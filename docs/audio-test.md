
**Audio Test의 목적**

현재 테스트는 “번역 품질”이나 “마이크 음질”을 평가하는 기능이 아닙니다.

핵심 목적은 다음 4가지입니다.

1. 선택한 입력 장치를 실제로 열 수 있는가
2. PCM 오디오 데이터가 들어오는가
3. 입력 포맷이 무엇인가
4. 선택된 interpreter의 처리 포맷으로 변환 가능한가

관련 구현은 `backend/api/v1/endpoints/audio.py`와 `backend/services/audio_processor.py`에 있습니다.

**입력 장치 선택**

Operator의 입력 장치 목록은 기본적으로 현재 OS의 표준 capture Host API를 사용한다. Windows는 WASAPI, macOS는 CoreAudio를 우선한다. 원하는 입력이 보이지 않으면 Settings의 전체 오디오 경로 목록으로 전환해 다른 PortAudio Host API도 확인한다. 그 외 운영체제에서는 전체 입력 목록을 표시한다.

장치 선택값은 PyAudio의 숫자 index가 아니라 Host API 이름과 정확한 장치 이름으로 저장하고, 캡처를 시작할 때 현재 index를 다시 찾는다. PyAudio는 OS가 보장하는 영구 device ID를 제공하지 않으므로, 장치 이름이 바뀌거나 같은 Host API에 동일 이름 장치가 여러 개 있으면 Operator에서 다시 선택해야 한다. 이전 버전이 저장한 숫자 index는 정확한 장치로 안전하게 복원할 수 없으므로 자동으로 다른 장치에 연결하지 않는다.

목록은 입력 capability를 보고하는 장치를 보여주는 후보 목록이다. 실제 사용 가능 여부는 Audio Test에서 장치를 열어 확인한다. 내장 마이크, 물리 믹서/USB 오디오 인터페이스 입력, OS가 입력으로 노출하는 마이크 포함 헤드셋을 사용할 수 있다. 마이크가 없는 headphone-only AUX 케이블은 입력 장치가 아니다. 시스템 재생 소리(loopback) 캡처는 지원하지 않는다.

macOS에서는 PyAudio가 CoreAudio 지원 PortAudio와 함께 설치되어야 하고 backend를 실행하는 앱/프로세스에 Microphone 권한이 필요하다. macOS 실기기 Audio Test를 별도로 수행한다.

**Capture stream format**

AudioCapture는 설정 sample rate, 장치 default rate 및 정해진 fallback rate를 순서대로 시도하고, mono부터 장치 metadata의 `maxInputChannels` 범위 안에서 채널 수를 시도한다. 각 조합은 PCM16, PCM24, PCM32, PCM8 순서로 실제 stream을 열어 선택한다. 성공한 PyAudio stream의 tuple `(sample_rate, channels, sample_width)`이 AudioProcessor의 source format이다.

이 값은 장치 ADC의 물리 format이 아니라 앱이 PyAudio에 요청해 열린 capture stream format이다. OS driver나 PortAudio가 변환할 수 있으므로 Mixer 사양으로 앱 입력 bit depth를 추정하지 않는다. Device 목록의 `input_channels`와 `default_sample_rate`는 capability metadata이며 선택된 stream tuple과 동일하다고 보장되지 않는다.

API는 `capture_sample_rate`, `capture_channels`, `capture_sample_width`로 실제 열린 tuple을 반환한다. Operator UI는 “Capture stream format”으로 표시한다. Sample width API 값의 단위는 bytes이며, UI에는 bits로 환산해 표시한다.

명시한 장치 이름이나 index를 사용할 수 없으면 해당 장치와 실패 이유를 포함해 오류를 반환하며 시스템 기본 장치로 대체하지 않는다. 빈 값 또는 `default`를 선택한 경우에만 시스템 기본 입력을 사용한다.

**Input Level 계산 방식**

현재 level은 peak가 아니라 RMS 기반 dBFS입니다.

**RMS = sqrt(mean(sample^2))**

**dBFS = 20 * log10(RMS)**

기준은 다음과 같습니다.

* `0 dBFS`: 디지털 최대 크기
* `-3 dBFS`: full-scale sine wave의 일반적인 RMS 값
* `-60 dBFS`: 현재 noise floor 하한
* 무음 또는 너무 작은 값: `-60 dBFS`로 고정

구현은 `backend/services/audio_processor.py`에 있습니다.

프론트 meter는 다음처럼 표시합니다.

