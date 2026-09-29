'use strict';

/** Share an in-flight request and cache only successful provider responses. */
function createLiveCache(ttlMs, maxEntries = 100) {
  const entries = new Map();

  return async function load(key, fetchValue) {
    const now = Date.now();
    const existing = entries.get(key);
    if (existing && existing.expiresAt > now) {
      const value = existing.promise ? await existing.promise : existing.value;
      return { value, cached: true };
    }

    const promise = Promise.resolve().then(fetchValue);
    entries.set(key, { promise, expiresAt: now + ttlMs });

    try {
      const value = await promise;
      entries.delete(key);
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      return { value, cached: false };
    } catch (error) {
      if (entries.get(key)?.promise === promise) entries.delete(key);
      throw error;
    }
  };
}

module.exports = { createLiveCache };
