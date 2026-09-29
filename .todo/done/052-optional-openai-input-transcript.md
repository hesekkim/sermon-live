# 052 선택형 OpenAI 입력 transcript

상태: 완료
우선순위: 중간

## Goal

OpenAI Realtime translation의 input transcription을 기본 비활성화하고, Operator가 Settings의 API Model 탭에서 선택적으로 켜고 끌 수 있게 한다. 비활성화 상태에서는 OpenAI transcription 설정을 보내지 않고 Broadcast의 한국어 input TranscriptPane을 표시하지 않는다. German output transcript/audio 흐름은 유지한다.

## Why

OpenAI translation은 입력 음성을 직접 번역하므로 별도 input transcript를 켠다고 번역 품질이 향상된다고 단정할 수 없다. 이 기능은 Operator가 한국어 원문 transcript를 확인·다운로드하려는 경우에만 필요하며 추가 API 사용량이 발생할 수 있다.

## Decisions

- `input_transcript_enabled` 기본값은 `false`다. Backend `.env`는 초기 기본값을 제공하고, Operator JSON store 설정이 이를 override한다.
- 운영 설정 위치는 Settings의 API Model 탭이다. 설정은 backend runtime에 저장하고 Operator session status에도 포함해 reconnect/polling 후 UI가 같은 값을 사용하게 한다.
- 설정은 API Model payload에만 포함한다. safety timer, device 저장 payload에서 값이 섞이거나 덮어써지면 안 된다.
- Translation session이 `starting`, `live`, `stopping`일 때는 변경을 거부한다.
- Provider별 session payload는 `OpenAIRealtimeInterpreter` adapter 안에서만 분기한다. `SessionService` 및 공용 audio/event pipeline은 OpenAI 이름을 검사하지 않는다.
- Input transcript off이면 Broadcast input TranscriptPane은 숨긴다. On이면 기존 desktop dual-pane breakpoint 동작을 유지하고, viewport가 좁을 때의 현재 숨김 UX도 유지한다.
- 실 API usage 차이 및 번역 품질 향상 여부는 자동 테스트로 단정하지 않고 `.todo/008-backend-openai-e2e-verify.md`의 수동 확인에서 기록한다.

## Implementation

### Backend

- `Settings`와 `backend/.env.example`에 `input_transcript_enabled` / `APP_INPUT_TRANSCRIPT_ENABLED=false`를 추가한다.
- `OperatorRecord` load/save, public view, environment overlay에 선택값을 추가한다. 기존 JSON 파일에 필드가 없어도 기본 false가 적용되어야 한다.
- Operator settings GET/PUT에 field를 추가하고 live session 보호 검사를 적용한다.
- Session status HTTP/WebSocket snapshot에 현재 적용값을 싣는다. `BroadcastHub`의 public Listen allowlist에는 input transcript 설정을 노출하지 않는다.
- Adapter는 true일 때만 `session.audio.input.transcription.model`을 보낸다. Output language 설정은 계속 보낸다.

### Frontend

- API Model 탭에 default-off checkbox/toggle을 제공한다. Korean/English/German 안내 문구에는 한국어 원문 표시 용도, 번역 품질 개선을 보장하지 않는 점, 추가 usage 가능성을 명시한다.
- API Model Apply 요청에만 boolean을 포함하고, 성공 시 Broadcast shell의 상태를 즉시 갱신한다. API status refresh/reconnect도 설정값을 복구한다.
- `Broadcast.tsx`에서 responsive `showInputPane`과 `input_transcript_enabled`를 함께 적용한다. Off에서는 pane 전체를 렌더링하지 않고 output pane은 유지한다.

## Acceptance criteria

