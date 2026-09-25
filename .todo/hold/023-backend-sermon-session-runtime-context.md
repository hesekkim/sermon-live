# 023 Sermon Session runtime context

상태: 보류

## Goal

실제 Sermon Session에 저장된 데이터만 사용해 runtime context block을 구성하는 규칙을 정의한다. 다만 선택된 OpenAI Translation API에 전달할 공식 경로가 없어, 이를 소비할 engine이 확인될 때까지 구현은 보류한다.

## Why

설교 제목, 연사, 성경 구절, 본문, 메모는 설교 맥락이다. 실제 모델에 전달 가능한 필드인 것처럼 취급하지 않으며, Sermon Session에 없는 필드를 임의로 추가하지 않는다.

## Related files

- `backend/services/sermon_session.py`
- `backend/api/v1/endpoints/sermon_session.py`
- `backend/services/interpreters/openai_realtime.py`

## Dependencies

015, 016

## Scope

- 실제 필드 `title`, `speaker`, `bible_reference`, `bible_text`, `notes`만 projection 대상으로 삼는다.
- `summary`, session purpose 등 Sermon Session에 없는 필드를 만들지 않는다.
- Sermon Glossary는 별도 저장 도메인으로 유지하고 이 context block에 중복 저장하지 않는다.

## Implementation notes

- 지원되는 runtime consumer가 확인된 뒤 title, speaker, bible reference, bible text, notes 중 필요한 값을 선택한다.
- 긴 Bible text는 전문 전달을 전제하지 않는다. 공식 입력 한도와 의미적 우선순위가 확인되기 전까지 임의 truncation 규칙을 구현하지 않는다.
- metadata 전체를 무조건 전달하지 않는다.

## Acceptance criteria

- projection 필드는 현재 Sermon Session 모델과 정확히 일치한다.
- context를 받을 수 있는 공식 interpreter/API가 확인되기 전에는 runtime 전송 구현을 하지 않는다.
- 지원 확인 후 빈 값 fallback, 최대 길이, 우선순위를 근거와 함께 정한다.

## Tests

- 보류 해제 후 projection, 빈 필드 fallback, 길이 제한 규칙 검증

## Risks

- 현재 Realtime Translation API는 context/instructions 입력을 문서화하지 않는다.
