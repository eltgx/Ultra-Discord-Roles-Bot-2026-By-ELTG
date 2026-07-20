'use strict';

const { PermissionFlagsBits } = require('discord.js');
const { logger } = require('../utils/logger');
const { missingBotPermissions } = require('../utils/permissions');

/**
 * Centralized Discord role operations with hierarchy checks,
 * exclusive groups, priority, and optional temporary grants.
 */
class RoleManager {
  /**
   * @param {import('discord.js').Client} client
   * @param {object} config
   * @param {import('../database/Database').BotDatabase} db
   */
  constructor(client, config, db) {
    this.client = client;
    this.config = config;
    this.db = db;
  }

  /**
   * @param {import('discord.js').Guild} guild
   * @returns {{ ok: boolean, missing: string[] }}
   */
  canManageRoles(guild) {
    const missing = missingBotPermissions(guild, [PermissionFlagsBits.ManageRoles]);
    return { ok: missing.length === 0, missing };
  }

  /**
   * @param {import('discord.js').GuildMember} member
   * @param {string} roleId
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  async addRole(member, roleId) {
    if (!member || !roleId) return { ok: false, reason: 'invalid' };
    if (roleId.startsWith('YOUR_')) return { ok: false, reason: 'placeholder' };

    const role = member.guild.roles.cache.get(roleId);
    if (!role) return { ok: false, reason: 'not_found' };

    const perm = this.canManageRoles(member.guild);
    if (!perm.ok) return { ok: false, reason: 'missing_permission', missing: perm.missing };

    const me = member.guild.members.me;
    if (me && role.position >= me.roles.highest.position) {
      return { ok: false, reason: 'hierarchy' };
    }

    if (member.roles.cache.has(roleId)) return { ok: true, reason: 'already' };

    try {
      await member.roles.add(roleId, 'Roles Bot');
      return { ok: true };
    } catch (err) {
      logger.error(`Failed to add role ${roleId} to ${member.id}`, err);
      return { ok: false, reason: 'api_error', error: err };
    }
  }

  /**
   * @param {import('discord.js').GuildMember} member
   * @param {string} roleId
   */
  async removeRole(member, roleId) {
    if (!member || !roleId) return { ok: false, reason: 'invalid' };
    if (!member.roles.cache.has(roleId)) return { ok: true, reason: 'absent' };

    try {
      await member.roles.remove(roleId, 'Roles Bot');
      return { ok: true };
    } catch (err) {
      logger.error(`Failed to remove role ${roleId} from ${member.id}`, err);
      return { ok: false, reason: 'api_error', error: err };
    }
  }

  /**
   * Remove many roles in one API call when possible.
   * @param {import('discord.js').GuildMember} member
   * @param {string[]} roleIds
   */
  async removeRoles(member, roleIds) {
    const toRemove = roleIds.filter((id) => member.roles.cache.has(id));
    if (toRemove.length === 0) return { ok: true, removed: [] };
    try {
      await member.roles.remove(toRemove, 'Roles Bot');
      return { ok: true, removed: toRemove };
    } catch (err) {
      logger.error(`Failed batch role remove for ${member.id}`, err);
      return { ok: false, error: err, removed: [] };
    }
  }

  /**
   * Assign one role from an exclusive group (e.g. ranks or colors).
   * Removes other group roles by priority / membership.
   *
   * @param {import('discord.js').GuildMember} member
   * @param {{ roleId: string, priority?: number }[]} groupRoles
   * @param {string} keepRoleId
   */
  async setExclusiveRole(member, groupRoles, keepRoleId) {
    const groupIds = groupRoles.map((r) => r.roleId).filter(Boolean);
    const others = groupIds.filter((id) => id !== keepRoleId);
    await this.removeRoles(member, others);
    if (keepRoleId) {
      return this.addRole(member, keepRoleId);
    }
    return { ok: true, reason: 'cleared' };
  }

  /**
   * Sync member to the highest earned rank role only.
   * @param {import('discord.js').GuildMember} member
   * @param {object|null} rank
   */
  async syncRankRole(member, rank) {
    const ranks = this.config.ranks;
    if (!rank) {
      await this.removeRoles(member, ranks.map((r) => r.roleId));
      return { ok: true, rank: null };
    }
    const result = await this.setExclusiveRole(member, ranks, rank.roleId);
    return { ...result, rank };
  }

  /**
   * Set a name color (exclusive among color roles).
   * @param {import('discord.js').GuildMember} member
   * @param {string|null} colorKey
   */
  async setColor(member, colorKey) {
    const colors = this.config.colors;
    const group = Object.values(colors).map((c) => ({ roleId: c.roleId }));

    if (!colorKey || colorKey === 'clear') {
      await this.setExclusiveRole(member, group, null);
      return { ok: true, cleared: true };
    }

    const color = colors[colorKey];
    if (!color) return { ok: false, reason: 'unknown_color' };
    const result = await this.setExclusiveRole(member, group, color.roleId);
    return { ...result, color };
  }

  /**
   * Remove all configured color roles from a member.
   */
  async clearColors(member) {
    const ids = Object.values(this.config.colors).map((c) => c.roleId);
    return this.removeRoles(member, ids);
  }

  /**
   * Grant a role that expires later (tracked in DB).
   */
  async grantTemporaryRole(member, roleId, expiresAt, reason = 'temporary reward') {
    const add = await this.addRole(member, roleId);
    if (!add.ok && add.reason !== 'already') return add;
    this.db.addTemporaryRole(member.id, member.guild.id, roleId, expiresAt);
    logger.info(`Temp role ${roleId} for ${member.id} until ${expiresAt} (${reason})`);
    return { ok: true };
  }

  /**
   * Process expired temporary roles across guilds.
   */
  async processExpiredTemporaryRoles() {
    const expired = this.db.getExpiredTemporaryRoles(Date.now());
    for (const row of expired) {
      try {
        const guild = this.client.guilds.cache.get(row.guild_id);
        if (!guild) {
          this.db.removeTemporaryRole(row.user_id, row.guild_id, row.role_id);
          continue;
        }
        const member = await guild.members.fetch(row.user_id).catch(() => null);
        if (member) await this.removeRole(member, row.role_id);
        this.db.removeTemporaryRole(row.user_id, row.guild_id, row.role_id);
      } catch (err) {
        logger.error('Temp role expiry failed', err);
      }
    }
  }
}

module.exports = { RoleManager };
