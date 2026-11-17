# sermon-live

교회 LAN에서 설교를 한국어에서 독일어로 실시간 통역하는 애플리케이션입니다.

청중은 같은 Wi-Fi에 연결된 휴대폰 브라우저로 접속합니다. 운영자 노트북이 설교단 마이크의 음성을 캡처해 주입된 통역기(OpenAI Realtime을 활성화하거나 무료 로컬 테스트용 Echo)를 통해 처리하고, PCM 오디오와 자막을 WebSocket으로 전송합니다.

## 구성

- `backend/` — FastAPI, 오디오 캡처, 통역 adapter, 방송
- `frontend/` — Vite React 청취 페이지와 운영자 화면
- `.github/instructions/` — Copilot 작업 지침
- `.cursor/rules/` — Cursor 작업 규칙

## 실행

### Windows 빌드 및 실행

저장소 루트에서 `build.bat`을 실행하면 frontend가 `frontend/dist`에 빌드되고 backend Python 모듈의 문법을 검사합니다. Backend는 별도로 컴파일된 바이너리가 아닌 Python 애플리케이션입니다. `run.bat`을 실행하면 backend가 시작되고 같은 프로세스에서 빌드된 frontend를 제공합니다.

빌드가 끝나면 `run.bat`을 실행하세요. 백엔드 진단 로그를 파일에도 저장하려면 `run.bat --verbose`로 실행하세요. 로그는 `backend/logs/sermon-live.log`에 저장되고 5 MB마다 회전하며 이전 파일 3개를 보관합니다. 세션 시작 시 실제 타이머 설정, 타이머 경고·연장, 종료 사유와 경과 시간 및 백엔드 서비스 로그가 기록됩니다. 상세 모드는 애플리케이션 서비스와 서버 로그를 DEBUG로 설정하며, 외부 API 라이브러리의 상세 요청 로그는 켜지지 않습니다.

기본 설정에서는 운영자 노트북에서 `http://localhost:8080/operator`를 열고, 같은 네트워크의 청중 기기에서 `http://<LAN-IP>:8080/listen`을 엽니다. 모바일에서 Screen Wake Lock을 사용하려면 아래의 HTTPS 설정을 적용하세요.

Backend를 직접 실행하려면:

```powershell
cd sermon-live/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade "pip>=26.1.2"
pip install -r requirements.txt
copy .env.example .env
python main.py
```

macOS에서는 CoreAudio를 지원하는 PortAudio 빌드와 함께 PyAudio를 설치하고, backend를 실행하는 앱 또는 터미널에 마이크 접근 권한을 부여하세요. 운영자 기기 설정은 기본적으로 CoreAudio 입력을 사용합니다. 예상한 실제 입력 장치가 보이지 않으면 모든 Host API 장치 목록을 사용하세요.

기본 HTTP 설정에서는 `http://<LAN-IP>:8080/operator`(또는 Vite 개발 서버의 `http://localhost:5173/operator`)를 열어 통역기를 선택하고 API key를 저장한 다음 캡처를 시작하세요. HTTPS를 설정했다면 운영자와 청중 모두 `https://<LAN-IP>:8080` origin을 사용합니다. 청중용 주소 경로는 `/listen`입니다.

backend를 시작하기 전에 `backend/.env`를 편집해 Operator secret 두 개를 설정하세요. 다음 명령으로 서로 다른 값을 생성할 수 있습니다.

```powershell
python -c "import secrets; print(secrets.token_urlsafe(24))"
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

첫 번째 값은 `APP_OPERATOR_PASSWORD`에, 두 번째 값은 `APP_OPERATOR_SESSION_SECRET`에 설정하세요. Session secret은 서버 전용 서명 키이며 로그인할 때 입력하는 비밀번호가 아닙니다. Sermon Session 기능과도 관련이 없습니다. 인증 쿠키에 서명해 backend가 위조되거나 변조된 세션을 거부할 수 있게 합니다. `.env`를 commit하지 말고, 두 값을 서로 바꿔 사용하지 마세요. 둘 중 하나라도 비어 있으면 Operator 로그인과 보호된 API를 사용할 수 없습니다. Operator 로그인에는 로컬 비밀번호만 사용하며 이메일 계정이나 외부 인증 서비스는 필요하지 않습니다.

비밀번호를 변경해도 이미 발급된 쿠키는 취소되지 않으며, 12시간 후 만료됩니다. 모든 Operator 세션을 즉시 취소해야 한다면 session secret도 교체하세요.

`APP_ALLOWED_ORIGINS`에는 Operator 브라우저에서 사용하는 정확한 origin을 지정해야 합니다. 기본값에는 Vite localhost URL이 포함되어 있습니다. 노트북 LAN 주소로 통합 UI를 열 경우 해당 origin을 추가하세요(예: `http://192.168.1.20:8080`). `*`는 사용하지 마세요.

Operator API, 오디오 도구, `/ws/operator`에는 로그인이 필요합니다. `/health`, `/listen`, `/ws/listen`은 LAN 기기에서 로그인 없이 사용할 수 있습니다. 해당 Wi-Fi에 연결된 누구나 실시간 오디오와 자막을 들을 수 있습니다. Windows에서는 연결된 네트워크를 **Private**로 설정하고, Windows Defender Firewall에서 Python/sermon-live를 **Private networks**에만 허용하세요. 이 서버를 위해 라우터 포트 포워딩을 활성화하지 마세요.

기본 설정은 HTTP와 `ws://`를 사용합니다. 같은 네트워크의 능동적인 공격자가 비밀번호와 세션 쿠키를 엿보거나 탈취할 수 있습니다. Operator 인증만으로 전송 과정의 위험이 사라지지는 않으므로 신뢰할 수 있는 사설 LAN에서만 사용하세요.

