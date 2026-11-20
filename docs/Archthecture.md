# 목표 아키텍처

## 문서 목적과 범위

이 문서는 `.todo/035`부터 `.todo/043`까지의 Operator UX, 인증, 오디오 안정성, route 정리 티켓이 완료되었다고 가정한 **목표 상태**를 설명한다. 현재 코드 상태를 그대로 기록한 문서가 아니다.

초기 제품 방향과 OpenAI translation 설계는 [Archthecture.md](Archthecture.md)에 남아 있다. 초기 문서와 본 문서의 운영 UX/route 결정이 다르면 이 문서를 현재 roadmap의 기준으로 삼는다. 새 작업 티켓은 [.todo/README.md](../.todo/README.md)를 참조한다.

현재 제품 경계는 Local PC의 Operator/Translation Publisher, Berlin relay, 별도 Vercel static Listener다. Local PC Backend는 청중 Listener 연결을 받지 않는다.

이 문서는 새 UX/안정성 티켓만 완료된 상태를 기술한다. 기존 backlog에 남은 OpenAI 실제 장비 end-to-end 확인, Glossary 기능은 완료된 것으로 간주하지 않는다. Sermon Session은 현재 애플리케이션에서 비활성화되며 번역 context로 사용하지 않는다.

### 목표 구조 이후 추가된 기능

다음 기능은 위 티켓 이후 구현되어 현재 코드에 포함되어 있다.

