'use strict';

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = levels[process.env.LOG_LEVEL?.toLowerCase()] ?? levels.info;

function stamp() {
  return new Date().toISOString();
}

function format(level, message, meta) {
  const base = `[${stamp()}] [${level.toUpperCase()}] ${message}`;
  if (meta === undefined) return base;
  if (meta instanceof Error) return `${base}\n${meta.stack || meta.message}`;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return `${base} [unserializable meta]`;
  }
}

const logger = {
  debug(message, meta) {
    if (currentLevel <= levels.debug) console.debug(format('debug', message, meta));
  },
  info(message, meta) {
    if (currentLevel <= levels.info) console.info(format('info', message, meta));
  },
  warn(message, meta) {
    if (currentLevel <= levels.warn) console.warn(format('warn', message, meta));
  },
  error(message, meta) {
    if (currentLevel <= levels.error) console.error(format('error', message, meta));
  },
};

module.exports = { logger };
