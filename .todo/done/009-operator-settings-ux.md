# 009 Operator Settings 저장 UX

상태: 완료

## 목표

즉시 적용되는 환경설정과 서버에 저장해야 하는 통역 설정을 UI에서 명확히 분리한다.

## 결정 사항

- 언어와 Dark Mode는 변경 즉시 적용한다.
- API model과 API key는 별도의 `Apply` 동작으로 저장한다.
- 기존 인라인 status 문구 대신 성공/실패는 Toast로 표시한다.
- 저장된 API key는 원문을 반환하지 않고 앞뒤 일부만 masked preview로 표시한다.
- API key 입력 중에는 password 표시/숨김 toggle로 사용자가 입력값을 확인할 수 있다.

## 구현 범위

- 언어/Dark Mode 영역과 API model/key 영역을 시각적으로 분리
- API model/key 전용 `Apply` 버튼 제공
- Apply 전에는 서버 설정이 변경되지 않도록 처리
- Settings 진입 시 GET 실패를 Toast로 표시
- Apply의 HTTP 실패와 network 실패를 Toast로 표시
- 저장 중 중복 submit 방지
- 저장 성공 시 API key 원문을 입력창에서 제거
- 저장된 key는 원문 대신 `앞 4자...뒤 4자` 형태의 masked preview를 입력창에 표시
- API key 입력창에 password 표시/숨김 toggle 제공
- GET/PUT 응답에 API key 원문 없이 provider별 masked key preview 제공

## 수용 기준

- 언어 변경 즉시 화면 언어가 바뀌고 localStorage/DOM에도 반영된다.
- Dark Mode 변경 즉시 화면 테마와 Toast 테마가 바뀐다.
- API model/key 변경 후 `Apply`를 눌러야 서버 설정이 변경된다.
- Apply 성공과 실패가 각각 번역된 Toast로 표시된다.
- API key 원문이 화면 상태 복원, response, Toast에 노출되지 않는다.
- 저장된 API key가 입력창에 masked preview로 표시된다.
- API key 입력 중 표시/숨김 toggle로 입력값을 확인할 수 있다.
- 저장 중 Apply를 반복해도 중복 요청이 발생하지 않는다.

## 검증

- Settings GET/PUT payload unit test
- Apply 성공/HTTP 실패/network 실패 Toast test
- 저장된 key masked preview와 password 표시/숨김 toggle test
- 언어/Dark Mode 즉시 적용 기존 테스트 보강
- 새로고침 후 저장 상태 수동 확인

## 커밋 경계

Settings 화면과 Settings 관련 frontend 테스트를 포함한다. 원문 key를 노출하지 않는 masked preview 응답 계약 변경도 포함하며, 공통 Toast 구현은 `008`에 포함한다.
