---
description: React UI와 로직 분리, custom hook 중심
globs: frontend/**/*.{ts,tsx}
alwaysApply: true
---

# React

- UI(component)와 로직을 분리한다
- WebSocket, AudioContext, 재생 큐는 custom hook으로 뺀다
- custom hook은 해당 component 옆에 둔다
- presentational component는 가능한 한 props로만 그린다
- `useEffect`는 subscription, DOM 동기화처럼 필요한 side effect에만 쓰고, 가능하면 custom hook 안에 둔다
- 컴포넌트/훅 전용 타입은 그 파일에 둔다. 2곳 이상에서 쓰는 타입만 `shared/types`로 올린다

## Unit test

- 위치: `frontend/tests/unit/`
- 도구: Vitest
- 테스트 대상: PCM 유틸, 중요한 상태 전환
- 테스트하지 않는 것: 레이아웃, 스타일, snapshot
