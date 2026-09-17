# 002d 방송 페이지 + 세션 API + 전사

상태: 완료

## 목표

Operator가 하나의 HTTP 프로세스 안에서 통역 세션을 명시적으로 시작/정지하고, input/output transcript와 Listen 참여 상태를 실시간으로 관찰하게 한다.

## 구현 범위

- `POST /api/v1/session/start`, `POST /api/v1/session/stop`, `GET /api/v1/session`
- application lifespan에서는 세션을 자동 시작하지 않고 종료 시 정리만 수행
- Operator WebSocket `/ws/operator`에 status, transcript, error event 전달
- Listen WebSocket `/ws/listen`에는 output transcript/audio만 전달
- input transcript는 한국어, output transcript는 독일어라는 UI 계약을 label에 반영
- `BroadcastHub`에서 Listen client 수를 세고 Operator에 broadcast
- 각 transcript pane 제목 옆의 `LiaFileDownloadSolid` icon button으로 input/output TXT를 각각 다운로드
- 세션 토글은 icon-only native button으로 `aria-pressed`, 상태별 aria-label 제공
- 누적 input/output lines를 각각 `transcriptFile.ts` 형식으로 다운로드
- interpreter error event를 Operator error 상태로 표시

## lifecycle 계약

- 이미 실행 중인 start는 중복 세션을 만들지 않는다.
- stop은 capture, interpreter task, WebSocket 자원을 정리한다.
- start 실패 시 UI는 running 상태로 전환되지 않고 실패 문구를 표시한다.
- session 중 Settings 변경은 현재 interpreter에 영향을 주지 않는다.

## 수용 기준

- Start/stop 아이콘으로 세션 상태가 바뀌고 새 Operator 연결에도 현재 상태가 전달된다.
- Listen client 접속/해제에 따라 참여 인원이 갱신된다.
- input pane에는 input만, output pane에는 output만 누적 표시된다.
- 현재 마지막 문장만 highlight되고 이전 문장은 기본색이다.
- interpreter 오류와 start/stop 실패가 화면에 표시된다.
- 각 pane의 Download 클릭 시 해당 input/output transcript가 독립적인 TXT로 내려받아진다.

## 검증

- `Push-Location backend; .\.venv\Scripts\python.exe -m pytest; Pop-Location`
- `Push-Location frontend; npm test -- --run; Pop-Location`
- `Push-Location frontend; npm run build; Pop-Location`
- Echo interpreter로 start/stop, Listen 접속자 수, transcript download 수동 확인

## 커밋 경계

session API, BroadcastHub/SessionService event routing, Broadcast 화면/hook/download 유틸과 관련 테스트만 포함한다. provider 설정 form과 Sidebar layout은 포함하지 않는다.
