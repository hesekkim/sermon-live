# 085 방송 시작 전 Operator Listener QR 공유

상태: 완료 (코드 구현·자동 검증 완료)
우선순위: 높음

## Goal

Operator가 방송을 시작하기 전에 Listener 링크와 QR을 준비해 화면에 표시할 수 있게 한다. 보통 Operator 실행 중 한 번 방송하므로, 매 Translation Session 시작 때까지 QR을 기다리지 않아도 되게 한다.

## Scope

- Operator backend 프로세스 시작 시 Listener용 random `session_id`를 할당한다.
- relay와 Listener URL이 설정된 경우 Operator의 QR 공유 요청에서 해당 ID를 relay에 미리 등록한다. Publisher 연결 전에도 QR을 반환한다.
- 방송 시작은 Operator 프로세스에서 준비한 동일 ID를 사용한다. 재방송 시 relay session generation은 갱신하되 공유 링크는 유지한다.
- Relay는 방송이 실제로 live가 되기 전까지 Listener token 발급과 입장을 거부한다.
- 방송 전 미리 등록만 된 relay session은 Operator 종료 시 정리한다.
- relay 사전 등록 실패는 QR을 성공한 것처럼 반환하지 않고 명시적 오류로 처리한다.

## Out of scope

- 방송 시작 전 Listener 입장을 허용하는 것
- Listener token 갱신·재연결 정책 변경 (`084` 범위)
- session link bearer 권한 또는 relay protocol 변경

## Acceptance criteria

- [x] 방송이 꺼진 상태에서 QR 공유 API가 session ID가 포함된 Listener URL을 반환한다.
- [x] QR 요청은 relay에 session을 미리 등록하고, 방송 시작은 같은 ID를 사용한다.
- [x] 한 Operator 프로세스 안에서 반복 방송해도 공유 session ID는 유지된다.
- [x] 방송 시작 전 Listener token 발급은 계속 거부된다.
- [x] 준비된 relay session은 Operator 서버 종료 시 정리되고, relay 오류는 503으로 표시된다.
- [x] Operator QR UI와 backend session/relay 동작의 자동 검증이 통과한다.

## Tests and verification

- Backend: `test_operator_api.py`, `test_session_events.py`, `test_session_lifecycle.py`, `test_relay_publisher.py` — 65개 통과.
- Operator frontend: `operatorNavigation.test.tsx` — 17개 통과.
- Operator session ID 발급 시점 및 재사용, 방송 전 QR 생성, relay 사전 등록/종료 정리를 검증했다.
