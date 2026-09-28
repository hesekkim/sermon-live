# 042 Sermon Session API와 Operator 진입 경로 비활성화

상태: 완료
우선순위: 중간

## Goal

Sermon Session 기능 파일과 데이터를 삭제하지 않고, 현재 앱에서 해당 API와 Operator 화면을 더 이상 활성 기능으로 포함하지 않는다.

## Why

현재 Sermon Session router는 API에 등록되어 있고, Operator navigation과 `/operator/sermon-session` route도 접근 가능하다. 하지만 사용자는 현재 제품에서 해당 기능을 포함하지 않기로 했다. 기존 기능 코드를 보존하면서 실수로 접근/부분 사용되지 않도록 등록 지점과 session lifecycle 연결을 비활성화한다.

## Related files

- `backend/api/v1/api.py`
- `backend/api/v1/endpoints/sermon_session.py` (파일은 보존)
- `backend/services/sermon_session.py` (파일은 보존)
- `backend/services/session_service.py`
- `frontend/src/App.tsx`
- `frontend/src/pages/Operator/layout/OperatorLayout.tsx`
- `frontend/src/pages/Operator/sermon-session/` (파일은 보존)
- `frontend/src/pages/Operator/translations.ts`
- `frontend/tests/unit/operatorNavigation.test.tsx`
- `backend/tests/unit/test_sermon_session.py` (store unit test는 보존 가능)
- `backend/tests/unit/test_operator_api.py` 또는 app route 테스트

## Dependencies

- `.todo/036-frontend-operator-control-sidebar.md`
- `.todo/done/015-backend-sermon-session-model.md`
- `.todo/done/016-frontend-sermon-session-ui.md`
- `.todo/019-backend-glossary-model.md` 및 hold된 context ticket과 독립적으로 적용

## Implementation notes

- `api/v1/api.py`에서 `sermon_session_router` include를 제거한다. Store/service implementation은 이 ticket에서 삭제하지 않는다.
- OperatorLayout의 Sermon Session navigation item을 제거한다.
- `App.tsx`의 `/operator/sermon-session` route를 비활성화한다. direct URL 진입 시 빈 화면이 되지 않도록 Broadcast로 redirect한다.
- 활성 `SessionService`에서 sermon store dependency, `sermon_session_id` 상태 필드와 API start payload 연계를 제거한다. Sermon data가 OpenAI session context로 사용되는 것처럼 보이면 안 된다.
- 관련 frontend page, hook, backend endpoint, store 소스는 workspace에서 보존하되 앱 router/route에서 reachable하지 않게 한다. 이 상태가 의도된 비활성화임을 파일/티켓/README에서 추적한다.
- 기존 Sermon Session store unit tests를 무조건 삭제하지 않는다. 앱에서 노출되지 않는 순수 store 동작 테스트로 가치가 있는지 확인해 유지 여부를 판단한다.
- `.todo/README.md` 결정사항을 현재 route 구조와 일치시킨다.

## Acceptance criteria

- FastAPI app에 `/api/v1/sermon-session` GET/PUT route가 등록되지 않는다.
- UI에 Sermon Session 메뉴가 없고 `/operator/sermon-session` direct access는 Broadcast로 redirect한다.
- 활성 session status/API/Frontend가 sermon ID나 sermon field를 운영 데이터로 표시하지 않는다.
- 기존 sermon-session 소스 파일과 JSON 데이터는 삭제되지 않는다.
- Listen, Broadcast start/stop, Settings 및 Operator auth 흐름은 영향받지 않는다.

## Tests

- App route test에서 `/operator/sermon-session` 접근 시 Broadcast redirect를 확인한다.
- FastAPI route test에서 Sermon Session endpoint가 등록되지 않았음을 확인한다.
- `operatorNavigation.test.tsx`에서 Sermon nav가 없고 Broadcast/Settings 접근이 유지되는지 확인한다.
- Session lifecycle test에서 sermon store mock/ID 의존 없이 정상 start/stop을 확인한다.

## Risks

- 별도 branch/function/file은 보존하지만 router에서 제외하면 API 기능은 운영 앱에서 사용할 수 없다. 재활성화 시 auth 보호를 포함해 다시 등록해야 한다.
- README/.todo 기존 결정사항이 Sermon 메뉴를 노출한다고 적혀 있을 수 있으므로 구현 후 현재 정책으로 갱신해야 한다.
- Hold 상태의 Sermon context/glossary 기능과 혼동해 제거하지 않는다. 이번 작업은 runtime injection 기능 구현이나 데이터 삭제가 아니다.