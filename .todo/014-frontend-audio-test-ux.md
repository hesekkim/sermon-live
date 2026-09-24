# 014 오디오 테스트 UX

상태: 대기

## Goal

장치 선택, 상태, 입력 레벨, 감지 포맷, 처리 포맷, "Test Audio" 버튼으로 구성된 Audio Test 패널을 만든다.

## Why

Operator가 세션을 켜기 전에 오디오 파이프라인이 정상인지 스스로 확인할 수 있어야 한다.

## Related files

- `frontend/src/pages/Operator/settings/Settings.tsx` 또는 신규 페이지
- 012에서 만든 AudioLevelMeter 컴포넌트 재사용

## Dependencies

012, 013

## Implementation notes

- Archthecture.md 13번 mockup을 참고: Device / Status / Input Level / Detected format / OpenAI Processing format / Test 버튼.
- 013 엔드포인트를 호출하는 훅을 추가하고 기존 Select/Button 컴포넌트 재사용.

## Acceptance criteria

- Test 버튼 클릭 시 013 호출 결과(감지 포맷, 레벨, 처리 결과)가 화면에 표시된다.

## Tests

- mock fetch로 테스트 결과 렌더링 검증. 디자인/레이아웃은 테스트 대상 아님.

## Risks

- 낮음.
