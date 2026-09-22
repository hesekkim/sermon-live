# 013 Settings key status StatusTag

상태: 완료

## 목표

설정 화면에서 API 키 상태를 서버 연결 기준으로 확인하고, 유효/무효를 바로 보여준다.

## 문제

현재는 Settings에서 저장 여부만 표시하고, 실제 서버 연결/인증 단계에서 키가 유효하지 않은지 판단할 수 없다. 이 때문에 사용자는 저장되었다는 사실과 실제 런타임 사용 가능 상태가 달라도 알지 못한다.

## 구현 범위

- Settings의 `gemini` / `openai` 선택 시 상태 표시
- 서버에 `GET /api/v1/operator/settings`로 현재 key state와 연결 상태 확인
- `StatusTag`로 표현: `valid`, `missing`, `invalid` 상태 구분
- Apply와 Settings 재조회 시 provider key를 즉시 검증하고 상태 갱신
- Apply와 Settings 진입 시 provider adapter의 인증 결과를 사용
- API key 원문은 노출하지 않음
- 민감한 값이 사용자 화면에 그대로 보이지 않도록 masked preview 처리 유지

## 수용 기준

- 키가 비어 있으면 `missing` 상태로 표시된다.
- 키가 저장되어 있고 서버가 연결 가능한 상태면 `valid` 상태 태그가 표시된다.
- 키가 저장되었지만 서버 인증에 실패하면 `invalid` 상태 태그와 안내 메시지가 표시된다.
- 사용자는 API key 원문을 보지 않고도 현재 상태를 판단할 수 있다.
- 로컬/CI에서는 echo provider로 테스트 가능하다.

## 검증

- backend unit test: 30개 통과
- frontend unit test: 19개 통과
- frontend build: TypeScript 및 Vite build 통과
- key validation unit test: valid/invalid 상태 저장 및 연결 실패 보존 확인
- API key 원문이 응답에 노출되지 않는지 확인

## 비고

이 작업은 Broadcast toast lifecycle과 분리한다. API key 상태는 Apply와 Settings 재조회 시 즉시 검증하며, Broadcast 시작에 의존하지 않는다. 상태 표시는 `StatusTag`가 담당한다.
