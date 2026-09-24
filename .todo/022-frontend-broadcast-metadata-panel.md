# 022 Broadcast 메타데이터 패널

상태: 대기

## Goal

Broadcast 화면에 번역 세션 상태, 오디오 상태/레벨, source/target 언어, latency, OpenAI 연결 상태를 보여주는 패널을 추가한다. 기존 dual-column(한국어/독일어) 레이아웃은 유지한다.

## Why

Operator가 한 화면에서 전체 파이프라인 상태를 파악할 수 있어야 한다 (Archthecture.md 30번).

## Related files

- `frontend/src/pages/Operator/broadcast/Broadcast.tsx`
- `frontend/src/pages/Operator/broadcast/useBroadcastSession.ts`

## Dependencies

007, 012, 017

## Implementation notes

- 기존 dual-column 구조를 유지하고 상단/사이드에 상태 패널만 추가.
- latency 측정은 우선 단순한 지표(예: 오디오 청크 전송~자막 수신 타임스탬프 차이)로 시작.

## Acceptance criteria

- 세션 실행 중 상태 패널이 실시간으로 갱신된다.
- 기존 transcript 다운로드 등 기능이 회귀 없이 동작.

## Tests

- mock WebSocket 메시지로 상태 패널 갱신 검증 (디자인/레이아웃 자체는 테스트 대상 아님).

## Risks

- 낮음.
