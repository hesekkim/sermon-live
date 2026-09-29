import { describe, expect, it } from 'vitest';
import { buildListenQrUrl } from '../../src/pages/Operator/layout/listenQrUrl';

describe('buildListenQrUrl', () => {
  it('uses the detected LAN address when the operator opened localhost', () => {
    expect(buildListenQrUrl('http://localhost:5173', '192.168.1.12')).toBe(
      'http://192.168.1.12:5173/listen',
    );
  });

  it('keeps the current host and port when the operator opened a LAN URL', () => {
    expect(
      buildListenQrUrl('http://192.168.1.22:5173/operator?tab=settings', null),
    ).toBe('http://192.168.1.22:5173/listen');
  });

  it('does not create a loopback URL when LAN detection fails', () => {
    expect(buildListenQrUrl('http://127.0.0.1:5173', null)).toBeNull();
  });

  it('replaces an IPv6 loopback host with the detected LAN address', () => {
    expect(buildListenQrUrl('http://[::1]:5173', '192.168.1.12')).toBe(
      'http://192.168.1.12:5173/listen',
    );
  });
});
