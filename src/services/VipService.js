'use strict';

const { logger } = require('../utils/logger');
const { parseDuration, formatDateTime } = require('../utils/formatters');

/**
 * VIP+ membership grant, extend, expiry, and cleanup.
 */
class VipService {
  /**
   * @param {object} options
   * @param {object} options.config
   * @param {import('../database/Database').BotDatabase} options.db
   * @param {import('../managers/RoleManager').RoleManager} options.roleManager
   * @param {import('discord.js').Client} options.client
   */
  constructor({ config, db, roleManager, client }) {
    this.config = config;
    this.db = db;
    this.roleManager = roleManager;
    this.client = client;
  }

  get roleId() {
    return this.config.roles.vipPlus;
  }

  /**
   * @param {string} userId
   * @returns {{ active: boolean, lifetime: boolean, expiresAt: number|null }}
   */
  getStatus(userId) {
    const row = this.db.getVip(userId);
    if (!row) {
      return { active: false, lifetime: false, expiresAt: null };
    }
    if (row.expires_at === null) {
      return { active: true, lifetime: true, expiresAt: null };
    }
    if (row.expires_at > Date.now()) {
      return { active: true, lifetime: false, expiresAt: row.expires_at };
    }
    return { active: false, lifetime: false, expiresAt: row.expires_at };
  }

  /**
   * Grant or extend VIP by a duration string (`30d`, `1y`, …) or `lifetime`.
   * @param {import('discord.js').GuildMember} member
   * @param {string} durationStr
   */
  async grant(member, durationStr) {
    if (durationStr.toLowerCase() === 'lifetime') {
      this.db.setVipExpiry(member.id, null);
      await this.roleManager.addRole(member, this.roleId);
      return { lifetime: true, expiresAt: null };
    }

    const ms = parseDuration(durationStr);
    if (ms === null) return { error: 'invalid_duration' };

    const current = this.db.getVip(member.id);
    let newExpiry = Date.now() + ms;

    if (current?.expires_at === null) {
      // already lifetime — keep lifetime
      await this.roleManager.addRole(member, this.roleId);
      return { lifetime: true, expiresAt: null, extended: false };
    }

    if (current?.expires_at && current.expires_at > Date.now()) {
      newExpiry = current.expires_at + ms;
    }

    this.db.setVipExpiry(member.id, newExpiry);
    await this.roleManager.addRole(member, this.roleId);
    return { lifetime: false, expiresAt: newExpiry, formatted: formatDateTime(newExpiry) };
  }

  /**
   * Extend VIP by milliseconds (box bonuses).
   */
  async extendMs(member, ms) {
    const current = this.db.getVip(member.id);
    if (current?.expires_at === null) {
      await this.roleManager.addRole(member, this.roleId);
      return { lifetime: true };
    }

    let newExpiry = Date.now() + ms;
    if (current?.expires_at && current.expires_at > Date.now()) {
      newExpiry = current.expires_at + ms;
    }

    this.db.setVipExpiry(member.id, newExpiry);
    await this.roleManager.addRole(member, this.roleId);
    return { lifetime: false, expiresAt: newExpiry };
  }

  /**
   * Strip VIP role + colors for expired memberships (once globally).
   */
  async processExpiries() {
    const expired = this.db.getExpiredVip(Date.now());
    if (expired.length === 0) return;

    for (const row of expired) {
      this.db.clearVip(row.user_id);

      for (const guild of this.client.guilds.cache.values()) {
        try {
          const member = await guild.members.fetch(row.user_id).catch(() => null);
          if (!member) continue;

          if (member.roles.cache.has(this.roleId)) {
            await this.roleManager.removeRole(member, this.roleId);
          }
          await this.roleManager.clearColors(member);

          if (this.config.features.dmOnVipExpiry) {
            await member.send(this.config.messages.vip.expired).catch(() => {});
          }

          logger.info(`[VIP+] Expired for ${member.user.tag} in ${guild.id}`);
        } catch (err) {
          logger.error(`VIP expiry handling failed for ${row.user_id}`, err);
        }
      }
    }
  }
}

module.exports = { VipService };
