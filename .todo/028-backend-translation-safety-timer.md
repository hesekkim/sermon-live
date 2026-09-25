# 028 Translation Safety Timer

상태: 대기

## Goal

Translation Session의 자동 종료, 사전 경고, 연장, 강제 상한을 backend에서 관리한다.

## Why

실수로 OpenAI audio session을 계속 실행해 비용이 무한정 증가하는 것을 막는 안전장치다.

## Dependencies

027

## Scope

- 기본값: Auto Stop 90분, Warning 5분 전, Extension 10분, Hard Limit 120분
- 사용자가 설정한 값을 저장하고 범위를 검증
- Warning 시점에 Operator에 경고 이벤트 전송
- 응답이 없으면 Auto Stop에서 자동 종료
- Extension 요청은 Hard Limit을 넘지 않도록 clamp
- Hard Limit 도달 시 강제 종료
- 자동 종료 reason을 `auto_stop` 또는 `hard_limit`로 기록

## Acceptance criteria

- 90분 세션은 5분 전에 warning을 보내고 응답이 없으면 자동 종료된다.
- 10분 연장은 90→100→110→120분까지만 가능하다.
- Hard Limit 이후에는 연장할 수 없다.
- 타이머 상태와 종료 reason이 Operator/Listener에 전달된다.
- 타이머 계산은 wall-clock에 의존하지 않도록 unit test로 검증한다.

## Tests

- 기본값과 설정값 검증
- warning, auto stop, extension, hard limit 경계값
- 중복 extension과 종료 후 조작 거부

## Risks

- frontend countdown만 믿으면 브라우저 종료 시 안전장치가 사라지므로 종료 판단은 backend가 소유한다.
