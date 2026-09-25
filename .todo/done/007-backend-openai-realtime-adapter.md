# 007 OpenAI Realtime Translation adapter 구현

상태: 완료

## Goal

`OpenAIRealtimeInterpreter`를 `LiveInterpreter` protocol에 맞춰 완전히 구현한다: WebSocket 연결, 세션 설정, 오디오 송신, 이벤트 파싱, key 검증, graceful close.

## Why

현재 전 메서드가 `NotImplementedError`인 스텁이다. 이 티켓이 실제 번역 파이프라인의 핵심이다.

## Related files

- `backend/services/interpreters/openai_realtime.py`
- 신규 `backend/tests/unit/test_openai_realtime.py`
- `backend/core/config.py` (필요 시 필드 보강)

## Dependencies

006 (입력 포맷 계약 확정)

## Implementation notes

- **공식 문서 확인 (2026-09-24)**: [Realtime translation guide](https://developers.openai.com/api/docs/guides/realtime-translation)와 [Realtime API reference](https://developers.openai.com/api/reference/resources/realtime)를 확인했다. WebSocket endpoint는 `wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate`이며 표준 `Authorization: Bearer` 인증을 사용한다. 번역 전용 client event는 `session.update`, `session.input_audio_buffer.append`, `session.close`이고, 종료 시 `session.closed`까지 수신해야 pending output이 flush된다.
- **추가 공식 지원 경계 확인 (2026-09-25)**: Realtime Translation session create/update schema에는 `instructions`나 glossary/custom context 입력이 없다. `session.update`로 문서화된 변경 항목은 output language, input transcription, noise reduction이다. 일반 Realtime session의 instructions/system message 지원을 번역 session에 적용할 수 있다고 가정하지 않는다. [Realtime translation guide](https://developers.openai.com/api/docs/guides/realtime-translation), [Realtime API reference](https://developers.openai.com/api/reference/resources/realtime).
- 공식 event mapping은 `session.output_audio.delta` -> `audio`, `session.output_transcript.delta` -> `output_text`, `session.input_transcript.delta` -> `input_text`, `error` -> `error`다. WebSocket 오디오는 base64 24 kHz PCM16 mono little-endian이며 출력 audio delta는 `sample_rate`를 제공할 수 있다.
- 모델과 target language는 현재 문서의 `gpt-realtime-translate`, `de`(German)로 고정하고, source transcript는 `gpt-realtime-whisper`로 요청한다. 공식 translation session은 source language 필드를 제공하지 않으므로 source=Korean은 호출부의 입력 계약으로만 유지한다. Translation API에 없는 adapter instruction으로 source language나 custom context를 보내지 않는다.
- 확인 항목: endpoint, model availability, authentication, input/output audio format, transcript/audio delta event, close/flush lifecycle, instructions 지원 여부, glossary/context 전달 가능 여부.
- source=Korean, target=German 고정.
- 송신: 24kHz/mono/PCM16 청크를 base64 인코딩하여 세션 오디오 append 이벤트로 전송.
- 수신 이벤트를 vendor-neutral `InterpreterEvent(kind, pcm, sample_rate, text)`로 변환. OpenAI의 이벤트 이름이 상위 계층(SessionService, BroadcastHub)으로 새어나가지 않게 한다.
- `close()` 시 남은 출력(오디오/자막)을 flush한 뒤 WebSocket을 닫는다 (마지막 문장 유실 방지).
- `validate_key()`는 실제 연결/짧은 핸드셰이크로 키 유효성을 확인.
- mock WebSocket으로 setup 메시지 구조, 이벤트 파싱, 오류와 종료 순서를 검증한다.

## Acceptance criteria

- [x] echo와 동일한 protocol 인터페이스로 동작.
- [x] 정상 종료 시 마지막 자막/오디오가 유실되지 않는다.
- [x] 유효하지 않은 API 키에 대해 `KeyValidationError`를 던진다.
- [x] 공식 문서 확인 결과와 구현한 event mapping이 티켓에 기록되어 있다.

## Tests

- [x] mock WebSocket으로 setup 이벤트, 오디오 송신, 텍스트/오디오 델타 파싱, 에러 이벤트, close flush 순서 검증.

## Risks

- 가장 리스크가 큰 티켓. 공식 API 스펙이 문서 가정과 다를 가능성 높음 — 구현 중 스펙 재확인 필수.
