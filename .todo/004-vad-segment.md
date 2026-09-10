# 004 긴 설교 VAD 구간 분할

상태: 대기

## 배경

설교자가 문장 사이에 충분히 멈추지 않으면 현재 Gemini Live의 automatic activity detection이
end-of-turn을 늦게 판단한다. 그 결과 번역 첫 조각이 늦게 나오거나 긴 입력 뒤에 한꺼번에 출력될 수 있다.

현재 `AudioCapture`는 16-bit mono 16kHz PCM을 약 64ms chunk로 만들고,
`SessionService`는 이를 그대로 `LiveInterpreter.send_pcm()`에 전달한다. 단순히 chunk를
1~2초로 합치는 것만으로는 turn 지연 문제가 해결되지 않을 수 있으므로, 외부 VAD가 정의한
발화 구간과 Gemini activity 경계를 연결하는 실험으로 다룬다.

## 목표

- 긴 무음이 아니라 긴 연속 발화에서도 1~2초 안에 번역이 시작되는지 검증
- 발화 중간 분할이 문맥 단절, 단어 중복, 번역 누락을 만들지 확인
- 기존 `LiveInterpreter` injection 경계를 유지한 채 VAD 적용 위치와 Gemini adapter 계약을 결정

## 실험 범위

- 입력 계약은 기존과 동일: signed 16-bit PCM, mono, `input_sample_rate` 기본 16kHz
- VAD는 `AudioCapture` 내부가 아니라 `services/`의 독립 모듈로 둔다
- `SessionService`는 vendor payload를 알지 않고 segmenter의 입력/출력 계약만 사용한다
- Gemini adapter에서만 `activityStart`/`activityEnd` 또는 동등한 turn 경계를 다룬다
- Echo/OpenAI 동작과 frontend broadcast 계약은 변경하지 않는다
- 먼저 고정 1~2초 segment 모드와 VAD 기반 segment 모드를 비교한다

## 결정할 것

- VAD 구현/의존성: 기존 표준 라이브러리 기반 energy gate로 시작할지, 검증된 VAD 패키지를 추가할지
- segment 정책: 최소 발화 길이, 최대 길이(기본 2초), 시작 padding, 종료 silence, segment 간 overlap
- 발화 중간에 max 길이에 도달했을 때 Gemini에 activity 경계를 보낼지, 연속 activity로 유지할지
- 문맥 유지 방식: 하나의 Gemini 세션에서 경계만 표시할지, 세션을 재생성하지 않고 연속 입력할지
- 설정값 이름과 기본값, 그리고 `APP_INTERPRETER=echo`에서 사용할 검증 방식

## 완료 조건

- [ ] segmenter가 PCM frame stream을 받아 segment를 내보내는 명시적 인터페이스가 있다
- [ ] segmenter unit test가 무음 제거, 짧은 무음, 최대 길이, 시작/종료 padding, flush를 검증한다
- [ ] 세션 종료/취소 시 남은 audio가 유실되지 않고 flush되는 경로가 있다
- [ ] Gemini adapter 외부로 `activityStart`, `activityEnd`, `realtimeInput` payload가 새지 않는다
- [ ] 고정 segment와 VAD segment 각각에서 첫 번역까지의 시간, 누락/중복 여부를 기록한다
- [ ] 실제 설교 녹음 또는 동일한 PCM fixture로 연속 발화 시나리오를 재현한다
- [ ] 효과가 없거나 품질이 나빠질 때 끌 수 있는 설정이 있고 기본 동작은 기존과 동일하다

## 측정 기준

- 첫 번역 latency: 발화 시작부터 첫 번역 audio/text event까지
- segment latency: 발화 시작부터 첫 segment 전송까지
- 품질: 단어 누락, 중복, 발화 중간 문맥 단절 횟수
- 안정성: CPU 사용량, queue 적체, 세션 종료 시 tail audio 유실 여부

## 하지 않음

- VAD를 frontend microphone 또는 browser audio pipeline에 추가
- Gemini/OpenAI 실호출을 unit test에 포함
- 번역 모델, system instruction, 출력 음성 포맷 변경
- 실제 마이크 장치 자체를 unit test에서 검증

## 선행 조사

- Gemini Live에서 activity 경계와 automatic activity detection을 함께 사용할 때의 동작 확인
- 사용할 VAD의 frame size/샘플레이트 제약과 Windows 설치 가능성 확인
- 짧은 한국어 조사·어미가 segment 경계에서 잘리는 실제 녹음 fixture 준비