- [x] 기본 config, 새 store, 기존 store 모두 input transcript off로 동작한다.
- [x] Settings API Model toggle 저장 후 GET/status에 설정값이 일관되게 반영된다.
- [x] API Model 외의 settings request는 input transcript draft를 제출하거나 덮어쓰지 않는다.
- [x] live/starting/stopping session 중 설정 변경은 거부되고 이전 값이 유지된다.
- [x] OpenAI adapter는 off일 때 input transcription을 session.update에 넣지 않고, on일 때만 설정한다. Output language 설정은 양쪽 모두 유지된다.
- [x] Operator Broadcast input pane은 off 또는 OpenAI 외 provider에서 숨고, on에서는 기존 responsive 조건에 따라 표시된다. Output pane은 항상 유지된다.
- [x] Listen 공개 status/event에는 Operator 설정값이 노출되지 않는다.
- [x] 자동 테스트는 OpenAI 실호출/API key에 의존하지 않는다.
- [x] Backend 및 Frontend unit suite, Frontend production build가 통과한다.
- [x] 실제 usage 차이/quality 비교는 008의 manual checklist에 기록했다.

## 구현 결과

- `input_transcript_enabled`의 config 기본값을 false로 두고 `APP_INPUT_TRANSCRIPT_ENABLED=false`를 `.env.example`에 추가했다. Operator JSON store는 기존 파일에 값이 없으면 config 기본값을 사용하며 명시적 false도 저장한다.
- Operator settings API와 session status에 유효 설정값을 추가했다. live session 중에는 다른 protected setting과 동일하게 변경을 거부하며, status의 값은 interpreter가 OpenAI일 때만 true로 공개된다.
- OpenAI adapter는 opt-in일 때만 source transcription model을 `session.update`에 포함하고, default off에서는 output language 설정만 전달한다.
- API Model 탭에 한국어/영어/독일어 checkbox와 usage 안내를 추가했다. Apply 요청에만 값이 포함되며 저장 성공 즉시 Operator shell 상태를 갱신한다.
- Broadcast input pane은 설정이 off이거나 OpenAI가 선택되지 않으면 숨는다. On 상태에서도 기존 viewport breakpoint를 유지하고 output pane은 계속 표시한다.
- 008에 transcript off/on의 usage와 동일 오디오 translation quality 비교 체크를 추가했다.

## Tests

- Backend: config default/env parity, OperatorSettingsStore default/persist/overlay, settings GET/PUT and live conflict, adapter session.update off/on payload.
- Frontend: API Model default off, separate payload and immediate shell update; Broadcast input pane shown/hidden based on setting and existing viewport rule.
- Commands: Backend `python -m pytest tests/unit -q`; Frontend `npm test`; `npm run build`.

## 검증 결과

- `python -m pytest tests/unit -q`: 138 passed
- `npm test`: 93 passed (17 files)
- `npm run build`: 통과 (`tsc -b && vite build`)
- Focused Backend transcript/config/store/API/adapter/lifecycle suite: 68 passed
- Focused Frontend Settings/navigation/session suite: 39 passed; 최종 Settings/navigation 재검증 23 passed
- 변경 파일 diagnostics: 오류 없음
- `git diff --check`: 통과

## 잔여 위험

- 실제 OpenAI transcript 비용 차이와 번역 품질에 미치는 영향은 실 API usage 및 동일 audio 비교로 확인하지 않았다. 008의 수동 checklist에서 확인한다.
- OpenAI key, 실 microphone/mixer 또는 외부 network를 사용한 수동 검증은 이 티켓 범위에서 수행하지 않았다.

## Related files

- `backend/core/config.py`
- `backend/.env.example`
- `backend/services/operator_store.py`
- `backend/api/v1/endpoints/operator.py`
- `backend/services/session_service.py`
- `backend/services/interpreters/openai_realtime.py`
- `backend/tests/unit/test_config.py`
- `backend/tests/unit/test_operator_store.py`
- `backend/tests/unit/test_operator_api.py`
- `backend/tests/unit/test_openai_realtime.py`
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`
- `frontend/src/pages/Operator/settings/Settings.tsx`
- `frontend/src/pages/Operator/settings/components/InterpreterSection.tsx`
- `frontend/src/pages/Operator/layout/OperatorLayout.tsx`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastSession.ts`
- `frontend/src/pages/Operator/broadcast/Broadcast.tsx`
- `frontend/src/pages/Operator/translations.ts`
- `frontend/tests/unit/OperatorPrefs.test.tsx`
- `frontend/tests/unit/operatorNavigation.test.tsx`
- `.todo/008-backend-openai-e2e-verify.md`