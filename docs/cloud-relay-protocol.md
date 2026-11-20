# Cloud Listener relay protocol decision

## Scope and roles

- The Local PC owns the Operator UI, OpenAI Translation session, microphone capture, and audio encoding.
- The Local PC opens an outbound WebSocket to the Berlin relay.
- Berlin validates Publisher and Listener access, relays already-encoded frames, and does not re-encode audio.
- The Listener UI is served statically by Vercel. It connects only to the Berlin relay.
- A Listener password authenticates audience access; it is separate from the Publisher service credential.

LAN broadcast remains supported. Cloud relay mode is opt-in: setting `APP_RELAY_URL` enables it. A relay failure or disabled relay never silently switches to LAN or public routing.

## Local Publisher configuration

Set these server-side values in `sermon-live/backend/.env` to opt in:

- `APP_RELAY_URL`: Berlin API relay base URL, ending in `/api/v1/relay`.
- `APP_RELAY_PUBLISHER_CREDENTIAL`: the same randomly generated value configured on Berlin; at least 32 characters.
- `APP_RELAY_LISTENER_PASSWORD`: the audience password, 8-128 characters.

The Publisher credential and Listener password stay in the Local PC backend. The password is sent only in the HTTPS session-upsert request; neither secret is placed in a URL or returned to the frontend. Leave `APP_RELAY_URL` empty for local-only operation. When it is configured, missing credentials or an unavailable relay fail the translation session instead of silently falling back to another route.

## Publisher handshake

With `APP_RELAY_URL` set to the Berlin relay API base (for example, `https://relay.example.com/api/v1/relay`), the Publisher opens `WSS {APP_RELAY_URL}/ws/publisher/{sessionId}` and sends a JSON text message first:

```json
{
  "type": "publisher_hello",
  "protocol": "sermon-live/1",
  "session_id": "random-session-id",
  "codec": "opus",
  "container": "raw-opus",
  "sample_rate": 24000,
  "channels": 1,
  "packet_duration_ms": 20,
  "target_bitrate": 48000
}
```

The relay returns `publisher_ready` or `publisher_error`. All IDs and codec values are validated exactly. The 24 kHz mono signal is an Opus convention for 24 kHz speech, not a PCM frame.

## JSON control events

All subsequent control events are UTF-8 JSON text frames:

| Event | Required fields |
| --- | --- |
| `subtitle` | `type`, `session_id`, `sequence`, `timestamp_ms`, `language`, `text` |
| `status` | `type`, `session_id`, `sequence`, `timestamp_ms`, `status` |
| `publisher_ping` | `type`, `session_id`, `timestamp_ms` |
| `publisher_close` | `type`, `session_id`, `reason`, `sequence` |

Status values are `starting`, `live`, `reconnecting`, `live_recovered`, `ending`, `ended`, and `error`.

`sequence` is a monotonic integer per JSON event category and is used only for ordering/detection. `timestamp_ms` is the Local PC's monotonic wall-clock origin in milliseconds and must not be substituted for packet sequence. The relay does not include arbitrary user text or audio in logs.

## Binary audio frame

Binary frames use a fixed little-endian header followed immediately by one Opus packet:

```text
0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
S L 1 A  V  F  LL LL TTTTTTTT TT SS SS SS SS  Opus payload
```

The wire header is exactly 20 bytes:

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 4 | ASCII `SL1A` |
| 4 | 1 | protocol version (`1`) |
| 5 | 1 | flags (`0` currently) |
| 6 | 2 | Opus payload length |
| 8 | 8 | sender timestamp in microseconds, big endian |
| 16 | 4 | packet sequence, big endian |

Payload length is the length in bytes after the 20-byte header. The relay rejects:

- a frame shorter than 20 bytes;
- payload length mismatch;
- payload length greater than 1275 bytes;
- invalid `SL1A` magic or protocol version;
- codec mismatch or changed session metadata;
- sequence reuse or a sequence older than the relay's contiguous audio sequence;
- a frame for a session that is not live.

Sequence gaps are reported to the Listener as `audio_gap` status telemetry and do not change subtitle ordering. A Listener may request `audio` subscription with JSON `{"type":"audio","enabled":true}`. It receives the same 20-byte frame or is disconnected for backpressure.

Raw Opus packets are preferred over an Ogg container for WebSockets. One WebSocket binary message is exactly one packet and packet boundaries are preserved. A relay must not combine packets or place multiple packets in one message.

## Listener admission

