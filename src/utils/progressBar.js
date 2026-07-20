'use strict';

/**
 * Build a text progress bar.
 * @param {number} percent 0–100
 * @param {number} length
 * @returns {string}
 */
function progressBar(percent, length = 12) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((clamped / 100) * length);
  const empty = Math.max(0, length - filled);
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${clamped.toFixed(1)}%`;
}

module.exports = { progressBar };
