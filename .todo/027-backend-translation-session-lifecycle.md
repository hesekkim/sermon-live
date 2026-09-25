# 027 Translation Session lifecycle

상태: 대기

## Goal

Server와 AudioCapture가 실행 중인 상태에서 Translation Session만 시작하고 중지할 수 있는 lifecycle을 추가한다.

## Why

찬양과 광고 중에는 통역 세션을 종료해 API 비용을 줄이고, 설교 중에만 통역을 실행해야 한다. FastAPI Server ON/OFF와 Translation LIVE/OFF는 서로 다른 개념이다.

## Dependencies

008, 015

## Scope

- 상태: `off | starting | live | stopping | error`
- start/stop 중복 요청과 잘못된 상태 전이를 거부
- 수동 종료, 자동 종료, 오류 종료의 reason을 기록
- AudioCapture와 BroadcastHub는 Server lifecycle에 속하고 Translation Session 종료로 함께 종료하지 않음
- Operator와 Listener에 동일한 session status/error/ended 이벤트 전달
- 현재 Sermon Session id를 선택적으로 연결

## Acceptance criteria

- Server가 ONLINE인 상태에서 Translation Session을 start/stop할 수 있다.
- Translation이 OFF여도 Listener 연결과 서버 상태는 유지된다.
- 모든 종료 이벤트에 `reason`이 포함된다.
- 실패한 시작은 명확한 오류 상태와 사용자 메시지를 남긴다.
- 상태 전이 규칙이 backend unit test로 고정된다.

## Tests

- 상태 전이와 중복 start/stop
- 수동 종료, auto stop, hard limit, interpreter/device 오류 reason
- Operator/Listener event payload

## Risks

- 기존 SessionService가 서버 실행과 번역 실행을 함께 소유하고 있을 수 있어 책임 분리가 필요하다.
