# 047 프론트엔드 오디오 장치 및 테스트 제어

상태: 완료

## Goal

실행 중 추가된 입력 장치 목록을 갱신하고, 진행 중인 오디오 테스트를 중단할 수 있게 한다. 입력 레벨 미터의 기존 네 색상과 threshold는 유지하면서 색상 사이 경계만 부드럽게 연결한다.

## Why

장치 목록이 최초 로드 후 고정되어 새 입력 장치를 선택할 방법이 없고, 테스트 스트림이 완료되지 않으면 화면에서 직접 중단할 수 없다. 네 색 band 사이의 접점은 구분되지만 색상 전환은 딱딱하다.

## Related files

- `frontend/src/pages/Operator/settings/Settings.tsx`
- `frontend/src/pages/Operator/settings/Settings.module.css`
- `frontend/src/pages/Operator/settings/components/AudioDeviceSection.tsx`
- `frontend/src/pages/Operator/settings/components/AudioTestPanel.tsx`
- `frontend/src/pages/Operator/settings/hooks/useAudioDevices.ts`
- `frontend/src/pages/Operator/settings/hooks/useAudioTest.ts`
- `frontend/src/pages/Operator/translations.ts`
- `frontend/src/shared/components/AudioLevelMeter/AudioLevelMeter.tsx`
- `frontend/src/shared/components/AudioLevelMeter/AudioLevelMeter.module.css`
- `frontend/tests/unit/useAudioDevices.test.tsx`
- `frontend/tests/unit/useAudioTest.test.tsx`
- `frontend/tests/unit/AudioLevelMeter.test.tsx`

## Acceptance criteria

- 장치 선택 근처에 목록 새로고침 동작이 있고, 새 장치가 응답 목록에 반영된다.
- 오디오 테스트 중 기존 버튼이 정지 동작으로 전환되고, 취소 후 실행 상태와 레벨 표시가 종료된다.
- System default 입력 테스트도 같은 정지 동작을 사용할 수 있다.
- 네 색상과 threshold 동작은 유지되고 색상 경계에만 짧은 혼합 영역이 표시된다.
- 새 UI 문구는 한국어, 영어, 독일어를 지원한다.

## Result

- 장치 선택 옆에 새로고침 버튼을 추가해 현재 입력 장치 목록을 다시 불러오도록 연결했다.
- 테스트 실행 버튼을 글자만 있는 정지 버튼으로 전환하고 AbortController로 진행 중 요청을 취소하도록 했다.
- 테스트 취소 후 실행 상태가 해제되며, 정지 테스트는 결과나 오류를 새로 만들지 않는다.
- 테스트 중 입력 레벨은 BroadcastHeader와 같은 Operator runtime level을 사용하고, 테스트 결과는 bounded JSON endpoint에서 받도록 했다.
- 테스트 응답이 제한 시간 내 오지 않으면 요청을 취소하고 번역된 timeout 오류를 표시한다.
- 미터의 4색 구간과 threshold는 유지하고 각 band 경계에만 색상 혼합 overlay를 추가했다.
- 새로고침과 정지 문구를 한국어, 영어, 독일어 번역에 추가했다.

## Verification

- `npm test -- tests/unit/useAudioDevices.test.tsx tests/unit/useAudioTest.test.tsx tests/unit/AudioLevelMeter.test.tsx --reporter=verbose` — 3개 파일, 18개 테스트 통과
- `npm run build` — TypeScript 검사 및 Vite production build 통과
- `git diff --check` — 통과
- `pytest tests/unit/test_audio_devices.py` — 현재 Python 환경에 `numpy`가 없어 collection 불가

## Notes

- backend의 `/api/v1/audio/test`는 공용 runtime의 `audio.collect()` 또는 별도 capture를 사용하고 캡처 길이를 3초로 제한한다. 실시간 레벨은 Operator WebSocket의 `audio_level` 이벤트를 사용한다.
- 브라우저 `devicechange` 자동 감지와 backend 변경은 범위에서 제외했다.
