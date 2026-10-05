# 059 믹서 입력 채널 선택

상태: 완료

## Goal

USB 믹서처럼 여러 입력 채널을 제공하는 오디오 장치를 Operator Settings에서 장치별 채널을 선택해 사용할 수 있게 한다. 선택한 채널만 mono PCM으로 변환해 기존 캡처·처리·통역 파이프라인에 전달하고, 장치 및 채널 선택을 함께 저장해 재시작 후에도 복원한다.

## Why

현재 입력 장치 목록은 `input_channels` capability를 반환하지만 Operator UI와 설정 저장은 장치만 다룬다. AudioCapture도 장치가 지원하는 입력 채널 수에 따라 스트림을 열 뿐, 믹서의 어느 채널을 사용할지 지정하지 않는다. 그 결과 `Microphone (X-USB) · Windows WASAPI (48000 Hz)` 같은 믹서 장치를 선택해도 특정 마이크 입력을 고를 방법이 없다.

여러 믹서 입력을 OS가 하나의 다채널 입력 장치로 노출하는 경우, 스트림 전체를 mono로 평균내는 기존 변환은 입력별 선택을 제공하지 못한다. Operator가 원하는 물리 믹서 채널을 명시적으로 고를 수 있어야 한다.

## Scope

- 장치의 `input_channels` 값으로 1-based 입력 채널 선택지를 구성한다.
- 선택한 입력 샘플만 AudioCapture callback에서 추출하고, 기존 오디오 pipeline에는 mono stream으로 전달한다.
- 채널 선택은 장치 선택과 함께 `operator.json`에 저장하고 Settings GET/PUT에서 복원한다.
- 장치가 바뀌면 기존 채널 번호를 새 장치에 그대로 적용하지 않고 1번 채널로 초기화한다.
- 세션 실행 중 장치 또는 채널 변경은 기존 장치 변경과 동일하게 거부한다.
- 기본 채널은 1번으로 한다. 단일 채널 장치에는 별도 채널 UI를 표시하지 않는다.
- Audio Test와 streaming Audio Test가 저장/선택된 동일 채널을 사용한다.
- 새 사용자 문구는 한국어, 영어, 독일어를 지원한다.

## Out of scope

- 물리 장치별 입력 이름/단자 이름을 PortAudio가 제공하지 않는 경우의 자동 라벨링.
- 믹서의 출력 채널, playback loopback, 장치별 gain 또는 routing 제어.
- 실제 마이크, mixer 또는 유료 통역 API를 사용하는 자동화 테스트.
- 채널의 신호 감지로 최적 입력을 자동 선택하는 기능.

## Implementation notes

- UI는 기존 Audio Device Select와 같은 공용 `Select`를 재사용한다.
- 채널 번호는 사용자에게 1부터 표시하고, 캡처 내부 인덱스는 0부터 계산한다.
- 요청 채널이 장치의 `maxInputChannels`를 초과하면 장치 기본값이나 다른 채널로 조용히 대체하지 않고 명시적인 오류를 반환한다.
- PortAudio stream이 선택된 입력 채널보다 많은 채널을 열더라도, callback에서 선택 샘플을 분리한 뒤 AudioProcessor에 넘긴다.
- 저장 설정이 현재 장치 capability보다 큰 채널 번호를 가리키면 Settings에서 재선택 안내를 표시하고 Audio Test를 막는다.
- 세션 중 Audio Runtime은 선택 장치/채널로 임시 테스트를 수행한 뒤 원래 장치/채널로 복구한다.

## Related files

