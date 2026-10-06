# sermon-live

교회 LAN에서 설교를 한국어에서 독일어로 실시간 통역하는 애플리케이션입니다.

청중은 같은 Wi-Fi에 연결된 휴대폰 브라우저로 접속합니다. 운영자 노트북이 설교단 마이크의 음성을 캡처해 주입된 통역기(OpenAI Realtime을 활성화하거나 무료 로컬 테스트용 Echo)를 통해 처리하고, PCM 오디오와 자막을 WebSocket으로 전송합니다.

## 구성

- `backend/` — FastAPI, 오디오 캡처, 통역 adapter, 방송
- `frontend/` — Vite React 청취 페이지와 운영자 화면
- `.agent/rules/` — agent 규칙 (`.cursor` 아님)

## 실행

### Windows 빌드 및 실행

저장소 루트에서 `build.bat`을 실행하면 frontend가 `frontend/dist`에 빌드되고 backend Python 모듈의 문법을 검사합니다. Backend는 별도로 컴파일된 바이너리가 아닌 Python 애플리케이션입니다. `run.bat`을 실행하면 backend가 시작되고 같은 프로세스에서 빌드된 frontend를 제공합니다.

빌드가 끝나면 `run.bat`을 실행하세요. 운영자 노트북에서는 `http://localhost:8080/operator`를 열고, 같은 네트워크의 청중 기기에서는 `http://<LAN-IP>:8080/listen`을 엽니다.

Backend를 직접 실행하려면:

```powershell
cd sermon-live/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python main.py
```

macOS에서는 CoreAudio를 지원하는 PortAudio 빌드와 함께 PyAudio를 설치하고, backend를 실행하는 앱 또는 터미널에 마이크 접근 권한을 부여하세요. 운영자 기기 설정은 기본적으로 CoreAudio 입력을 사용합니다. 예상한 실제 입력 장치가 보이지 않으면 모든 Host API 장치 목록을 사용하세요.

`http://<LAN-IP>:8080/operator`(또는 Vite 개발 서버의 `http://localhost:5173/operator`)를 열어 통역기를 선택하고 API key를 저장한 다음 캡처를 시작하세요. 청중용 주소 경로는 `/listen`입니다.

backend를 시작하기 전에 `backend/.env`를 편집해 Operator secret 두 개를 설정하세요. 다음 명령으로 서로 다른 값을 생성할 수 있습니다.

```powershell
python -c "import secrets; print(secrets.token_urlsafe(24))"
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

첫 번째 값은 `APP_OPERATOR_PASSWORD`에, 두 번째 값은 `APP_OPERATOR_SESSION_SECRET`에 설정하세요. Session secret은 서버 전용 서명 키이며 로그인할 때 입력하는 비밀번호가 아닙니다. Sermon Session 기능과도 관련이 없습니다. 인증 쿠키에 서명해 backend가 위조되거나 변조된 세션을 거부할 수 있게 합니다. `.env`를 commit하지 말고, 두 값을 서로 바꿔 사용하지 마세요. 둘 중 하나라도 비어 있으면 Operator 로그인과 보호된 API를 사용할 수 없습니다. Operator 로그인에는 로컬 비밀번호만 사용하며 이메일 계정이나 외부 인증 서비스는 필요하지 않습니다.

비밀번호를 변경해도 이미 발급된 쿠키는 취소되지 않으며, 12시간 후 만료됩니다. 모든 Operator 세션을 즉시 취소해야 한다면 session secret도 교체하세요.

`APP_ALLOWED_ORIGINS`에는 Operator 브라우저에서 사용하는 정확한 origin을 지정해야 합니다. 기본값에는 Vite localhost URL이 포함되어 있습니다. 노트북 LAN 주소로 통합 UI를 열 경우 해당 origin을 추가하세요(예: `http://192.168.1.20:8080`). `*`는 사용하지 마세요.

Operator API, 오디오 도구, `/ws/operator`에는 로그인이 필요합니다. `/health`, `/listen`, `/ws/listen`은 LAN 기기에서 로그인 없이 사용할 수 있습니다. 해당 Wi-Fi에 연결된 누구나 실시간 오디오와 자막을 들을 수 있습니다. Windows에서는 연결된 네트워크를 **Private**로 설정하고, Windows Defender Firewall에서 Python/sermon-live를 **Private networks**에만 허용하세요. 이 서버를 위해 라우터 포트 포워딩을 활성화하지 마세요.

이 설정은 HTTPS/WSS가 아닌 HTTP와 `ws://`를 사용합니다. 같은 네트워크의 능동적인 공격자가 비밀번호와 세션 쿠키를 엿보거나 탈취할 수 있습니다. Operator 인증만으로 전송 과정의 위험이 사라지지는 않으므로 신뢰할 수 있는 사설 LAN에서만 사용하세요.

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
