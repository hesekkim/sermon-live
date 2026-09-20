# 010 Operator Broadcast lifecycle Toast

상태: 대기

## 목표

Broadcast에서 서버 세션의 시작/중지 결과와 실시간 오류를 Toast로 명확히 알린다.

## 구현 범위

- 방송 시작 성공 Toast
- 방송 중지 성공 Toast
- start/stop HTTP 실패 Toast
- interpreter error event Toast
- WebSocket error/close 상황 Toast
- 기존 인라인 error와 Toast가 중복 표시되지 않도록 정리
- 세션 토글 중 중복 클릭 방지
- 서버 status event와 UI running 상태 동기화

## 수용 기준

- Start 성공 시 시작 Toast가 표시된다.
- Stop 성공 시 중지 Toast가 표시된다.
- Start/stop HTTP 실패 시 실패 Toast가 표시되고 running 상태가 잘못 바뀌지 않는다.
- interpreter 또는 WebSocket 오류가 발생하면 오류 Toast가 표시된다.
- Toast에 API key나 vendor payload 등 민감한 원문이 포함되지 않는다.
- 토글 요청 중 추가 클릭으로 중복 요청이 발생하지 않는다.

## 검증

- Broadcast/useBroadcastSession frontend unit test
- start/stop 성공·실패와 WebSocket error test
- Echo interpreter로 start/stop 수동 확인

## 커밋 경계

Broadcast 화면/hook의 lifecycle 알림과 관련 테스트만 포함한다. Toast provider/CSS는 `008`, Settings UX는 `009`에 포함한다.
