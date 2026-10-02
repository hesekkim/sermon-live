# 055 Listener 독일어 정본 구절 popup

상태: 완료
우선순위: 높음

## Goal

Listener가 backend의 scripture 이벤트를 받아 기존 OpenAI 독일어 번역 아래에 Lutherbibel 1912 reference와 정본 구절을 간결한 popup/패널로 표시한다. 번역 text와 재생 audio는 그대로 둔다.

## UX Decisions

- reference 이벤트가 오기 전에는 scripture 영역을 렌더링하지 않는다.
- scripture popup은 화면 상단 safe area에서 `12px` 아래에 고정하고 footer 조작부보다 높은 z-index로 표시한다. 수신된 scripture가 여러 개면 같은 폭으로 수직 스택을 만들며, 뒤 카드는 아래쪽으로 offset한다.
- Card surface는 light/dark theme 각각 불투명한 배경을 사용해 뒤 카드의 글자가 비치지 않게 한다. 긴 본문은 높이를 제한하고 내부에서 스크롤한다.
- 카드 tap/click으로 맨 앞 카드 하나를 닫는다. Enter/Space도 같은 닫기 동작을 하고 Escape는 전체 큐를 닫는다.
- 닫을 때 카드는 위로 `420ms` 이동한다. opacity는 `100ms` 뒤 시작해 `320ms` 동안 줄고, `460ms` 시점에 큐에서 제거한다. `prefers-reduced-motion`에서는 CSS transition을 비활성화한다.
- swipe hint 없이 카드를 표시해 카드 스택이 safe-area 상단 위치에서 바로 시작한다.
- 새 scripture reference는 동적 큐 맨 앞에 놓이고 이전 수신 카드들은 뒤에 남는다. tap/click dismiss는 맨 앞 카드 하나만 제거한다.
- 본문은 Lutherbibel 1912 판본임을 명시하고 reference label을 함께 보여준다.
- 일반 번역은 기존 메인 자막에 계속 남는다. 정본 구절로 번역문을 치환하거나 기존 문장을 지우지 않는다.
- 정적 예시 scripture는 제공하지 않는다. Listener는 실제 수신된 scripture 이벤트만 표시한다.
- session `starting`에서 이전 session scripture 상태를 초기화한다. session 종료 상태와 Listen audio control 동작은 기존 규칙을 유지한다.
- popup은 텍스트 전용이며 audio, TTS, playback scheduling에 관여하지 않는다.

## Implementation Notes

- WebSocket parsing과 최신 scripture 상태는 `useListenAudio` hook에 둔다. `Listen`은 실제 수신 이벤트를 동적 카드 목록에 쌓아 `ScripturePopup`에 전달한다.
- `ScripturePopup`의 마크업/스타일은 전용 component와 CSS module에 두고, dismiss animation 상태와 timer는 인접한 `useScripturePopup` hook에서 관리한다.
- 새 event discriminator를 기존 일반 `{text}` subtitle 누적 로직과 분리한다. scripture text가 OpenAI 번역 subtitle 문자열에 섞이지 않게 한다.
- reference ID/verse array를 유지해 verse range, 줄바꿈, reference label을 안정적으로 렌더링한다.
- popup은 소형 모바일 화면에서도 메인 번역과 겹치지 않고 세로로 배치한다. 긴 본문은 영역 안에서 줄바꿈되며 스크롤을 방해하지 않는다.
- accessibility를 위해 판본/구절 변경은 적절한 live region으로 알린다. 시각적 디자인/스타일 snapshot 테스트는 추가하지 않는다.

## Acceptance Criteria

