# 007 Operator settings API key 저장 수정

상태: 대기

## 목표

Settings에서 Gemini/OpenAI API key와 interpreter 설정을 저장하고, 저장 실패 원인을 사용자에게 명확히 전달한다.

## 구현 범위

- `frontend/src/pages/Operator/settings/Settings.tsx`의 PUT payload와 response 처리 확인
- `backend/api/v1/endpoints/operator.py`의 settings PUT 계약 확인
- `backend/services/operator_store.py`의 `backend/data/operator.json` 저장 동작 확인
- Gemini/OpenAI provider별 key 전달
- 빈 key 저장 시 기존 key 유지
- GET/PUT response와 로그에 API key 원문 노출 금지
- 파일 쓰기 실패와 잘못된 요청이 frontend에서 처리 가능한 HTTP 오류가 되도록 정리
- 저장 성공 후 API key 입력값 초기화

## 수용 기준

- Gemini key를 입력하고 저장하면 `backend/data/operator.json`에 저장된다.
- 새로고침 후 선택한 provider와 key 저장 여부가 올바르게 표시된다.
- 빈 key로 저장해도 기존 key가 삭제되지 않는다.
- API key 원문이 GET response, PUT response, Toast, log에 포함되지 않는다.
- 저장 실패 시 HTTP 실패와 network 실패를 구분하지 않고 사용자에게 실패 상태를 표시한다.

## 검증

- backend settings store/API unit test
- frontend PUT payload 및 실패 처리 unit test
- Gemini key 저장 후 새로고침 수동 확인

## 커밋 경계

Operator settings 저장 계약과 관련 테스트만 포함한다. Toast 디자인과 Broadcast lifecycle 변경은 포함하지 않는다.
