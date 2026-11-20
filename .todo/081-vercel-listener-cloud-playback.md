# 081 Vercel Listener 인증과 압축 오디오 재생

상태: 대기
우선순위: 높음

## Goal

Vercel에 배포한 Listener가 Berlin relay에 연결하고, 청중 비밀번호를 검증한 뒤 실시간 자막과 압축 오디오를 안정적으로 표시·재생한다.

## Depends on

- `.todo/076-cloud-listener-protocol-and-codec-decision.md`
- `.todo/077-berlin-relay-session-authentication.md`
- `.todo/078-berlin-live-relay-websocket.md`

## Scope

- Listener route의 relay endpoint를 Vercel 환경 설정으로 지정한다. 운영 UI/서버 endpoint는 Vercel bundle에 포함하지 않으며 비밀 환경변수를 `VITE_` client bundle에 넣지 않는다.
- 사용자가 방송 코드를 열고 비밀번호를 입력해 HTTPS 인증 요청을 한 다음, 승인된 session token으로 Listener WebSocket에 연결하도록 한다.
- 비밀번호와 token을 URL query, localStorage, browser history, analytics/log에 넣지 않는다. token은 가능한 한 memory에만 두고 종료/만료 시 버린다.
- `.todo/076`에서 확정한 압축 오디오를 선택한 decoder로 처리한다. packet 경계, timestamp, sequence, sample-rate, gap 및 decoder 오류를 관리한다.
- 기존 Listener 번역 상태, 출력 언어 UI, 자막 자동 이동/성경 참조, 명시적 오디오 시작, Wake Lock/AudioContext 복구 UX를 유지한다.
- WSS reconnect에 exponential backoff를 사용하고 session 종료, 인증 만료, 잘못된 비밀번호, 연결 복구를 구분한다.
- Vercel static hosting이 WebSocket proxy/runtime relay가 아니라 UI 제공 역할만 맡는 구성을 문서화한다.

## Out of scope

- Vercel Serverless Function을 통한 오디오 중계
- 비밀번호를 URL/QR에 자동 포함
- 브라우저 지원을 확인하지 않은 codec fallback으로 오디오를 PCM 전체로 전송

## Acceptance criteria

- [ ] Vercel production origin에서 Berlin HTTPS auth와 WSS Listener 연결이 동작한다.
- [ ] 잘못된/만료된 비밀번호 권한으로는 session 상태·자막·오디오가 노출되지 않는다.
- [ ] 선택한 Opus decoder가 지원 대상 브라우저에서 연속 재생하고 frame 누락/재접속 후 회복한다.
- [ ] 인증 비밀과 Publisher credential은 URL, localStorage, browser console, analytics, static bundle에 노출되지 않는다.
- [ ] 기존 LAN Listener mode를 076에서 유지하기로 한 경우 그 mode의 동작도 회귀 테스트로 보존한다.
- [ ] 모바일에서 사용자 오디오 시작, 화면 복귀, AudioContext 복구 및 기존 Listen UX가 유지된다.
- [ ] Vercel build/preview/production 환경변수와 Berlin allowed-origin/WebSocket Origin 설정을 구분한다.

## Tests and verification

- Vitest에서 password flow, auth failure, WebSocket events, compressed frame decoder, reconnect/AudioContext recovery를 mock한다.
- Production build를 검사해 bundle에 secret, relay publisher credential 또는 서버 전용 환경변수가 없는지 확인한다.
- 지원 대상 브라우저/모바일은 실기기 smoke-test 항목과 미확인 범위를 기록한다.
