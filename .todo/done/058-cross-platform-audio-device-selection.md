# 058 Cross-platform audio input device selection

상태: 완료

## Goal

Windows와 macOS에서 실제 오디오 입력으로 사용할 수 있는 장치를 간결하고 안전하게 열거하고 선택한다. PyAudio numeric device index를 설정에 영속 저장하지 않으며, 내장 마이크, 물리 믹서/USB 오디오 입력, 마이크가 있는 유선 헤드셋 입력을 지원한다.

## Why

현재 `/api/v1/audio/devices`는 `maxInputChannels > 0`인 PortAudio 장치를 대부분 그대로 반환한다. Windows에서는 같은 장치가 MME, DirectSound, WASAPI 등 여러 Host API로 중복 노출될 수 있다. 프론트는 목록의 숫자 index를 선택값으로 표시하고 operator 설정에 저장하며, 세션 시작 시 다시 그 index를 사용한다. 장치 목록 순서나 연결 상태가 바뀌면 저장된 index가 다른 장치를 가리키거나 `Invalid device info`로 실패할 수 있다.

## Scope

- Windows 기본 목록은 WASAPI, macOS 기본 목록은 CoreAudio 입력 경로를 사용한다.
- 기본 목록에서 입력이 누락된 경우 전체 Host API 목록으로 전환할 수 있다.
- 다른 운영체제에서는 전체 입력 장치 목록을 제공한다.
- 기본 입력(`default`), 내장 마이크, 물리 믹서/USB 인터페이스 입력, OS가 입력으로 인식하는 유선 헤드셋 마이크를 지원한다.
- 물리 입력을 캡처하는 기존 PyAudio/PortAudio pipeline은 유지한다.
- 시스템 playback loopback 캡처는 구현하지 않는다.

## Out of scope

- Windows Core Audio endpoint ID 또는 macOS CoreAudio UID 수집/매핑
- loopback 오디오 캡처 지원
- 이름이나 sample rate를 기준으로 Bluetooth, 저대역폭, 특수 입력 장치를 일괄 제외
- 별도 캡처 라이브러리/OS native backend 도입

## Design

- Device API는 `mode=standard|all` 목록 모드를 받는다. `standard`는 현재 OS의 canonical Host API를 우선하고, 지원 Host API를 찾지 못하면 결과가 비는 상황을 피하도록 전체 입력 목록으로 안전하게 fallback한다. `all`은 모든 Host API에서 입력 채널이 있는 후보를 반환한다.
- API device record에는 현재 실행에서만 유효한 `index`, 표시용 `name`, `host_api`, 입력 capability, 불투명 `selector`를 포함한다. 숫자 index는 현재 PyAudio 인스턴스에서 stream을 여는 데만 사용한다.
- Persisted selector는 Host API 이름과 정확한 장치 이름의 조합으로 재열거 시 현재 index에 재해석한다. 일치가 0개 또는 복수이면 임의 장치/default로 fallback하지 않고 명확한 오류를 반환한다. 이 selector는 PyAudio의 한계상 best-effort이며 OS가 보장하는 stable ID가 아님을 문서화한다.
- 기존 숫자 `audio_device` 설정은 원래 장치를 신뢰성 있게 복원할 수 없으므로 자동 remap하지 않는다. Operator UI에서 기존 선택이 stale/reselect 상태로 드러나게 하고 사용자가 새 장치를 선택하도록 한다.
- 입력 채널이 있는 장치는 이름이나 sample rate만으로 제거하지 않는다. 명시적인 출력 전용 항목만 제외한다. Host API 이름은 사용자에게 같은 이름의 장치를 구별하는 정보로 표시한다.
- 새 UI 문구는 한국어, 영어, 독일어를 지원한다.

## Implementation steps

1. `backend/services/audio_devices.py`에 Host API 정보 조회와 표준/전체 목록 모드를 추가하고, 같은 PyAudio 인스턴스에서 index와 name을 가져오도록 한다.
2. `backend/api/v1/endpoints/audio.py`의 응답 스키마와 GET endpoint를 mode 및 selector 계약에 맞춘다.
3. `backend/services/audio_capture.py`의 selector resolver가 매 시작 때 최신 enumeration index를 찾도록 변경한다. `default`와 기존 정확한 이름 설정은 호환 가능한 경우 보존하고, 숫자 설정 및 모호한 이름은 잘못된 장치로 열지 않고 재선택 오류로 처리한다.
4. `frontend/src/pages/Operator/settings/hooks/useAudioDevices.ts`에서 selector 기반 option value, 표준/전체 목록 전환, 새로고침 후 선택 복원, stale 설정 상태를 구현한다.
5. `AudioDeviceSection`/`Settings`에 목록 모드 전환과 재선택 안내를 연결하고 Operator 번역(ko/en/de)을 추가한다. 저장 및 Audio Test 요청은 새 selector를 사용한다.
6. `docs/audio-test.md`와 README 설정 안내에 Host API 목록 방식, selector 한계, 기존 숫자 설정 재선택, macOS CoreAudio/PyAudio 설치 및 microphone permission을 기록한다.

## Progress

