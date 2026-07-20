'use strict';

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG_DIR = path.join(ROOT, 'config');

function readJson(fileName) {
  const full = path.join(CONFIG_DIR, fileName);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing config file: ${fileName}`);
  }
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function assertSnowflakeLike(value, label) {
  if (value == null) return;
  const str = String(value);
  if (str.startsWith('YOUR_')) {
    logger.warn(`Config placeholder still set for ${label}: ${str}`);
    return;
  }
  if (!/^\d{17,20}$/.test(str)) {
    logger.warn(`Suspicious ID for ${label}: ${str}`);
  }
}

/**
 * Load and validate all configuration.
 */
function loadConfig() {
  const config = readJson('config.json');
  const ranks = readJson('ranks.json');
  const boxes = readJson('boxes.json');
  const colors = readJson('colors.json');
  const achievements = readJson('achievements.json');
  const messages = readJson('messages.json');

  if (process.env.GUILD_ID) config.guildId = process.env.GUILD_ID;
  if (process.env.CLIENT_ID) config.clientId = process.env.CLIENT_ID;

  config.databasePath = process.env.DATABASE_PATH
    || path.join(ROOT, 'data', 'bot.json');

  assertSnowflakeLike(config.guildId, 'guildId');
  assertSnowflakeLike(config.roles?.vipPlus, 'roles.vipPlus');
  for (const id of config.roles?.admin || []) {
    assertSnowflakeLike(id, 'roles.admin');
  }
  for (const rank of ranks) {
    assertSnowflakeLike(rank.roleId, `ranks.${rank.id}.roleId`);
  }
  for (const [key, color] of Object.entries(colors)) {
    assertSnowflakeLike(color.roleId, `colors.${key}.roleId`);
  }

  ranks.sort((a, b) => a.xpNeeded - b.xpNeeded);

  return {
    ...config,
    ranks,
    boxes,
    colors,
    achievements,
    messages,
  };
}

module.exports = { loadConfig, CONFIG_DIR, ROOT };
