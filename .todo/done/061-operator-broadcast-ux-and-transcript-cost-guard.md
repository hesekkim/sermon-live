# 061 Operator Broadcast 로딩 UX와 원문 transcript 비용 차단

상태: 완료
우선순위: 높음 (방송 운영 흐름 및 불필요한 API 사용 방지)

## Goal

Operator Broadcast에서 새 번역 자막이 도착하면 각 transcript pane이 최신 줄을 따라가게 한다. 설정 저장과 방송 시작 중 진행 상태를 명확히 보여준다. 추가 API 사용량을 일으킬 수 있는 Korean source transcript 기능은 Settings UI, API, runtime 전체에서 사용할 수 없게 한다.

## Why

Broadcast의 자막 영역은 pane 내부에 스크롤이 생겨도 Listen과 달리 최신 자막을 자동으로 보여주지 않았다. Settings 저장과 broadcast start 요청은 수 초 걸릴 수 있지만 기다리는 동안 진행 표시가 부족했다. Korean source transcript는 번역에 필수적이지 않고 추가 API 사용량이 발생할 수 있어 잘못 활성화될 경우 불필요한 비용이 발생할 수 있다.

## Related files

- `frontend/src/pages/Operator/broadcast/components/TranscriptPane.tsx`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastToggle.ts`
- `frontend/src/pages/Operator/layout/OperatorLayout.tsx`
- `frontend/src/pages/Operator/layout/OperatorLayout.module.css`
- `frontend/src/pages/Operator/settings/Settings.tsx`
- `frontend/src/pages/Operator/settings/Settings.module.css`
- `frontend/src/pages/Operator/settings/components/InterpreterSection.tsx`
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`
- `frontend/src/pages/Operator/translations.ts`
- `frontend/src/shared/components/LoadingSpinner/LoadingSpinner.tsx`
- `frontend/src/shared/components/LoadingSpinner/LoadingSpinner.module.css`
- `frontend/tests/unit/TranscriptPane.test.tsx`
- `frontend/tests/unit/OperatorPrefs.test.tsx`
- `frontend/tests/unit/useBroadcastToggle.test.tsx`
- `frontend/tests/unit/operatorNavigation.test.tsx`
- `backend/core/config.py`
- `backend/api/v1/endpoints/operator.py`
- `backend/services/operator_store.py`
- `backend/services/session_service.py`
- `backend/services/interpreters/openai_realtime.py`
- 관련 Backend unit tests

## Decisions

- Broadcast 전체 페이지가 아니라 실제 overflow가 발생하는 각 TranscriptPane 내부를 최신 transcript까지 자동 스크롤한다.
- 설정 저장은 기존 `isSaving`을 사용해 Apply 버튼 내부에 작은 spinner와 저장 중 문구를 표시한다. 저장 중 버튼은 비활성화하고 `aria-busy`를 제공한다.
- 방송 시작은 기존 broadcast toggle pending 상태로 화면 중앙에 비차단 시각 오버레이를 표시한다. spinner 위, 진행 문구 아래의 2줄로 배치하며, 시작 전 transcript 확인 대화상자를 기다리는 동안에는 시작 spinner를 표시하지 않는다.
- 공용 LoadingSpinner가 현재 저장소에 없으므로 CSS animation 기반 shared component를 추가한다. 장식용 spinner는 보조기술에서 숨기고, 상위 status와 busy state에서 안내한다.
- Korean source transcript checkbox는 항상 꺼진 disabled 상태로 표시하고 Settings 요청 payload에서 필드를 제거한다.
- 사용자가 선택한 백엔드 정책에 따라 PUT body에 `input_transcript_enabled: true`가 있으면 422를 반환한다. `false` 또는 미전송은 허용한다.
- legacy settings JSON, 환경 설정 등에서 남은 과거 true 설정은 runtime 및 public status에서 항상 무시한다. 설정을 다시 저장할 때 legacy 필드를 파일에서 제거한다.
- OpenAI Realtime adapter는 input transcription 설정을 더 이상 보낼 수 없도록 한다. 통역 output 언어 및 나머지 translation 기능은 유지한다.
- API 문구는 한국어·영어·독일어로 제공한다.

