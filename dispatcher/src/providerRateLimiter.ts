function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export interface ProviderRateLimiterOptions {
  capacity?: number; // tokens per interval
  intervalMs?: number; // refill window in ms
  prefix?: string; // redis key prefix
}

/**
 * Redis-backed fixed-window rate limiter.
 * - Uses a small atomic Lua script to INCR and ensure TTL is set on the window key.
 * - If capacity is exceeded, waits until the next window then retries.
 *
 * Notes:
 * - This is a simple fixed-window limiter (not sliding window).
 * - Intended for use in multi-process environments where Redis is available.
 */
export class ProviderRateLimiter {
  private readonly redis: any;
  private readonly capacity: number;
  private readonly intervalMs: number;
  private readonly prefix: string;

  // Lua script increments key and ensures pexpire is set atomically.
  // Returns the current count after increment.
  private static readonly INCR_AND_EXPIRE_SCRIPT = `
local current = redis.call('incr', KEYS[1])
local ttl = redis.call('pttl', KEYS[1])
if ttl < 0 then
  redis.call('pexpire', KEYS[1], ARGV[1])
end
return current
`;

  constructor(redis: any, opts?: ProviderRateLimiterOptions) {
    if (!redis) throw new Error('ProviderRateLimiter requires a Redis client instance');
    this.redis = redis;
    this.capacity = opts?.capacity ?? Number(process?.env?.RL_TOKENS_PER_INTERVAL ?? 2);
    this.intervalMs = opts?.intervalMs ?? Number(process?.env?.RL_INTERVAL_MS ?? 1000);
    this.prefix = opts?.prefix ?? 'rl:prov:';
  }

  /**
   * Consume a single token for the given key. Resolves when the token has been successfully
   * consumed (may wait until the next interval if capacity is exceeded).
   */
  async consume(key: string): Promise<void> {
    if (!key) throw new Error('ProviderRateLimiter.consume requires a non-empty key');

    // Defensive: clamp values
    const capacity = Math.max(1, Math.floor(this.capacity));
    const intervalMs = Math.max(1, Math.floor(this.intervalMs));

    const windowKey = this.prefix + key + ':' + Math.floor(Date.now() / intervalMs);

    // Try until we can consume (loop with small waits). This handles the case
    // where multiple callers exceed capacity and we need to wait for next window.
    while (true) {
      const now = Date.now();
      // Run the small atomic script. ioredis will return a number here.
      // We pass 1 key and intervalMs as ARGV[1].
      const currentRaw = await this.redis.eval(ProviderRateLimiter.INCR_AND_EXPIRE_SCRIPT, 1, windowKey, intervalMs);
      const current = Number(currentRaw ?? 0);

      if (Number.isNaN(current)) {
        // Unexpected, but defensive
        throw new Error('Unexpected Redis reply from rate-limiter script: ' + String(currentRaw));
      }

      if (current <= capacity) {
        // Successfully consumed
        return;
      }

      // Over capacity -> compute wait until start of next window
      const nextWindowStart = Math.floor(now / intervalMs) * intervalMs + intervalMs;
      const delay = Math.max(5, nextWindowStart - now + 2); // small cushion

      // Optional jitter to avoid thundering herd
      const jitter = Math.floor(Math.random() * Math.min(50, delay));
      await sleep(delay + jitter);
      // after sleep, loop and attempt again
    }
  }
}
