# 002 방송실 Operator UI

상태: 완료

## 목표

방송 담당자가 FHD 데스크톱 화면에서 통역 세션을 시작/정지하고, 통역 제공자 설정과 누적 전사를 관리할 수 있는 React Operator 화면을 제공한다.

## 범위

- React Router 기반 `/operator` 셸과 `/operator/settings`, `/operator/broadcast` 화면
- `frontend/src/shared/components`의 `Sidebar`, `SidebarPanelIcon`, `Select`, `InputField`, `SlideToggle`, `Button` 재사용
- Echo/Gemini/OpenAI provider 선택과 provider별 API key 저장
- 한국어 input transcript와 독일어 output transcript 표시
- Listen WebSocket 접속자 수 표시
- 세션 start/stop 및 누적 transcript TXT 다운로드
- 한국어/영어/독일어 UI와 light/dark theme 저장

## 비범위

- 모바일/반응형 UI. 최소 1280px, 주 대상은 FHD(1920x1080) 데스크톱이다.
- 방송실에서 입력 오디오 장치 선택
- OpenAI Realtime 실제 adapter 구현
- API key 암호화, 사용자 인증, 다중 운영자 권한
- Listen 화면의 디자인 개편

## 공통 구현 규칙

- Operator 화면의 일반 버튼은 shared `Button`을 사용한다. icon-only 세션 토글처럼 상태/접근성 요구가 있는 컨트롤만 native button을 허용한다.
- provider와 language 선택은 shared `Select`, API key 입력은 shared `InputField`, theme은 shared `SlideToggle`을 사용한다.
- Listen 전용 CSS가 Operator에 누수되지 않도록 전역 `button` 선택자를 사용하지 않는다.
- 화면에 노출되는 Operator 문자열은 `translations.ts` 사전에서만 가져온다.
- API key 값은 GET/WebSocket/로그/화면에 반환하지 않고 저장 여부만 반환한다.

## 완료 기준

- `/operator` 진입 시 broadcast 화면으로 이동하고 Sidebar에서 settings/broadcast를 전환할 수 있다.
- Sidebar 접힘 상태가 localStorage에 유지되며, 화면 폭이 줄면 input pane을 숨기고 Sidebar를 접는다.
- 저장한 provider 설정은 다음 세션 start부터 적용되고, 실행 중인 세션은 변경하지 않는다.
- Listen 클라이언트에는 output transcript/audio만 전달하고 Operator에는 input/output을 모두 전달한다.
- 연결 오류, 저장 실패, interpreter 오류가 Operator UI에 표시된다.
- `backend` pytest, `frontend` Vitest, `frontend` production build가 통과한다.

## 하위 티켓

1. `002a-operator-shell.md` — shared Sidebar 기반 라우트 셸과 FHD 레이아웃
2. `002b-operator-i18n-theme.md` — UI 사전, 언어 저장, light/dark theme
3. `002c-operator-settings.md` — provider/API key 저장 API와 Settings 화면
4. `002d-operator-broadcast.md` — 세션 lifecycle, WebSocket 전사, 참여자 수, 다운로드

각 하위 티켓은 독립적으로 리뷰하고 별도 커밋한다. 부모 티켓은 하위 티켓 전체의 통합 검증만 담당한다.