## Scope

### Broadcast transcript

- 각 pane의 `lines`가 변경되면 pane의 내부 scroll container를 `scrollHeight`까지 이동한다.
- Output pane과 Input pane이 렌더링되는 경우 두 pane을 독립적으로 동기화한다.
- transcript 다운로드, 기존 빈 상태, 문장 강조 표시를 유지한다.

### Settings save loading

- Safety 및 API Model Apply 요청에서 spinner와 현지화된 저장 중 문구를 표시한다.
- spinner는 Button의 `icon` slot으로 전달해 기존 icon-label spacing을 재사용한다.
- 저장 도중 중복 Apply를 막고 `aria-busy` 상태를 노출한다.
- 저장 완료 또는 실패 시 진행 표시를 제거하며 기존 성공/오류 toast와 dirty state 동작을 유지한다.

### Broadcast start loading

- 시작 승인 및 기존 transcript 처리 이후 실제 start request를 시작할 때 overlay를 띄운다.
- 시작 성공, 예외, 세션 오류 등 기존 로직의 완료 경로에서 overlay를 해제한다.
- 오버레이는 진행 상태를 분명히 보여주되 화면을 modal dialog로 바꾸거나 별도 취소 흐름을 추가하지 않는다.
- 기존 power button의 중복 동작 방지와 세션 상태 처리를 유지한다.

### Korean source transcript disablement

- Settings에서 설정값을 읽거나 수정하는 hook state를 제거한다. 저장 요청에는 해당 필드를 보내지 않는다.
- API checkbox는 off이며 비활성화한다.
- backend config에서 기능 전용 model/enable flag를 제거한다.
- operator settings PUT의 true 입력은 상태 변경 전 422로 거부한다.
- operator settings public response와 session status는 transcript 설정을 항상 false로 반환한다.
- Operator store는 legacy true 값을 load/overlay하지 않고 이후 저장 시 JSON에서 제거한다.
- OpenAI adapter는 legacy/추가 입력값과 무관하게 input transcription을 구성하지 않는다.

## Out of Scope

- Listen 화면의 자동 스크롤 동작 또는 자막 표시 UX 변경.
- Translation output language, output transcript, Broadcast 다운로드·문장 누적 동작 변경.
- Backend interpreter 선택을 공용 파이프라인에 추가하거나 provider-specific 분기를 노출하는 일.
- 실제 OpenAI 호출, API key, 마이크 또는 외부 서비스 호출을 사용하는 테스트.
- 서버 시작 중 오버레이, 중지 동작의 시각 효과, broadcast start 취소 기능.

## Acceptance criteria

- [x] Broadcast transcript 줄이 추가되면 내부 pane이 최신 줄까지 자동 스크롤한다.
- [x] 설정 저장 중 두 Apply 버튼에 spinner와 저장 중 문구가 표시되고 중복 제출은 막힌다.
- [x] spinner와 설정 문구 사이 간격은 공통 Button의 icon-label spacing을 사용한다.
- [x] Broadcast 시작 요청 처리 중 중앙 overlay가 spinner와 문구를 2줄로 표시한다.
- [x] 시작 전 transcript 확인을 취소하면 spinner가 뜨지 않고 세션도 시작하지 않는다.
- [x] 시작 성공/실패 시 overlay pending 상태가 해제된다.
- [x] Korean source transcript checkbox는 unchecked 및 disabled다.
- [x] Settings UI는 transcript enable 값을 PUT payload로 보내지 않는다.
- [x] `input_transcript_enabled: true` 설정 API 요청은 422이며 변경을 저장하지 않는다.
- [x] legacy stored true 및 config 입력이 runtime, API 공개 응답, OpenAI payload에 영향을 주지 않는다.
- [x] output translation, 기존 session 시작/종료 및 settings 저장 동작은 유지된다.

## Tests

### Frontend

