import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildListenerWebSocketUrl,
  ListenerAdmissionError,
  parseOpusPacket,
  requestListenerToken,
} from '../src/pages/Listen/relayProtocol';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function makeAudioFrame(sequence = 1): ArrayBuffer {
  const bytes = new Uint8Array(22);
  bytes.set([0x53, 0x4c, 0x31, 0x41, 1, 0]);
  const view = new DataView(bytes.buffer);
  view.setUint16(6, 2, true);
  view.setBigUint64(8, 1200n, false);
  view.setUint32(16, sequence, false);
  bytes.set([0x11, 0x22], 20);
  return bytes.buffer;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Listener relay protocol', () => {
  it('sends the password only in the HTTPS admission body and returns a bounded memory token', async () => {
    vi.stubEnv(
      'VITE_RELAY_API_BASE_URL',
      'https://relay.example.test/api/v1/relay/',
    );
    const fetchMock = vi.fn().mockResolvedValue(
      response({ listener_token: 'opaque-token', expires_in_seconds: 90 }),
    );

    const token = await requestListenerToken(
      'relay_session_123456',
      'audience-password',
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://relay.example.test/api/v1/relay/sessions/relay_session_123456/listener-token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listener_password: 'audience-password' }),
      },
    );
    expect(token.value).toBe('opaque-token');
    expect(token.expiresAt).toBeGreaterThan(Date.now());
    expect(JSON.stringify(token)).not.toContain('audience-password');
  });

  it('does not expose failed passwords in admission errors', async () => {
    vi.stubEnv(
      'VITE_RELAY_API_BASE_URL',
      'https://relay.example.test/api/v1/relay',
    );
    const fetchMock = vi.fn().mockResolvedValue(response({}, 401));

    await expect(
      requestListenerToken('relay_session_123456', 'wrong-password', fetchMock),
    ).rejects.toMatchObject({
      name: 'ListenerAdmissionError',
      kind: 'invalid',
      message: 'invalid',
    });
  });

  it('distinguishes a valid password when the broadcast is not live', async () => {
    vi.stubEnv(
      'VITE_RELAY_API_BASE_URL',
      'https://relay.example.test/api/v1/relay',
    );
    const fetchMock = vi.fn().mockResolvedValue(response({}, 409));

    await expect(
      requestListenerToken('relay_session_123456', 'audience-password', fetchMock),
    ).rejects.toMatchObject({
      name: 'ListenerAdmissionError',
      kind: 'not_live',
      message: 'not_live',
    });
  });

  it('rejects access tokens whose advertised lifetime exceeds 90 minutes', async () => {
    vi.stubEnv(
      'VITE_RELAY_API_BASE_URL',
      'https://relay.example.test/api/v1/relay',
    );
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        listener_token: 'opaque-token',
        expires_in_seconds: 90 * 60 + 1,
      }),
    );

    await expect(
      requestListenerToken('relay_session_123456', 'audience-password', fetchMock),
    ).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('builds a Berlin WSS address without query credentials', () => {
    vi.stubEnv(
      'VITE_RELAY_API_BASE_URL',
      'https://relay.example.test/api/v1/relay',
    );

    const socketUrl = buildListenerWebSocketUrl('relay_session_123456');

    expect(socketUrl).toBe(
      'wss://relay.example.test/api/v1/relay/ws/listener/relay_session_123456',
    );
    expect(new URL(socketUrl).search).toBe('');
  });

  it('preserves one Opus packet boundary and validates its header', () => {
    const packet = parseOpusPacket(makeAudioFrame(17));

    expect(packet.sequence).toBe(17);
    expect(packet.timestampMicros).toBe(1200n);
    expect(Array.from(packet.payload)).toEqual([0x11, 0x22]);
    expect(() => parseOpusPacket(new ArrayBuffer(19))).toThrow(
      'Audio frame is truncated',
    );
  });

  it('requires an explicitly configured HTTPS relay endpoint for production', async () => {
    vi.stubEnv('VITE_RELAY_API_BASE_URL', 'http://relay.example.test/relay');

    await expect(
      requestListenerToken('relay_session_123456', 'audience-password'),
    ).rejects.toBeInstanceOf(ListenerAdmissionError);
  });
});
