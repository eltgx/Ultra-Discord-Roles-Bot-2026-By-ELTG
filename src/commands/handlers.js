'use strict';

const { progressBar } = require('../utils/progressBar');
const { formatVoiceTime, formatDateTime, formatDuration, fill } = require('../utils/formatters');
const { isAdmin, canUseVipFeatures } = require('../utils/permissions');

/**
 * Shared handlers used by both slash and prefix commands.
 */
function createCommandHandlers(ctx) {
  const {
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
  } = ctx;

  async function reply(interactionOrMessage, options) {
    const isInteraction = typeof interactionOrMessage.isChatInputCommand === 'function';
    if (isInteraction) {
      if (interactionOrMessage.deferred || interactionOrMessage.replied) {
        return interactionOrMessage.editReply(options);
      }
      return interactionOrMessage.reply(options);
    }
    return interactionOrMessage.reply(options);
  }

  async function defer(interactionOrMessage, ephemeral = false) {
    if (interactionOrMessage.deferReply) {
      await interactionOrMessage.deferReply({ ephemeral });
    }
  }

  function guardCooldown(userId, name, interactionOrMessage) {
    const ms = config.cooldowns?.[name] || 0;
    const { hit, remainingMs } = cooldowns.check(userId, name, ms);
    if (hit) {
      const embed = embeds.error('cooldown', { time: formatDuration(remainingMs) });
      reply(interactionOrMessage, { embeds: [embed], ephemeral: true }).catch(() => {});
      return false;
    }
    return true;
  }

  async function notifyUnlocked(ctxMsg, unlocked) {
    await notifications.announceAchievements(ctxMsg, unlocked);
  }

  return {
    async top(interaction) {
      const category = interaction.options.getString('choose', true);
      await defer(interaction);
      const embed = await leaderboardService.buildEmbed(category);
      return reply(interaction, { embeds: [embed] });
    },

    async color(interaction) {
      const member = interaction.member;
      if (!canUseVipFeatures(member, config.roles.vipPlus, config.roles.admin)) {
        return reply(interaction, { embeds: [embeds.error('vipOnly')], ephemeral: true });
      }

      const choice = interaction.options.getString('choose', true);
      await defer(interaction, true);

      const perm = roleManager.canManageRoles(interaction.guild);
      if (!perm.ok) {
        return reply(interaction, {
          embeds: [embeds.error('missingBotPermission', { permissions: perm.missing.join(', ') })],
        });
      }

      const result = await roleManager.setColor(member, choice);
      if (!result.ok) {
        if (result.reason === 'hierarchy') {
          return reply(interaction, { embeds: [embeds.error('roleHierarchy')] });
        }
        if (result.reason === 'not_found' || result.reason === 'placeholder') {
          return reply(interaction, { embeds: [embeds.error('roleNotFound')] });
        }
        return reply(interaction, { embeds: [embeds.error('generic')] });
      }

      if (result.cleared) {
        return reply(interaction, { embeds: [embeds.success('colorCleared')] });
      }

      const color = result.color;
      return reply(interaction, {
        embeds: [embeds.success('colorSet', {
          color: color.label,
          emoji: color.emoji || '',
        })],
      });
    },

    async profile(interactionOrMessage, targetMember) {
      if (!guardCooldown(interactionOrMessage.member.id, 'profile', interactionOrMessage)) return;

      const member = targetMember || interactionOrMessage.member;
      const { user, progress } = levelingService.getProfile(member.id);
      const bar = progressBar(progress.percent, config.features.progressBarLength);
      const rankName = progress.current?.name || 'No Rank';

      const embed = embeds.base('neutral')
        .setTitle(`✨ ${member.user.username} — Profile`)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setDescription(
          `**Level ${progress.level} | ${rankName}**\n` +
          `\`${bar}\`\n\n` +
          `📊 **XP:** ${user.xp.toLocaleString()} / ${progress.maxXp.toLocaleString()}\n` +
          `🎯 **XP Remaining:** ${progress.remaining.toLocaleString()}\n\n` +
          `💰 **Points:** ${user.points.toLocaleString()}\n` +
          `💎 **Total Points:** ${user.total_points.toLocaleString()}\n` +
          `⭐ **Reputation:** ${user.rep.toLocaleString()}\n` +
          `⌚ **Voice Time:** ${formatVoiceTime(user.voice_seconds)}`
        )
        .setFooter({
          text: `Requested by ${interactionOrMessage.member?.user?.username || interactionOrMessage.author.username}`,
        });

      return reply(interactionOrMessage, { embeds: [embed] });
    },

    async levelUp(interactionOrMessage) {
      if (!guardCooldown(interactionOrMessage.member.id, 'levelup', interactionOrMessage)) return;
      await defer(interactionOrMessage);

      const result = await levelingService.levelUp(interactionOrMessage.member);

      if (result.status === 'need_xp') {
        return reply(interactionOrMessage, {
          embeds: [embeds.success('needXp', {
            xp: result.xpNeeded.toLocaleString(),
            rank: result.rank.name,
          })],
        });
      }
      if (result.status === 'max') {
        return reply(interactionOrMessage, {
          embeds: [embeds.success('maxRank', { rank: result.rank.name })],
        });
      }
      if (result.status === 'already') {
        return reply(interactionOrMessage, {
          embeds: [embeds.success('alreadyRank', {
            rank: result.rank.name,
            xp: result.xpNeeded.toLocaleString(),
            next: result.next.name,
          })],
        });
      }
      if (result.status === 'role_error') {
        if (result.reason === 'hierarchy') {
          return reply(interactionOrMessage, { embeds: [embeds.error('roleHierarchy')] });
        }
        if (result.reason === 'missing_permission') {
          return reply(interactionOrMessage, {
            embeds: [embeds.error('missingBotPermission', {
              permissions: (result.missing || []).join(', '),
            })],
          });
        }
        return reply(interactionOrMessage, { embeds: [embeds.error('roleNotFound')] });
      }

      const boxName = result.box?.name || 'Reward';
      await reply(interactionOrMessage, {
        embeds: [embeds.success('levelUp', {
          user: `<@${interactionOrMessage.member.id}>`,
          from: result.from,
          to: result.rank.name,
          box: boxName,
        })],
      });
      await notifyUnlocked(interactionOrMessage, result.unlocked);
    },

    async boxes(interactionOrMessage, boxType) {
      if (!guardCooldown(interactionOrMessage.member.id, 'boxes', interactionOrMessage)) return;
      const userId = interactionOrMessage.member.id;

      if (!boxType) {
        const inv = boxService.inventory(userId);
        const lines = Object.entries(inv).map(([type, amount]) => {
          const def = boxService.getDefinition(type);
          return `${def.emoji} **${def.name}:** ${amount}`;
        });
        const embed = embeds.info(
          'Boxes',
          `${lines.join('\n\n')}\n\n${config.messages.boxes.inventoryHint}`,
          'boxes'
        );
        return reply(interactionOrMessage, { embeds: [embed] });
      }

      await defer(interactionOrMessage);
      const opened = await boxService.open(interactionOrMessage.member, boxType);
      if (opened.error === 'invalid_type') {
        return reply(interactionOrMessage, {
          embeds: [embeds.error('invalidBoxType', { types: boxService.types().join(', ') })],
        });
      }
      if (opened.error === 'empty') {
        const def = boxService.getDefinition(boxType);
        return reply(interactionOrMessage, {
          embeds: [embeds.error('noBoxes', { name: def?.name || boxType })],
        });
      }

      let vipLine = '';
      if (opened.vipBonus) {
        vipLine = `\n\n🎁 ${fill(config.messages.boxes.vipBonus, { duration: opened.vipBonus.duration })}`;
      }

      const embed = embeds.base('success')
        .setTitle(`${opened.def.emoji} Box Opened!`)
        .setDescription(
          `${fill(config.messages.boxes.opened, { name: opened.def.name })}\n\n` +
          `💰 **+${opened.points.toLocaleString()} Points**\n` +
          `📊 **+${opened.xp.toLocaleString()} XP**${vipLine}`
        );

      await reply(interactionOrMessage, { embeds: [embed] });

      const after = await levelingService.afterXpGain(interactionOrMessage.member);
      await notifyUnlocked(interactionOrMessage, after.unlocked);
    },

    async membership(interactionOrMessage) {
      const member = interactionOrMessage.member;
      const status = vipService.getStatus(member.id);
      const hasRole = member.roles.cache.has(config.roles.vipPlus);

      const embed = embeds.base('neutral').setTitle(`${member.user.username}'s Membership`);

      if (hasRole || status.active) {
        if (status.lifetime) {
          embed.addFields({ name: 'VIP PLUS', value: config.messages.vip.lifetime });
        } else if (status.expiresAt) {
          embed.addFields({
            name: 'VIP PLUS',
            value: fill(config.messages.vip.activeUntil, {
              expiry: formatDateTime(status.expiresAt),
            }),
          });
        } else {
          embed.addFields({ name: 'VIP PLUS', value: config.messages.vip.lifetime });
        }
      } else {
        embed.setDescription(config.messages.vip.none);
      }

      return reply(interactionOrMessage, { embeds: [embed] });
    },

    async modifier(interactionOrMessage) {
      const member = interactionOrMessage.member;
      const isVip = member.roles.cache.has(config.roles.vipPlus);
      const xp = isVip ? config.voiceRewards.vipXp : config.voiceRewards.baseXp;
      const minutes = Math.round(config.voiceRewards.intervalMs / 60000);

      const embed = embeds.base('vip').setDescription(
        fill(config.messages.voice.modifier, {
          minutes,
          xp,
          points: config.voiceRewards.points,
          minMembers: config.voiceRewards.minHumanMembers,
        })
      );

      return reply(interactionOrMessage, { embeds: [embed] });
    },

    async rep(interactionOrMessage, targetMember) {
      const result = await reputationService.give(interactionOrMessage.member, targetMember);
      if (result.error === 'mention_required') {
        return reply(interactionOrMessage, { embeds: [embeds.error('mentionRequired')] });
      }
      if (result.error === 'self') {
        return reply(interactionOrMessage, { embeds: [embeds.error('selfRep')] });
      }
      if (result.error === 'bot') {
        return reply(interactionOrMessage, { embeds: [embeds.error('botRep')] });
      }
      if (result.error === 'cooldown') {
        return reply(interactionOrMessage, {
          embeds: [embeds.error('cooldown', { time: result.remaining })],
        });
      }

      await reply(interactionOrMessage, {
        embeds: [embeds.success('repGiven', { user: `<@${targetMember.id}>` })],
      });
      await notifyUnlocked(interactionOrMessage, result.unlocked);
    },

    async achievements(interactionOrMessage) {
      const list = achievementEngine.listForUser(interactionOrMessage.member.id);
      const lines = list.map((a) => {
        const status = a.unlocked ? '✅' : '🔒';
        const pct = Math.floor(a.progress * 100);
        return `${status} ${a.icon || '🏆'} **${a.name}** — ${a.description || ''} (\`${pct}%\`)`;
      });

      const embed = embeds.info(
        'Achievements',
        lines.join('\n') || 'No achievements configured.',
        'achievement'
      );
      return reply(interactionOrMessage, { embeds: [embed] });
    },

    async sync(interactionOrMessage, targetMember) {
      const actor = interactionOrMessage.member;
      if (!isAdmin(actor, config.roles.admin)) {
        return reply(interactionOrMessage, { embeds: [embeds.error('noPermission')], ephemeral: true });
      }

      const member = targetMember || actor;
      await defer(interactionOrMessage);
      const result = await levelingService.sync(member);

      await reply(interactionOrMessage, {
        embeds: [embeds.success('synced', {
          user: `<@${member.id}>`,
          rank: result.rank?.name || 'No Rank',
          level: result.level,
        })],
      });
      await notifyUnlocked(interactionOrMessage, result.unlocked);
    },

    async giveVipPlus(interactionOrMessage, targetMember, durationStr) {
      if (!isAdmin(interactionOrMessage.member, config.roles.admin)) {
        return reply(interactionOrMessage, { embeds: [embeds.error('noPermission')] });
      }
      if (!targetMember || !durationStr) {
        return reply(interactionOrMessage, {
          embeds: [embeds.error('invalidUsage', {
            usage: '`/givevipplus user:<member> duration:<30d|1y|lifetime>`',
          })],
        });
      }

      const result = await vipService.grant(targetMember, durationStr);
      if (result.error === 'invalid_duration') {
        return reply(interactionOrMessage, { embeds: [embeds.error('invalidDuration')] });
      }

      if (result.lifetime) {
        return reply(interactionOrMessage, {
          embeds: [embeds.success('vipLifetime', { user: `<@${targetMember.id}>` })],
        });
      }

      return reply(interactionOrMessage, {
        embeds: [embeds.success('vipGranted', {
          user: `<@${targetMember.id}>`,
          duration: durationStr,
          expiry: result.formatted,
        })],
      });
    },

    async giveBox(interactionOrMessage, targetMember, boxType, amount) {
      if (!isAdmin(interactionOrMessage.member, config.roles.admin)) {
        return reply(interactionOrMessage, { embeds: [embeds.error('noPermission')] });
      }
      if (!targetMember) {
        return reply(interactionOrMessage, { embeds: [embeds.error('mentionRequired')] });
      }
      if (!boxService.getDefinition(boxType)) {
        return reply(interactionOrMessage, {
          embeds: [embeds.error('invalidBoxType', { types: boxService.types().join(', ') })],
        });
      }
      const qty = Number(amount) || 1;
      if (qty <= 0) {
        return reply(interactionOrMessage, { embeds: [embeds.error('invalidAmount')] });
      }

      const def = boxService.getDefinition(boxType);
      boxService.grant(targetMember.id, boxType, qty);

      if (config.features.dmOnBoxGrant) {
        await targetMember.send(
          `You received **${qty}× ${def.name}** box(es)! Check with \`/boxes\` or \`$boxes\`.`
        ).catch(() => {});
      }

      return reply(interactionOrMessage, {
        embeds: [embeds.success('boxGranted', {
          amount: qty,
          name: def.name,
          user: `<@${targetMember.id}>`,
        })],
      });
    },

    async setLevel(interactionOrMessage, targetMember, level) {
      if (!isAdmin(interactionOrMessage.member, config.roles.admin)) {
        return reply(interactionOrMessage, { embeds: [embeds.error('noPermission')] });
      }
      if (!targetMember || !Number.isFinite(level) || level < 1) {
        return reply(interactionOrMessage, { embeds: [embeds.error('invalidLevel')] });
      }

      await defer(interactionOrMessage);
      const result = await levelingService.setLevel(targetMember, level);
      await reply(interactionOrMessage, {
        embeds: [embeds.success('levelSet', {
          user: `<@${targetMember.id}>`,
          level: result.level,
          rank: result.rank?.name || 'Unknown',
        })],
      });
      await notifyUnlocked(interactionOrMessage, result.unlocked);
    },

    async setXp(interactionOrMessage, targetMember, xp) {
      if (!isAdmin(interactionOrMessage.member, config.roles.admin)) {
        return reply(interactionOrMessage, { embeds: [embeds.error('noPermission')] });
      }
      if (!targetMember || !Number.isFinite(xp) || xp < 0) {
        return reply(interactionOrMessage, {
          embeds: [embeds.error('invalidUsage', { usage: 'Provide a user and non-negative XP amount.' })],
        });
      }

      await defer(interactionOrMessage);
      const result = await levelingService.setXp(targetMember, xp);
      await reply(interactionOrMessage, {
        embeds: [embeds.success('xpSet', {
          user: `<@${targetMember.id}>`,
          xp: result.xp.toLocaleString(),
          level: result.level,
          rank: result.rank?.name || 'No Rank',
        })],
      });
      await notifyUnlocked(interactionOrMessage, result.unlocked);
    },
  };
}

module.exports = { createCommandHandlers };
