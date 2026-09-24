# 020 Glossary 세션 주입

상태: 대기

## Goal

007/017에서 지원이 확인된 경우, Global + Sermon Glossary 중 관련 용어를 번역 세션 설정에 주입한다. 지원되지 않으면 이 티켓은 보류 처리한다.

## Why

Glossary가 저장되어 있어도 실제 번역 결과에 반영되지 않으면 의미가 없다. 다만 지원 여부가 불확실하므로 확정된 사실 기반으로만 진행한다.

## Related files

- `backend/services/interpreters/openai_realtime.py`
- `backend/models/glossary.py`, `backend/models/translation_profile.py`

## Dependencies

017, 019, 007

## Implementation notes

- RAG/벡터 검색 등 복잡한 관련성 검색을 도입하지 않는다. 단순 규칙(예: 전체 Global + 오늘의 Sermon Glossary를 그대로 전달, 또는 최근 transcript에 등장한 단어와 매칭)으로 시작한다.
- API가 세션 중간에 instructions 갱신을 지원하지 않는 경우, 세션 시작 시점에만 주입 가능하다는 제약을 문서화한다.
- 지원되지 않는 것으로 확인되면: 이 티켓을 "보류"로 표시하고 이유를 기록한 뒤 019/017의 UI/저장 기능만 유지한다.

## Acceptance criteria

- 지원되는 경우: 새 세션 시작 시 관련 용어가 세션 설정에 포함됨을 로그/테스트로 확인.
- 지원되지 않는 경우: 티켓 상태가 "보류"로 전환되고 사유가 기록됨.

## Tests

- mock adapter로 glossary가 세션 설정 payload에 포함되는지 검증 (지원되는 경우).

## Risks

- 가장 불확실성이 큰 티켓 — 007의 조사 결과에 전적으로 의존.
