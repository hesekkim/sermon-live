# 039 Frontend Operator 로그인 흐름

상태: 대기
우선순위: 높음

## Goal

Operator route에 로그인 gate를 추가하고, 인증되지 않은 사용자는 Operator 기능을 열 수 없도록 한다. Listen route는 로그인 없이 계속 이용 가능하게 둔다.

## Why

Backend 인증 없이 route를 숨기는 것만으로는 보안이 되지 않지만, backend auth를 추가한 뒤에도 Operator에게 로그인/로그아웃 UX와 만료 세션 복구 흐름이 필요하다.

## Related files

- `frontend/src/App.tsx`
- `frontend/src/pages/Operator/layout/OperatorLayout.tsx`
- 신규 `frontend/src/pages/Operator/auth/OperatorLogin.tsx` 및 관련 hook/API module
- 필요 시 `frontend/src/shared/api/`의 인증 API
- `frontend/src/pages/Operator/translations.ts`
- `frontend/tests/unit/operatorNavigation.test.tsx`
- 신규 `frontend/tests/unit/operatorAuth.test.tsx`
- `backend/api/v1/endpoints/operator.py` 또는 auth endpoint (contract dependency)

## Dependencies

- `.todo/038-backend-operator-authentication.md`
- `.todo/036-frontend-operator-control-sidebar.md`

## Implementation notes

- `/listen`은 public route로 유지하고 `/operator/*`에서만 auth check를 한다.
- 초기 load 시 session-check endpoint를 호출해 pending/authenticated/unauthenticated 상태를 구분한다. 확인되기 전 Operator content를 flash-render 하지 않는다.
- 미인증 상태는 로그인 화면으로 보내고, 로그인 성공 시 사용자가 원래 진입하려던 Operator Broadcast 또는 Settings route로 이동한다. 외부 origin redirect는 허용하지 않는다.
- 로그인 요청은 same-origin cookie 기반으로 전송한다. password를 localStorage/sessionStorage, URL, console에 저장하지 않는다. 입력 draft는 로그인 성공/실패 후 정책에 따라 비우고 server cookie만 세션 증거로 사용한다.
- 보호 API가 401/403을 돌려주면 session 만료 상태를 반영하고 로그인 gate로 복귀한다. 기존 toast를 유지하되 민감한 backend 상세 오류는 그대로 노출하지 않는다.
- Logout action을 Operator shell의 상단 또는 Settings 영역에서 접근 가능하게 제공한다. 로그아웃은 backend cookie를 만료시키고 Listen 화면의 별도 동작에 영향을 주지 않는다.
- 라벨은 한국어/영어/독일어 translation table에 추가한다.

## Acceptance criteria

- `/listen`은 로그인하지 않아도 접근하고 WebSocket 청취를 시작할 수 있다.
- `/operator`, `/operator/broadcast`, `/operator/settings` direct entry는 인증 전 Operator 내용을 렌더링하지 않는다.
- 유효 자격 증명으로 로그인하면 요청한 Operator route로 이동한다.
- 잘못된 password와 세션 만료는 명확한 오류를 표시하고 password를 브라우저 저장소에 남기지 않는다.
- logout 후 Operator route 재진입은 다시 로그인 화면을 요구한다.
- 페이지 refresh 후 유효한 server session은 유지되고, 만료/invalid session은 gate로 돌아간다.

## Tests

- Auth hook unit tests: pending -> authenticated/unauthenticated, login failure, logout, expired session.
- Navigation tests: Listen public, Operator protected, post-login return route, logout 후 redirect.
- 실제 password를 fixture, test name, 로그에 쓰지 않는다.

## Risks

- Backend와 frontend가 서로 다른 cookie path/SameSite/Origin 가정을 하면 로그인은 성공해도 WebSocket 인증이 실패할 수 있다.
- Operator UI가 세션 상태를 여러 layout hook에서 중복 fetch하면 redirect loop가 생길 수 있으므로 auth state owner를 하나로 둔다.
- 이 ticket만으로 API가 보호되지는 않는다. 038 backend ticket이 배포 전에 반드시 완료되어야 한다.
