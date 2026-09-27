# 041 Backend 오디오 큐 포화 정책과 관측성

상태: 대기
우선순위: 높음

## Goal

번역 전송이 입력 캡처보다 느려져 queue가 찼을 때 오래된 청크를 버리는 현재 정책을 명시적으로 계측하고 Operator에 알린다. 정상 종료 시 flush/drain이 무한히 대기하지 않게 한다.

## Why

현재 translation queue는 32개 항목으로 제한하고, full이면 기존 가장 오래된 청크를 제거한 뒤 최신 청크를 넣는다. 이 동작은 지연을 제한하지만 transcript/audio의 일부가 사라져도 Operator가 알 수 없다. 항목 개수는 입력 format/chunk duration에 따라 실제 대기 시간 의미가 달라진다.

## Related files

- `backend/services/audio_runtime.py`
- `backend/services/session_service.py`
- `backend/services/broadcast.py`
- `backend/services/interpreters/protocol.py`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastSession.ts`
- `frontend/src/pages/Operator/layout/OperatorLayout.tsx` 또는 sidebar component
- `frontend/src/pages/Operator/translations.ts`
- `backend/tests/unit/test_audio_runtime.py`
- `backend/tests/unit/test_session_lifecycle.py`
- `frontend/tests/unit/useBroadcastSession.test.tsx`
- 관련 흐름: `frontend/tests/unit/liveFlow.test.tsx`

## Dependencies

- `.todo/036-frontend-operator-control-sidebar.md`
- `.todo/040-backend-audio-format-negotiation.md`
- `.todo/done/029-backend-broadcast-observability.md`

## Implementation notes

- 사용자 정책: queue overflow에서도 session은 즉시 오류로 중단하지 않는다. 최신 청크를 유지하기 위해 가장 오래된 청크를 폐기한다.
- queue size를 단순 item count로 정하지 않는다. 표준 target tuple과 청크 byte length/sample count로 queued audio duration을 측정하고, 설정된 최대 대기시간을 넘을 때 drop한다.
- 필요한 경우 interpreter 전송 chunk를 일정한 짧은 duration으로 재분할해 입력 장치 chunk/frame 설정에 따라 최대 latency가 달라지지 않게 한다. 불필요한 대규모 buffering/framework는 도입하지 않는다.
- 누적 dropped duration/chunk count를 session 단위로 추적하고 session start에서 초기화한다. 상태 API 및 공통 operator event에 vendor-neutral field로 노출한다.
- drop 발생 시 모든 chunk마다 toast를 띄우지 않는다. 누적 count를 지속 표시하고, 일정 주기 또는 첫 overflow에서만 rate-limited warning을 내보낸다.
- 세션 종료 시 processor `flush()` 결과를 남은 정상 queue 뒤에 보낸다. queue가 찬 상태에서 producer/consumer가 교착하지 않게 종료 순서를 설계한다.
- 정상 stop에서 queued audio를 얼마나 기다릴지 최대 drain deadline을 둔다. deadline 초과 시 남은 chunk 수/duration을 종료 결과에 반영하고 stop은 완료한다.
- device/interpreter error에 의한 stop과 사용자 manual stop에서 pending audio 정책이 다를 수 있으므로 목적을 명시한다. 이미 고의로 discard하는 오류/abort 경로를 accidental data loss로 바꾸지 않는다.
- Audio level queue/test subscriber 정책과 translation queue 정책을 혼동하지 않는다.

## Acceptance criteria

- 빠른 consumer에서는 기존처럼 chunk가 손실 없이 순서대로 전달되고 drop count는 0이다.
- 느린 consumer/인위적 queue 포화에서는 가장 오래된 오디오가 drop되고 최신 오디오는 전달된다.
- Operator는 drop 경고와 session 누적 drop 수 또는 손실 duration을 확인할 수 있다.
- 경고가 지나치게 자주 반복되지 않는다.
- 고정 item count가 아니라 실제 오디오 duration 한도가 제어 기준이다.
- stop/auto-stop 시 flush와 queue drain이 정해진 deadline 안에 종료된다.
- 종료 deadline 뒤 폐기된 마지막 chunk 수는 operator에게 숨겨지지 않는다.

## Tests

- Backend unit test에서 빠른/느린 fake interpreter로 order, drop count, duration cap, warning event를 검증한다.
- Normal stop, auto-stop, cancellation, interpreter error에서 종료 대기와 discard 차이를 검증한다.
- Frontend hook은 drop event를 누적하고 sidebar에 경고 상태를 표현한다.
- 실제 OpenAI endpoint/실제 네트워크 속도는 unit test에서 호출하지 않는다.

## Risks

- 큐 제한을 너무 낮추면 일시적인 네트워크 흔들림에도 음성 손실이 잦아진다. 설정값/기본값은 수동 latency 검증 후 선택한다.
- `asyncio.Queue` consumer send가 멈춘 경우 단순 `wait_for(queue.put)`만 적용하면 종료 중 task race가 생길 수 있으므로 lifecycle lock/reader task와 함께 설계한다.
- 오디오 청크를 자르는 경계가 PCM frame을 나누지 않도록 bytes 대신 sample/frame 단위로 계산한다.
