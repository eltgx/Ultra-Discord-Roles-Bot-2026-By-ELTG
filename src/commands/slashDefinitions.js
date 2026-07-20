'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');

/**
 * Build slash command data from config (colors, box types, etc.).
 * @param {object} config
 */
function buildSlashCommands(config) {
  const colorChoices = [
    { name: 'Clear — Remove all colors', value: 'clear' },
    ...Object.entries(config.colors).map(([key, color]) => ({
      name: `${color.label} ${color.emoji || ''}`.trim().slice(0, 100),
      value: key,
    })),
  ].slice(0, 25);

  const boxChoices = Object.entries(config.boxes).map(([key, box]) => ({
    name: `${box.name} ${box.emoji || ''}`.trim().slice(0, 100),
    value: key,
  }));

  return [
    new SlashCommandBuilder()
      .setName('top')
      .setDescription('Show the server leaderboard')
      .addStringOption((opt) =>
        opt
          .setName('choose')
          .setDescription('Leaderboard category')
          .setRequired(true)
          .addChoices(
            { name: 'Leveling', value: 'leveling' },
            { name: 'Reputation', value: 'reputation' },
            { name: 'Voice Time', value: 'afk_time' }
          )
      ),

    new SlashCommandBuilder()
      .setName('color')
      .setDescription('Change your name color (VIP+)')
      .addStringOption((opt) =>
        opt
          .setName('choose')
          .setDescription('Color to apply')
          .setRequired(true)
          .addChoices(...colorChoices)
      ),

    new SlashCommandBuilder()
      .setName('profile')
      .setDescription('View a leveling profile')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member to view').setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('levelup')
      .setDescription('Claim your highest earned rank role and reward box'),

    new SlashCommandBuilder()
      .setName('boxes')
      .setDescription('View or open loot boxes')
      .addSubcommand((sub) =>
        sub.setName('inventory').setDescription('Show your box inventory')
      )
      .addSubcommand((sub) =>
        sub
          .setName('open')
          .setDescription('Open one loot box')
          .addStringOption((opt) =>
            opt
              .setName('type')
              .setDescription('Box type')
              .setRequired(true)
              .addChoices(...boxChoices)
          )
      ),

    new SlashCommandBuilder()
      .setName('membership')
      .setDescription('Check your VIP+ membership status'),

    new SlashCommandBuilder()
      .setName('modifier')
      .setDescription('Show your current voice XP rates'),

    new SlashCommandBuilder()
      .setName('rep')
      .setDescription('Give a reputation point to a member')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member to thank').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('achievements')
      .setDescription('View your achievement progress'),

    new SlashCommandBuilder()
      .setName('sync')
      .setDescription('Sync rank roles to match XP (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member to sync').setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('givevipplus')
      .setDescription('Grant or extend VIP+ (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member').setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('duration')
          .setDescription('e.g. 30d, 1y, lifetime')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('givebox')
      .setDescription('Give loot boxes to a member (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member').setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Box type')
          .setRequired(true)
          .addChoices(...boxChoices)
      )
      .addIntegerOption((opt) =>
        opt.setName('amount').setDescription('How many').setRequired(false).setMinValue(1)
      ),

    new SlashCommandBuilder()
      .setName('setlevel')
      .setDescription('Set a member level (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('level').setDescription('Level number').setRequired(true).setMinValue(1)
      ),

    new SlashCommandBuilder()
      .setName('setxp')
      .setDescription('Set a member XP (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('amount').setDescription('XP amount').setRequired(true).setMinValue(0)
      ),
  ].map((c) => c.toJSON());
}

module.exports = { buildSlashCommands };
