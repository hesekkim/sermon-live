# 065 Operator 안전 설정 로딩 및 조회 지연

상태: 대기
우선순위: 중간 (잘못된 초기값 노출 및 설정 화면 대기)

## Goal

Operator Settings의 안전 설정 탭에서 서버 설정 응답 전에 기본 타이머 값이 잠시 나타나지 않도록 하고, 설정 파일 조회가 OpenAI API key 네트워크 검증을 기다리느라 지연되지 않도록 한다. 안전 설정 로딩 상태와 오류를 명시적으로 표시하면서 실제 저장값 및 기존 API key 상태 UX를 보존한다.

## Reported behavior

- 안전 설정 탭을 열면 auto stop 90분, warning 5분, extension 10분, hard limit 120분 같은 기본값이 먼저 보인다.
- 잠시 뒤 저장된 실제 설정값으로 바뀐다.
- 작은 설정 데이터 조회에 비해 화면 로딩이 길다고 보고됐다.
- 로딩 중에는 임시 기본값 입력 폼이 아니라 로딩 표시가 보여야 한다.

## Prior work와 남은 문제

완료 티켓 `.todo/done/062-operator-settings-and-session-transition-ux.md`는 설정 로딩 중 Echo 기본값이 노출되지 않도록 spinner를 표시하고, invalid API key 상태를 안전하게 보여주며, 세션 전환·장치 저장 로딩 UX를 다뤘다. 이 티켓은 그 작업을 중복하지 않는다.

현재 코드에서 확인된 남은 결함:

- `frontend/src/pages/Operator/settings/Settings.tsx`의 `renderContent()`는 `activeTab === 'safety'`를 처리한 다음 공통 `settingsLoadStatus === 'loading'` 및 `error` 분기로 내려간다. 따라서 안전 탭은 로딩 상태와 무관하게 hook의 초기 timer draft를 입력 폼에 먼저 표시할 수 있다.
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`는 처음부터 timer 값에 기본값을 설정한다. 서버 설정 응답이 적용되기 전 해당 값은 확정된 사용자 설정이 아니다.
- `backend/api/v1/endpoints/operator.py`의 `GET /api/v1/operator/settings`는 응답 직전에 `validate_operator_key()`를 기다린다. OpenAI가 선택되고 키가 있는 경우 이 함수는 외부 Translation endpoint 연결/핸드셰이크를 수행하므로 네트워크 시간과 가용성이 설정 조회 지연에 영향을 줄 수 있다.
- 062에서 이미 API 설정 로딩 spinner를 다뤘으나, 안전 탭 분기 문제와 GET에서 매번 외부 검증을 동기적으로 기다리는 문제는 별도로 확인·검증하지 않았다.

## Related files

- `frontend/src/pages/Operator/settings/Settings.tsx`
- `frontend/src/pages/Operator/settings/Settings.module.css`
- `frontend/src/pages/Operator/settings/components/SafetySection.tsx`
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`
- `frontend/src/pages/Operator/translations.ts`
- `frontend/tests/unit/OperatorPrefs.test.tsx`
- `backend/api/v1/endpoints/operator.py`
- `backend/services/key_validation.py`
- `backend/services/operator_store.py`
- `backend/tests/unit/test_operator_api.py`
- `backend/tests/unit/test_key_validation.py`
- `backend/tests/unit/test_operator_store.py`
- `.todo/done/062-operator-settings-and-session-transition-ux.md`

## Scope

### Frontend loading and error states

- 안전 탭 렌더링에서도 공통 settings load 상태를 최우선 적용한다.
- `settingsLoadStatus === 'loading'`일 때 실제 SafetySection 입력 폼과 적용 버튼 대신 기존 공용 `LoadingSpinner` 및 현지화된 status 문구를 표시한다.
- `settingsLoadStatus === 'error'`일 때 기본값이 설정값인 것처럼 노출되지 않도록 오류 안내를 표시한다.
- 서버 응답을 적용한 다음에만 저장된 timer 값을 표시하고, 로딩 종료 시 값이 기본값에서 실제 값으로 깜빡이며 바뀌지 않도록 한다.
- 로딩 중 Safety 저장/dirty 계산이 가능한 것처럼 동작하지 않게 한다.
- Settings의 Devices/API 탭에 이미 있는 loading/error 및 save 흐름은 보존한다.

### Backend settings read latency

