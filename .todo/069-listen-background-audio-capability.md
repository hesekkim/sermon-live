# 069 Listen 백그라운드 오디오 및 화면 켜짐 지원

상태: 대기
우선순위: 높음 (화면 잠금 시간 초과 후 음성 청취가 끊김)

## Goal

먼저 현재 WebSocket PCM + Web Audio API 구조가 실제 화면 잠금/백그라운드에서도 계속 재생할 수 있는지 브라우저별로 검증한다. 브라우저 백그라운드 재생을 보장할 수 없다면, 사용자가 Listen 페이지에서 실시간 음성/자막을 보고 듣는 동안 기기의 자동 화면 잠금 시간이 지나도 화면이 켜져 있도록 한다. native app 없이 가능한 웹 기능과 secure local serving 조건을 확인한다.

## 확인된 웹 플랫폼 동작

- Screen Wake Lock API는 화면이 꺼지거나 자동 잠금되는 것을 막을 수 있지만, **secure context(일반적으로 HTTPS)** 에서만 사용할 수 있고 문서가 visible 상태일 때만 요청할 수 있다. 탭/앱이 백그라운드가 되면 lock이 해제될 수 있고, 저전력 상태 등 OS 조건에 따라 요청이 거절되거나 해제될 수도 있다.
- Can I Use의 현재 호환성 표에는 iOS Safari 16.4 이상이 Screen Wake Lock API를 지원하는 것으로 표시되어 있다. 따라서 이 기능을 구현할 때 Safari 미지원만을 전제로 삼지 않는다.
- 이 프로젝트의 Listener는 로그상 `http://10.10.3.227:8080/listen` 같은 LAN IP의 HTTP origin에서 제공됐다. LAN IP의 HTTP는 secure context가 아니므로 이 origin에서는 `navigator.wakeLock`을 사용할 수 없다. `localhost` 예외는 휴대폰에서 접속할 때 휴대폰 자신을 가리키므로 서버 PC의 LAN 주소 문제를 해결하지 않는다.
- 현재 `Listen.tsx`는 `isListening`일 때 Wake Lock을 요청하지만, API 미지원 및 요청 거절을 사용자에게 표시하지 않고 catch에서 무시한다. 따라서 기능이 실제로 활성화됐는지 알 수 없다.
- Listener 오디오는 `/ws/listen` 이진 PCM을 `AudioContext`/`AudioBufferSourceNode`로 재생한다. Screen Wake Lock은 화면을 켜 두는 API이지, 화면을 끄거나 페이지가 백그라운드가 된 뒤 JavaScript/WebSocket/AudioContext가 계속 실행되도록 보장하는 API가 아니다.
- 로그에는 iPhone Safari 및 iOS Chrome 연결의 heartbeat timeout과 disconnect가 있다. 이는 백그라운드 중 연결 처리가 멈출 가능성과 일치하지만, 특정 기기의 화면 잠금이 직접 원인이라고 입증하지는 않는다.
- 근거 문서:
  - [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
  - [Can I Use: Screen Wake Lock API](https://caniuse.com/wake-lock)
  - [MDN Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)
  - [W3C Screen Wake Lock](https://w3c.github.io/screen-wake-lock/)

## 권장 제품 동작

- 우선순위 1: 사용자가 Listen 페이지에서 청취를 시작하고 Translation Session이 live인 동안, 말하는 구간 사이의 대기 시간에도 Screen Wake Lock을 유지해 **자동 화면 꺼짐/잠금 시간 초과**를 막는다.
- 사용자가 청취를 중지하거나 Translation Session이 끝나거나 Listen 페이지를 벗어나면 Wake Lock을 해제한다.
- 사용자가 직접 화면을 잠그거나 다른 앱으로 전환한 경우까지 막으려 하지 않는다. Wake Lock은 백그라운드 오디오 실행 보장이 아니다.
- 화면 잠금 중 백그라운드 음성 재생은 현재 PCM/WebSocket 경로에서 가능한지 실기기로 검증한다. 확실히 보장되지 않는다면 native app을 전제하지 않고, 위의 “Listen이 보이는 동안 화면 켜짐”을 공식 fallback으로 제공한다.

## Scope

- `navigator.wakeLock`, `window.isSecureContext`, Wake Lock request/release 상태를 runtime에서 확인하고, API 미지원·secure context 아님·request 거절·OS release를 서로 구분한다.
- 실시간 통역이 live이고 Listen 오디오가 활성화된 동안 화면이 보이는 문서에서 Screen Wake Lock을 유지한다. 자동 화면 잠금 시간 초과가 말 사이의 긴 pause 때문에 발생하지 않아야 한다.
- 페이지가 다시 visible 상태가 되면 기존 Wake Lock 동작을 재요청한다. system release 이벤트를 감지하고 재요청이 불가능하면 화면 상태를 사용자에게 알린다.
- Wake Lock이 unavailable/rejected인 경우 조용히 성공처럼 넘어가지 않고, 현재는 화면 자동 잠금을 막을 수 없는 상태임을 UI에 표시한다.
- 모바일 LAN에서 Screen Wake Lock을 쓰려면 신뢰할 수 있는 HTTPS secure context가 필요하다. 현재 HTTP-only 정책을 재검토하고, 로컬 사용자가 인증서 경고를 우회하지 않고 HTTPS/WSS로 접속하는 현실적인 설정·배포 방법을 검증한다. 유효한 trusted origin이 준비되지 않으면 해당 구현은 완료로 간주하지 않는다.
- HTTPS 전환 시 Listener WebSocket도 secure page에서 사용할 수 있도록 WSS가 동작하는지 함께 확인한다. 기존 HTTP 사용자와 현재 local startup 동작의 호환성 및 인증서 설정 UX를 문서화한다.
- 현재 Web Audio + WebSocket pipeline이 iOS Safari, iOS Chrome, Android Chrome, desktop Chrome에서 화면 잠금/백그라운드 진입 후 어떻게 동작하는지 실제 기기에서 조사한다.
- `HTMLAudioElement`, media session 또는 다른 표준 경로가 현재 PCM/WebSocket 입력에서 신뢰성 있는 iOS background playback을 제공하는지 검증한다. 문서 검토만으로 해결책이라고 단정하지 않는다.
- 웹 브라우저 경로가 화면 잠금 중 재생을 보장하지 못하는 경우, 지원 범위를 문서화하고 “Listen 페이지가 보이는 동안 화면을 켜 둔다”를 동작 가능한 fallback으로 제공한다. native app은 이 티켓의 전제나 산출물로 요구하지 않는다.
- 모든 화면 잠금 방지 동작은 사용자가 실제로 듣고 있거나 live 번역을 보고 있을 때만 수행하며, 세션 종료/청취 중지/페이지 이탈 시 해제한다.

## Out of scope

- 서버 입력 마이크, Translation Session 또는 오디오 broadcast pipeline 변경.
- iOS 백그라운드 제한을 우회하는 silent audio, 무음 loop, 비표준 keep-alive hack.
- 실기기 검증 없이 PWA 설치만으로 background audio가 보장된다고 주장하는 것.
- native iOS/Android 앱 구현.
- 사용자가 직접 화면을 끄거나 다른 앱으로 전환한 상태에서 화면을 다시 켜거나 브라우저 JavaScript 실행을 강제하는 것.
- 사용자가 명시적으로 끈 화면 자동 잠금 설정을 무시하는 것.

## Related files

- `frontend/src/pages/Listen/useListenAudio.ts`
- `frontend/src/pages/Listen/Listen.tsx`
- `frontend/src/pages/Listen/translations.ts`
- `frontend/src/pages/Listen/Listen.module.css`
- `frontend/tests/unit/Listen.test.tsx`
- `README.md`
- `backend/main.py`
- `run.bat`
- `.todo/done/063-listen-audio-context-recovery.md`
- `.todo/068-listen-ios-resume-without-refresh.md`

## Acceptance criteria

- 모바일 Listener를 실제 LAN 접속 URL에서 열었을 때 `window.isSecureContext === true`이고 `navigator.wakeLock`이 사용 가능한 trusted HTTPS origin이 제공된다. HTTPS/WSS 설정 방법은 사용자 기기에서 재현 가능하게 문서화된다.
- 사용자가 live Translation Session에서 듣기를 켜고 Listen 페이지를 보고 있는 동안 Wake Lock request가 성공하면 OS의 자동 화면 잠금 시간이 지나도 화면이 켜져 있고, 음성/자막이 계속 표시된다. 말 사이의 pause 때문에 lock을 해제하지 않는다.
- Wake Lock은 사용자가 듣기를 중지하거나 세션이 끝나거나 Listen 페이지를 벗어나면 해제된다. 다시 visible 상태로 돌아왔을 때 재요청 동작을 검증한다.
- OS가 lock을 거부/해제하거나 HTTPS/API 지원이 없는 경우 UI는 실제 상태를 표시하고, 활성 Wake Lock처럼 오인시키지 않는다.
- iOS Safari, iOS Chrome, Android Chrome에서 “페이지가 보이는 상태의 자동 화면 timeout 방지”와 “화면을 실제로 끈 뒤 background playback”을 별개 결과로 기록한다.
- 현재 WebSocket+Web Audio 구조에서 화면을 실제로 잠가도 신뢰성 있게 재생이 지속되는 플랫폼은 실기기 테스트로 통과한다. 지속되지 않는 경우 화면 켜짐 fallback을 기본 안내로 제공하며 native app 구현을 요구하지 않는다.
- 사용자/OS가 직접 화면을 잠그거나 앱을 background로 보내면 Wake Lock이 이를 막을 수 없다는 한계를 UI/README에 정확히 설명한다.
- UI 문구 변경 시 한국어/영어/독일어를 모두 갱신한다.
- 자동 테스트는 오디오 객체/API 상태를 mock으로 검증하며 실제 기기나 마이크를 흉내 내어 백그라운드 재생 성공을 주장하지 않는다.

## Manual validation

- [ ] 인증서 경고를 무시하지 않고 iPhone에서 로컬 HTTPS Listen URL에 접속해 secure context 및 WSS 연결을 확인한다.
- [ ] iPhone Safari와 iPhone Chrome에서 Listen을 시작하고, 페이지가 보이는 상태로 10분 이상 자동 화면 timeout을 기다려 화면이 켜져 있는지 확인한다.
- [ ] 같은 테스트에서 실시간 음성/자막이 오랜 pause 동안에도 표시되고 Wake Lock이 유지되는지 확인한다.
- [ ] 청취 중지, Translation Session 종료, 페이지 이탈 시 화면이 다시 일반 자동 잠금 정책을 따르는지 확인한다.
- [ ] Wake Lock을 OS 설정/저전력 상태로 거부 또는 해제할 수 있으면 UI가 상태를 정확히 안내하는지 확인한다.
- [ ] 별도로 화면을 직접 잠그거나 앱을 background로 보냈을 때 오디오, WebSocket, AudioContext가 지속되는지 실기기에서 확인한다.
- [ ] Android Chrome 및 desktop Chrome에서도 visible page의 Wake Lock과 실제 background playback을 각각 확인한다.
- [ ] 기기/OS/browser 버전, `isSecureContext`, Wake Lock 요청/해제, WebSocket 상태, AudioContext 상태, 화면 timeout 이후 표시 여부를 기록한다.
- [ ] iOS에서 background playback이 중단되면 화면 복귀 후 068의 새로고침 없는 복구 동작과 구분해 기록한다.
