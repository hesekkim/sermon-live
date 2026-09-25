# 027 Translation Session lifecycle

상태: 완료

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
- Operator 헤더 전원 버튼은 Server가 아니라 Translation Session만 시작/중지함. Translation이 OFF여도 Server와 Listener 연결은 유지함
- Translation 시작은 Server ONLINE, 사용 가능한 입력 장치(선택된 장치 또는 기본 장치), 선택된 interpreter 준비 상태를 전제로 함. OpenAI interpreter 선택 시 API key 설정 및 유효성 검증이 필요함
- 시작 전제 조건을 backend에서 검증하고, 미충족 시 구체적인 오류를 반환함. Operator UI는 시작이 불가능한 사유를 표시하고 `starting`/`stopping` 중 중복 입력을 막음
- Operator와 Listener에 동일한 session status/error/ended 이벤트 전달
- 현재 Sermon Session id를 선택적으로 연결
- AudioCapture/AudioProcessor는 Translation Session lifecycle과 분리
- Translation stop 시 pending output을 가능한 범위에서 drain한 후 session close

## Acceptance criteria

- Server가 ONLINE인 상태에서 Translation Session을 start/stop할 수 있다.
- 사용 가능한 입력 장치와 선택된 interpreter가 준비된 경우에만 Translation Session 시작이 가능하다. OpenAI interpreter 사용 시 유효한 API key가 필요하다.
- 시작 전제 조건이 충족되지 않으면 시작이 거부되고 Operator에 구체적인 오류가 표시된다.
- Translation이 OFF여도 Listener 연결과 서버 상태는 유지된다.
- 모든 종료 이벤트에 `reason`이 포함된다.
- 실패한 시작은 명확한 오류 상태와 사용자 메시지를 남긴다.
- 상태 전이 규칙이 backend unit test로 고정된다.

## Tests

- 상태 전이와 중복 start/stop
- 입력 장치 또는 interpreter 준비 조건 미충족 시 시작 거부 및 오류 전달
- 수동 종료, auto stop, hard limit, interpreter/device 오류 reason
- Operator/Listener event payload

## Risks

- 기존 SessionService가 서버 실행과 번역 실행을 함께 소유하고 있을 수 있어 책임 분리가 필요하다.
