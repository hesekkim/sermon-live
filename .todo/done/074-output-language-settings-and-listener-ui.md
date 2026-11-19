# 074 출력 언어 설정과 Listener UI 언어 연동

상태: 완료
우선순위: 높음

## Goal

Operator Settings에서 통역 출력 언어를 영어 또는 독일어로 선택하고, 선택한 언어로 OpenAI Realtime Translation 출력을 설정한다. Listen 페이지의 UI 문구도 선택된 출력 언어로 표시한다.

## 결정 사항

- 출력 언어 선택지는 영어(`en`)와 독일어(`de`)로 제한한다.
- 새 설치 및 기존 설정에 값이 없을 때 기본값은 독일어(`de`)다.
- Listen UI 언어는 브라우저 언어가 아니라 저장된 출력 언어를 따른다. `en`이면 영어 UI, `de`이면 독일어 UI를 표시한다.
- Operator UI 언어 설정은 기존대로 독립적으로 유지한다.
- 기존 `.env`의 `APP_TRANSLATION_TARGET_LANGUAGE` 값은 이전하지 않는다. 이 변수가 남아 있어도 새 동작에 영향을 주지 않게 한다.
- 입력 언어 및 Operator의 한국어 source transcript 문구 하드코딩은 이 티켓의 범위에 포함하지 않고 075에서 별도로 다룬다. Listener UI 문구는 선택된 출력 언어에 일치시킨다.

## Current behavior

- 출력 언어는 `APP_TRANSLATION_TARGET_LANGUAGE` 설정값에서 읽히며 기본값은 `de`다.
- OpenAI adapter는 translation session의 `audio.output.language`에 해당 값을 전달한다.
- Operator Settings에는 출력 언어 선택 항목이 없고, Listener UI 번역은 독일어·영어·한국어 세 언어를 브라우저 언어에 따라 선택한다. 출력 언어와는 연동되지 않는다.
- 출력 transcript 제목 등 일부 문구는 German으로 고정되어 있다.

## Scope

- API Model Settings 탭에 `en` / `de` 선택 항목을 추가한다. 기존 공통 Select와 Operator 설정 저장 흐름을 사용한다.
- 출력 언어를 Operator 설정 API와 `operator.json`에 저장하고, backend runtime 설정 overlay를 통해 현재 translation session에 전달한다.
- 저장된 출력 언어를 OpenAI adapter의 `audio.output.language`에 설정한다.
- Settings 조회 응답에 출력 언어를 포함하고, 지원하지 않는 언어 코드의 저장 요청은 backend에서 거부한다.
- 현재 session status/WebSocket의 public status에 출력 언어 코드를 포함해 Listen이 선택값을 알 수 있게 한다. API key 등 비밀값은 추가 노출하지 않는다.
- Listen UI의 고정 독일어/브라우저 감지 선택을 출력 언어 기준으로 전환한다. Listener의 UI 문구는 영어 또는 독일어로 일관되게 표시한다.
- 출력 transcript의 제목과 언어명을 선택값과 일치시킨다.
- `APP_TRANSLATION_TARGET_LANGUAGE`를 `backend/.env.example` 및 환경변수로 읽는 backend 설정 경로에서 제거한다. backend 내부에는 저장된 값을 adapter에 전달하기 위한 runtime 표현을 유지한다.
- 기존 환경변수 값은 migration하지 않고 무시한다. 설정 저장소에 출력 언어가 없으면 `de`를 사용한다.
- Settings/API/adapter/Listener 관련 문서와 테스트를 갱신한다.
- 실행 중인 Translation Session에서 출력 언어를 바꾸지 못하게 기존 protected-setting 충돌 정책을 적용한다.

## Out of scope

- 입력 언어를 선택하거나 OpenAI에 입력 언어를 지정하는 기능
- 한국어 source transcript의 하드코딩 제거 또는 input transcript 기능 활성화 (075에서 별도 처리)
- 세 번째 이상의 출력 언어
- Listener UI 언어를 출력 언어와 별도로 선택하는 설정
- 성경 본문 번역 데이터 추가. 현재 독일어 Luther 1912 본문은 출력 언어와 별도로 유지되며, 영어 번역 제공은 별도 범위다.
- OpenAI API 실호출 또는 실제 API key를 사용하는 자동 테스트

## Implementation notes

