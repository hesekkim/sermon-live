# 024 Translation Profile 잔재 제거 및 정책 범위

상태: 완료

## Goal

Translation Profile을 사용자 기능으로 유지하지 않고 남아 있는 model/service/API/storage/test 참조를 제거한다. 현재 OpenAI Translation API에서 사용할 수 없는 정책 필드로 별도 config나 새로운 runtime 입력을 만들지 않는다.

## Why

017/018은 폐기했지만 현재 backend에는 TranslationProfile model, store, endpoint가 남아 있다. 고정 번역 정책은 제품 결정으로만 유지하고, 이를 소비할 공식 API가 없는데 런타임 config를 먼저 만들지 않는다.

## Related files

- `backend/models/translation_profile.py`
- `backend/services/translation_profile.py`
- `backend/api/v1/endpoints/translation_profile.py`
- API router registration, related tests, and `backend/data/translation_profile.json` if present
- repository-wide stale Translation Profile UI/navigation references, if any remain

## Dependencies

없음

## Scope

- TranslationProfile CRUD model/store/endpoint/route/tests와 사용되지 않는 참조를 제거한다.
- 기존 JSON 데이터가 있으면 내용을 확인하고, 사용자 데이터 처리 방침을 정하지 않은 채 조용히 삭제하지 않는다.
- 정책 결정은 Korean → German, 자연스러운 설교 통역, 불필요한 설명/요약 금지, 성경 용어 일관성으로 문서화하되 API 전송 가능하다고 주장하지 않는다.
- 정책을 위한 Operator CRUD, profile 모델, capability matrix는 만들지 않는다.

## Implementation notes

- 실제 OpenAI Translation 문서의 세션 설정은 model/audio이며, 갱신은 output language, input transcription, noise reduction에 한정된다. 정책 문자열을 보낼 수 있는 공식 필드는 문서화되어 있지 않다.
- 공식 API가 정책 입력을 지원하게 되면 그때 작은 고정 config의 필요성을 재검토한다.
- API key, 오디오 장치, Safety 설정은 이 ticket의 제거 대상이 아니다.

## Acceptance criteria

- `/api/v1/translation-profile`와 전용 model/store가 더 이상 활성 API/runtime에서 사용되지 않는다.
- 제거 전 저장 JSON이 있는지 확인하고, 기존 데이터가 있으면 보존/폐기 방법을 기록한다.
- 남은 import, route registration, tests, settings/navigation UI 참조가 없다.
- 고정 정책은 현재 API가 지원하는 기능처럼 표현되지 않는다.

## Tests

- API route inventory/endpoint absence
- repository search for active TranslationProfile imports and endpoint references
- retained user configuration data is not silently discarded

## Risks

- future engine이 runtime policy를 공식 지원하면 작은 config를 별도 변경으로 추가한다.
