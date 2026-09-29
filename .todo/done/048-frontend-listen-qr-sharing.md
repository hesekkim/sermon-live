# 048 Listen QR 공유

상태: 완료

## Goal

Operator 우측 상단에서 같은 Wi-Fi/LAN 청중이 `/listen`으로 접속할 QR을 열고, URL을 복사할 수 있게 한다.

## Why

청중에게 URL과 현재 PC의 LAN 주소를 직접 안내하는 절차가 번거롭다. 공유기나 네트워크가 바뀔 수 있으므로 QR을 열 때 현재 LAN 주소를 다시 확인해야 한다.

## Implementation notes

- Operator 전체 화면에서 접근 가능한 QR icon action과 공용 `Dialog`를 사용한다.
- Backend에 Operator 인증이 필요한 현재 LAN 주소 runtime endpoint를 제공한다. 주소 감지 실패 시 loopback 주소를 유효한 공유 주소로 반환하지 않는다.
- Frontend는 Dialog를 열 때 주소를 조회하고, 현재 scheme/port를 적용해 `/listen` URL을 만든다. Operator가 localhost로 열린 경우 감지한 LAN IPv4를 사용한다.
- Dialog에 QR, 읽을 수 있는 URL, 복사, 재조회, 실패 안내를 표시한다. 기존 ko/en/de 번역을 유지한다.
- QR은 일반 입력 문자열을 담고 Operator 인증정보를 포함하지 않는다.
- 자동 주소 감지는 best-effort다. 외부망 접근, 수동 주소 설정, 실제 네트워크 장비 검증은 범위에서 제외한다.

## Acceptance criteria

- QR 버튼은 Operator 전체 화면에서 키보드 접근 가능하고, Dialog는 공용 컴포넌트를 사용한다.
- 같은 Wi-Fi 청중이 스캔할 수 있는 `/listen` 주소를 표시하며, URL 복사 및 주소 재조회가 동작한다.
- 주소를 감지하지 못하면 localhost QR 대신 이해 가능한 오류와 재시도 경로를 표시한다.
- UI 문구는 한국어, 영어, 독일어를 제공한다.
- 외부 Wi-Fi 또는 모바일 데이터에서 사설 LAN IP로 연결할 수 없다는 범위를 티켓/운영 안내에 명시한다.

## Tests

- Backend unit: LAN 주소 감지 성공/실패, 인증 보호 및 endpoint response.
- Frontend unit: localhost + 감지 IP, 기존 LAN origin, 주소 조회 실패, 재조회 및 URL 복사.
- Frontend production build와 backend unit suite.
- 수동 확인 가능 시 동일 Wi-Fi의 모바일 기기로 QR scan 및 WebSocket 연결을 확인한다.

## Risks

- DHCP 주소가 변경되어도 이전에 스캔하거나 저장한 QR URL은 갱신되지 않는다. 지속적인 주소가 필요하면 DHCP reservation 또는 LAN DNS가 필요하다.
- 다중 NIC, client isolation, 방화벽에 따라 자동 감지한 IP에 다른 기기가 접근하지 못할 수 있다.
- 같은 LAN을 벗어난 접속에는 공개 도메인 또는 터널 등 별도 구성이 필요하다.

## Completion

- Backend unit suite: 120 passed.
- QR 관련 frontend tests: 5 passed; frontend production build succeeded.
- 전체 frontend unit suite에서는 QR과 무관한 기존 Listener 상태 문구 테스트와 Operator 비밀번호 오류 selector 테스트가 실패하며, 두 실패는 단독 실행으로 재현했다.
- 동일 Wi-Fi 모바일 기기로 실제 QR scan 및 WebSocket 연결은 이 환경에서 확인하지 못했다.
