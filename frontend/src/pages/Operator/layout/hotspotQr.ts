export type HotspotSecurity = 'open' | 'WPA' | 'WPA2' | 'WPA3';

function escapeWifiValue(value: string): string {
  return value.replace(/[\\;,"]/g, '\\$&');
}

function isValidWpaPassword(password: string): boolean {
  const byteLength = new TextEncoder().encode(password).length;
  return (
    (byteLength >= 8 && byteLength <= 63) ||
    (password.length === 64 && /^[\da-fA-F]{64}$/.test(password))
  );
}

export function buildWifiQrPayload(
  ssid: string,
  security: HotspotSecurity,
  password: string,
): string | null {
  if (!ssid || new TextEncoder().encode(ssid).length > 32) return null;

  const escapedSsid = escapeWifiValue(ssid);
  if (security === 'open') {
    return `WIFI:T:nopass;S:${escapedSsid};;`;
  }
  if (!isValidWpaPassword(password)) return null;

  return `WIFI:T:WPA;S:${escapedSsid};P:${escapeWifiValue(password)};;`;
}

function isPrivateIpv4Address(address: string): boolean {
  const octets = address.split('.');
  if (
    octets.length !== 4 ||
    octets.some(
      (octet) =>
        !/^(0|[1-9]\d{0,2})$/.test(octet) || Number(octet) > 255,
    )
  ) {
    return false;
  }

  const [first, second] = octets.map(Number);
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function buildHotspotListenQrUrl(
  origin: string,
  hotspotIp: string,
): string | null {
  if (!isPrivateIpv4Address(hotspotIp)) return null;

  const url = new URL(origin);
  url.hostname = hotspotIp;
  url.pathname = '/listen';
  url.search = '';
  url.hash = '';
  return url.toString();
}
