# 독립 실행 패키지 빌드

독립 실행 패키지는 Python runtime과 backend 의존성, 빌드된 frontend, Scripture corpus를 포함한다. 설치된 운영자 컴퓨터에는 Python과 Node.js/npm이 필요하지 않다. 패키지는 대상 OS에서 직접 빌드해야 한다.

Windows는 portable ZIP으로, macOS는 CPU 아키텍처별 `.app`/DMG로 배포한다. macOS 패키지는 해당 아키텍처의 Mac에서 빌드하고 검증해야 한다. 두 플랫폼 모두 별도 앱 런타임 설치를 요구하지 않는다.

## Windows portable package

빌드 PC에 Python과 Node.js/npm을 설치하고 저장소 루트에서 PowerShell로 실행한다. 스크립트가 `build.bat`으로 frontend를 빌드하고 PyInstaller 패키지를 만든 뒤 portable ZIP을 생성한다.

```powershell
.\packaging\build_windows.ps1
```

`build.bat`은 개발자용으로 유지한다. PyInstaller 결과물은 `dist\sermon-live\`에, 배포 ZIP은 `dist\sermon-live-windows-x64.zip`에 생성된다. ZIP 안의 `README.txt`에는 첫 Operator 비밀번호 설정, 실행·종료, 방화벽, 업데이트 절차가 포함된다.

사용자는 ZIP을 원하는 폴더에 풀고 `sermon-live.exe`를 실행한다. 코드 서명은 범위 밖이므로 Windows SmartScreen 경고가 표시될 수 있으며, 신뢰할 수 있는 배포 출처의 파일만 실행한다. Operator 비밀번호와 session secret은 `%LOCALAPPDATA%\Sermon Live\.env`에 설정한다. 앱은 서버 시작 시 Operator 및 Listener 주소를 콘솔에 표시하고, 종료하려면 콘솔에서 `Ctrl+C`를 누른다. 진단 로그가 필요하면 `sermon-live.exe --verbose`로 실행하며 로그는 사용자 데이터 폴더의 `logs` 아래 저장된다. Windows 방화벽에서 LAN 접속을 허용할 때는 Private network만 선택하고 port forwarding을 설정하지 않는다.

## macOS architecture-specific DMG

macOS 패키지는 Apple Silicon용 `arm64`와 Intel용 `x86_64`를 별도로 만든다. Universal binary는 제공하지 않으며, 빌드에 사용할 Python runtime과 Mac의 아키텍처가 같아야 한다. 빌드 PC에는 Python 3, Node.js/npm, Xcode Command Line Tools가 필요하다. PyAudio wheel을 사용할 수 없어 빌드에 실패하면 PortAudio와 Xcode Command Line Tools를 설치한 뒤 다시 시도한다.

```bash
brew install portaudio
xcode-select --install
```

```bash
bash ./packaging/build_macos.sh
```

스크립트는 frontend를 빌드하고 Python 의존성 및 PyInstaller를 설치한 뒤 `.app`과 압축 DMG를 만든다. 결과물은 `dist/macos/arm64/sermon-live-macos-arm64.dmg` 또는 `dist/macos/x86_64/sermon-live-macos-x86_64.dmg`에 생성된다. 다른 아키텍처용 파일은 해당 아키텍처 Mac에서 별도로 빌드한다.

DMG 안의 `Sermon Live.app`과 `Start Sermon Live.command`를 같은 폴더(예: `/Applications`)에 복사하고 `.command`를 실행한다. Terminal 창에 Operator 및 Listener 주소가 표시된다. 실행 중에는 Terminal을 닫지 말고 `Ctrl+C`로 서버와 오디오 자원을 종료한다. 앱은 서명·공증되지 않아 Gatekeeper 경고가 표시될 수 있다. 신뢰할 수 있는 출처의 패키지만 실행한다.

첫 오디오 장치 조회에서 macOS 마이크 권한 요청을 허용한다. 거부했거나 장치 목록이 비어 있으면 `System Settings > Privacy & Security > Microphone`에서 Sermon Live를 허용하고 서버를 재시작한다. macOS 방화벽이 수신 연결을 묻는 경우 같은 로컬 네트워크에서 Listener를 쓸 때만 앱 연결을 허용한다. 방화벽을 전체 비활성화하거나 router port forwarding을 설정하지 않는다.

사용자 설정과 로그는 `~/Library/Application Support/Sermon Live`에 저장된다. 업데이트 시 서버를 종료한 뒤 `.app`과 `.command`를 함께 교체하고 이 사용자 데이터 폴더는 삭제하지 않는다.

## 패키지 HTTPS 설정

HTTPS는 선택 사항이다. 두 패키지 모두 사용자 데이터 `.env`에서
`APP_SSL_CERTFILE`과 `APP_SSL_KEYFILE`을 읽는다.

- Windows: `%LOCALAPPDATA%\Sermon Live\.env`
- macOS: `~/Library/Application Support/Sermon Live/.env`

인증서는 설치/패키지 폴더 밖의 사용자 데이터 `tls` 디렉터리 등에 보관하고,
두 설정 모두 절대 경로로 지정한다. 인증서 SAN에는 Listener 기기가 접속할
LAN IP 또는 DNS 이름이 있어야 하며, 청중 기기가 인증서를 신뢰해야 한다.
LAN IP는 `localhost` secure-context 예외가 아니다.

로컬 CA를 사용하는 경우 관리 대상 청중 기기에는 공개 인증서 `rootCA.pem`만
설치한다. `rootCA-key.pem`과 leaf private key `lan-key.pem`은 운영자 PC에
보관하며 패키지에 넣거나 Listener 기기에 전달하지 않는다. 인증서 경고를
우회하도록 안내하지 않는다. 신뢰할 수 있는 HTTPS 페이지는 WSS를 사용하고,
HTTP 또는 secure context가 아닌 경우 Wake Lock은 활성 상태로 표시되지 않는다.
TLS 설정이 둘 다 없으면 기존 HTTP 동작을 유지하고, 한쪽만 설정하면 시작 시
검증 오류가 발생한다.

## 사용자 데이터와 이전

패키지 실행 시 Windows 데이터는 `%LOCALAPPDATA%\Sermon Live`, macOS 데이터는 `~/Library/Application Support/Sermon Live`에 저장한다. source 실행은 기존 `backend/.env`, `backend/data/`, `backend/logs/` 위치를 계속 사용한다. 패키지 업데이트는 사용자 데이터 디렉터리를 덮어쓰지 않는다.

기존 source 실행에서 설정을 옮길 때는 패키지 실행 파일에 이전 프로젝트 루트를 지정한다.

```powershell
.\dist\sermon-live\sermon-live.exe --migrate-from "C:\path\to\sermon-live"
```

이 명령은 `backend/.env`와 `backend/data/operator.json`만 대상 사용자 데이터 폴더에 복사하며, 대상 파일이 이미 있으면 보존한다. 이전이 끝나면 패키지를 다시 실행한다. `.env`와 `operator.json`에는 비밀정보가 있을 수 있으므로 복사본과 백업을 안전하게 관리한다.

macOS 아키텍처별 빌드 스크립트와 패키지 안내가 추가되었다. 실제 Mac 빌드, 마이크 권한, CoreAudio, 방화벽, Listener 및 업데이트 보존 검증은 macOS에서 수행해야 한다. 앱 서명·공증은 범위 밖이다.
