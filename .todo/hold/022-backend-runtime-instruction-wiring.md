# 022 Translation runtime context boundary

상태: 보류

## Goal

기존 `LiveInterpreter` 경계 안에서 Sermon context, Today's Glossary, 고정 번역 정책을 조립해 전달할 수 있는지 확정한다. 현재 `gpt-realtime-translate` 공식 API에는 해당 context/instructions 입력이 문서화되어 있지 않으므로, 지원이 생기기 전까지 payload 전달 구현은 보류한다.

## Why

저장 데이터만으로 실제 번역 결과 반영을 주장할 수 없다. 앱 context 모델과 OpenAI vendor payload의 지원 여부를 구분하고, 사용되지 않는 abstraction을 만들지 않아야 한다.

## Related files

- `backend/services/interpreters/openai_realtime.py`
- `backend/services/session_service.py`
- `backend/services/sermon_session.py`
- `backend/models/glossary.py`
- `backend/services/interpreters/protocol.py`

## Dependencies

015, 016, 019, 020, 023, 024

## Scope

- 지원되는 engine 입력 경로가 확인된 경우에만 필요한 context를 조립한다.
- 현재 OpenAI Translation API에 없는 `instructions`/Glossary 필드를 전송하지 않는다.
- provider 경계는 기존 `LiveInterpreter` protocol과 factory를 재사용한다. 별도의 `TranslationEngine` framework나 capability matrix를 추가하지 않는다.
- provider별 payload 처리는 해당 adapter 안에 둔다.

## Implementation notes

- 공식 문서가 context/instructions를 지원한다고 명시하기 전까지 runtime 조립 코드를 추가하지 않는다.
- 지원이 추가되면 적용 위치(세션 생성/갱신), 입력 한도, Glossary 범위를 재확인한 후 이 티켓을 재개한다.
- `session.update`에 현재 문서화된 번역 세션 설정은 output language, input transcription, noise reduction뿐이다.
- vendor-specific event 및 payload 이름은 adapter 밖으로 새지 않는다.

## Acceptance criteria

- 현재 OpenAI adapter가 stub 상태임을 유지하며, 구현 시 공식적으로 지원되지 않는 payload를 만들거나 전송하지 않는다.
- 지원되지 않는 payload를 보내거나 동작한다고 주장하는 테스트가 없다.
- 지원이 추가되면 기존 `LiveInterpreter` 경계를 사용하고 vendor payload는 adapter 안에 둔다.

## Tests

- 보류 해제 시 지원되는 context 전달 경로를 mock interpreter로 검증

## Risks

- 현재 공식 translation schema에는 context/instructions 필드가 없다. 새 지원이 확인될 때까지 이 티켓은 보류한다.
