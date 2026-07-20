'use strict';

const { PermissionFlagsBits } = require('discord.js');

/**
 * @param {import('discord.js').GuildMember} member
 * @param {string[]} adminRoleIds
 * @returns {boolean}
 */
function isAdmin(member, adminRoleIds = []) {
  if (!member) return false;
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return adminRoleIds.some((id) => member.roles.cache.has(id));
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {string} vipPlusRoleId
 * @param {string[]} adminRoleIds
 * @returns {boolean}
 */
function canUseVipFeatures(member, vipPlusRoleId, adminRoleIds = []) {
  if (!member) return false;
  if (isAdmin(member, adminRoleIds)) return true;
  return Boolean(vipPlusRoleId && member.roles.cache.has(vipPlusRoleId));
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').PermissionResolvable[]} permissions
 * @returns {string[]}
 */
function missingBotPermissions(guild, permissions) {
  const me = guild.members.me;
  if (!me) return permissions.map(String);
  return permissions.filter((p) => !me.permissions.has(p)).map(String);
}

module.exports = {
  isAdmin,
  canUseVipFeatures,
  missingBotPermissions,
};
