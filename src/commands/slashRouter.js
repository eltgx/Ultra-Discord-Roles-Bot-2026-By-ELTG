'use strict';

const { logger } = require('../utils/logger');

/**
 * Route slash interactions to shared handlers.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {ReturnType<import('./handlers').createCommandHandlers>} handlers
 */
async function handleSlashCommand(interaction, handlers) {
  const name = interaction.commandName;

  try {
    switch (name) {
      case 'top':
        return handlers.top(interaction);
      case 'color':
        return handlers.color(interaction);
      case 'profile': {
        const user = interaction.options.getUser('user');
        const member = user
          ? await interaction.guild.members.fetch(user.id).catch(() => null)
          : interaction.member;
        if (!member) {
          return interaction.reply({ content: 'User not found.', ephemeral: true });
        }
        return handlers.profile(interaction, member);
      }
      case 'levelup':
        return handlers.levelUp(interaction);
      case 'boxes': {
        const sub = interaction.options.getSubcommand();
        if (sub === 'open') {
          return handlers.boxes(interaction, interaction.options.getString('type', true));
        }
        return handlers.boxes(interaction, null);
      }
      case 'membership':
        return handlers.membership(interaction);
      case 'modifier':
        return handlers.modifier(interaction);
      case 'rep': {
        const user = interaction.options.getUser('user', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        return handlers.rep(interaction, member);
      }
      case 'achievements':
        return handlers.achievements(interaction);
      case 'sync': {
        const user = interaction.options.getUser('user');
        const member = user
          ? await interaction.guild.members.fetch(user.id).catch(() => null)
          : interaction.member;
        return handlers.sync(interaction, member);
      }
      case 'givevipplus': {
        const user = interaction.options.getUser('user', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const duration = interaction.options.getString('duration', true);
        return handlers.giveVipPlus(interaction, member, duration);
      }
      case 'givebox': {
        const user = interaction.options.getUser('user', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const type = interaction.options.getString('type', true);
        const amount = interaction.options.getInteger('amount') || 1;
        return handlers.giveBox(interaction, member, type, amount);
      }
      case 'setlevel': {
        const user = interaction.options.getUser('user', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const level = interaction.options.getInteger('level', true);
        return handlers.setLevel(interaction, member, level);
      }
      case 'setxp': {
        const user = interaction.options.getUser('user', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const amount = interaction.options.getInteger('amount', true);
        return handlers.setXp(interaction, member, amount);
      }
      default:
        logger.warn(`Unhandled slash command: ${name}`);
    }
  } catch (err) {
    logger.error(`Slash command /${name} failed`, err);
    const payload = { content: 'An unexpected error occurred.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
}

module.exports = { handleSlashCommand };
