/* =============================================================================
 * lockout.mjs — too many wrong passcodes from one address → a timed lock.
 * (Ported from the XAT Racing ops console.)
 *
 * The console's passcode is checked on every request (x-ops-key), so a
 * guesser could try keys as fast as the server answers. This counts the
 * failures per client address inside a window and, past the limit, refuses
 * that address for a while — every ops call, not just the unlock, so the
 * lock cannot be stepped around by probing a different route. In memory,
 * per process; hard-capped. A correct key clears the address's slate.
 *
 * THE SAME WRONG KEY COUNTS ONCE. A console tab still open after the
 * passcode was rotated re-sends its stale key on every click; ten clicks
 * used to lock the owner out of their own console. A repeat of the key that
 * failed last time refreshes the timestamp but does not add a try — only a
 * DIFFERENT wrong key is a guess.
 * ===========================================================================*/


export function createLockout({ max = 10, windowMs = 15 * 60_000, lockMs = 15 * 60_000, maxKeys = 5000 } = {}) {
  const fails = new Map();                 // ip → { times: [ms…], until: ms, last: keyHash }
  const prune = (now) => {
    if (fails.size <= maxKeys) return;
    for (const [k, e] of fails) if (e.until <= now && (!e.times.length || now - e.times[e.times.length - 1] > windowMs)) fails.delete(k);
    // still over: the oldest entries go, whatever their state — memory is bounded, full stop
    while (fails.size > maxKeys) fails.delete(fails.keys().next().value);
  };
  return {
    /** ms left on this address's lock, 0 when it may try. */
    locked(ip, now = Date.now()) {
      const e = fails.get(ip);
      return e && e.until > now ? e.until - now : 0;
    },
    /** One wrong passcode. `key` is a hash of what was tried; the same one
     *  again is not a new try. Returns ms of lock imposed (0 = still allowed). */
    fail(ip, key = '', now = Date.now()) {
      const e = fails.get(ip) || { times: [], until: 0, last: '' };
      e.times = e.times.filter((t) => now - t < windowMs);
      if (!(key && e.last === key && e.times.length)) e.times.push(now);
      e.last = key;
      if (e.times.length >= max) { e.until = now + lockMs; e.times = []; }
      fails.set(ip, e);
      prune(now);
      return e.until > now ? e.until - now : 0;
    },
    /** A right passcode — forget this address's failures. */
    clear(ip) { fails.delete(ip); },
    /** failures counted so far in the window (for a "3 tries left" message) */
    count(ip, now = Date.now()) { const e = fails.get(ip); return e ? e.times.filter((t) => now - t < windowMs).length : 0; },
    size() { return fails.size; },
    max, windowMs, lockMs,
  };
}
