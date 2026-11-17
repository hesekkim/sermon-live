# 070 Windows/macOS 독립 실행 패키징 기반

상태: 대기
우선순위: 높음

## Goal

Python과 Node.js/npm이 설치되지 않은 Windows 또는 macOS 운영자 컴퓨터에서 Sermon Live를 설치하고 실행할 수 있도록 공통 패키징 기반을 마련한다. 청중 기기는 같은 LAN의 브라우저로 접속하며 별도 설치가 필요하지 않다.

## Scope

- Python 백엔드와 빌드된 React frontend를 운영자용 실행 패키지에 포함한다.
- PyAudio/PortAudio를 포함한 런타임 의존성 및 frontend 정적 리소스의 패키징 방식을 검증하고 선택한다.
- 패키징 리소스와 쓰기 가능한 사용자 데이터 경로를 분리한다.
- 설정, Operator API key 저장소, 로그 및 기타 사용자 데이터를 Windows와 macOS의 사용자별 쓰기 가능 위치에 저장한다.
- 기존 `backend/.env`와 `backend/data/operator.json` 사용자의 설정을 새 위치로 이전할지, 어떻게 이전할지 결정하고 비파괴적인 이전 절차를 구현한다.
- 실행 진입점에서 서버 시작·종료와 Operator 및 Listener 접속 주소를 사용자가 확인할 수 있게 한다. 종료 시 서버와 오디오 자원을 정리하고 고아 프로세스를 남기지 않는다.
- 환경 변수 설정과 사용자 설정의 우선순위를 명확히 하고, 패키지 설치 위치에 사용자 비밀정보나 변경 데이터를 쓰지 않는다.
- OS별 패키지는 해당 OS에서 빌드한다. `build.bat`은 개발자용으로 유지한다.

## Out of scope

- Electron 또는 다른 프레임워크로 Operator/Listener 웹 UI를 다시 작성하는 것
- 자동 HTTPS 인증서 발급·갱신 또는 로컬 CA 자동 생성
- 외부 공개 배포를 위한 코드 서명·공증 및 자동 릴리스 파이프라인
- 운영자 PC가 아닌 청중 기기에 앱을 설치하는 것

## Implementation notes

- 패키징 도구는 PyAudio/PortAudio, FastAPI 정적 frontend, 데이터 리소스를 포함한 최소 end-to-end 빌드 검증 후 선택한다.
- 다음 기존 리소스 경로와 쓰기 경로를 구분한다.
  - `backend/core/config.py`: `.env`와 `frontend/dist` 경로
  - `backend/services/operator_store.py`: `backend/data/operator.json`
  - `backend/data/scripture/deu1912_vpl.xml`
  - `backend/main.py`: 로그 경로와 frontend 제공
- 사용자 데이터 디렉터리는 OS 표준 사용자 데이터 위치를 사용하고, 설치된 앱 리소스 안에는 저장하지 않는다.
- 이전 대상 파일이 새 위치에 이미 있으면 덮어쓰지 않는다. API key, Operator 비밀번호, session secret, TLS private key를 로그나 패키지에 포함하지 않는다.
- 새 설정 경로에서도 `APP_SSL_CERTFILE`과 `APP_SSL_KEYFILE`을 포함한 기존 `APP_*` 환경 설정을 유지한다.
- `.todo/071-windows-installable-package.md`와 `.todo/072-macos-installable-package.md`가 이 기반에 의존한다.

## Acceptance criteria

- [ ] 패키지 리소스에서 FastAPI가 빌드된 frontend와 Scripture corpus를 제공한다.
- [ ] 설정, Operator 저장소, 로그가 OS별 사용자 데이터 위치를 사용하며 앱 설치 디렉터리에 쓰지 않는다.
- [ ] 기존 설정 이전 동작이 정의되고, 사용자 데이터가 이미 존재하는 경우 이를 덮어쓰지 않는다.
- [ ] 시작 및 종료 방법과 로컬 Operator/LAN Listener 주소를 운영자가 확인할 수 있다.
- [ ] 깨끗한 테스트 환경에서 Python과 Node.js/npm 없이 패키징된 앱이 시작되고 종료된다.
- [ ] 기존 개발 실행 흐름과 backend/frontend unit 테스트가 유지된다.
- [ ] 비밀정보와 TLS private key가 패키지, 로그, 테스트 결과에 들어가지 않는다.

## Tests and verification

### Automated

- backend unit tests에서 패키지 리소스 경로, OS별 사용자 데이터 경로, 환경 변수 우선순위와 설정 이전 경계를 검증한다.
- frontend production build 및 backend unit tests를 실행한다.
- 선택한 패키징 도구로 frontend와 Scripture 리소스를 포함한 smoke package를 만든다.

### Manual

- [ ] Python과 Node.js/npm이 없는 Windows 환경에서 설치·시작·종료를 확인한다.
- [ ] Python과 Node.js/npm이 없는 macOS 환경에서 설치·시작·종료를 확인한다.
- [ ] 두 OS에서 사용자 설정과 로그가 앱 업데이트 후에도 보존되는지 확인한다.
- [ ] 실제 오디오 장치 enumeration 및 capture는 각 OS 플랫폼 티켓에서 검증한다.
