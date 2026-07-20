'use strict';

require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadConfig } = require('./config');
const { BotDatabase } = require('./database/Database');
const { RoleManager } = require('./managers/RoleManager');
const { CooldownManager, NotificationService } = require('./managers/CooldownManager');
const { RankService } = require('./services/RankService');
const { VipService } = require('./services/VipService');
const { BoxService } = require('./services/BoxService');
const { LevelingService } = require('./services/LevelingService');
const { VoiceRewardService } = require('./services/VoiceRewardService');
const { ReputationService } = require('./services/ReputationService');
const { LeaderboardService } = require('./services/LeaderboardService');
const { AchievementEngine } = require('./achievements/AchievementEngine');
const { createEmbedFactory } = require('./utils/embeds');
const { createCommandHandlers } = require('./commands/handlers');
const { registerEvents } = require('./events/registerEvents');
const { logger } = require('./utils/logger');

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token || token === 'your_bot_token_here') {
    logger.error('Set DISCORD_TOKEN in .env before starting the bot.');
    process.exit(1);
  }

  const config = loadConfig();
  const db = new BotDatabase(config.databasePath);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  const roleManager = new RoleManager(client, config, db);
  const rankService = new RankService(config.ranks);
  const vipService = new VipService({ config, db, roleManager, client });
  const boxService = new BoxService({ config, db, vipService });
  const achievementEngine = new AchievementEngine({
    config,
    db,
    roleManager,
    boxService,
    rankService,
  });
  const levelingService = new LevelingService({
    config,
    db,
    rankService,
    roleManager,
    boxService,
    achievementEngine,
  });
  const voiceRewardService = new VoiceRewardService({
    client,
    config,
    db,
    levelingService,
  });
  const reputationService = new ReputationService({
    config,
    db,
    levelingService,
  });
  const leaderboardService = new LeaderboardService({ client, config, db });
  const embeds = createEmbedFactory(config);
  const cooldowns = new CooldownManager();
  const notifications = new NotificationService(config, achievementEngine);

  const handlers = createCommandHandlers({
    config,
    db,
    embeds,
    levelingService,
    boxService,
    vipService,
    reputationService,
    leaderboardService,
    roleManager,
    achievementEngine,
    notifications,
    cooldowns,
  });

  const app = {
    client,
    config,
    db,
    handlers,
    vipService,
    roleManager,
    voiceRewardService,
  };

  registerEvents(app);

  const shutdown = (signal) => {
    logger.info(`Shutting down (${signal})…`);
    voiceRewardService.stop();
    if (app._maintenanceTimer) clearInterval(app._maintenanceTimer);
    db.close();
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await client.login(token);
}

main().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
