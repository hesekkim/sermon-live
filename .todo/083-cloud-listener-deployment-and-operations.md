# 083 Cloud Listener 배포와 운영 문서

상태: 대기
우선순위: 높음

## Goal

Berlin Saenuree Render backend, Sermon Live Local Publisher, Vercel Listener의 production 설정·배포·운영·장애 대응 절차를 안전하게 문서화한다.

## Depends on

- `.todo/082-cloud-relay-resilience-and-load-validation.md`

## Scope

- `berlin-saenuree/backend`에 필요한 Render 환경변수, 단일 instance/worker 전제, WebSocket endpoint와 health check, origin allowlist, secret 초기화/교체 절차를 문서화한다.
- `sermon-live/backend/.env.example`과 패키지 설정에 relay URL 및 Publisher credential 이름/보안 요구를 추가한다. 실제 비밀은 예제·기본값·저장소에 넣지 않는다.
- Vercel build/production environment variable, public Listener URL, Berlin HTTPS/WSS origin allowlist 및 build/redeploy 절차를 문서화한다.
- Render의 Starter compute, workspace별 monthly egress allowance, 초과 요금, 대시보드 모니터링과 예상 listener-hour 계산을 설명한다. 변동 가능한 요금은 Render 공식 문서/대시보드 확인을 안내한다.
- 방송 전 checklist, 비밀번호를 별도 전달하는 방식, 방송 종료/secret rotation, Render 재배포 중 연결 끊김, 장애 시 대응 및 현재 LAN mode 정책을 안내한다.
- 운영 문서는 Listener password를 URL/QR에 넣거나 라우터 port forwarding을 설정하도록 유도하지 않는다.
- 프로젝트 README 및 `.todo/README.md`의 아키텍처/보안 설명을 실제 배포 결과와 일치시킨다.

## Out of scope

- 실제 Render/Vercel 계정의 secret 설정 또는 배포를 대신 수행하는 것
- Vercel/Render 요금이나 제공량이 영구 고정이라고 보장하는 것
- 사용자 승인 없이 기존 LAN 운영 경로를 제거하는 것

## Acceptance criteria

- [ ] 깨끗한 환경에 필요한 변수 이름과 역할만 문서화하며 실제 credential은 없다.
- [ ] Local PC Publisher, Berlin relay, Vercel Listener의 네트워크 방향과 TLS/WSS를 다이어그램/단계로 설명한다.
- [ ] Render WebSocket reconnect와 instance shutdown 때의 동작, single-instance 한계를 설명한다.
- [ ] 청중 비밀번호와 Publisher credential의 차이·보관 위치·회전 방법을 설명한다.
- [ ] Render outbound bandwidth 계산 예시와 현재 공식 문서 링크 및 대시보드 확인 위치가 있다.
- [ ] 기존 LAN Listener 유지/전환 정책이 076 결정 및 실제 구현과 일치한다.
- [ ] 개발/preview/production에서 CORS 및 WebSocket Origin 설정을 분리한다.
- [ ] 문서의 모든 명령/환경 변수/URL이 실제 설정 이름과 대조 검증된다.

## Tests and verification

- 문서 내 변수 이름을 `.env.example`, Render config, Vercel config와 수동 대조한다.
- 배포 전 checklist를 따라 staging/preview 연결을 확인한다. 실제 credential은 문서·fixture·로그에 남기지 않는다.