- `backend/core/config.py`
- `backend/.env.example`
- `backend/services/audio_capture.py`
- `backend/services/audio_runtime.py`
- `backend/services/operator_store.py`
- `backend/api/v1/endpoints/operator.py`
- `backend/api/v1/endpoints/audio.py`
- `backend/tests/unit/test_audio_capture.py`
- `backend/tests/unit/test_audio_devices.py`
- `backend/tests/unit/test_operator_store.py`
- `backend/tests/unit/test_operator_api.py`
- `frontend/src/pages/Operator/settings/Settings.tsx`
- `frontend/src/pages/Operator/settings/components/AudioDeviceSection.tsx`
- `frontend/src/pages/Operator/settings/hooks/useAudioDevices.ts`
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`
- `frontend/src/pages/Operator/settings/hooks/useAudioTest.ts`
- `frontend/src/pages/Operator/translations.ts`
- `frontend/tests/unit/useAudioTest.test.tsx`

## Acceptance criteria

- `input_channels > 1`인 장치를 선택하면 지원 범위의 입력 채널 선택 UI가 표시된다.
- 채널 변경값은 서버에 저장되고 Settings 재진입 및 서버 재시작 후 복원된다.
- 채널 1/2/3 등 선택한 번호가 캡처 callback에서 올바른 PCM sample로 추출된다.
- 다채널 PCM에서 선택 채널을 추출한 데이터의 sample width, frame 정합성 및 mono 입력 format이 유지된다.
- 단일 채널 장치 및 기본 시스템 장치의 기존 선택/테스트 동작이 유지된다.
- 존재하지 않는 채널은 명확히 실패하고 임의 채널 또는 기본 장치로 fallback하지 않는다.
- 믹서 채널 설정 변경은 실행 중 세션에서 거부되고, 정지 상태에서는 Audio Runtime에 적용된다.
- Audio Test와 streaming Audio Test가 요청한 채널을 사용하며, 공용 Runtime 테스트 후 원래 캡처 설정이 복구된다.
- backend/frontend 자동화 테스트는 실제 마이크 및 외부 통역 API를 호출하지 않는다.

## Progress

- `audio_channel` 설정 필드와 1-based 채널 저장/조회/검증을 추가했다.
- Settings에 다채널 입력 장치용 채널 선택기를 연결하고, 장치 전환 시 1번 채널을 선택하도록 했다.
- AudioCapture에서 선택 채널을 분리해 mono PCM으로 전달하고, 사용할 수 없는 채널은 오류 처리한다.
- Audio Test 요청 및 Runtime 임시 테스트에 채널 선택을 전달하도록 연결했다.
- 한국어/영어/독일어 라벨과 잘못된 저장 채널 재선택 안내를 추가했다.

## Verification

- `pytest tests/unit` — 160개 테스트 통과
- `pytest tests/unit/test_operator_api.py tests/unit/test_audio_runtime.py tests/unit/test_audio_capture.py` — 36개 테스트 통과 (리뷰 이슈 수정 검증)
- `npm test` — 17개 파일, 114개 테스트 통과
- `npm run build` — TypeScript 검사 및 Vite production build 통과
- `git diff --check` — 통과
- 실제 X-USB 장비로 채널별 신호 입력 및 선택 결과를 확인하는 수동 검증은 남아 있다.

## Manual mixer check

- [ ] X-USB 장치를 연결하고 Settings 목록에서 `input_channels`가 장비가 제공하는 입력 범위와 일치하는지 확인한다.
- [ ] 믹서의 서로 다른 입력 채널에 신호를 각각 연결하고 UI에서 해당 입력 번호를 선택한다.
- [ ] 각 선택에서 Audio Test 입력 레벨이 선택한 입력에만 반응하고, 다른 채널 입력은 선택 결과에 섞이지 않는지 확인한다.
- [ ] 선택 채널별 실제 capture format이 mono로 보고되는지 확인한다.
- [ ] 앱 재시작 뒤 선택한 장치와 채널이 복원되는지 확인한다.
- [ ] 채널 선택 변경이 실행 중인 Translation Session에서 막히며, 세션 정지 후에는 적용되는지 확인한다.
- [ ] 다른 장치로 전환 시 채널이 1번으로 초기화되고, 단일 채널 마이크에 채널 선택 UI가 표시되지 않는지 확인한다.

테스트 기록에는 API key, credential 또는 민감한 장치 정보를 포함하지 않는다. 실제 장비가 채널 입력들을 PortAudio에 어떻게 노출하는지와 확인한 채널 수, 선택별 신호 결과만 기록한다.
