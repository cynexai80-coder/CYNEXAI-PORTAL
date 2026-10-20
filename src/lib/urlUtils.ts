/**
 * Only allow safe link schemes. Anything else (javascript:, data:, vbscript:, …) becomes ''.
 * Use this when STORING user-entered URLs and again when RENDERING them as href/src.
 */
export function safeHttpUrl(raw: unknown, allowRelative = false): string {
  if (typeof raw !== 'string') return '';
  const value = raw.trim();
  if (!value) return '';
  if (allowRelative && value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    // Bare domains like "example.com/jobs" -> assume https
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
    return '';
  }
}

export function safeLink(raw: unknown): string {
  return safeHttpUrl(raw) || '#';
}
