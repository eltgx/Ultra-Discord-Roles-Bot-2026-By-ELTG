'use strict';

const { REST, Routes } = require('discord.js');
const { buildSlashCommands } = require('../commands/slashDefinitions');
const { logger } = require('../utils/logger');

/**
 * Register guild slash commands (instant update).
 * @param {import('discord.js').Client} client
 * @param {object} config
 */
async function registerCommands(client, config) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is required');

  const body = buildSlashCommands(config);
  const rest = new REST({ version: '10' }).setToken(token);
  const clientId = config.clientId || client.user.id;

  if (!config.guildId || String(config.guildId).startsWith('YOUR_')) {
    logger.warn('guildId not configured — registering GLOBAL commands (may take up to 1 hour)');
    await rest.put(Routes.applicationCommands(clientId), { body });
  } else {
    await rest.put(Routes.applicationGuildCommands(clientId, config.guildId), { body });
    logger.info(`Registered ${body.length} guild slash commands for ${config.guildId}`);
  }
}

module.exports = { registerCommands };
