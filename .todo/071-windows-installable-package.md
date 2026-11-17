# 071 Windows 설치 패키지

상태: 대기
우선순위: 높음

## Goal

Python과 Node.js/npm이 설치되지 않은 Windows 운영자 컴퓨터에 설치해 실행할 수 있는 Sermon Live 패키지를 제공한다.

## Depends on

- `.todo/070-standalone-packaging-foundation.md`

## Scope

- Windows용 자체 포함 패키지와 사용자가 실행할 수 있는 명확한 시작·종료 진입점을 만든다.
- 설치형 또는 portable 배포 형태는 업데이트, 사용자 데이터 보존, 운영 편의성을 비교해 결정한다.
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

- [ ] 패키지를 설치하거나 풀어 실행할 때 Python과 Node.js/npm 설치를 요구하지 않는다.
- [ ] 실행 진입점으로 서버를 시작하고 종료할 수 있으며, 종료 후 backend 프로세스가 남지 않는다.
- [ ] Operator 페이지와 같은 LAN의 Listener 페이지에 접속할 주소를 확인할 수 있다.
- [ ] Operator 설정과 로그가 Windows 사용자별 데이터 위치에 생성되고 패키지 재실행 후 유지된다.
- [ ] private network 방화벽 안내와 port forwarding 금지 안내를 제공한다.
- [ ] PyAudio가 오류 없이 로드되고 OS 입력 장치 목록을 조회한다.

## Tests and verification

### Automated

- backend unit tests와 frontend production build를 실행한다.
- 패키지 생성 후 frontend 및 Scripture 리소스 제공을 smoke test한다.
- 패키지 파일과 로그에 API key, 비밀번호, session secret 또는 TLS private key가 포함되지 않는지 확인한다.

### Manual

- [ ] Python과 Node.js/npm이 없는 깨끗한 Windows 환경에서 설치·실행·종료한다.
- [ ] 실제 입력 장치 enumeration과 Operator Audio Test를 확인한다. 자동 테스트에서 실제 마이크를 사용하지 않는다.
- [ ] 같은 Wi-Fi의 청중 브라우저에서 `/listen` 접속을 확인한다.
- [ ] 서버 재실행과 패키지 업데이트 후 사용자 설정이 보존되는지 확인한다.
