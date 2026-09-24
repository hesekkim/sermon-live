# 001 Gemini 제거

상태: 대기

## Goal

Gemini Live 관련 코드/설정/UI를 저장소에서 전부 제거한다. `LiveInterpreter` protocol, factory 구조, echo/openai adapter는 유지한다.

## Why

최종 제품은 OpenAI만 사용한다. Git baseline tag로 Gemini 상태가 이미 보존되어 있으므로, 이후 모든 티켓에서 gemini 분기를 신경 쓸 필요 없이 echo/openai만 다루기 위해 가장 먼저 제거한다.

## Related files

- `backend/services/interpreters/gemini_live.py` (삭제)
- `backend/tests/unit/test_gemini_live.py` (삭제)
- `backend/services/interpreters/factory.py` (gemini 분기 제거)
- `backend/core/config.py` (`gemini_api_key`, `gemini_model`, `gemini_voice`, `turn_silence_ms` 제거)
- `backend/tests/unit/test_factory.py` (gemini 케이스 제거)
- `backend/services/operator_store.py` (gemini key 오버레이/마스킹 로직 제거)
- `backend/services/key_validation.py` (provider 이름 기반 검증 분기 제거)
- `backend/tests/unit/test_operator_store.py`, `backend/tests/unit/test_operator_api.py` (gemini 관련 테스트 제거)
- `backend/tests/unit/test_key_validation.py` (gemini 관련 테스트 제거 또는 protocol 기반 테스트로 대체)
- `frontend/src/pages/Operator/settings/Settings.tsx` (interpreter dropdown에서 gemini 옵션 제거)
- `frontend/src/pages/Operator/translations.ts` (`gemini` 라벨 제거)
- `frontend/src/pages/Operator/OperatorPrefs.tsx` (interpreter 타입에서 gemini 제거)

## Dependencies

없음. Git baseline tag가 안전망 역할을 하므로 바로 진행 가능.

## Implementation notes

- 삭제 전 git baseline tag가 실제로 존재하는지 `git tag` 로 확인한다.
- `interpreter: InterpreterName` 타입에서 `"gemini"` 리터럴을 제거하고 `"echo" | "openai"`만 남긴다.
- `APP_INTERPRETER=gemini` 같은 운영 설정과 예시(`.env`, `.env.example`, `operator.json`)를 정리한다.
- Git history, baseline tag, `.todo`의 역사적 계획 문서, `.pytest_cache`, `.venv`는 제거 범위에서 제외한다.
- `SessionService`와 `key_validation.py`에 남은 provider 이름 기반 런타임 분기를 제거한다. 키 검증은 adapter protocol 또는 factory가 제공하는 추상화로 수행한다.
- 현재 작업공간이나 Git history에 실제 API key가 있으면 구현 전에 폐기·재발급하고, 저장소 추적 여부를 확인한다.
- 프론트 타입에서 gemini를 제거하면 관련 TS 컴파일 에러가 연쇄적으로 드러나므로 타입부터 좁히고 나머지를 고친다.

## Acceptance criteria

- 운영 코드, 설정, 테스트, 프론트 UI에 Gemini 문자열이 남아있지 않다. Git history, baseline tag, 캐시, 가상환경, 역사적 계획 문서는 제외한다.
- `factory.py`가 echo/openai 두 값만 처리한다.
- 프론트 Settings 화면에 gemini 옵션이 보이지 않는다.
- `SessionService`와 `key_validation.py`가 provider 이름으로 런타임 동작을 분기하지 않는다.
- 노출된 API key가 폐기되었고 평문 secret이 테스트·로그·응답에 남지 않는다.

## Tests

- `cd backend; pytest` 전체 그린
- `cd frontend; npm run test` 전체 그린

## Risks

- 넓은 범위의 삭제라 컴파일/테스트 에러가 한 번에 많이 발생할 수 있음 — 타입 정리부터 순서대로 처리.
- API key가 외부에 노출된 경우 코드 변경보다 키 폐기·재발급을 먼저 완료한다.
