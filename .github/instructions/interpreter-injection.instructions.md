---
description: 통역 API는 injection. 파이프라인에 vendor 분기 금지
applyTo: '**/*'
---

# Interpreter injection

- `SessionService`와 HTTP/WebSocket 레이어는 `LiveInterpreter` protocol만 사용한다
- provider 선택 분기는 `services/interpreters/factory.py`에만 둔다. 설정 저장·키 상태 표시를 위한 필드 처리는 예외로 하되, 런타임 파이프라인은 provider 이름을 검사하지 않는다
- 새 provider: protocol 구현 + factory 등록. provider 추가 때문에 캡처·브로드캐스트·프론트를 vendor-specific하게 바꾸지 않는다
- vendor payload (`realtimeInput`, `input_audio_buffer` 등)는 해당 adapter 파일 밖으로 새지 않는다
- `APP_INTERPRETER`로 구현체를 고른다
- 공유 오디오 파이프라인은 native capture format에서 interpreter가 선언한 required format으로 변환한다
- 로컬/CI 검증은 `echo`를 쓴다. 유료 API를 테스트에 넣지 않는다
