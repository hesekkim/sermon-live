# 011 오디오 입력 레벨 브로드캐스트

상태: 대기

## Goal

입력 오디오의 RMS/dBFS 레벨을 청크 단위로 계산해 operator WebSocket에 `{type: "audio_level", level: number}`로 브로드캐스트한다.

## Why

AI 문제와 오디오 하드웨어/입력 문제를 구분하려면 Operator가 실시간 입력 레벨을 볼 수 있어야 한다.

## Related files

- `backend/services/audio_processor.py` 또는 `backend/services/session_service.py`
- `backend/services/broadcast.py`

## Dependencies

005, 006

## Implementation notes

- 레벨 계산은 AudioProcessor 또는 파이프라인 어느 한 지점에서 일관되게 수행 (중복 계산 금지).
- 브로드캐스트 빈도는 매 청크마다 보낼 필요 없이 throttle(예: 100~200ms 간격)하여 WS 트래픽 과다를 방지.
- 기존 `broadcast_operator()` 메커니즘 재사용.

## Acceptance criteria

- 세션 실행 중 operator WS로 주기적인 레벨 값이 전달된다.
- 무음 입력 시 낮은 값, 신호 입력 시 값이 올라간다.

## Tests

- 합성 PCM(무음/신호)로 레벨 계산 함수 단위 테스트.

## Risks

- 과도한 브로드캐스트 빈도로 인한 트래픽 증가 — throttle로 완화.
