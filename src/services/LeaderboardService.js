'use strict';

const { EmbedBuilder } = require('discord.js');

class LeaderboardService {
  /**
   * @param {object} options
   * @param {import('discord.js').Client} options.client
   * @param {object} options.config
   * @param {import('../database/Database').BotDatabase} options.db
   */
  constructor({ client, config, db }) {
    this.client = client;
    this.config = config;
    this.db = db;
    /** @type {Map<string, { at: number, embed: EmbedBuilder }>} */
    this.cache = new Map();
    this.cacheTtlMs = 30_000;
  }

  /**
   * @param {'leveling'|'reputation'|'afk_time'} category
   */
  async buildEmbed(category) {
    const cached = this.cache.get(category);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return EmbedBuilder.from(cached.embed);
    }

    const limit = this.config.leaderboard.limit;
    const rows = this.db.getTop(category, limit);
    const colors = this.config.embeds.colors;

    const meta = {
      leveling: { title: '🏆 Top Leveling Leaderboard', color: colors.primary, format: (v) => `\`${Number(v).toLocaleString()} XP\`` },
      reputation: { title: '⭐ Top Reputation Leaderboard', color: colors.reputation, format: (v) => `\`${Number(v).toLocaleString()} Rep\`` },
      afk_time: {
        title: '⌚ Top Voice Activity Leaderboard',
        color: colors.voice,
        format: (v) => {
          const hours = Math.floor(Number(v) / 3600);
          const mins = Math.floor((Number(v) % 3600) / 60);
          return `\`${hours}h ${mins}m\``;
        },
      },
    }[category];

    if (!meta) {
      return new EmbedBuilder().setColor(colors.error).setDescription('Unknown leaderboard category.');
    }

    const lines = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let name = `Unknown (${row.id})`;
      try {
        const user = await this.client.users.fetch(row.id);
        name = user.username;
      } catch {
        // keep fallback
      }
      lines.push(`**#${i + 1}** | ${name} — ${meta.format(row.value)}`);
    }

    const embed = new EmbedBuilder()
      .setColor(meta.color)
      .setTitle(meta.title)
      .setDescription(lines.join('\n') || 'No entries found.')
      .setTimestamp();

    this.cache.set(category, { at: Date.now(), embed });
    return embed;
  }

  invalidate() {
    this.cache.clear();
  }
}

module.exports = { LeaderboardService };
