# 020 OpenAI Glossary 지원 확인

상태: 보류

## Goal

현재 선택한 `gpt-realtime-translate`가 custom terminology 또는 context/ instructions를 공식 지원하는지 확인하고, 지원 경계를 기록한다. 미지원이므로 Glossary 주입 구현은 하지 않는다.

## Why

Glossary 저장은 번역 결과 반영을 보장하지 않는다. 일반 Realtime API의 instructions 지원을 Realtime Translation API에도 있다고 가정하지 않는다.

## Related files

- `backend/services/interpreters/openai_realtime.py`
- `backend/models/glossary.py`

## Dependencies

007, 019

## Implementation notes

- 2026-09-25 공식 문서 확인 결과: Realtime Translation 세션 생성 설정에는 model/audio가 있고, `session.update`는 `audio.output.language`, `audio.input.transcription`, `audio.input.noise_reduction`만 지원한다. `instructions`, custom context, glossary 필드는 문서화되어 있지 않다.
- 일반 Realtime API에 있는 `instructions` 및 system message 기능은 `/v1/realtime/translations`의 `gpt-realtime-translate` 지원 근거로 간주하지 않는다.
- 공식 문서: https://developers.openai.com/api/docs/guides/realtime-translation 및 https://developers.openai.com/api/reference/resources/realtime
- 지원 범위가 공식 문서에서 바뀌기 전까지 주입 payload, 관련 용어 선택, 전체 사전 전송 구현은 하지 않는다.

## Acceptance criteria

- 미지원 근거와 확인 날짜가 기록된다.
- 현재 OpenAI Translation adapter가 임의의 instructions/glossary 필드를 전송하지 않는다.
- 지원이 추가되면 공식 필드와 적용 시점 확인 후 이 티켓을 다시 진행한다.

## Tests

- 지원 전에는 Glossary 주입 payload 테스트를 추가하지 않는다.

## Risks

- 문서가 아닌 경험적 prompt 결과만으로 API 지원을 가정하면 무효 필드 전송과 무효 UI 설정을 만들 수 있다.
