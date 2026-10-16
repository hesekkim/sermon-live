# 065 Operator 안전 설정 로딩 및 조회 지연

상태: 완료
우선순위: 중간 (잘못된 초기값 노출 및 설정 화면 대기)

## Goal

Operator Settings의 안전 설정 탭에서 서버 설정 응답 전에 기본 타이머 값이 노출되지 않도록 하고, 설정 조회는 OpenAI 네트워크 검증을 기다리지 않게 한다. 저장된 키가 나중에 revoke되는 경우를 확인할 수 있도록 OpenAI가 저장된 provider일 때 API Model 탭 진입 시 키를 다시 검증한다. 로딩·검증 상태와 오류를 명시적으로 표시하고 키 원문 및 provider 오류를 노출하지 않는다.

## Reported behavior

- 안전 설정 탭을 열면 auto stop 90분, warning 5분, extension 10분, hard limit 120분 같은 기본값이 먼저 보인다.
- 잠시 뒤 저장된 실제 설정값으로 바뀐다.
- 작은 설정 데이터 조회에 비해 화면 로딩이 길다고 보고됐다.
- 로딩 중에는 임시 기본값 입력 폼이 아니라 로딩 표시가 보여야 한다.
- 저장 시 유효했던 키가 이후 revoke되어도 설정 화면에는 마지막 검증 결과인 `valid`가 남을 수 있다.

## Prior work와 남은 문제

완료 티켓 `.todo/done/062-operator-settings-and-session-transition-ux.md`는 설정 로딩 중 Echo 기본값이 노출되지 않도록 spinner를 표시하고, invalid API key 상태를 안전하게 보여주며, 세션 전환·장치 저장 로딩 UX를 다뤘다. 이 티켓은 그 작업을 중복하지 않는다.

작업 전 확인된 결함:

