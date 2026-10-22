# 063 모바일 Listen 오디오 복구

상태: 진행 (코드 구현·자동 검증 완료, iOS 실기기 검증 대기)
우선순위: 높음 (모바일 청취 중 번역 음성 중단)

## Goal

iOS Safari에서 Listen 페이지를 열고 듣는 중 화면이 잠기거나 Safari가 백그라운드에 들어갔다가 복귀해도 번역 오디오가 다시 재생되도록 한다. 오디오가 복구되지 않는 경우에는 자막만 계속 진행되는 상태를 조용히 유지하지 말고, 청취자가 취할 수 있는 복구 동작을 명확히 표시한다.

## Reported behavior

- 모바일 Safari에서 Listen에 연결해 음성을 듣는다.
- 화면이 꺼지거나 Safari가 백그라운드 상태가 된 뒤 연결/재생이 중단된다.
- 화면으로 돌아오면 자막은 다시 보이지만 번역 음성은 들리지 않는다.
- Safari를 닫았다가 다시 열어 Listen에 접속해도 같은 현상이 보고됐다.

이 보고만으로 WebSocket 연결 단절, 브라우저의 AudioContext 중단, 오디오 프레임 미수신, 스피커 출력 제한 중 어느 하나가 원인이라고 단정하지 않는다.

## 조사한 구현과 원인 가설

- `frontend/src/pages/Listen/useListenAudio.ts`가 Listener WebSocket 연결·재연결과 `AudioContext` 재생을 함께 관리한다.
- WebSocket은 끊긴 경우 재연결을 예약하고, 연결 후 세션 상태를 다시 받는다. 이미 연결된 뒤의 연결 손실 자체는 기존 테스트에서 다룬다.
- 오디오 재생은 별도 `AudioContext`에 의존한다. 오디오 청크 처리에서 context가 `suspended`일 때 `resume()`을 호출하지만, 상태가 `running`이 아니면 해당 청크를 재생하지 않는다.
- `frontend/src/pages/Listen/Listen.tsx`는 페이지가 보일 때 Wake Lock을 다시 요청하지만 AudioContext 복구 절차는 갖고 있지 않다.
- 브라우저/OS의 백그라운드 정책에 따라 context가 suspend 또는 다른 중단 상태가 될 수 있다. 화면 복귀 때 WebSocket은 정상이어도 오디오 재생 경로만 회복하지 못하는 것이 우선 가설이다.
- 실제 iOS Safari에서 context 상태, audio frame 수신 여부 및 재생 시도 결과를 관찰해 가설을 확인해야 한다. Safari 종료 후 새 페이지 로드 증상은 페이지 수명주기와 기존 AudioContext 재사용 여부를 별도로 점검한다.

## Related files

- `frontend/src/pages/Listen/useListenAudio.ts`
- `frontend/src/pages/Listen/Listen.tsx`
- `frontend/src/pages/Listen/Listen.module.css`
- `frontend/tests/unit/Listen.test.tsx`
- `frontend/src/shared/audio/pcm.ts`

## Scope

- 페이지 visibility 및 AudioContext 상태 전이를 관찰해, WebSocket 연결 상태와 오디오 재생 상태를 구분한다.
- 화면 복귀 시 현재 context 상태에 맞는 복구 절차를 적용한다. context가 재개 불가능하거나 브라우저의 사용자 활성화 제약이 있는 경우에는 허용된 사용자 동작(예: 듣기 버튼으로 다시 활성화)을 안내한다.
- `AudioContext`가 `running`이 아닌 상태에서 청크가 무시될 때, 조용히 정상 재생처럼 남지 않도록 상태를 갱신하고 복구 실패를 청취자에게 알린다.
- 재개가 비동기인 동안에는 오래된 context/세대의 청크가 재생되지 않도록 기존 generation 및 소스 정리 계약을 유지한다.
- 복구 시 오래된 PCM이 무제한으로 쌓이거나, 재개 후 수 초 전의 음성이 한꺼번에 재생되지 않도록 현재 bounded audio scheduling 정책과 청크 폐기 정책을 검토한다.
- 기존 Listen WebSocket 자동 재접속, 수동 듣기 시작/중지, PCM odd-byte 결합, 자막·성경 이벤트 동작을 보존한다.
- UI에 새 상태나 안내 문구가 필요하면 기존 Listener의 한국어/영어/독일어 지원 정책에 맞춘다.

## Out of scope

- 서버 Listen WebSocket 재연결 정책 또는 BroadcastHub의 동시 송신 구조 변경. 오디오 복구를 위해 해당 변경이 필요하다는 재현 근거가 발견된 경우에만 좁게 확장한다.
- iOS에서 사용자 활성화가 필요한 재생 정책을 우회하는 자동 재생 해킹.
- 화면 잠금 중 모든 iOS 버전/브라우저에서 백그라운드 재생을 보장하는 것.
- 실제 마이크, 외부 OpenAI API 또는 유료 Translation Session을 사용하는 자동화 테스트.
- Listen 전체 UI 재설계, volume control 추가.

## Implementation notes

