# 040 Backend 장치 입력 포맷 협상과 변환 target 정리

상태: 대기
우선순위: 높음

## Goal

선택한 입력 장치가 지원하는 캡처 포맷을 확인해 AudioCapture를 열고, capture tuple을 AudioProcessor에서 interpreter 요구 포맷으로 변환한다. OpenAI로 전송되는 포맷은 24 kHz/mono/PCM16으로 보장한다.

## Why

현재 `AudioCapture`는 sample rate만 설정값 또는 장치 기본값으로 선택하고 channels=1, `paInt16`으로 연다. 장치 capability를 협상하거나 실패 대안을 검증하지 않는다. 한편 `translation_target_*` config 값은 실제 변환에 쓰이지 않고, runtime은 interpreter protocol의 required format을 사용한다. 설정과 실행 경로 사이의 불일치를 제거해야 한다.

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

- PortAudio/PyAudio에서 device별 지원 여부를 조회/검증하고 선택한 입력 장치의 stream을 실제로 open할 수 있는 format을 선택한다. `maxInputChannels`나 `defaultSampleRate` 하나만으로 PCM width 지원을 단정하지 않는다.
- 가능한 candidate format을 분명한 우선순위로 검사하고, 지원 포맷이 없으면 선택한 device 이름과 실패 이유를 포함하되 API key 등 secret은 포함하지 않는 오류를 반환한다.
- `input_format`은 OS driver에서 물리적으로 받은 ADC format이 아니라 PyAudio stream에서 앱이 요청/수신하는 `(sample_rate, channels, sample_width)`임을 문서와 UI에 명시한다. Mixer가 24-bit라고 해서 app input도 24-bit라고 가정하지 않는다.
- audio device API가 UI에 제공하는 capability 정보와 실제 probe 결과를 구분한다. 신뢰할 수 없는 “지원한다” 표시를 만들지 않는다.
- `AudioProcessor`는 native/capture tuple을 provider-agnostic하게 interpreter의 `required_*` tuple로 변환한다. `SessionService`와 runtime에 provider name 분기를 추가하지 않는다.
- OpenAI adapter의 required format 24 kHz/mono/PCM16을 canonical target으로 둔다. 현재 아무 곳에서도 변환 target으로 쓰이지 않는 `translation_target_sample_rate/channels/sample_width` 필드는 제거한다. 이미 환경변수로 설정된 경우 migration note나 명확한 validation 오류를 고려한다.
- `/api/v1/audio/test`와 `/stream`은 OpenAI format을 무조건 hardcode하지 말고 현재 선택된 interpreter/format resolver의 target을 사용한다. test 결과의 `processing_success`는 실제 process/flush 성공으로 설정한다.
- Audio Test 응답과 UI는 “Detected” 대신 “Capture stream format”에 맞는 의미를 사용하고, sample width를 bit 단위로 일관되게 표시한다. `input_channels`, default rate는 capability metadata이지 선택된 stream의 실제 format과 같지 않다.
- 장치 목록에 default device 선택이 가능해야 한다. UI가 빈 selectedDevice 때문에 default 사용 경로를 막지 않도록 contract를 정한다.

## Acceptance criteria

- Mono/stereo 및 서로 다른 지원 sample rate/PCM width를 가진 fake device에 대해 선택된 capture tuple이 정확히 보고된다.
- 지원되지 않는 포맷과 장치 unavailable 상황은 명확한 오류가 되고 잘못된 stream format을 정상으로 표시하지 않는다.
- 서로 다른 native capture format이 AudioProcessor를 거쳐 OpenAI 요구 tuple로 변환된다.
- OpenAI에 보내는 실제 bytes는 24 kHz/mono/PCM16 little-endian 계약을 만족한다.
- Pipeline은 provider 이름을 직접 검사하지 않고 `LiveInterpreter.required_*`만 사용한다.
- Audio Test의 processing format과 실제 processor target이 일치한다.
- Audio Test normal/stream 경로의 conversion 결과와 `processing_success` 의미가 일관된다.
- target config 필드 제거 후 config/API/UI 테스트가 새 계약에 맞게 갱신된다.

## Tests

- PyAudio fake에서 format support probe, candidate fallback, 선택 device index, stream open error를 검증한다.
- AudioProcessor unit test에서 channel conversion, PCM24 decode, resampling, odd-byte carry 및 output duration을 검증한다.
- AudioRuntime test에서 fake interpreter required tuple이 실제 target으로 쓰이는지 확인한다.
- Audio endpoint test에서 Audio Test 결과 format이 실제 처리와 일치하는지 검증한다.
- 실제 장비 캡처는 unit test에서 하지 않는다. Laptop mic와 USB/Mixer는 수동 LAN/장비 검증 항목으로 남긴다.

## Risks

- 일부 PortAudio host API의 capability probe 결과와 실제 `open()` 결과가 다를 수 있으므로 마지막 결정은 stream open 성공이어야 한다.
- 자동 candidate 탐색이 예상치 못한 낮은 품질/채널 선택을 할 수 있다. 우선순위를 명시하고 Operator에 실제 app stream format을 보여준다.
- Windows OS audio driver가 format을 변환하면 표시 값은 장치의 물리 input bit depth와 다를 수 있다.
- 기존 `APP_TRANSLATION_TARGET_*` 사용 환경과 테스트 fixture가 있을 수 있으므로 제거 시 영향과 migration을 확인한다.
