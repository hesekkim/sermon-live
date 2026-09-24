# 002 OpenAI 설정 필드 추가

상태: 완료

## Goal

`core/config.py`에 OpenAI 모델명과 번역 엔진에 전달할 목표 오디오 포맷(24kHz/mono/PCM16) 설정을 추가한다.

## Why

이후 OpenAI adapter(007)와 AudioProcessor(005)가 참조할 고정 설정값이 필요하다.

## Related files

- `backend/core/config.py`
- `backend/tests/unit/test_config.py`

## Dependencies

001

## Implementation notes

- `openai_model: str = "gpt-realtime-translate"` 추가 (구현 시점에 007에서 재검증 예정이므로 주석으로 출처 표기).
- `translation_target_sample_rate: int = 24000`, `translation_target_channels: int = 1`, `translation_target_sample_width: int = 2` 추가.
- 기존 `output_sample_rate` 필드와 역할이 겹치면 하나로 통합하고 나머지 사용처를 갱신한다 (중복 설정 만들지 않기).

## Acceptance criteria

- `Settings()` 기본값으로 OpenAI 모델/타겟 포맷 필드에 접근 가능.
- 기존 `output_sample_rate` 관련 사용처와 충돌/중복 없음.

## Tests

- `test_config.py`에 신규 필드 기본값 확인 테스트 추가.

## Risks

- 낮음. 순수 설정 추가.