- [x] scripture 이벤트 수신 시 reference, `Lutherbibel 1912` 표기, 본문이 메인 번역 아래 표시된다.
- [x] scripture 이벤트가 없어도 기존 Listen 자막/오디오/status UI는 이전과 동일하게 동작한다.
- [x] scripture event payload는 일반 subtitle text를 변경하지 않는다.
- [x] 다음 reference는 동적 스택의 앞에 추가되고, tap/click dismiss는 앞 카드만 제거해 다음 수신 구절을 드러낸다. Escape는 스택 전체를 닫는다.
- [x] 실제 scripture 이벤트가 없으면 환경과 query string에 관계없이 scripture 카드를 렌더링하지 않는다.
- [x] audio start/stop, PCM playback queue, reconnect, font-size/theme 동작에 regression이 없다.
- [x] 본문 없는/필드 오류 payload는 무시하고 기존 자막을 유지한다.
- [x] popup이 footer 조작부를 덮고 좌우 12px inset으로 최하단에 표시된다.
- [x] light/dark theme 모두 불투명한 카드 surface를 사용해 뒤 카드 텍스트가 비치지 않는다.
- [x] tap/click과 Enter/Space로 최상단 카드 하나를 닫고 Escape로 전체 스택을 닫는다.
- [x] 최상단 카드는 위로 자연스럽게 이동하며 사라진 뒤 제거되고 다음 카드가 드러난다.
- [x] swipe hint 없이 팝업이 safe-area 상단에서 시작한다.

## Tests

- `frontend/tests/unit/Listen.test.tsx`에서 이벤트 전 빈 상태, 실제 scripture 이벤트 누적, 한 장씩 dismiss를 검증한다.
- 같은 테스트에서 기존 subtitle text가 별도로 누적되는지, scripture event가 audio control 흐름에 영향을 주지 않는지 검증한다.
- 레이아웃, CSS class, snapshot 자체를 검증하는 테스트는 추가하지 않는다.
- 수동 검증: desktop/mobile Listener, 한 절 및 multi-verse range, 장시간 자막에서 번역과 popup이 겹치지 않는지 확인한다.

## Dependencies

- `054-backend-german-scripture-reference-events.md`

## Related Tickets

- `053-backend-luther1912-scripture-corpus.md`
- `054-backend-german-scripture-reference-events.md`

## 구현 결과

- `useListenAudio`가 `scripture` WebSocket 이벤트를 검증해 별도 상태로 보관하고, 새 translation session 시작 때 이전 구절 상태를 비운다.
- Listener는 실제 수신된 scripture를 목록에 누적해 최신 reference를 앞에 표시하고, tap/click 시 한 장씩 제거한다. 일반 번역과 PCM playback은 변경하지 않는다.
- 본문/참조 필드가 잘못된 이벤트는 무시한다.
- Popup은 fixed top `12px + safe-area inset`, 좌우 `12px` 여백, footer보다 높은 z-index로 표시한다. hint가 없어져 카드가 팝업 상단 위치부터 시작한다.
- Card는 불투명한 동일 폭 surface로 수직 스택된다. 최상단 카드 tap/click 시 위로 `420ms` 이동하고 `100ms` 뒤 opacity가 `320ms` 동안 감소한다. hook은 `460ms` 후 카드를 제거한다.
- Popup UI를 `ScripturePopup/ScripturePopup.tsx`로 분리하고 dismiss animation 상태와 timer를 `ScripturePopup/useScripturePopup.ts`에서 관리한다. `Listen`은 표시 데이터와 닫기 동작만 연결한다.
- swipe hint와 pointer drag/dim 상태는 사용하지 않는다. 정적 예시 scripture fixture와 preview query 처리를 제거해 실제 이벤트 전에 카드가 렌더링되지 않도록 한다.
- 정적 예시 scripture fixture와 preview query 처리는 제거했다. 실제 이벤트 전에는 카드가 렌더링되지 않는다.

## 검증 결과

- `frontend/tests/unit/Listen.test.tsx`: 20 passed. 실제 구절 이벤트 전 빈 상태, 수신 구절 누적, click/keyboard 닫기, animation 중 카드 유지, 다음 카드 노출 및 session 동작을 확인했다.
- `npm run build`: 통과.
- `git diff --check`: 통과.
