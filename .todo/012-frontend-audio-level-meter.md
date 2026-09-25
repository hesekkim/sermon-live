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
- hook은 `audioLevel: number | null`을 반환한다.
- 초기 상태, 세션 중지(`running: false`), WebSocket 종료 시 `audioLevel`을 `null`로 초기화한다.
- `audio_level.level`은 finite number인 경우에만 반영한다.
- 미터 입력 범위는 backend 계약에 맞춰 `-60 dBFS ~ 0 dBFS`로 고정하고, 범위를 벗어난 값은 clamp한다.
- 미터는 기존 shared 컴포넌트 스타일(css module) 컨벤션을 따른다.
- 미터는 `role="meter"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` 등 접근성 상태를 제공한다.
- 현재 frontend build를 막고 있는 `Broadcast.tsx`의 `variant="text"` 오류는 012 작업 중 함께 수정하거나 선행 작업으로 처리한다.

## Acceptance criteria

- 세션 실행 중 레벨 미터가 실시간으로 갱신된다.
- 세션 미실행 시 미터가 빈 상태로 표시된다.
- 세션 실행 중 무음 입력은 빈 상태가 아니라 최소 레벨로 표시된다.
- 유효하지 않거나 범위를 벗어난 WebSocket level 값은 UI를 오염시키지 않는다.

## Tests

- mock WebSocket 메시지로 레벨 state 업데이트 검증 (기존 useBroadcastSession.test.tsx 패턴).
- `audio_level` 메시지 수신 시 state 갱신
- 잘못된 level 값 무시
- `running: false` 수신 시 `null`로 초기화
- WebSocket 종료 시 `null`로 초기화

## Risks

- 낮음. 디자인/스타일 세부사항은 테스트 대상 아님 (testing-strategy).
