# 084 Listener token 갱신과 만료 전 재접속

상태: 대기
우선순위: 높음

## Goal

90분을 넘는 방송에서도 청중이 비밀번호를 반복 입력하지 않고 Berlin relay의 자막과 Opus 오디오를 계속 받을 수 있도록 Listener 인증을 안전하게 갱신하고 WebSocket을 교체한다.

## Depends on

- `.todo/077-berlin-relay-session-authentication.md`
- `.todo/081-vercel-listener-cloud-playback.md`

## Scope

- 최대 90분 access token을 만료 전에 갱신하는 인증 방식을 설계하고 Berlin relay endpoint와 Listener client에 구현한다. Access token 자체의 허용 수명을 90분보다 늘리지 않는다.
- 갱신 권한은 해당 session 및 현재 password version에 묶고, 방송 종료·비밀번호 변경·token 폐기 후에는 새 token을 발급하지 않는다.
- Listener는 현재 WebSocket이 만료되기 전에 새 token을 얻고 새 WebSocket을 연결한다. 새 연결이 준비된 후 기존 연결을 닫고 오디오 구독 상태를 복구한다.
- Reconnect 중 자막 중복/누락과 Opus packet 중복을 처리하며, 오디오 decoder와 사용자 gesture 상태를 불필요하게 초기화하지 않는다.
- 인증 실패·rate limit·방송 종료는 구분해 안내하고, 인증 실패를 무한 재시도로 반복하지 않는다.
- 재사용 가능한 갱신 비밀은 URL, localStorage, browser history, analytics/log에 저장하지 않는다. 선택한 refresh 권한 모델과 위협 분석을 문서화한다.

## Out of scope

- Access token 수명을 90분보다 길게 늘리는 것
- Listener 개인 계정, 이메일 로그인 또는 비밀번호를 URL/QR에 포함하는 것
- Berlin relay 장애나 Publisher 재시작에 대한 전체 복구/부하 검증 (`082`에서 다룸)

## Acceptance criteria

- [ ] 인증된 Listener가 반복 입력 없이 만료 전에 새 access token을 얻고 만료 이전에 WSS 연결을 교체한다.
- [ ] 새 WSS가 준비될 때까지 기존 연결을 유지하고, 교체 뒤 자막/오디오 구독 상태를 복구한다.
- [ ] 교체 중 session 경계와 packet sequence를 검증해 오래된/중복 오디오를 재생하지 않는다.
- [ ] 만료 후 새 token으로 접근할 수 없으며, 방송 종료 또는 비밀번호 변경 뒤 갱신 요청도 거부된다.
- [ ] 갱신 권한은 session-bound, revoke 가능한 짧은 access token 정책을 우회하지 않으며 server-side rate limit이 적용된다.
- [ ] 비밀번호와 갱신 비밀은 URL, localStorage, browser history, 로그, analytics 및 frontend static bundle에 노출되지 않는다.
- [ ] 인증 실패, 종료 session, rate limit, 일시적인 네트워크 오류에 대한 재시도/사용자 안내 동작이 구분된다.

## Tests and verification

- Berlin backend 테스트에서 정상 갱신, 잘못된/만료된/폐기된 갱신 권한, session 불일치, password 변경, session 종료 및 rate limit을 검증한다.
- Listener Vitest에서 만료 전 갱신, 기존/새 WebSocket 교체 순서, 재시도, 오디오 구독 복구, 중복 packet 방지 및 종료 상태를 fake timer로 검증한다.
- 통합 테스트에서 token expiry 직전·직후의 reconnect 흐름을 검증하고, secret이 URL/storage/log에 기록되지 않는지 확인한다.
- 지원 브라우저에서 장시간 재생 중 token 교체와 모바일 AudioContext 복구를 smoke-test한다.
