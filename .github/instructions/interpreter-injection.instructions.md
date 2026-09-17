---
description: 통역 API는 injection. 파이프라인에 vendor 분기 금지
applyTo: "**"
---

# Interpreter injection

- `SessionService`와 HTTP/WebSocket 레이어는 `LiveInterpreter` protocol만 사용한다
- Gemini, OpenAI, Echo 분기는 `services/interpreters/factory.py`에만 둔다
- 새 provider: protocol 구현 + factory 등록. 캡처·브로드캐스트·프론트를 바꾸지 않는다
- vendor payload (`realtimeInput`, `input_audio_buffer` 등)는 해당 adapter 파일 밖으로 새지 않는다
- `APP_INTERPRETER`로 구현체를 고른다
- 로컬/CI 검증은 `echo`를 쓴다. 유료 API를 테스트에 넣지 않는다
