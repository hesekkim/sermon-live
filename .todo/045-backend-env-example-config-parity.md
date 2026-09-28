# 045 Backend 환경변수 예제와 Config 정합성

상태: 대기
우선순위: 낮음

## Goal

`backend/.env.example`이 현재 `Settings`에서 지원하고 실제 실행 경로가 소비하는 환경변수를 정확히 안내하도록 정리한다.

## Why

환경변수 예제가 config 필드와 달라지면 배포 설정을 잘못 구성하거나, 더 이상 지원하지 않는 값을 계속 설정할 수 있다. 새 설치에서는 비밀값과 선택 옵션의 역할 및 기본값을 구분해 이해할 수 있어야 한다.

## Related files

- `backend/.env.example`
- `backend/core/config.py`
- `backend/tests/unit/test_config.py`
- `README.md`
- `docs/audio-test.md` (환경변수 안내가 현재 config와 불일치하는 경우에만)

## Dependencies

- 없음

## Implementation notes

- `Settings`의 `APP_` prefix 규칙과 `.env.example`의 모든 활성/주석 환경변수를 대조한다. 변수 사용 여부는 선언뿐 아니라 실제 consumer까지 확인한다.
- 현재 예제에 있는 `APP_HOST`, `APP_PORT`, `APP_DEBUG`, `APP_INTERPRETER`, `APP_ALLOWED_ORIGINS`, Operator 인증 비밀값, `APP_OPENAI_API_KEY`, audio device/chunk/sample rate, translation queue/drain timeout은 실제 사용 중이므로 유지한다.
- `Settings`에는 있지만 예제에 없는 설정 옵션을 기본값 및 간결한 용도와 함께 추가한다:
  - `APP_APP_NAME=sermon-live`
  - `APP_OPENAI_MODEL=gpt-realtime-translate`
  - `APP_TRANSLATION_TARGET_LANGUAGE=de`
  - `APP_TRANSLATION_SOURCE_TRANSCRIPTION_MODEL=gpt-realtime-whisper`
  - `APP_TRANSLATION_SESSION_AUTO_STOP_MINUTES=90`
  - `APP_TRANSLATION_SESSION_WARNING_MINUTES=5`
  - `APP_TRANSLATION_SESSION_EXTENSION_MINUTES=10`
  - `APP_TRANSLATION_SESSION_HARD_LIMIT_MINUTES=120`
  - `APP_FRONTEND_DIST=` (비어 있으면 config의 기본 frontend dist 경로 사용)
- `APP_APP_NAME`은 `app_name` 필드에 `APP_` prefix가 붙은 실제 변수명이다. 다른 이름으로 바꾸거나 alias를 추가하지 않는다.
- config에 정의되지 않고 소비되지도 않는 예제 변수가 발견되면 제거한다. 단순히 optional/defaulted라는 이유만으로 유효한 설정을 제거하지 않는다.
- `APP_AUDIO_DEVICE`처럼 유효하지만 선택적인 항목은 주석 처리 상태를 유지할 수 있다. 비밀값은 계속 빈 placeholder로 두며 실제 key/password/secret을 추가하지 않는다.
- 현재 Settings에 없는 legacy audio target format 변수는 예제에 추가하지 않는다. 관련 문서가 여전히 활성 설정으로 오해하게 만드는 경우에만 해당 문구를 갱신한다.
- 감사 결과 현재 `Settings`에 빠진 config 필드는 확인되지 않았다. 따라서 config runtime 동작을 불필요하게 바꾸지 말고, 누락된 예제 항목을 보충한다. 조사 중 실제 runtime 설정 누락을 발견할 경우에만 별도 필드/validator 변경을 이 티켓 범위에서 최소 추가한다.

## Acceptance criteria

- 모든 유효한 `Settings` 환경변수가 예제에 있거나 코드 기본값만 사용하는 내부 옵션이라는 점이 명확하다. 사용자 운영자가 조정 가능한 설정은 예제에서 찾을 수 있다.
- 예제의 각 환경변수는 `APP_` prefix를 적용한 실제 Settings field에 대응하며, 오탈자나 존재하지 않는 legacy 변수는 남지 않는다.
- 현재 활성화된 유효 변수와 비밀값 생성 안내는 보존된다.
- 모델, target language, session timer 기본값은 `Settings` 및 기존 정책과 동일하다.
- `Settings` 기본값, timer 범위 검증, queue/drain 검증, 허용 origin parsing이 변경 없이 통과한다.
- 예제 및 테스트에 실제 API key, password, session secret이 포함되지 않는다.

## Tests

- `backend`에서 `pytest tests/unit/test_config.py` 실행.
- 테스트가 예제의 변수명/기본값을 직접 검증하도록 확장할 경우 `_env_file`에 `.env.example`을 명시해 실행하고, process environment 및 개발자 로컬 `.env`에 의존하지 않게 한다.
- 모든 예제 변수가 `Settings`에 대응하는지와 제거 대상의 consumer가 없는지는 코드/config 검색으로 확인한다.

## Risks

- Pydantic Settings는 비어 있는 secret 및 선택 필드의 parsing에 영향을 받을 수 있다. `.env.example` 전체를 테스트 입력으로 사용할 경우 secret가 `None`/빈 값으로 처리되는 계약을 확인하고 실제 비밀값은 넣지 않는다.
- 모델명은 provider가 지원하는 공식 모델과 동기화되어야 한다. 이 티켓에서는 현재 config 기본값을 문서화하며 모델 기능/호출 구현은 변경하지 않는다.
