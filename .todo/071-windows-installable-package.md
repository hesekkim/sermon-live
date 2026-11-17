# 071 Windows 설치 패키지

상태: 진행
우선순위: 높음

## Goal

Python과 Node.js/npm이 설치되지 않은 Windows 운영자 컴퓨터에 설치해 실행할 수 있는 Sermon Live 패키지를 제공한다.

## Depends on

- `.todo/done/070-standalone-packaging-foundation.md`

## Scope

- Windows용 자체 포함 패키지와 사용자가 실행할 수 있는 명확한 시작·종료 진입점을 만든다.
- portable ZIP으로 배포한다. 관리자 권한과 설치 프로그램 제작 도구가 필요 없고, 앱 파일만 교체해 업데이트하면서 사용자 데이터를 보존할 수 있다.
- backend, 빌드된 frontend, Scripture 리소스, PyAudio/PortAudio 런타임을 포함한다.
- 사용자 데이터는 070에서 정의한 Windows 사용자별 디렉터리에 저장한다.
- 서버가 로컬 Operator URL과 LAN Listener URL을 안내한다.
- Windows Defender Firewall에서 Private network만 허용하도록 안내한다. Router port forwarding을 요구하거나 자동으로 설정하지 않는다.

## Out of scope

- macOS 패키지
- 앱에 TLS 인증서나 private key를 포함하는 것
- Windows code signing 및 SmartScreen 경고 제거
- 자동 업데이트 서비스 및 CI 기반 공개 릴리스

## Implementation notes

- 패키지는 Windows에서 빌드하고 실제 Windows 환경에서 검증한다.
- PyAudio/PortAudio의 native binary 및 audio device enumeration이 패키지 안에서 동작하는지 확인한다.
- Operator 및 Listener는 기존 브라우저 기반 UI를 사용한다.
- `build.bat`은 개발자용으로 유지하며, 사용자 PC에서 실행할 단계로 안내하지 않는다.
- HTTPS와 모바일 Screen Wake Lock 검증은 `.todo/073-packaged-https-wake-lock.md`에서 다룬다.

## Acceptance criteria

- [x] 패키지를 풀어 실행할 때 Python과 Node.js/npm 설치를 요구하지 않는다.
- [ ] 실행 진입점으로 서버를 시작하고 종료할 수 있으며, 종료 후 backend 프로세스가 남지 않는다.
- [x] Operator 페이지와 같은 LAN의 Listener 페이지에 접속할 주소를 확인할 수 있다.
- [ ] Operator 설정과 로그가 Windows 사용자별 데이터 위치에 생성되고 패키지 재실행 후 유지된다.
- [x] private network 방화벽 안내와 port forwarding 금지 안내를 제공한다.
- [x] PyAudio가 오류 없이 로드되고 OS 입력 장치 목록을 조회한다.

## Tests and verification

### Automated

- [x] backend unit tests와 frontend production build를 실행한다.
- [x] 패키지 생성 후 frontend 및 Scripture 리소스 제공을 smoke test한다.
- [x] ZIP에 `.env`, Operator 설정, 로그, TLS private key가 포함되지 않으며 smoke 실행 로그에 테스트 secret이 나오지 않는지 확인한다.

### Manual

- [ ] Python과 Node.js/npm이 없는 별도 깨끗한 Windows 환경에서 실행·종료한다. (현재 개발 PC의 제한된 PATH 검증과 구분)
- [ ] 실제 입력 장치 enumeration과 Operator Audio Test를 확인한다. 자동 테스트에서 실제 마이크를 사용하지 않는다.
- [ ] 같은 Wi-Fi의 청중 브라우저에서 `/listen` 접속을 확인한다.
- [ ] 서버 재실행과 패키지 업데이트 후 사용자 설정이 보존되는지 확인한다.

### Verification notes

- Windows 11에서 portable ZIP을 생성하고, 추출한 패키지를 Python/npm이 PATH에 없는 조건으로 실행했다. `/health`, Operator 페이지·frontend bundle, 로그인 및 인증된 설정 API가 응답했다.
- ZIP에 실행 파일, frontend, Scripture 리소스, `README.txt`가 있고 사용자 설정·로그·비밀 파일은 포함되지 않는 것을 확인했다.
- 패키지 오디오 열거 helper가 OS 입력 장치 3개를 조회했다. 실제 Operator Audio Test, 별도 PC, 다른 기기의 Listener 접속, 데이터 이전·업데이트 보존은 아직 수동 확인하지 않았다.
- 종료 확인은 개발 서버 프로세스를 직접 종료해 잔여 프로세스가 없는 것까지 확인했다. 콘솔 `Ctrl+C`를 통한 정상 종료 확인은 남아 있다.
