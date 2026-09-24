# 017 Translation Profile 모델

상태: 대기

## Goal

고정 번역 정책(source/target 언어, 스타일, 성경 용어 처리 방침 등)을 저장/조회하는 Translation Profile을 추가한다.

## Why

매주 바뀌는 Sermon Session과 달리, 번역 정책은 고정적으로 관리되어야 한다 (Archthecture.md 24번).

## Related files

- 신규 `backend/models/translation_profile.py`
- 신규 endpoint `GET/PUT /api/v1/translation-profile`
- `backend/services/interpreters/openai_realtime.py` (지원되는 경우에만 연결)

## Dependencies

007 (adapter가 실제로 instructions/style 주입을 지원하는지 확인 필요), 015와 병렬 가능

## Implementation notes

- 필드: `name, source_language(고정 Korean), target_language(고정 German), style, biblical_terminology(bool), no_explanation(bool), no_summarization(bool)`.
- **007에서 확인된 사실에 따라 실제 적용 범위를 조정한다.** gpt-realtime-translate가 세션 설정/instructions를 지원하지 않는다면, 이 티켓은 저장/조회 UI만 제공하고 실제 세션 주입은 020에서 명시적으로 보류 처리한다.
- 과도한 데이터 모델(우선순위, 버전 관리 등)을 추가하지 않는다.

## Acceptance criteria

- Profile 저장/조회 가능.
- OpenAI adapter에 실제로 전달 가능한지 여부가 티켓 노트에 명시되어 있다.

## Tests

- 저장/조회 라운드트립 테스트.

## Risks

- API가 arbitrary instructions를 지원하지 않으면 이 기능의 실질적 효과가 제한될 수 있음.
