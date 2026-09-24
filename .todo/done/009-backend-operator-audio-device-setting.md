# 009 Operator 설정에 오디오 장치 저장

상태: 완료

## Goal

`GET/PUT /api/v1/operator/settings`에 `audio_device` 필드를 추가해 Operator가 선택한 입력 장치를 저장/조회할 수 있게 한다.

## Why

003에서 장치 목록을 조회할 수 있게 했으니, 선택한 장치를 다음 세션 시작 시 사용하도록 영속화해야 한다.

## Related files

- `backend/services/operator_store.py`
- `backend/api/v1/endpoints/operator.py`
- `backend/tests/unit/test_operator_store.py`, `backend/tests/unit/test_operator_api.py`

## Dependencies

003

## Implementation notes

- 기존 `operator.json` 오버레이 방식(JSON이 env보다 우선)과 동일하게 `audio_device` 필드를 추가.
- public_view()에 저장된 장치 index/name을 그대로 노출 (민감정보 아님, 마스킹 불필요).
- `AudioCapture`가 세션 시작 시 이 값을 `settings.audio_device`로 사용하도록 연결 (기존 오버레이 메커니즘 재사용).

## Acceptance criteria

- PUT으로 저장한 `audio_device`가 다음 세션 시작 시 실제로 사용된다.
- GET 응답에 현재 저장된 장치 정보가 포함된다.

## Tests

- 오버레이 우선순위(JSON > env) 회귀 테스트에 `audio_device` 케이스 추가.

## Risks

- 낮음. 기존 오버레이 패턴을 그대로 확장.
