# 002b UI 언어 + Dark mode

상태: 완료

## 목표

Operator의 화면 문자열과 색상 테마를 사용자 preference로 제어하고 새로고침 후에도 유지한다.

## 구현 범위

- `OperatorPrefsProvider`와 `useOperatorPrefs` 추가
- `ko`, `en`, `de` 사전 작성 및 기본 언어 `ko` 지정
- Settings의 language `Select`로 언어 변경
- `operatorUiLanguage` localStorage 저장 및 `html[lang]` 동기화
- shared `SlideToggle`로 light/dark 전환
- `operatorUiTheme` localStorage 저장 및 `html[data-theme]` 동기화
- CMS token 기반 light/dark 색상 정의
- 과거 transcript는 기본 text 색상, 현재 transcript는 `--highlight` 색상 사용

## 수용 기준

- Operator 화면에 표시되는 title, label, button, empty state, error 문구가 선택 언어로 바뀐다.
- 초기 진입 언어는 한국어이며 저장된 언어가 있으면 복원된다.
- dark mode에서 본문은 흰색 계열, light mode에서 검은색 계열이고 현재 문장만 파란색이다.
- Listen 화면 preference와 Operator preference가 충돌하지 않는다.
- 문자열을 TSX에 직접 추가하지 않고 사전에 추가한다.

## 검증

- `Push-Location frontend; npm run build; Pop-Location`
- 세 언어와 두 테마를 전환한 뒤 새로고침하여 persistence 확인

## 커밋 경계

사전, preference provider, theme token/CSS, Settings의 language/theme 연결만 포함한다. provider 저장 API와 방송 WebSocket은 포함하지 않는다.
