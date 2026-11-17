# 독립 실행 패키지 빌드 (개발자용 실험 단계)

독립 실행 패키지는 Python runtime과 backend 의존성, 빌드된 frontend, Scripture corpus를 포함한다. 설치된 운영자 컴퓨터에는 Python과 Node.js/npm이 필요하지 않다. 패키지는 대상 OS에서 직접 빌드해야 한다.

현재 `packaging/sermon_live.spec`은 Windows용 PyInstaller onedir smoke package다. macOS `.app`/DMG는 macOS에서 별도로 구성하고 검증해야 하며 아직 지원 패키지가 아니다.

## Windows smoke package

빌드 PC에 Python과 Node.js/npm을 설치하고 저장소 루트에서 PowerShell로 실행한다.

```powershell
.\build.bat
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-packaging.txt
backend\.venv\Scripts\python.exe -m PyInstaller --noconfirm --clean packaging\sermon_live.spec
.\dist\sermon-live\sermon-live.exe
```

`build.bat`은 개발자용으로 유지한다. package 명령을 실행하기 전에 frontend production build가 성공해야 한다. PyInstaller 결과물은 `dist\sermon-live\`에 생성된다.

앱은 서버 시작 시 Operator 및 Listener 주소를 콘솔에 표시한다. 종료하려면 콘솔에서 `Ctrl+C`를 누른다. Windows 방화벽에서 LAN 접속을 허용할 때는 Private network만 선택하고 port forwarding을 설정하지 않는다.

## 사용자 데이터와 이전

패키지 실행 시 Windows 데이터는 `%LOCALAPPDATA%\Sermon Live`, macOS 데이터는 `~/Library/Application Support/Sermon Live`에 저장한다. source 실행은 기존 `backend/.env`, `backend/data/`, `backend/logs/` 위치를 계속 사용한다. 패키지 업데이트는 사용자 데이터 디렉터리를 덮어쓰지 않는다.

기존 source 실행에서 설정을 옮길 때는 패키지 실행 파일에 이전 프로젝트 루트를 지정한다.

```powershell
.\dist\sermon-live\sermon-live.exe --migrate-from "C:\path\to\sermon-live"
```

이 명령은 `backend/.env`와 `backend/data/operator.json`만 대상 사용자 데이터 폴더에 복사하며, 대상 파일이 이미 있으면 보존한다. 이전이 끝나면 패키지를 다시 실행한다. `.env`와 `operator.json`에는 비밀정보가 있을 수 있으므로 복사본과 백업을 안전하게 관리한다.

macOS 빌드 및 실제 마이크 검증, 앱 서명·공증은 후속 플랫폼 배포 범위다.
