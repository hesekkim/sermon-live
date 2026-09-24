# 019 Glossary 모델 (Global + Sermon)

상태: 대기

## Goal

Global Glossary(영구)와 Today's Sermon Glossary(세션 스코프)를 관리하는 최소 데이터 모델과 CRUD 엔드포인트를 추가한다.

## Why

용어 일관성을 위해 글로벌/설교별 용어집을 분리 관리해야 한다 (Archthecture.md 26~28번). 처음부터 과도한 메타데이터(RAG, 우선순위 등)를 만들지 않는다.

## Related files

- 신규 `backend/models/glossary.py`
- 신규 endpoint `GET/POST/DELETE /api/v1/glossary/global`, `/api/v1/glossary/sermon`
- 신규 테스트

## Dependencies

015 (sermon glossary가 sermon session에 종속)

## Implementation notes

- 항목 필드는 `source, target`만 (최소). priority/note 등은 실제 필요성이 확인되기 전까지 추가하지 않는다.
- Global Glossary는 JSON 파일로 영구 저장. Sermon Glossary는 현재 Sermon Session에 종속되어 저장(015 모델의 하위 필드 또는 별도 파일 + sermon id 참조).

## Acceptance criteria

- 용어 추가/삭제/조회가 Global/Sermon 각각 독립적으로 동작.

## Tests

- CRUD 라운드트립, Global과 Sermon 간 격리 검증.

## Risks

- 낮음. 의도적으로 최소 스코프 유지.
