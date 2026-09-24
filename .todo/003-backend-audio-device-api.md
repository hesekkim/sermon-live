# 003 오디오 입력 장치 목록 API

상태: 대기

## Goal

`GET /api/v1/audio/devices`로 사용 가능한 PyAudio 입력 장치 목록(index, name, input_channels, default_sample_rate)을 반환한다.

## Why

Operator UI에서 입력 장치를 선택하려면 백엔드가 실제 장치 목록을 제공해야 한다. 현재는 `audio_device` 설정을 텍스트로만 넣을 수 있고 조회 API가 없다.

## Related files

- 신규 `backend/services/audio_devices.py`
- `backend/api/v1/api.py` (라우터 등록)
- 신규 `backend/api/v1/endpoints/audio.py`
- 신규 `backend/tests/unit/test_audio_devices.py`

## Dependencies

001 (병렬 진행 가능)

## Implementation notes

- PyAudio 인스턴스를 열어 `get_device_count()`/`get_device_info_by_index()`로 `maxInputChannels > 0`인 장치만 필터링.
- 응답 스키마: `[{"index": int, "name": str, "input_channels": int, "default_sample_rate": number}]`.
- 테스트에서는 실제 오디오 하드웨어 대신 PyAudio를 mock 처리한다 (testing-strategy: 실제 마이크 캡처 테스트 금지).
- `audio_capture.py`의 `_resolve_device_index`와 로직이 겹치지 않도록 장치 열거 로직을 `audio_devices.py`로 공유/재사용한다.

## Acceptance criteria

- 장치가 없거나 PyAudio 초기화 실패 시에도 500 대신 빈 배열 또는 명확한 에러로 처리.
- 응답 필드명이 문서(GET /api/audio/devices 예시)와 일치.

## Tests

- mock PyAudio device list로 필터링(입력 채널 0인 장치 제외) 검증.

## Risks

- PyAudio 장치 열거가 플랫폼별로 동작이 다를 수 있음 — 실패 시 graceful degradation 필요.