Before audio/text admission, the Listener authenticates by the session-specific HTTP password-check flow specified in ticket 077. After admission, the Listener opens a WebSocket and sends no credentials in the URL.

The Listener requests a token with `POST {APP_RELAY_URL}/sessions/{sessionId}/listener-token`, then opens `WSS {APP_RELAY_URL}/ws/listener/{sessionId}`. The first WebSocket text message is `{"type":"listener_hello","session_id":"...","listener_token":"..."}`. The relay validates the token before registering the Listener or sending `listener_ready`; the token is never placed in a query parameter.

The Listener receives a `listener_ready` JSON event containing:

```json
{
  "type": "listener_ready",
  "protocol": "sermon-live/1",
  "session_id": "random-session-id",
  "codec": "opus",
  "sample_rate": 24000,
  "channels": 1,
  "packet_duration_ms": 20
}
```

## Reconnect and end behavior

Publisher reconnection uses the same session ID and `publisher_hello`, then resumes with a new, explicitly increasing epoch in the upper sequence space. The exact epoch layout is deferred to implementation in ticket 079. The relay closes the listener session if Publisher ends normally or expires, and sends `status=ended` with `reason=publisher_closed|idle_timeout|publisher_error|server_shutdown`.

Listener reconnection may reuse the Listener admission token for up to 90 minutes from issuance; the relay closes the WebSocket when it expires. Automatic token refresh is not implemented yet, so a Listener must authenticate again after expiry. No password or credential is placed in the query string. If codec/session metadata changed, Listener fails `codec_mismatch` or `session_mismatch` instead of mixing frames.

## Codec decision

For Local PC encoding, use Opus through PyAV/libav in the Python backend. PyAV bundles native FFmpeg/libopus dependencies for supported wheels and can emit raw Opus packets. It also lets the Local package keep encoder code outside the JavaScript frontend.

Candidates not selected:

- PCM: rejected because it is 384 kbit/s at 24 kHz mono 16-bit and does not meet the 64 kbit/s target.
- MP3/AAC: higher latency, license/package complexity, and poor low-bitrate speech behavior for this use case.
- Web SpeechCodec/WebCodecs only: insufficiently consistent for Safari and older supported browsers.
- `opusenc`/external FFmpeg process: platform packaging and process lifecycle are less reliable than a native Python library.

For browser decoding, use a maintained WebAssembly Opus decoder rather than assuming WebCodecs availability. The initial package candidate is `opus-decoder` (decoder-only WASM). Browser fallback is the Web Audio/Media `decodeAudioData` Opus path if it has been verified on the target browser; it is not the primary implementation. Native Node-only or native-addon packages are not used in Vercel.

This combination provides:

- Windows/macOS native package support through PyAV wheels;
- raw packet boundaries for Opus;
- broad Listener support through WASM;
- no Render-side decode/re-encode.

## Initial spike result

Run:

```powershell
python backend/scripts/opus_spike.py
```

The spike uses eight seconds of synthetic speech-like test audio, 24 kHz mono, 16-bit PCM, 48 kbit/s Opus, and a 20 ms packet duration. It records:

- PCM baseline and Opus container wire bitrate;
- packet sizes and count;
- decoded frame count and decode errors;
- encoder/decoder CPU time;
- sample-SNR result.

The Windows machine spike using `PyAV 19.0.2`/`libopus` produced:

- 384 kbit/s PCM16 baseline;
- 53.8 kbit/s Ogg/Opus wire result including container overhead;
- 401 packets in eight seconds;
- 104-228 bytes per packet;
- 401 decoded frames with no decoder error;
- 48.884 ms encoder time and 21.573 ms decoder time on a repeated Windows run;
- the synthetic sample-SNR number was -1.03 dB because this test is a waveform similarity metric on a synthetic tone and is not a listening-quality metric.

The measured Ogg result is below the 64 kbit/s target. Raw Opus frames will exclude container overhead. The current machine result is not a substitute for Windows/macOS package smoke tests or real browser/WASM measurements.

## Acceptance status

- Protocol and error behavior: decided by this document.
- Encoder/decoder: PyAV/libopus locally and WASM decoder in browsers.
- Spike: implemented with synthetic non-voice audio and no API key/microphone.
- PCM comparison: script emits both 384 kbit/s baseline and measured Opus result.
- LAN/cloud policy: LAN remains a fallback; cloud mode is explicit and documented.
- Windows/macOS and real-browser verification: remaining OS/package and Browser smoke work; this ticket records the dependency decision but does not falsely claim real-device validation.
