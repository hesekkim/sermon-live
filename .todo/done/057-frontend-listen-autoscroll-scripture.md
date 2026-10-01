# 057 Listen 자동 스크롤 및 성경 팝업 UX

상태: 완료
우선순위: 높음 (실시간 청취 가독성)

## Goal

Listen에서 새 번역 문장이 들어오면 최신 문장이 화면에 보이도록 자동 스크롤한다. 성경 팝업을 화면 상단으로 옮겨 새 자막을 가리지 않게 하고, 팝업을 닫은 뒤 다음 성경 이벤트가 오면 카드와 swipe 안내가 다시 표시되도록 한다. 화면 제목 `Demo`는 서비스 의미에 맞는 `Seanuree Live`로 변경한다.

## Why

자막이 누적되어 화면 아래로 밀려도 화면이 따라가지 않아 청취자가 직접 스크롤해야 한다. 성경 팝업은 viewport 하단에 고정되어 새로 표시되는 자막과 하단 청취 도구를 가릴 수 있다. 사용자는 첫 팝업을 왼쪽 swipe로 닫은 다음 새 성경 이벤트를 받아도 카드와 swipe 안내가 모두 다시 보이지 않는다고 보고했다. 현재 화면 제목 `Demo`도 더 이상 실제 서비스 이름과 맞지 않는다.

## Related files

- `frontend/src/pages/Listen/Listen.tsx`
- `frontend/src/pages/Listen/Listen.module.css`
- `frontend/src/pages/Listen/ScripturePopup/ScripturePopup.module.css`
- `frontend/src/pages/Listen/ScripturePopup/useScripturePopup.ts`
- `frontend/src/pages/Listen/useListenAudio.ts`
- `frontend/tests/unit/Listen.test.tsx`
- `frontend/index.html` (브라우저 탭 제목은 별도이며 이번 변경 범위에서는 제외)

## Scope

- `subtitleLines`가 갱신되면 마지막 문장으로 자동 스크롤한다. 계속 들어오는 delta도 최신 위치를 유지하고 고정 footer가 최신 문장을 가리지 않게 한다.
- 성경 팝업을 viewport 상단의 헤더 아래에 배치하고 safe-area inset을 반영한다.
- 마지막 scripture 카드를 swipe로 닫고 새 scripture 이벤트를 수신하는 회귀 시나리오를 검증한다. 카드와 swipe 안내 모두 다시 표시되어야 한다.
- 팝업이 닫힌 뒤 새 이벤트가 도착해도 이전 dismiss animation/timer 상태가 새 팝업을 숨기지 않도록 한다. swipe 안내는 새 팝업에서 다시 확인할 수 있어야 한다.
- 화면의 `Demo` 제목을 `Seanuree Live`로 변경한다.

## Out of Scope

- Backend reference detection, scripture corpus, WebSocket event schema 변경. 프론트 회귀 테스트가 서버 이벤트 누락을 입증하는 경우에만 별도 검토한다.
- 브라우저 tab/document title 변경.
- Listen transcript persistence, Operator UI, audio playback behavior 변경.
- 디자인 스냅샷 또는 CSS className 전용 테스트.

## Implementation notes

- 자동 스크롤은 Listen DOM 경계에서 최신 자막 요소를 ref로 추적하고 `subtitleLines` 변경에 동기화한다. 전체 transcript를 중첩 스크롤 영역으로 바꾸지 않는다.
- 스크롤 시 고정 footer와 겹치지 않도록 기존 페이지 하단 여백과 요소의 scroll margin을 확인한다.
- Scripture payload는 `useListenAudio`가 파싱하고, Listen이 수신 본문을 로컬 카드 목록으로 관리한다. Backend는 번역 텍스트에서 참조를 감지해 별도 이벤트를 보낸다.
- `useScripturePopup`의 dismiss timeout, 새 top card 변경, 안내 표시 시점을 함께 검토한다. 기존 swipe 임계값과 키보드 동작은 유지한다.
- 상태 전환 테스트는 mock WebSocket의 실제 이벤트 순서로 작성한다. 기존 구현으로 보고된 재현이 되지 않으면 상태를 추측해 변경하지 말고 테스트 시퀀스와 사용자의 런타임 흐름 간 차이를 확인한다.

