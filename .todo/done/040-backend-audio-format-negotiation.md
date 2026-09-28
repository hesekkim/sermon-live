# 040 Backend 장치 입력 포맷 협상과 변환 target 정리

상태: 완료
우선순위: 높음

## Goal

선택한 입력 장치가 지원하는 캡처 포맷을 확인해 AudioCapture를 열고, capture tuple을 AudioProcessor에서 interpreter 요구 포맷으로 변환한다. OpenAI로 전송되는 포맷은 24 kHz/mono/PCM16으로 보장한다.

## Why

변경 전 `AudioCapture`는 sample rate만 설정값 또는 장치 기본값으로 선택하고 channels=1, `paInt16`으로 열었다. 장치 capability 협상이나 fallback 검증도 없었다. `translation_target_*` config 값은 실제 변환에 쓰이지 않았고 runtime은 interpreter protocol의 required format을 사용했다. 이번 작업은 이 설정과 실행 경로의 불일치를 제거한다.

## Related files

- `backend/services/audio_capture.py`
- `backend/services/audio_devices.py`
- `backend/services/audio_processor.py`
- `backend/services/audio_runtime.py`
- `backend/core/config.py`
- `backend/services/interpreters/protocol.py`
- `backend/services/interpreters/openai_realtime.py`
- `backend/services/interpreters/factory.py`
- `backend/api/v1/endpoints/audio.py`
- `backend/tests/unit/test_audio_capture.py`
- `backend/tests/unit/test_audio_devices.py`
- `backend/tests/unit/test_audio_processor.py`
- `backend/tests/unit/test_audio_runtime.py`
- Audio Test frontend: `frontend/src/pages/Operator/settings/hooks/useAudioTest.ts`, `components/AudioTestPanel.tsx`

## Dependencies

- `.todo/done/003-backend-audio-device-api.md`
- `.todo/done/004-backend-audio-capture-native-format.md`
- `.todo/done/005-backend-audio-processor.md`
- `.todo/done/006-backend-session-service-processor-wiring.md`
- `.todo/done/007-backend-openai-realtime-adapter.md`

## Implementation notes

- candidate별 `AudioCapture.open()` 시도로 rate/channel/PCM width를 검증하고, 실제 stream open 성공을 선택 기준으로 사용한다.
- 선택한 device 이름 또는 index를 사용할 수 없으면 명확한 오류로 실패한다. 명시적인 장치 선택이 default input으로 조용히 대체되지 않는다.
- `input_format`은 물리 ADC format이 아니라 PyAudio stream의 `(sample_rate, channels, sample_width)`이다. Device metadata와 실제 capture tuple을 구분한다.
- `AudioProcessor` target은 provider-agnostic하게 `LiveInterpreter.required_*`를 사용한다. OpenAI adapter는 24 kHz/mono/PCM16 little-endian을 요구한다.
- 사용되지 않던 `translation_target_*` 설정 필드를 제거했다. 기존 `.env`에서는 `APP_TRANSLATION_TARGET_SAMPLE_RATE`, `APP_TRANSLATION_TARGET_CHANNELS`, `APP_TRANSLATION_TARGET_SAMPLE_WIDTH` 항목을 제거하도록 `backend/.env.example`과 `docs/audio-test.md`에 migration note를 추가했다.
- Audio Test normal/stream 경로는 Operator store 설정을 overlay하고 `process()`와 `flush()`가 완료된 경우에만 `processing_success=true`로 보고한다. 오류 응답도 선택 interpreter의 processing target을 반환한다.
- API와 UI는 `capture_*` tuple을 사용하고 UI sample width는 bit 단위로 표시한다. 선택값이 비어 있으면 시스템 기본 입력을 테스트할 수 있다.

## Acceptance criteria

- [x] Fake device의 mono/stereo 및 여러 sample rate/PCM width 조합에서 열린 capture tuple을 정확히 보고한다.
- [x] 지원되지 않는 조합과 unavailable device는 장치 이름 및 실패 이유를 포함해 명확히 실패한다.
- [x] AudioProcessor가 capture format을 interpreter required tuple로 변환하고 OpenAI target byte 계약을 유지한다.
- [x] Pipeline은 provider 이름을 직접 검사하지 않고 `LiveInterpreter.required_*`를 사용한다.
- [x] Audio Test normal/stream 결과의 target과 `processing_success` 의미가 일치한다.
- [x] UI가 capture stream format을 표시하고 sample width를 bits로 표시한다.
- [x] 기본 장치를 선택하지 않은 초기 상태에서도 default input Audio Test가 가능하다.
- [x] 이전 `APP_TRANSLATION_TARGET_*` 설정 제거 방법을 문서화했다.

## Tests

- Fake PyAudio candidate fallback, stereo/PCM24 선택, 누락 장치 오류와 리소스 정리 검증.
- AudioProcessor 채널 변환, PCM24 decode, resampling, odd-byte carry 및 flush 검증.
- AudioRuntime이 interpreter required format을 실제 target으로 쓰는지 검증.
- Audio Test의 Operator interpreter target, process/flush 오류, normal/stream 결과 검증.
- 실제 장비 캡처는 unit test에서 하지 않는다. Laptop mic와 USB/Mixer 검증은 수동 항목으로 남긴다.

## Review 결과 및 검증

- Backend unit: `pytest tests/unit -q` 114 passed.
- Frontend Audio Test/format unit: 5 passed.
- Frontend build/typecheck: `npm run build` 통과.
- 전체 frontend unit suite: 70 passed, 1 failed. 실패는 이 작업 범위 밖인 `operatorNavigation` 로그인 오류 DOM assertion이다.
- 실제 장비 검증은 수행하지 않았다.