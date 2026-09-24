# 016 Sermon Session UI

상태: 대기

## Goal

Sermon Session 정보를 입력/조회하는 Operator 화면을 추가한다 (제목/설교자/본문/노트 + lifecycle 표시).

## Why

015의 백엔드 기능을 Operator가 실제로 쓸 수 있어야 한다.

## Related files

- 신규 `frontend/src/pages/Operator/sermon-session/` (라우트 `/operator/sermon-session`)
- `frontend/src/App.tsx` (라우트 추가)
- `frontend/src/pages/Operator/layout/OperatorLayout.tsx` (사이드바 항목 추가)

## Dependencies

015

## Implementation notes

- 기존 InputField/Button 컴포넌트, hook-per-page 패턴(`useSermonSession`) 사용.
- lifecycle은 읽기 전용 표시(Prepare/Ready/Live/Ended), 값 자체는 서버가 결정.

## Acceptance criteria

- 폼 입력 저장/조회가 정상 동작.
- 사이드바에서 새 페이지로 이동 가능.

## Tests

- mock fetch로 폼 저장/로드 검증.

## Risks

- 낮음.
