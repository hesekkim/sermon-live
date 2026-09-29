# 044 Frontend Listen 및 Settings UX 보정

상태: 완료
우선순위: 중간

## Goal

Listener의 듣기 동작과 transcript 다운로드 affordance를 명확하게 하고, Settings의 저장 가능 상태와 키보드 포커스 표시를 일관되게 만든다.

## Why

현재 Listen 버튼은 연결되지 않은 상태에서도 활성화되어 있고 시작 후 중지 동작이 없다. 빈 transcript도 다운로드할 수 있으며, Settings Apply는 저장할 변경이 없어도 활성화된다. Settings tab은 공통 버튼과 다른 전역 focus 표시를 사용한다.

## Related files

- `frontend/src/pages/Listen/Listen.tsx`
- `frontend/src/pages/Listen/useListenAudio.ts`
- `frontend/src/pages/Operator/broadcast/components/TranscriptPane.tsx`
- `frontend/src/pages/Operator/broadcast/Broadcast.module.css`
- `frontend/src/pages/Operator/broadcast/utils/transcriptFile.ts`
- `frontend/src/pages/Operator/settings/Settings.tsx`
- `frontend/src/pages/Operator/settings/Settings.module.css`
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`
- `frontend/tests/unit/Listen.test.tsx`
- `frontend/tests/unit/OperatorPrefs.test.tsx`
- `frontend/tests/unit/transcriptFile.test.ts`
- `frontend/tests/unit/TranscriptPane.test.tsx` (필요한 경우 신규)

## Dependencies

- `.todo/done/033-frontend-listener-core-ux.md`
- `.todo/done/037-frontend-settings-tabs-and-save-scope.md`

## Scope and implementation notes

### Listen 연결 및 듣기 제어

- WebSocket은 기존대로 화면 진입 시 연결하고 예기치 않은 종료 시 자동 재연결한다. 버튼으로 WebSocket 연결 수명주기를 바꾸지 않는다.
- 연결 상태가 `connected`가 아니거나 번역 세션 상태가 `live`가 아니면 듣기 시작 버튼을 비활성화한다. 이미 듣는 중이면 연결 또는 세션이 종료되어도 중지 동작은 가능해야 한다.
- 연결과 번역 세션이 모두 활성화된 상태에서 버튼을 누르면 AudioContext를 사용자 제스처로 활성화하고 듣기를 시작한다. 다시 누르면 로컬 오디오 재생을 중지한다.
- 중지 시 예약되거나 대기 중인 오디오가 계속 재생되지 않게 정리한다. WebSocket 연결과 기존 자막/상태 표시 및 재연결 처리는 유지한다.
- 버튼의 accessible name과 표시 문구는 듣기 시작/중지 상태를 구분하고, 기존 연결/Translation 상태 표시와 혼동되지 않게 한다.

### Transcript 다운로드

- 다운로드 버튼은 제목 바로 옆에 배치하고 header의 양 끝으로 분리하지 않는다.
- 유효한 transcript 내용이 하나도 없으면 버튼을 비활성화한다. 내용이 있을 때만 파일 다운로드가 가능해야 한다.
- 접근 가능한 이름과 tooltip을 유지한다. 버튼 hit area는 고정 크기로 두고 hover 배경은 원형으로 표시한다. 키보드 focus-visible 표시를 제거하지 않는다.
- `buildTranscriptPaneDownload`의 기존 파일 내용/줄바꿈 규칙은 이 UX 작업과 무관하게 유지한다.

### Settings Apply 변경 감지

- Safety draft와 API Model draft를 각각 서버에서 읽은 값 및 성공적으로 저장한 값과 비교한다. 두 탭은 서로의 미저장 draft에 영향을 받지 않는다.
- Safety Apply는 timer 값이 저장값과 다르고 유효성 오류가 없으며 저장 중이 아닐 때만 활성화한다. 값을 원래대로 되돌리면 다시 비활성화한다.
- API Model Apply는 interpreter가 저장값과 다르거나 새 API key가 입력된 경우에만 활성화한다. key 입력 후 지우면 다른 변경이 없는 한 pristine 상태로 돌아간다.
- 기존 key는 서버에서 평문으로 받을 수 없으므로 baseline으로 복사하지 않는다. 빈 key 입력은 기존 key 삭제 요청이 아니라 변경 없음으로 처리한다.
- 저장 성공 시 해당 탭의 baseline을 응답값으로 갱신한다. 실패하면 draft는 유지하고 재시도 가능하게 한다.
- Appearance 언어와 Input device의 즉시 반영/저장 동작은 바꾸지 않는다.

### Settings tab focus

- tab의 `:focus-visible` 스타일을 공통 Button의 `--cf-focus-color` 및 `--cf-focus-offset`과 일치시킨다.
- 포커스 ring과 활성 tab 표시가 동시에 구분되어야 하며, 마우스 클릭만으로 불필요한 키보드 포커스 ring을 표시하지 않는다.

## Acceptance criteria

- WebSocket이 `idle`, `connecting`, `reconnecting`이거나 번역 세션이 `live`가 아닐 때 듣기 시작은 불가능하다. WebSocket이 `connected`이고 번역 세션이 `live`일 때 시작할 수 있다.
- 듣기 중 버튼은 중지 동작을 제공하고, 연결이 끊긴 상태에서도 중지할 수 있다. 중지 후 예약 오디오가 재생되지 않으며 자동 재연결은 계속 동작한다.
- 내용이 없는 transcript는 다운로드할 수 없고, transcript 내용이 생기면 다운로드할 수 있다.
- 다운로드 아이콘은 pane title 바로 옆에 있고 hover/focus 상태에서도 원형 hit area 및 접근성이 유지된다.
- 변경되지 않은 Safety/API Model 설정에서는 Apply가 비활성화된다. 유효한 변경은 활성화되고, 원복 또는 성공 저장 후 비활성화된다.
- Safety 검증 오류와 저장 중에는 Safety Apply가 비활성화된다. API key를 입력 후 비우는 경우 저장되지 않은 변경으로 남지 않는다.
- Settings tab의 키보드 focus ring이 공통 Button focus 표시와 같은 색상 및 offset을 사용한다.
- 기존 UI language 즉시 적용, Audio device 저장, key masking, Listen 자동 재연결이 회귀하지 않는다.

## Tests

- `Listen.test.tsx`: 연결 전/중/재연결 중 및 세션 비활성 상태의 disabled 상태, 연결과 세션 활성 후 시작, 시작 후 중지, 재시작, stop 중 AudioContext 재개가 완료되는 이전 chunk 폐기, 예기치 않은 연결 종료 후 자동 재연결을 검증한다. WebSocket과 AudioContext는 기존 mock을 사용한다.
- Settings save flow: pristine/dirty/reverted/invalid/saving/success 상태에서 Apply 활성 조건과 성공 후 baseline 갱신을 검증한다. Safety와 API Model draft의 독립성을 유지한다.
- TranscriptPane: 빈 transcript는 다운로드할 수 없고 내용이 있는 경우 다운로드 함수가 호출되는지 검증한다. 스타일이나 snapshot 테스트는 추가하지 않는다.
- `frontend`에서 `npm test -- tests/unit/Listen.test.tsx tests/unit/OperatorPrefs.test.tsx tests/unit/TranscriptPane.test.tsx` 실행 후 `npm run build`를 실행한다.
- 탭 키보드 탐색의 focus ring은 브라우저에서 수동 확인한다.

## Risks

- AudioContext만 suspend하거나 state flag만 변경하면 이미 예약된 AudioBufferSource가 계속 재생될 수 있다. 중지 시 실제 출력과 pending audio를 정리하는 동작을 검증한다.
- OpenAI API key 원문을 saved baseline, test assertion output 또는 로그에 추가하지 않는다.
- CSS Modules focus 스타일은 프로젝트의 테스트 규칙에 따라 자동화하지 않고 실제 키보드 탐색으로 확인한다.
