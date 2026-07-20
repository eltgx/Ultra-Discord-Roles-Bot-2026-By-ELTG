'use strict';

/**
 * Random integer inclusive.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * @param {number} chancePercent 0–100
 * @returns {boolean}
 */
function chance(chancePercent) {
  return Math.random() * 100 <= chancePercent;
}

/**
 * Sleep helper (tests / backoff).
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run async work with a concurrency limit.
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<void>} fn
 */
async function mapPool(items, limit, fn) {
  const queue = [...items.entries()];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      const [index, item] = next;
      await fn(item, index);
    }
  });
  await Promise.all(workers);
}

module.exports = { randomInt, chance, sleep, mapPool };
