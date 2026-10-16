# 064 OpenAI Translation 음성 출력 진단

상태: 대기
우선순위: 높음 (번역 자막은 보이지만 Listen 음성이 들리지 않음)

## Goal

믹서의 설교자 입력과 찬양 입력이 함께 있는 환경에서 찬양 번역 자막은 표시되지만 번역 음성이 들리지 않는 보고를 재현·진단한다. OpenAI Translation 출력부터 Listener 재생까지 경계를 분리해 실제 누락 지점을 찾고, 원인이 확인된 지점만 수정한다.

## Reported behavior

- Mixer에서 설교자 마이크가 채널 1로 들어오도록 구성했다.
- 찬양은 별도 채널에서 입력되는 상황에서 찬양 번역 텍스트가 Listener 화면에 표시된다.
- 해당 번역의 음성은 들리지 않는다고 보고됐다.

기존 설명만으로 찬양이 실제 선택된 입력 채널에 들어가는지, OpenAI가 audio delta를 생성했는지, 서버가 음성을 송신했는지, 모바일 브라우저가 재생했는지 알 수 없다. 현장 mixer 채널 번호·OS 입력 채널 번호·현재 설정의 `audio_channel`은 같다고 가정하지 않는다.

## OpenAI 기능 확인

OpenAI Realtime Translation 공식 가이드는 Translation Session이 번역 음성과 transcript delta를 모두 제공하며 WebSocket 출력 이벤트를 다음과 같이 분리해 설명한다.

- `session.output_audio.delta`: base64 인코딩된 번역 오디오
- `session.output_transcript.delta`: 번역 텍스트

가이드: https://developers.openai.com/api/docs/guides/realtime-translation

현재 코드 조사에서 `backend/services/interpreters/openai_realtime.py`는 이 두 이벤트를 각각 `audio`와 `output_text` interpreter 이벤트로 매핑한다. `backend/services/session_service.py`는 audio를 `BroadcastHub.broadcast_audio`로 보내고 텍스트를 자막으로 broadcast한다. `backend/services/broadcast.py`는 Listen WebSocket에 이진 오디오 frame을 전달한다. `frontend/src/pages/Listen/useListenAudio.ts`가 frame을 PCM으로 변환해 AudioContext에서 재생한다.

따라서 OpenAI Translation이 텍스트만 지원한다는 전제로 기능을 추가하지 않는다. 현재 환경에서 audio delta가 생성·수신되었는지 여부는 미확인이다.

## Related files

- `backend/services/audio_capture.py`
- `backend/services/audio_runtime.py`
- `backend/services/interpreters/openai_realtime.py`
- `backend/services/interpreters/protocol.py`
- `backend/services/session_service.py`
- `backend/services/broadcast.py`
- `backend/tests/unit/test_openai_realtime.py`
- `backend/tests/unit/test_audio_runtime.py`
- `backend/tests/unit/test_session_events.py`
- `backend/tests/unit/test_listen_websocket.py`
- `frontend/src/pages/Listen/useListenAudio.ts`
- `frontend/tests/unit/Listen.test.tsx`
- `.todo/done/059-mixer-input-channel-selection.md`

## Scope

### 경계별 진단

- Mixer/AudioCapture: 실제 선택 장치와 1-based `audio_channel`, 장치가 OS에 보고하는 입력 채널 수, 선택한 입력의 신호 유무를 확인한다.
- AudioRuntime: 선택한 입력이 변환 후 interpreter에 전달되는 PCM으로 이어지는지 확인한다. 다른 입력 채널의 신호가 섞이거나 올바른 channel index와 혼동되는지 검증한다.
- OpenAI adapter: Translation Session에서 `session.output_audio.delta`와 `session.output_transcript.delta`가 각각 발생할 수 있음을 유지하고, 실제 adapter 이벤트 변환과 sample rate 처리를 검증한다.
- SessionService/BroadcastHub: audio event가 Listen용 오디오 broadcast에 도달하는지, text event와 독립적으로 처리되는지 확인한다.
- Listener: 이진 PCM frame 수신, AudioContext 상태, frame queue 처리 및 재생을 구분한다. 모바일 재생 증상이 063의 AudioContext 생명주기 문제와 겹치는지 함께 판단한다.
- 필요한 진단 정보는 비민감 메타데이터(이벤트 종류/개수, sample rate, 연결 상태, 처리 오류)로 제한한다. 원문 PCM, API key, 인증 헤더, credential, 자막 본문을 새로운 로그에 남기지 않는다.

### 수정 범위

- 먼저 관측 근거로 실패 경계를 식별한다.
- 매핑 오류, frame 전달 누락, mixer 채널 index 오류 등 재현 가능한 결함만 최소 수정한다.
- OpenAI가 특정 입력에서 audio delta를 보내지 않은 경우 이를 브라우저 playback 실패와 혼동하지 않도록 진단 결과를 구분한다.
- 사용자에게 새 진단/오류 상태를 표시할 필요가 있으면 기존 한국어/영어/독일어 UI 정책을 따른다.

## Out of scope