## Acceptance criteria

- 새 자막 문장 또는 추가 delta가 도착할 때 최신 문장이 viewport 안에 자동으로 들어온다.
- 자동 스크롤 후에도 최신 문장이 고정 footer에 가려지지 않는다.
- 성경 팝업은 헤더 아래 viewport 상단에 표시되며 기존 swipe 닫기, 카드 스택, 테마 표현이 유지된다.
- 마지막 성경 카드를 왼쪽 swipe로 닫은 후 새 scripture 이벤트가 오면 새 카드가 표시된다.
- 새 팝업에서 `Zum Schließen nach links wischen` 안내가 다시 표시된다.
- Listen 화면 제목이 `Seanuree Live`로 표시된다.
- Backend event contract와 interpreter pipeline은 변경하지 않는다.

## Tests

- `Listen.test.tsx`: 새 자막 수신 후 최신 문장으로 스크롤 동작이 요청되는지 확인한다.
- `Listen.test.tsx`: scripture 이벤트 수신, 마지막 카드 swipe dismiss, 이후 새 scripture 이벤트 수신 순서에서 카드와 swipe 안내가 재등장하는지 검증한다.
- 기존 scripture stack 전환 및 swipe animation 테스트가 계속 통과해야 한다.
- 프론트 검증: `cd frontend && npm test -- tests/unit/Listen.test.tsx`
- 타입/번들 검증: `cd frontend && npm run build`

## Manual verification

- 데스크톱과 모바일에서 자막을 충분히 누적해 새 문장이 화면 아래에 남지 않고 따라오는지 확인한다.
- 최신 자막이 fixed footer에 가려지지 않는지 확인한다.
- 상단 팝업이 헤더, 테마 버튼, safe-area와 겹치지 않는지 확인한다.
- 첫 팝업을 swipe로 닫고 실제 후속 scripture 이벤트 후 카드와 안내가 다시 보이는지 확인한다.
- 제목이 `Seanuree Live`인지 확인한다.

## 구현 및 검증 기록

- `Listen`의 최신 자막 요소를 ref로 추적하고 자막 목록 변경 시 `scrollIntoView`를 호출한다. 현재 자막에 footer 여백을 두어 스크롤 후 고정 footer에 가려지는 것을 줄였다.
- 성경 팝업은 safe-area를 반영해 헤더 아래 화면 상단에 고정한다.
- 새 top scripture가 선택될 때 swipe 안내 표시를 갱신한다. 마지막 카드를 닫고 후속 이벤트를 받은 흐름과 스택의 다음 카드 표시를 회귀 테스트로 검증한다.
- 화면 제목을 `Seanuree Live`로 변경했다. 브라우저 tab title은 유지했다.
- 검증 통과: `npm test -- tests/unit/Listen.test.tsx` (15 tests), `npm run build`, `git diff --check`, 편집 파일 diagnostics.
- 개발 서버 `http://localhost:5173/listen`에서 데스크톱 및 390x844 모바일의 제목과 기본 레이아웃을 확인했다. backend가 실행되지 않아 실제 scripture 이벤트가 뜬 상태의 시각 확인은 하지 못했다. 해당 이벤트 흐름은 Vitest로 검증했다.

## Risks

- `scrollIntoView`의 부드러운 스크롤을 모든 delta마다 호출하면 사용자가 과거 자막을 읽는 동작을 방해할 수 있다. 실시간 청취의 최신 문장 추적을 우선하되, 필요하면 동작을 줄 단위 또는 sentinel 기준으로 조정한다.
- 팝업을 상단에 고정하면 긴 카드가 자막과 겹칠 수 있으므로 기존 max-height 및 내부 스크롤을 유지한다.
- 현재 프론트 상태 경로는 새 scripture 이벤트를 받을 수 있어 보인다. 사용자 재현과 테스트 결과가 다를 경우 임의로 backend를 수정하지 않고 실제 이벤트 시퀀스를 먼저 확인한다.
