# 021 Glossary UI

상태: 대기

## Goal

Global Glossary와 Today's Sermon Glossary를 각 소유 화면 안에서 편집할 수 있게 한다.

## Why

Operator가 용어를 관리할 수 있어야 한다. Glossary는 별도 top-level 페이지가 아니라 Settings와 Sermon의 각 영역에 둔다.

## Related files

- Operator Settings의 Global Glossary 영역
- Sermon 화면의 Today's Sermon Glossary 영역
- 기존 Glossary API와 Operator/Sermon page hooks

## Dependencies

016, 019

## Implementation notes

- Global Glossary는 Settings 내부에 둔다.
- Today's Sermon Glossary는 Sermon 화면 내부에 두고 현재 Sermon Session에 연결한다.
- 별도 Glossary top-level route/page를 만들지 않고, 두 glossary를 한 페이지에 합치지 않는다.
- 용어 추가/삭제만 지원 (수정은 삭제 후 재추가로 단순화 가능).

## Acceptance criteria

- Settings에서 Global Glossary를 독립적으로 조회/추가/삭제할 수 있다.
- Sermon에서 Today's Sermon Glossary를 현재 세션 범위로 조회/추가/삭제할 수 있다.
- 두 Glossary는 화면과 저장 범위가 서로 섞이지 않는다.

## Tests

- mock fetch로 추가/삭제 흐름 검증.

## Risks

- 낮음.
