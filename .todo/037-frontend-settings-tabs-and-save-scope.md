# 037 Settings 탭과 섹션별 저장

상태: 대기
우선순위: 최우선 UX

## Goal

Operator Settings를 네 개의 탭으로 나누고, 각 설정이 요구된 저장 방식으로 독립 동작하도록 한다. 상단 Back action은 Broadcast로 쉽게 돌아가게 한다.

## Why

현재 화면은 Appearance, Audio, Safety, Interpreter를 한 페이지에 모두 표시하고, 언어·테마·장치·timer·API 설정을 하나의 Apply action으로 함께 저장한다. 화면이 길고 한 섹션을 수정해도 다른 draft 값이 같은 요청 payload에 포함될 수 있다.

## Related files

- `frontend/src/pages/Operator/settings/Settings.tsx`
- `frontend/src/pages/Operator/settings/Settings.module.css`
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`
- `frontend/src/pages/Operator/settings/hooks/useAudioDevices.ts`
- `frontend/src/pages/Operator/settings/components/AppearanceSection.tsx`
- `frontend/src/pages/Operator/settings/components/AudioDeviceSection.tsx`
- `frontend/src/pages/Operator/settings/components/SafetySection.tsx`
- `frontend/src/pages/Operator/settings/components/InterpreterSection.tsx`
- `frontend/src/pages/Operator/OperatorPrefs.tsx`
- `frontend/src/pages/Operator/translations.ts`
- Backend API contract: `backend/api/v1/endpoints/operator.py`

## Dependencies

- `.todo/036-frontend-operator-control-sidebar.md`
- `.todo/done/032-frontend-settings-configuration-ui.md`
- `.todo/done/028-backend-translation-safety-timer.md`

## Scope and implementation notes

### Tabs and navigation

- 네 탭 이름과 책임은 `Appearance`, `Input devices`, `Safety`, `API Model`로 고정한다.
- 접근 가능한 `tablist`, `tab`, `tabpanel` 관계와 선택 상태(`aria-selected`, roving focus 또는 native button/tab semantics)를 구현한다.
- 탭 전환으로 다른 섹션의 미저장 draft를 저장하거나 덮어쓰지 않는다.
- Settings 상단에 Back button을 두고 `/operator/broadcast`로 돌아가게 한다. 단순 browser history 의존으로 이전의 외부 페이지에 빠지지 않게 한다.

### Appearance

- UI language selector는 선택 즉시 `OperatorPrefsProvider`에 반영하고 기존 localStorage 저장을 재사용한다.
- Dark mode control은 Settings 본문에 중복 배치하지 않는다. `.todo/036`에서 정한 상단 toggle을 사용한다.
- Appearance 전용 Apply 버튼은 없다.

### Input devices

- 장치 선택 변경 즉시 backend에 저장한다. 성공 후 선택 장치 상태를 확정하고, 실패/409이면 이전 값으로 rollback하며 구체적인 오류를 표시한다.
- 기존 backend 동작대로 capture runtime 재시작이 필요하다. Translation Session live 중에는 변경이 거부되므로 selector 상태와 사용자 안내가 서버 결과와 일치해야 한다.
- 장치 목록 로딩 중, 빈 목록, default 장치, 저장 중, 저장 실패 상태를 구분한다.
- Audio Test는 선택 장치와 실제 처리 format을 기준으로 계속 제공한다.
- Input device 선택에는 별도 Apply 버튼을 두지 않는다.

### Safety

- Auto Stop, Warning, Extension, Hard Limit draft와 기존 상호 제약 검증을 유지한다.
- Safety 탭에만 적용되는 Apply 버튼을 둔다. payload에는 Safety 필드만 보내고 backend body가 요구하는 non-Safety 필드가 필수라면 저장된 현재 값을 명시적으로 포함하되, API Model의 미저장 draft나 API key는 보내지 않는다.
- 저장 중 disabled 상태와 성공/실패 feedback을 제공한다.

### API Model

- 기존 `echo/openai` 선택, OpenAI API key 입력/저장 상태를 이 탭에 둔다. 임의 model name 설정 기능을 새로 추가하지 않는다. 실제 API model 설정 지원은 별도 근거가 있을 때만 범위를 넓힌다.
- API Model 전용 Apply를 둔다. Safety의 draft timer 값이나 저장되지 않은 device 값을 함께 보내지 않는다.
- API key 원문은 입력 직후에만 frontend memory에 두며, 서버 응답에는 masked 상태만 표시한다. 저장 성공 후 입력 draft를 비운다.

## Acceptance criteria

- 최초 Settings 진입 시 네 섹션이 한 화면에 모두 노출되지 않고 선택된 탭의 내용만 보인다.
- 탭 이동은 키보드와 보조기술에서 식별 가능하다.
- Appearance language와 header theme은 즉시 적용되며 Appearance Apply는 없다.
- Audio device 변경은 별도 Apply 없이 저장되고, 실패 시 UI가 실제 저장 상태와 일치한다.
- Safety 저장 요청은 API Model draft를 포함하지 않고, API Model 저장은 Safety draft를 포함하지 않는다.
- Settings의 Back action은 Broadcast로 이동한다.
- 기존 timer validation, API key masking, Audio Test가 회귀하지 않는다.

## Tests

- Settings hook unit test: 각 섹션 save payload 분리, device optimistic update/rollback, language 즉시 반영, API key draft clear.
- tab interaction test: 현재 tab/panel 관계, 네 탭 전환, Back action을 검증한다.
- timer validation unit test를 재사용/갱신한다.
- 레이아웃 snapshot 및 스타일 assertion은 추가하지 않는다.

## Risks

- 현재 backend PUT body에서 `interpreter`는 필수다. 섹션별 partial update와 validation이 충돌하지 않도록 저장 계약을 검토해야 한다.
- Audio device 저장 요청은 서버에서 현재 오디오 runtime을 재시작한다. 요청 도중 live session 상태가 바뀌는 경우 사용자에게 정확한 결과를 제공해야 한다.
- `AppearanceSection`의 theme control을 제거하더라도 사용자 취향(theme) 저장은 상단 toggle에서 계속 유지되어야 한다.
