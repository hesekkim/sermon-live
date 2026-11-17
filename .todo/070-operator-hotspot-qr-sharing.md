# 070 Operator 핫스팟 및 Listener QR 공유

상태: 진행 (Windows 실기기 검증 대기)
우선순위: 높음 (청중이 핫스팟에 연결하고 Listener를 여는 절차 단순화)

## Goal

Operator의 QR 공유 화면에서 핫스팟 접속용 Wi-Fi QR과 Listener URL QR을 함께 표시한다. 현재 실행 구조에서는 핫스팟 정보를 수동 입력하고, 한 화면에서 청중이 핫스팟에 연결한 뒤 Listener를 열도록 안내한다.

## User flow

1. Operator QR 화면에서 SSID, 보안 방식, 비밀번호, 핫스팟 IPv4를 입력한다.
2. 입력값이 유효하면 Wi-Fi 연결 QR과 해당 핫스팟의 Listener URL QR을 같은 화면에 표시한다.
3. 청중은 Wi-Fi QR을 스캔해 핫스팟에 연결한 다음 Listener QR을 스캔해 `/listen`을 연다.
4. 입력값이 없거나 유효하지 않으면 다음 조치를 안내하고 현재 Listener QR 공유 동작은 계속 사용할 수 있게 한다.

Wi-Fi 연결과 웹사이트 열기는 표준 QR 형식이 서로 다르므로, 두 QR을 하나의 코드로 합치지 않는다.

## Scope

- Operator QR 화면에서 Windows Mobile Hotspot 정보를 수동 입력할 수 있게 한다. 자동 조회는 패키징 및 capability 제약으로 보류한다.
- 운영자가 입력한 핫스팟 IPv4 주소를 사용한다. 기본 인터넷 경로에서 선택한 주소를 핫스팟 주소라고 가정하지 않는다.
- Operator QR 공유 화면에 Wi-Fi 연결 QR과 핫스팟 주소를 사용하는 Listener URL QR을 함께 표시한다.
- 기존 LAN/공유기 환경의 Listener QR 동작은 보존하고, Windows 핫스팟 정보가 없거나 지원되지 않을 때 기존 경로로 안전하게 fallback한다.
- QR 생성에는 기존 `qrcode.react` 의존성을 사용한다.

## 보안 및 개인정보

- 비밀번호 입력은 인증된 Operator QR 화면에서만 이뤄지며 공개 Listener API나 로그에 기록하지 않는다.
- 입력값은 backend/data 또는 브라우저 저장소에 저장하지 않는다. 메모리에만 유지하고 Operator QR 화면을 닫을 때 폐기한다.
- 비밀번호를 읽는 지원 API가 없거나 실행 권한이 부족한 경우 OS 내부 파일을 직접 파싱하거나 보호 경계를 우회하지 않는다.
- Wi-Fi QR의 문자열 escaping 및 WPA/WPA2/WPA3 등 실제 핫스팟 보안 타입을 올바르게 처리한다.

## Out of scope

- Listener 접근 인증 변경. `/listen` 및 `/ws/listen`은 같은 핫스팟에 연결된 청중이 접근하도록 현재 공개 동작을 유지한다.
- 공유기 설정, 포트 포워딩, 인터넷을 통한 원격 접속 설정.
- Windows Settings 앱 자체를 조작하거나 화면을 캡처하는 방식.
- macOS/Linux 핫스팟 정보를 자동 조회하는 기능.
- 브라우저나 다른 앱에서 Wi-Fi에 자동 연결하는 것. QR을 스캔한 뒤 OS가 제공하는 연결 동작을 사용한다.

## Related files

