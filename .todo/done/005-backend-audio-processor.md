# 005 AudioProcessor (포맷 변환)

상태: 완료

## Goal

임의의 입력 오디오(sample rate/channels/sample width)를 interpreter가 요구하는 포맷으로 청크 단위 스트리밍 변환하는 `AudioProcessor`를 만든다.

## Why

AudioCapture는 네이티브 포맷을 유지하고, OpenAI 등 provider가 요구하는 고정 포맷(24kHz/mono/PCM16)으로의 변환은 별도 계층이 담당해야 AudioCapture를 다시 만들 필요가 없다.

## Related files

- 신규 `backend/services/audio_processor.py`
- `backend/services/interpreters/protocol.py` (interpreter required format 속성 추가)
- `backend/services/interpreters/echo.py`, `backend/services/interpreters/openai_realtime.py` (포맷 속성 선언)
- `backend/requirements.txt` (numpy 추가)
- 신규 `backend/tests/unit/test_audio_processor.py`

## Dependencies

004

## Implementation notes

- `LiveInterpreter` protocol에 `required_sample_rate: int`, `required_channels: int`, `required_sample_width: int` 속성(또는 read-only property)을 추가한다. 이 값은 interpreter가 요구하는 입력 포맷이며 AudioCapture의 native format과 구분한다.
- AudioCapture는 `native_sample_rate/native_channels/native_sample_width`를 제공하고, SessionService는 `native format -> interpreter.required_*` 변환으로 AudioProcessor를 구성한다. SessionService는 vendor 이름으로 분기하지 않는다.
- `AudioProcessor(source_rate, source_channels, source_width, target_rate, target_channels, target_width)`:
  - `process(chunk: bytes) -> bytes` — bit-depth 변환 → channel downmix → resample 순서로 처리.
  - 청크 경계에서 프레임이 잘리는 문제(odd byte, resample 위상)를 다음 청크로 carry-over 처리한다 (전체 버퍼링 금지).
- 리샘플링은 numpy 기반 선형보간 또는 `scipy` 없이 numpy만으로 구현 (신규 의존성 최소화). `audioop`는 Python 3.13에서 제거되었으므로 사용하지 않는다.
- 설계 목표: "capture -> process -> send"를 작은 청크 단위로 즉시 수행 (전체 설교를 메모리에 모으지 않음).

## Acceptance criteria

- 48kHz/stereo/16bit 입력 → 24kHz/mono/16bit 출력이 청크 단위로 정확히 변환됨.
- echo/openai 각 interpreter가 선언한 목표 포맷대로 변환됨.
- SessionService/BroadcastHub 코드에 provider 이름 분기가 없다.
- `input_*`와 `required_*` 포맷의 의미가 코드와 테스트에서 혼동되지 않는다.

## Tests

- 알려진 사인파 등 합성 PCM으로 다운샘플링/다운믹스 결과 검증.
- 청크 경계 carry-over(홀수 바이트, 위상 연속성) 검증.

## Risks

- 리샘플링 품질/지연 트레이드오프 — 저지연 우선, 품질 이슈는 실사용 테스트에서 조정.
