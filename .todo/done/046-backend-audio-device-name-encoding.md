# 046 오디오 장치 입력 필터와 다국어 이름

상태: 완료
우선순위: 보통

## Goal

설정의 오디오 장치 목록에 입력 가능한 장치만 표시하고, 독일어를 포함한 Unicode 장치명이 깨지지 않게 표시한다.

## Why

현재 서비스는 `maxInputChannels > 0`으로 이미 출력 전용 장치를 제외하지만, PyAudio는 장치명 바이트를 OS 기본 인코딩으로 먼저 디코딩한다. UTF-8 이름이 다른 인코딩으로도 유효하게 해석되면 API에는 이미 깨진 문자열이 전달될 수 있다.

## Related files

- `backend/services/audio_devices.py`
- `backend/tests/unit/test_audio_devices.py`
- `frontend/src/pages/Operator/settings/hooks/useAudioDevices.ts`
- `frontend/tests/unit/useAudioDevices.test.tsx`

## Implementation notes

- 기본 입력 필터는 `maxInputChannels > 0`이다. Windows WDM-KS는 일부 HAP 출력 엔드포인트를 입력 채널만 있는 장치로 보고하므로, 이름에 `output`이 있고 `maxOutputChannels <= 0`인 항목은 추가로 제외한다. 실제 입출력 겸용 장치는 출력 채널도 있어 유지한다.
- PyAudio 고수준 API의 이름은 이미 디코딩되어 있다. 초기화된 PortAudio 저수준 API에서 원본 `name` 바이트를 얻어 UTF-8 우선으로 디코딩하고, UTF-8이 아니면 OS 기본 인코딩을 fallback으로 사용한다.
- PyAudio 설치 파일은 수정하지 않는다. 프론트엔드에서도 이미 Unicode로 전달된 이름을 재디코딩하지 않는다.
- 출력 전용 제외와 겸용 장치 포함 회귀 테스트를 보존하고, 다국어 이름이 API 및 프론트 옵션 라벨까지 그대로 유지되는지 검증한다.

## Acceptance criteria

- 출력 전용 장치(`maxInputChannels <= 0`)와 WDM-KS에서 입력으로 잘못 보고된 출력 엔드포인트가 제외된다.
- 실제 입력·출력 겸용 장치는 이름에 `output`이 포함되어도 목록에 남는다.
- UTF-8 다국어 장치명은 현재 OS 로캘과 관계없이 정상적으로 반환된다.
- UTF-8이 아닌 장치명은 OS 기본 인코딩 fallback으로 처리된다.
- API의 장치명이 설정 선택 옵션에서도 변형 없이 표시된다.

## Tests

- `backend`에서 `pytest tests/unit/test_audio_devices.py` 실행: 17개 통과.
- `frontend`에서 `npm test -- useAudioDevices.test.tsx` 실행: 7개 통과.
- Windows 실제 장치 목록을 확인해 `output` 라벨 엔드포인트가 제외되고 `Kopfhörer` 이름이 정상 표시됨을 확인했다.

## Risks

- PortAudio 원본 이름 API는 PyAudio 초기화 이후 사용해야 한다. 장치 인덱스 기준과 cleanup 순서를 기존 서비스 lifecycle 안에서 유지한다.
- 출력 오분류 감지는 장치 이름의 `output` 표기와 출력 채널 수를 함께 사용한다. 다른 드라이버가 출력 장치를 다른 방식으로 노출하면 별도 사례가 필요하다.
