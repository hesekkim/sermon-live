# 060 Listener WebSocket 연결 및 네트워크 주소 신뢰성

상태: 구현 완료 (실제 hotspot 환경 검증 대기)

## Goal

여러 모바일 기기가 노트북이 제공하는 `/listen` 페이지에 안정적으로 접속하고, 연결 실패 시 원인을 구분할 수 있게 한다. 노트북이 인터넷용 Wi-Fi와 별도 로컬 Wi-Fi/핫스팟 또는 유선 LAN을 동시에 사용하는 경우에도 청취 URL이 모바일이 실제로 접근 가능한 인터페이스를 가리키도록 한다.

## Why

Local에서 backend와 frontend를 실행한 뒤 노트북의 hotspot을 켜고 모바일 4대가 모두 해당 hotspot에 연결된 상태로 `/listen`에 접근했다. 두 대는 연결됐고, 한 대는 연결되지 않았으며, 한 대는 `VERBINDET...`에서 멈췄다. 이 재현에서 hotspot의 client isolation, 방화벽, client limit 또는 특정 모바일의 네트워크 상태가 원인인지는 아직 확인되지 않았다.

이전 기록에는 행사장 Wi-Fi의 client isolation이 있었다고 적혀 있었으나, 현재 제공된 재현 조건에서는 이를 확인하지 않았다. 따라서 이를 이번 증상의 확정 원인으로 보지 않고, 수동 네트워크 점검 항목으로 남긴다.

구현 전 코드 조사에서 확인한 사항:

- Listener는 페이지 로드 시 `ws(s)://<현재 호스트>/ws/listen`에 연결한다. WebSocket `open` 이벤트가 와야 연결 상태가 `connected`가 된다.
- 연결 실패 시 `error`에서 소켓을 닫고, `close` 이벤트가 발생하면 1.2초 후 재접속한다. 연결이 성공할 때까지 반복하지만, 소켓이 `CONNECTING` 상태에서 멈춰 `open`, `error`, `close` 중 어느 이벤트도 발생하지 않는 경우의 연결 제한 시간이 없다. 이 경우 화면에 `VERBINDET...`가 계속 남을 수 있다.
- UI는 연결 중(`VERBINDET...`)과 연결이 끊겨 재시도 중(`VERBINDUNG UNTERBROCHEN · VERBINDET ERNEUT`)을 구분하지만, 연결 거부·시간 초과·네트워크 도달 불가 같은 원인을 표시하지 않는다.
- 백엔드에는 Listener 최대 연결 수 제한이 없다. `BroadcastHub.register`는 연결을 accept한 뒤 Listener set에 등록하며, 이 경로에는 lock이 없다. 등록 set 변경 자체는 await 없이 실행되므로 현재 코드에서 등록 시점의 전형적인 lock deadlock을 뒷받침하는 근거는 없다. 다만 동시 등록/해제와 listener count가 여러 연결에서 일관적인지는 직접 검증되지 않았다.
- 오디오/JSON 브로드캐스트는 여러 Listener에 병렬 전송하고 느린 클라이언트는 송신이 1초 넘게 막힐 때 닫는다. 같은 Listener WebSocket에는 서로 다른 브로드캐스트 경로가 동시에 send를 시도할 수 있으므로, 동일 소켓의 동시 송신이 Starlette/ASGI 전송에서 충돌하거나 이벤트 순서를 깨뜨리는지는 추가 검증이 필요하다. 기존 느린 클라이언트 테스트는 서로 다른 두 Listener를 검증하며, 한 소켓에 겹친 송신을 검증하지 않는다.
- `/ws/listen` handler는 `hub.register`와 초기 session 상태 전송을 `try` 블록 바깥에서 수행한다. 두 단계 중 예외가 발생하면 이미 등록된 연결이 해제되지 않을 수 있어, 등록/해제 수와 Operator listener count가 어긋날 가능성을 검증해야 한다.
- Listener QR 주소는 백엔드가 UDP 소켓을 `8.8.8.8`에 연결해 운영체제가 선택한 IPv4 주소를 사용한다. 이는 인터넷 경로가 있는 어댑터 주소를 선택하는 것이지, 핫스팟에 연결된 모바일에서 도달 가능한 주소임을 보장하지 않는다.

따라서 현재 증상만으로 실제 장애 원인이 잘못된 인터페이스 IP, hotspot/무선 제한, Windows 방화벽, 브라우저 연결 정지, backend 연결 정리 문제 또는 동일 소켓 동시 송신 문제인지 확정할 수 없다. 코드상 listener 제한이나 등록 lock deadlock의 증거는 없지만, backend 동시 처리 전반이 검증 완료된 것은 아니다. 앱은 현재 실패 상태와 실제 접근 주소를 진단하기에 충분한 정보도 제공하지 않는다.

