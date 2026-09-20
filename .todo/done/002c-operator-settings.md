# 002c Settings: provider + API key JSON

상태: 완료

## 목표

운영자가 shared form components를 통해 provider와 API key를 저장하고, 서버 재시작 없이 다음 세션 시작에 반영되도록 한다.

## 구현 범위

- shared `Select`로 `echo`, `gemini`, `openai` 선택
- shared `InputField`로 현재 provider의 API key 입력
- Echo 선택 시 API key 입력 비활성화
- shared `Button`으로 저장
- `GET /api/v1/operator/settings`에서 provider와 key 저장 여부만 반환
- `PUT /api/v1/operator/suggettings`에서 provider와 선택 key 저장
- 저장 위치는 `backend/data/operator.json`; `.env`에는 UI 저장값을 쓰지 않는다.
- `OperatorSettingsStore`가 JSON 값을 다음 session start의 runtime `Settings`에 overlay
- 실행 중 Settings 변경은 현재 session을 재생성하지 않고 다음 start부터 적용
- network reject와 HTTP failure 모두 저장 실패 상태로 표시

## 보안/계약

- API key 원문은 GET response, frontend state 표시, log에 포함하지 않는다.
- 빈 key 저장은 기존 key를 삭제하지 않는다.
- OpenAI adapter는 아직 stub이지만 OpenAI key도 runtime Settings까지 전달한다.
- 실제 OpenAI 호출 구현은 `003/006` 범위로 분리한다.

## 수용 기준

- provider별 key 상태가 저장 후 새로고침에도 올바르게 보인다.
- Gemini 선택 후 key가 없으면 session start가 명확한 오류로 실패한다.
- 저장 중 네트워크 오류가 발생하면 다국어 `saveFailed`가 표시된다.
- 기존 Gemini/OpenAI key가 응답 문자열에 노출되지 않는다.

## 검증

- `Push-Location backend; .\.venv\Scripts\python.exe -m pytest; Pop-Location`
- `Push-Location frontend; npm test -- --run; Pop-Location`
- `Push-Location frontend; npm run build; Pop-Location`

## 커밋 경계

Settings 화면, operator store/API, runtime Settings overlay와 관련 테스트만 포함한다. 실제 vendor adapter 구현은 포함하지 않는다.
