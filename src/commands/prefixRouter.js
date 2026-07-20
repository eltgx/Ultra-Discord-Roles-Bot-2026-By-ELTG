'use strict';

const { logger } = require('../utils/logger');

/**
 * Legacy `$` prefix commands mapped onto shared handlers.
 * @param {import('discord.js').Message} message
 * @param {object} config
 * @param {ReturnType<import('./handlers').createCommandHandlers>} handlers
 */
async function handlePrefixCommand(message, config, handlers) {
  const prefix = config.prefix || '$';
  if (!message.content.startsWith(prefix)) return;

  const body = message.content.slice(prefix.length).trim();
  if (!body) return;

  const [rawCommand, ...rest] = body.split(/\s+/);
  const command = rawCommand.toLowerCase();
  const args = rest;

  try {
    switch (command) {
      case 'p':
      case 'profile': {
        const target = message.mentions.members.first() || message.member;
        return handlers.profile(message, target);
      }
      case 'levelup':
        return handlers.levelUp(message);
      case 'boxes':
        return handlers.boxes(message, args[0]?.toLowerCase() || null);
      case 'membership':
        return handlers.membership(message);
      case 'modifier':
        return handlers.modifier(message);
      case 'rep': {
        const target = message.mentions.members.first();
        return handlers.rep(message, target);
      }
      case 'achievements':
        return handlers.achievements(message);
      case 'sync': {
        const target = message.mentions.members.first() || message.member;
        return handlers.sync(message, target);
      }
      case 'givevipplus': {
        const target = message.mentions.members.first();
        const duration = args.find((a) => !a.startsWith('<@')) || args[1];
        return handlers.giveVipPlus(message, target, duration);
      }
      case 'givebox': {
        const target = message.mentions.members.first();
        const type = args.find((a) => !a.startsWith('<@') && Number.isNaN(Number(a)));
        const amountArg = args.find((a) => /^\d+$/.test(a));
        return handlers.giveBox(message, target, type?.toLowerCase(), amountArg ? Number(amountArg) : 1);
      }
      case 'setlevel': {
        const target = message.mentions.members.first();
        const level = Number(args.find((a) => /^\d+$/.test(a)));
        return handlers.setLevel(message, target, level);
      }
      case 'setxp': {
        const target = message.mentions.members.first();
        const xp = Number(args.find((a) => /^\d+$/.test(a)));
        return handlers.setXp(message, target, xp);
      }
      default:
        // Ignore unknown prefix commands silently
        return;
    }
  } catch (err) {
    logger.error(`Prefix command $${command} failed`, err);
    await message.reply('An unexpected error occurred.').catch(() => {});
  }
}

module.exports = { handlePrefixCommand };