- **Scripture popup**: SessionService가 독일어 번역 text에서 성경 구절 참조를 감지(`services/scripture.py`)하고 Lutherbibel 1912 본문을 Berlin relay의 `scripture` event로 보낸다. Listener는 번역 자막을 가리지 않는 카드 stack으로 표시한다. Source transcript는 감지 대상이 아니다.
- **Listener QR 공유**: Operator layout은 `APP_RELAY_LISTENER_URL` 기반 Vercel URL을 QR로 보여준다. LAN URL로 대체하지 않는다.
- **Listen 화면 유지**: 신뢰된 HTTPS origin에서 듣는 중 Screen Wake Lock을 요청해 페이지가 보이는 동안 자동 화면 꺼짐을 막고, 화면 복귀 시 다시 요청한다. 화면을 직접 잠그거나 앱을 백그라운드로 보낸 뒤의 재생은 보장하지 않는다.
- **오디오 복구**: AudioContext가 OS/브라우저에 의해 suspended/interrupted되면 예약된 오디오를 비우고 사용자 gesture 기반 "오디오 다시 재생" 버튼을 보여준다.
- **Cloud Listener 연결 안정성**: HTTPS 비밀번호 admission, session-bound token, WSS heartbeat, exponential reconnect, Opus packet decoder 및 사용자 gesture 기반 오디오 복구. 자세한 계약은 [Listen 연결과 재연결](#listen-연결과-재연결)을 따른다.

## 제품 경계

```text
교회 오디오 입력 장치
        |
        v
Local PC: AudioCapture -> AudioProcessor -> AudioRuntime
        |                                      |
        |                                      v
        |                              SessionService
        |                                      |
        |                                      v
        |                           LiveInterpreter protocol
        |                                      |
        |                                      v
        |                        OpenAI Realtime Translation
        |                                      |
        |                    translated audio / text deltas
        |                                      |
        v                                      v
Operator Browser <---- Local FastAPI/WebSocket
Local PC Publisher ---- WSS ----> Berlin Relay <---- HTTPS/WSS ---- Vercel Listener
```

출력 언어는 Operator Settings에서 영어(`en`) 또는 독일어(`de`)를 선택하며 기본값은 독일어다. Listen UI도 선택한 출력 언어로 표시한다. 입력 언어는 provider에 지정하지 않는다. OpenAI API key는 Backend에서만 사용하고 Browser나 Listen client에 전달하지 않는다.

## 실행 단위와 소유권

### Local PC Backend

FastAPI 프로세스는 HTTP API, WebSocket, Operator 인증, 오디오 입력 runtime, Translation Session lifecycle, broadcast fan-out을 소유한다.

- 서버 프로세스는 계속 실행될 수 있다.
- AudioRuntime은 시작 시 입력 장치를 열고 장치 상태와 input level을 관리한다.
- 비용이 발생하는 외부 Translation Session은 Operator가 시작할 때만 연결한다.
- 서버 종료 시 활성 Translation Session을 종료하고 AudioRuntime 및 WebSocket client를 정리한다.
- remote Listener 수가 증가해도 OpenAI API key 또는 OpenAI socket은 Listener client 쪽에 생성되지 않는다.

### Browser 애플리케이션

두 개의 별도 React 앱이 사용자 surface를 제공한다.

- `frontend/`: Local PC에서 로그인한 운영자가 쓰는 `/operator/*` Broadcast와 Settings.
- `listener-frontend/`: Vercel에서 정적으로 제공하는 Listener UI. Berlin relay 외의 전송 경로는 없다.

Operator shell은 Broadcast 상태 구독과 조작을 route component보다 상위에서 소유한다. Broadcast와 Settings 사이를 이동해도 WebSocket, status refresh, live timer, pending action이 unmount되지 않는다.

## 사용자 화면

### Listen

Listener는 방송 코드와 비밀번호로 Berlin에 HTTPS admission을 요청한다. 승인된 token은 메모리에만 유지하고 WSS handshake로 보낸다. 연결 상태, translation 상태, 선택된 출력 언어의 자막, 명시적인 Listen 시작, 글자 크기와 theme을 제공한다. 자막 자동 이동과 scripture 카드도 유지한다. Relay 장애 시 Local/LAN 경로로 전환하지 않는다.

오디오 playback은 Listen Browser의 AudioContext에서 수행한다. 사용자 음량은 기기의 하드웨어/OS 조절을 사용하며 앱에 별도의 volume control을 두지 않는다. Listen Browser에는 Operator 설정이나 API key가 전달되지 않는다.

모바일 브라우저(특히 iOS Safari)는 화면이 잠기거나 앱이 background로 가면 AudioContext와 WebSocket을 중단할 수 있다. Vercel HTTPS origin에서 Wake Lock 요청에 성공하면 Listener 페이지가 보이는 동안 자동 화면 꺼짐을 막는다. Wake Lock은 직접 잠금이나 background 재생을 막지 않는다. 화면 복귀 시 socket은 exponential backoff로 재연결되고 AudioContext는 복구 버튼으로 재개된다. 이 제한은 운영 안내에 포함한다.

### Operator Broadcast

Operator의 기본 화면은 Broadcast다. 왼쪽 영역은 page navigation이 아니라 반복 운영에 필요한 control sidebar다.

Sidebar는 다음 정보를 한 곳에 둔다.

- Translation Start/Stop control
- server, Operator WebSocket, interpreter, translation session 상태
- input device ready/error
- Input level meter
- Listener 수
- session 경과/잔여 시간, auto-stop warning 및 extension/stop action
- latency와 queue drop warning/count

본문은 source transcript와 선택된 출력 언어의 translation transcript를 표시한다. 출력 transcript 제목과 다운로드 안내는 현재 출력 언어에 맞춘다. transcript download가 지원되는 경우 기존 동작을 유지한다.

현재 signal label은 Input level의 동일한 값에 threshold를 적용한 파생 표시다. 따라서 Broadcast에는 level meter와 별도의 "Audio signal / Silent" label을 중복 노출하지 않는다. 단, input device의 ready/error는 signal 크기와 다른 상태이므로 계속 표시한다. Audio Test 화면의 신호/무음 결과는 짧은 측정 구간에 대한 테스트 판정이므로 별도로 유지한다.

Operator 상단에는 Settings icon과 Dark mode toggle을 둔다. theme은 즉시 바뀌고 Operator preferences 저장 방식을 사용한다. Settings route에서 Broadcast로 돌아가도 live session 상태는 유지된다.

### Operator Settings

Settings는 다음 네 탭을 사용한다.

1. **Appearance**: UI language를 선택 즉시 적용한다. Dark mode는 공통 상단 toggle에서 조절한다. 이 탭에는 Apply 버튼이 없다.
2. **Input devices**: 장치 선택 즉시 저장한다. 저장에 성공하면 backend capture runtime에 반영한다. Session live 중 변경은 거부하고 사용자가 이전 선택을 유지하도록 한다. Audio Test는 장치 연결, input level, capture stream format, processing format 및 변환 성공 여부를 확인한다.
3. **Safety**: Auto Stop, warning, extension, hard limit을 편집하고 이 값만 저장하는 Apply 버튼을 둔다.
4. **API Model**: Echo/OpenAI 선택, OpenAI API key 저장 상태/입력 및 출력 언어(영어/독일어)를 관리하고 이 값만 저장하는 Apply 버튼을 둔다. 저장된 API key 원문은 응답으로 되돌려주지 않는다.

각 탭의 미저장 draft가 다른 탭을 저장할 때 함께 전송되거나 덮어써지지 않는다. Settings 상단 Back action은 Broadcast로 돌아간다.

Sermon Session 화면/route는 Operator navigation 및 앱 route에 포함되지 않는다. 해당 feature의 원본 파일이나 저장 데이터가 남아 있더라도 활성 product surface로 취급하지 않는다.

## 인증과 접근 경계

Operator는 애플리케이션 로그인으로 보호한다. 이번 목표 범위는 사용자 계정 DB나 외부 identity provider를 도입하지 않는 단일 Local PC 운영자 환경이다.

### 인증 대상

- Operator settings 조회 및 저장
- session status/start/stop/extend
- audio device 목록 및 audio test
- `/ws/operator`
- React `/operator/*` 화면

HTTP endpoint와 WebSocket 모두 Backend에서 실제 인증을 확인한다. React route guard는 사용자 경험을 위한 것이며 backend enforcement를 대체하지 않는다. WebSocket은 BroadcastHub에 등록하기 전에 cookie와 Origin을 검증한다.

### 공개 대상

- `/health`

청중 Listener의 admission 및 stream은 Berlin relay에서 방송별 비밀번호와 session-bound token으로 보호한다. Local PC Backend에는 `/listen` UI나 `/ws/listen` endpoint가 없다.

### 세션과 보안 한계

Operator password 및 세션 signing secret은 Local PC의 environment configuration에서 설정한다. 로그인 후에는 HttpOnly/SameSite cookie session을 사용하며 credential을 localStorage, URL, API response 또는 log에 넣지 않는다. Unsafe HTTP 요청에는 Origin/CSRF 검증을 적용한다. 로그인 실패 시도를 제한한다.

Local PC Operator 기본 실행은 HTTP/ws이며, `APP_SSL_CERTFILE`과 `APP_SSL_KEYFILE`을 함께 설정하면 HTTPS/WSS를 사용할 수 있다. 청중 Listener는 Vercel HTTPS에서 실행되며 Local PC listener transport에 의존하지 않는다.

OpenAI API key는 Browser에 노출되지 않지만 현재 설정 저장소의 at-rest 암호화는 별도 범위다. Local PC 사용자 계정 또는 해당 설정 파일이 탈취되는 경우를 앱 로그인만으로 방어한다고 간주하지 않는다.

## Backend 구성과 책임

### HTTP/API Router

Router는 HTTP/WebSocket 입출력과 인증 적용을 담당하고 capture, interpreter 또는 session business logic을 직접 구현하지 않는다.

| Surface | 접근 | 책임 |
| --- | --- | --- |
| `/health` | 공개 | process health 확인 |
| `/api/v1/auth/*` 또는 동등한 auth route | 공개 진입 | 로그인, 현재 session 확인, logout |
| `/api/v1/operator/settings` | Operator 인증 | runtime/operator 설정 조회와 저장 |
| `/api/v1/session/*` | Operator 인증 | translation session 조회와 lifecycle control |
| `/api/v1/audio/*` | Operator 인증 | device discovery 및 Audio Test |
| `/ws/operator` | Operator 인증 | Operator 상태/transcript 수신 |
| Sermon Session endpoint | 등록하지 않음 | 앱에서 비활성화 |

실제 auth endpoint prefix는 구현 시 기존 API convention에 맞춰 결정하되 보호 범위는 동일하게 유지한다.

### OperatorSettingsStore

고정/운영 설정은 `.env`의 기본값과 Local PC의 operator store를 overlay해 사용한다. Translation output language는 환경변수가 아니라 Operator store에서 관리하며, 값이 없으면 독일어를 사용한다. Browser appearance 설정은 Operator Browser preference로 관리하고, 다음 backend 운영값만 server-side 설정으로 관리한다.

- active interpreter (`echo` 또는 `openai`)
- OpenAI API key
- 선택한 audio device
- translation output language (`en` 또는 `de`, 기본 `de`)
- safety timer 값

API key는 API response에서 mask/status로만 표현한다. 현재 JSON store의 평문-at-rest 위험은 별도 배포/보안 과제다.

### AudioCapture

AudioCapture는 선택된 입력 device stream을 열고 작은 audio chunk를 제공하며 장치 lifecycle과 앱이 실제로 연 stream tuple을 관리한다.

Capture tuple은 `(sample_rate, channels, sample_width)`다. 장치 capability를 probe하고 실제 stream open 결과를 최종 기준으로 삼는다. device metadata의 default sample rate나 mixer 사양만 보고 app이 실제로 PCM24를 받는다고 추론하지 않는다. OS audio driver/PortAudio의 변환 가능성을 고려해 UI에는 “capture stream format”을 표시한다.

AudioCapture는 OpenAI event나 API를 알지 않는다.

### AudioProcessor

AudioProcessor는 provider-neutral 변환 경계다. 캡처 stream chunk를 작은 단위로 처리해 target tuple로 변환한다.

- sample width/PCM encoding 변환
- channel mix/convert
- resampling
- 입력 level 측정

target tuple의 유일한 기준은 `LiveInterpreter.required_sample_rate`, `required_channels`, `required_sample_width`다. OpenAI adapter는 24 kHz, mono, signed PCM16 little-endian을 요구한다. 중복된 사용되지 않는 `translation_target_*` config를 target source로 두지 않는다.

### AudioRuntime

AudioRuntime은 AudioCapture와 AudioProcessor를 소유하고 capture pump를 실행한다. Audio Test consumer와 Translation Session consumer를 구분하며, session에 필요한 audio queue를 연결/해제한다.

Queue는 chunk 개수만이 아니라 target format 기준의 queued audio duration으로 제한한다. Queue가 밀리면 broadcast를 끊지 않고 오래된 chunk를 버려 최신 audio를 유지한다. Drop chunk/duration 누계를 session scope로 집계해 Operator에 알린다. PCM frame 경계는 유지한다.

정상 stop 및 auto-stop 때 Processor의 남은 resample output을 flush하고 queue를 제한된 deadline 안에 drain한다. Deadline을 넘긴 잔여 audio도 drop 관측 정보에 반영한다. 오류/abort에서의 의도된 discard는 정상 drain과 구분한다.

### SessionService

SessionService는 `LiveInterpreter` protocol만 사용하며 provider 이름 또는 OpenAI event schema를 검사하지 않는다. lifecycle은 `off -> starting -> live -> stopping -> off/error`로 관리한다.

- session start: runtime settings 확인, interpreter 생성/검증/start, audio queue 연결, audio/event/timer task 실행
- audio pump: AudioRuntime queue에서 처리된 PCM을 interpreter에 전송
- event pump: application-level event를 BroadcastHub로 route
- stop/auto-stop: audio flush/drain, interpreter close, 마지막 출력 처리, task 정리, 종료 status publish
- error/device failure: cause를 정규화하고 관련 task/session을 정리한 뒤 error status publish

Server process lifecycle과 Translation Session lifecycle은 분리된다. `auto_stop`, `manual`, `hard_limit`, `server_shutdown`은 정상 OFF 종료 reason이다. `interpreter_error`, `device_error`는 오류 상태다. Browser UI는 raw reason code 대신 localization mapping을 표시한다.

### LiveInterpreter와 OpenAI adapter

`LiveInterpreter` protocol이 interpreter lifecycle과 필요한 오디오 포맷을 선언한다. Factory만 설정에 따라 Echo 또는 OpenAI 구현을 선택한다. Echo는 무료 local test adapter이며 production translation engine은 OpenAI다.

OpenAI adapter는 다음을 내부에서 처리한다.

- `wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate`
- server-side standard API key 인증
- translation `session.update`와 target language 설정
- 24 kHz/mono/PCM16 audio append
- provider audio/transcript/error event parsing
- session close 및 `session.closed` flush 순서

OpenAI event명과 payload는 adapter 경계를 넘어가지 않는다. SessionService/BroadcastHub/UI에는 audio, input transcript, translated text, error/close, `reconnecting`/`reconnected` 등 application event만 전달된다. Translation Session은 voice-agent `/v1/realtime`의 `response.create` lifecycle을 사용하지 않는다.

OpenAI websocket이 `session.closed` 없이 끊기면(network 순단, server close) adapter는 즉시 오류로 끝내지 않고 backoff(0.5, 1, 2, 4초)로 새 translation session을 열어 재연결한다. 재연결 중 `send_pcm`은 연결이 복구될 때까지 대기하므로 AudioRuntime queue가 기존 duration 제한/drop telemetry 규칙대로 오래된 audio를 버린다. 전송 도중 끊긴 chunk는 새 연결로 다시 보낸다. 모든 시도가 실패하거나 key가 거부되면 `OpenAI Realtime connection lost` error event를 내고 SessionService가 `interpreter_error`로 종료한다. Provider가 보낸 `error` event와 정상 종료 요청 중의 끊김은 재연결 대상이 아니다. 새 OpenAI session은 이전 session의 문맥을 이어받지 않는다.

### BroadcastHub

Local BroadcastHub는 application event와 Operator client를 연결한다. 청중 audio/text는 독립된 `RelayPublisher`를 거쳐 Berlin으로 나간다.

- Operator clients: session/audio status, input level, Berlin listener count, latency, queue drop telemetry, input/output transcript, errors, localized 가능한 종료 reason code

BroadcastHub는 OpenAI websocket/payload 또는 API key를 알지 않는다. Berlin listener count는 relay Publisher status API에서 Operator에 전달한다. Local PC에는 청중 WebSocket이나 LAN audio transport가 없다.

## Data flow

### Audio와 translation

```mermaid
sequenceDiagram
    participant Device as Audio Device
    participant Capture as AudioCapture
    participant Runtime as AudioRuntime/Processor
    participant Session as SessionService
    participant Engine as LiveInterpreter
    participant OpenAI as OpenAI Translation API
    participant Hub as BroadcastHub
    participant Operator as Operator Browser
    participant Relay as Berlin Relay
    participant Listener as Vercel Listener

    Device->>Capture: input stream
    Capture->>Runtime: small capture chunk + capture tuple
    Runtime->>Runtime: convert to interpreter required format; measure input level
    Runtime->>Session: bounded-duration audio queue
    Session->>Engine: send processed PCM
    Engine->>OpenAI: translation audio append
    OpenAI-->>Engine: audio/text deltas and session events
    Engine-->>Session: application-level interpreter events
    Session->>Hub: source text, status/error, input level
    Hub-->>Operator: transcript/status/level/listener/latency/drop events
    Session->>Relay: subtitles, scripture, status and Opus audio
    Relay-->>Listener: authenticated text/status and subscribed Opus packets
```

Translation 입력은 continuous streaming을 전제로 한다. 전체 설교를 메모리에 모아 한 번에 처리하지 않는다. Listener로 보내는 Output audio는 Local PC에서 24 kHz mono Opus로 압축하고 Berlin relay는 packet을 그대로 fan-out한다.

### Broadcast 상태와 지연

Input level은 AudioProcessor가 캡처된 원본 PCM을 기준으로 dBFS를 계산하고 Operator에 throttled event로 보낸다. 이는 장치가 연결됐는지와 다른 측정이므로 다음을 혼합하지 않는다.

- `audio_status`: capture runtime ready/error
- `audio_level`: 입력 PCM의 signal magnitude
- `interpreter/session status`: translator 연결 및 lifecycle

Latency는 현재 구현이 측정하는 오디오 전송 시점과 첫 번역 text event 사이 등 명시된 구간으로 표현한다. 이것을 end-to-end playback latency로 오해하지 않도록 UI label/문서에 측정 범위를 둔다.

## 상태와 이벤트 계약

Backend는 HTTP polling snapshot과 WebSocket event를 같은 application-level 상태 의미로 유지한다.

핵심 status/data event는 다음 의미를 갖는다.

| Event | 목적 | 대상 |
| --- | --- | --- |
| `translation_status` | session state, relay listener count, start availability, timer, `session_id`, `interpreter_reconnecting`, `translation_target_language` | Operator |
| `audio_status` | input runtime ready/error | Operator |
| `audio_level` | throttled dBFS input measurement | Operator |
| `listener_count` | 현재 Listen 연결 수 변경 | Operator |
| `latency` | 명시된 번역 latency 측정 | Operator |
| `transcript` | `input` source 또는 선택된 출력 언어의 `output` text delta | Operator |
| `audio_overflow` | 누적 dropped chunk/duration과 최근 drop | Operator |
| `error` | 이해 가능한 오류 상태 | Operator |
| `session_ended` | 최종 reason code, `session_id` | Operator |
| `subtitle`, `status`, `scripture`, `audio_gap` | 선택 언어 자막, 방송 상태, 성경 구절, Opus packet gap | Berlin relay를 경유하는 Listener |
| `pong` | Listener heartbeat 응답 | Berlin relay의 Listener |
| binary Opus packet | framed 24 kHz mono playback | 오디오 구독 중인 Listener |

Vercel Listener는 Local PC `/ws/listen` endpoint에서 상태나 audio를 받지 않는다. Berlin relay의 Listener admission 및 event contract는 [cloud relay protocol](cloud-relay-protocol.md)에 정의한다.

Listener가 Berlin relay로 보내는 message는 다음 두 가지다.

| Message | 의미 |
| --- | --- |
| `{"type":"ping"}` | heartbeat. 서버는 `{"type":"pong"}`으로 응답한다. |
| `{"type":"audio","enabled":true\|false}` | 이 연결로 바이너리 audio를 받을지 여부. 연결 기본값은 `false`. |

`session_id`는 Operator 서버 프로세스 시작 시 발급되고, Listener QR을 열면 방송 시작 전에도 relay에 등록된다. 방송 시작 시에는 같은 ID를 재사용하며 Operator 프로세스 종료 시 세션을 종료한다. Listener access token은 relay session generation별 최대 90분이며 자동 갱신은 `.todo/084` 범위다.

HTTP status와 WebSocket 종료 이벤트의 도착 순서가 달라도 Operator의 최종 UI 상태는 일관돼야 한다. `session_ended`를 받은 뒤 정상 종료는 OFF, fatal error 종료는 error로 정규화한다. `auto_stop` 같은 내부 code는 UI에서 localization된 label로 변환한다.

`audio_overflow`의 구현 field name은 backend/frontend ticket에서 하나의 contract로 확정하고, status snapshot과 event update가 서로 모순되지 않게 한다. 모든 overflow마다 toast를 반복하지 않고 누적 정보와 제한된 빈도의 경고를 제공한다.

## Listen 연결과 재연결

Listener는 Vercel static assets를 제공받은 뒤 Berlin relay에 직접 HTTPS admission과 WSS 연결을 시작한다. WSS 첫 JSON은 session-bound `listener_hello`이며 token은 URL에 포함하지 않는다. 연결 유지는 5초 ping 및 stale connection 감지로 처리하며 reconnect backoff는 1초부터 2배씩 최대 30초까지 증가한다. Token 만료나 relay가 인증을 거부하면 재연결을 멈추고 비밀번호 재입력을 요청한다. Token 자동 갱신은 `.todo/084`에서 구현한다.

Relay ready에서 protocol, session, Opus codec, sample rate, channels, packet duration 및 현재 status를 검증한다. 오디오 binary는 20-byte `SL1A` header와 단일 Opus packet으로 구성한다. sequence 또는 timestamp gap은 decoder reset 및 자막 줄 경계로 처리한다. AudioContext는 사용자 입력으로만 시작하며 화면 복귀 뒤에는 명시적 복구 버튼을 제공한다. Relay 장애 시 Local/LAN transport로 fallback하지 않는다.

## 설정과 데이터 저장

### Environment configuration

`.env`는 앱의 고정 configuration과 server secret을 담는다. 예를 들어 OpenAI server API key, default interpreter, OpenAI target language/모델 및 Operator authentication password/session signing secret이다. Sermon metadata나 매주 바뀌는 UI draft를 넣지 않는다.

### Local PC data

Operator settings(JSON store)은 active interpreter, OpenAI API key, audio device 및 Safety Timer 값을 저장한다. 이 파일은 Local PC 사용자의 파일 권한 안에 있으며 이번 목표 범위에서 at-rest encryption을 제공하지 않는다.

### Browser preference

Operator UI language/theme은 Operator Browser preference에 저장한다. Listen Browser의 theme/font size는 Listener preference로 별도 관리한다. Browser preference가 backend operator configuration을 변경하지 않는다.

Sermon Session JSON store/API implementation은 파일로 남을 수 있으나 app API router, React route, navigation 및 active SessionService에서 접근하지 않는다. Sermon notes, Bible text, glossary는 현재 translation prompt/session에 들어가지 않는다.

## 오류 처리와 복구

- Device open 실패: capture/audio status에 device error 표시, Start 비활성화.
- Audio signal 없음: input level은 floor에 머물고 device ready 상태와 구분. Audio Test에서만 측정 결과 `silent`로 보고.
- Interpreter connect/API key failure: SessionService error 종료, Operator에 오류 표시. key 값은 노출하지 않음.
- Interpreter stream/network failure: adapter가 먼저 OpenAI session을 재연결하고 `interpreter_reconnecting`을 publish한다. 재연결이 최종 실패하면 adapter error event로 변환하고, SessionService가 error/cleanup을 수행하며, Listen은 unavailable 상태를 표시하되 듣기 의도를 유지한다.
- Queue overflow: 최신 audio 유지, 오래된 audio drop 누계 및 warning을 Operator에 전달.
- 느린 Listener: Berlin relay의 bounded queue/backpressure 정책으로 격리한다. Local PC의 Operator와 다른 Listener에 영향을 주지 않는다.
- Listener WebSocket reconnect: exponential backoff로 Berlin relay에 재접속하고, token 만료/인증 실패는 비밀번호 재입력 상태로 분리한다.
- Auto Stop: 정상 종료, control OFF, localised reason. 오류 종료와 혼동하지 않음.

## 배포 및 신뢰 경계

```text
Vercel Listener -- HTTPS/WSS --> Berlin Saenuree Relay
                                      ^
                                      |
Local PC Operator --> Local FastAPI --+-- Publisher WSS
                  Local FastAPI -- API key --> OpenAI Realtime API (outbound Internet)
```

- Local PC API는 Operator용이다. 앱 port는 LAN interface에 노출될 수 있으므로 OS firewall에서 Private network만 허용한다.
- Router port forwarding을 설정하지 않는다.
- Berlin은 HTTPS password admission, session-bound Listener token 및 허용된 WebSocket Origin을 확인한다.
- Vercel은 정적 Listener UI만 제공하며 relay API나 WebSocket을 proxy하지 않는다.
- OpenAI 연결을 위해 Local PC의 outbound Internet access가 필요하다. 외부 호스팅이 아니라 외부 AI API call이다.

## 테스트 아키텍처

### Backend unit tests

- Operator auth: session signing, cookie/Origin/CSRF, protected route 및 WebSocket admission
- Audio: device capability/open negotiation, native tuple report, PCM conversion/resampling, interpreter target contract
- Runtime: queue duration limit, drop policy/telemetry, bounded shutdown drain
- SessionService: 실제 활성 class의 event routing, lifecycle, auto-stop, close/flush, device/interpreter errors
- Interpreter: OpenAI event mapping, 예기치 않은 끊김 후 재연결/재전송/최종 실패를 mocked websocket으로만 검증. 실제 OpenAI API key/network 호출은 하지 않음
- Berlin relay: Listener admission, session isolation, Opus packet contract, bounded queue/backpressure, Origin, ping/pong, token expiry
- Router registration: Sermon Session route가 앱에 등록되지 않는지 확인

### Frontend unit tests

- Listener: HTTPS password admission, WSS hello, relay event/session status, Opus packet decode, reconnect, AudioContext recovery, secret non-persistence
- Operator auth pending/login/expiry/logout과 route guard
- auto-stop 후 OFF state, 종료 reason localization, 다음 click의 start 동작
- sidebar control과 session ownership, Listener count/input level/queue warning state
- Settings 탭 이동, per-section request payload 격리, immediate apply/rollback
- Listen reconnect와 transcript/audio core state: 같은 session 재접속 시 audio 자동 재개, 끊긴 사이 session 변경, 오류 종료 후 재시작 시 재개, heartbeat watchdog, backoff, 자막 gap, jitter buffer

레이아웃 스타일, className, snapshot 테스트는 두지 않는다.

### Manual LAN/device verification

Unit test는 실제 microphone/device/OpenAI API를 대신하지 않는다. 배포 전에는 최소한 다음을 별도 확인한다.

- 비인증 Operator 요청 거부와 로그인 후 설정/Start/Stop 성공
- Listen 공개 접속 및 여러 동시 listener의 audio/text broadcast
- 듣는 중 폰 Wi-Fi off/on, AP 이동, 화면 잠금/복귀 후 자막과 audio가 자동 복구되는지
- 설교 중 Local PC의 인터넷을 잠시 끊었을 때 OpenAI 재연결 표시와 복구
- OpenAI가 실제로 audio를 실시간보다 빠르게 몰아서 보내는지와 Listen 6초 상한 도달 여부
- 자동 종료 후 button OFF와 사용자용 reason 표시
- Laptop microphone 및 실제 USB/Mixer에서 capture stream format, input level, 24 kHz conversion 확인
- 장치 unavailable, silence, interpreter/network failure, queue overflow, shutdown final-output 동작
- 현재 HTTP 전용 보안 한계와 LAN firewall 설정이 운영자에게 전달됐는지

## 의도적으로 제외하는 범위

- Listen volume control: hardware/OS volume을 사용
- Sermon Session 운영 화면/API/runtime context: route에서 비활성화하고 source/data는 보존
- Translation Profile과 Glossary injection: 현재 OpenAI translation session의 공식 지원 여부가 보장되지 않아 이 목표 구조에 포함하지 않음
- Browser의 OpenAI API 직접 연결 또는 client secret flow
- 다중 AI provider orchestration framework
- 공개 Internet을 통한 원격 Operator access
- TLS certificate provisioning: 이 roadmap ticket set에서는 제외하며 HTTP/LAN 한계를 기록
