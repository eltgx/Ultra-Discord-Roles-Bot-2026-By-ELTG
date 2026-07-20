'use strict';

/**
 * Optional migration from legacy QuickDB JSON into the JSON store.
 *
 * Usage:
 *   npm install quick.db
 *   node scripts/migrate-quickdb.js
 */
require('dotenv').config();

const path = require('path');
const { loadConfig } = require('../src/config');
const { BotDatabase } = require('../src/database/Database');
const { logger } = require('../src/utils/logger');

async function run() {
  let QuickDB;
  try {
    ({ QuickDB } = require('quick.db'));
  } catch {
    logger.error('Install quick.db first: npm install quick.db');
    process.exit(1);
  }

  const config = loadConfig();
  const db = new BotDatabase(config.databasePath);
  const quick = new QuickDB();
  const all = await quick.all();

  let users = 0;
  let boxes = 0;
  let vips = 0;

  for (const entry of all) {
    const { id, value } = entry;

    const xpMatch = id.match(/^xp_(.+)$/);
    if (xpMatch) {
      db.setXp(xpMatch[1], Number(value) || 0);
      users += 1;
      continue;
    }

    const levelMatch = id.match(/^level_(.+)$/);
    if (levelMatch) {
      db.setLevel(levelMatch[1], Number(value) || 0);
      continue;
    }

    const pointsMatch = id.match(/^points_(.+)$/);
    if (pointsMatch) {
      db.setPoints(pointsMatch[1], Number(value) || 0);
      continue;
    }

    const totalMatch = id.match(/^total_points_(.+)$/);
    if (totalMatch) {
      db.setTotalPoints(totalMatch[1], Number(value) || 0);
      continue;
    }

    const voiceMatch = id.match(/^afk_time_(.+)$/);
    if (voiceMatch) {
      db.setVoiceSeconds(voiceMatch[1], Number(value) || 0);
      continue;
    }

    const repMatch = id.match(/^rep_(.+)$/);
    if (repMatch && !id.includes('cooldown')) {
      db.setRep(repMatch[1], Number(value) || 0);
      continue;
    }

    const cooldownMatch = id.match(/^rep_cooldown_(.+)$/);
    if (cooldownMatch) {
      db.setRepCooldown(cooldownMatch[1], Number(value) || 0);
      continue;
    }

    const boxMatch = id.match(/^box_(common|rare|legendary|mythic)_(.+)$/);
    if (boxMatch) {
      db.addBoxes(boxMatch[2], boxMatch[1], Number(value) || 0);
      boxes += 1;
      continue;
    }

    const vipMatch = id.match(/^vipplus_expiry_(.+)$/);
    if (vipMatch) {
      if (value === 'lifetime') db.setVipExpiry(vipMatch[1], null);
      else db.setVipExpiry(vipMatch[1], Number(value));
      vips += 1;
    }
  }

  db.close();
  logger.info(`Migration complete. XP keys≈${users}, box keys≈${boxes}, vip keys≈${vips}`);
  logger.info(`Store path: ${path.resolve(config.databasePath)}`);
}

run().catch((err) => {
  logger.error('Migration failed', err);
  process.exit(1);
});