- OpenAI Realtime Translation에 문서화되지 않은 response 생성, 텍스트 전용/음성 전용 모드 또는 vendor-specific 기능을 임의로 추가하는 것.
- 외부 유료 API에 의존하는 자동 테스트나 실제 API key를 fixture/로그에 사용하는 것.
- 실제 mixer, 실제 마이크, 특정 venue 장비를 자동화 테스트에서 사용하는 것.
- 입력 채널 선택 정책을 변경하거나 자동으로 최적 채널을 추정하는 기능. 관련 변경이 원인으로 확인되면 근거와 범위를 명시해 조정한다.
- 확인되지 않은 현상에 대해 “OpenAI가 audio delta를 보냈다/보내지 않았다”고 단정하는 것.

## Implementation notes

- 통역 vendor 분기는 `services/interpreters/openai_realtime.py` adapter 경계를 벗어나지 않는다. SessionService, BroadcastHub, HTTP/WebSocket 및 frontend는 vendor-neutral protocol을 사용한다.
- OpenAI event 변환은 기존 `InterpreterEvent` 구조를 사용한다. 음성 event 수신을 텍스트 event의 존재로 추론하지 않는다.
- Mixer 선택 채널은 설정된 물리/논리 입력을 기준으로 테스트한다. 채널 번호가 1-based UI와 0-based capture index 사이에서 정확히 변환되는지 059 계약과 대조한다.
- 수정으로 UI 문구가 추가되면 번역 3개 언어를 함께 갱신한다.
- 서버 진단 로그에는 API key나 raw audio payload를 기록하지 않는다.

## Acceptance criteria

- [ ] 현재 파이프라인의 오디오/텍스트 출력 경계가 자동 테스트 또는 명시적인 수동 관측 항목으로 구분된다.
- [ ] OpenAI adapter의 mock event test가 output audio delta를 PCM과 sample rate가 포함된 `audio` 이벤트로, output transcript delta를 `output_text` 이벤트로 각각 변환하는지 검증한다.
- [ ] SessionService/BroadcastHub 테스트가 audio event의 Listen 전달과 text event의 자막 전달을 독립적으로 검증한다.
- [ ] Listener 단위 테스트가 binary PCM frame을 받아 재생 경로를 실행하는지 확인하며, AudioContext 비재생 상태를 “서버가 오디오를 보내지 않음”으로 오진하지 않는다.
- [ ] 실제 출력이 없는 경우 OpenAI audio delta 미수신, 서버 전달 실패, 브라우저 재생 실패 중 관측된 경계를 구분해 기록한다. 확인되지 않은 구간은 미확정으로 남긴다.
- [ ] Mixer 입력 채널은 설정된 channel만 사용하는 기존 동작을 보존하며, 선택하지 않은 채널이 입력에 섞이지 않는지 mock 기반 capture test로 검증한다.
- [ ] 실제 OpenAI API, 유료 Session, 마이크, mixer를 호출하는 자동 테스트가 추가되지 않는다.
- [ ] 수정이 필요한 경우, 해당 원인에 대한 회귀 테스트를 추가하고 기존 번역 텍스트/오디오 event 흐름을 보존한다.

## Tests

### Backend unit

- `backend/tests/unit/test_openai_realtime.py`: 기존 mock websocket event mapping을 기반으로 audio와 transcript delta의 독립 변환을 검증한다.
- `backend/tests/unit/test_session_events.py` 또는 관련 SessionService 테스트: audio와 text 이벤트의 각각의 broadcast 호출을 mock으로 검증한다.
- `backend/tests/unit/test_audio_runtime.py` 및 `backend/tests/unit/test_audio_capture.py`: 선택 채널에서 생성된 PCM만 translation pipeline에 들어가는지 테스트한다.
- `backend/tests/unit/test_listen_websocket.py`: Listen 오디오 frame 전달 contract가 변경된 경우에만 보강한다.

### Frontend unit

- `frontend/tests/unit/Listen.test.tsx`: Listener WebSocket이 이진 오디오를 받을 때 PCM 재생 경로를 검증한다.
- 실제 오디오 출력이 이루어졌다고 주장하지 않도록 AudioContext와 WebSocket을 mock한다.

### Manual validation

- [ ] 장비에서 설교자 mic 및 찬양 입력이 각각 어느 OS 입력 채널로 들어오는지 확인한다. 민감한 장치 이름 대신 채널 번호와 신호 결과만 기록한다.
- [ ] Listener에서 자막과 음성이 모두 들리는 경우 서버/브라우저의 비민감 상태로 audio delta부터 playback까지의 경로를 확인한다.
- [ ] 음성이 들리지 않으면 각 단계의 마지막 성공 지점을 기록하고, OpenAI 실호출 여부 및 비용 발생 여부를 사전에 확인한다.
- [ ] 실제 API key, credential, 원문 PCM 및 개인 식별 정보를 로그/티켓에 기록하지 않는다.

## Risks

- Translation Session output audio는 실제 모델 응답과 음성 입력 품질에 따라 달라진다. mock test는 adapter와 전달 계약만 보장하며 실제 모델의 음성 생성 여부를 보장하지 않는다.
- Mixer의 장치별 채널 표기는 물리 입력 라벨과 일치하지 않을 수 있으므로 실제 장비에서 입력 경로를 검증해야 한다.
- 모바일 AudioContext 복귀 문제가 이 증상의 일부라면 063 티켓과 구현 범위를 조정하고 중복된 복구 로직을 만들지 않는다.
