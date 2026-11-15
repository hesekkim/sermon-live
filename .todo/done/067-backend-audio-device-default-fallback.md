# 067 저장 입력 장치 부재 시 System default fallback

상태: 완료
우선순위: 높음 (저장 장치 부재로 서버 오디오 입력이 준비되지 않음)

## Goal

Operator가 마지막으로 선택한 입력 장치가 현재 연결되어 있지 않더라도, 임의 장치를 열지 않고 OS의 실제 기본 입력 장치(System default)를 사용해 캡처를 시작한다.

## 로그 근거

- `sermon-live.log.2` 10:49:25에 저장된 `Microphone (X-USB)` selector가 발견되지 않아 `AudioCapture`가 예외를 냈다.
- 서버 HTTP startup은 계속됐지만 audio runtime은 준비되지 않았다.
- 이후 설정 변경 후 다른 입력 장치가 열렸다. 로그는 이 장치가 자동 fallback으로 선택된 것이 아니라 설정 PUT 후 열렸음을 보여준다.

## 기존 정책 변경

- 완료된 058은 선택한 selector가 없거나 모호하면 명시적으로 실패하고, 다른 장치나 default로 자동 fallback하지 않도록 설계했다.
- 본 티켓은 해당 정책을 의도적으로 변경한다. fallback 대상은 열거 목록의 첫 번째 장치가 아니라 PortAudio/OS가 제공하는 **System default input device**여야 한다.

## Scope

- 저장 selector가 현재 enumeration에서 유일하게 해석되면 기존 장치를 그대로 사용한다.
- selector가 없거나 현재 장치 목록에서 찾을 수 없으면 `get_default_input_device_info()`를 사용해 기본 입력을 열고, 실제 유효한 stream을 열 수 있는지 검사한다.
- 기본 입력도 없거나 stream open에 실패하면 원래 selector 오류를 성공처럼 숨기지 말고, fallback 시도 실패를 포함한 명확한 audio error 상태를 노출한다.
- fallback으로 사용 중인 유효 입력 장치와 저장된 사용자 선택을 Operator가 혼동하지 않도록 effective device/fallback 상태를 표시한다.
- 권장 저장 정책: 일시적 분리로 사용자의 선호 selector를 잃지 않도록 저장값은 자동 덮어쓰지 않는다. 현재 runtime만 System default를 사용하고, 사용자가 설정에서 기본 입력을 확정 선택하면 그때 `default`를 저장한다.
- 로그에는 fallback 발생 여부와 결과만 남기고 raw audio, 인증정보 또는 credential은 기록하지 않는다.
- UI에 새 상태/문구가 추가되면 한국어/영어/독일어 번역을 모두 갱신한다.

## Out of scope

- 임의의 첫 번째 열거 장치를 기본 장치로 사용하는 것.
- 기존 selector가 복수 장치와 일치할 때 임의로 하나를 선택하는 것.
- Translation Session 중 입력 장치 자동 교체.
- 사용자의 저장 설정을 확인 없이 `default`로 영구 덮어쓰는 것.

## Related files

- `backend/services/audio_capture.py`
- `backend/services/audio_runtime.py`
- `backend/services/operator_store.py`
- `backend/api/v1/endpoints/operator.py`
- `frontend/src/pages/Operator/settings/hooks/useAudioDevices.ts`
- `frontend/src/pages/Operator/settings/hooks/useOperatorSettings.ts`
- `frontend/src/pages/Operator/settings/components/AudioDeviceSection.tsx`
- `frontend/src/pages/Operator/translations.ts`
- `backend/tests/unit/test_audio_capture.py`
- `backend/tests/unit/test_audio_runtime.py`
- `backend/tests/unit/test_operator_store.py`
- `frontend/tests/unit/useAudioDevices.test.tsx`
- `.todo/done/058-cross-platform-audio-device-selection.md`

## Progress

- 저장 selector가 사라지면 OS System default를 열고, runtime에 저장 selector·effective device·fallback 상태를 보존한다. 저장 설정은 자동 변경하지 않는다.
- Operator Settings에 실제 사용 중인 기본 입력 장치명과 fallback 안내를 추가하고, 한국어·영어·독일어 문구를 갱신했다.
- 기본 장치 부재와 stream open 실패, runtime 상태 전파를 mock 기반 단위 테스트로 검증했다.
- Backend audio/session 관련 테스트 64개, frontend broadcast hook 테스트 18개, TypeScript 및 Vite production build를 통과했다.
- 실장비 분리/재연결 수동 검증은 수행하지 않았다.

## Acceptance criteria

- 저장된 selector가 정상적으로 존재하면 정확히 그 장치가 계속 사용된다.
- 저장된 장치가 없는 경우 System default 입력을 열고 앱 서버와 audio capture가 오류 없이 준비된다.
- 기본 장치가 실제로 없는 경우 또는 열기에 실패한 경우 UI에 명시적인 오류가 표시되며 다른 장치를 임의로 사용하지 않는다.
- fallback 발생 시 runtime에서 실제 사용 중인 입력 장치가 설정에 표시되고, 사용자의 저장 selector는 자동으로 덮어쓰지 않는다.
- 장치 재연결 시 기존 저장 selector가 다시 유효해지고 선택 우선순위를 회복한다.
- 058의 no-fallback 테스트를 새 정책에 맞게 변경하되, 모호한 selector/잘못된 legacy index의 안전한 오류 처리는 유지한다.
- 테스트는 mock된 PortAudio 장치 목록 및 stream을 사용하고 실제 입력 장비를 요구하지 않는다.

## Tests and manual validation

### Backend unit

- selector match, selector missing + default success, selector missing + default absent, default stream open failure, duplicate/ambiguous selector를 각각 검증한다.
- fallback runtime에서도 `AudioRuntime.ready`, `input_format`, effective device status가 일관되는지 검증한다.
- fallback 실행 후 원래 저장 selector가 보존되고, 장치 재연결 후 기존 장치가 다시 선택되는지 검증한다.

### Frontend unit

- 저장 selector와 실제 fallback device 표시를 구분하고, 사용자가 `System default`를 명시 선택했을 때만 저장값이 바뀌는지 검증한다.
- fallback 경고와 완전한 입력 부재 오류의 번역 및 표시 상태를 검증한다.

### Manual

- [ ] 선택한 USB 입력을 분리한 뒤 서버를 재시작하고 OS 기본 입력으로 audio capture가 준비되는지 확인한다.
- [ ] 기본 입력도 비활성화한 경우 명확한 오류를 확인한다.
- [ ] 원래 USB 입력을 다시 연결한 뒤 저장 selector로 복귀하는지 확인한다.
