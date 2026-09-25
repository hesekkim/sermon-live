# 031 Broadcast Translation 제어

상태: 완료

## Goal

Broadcast에서 Translation Session을 시작/중지하고, Timer 및 종료 상태를 Operator가 제어할 수 있도록 한다.

## Why

Operator는 서버가 살아 있는지보다 현재 통역이 실행 중인지, 언제 종료되는지, 오디오와 번역이 정상인지 즉시 알아야 한다.

## Dependencies

025, 027, 028, 029

## Scope

- Server ONLINE과 Translation LIVE/OFF를 별도 표시
- Start/Stop, 남은 시간, 경과 시간 표시
- Warning modal의 연장/지금 종료 조작
- Hard Limit에서 연장 버튼 비활성화
- 자동 종료와 오류 종료 reason 표시
- Korean source/German translation dual-column 유지
- audio signal, input level, latency, listener count 표시

## Acceptance criteria

- Start/Stop은 Translation Session만 제어한다.
- Timer warning이 backend 이벤트에 따라 표시된다.
- 연장과 즉시 종료가 backend에 반영된다.
- 종료 후 마지막 transcript와 종료 reason이 보인다.
- mock WebSocket 기반 frontend unit test가 핵심 상태 전이를 검증한다.

## Tests

- LIVE/OFF와 timer 표시
- warning/extension/stop 흐름
- 종료 reason과 error 상태 표시
