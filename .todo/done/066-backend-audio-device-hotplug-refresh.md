# 066 서버 재시작 없는 오디오 장치 hot-plug 갱신

상태: 완료
우선순위: 높음 (새 입력 장치를 인식하려고 서버를 재시작해야 함)

## Goal

Operator의 장치 새로고침으로 현재 OS 입력 장치 목록을 다시 조회하고, 캡처가 장치 부재로 준비되지 않은 상태라면 서버 프로세스 재시작 없이 입력 캡처를 재시도한다.

## 로그 근거

- `sermon-live.log.2` 10:49:25: 저장된 `Microphone (X-USB)` selector를 찾지 못해 audio capture가 시작되지 않았다.
- 10:50:27에 `/api/v1/audio/devices` 조회가 있었지만 곧바로 캡처가 준비되지는 않았다.
- 10:50:29에 Operator 설정 PUT 후에야 Realtek 입력 stream이 열렸다.
- 따라서 목록 새로고침 요청과 입력 캡처 재시도는 별개 동작이다. 로그만으로 PortAudio/driver의 hot-plug 열거 실패인지, 캡처 runtime 재시도 누락인지까지는 확정할 수 없다.

## 현재 동작

- 완료된 047에서 새로고침 버튼은 `/api/v1/audio/devices`를 다시 요청하도록 구현됐다.
- GET 요청은 새 PyAudio 인스턴스로 장치를 열거하지만, `AudioRuntime`의 캡처 stream을 재시작하지 않는다.
- 캡처가 준비되지 않은 경우 설정 변경 또는 서버 재시작이 별도의 재시도 계기가 될 수 있다.

## Scope

- 버튼을 누른 요청이 실제 최신 장치 enumeration을 수행하고, 새로 연결된 입력 장치가 목록과 선택 UI에 반영되는지 재현한다.
- 프로세스를 재시작하지 않고 enumeration backend를 필요한 범위에서 재초기화할 방법을 확인한다. PyAudio/PortAudio가 장치 목록을 캐시한다면 프로세스 전체 재시작 대신 필요한 오디오 host/runtime만 안전하게 재초기화한다.
- `AudioRuntime`이 장치 부재로 `ready=false`인 상태에서 새 장치 목록을 성공적으로 읽으면, 사용자가 새 장치 또는 System default를 선택한 뒤 capture를 다시 시작할 수 있게 한다.
- 이미 정상 입력 stream이 있거나 Translation Session이 live이면 장치 목록 조회만으로 stream이나 세션을 중단하지 않는다.
- 장치 새로고침과 capture 재시도 결과를 UI에 구분해 표시한다. 목록 조회 성공을 capture 준비 성공으로 잘못 표시하지 않는다.
- 재시도 실패 시 명시적인 오류를 반환/표시하고, 빈 목록이나 기존 오류를 성공처럼 숨기지 않는다.

## Out of scope

- 저장된 장치가 존재하지 않을 때 System default로 자동 전환하는 정책. 해당 동작은 067에서 다룬다.
- Translation Session 실행 중 입력 장치를 무중단으로 교체하는 기능.
- 특정 USB mixer/driver의 고유한 오류를 앱에서 복구하는 것.
- 실제 마이크 또는 장비를 사용하는 자동 테스트.

## Related files

- `backend/services/audio_devices.py`
- `backend/services/audio_capture.py`
- `backend/services/audio_runtime.py`
- `backend/api/v1/endpoints/audio.py`
- `backend/api/v1/endpoints/operator.py`
- `frontend/src/pages/Operator/settings/hooks/useAudioDevices.ts`
- `frontend/src/pages/Operator/settings/Settings.tsx`
- `backend/tests/unit/test_audio_devices.py`
- `backend/tests/unit/test_audio_runtime.py`
- `frontend/tests/unit/useAudioDevices.test.tsx`
- `.todo/done/047-frontend-audio-device-test-controls.md`
- `.todo/done/058-cross-platform-audio-device-selection.md`

## Acceptance criteria

- 입력 장치를 앱 실행 중 분리/연결한 뒤, 서버 프로세스를 재시작하지 않고 새로고침으로 새 장치 목록을 확인할 수 있다.
- 캡처가 장치 부재로 `ready=false`인 경우 새 장치 선택 또는 명시적인 재시도 후 `audio_status.ready=true`가 되고, Operator 입력 상태도 갱신된다.
- 이미 준비된 캡처와 live Translation Session은 단순 목록 새로고침 때문에 중단되지 않는다.
- enumeration 실패, 목록 갱신 성공, 캡처 재시도 실패 상태가 서로 구분된다.
- 장치 이름/순서가 바뀌어도 numeric device index를 영속 설정값으로 사용하지 않는 058의 selector 계약을 보존한다.
- 새로운 backend/frontend 분기에는 실패 전 상태와 핫플러그 상황을 재현하는 focused unit test가 있다.

## Tests and manual validation

### Backend unit

- mock PyAudio에서 첫 enumeration에는 입력 장치가 없고 다음 enumeration에는 새 장치가 추가되는 상황을 검증한다.
- audio runtime이 초기 캡처에 실패한 뒤 장치 갱신 및 재시도 후 정상 상태가 되는지 검증한다.
- live 세션 또는 정상 캡처 중 enumeration이 캡처/세션을 중단하지 않는지 검증한다.

### Frontend unit

- 새로고침 요청 완료 후 장치 목록, 선택값, loading/error 상태가 갱신되는지 검증한다.
- enumeration 성공과 capture 미준비 상태를 같은 성공 표시로 혼동하지 않는지 검증한다.

### Manual

- 실제 오디오 장비를 사용하는 수동 검증은 이 작업 환경에서 수행하지 않았다.
- [ ] 서버를 실행한 채 USB 입력 장치를 연결/분리하고 새로고침을 눌러 장치 목록을 확인한다.
- [ ] 초기 캡처가 장치 부재로 실패한 뒤 장치를 연결하고, 서버 재시작 없이 캡처가 준비되는지 확인한다.
- [ ] 연결된 Listener/Operator 및 live 세션이 새로고침 요청 때문에 끊기지 않는지 확인한다.
