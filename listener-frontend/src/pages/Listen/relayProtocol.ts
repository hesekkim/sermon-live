export interface ListenerToken {
  value: string;
  expiresAt: number;
}

export interface OpusPacket {
  timestampMicros: bigint;
  sequence: number;
  payload: Uint8Array;
}

export type ListenerAdmissionErrorKind =
  | 'invalid'
  | 'not_live'
  | 'rate_limited'
  | 'unavailable'
  | 'configuration';

export class ListenerAdmissionError extends Error {
  constructor(readonly kind: ListenerAdmissionErrorKind) {
    super(kind);
    this.name = 'ListenerAdmissionError';
  }
}

export function getRelayApiBaseUrl(): string {
  const configured = import.meta.env.VITE_RELAY_API_BASE_URL?.trim();
  if (!configured) {
    throw new ListenerAdmissionError('configuration');
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new ListenerAdmissionError('configuration');
  }
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(localHost && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new ListenerAdmissionError('configuration');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export async function requestListenerToken(
  sessionId: string,
  password: string,
  request: typeof fetch = fetch,
): Promise<ListenerToken> {
  const normalizedSessionId = sessionId.trim();
  if (
    !/^[A-Za-z0-9_-]{16,128}$/.test(normalizedSessionId) ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new ListenerAdmissionError('invalid');
  }

  const baseUrl = getRelayApiBaseUrl();
  let response: Response;
  try {
    response = await request(
      `${baseUrl}/sessions/${encodeURIComponent(normalizedSessionId)}/listener-token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listener_password: password }),
      },
    );
  } catch {
    throw new ListenerAdmissionError('unavailable');
  }

  if (!response.ok) {
    const kind =
      response.status === 401
        ? 'invalid'
        : response.status === 409
          ? 'not_live'
          : response.status === 429
            ? 'rate_limited'
            : 'unavailable';
    throw new ListenerAdmissionError(kind);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ListenerAdmissionError('unavailable');
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    !('listener_token' in body) ||
    typeof body.listener_token !== 'string' ||
    body.listener_token.length === 0 ||
    !('expires_in_seconds' in body) ||
    typeof body.expires_in_seconds !== 'number' ||
    !Number.isInteger(body.expires_in_seconds) ||
    body.expires_in_seconds < 1 ||
    body.expires_in_seconds > 90 * 60
  ) {
    throw new ListenerAdmissionError('unavailable');
  }

  return {
    value: body.listener_token,
    expiresAt: Date.now() + body.expires_in_seconds * 1000,
  };
}

export function buildListenerWebSocketUrl(sessionId: string): string {
  const baseUrl = new URL(getRelayApiBaseUrl());
  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, '')}/ws/listener/${encodeURIComponent(sessionId)}`;
  baseUrl.search = '';
  baseUrl.hash = '';
  return baseUrl.toString();
}

export function parseOpusPacket(frame: ArrayBuffer): OpusPacket {
  const bytes = new Uint8Array(frame);
  if (bytes.length < 21) {
    throw new Error('Audio frame is truncated');
  }
  if (
    bytes[0] !== 0x53 ||
    bytes[1] !== 0x4c ||
    bytes[2] !== 0x31 ||
    bytes[3] !== 0x41 ||
    bytes[4] !== 1 ||
    bytes[5] !== 0
  ) {
    throw new Error('Audio frame format is not supported');
  }

  const view = new DataView(frame);
  const payloadLength = view.getUint16(6, true);
  if (payloadLength === 0 || payloadLength > 1275 || bytes.length !== 20 + payloadLength) {
    throw new Error('Audio frame length is invalid');
  }

  return {
    timestampMicros: view.getBigUint64(8, false),
    sequence: view.getUint32(16, false),
    payload: bytes.slice(20),
  };
}
