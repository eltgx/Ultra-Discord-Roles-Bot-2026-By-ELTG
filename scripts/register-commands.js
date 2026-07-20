'use strict';

/**
 * Standalone slash-command registration (useful in CI or before first boot).
 * Usage: node scripts/register-commands.js
 */
require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { loadConfig } = require('../src/config');
const { registerCommands } = require('../src/managers/CommandManager');
const { logger } = require('../src/utils/logger');

async function run() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    logger.error('DISCORD_TOKEN missing');
    process.exit(1);
  }

  const config = loadConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once('ready', async () => {
    try {
      await registerCommands(client, config);
      logger.info('Done.');
    } catch (err) {
      logger.error('Registration failed', err);
      process.exitCode = 1;
    } finally {
      client.destroy();
    }
  });

  await client.login(token);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
