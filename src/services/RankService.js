'use strict';

/**
 * Pure helpers for rank / level math from XP.
 */
class RankService {
  /**
   * @param {Array<{ id: string, name: string, roleId: string, xpNeeded: number, rewardBox: string, priority: number }>} ranks
   */
  constructor(ranks) {
    this.ranks = [...ranks].sort((a, b) => a.xpNeeded - b.xpNeeded);
  }

  /**
   * Highest rank the user qualifies for (0-based index), or -1.
   * @param {number} xp
   * @returns {number}
   */
  indexForXp(xp) {
    let highest = -1;
    for (let i = 0; i < this.ranks.length; i++) {
      if (xp >= this.ranks[i].xpNeeded) highest = i;
      else break;
    }
    return highest;
  }

  /**
   * Level is 1-based rank index; 0 means no rank yet.
   * @param {number} xp
   * @returns {number}
   */
  levelForXp(xp) {
    const index = this.indexForXp(xp);
    return index === -1 ? 0 : index + 1;
  }

  /**
   * @param {number} xp
   * @returns {object|null}
   */
  rankForXp(xp) {
    const index = this.indexForXp(xp);
    return index === -1 ? null : this.ranks[index];
  }

  /**
   * @param {number} level 1-based
   * @returns {object|null}
   */
  rankForLevel(level) {
    if (level < 1) return null;
    const index = Math.min(level - 1, this.ranks.length - 1);
    return this.ranks[index] || null;
  }

  /**
   * XP required to sit at a given 1-based level.
   * @param {number} level
   * @returns {number}
   */
  xpForLevel(level) {
    if (level <= 1) return this.ranks[0]?.xpNeeded ?? 0;
    const rank = this.rankForLevel(level);
    return rank?.xpNeeded ?? 0;
  }

  /**
   * Progress within current tier toward next rank.
   * @param {number} xp
   */
  progress(xp) {
    const index = this.indexForXp(xp);
    const current = index === -1 ? null : this.ranks[index];
    const next = this.ranks[index + 1] || null;

    const minXp = current ? current.xpNeeded : 0;
    const maxXp = next ? next.xpNeeded : minXp;
    let span = maxXp - minXp;
    if (span <= 0) span = 100;

    const into = Math.max(0, xp - minXp);
    let percent = (into / span) * 100;
    if (!next) percent = 100;
    percent = Math.max(0, Math.min(100, percent));

    const remaining = next ? Math.max(0, next.xpNeeded - xp) : 0;

    return {
      level: index === -1 ? 0 : index + 1,
      current,
      next,
      minXp,
      maxXp: next ? next.xpNeeded : xp,
      remaining,
      percent,
      atMax: !next && index !== -1,
    };
  }

  allRankRoleIds() {
    return this.ranks.map((r) => r.roleId);
  }
}

module.exports = { RankService };
