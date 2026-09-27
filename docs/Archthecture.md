# 목표 아키텍처

## 문서 목적과 범위

이 문서는 `.todo/035`부터 `.todo/043`까지의 Operator UX, 인증, 오디오 안정성, route 정리 티켓이 완료되었다고 가정한 **목표 상태**를 설명한다. 현재 코드 상태를 그대로 기록한 문서가 아니다.

초기 제품 방향과 OpenAI translation 설계는 [Archthecture.md](Archthecture.md)에 남아 있다. 초기 문서와 본 문서의 운영 UX/route 결정이 다르면 이 문서를 현재 roadmap의 기준으로 삼는다. 새 작업 티켓은 [.todo/README.md](../.todo/README.md)를 참조한다.

이 목표 상태는 Local PC가 FastAPI와 React 애플리케이션을 실행하고, 같은 교회 Wi-Fi에 연결된 청취자에게 Listen을 제공하는 배포를 전제로 한다. 앱 서버는 외부에 호스팅하지 않지만, 번역을 위해 Backend는 OpenAI Realtime API에 outbound 연결한다.

이 문서는 새 UX/안정성 티켓만 완료된 상태를 기술한다. 기존 backlog에 남은 OpenAI 실제 장비 end-to-end 확인, Glossary 기능은 완료된 것으로 간주하지 않는다. Sermon Session은 현재 애플리케이션에서 비활성화되며 번역 context로 사용하지 않는다.

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
Operator Browser <---- BroadcastHub/WebSocket ----> Listen Browsers
```

언어 방향은 Korean source에서 German target으로 고정한다. OpenAI API key는 Backend에서만 사용하고 Browser나 Listen client에 전달하지 않는다.

## 실행 단위와 소유권

### Local PC Backend

FastAPI 프로세스는 HTTP API, WebSocket, Operator 인증, 오디오 입력 runtime, Translation Session lifecycle, broadcast fan-out을 소유한다.

- 서버 프로세스는 계속 실행될 수 있다.
- AudioRuntime은 시작 시 입력 장치를 열고 장치 상태와 input level을 관리한다.
- 비용이 발생하는 외부 Translation Session은 Operator가 시작할 때만 연결한다.
- 서버 종료 시 활성 Translation Session을 종료하고 AudioRuntime 및 WebSocket client를 정리한다.
- listen clients가 증가해도 OpenAI API key 또는 OpenAI socket은 client 쪽에 생성되지 않는다.

### Browser 애플리케이션

React 앱은 두 가지 사용자 surface를 제공한다.

- `/listen`: 같은 Wi-Fi 청취자가 쓰는 공개 Listen 화면.
- `/operator/*`: 로그인한 운영자가 쓰는 Broadcast와 Settings.

Operator shell은 Broadcast 상태 구독과 조작을 route component보다 상위에서 소유한다. Broadcast와 Settings 사이를 이동해도 WebSocket, status refresh, live timer, pending action이 unmount되지 않는다.

## 사용자 화면

### Listen

Listen은 로그인 없이 접근할 수 있다. 연결 상태, translation 상태, 독일어 자막, 명시적인 Listen 시작, 글자 크기와 listener theme을 제공한다. 재연결, 대기, 정상 종료, 통역 오류를 구분한다.

오디오 playback은 Listen Browser의 AudioContext에서 수행한다. 사용자 음량은 기기의 하드웨어/OS 조절을 사용하며 앱에 별도의 volume control을 두지 않는다. Listen Browser에는 Operator 설정이나 API key가 전달되지 않는다.

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

본문은 Korean source와 German translation transcript를 유지한다. transcript download가 지원되는 경우 기존 동작을 유지한다.

현재 signal label은 Input level의 동일한 값에 threshold를 적용한 파생 표시다. 따라서 Broadcast에는 level meter와 별도의 "Audio signal / Silent" label을 중복 노출하지 않는다. 단, input device의 ready/error는 signal 크기와 다른 상태이므로 계속 표시한다. Audio Test 화면의 신호/무음 결과는 짧은 측정 구간에 대한 테스트 판정이므로 별도로 유지한다.

Operator 상단에는 Settings icon과 Dark mode toggle을 둔다. theme은 즉시 바뀌고 Operator preferences 저장 방식을 사용한다. Settings route에서 Broadcast로 돌아가도 live session 상태는 유지된다.

### Operator Settings

Settings는 다음 네 탭을 사용한다.

1. **Appearance**: UI language를 선택 즉시 적용한다. Dark mode는 공통 상단 toggle에서 조절한다. 이 탭에는 Apply 버튼이 없다.
2. **Input devices**: 장치 선택 즉시 저장한다. 저장에 성공하면 backend capture runtime에 반영한다. Session live 중 변경은 거부하고 사용자가 이전 선택을 유지하도록 한다. Audio Test는 장치 연결, input level, capture stream format, processing format 및 변환 성공 여부를 확인한다.
3. **Safety**: Auto Stop, warning, extension, hard limit을 편집하고 이 값만 저장하는 Apply 버튼을 둔다.
4. **API Model**: Echo/OpenAI 선택과 OpenAI API key 저장 상태/입력을 관리하고 이 값만 저장하는 Apply 버튼을 둔다. 저장된 API key 원문은 응답으로 되돌려주지 않는다.

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
- `/listen`
- `/ws/listen`

Listen 공개는 같은 Wi-Fi에 있는 누구든 진행 중인 독일어 audio와 subtitle을 수신할 수 있다는 의미다. 이는 운영 정책이다.

### 세션과 보안 한계

Operator password 및 세션 signing secret은 Local PC의 environment configuration에서 설정한다. 로그인 후에는 HttpOnly/SameSite cookie session을 사용하며 credential을 localStorage, URL, API response 또는 log에 넣지 않는다. Unsafe HTTP 요청에는 Origin/CSRF 검증을 적용한다. 로그인 실패 시도를 제한한다.

HTTPS/WSS 인증서 배포는 이 roadmap 범위에서 하지 않는다. 따라서 HTTP LAN에서 앱 로그인은 임의 Operator 조작을 막지만, 같은 Wi-Fi의 능동적 네트워크 공격자에게 credential/session 기밀성을 보장하지 않는다. 운영은 신뢰 가능한 private Wi-Fi와 Windows 방화벽 제한을 전제로 하고 router port forwarding을 하지 않는다.

OpenAI API key는 Browser에 노출되지 않지만 현재 설정 저장소의 at-rest 암호화는 별도 범위다. Local PC 사용자 계정 또는 해당 설정 파일이 탈취되는 경우를 앱 로그인만으로 방어한다고 간주하지 않는다.

## Backend 구성과 책임

### HTTP/API Router

Router는 HTTP/WebSocket 입출력과 인증 적용을 담당하고 capture, interpreter 또는 session business logic을 직접 구현하지 않는다.

| Surface | 접근 | 책임 |
| --- | --- | --- |
| `/health` | 공개 | process health 확인 |
| `/ws/listen` | 공개 | Listen client 등록 및 broadcast 수신 |
| `/api/v1/auth/*` 또는 동등한 auth route | 공개 진입 | 로그인, 현재 session 확인, logout |
| `/api/v1/operator/settings` | Operator 인증 | runtime/operator 설정 조회와 저장 |
| `/api/v1/session/*` | Operator 인증 | translation session 조회와 lifecycle control |
| `/api/v1/audio/*` | Operator 인증 | device discovery 및 Audio Test |
| `/ws/operator` | Operator 인증 | Operator 상태/transcript 수신 |
| Sermon Session endpoint | 등록하지 않음 | 앱에서 비활성화 |

실제 auth endpoint prefix는 구현 시 기존 API convention에 맞춰 결정하되 보호 범위는 동일하게 유지한다.

### OperatorSettingsStore

고정/운영 설정은 `.env`의 기본값과 Local PC의 operator store를 overlay해 사용한다. Browser appearance 설정은 Operator Browser preference로 관리하고, 다음 backend 운영값만 server-side 설정으로 관리한다.

- active interpreter (`echo` 또는 `openai`)
- OpenAI API key
- 선택한 audio device
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

OpenAI event명과 payload는 adapter 경계를 넘어가지 않는다. SessionService/BroadcastHub/UI에는 audio, input transcript, translated text, error/close 등 application event만 전달된다. Translation Session은 voice-agent `/v1/realtime`의 `response.create` lifecycle을 사용하지 않는다.

### BroadcastHub

BroadcastHub는 application event/audio를 등록 client에 fan-out한다.

- Listen clients: session status, German translated text, output sample rate, binary translated audio, ended state
- Operator clients: session/audio status, input level, listener count, latency, queue drop telemetry, input/output transcript, errors, localized 가능한 종료 reason code

BroadcastHub는 OpenAI websocket/payload 또는 API key를 알지 않는다. Listener count는 등록/해제 시 갱신한다. 하나의 listener 연결 실패가 다른 client 전달을 막지 않는다.

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
    participant Listen as Listen Browsers
    participant Operator as Operator Browser

    Device->>Capture: input stream
    Capture->>Runtime: small capture chunk + capture tuple
    Runtime->>Runtime: convert to interpreter required format; measure input level
    Runtime->>Session: bounded-duration audio queue
    Session->>Engine: send processed PCM
    Engine->>OpenAI: translation audio append
    OpenAI-->>Engine: audio/text deltas and session events
    Engine-->>Session: application-level interpreter events
    Session->>Hub: audio, translated text, source text, status/error
    Hub-->>Listen: text/status JSON and binary output audio
    Hub-->>Operator: transcript/status/level/listener/latency/drop events
```

Translation 입력은 continuous streaming을 전제로 한다. 전체 설교를 메모리에 모아 한 번에 처리하지 않는다. Output audio는 target sample rate metadata와 함께 전달한다.

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
| `translation_status` | session state, listener count, start availability, timer | Operator, Listen snapshot |
| `audio_status` | input runtime ready/error | Operator |
| `audio_level` | throttled dBFS input measurement | Operator |
| `listener_count` | 현재 Listen 연결 수 변경 | Operator |
| `latency` | 명시된 번역 latency 측정 | Operator |
| `transcript` | `input` Korean 또는 `output` German text delta | Operator |
| `audio_overflow` | 누적 dropped chunk/duration과 최근 drop | Operator |
| `error` | 이해 가능한 오류 상태 | Operator, 필요 시 Listen |
| `session_ended` | 최종 reason code | Operator, Listen |
| binary audio + sample-rate metadata | translated PCM playback | Listen |

HTTP status와 WebSocket 종료 이벤트의 도착 순서가 달라도 Operator의 최종 UI 상태는 일관돼야 한다. `session_ended`를 받은 뒤 정상 종료는 OFF, fatal error 종료는 error로 정규화한다. `auto_stop` 같은 내부 code는 UI에서 localization된 label로 변환한다.

`audio_overflow`의 구현 field name은 backend/frontend ticket에서 하나의 contract로 확정하고, status snapshot과 event update가 서로 모순되지 않게 한다. 모든 overflow마다 toast를 반복하지 않고 누적 정보와 제한된 빈도의 경고를 제공한다.

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
- Interpreter stream/network failure: adapter event로 변환, SessionService가 error/cleanup 수행, Listen은 unavailable/reconnect state를 표시.
- Queue overflow: 최신 audio 유지, 오래된 audio drop 누계 및 warning을 Operator에 전달.
- WebSocket reconnect: Operator가 status snapshot으로 복구하고 Listen은 공개 endpoint에 재접속.
- Auto Stop: 정상 종료, control OFF, localised reason. 오류 종료와 혼동하지 않음.

## 배포 및 신뢰 경계

```text
교회 Wi-Fi
  ├── Operator device -- login cookie --> Local PC FastAPI
  ├── Listen devices ------------------> Local PC FastAPI/WebSocket
  └── Local PC FastAPI -- API key -----> OpenAI Realtime API (outbound Internet)
```

- 앱 port는 Local PC LAN interface에 노출될 수 있으므로 OS firewall에서 Private network만 허용한다.
- Router port forwarding을 설정하지 않는다.
- Listen endpoint 공개는 의도된 기능이다. Wi-Fi에 접속한 client는 방송 output을 수신할 수 있다.
- 앱 로그인은 Operator 제어를 보호하지만, TLS가 없으면 같은 Wi-Fi의 공격자에 대한 transport confidentiality/integrity를 제공하지 않는다.
- OpenAI 연결을 위해 Local PC의 outbound Internet access가 필요하다. 외부 호스팅이 아니라 외부 AI API call이다.

## 테스트 아키텍처

### Backend unit tests

- Operator auth: session signing, cookie/Origin/CSRF, protected route 및 WebSocket admission, public route 예외
- Audio: device capability/open negotiation, native tuple report, PCM conversion/resampling, interpreter target contract
- Runtime: queue duration limit, drop policy/telemetry, bounded shutdown drain
- SessionService: 실제 활성 class의 event routing, lifecycle, auto-stop, close/flush, device/interpreter errors
- Interpreter: OpenAI event mapping과 mocked websocket만 검증. 실제 OpenAI API key/network 호출은 하지 않음
- Router registration: Sermon Session route가 앱에 등록되지 않는지 확인

### Frontend unit tests

- Operator auth pending/login/expiry/logout과 route guard
- auto-stop 후 OFF state, 종료 reason localization, 다음 click의 start 동작
- sidebar control과 session ownership, Listener count/input level/queue warning state
- Settings 탭 이동, per-section request payload 격리, immediate apply/rollback
- Listen reconnect와 transcript/audio core state

레이아웃 스타일, className, snapshot 테스트는 두지 않는다.

### Manual LAN/device verification

Unit test는 실제 microphone/device/OpenAI API를 대신하지 않는다. 배포 전에는 최소한 다음을 별도 확인한다.

- 비인증 Operator 요청 거부와 로그인 후 설정/Start/Stop 성공
- Listen 공개 접속 및 여러 동시 listener의 audio/text broadcast
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