- `TranscriptPane.test.tsx`: lines 변경 후 pane 내부 scrollTop이 새 scrollHeight까지 이동하는지 확인.
- `OperatorPrefs.test.tsx`: 저장 중 Apply 비활성화, `aria-busy`, spinner 표시 및 완료 후 해제를 확인. API Model payload에 input transcript 필드가 없는지 확인.
- `useBroadcastToggle.test.tsx`: start 요청이 resolve되기 전 pending 표시, resolve 뒤 해제를 확인.
- `operatorNavigation.test.tsx`: settings 이동과 Broadcast transcript/status 흐름의 기존 동작 유지 확인.
- 명령: `cd frontend && npm test -- tests/unit/TranscriptPane.test.tsx tests/unit/OperatorPrefs.test.tsx tests/unit/useBroadcastToggle.test.tsx tests/unit/operatorNavigation.test.tsx`
- 빌드: `cd frontend && npm run build`

### Backend

- `test_operator_api.py`: true 입력은 422, 일반 설정과 false 값 처리는 정상인지 확인.
- `test_operator_store.py`: 과거 JSON true 값이 public view/runtime overlay에 반영되지 않고 이후 저장에서 제거되는지 확인.
- `test_session_lifecycle.py`: legacy config/store 설정에도 session status가 false인지 확인.
- `test_openai_realtime.py`: legacy transcription 관련 설정값이 있어도 OpenAI session.update에 input transcription이 포함되지 않는지 확인.
- `test_config.py`: 제거된 설정 필드가 유효 config에 존재하지 않는지 확인.
- 명령: `python -m pytest backend/tests/unit/test_config.py backend/tests/unit/test_operator_store.py backend/tests/unit/test_operator_api.py backend/tests/unit/test_openai_realtime.py backend/tests/unit/test_session_lifecycle.py`

## 구현 및 검증 결과

- `TranscriptPane`의 scroll container를 ref로 관리하고 lines 변경 시 `scrollTop = scrollHeight`로 최신 자막에 맞춘다.
- `isSaving`을 Safety/API Model Apply 버튼 모두에서 활용한다. `LoadingSpinner`를 Button `icon`으로 전달해 아이콘과 라벨 간 여백을 유지한다.
- shared `LoadingSpinner`와 Operator layout overlay 스타일을 추가했다. Overlay는 화면 중앙 카드에 spinner를 위쪽, 안내 문구를 아래쪽으로 배치한다.
- `useBroadcastToggle`에 시작 전용 pending 상태를 추가했다. 확인 대화상자 승인 후에만 켜지고, start 흐름의 `finally`에서 해제한다.
- 설정 UI state, API payload, config flag, input transcription model 설정을 제거했다. public settings/session status에는 false를 반환하고 legacy store true는 무시한다.
- true 설정 API 요청은 저장·상태 검사보다 먼저 422로 반환한다.
- 전체 저장소 테스트/외부 API 검증은 이 ticket에서 실행하지 않았다.
- 검증 통과:
  - Focused Backend unit tests: 72 passed
  - 관련 Frontend unit tests: 33 passed; spinner 및 최종 loading UX 반영 후 추가 실행한 관련 테스트 31 passed
  - `frontend` production build (`tsc -b && vite build`)
  - 변경 파일 diagnostics 및 `git diff --check`

## Manual verification

- [ ] 긴 입력/출력 transcript가 pane 내부에서 최신 줄을 따라가는지 확인한다.
- [ ] 실제 장치 선택 등 수 초 걸리는 설정 저장에서 버튼 spinner와 spacing을 확인한다.
- [ ] 실제 OpenAI start 시간을 사용하지 않고, 개발/수동 환경에서 중앙 overlay의 2줄 정렬, light/dark theme 대비 및 mobile viewport 배치를 확인한다.

## Risks

- 매 줄이 추가될 때 항상 아래로 스크롤하므로 운영자가 이전 transcript를 읽는 중에도 최신 줄로 이동한다. 요구된 Listen과 같은 자동 최신 추적 동작이며, 추후 사용자가 수동으로 위로 스크롤할 때 auto-follow를 일시 중단해야 한다는 피드백이 확인되면 별도 UX로 다룬다.
- legacy 설정 파일에 남은 `input_transcript_enabled` 키는 runtime에서 무시되고 다음 저장 때 제거된다. 별도 데이터 migration은 필요하지 않다.
- 시각적 브라우저 수동 확인은 수행하지 않았다. 정렬과 loading state는 단위 테스트 및 production build로 확인했다.
