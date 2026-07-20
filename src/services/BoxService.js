'use strict';

const { randomInt, chance } = require('../utils/helpers');
const { parseDuration } = require('../utils/formatters');
const { logger } = require('../utils/logger');

/**
 * Loot box inventory and opening logic.
 */
class BoxService {
  /**
   * @param {object} options
   * @param {object} options.config
   * @param {import('../database/Database').BotDatabase} options.db
   * @param {import('./VipService').VipService} options.vipService
   */
  constructor({ config, db, vipService }) {
    this.config = config;
    this.db = db;
    this.vipService = vipService;
  }

  types() {
    return Object.keys(this.config.boxes);
  }

  getDefinition(boxType) {
    return this.config.boxes[boxType] || null;
  }

  grant(userId, boxType, amount = 1) {
    if (!this.config.boxes[boxType]) {
      throw new Error(`Unknown box type: ${boxType}`);
    }
    return this.db.addBoxes(userId, boxType, amount);
  }

  inventory(userId) {
    const counts = this.db.getAllBoxes(userId);
    const result = {};
    for (const type of this.types()) {
      result[type] = counts[type] || 0;
    }
    return result;
  }

  /**
   * Open one box. Returns loot details or an error code.
   * @param {import('discord.js').GuildMember} member
   * @param {string} boxType
   */
  async open(member, boxType) {
    const def = this.getDefinition(boxType);
    if (!def) return { error: 'invalid_type' };

    const points = randomInt(def.minPoints, def.maxPoints);
    const xp = randomInt(def.minXp, def.maxXp);

    const applied = this.db.openBoxTransaction(member.id, boxType, points, xp);
    if (!applied) return { error: 'empty' };

    let vipBonus = null;
    if (def.vipBonus?.chancePercent && chance(def.vipBonus.chancePercent)) {
      const ms = parseDuration(def.vipBonus.duration);
      if (ms) {
        await this.vipService.extendMs(member, ms);
        vipBonus = { duration: def.vipBonus.duration };
        logger.info(`Box VIP bonus: ${boxType} → ${member.id} (${def.vipBonus.duration})`);
      }
    }

    const user = this.db.getUser(member.id);
    return {
      boxType,
      def,
      points,
      xp,
      vipBonus,
      user,
    };
  }
}

module.exports = { BoxService };
