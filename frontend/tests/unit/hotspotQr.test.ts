import { describe, expect, it } from 'vitest';
import {
  buildHotspotListenQrUrl,
  buildWifiQrPayload,
} from '../../src/pages/Operator/layout/hotspotQr';

describe('buildWifiQrPayload', () => {
  it('escapes special characters in the SSID and password', () => {
    expect(
      buildWifiQrPayload(
        'Room; "A",\\B',
        'WPA2',
        'pass; "X",\\y123',
      ),
    ).toBe(
      String.raw`WIFI:T:WPA;S:Room\; \"A\"\,\\B;P:pass\; \"X\"\,\\y123;;`,
    );
  });

  it('uses the standard open-network marker without a password', () => {
    expect(buildWifiQrPayload('Open network', 'open', '')).toBe(
      'WIFI:T:nopass;S:Open network;;',
    );
  });

  it('requires a valid SSID and WPA passphrase', () => {
    expect(buildWifiQrPayload('', 'open', '')).toBeNull();
    expect(buildWifiQrPayload('Sermon', 'WPA3', 'short')).toBeNull();
    expect(buildWifiQrPayload('Sermon', 'WPA3', 'g'.repeat(64))).toBeNull();
    expect(buildWifiQrPayload('Sermon', 'WPA3', 'é'.repeat(32))).toBeNull();
    expect(buildWifiQrPayload('Sermon', 'WPA3', 'f'.repeat(64))).toContain(
      'WIFI:T:WPA;',
    );
    expect(buildWifiQrPayload('S'.repeat(33), 'open', '')).toBeNull();
  });
});

describe('buildHotspotListenQrUrl', () => {
  it('uses the hotspot IPv4 address regardless of the current network host', () => {
    expect(
      buildHotspotListenQrUrl(
        'https://192.168.1.22:8443/operator?tab=audio',
        '192.168.137.1',
      ),
    ).toBe('https://192.168.137.1:8443/listen');
  });

  it.each(['localhost', '127.0.0.1', '192.168.1.256', '8.8.8.8'])(
    'rejects an invalid or non-private address: %s',
    (address) => {
      expect(buildHotspotListenQrUrl('http://localhost:5173', address)).toBeNull();
    },
  );
});
