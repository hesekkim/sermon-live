# 006 SessionService에 AudioProcessor 연결

상태: 대기

## Goal

`SessionService`의 오디오 파이프라인을 `AudioCapture -> AudioProcessor -> interpreter.send_pcm()`로 연결한다.

## Why

interpreter가 요구하는 고정 포맷으로 항상 변환된 오디오가 전달되도록 보장하되, SessionService는 여전히 provider를 몰라야 한다.

## Related files

- `backend/services/session_service.py`
- `backend/tests/unit/test_session_events.py`

## Dependencies

005

## Implementation notes

- `_pump_capture()`에서 `capture.chunks()` → `AudioProcessor.process()` → `interpreter.send_pcm()` 순서로 변경.
- `AudioProcessor`는 세션 시작 시 `capture.input_format`(004)과 `interpreter.input_sample_rate/channels/sample_width`(005)로 1회 구성한다.
- echo interpreter의 기존 동작(입력 그대로 통과) 회귀가 없는지 확인.

## Acceptance criteria

- echo/openai 두 interpreter 모두 동일한 파이프라인 코드로 동작.
- `session_service.py`에 `if interpreter_name == "openai"` 같은 분기가 없다.

## Tests

- 기존 `test_session_events.py` 케이스가 AudioProcessor를 거친 뒤에도 그린.
- processed pcm이 interpreter로 전달되는지 확인하는 케이스 추가.

## Risks

- 낮음. 기존 이벤트 라우팅 로직은 변경하지 않음.
