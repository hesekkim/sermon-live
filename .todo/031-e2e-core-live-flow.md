# 031 핵심 live broadcast 흐름 검증

상태: 대기

## Goal

개인 예배에서 가장 중요한 Operator와 Listener의 짧은 live 흐름을 검증한다.

## Why

개별 adapter와 UI 테스트만으로는 실제 운영 상태가 서로 일치하는지 보장할 수 없다.

## Dependencies

008, 013, 014, 024, 025, 026, 028, 030

## Scope

- Server ONLINE 상태 확인
- Translation OFF에서 Listener 접속
- Translation LIVE 시작
- mock audio 입력과 source/translation 이벤트
- Operator metadata와 Listener subtitle/audio 상태
- warning, extension, auto stop 또는 hard limit
- 종료 reason과 Listener의 방송 종료 상태
- device unavailable, interpreter error, reconnect 상태의 핵심 오류 경로

## Acceptance criteria

- 유료 OpenAI 실호출 없이 mock backend와 mock WebSocket으로 자동화한다.
- 핵심 사용자 경로가 Playwright 또는 프로젝트의 e2e 방식으로 검증된다.
- backend unit과 frontend unit에서 이미 검증한 세부 규칙을 중복하지 않는다.
- 실패 시 Operator와 Listener가 서로 다른 상태를 보이지 않는다.

## Tests

- 짧은 happy path
- timer 종료 path
- 연결 오류와 복구 path

## Risks

- 실제 마이크와 외부 OpenAI는 자동화 대상이 아니다. 실제 장비 확인은 수동 체크리스트로 별도 기록한다.
