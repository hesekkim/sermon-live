# 050 운영자 WebSocket 지연 격리와 재연결 상태 처리

상태: 완료
우선순위: 높음

## Goal

운영자 WebSocket의 일시적인 단절이나 느린 전송이 마이크 캡처와 통역 오디오 처리에 영향을 주지 않게 한다. 운영자 연결 복구 상태를 세션 오류와 구분해 표시하고, 실제 방송 상태를 오해하지 않도록 한다.

## 발견 배경

- 기존에는 `AudioLevelMeter`가 `audioLevel === null`을 idle 줄무늬로 표시하고, `useBroadcastSession`이 운영자 WebSocket 오류/종료 때 레벨을 즉시 `null`로 바꿨다. 그 결과 미터 변화만으로 오디오 장치 단절과 운영자 소켓 단절을 구분하기 어려웠다.
- 서버는 오디오 레벨을 약 100ms 간격으로 운영자 WebSocket에 전송한다.
- `AudioRuntime._pump_capture()`는 레벨을 계산하고 `broadcast_operator()` 전송을 기다린 뒤 번역 큐에 오디오를 넣는다. `BroadcastHub.broadcast_operator()`는 각 운영자 소켓의 `send_json()`을 순차적으로 기다리며 명시적인 전송 deadline이 없다.
- `AudioCapture`의 원시 캡처 큐는 무제한이다. 운영자 소켓 전송이 연결은 유지한 채 backpressure로 지연되면 캡처 소비가 멈춰 원시 큐가 쌓일 수 있다. 처리가 재개되어도 번역 큐는 2초 한도로 오래된 청크를 버리므로 통역 오디오 손실과 overflow 경고로 이어질 수 있다.
- 단순히 소켓이 닫힌 경우 전송 실패가 빠르게 반환될 수 있으므로, 미터가 깜빡인 사실만으로 위 backpressure 문제가 실제 발생했다고 단정하지 않는다.
- 현재 재연결 오류는 일반 `sessionError` 토스트로도 보고된다. 번역 세션 자체가 살아 있어도 사용자에게 방송 오류처럼 보일 수 있다.

## 구현 결과

- 오디오 캡처 루프에서 level WebSocket 전송을 분리하고, 크기 1의 latest-value queue와 별도 task로 전송한다. 느린 연결 중에도 캡처 청크는 translation queue로 들어가며 오래된 level 값은 최신 값으로 대체된다.
- `BroadcastHub.broadcast_operator()`를 client별 동시 전송으로 바꾸고, 1초 send timeout을 적용한다. timeout된 연결에는 제한된 close frame을 보낸 뒤 해당 client만 정리한다.
- Operator WebSocket의 일시 오류는 `reconnecting` 상태로만 표시하고 일반 세션 오류 callback/toast에 전달하지 않는다. 실제 interpreter/session 오류 경로는 유지한다.
- 재연결 뒤 `translation_status` snapshot으로 live 상태, listener count, timer가 복구되는 동작을 테스트한다.
- 운영자 소켓 단절 시 마지막 입력 레벨을 최대 3초간 흐리게 유지하고 stale 안내를 표시한다. 새 샘플 수신 시 stale 상태를 해제하며, 세션 종료나 입력 장치 오류 시에는 즉시 레벨을 비운다. Broadcast와 Settings의 미터가 같은 상태를 사용한다.

## Acceptance criteria

- 느리거나 응답하지 않는 운영자 WebSocket을 주입해도 캡처 펌프가 다음 입력 청크를 처리하고 번역 큐로 전달한다.
- 운영자 미터 이벤트가 지연될 때 메모리 증가나 오래된 레벨 이벤트 backlog가 발생하지 않는다.
- 운영자 소켓 전송 실패/timeout은 해당 클라이언트만 정리하며 세션 종료, 오디오 장치 오류, interpreter 오류로 바뀌지 않는다.
- 재연결 중에는 운영자 연결 상태가 `reconnecting`으로 표시되고, 세션이 실제 live라면 `live` 상태와 start/stop 동작은 유지된다.
- 일시적인 운영자 WebSocket 오류가 일반 방송 오류 토스트나 시작 실패 신호로 잘못 처리되지 않는다.
- 정상 연결과 오디오 레벨 전송의 기존 throttle 및 payload 계약은 유지한다.
- 운영자 소켓 재연결 중 마지막 레벨은 stale 상태로 최대 3초간 표시하고, 새 샘플 수신 또는 세션/장치 중단 시 각각 복구 또는 즉시 초기화한다.

## 검증

- `backend/tests/unit/test_audio_runtime.py`: 지연 fake hub 중에도 capture와 translation queue가 진행되고 pending level 값이 최신 값 하나로 제한됨을 확인한다.
- `backend/tests/unit/test_session_lifecycle.py`: timeout된 operator socket의 close/제거와 healthy client 동시 전달을 확인한다.
- `frontend/tests/unit/useBroadcastSession.test.tsx`: transient socket error가 session error callback을 호출하지 않고, 재연결 snapshot에서 상태가 복구됨을 확인한다.
- backend unit: 122 passed
- frontend unit: 91 passed
- frontend production build: 통과 (`tsc -b && vite build`)
- 변경 파일 diagnostics: 오류 없음
- 실제 마이크 장치와 실제 네트워크 장애를 이용한 수동 확인은 수행하지 않았다.

## Out of scope

- WebSocket 단절 중 전달되지 않은 input/output transcript를 영속화하거나 재전송하는 기능. 현재 transcript는 운영자 화면의 메모리 상태이며 재연결 snapshot에 포함되지 않는다. transcript 유실 방지가 요구되면 별도 ticket으로 범위를 정의한다.
- 실제 오디오 장치 오류나 interpreter 연결 실패 자체의 복구 정책 변경.

## Related files

- `backend/services/audio_runtime.py`
- `backend/services/audio_capture.py`
- `backend/services/broadcast.py`
- `backend/api/v1/endpoints/operator.py`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastSession.ts`
- `frontend/src/pages/Operator/broadcast/components/BroadcastHeader.tsx`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastToggle.ts`
- `frontend/src/pages/Operator/settings/components/AudioTestPanel.tsx`
- `frontend/src/shared/components/AudioLevelMeter/AudioLevelMeter.tsx`
- `frontend/src/pages/Operator/translations.ts`
- `frontend/tests/unit/useBroadcastSession.test.tsx`
- `frontend/tests/unit/AudioLevelMeter.test.tsx`
- `frontend/tests/unit/useAudioTest.test.tsx`

## 잔여 위험

- 대상 환경의 실제 Wi-Fi에서 send timeout 1초가 적절한지는 운영 중 관측이 필요하다.
- transcript replay는 포함하지 않았으므로 운영자 연결이 끊긴 동안 화면 자막 이벤트가 누락될 수 있다.