# 043 Backend SessionService 테스트 대상 정렬

상태: 완료
우선순위: 중간

## Goal

운영에서 실제 사용하는 `SessionService`를 session event/lifecycle 테스트가 대상으로 삼게 하고, 검증되지 않는 중복 Legacy 구현을 안전하게 정리한다.

## Why

`backend/services/runtime.py`가 사용하는 활성 `SessionService`와 session event/lifecycle 테스트 대상이 일치하지 않았다. 이벤트 pump와 오류 처리 수정이 이전 구현에 대해서만 검증되면 실제 사용 경로의 회귀를 막지 못한다.

## Related files

- `backend/services/session_service.py`
- `backend/services/runtime.py`
- `backend/tests/unit/test_session_events.py`
- `backend/tests/unit/test_session_lifecycle.py`
- `backend/tests/unit/conftest.py`

## Dependencies

- `.todo/040-backend-audio-format-negotiation.md`
- `.todo/042-disable-sermon-session-routes.md`

## 완료 내용

- `test_session_events.py`는 활성 `SessionService`와 `services.runtime.session`의 동일한 클래스를 사용한다. protocol interpreter fake를 이용해 audio, input/output transcript, latency 및 listener broadcast를 검증한다.
- `test_session_lifecycle.py`는 `start`/`stop`, 자동 종료, interpreter/device 오류 및 정리 동작을 활성 구현에서 검증한다.
- 운영 코드와 테스트에서 참조되지 않는 이전 Legacy 구현 및 중복 테스트를 제거했다. 오디오 변환 및 capture/runtime 동작은 기존 `AudioProcessor`/`AudioRuntime` 단위 테스트에서 검증한다.
- 리뷰에서 event loop 시간에 의존하는 latency 테스트의 고정 상한을 제거해 느린 CI에서의 불필요한 실패 가능성을 줄였다.

## Acceptance criteria

- [x] session event/lifecycle 테스트가 `services.runtime.session`과 동일한 `SessionService` 클래스를 검증한다.
- [x] 이전 Legacy 구현의 운영 코드 및 테스트 참조가 없다.
- [x] Interpreter output audio/text/input transcript/error가 활성 service의 올바른 broadcast surface로 전달된다.
- [x] manual/auto stop, interpreter error, device error 후 state/task/reference가 정리된다.
- [x] 전체 backend unit suite가 통과한다.

## Tests

- `pytest tests/unit/test_session_events.py tests/unit/test_session_lifecycle.py -q`: 19 passed.
- `pytest tests/unit -q`: 108 passed.
- backend Python 파일 검색에서 이전 Legacy 구현 이름의 참조가 없음을 확인했다.

## 잔여 위험

- lifecycle은 async task/lock 순서에 민감하다. 관련 테스트는 queue sentinel 처리와 task 종료까지 확인한다.
