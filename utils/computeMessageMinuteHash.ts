// Local minimal shape to avoid cross-package dependency; matches @messaging-service/types Message essentials
export type DedupMessageShape = {
  recipientId: string;
  channel: string; // 'EMAIL' | 'SMS' | ...
  payload: {
    subject: string | null;
    bodyHtml: string | null;
    bodyText: string;
    from: string;
    to: unknown; // object with contact data
  };
  // Optional fields are ignored by the hash by default; add here if you want them to affect de-dup
  campaignId?: string | null;
};

/**
 * Returns a new Date truncated to the minute in UTC (seconds and ms set to 0).
 */
export function truncateToUtcMinute(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    0,
    0
  ));
}

/**
 * Returns a compact UTC minute key, e.g. "2025-09-24T12:34Z".
 */
export function getUtcMinuteKey(date: Date): string {
  const d = truncateToUtcMinute(date);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}Z`;
}

/**
 * Stable stringify that sorts object keys so JSON order doesn't affect the hash.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

// Simple FNV-1a 64-bit hash implemented with BigInt for good distribution and no deps
function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n; // offset basis
  const prime = 0x100000001b3n; // FNV prime
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & 0xFFFFFFFFFFFFFFFFn; // 64-bit overflow
  }
  // return as 16-char hex (pad to 16 bytes → 128 bits? For 64-bit it's 16 hex chars)
  let hex = hash.toString(16);
  if (hex.length < 16) hex = hex.padStart(16, '0');
  return hex;
}

/**
 * Compute a deterministic hash for a message combined with the UTC minute bucket.
 *
 * Why UTC minute:
 * - Ensures all instances calculate the same bucket regardless of local timezone.
 * - Suppresses accidental duplicates within a minute while allowing a later resend to pass.
 *
 * You can pass a reference date to control the bucket (defaults to now). If you prefer
 * to use the message's scheduledAt instead, call with that date.
 */
export function computeMessageMinuteHash(
  message: DedupMessageShape,
  referenceDate: Date = new Date()
): string {
  const minuteKey = getUtcMinuteKey(referenceDate);

  // Include only fields that define the "same" outbound content to a recipient.
  // Adjust to your semantics if campaignId should affect dedupe.
  const basis = {
    minute: minuteKey,
    recipientId: message.recipientId,
    channel: message.channel,
    payload: {
      subject: message.payload.subject ?? null,
      bodyHtml: message.payload.bodyHtml ?? null,
      bodyText: message.payload.bodyText,
      from: message.payload.from,
      to: message.payload.to,
    },
    // campaignId: message.campaignId ?? null, // uncomment if needed
  } as const;

  return fnv1a64(stableStringify(basis));
}

/**
 * Convenience helper: returns both the minute key and the hash for logging and storage.
 */
export function getMessageMinuteFingerprint(
  message: DedupMessageShape,
  referenceDate: Date = new Date()
): { minuteKey: string; hash: string } {
  const minuteKey = getUtcMinuteKey(referenceDate);
  const hash = computeMessageMinuteHash(message, referenceDate);
  return { minuteKey, hash };
}