### 모바일 LAN에서 HTTPS/WSS 사용

Screen Wake Lock은 secure context에서만 사용할 수 있습니다. 모바일 기기에서 접속하는 LAN IP는 `localhost` 예외에 해당하지 않으므로, 인증서 경고를 무시하지 않고 신뢰할 수 있는 HTTPS origin을 사용해야 합니다. 아래 절차는 운영자 PC에서 로컬 CA를 만들고 각 청중 기기에 CA 공개 인증서를 신뢰하도록 설치합니다. 공개 인증서 외의 CA 개인 키(`rootCA-key.pem`)는 공유하지 마세요.

1. Windows에 `mkcert`를 설치하고 로컬 PC의 신뢰 저장소에 CA를 등록합니다. 공식 설치 방법은 Chocolatey 또는 Scoop입니다.

   ```powershell
   choco install mkcert
   mkcert -install
   ```

2. PC의 현재 LAN IPv4 주소에 대한 인증서를 만듭니다. `$lanIp` 값을 실제 주소로 바꾸세요. 인증서와 키는 저장소 밖에 보관합니다.

   ```powershell
   $lanIp = '192.168.1.20'
   $certDir = Join-Path $env:LOCALAPPDATA 'sermon-live\tls'
   New-Item -ItemType Directory -Force $certDir | Out-Null
   mkcert -cert-file (Join-Path $certDir 'lan.pem') -key-file (Join-Path $certDir 'lan-key.pem') $lanIp localhost 127.0.0.1
   mkcert -CAROOT
   ```

3. `mkcert -CAROOT`가 출력한 폴더의 `rootCA.pem`만 각 청중 기기에 안전하게 전달해 설치합니다. `rootCA-key.pem`은 절대 전달하지 않습니다. 루트 CA를 신뢰시키면 이 PC의 CA 개인 키가 서명한 다른 인증서도 해당 기기가 신뢰하게 되므로, 조직에서 관리하는 기기에만 적용하고 `certutil -hashfile "<CA 폴더>\rootCA.pem" SHA256`으로 인증서 지문을 별도 경로에서 확인하세요. 기기에서 더는 사용하지 않으면 프로파일/CA 신뢰를 제거합니다. iPhone/iPad에서는 인증서 프로파일을 설치한 다음 **설정 → 일반 → 정보 → 인증서 신뢰 설정**에서 해당 루트 인증서의 전체 신뢰를 켭니다. Android의 사용자 CA 설치와 신뢰 동작은 OS·브라우저에 따라 다를 수 있으므로 실제 사용하는 Chrome에서 아래 secure-context 검사를 통과하는지 확인합니다. 통과하지 않으면 Android에서는 이 로컬 CA 방식을 지원 경로로 간주하지 말고, 기기가 기본 신뢰하는 공개 CA 인증서와 LAN 도메인/DNS 구성을 사용하세요.
4. `backend/.env`에서 두 경로를 설정합니다. 인증서와 키는 반드시 함께 설정해야 합니다.

   ```dotenv
   APP_SSL_CERTFILE="C:/Users/<user>/AppData/Local/sermon-live/tls/lan.pem"
   APP_SSL_KEYFILE="C:/Users/<user>/AppData/Local/sermon-live/tls/lan-key.pem"
   ```

5. `run.bat`으로 서버를 다시 시작하고, 서버가 출력한 HTTPS Listener 주소를 엽니다. 브라우저에서 `window.isSecureContext === true`, `navigator.wakeLock` 사용 가능 여부와 Listener 연결을 확인합니다. HTTPS 페이지에서는 WebSocket이 자동으로 WSS를 사용합니다.

인증서가 없으면 기존 HTTP 동작은 유지됩니다. HTTP에서는 Listener가 이를 화면에 알리고 Wake Lock이 활성화된 것처럼 표시하지 않습니다. LAN IP가 바뀌면 새 IP를 포함한 인증서를 다시 만들어야 합니다. 이 로컬 CA 방식은 기기별 신뢰 설치가 필요하므로, 이를 관리하기 어려운 배포 환경에서는 기기들이 신뢰하는 공개 CA 인증서와 로컬 DNS가 있는 도메인을 사용하세요.

Screen Wake Lock은 페이지가 보이는 동안 자동 화면 꺼짐을 막을 뿐, 사용자가 화면을 직접 잠그거나 앱을 백그라운드로 보낸 뒤 WebSocket 및 오디오 재생이 계속되는 것을 보장하지 않습니다. 백그라운드 재생 여부는 기기별 실기기 검증이 필요합니다.

Frontend 개발 서버:

```powershell
cd sermon-live/frontend
npm install
npm run dev
```

휴대폰에서는 `localhost`가 아니라 노트북의 LAN IP를 사용해야 합니다. Listener가 계속 연결 중으로 표시되면 Windows Firewall 설정과 네트워크에서 기기 간 통신이 허용되는지 확인하세요.

## 통역기 주입

`APP_INTERPRETER=echo|openai`

Pipeline 코드에서 vendor 이름을 기준으로 분기하지 마세요. 새 provider를 추가하려면 `LiveInterpreter`를 구현하고 factory에 등록하세요.

## Sermon Session

Sermon Session은 애플리케이션에서 의도적으로 비활성화되어 있습니다. API router와 Operator 페이지 route는 등록되어 있지 않으며, 통역 세션은 설교 데이터를 불러오거나 노출하지 않습니다. 향후 작업을 위해 endpoint, store, UI 소스, JSON 데이터는 보존되어 있습니다. 다시 활성화하려면 해당 route를 명시적으로 등록해야 합니다.
