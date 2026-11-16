# 068 iOS 복귀 후 페이지 새로고침 없는 Listen 복구

상태: 진행
우선순위: 높음 (화면 잠금/복귀 후 새로고침해야 음성이 들림)

## Goal

iOS Safari와 iOS Chrome에서 Listen 페이지가 백그라운드로 갔다가 다시 보일 때, 페이지 전체를 새로고침하지 않고 Listener WebSocket과 오디오 재생을 복구하거나 필요한 사용자 동작을 명확히 안내한다.

## 로그 근거

- 로그에는 iPhone Safari와 iPhone Chrome(iOS, `CriOS`)의 `/ws/listen` handshake 성공 기록이 있다. 따라서 접속 초기화 단계에서 Safari가 전면 차단되는 현상은 확인되지 않았다.
- 일부 Listener 연결은 수락된 뒤 종료됐고, `Listen client disconnected`, `CLOSE 1001` 및 `Listener heartbeat timeout` 기록이 있다.
- 백엔드 로그에는 브라우저의 `AudioContext` 상태, 오디오 재생 성공 여부, 화면 visibility 또는 사용자가 새로고침을 했는지 기록되지 않는다. 종료 원인이 화면 잠금이라고 로그만으로 확정할 수는 없다.
- 060은 WebSocket 재접속 경로, 063은 AudioContext 복구 경로를 구현했지만, 063의 iOS 실기기 잠금/복귀 검증은 완료되지 않았다. 보고가 계속되므로 실기기에서 통합 수명주기를 재검증한다.

## Scope

- iOS 화면 잠금/백그라운드 전환/복귀에서 WebSocket 상태와 AudioContext 상태를 별도로 관측해 실패 경계를 확인한다.
- 복귀 시 WebSocket이 실제로 stale/closed이면 현재 hook의 소켓 generation과 재시도 timer를 재사용해 재연결한다. 예전 socket event가 새 연결 상태를 덮어쓰지 않아야 한다.
- WebSocket이 정상인데 AudioContext가 `suspended` 또는 `closed`이면 063의 복구 경로를 사용한다. 브라우저 정책상 사용자 활성화가 필요하면 Listen 버튼을 복구 동작으로 노출하고 현 상태를 번역해 안내한다.
- 음성 재생이 복구되지 않은 상태를 UI에서 단순히 `connected/live`로 표시하지 않는다. 연결, 자막 수신, 오디오 출력 복구 상태를 구분한다.
- Safari와 iOS Chrome을 UA 문자열로 분기하지 않는다. 실제 Web API 기능과 AudioContext/WebSocket state를 기준으로 처리한다.
- 로그/진단에는 상태 전이와 오류 유형만 기록하며 쿠키, 원문 PCM, transcript 본문은 추가하지 않는다.

## 기존 티켓과의 관계

- `.todo/done/060-listen-websocket-network-reliability.md`: WebSocket handshake timeout 및 재접속 동작은 이미 구현되어 있다. 해당 로직을 다시 작성하지 말고, iOS 복귀 뒤 실제 timer/event가 다시 실행되는지 확인한다.
- `.todo/done/063-listen-audio-context-recovery.md`: AudioContext 자동/사용자 복구가 구현되어 있다. 페이지 새로고침이 필요한 상태 전이 또는 통합 누락이 재현될 때만 좁게 보완한다.
- 본 티켓은 두 기능을 실제 iOS 페이지 수명주기와 결합해 검증하고, no-refresh 복구가 실패하는 남은 경로를 보완한다.

## Out of scope

- 브라우저/OS가 화면 잠금 중 JavaScript와 WebSocket을 계속 실행하도록 우회하는 것.
- 사용자 활성화가 필요한 iOS 오디오 재생 제한을 무단으로 우회하는 것.
- 다른 브라우저/OS가 특정 버전에서도 항상 같은 백그라운드 동작을 한다고 가정하는 것.
- Listener 전체 UI 재설계, 백그라운드 재생을 위한 native app 도입.

## Related files

- `frontend/src/pages/Listen/useListenAudio.ts`
- `frontend/src/pages/Listen/Listen.tsx`
- `frontend/src/pages/Listen/Listen.module.css`
- `frontend/src/pages/Listen/translations.ts`
- `frontend/tests/unit/Listen.test.tsx`
- `.todo/done/060-listen-websocket-network-reliability.md`
- `.todo/done/063-listen-audio-context-recovery.md`
- `backend/services/broadcast.py`

