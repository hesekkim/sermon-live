# 008 OpenAI 및 Translation Session end-to-end 검증

상태: 대기

## Goal

OpenAI interpreter를 사용하는 Translation Session의 전체 start/stop 사이클, 마지막 문장 flush, 오류 케이스를 검증한다. Server와 AudioCapture가 계속 실행되는 동안 Translation Session만 켜고 끄는 흐름을 기준으로 한다.

## Why

adapter 단위 테스트만으로는 실제 운영 lifecycle(Translation Session 시작-오디오 스트리밍-정지)이 보장되지 않는다.

## Related files

- `backend/tests/unit/test_session_events.py`
- 필요 시 신규 e2e-ish unit test 파일

## Dependencies

007

## Implementation notes

- mock OpenAI adapter(또는 mock WebSocket)로 Translation Session start → 오디오 청크 여러 개 전송 → stop 순서를 시뮬레이션.
- Server ONLINE 및 AudioCapture 실행 상태와 Translation LIVE/OFF 상태가 독립적으로 유지되는지 확인.
- stop() 호출 시 마지막 자막/오디오 이벤트가 브로드캐스트된 후 세션이 종료되는지 확인.
- 키 누락/유효하지 않은 키로 start() 시도 시 명확한 에러가 반환되는지 확인 (기존 gemini 케이스와 동일 패턴).
- 장치 미사용 가능, interpreter 오류, 세션 중복 시작 시 상태와 오류가 일관되게 전달되는지 확인.
- 실사용 검증은 노트북 마이크로 수동 e2e 진행 (자동화 테스트 범위 아님, testing-strategy 규칙에 따라 유료 API 실호출은 테스트에 넣지 않음).

## Acceptance criteria

- 자동화 테스트는 전부 mock 기반으로 그린.
- 수동 e2e 체크리스트(시작→한국어 발화→독일어 자막/오디오→정지→마지막 문장 확인)를 티켓 완료 기준에 포함.
- 외부 OpenAI 실호출은 자동화 테스트에 포함하지 않으며, 실제 확인은 별도 수동 절차로 기록한다.

## Tests

- `test_session_events.py`에 openai 케이스 추가 (mock).

## Risks

- 수동 e2e는 자동화되지 않으므로 완료 처리 전 실제 확인 필요.
