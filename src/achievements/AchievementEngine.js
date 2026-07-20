'use strict';

const { logger } = require('../utils/logger');
const { fill } = require('../utils/formatters');

/**
 * Configurable achievement engine.
 * Evaluates requirements against user stats and applies rewards.
 */
class AchievementEngine {
  /**
   * @param {object} options
   * @param {object} options.config
   * @param {import('../database/Database').BotDatabase} options.db
   * @param {import('../managers/RoleManager').RoleManager} options.roleManager
   * @param {import('./BoxService').BoxService} options.boxService
   * @param {import('./RankService').RankService} options.rankService
   */
  constructor({ config, db, roleManager, boxService, rankService }) {
    this.config = config;
    this.db = db;
    this.roleManager = roleManager;
    this.boxService = boxService;
    this.rankService = rankService;
    this.definitions = config.achievements || [];
  }

  /**
   * Snapshot of metrics used by requirement checks.
   * @param {object} userRow
   */
  buildContext(userRow) {
    const level = userRow.level || this.rankService.levelForXp(userRow.xp || 0);
    return {
      xp: userRow.xp || 0,
      level,
      reputation: userRow.rep || 0,
      voice_seconds: userRow.voice_seconds || 0,
      voice_hours: Math.floor((userRow.voice_seconds || 0) / 3600),
      points: userRow.points || 0,
      total_points: userRow.total_points || 0,
    };
  }

  /**
   * @param {object} requirement
   * @param {object} ctx
   * @returns {boolean}
   */
  meets(requirement, ctx) {
    if (!requirement?.type) return false;
    const amount = Number(requirement.amount) || 0;

    switch (requirement.type) {
      case 'xp':
        return ctx.xp >= amount;
      case 'level':
        return ctx.level >= amount;
      case 'reputation':
      case 'rep':
        return ctx.reputation >= amount;
      case 'voice_seconds':
        return ctx.voice_seconds >= amount;
      case 'voice_hours':
        return ctx.voice_hours >= amount;
      case 'points':
        return ctx.points >= amount;
      case 'total_points':
        return ctx.total_points >= amount;
      default:
        logger.warn(`Unknown achievement requirement type: ${requirement.type}`);
        return false;
    }
  }

  /**
   * Progress 0–1 toward a requirement.
   */
  progress(requirement, ctx) {
    const amount = Number(requirement.amount) || 1;
    let current = 0;
    switch (requirement.type) {
      case 'xp': current = ctx.xp; break;
      case 'level': current = ctx.level; break;
      case 'reputation':
      case 'rep': current = ctx.reputation; break;
      case 'voice_seconds': current = ctx.voice_seconds; break;
      case 'voice_hours': current = ctx.voice_hours; break;
      case 'points': current = ctx.points; break;
      case 'total_points': current = ctx.total_points; break;
      default: current = 0;
    }
    return Math.max(0, Math.min(1, current / amount));
  }

  /**
   * Evaluate all achievements for a user; unlock newly earned ones.
   * @param {import('discord.js').GuildMember|null} member
   * @param {object} [userRow]
   * @returns {Promise<object[]>} newly unlocked definitions
   */
  async evaluate(member, userRow) {
    if (!this.config.features?.autoEvaluateAchievements) return [];

    const userId = member?.id || userRow?.id;
    if (!userId) return [];

    const row = userRow || this.db.getUser(userId);
    const ctx = this.buildContext(row);
    const unlocked = [];

    for (const achievement of this.definitions) {
      if (this.db.hasAchievement(userId, achievement.id)) continue;
      if (!this.meets(achievement.requirement, ctx)) continue;

      const isNew = this.db.unlockAchievement(userId, achievement.id);
      if (!isNew) continue;

      await this.#applyRewards(member, userId, achievement);
      unlocked.push(achievement);
      logger.info(`Achievement unlocked: ${achievement.id} for ${userId}`);
    }

    return unlocked;
  }

  async #applyRewards(member, userId, achievement) {
    if (achievement.rewardRole && member) {
      await this.roleManager.addRole(member, achievement.rewardRole);
    }

    for (const reward of achievement.rewards || []) {
      switch (reward.type) {
        case 'box':
          this.boxService.grant(userId, reward.boxType, reward.amount || 1);
          break;
        case 'points':
          this.db.addPoints(userId, reward.amount || 0);
          break;
        case 'xp':
          this.db.addXp(userId, reward.amount || 0);
          break;
        case 'role':
          if (member && reward.roleId) {
            if (reward.durationMs) {
              await this.roleManager.grantTemporaryRole(
                member,
                reward.roleId,
                Date.now() + reward.durationMs,
                `achievement:${achievement.id}`
              );
            } else {
              await this.roleManager.addRole(member, reward.roleId);
            }
          }
          break;
        default:
          logger.warn(`Unknown achievement reward type: ${reward.type}`);
      }
    }
  }

  /**
   * List visible achievements with unlock status for UI.
   */
  listForUser(userId) {
    const row = this.db.getUser(userId);
    const ctx = this.buildContext(row);
    const unlockedIds = new Set(this.db.listAchievements(userId).map((a) => a.achievement_id));

    return this.definitions
      .filter((a) => !a.hidden || unlockedIds.has(a.id))
      .map((a) => ({
        ...a,
        unlocked: unlockedIds.has(a.id),
        progress: this.progress(a.requirement, ctx),
      }));
  }

  /**
   * Build a short reward summary string.
   */
  formatRewards(achievement) {
    const parts = [];
    if (achievement.rewardRole) parts.push(`role`);
    for (const r of achievement.rewards || []) {
      if (r.type === 'box') parts.push(`${r.amount || 1}× ${r.boxType} box`);
      if (r.type === 'points') parts.push(`${r.amount} points`);
      if (r.type === 'xp') parts.push(`${r.amount} XP`);
      if (r.type === 'role') parts.push('bonus role');
    }
    return parts.join(', ') || 'none';
  }

  notificationText(achievement) {
    const msg = this.config.messages.achievements;
    let text = fill(msg.unlocked, {
      icon: achievement.icon || '🏆',
      name: achievement.name,
      description: achievement.description || '',
    });
    const rewards = this.formatRewards(achievement);
    if (rewards !== 'none') {
      text += `\n${fill(msg.rewardSummary, { rewards })}`;
    }
    return text;
  }
}

module.exports = { AchievementEngine };
