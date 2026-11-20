# 083 Cloud Listener 배포와 운영 검증

상태: 대기
우선순위: 높음

## Goal

Berlin Saenuree Render backend, Sermon Live Local Publisher, Vercel Listener의 production 설정·배포·운영·장애 대응 절차를 안전하게 문서화하고, 배포 후 실제 연결과 청취 UX를 검증한다.

## Depends on

- `.todo/done/081-vercel-listener-cloud-playback.md`
- `.todo/082-cloud-relay-resilience-and-load-validation.md`

## Scope

- `berlin-saenuree/backend`에 필요한 Render 환경변수, 단일 instance/worker 전제, WebSocket endpoint와 health check, origin allowlist, secret 초기화/교체 절차를 문서화한다.
- `sermon-live/backend/.env.example`과 패키지 설정에 relay URL 및 Publisher credential 이름/보안 요구를 추가한다. 실제 비밀은 예제·기본값·저장소에 넣지 않는다.
- Vercel build/production environment variable, public Listener URL, Berlin HTTPS/WSS origin allowlist 및 build/redeploy 절차를 문서화한다.
- Render의 Starter compute, workspace별 monthly egress allowance, 초과 요금, 대시보드 모니터링과 예상 listener-hour 계산을 설명한다. 변동 가능한 요금은 Render 공식 문서/대시보드 확인을 안내한다.
- `.todo/done/081-vercel-listener-cloud-playback.md`의 배포 후 검증을 이 티켓에서 수행한다. Preview/production Vercel origin의 HTTPS admission과 WSS 연결, Berlin origin 허용, 실기기 재생은 코드 단위 테스트를 대체하지 않는 별도 smoke test다.
- 공유 session link의 live/off admission, session 종료 후 5초 로그아웃, 자막/성경 구절 및 연속 Opus playback을 실제 배포 환경에서 확인한다.
- 지원 대상 브라우저와 iOS/Android 실기기에서 명시적 오디오 시작, 화면 복귀, AudioContext/Wake Lock 복구를 확인하고 버전·기기·환경별 결과를 기록한다.
- 방송 전 checklist, session link를 의도된 청중에게만 공유하는 방법, Publisher credential rotation, Render 재배포 중 연결 끊김, 장애 시 대응 및 081의 remote-only Listener 정책을 안내한다.
- session link는 bearer access이므로 외부에 공개하지 않고, Publisher credential이나 단기 Listener token은 URL/QR에 넣지 않는다. 라우터 port forwarding도 설정하지 않는다.
- 프로젝트 README 및 `.todo/README.md`의 아키텍처/보안 설명을 실제 배포 결과와 일치시킨다.

## Out of scope

- 사용자 대신 실제 Render/Vercel 계정의 secret 생성·설정 또는 배포를 수행하는 것. 운영자가 수행한 배포 후 smoke test와 결과 기록은 이 티켓의 범위다.
- Vercel/Render 요금이나 제공량이 영구 고정이라고 보장하는 것
- 081에서 확정한 remote-only 정책과 달리 cloud 장애 시 LAN Listener fallback을 추가하는 것

## Acceptance criteria

- [ ] 깨끗한 환경에 필요한 변수 이름과 역할만 문서화하며 실제 credential은 없다.
- [ ] Local PC Publisher, Berlin relay, Vercel Listener의 네트워크 방향과 TLS/WSS를 다이어그램/단계로 설명한다.
- [ ] Render WebSocket reconnect와 instance shutdown 때의 동작, single-instance 한계를 설명한다.
- [ ] session link가 청취 권한임을 설명하고, Publisher credential의 보관 위치·회전 방법을 구분해 안내한다.
- [ ] Render outbound bandwidth 계산 예시와 현재 공식 문서 링크 및 대시보드 확인 위치가 있다.
- [ ] Listener remote-only 및 LAN fallback 제거 정책이 076 결정과 081 실제 구현에 일치한다.
- [ ] 개발/preview/production에서 CORS 및 WebSocket Origin 설정을 분리한다.
- [ ] 문서의 모든 명령/환경 변수/URL이 실제 설정 이름과 대조 검증된다.
- [ ] Preview/production 배포에서 설정된 Berlin HTTPS/WSS endpoint와 허용 Origin을 확인한다.
- [ ] 공유 session link로 live 방송에 입장할 수 있고, OFF 상태에서는 admission 및 미디어·session state 전달이 거부되는지 확인한다.
- [ ] active broadcast에서 자막·성경 구절·연속 Opus audio가 동작하고 종료 event 후 5초 안내 및 로그아웃이 동작한다.
- [ ] 지원 브라우저 및 iOS/Android 실기기에서 명시적 audio start, 화면 잠금/복귀 및 AudioContext/Wake Lock 복구를 확인한다.
- [ ] 검증 날짜, Vercel environment, 브라우저/기기 버전, 결과와 미해결 항목을 기록한다. 실제 비밀은 결과나 로그에 남기지 않는다.

## Tests and verification

- 문서 내 변수 이름을 `.env.example`, Render config, Vercel config와 수동 대조한다.
- 배포 전 checklist를 따라 staging/preview/production 연결과 Listener 동작을 smoke test한다. 실제 credential은 문서·fixture·로그에 남기지 않는다.
- 081에서 이관한 실제 Vercel Origin, live-only admission, WSS, Opus 재생, session 종료 및 모바일/브라우저 수동 검증을 수행해 결과를 기록한다.
