'use strict';

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

function emptyUser(id) {
  return {
    id,
    xp: 0,
    level: 0,
    points: 0,
    total_points: 0,
    rep: 0,
    voice_seconds: 0,
    rep_cooldown: 0,
  };
}

function emptyStore() {
  return {
    users: {},
    boxes: {},
    vip: {},
    achievements: {},
    claimed_ranks: {},
    temporary_roles: [],
  };
}

/**
 * Pure-JS JSON database — no native modules (ModVC / free-host friendly).
 * Same public API as the previous SQLite implementation.
 */
class BotDatabase {
  /**
   * @param {string} dbPath Absolute or relative path to the JSON file
   */
  constructor(dbPath) {
    this.dbPath = dbPath.endsWith('.sqlite')
      ? dbPath.replace(/\.sqlite$/i, '.json')
      : dbPath;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.data = this.#load();
    this._dirty = false;
    this._saveTimer = null;
    this._saving = false;

    process.on('exit', () => this.#flushSync());
    logger.info(`Database ready at ${this.dbPath}`);
  }

  #load() {
    if (!fs.existsSync(this.dbPath)) return emptyStore();
    try {
      const parsed = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
      return {
        ...emptyStore(),
        ...parsed,
        users: parsed.users || {},
        boxes: parsed.boxes || {},
        vip: parsed.vip || {},
        achievements: parsed.achievements || {},
        claimed_ranks: parsed.claimed_ranks || {},
        temporary_roles: Array.isArray(parsed.temporary_roles) ? parsed.temporary_roles : [],
      };
    } catch (err) {
      logger.error('Failed to read database — starting empty store', err);
      return emptyStore();
    }
  }

