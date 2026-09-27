# 035 Broadcast 종료 상태와 사유 표시

상태: 완료
우선순위: 최우선 UX

## Goal

Auto Stop을 포함한 모든 세션 종료 후 Operator가 방송이 꺼졌음을 즉시 정확하게 알 수 있도록 한다. 버튼 상태와 실제 세션 상태를 일치시키고, 내부 reason code 대신 사용자용 종료 사유를 표시한다.

## Why

현재 버튼은 `running`을 기준으로 아이콘과 접근성 상태를 만들고, `session_status`와 `session_ended`는 별도로 처리한다. 서버 종료 이벤트가 도착하는 순서나 일부 필드 누락에 따라 화면 상태가 엇갈릴 수 있다. 특히 Auto Stop 뒤에도 버튼이 ON처럼 남는 현장 보고가 있다. 또한 `lastTerminationReason`에 `auto_stop` 같은 내부 문자열을 그대로 보여주면 사용자에게 의미가 전달되지 않는다.

## Related files

- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastSession.ts`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastToggle.ts`
- `frontend/src/pages/Operator/broadcast/components/BroadcastHeader.tsx`
- `frontend/src/pages/Operator/translations.ts`
- `frontend/tests/unit/useBroadcastSession.test.tsx`
- `frontend/tests/unit/useBroadcastToggle.test.tsx`
- `frontend/tests/unit/liveFlow.test.tsx`
- 관련 backend 이벤트 계약: `backend/services/session_service.py`

## Dependencies

- `.todo/done/027-backend-translation-session-lifecycle.md`
- `.todo/done/028-backend-translation-safety-timer.md`
- `.todo/done/029-backend-broadcast-observability.md`
- `.todo/done/031-frontend-translation-session-controls.md`

## Implementation notes

- `session_status`와 `running`의 기존 API 계약을 확인하고, UI에서 하나의 정규화된 session state를 기준으로 제어 버튼, 아이콘, `aria-pressed`, 라벨, toggle 방향을 계산한다.
- `session_ended`는 단지 종료 사유만 기록하지 말고 terminal state도 확정한다. `auto_stop`, `hard_limit`, `manual`, `server_shutdown`은 OFF로, `interpreter_error`, `device_error`는 오류 상태로 정규화한다.
- 이미 처리한 종료 이벤트가 뒤늦게 도착해 새 세션 상태를 덮지 않도록 이벤트 처리 순서를 검토한다. 가능하면 backend status 이벤트를 먼저 신뢰하고 종료 이벤트의 필드는 방어적으로 병합한다.
- 종료 reason은 명시적인 타입/매핑으로 한국어, 영어, 독일어 문구를 제공한다. raw reason 문자열은 화면이나 접근성 라벨에 출력하지 않는다.
- Auto Stop은 정상 종료라는 점이 드러나야 하며 일반 오류 문구로 취급하지 않는다.
- 기존 start/stop pending guard, API 응답 후 상태 갱신, WebSocket 재연결 처리를 유지한다.

## Acceptance criteria

- Auto Stop 종료 직후 전원 버튼은 OFF 아이콘과 OFF 라벨을 표시하고, `aria-pressed`도 false다.
- 같은 화면에서 버튼을 누르면 새 방송 시작 동작을 수행한다.
- 수동 종료, Auto Stop, Hard Limit, 서버 종료, 장치 오류, interpreter 오류가 올바른 정상/오류 상태로 표시된다.
- 화면 어디에도 `auto_stop`, `hard_limit`, `device_error` 같은 raw identifier가 노출되지 않는다.
- WebSocket 종료 이벤트와 REST status 응답이 순서가 달라도 최종 UI가 일관된다.

## Tests

- Hook unit test: 각 `session_status`, `session_ended.reason` 조합 후 상태와 reason label을 검증한다.
- Toggle unit test: 종료 후 다음 클릭이 `start`를 호출하고, 실행 중 클릭은 `stop`을 호출하는지 검증한다.
- `liveFlow.test.tsx`: `live -> auto_stop -> off`와 오류 종료 경로를 end-to-end 스타일의 mock WebSocket 흐름으로 검증한다.
- 한국어/영어/독일어 종료 사유 mapping 테스트는 테이블 기반으로 핵심 reason만 확인한다.

## Risks

- WebSocket과 REST polling이 서로 다른 시점의 상태를 전달할 수 있으므로 하나의 이벤트 처리만 바꾸면 race가 남을 수 있다.
- UI 종료 상태를 고쳐도 backend가 `session_ended`를 누락하거나 잘못 분류하는 문제는 별도 확인해야 한다.
- 레이아웃과 스타일 snapshot 테스트는 추가하지 않는다.