- `GET /api/v1/operator/settings`의 빠른 로컬 설정 응답을 외부 OpenAI 네트워크 가용성에 종속시키지 않는다.
- key status는 Operator store의 현재 안전한 public 상태를 반환한다. 설정 조회 시 key를 매번 동기 검증하지 않는다.
- API key 입력/변경 시 기존 검증 및 오류 처리 계약을 보존한다. 실시간 재검증이 별도로 필요하다면 Settings 전체 응답과 분리된 명시적/비차단 경로로 수행하고, 무한히 중복 요청하지 않는다.
- 저장된 key status가 과거 검증 결과일 수 있으므로 상태의 의미와 갱신 시점을 확인해 UI에서 실시간 보장인 것처럼 표시하지 않는다.
- 기존 `validate_operator_key()`의 보안 처리와 status sanitization은 유지한다.

## Out of scope

- Safety timer 기본값 또는 유효성 규칙 변경.
- Operator settings 전체 화면 재설계.
- OpenAI key 검증 자체 제거, API key 노출, 외부 오류 원문을 UI에 표시하는 일.
- 실제 OpenAI endpoint를 호출하는 자동 테스트.
- 설정 GET의 응답 속도를 특정 절대 시간으로 보장하는 benchmark 추가.
- audio device 목록 API의 탐색/로딩 동작 변경.

## Implementation notes

- 안전 탭은 별도 상태 로직을 복제하기보다 기존 `settingsLoadStatus` 및 공통 로딩 컴포넌트를 재사용한다.
- Settings GET에서 key validation 호출 제거/분리를 선택할 경우 PUT에서 API key 또는 interpreter를 바꿀 때 수행되는 검증을 유지하는지 확인한다.
- key status가 저장된 값 또는 마지막 검증 상태라는 점을 반영한다. 네트워크 검증 실패를 `valid`로 바꾸는 success-shaped fallback은 금지한다.
- Backend 외부 API는 mock해야 하며, 테스트·로그·fixture에 실제 API key를 사용하지 않는다.
- 사용자 문구가 추가되면 한국어/영어/독일어 번역을 함께 갱신한다.

## Acceptance criteria

- [ ] 설정 응답이 지연되는 동안 안전 설정 탭에는 timer 기본값 입력 폼이 아니라 loading spinner/status가 표시된다.
- [ ] 설정 응답 전에는 safety save가 활성화되거나 초기 timer draft를 사용해 저장되지 않는다.
- [ ] 설정 로딩 실패 시 기본값 폼 대신 오류 상태가 보이고, 다른 탭의 기존 error UX가 유지된다.
- [ ] 설정 응답이 완료된 뒤에는 서버의 실제 timer 설정이 표시되며 기존 validation, dirty state, save 동작이 보존된다.
- [ ] OpenAI가 선택되어 있고 저장된 key가 있어도 `GET /api/v1/operator/settings`는 외부 OpenAI 연결/핸드셰이크 완료를 기다리지 않는다.
- [ ] API key 또는 interpreter 변경 시 기존 검증 및 valid/invalid/missing status 업데이트 흐름이 유지된다.
- [ ] Settings 화면은 key의 실시간 유효성을 검증하지 않은 상태를 잘못된 키 오류 또는 검증 완료 상태로 오표시하지 않는다.
- [ ] GET 지연/검증 실패/네트워크 단절 시 API key 원문 및 provider 오류 원문이 사용자 응답이나 로그로 노출되지 않는다.
- [ ] 외부 OpenAI 실호출 없이 frontend/backend unit test로 상태 전환과 validation 경계를 검증한다.

## Tests

### Frontend unit

- `frontend/tests/unit/OperatorPrefs.test.tsx`: Settings GET 응답을 pending으로 유지한 채 Safety 탭을 열고, spinner가 보이며 timer input 및 save action이 노출되지 않는지 확인한다.
- 응답을 resolve한 뒤 server timer 값이 표시되는지, reject/non-ok 응답에서는 loading 종료 후 error가 보이며 초기 기본값이 사용자 설정처럼 남지 않는지 확인한다.
- 기존 safety validation, 저장 payload 분리, API key status 관련 테스트를 유지한다.

### Backend unit

- `backend/tests/unit/test_operator_api.py`: OpenAI provider/key가 설정되어도 GET settings가 key validation을 대기/호출하지 않고 public settings를 반환하는지 검증한다.
- API key 또는 interpreter 변경 PUT은 기존대로 `validate_operator_key()`를 호출하는지 확인한다.
- validation service/store 테스트에서 persisted key status와 public response sanitization이 유지되는지 확인한다.
- 네트워크 호출은 mock하며 실제 API key나 OpenAI endpoint를 사용하지 않는다.

## Risks

- GET 요청의 동기 검증을 제거하면 key status는 마지막 검증 결과일 수 있다. UI/문서가 이를 실시간 상태로 보장한다고 암시하지 않는지 확인한다.
- initial timer defaults를 내부 fallback으로 그대로 보유하더라도 loading/error 렌더링이 폼을 숨기는지 테스트한다. 기본값을 없애기 위해 타입 안전성을 낮추거나 빈 값을 임의 변환하지 않는다.
