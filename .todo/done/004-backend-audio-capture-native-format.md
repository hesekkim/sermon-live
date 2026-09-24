# 004 AudioCapture 네이티브 포맷 대응

상태: 완료

## Goal

`AudioCapture`가 `input_sample_rate` 하드코딩 대신 선택된 장치의 실제 `default_sample_rate`를 조회해 사용하고, 실제로 열린 rate/channels/sample_width를 속성으로 노출한다.

## Why

노트북 마이크와 교회 Mixer는 서로 다른 sample rate를 가진다. "입력 format은 가변, OpenAI 전달 format만 고정"이라는 원칙에 따라 AudioCapture는 장치의 실제 포맷을 그대로 받아야 한다.

## Related files

- `backend/services/audio_capture.py`
- `backend/tests/unit/test_audio_capture.py` (신규 또는 기존 파일 확장)

## Dependencies

003

## Implementation notes

- PCM24를 실제로 받고 있다고 가정하지 않는다 (Archthecture.md 9번 항목). PyAudio open 포맷은 계속 `paInt16`으로 유지하되, `rate`는 `settings.input_sample_rate`가 명시적으로 설정된 경우 그 값을, 비어있으면 장치의 `default_sample_rate`를 조회해서 사용한다.
- 캡처 후 `AudioCapture.input_format` 같은 property로 `(sample_rate, channels, sample_width)`를 노출해 005의 AudioProcessor가 구성값으로 사용할 수 있게 한다.
- 채널 수는 장치의 `maxInputChannels`가 1 미만이면 열 수 없으므로 항상 1로 요청(현재와 동일), 다만 실제 열린 채널 수를 그대로 property에 반영.

## Acceptance criteria

- `settings.input_sample_rate`가 비어있을 때 장치 default rate로 스트림이 열린다.
- `AudioCapture` 인스턴스에서 실제 캡처 포맷을 조회할 수 있다.

## Tests

- mock PyAudio로 default_sample_rate 조회 및 반영 여부 검증.
- 기존 `_resolve_device_index` 동작 회귀 없는지 확인.

## Risks

- 실제 하드웨어에서 요청한 rate를 지원하지 않으면 PyAudio가 예외를 던질 수 있음 — 에러 메시지를 명확히 로깅.
