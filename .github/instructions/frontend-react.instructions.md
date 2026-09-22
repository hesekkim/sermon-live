---
description: React UI와 로직 분리, custom hook 중심
applyTo: 'frontend/**/*.{ts,tsx}'
---

# React

- UI(component)와 로직을 분리한다
- fetch, 폼 상태, 권한, 파생 데이터 같은 화면 로직은 custom hook으로 뺀다
- WebSocket, AudioContext, 재생 큐는 custom hook으로 뺀다
- custom hook은 해당 component 옆에 둔다 (`ComponentName/useX.ts`)
- API 호출은 `shared/api`에 두고, hook이 그걸 사용한다
- 페이지 전용 API만 있으면 `pages/<Page>/api.ts`에 둬도 된다
- presentational component는 가능한 한 props로만 그린다
- `useEffect`는 구조를 강제하는 도구가 아니다. fetch, subscription, DOM 동기화처럼 필요한 side effect에만 쓰고, 가능하면 custom hook 안에 둔다
- 컴포넌트/훅 전용 타입은 그 파일에 둔다. 2곳 이상에서 쓰는 타입만 `shared/types`로 올린다
- form `onSubmit` 핸들러 타입은 `React.SubmitEvent`를 쓴다 (`FormEvent`는 React 19 types에서 deprecated)

## Dialog / Modal

- 확인·경고·폼 모달 등 **대화창이 필요하면** 반드시 공통 `Dialog` component를 사용한다
- `window.confirm` / `window.alert` / `window.prompt`를 쓰지 않는다
- overlay·헤더·닫기 버튼을 화면마다 새로 만들지 않는다. 내용은 `children` / `footer`로 구성한다
- 로그인처럼 도메인 전용 모달도 Dialog를 셸로 쓰고, 내부 폼·상태만 해당 컴포넌트/훅에 둔다

## Unit test

- 위치: `frontend/tests/unit/`
- 도구: Vitest, Testing Library
- 테스트 대상: custom hook, util, 중요한 상태 전환/폼 규칙
- 테스트하지 않는 것: 레이아웃 component, 스타일, 아이콘, 순수 마크업 component, snapshot 남발
