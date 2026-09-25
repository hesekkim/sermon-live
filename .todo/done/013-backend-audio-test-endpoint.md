# 013 오디오 테스트 엔드포인트

상태: 완료

## Goal

`POST /api/v1/audio/test`로 짧은 시간 캡처하여 감지된 포맷(sample rate/channels/bit depth)과 입력 레벨을 반환한다. 번역 세션을 시작하지 않고 확인 가능해야 한다.

## Why

Operator가 실제 세션을 켜지 않고도 장치가 정상 연결되어 신호가 들어오는지 확인할 수 있어야 한다 (Archthecture.md 13번).

## Related files

- 신규 endpoint (`backend/api/v1/endpoints/audio.py`)
- `backend/services/audio_devices.py` 또는 `audio_capture.py` 재사용
- 신규 테스트

## Dependencies

004, 005

## Implementation notes

- 짧은 시간(예: 1~2초) `AudioCapture`를 독립적으로 열어 캡처 후 즉시 종료.
- 응답에 감지된 원본 포맷과 AudioProcessor로 변환한 결과 포맷(24kHz/mono/PCM16 처리 성공 여부)을 모두 포함.
- 이미 세션이 실행 중일 때는 장치 충돌을 피하기 위해 테스트 요청을 거부하고 명확한 에러를 반환한다.

## Acceptance criteria

- 장치 연결 안 됨/무음/정상 신호 세 가지 상황을 구분해 응답한다.
- 세션 실행 중에는 409 등으로 명확히 거부한다.

## Tests

- mock PyAudio로 감지 포맷/레벨 반환 검증, 세션 실행 중 거부 케이스 검증.

## Risks

- 실제 마이크 캡처는 테스트하지 않는다 (testing-strategy) — mock 기반으로만 검증.
