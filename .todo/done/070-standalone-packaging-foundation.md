# 070 독립 실행 패키징 공통 기반

상태: 완료
우선순위: 높음

## Goal

Python과 Node.js/npm이 설치되지 않은 운영자 컴퓨터용 패키지에서 실행 환경, 정적 리소스와 사용자 데이터를 분리하는 공통 기반을 마련한다. OS별 설치 패키지와 실기기 검증은 후속 티켓에서 다룬다.

## Scope

- PyInstaller onedir를 사용해 Windows end-to-end smoke package를 만든다.
- Backend, 빌드된 React frontend, Scripture corpus를 패키지 리소스로 포함한다.
- 패키징 리소스와 쓰기 가능한 사용자 데이터 경로를 분리한다.
- 패키지 설정, Operator 저장소, 로그를 OS 사용자별 쓰기 가능 위치에 저장한다. Windows와 macOS의 경로 규칙을 구현하고 단위 테스트한다.
- 기존 `backend/.env`와 `backend/data/operator.json`을 사용자가 지정한 source 프로젝트에서 새 위치로 비파괴 이전한다.
- 패키지 실행 시 Operator/LAN Listener 주소를 안내하고, 일반 종료 시 기존 FastAPI lifespan 정리 흐름을 사용한다.
- 환경 변수 설정과 사용자 설정의 우선순위를 명확히 하고, 패키지 설치 위치에 사용자 비밀정보나 변경 데이터를 쓰지 않는다.
- 기존 개발 실행 흐름을 유지하고 `build.bat`은 개발자용으로 둔다.

## Out of scope

- Electron 또는 다른 프레임워크로 Operator/Listener 웹 UI를 다시 작성하는 것
- Windows 설치 프로그램과 실제 Windows 오디오 장치 검증
- macOS `.app`/DMG, CoreAudio·마이크 권한 및 실제 Mac 검증
- 자동 HTTPS 인증서 발급·갱신 또는 로컬 CA 자동 생성
- 외부 공개 배포를 위한 코드 서명·공증 및 자동 릴리스 파이프라인
- 운영자 PC가 아닌 청중 기기에 앱을 설치하는 것

## Implementation notes

- PyInstaller 6.x Windows onedir가 frontend와 Scripture 리소스를 포함한 smoke package를 생성하는 것을 확인했다. macOS 지원 여부는 072에서 검증한다.
- 다음 기존 리소스 경로와 쓰기 경로를 구분한다.
  - `backend/core/config.py`: `.env`와 `frontend/dist` 경로
  - `backend/services/operator_store.py`: `backend/data/operator.json`
  - `backend/data/scripture/deu1912_vpl.xml`
  - `backend/main.py`: 로그 경로와 frontend 제공
- 패키지 사용자 데이터 위치는 Windows `%LOCALAPPDATA%/Sermon Live`, macOS `~/Library/Application Support/Sermon Live`다. source 실행은 기존 경로를 유지한다.
- 이전 대상 파일이 새 위치에 이미 있으면 덮어쓰지 않는다. API key, Operator 비밀번호, session secret, TLS private key를 로그나 패키지에 포함하지 않는다.
- 새 설정 경로에서도 `APP_SSL_CERTFILE`과 `APP_SSL_KEYFILE`을 포함한 기존 `APP_*` 환경 설정을 유지한다.
- Windows/macOS 설치 패키지와 각 OS 실기기 검증은 `.todo` 루트의 071/072 티켓에서 진행한다.

## Acceptance criteria

- [x] Windows smoke package가 frontend와 Scripture corpus를 포함하고 FastAPI 경로로 제공한다.
- [x] Windows와 macOS 사용자 데이터 위치 및 source 실행 경로를 구현하고 단위 테스트한다.
- [x] 기존 설정 이전은 명시적 source 경로를 사용하며, 대상 파일을 덮어쓰지 않는다.
- [x] Windows smoke package가 Python/npm이 PATH에 없는 조건에서 실행되고 Operator/LAN Listener 주소를 표시한다.
- [x] 설정과 로그는 패키지 리소스 밖의 사용자 데이터 위치를 사용한다.
- [x] backend unit tests와 frontend production build가 통과한다.
- [x] 로컬 `.env`와 `operator.json`은 패키지에 포함되지 않는다.

## Tests and verification

### Automated

- backend unit tests 216 passed, 1 skipped.
- frontend production build를 실행한다.
- Windows PyInstaller onedir package를 빌드하고 health, Operator page, JavaScript asset, Scripture resource, 로그 경로 및 audio enumerator를 smoke test한다.
- 제한된 PATH에 Python/npm이 없는 조건에서 패키지를 실행하고 기존 설정 이전과 대상 파일 보호를 확인한다.

### Manual

- Windows smoke는 현재 개발 PC에서 Python/npm이 PATH에 없는 조건으로 검증했다. 별도의 깨끗한 Windows PC 설치 검증과 실제 오디오 캡처는 071에서 수행한다.
- macOS 패키지, 실제 Mac 검증 및 업데이트 후 데이터 보존 검증은 072에서 수행한다.

## Progress

- 공통 경로 추상화와 명시적 설정 이전 절차를 구현했다.
- 제한된 PATH 환경에서 Windows smoke package가 unrelated working directory에서 동작하는 것을 확인했다.
- macOS 패키지 및 실제 오디오 하드웨어 검증은 이 티켓의 완료 조건에서 제외하고 071/072로 분리했다.
