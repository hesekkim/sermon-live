# 062 Operator 설정 피드백과 세션 전환 로딩 UX

상태: 완료

## Goal

Operator 설정에서 장치 및 통역 설정의 현재 상태와 저장 결과를 분명히 전달하고, Translation Session 시작·중지 중에는 진행 상태를 보여준다. 잘못된 OpenAI 키의 provider 원문 오류가 사용자 화면에 노출되지 않게 한다.

## Scope and decisions

- API 설정을 불러오는 동안 Echo 기본값을 잠시 보여주지 않고, 로딩 상태와 spinner를 표시한다.
- 잘못된 API 키는 `StatusTag`의 `INVALID`로 표현한다. 공급자가 반환한 오류 원문이나 중복 문구는 설정 화면에 표시하지 않는다.
- 잘못된 키에 대한 일반 오류 문구를 서버 public settings 응답, session 시작 차단 사유, Operator 화면에서 안전하게 처리한다.
- `start_block_reason`의 영어 표준 사유는 `formatStartBlockReason`에서 현재 UI 언어로 변환한다. 이 helper는 HTTP session status와 WebSocket status 처리에 사용한다.
- Korean source transcript 옵션은 사용 불가 상태가 눈에 띄도록 disabled 스타일로 표시한다.
- 입력 장치/채널 저장 중 선택기를 비활성화하고, 바로 아래에 spinner와 저장 안내를 표시한다.
- 장치 또는 채널 설정 저장은 로컬 설정 파일을 기록하는 것 외에도 capability 검증과 오디오 런타임 재시작을 수행한다. 단, API 모델이나 키가 변경되지 않았다면 장치 설정 저장에서 API 키를 재검증하지 않는다.
- Translation Session 시작 및 중지 전환에 공통 전체 화면 spinner overlay와 현지화된 안내를 표시한다.
- 입력 채널 선택 UI는 Mixer 감지에 의존하지 않는다. 장치가 OS에 보고하는 `input_channels`가 2 이상일 때 표시하며, 단일 채널 장치에서는 숨긴다.

## Related files

- `backend/api/v1/endpoints/operator.py`
- `backend/services/key_validation.py`
- `backend/services/operator_store.py`
- `backend/services/session_service.py`
- `backend/tests/unit/test_key_validation.py`
- `backend/tests/unit/test_operator_api.py`
- `backend/tests/unit/test_operator_store.py`
- `backend/tests/unit/test_session_events.py`
- `frontend/src/pages/Operator/broadcast/Broadcast.module.css`
- `frontend/src/pages/Operator/broadcast/components/BroadcastHeader.tsx`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastSession.ts`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastToggle.ts`
- `frontend/src/pages/Operator/layout/OperatorLayout.tsx`
- `frontend/src/pages/Operator/settings/Settings.module.css`
- `frontend/src/pages/Operator/settings/Settings.tsx`
- `frontend/src/pages/Operator/settings/components/AudioDeviceSection.tsx`
- `frontend/src/pages/Operator/settings/components/InterpreterSection.tsx`
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`
- `frontend/src/pages/Operator/translations.ts`
- 관련 Frontend unit tests

## Acceptance criteria

- [x] 초기 설정 로딩 중 잘못된 기본 통역기가 잠시 노출되지 않는다.
- [x] Settings의 invalid API key 상태는 StatusTag로 표시되며 공급자 오류 원문은 노출되지 않는다.
- [x] Session 시작 차단 사유에 잘못된 키가 포함되더라도 일반 문구만 전달하고 현지화한다.
- [x] 입력 transcript 비활성 상태가 화면에 시각적으로 구분된다.
- [x] 입력 장치 및 채널 저장 중 spinner와 진행 문구가 표시되고 저장 완료 후 사라진다.
- [x] 장치 및 채널 저장만으로 불필요한 API key 검증 요청을 수행하지 않는다.
- [x] Session 시작과 중지 대기 동안 동일한 로딩 overlay가 표시된다.
- [x] 다국어 문자열과 기존 설정·방송 동작을 유지한다.

## Verification

- Backend operator API 테스트 — 13개 통과.
- Backend key validation, operator store, session event 테스트 — 19개 통과.
- Frontend settings, broadcast session, audio test 테스트 — 28개 통과.
- Frontend broadcast toggle 및 session 테스트 — 24개 통과.
- `npm run build` — 통과.
- `git diff --check` — 통과.
