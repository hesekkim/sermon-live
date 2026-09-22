# 014 Operator UI 언어 설정을 operator.json으로 저장

상태: 대기

## 목표

Operator UI에서 선택한 언어를 브라우저 `localStorage`가 아니라 서버의 `backend/data/operator.json`에 저장하고, 이후 접속 시 서버 설정을 조회해 동일한 언어로 UI를 초기화한다.

## 현재 문제

- `frontend/src/pages/Operator/OperatorPrefs.tsx`가 `operatorUiLanguage`를 `localStorage`에서 직접 읽고 쓴다.
- 브라우저별로 언어 설정이 분리되어 운영자 환경 간 설정이 일치하지 않는다.
- `operator.json`과 `/api/v1/operator/settings`에는 interpreter와 API key 설정만 포함되어 있다.
- Settings 화면의 언어 변경이 서버 설정 저장 흐름과 연결되어 있지 않다.

## 구현 범위

- `backend/services/operator_store.py`
  - `OperatorRecord`에 UI 언어 필드를 추가한다.
  - 지원 언어는 현재 프론트 계약과 동일하게 `ko`, `en`, `de`로 제한한다.
  - 잘못된 값이나 누락된 값은 기본값 `ko`로 처리한다.
  - 기존 `operator.json`에 언어 필드가 없어도 기존 설정을 정상적으로 읽는다.
  - 저장 시 기존 interpreter/API key 값을 보존하면서 언어를 함께 기록한다.
- `backend/api/v1/endpoints/operator.py`
  - `GET /api/v1/operator/settings` 응답에 현재 UI 언어를 포함한다.
  - `PUT /api/v1/operator/settings`가 UI 언어를 저장할 수 있도록 request body 계약을 확장한다.
  - 기존 interpreter/API key 저장 및 API key 비노출 계약을 유지한다.
  - 언어만 변경하는 요청도 기존 설정을 잃지 않고 처리할 수 있도록 한다.
- `frontend/src/pages/Operator/OperatorPrefs.tsx`
  - 언어의 `localStorage` 읽기/쓰기와 `operatorUiLanguage` 키를 제거한다.
  - provider 초기화 시 operator settings API에서 언어를 조회한다.
  - 서버 조회 전에는 `ko`를 임시 기본값으로 사용하고, 조회 성공 후 서버 언어로 동기화한다.
  - 언어 변경 시 API에 저장하고 성공한 경우에만 현재 UI 언어를 확정한다. 저장 실패 시 이전 언어를 유지하고 기존 다국어 오류 상태를 표시한다.
  - theme의 `localStorage` 저장은 이 작업에서 변경하지 않는다.
- `frontend/src/pages/Operator/settings/Settings.tsx`
  - 언어 선택이 provider의 서버 저장 흐름을 사용하도록 연결한다.
  - interpreter/API key 저장과 언어 저장이 서로의 값을 덮어쓰지 않도록 요청 payload와 response 처리를 정리한다.

## 데이터/API 계약

`backend/data/operator.json` 예시:

```json
{
  "interpreter": "gemini",
  "gemini_api_key": "",
  "openai_api_key": "",
  "ui_language": "ko"
}
```

`GET /api/v1/operator/settings` 응답에는 다음 필드를 추가한다.

```json
{
  "interpreter": "echo",
  "gemini_key_set": false,
  "openai_key_set": false,
  "gemini_key_masked": "",
  "openai_key_masked": "",
  "ui_language": "ko"
}
```

언어 변경 요청은 최소한 다음 형태를 지원한다.

```json
{
  "ui_language": "en"
}
```

기존 Settings 저장 요청과의 하위 호환성을 유지하고, API key 원문은 기존과 동일하게 response나 로그에 포함하지 않는다.

## 수용 기준

- 언어를 `ko`, `en`, `de` 중 하나로 변경하면 `backend/data/operator.json`에 저장된다.
- 페이지 새로고침 또는 다른 브라우저에서 Settings를 열어도 서버에 저장된 언어로 UI가 시작된다.
- 언어를 저장한 브라우저의 `localStorage`를 삭제해도 서버 설정이 유지된다.
- `operator.json`에 `ui_language`가 없는 기존 파일을 읽을 때 UI가 `ko`로 동작하고 다른 설정은 유지된다.
- `ko`, `en`, `de` 이외의 언어 값은 저장되지 않으며 기본 언어 또는 HTTP validation error로 처리된다.
- 언어 저장 요청이 실패하면 UI는 이전 언어를 유지하고 저장 실패 메시지를 표시한다.
- theme은 기존처럼 `localStorage`에 저장되며 이번 작업으로 동작이 바뀌지 않는다.
- 기존 interpreter/API key 조회, 저장, masking 동작이 회귀하지 않는다.

## 검증

- backend unit test
  - `operator.json`의 `ui_language` load/save roundtrip
  - 누락되거나 잘못된 언어의 fallback/validation
  - GET/PUT settings의 언어 필드와 기존 API key 비노출 계약
  - 언어 저장 시 interpreter/API key 보존
- frontend unit test
  - provider 초기화 시 settings API의 언어 적용
  - 언어 변경 시 PUT payload 전송 및 성공 후 document `lang` 동기화
  - API/network 실패 시 이전 언어 유지와 오류 상태
  - 언어 localStorage를 읽거나 쓰지 않음
  - theme localStorage 동작은 유지

검증 명령:

- `Push-Location backend; .\\.venv\\Scripts\\python.exe -m pytest; Pop-Location`
- `Push-Location frontend; npm test -- --run; Pop-Location`
- `Push-Location frontend; npm run build; Pop-Location`

## 커밋 경계

UI 언어의 server persistence와 관련된 operator store/API, `OperatorPrefsProvider`, Settings 연결, unit test만 포함한다. theme 저장 방식 변경, 사용자별 계정/권한, 다국어 문구 자체의 수정, 실제 interpreter vendor 동작 변경은 포함하지 않는다.
