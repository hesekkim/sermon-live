Sermon Live macOS 패키지

이 패키지에는 Python runtime과 backend 의존성이 포함되어 있습니다.
운영자 컴퓨터에 Python, Node.js 또는 npm을 설치할 필요가 없습니다.

지원 아키텍처

DMG 파일명에 표시된 아키텍처를 확인하세요.

- arm64: Apple Silicon Mac
- x86_64: Intel Mac

Universal package가 아닙니다. 실행 중인 Mac과 같은 아키텍처용 패키지를
빌드해야 합니다.

설치

1. DMG를 엽니다.
2. "Sermon Live.app"과 "Start Sermon Live.command"를 모두 같은 폴더
   (예: 응용 프로그램 폴더)로 복사합니다.
3. 앱을 이동하거나 업데이트할 때 두 항목을 함께 유지합니다.

이 패키지는 코드 서명·공증되지 않아 macOS에서 개발자를 확인할 수 없다는
경고가 표시될 수 있습니다. 신뢰할 수 있는 출처의 패키지만 실행하세요.
차단되면 "Sermon Live.app"을 Control-click하고 열기를 선택한 뒤 확인합니다.
필요하다면 "Start Sermon Live.command"에도 같은 절차를 적용하세요.

첫 실행 전 설정

서버를 시작하기 전에 Operator 비밀번호와 session secret을 설정합니다.

1. Terminal을 엽니다.
2. 다음 명령을 실행합니다.

   mkdir -p "$HOME/Library/Application Support/Sermon Live"
   touch "$HOME/Library/Application Support/Sermon Live/.env"
   open -e "$HOME/Library/Application Support/Sermon Live/.env"

3. 예시 값을 바꾸어 다음 두 줄을 추가합니다.

   APP_OPERATOR_PASSWORD=비공개로_사용할_긴_비밀번호
   APP_OPERATOR_SESSION_SECRET=생성한_무작위_문자열

4. session secret은 다음 명령으로 생성할 수 있습니다.

   openssl rand -hex 32

파일을 저장하고 공유하지 마세요. 사용자 계정의 데이터 폴더에 보관됩니다.

실행 및 종료

"Start Sermon Live.command"를 더블클릭하고 Terminal 창을 열어 둡니다.
Terminal에 Operator URL과 LAN Listener URL이 표시됩니다. Operator URL은
이 Mac에서 열고, Listener URL은 신뢰할 수 있는 같은 로컬 네트워크의
기기에서만 사용하세요.

서버와 오디오 자원을 종료하려면 Terminal 창에서 Control-C를 누릅니다.
서버가 종료되기 전에 Terminal 창을 닫지 마세요.

마이크 권한

서버를 처음 시작해 오디오 캡처를 열 때 마이크 접근 요청이 표시되면
허용을 선택합니다. 입력 장치 목록을 새로고침하는 것만으로는 권한 요청이
표시되지 않습니다.
권한을 거부했거나 입력 장치가 표시되지 않으면 다음 단계를 따릅니다.

1. 시스템 설정 > 개인정보 보호 및 보안 > 마이크를 엽니다.
2. Sermon Live 접근을 허용합니다.
3. 실행 중인 서버를 Control-C로 종료한 뒤 다시 시작합니다.

Sermon Live가 목록에 없으면 서버를 완전히 종료한 뒤 다시 시작해 캡처를
시도합니다. 권한 요청을 이미 거부했다면 다시 표시되지 않을 수 있으므로
시스템 설정에서 접근을 허용한 뒤 서버를 재시작합니다.

방화벽

macOS에서 수신 연결을 허용할지 묻는 경우 같은 로컬 네트워크에서 Listener를
사용할 때만 Sermon Live 연결을 허용합니다. 방화벽 전체를 끄거나 router
port forwarding을 설정하지 마세요.

설정, 로그 및 업데이트

설정과 로그는 다음 위치에 저장됩니다.

   ~/Library/Application Support/Sermon Live

진단 로그가 필요하면 Terminal에서 다음 명령으로 실행합니다.

   "/Applications/Start Sermon Live.command" --verbose

상세 로그는 "logs" 폴더에 저장됩니다. 업데이트할 때는 서버를 종료한 뒤
앱과 launcher를 함께 교체하고 사용자 데이터 폴더는 유지하세요. 이 폴더에는
인증 정보, 설정과 진단 로그가 있습니다.

기존 source 프로젝트의 설정을 이전하려면 다음처럼 실행합니다.

   "/Applications/Sermon Live.app/Contents/MacOS/sermon-live" \
     --migrate-from "/path/to/sermon-live"

이전은 이미 존재하는 사용자 데이터를 덮어쓰지 않습니다.
