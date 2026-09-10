# 005 번역 전후 로그 추가

상태: 진행

## 배경

VAD 작업 이후 실제로 입력이 Gemini에 전달되는지와 번역 결과가 생성되는지
backend 로그만으로 확인하기 어렵다. 현재는 일부 Gemini text만 `[Gemini text]`로
기록하고, 원문 입력 전사는 활성화하지 않았다.

## 목표

- backend 로그에서 Gemini가 인식한 원문과 모델이 생성한 번역을 구분해 확인
- audio chunk 전송, 입력 전사, 출력 번역, interpreter error의 흐름을 추적
- 실제 vendor 호출 없이 로그 포맷과 수신 이벤트 처리를 unit test로 검증

## 구현 범위

- Gemini setup에 `inputAudioTranscription`을 활성화한다
- Gemini `serverContent.inputTranscription.text`를 `[Translation input]`으로 기록한다
- 모델 text를 `[Translation output]`으로 기록한다
- 빈 문자열과 text filter로 제거되는 출력은 로그에 남기지 않는다
- API key, PCM 본문, base64 audio payload는 로그에 기록하지 않는다
- VAD 활성화 시 manual activity 경계와 충돌하지 않도록 Gemini automatic VAD를 끈다

## 완료 조건

- [x] backend 로그에 `[Translation input]`과 `[Translation output]`이 각각 보인다
- [x] input/output 이벤트가 한 server message에 함께 와도 모두 처리된다
- [x] 입력 전사가 없는 Echo 모드에서도 기존 로컬 테스트가 깨지지 않는다
- [x] 로그에 민감정보와 raw audio가 포함되지 않는다
- [x] Gemini WebSocket mock unit test가 setup 옵션과 로그 메시지를 검증한다
- [x] `pytest` 전체 테스트가 통과한다

## 하지 않음

- 원문 전사를 frontend subtitle로 broadcast
- 로그 파일 저장, 외부 observability 서비스 연동
- 실제 Gemini API 호출을 테스트에 포함