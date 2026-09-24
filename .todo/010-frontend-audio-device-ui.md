# 010 오디오 장치 선택 UI

상태: 대기

## Goal

Settings 페이지에 오디오 입력 장치 Select를 추가하고, 장치 목록/저장을 담당하는 `useAudioDevices` 훅을 만든다.

## Why

Operator가 UI에서 장치를 고를 수 있어야 003/009의 백엔드 기능이 의미가 있다.

## Related files

- `frontend/src/pages/Operator/settings/Settings.tsx`
- 신규 `frontend/src/pages/Operator/settings/useAudioDevices.ts`
- 신규 `frontend/tests/unit/useAudioDevices.test.ts(x)`

## Dependencies

009

## Implementation notes

- `useAudioDevices()`: `GET /api/v1/audio/devices` 호출, 선택값은 기존 Settings 저장 흐름(`PUT /api/v1/operator/settings`)에 편승.
- 기존 `Select` 공용 컴포넌트 재사용.
- 기존 hook-per-feature 패턴(예: `useOperatorLayout`)을 따른다.

## Acceptance criteria

- 장치 목록이 드롭다운에 표시되고 선택 시 저장된다.
- 장치 목록 조회 실패 시 에러 상태를 사용자에게 보여준다 (Toast 등 기존 패턴 재사용).

## Tests

- mock fetch로 장치 목록 렌더링/선택/저장 흐름 검증.

## Risks

- 낮음.
