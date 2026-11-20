# 078 Berlin 실시간 Relay WebSocket

상태: 대기
우선순위: 높음

## Goal

Berlin Saenuree backend가 인증된 Local PC Publisher로부터 실시간 자막·압축 오디오를 받고, 승인된 Listener WebSocket에 안전하게 fan-out한다.

## Depends on

- `.todo/076-cloud-listener-protocol-and-codec-decision.md`
- `.todo/077-berlin-relay-session-authentication.md`

## Scope

- `berlin-saenuree/backend`에 실시간 방송 session과 Publisher/Listener endpoint를 추가한다.
- Publisher의 제어 메시지, JSON 자막/상태와 binary 압축 오디오를 `.todo/076` 계약에 따라 처리한다.
- 세션별로 인증된 Listener만 해당 세션의 메시지를 받게 한다. Publisher가 종료하거나 연결이 끊기면 명시적 상태를 전달하고 session 자원을 정리한다.
- 각 Listener에 bounded send queue를 둔다. 한 client가 느리거나 끊겨도 Publisher 입력, 다른 Listener, 기존 CMS 요청을 블로킹하지 않게 한다. 오디오 backlog가 한도를 넘으면 오래된 오디오를 제한적으로 버리거나 해당 client를 종료하고 관측치를 남긴다.
- heartbeat, idle cleanup, 최대 동시 Listener/session 제한 및 graceful shutdown을 구현한다.
- 이 버전은 현재 Berlin 배포의 단일 worker / 단일 instance 상태 저장을 전제로 한다. 인스턴스별 메모리 상태를 이용한 수평 확장을 활성화하지 않는다.
- Binary frame과 자막 내용 또는 인증자료를 로그로 기록하지 않는다. session ID는 안전한 난수로 생성한다.

## Out of scope

- 오디오 압축/디코딩 또는 품질 변환 (Publisher가 압축한 프레임을 전달)
- 다중 Render instance 간 Redis/pub-sub 또는 영속 방송 기록
- 실시간 세션/음성 아카이브

## Acceptance criteria

- [ ] 하나의 Publisher가 session을 시작하고 압축 오디오·자막·상태를 보내며 session 종료를 알릴 수 있다.
- [ ] 두 개 이상의 승인 Listener가 올바른 순서의 동일 session 이벤트를 받고 다른 session 데이터는 받지 않는다.
- [ ] 느린 Listener의 bounded queue가 전체 방송을 막지 않고 문서화된 backpressure 정책으로 작동한다.
- [ ] 연결 종료, idle timeout, Server shutdown 시 socket과 session 자원이 해제되고 클라이언트가 복구 가능한 종료 상태를 받는다.
- [ ] 연결/Listener/session 상한을 초과하면 명시적으로 거부하고 기존 Berlin HTTP API에 영향을 주지 않는다.
- [ ] WebSocket endpoint, middleware, startup/shutdown 동작에 대한 자동 테스트가 추가된다.
- [ ] 한 worker에서만 운영하는 조건과 수평 확장 시 공유 relay가 필요함을 배포 설정/문서에 명시한다.

## Tests and verification

- Berlin backend unit test에서 fan-out 격리, queue 제한, heartbeat, Publisher 종료, listener disconnect 및 binary frame 계약을 검증한다.
- 테스트는 실제 Render/OpenAI 자격 증명 없이 실행한다.
- 부하 측정은 `.todo/082`에서 수행한다.
