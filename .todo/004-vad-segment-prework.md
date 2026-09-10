# 004 VAD 선행작업 및 실험 결론

상태: 참고

## 확인된 baseline

- VAD를 끄면 `AudioCapture -> Gemini` raw PCM streaming이 정상 동작했다.
- Gemini input transcription은 작은 PCM chunk를 실시간으로 받았다.
- Gemini automatic VAD는 입력 turn 종료를 자체 판단하고 번역 audio를 생성했다.
- client playback 경로는 raw PCM baseline에서 동작했다.

## 실패한 실험

- RMS energy gate로 20ms frame을 분류하고 2초 이내 segment를 생성했다.
- Gemini automatic VAD를 끄고 각 segment에 `activityStart -> PCM -> activityEnd`를 보냈다.
- segment 생성 자체는 정상이어도 번역이 늦거나, 문맥이 끊기거나, 번역 audio가 안정적으로 재생되지 않았다.
- `audioStreamEnd` hybrid 방식도 이 adapter의 실험에서는 원하는 결과를 확인하지 못했다.

## 결론

현재 서비스의 기본 경로에서는 자체 VAD를 사용하지 않는다. Gemini를 계속 사용할 때는
Gemini automatic VAD와 raw PCM streaming을 우선한다. 이 실험은 애플리케이션 VAD가
항상 API 내부 VAD보다 낫지 않다는 사실을 확인한 기록이다.

## 다음 AI 작업 규칙

1. 작업 시작 전에 raw baseline을 먼저 검증한다.
2. provider의 server-side VAD가 있으면 자체 RMS VAD를 먼저 추가하지 않는다.
3. input transcription, output transcription, output audio playback을 별도로 검증한다.
4. 실제 API payload는 공식 문서와 현재 model 계약을 대조한다.
5. 사용자가 요청하지 않으면 commit, push, branch 조작을 하지 않는다.
6. 실제 API 호출은 unit test가 아니라 수동 smoke test로 검증한다.