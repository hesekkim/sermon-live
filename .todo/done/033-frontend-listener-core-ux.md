# 033 Listener 핵심 UX

상태: 완료

Listener를 접속 후 최소한의 조작으로 통역을 듣고 자막을 볼 수 있는 화면으로 정리한다.

## Why

청중에게 Operator 기능을 노출하지 않고, 방송 상태와 자막/오디오 청취에만 집중시켜야 한다.

## Dependencies

027, 029

## Scope

- Session status
- 큰 독일어 자막 영역
- 명시적인 `Listen` 시작 버튼
- 연결 중, 연결 끊김, 방송 종료, 통역 대기 중 상태
- 글자 크기 조절
- Listener별 Dark/Light theme
- Operator 설정, API key, server control은 노출하지 않음

## Acceptance criteria

- 접속→상태 확인→듣기 시작→자막 보기 흐름이 단순하게 동작한다.
- browser autoplay 제한에 걸려도 Listen 버튼으로 재생을 시작할 수 있다.
- Translation OFF와 방송 종료를 구분해 표시한다.
- 연결 끊김과 복구 상태를 사용자에게 명확히 표시한다.

## Tests

- Listen button과 playback state
- session status별 화면 상태
- font size/theme 저장과 reconnect 상태
