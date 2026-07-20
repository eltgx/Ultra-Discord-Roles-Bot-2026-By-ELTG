'use strict';

const { logger } = require('../utils/logger');

/**
 * Level-up claims, XP/level admin sets, and role sync.
 */
class LevelingService {
  /**
   * @param {object} options
   */
  constructor({ config, db, rankService, roleManager, boxService, achievementEngine }) {
    this.config = config;
    this.db = db;
    this.rankService = rankService;
    this.roleManager = roleManager;
    this.boxService = boxService;
    this.achievementEngine = achievementEngine;
  }

  getProfile(userId) {
    const user = this.db.getUser(userId);
    const progress = this.rankService.progress(user.xp);
    // Keep stored level consistent with XP
    const level = progress.level;
    if (user.level !== level) {
      this.db.setLevel(userId, level);
      user.level = level;
    }
    return { user, progress };
  }

  /**
   * Claim the highest earned rank (legacy `$levelup` behavior),
   * granting the box only the first time that rank is claimed.
   *
   * @param {import('discord.js').GuildMember} member
   */
  async levelUp(member) {
    const user = this.db.getUser(member.id);
    const index = this.rankService.indexForXp(user.xp);

    if (index === -1) {
      const first = this.rankService.ranks[0];
      return {
        status: 'need_xp',
        xpNeeded: Math.max(0, first.xpNeeded - user.xp),
        rank: first,
      };
    }

    const highest = this.rankService.ranks[index];
    const next = this.rankService.ranks[index + 1] || null;
    const alreadyHas = member.roles.cache.has(highest.roleId);

    if (alreadyHas) {
      if (!next) return { status: 'max', rank: highest };
      return {
        status: 'already',
        rank: highest,
        next,
        xpNeeded: Math.max(0, next.xpNeeded - user.xp),
      };
    }

    let previousName = 'No Rank';
    for (const rank of this.rankService.ranks) {
      if (rank.id !== highest.id && member.roles.cache.has(rank.roleId)) {
        previousName = rank.name;
      }
    }

    const sync = await this.roleManager.syncRankRole(member, highest);
    if (!sync.ok && sync.reason && sync.reason !== 'already') {
      return { status: 'role_error', reason: sync.reason, missing: sync.missing };
    }

    this.db.setLevel(member.id, index + 1);

    let boxGranted = null;
    const firstClaim = this.db.claimRank(member.id, highest.id);
    if (firstClaim) {
      const boxType = highest.rewardBox || 'common';
      this.boxService.grant(member.id, boxType, 1);
      boxGranted = this.boxService.getDefinition(boxType);
    }

    const unlocked = await this.achievementEngine.evaluate(member, this.db.getUser(member.id));

    logger.info(`Level up: ${member.id} → ${highest.name}`);

    return {
      status: 'leveled',
      from: previousName,
      rank: highest,
      box: boxGranted,
      firstClaim,
      unlocked,
    };
  }

  /**
   * Force-sync Discord roles to current XP without granting boxes.
   */
  async sync(member) {
    const user = this.db.getUser(member.id);
    const rank = this.rankService.rankForXp(user.xp);
    const level = this.rankService.levelForXp(user.xp);
    this.db.setLevel(member.id, level);
    const result = await this.roleManager.syncRankRole(member, rank);
    const unlocked = await this.achievementEngine.evaluate(member, this.db.getUser(member.id));
    return { user, rank, level, result, unlocked };
  }

  /**
   * Admin: set level and matching XP threshold.
   */
  async setLevel(member, level) {
    const safeLevel = Math.max(1, Math.min(level, this.rankService.ranks.length));
    const xp = this.rankService.xpForLevel(safeLevel);
    this.db.setXpAndLevel(member.id, xp, safeLevel);
    const rank = this.rankService.rankForLevel(safeLevel);
    await this.roleManager.syncRankRole(member, rank);
    const unlocked = await this.achievementEngine.evaluate(member, this.db.getUser(member.id));
    return { level: safeLevel, xp, rank, unlocked };
  }

  /**
   * Admin: set XP and recalculate level + roles.
   */
  async setXp(member, xp) {
    const safeXp = Math.max(0, xp);
    const level = this.rankService.levelForXp(safeXp);
    this.db.setXpAndLevel(member.id, safeXp, level);
    const rank = this.rankService.rankForXp(safeXp);
    await this.roleManager.syncRankRole(member, rank);
    const unlocked = await this.achievementEngine.evaluate(member, this.db.getUser(member.id));
    return { xp: safeXp, level, rank, unlocked };
  }

  /**
   * After XP grants (voice / boxes), optionally auto level-up and always evaluate achievements.
   */
  async afterXpGain(member) {
    const unlocked = await this.achievementEngine.evaluate(member, this.db.getUser(member.id));
    let levelUpResult = null;
    if (this.config.features.autoLevelUp && member) {
      const user = this.db.getUser(member.id);
      const rank = this.rankService.rankForXp(user.xp);
      if (rank && !member.roles.cache.has(rank.roleId)) {
        levelUpResult = await this.levelUp(member);
      }
    } else if (member) {
      // Keep DB level column fresh without role changes
      const user = this.db.getUser(member.id);
      const level = this.rankService.levelForXp(user.xp);
      if (user.level !== level) this.db.setLevel(member.id, level);
    }
    return { unlocked, levelUpResult };
  }
}

module.exports = { LevelingService };