구현과 mock 기반 unit test로 확인한 결과, 4개 Listener의 동시 등록/해제에서 listener count가 맞고, 등록 자체가 deadlock을 일으키지 않았다. 이 테스트는 실제 hotspot 장애의 원인을 확정하지 않는다. Listener 소켓 전송은 연결별로 직렬화했고, endpoint는 등록 후 실패/종료 시 finally에서 Listener를 해제한다. QR 주소는 기존 자동 탐지 동작을 유지한다. 다중 NIC 환경에서 선택된 주소가 실제 모바일에서 접근 가능한지는 보장하지 않는다.

## Scope

- Listener WebSocket 연결 시도에 유한한 timeout을 두고, timeout이 발생하면 해당 소켓을 정리한 뒤 기존 재연결 흐름으로 전환한다.
- 연결 timeout, 서버의 정상 종료, 네트워크 단절을 UI 상태와 사용자 메시지에서 구별한다. 재시도 중임을 명확히 표시하고, 영구적으로 `VERBINDET...`에 머물지 않도록 한다.
- 재시도 타이머와 소켓 이벤트가 오래된 연결에 의해 중복 실행되지 않게 관리한다. 페이지 unmount 또는 새 연결 시작 시 이전 timeout/retry timer를 정리한다.
- 반복 재시도로 서버와 브라우저에 불필요한 부하를 만들지 않도록 재시도 간격을 검토한다. 재시도는 자동 복구를 유지하되, 과도한 빈도의 반복 연결이 없도록 한다.
- 기존 LAN 주소 자동 탐지 및 청취 QR 동작을 다중 네트워크 어댑터와 인터넷 연결 없는 로컬 라우터 환경에서 검토한다. 자동 탐지 결과의 실제 도달 가능성은 보장하지 않으며, QR 주소 선택·직접 입력 UI는 추가하지 않는다.
- 백엔드 연결 로그와 Operator의 Listener 수가 접속 성공/실패를 판별하는 데 일관되게 동작하는지 확인한다. 진단 정보에 인증 정보, API key 또는 쿠키를 노출하지 않는다.
- 여러 Listener의 동시 등록/해제, listener count 갱신, 한 Listener 소켓으로의 동시 오디오/JSON 송신을 재현 가능한 mock 기반 테스트로 검증한다. 실제 경합이 재현되면 해당 동작에 한해서 최소한으로 직렬화/정리하고, 재현되지 않으면 불필요한 lock을 추가하지 않는다.
- Listener handler의 accept/초기 상태 전송/수신 중 오류와 취소에서도 등록된 연결 및 listener count가 정리되는지 검증한다.
- 사용자에게 새로 표시되는 문구는 기존 Listener UI 언어 정책에 맞춰 한국어/영어/독일어를 지원한다.

## Out of scope

- Windows Hotspot, 행사장 공유기 또는 특정 노트북 무선 어댑터의 결함 수정.
- 외부 라우터/액세스 포인트 구매 또는 네트워크 구성 자동화.
- 인터넷이 차단된 상태에서 외부 번역 서비스가 작동하도록 보장하는 것.
- Listener WebSocket을 인증하거나 HTTPS/WSS 배포를 새로 도입하는 것.
- 근거 없이 Listener 최대 수를 설정하거나 현재 수 제한을 변경하는 것.
- 실제 마이크, 실제 유료 통역 API 또는 특정 장소 Wi-Fi를 자동화 테스트에 사용하는 것.

## Implementation notes

- 연결 상태는 최소한 초기 연결 중, 연결됨, 재접속 중을 구분하고, 최초 연결 실패와 이미 연결된 뒤의 끊김을 사용자에게 혼동시키지 않는다.
- 연결 timeout 처리에서 현재 활성 소켓인지 확인한 뒤 정리한다. timeout 처리 후 늦게 도착한 이전 소켓의 `open`/`close` 이벤트가 최신 연결 상태를 덮어쓰지 않아야 한다.
- 기존 `listenGenerationRef`, `socketRef`, `reconnectTimerRef` 수명주기와 React hook 패턴을 활용한다. timer 및 소켓 handler cleanup은 unmount와 재시도 모두에서 검증한다.
- 재시도 중 사용자가 `anhören`을 눌러 재생을 시작했거나 이미 재생 중일 때의 동작을 보존한다. 서버에서 번역이 꺼지거나 종료되는 기존 동작도 유지한다.
- backend 동시성 조사에서는 현재 코드 경로를 재현하는 테스트부터 작성한다. 여러 WebSocket의 동시 등록/해제 및 count 통지와 한 WebSocket에 서로 다른 브로드캐스트가 겹치는 경우를 나눠 검증한다. 테스트에서 동시 송신 문제가 확인되지 않으면 추측에 기반한 전역 lock을 도입하지 않는다.
- Listener endpoint는 등록 후 초기 상태 전송이나 receive에서 예외/취소가 일어나도 cleanup이 실행되는지 확인하고, 테스트로 확인한 수명주기에 맞춰 `try/finally` cleanup 적용 여부를 결정한다.
- QR 주소 생성을 기존 자동 선택 동작으로 유지한다. 운영체제가 선택한 주소가 사용자의 로컬 네트워크에서 도달 가능한지는 별도 수동 점검 대상으로 둔다.
- Windows Defender Firewall 및 공유기 Client/AP isolation은 앱에서 탐지할 수 없을 수 있으므로, 탐지하지 못하는 원인을 앱 오류로 오인시키지 않고 운영자 안내/진단 절차로 다룬다.

