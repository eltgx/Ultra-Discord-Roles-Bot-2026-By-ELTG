'use strict';

const DURATION_RE = /^(\d+)(y|d|h|m|s)$/i;

const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Parse strings like "30d", "1y", "12h", "45m", "30s" into milliseconds.
 * @param {string} input
 * @returns {number|null}
 */
function parseDuration(input) {
  if (!input || typeof input !== 'string') return null;
  const match = input.trim().match(DURATION_RE);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount * UNIT_MS[unit];
}

/**
 * Human-readable remaining time from milliseconds.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!days && !hours && seconds) parts.push(`${seconds}s`);
  if (parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

/**
 * Format a date for membership embeds.
 * @param {Date|number|string} date
 * @returns {string}
 */
function formatDateTime(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Format voice seconds as "Xh Ym".
 * @param {number} seconds
 * @returns {string}
 */
function formatVoiceTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${hours} hours, ${minutes} mins`;
}

/**
 * Replace `{key}` placeholders in a template string.
 * @param {string} template
 * @param {Record<string, string|number>} vars
 * @returns {string}
 */
function fill(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : `{${key}}`
  );
}

module.exports = {
  parseDuration,
  formatDuration,
  formatDateTime,
  formatVoiceTime,
  fill,
};