- Backend enumeration/API에 Host API 이름, standard/all 모드, opaque selector를 추가했다.
- Capture 시작 시 selector를 현재 device index로 재해석하고, legacy numeric 또는 모호한 이름은 안전하게 실패하도록 했다.
- Operator Settings에 목록 전환 SlideToggle, Host API별 option, stale selector 재선택 안내를 연결했다.
- Backend unit tests 157개, frontend unit tests 112개, TypeScript/Vite production build를 통과했다.
- Windows 실장치 enumeration에서 기본 WASAPI 목록이 `Microphone Array (Realtek(R) Audio)`와 `External Mic (Realtek(R) Audio)`를 반환하는 것을 확인했다. 이 확인은 목록 조회이며 실제 캡처 테스트는 아니다.
- Mac 하드웨어/CoreAudio smoke test는 현재 Windows 개발 환경에서 수행할 수 없어 남아 있다.

## Related files

- `backend/services/audio_devices.py`
- `backend/services/audio_capture.py`
- `backend/api/v1/endpoints/audio.py`
- `backend/services/operator_store.py`
- `backend/api/v1/endpoints/operator.py`
- `frontend/src/pages/Operator/settings/hooks/useAudioDevices.ts`
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`
- `frontend/src/pages/Operator/settings/Settings.tsx`
- `frontend/src/pages/Operator/settings/components/AudioDeviceSection.tsx`
- `frontend/src/shared/components/SlideToggle/SlideToggle.tsx`
- `frontend/src/shared/components/SlideToggle/SlideToggle.module.css`
- `frontend/src/pages/Operator/translations.ts`
- `backend/tests/unit/test_audio_devices.py`
- `backend/tests/unit/test_audio_capture.py`
- `backend/tests/unit/test_operator_store.py`
- `backend/tests/unit/test_operator_api.py`
- `frontend/tests/unit/useAudioDevices.test.tsx`
- `frontend/tests/unit/OperatorPrefs.test.tsx` or relevant Settings tests
- `docs/audio-test.md`

## Acceptance criteria

- Windows 기본 목록은 WASAPI 입력을 우선해 Host API 중복을 줄이고, 전체 목록 모드에서는 다른 Host API 장치도 확인할 수 있다.
- macOS 기본 목록은 CoreAudio 입력을 사용한다. 표준 Host API가 없는 환경에서는 목록이 비어버리지 않고 전체 후보를 제공한다.
- 내장 마이크, 입력 기능이 있는 USB mixer/interface, OS가 입력으로 제공하는 headset mic는 이름이나 sample rate만으로 필터링되지 않는다. 마이크가 없는 headphone-only AUX 케이블은 입력 장치로 가장하지 않는다.
- 동일 이름이라도 Host API가 다르면 구분 가능하고, 명시 선택은 Host API와 정확한 이름으로만 한 장치에 해석된다.
- 목록 재정렬/refresh 뒤에도 저장된 selector는 새 index에 재해석된다. 선택 장치가 없거나 selector가 모호하면 잘못된 장치/default를 조용히 열지 않고 재선택 가능한 오류가 난다.
- 구형 숫자 `audio_device` 설정은 자동으로 다른 입력에 매핑되지 않는다. Operator 설정에서 재선택을 안내한다.
- standard/all 전환, 장치 선택, 저장/복원, Audio Test가 기존 Operator 설정 흐름에서 동작한다.
- 일반 단위 테스트는 물리 하드웨어나 유료 외부 API를 사용하지 않는다.

## Tests and verification

- `backend/tests/unit/test_audio_devices.py`: Host API 이름 연결, 표준/전체 filter, 출력 전용 제외, mixed-I/O 및 다양한 이름의 물리 입력 보존, 중복 이름 구별.
- `backend/tests/unit/test_audio_capture.py`: default, 현재 목록 기반 최신 index resolver, exact match, no match/ambiguous 오류, legacy numeric 재선택 오류, 잘못된 장치로 fallback하지 않음.
- `backend/tests/unit/test_operator_store.py` 및 `test_operator_api.py`: selector 저장/로드 및 API 왕복, legacy 숫자 설정이 위험하게 remap되지 않음.
- `frontend/tests/unit/useAudioDevices.test.tsx`: 모드 전환, selector option, refresh 후 재해석, stale 설정 상태.
- 관련 frontend settings tests 및 locale completeness 검사: 저장 선택과 ko/en/de 문자열.
- Windows 실기기 확인: 노트북 마이크, 물리 mixer/USB 입력, mic가 달린 유선 헤드셋을 standard/all 목록에서 확인하고 Audio Test 및 서버 재시작 후 선택을 검증한다.
- Mac 실기기 확인: CoreAudio 목록, 위 입력 유형, PyAudio microphone permission, Audio Test 및 재시작 복원을 검증한다.
- `git diff --check` 실행.

## Known limitations

Host API 이름 + 정확한 장치 이름은 index보다 재열거에 강하지만 OS 고유 stable ID는 아니다. 동일 Host API 내 동일 이름 장치나 OS/driver 업데이트에 따른 이름 변경은 사용자 재선택이 필요할 수 있다. macOS 동작은 현재 CI에서 실기기로 검증할 수 없으므로 별도 Mac smoke test가 필요하다.