## Related files

- `frontend/src/pages/Listen/useListenAudio.ts`
- `frontend/src/pages/Listen/Listen.tsx`
- `frontend/src/pages/Listen/Listen.module.css`
- `frontend/src/pages/Operator/layout/listenQrUrl.ts`
- `frontend/src/pages/Operator/layout/useListenQr.ts`
- `frontend/src/pages/Operator/layout/ListenQrShare.tsx`
- `frontend/src/pages/Operator/translations.ts`
- `backend/services/network.py`
- `backend/api/v1/endpoints/operator.py`
- `backend/main.py`
- `backend/cli.py`
- `backend/requirements.txt`
- `backend/services/broadcast.py`
- `backend/tests/unit/test_listen_websocket.py`
- `frontend/tests/unit/Listen.test.tsx`
- `frontend/tests/unit/listenQrUrl.test.ts`
- `frontend/tests/unit/operatorNavigation.test.tsx`
- `backend/tests/unit/test_network.py`
- `backend/tests/unit/test_operator_api.py`
- `README.md`

## Acceptance criteria

- WebSocket handshake가 제한 시간 안에 완료되지 않으면 Listener가 무한히 `VERBINDET...`만 표시하지 않고 재접속 상태로 전환하며, 연결 재시도가 계속 가능하다.
- timeout 이후 이전 소켓에서 늦은 이벤트가 발생해도 정상적으로 연결된 새 소켓의 UI 상태나 재시도 timer를 망가뜨리지 않는다.
- 초기 접속 실패와 성공 후 끊김이 UI에서 구분되고, 연결 성공 시 기존 번역 상태/Listener 오디오 동작이 복구된다.
- 자동 재시도 간격은 무한히 짧아지지 않으며, 반복 연결 시도와 timer 중복이 발생하지 않는다.
- 페이지를 이동하거나 컴포넌트를 unmount하면 소켓 및 연결/재시도 timer가 정리된다.
- 여러 Listener를 동시에 연결/해제해도 backend가 연결 수를 정확히 추적하며, 하나의 Listener 전송 실패가 다른 Listener 연결이나 번역 세션을 불필요하게 중단시키지 않는다.
- 서로 다른 broadcast 경로가 동일한 Listener 소켓으로 동시에 메시지를 보내는 경우 안전성이 테스트로 확인된다. 문제가 재현되면 수정 후 메시지 손실/겹친 send가 없고 정상 Listener에 영향이 없음을 검증한다.
- Listener handler의 등록 후 초기 상태 전송 실패, 연결 종료 및 task 취소에서 연결이 정리되고 listener count가 실제 연결 수와 일치한다.
- Listener QR/URL은 기존 자동 주소 생성 동작을 유지한다. 다중 NIC 상태에서 선택된 주소가 실제 청취 기기에서 도달 가능한지는 보장하지 않는다.
- 주소 생성은 loopback 주소, 주소 미탐지, 포트/path/query 처리에서 유효한 기존 동작을 유지한다.
- Listener 연결이 실패해도 기존 연결 중인 Listener, Operator 브로드캐스트 및 번역 세션 흐름이 불필요하게 중단되지 않는다.
- 로컬 자동화 테스트는 mock WebSocket/네트워크를 사용하며 외부 서비스와 실제 오디오 장비를 호출하지 않는다.
- 필요한 backend/frontend unit test와 frontend production build가 통과한다.

## Tests

