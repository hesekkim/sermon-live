# 013 Settings key status TagSelector

상태: 대기

## 목표

설정 화면에서 API 키 상태를 서버 연결 기준으로 확인하고, 유효/무효를 바로 보여준다.

## 문제

현재는 Settings에서 저장 여부만 표시하고, 실제 서버 연결/인증 단계에서 키가 유효하지 않은지 판단할 수 없다. 이 때문에 사용자는 저장되었다는 사실과 실제 런타임 사용 가능 상태가 달라도 알지 못한다.

## 구현 범위

- Settings의 `gemini` / `openai` 선택 시 상태 표시
- 서버에 `GET /api/v1/operator/settings`로 현재 key state와 연결 상태 확인
- `TagSelector`로 표현: `valid`, `missing`, `invalid` 상태 구분
- 유효성 검사 결과를 서버가 알려주는 값이 있으면 사용하고, 없으면 기존 saved/masked 정보와 함께 경고 표시
- API key 원문은 노출하지 않음
- 민감한 값이 사용자 화면에 그대로 보이지 않도록 masked preview 처리 유지

## 수용 기준

- 키가 비어 있으면 `missing` 상태로 표시된다.
- 키가 저장되어 있고 서버가 연결 가능한 상태면 `valid` 상태 태그가 표시된다.
- 키가 저장되었지만 서버 인증에 실패하면 `invalid` 상태 태그와 안내 메시지가 표시된다.
- 사용자는 API key 원문을 보지 않고도 현재 상태를 판단할 수 있다.
- 로컬/CI에서는 echo provider로 테스트 가능하다.

## 검증

- frontend unit test: 상태 태그 노출
- manual check: invalid Gemini key or mock failure state

## 비고

이 작업은 Broadcast toast lifecycle와 분리한다. Toast 티켓은 API key invalid를 사용자에게 구체적으로 알리는 것에 집중하고, TagSelector는 별도 상태 표시 기능으로 다룬다.
