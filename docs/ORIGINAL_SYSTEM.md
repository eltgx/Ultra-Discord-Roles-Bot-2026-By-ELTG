# Original System — Reverse Engineering Report

Source analyzed: `message.txt` (monolithic Discord.js bot, ~767 lines).

## What the Bot Does

A **voice-activity leveling / rank-reward bot** (branded “ShortiesCord Real-Time Bot”) that:

1. Awards XP and points for active voice presence
2. Unlocks progressive **rank roles** (Bronze → Elite) via `$levelup`
3. Grants **loot boxes** on rank-up and via admin / box opening
4. Manages **VIP+** memberships (timed, color name roles, XP boost)
5. Tracks **reputation**, **voice time**, and shows **leaderboards / profiles**

---

## Core Systems

### 1. Voice XP Loop (`setInterval`, every 3 minutes)

For each guild member in a voice channel:

| Condition | Effect |
|-----------|--------|
| Alone in VC (≤1 non-bot) | Skip (anti-AFK) |
| Muted or deafened | Skip |
| VIP+ role | +30 XP |
| Normal | +15 XP |
| Always (if eligible) | +2 points, +2 total_points, +180s voice time |

### 2. Rank / Level System

Hardcoded `ranks[]` array: each entry has `id` (role), `xpNeeded`, `name`, `rewardBox`.

- Level ≈ index of highest rank whose `xpNeeded` ≤ current XP
- `$levelup` is **manual**: checks XP, assigns highest earned rank role, removes other rank roles, grants 1 reward box
- `$setlevel` / `$setxp` (admin) write DB directly; `$setlevel` does **not** sync Discord roles

### 3. Loot Boxes

Types: `common`, `rare`, `legendary`, `mythic` — random points + XP ranges.

Bonus rolls when opening:

- Mythic: 15% → 3 days VIP+
- Legendary: 5% → 1 day VIP+

### 4. VIP+

- Role + DB key `vipplus_expiry_<userId>` (`timestamp` or intended `"lifetime"`)
- `$givevipplus @user 30d|1y` — grant/extend
- Interval removes expired VIP+ and all color roles
- `/color` — exclusive VIP+ (or admin whitelist) name colors

### 5. Reputation

`$rep @user` — +1 rep, 24h cooldown per giver. No self/bots.

### 6. Commands

| Command | Type | Who | Purpose |
|---------|------|-----|---------|
| `/top` | Slash | Everyone | Top 10 leveling / reputation / voice hours |
| `/color` | Slash | VIP+ / admin | Set or clear name color |
| `$givevipplus` | Prefix | Admin roles / owner | Grant timed VIP+ |
| `$membership` | Prefix | Everyone | VIP+ expiry info |
| `$givebox` | Prefix | Admin | Give boxes |
| `$setlevel` | Prefix | Admin | Force level + matching XP |
| `$setxp` | Prefix | Admin | Force XP + recalculate level |
| `$boxes` | Prefix | Everyone | Inventory / open box |
| `$levelup` | Prefix | Everyone | Claim rank role + box |
| `$p` | Prefix | Everyone | Profile (self or mention) |
| `$modifier` | Prefix | Everyone | Show current XP rates |
| `$rep` | Prefix | Everyone | Give reputation |

### 7. Database (QuickDB)

Flat key-value store, no schema:

| Key pattern | Meaning |
|-------------|---------|
| `xp_<id>` | Experience |
| `level_<id>` | Stored level (often out of sync with roles) |
| `points_<id>` | Spendable points |
| `total_points_<id>` | Lifetime points |
| `afk_time_<id>` | Voice seconds (misnamed “AFK”) |
| `rep_<id>` | Reputation |
| `rep_cooldown_<id>` | Last rep timestamp |
| `box_<type>_<id>` | Box counts |
| `vipplus_expiry_<id>` | VIP expiry ms or `"lifetime"` |

### 8. Permissions

- Admin = any of `whitelistedRoles` **or** guild owner
- VIP+ gated: `/color`, higher voice XP
- No Discord permission bit checks (Manage Roles, etc.) before role edits

### 9. Events

- `ready` — register guild slash commands; start VIP + voice interval
- `interactionCreate` — `/color`, `/top`
- `messageCreate` — all `$` prefix commands + no chat XP

---

## Bugs & Weaknesses Found

### Critical / Security

1. **Bot token hardcoded** in source — must be revoked and rotated immediately
2. **Message Content intent** required for all prefix commands; no slash equivalents for most features
3. Admin check is role-ID whitelist only — no Discord permission fallback
4. Role hierarchy failures only logged; partial success leaves inconsistent state

### Logic Bugs

5. **Bronze V role ID truncated**: `"149902513075398749"` (likely invalid snowflake)
6. `$levelup` awards a box every claim of a *new* highest role, but never auto-claims skipped ranks’ boxes if XP jumps
7. `$setlevel` / `$setxp` update DB but **do not** update Discord roles or grant boxes
8. VIP `"lifetime"` is written nowhere; `$membership` shows “Permanent” when role exists but no expiry key — ambiguous
9. `$p` matches any message starting with `$p` (e.g. `$please`, `$points` if added later)
10. Leaderboard `db.all()` loads **entire database** every `/top` call — O(n) scan
11. Voice loop calls `db.all()` every 3 minutes **per guild** for VIP expiry — same issue
12. AFK time for leaderboard converts to hours with `Math.floor` — users under 1h show as 0 and sort poorly
13. Color choice display uses single `replace('_', ' ')` — only first underscore
14. Opening a box adds XP but does **not** trigger level-up / role sync
15. Expired VIP removal runs inside each guild loop but VIP keys are **global** — multi-guild bots behave incorrectly
16. No transaction around box open (sub box → add rewards); crash mid-way can lose the box

### Scalability

17. Single-file monolith (~767 lines)
18. Full-table scans for leaderboards and VIP expiry
19. Per-member sequential `roles.add` / `roles.remove` without batching
20. Sequential `users.fetch` for top 10 (no cache preference)
21. Interval has no overlap guard — slow loops can stack

### Maintainability

22. Hardcoded guild / role IDs and magic numbers throughout
23. Duplicated VIP extend logic (givevipplus + box bonuses)
24. Duplicated leaderboard embed building (3 nearly identical blocks)
25. Duplicated rank-from-XP calculation in `$p`, `$levelup`, `$setxp`
26. Unused / misleading naming (`afk_time` = active voice time)
27. Arabic comments mixed with English UX; no docs or env config
28. No logging framework, no graceful shutdown, minimal try/catch on message handlers
29. Slash commands registered only for one hardcoded guild

### UX Gaps

30. Plain text errors; weak embeds; no progress bar on profile
31. No achievement notifications beyond rank-up text
32. No sync command when roles drift from XP
33. Cooldown message only on `$rep`; no global command cooldowns
34. Missing bot permission warnings before failing role ops

---

## What to Preserve Externally

- Voice XP rates and anti-cheat rules
- Rank ladder thresholds and box rewards
- Box loot tables and VIP lottery odds
- VIP+ duration model and color exclusivity
- Reputation cooldown (24h)
- Command surface (slash + familiar `$` aliases)

## What to Rewrite Internally

- Modular architecture + config-driven IDs
- SQLite schema instead of flat QuickDB keys
- Achievement engine + RoleManager
- Auto-evaluation of unlocks after XP/rep/voice changes
- Production logging, validation, and crash isolation
