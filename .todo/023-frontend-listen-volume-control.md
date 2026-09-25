# 023 Listen 볼륨 컨트롤

상태: 대기

## Goal

Listen 페이지에 재생 볼륨 조절 컨트롤을 추가한다. Listener의 전체 단순 UX는 030에서 관리한다.

## Why

청취자가 재생 볼륨을 직접 조절할 수 있어야 한다 (Archthecture.md 31번).

## Related files

- `frontend/src/pages/Listen/Listen.tsx`
- `frontend/src/pages/Listen/useListenAudio.ts`

## Dependencies

없음 (낮은 우선순위, 다른 프론트 작업과 병렬 가능)

## Implementation notes

- Web Audio API `GainNode`를 오디오 재생 경로에 추가해 볼륨 조절.
- 기존 subtitle/status 흐름 회귀 없어야 함.
- 연결 상태, 자막, 듣기 시작 버튼, 글자 크기, 테마는 이 티켓의 범위에 포함하지 않는다.

## Acceptance criteria

- 슬라이더로 재생 볼륨 조절 가능, 새로고침 후에도 마지막 볼륨 유지(localStorage) 여부는 선택.

## Tests

- `useListenAudio`에서 GainNode 값 반영 로직 단위 테스트 (실제 오디오 재생/디자인은 테스트 제외).

## Risks

- 낮음.