- 통역 vendor 선택 분기는 `services/interpreters/factory.py`에만 둔다. SessionService, endpoint 및 frontend는 provider 이름을 기준으로 분기하지 않는다.
- `APP_TRANSLATION_TARGET_LANGUAGE`를 Pydantic Settings 필드로 계속 유지하면 환경변수 입력 경로가 살아 있을 수 있으므로, 저장소의 출력 언어와 env 설정 경로를 분리한다.
- Listener용 status 필드는 UI에서 필요한 언어 코드만 전달한다.
- Listen locale은 `en` / `de` 출력값으로 정한다. 출력 언어 설정이 바뀌면 기존 Listener에도 public session status를 broadcast한다.
- Operator에 남아 있는 한국어 input/source transcript 문구는 075에서 다룬다.
- OpenAI 공식 문서는 출력 언어 값을 문자열로 정의하고 전체 지원 언어 목록을 제공하지 않는다. 이 티켓은 확인된 영어·독일어만 노출하며 다른 언어 선택지는 추가하지 않는다.
- 영어 출력 중에도 Bible reference popup의 본문은 현재 독일어 corpus를 사용한다. UI 언어 전환이 해당 콘텐츠를 영어로 번역한다고 표시하지 않는다.

## Acceptance criteria

- [x] Operator Settings에서 `English`와 `German`만 선택할 수 있고 기본값은 `German`이다.
- [x] 출력 언어는 Operator 설정으로 저장되고 페이지 재접속 및 backend 재시작 후 유지된다.
- [x] API에서 `en`과 `de` 외의 언어 코드 저장을 거부한다.
- [x] 영어 선택 시 adapter가 OpenAI translation session에 `audio.output.language: "en"`을 전달하고, 독일어 선택 시 `"de"`를 전달한다.
- [x] Translation Session live 중에는 언어 변경이 거부되고 기존 선택값이 유지된다.
- [x] Listen은 출력 언어 `en`일 때 영어 UI, `de`일 때 독일어 UI를 표시하며 브라우저 기본 언어에 좌우되지 않는다.
- [x] Listen transcript 제목/언어명이 선택한 출력 언어와 일치한다.
- [x] Listener 상태 응답에 언어 코드 외의 민감 정보가 추가되지 않는다.
- [x] `APP_TRANSLATION_TARGET_LANGUAGE`가 `.env.example` 및 backend env 설정에 남지 않고, 기존 env 값이 설정값을 덮어쓰지 않는다.
- [x] 출력 언어가 저장되지 않은 기존 `operator.json`은 독일어 기본값으로 동작한다.
- [x] 한국어 input transcript 문구 정리 또는 input transcript 활성화가 이 티켓에 섞이지 않는다.

## 구현 및 검증 결과

- Backend 핵심 unit test 110개 통과. 최종 Operator API 테스트 재실행 결과 16개 통과.
- Frontend 관련 unit test 59개 통과, production build 성공.
- `git diff --check` 통과.
- Manual 체크리스트와 실제 OpenAI API 호출 검증은 수행하지 않았다.

## Tests and verification

### Backend unit

- Operator settings store의 `en` / `de` 저장, 조회, overlay, 미설정 기본값을 검증한다.
- Operator settings API의 허용값, 잘못된 언어 코드 거부, session live 중 변경 거부를 검증한다.
- OpenAI adapter mock test에서 `en` / `de` 값이 각각 `session.update` payload에 들어가는지 검증한다.
- session status/WebSocket에 출력 언어 코드가 포함되고 secret이 노출되지 않는지 검증한다.
- 실제 OpenAI API 및 API key는 테스트에서 사용하지 않는다.

### Frontend unit

- Settings에서 출력 언어 변경 후 Apply payload 및 저장 응답 반영을 검증한다.
- Listener가 `en` / `de` 출력 언어에 따라 올바른 locale의 UI 문구를 선택하는지 검증한다.
- 지원하지 않는 값이나 설정 로딩 실패를 기본 성공값으로 조용히 대체하지 않는지 검증한다.

### Manual

- [ ] Operator UI 언어와 출력 언어를 서로 다르게 설정해도 Operator UI 언어가 바뀌지 않는다.
- [ ] 출력 언어 각각에서 Listener 상태 문구, transcript 제목, 청취 시작/중단 등 주요 UI가 해당 언어로 표시된다.
- [ ] 기존 설정 데이터와 기존 `.env`에 target language가 있어도 migration 없이 독일어 기본값 또는 Operator 저장값이 적용된다.

