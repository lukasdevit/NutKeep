import { translate } from '@/i18n';

/** Shape of the new backend error response */
interface ApiErrorBody {
  code?: string;
  messageKey?: string;
  message?: string;
  error?: string; // legacy fallback
}

/**
 * Parse an API error response body and return a human-readable (translated) message.
 *
 * Priority:
 *  1. `messageKey` → look up translation via i18n
 *  2. `message` (English fallback from backend)
 *  3. `error` (legacy format fallback)
 *  4. Raw string or HTTP status
 */
export function getApiErrorMessage(body: ApiErrorBody | string | undefined, status?: number): string {
  if (!body) return `Server error (${status ?? 'unknown'})`;
  if (typeof body === 'string') return body;

  // New format: { code, messageKey, message }
  if (body.messageKey) {
    return translate(body.messageKey, body.message);
  }

  // Legacy format: { error: "..." }
  if (body.error) return body.error;

  // New format without messageKey
  if (body.message) return body.message;

  return `Server error (${status ?? 'unknown'})`;
}
