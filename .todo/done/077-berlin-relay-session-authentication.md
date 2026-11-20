# 077 Berlin Relay 방송별 인증과 Listener 권한

상태: 완료
우선순위: 높음

## Goal

청중은 Operator가 설정한 방송별 비밀번호로 입장하고, Local PC Publisher만 방송 데이터와 제어 이벤트를 송신하도록 Berlin backend에 별도 인증 체계를 추가한다.

## Depends on

- `.todo/076-cloud-listener-protocol-and-codec-decision.md`

## Scope

- Publisher와 Listener를 별도 권한·credential로 분리한다. CMS site-admin/JWT 인증은 재사용하지 않는다.
- Local PC Publisher가 강한 service credential로 방송을 생성·갱신·종료할 수 있게 한다. credential은 Local PC backend에서만 보관·사용하며 frontend, URL, 응답, 로그에 노출하지 않는다.
- Operator가 지정하는 방송별 Listener 비밀번호는 TLS를 통해 relay에 전달하고 Berlin backend에는 강한 단방향 해시로 저장한다. 조회 API에서 비밀번호를 반환하지 않는다.
- Listener 비밀번호 검증 성공 시 해당 session에만 한정된 최대 90분 수명의 권한을 발급한다. 비밀번호 변경·방송 종료·만료 시 기존 권한을 무효화한다.
- 비밀번호 추측, session enumeration, 과도한 접속을 제한하고 실패 응답에서 방송 존재 여부나 비밀번호 일부를 노출하지 않는다.
- WebSocket Origin을 명시된 Vercel production/preview 정책에 따라 검증한다. CORS만으로 WebSocket 보안을 대체하지 않는다.
- token/비밀번호/credential을 access log, 오류 메시지, analytics에 남기지 않는다. query parameter를 인증 비밀 전달 수단으로 사용하지 않는다.

## Out of scope

- Berlin CMS 사용자/관리자 인증 흐름 변경
- 이메일 계정 생성이나 청중 개인별 계정
- 브라우저에 Publisher credential을 전달하는 것

## Acceptance criteria

- [x] 미인증 WebSocket은 자막/오디오를 받지 않으며 Publisher만 session 생명주기와 송신 권한을 가진다.
- [x] Listener 비밀번호 검증 후 해당 session의 Listener 권한만 획득하며 다른 session 접근은 거부된다.
- [x] 방송 종료, 비밀번호 교체, token 만료 후 이전 Listener 권한은 거부된다.
- [x] 비밀번호 저장은 검증된 password hashing 방식과 적절한 비용 설정을 사용하고 원문 저장/로그가 없다.
- [x] 인증 실패와 대입 시도가 IP/session 기준으로 제한되며 응답은 계정/session 열거에 사용될 수 없다.
- [x] HTTP 및 WebSocket 양쪽 admission에 적용되는 테스트가 있고 기존 CMS auth 테스트가 유지된다.
- [x] WebSocket 인증이 URL query에 비밀을 넣지 않으며 Origin 검증 테스트가 있다.
- [x] Listener token 기본 수명은 90분이며, 설정은 90분을 넘을 수 없고 만료 시 연결된 WebSocket도 닫힌다.

## Tests and verification

- backend unit/integration test에서 Publisher 권한, Listener 비밀번호 검증, 만료/폐기, 과도한 실패, Origin 불일치를 검증한다.
- rate limit은 WebSocket 연결과 password-check HTTP endpoint를 모두 다룬다. 기존 HTTP middleware만으로 WebSocket 제어가 된다고 가정하지 않는다.
- 실제 비밀번호와 credential은 test fixture, 로그, 저장소에 커밋하지 않는다.

## Follow-up

- 현재 Listen UI는 Local PC `/ws/listen`을 사용한다. Remote-only Listener UI에서 Berlin relay의 session/password admission, Listener WebSocket, 브라우저 Opus 디코딩을 연결하는 후속 작업이 필요하다.
- Remote-only Listener UI는 `.todo/081-vercel-listener-cloud-playback.md`에서 구현한다.
- token 자동 갱신과 만료 전 재접속은 `.todo/084-listener-token-renewal-and-reconnect.md`에서 구현한다. 현재 버전은 최대 90분 후 재인증이 필요하다.
