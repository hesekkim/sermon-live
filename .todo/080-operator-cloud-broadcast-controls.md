# 080 Operator Cloud 방송 제어와 청중 입장 정보

상태: 대기
우선순위: 높음

## Goal

Operator가 Berlin relay를 설정하고, 방송별 청중 입장 비밀번호를 지정하며, 연결 상태와 청중에게 공유할 Vercel Listener 주소/QR을 관리할 수 있게 한다.

## Depends on

- `.todo/077-berlin-relay-session-authentication.md`
- `.todo/079-local-cloud-publisher-and-opus-encoding.md`

## Scope

- Settings에서 Berlin relay base URL과 필요한 Publisher credential을 Local backend에 안전하게 설정한다. credential은 Operator UI에 masked 상태로만 표시하고 API 응답/브라우저 storage에 평문으로 보관하지 않는다.
- Operator가 방송 시작 전 비밀번호를 정하고, 방송 중 접근 정보를 확인/재설정할 수 있게 한다. 비밀번호를 GET 응답, transcript export, URL, QR에 넣지 않는다.
- 비밀번호는 새 방송 생성/변경 시 Berlin relay로 TLS 전송하고, 방송 종료 시 relay session과 Listener 권한을 폐기한다.
- Vercel Listener 주소와 방송 코드/세션 식별자를 공유할 QR을 제공한다. QR에는 입장 비밀번호를 포함하지 않는다. 입장 비밀번호는 Operator가 별도 전달한다.
- Relay 연결/인증 오류, live/offline 상태, Listener 수, 마지막 연결 오류 등 비민감 운영 상태를 표시한다.
- 기존 Operator 인증, Broadcast 상태 UI, Safety Timer, transcript 동작을 보존한다.
- 중계 비활성화 또는 relay 장애 시 제품 결정에 따른 fallback 동작을 명확히 표시한다. 조용히 LAN/public 경로로 전환하지 않는다.

## Out of scope

- Berlin CMS 관리 화면에서 Sermon Live를 제어하는 것
- 입장 비밀번호를 URL/QR에 포함하는 것
- OpenAI API key 설정 방식 변경

## Acceptance criteria

- [ ] Operator는 relay 설정과 청중 입장 비밀번호를 설정하고 수정할 수 있으며, Listener URL/QR만으로는 접근할 수 없다.
- [ ] Publisher credential은 Local backend의 서버 측 요청에서만 사용되고 React bundle/응답/URL/로그에 존재하지 않는다.
- [ ] 비밀번호는 저장·조회 응답·export에 평문으로 남지 않고 HTTPS 요청 body로만 relay에 전달된다.
- [ ] relay 연결 실패/인증 실패/종료 상태가 Operator에 명확히 표시되고 기존 local translation 상태를 오인하지 않는다.
- [ ] listener 수는 Berlin relay의 authoritative count로 표시되고 연결이 끊기면 오래된 수를 정상 값처럼 유지하지 않는다.
- [ ] QR에는 Vercel origin과 비밀이 아닌 session 식별 정보만 포함된다.
- [ ] 기존 Operator auth, Settings Apply, Broadcast/auto-stop 회귀 테스트가 통과한다.

## Tests and verification

- frontend/backend unit test에서 secret masking, password 미반환, QR payload, relay 오류/연결 상태를 검증한다.
- Browser test에서 Publisher credential 및 입장 비밀번호가 localStorage, URL, console/log에 남지 않는지 검사한다.
