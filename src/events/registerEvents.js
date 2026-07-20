'use strict';

const { Events } = require('discord.js');
const { registerCommands } = require('../managers/CommandManager');
const { handleSlashCommand } = require('../commands/slashRouter');
const { handlePrefixCommand } = require('../commands/prefixRouter');
const { logger } = require('../utils/logger');

/**
 * Wire Discord.js events to application services.
 * @param {object} app
 */
function registerEvents(app) {
  const { client, config, handlers, vipService, roleManager, voiceRewardService } = app;

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);

    try {
      await registerCommands(readyClient, config);
    } catch (err) {
      logger.error('Failed to register slash commands', err);
    }

    voiceRewardService.start();

    // Combined maintenance loop: VIP expiry + temp roles (once, not per-guild full scans)
    const maintenance = async () => {
      try {
        await vipService.processExpiries();
        await roleManager.processExpiredTemporaryRoles();
      } catch (err) {
        logger.error('Maintenance loop error', err);
      }
    };

    await maintenance();
    const timer = setInterval(maintenance, config.voiceRewards.intervalMs);
    if (timer.unref) timer.unref();
    app._maintenanceTimer = timer;
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This bot only works in servers.', ephemeral: true }).catch(() => {});
      return;
    }
    await handleSlashCommand(interaction, handlers);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    await handlePrefixCommand(message, config, handlers);
  });

  client.on(Events.Error, (err) => logger.error('Discord client error', err));
  client.on(Events.Warn, (msg) => logger.warn(String(msg)));

  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled promise rejection', err);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err);
  });
}

module.exports = { registerEvents };
