'use strict';

const { logger } = require('../utils/logger');

/**
 * Periodic voice XP / points / time rewards with anti-cheat filters.
 */
class VoiceRewardService {
  /**
   * @param {object} options
   */
  constructor({ client, config, db, levelingService }) {
    this.client = client;
    this.config = config;
    this.db = db;
    this.levelingService = levelingService;
    this.running = false;
    this.timer = null;
    this.tickInProgress = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const interval = this.config.voiceRewards.intervalMs;
    this.timer = setInterval(() => {
      this.tick().catch((err) => logger.error('Voice reward tick failed', err));
    }, interval);
    // Allow process to exit even if timer is active in tests; keep default for bots
    if (this.timer.unref) this.timer.unref();
    logger.info(`Voice reward loop started (every ${interval}ms)`);
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * @param {import('discord.js').GuildMember} member
   * @param {import('discord.js').VoiceState} voiceState
   */
  isEligible(member, voiceState) {
    const cfg = this.config.voiceRewards;
    if (!voiceState.channelId || !member || member.user.bot) return false;

    const channel = voiceState.channel;
    if (!channel) return false;

    const humans = channel.members.filter((m) => !m.user.bot).size;
    if (humans < cfg.minHumanMembers) return false;

    if (cfg.requireUnmuted && (voiceState.selfMute || voiceState.serverMute)) return false;
    if (cfg.requireUndeafened && (voiceState.selfDeaf || voiceState.serverDeaf)) return false;

    return true;
  }

  xpForMember(member) {
    const vipId = this.config.roles.vipPlus;
    const isVip = vipId && member.roles.cache.has(vipId);
    return isVip ? this.config.voiceRewards.vipXp : this.config.voiceRewards.baseXp;
  }

  async tick() {
    if (this.tickInProgress) {
      logger.warn('Skipping voice tick — previous still running');
      return;
    }
    this.tickInProgress = true;

    try {
      const cfg = this.config.voiceRewards;
      const voiceSeconds = Math.floor(cfg.intervalMs / 1000);
      const batch = [];
      /** @type {Map<string, import('discord.js').GuildMember>} */
      const membersById = new Map();

      for (const guild of this.client.guilds.cache.values()) {
        for (const voiceState of guild.voiceStates.cache.values()) {
          const member = voiceState.member;
          if (!member || !this.isEligible(member, voiceState)) continue;

          batch.push({
            userId: member.id,
            xp: this.xpForMember(member),
            points: cfg.points,
            voiceSeconds,
          });
          membersById.set(member.id, member);
        }
      }

      if (batch.length === 0) return;

      this.db.applyVoiceRewardBatch(batch);

      // Evaluate achievements without flooding; process sequentially with soft limit
      let evaluated = 0;
      for (const [userId, member] of membersById) {
        if (evaluated >= 50) break;
        try {
          await this.levelingService.afterXpGain(member);
          evaluated += 1;
        } catch (err) {
          logger.error(`Post-voice evaluate failed for ${userId}`, err);
        }
      }

      logger.debug(`Voice rewards applied to ${batch.length} members`);
    } finally {
      this.tickInProgress = false;
    }
  }
}

module.exports = { VoiceRewardService };
