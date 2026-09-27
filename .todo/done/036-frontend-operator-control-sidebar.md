# 036 Operator 제어 사이드바와 상단 작업

상태: 완료
우선순위: 최우선 UX

## Goal

Operator 왼쪽 영역을 페이지 이동 메뉴가 아닌 Broadcast 운영 제어용 사이드바로 바꾼다. Broadcast 화면을 기본 작업 화면으로 유지하고 Settings 진입과 Dark mode 제어는 상단 작업 영역으로 옮긴다.

## Why

현재 Sidebar에는 방송, 설교, 설정 링크만 있어 공간에 비해 반복 운영 가치가 낮다. 운영자는 대부분의 시간을 Broadcast에서 보내므로 세션 제어, 입력 레벨, Listener 수, 연결 상태를 한 곳에 모아야 한다. Settings로 이동하더라도 Broadcast WebSocket 구독이 종료되지 않아야 한다.

## Related files

- `frontend/src/pages/Operator/layout/OperatorLayout.tsx`
- `frontend/src/pages/Operator/layout/OperatorLayout.module.css`
- `frontend/src/pages/Operator/layout/useOperatorLayout.ts`
- `frontend/src/pages/Operator/broadcast/Broadcast.tsx`
- `frontend/src/pages/Operator/broadcast/components/BroadcastHeader.tsx`
- `frontend/src/pages/Operator/broadcast/Broadcast.module.css`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastSession.ts`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastToggle.ts`
- `frontend/src/pages/Operator/OperatorPrefs.tsx`
- `frontend/tests/unit/useOperatorLayout.test.tsx`
- `frontend/tests/unit/operatorNavigation.test.tsx`

## Dependencies

- `.todo/035-frontend-broadcast-termination-state.md`
- `.todo/done/029-backend-broadcast-observability.md`
- `.todo/done/031-frontend-translation-session-controls.md`

## Implementation notes

- 왼쪽 Sidebar의 Broadcast/Sermon/Settings 페이지 링크와 접기/펴기 기능을 제거한다. Settings route는 유지하되 상단 Settings 아이콘으로만 접근하게 한다.
- Broadcast를 `/operator` 기본 route로 사용한다. 기존 `/operator/broadcast` direct route는 유지하거나 호환 redirect를 둔다.
- 현재 BroadcastHeader에 있는 power control, 서버/Operator/interpreter/session 상태, timer, latency 및 warning/extension action을 제어 사이드바로 옮긴다.
- Input level meter와 Listener count도 사이드바에 둔다. 이 값은 운영 중 반복 확인이 필요한 정보다.
- Broadcast의 “Audio signal / Silent” 표시는 Input level의 동일한 dBFS 값에서 파생되므로 중복 상태로 표시하지 않는다. 대신 `audio_ready`, `audio_error` 기반 장치 연결/오류 상태는 signal level과 별도로 표시한다.
- `useBroadcastSession`과 세션 toggle 상태를 OperatorLayout 또는 이에 준하는 지속되는 상위 owner로 이동한다. Broadcast에서 Settings로 route 이동해도 WebSocket, 상태 refresh, timer 및 action handler가 살아 있어야 한다.
- main content에는 원문/번역 transcript pane을 남긴다. 운영 control을 transcript pane 안에 중복해서 두지 않는다.
- 상단 공통 action에는 Settings icon button과 Dark mode toggle을 나란히 배치한다. Settings는 `/operator/settings`로 이동하고, theme은 `OperatorPrefsProvider`의 즉시 적용과 localStorage 저장을 사용한다.
- 아이콘 버튼에는 접근 가능한 label과 tooltip/title을 제공하고, 좁은 viewport에서도 control이 가려지거나 가로 overflow가 생기지 않게 한다.
- 로그인 gate는 별도 인증 티켓에서 담당한다. 이 layout은 인증 성공 후 Operator shell을 렌더링하는 구조로 연결 가능해야 한다.

## Acceptance criteria

- 왼쪽 영역에 다른 페이지로 이동하는 nav link가 없다.
- Broadcast 제어 sidebar에서 Start/Stop, translation 상태, 필요한 audio/server 상태, timer action을 사용할 수 있다.
- Input level과 Listener count가 sidebar에 표시된다.
- 중복 Audio signal/Silent 상태 텍스트는 제거되고 device ready/error는 구분된다.
- Broadcast -> Settings -> Back to Broadcast 이동 중 live 상태, WebSocket 연결 및 session timer가 초기화되지 않는다.
- Settings 아이콘과 theme toggle은 Operator 상단에 있고, theme 변경은 Settings 저장 없이 즉시 화면에 반영된다.
- Broadcast transcript는 남고 기존 transcript download 기능도 동작한다.
- Sermon Session 메뉴는 보이지 않는다.

## Tests

- Layout/hook 테스트는 nav 링크 부재, 기본 route, 상단 action, theme toggle과 Settings 왕복 중 session owner 유지의 동작을 검증한다.
- `operatorNavigation.test.tsx`를 새 route 구조로 갱신한다.
- `liveFlow.test.tsx`에서 toolbar가 layout owner로 올라간 뒤에도 Listen/Operator 상태가 동기화되는 핵심 경로를 검증한다.
- 테스트는 역할/행동을 확인하고 className, 픽셀 레이아웃, snapshot에는 의존하지 않는다.

## Risks

- `useBroadcastSession`을 route component 밖으로 올릴 때 ToastProvider와 `useOperatorPrefs`의 provider 순서를 유지해야 한다.
- Timer warning dialog가 layout에 올라가면서 Broadcast 전용 CSS/module import에 묶이지 않도록 component 책임을 정리해야 한다.
- 작은 화면에서 모든 상태를 사이드바에 넣으면 과밀할 수 있다. 핵심 control과 세부 상태의 우선순위를 유지하고 반응형 표시를 확인한다.
