'use strict';

const { EmbedBuilder } = require('discord.js');
const { fill } = require('./formatters');

/**
 * @param {import('../config')} config
 */
function createEmbedFactory(config) {
  const colors = config.embeds.colors;
  const messages = config.messages;

  function base(colorKey = 'primary') {
    return new EmbedBuilder()
      .setColor(colors[colorKey] || colors.primary)
      .setTimestamp();
  }

  function error(keyOrText, vars = {}) {
    const text = messages.errors[keyOrText]
      ? fill(messages.errors[keyOrText], vars)
      : keyOrText;
    return base('error').setDescription(text);
  }

  function success(keyOrText, vars = {}) {
    const text = messages.success[keyOrText]
      ? fill(messages.success[keyOrText], vars)
      : keyOrText;
    return base('success').setDescription(text);
  }

  function info(title, description, colorKey = 'neutral') {
    return base(colorKey).setTitle(title).setDescription(description);
  }

  return { base, error, success, info, colors, messages, fill };
}

module.exports = { createEmbedFactory };
