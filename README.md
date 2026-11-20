# sermon-live

Local PC에서 설교를 한국어에서 독일어로 실시간 통역하고, Berlin relay를 통해 원격 Listener에 전달하는 애플리케이션입니다.

운영자는 Local PC의 Operator 화면을 사용합니다. 청중은 별도 정적 앱인 `listener-frontend/`를 Vercel에서 열고, 방송 코드와 비밀번호로 입장해 Berlin relay의 자막과 Opus 오디오를 수신합니다.

## 구성

- `backend/` — FastAPI, 오디오 캡처, 통역 adapter, 방송
- `frontend/` — Local PC Operator 화면
- `listener-frontend/` — Berlin relay 전용 Vercel Listener 화면
- `.github/instructions/` — Copilot 작업 지침
- `.cursor/rules/` — Cursor 작업 규칙

## 실행

### Windows 빌드 및 실행

저장소 루트에서 `build.bat`을 실행하면 frontend가 `frontend/dist`에 빌드되고 backend Python 모듈의 문법을 검사합니다. Backend는 별도로 컴파일된 바이너리가 아닌 Python 애플리케이션입니다. `run.bat`을 실행하면 backend가 시작되고 같은 프로세스에서 빌드된 frontend를 제공합니다.

Python runtime과 빌드된 frontend를 포함하는 Windows/macOS 독립 실행 패키지는 [패키징 안내](docs/packaging.md)를 참고하세요. macOS 패키지는 대상 CPU 아키텍처의 Mac에서 별도로 빌드해야 합니다.

빌드가 끝나면 `run.bat`을 실행하세요. 백엔드 진단 로그를 파일에도 저장하려면 `run.bat --verbose`로 실행하세요. 로그는 `backend/logs/sermon-live.log`에 저장되고 5 MB마다 회전하며 이전 파일 3개를 보관합니다. 세션 시작 시 실제 타이머 설정, 타이머 경고·연장, 종료 사유와 경과 시간 및 백엔드 서비스 로그가 기록됩니다. 상세 모드는 애플리케이션 서비스와 서버 로그를 DEBUG로 설정하며, 외부 API 라이브러리의 상세 요청 로그는 켜지지 않습니다.

기본 설정에서는 운영자 노트북에서 `http://localhost:8080/operator`를 엽니다. 청중은 Vercel Listener 주소를 사용하며 Local PC의 `/listen` 또는 `/ws/listen` 경로는 제공되지 않습니다.

Cloud Listener는 Berlin relay와 Vercel static hosting만 사용합니다. Relay가 비활성화되거나 연결에 실패하면 LAN/local 경로로 전환하지 않습니다. 중계 계약은 [Cloud relay protocol](docs/cloud-relay-protocol.md), Listener Vercel 설정은 [Listener 배포 안내](listener-frontend/DEPLOY.md)를 참고하세요.

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

기본 HTTP 설정에서는 `http://<LAN-IP>:8080/operator`(또는 Vite 개발 서버의 `http://localhost:5173/operator`)를 열어 통역기를 선택하고 API key를 저장한 다음 캡처를 시작하세요. 청중은 별도 Vercel origin에서 Listen에 입장합니다.

backend를 시작하기 전에 `backend/.env`를 편집해 Operator secret 두 개를 설정하세요. 다음 명령으로 서로 다른 값을 생성할 수 있습니다.

```powershell
python -c "import secrets; print(secrets.token_urlsafe(24))"
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

첫 번째 값은 `APP_OPERATOR_PASSWORD`에, 두 번째 값은 `APP_OPERATOR_SESSION_SECRET`에 설정하세요. Session secret은 서버 전용 서명 키이며 로그인할 때 입력하는 비밀번호가 아닙니다. Sermon Session 기능과도 관련이 없습니다. 인증 쿠키에 서명해 backend가 위조되거나 변조된 세션을 거부할 수 있게 합니다. `.env`를 commit하지 말고, 두 값을 서로 바꿔 사용하지 마세요. 둘 중 하나라도 비어 있으면 Operator 로그인과 보호된 API를 사용할 수 없습니다. Operator 로그인에는 로컬 비밀번호만 사용하며 이메일 계정이나 외부 인증 서비스는 필요하지 않습니다.

비밀번호를 변경해도 이미 발급된 쿠키는 취소되지 않으며, 12시간 후 만료됩니다. 모든 Operator 세션을 즉시 취소해야 한다면 session secret도 교체하세요.

`APP_ALLOWED_ORIGINS`에는 Operator 브라우저에서 사용하는 정확한 origin을 지정해야 합니다. 기본값에는 Vite 개발 URL과 통합 UI의 `localhost:8080`, `127.0.0.1:8080`이 포함되어 있습니다. 노트북 LAN 주소로 통합 UI를 열 경우 해당 origin을 추가하세요(예: `http://192.168.1.20:8080`). `*`는 사용하지 마세요.

Operator API, 오디오 도구, `/ws/operator`에는 로그인이 필요합니다. `/health`와 인증 진입점만 공개됩니다. Listener access는 Berlin relay가 방송별 비밀번호와 짧은 수명의 session token으로 관리하며, Local PC backend는 Listener 접속을 받지 않습니다. Windows에서는 연결된 네트워크를 **Private**로 설정하고, Windows Defender Firewall에서 Python/sermon-live를 **Private networks**에만 허용하세요. 이 서버를 위해 라우터 포트 포워딩을 활성화하지 마세요.

기본 설정은 HTTP와 `ws://`를 사용합니다. 같은 네트워크의 능동적인 공격자가 비밀번호와 세션 쿠키를 엿보거나 탈취할 수 있습니다. Operator 인증만으로 전송 과정의 위험이 사라지지는 않으므로 신뢰할 수 있는 사설 LAN에서만 사용하세요.

### Listener 개발 및 배포

청중용 UI는 Vercel의 별도 `listener-frontend/` 프로젝트에서 HTTPS로 제공되며 Berlin relay에 직접 WSS 연결합니다. Local PC HTTPS 인증서는 Listener 접근에 필요하지 않습니다. Vercel 환경변수, WebSocket Origin 및 모바일 검증 절차는 [Listener 배포 안내](listener-frontend/DEPLOY.md)를 참고하세요.

Local PC Operator frontend 개발 서버:

```powershell
cd sermon-live/frontend
npm install
npm run dev
```

Operator 화면은 `http://localhost:5173/operator`에서 확인할 수 있습니다. Listener UI는 아래 명령으로 별도 실행합니다.

```powershell
cd sermon-live/listener-frontend
npm install
npm run dev
```

Listener 개발 환경에서도 공개 relay API base를 `VITE_RELAY_API_BASE_URL`로 설정해야 합니다. 개발 Origin은 Berlin relay의 로컬 개발 allowlist에만 추가하고 Production allowlist와 분리하세요.

## 통역기 주입

`APP_INTERPRETER=echo|openai`

Pipeline 코드에서 vendor 이름을 기준으로 분기하지 마세요. 새 provider를 추가하려면 `LiveInterpreter`를 구현하고 factory에 등록하세요.

## Sermon Session

Sermon Session은 애플리케이션에서 의도적으로 비활성화되어 있습니다. API router와 Operator 페이지 route는 등록되어 있지 않으며, 통역 세션은 설교 데이터를 불러오거나 노출하지 않습니다. 향후 작업을 위해 endpoint, store, UI 소스, JSON 데이터는 보존되어 있습니다. 다시 활성화하려면 해당 route를 명시적으로 등록해야 합니다.
