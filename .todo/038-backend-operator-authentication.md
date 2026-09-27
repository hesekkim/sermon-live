# 038 Backend Operator 인증과 접근 제어

상태: 대기
우선순위: 높음

## Goal

Local PC에서 실행되는 FastAPI에 Operator 인증을 추가해 같은 Wi-Fi의 임의 사용자가 설정을 바꾸거나 통역 세션을 조작하지 못하게 한다. 청취자가 사용하는 Listen 화면과 Listen WebSocket은 공개로 유지한다.

## Why

앱은 `0.0.0.0`에 bind되고 Operator settings, session control, audio test, Operator WebSocket에 인증이 없다. 같은 LAN 사용자는 OpenAI key 저장 설정을 변경하거나 비용이 발생하는 session을 시작/중지할 수 있다. CORS는 접근 인증이 아니다.

## Related files

- `backend/core/config.py`
- `backend/main.py`
- `backend/api/v1/api.py`
- `backend/api/v1/endpoints/operator.py`
- `backend/api/v1/endpoints/audio.py`
- 신규 `backend/services/operator_auth.py` 또는 동등한 auth service
- 필요 시 `backend/api/v1/endpoints/auth.py`
- `backend/requirements.txt`
- `backend/tests/unit/test_operator_api.py`
- 신규 `backend/tests/unit/test_operator_auth.py`
- 신규 `backend/tests/unit/test_operator_websocket_auth.py` 또는 현재 API 테스트 내 focused cases
- `README.md`

## Dependencies

- `.todo/039-frontend-operator-login.md`
- `.todo/done/029-backend-broadcast-observability.md`

## Implementation notes

- `APP_OPERATOR_PASSWORD` 및 별도의 무작위 `APP_OPERATOR_SESSION_SECRET` 설정을 정의한다. 개발용 default password/secret을 제공하지 않는다. 비밀값이 빠진 상태에서는 Operator endpoint가 fail-closed 하도록 시작 검증 또는 인증 응답을 설계한다.
- 로그인/현재 세션 확인/로그아웃 endpoint만 공개 인증 경계로 둔다. 보호 대상은 operator settings GET/PUT, session status/start/stop/extend, audio devices/test/stream, `/ws/operator`다.
- 공개 유지 대상은 `/health`, `/listen` SPA 경로, `/ws/listen`이다. Sermon Session API는 별도 비활성화 티켓에서 router 등록을 해제한다.
- password를 저장하거나 비교하는 과정에서 로그/응답에 출력하지 않는다. 환경에서 전달된 password와 입력값을 timing-safe 방식으로 비교한다.
- 로그인 후에는 HttpOnly, SameSite 세션 쿠키를 사용한다. 세션에 secret/password 자체를 저장하지 않고 최소한의 인증 claim만 저장한다. 세션 서명 검증은 서버에서 수행한다.
- 모든 보호 대상 HTTP 요청의 unsafe method에서 Origin 검증과 CSRF 방어를 적용한다. `GET`도 상태/개인정보를 제공하는 Operator endpoint는 반드시 인증한다.
- WebSocket은 `accept()` 또는 hub 등록 전에 인증 쿠키와 허용 Origin을 확인한다. 인증 실패 시 적절한 close/status로 거부하고 hub client set에 등록하지 않는다.
- 로그인 무차별 시도를 완화할 간단한 실패 제한/지연 정책을 적용한다. user/account DB나 외부 auth provider는 도입하지 않는다.
- `itsdangerous` 등 새 의존성을 추가한다면 세션의 서명/쿠키 속성만 위해 사용하는지 평가하고 requirements/test에 반영한다. 민감 데이터를 서명 쿠키에 담아 암호화된 것으로 취급하지 않는다.
- README에 `.env` 설정, 안전한 secret 생성 방법, Windows Private Network 방화벽, router port forwarding 금지, Listen 공개 범위를 기록한다.
- HTTPS/WSS와 인증서 배포는 이번 범위에서 제외한다. README와 사용자 안내에 HTTP LAN 세션의 도청/탈취 한계를 명시한다.

## Acceptance criteria

- 올바르지 않거나 누락된 인증 상태에서 모든 보호 HTTP API는 거부된다.
- 비인증 사용자는 `/ws/operator`에서 status/transcript/error 이벤트를 받을 수 없고 hub에 등록되지 않는다.
- 인증된 Operator는 기존 settings, session control, audio device/test 기능을 사용할 수 있다.
- `/health`, Listen 페이지와 `/ws/listen`은 로그인 없이 동작한다.
- API key와 Operator password가 API response, 로그, cookie payload의 읽을 수 있는 값으로 노출되지 않는다.
- CSRF/Origin 검증이 cross-origin unsafe HTTP 요청과 허용되지 않은 WebSocket origin을 거부한다.
- secret 미설정 상태에 기본 password로 우회할 수 없다.
- 로컬 운영의 네트워크 제한과 HTTP 잔여 위험이 문서화된다.

## Tests

- Backend unit/API tests: 로그인 성공/실패, cookie set/clear 및 flags, 보호 endpoint 무인증 거부/인증 성공, Origin/CSRF 거부, public health 접근.
- WebSocket unit tests: cookie 없는 접속 거부, 인증 cookie 접속 성공, hub 등록 여부, 잘못된 Origin 거부.
- 기존 operator API 테스트 fixture를 인증된 client fixture로 갱신한다.
- 실제 API key를 사용하거나 테스트 출력에 password/secret을 남기지 않는다.

## Risks

- HTTP를 계속 사용하는 한 같은 Wi-Fi에서 능동적 공격자가 cookie/password를 가로채는 위험은 제거되지 않는다. HTTPS를 이번 scope에서 제외한다는 사용자 결정을 존중하되 이를 인증만으로 완전히 보호한다고 표현하지 않는다.
- Listen WebSocket은 공개이므로 같은 네트워크의 누구나 실제 방송 audio/text를 받을 수 있다. 이는 합의된 정책이다.
- CORS 또는 React route guard만 적용하면 직접 HTTP/WebSocket 호출을 막을 수 없으므로 backend enforcement가 필수다.
