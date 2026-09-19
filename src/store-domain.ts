const HOSTNAME = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Agents pass whatever they have on hand: a bare host, a product URL, a checkout URL. */
export function parseStoreDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || trimmed.length > 2048) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!URL.canParse(withScheme)) return null;
  const host = new URL(withScheme).hostname.replace(/^www\./, '');
  const isIpLike = /\.\d+$/.test(host);
  return host.length <= 253 && HOSTNAME.test(host) && !isIpLike ? host : null;
}