* `-60 dBFS`: 0%
* `0 dBFS`: 100%
* 실제로는 최소 5% 이상 표시될 수 있음
* 테스트 중에는 각 PCM chunk의 실제 dBFS를 streaming으로 표시
* 테스트 완료 후에는 전체 3초 구간의 level을 표시

**Signal 판정 기준**

현재 기준은 다음과 같습니다.

**raw audio가 존재하고 input_level_dbfs > -60.0이면 signal**

**그 외에는 silent**

구현은 `backend/api/v1/endpoints/audio.py`에 있습니다.

따라서 현재 `signal`은 “사람 목소리가 명확하게 감지됐다”는 뜻이 아닙니다.

정확히는:

> `-60 dBFS`보다 큰 PCM 신호가 한 번이라도 존재했다

는 의미입니다.

그래서 주변 소음, 컴퓨터 팬, 마이크 자체 noise floor도 `signal`이 될 수 있습니다. 오디오 담당자에게 반드시 확인할 부분은 이 threshold입니다.

예를 들면 다음을 논의해야 합니다.

* 무음 환경의 일반적인 noise floor는 몇 dBFS인가?
* 실제 발화의 평균 RMS는 몇 dBFS인가?
* `-60 dBFS`가 너무 민감하지 않은가?
* `-45 dBFS` 또는 `-50 dBFS`가 더 적절한가?
* 짧은 소음에도 signal로 판정할 것인가?
* 일정 시간 이상 threshold를 넘을 때만 signal로 판정할 것인가?
* 시작/종료 threshold에 hysteresis를 둘 것인가?

**현재 테스트가 확인하지 않는 것**

현재 테스트는 다음을 판정하지 않습니다.

* 음성인지 여부
* 말소리와 배경 소음의 구분
* SNR
* clipping 여부
* peak level
* 좌우 채널 불균형
* 마이크 gain 적정성
* 실제 OpenAI API 음질
* 번역 latency
* 실제 발화 명료도

즉, 오디오 전문가 관점에서는 현재 기능을 다음처럼 부르는 것이 정확합니다.

> Input device availability and PCM signal sanity check

**Processing format**

AudioProcessor target은 `LiveInterpreter.required_sample_rate`, `required_channels`, `required_sample_width`에서 가져온다. OpenAI adapter의 계약은 `24,000 Hz / mono / 2 bytes (16-bit) / signed little-endian PCM`이다. Echo adapter는 자체 required format을 선언하므로 Audio Test의 target은 선택된 interpreter에 따라 달라져야 한다.

040에서 `translation_target_*` 설정 필드는 제거됐다. 기존 배포의 `.env`에서 `APP_TRANSLATION_TARGET_SAMPLE_RATE`, `APP_TRANSLATION_TARGET_CHANNELS`, `APP_TRANSLATION_TARGET_SAMPLE_WIDTH` 항목을 삭제한다. 처리 target은 선택된 interpreter가 선언하며 자세한 migration 안내는 `backend/.env.example`에 있다.

**처리 성공 기준**

Audio Test는 환경 설정에 Operator store 설정을 overlay해 현재 interpreter의 required tuple을 사용한다. normal과 stream 경로는 `AudioProcessor.process()`와 `flush()`가 모두 예외 없이 완료된 경우에만 `processing_success=true`를 반환한다. 변환 오류는 `disconnected` 및 `processing_success=false`로 반환하며 processing format은 실패 시에도 동일한 target을 보고한다.

**권장 운영 판정**

오디오 전문가와 다음 정도의 기준을 합의하면 좋습니다.

| 항목             | 권장 논의 기준                                      |
| ---------------- | --------------------------------------------------- |
| 무음             | noise floor가 보통 몇 dBFS인지 측정                 |
| 발화             | 일반 발화 RMS 범위 측정                             |
| Signal threshold | noise floor보다 충분히 높게 설정                    |
| 테스트 시간      | 현재 3초가 충분한지 확인                            |
| Level            | RMS만 사용할지 peak도 추가할지 결정                 |
| Clipping         | `-3 dBFS`이상 또는 peak 근접 시 경고할지 결정     |
| 성공 조건        | 장치 open + PCM 수신 + 처리 변환 성공으로 볼지 결정 |
| 음성 감지        | 단순 level threshold인지 VAD를 사용할지 결정        |

가장 중요한 현재 쟁점은 `-60 dBFS`입니다. 이 값은 “신호가 있는지”를 확인하기에는 매우 민감한 기준이라서, 실제 운영에서는 오디오 환경의 noise floor를 먼저 측정한 뒤 threshold를 정하는 것이 좋습니다.
