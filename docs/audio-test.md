
**Audio Test의 목적**

현재 테스트는 “번역 품질”이나 “마이크 음질”을 평가하는 기능이 아닙니다.

핵심 목적은 다음 4가지입니다.

1. 선택한 입력 장치를 실제로 열 수 있는가
2. PCM 오디오 데이터가 들어오는가
3. 입력 포맷이 무엇인가
4. OpenAI 처리용 포맷으로 변환 가능한가

관련 구현은 `audio.py`와 `audio_processor.py`에 있습니다.

**현재 오디오 입력 기준**

현재 capture 설정은 다음과 같습니다.

* Encoding: signed PCM 16-bit little-endian
* Sample rate: 기본 `16,000 Hz`
* Channels: `1 channel`, mono
* Sample width: `2 bytes`
* Chunk size: `1024 frames`
* 테스트 시간: `3초`

설정값은 `config.py`에 있습니다.

중요한 점은 `detected_sample_rate`가 장치가 실제로 자동 감지한 값이라기보다, 현재 capture를 열 때 사용한 설정값이라는 점입니다. 현재는 기본적으로 16 kHz로 열도록 되어 있습니다.

**Input Level 계산 방식**

현재 level은 peak가 아니라 RMS 기반 dBFS입니다.

**RMS = sqrt(mean(sample^2))**

**dBFS = 20 * log10(RMS)**

기준은 다음과 같습니다.

* `0 dBFS`: 디지털 최대 크기
* `-3 dBFS`: full-scale sine wave의 일반적인 RMS 값
* `-60 dBFS`: 현재 noise floor 하한
* 무음 또는 너무 작은 값: `-60 dBFS`로 고정

구현은 `audio_processor.py:6-15`에 있습니다.

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

구현은 `audio.py:40-65`에 있습니다.

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

**처리 포맷**

입력은 다음 출력 포맷으로 변환됩니다.

* Sample rate: `24,000 Hz`
* Channels: `1`, mono
* Sample width: `2 bytes`
* Encoding: signed PCM 16-bit

OpenAI 처리 포맷 표시값은 `audio.py`에서 생성됩니다.

오디오 담당자에게는 특히 다음을 확인하면 됩니다.

* OpenAI 입력에 24 kHz mono가 맞는가
* 16 kHz에서 24 kHz로 올리는 resampling이 필요한가
* 실제 서비스는 16 kHz 입력으로 충분한가
* mono downmix 시 채널 정보 손실이 문제가 없는가
* target encoding이 little-endian PCM인지

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
