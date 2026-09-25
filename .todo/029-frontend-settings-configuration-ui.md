# 029 Operator 설정 UI

상태: 대기

## Goal

일반 사용자가 소스코드나 `.env`를 수정하지 않고 Operator UI에서 변경 가능한 운영 설정을 관리한다.

## Why

개인용 프로그램이지만 개발자 전용 설정 방식으로 만들지 않는다. 예배 전 필요한 설정은 처음부터 화면에서 편집할 수 있어야 한다.

## Dependencies

009, 010, 017, 025

## Scope

- UI language와 theme
- Audio Input Device
- Translation Profile
- Auto Stop, Warning, Extension, Hard Limit
- OpenAI API key 입력/저장 상태와 model
- API key 원문은 frontend state와 API 응답에 반환하지 않고 masked status만 표시
- 기술적 server/deployment 설정은 이 화면에 노출하지 않음

## Acceptance criteria

- 설정을 저장하고 새로고침 후 조회할 수 있다.
- 숫자 설정의 범위와 상호 제약이 표시/검증된다.
- API key는 저장 상태만 확인할 수 있고 원문이 노출되지 않는다.
- Audio device 설정은 기존 선택 기능과 회귀 없이 동작한다.

## Tests

- 설정 load/save
- timer validation
- secret masking과 저장 상태 표시