- `frontend/src/pages/Operator/layout/ListenQrShare.tsx`
- `frontend/src/pages/Operator/layout/useListenQr.ts`
- `frontend/src/pages/Operator/layout/listenQrUrl.ts`
- `frontend/src/pages/Operator/layout/ListenQrShare.module.css`
- `frontend/src/pages/Operator/layout/hotspotQr.ts`
- `backend/api/v1/endpoints/operator.py`
- `backend/services/network.py`
- `backend/tests/unit/test_network.py`
- `backend/tests/unit/test_operator_api.py`
- `frontend/tests/unit/listenQrUrl.test.ts`
- `frontend/tests/unit/ListenQrShare.test.tsx`
- `frontend/tests/unit/hotspotQr.test.ts`
- `.todo/done/048-frontend-listen-qr-sharing.md`

## 구현 결정

- Microsoft의 [`NetworkOperatorTetheringManager.GetCurrentAccessPointConfiguration`](https://learn.microsoft.com/en-us/uwp/api/windows.networking.networkoperators.networkoperatortetheringmanager.getcurrentaccesspointconfiguration?view=winrt-26100)는 `wiFiControl` 앱 capability가 필요하다. 현재 앱은 `run.bat`에서 일반 Python 프로세스로 실행되고 패키지 매니페스트가 없어 이 capability를 선언할 수 없으므로 자동 조회는 보류한다.
- 사용자 결정에 따라 자동 조회 대신 수동 입력 경로를 구현하고, 비밀번호를 backend/data 등에 지속 저장하지 않는다.
- 핫스팟 Listener QR은 사용자가 입력한 사설 IPv4를 사용한다. 기존 LAN Listener QR은 핫스팟 정보가 완성되지 않았을 때 fallback으로 표시한다.
- 자동 OS 조회와 핫스팟 인터페이스 식별은 보류한다. Windows 실기기 확인은 남아 있다.

## Acceptance criteria

- [ ] 지원되는 Windows 환경에서 핫스팟 상태, SSID, 보안 타입 및 비밀번호를 자동 조회한다. 패키징과 `wiFiControl` capability가 필요해 보류한다.
- [x] 자동 조회를 사용할 수 없을 때 SSID/보안 타입/비밀번호를 수동 입력할 수 있고, 입력값은 화면을 닫으면 폐기된다.
- [x] 핫스팟 접속용 QR과 핫스팟 네트워크의 `/listen` URL QR을 Operator의 한 화면에서 확인할 수 있다.
- [x] 입력값이 없거나 유효하지 않을 때 다음 조치를 안내하며 기존 Listener QR 공유 기능은 계속 동작한다.
- [x] Listener URL은 기본 인터넷 인터페이스가 아니라 핫스팟에 연결된 청중이 도달 가능한 주소를 사용한다. 현재는 입력한 사설 IPv4를 사용한다.
- [x] Wi-Fi QR encoding/escaping, 비밀번호·SSID 입력 검증, 핫스팟 IPv4 URL 구성을 단위 테스트로 검증한다.
- [x] UI 문구는 한국어, 영어, 독일어를 제공한다.
- [ ] Windows 실기기에서 핫스팟 연결 QR scan, Listener QR 접속, `/ws/listen` 연결을 확인한다.

## 검증

- `npm test -- tests/unit/hotspotQr.test.ts tests/unit/ListenQrShare.test.tsx tests/unit/listenQrUrl.test.ts tests/unit/operatorNavigation.test.tsx` — 24개 통과
- `npm run build` — 성공
- `git diff --check` — 성공

## Risks

- Windows Mobile Hotspot 정보 API는 `wiFiControl` capability와 패키지 매니페스트가 필요하다. 자동 조회를 재개할 때 패키징 및 권한을 다시 검증해야 한다.
- 운영자가 입력하는 IPv4 주소가 잘못되거나 방화벽·client isolation 설정이 있으면 청중이 Listener에 연결하지 못할 수 있다.
- Wi-Fi QR을 화면에 띄우면 주변 사람이 핫스팟 비밀번호를 스캔할 수 있다. Operator는 신뢰할 수 있는 장소에서만 표시해야 한다.
- QR 형식의 인증 방식과 escape 규칙이 맞지 않으면 일부 기기에서 연결에 실패할 수 있으므로 실제 iOS/Android 기기로 검증한다.
