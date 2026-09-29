# 051 OpenAI 실장 전 전체 구현 점검 및 핵심 하드닝

상태: 완료
우선순위: 높음

## Goal

실제 OpenAI Translation API와 장비를 연결하기 전에 목표 아키텍처의 핵심 경로를 전체적으로 점검하고, 자동화 테스트로 재현되는 실장 차단 결함을 수정한다. 공개 Listen, 오디오 파이프라인, session lifecycle 및 OpenAI adapter 경계에서 장애가 다른 client나 전체 번역 흐름으로 번지지 않도록 한다.

실제 OpenAI API 호출 및 장비 end-to-end 검증은 이 티켓에서 수행하지 않는다. 이 티켓의 완료는 `.todo/008-backend-openai-e2e-verify.md`의 수동 실장 검증을 시작할 준비가 되었다는 뜻이다.

## 발견 배경

목표 기준은 `docs/Archthecture.md`이며, 현 구현의 전반적인 정합성과 실장 전 위험을 한 번 더 확인해야 한다. 공식 protocol 확인은 [OpenAI Realtime translation guide](https://developers.openai.com/api/docs/guides/realtime-translation.md)를 기준으로 하며, 초기 코드 교차 점검에서 다음 위험 후보가 나왔다.

- OpenAI adapter가 output transcript delta를 전달하지만 Listen UI가 받은 조각을 누적하지 않고 교체 표시할 가능성.
- BroadcastHub의 공개 Listen 전송이 느린 client를 기다리며 다른 client 또는 interpreter event 처리를 지연시킬 가능성. `.todo/050`은 Operator WebSocket 격리를 다루므로 공개 Listen 경로는 별도로 확인해야 한다.
- AudioCapture의 원본 입력 queue가 무제한이면 소비가 막힌 동안 메모리와 audio 지연이 증가할 가능성.
- OpenAI provider 오류 상세가 공개 Listen client에 전파될 가능성.
- Operator settings API unit test의 API key 검증 경로가 외부 OpenAI 연결을 시도할 가능성.
- 이전 session 종료 뒤 다른 Operator tab에서 시작한 새 session 상태를 기존 tab이 stale 종료 상태로 무시할 가능성.
- Listen output audio 예약 backlog와 process shutdown 중 `starting` 상태의 race가 실제로 제한·정리되는지 추가 확인 필요.

위 후보 중 구현 경로와 테스트에서 재현되지 않는 항목은 결함으로 단정하지 않는다. 확인 결과에 따라 수정하거나 근거와 잔여 위험을 기록한다.

## 범위

### 1. 전체 아키텍처 대조

다음 경로를 `docs/Archthecture.md`의 계약과 대조한다.

- `LiveInterpreter` protocol, factory, OpenAI adapter의 session/audio/event/close 흐름
- AudioCapture native format, AudioProcessor interpreter target 변환, AudioRuntime queue/drop/drain
- SessionService start/live/stop/error/shutdown 및 BroadcastHub event fan-out
- Operator 인증 경계와 공개 Listen의 event/data 범위
- Listen text/audio/reconnect 상태와 Operator lifecycle/status 반영
- Settings 요청 scope 및 API key mask/status 경계
- Sermon Session route가 활성 앱 surface에서 제외된 상태

각 발견을 확인된 결함, 문서/계약 차이, 실제 장비에서만 확인 가능한 위험으로 분류한다. 목표 문서가 의도적으로 제외한 TLS 배포, key-at-rest 암호화, Sermon Session 기능, glossary/profile 구현은 이 티켓의 수정 범위에 넣지 않는다.

### 2. 실장 차단 후보 확인 및 수정

#### Transcript delta 누적

- `session.output_transcript.delta`부터 Listen의 subtitle state까지 실제 payload가 delta인지 추적한다.
- 여러 조각이 도착할 때 문장이 누적 표시되고 새 session/종료 시 이전 문장이 새 session에 섞이지 않는지 확인한다.
- OpenAI 실시간 delta 흐름을 모사하는 Frontend unit test를 추가한다. 단일 완성 문자열만 전달하는 테스트로 대체하지 않는다.

#### 공개 Listen backpressure 격리

- `BroadcastHub`의 JSON 및 binary audio 전달 모두에서 한 Listen socket이 멈추거나 느릴 때 전송 await가 다른 client 및 SessionService event 처리를 붙잡는지 재현한다.
- 해결은 client별 bounded delivery 또는 timeout 후 해당 client만 정리하는 등 기존 event 순서와 reconnect 계약을 보존하는 방식으로 한다. 한 client의 실패/포화가 다른 client, Operator 전송, capture pump, interpreter event pump를 막아서는 안 된다.
- 포화 정책은 메모리 상한이 명시되어야 한다. 느린 client의 audio가 무제한으로 쌓이지 않도록 하며 정상 client에서는 text/audio 순서를 보존한다.
- 정상 Listen client, 느린 Listen client, Operator client를 함께 둔 테스트에서 정상 client와 운영 파이프라인이 계속 진행하고 느린 client만 제한/정리되는지 검증한다. JSON과 binary audio 경로를 모두 다룬다.

#### Capture queue 한도

- AudioCapture callback/consumer 간 queue 생성, 생산 속도, 종료 동작과 thread/event-loop 경계를 확인한다.
- 소비 지연 중 queue 메모리와 audio age가 무한히 증가하지 않도록 유한 한도를 보장한다. 최신 audio 유지가 가능한 drop 정책을 적용하고 PCM frame 정합성을 보존한다.
- 새 drop이 기존 `audio_queue_overflow` 누적 계약과 합쳐지거나 구분될 경우 status snapshot/event 간 누계가 일치하도록 한다. 손실 원인이 operator WebSocket 지연으로 잘못 표시되지 않게 한다.
- fake capture overload 테스트로 queue 상한, drop 관측, 회복 후 최신 chunk 처리 및 정상 shutdown을 확인한다.

#### 공개 오류 메시지 분리

- OpenAI adapter의 원본 오류가 SessionService와 BroadcastHub를 지나 Listen에 도달하는 경로를 확인한다.
- 익명 Listen에는 통역을 계속할 수 없다는 사용자용 일반 상태만 전송한다. upstream 상세, endpoint 진단, credential 또는 설정 내부값은 포함하지 않는다.
- Operator에는 조치 가능한 범위의 안전한 오류를 제공하되 API key와 secret은 어떤 event/log에도 포함하지 않는다.
- 동일한 provider error 입력으로 Operator/Listen payload를 각각 검증하는 unit test를 둔다.

#### Settings API test의 네트워크 격리

- OpenAI key validation 호출 경계를 확인하고 `test_operator_api.py`가 fake key로 실제 network/WebSocket을 시도하지 않게 fixture 또는 service dependency를 대체한다.
- API 설정 요청/응답 동작은 계속 검증하되 실제 vendor validation은 별도 adapter mock test로 검증한다.
- backend unit test 전체를 외부 API key, 인터넷, 실서비스에 의존하지 않게 한다.

#### Operator의 원격 새 session 상태

- `session_ended` 뒤 설정되는 stale-event 방지 상태가 다음 정상 `starting`/`live` lifecycle에서 갱신되는지 확인한다.
- 한 tab에서 종료한 뒤 다른 tab에서 새 session을 시작하는 순서를 재현한다. 첫 tab이 새 `live`를 영구 무시하지 않아야 하며, 이전 session의 지연 이벤트가 새 session을 잘못 재활성화하지 않아야 한다.
- 기존 종료 직후 stale status 방어를 보존하는 Frontend unit test를 추가한다.

### 3. 추가 위험 판정

다음은 현재 결함이라고 단정하지 않으며, 코드와 인접 테스트로 확인한다.

- Listen Web Audio 예약 lead/backlog에 유한 상한이 있는지. 무제한 예약이 가능하면 느린 output 소비에서 재생 지연이 누적되지 않도록 bounded 동작 및 테스트를 추가한다.
- Server shutdown이 `starting` session을 기다리거나 취소하고 interpreter/audio task를 정리하는지. race가 확인되면 재현 테스트와 최소 lifecycle 수정을 포함한다.
- AudioProcessor resampling의 음성 품질 위험은 수학적/단위 동작과 실제 장비 확인을 구분한다. Anti-alias 필터나 품질 알고리즘 변경은 근거가 확인되지 않으면 이 티켓에서 임의로 확대하지 않고 008 수동 확인 항목으로 남긴다.
- OpenAI translation input chunk duration이 공식 권장값과 다른 경우 실제 호환성 결함인지 성능 최적화 차이인지 기록한다. 무근거로 오디오 chunk 정책을 바꾸지 않는다.

## 제외 범위

- 실제 API key, 실계정, 외부 OpenAI network를 사용하는 자동화 테스트
- 실제 microphone, mixer, Wi-Fi를 이용한 수동 e2e 검증 (008에서 수행)
- 번역 정책, target 언어 제품 변경, glossary/profile/Sermon context 추가
- TLS 배포, operator store key-at-rest 암호화 및 별도 사용자 계정 시스템
- 이번 점검과 무관한 UI 디자인/레이아웃 변경

## Acceptance criteria

- [x] 목표 아키텍처의 Backend, Frontend, event contract 주요 경로를 검토하고 확인된 결함과 잔여 위험을 이 티켓에 기록했다.
- [x] 여러 OpenAI transcript delta가 Listen에서 문장 단위로 누적되고 문장 경계 및 새 session 시작 때 이전 자막이 교체/초기화된다.
- [x] 느린 Listen JSON/binary send는 deadline 이후 해당 client만 정리하며 다른 Listen client와 Operator 전달을 막지 않는다.
- [x] Listen Web Audio 예약 backlog에 2초 lead 제한이 있고 초과 시 아직 재생되지 않은 오래된 예약을 폐기하는 테스트가 있다.
- [x] AudioCapture 원본 queue는 유한하며 가장 오래된 PCM chunk 폐기와 chunk/duration telemetry를 검증한다.
- [x] 공개 Listen에는 허용된 session 상태만 전달하고 upstream 오류 상세를 보내지 않으며 API key는 adapter, session 오류 및 start 응답에서 redacted 처리된다.
- [x] OpenAI settings API roundtrip 테스트가 key validation을 mock하고 Backend unit suite가 실 OpenAI 연결 없이 통과했다.
- [x] 이전 session 종료 후 다른 Operator tab에서 시작하는 새 session 상태와 stale 종료 방어를 검증했다.
- [x] `starting` 중 shutdown이 start task를 취소하고 interpreter 및 session 상태를 정리하는 테스트를 추가했다.
- [x] 자동화 검증에 실제 OpenAI API, 실제 API key 또는 실제 audio device 호출이 없다.
- [x] Backend/Frontend unit suite 및 Frontend production build가 통과했다.
- [x] 008 실장 검증에 실제 model event, sentence boundary, 오디오 포맷, 장비 품질 및 LAN 동작 확인을 남겼다.

## 구현 결과

- Listen subtitle은 OpenAI `session.output_transcript.delta` 조각을 누적 표시한다. Translation 전용 공식 계약이 별도의 transcript-done event를 문서화하지 않아 그 event에 의존하지 않고, 현재 텍스트가 `.`, `!`, `?`로 끝나면 다음 delta를 새 문장으로 표시한다. `starting` status에서는 이전 session subtitle을 초기화한다.
- BroadcastHub의 Listen JSON과 binary audio fan-out에 client별 1초 send timeout을 적용했다. timeout된 Listen socket은 1013으로 닫고 다른 client를 계속 처리한다. Listen 상태 snapshot은 `session_status`와 termination reason만 허용하며 Operator 전용 audio/timer/overflow/error 상세를 공개하지 않는다.
- AudioCapture는 최소 8 kHz 및 설정된 `audio_chunk_frames`를 기준으로 약 1초 이하 분량의 유한 queue를 두고, 가득 차면 오래된 전체 PCM chunk를 폐기한다. Translation 중 발생한 손실은 기존 `audio_queue_overflow` count/duration 누계에 포함한다.
- Translation queue를 분리하기 직전에 capture drop 누계를 한 번 더 수집해 종료 직전 발생한 손실도 최종 session telemetry에 포함한다.
- Listen 재생 시작 예약이 현재 시각보다 2초 넘게 앞서면 아직 재생되지 않은 예약을 버리고 최신 audio부터 재생한다.
- OpenAI adapter, SessionService 및 Operator start HTTP 오류 경로는 설정 API key를 `[REDACTED]` 처리한다. 공개 Listen의 error event에는 진단 문자열을 싣지 않는다.
- Operator settings API 테스트는 OpenAI key validation dependency를 mock한다. Operator의 stale end guard는 새 `starting` status에서 해제한다.
- SessionService는 현재 `starting` task를 추적하고 server shutdown 시 취소 후 `_abort_start` 정리가 끝날 때까지 기다린다.

## 잔여 위험

- 실제 Realtime translation endpoint에서 subtitle delta의 문장부호 경계가 사용자 기대와 맞는지, `session.close` flush 시 마지막 delta/audio가 전달되는지는 mock unit test로 보장할 수 없다. 008에서 실제 session으로 확인한다.
- queue 상한, 1초 send timeout, 2초 browser playback lead는 실제 교회 Wi-Fi 및 오디오 장치에서 관측 후 조정할 수 있다.
- AudioProcessor 선형 resampling의 anti-aliasing 및 실제 음성 품질, capture format과 24 kHz target 변환, 100 ms 처리 chunk의 체감 지연은 실제 장비/실계정 수동 점검 대상이다.
- 이 티켓은 실제 OpenAI API, 실 microphone/mixer, LAN 부하 검증을 수행하지 않았다.

## 검증

Backend 작업 디렉터리에서:

- `python -m pytest tests/unit/test_openai_realtime.py tests/unit/test_session_lifecycle.py tests/unit/test_audio_runtime.py tests/unit/test_operator_api.py -q`
- `python -m pytest tests/unit -q`

Frontend 작업 디렉터리에서:

- `npm test`
- `npm run build`

신규/수정 unit test는 각 수정 slice에서 먼저 실행한다. 테스트 출력 및 로그에 API key가 포함되지 않는지 확인한다. 기존 실패가 있으면 이번 변경 회귀와 분리해 기록한다.

## 다음 작업과의 관계

- 선행 완료 기준: 이 티켓의 자동화 하드닝과 unit suite 통과.
- 후속: `.todo/008-backend-openai-e2e-verify.md`에서 실제 계정 및 장비를 이용한 시작 → 한국어 발화 → 독일어 자막/오디오 → 종료/마지막 출력 확인을 수행한다.
- 실제 장비로만 검증 가능한 문제는 이 티켓에서 해결 완료로 가장하지 않고 008의 수동 결과에 연결한다.

## Related files

- `docs/Archthecture.md`
- `backend/services/interpreters/openai_realtime.py`
- `backend/services/session_service.py`
- `backend/services/broadcast.py`
- `backend/services/audio_capture.py`
- `backend/services/audio_runtime.py`
- `backend/services/audio_processor.py`
- `backend/services/key_validation.py`
- `backend/api/v1/endpoints/operator.py`
- `backend/tests/unit/test_openai_realtime.py`
- `backend/tests/unit/test_session_events.py`
- `backend/tests/unit/test_session_lifecycle.py`
- `backend/tests/unit/test_audio_runtime.py`
- `backend/tests/unit/test_operator_api.py`
- `frontend/src/pages/Listen/useListenAudio.ts`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastSession.ts`
- `frontend/tests/unit/Listen.test.tsx`
- `frontend/tests/unit/useBroadcastSession.test.tsx`

## 검증 결과

- `python -m pytest tests/unit -q`: 133 passed
- `npm test`: 92 passed (17 files)
- `npm run build`: 통과 (`tsc -b && vite build`)
- 변경 파일 diagnostics: 오류 없음
- `git diff --check`: 통과
