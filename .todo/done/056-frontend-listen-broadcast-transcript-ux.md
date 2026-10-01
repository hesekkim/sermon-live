# 056 Listen 및 Broadcast transcript UX 개선

상태: 완료
우선순위: 높음 (자막 보존 및 핵심 청취 UX)

## Goal

Listen 청취 중 이전 문장과 현재 문장을 구분하고, 방송 종료 후에도 열린 Listen 화면에서 설교 텍스트를 보존한다. Broadcast Output은 문장 단위로 누적·강조하며, 새 방송 시작 전에 기존 기록을 처리하고 Output 영역 안에서만 스크롤되게 한다.

## Why

현재 Listen은 새 문장이 들어오면 이전 문장을 대체하고, 방송 종료 상태가 자막을 가리거나 청취 버튼의 상태와 일치하지 않을 수 있다. Operator의 Output도 스트리밍 조각이 문장으로 구분되지 않고, 기록이 길어질 때 전체 페이지가 스크롤될 수 있다. 방송 재시작 전에 이전 Output을 내려받거나 폐기할 기회도 필요하다.

## Related files

- `frontend/src/pages/Listen/useListenAudio.ts`
- `frontend/src/pages/Listen/Listen.tsx`
- `frontend/src/pages/Listen/Listen.module.css`
- `frontend/src/pages/Operator/layout/OperatorLayout.tsx`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastSession.ts`
- `frontend/src/pages/Operator/broadcast/hooks/useBroadcastToggle.ts`
- `frontend/src/pages/Operator/broadcast/Broadcast.tsx`
- `frontend/src/pages/Operator/broadcast/Broadcast.module.css`
- `frontend/src/pages/Operator/broadcast/components/TranscriptPane.tsx`
- `frontend/src/pages/Operator/broadcast/utils/transcriptFile.ts`
- `frontend/src/shared/components/Dialog/Dialog.tsx`
- `frontend/src/pages/Operator/translations.ts`
- `frontend/tests/unit/Listen.test.tsx`
- `frontend/tests/unit/liveFlow.test.tsx`
- `frontend/tests/unit/useBroadcastSession.test.tsx`
- `frontend/tests/unit/useBroadcastToggle.test.tsx`
- `frontend/tests/unit/transcriptFile.test.ts`
- `frontend/tests/unit/TranscriptPane.test.tsx`

## Dependencies

- `.todo/done/033-frontend-listener-core-ux.md`
- `.todo/done/035-frontend-broadcast-termination-state.md`
- `.todo/done/044-frontend-listen-settings-ux-polish.md`
- `.todo/done/050-operator-websocket-audio-isolation.md`

## Scope

- Listen의 스트리밍 자막을 문장 이력으로 누적하고, 이전 문장은 일반 text 색상, 마지막 문장 및 아직 완성되지 않은 현재 문장은 강조 색상으로 표시한다.
- Listen에 `session_ended` 또는 terminal status가 오면 재생 중인 audio와 queue를 정리하고 listening state 및 버튼 UI를 `anhören` 상태로 복귀시킨다. 종료된 방송에서 다시 듣기를 시작할 수 없도록 버튼의 disabled 상태를 분명하게 구분한다.
- 방송이 종료되어도 열린 Listen 화면의 자막을 유지한다. 종료 배지나 안내가 자막을 대체하지 않으며, 종료 여부는 버튼 상태로만 표현한다.
- Broadcast Output이 존재할 때만 새 Broadcast 시작 전 공통 Dialog로 다운로드 여부를 확인한다. 다운로드를 선택하면 기존 output transcript 다운로드를 시작한다. 다운로드하지 않는 선택도 기존 기록을 폐기하고 계속 시작하는 의미로 명확히 표시한다.
- Dialog의 취소, 닫기, Escape는 새 Broadcast를 시작하지 않고 기존 Input/Output transcript를 보존한다.
- 다운로드 여부와 관계없이 새 Broadcast를 시작할 때 이전 Input/Output transcript를 초기화한다. Output이 없는 경우 확인 Dialog 없이 시작한다.
- Broadcast Output은 조각을 문장 행으로 누적한다. 완료된 문장은 새 행에서 시작하며 이전 문장은 일반색, 새 문장 또는 마지막 미완성 문장은 강조색으로 보여준다.
- 긴 Output은 Output 전용 영역 내부에서 스크롤되며 페이지 전체가 transcript 길이에 따라 확장되지 않게 한다.

## Out of Scope

- Listen transcript를 새로고침·탭 종료·페이지 이탈 이후에도 보존하기 위한 localStorage, IndexedDB, backend persistence.
- Input transcript를 Broadcast Output처럼 문장별 색상으로 렌더링하거나 문장 분할 규칙을 변경하는 일.
- Backend event schema, interpreter adapter 또는 vendor별 pipeline 변경.
- 실제 OpenAI API, 실제 마이크 또는 외부 서비스 호출을 사용하는 자동화 테스트.

## Implementation notes

- Listen transcript 이력과 문장 누적은 `useListenAudio` hook에서 관리하고, 표시 컴포넌트는 문장 목록과 현재 문장을 props/state로 렌더링한다.
- 문장 분할은 스트리밍 delta의 문장 종료 부호(`.`, `?`, `!`)와 그 뒤에 오는 닫는 따옴표를 고려한다. 끝나지 않은 조각은 현재 문장으로 남겨 다음 delta와 이어 붙인다. 불필요한 공백은 정리하되 출력 텍스트의 구두점은 보존한다.
- Listen 기록은 현재 페이지의 메모리 상태에만 둔다. 방송 종료 이벤트만으로 비우지 않고, 새 세션의 `starting` 이벤트에서는 이전 세션 텍스트를 초기화한다.
- 종료 상태 처리는 기존 WebSocket/audio hook 경계를 유지한다. 종료 시 재생 queue 정리와 UI 상태 변경이 중복 이벤트나 뒤늦은 status 이벤트에 의해 되돌아가지 않는지 확인한다.
- Dialog가 확인되기 전에는 Broadcast start와 transcript clear를 실행하지 않는다. 다운로드에는 `downloadTextFile`, `buildTranscriptPaneDownload`, 현재 `sermon-output-transcript.txt` 파일명 및 newline 포맷을 재사용한다.
- 새 Broadcast 시작 직전에 Input과 Output 양쪽의 기존 transcript를 원자적으로 초기화한다. 사용자가 취소한 경우 둘 다 유지한다.
- Output sentence accumulator는 Input transcript accumulator와 분리해 Output에만 적용한다. 마지막 미완성 문장도 표시하고, 이후 조각이 도착하면 이어 붙인다.
- 기존 `TranscriptPane`의 `past`/`current` 표시를 활용한다. 내부 스크롤이 작동하도록 Output과 부모 flex item의 `min-height`/height 제약을 확인하고, 필요한 최소 레이아웃만 조정한다.
- Dialog, 버튼 label, 접근성 이름 등 사용자 노출 문구가 추가되면 지원 중인 언어 번역을 모두 갱신한다. raw session reason을 노출하지 않는다.

## Acceptance criteria

- 새 Listen 문장이 시작되어도 이전 문장이 화면에 남고 일반색으로 표시된다. 새로 들어오는 문장만 강조색을 사용한다.
- 문장 조각이 여러 WebSocket delta로 나뉘어 와도 같은 문장으로 누적되고, 문장 종료 부호 뒤 다음 문장은 별도 행으로 표시된다.
- Listen 화면이 열린 상태에서 서버 종료 이벤트를 받아도 기존 자막 텍스트가 유지된다.
- 서버 종료 시 audio 재생 및 queue가 정리되고, Listen 버튼은 `anhören` UI와 disabled 상태로 돌아온다. disabled와 enabled 버튼은 색상/대비 등으로 명확히 구분된다.
- Listen 종료 안내나 badge가 transcript 영역에 나타나 기존 설교 텍스트를 가리거나 대체하지 않는다.
- Output transcript가 있을 때 새 Broadcast를 누르면 다운로드 여부 Dialog가 표시된다. 다운로드 선택은 기존 파일 포맷으로 내려받고, 다운로드하지 않는 선택은 폐기 후 시작한다.
- Dialog를 취소하거나 닫으면 Broadcast가 시작되지 않고 기존 Input/Output transcript가 그대로 남는다.
- 새 Broadcast가 시작되면 Input/Output의 이전 transcript가 초기화된다. Output이 비어 있으면 Dialog 없이 시작된다.
- Broadcast Output의 이전 문장은 일반색, 현재 문장은 강조색으로 표시되고 완료 문장마다 반드시 새 줄에서 시작한다.
- Output이 길어져도 스크롤은 Output 영역 내부에서만 발생하며 페이지 전체 높이를 늘리지 않는다.
- 구현은 frontend 범위에 한정하며, backend event contract와 provider-neutral interpreter pipeline은 변경하지 않는다.

## Tests

- `Listen.test.tsx`: 문장 이력과 현재 문장 강조, 세션 종료 후 텍스트 보존, 종료 후 버튼 및 disabled state를 검증한다.
- `liveFlow.test.tsx`: transcript delta 누적과 session 종료 뒤 자막/버튼 상태를 핵심 흐름에서 확인한다.
- `useBroadcastSession.test.tsx`: 새 Broadcast 시작 시 Input/Output 초기화, Output 조각의 문장 누적 및 미완성 문장 처리를 검증한다.
- `useBroadcastToggle.test.tsx`: 시작 전 보류, 확인 후 start, 취소 시 start 미호출을 검증한다.
- `transcriptFile.test.ts`: 다운로드 파일 텍스트와 기존 줄바꿈 포맷을 확인한다.
- `TranscriptPane.test.tsx`: 행별 past/current text 렌더링을 확인한다.
- CSS layout snapshot이나 className만을 대상으로 한 테스트는 추가하지 않는다.
- 테스트는 mock 기반으로 실행하며 실제 API key, OpenAI 호출, 마이크를 사용하지 않는다.

## Manual verification

- Operator에서 Output이 있는 상태로 새 Broadcast를 누르고 다운로드, 미다운로드, 취소 각각의 결과를 확인한다. 다운로드 파일명과 텍스트 줄바꿈을 확인한다.
- Listen에서 여러 문장의 delta를 수신해 이전/현재 문장 색상과 줄바꿈을 확인한 뒤 서버 종료를 발생시킨다. 기존 텍스트가 남고 버튼만 종료 상태로 바뀌는지 확인한다.
- Output에 긴 텍스트를 표시해 데스크톱과 모바일 viewport에서 Output 내부 스크롤 및 페이지 높이를 확인한다.
- 자동 검증 명령:
  - `cd frontend && npm test -- tests/unit/Listen.test.tsx tests/unit/liveFlow.test.tsx tests/unit/useBroadcastSession.test.tsx tests/unit/useBroadcastToggle.test.tsx tests/unit/transcriptFile.test.ts tests/unit/TranscriptPane.test.tsx`
  - `cd frontend && npm run build`

## 구현 및 검증 기록

- Listen은 이전 문장과 현재 문장을 누적 렌더링하고, 세션 종료 시 재생 queue를 정리하면서 열린 화면의 텍스트를 보존한다. 정상 종료 안내는 badge 대신 disabled `anhören` 버튼에만 표시한다.
- 새 Broadcast 시작은 공통 Dialog에서 다운로드/미다운로드/취소를 선택한다. 취소는 기존 기록을 유지하고, 시작 승인은 Input/Output 기록을 지운 뒤 실행한다.
- Output transcript는 문장별 줄로 누적하고 기존 past/current 색상을 사용한다. Operator route 높이를 viewport에 제한해 transcript pane 내부 스크롤을 적용했다.
- 검증: 관련 Vitest 6개 파일, 43개 테스트 통과. `npm run build` 통과. 수정 파일 진단 오류 없음, `git diff --check` 통과.
- Vite Listen 화면 렌더링을 확인했다. Operator 브라우저 확인은 backend 인증 응답이 없어 수행하지 못했으며, Dialog 선택 및 긴 Output 내부 스크롤 수동 확인이 남아 있다.

## Risks

- 스트리밍 transcript는 문장부호가 없거나 독일어 약어·숫자·인용부호를 포함할 수 있다. 문장 경계 규칙은 실제 delta 분할 패턴으로 테스트하고, 분할이 불확실한 텍스트를 잃거나 중복하지 않아야 한다.
- WebSocket 종료 이벤트와 session status 이벤트 도착 순서에 따라 버튼 상태가 경합할 수 있으므로 두 종료 경로를 같은 terminal state로 정규화한다.
- `.scroll`에 overflow가 설정되어 있어도 부모 높이 제약이 없으면 전체 페이지가 늘어날 수 있으므로 실제 브라우저 viewport에서 확인한다.
- 브라우저 다운로드 API가 완료를 동기적으로 보장하지 않으므로, 다운로드 요청 직후 새 방송을 진행하는 동작을 수동으로 확인한다.
