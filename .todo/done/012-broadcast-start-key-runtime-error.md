# 012 Broadcast start with saved key fails

상태: 완료

## 목표

저장된 Gemini/OpenAI key가 정상적으로 보관되어 있어도, 방송 시작 버튼을 누르면 일반적인 "방송 처리 중 오류가 발생했습니다" 메시지가 뜨는 문제를 원인 단위로 수정한다.

## 현재 증상

- 이전에는 key가 비어 있었음
- key를 정상 값으로 저장한 뒤 서버를 시작하려고 하면 UI에서 generic session error가 발생
- 현재는 설정 저장 자체는 동작하지만, 런타임 세션 시작 단계에서 실패가 발생하는 것으로 보임
- 실패 원인이 UI에 그대로 드러나지 않으므로, 실제 실패 원인(키 불일치, Gemini 인증, WebSocket 연결, payload/모델 설정 등)을 분리해서 확인해야 함

## 구현 범위

- `frontend/src/pages/Operator/broadcast/useBroadcastSession.ts`의 start 실패 처리 확인
- `backend/services/session_service.py`의 session start lifecycle와 interpreter overlay 확인
- `backend/services/interpreters/gemini_live.py` 또는 `openai_realtime.py`의 실제 연결/에러 흐름 확인
- 저장된 key가 `overlay_settings()`에서 제대로 반영되는지 검증
- 세션 시작 실패 시 사용자 메시지와 backend log를 분리하여, 민감한 key 원문 유출 방지
- Http/WebSocket 에러를 사용자에게 의미 있는 상태로 변환

## 수용 기준

- 저장된 valid key로 방송 시작 시 세션이 정상적으로 시작된다.
- 실패 시 UI는 "방송을 시작하지 못했습니다" 또는 provider별 구체 메시지로 표시된다.
- 세션 시작 실패가 발생해도 API key 원문이 frontend toast, GET/PUT response, log에 노출되지 않는다.
- 실제 원인(인증 실패, WebSocket 연결 실패, 모델 설정 문제, 길이/포맷 문제)을 분리해서 추적 가능하다.
- 프론트의 generic `sessionError` 문구가 비정상적인 runtime failure를 숨기지 않도록 정리된다.

## 검증

- backend unit test: 저장 key overlay, provider별 missing key, 연결 실패의 invalid 오기록 방지
- frontend unit test: Settings warning/status와 Broadcast WebSocket 오류 중복 방지
- backend unit test 30개 통과
- frontend unit test 19개 통과
- frontend TypeScript 및 Vite build 통과

실제 유료 provider를 호출하는 수동 검증은 외부 API 및 credential 의존성 때문에 수행하지 않았다. 로컬/CI 검증은 Echo provider를 사용한다.

## 참고

현재 증상은 "설정 저장 성공"과 "런타임 세션 시작 실패" 사이의 경계 문제로 보인다. 즉, 저장 로직은 정상인데 실제 interpreter 연결 단계에서 실패하고 있음을 전제로 작업해야 한다.
