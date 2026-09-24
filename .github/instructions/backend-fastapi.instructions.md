---
description: FastAPI backend 구조와 unit test 범위
applyTo: 'backend/**/*.py'
---

# FastAPI

- 라우터(`api/`)는 HTTP/WebSocket 입출력만 담당한다. 비즈니스 로직은 `services/`에 둔다
- 설정값은 `core/config.py`(`APP_` prefix)를 통하고, 코드에 비밀값을 넣지 않는다
- API key는 소스, 테스트 fixture, 로그, API 응답에 평문으로 남기지 않는다
- 통역 vendor 호출은 `services/interpreters/`에만 둔다. 라우터와 `SessionService`는 `LiveInterpreter`만 본다
- endpoint에서 마이크·외부 AI WebSocket을 직접 열지 않는다
- 외부 API 구현 전 공식 문서의 endpoint, model, event schema, audio format을 확인하고 구현 근거를 남긴다

## Unit test

- 위치: `backend/tests/unit/`
- 도구: pytest
- 외부 AI(Gemini, OpenAI)는 mock하거나 호출하지 않는다
- 테스트하지 않는 것: 실제 마이크 장치, 실제 vendor API
