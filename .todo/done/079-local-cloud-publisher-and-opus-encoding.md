# 079 Local Publisher와 압축 오디오 송출

상태: 완료
우선순위: 높음

현재 적용 정책: Listener password 설정 기능은 후속 변경으로 제거되었다. 현재 청취 권한은 공유 session ID에 있으며, 이 티켓의 Publisher 송출 동작은 유지된다.

## Goal

Sermon Live backend가 기존 OpenAI Translation 출력을 받아 압축 오디오와 자막을 Berlin relay에 안전하게 송출한다. 인코딩은 Local PC에서 수행해 Render Listener egress의 압축 효과를 얻는다.

## Depends on

- `.todo/076-cloud-listener-protocol-and-codec-decision.md`
- `.todo/077-berlin-relay-session-authentication.md`
- `.todo/078-berlin-live-relay-websocket.md`

## Scope

- SessionService/LiveInterpreter의 vendor-neutral 출력 계약은 유지한다. OpenAI API key나 provider socket을 Berlin/Listener로 보내지 않는다.
- `.todo/076`에서 검증한 Opus encoder를 패키징 가능한 방식으로 통합하고 24 kHz mono PCM을 지정된 bitrate/packet duration으로 압축한다.
- Local backend가 Berlin으로 outbound `wss://` Publisher 연결을 시작한다. 수신 대기 포트, 공유기 port forwarding, Listener direct LAN 접근을 요구하지 않는다.
- 압축 프레임과 자막·상태를 relay protocol에 맞춰 순서대로 보낸다. Session ID, codec, sample rate metadata를 초기 handshake에 포함한다.
- Publisher credential은 Local backend 전용 설정에 둔다. React build, Operator API response, 로그에 노출하지 않는다.
- 일시적인 네트워크 장애에 exponential backoff로 재접속하고, 재접속 중 오디오 queue를 duration 기준으로 제한해 최신 음성을 유지한다. 이미 오래된 프레임을 무제한 재전송하지 않는다.
- 정상 종료 시 encoder 잔여 프레임을 flush하고 relay session을 종료한다. 오류 종료는 사용자/Operator에 명시한다.
- 기본 LAN broadcast를 cloud로 전환할지 여부는 076의 결정에 따르고, 기존 운영 동작의 무단 변경을 피한다.

## Out of scope

- OpenAI translation pipeline 변경
- 청중 비밀번호 입력 UX
- Berlin relay fan-out 구현
- 무제한 오프라인 오디오 저장 및 재송신

## Acceptance criteria

- [x] mock OpenAI 이벤트가 encoder를 거쳐 protocol-valid compressed frame으로 Publisher WebSocket에 전달된다.
- [x] 자막과 오디오는 독립적으로 전달되고 텍스트 자막의 언어·내용·기존 operator transcript 의미가 보존된다.
- [x] 압축 오디오 평균 wire bitrate가 076에서 정한 상한 이하이며 PCM 대비 측정치가 기록된다.
- [x] 연결 끊김/복구 중 queue memory와 audio duration은 설정 상한을 넘지 않고 재연결 시 현재 방송이 복구된다.
- [x] 정상 stop, 자동 stop, encoder 실패, relay 인증 실패 및 네트워크 단절이 구별된 상태/오류로 노출된다.
- [x] Publisher secret, OpenAI API key, PCM/압축 payload가 로그/API/browser에 노출되지 않는다.
- [x] 패키지 및 backend 테스트가 실제 OpenAI 또는 Render 연결 없이 실행된다.

## Tests and verification

- backend unit test에서 encoder framing, 재연결, queue overflow, flush, stop/error 경로를 검증한다.
- 합성 PCM과 fake relay server로 연속 송출을 검증한다.
- Windows/macOS 패키지에서 코덱 dependency load 검증은 대상 OS smoke-test로 남긴다.

## Implementation status

- `backend/services/relay_publisher.py`에 PyAV/libopus Opus 인코더, Publisher provisioning/WebSocket handshake, 재접속 및 duration 제한 queue를 구현했다.
- `backend/services/session_service.py`에 relay 송출 수명주기와 상태 전달을 연결했다.
- `backend/tests/unit/test_relay_publisher.py`와 session lifecycle 테스트로 encoder framing, 재연결, queue, flush, stop/error 경로를 검증했다.
- Windows/macOS 실제 패키지 smoke-test와 실환경 Render 부하 검증은 후속 운영 티켓에서 수행한다.
