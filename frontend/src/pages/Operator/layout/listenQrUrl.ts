const LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

export function buildListenQrUrl(
  origin: string,
  lanIp: string | null,
): string | null {
  const url = new URL(origin);
  if (LOOPBACK_HOSTS.has(url.hostname)) {
    if (!lanIp) {
      return null;
    }
    url.hostname = lanIp;
  }
  url.pathname = '/listen';
  url.search = '';
  url.hash = '';
  return url.toString();
}
