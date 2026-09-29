# 049 미사용 Frontend 공용 컴포넌트 제거

상태: 완료

## Goal

Frontend에서 사용되지 않는 공용 컴포넌트와 전용 파일을 제거한다.

## Why

사용처가 없는 컴포넌트가 shared components에 남아 유지보수 범위와 탐색 비용을 늘린다.

## Related files

- `frontend/src/shared/components/Checkbox/`
- `frontend/src/shared/components/RatingTag/`
- `frontend/src/shared/components/SlideToggle/`
- `frontend/src/shared/components/TagSelector/`
- `frontend/src/shared/components/TocItem/`
- `frontend/tsconfig.app.json`
- `.todo/README.md`

## Implementation notes

- `Checkbox`와 내부 전용 `useCheckbox`를 포함해 위 다섯 폴더의 컴포넌트, hook, CSS module을 모두 제거했다.
- 삭제된 `RatingTag`를 가리키는 TypeScript 제외 설정도 제거했다.
- 앱과 테스트에서 사용되는 다른 공용 컴포넌트는 변경하지 않았다.
- Backend Sermon Session 코드는 범위에 포함하지 않았다.
- `SlideToggle`을 언급하는 완료/폐기 작업 문서는 과거 기록이므로 수정하지 않았다.

## Acceptance criteria

- 다섯 컴포넌트 그룹의 파일이 제거되고 앱/테스트에 해당 컴포넌트 참조가 남지 않는다.
- Backend 및 다른 frontend 코드는 변경하지 않는다.
- 완료 시 티켓을 `done/`으로 이동하고 README 완료 목록을 갱신한다.

## Tests

- `frontend`에서 `npm test`
- `frontend`에서 `npm run build`
- 완료 후 `frontend/src`와 `frontend/tests`에서 후보 심볼/경로를 검색한다.

## Risks

- 테스트나 빌드에서 참조가 발견되면 해당 참조를 살피고, 현재 사용처가 확인된 컴포넌트는 제거 대상에서 제외한다.

## Completion

- Frontend unit tests: 87 passed, 2 failed. 실패는 `liveFlow.test.tsx`의 Listener 상태 문구 기대와 `operatorNavigation.test.tsx`의 로그인 오류 selector 관련이며, 기존 테스트 실패로 이번 제거와 무관하다.
- `npm run build`: 성공.
- 후보 심볼/경로 검색: 남은 참조 없음.
- `git diff --check`: 성공.
