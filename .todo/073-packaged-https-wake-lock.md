# 073 패키지의 HTTPS/Wake Lock 설정과 검증

상태: 진행
우선순위: 보통

## Goal

Windows와 macOS 패키지에서 기존 HTTPS/WSS 설정을 사용할 수 있게 하고, 신뢰 가능한 HTTPS origin으로 접속한 모바일 Listener에서 Screen Wake Lock이 동작하는지 확인한다.

## Depends on

- `.todo/done/070-standalone-packaging-foundation.md`
- `.todo/071-windows-installable-package.md`
- `.todo/072-macos-installable-package.md`

## Scope

- 기존 `APP_SSL_CERTFILE` 및 `APP_SSL_KEYFILE` 설정을 패키지 실행 환경에서도 유지한다.
- 인증서와 키를 OS 사용자별 설정 위치에서 참조할 수 있게 하고, 인증서/키가 함께 설정되어야 한다는 기존 검증을 보존한다.
- README의 TLS 안내를 패키지 설치·실행 흐름과 운영자 설정 위치에 맞게 보완한다.
- 인증서 SAN에 청중 기기에서 접속할 LAN IP 또는 DNS 이름이 포함되어야 하며, 청중 브라우저가 해당 인증서를 신뢰해야 한다는 점을 명시한다.
- HTTPS 페이지에서 WSS Listener 연결과 `window.isSecureContext` 및 Wake Lock 사용 가능 상태를 검증한다.
- 인증서가 없을 때 기존 HTTP 동작을 유지하고, HTTP에서 Wake Lock을 쓸 수 있다고 오인시키지 않는다.

## Out of scope

- 인증서 자동 발급·갱신 및 도메인/DNS 서비스 통합
- 로컬 CA 자동 생성 또는 기기별 신뢰 설치를 대신 수행하는 것
- 인증서 private key를 패키지에 포함하거나 청중 기기로 전달하는 것
- 브라우저/운영체제가 지원하지 않는 환경에서 Wake Lock 동작을 보장하는 것

## Implementation notes

- 이 앱은 현재 `APP_SSL_CERTFILE`과 `APP_SSL_KEYFILE`이 설정된 경우 HTTPS를 제공하고, HTTPS 페이지에서 WebSocket은 WSS를 사용한다.
- 로컬 CA 방식은 운영자 PC가 CA private key를 보관하고 청중 기기에는 공개 루트 인증서만 설치해야 한다. 각 기기의 신뢰 설치 과정은 별도로 남는다.
- 일반적인 LAN IP는 `localhost` 보안 예외가 아니다. 자체 서명 또는 신뢰되지 않는 인증서 경고를 무시하는 절차를 지원 경로로 안내하지 않는다.
- 인증서가 없거나 모바일 브라우저가 신뢰하지 않는 경우에도 기본 HTTP 청취 동작은 유지한다.
- README의 현재 HTTPS 안내와 코드 경로를 검토해 중복·오래된 설명을 정리한다.

## Acceptance criteria

- [ ] Windows/macOS 패키지에서 인증서와 키 경로를 설정해 HTTPS 서버를 시작할 수 있다.
- [x] 인증서/키가 한쪽만 설정된 경우 명시적 오류가 발생하고, 둘 다 없으면 기존 HTTP 동작이 유지된다.
- [x] HTTPS Listener origin의 WebSocket 연결이 WSS를 사용한다.
- [ ] 신뢰된 인증서가 설치된 지원 모바일 브라우저에서 `window.isSecureContext`가 true이고, 지원 시 Screen Wake Lock 요청이 동작한다.
- [x] HTTP 또는 신뢰되지 않은 origin을 Wake Lock 활성 상태로 표시하지 않는다.
- [ ] 인증서 private key가 저장소, 패키지, 로그, 청중 기기 전달 자료에 포함되지 않는다.
- [x] 문서에 인증서 신뢰 요건, LAN IP/DNS 이름 일치, 로컬 CA 공개 인증서와 private key의 구분을 안내한다.

## Tests and verification

### Automated

- backend config unit tests에서 인증서/키 짝 설정과 잘못된 설정을 검증한다.
- HTTPS 설정 시 TLS listener와 WSS 연결에 필요한 기존 설정 전달을 회귀 검증한다.
- frontend unit tests에서 secure context가 아닌 상태가 Wake Lock 활성 상태로 표현되지 않는지 확인한다.
- 유료 API, 실제 인증서 private key, 실제 마이크를 자동 테스트에 사용하지 않는다.

### Manual

- [ ] Windows 패키지에서 신뢰 가능한 인증서로 HTTPS/WSS 접속을 확인한다.
- [ ] macOS 패키지에서 신뢰 가능한 인증서로 HTTPS/WSS 접속을 확인한다.
- [ ] 실제 청중 모바일 기기에서 인증서 신뢰, `window.isSecureContext`, Listener 재생 및 Wake Lock을 확인한다.
- [ ] 인증서가 없거나 LAN 주소와 인증서 이름이 맞지 않는 경우 안내와 HTTP fallback을 확인한다.

## Progress

- 패키지의 user-data `.env`에서 기존 `APP_SSL_CERTFILE`/`APP_SSL_KEYFILE` 설정을 사용하도록 Windows/macOS 설치 안내를 추가했다. backend 설정 검증은 두 값의 짝 설정과 미설정 시 HTTP 동작을 보존한다.
- HTTPS Listener에서 `wss:`를 사용하는 frontend 회귀 테스트와 패키지 실행 시 Uvicorn에 TLS 경로를 전달하는 backend 테스트를 추가했다. insecure context의 Wake Lock 안내는 기존 Listen 테스트로 검증한다.
- 실제 Windows/macOS 패키지, 인증서 신뢰가 설치된 모바일 기기, 키 파일 패키지 검사 및 LAN/Wake Lock 수동 검증은 수행하지 않았다. 이 항목들은 대상 OS와 기기에서 확인한 뒤 완료 처리한다.
