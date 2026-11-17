# 072 macOS 설치 패키지

상태: 대기
우선순위: 높음

## Goal

Python과 Node.js/npm이 설치되지 않은 macOS 운영자 컴퓨터에서 설치하고 실행할 수 있는 Sermon Live 앱 패키지를 제공한다.

## Depends on

- `.todo/070-standalone-packaging-foundation.md`

## Scope

- macOS용 `.app` 및 배포 가능한 압축 이미지 형식을 만든다.
- backend, 빌드된 frontend, Scripture 리소스, PyAudio/PortAudio 런타임을 포함한다.
- 앱이 실행 중인 동안 서버를 시작·종료할 명확한 방법과 Operator/LAN Listener 주소를 제공한다.
- macOS 마이크 권한 요청에 필요한 앱 설명과 사용자 안내를 제공한다.
- Apple Silicon과 Intel 지원 범위를 정한다. Universal package가 어렵다면 아키텍처별 패키지로 구분한다.
- 사용자 데이터는 070에서 정의한 macOS 사용자별 디렉터리에 저장한다.
- macOS 방화벽에서 LAN 접속을 허용할 때 필요한 사용자 안내를 제공한다.

## Out of scope

- Windows 패키지
- 앱에 TLS 인증서나 private key를 포함하는 것
- code signing 및 notarization
- 자동 업데이트 서비스 및 CI 기반 공개 릴리스

## Implementation notes

- 패키지는 macOS에서 빌드하고 실제 Mac에서 검증한다. Windows에서 만든 바이너리를 macOS용으로 재사용하지 않는다.
- PyAudio/PortAudio와 CoreAudio 입력 장치 enumeration을 실제 Mac에서 확인한다.
- 마이크 권한 거부 시 사용자가 설정에서 다시 허용할 방법을 명확히 안내한다.
- 미서명 테스트 패키지는 macOS의 Gatekeeper 경고를 표시할 수 있음을 문서화한다. 외부 일반 공개 배포가 확정되면 서명·공증은 별도 범위로 다룬다.
- HTTPS와 모바일 Screen Wake Lock 검증은 `.todo/073-packaged-https-wake-lock.md`에서 다룬다.

## Acceptance criteria

- [ ] 패키지를 설치하거나 실행할 때 Python과 Node.js/npm 설치를 요구하지 않는다.
- [ ] 앱 시작과 종료 시 backend 프로세스와 오디오 자원이 정리된다.
- [ ] Operator 페이지와 같은 LAN의 Listener 페이지에 접속할 주소를 확인할 수 있다.
- [ ] 마이크 권한 허용 후 CoreAudio 입력 장치 목록과 Audio Test가 동작한다.
- [ ] 마이크 권한 거부/미허용 상태에서 원인과 권한 복구 방법을 확인할 수 있다.
- [ ] Operator 설정과 로그가 macOS 사용자별 데이터 위치에 저장되고 재실행 후 유지된다.

## Tests and verification

### Automated

- backend unit tests와 frontend production build를 실행한다.
- 패키지 생성 후 frontend 및 Scripture 리소스 제공을 smoke test한다.
- 패키지 파일과 로그에 API key, 비밀번호, session secret 또는 TLS private key가 포함되지 않는지 확인한다.

### Manual

- [ ] Python과 Node.js/npm이 없는 깨끗한 Mac에서 설치·실행·종료한다.
- [ ] 실제 Mac에서 마이크 권한 요청, CoreAudio 장치 enumeration, Audio Test를 확인한다. 자동 테스트에서 실제 마이크를 사용하지 않는다.
- [ ] 같은 Wi-Fi의 청중 브라우저에서 `/listen` 접속을 확인한다.
- [ ] 서버 재실행과 패키지 업데이트 후 사용자 설정이 보존되는지 확인한다.