- Frontend unit: WebSocket open timeout 후 재시도, 오래된 socket 이벤트 무시, 재시도 중 연결 성공, unmount 시 timer/socket 정리를 검증한다.
- Frontend unit: 기존 자동 QR 주소 생성의 loopback 및 여러 origin/포트 조건을 검증한다.
- Backend unit: 기존 네트워크 경로 기반 IPv4 조회와 주소 미탐지 응답을 검증한다.
- Backend unit: 여러 mock Listener의 동시 등록/해제 후 listener count와 Operator 통지가 일치하는지 검증한다.
- Backend unit: 같은 mock Listener에 오디오와 JSON broadcast가 겹칠 때 동시 send, 예외, 메시지 손실 또는 ordering 문제가 발생하는지 검증한다. 문제가 확인되면 수정 후 같은 테스트로 안전성을 보장한다.
- Backend unit: Listener endpoint의 등록 이후 초기 상태 전송 실패, disconnect, 예외 및 취소에서 연결 set과 listener count가 정리되는지 검증한다.
- 기존 broadcast/listener count 및 느린 청취자 테스트를 실행해 건강한 Listener, Operator 브로드캐스트 및 번역 세션 동작이 보존되는지 확인한다.
- 검증은 프로젝트의 backend unit(`backend/tests/unit/`)과 frontend unit(`frontend/tests/unit/`) 범위에서 한다. 실제 핫스팟 및 공유기 확인은 수동 체크로 기록한다.

## Implementation result

- Frontend WebSocket handshake timeout은 8초이며, 실패 후 단일 1.2초 재시도 timer를 사용한다. 이전 socket의 늦은 open/message/close 이벤트는 무시하고 unmount 시 연결/재시도 timer와 socket을 정리한다.
- UI는 최초 연결 실패, handshake timeout, 정상 종료(close event), 연결 성공 이후 비정상 단절을 구분해 재시도 상태로 표시한다. 새 연결 상태 문구는 한국어/영어/독일어를 지원한다.
- Backend Listener별 send lock으로 오디오와 JSON 송신을 직렬화한다. 동시 4개 연결 등록/해제, 동일 socket 동시 송신, 초기 상태 전송 실패와 register 이후 예외 cleanup을 unit test로 검증한다.
- Operator network API와 QR은 기존 방식대로 운영체제의 네트워크 경로에서 선택된 IPv4 하나를 자동 사용한다. 주소 선택 및 직접 입력 UI는 두지 않으며, 다중 NIC 환경에서 자동 선택된 주소의 실제 도달 가능성은 보장하지 않는다.
- 주소 선택·직접 입력 UI 제거 후 검증 결과: backend 네트워크/API 관련 unit 15개 통과, frontend QR/Operator 관련 unit 15개 통과, TypeScript 검사 및 frontend production build 통과.
- 모바일 4대 및 Windows hotspot을 사용한 실제 네트워크 점검은 이 작업 환경에서 수행할 수 없어 아래 수동 체크를 대기 상태로 남긴다.

## Manual network check

- [ ] 노트북을 인터넷용 Wi-Fi와 모바일용 별도 핫스팟/라우터에 동시에 연결한다.
- [ ] Operator QR의 자동 주소가 모바일에서 접근 가능한 네트워크 인터페이스 주소인지 확인한다. 아니라면 접속 origin 또는 네트워크 설정을 확인한다.
- [ ] 모바일 1대에서 `/health` 응답과 `/listen` WebSocket 연결을 확인한다.
- [ ] 같은 로컬 네트워크에 모바일을 여러 대 연결하고 Operator의 Listener 수 및 각 기기의 연결 상태가 실제 접속과 일치하는지 확인한다.
- [ ] 모바일 4대를 동시에 `/listen`에 연결해 각 기기의 handshake 결과, backend 연결 로그, Operator listener count를 비교한다. 연결 실패 기기는 WebSocket handshake 단계와 접근한 노트북 인터페이스 주소를 확인해 기록한다.
- [ ] 동시에 접속/해제 및 실제 오디오 송신 중 정상 Listener들의 연결이 유지되는지 확인하고, 한 기기의 실패가 다른 기기나 Operator/번역 세션에 영향을 주는지 확인한다.
- [ ] Wi-Fi를 잠시 끊었다 다시 연결해 자동 재접속과 번역/오디오 흐름 복구를 확인한다.
- [ ] 서버를 중지하거나 잘못된 주소/포트로 접속해 연결 실패가 영구 `VERBINDET...`가 아닌 안내 가능한 상태로 표시되는지 확인한다.
- [ ] Windows 방화벽 차단, 공유기 Client/AP isolation, 핫스팟의 client limit은 앱 동작과 별개로 기록해 원인을 구분한다.

테스트 기록에는 API key, 인증 쿠키, 비밀번호 또는 민감한 네트워크 정보를 포함하지 않는다. 필요한 경우 IP는 로컬 대역이 드러나지 않도록 예시 주소로 치환하고, 사용한 인터페이스 종류 및 성공/실패 결과만 남긴다.