  #markDirty() {
    this._dirty = true;
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.#flushSync();
    }, 250);
    if (this._saveTimer.unref) this._saveTimer.unref();
  }

  #flushSync() {
    if (!this._dirty || this._saving) return;
    this._saving = true;
    try {
      const tmp = `${this.dbPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf8');
      fs.renameSync(tmp, this.dbPath);
      this._dirty = false;
    } catch (err) {
      logger.error('Failed to persist database', err);
    } finally {
      this._saving = false;
    }
  }

  /** Force immediate write (shutdown / critical paths). */
  saveNow() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this.#flushSync();
  }

  ensureUser(userId) {
    if (!this.data.users[userId]) {
      this.data.users[userId] = emptyUser(userId);
      this.#markDirty();
    }
  }

  getUser(userId) {
    this.ensureUser(userId);
    return { ...this.data.users[userId] };
  }

  applyVoiceReward(userId, xp, points, voiceSeconds) {
    this.ensureUser(userId);
    const u = this.data.users[userId];
    u.xp += xp;
    u.points += points;
    u.total_points += points;
    u.voice_seconds += voiceSeconds;
    this.#markDirty();
    return this.getUser(userId);
  }

  applyVoiceRewardBatch(batch) {
    for (const row of batch) {
      this.applyVoiceReward(row.userId, row.xp, row.points, row.voiceSeconds);
    }
    this.saveNow();
  }

  setXp(userId, xp) {
    this.ensureUser(userId);
    this.data.users[userId].xp = xp;
    this.#markDirty();
    return this.getUser(userId);
  }

  setLevel(userId, level) {
    this.ensureUser(userId);
    this.data.users[userId].level = level;
    this.#markDirty();
    return this.getUser(userId);
  }

  setXpAndLevel(userId, xp, level) {
    this.ensureUser(userId);
    this.data.users[userId].xp = xp;
    this.data.users[userId].level = level;
    this.#markDirty();
    return this.getUser(userId);
  }

  addXp(userId, amount) {
    this.ensureUser(userId);
    this.data.users[userId].xp += amount;
    this.#markDirty();
    return this.getUser(userId);
  }

  addPoints(userId, amount) {
    this.ensureUser(userId);
    this.data.users[userId].points += amount;
    this.data.users[userId].total_points += amount;
    this.#markDirty();
    return this.getUser(userId);
  }

  setPoints(userId, amount) {
    this.ensureUser(userId);
    this.data.users[userId].points = amount;
    this.#markDirty();
  }

  setTotalPoints(userId, amount) {
    this.ensureUser(userId);
    this.data.users[userId].total_points = amount;
    this.#markDirty();
  }

  setVoiceSeconds(userId, amount) {
    this.ensureUser(userId);
    this.data.users[userId].voice_seconds = amount;
    this.#markDirty();
  }

  setRep(userId, amount) {
    this.ensureUser(userId);
    this.data.users[userId].rep = amount;
    this.#markDirty();
  }

  addRep(userId, amount = 1) {
    this.ensureUser(userId);
    this.data.users[userId].rep += amount;
    this.#markDirty();
    return this.getUser(userId);
  }

  setRepCooldown(userId, timestamp) {
    this.ensureUser(userId);
    this.data.users[userId].rep_cooldown = timestamp;
    this.#markDirty();
  }

  getTop(stat, limit = 10) {
    const map = {
      leveling: 'xp',
      reputation: 'rep',
      afk_time: 'voice_seconds',
      voice: 'voice_seconds',
    };
    const column = map[stat] || stat;
    return Object.values(this.data.users)
      .filter((u) => (u[column] || 0) > 0)
      .sort((a, b) => (b[column] || 0) - (a[column] || 0))
      .slice(0, limit)
      .map((u) => ({ id: u.id, value: u[column] || 0 }));
  }

  getBoxCount(userId, boxType) {
    this.ensureUser(userId);
    return this.data.boxes[userId]?.[boxType] || 0;
  }

  getAllBoxes(userId) {
    this.ensureUser(userId);
    return { ...(this.data.boxes[userId] || {}) };
  }

  addBoxes(userId, boxType, amount) {
    this.ensureUser(userId);
    if (!this.data.boxes[userId]) this.data.boxes[userId] = {};
    this.data.boxes[userId][boxType] = (this.data.boxes[userId][boxType] || 0) + amount;
    this.#markDirty();
    return this.getBoxCount(userId, boxType);
  }

  consumeBox(userId, boxType) {
    const current = this.getBoxCount(userId, boxType);
    if (current <= 0) return false;
    this.data.boxes[userId][boxType] = current - 1;
    this.#markDirty();
    return true;
  }

  openBoxTransaction(userId, boxType, points, xp) {
    if (!this.consumeBox(userId, boxType)) return false;
    this.addPoints(userId, points);
    this.addXp(userId, xp);
    this.saveNow();
    return true;
  }

  getVip(userId) {
    const row = this.data.vip[userId];
    if (!row) return null;
    return { user_id: userId, expires_at: row.expires_at };
  }

  setVipExpiry(userId, expiresAt) {
    this.ensureUser(userId);
    this.data.vip[userId] = { expires_at: expiresAt };
    this.#markDirty();
  }

  clearVip(userId) {
    delete this.data.vip[userId];
    this.#markDirty();
  }

  getExpiredVip(now = Date.now()) {
    return Object.entries(this.data.vip)
      .filter(([, row]) => row.expires_at !== null && row.expires_at !== undefined && row.expires_at <= now)
      .map(([userId, row]) => ({ user_id: userId, expires_at: row.expires_at }));
  }

  hasAchievement(userId, achievementId) {
    return Boolean(this.data.achievements[userId]?.[achievementId]);
  }

  unlockAchievement(userId, achievementId, at = Date.now()) {
    this.ensureUser(userId);
    if (!this.data.achievements[userId]) this.data.achievements[userId] = {};
    if (this.data.achievements[userId][achievementId]) return false;
    this.data.achievements[userId][achievementId] = at;
    this.#markDirty();
    return true;
  }

  listAchievements(userId) {
    const map = this.data.achievements[userId] || {};
    return Object.entries(map).map(([achievement_id, unlocked_at]) => ({
      achievement_id,
      unlocked_at,
    }));
  }

  hasClaimedRank(userId, rankId) {
    return Boolean(this.data.claimed_ranks[userId]?.[rankId]);
  }

  claimRank(userId, rankId, at = Date.now()) {
    this.ensureUser(userId);
    if (!this.data.claimed_ranks[userId]) this.data.claimed_ranks[userId] = {};
    if (this.data.claimed_ranks[userId][rankId]) return false;
    this.data.claimed_ranks[userId][rankId] = at;
    this.#markDirty();
    return true;
  }

  addTemporaryRole(userId, guildId, roleId, expiresAt) {
    const list = this.data.temporary_roles;
    const idx = list.findIndex(
      (r) => r.user_id === userId && r.guild_id === guildId && r.role_id === roleId
    );
    const row = { user_id: userId, guild_id: guildId, role_id: roleId, expires_at: expiresAt };
    if (idx >= 0) list[idx] = row;
    else list.push(row);
    this.#markDirty();
  }

  getExpiredTemporaryRoles(now = Date.now()) {
    return this.data.temporary_roles.filter((r) => r.expires_at <= now);
  }

  removeTemporaryRole(userId, guildId, roleId) {
    this.data.temporary_roles = this.data.temporary_roles.filter(
      (r) => !(r.user_id === userId && r.guild_id === guildId && r.role_id === roleId)
    );
    this.#markDirty();
  }

  close() {
    this.saveNow();
  }
}

module.exports = { BotDatabase };
