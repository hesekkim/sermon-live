# 021 Glossary UI

상태: 대기

## Goal

Global Glossary와 Today's Sermon Glossary를 각각 편집할 수 있는 테이블 UI를 추가한다.

## Why

개발자가 JSON 파일을 직접 고치지 않고 Operator가 용어를 관리할 수 있어야 한다 (Archthecture.md 28번).

## Related files

- 신규 `frontend/src/pages/Operator/glossary/`
- `frontend/src/App.tsx`, `OperatorLayout.tsx`

## Dependencies

019

## Implementation notes

- Global Glossary 섹션과 Sermon Glossary 섹션을 명확히 구분해서 표시.
- 용어 추가/삭제만 지원 (수정은 삭제 후 재추가로 단순화 가능).

## Acceptance criteria

- 두 영역에서 각각 독립적으로 추가/삭제 가능.

## Tests

- mock fetch로 추가/삭제 흐름 검증.

## Risks

- 낮음.
