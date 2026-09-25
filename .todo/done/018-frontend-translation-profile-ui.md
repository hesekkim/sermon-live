# 018 Translation Profile UI

상태: 폐기/제외

## Goal

Translation Profile 필드를 입력/조회하는 간단한 폼 UI를 추가한다.

## Why

017의 백엔드 기능을 Operator가 사용할 수 있어야 한다.

## Related files

- 신규 `frontend/src/pages/Operator/translation-profile/`
- `frontend/src/App.tsx`, `OperatorLayout.tsx` (라우트/사이드바)

## Dependencies

017

## Implementation notes

- SlideToggle(불리언 필드), InputField(텍스트 필드) 등 기존 컴포넌트 재사용.

## Acceptance criteria

- 폼 저장/조회 정상 동작.

## Tests

- mock fetch로 저장/로드 검증.

## Risks

- 낮음.
