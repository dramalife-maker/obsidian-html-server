export type BaseUrlInput = string | undefined | null;

export const hasSchemeUrl = (value: string) => /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);

export function normalizeBaseUrl(input: BaseUrlInput): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';

  // Keep scheme URLs as-is (minus trailing slash).
  if (hasSchemeUrl(raw)) return raw.replace(/\/+$/, '');

  // Treat as path prefix.
  const withLeading = raw.startsWith('/') ? raw : '/' + raw;
  return withLeading.replace(/\/+$/, '');
}

export function ensureTrailingSlash(value: string): string {
  if (!value) return '/';
  return value.endsWith('/') ? value : value + '/';
}

export function joinBaseUrl(baseUrl: BaseUrlInput, path: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const p = path.startsWith('/') ? path : '/' + path;

  if (!base) return p;

  if (hasSchemeUrl(base)) {
    // Use URL to avoid double slashes and preserve scheme/host.
    const u = new URL(ensureTrailingSlash(base));
    // URL pathname already includes any base path; append `p` onto it.
    const basePath = u.pathname.replace(/\/+$/, '');
    u.pathname = basePath + p;
    return u.toString();
  }

  // base is a path prefix.
  return base + p;
}

export function tryGetForwardedPrefix(headers: Record<string, unknown>): string {
  const raw = headers['x-forwarded-prefix'];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return '';
}

