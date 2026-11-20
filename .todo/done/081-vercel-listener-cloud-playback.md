# 081 Vercel Listener 인증과 압축 오디오 재생

상태: 완료 (코드 구현·자동 검증 완료; 배포 후 검증은 083으로 이관)
우선순위: 높음

현재 적용 정책: 이 티켓에서 구현한 Listener password 입장 흐름은 후속 변경으로 제거되었다. 현재는 공유 session ID로 단기 Listener token을 발급하며, 만료 시 같은 링크로 다시 연결한다.

## Goal

Vercel에 배포한 Listener가 Berlin relay에 연결하고, 청중 비밀번호를 검증한 뒤 실시간 자막과 압축 오디오를 안정적으로 표시·재생한다.

## Depends on

- `.todo/done/076-cloud-listener-protocol-and-codec-decision.md`
- `.todo/done/077-berlin-relay-session-authentication.md`
- `.todo/done/078-berlin-live-relay-websocket.md`

## Scope

- Listener는 remote-only로 동작한다. 현재 same-origin `/ws/listen` Local PC 청취 경로를 제거하고, 청취 데이터는 Berlin relay를 통해서만 받는다. Relay 장애 시 LAN/local 경로로 fallback하지 않는다.
- Local PC frontend의 `/listen` Listener route를 제거하고 `/`는 Operator로 이동한다.
- Listener route의 relay endpoint를 Vercel 환경 설정으로 지정한다. 운영 UI/서버 endpoint는 Vercel bundle에 포함하지 않으며 비밀 환경변수를 `VITE_` client bundle에 넣지 않는다.
- 공유 링크의 session code는 방송 식별자이며 비밀번호가 아니다. URL에 있으면 자동 입력하고 직접 접속 시 설명과 함께 입력할 수 있게 한다.
- 유효한 비밀번호여도 Berlin Publisher가 live 상태가 아니면 token을 발급하지 않는다. session state는 올바른 비밀번호를 검증한 뒤에만 구분한다.
- 비밀번호와 token을 URL query, localStorage, browser history, analytics/log에 넣지 않는다. token은 가능한 한 memory에만 두고 종료/만료 시 버린다.
- `.todo/done/076`에서 확정한 압축 오디오를 선택한 decoder로 처리한다. packet 경계, timestamp, sequence, sample-rate, gap 및 decoder 오류를 관리한다.
- 기존 Listener 번역 상태, 출력 언어 UI, 자막 자동 이동/성경 참조, 명시적 오디오 시작, Wake Lock/AudioContext 복구 UX를 유지한다.
- WSS reconnect에 exponential backoff를 사용하고 session 종료, 인증 만료, 잘못된 비밀번호, 연결 복구를 구분한다.
- 방송 종료 event를 받으면 audio/token을 즉시 중단하고 현지화된 종료 대화창을 5초 표시한 뒤 admission 화면으로 강제 로그아웃한다.
- Admission, transcript, controls, 종료 대화창은 별도 component로 나누고 Listener UI copy는 translation module에 둔다.
- Access token 만료 전 갱신 및 WSS 교체는 `.todo/084-listener-token-renewal-and-reconnect.md`에서 구현한다. 이 티켓에서는 재인증이 필요한 만료 상태를 안전하게 표시한다.
- Vercel static hosting이 WebSocket proxy/runtime relay가 아니라 UI 제공 역할만 맡는 구성을 문서화한다.

## Out of scope

- Vercel Serverless Function을 통한 오디오 중계
- 비밀번호를 URL/QR에 자동 포함
- 브라우저 지원을 확인하지 않은 codec fallback으로 오디오를 PCM 전체로 전송
- LAN/local Listener 경로를 유지하거나 cloud 장애 시 local 경로로 전환하는 것

## Acceptance criteria

- [x] 독립 Listener 앱의 Berlin HTTPS admission 및 WSS 흐름을 구현하고 production build를 생성한다. 실제 배포 origin smoke test는 083에서 수행한다.
- [x] 자동 테스트에서 잘못된 비밀번호는 WebSocket 연결을 만들지 않으며, 만료 token은 비밀번호 재입력을 요구한다.
- [x] 올바른 비밀번호여도 방송이 live가 아니면 token을 발급하지 않고, 종료 후 5초 뒤 admission 화면으로 돌아간다.
- [x] Vitest에서 Opus packet decode, frame gap 및 reconnect 후 audio 복구를 검증한다. 지원 브라우저의 실기기 연속 재생 검증은 083에서 수행한다.
- [x] 인증 비밀과 Publisher credential은 URL/localStorage에 저장되지 않으며 Listener production bundle에서 server secret, Operator 경로, `/ws/listen` 참조를 찾지 못했다.
- [x] Listen UI는 Berlin relay transport만 사용하며 local/LAN fallback이 없다.
- [x] Local PC 앱에서 `/listen`은 Listener UI를 제공하지 않고 `/`는 Operator로 이동한다.
- [x] mock 테스트에서 명시적 오디오 시작과 AudioContext 복구 UX를 검증한다. 모바일 실기기 검증은 083에서 수행한다.
- [x] 배포 문서에서 Vercel Development/Preview/Production 환경변수와 Berlin allowed-origin/WebSocket Origin 설정을 구분한다.

## Tests and verification

- Vitest에서 password flow, auth failure, WebSocket events, compressed frame decoder, reconnect/AudioContext recovery를 mock한다.
- Production build를 검사해 bundle에 secret, relay publisher credential 또는 서버 전용 환경변수가 없는지 확인한다.
- Vercel staging/production origin 연결 및 지원 브라우저·모바일 실기기 smoke-test는 `.todo/083-cloud-listener-deployment-and-operations.md`로 이관한다.

## 현재 검증 기록

- Listener frontend: Vitest 15개 통과, TypeScript 및 Vite production build 통과.
- Local Operator frontend: Vitest 113개 통과, TypeScript/Vite production build 통과.
- Local backend relay publisher/session 및 Listener endpoint 제거 테스트 49개 통과.
- Berlin relay auth/stream 테스트 18개 통과.
- Vercel 실제 배포/Origin 설정, 지원 브라우저의 연속 Opus playback, 모바일 실기기 검증은 코드 구현 범위가 아니라 083의 배포 후 검증 항목으로 이관했다.