- `frontend/src/pages/Operator/settings/Settings.tsx`의 `renderContent()`는 `activeTab === 'safety'`를 처리한 다음 공통 `settingsLoadStatus === 'loading'` 및 `error` 분기로 내려간다. 따라서 안전 탭은 로딩 상태와 무관하게 hook의 초기 timer draft를 입력 폼에 먼저 표시할 수 있다.
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`는 처음부터 timer 값에 기본값을 설정한다. 서버 설정 응답이 적용되기 전 해당 값은 확정된 사용자 설정이 아니다.
- `GET /api/v1/operator/settings`의 설정 조회와 키 검증이 결합되어 있어 OpenAI 네트워크 상태가 설정 화면 로딩에 영향을 줄 수 있다.
- 키 상태는 마지막 검증 결과이므로 저장 후 키가 revoke되어도 API Model 탭에서 다시 검증하지 않으면 오래된 `valid`가 남을 수 있다.
- 062에서 API 설정 로딩 spinner를 다뤘으나 안전 탭 분기 문제, GET의 동기 검증, 오래된 키 상태의 갱신 경로는 별도로 확인·검증하지 않았다.

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
- API key 입력/변경 시 기존 검증 및 오류 처리 계약을 보존한다. 추가로 `POST /api/v1/operator/settings/validate-key`를 두어 명시적인 재검증을 Settings GET과 분리한다.
- OpenAI가 저장된 provider일 때 API Model 탭 진입마다 검증 POST를 호출한다. Echo가 저장된 상태에서 OpenAI를 임시 선택한 것만으로 저장된 키를 검증하지 않는다.
- 검증 중에는 이전 `valid` 표시 대신 진행 상태를 보여준다. 네트워크/검증 실행 오류는 `invalid`로 오표시하지 않고 `unverified` 및 일반 안내로 처리한다.
- 동시 중복 검증 요청은 하나로 제한한다. 탭을 나갔다 다시 진입하면 새 검증을 수행한다.
- UI가 키 상태를 검증 시점의 결과로 설명하고, 실시간 유효성 보장으로 오해하지 않도록 한다.
- 기존 `validate_operator_key()`의 보안 처리와 status sanitization은 유지한다.

## Out of scope

- Safety timer 기본값 또는 유효성 규칙 변경.
- Operator settings 전체 화면 재설계.
- API key 원문 노출 또는 외부 오류 원문을 UI에 표시하는 일.
- 실제 OpenAI endpoint를 호출하는 자동 테스트.
- 설정 GET의 응답 속도를 특정 절대 시간으로 보장하는 benchmark 추가.
- audio device 목록 API의 탐색/로딩 동작 변경.

## Implementation notes

- 안전 탭은 별도 상태 로직을 복제하기보다 기존 `settingsLoadStatus` 및 공통 로딩 컴포넌트를 재사용한다.
- Settings GET은 로컬 설정만 반환하고, API key 또는 interpreter 변경 PUT의 검증 흐름은 유지한다. OpenAI가 저장된 provider일 때 API Model 탭에 진입하면 별도 검증 전용 POST로 키를 다시 확인한다.
- 검증 결과는 key status만 저장하고, status warning은 store의 안전한 표준 문구를 사용한다. provider 오류 원문은 응답에 포함하지 않는다.
- 네트워크 오류 또는 핸드셰이크 실패를 잘못된 자격 증명과 구분해 `unverified`로 반환한다.
- 명시적인 인증 거부만 `invalid`로 분류하고, 기타 연결·provider 오류는 `unverified`로 처리한다.
- 검증 완료 시 provider와 키가 검증 시작 시점과 동일한 경우에만 결과를 저장한다. 검증 중 API Model 설정 저장은 비활성화한다.
- Backend 외부 API는 mock해야 하며, 테스트·로그·fixture에 실제 API key를 사용하지 않는다.
- 사용자 문구가 추가되면 한국어/영어/독일어 번역을 함께 갱신한다.

## Acceptance criteria

- [x] 설정 응답이 지연되는 동안 안전 설정 탭에는 timer 기본값 입력 폼이 아니라 loading spinner/status가 표시된다.
- [x] 설정 응답 전에는 safety save가 활성화되거나 초기 timer draft를 사용해 저장되지 않는다.
- [x] 설정 로딩 실패 시 기본값 폼 대신 오류 상태가 보이고, 다른 탭의 기존 error UX가 유지된다.
- [x] 설정 응답이 완료된 뒤에는 서버의 실제 timer 설정이 표시되며 기존 validation, dirty state, save 동작이 보존된다.
- [x] OpenAI가 선택되어 있고 저장된 key가 있어도 `GET /api/v1/operator/settings`는 외부 OpenAI 연결/핸드셰이크 완료를 기다리지 않는다.
- [x] API key 또는 interpreter 변경 시 기존 검증 및 valid/invalid/missing status 업데이트 흐름이 유지된다.
- [x] OpenAI가 저장된 provider일 때 API Model 탭 진입마다 키를 다시 검증하고, 검증 중/네트워크 오류/invalid 상태를 구분한다.
- [x] 인증 거부만 키 `invalid`로 처리하며, 서버 오류·연결 실패·검증 중 키 교체는 잘못된 키 상태를 만들거나 덮어쓰지 않는다.
- [x] 키 검증이 진행 중일 때 API Model 설정 저장을 막는다.
- [x] OpenAI 대신 Echo가 저장된 경우, 탭에서 OpenAI를 임시 선택한 것만으로 저장된 키를 검증하지 않는다.
- [x] API Model 탭에서 나갔다 재진입하면 새 검증을 수행하고, 검증 요청이 진행 중이면 동시 중복 요청을 보내지 않는다.
- [x] GET 지연/검증 실패/네트워크 단절 시 API key 원문 및 provider 오류 원문이 사용자 응답이나 로그로 노출되지 않는다.
- [x] 외부 OpenAI 실호출 없이 frontend/backend unit test로 상태 전환과 validation 경계를 검증한다.

## Tests

### Frontend unit

- `frontend/tests/unit/OperatorPrefs.test.tsx`: Settings GET 응답을 pending으로 유지한 채 Safety 탭을 열고, spinner가 보이며 timer input 및 save action이 노출되지 않는지 확인한다.
- API Model 탭을 열고 재진입할 때 검증 전용 요청을 보내고 상태를 갱신하는지 확인한다.
- 검증 중 상태가 이전 `valid`를 숨기고, 검증 실패 시 `invalid`가 아닌 네트워크 확인 안내를 보이는지 확인한다.
- 응답을 resolve한 뒤 server timer 값이 표시되는지, reject/non-ok 응답에서는 loading 종료 후 error가 보이며 초기 기본값이 사용자 설정처럼 남지 않는지 확인한다.
- 기존 safety validation, 저장 payload 분리, API key status 관련 테스트를 유지한다.

### Backend unit

- `backend/tests/unit/test_operator_api.py`: OpenAI provider/key가 설정되어도 GET settings가 key validation을 대기/호출하지 않고 public settings를 반환하는지 검증한다.
- 검증 전용 POST가 key validator를 호출하고 key/provider 오류 원문을 응답하지 않는지 검증한다.
- 네트워크 예외는 key status를 `unverified`로 남기고 invalid로 처리하지 않는지 검증한다.
- OpenAI adapter의 인증 거부와 일반 연결/provider 오류가 각각 `invalid`와 `unverified`로 분류되는지, 오래된 검증 결과가 교체된 키 상태를 덮지 않는지 확인한다.
- API key 또는 interpreter 변경 PUT은 기존대로 `validate_operator_key()`를 호출하는지 확인한다.
- validation service/store 테스트에서 persisted key status와 public response sanitization이 유지되는지 확인한다.
- 네트워크 호출은 mock하며 실제 API key나 OpenAI endpoint를 사용하지 않는다.

### 코드리뷰 후속 보완 및 검증

- OpenAI 연결 단계의 HTTP 401 및 명시적인 인증 오류 코드만 `KeyValidationError`로 분류한다. 서버 오류, 잘못된 핸드셰이크, 연결 실패는 `unverified` 경로로 전달한다.
- 검증 결과를 저장하기 직전에 현재 저장된 provider와 API key를 다시 비교해, 키 교체 후 도착한 오래된 결과를 무시한다. UI에서도 검증 중에는 저장 버튼을 비활성화한다.
- 검증 완료: backend unit 46개, `frontend/tests/unit/OperatorPrefs.test.tsx` 17개 통과, frontend production build 성공.

## Risks

- API Model 탭 진입 시 외부 검증은 해당 화면이 열려 있는 동안의 사용자 대기를 유발할 수 있다. 설정 GET은 검증과 분리되어 다른 탭은 이 지연의 영향을 받지 않는다.
- 탭을 나갔다 다시 들어가면 최신 상태 확인을 위해 재검증한다. 중복 진입 요청은 진행 중 플래그로 합친다.
- initial timer defaults를 내부 fallback으로 그대로 보유하더라도 loading/error 렌더링이 폼을 숨기는지 테스트한다. 기본값을 없애기 위해 타입 안전성을 낮추거나 빈 값을 임의 변환하지 않는다.
