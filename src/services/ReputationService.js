'use strict';

const { formatDuration } = require('../utils/formatters');

class ReputationService {
  /**
   * @param {object} options
   * @param {object} options.config
   * @param {import('../database/Database').BotDatabase} options.db
   * @param {import('./LevelingService').LevelingService} options.levelingService
   */
  constructor({ config, db, levelingService }) {
    this.config = config;
    this.db = db;
    this.levelingService = levelingService;
  }

  /**
   * @param {import('discord.js').GuildMember} giver
   * @param {import('discord.js').GuildMember} target
   */
  async give(giver, target) {
    if (!target) return { error: 'mention_required' };
    if (target.id === giver.id) return { error: 'self' };
    if (target.user.bot) return { error: 'bot' };

    const giverRow = this.db.getUser(giver.id);
    const cooldown = this.config.reputation.cooldownMs;
    const elapsed = Date.now() - (giverRow.rep_cooldown || 0);

    if (elapsed < cooldown) {
      return {
        error: 'cooldown',
        remaining: formatDuration(cooldown - elapsed),
      };
    }

    this.db.addRep(target.id, this.config.reputation.amount);
    this.db.setRepCooldown(giver.id, Date.now());

    const unlocked = await this.levelingService.achievementEngine.evaluate(
      target,
      this.db.getUser(target.id)
    );

    return { ok: true, unlocked };
  }
}

module.exports = { ReputationService };
