# 006 OpenAI Realtime server-side VAD 준비

상태: 대기

## 목표

ChatGPT 음성 번역 경험에 가까운 provider를 비교하기 위해 OpenAI Realtime API를
`LiveInterpreter` 뒤에 추가한다. 애플리케이션이 RMS 기반 VAD를 직접 구현하지 않고,
OpenAI Realtime의 server-side turn detection을 사용한다.

## 현재 결정

- 새 provider는 `backend/services/interpreters/openai_realtime.py`에만 구현한다.
- `SessionService`, `AudioCapture`, `BroadcastHub`, frontend의 provider 분기는 금지한다.
- 입력은 기존과 동일한 signed 16-bit mono PCM streaming을 사용한다.
- turn detection은 먼저 `server_vad`로 시작하고, 필요할 때 `semantic_vad`를 비교한다.
- 자체 `VadSegmenter`, `APP_VAD_ENABLED`, `activityStart/activityEnd`는 OpenAI 경로에서 사용하지 않는다.
- OpenAI 응답 audio와 output transcript는 각각 별도 이벤트로 처리한다.

## 선행 조사

- 사용할 OpenAI Realtime WebSocket endpoint, model, 인증 방식 확인
- 현재 계정과 model이 `server_vad` 및 필요한 audio codec을 지원하는지 확인
- input audio format, output PCM sample rate, transcript event 이름 확인
- `server_vad` 설정값의 공식 필드명 확인: threshold, prefix padding, silence duration 등
- OpenAI Realtime 응답 audio가 현재 `BroadcastHub`와 frontend PCM 재생 계약에 맞는지 확인

## 구현 순서

1. API 문서와 현재 stub의 protocol 차이를 조사한다.
2. fake WebSocket으로 setup, input audio append, response audio, transcript parsing을 테스트한다.
3. `LiveInterpreter` protocol에 필요한 변경만 추가한다.
4. Echo baseline을 먼저 통과시킨다.
5. OpenAI를 명시적으로 선택했을 때만 실제 API smoke test를 한다.
6. Gemini raw baseline과 latency, 누락/중복, output audio 재생을 비교한다.

## 완료 조건

- [ ] OpenAI adapter가 `LiveInterpreter` protocol을 구현한다.
- [ ] provider 내부에서만 OpenAI payload와 server-side VAD 설정을 사용한다.
- [ ] input audio, output transcript, output audio를 모두 처리한다.
- [ ] 외부 API 호출 없는 unit test가 setup과 주요 이벤트를 검증한다.
- [ ] Echo와 Gemini 기존 경로가 변경 없이 동작한다.
- [ ] 실제 smoke test에서 번역 audio가 client에서 재생된다.
- [ ] Gemini baseline 대비 결과와 비용/latency를 기록한다.

## 하지 않음

- ChatGPT Pro 앱의 내부 prompt, routing, VAD 설정을 추측해 복제
- 자체 RMS VAD를 OpenAI adapter 앞에 추가
- API key를 코드나 로그에 기록
- 실제 API 호출을 pytest에 포함