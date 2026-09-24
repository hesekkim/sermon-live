# 007 OpenAI Realtime Translation adapter 구현

상태: 대기

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

- **구현 착수 전 반드시 OpenAI 공식 문서에서 최신 endpoint/model/event schema를 재확인한다.** 이 티켓 작성 시점의 `/v1/realtime/translations`, `gpt-realtime-translate`, 이벤트 이름(`input_audio_buffer.append` 등)은 검증되지 않은 가정이다. 확인한 공식 문서 URL과 확인 날짜를 티켓에 기록하고, 다르면 구현 전에 이 티켓의 가정과 의존성을 갱신한다.
- 확인 항목: endpoint, model availability, authentication, input/output audio format, transcript/audio delta event, close/flush lifecycle, instructions 지원 여부, glossary/context 전달 가능 여부.
- source=Korean, target=German 고정.
- 송신: 24kHz/mono/PCM16 청크를 base64 인코딩하여 세션 오디오 append 이벤트로 전송.
- 수신 이벤트를 vendor-neutral `InterpreterEvent(kind, pcm, sample_rate, text)`로 변환. OpenAI의 이벤트 이름이 상위 계층(SessionService, BroadcastHub)으로 새어나가지 않게 한다.
- `close()` 시 남은 출력(오디오/자막)을 flush한 뒤 WebSocket을 닫는다 (마지막 문장 유실 방지).
- `validate_key()`는 실제 연결/짧은 핸드셰이크로 키 유효성을 확인.
- mock WebSocket으로 setup 메시지 구조, 이벤트 파싱, 오류와 종료 순서를 검증한다.

## Acceptance criteria

- echo와 동일한 protocol 인터페이스로 동작.
- 정상 종료 시 마지막 자막/오디오가 유실되지 않는다.
- 유효하지 않은 API 키에 대해 `KeyValidationError`를 던진다.
- 공식 문서 확인 결과와 구현한 event mapping이 티켓에 기록되어 있다.

## Tests

- mock WebSocket으로 setup 이벤트, 오디오 송신, 텍스트/오디오 델타 파싱, 에러 이벤트, close flush 순서 검증.

## Risks

- 가장 리스크가 큰 티켓. 공식 API 스펙이 문서 가정과 다를 가능성 높음 — 구현 중 스펙 재확인 필수.
