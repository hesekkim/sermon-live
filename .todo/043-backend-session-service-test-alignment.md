# 043 Backend SessionService 테스트 대상 정렬

상태: 대기
우선순위: 중간

## Goal

운영에서 실제 사용하는 `SessionService`를 session event/lifecycle 테스트가 대상으로 삼게 하고, 검증되지 않는 중복 Legacy 구현을 안전하게 정리한다.

## Why

`backend/services/runtime.py`는 `SessionService`를 사용하지만 `test_session_events.py`는 `LegacySessionService as SessionService`를 import한다. 이벤트 pump, audio conversion, 오류 처리 수정이 오래된 구현에 대해서만 검증되면 실제 사용 경로의 회귀를 막지 못한다.

## Related files

- `backend/services/session_service.py`
- `backend/services/runtime.py`
- `backend/tests/unit/test_session_events.py`
- `backend/tests/unit/test_session_lifecycle.py`
- `backend/tests/unit/conftest.py`

## Dependencies

- `.todo/040-backend-audio-format-negotiation.md`
- `.todo/042-disable-sermon-session-routes.md`

## Implementation notes

- `test_session_events.py`에서 `LegacySessionService` import를 없애고 활성 `SessionService` 테스트 fixture로 바꾼다.
- 기존 테스트가 직접 `_capture`, `_processor`, `_running` 같은 Legacy private field를 세팅하는 경우, `AudioRuntime`과 protocol interpreter fake를 주입해 public lifecycle (`start`, event pump, `stop`) 또는 활성 service의 좁은 unit boundary를 검증한다.
- `SessionService`의 중요한 계약은 interpreter event routing, audio/text broadcast, 종료 상태, 오류 처리, cancel/close sequence다. 기존 테스트 의도를 보존하고 단순 구현 복제 테스트는 추가하지 않는다.
- 활성 runtime에서 참조되지 않는 `LegacySessionService`는 전체 references와 test coverage를 확인한 뒤 제거한다. 사용자 데이터/실행 behavior가 아닌 중복 code 정리 범위다.
- 기존 `SessionService` 테스트가 이미 같은 동작을 검증하면 중복 case를 만들지 말고 합친다.

## Acceptance criteria

- session event/lifecycle 핵심 테스트가 모두 `services.runtime.session`과 동일한 `SessionService` 클래스를 검증한다.
- `LegacySessionService`를 import/reference하는 운영 코드 및 tests가 없다.
- Interpreter output audio/text/input transcript/error가 활성 `SessionService`를 통해 올바른 broadcast surface에 전달된다.
- manual/auto stop, interpreter error, device error 후 state/task/reference가 정리된다.
- 전체 backend unit suite가 통과한다.

## Tests

- `test_session_events.py`와 `test_session_lifecycle.py`의 핵심 event/lifecycle cases 실행.
- 전체 `pytest` 실행.
- repository search로 `LegacySessionService` references가 없음을 확인한다.

## Risks

- Legacy 구현 기반 테스트가 활성 구현에 없는 동작을 검증하고 있을 수 있으므로 테스트 제거 전 현재 기능 요구사항과 비교한다.
- session service lifecycle은 async task/lock 순서에 민감하다. fake를 단순화하되 task 종료와 queue sentinel을 건너뛰지 않는다.
