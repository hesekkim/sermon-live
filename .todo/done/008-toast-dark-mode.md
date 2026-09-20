# 008 Toast foundation + Dark Mode

상태: 완료

## 목표

앱에서 Toast를 사용할 수 있도록 provider를 연결하고, Light/Dark Mode 모두에서 Toast가 읽기 쉽고 접근 가능하게 표시되도록 한다.

## 구현 결과

- Operator 영역에 `ToastProvider`를 연결했다.
- Settings와 Broadcast 하위에서 `useToast`를 사용할 수 있는 context를 구성했다.
- Toast portal에 `cms-theme`를 적용하고 `html[data-theme]` CSS 변수와 연결했다.
- Light/Dark Mode의 info/warning/error Toast에 배경, 글자, border, icon 대비를 적용했다.
- 현재 UI 언어에 맞는 close label을 전달한다.
- 자동 dismiss와 수동 dismiss 동작을 유지했다.
- `role`, `aria-live`, `aria-atomic` 접근성 계약을 유지했다.
- 성공 메시지는 별도 variant를 추가하지 않고 `info` Toast를 재사용한다.

## 검증

- `frontend/tests/unit/Toast.test.tsx`에서 provider 연결, variant 렌더링, close label, 수동/자동 dismiss를 검증했다.
- Frontend unit test: 16개 통과
- `npm run build` 통과

## 후속 작업

Settings 저장 동작과 Broadcast lifecycle 메시지 연결은 각각 009, 010 티켓에서 처리한다.

## 커밋 경계

Toast provider 연결, Toast CSS와 관련 테스트만 포함한다.