# 012 오디오 레벨 미터 UI

상태: 대기

## Goal

Broadcast 화면에 입력 레벨을 보여주는 미터 바 컴포넌트를 추가한다.

## Why

011에서 전달되는 레벨 데이터를 Operator가 눈으로 확인할 수 있어야 한다.

## Related files

- `frontend/src/pages/Operator/broadcast/Broadcast.tsx`
- `frontend/src/pages/Operator/broadcast/useBroadcastSession.ts`
- `frontend/tests/unit/useBroadcastSession.test.tsx`
- 신규 AudioLevelMeter 컴포넌트 (`frontend/src/shared/components/` 하위)

## Dependencies

011

## Implementation notes

- `useBroadcastSession`에 `audio_level` 메시지 타입 처리 추가, 최신 레벨 값을 state로 노출.
- 미터는 기존 shared 컴포넌트 스타일(css module) 컨벤션을 따른다.

## Acceptance criteria

- 세션 실행 중 레벨 미터가 실시간으로 갱신된다.
- 세션 미실행 시 미터가 빈 상태로 표시된다.

## Tests

- mock WebSocket 메시지로 레벨 state 업데이트 검증 (기존 useBroadcastSession.test.tsx 패턴).

## Risks

- 낮음. 디자인/스타일 세부사항은 테스트 대상 아님 (testing-strategy).
