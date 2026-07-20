'use strict';

const { logger } = require('../utils/logger');

/**
 * Simple per-user cooldown map for command spam protection.
 */
class CooldownManager {
  constructor() {
    /** @type {Map<string, number>} */
    this.map = new Map();
  }

  key(userId, commandName) {
    return `${userId}:${commandName}`;
  }

  /**
   * @returns {{ hit: boolean, remainingMs: number }}
   */
  check(userId, commandName, cooldownMs) {
    if (!cooldownMs || cooldownMs <= 0) return { hit: false, remainingMs: 0 };
    const k = this.key(userId, commandName);
    const until = this.map.get(k) || 0;
    const now = Date.now();
    if (now < until) return { hit: true, remainingMs: until - now };
    this.map.set(k, now + cooldownMs);
    return { hit: false, remainingMs: 0 };
  }

  clear(userId, commandName) {
    this.map.delete(this.key(userId, commandName));
  }
}

/**
 * Notify users about achievements in channel or DM-safe reply context.
 */
class NotificationService {
  /**
   * @param {object} config
   * @param {import('../achievements/AchievementEngine').AchievementEngine} achievementEngine
   */
  constructor(config, achievementEngine) {
    this.config = config;
    this.achievementEngine = achievementEngine;
  }

  /**
   * @param {import('discord.js').Message|import('discord.js').ChatInputCommandInteraction} ctx
   * @param {object[]} unlocked
   */
  async announceAchievements(ctx, unlocked) {
    if (!unlocked?.length) return;

    for (const achievement of unlocked) {
      if (achievement.notify === false) continue;
      const text = this.achievementEngine.notificationText(achievement);
      try {
        if (ctx.followUp) {
          await ctx.followUp({ content: text, ephemeral: false }).catch(async () => {
            if (ctx.channel) await ctx.channel.send(text);
          });
        } else if (ctx.reply) {
          await ctx.channel.send(text);
        }
      } catch (err) {
        logger.error('Achievement notify failed', err);
      }
    }
  }
}

module.exports = { CooldownManager, NotificationService };