## Acceptance criteria

- 모의 visibility 전환, stale/closed WebSocket, `suspended`/`closed` AudioContext 조합에서 새로고침 없이 복구 동작을 수행한다.
- iOS 실기기에서 화면 잠금 후 복귀했을 때 자막·WebSocket·오디오 상태를 구분할 수 있다.
- 재생이 브라우저 정책상 자동 복구되지 않는 경우 Listener가 화면 새로고침 대신 명시적인 사용자 동작으로 오디오를 다시 시작할 수 있다.
- 오디오가 복구되지 않은 채 UI가 정상 재생 중처럼 보이지 않는다.
- 재접속/AudioContext 재개 race 이후 stale PCM frame이 재생되지 않고 오래된 오디오가 누적되지 않는다.
- Safari 및 iOS Chrome에서 정상 청취 시작/중지, 번역 종료, 자막 및 오디오 복구 회귀 테스트가 통과한다.
- 실기기 수동 검증에서 iOS/Safari 또는 Chrome 버전, 화면 잠금 시간, WebSocket 상태, AudioContext 상태, 사용자 동작 필요 여부만 기록한다. 인증/개인정보/오디오 원문은 남기지 않는다.

## 구현 현황

- 페이지가 visible로 돌아올 때 현재 WebSocket을 확인한다. `OPEN` 상태에서 heartbeat 응답이 stale이거나 소켓이 `CLOSED`/`CLOSING`이면 기존 generation 검사와 재접속 timer 경로로 전환한다. `CONNECTING` 소켓은 기존 handshake timeout을 유지한다.
- AudioContext 복구 필요 상태를 상단 상태 배지에도 표시하고, 듣기 버튼의 표시 문구 및 복구 안내를 한국어/영어/독일어로 일치시켰다.
- 재연결 또는 AudioContext 중단 뒤 새 PCM이 AudioBufferSource로 예약될 때까지 오디오 출력 대기 상태를 표시한다. 새 PCM이 도착하기 전에 기존 자막만으로 정상 청취 중처럼 표시하지 않는다.
- 단위 테스트에서 hidden 상태 동안 WebSocket/AudioContext를 건드리지 않고, visible 복귀 때 stale 소켓 재접속과 AudioContext 재개를 함께 검증한다. 닫힌 소켓 복구, 이전 소켓의 늦은 session/PCM 이벤트 무시, 사용자 gesture 복구, 새 PCM 예약 전후의 상태 배지도 검증했다.
- 오디오 출력 준비 상태는 새 PCM을 AudioContext에 예약했는지를 나타내며, 실제 장치에서 소리가 들리는지를 보증하지 않는다.
- `Listen.test.tsx` 및 `liveFlow.test.tsx` 44개 통과, Frontend 타입 검사 및 production build 통과.
- iPhone Safari/Chrome 실기기 화면 잠금/복귀 검증은 아직 수행하지 않았다. 따라서 티켓은 진행 상태로 유지한다.

## Tests and manual validation

### Frontend unit

- fake timers와 mock visibility events로 hidden 상태 동안 timer가 정지되거나 지연된 뒤 visible로 복귀하는 흐름을 검증한다.
- WebSocket이 open 상태에서 heartbeat stale인 경우와 close event를 받은 경우를 나눠 재연결 여부를 확인한다.
- AudioContext가 suspended인 경우 자동 resume 성공/실패, closed인 경우 사용자 gesture 복구를 기존 063 계약대로 검증한다.
- 재연결 후 새 PCM이 예약되기 전에는 오디오 대기 상태를, 예약된 뒤에는 정상 상태를 표시하는지 확인한다.
- 복구 버튼의 aria-label/status, 사용자가 중지했거나 세션이 끝난 뒤 이전 소켓이 재접속하지 않는지 검증한다.

### Manual iOS

- [ ] iPhone Safari에서 듣기를 시작한 뒤 화면을 잠그고 복귀해 페이지 새로고침 없이 재생되는지 확인한다.
- [ ] 같은 절차를 iPhone Chrome에서도 확인한다.
- [ ] 자동 재생이 거부되면 복구 안내 및 명시적 버튼 조작만으로 다시 들을 수 있는지 확인한다.
- [ ] 백그라운드 시간이 길어 서버 heartbeat timeout이 발생해도 복귀 후 자동 또는 안내된 사용자 동작으로 복구되는지 확인한다.
