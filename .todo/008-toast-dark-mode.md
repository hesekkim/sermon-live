# 008 Toast foundation + Dark Mode

상태: 대기

## 목표

앱에서 Toast를 사용할 수 있도록 provider를 연결하고, Light/Dark Mode 모두에서 Toast가 읽기 쉽고 접근 가능하게 표시되도록 한다.

## 구현 범위

- `ToastProvider`를 앱 최상위 또는 Operator 영역에 연결
- `useToast`를 Settings와 Broadcast에서 사용할 수 있도록 구성
- Toast portal의 `cms-theme`와 `html[data-theme]` CSS 변수 연결 확인
- Dark Mode에서 info/warning/error Toast의 배경, 글자, border, icon 대비 보정
- 현재 UI 언어에 맞는 Toast close label 전달
- 자동 dismiss와 수동 dismiss 동작 유지
- `role`, `aria-live`, `aria-atomic` 접근성 계약 유지

## 수용 기준

- Operator 화면에서 `useToast` 호출 시 runtime 오류가 발생하지 않는다.
- Light/Dark Mode에서 Toast의 메시지와 닫기 버튼을 읽을 수 있다.
- Toast가 다른 화면 요소보다 위에 표시되고 모바일 폭에서도 잘리지 않는다.
- 성공/정보/경고/실패 Toast가 구분되어 표시된다.
- 자동 dismiss와 닫기 버튼이 정상 동작한다.

## 검증

- Toast provider/store frontend unit test
- Dark Mode CSS 변수와 class 적용 테스트
- Light/Dark Mode 수동 시각 확인

## 커밋 경계

Toast provider 연결, Toast CSS와 관련 테스트만 포함한다. Settings 저장 동작과 Broadcast 메시지 연결은 별도 티켓에서 처리한다.