- `AudioContext.statechange` 및 `document.visibilitychange`는 진단에 필요한 시점만 구독하고, unmount 때 listener를 정리한다.
- `suspended`, 구현체가 노출하는 기타 비재생 상태, `closed`를 같은 상태로 취급하지 않는다. `resume()` 성공도 실제 `state === 'running'` 확인 전에는 복구 성공으로 보고하지 않는다.
- 사용자 동작이 필요하다면 기존 Listen 버튼 동작과 합쳐, 새 재생 경로가 사용자 gesture 안에서 시작되도록 한다. 이벤트 핸들러만으로 브라우저 제한을 우회할 수 있다고 가정하지 않는다.
- AudioContext를 새로 만드는 접근을 택한다면 기존 context와 예약 중인 `AudioBufferSourceNode`를 먼저 안전하게 정리하고, 오래된 비동기 재개 결과가 새 context 상태를 덮지 않는지 검증한다.
- 테스트 로그나 UI 오류에 API key, 원문 오디오, credential을 포함하지 않는다.

## Acceptance criteria

- [x] WebSocket 연결이 살아 있고 자막이 갱신되는 상태에서 AudioContext가 비재생 상태가 되면, UI/상태에서 이를 연결 문제와 구분할 수 있다.
- [x] AudioContext를 복구할 수 있는 조건에서는 복귀 후 새로 도착한 PCM 청크가 다시 재생된다.
- [x] 자동 복구가 브라우저 정책상 불가능한 경우에는 청취자가 수행할 수 있는 사용자 동작을 안내하고, 해당 동작 뒤 재생을 다시 시작할 수 있다.
- [x] context 재개가 중지/새 세션/unmount 후 완료되는 race에서 오래된 청크가 재생되거나 닫힌 context를 사용하지 않는다.
- [x] 청크 재개 실패가 미처리 promise rejection이나 성공처럼 보이는 상태를 만들지 않는다.
- [x] 기존 WebSocket 재연결, 수동 중지, PCM 홀수 바이트 결합, 오디오 스케줄링 상한 테스트가 유지된다.
- [x] 오디오 중단 시 이전 청크에서 남은 홀수 PCM 바이트를 버려 복구 후 샘플 경계가 어긋나지 않는다.
- [ ] 실제 iPhone/iPad Safari에서 화면 잠금 후 복귀 및 Safari를 닫았다가 Listen에 재접속하는 시나리오를 확인하고, OS/Safari 버전·context 상태·WebSocket 상태·새 오디오 수신 여부를 기록한다.

## Tests

### Frontend unit

- `frontend/tests/unit/Listen.test.tsx`에서 AudioContext의 `suspended`, `running`, `closed` 상태 전이 및 `statechange`를 mock으로 검증한다.
- 비재생 상태에서 오디오 frame을 받았을 때 재개 성공 뒤 새 frame이 재생되는지 확인한다.
- 재개 실패 또는 `closed` context에서 frame이 조용히 재생 성공으로 처리되지 않고, 사용자 복구 상태가 나타나는지 확인한다.
- 재개 Promise가 pending인 동안 듣기를 중지하거나 component를 unmount한 뒤 완료돼도 stale frame이 재생되지 않는지 확인한다.
- fake WebSocket이 열린 상태로 두고 AudioContext만 중단하여, 연결 복구와 오디오 복구가 독립적으로 검증되는지 확인한다.
- 오디오 중단 전 보관된 홀수 PCM 바이트가 복구 후 새 청크에 합쳐지지 않는지 확인한다.

### Manual iOS Safari

- [ ] Listen을 열고 오디오를 듣는 동안 화면을 잠근 뒤 다시 열어 번역 음성과 자막이 모두 이어지는지 확인한다.
- [ ] 화면 복귀 후 WebSocket은 연결됐지만 오디오가 복구되지 않는 경우 안내와 사용자 복구 동작을 확인한다.
- [ ] Safari 탭/앱을 닫았다가 다시 열어 Listen에 재접속했을 때 새 AudioContext와 재생이 정상적으로 시작되는지 확인한다.
- [ ] API key, credential, 원문 오디오 또는 개인 식별 정보를 기록하지 않는다.

## Risks

- iOS Safari의 재생 허용 정책은 화면이 보이는지 여부만으로 해결되지 않을 수 있다. 코드에서 자동 재생을 약속하지 말고 실제 사용자 동작과 기기 테스트로 수용 기준을 판단한다.
- 오디오 청크를 복구 중 보관할 경우 지연이 누적될 수 있다. 무제한 버퍼링은 허용하지 않는다.

## 구현 현황

- `AudioContext.statechange`와 페이지 복귀를 감지해 오디오 복구를 시도하고, WebSocket 연결 상태와 분리된 복구 안내 및 사용자 동작을 제공한다.
- 재개 중 도착한 청크와 예약된 오래된 오디오를 정리한다. 중단 시 미완성 PCM 샘플도 버리며, `closed` context는 사용자 동작에서 새 context로 교체한다.
- PCM 중단 회귀 테스트와 Frontend 빌드가 통과했다. 실제 iOS Safari 잠금/복귀 및 재접속 확인은 기기 접근이 필요해 대기 중이다.
