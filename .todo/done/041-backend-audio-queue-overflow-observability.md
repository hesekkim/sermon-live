# 041 Backend 오디오 큐 포화 정책과 관측성

상태: 완료
우선순위: 높음

## Goal

번역 전송이 입력 캡처보다 느려져 queue가 찼을 때 오래된 청크를 버리는 현재 정책을 명시적으로 계측하고 Operator에 알린다. 정상 종료 시 flush/drain이 무한히 대기하지 않게 한다.

## 구현 결과

- 번역 큐 한도를 item 수 대신 interpreter target format 기준 오디오 duration으로 관리한다. 오디오는 PCM frame 경계에 맞춰 최대 100ms 청크로 분할하고, 한도를 넘으면 가장 오래된 청크부터 폐기한다.
- 기본 큐 대기 한도와 정상 종료 drain deadline은 각각 2초이며 `APP_TRANSLATION_QUEUE_MAX_SECONDS`, `APP_TRANSLATION_DRAIN_TIMEOUT_SECONDS`로 설정한다.
- 세션별 dropped chunk 수와 duration을 누적하고, 최초 overflow 및 10초 rate limit으로 공통 `audio_queue_overflow` 이벤트를 전송한다. status와 `session_ended`에도 누적값을 포함해 Operator 상태 화면에서 경고와 손실량을 유지한다.
- 정상 stop과 auto-stop은 flush 결과를 queue 뒤에 넣고 제한 시간 동안 drain한다. 기한이 지나면 in-flight 및 대기 청크를 손실량에 반영한 뒤 종료한다. interpreter/device error와 start cancellation은 기존 의도대로 pending 오디오를 폐기한다.

## 검증

- `backend/tests/unit/test_audio_runtime.py`, `test_session_lifecycle.py`, `test_config.py`: 36 passed
- `frontend/tests/unit/useBroadcastSession.test.tsx`: 15 passed
- `frontend` production build: 통과 (TypeScript 및 Vite)
- `git diff --check`: 통과
- 리뷰 결과: 확인 범위에서 차단성 결함 없음

## 잔여 위험

- 기본 2초 한도에 대한 실제 입력 장치와 interpreter 조합의 수동 latency 측정은 수행하지 않았다. 운영 환경에서 지연과 overflow 빈도를 확인하고 설정값을 조정할 것.