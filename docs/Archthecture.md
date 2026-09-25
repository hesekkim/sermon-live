
1. 프로젝트 목적
   현재 프로젝트는 FastAPI Backend + React Frontend 기반의 실시간 설교 통역 프로그램이다.

최종 제품의 목적:

한국어 설교 음성
      ↓
실시간 AI 통역
      ↓
독일어 음성 + 독일어 자막
      ↓
여러 청취자가 Listen 페이지에서 실시간으로 청취
언어 방향은 반드시:

SOURCE: Korean
TARGET: German
으로 한다.

기존 대화 중 일부에서 언어 방향이 반대로 언급된 부분이 있으나, 최종 요구사항은 한국어 → 독일어이다.

2. 현재 애플리케이션 구조
   Frontend에는 크게 다음 기능이 있다.

Operator / Admin
관리자가 다음을 설정하고 방송을 제어한다.

화면에 표시되는 UI 언어

사용할 AI API 종류

API Key

Broadcast 화면

서버 시작/중지

번역 상태 확인

Broadcast 화면에는 원문과 번역 결과를 좌우로 볼 수 있는 UI가 있다.

목표:

┌─────────────────────┬─────────────────────┐
│ Korean Source       │ German Translation  │
├─────────────────────┼─────────────────────┤
│                    │                     │
│                    │                     │
└─────────────────────┴─────────────────────┘
User / Listen
사용자는 Listen 페이지에 접속해 실시간으로:

독일어 자막

독일어 번역 음성

을 들을 수 있다.

사용자가 OpenAI API와 직접 통신할 필요는 없다.

권장 구조:

Audio Source
    ↓
FastAPI
    ↓
OpenAI
    ↓
FastAPI
    ↓
WebSocket
    ↓
Listen clients
3. AI Provider에 대한 최종 결정
현재 Gemini Live 구현은 이미 존재한다.

그러나 Gemini는 최종 제품에서 사용하지 않는다.

Gemini의 역할은:

현재까지 만들어진 구조를 보존하는 baseline
뿐이다.

최종 제품의 AI는 OpenAI를 사용한다.

따라서:

❌ Gemini + OpenAI를 장기적으로 동시에 지원하는 제품
❌ Gemini를 완전히 완성한 뒤 OpenAI로 교체
가 아니다.

대신:

현재 Gemini 상태
   ↓
Git baseline/tag로 보존
   ↓
OpenAI 기준으로 리팩터링
   ↓
OpenAI 구현
   ↓
End-to-end 검증
   ↓
Gemini 완전 제거
로 진행한다.

4. 현재 코드에서 유지할 핵심 구조
   현재 uploaded source를 기준으로 다음 구조는 좋은 기반이다.

AudioCapture
    ↓
SessionService
    ↓
Interpreter
    ↓
BroadcastHub
현재 SessionService는 interpreter를 생성하고 오디오를 전달하며 결과를 BroadcastHub로 전달한다.
현재 BroadcastHub는 WebSocket client들에게 audio와 text를 전달하는 역할을 담당하고 있다.
이 핵심 구조는 유지하고 Gemini-specific 부분만 교체/정리한다.

5. OpenAI API 선택
   최종 AI 엔진은 OpenAI의:

gpt-realtime-translate
를 사용한다.

이 모델은 사람의 speech를 실시간으로 번역하기 위한 streaming speech-to-speech translation model이며, 원본 오디오가 들어오는 동안 번역된 오디오와 transcript delta를 제공한다. OpenAI는 live interpretation, broadcasts, lessons, meetings 등의 용도로 이 모델을 설명한다.

전용 endpoint:

/v1/realtime/translations
서버가 이미 raw audio를 받고 있는 현재 애플리케이션 구조에서는 WebSocket 사용을 우선한다. OpenAI 공식 문서에서도 서버가 raw audio를 이미 가지고 있는 경우 WebSocket을 사용하는 방식을 안내한다.

WebSocket:

wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate
공식 예제도 이 형태를 사용한다.

6. OpenAI 비용
   현재 OpenAI 공식 모델 페이지 기준:

gpt-realtime-translate
$0.034 / audio minute
이며 텍스트 token이 아닌 audio duration 기준으로 과금된다.

이 가격은 구현 문서가 아니라 현재 OpenAI 공식 가격을 기준으로만 기록하고, Agent가 실제 구현 전에 최신 가격을 다시 확인하도록 한다.

7. OpenAI 입력 오디오 형식
   OpenAI Realtime Translation의 server-side WebSocket 방식에서는:

24 kHz
PCM16
Mono
형식의 오디오를 스트리밍한다.

OpenAI 문서에서는 WebSocket 방식에서 24 kHz PCM16 audio를 base64로 보내는 방식으로 설명한다.

따라서 애플리케이션의 목표 입력 형식은:

24,000 Hz
Mono
PCM16
이다.

8. 입력 Audio format을 48kHz / PCM24로 고정하지 않는다
   실제 교회 운영 환경에서는 Mixer/Audio Interface가 다음 형식을 사용한다.

48 kHz
Mono
PCM24
그러나 개발 시에는 노트북 내장 마이크를 사용할 수 있으며 실제 입력 형식은 달라질 수 있다.

예:

Laptop microphone
48 kHz / PCM16

또는

Laptop microphone
44.1 kHz / PCM16

또는

USB mixer
48 kHz / PCM24
따라서:

입력 format = 가변
OpenAI 전달 format = 고정
원칙으로 설계한다.

9. 현재 AudioCapture 코드에 대한 중요 사항
   현재 AudioCapture는 PyAudio를:

format = pyaudio.paInt16
channels = 1
rate = settings.input_sample_rate
로 열고 있다.

따라서 Mixer가 실제로 24-bit라고 해서 현재 애플리케이션이 PCM24를 직접 받고 있다고 가정하지 않는다.

OS audio driver / PortAudio가 중간에서 format을 변환했을 가능성이 있으므로 Agent는 먼저 실제 input format과 장치가 지원하는 format을 분석한다.

이 분석 없이 PCM24 변환기를 무조건 추가하지 않는다.

10. AudioCapture와 AudioProcessor를 분리한다
    최종 구조:

Audio Device
    ↓
AudioCapture
    ↓
AudioProcessor
    ↓
OpenAITranslationEngine
AudioCapture
책임:

선택된 input device 열기

audio chunk capture

native/selected input format 유지

device lifecycle 관리

AudioProcessor
책임:

sample format conversion

channel conversion

resampling

OpenAI format으로 변환

작은 chunk 단위 streaming processing

예:

48k / Stereo / PCM24
        ↓
AudioProcessor
        ↓
24k / Mono / PCM16
개발 환경:

48k / Mono / PCM16
        ↓
AudioProcessor
        ↓
24k / Mono / PCM16
처럼 동작할 수 있어야 한다.

전체 설교 오디오를 메모리에 모은 후 변환하지 않는다.

작은 chunk 단위로 즉시:

capture
→ process
→ send
한다.

11. AudioProcessor는 OpenAI에 종속시키지 않는다
    OpenAI가 현재 target provider이지만 AudioProcessor 전체를 OpenAI 코드로 만들지 않는다.

원칙:

AudioCapture
    ↓
native audio
    ↓
AudioProcessor
    ↓
provider-required audio format
즉 미래에 API를 바꾸더라도 AudioCapture를 다시 만들 필요가 없어야 한다.

다만 과도한 audio framework를 만들지는 않는다.

12. Audio Device UX
    Operator에서 사용할 입력 장치를 선택할 수 있어야 한다.

예:

Audio Input Device
[ Built-in Microphone ▼ ]
실제 교회:

Audio Input Device
[ USB Audio CODEC ▼ ]
현재 AudioCapture는 이미 audio_device 설정을 숫자 index 또는 이름 일부로 검색할 수 있도록 되어 있으므로 이를 재사용/개선한다.

Backend에 입력 장치 목록 API를 추가하는 것을 검토한다.

예:

GET /api/audio/devices
예상 response:

[
  {
    "index": 3,
    "name": "USB Audio CODEC",
    "input_channels": 2,
    "default_sample_rate": 48000
  }
]
필요한 추가 hardware capability도 조사한다.

13. Audio Test UX
    Operator에서 실제 입력이 제대로 들어오는지 확인할 수 있는 테스트 기능을 만든다.

예:

Audio Input

Device
[ USB Audio CODEC ▼ ]

Status
● Connected

Input Level
██████████████░░░

Detected
48,000 Hz / Mono / 24-bit

OpenAI Processing
24,000 Hz / Mono / PCM16

[ Test Audio ]
노트북에서는 detected format이 다른 값으로 표시될 수 있다.

Audio Test는 다음을 확인하는 것을 목표로 한다.

device selected

device accessible

audio signal present

input format

processing format

conversion success

input level

14. Audio Level Meter
    Broadcast 화면에 input level을 표시한다.

목적은 AI 문제와 audio hardware/input 문제를 구분하는 것이다.

예:

Audio
Device: USB Audio CODEC
Status: Connected

Input Level
████████████░░░
가능하면 dBFS 등의 수치도 제공하되 Operator에게 반드시 노출할 필요는 없다.

15. TranslationEngine abstraction
    OpenAI만 사용하지만 미래에 가격 문제 등으로 다른 API로 바꿀 수 있으므로 아주 작은 abstraction 하나만 유지한다.

과도한 generic architecture를 만들지 않는다.

권장 개념:

TranslationEngine
      ↓
OpenAITranslationEngine
최소 lifecycle:

async def start(...)
async def send_audio(...)
async def events(...)
async def close(...)
실제 타입/이름은 repository 분석 결과에 맞춰 결정한다.

16. Provider abstraction의 범위
    다음은 TranslationEngine 내부에서 처리해야 한다.

OpenAI WebSocket

OpenAI session events

OpenAI audio event parsing

OpenAI transcript event parsing

OpenAI connection errors

OpenAI session close

OpenAI-specific configuration

다음 계층이 OpenAI를 직접 알면 안 된다.

SessionService
BroadcastHub
Listen UI
Sermon Session
Glossary
Audio Device UI
AudioCapture
목표:

SessionService
    ↓
TranslationEngine
    ↓
OpenAITranslationEngine
이다.

17. Application-level Translation Event
    Provider-specific event를 application-level event로 변환한다.

예:

source_text
translated_text
audio
status
error
또는 repository에 맞는 최소 event model을 설계한다.

SessionService와 BroadcastHub는 OpenAI의:

session.output_audio.delta
session.output_transcript.delta
session.input_transcript.delta
같은 API event명을 직접 알지 않아야 한다.

OpenAI의 현재 translation API는 이러한 audio/transcript delta event를 제공한다.

18. OpenAITranslationEngine 동작
    OpenAI translation session에 연결한다.

입력:

24kHz
Mono
PCM16
전송:

session.input_audio_buffer.append
출력 처리:

session.output_audio.delta
    ↓
audio event

session.output_transcript.delta
    ↓
translated text event

session.input_transcript.delta
    ↓
source text event
공식 가이드의 현재 WebSocket 예제 구조를 기준으로 구현한다.

19. Translation session은 voice-agent와 다르게 구현
    일반 gpt-realtime voice agent 구조를 그대로 사용하지 않는다.

OpenAI 공식 문서상:

Voice Agent
/v1/realtime

Translation Session
/v1/realtime/translations
은 서로 다른 architecture를 사용한다.

Translation session은 continuous incoming audio stream을 기반으로 번역하며 일반적인 response.create lifecycle을 사용하지 않는다.

따라서 구현 시 일반 Realtime assistant 예제를 그대로 복사하지 않는다.

20. Session 종료
    OpenAI translation session을 종료할 때 WebSocket을 즉시 닫지 않는다.

가능한 남은 번역/audio 결과를 flush하기 위해:

session.close
    ↓
remaining output 처리
    ↓
session.closed
    ↓
WebSocket close
순서를 지킨다.

마지막 설교 문장이 누락되지 않는지 테스트한다. OpenAI 공식 가이드도 session.close 후 session.closed를 기다리는 구조를 제시한다.

21. API Key 보안
    OpenAI API key는 Browser에 노출하지 않는다.

현재 구조에서는:

React Operator
    ↓
FastAPI
    ↓
OpenAI
로 처리한다.

Listen 사용자 역시 OpenAI standard API key를 직접 받지 않는다.

필요하다면 향후 browser WebRTC 방식의 short-lived client secret 구조를 검토할 수 있지만, 현재 architecture는 서버가 Mixer/raw audio를 받기 때문에 우선 server-side WebSocket 구조를 사용한다.

22. Sermon Session
    설교에 대한 정보는 .env에 넣지 않는다.

.env에는 애플리케이션의 고정적인 configuration만 둔다.

예:

source language
target language
OpenAI configuration
default application settings
매주 변경되는 데이터는 Sermon Session으로 관리한다.

예:

Sermon Title
Speaker
Bible Reference
Bible Text
Today's Notes
Today's Glossary
예:

Sermon Session

Title
[ 오늘의 설교 제목 ]

Speaker
[ 설교자 ]

Bible Reference
[ 로마서 8:1-11 ]

Bible Text
[ ... ]

Today's Notes
[ ... ]

Today's Glossary
[ ... ]
23. Server와 Sermon Session을 구분
다음 두 개념을 하나로 취급하지 않는다.

Server
ON / OFF
와:

Sermon Session
Prepare
→ Ready
→ Live
→ Ended
를 구분하는 것을 권장한다.

이것은 운영 안정성을 위한 구조다.

24. Translation Profile
    고정적인 번역 정책은 Translation Profile로 관리한다.

예:

Translation Profile

Name
[ Sermon - Korean → German ]

Source language
Korean

Target language
German

Style
Natural spoken German

Biblical terminology
Enabled

No explanation
Enabled

No summarization
Enabled
이 Profile은 매주 바뀌는 설교 정보와 구분한다.

25. Prompt / Context 전략
    다음 계층으로 생각한다.

Base Translation Rules
        +
Translation Profile
        +
Sermon Context
        +
Relevant Glossary
그러나 gpt-realtime-translate가 일반 GPT/voice-agent와 동일한 방식의 arbitrary prompt/context injection을 지원한다고 가정하지 않는다.

구현 전 반드시 현재 OpenAI 공식 API reference를 확인한다.

지원되는 경우에만 위 context를 session configuration/instructions 등으로 전달한다.

지원되지 않는다면 구조를 억지로 구현하지 말고, 공식적으로 지원되는 방식으로 재설계한다.

26. Glossary 정책
    Glossary는 거대한 사전 dump가 아니다.

너무 많은 irrelevant term을 한 번에 전달하지 않는다.

핵심 원칙:

정확한 소량의 relevant glossary

거대한 전체 glossary
다음 두 종류를 기본으로 한다.

Global Glossary
항상 자주 사용하는 핵심 교회/성경 용어.

예:

은혜 → Gnade
칭의 → Rechtfertigung
성화 → Heiligung
구속 → Erlösung
복음 → Evangelium
처음부터 수백 개를 넣지 않는다.

실제 사용 중 문제가 발견되는 용어를 중심으로 점진적으로 확대한다.

Sermon Glossary
오늘 설교에서 특별히 중요한 용어만 관리한다.

예:

오늘 설교의 특정 신학 용어
특정 고유명사
설교자가 특별하게 사용하는 표현
27. Glossary 적용 방식
전체 Global Glossary를 매번 session에 전부 넣는 것을 기본 동작으로 만들지 않는다.

가능한 경우:

Global Glossary
        +
Today's Sermon Glossary
        ↓
Relevant terms
        ↓
Translation Session
구조를 사용한다.

처음부터 RAG/vector DB/embedding 등의 복잡한 검색 시스템을 도입하지 않는다.

관련 용어 선택 방식은 단순한 구조로 시작한다.

실제 translation quality 테스트에서 문제가 반복되는 경우에만 후속 개선한다.

28. Glossary UX
    Operator에서 개발자가 JSON 파일을 직접 수정하지 않고 관리할 수 있도록 설계한다.

예:

Global Glossary

Korean          German
----------------------

은혜             Gnade
칭의             Rechtfertigung

[ + Add term ]
그리고:

Today's Sermon Glossary

Korean          German
----------------------

특정 용어         특정 번역

[ + Add term ]
두 영역을 구분한다.

29. Glossary 우선순위
    모든 Glossary 항목을 강제 규칙으로 취급하지 않는다.

필요하다면 최소한:

source
target
priority
note
정도의 metadata를 고려한다.

예:

{
  "source": "Gnade",
  "target": "은혜",
  "priority": "high",
  "note": "성경/설교 문맥에서 일반적으로 사용"
}
다만 이 구조가 실제 API에 필요한지 여부는 구현 전에 검토한다.

과도한 데이터 model을 만들지 않는다.

30. Broadcast UX
    Broadcast 화면에서 다음을 보여주는 방향으로 개선한다.

Translation Session
Status: LIVE

Audio
Device: USB Audio CODEC
Status: Connected

Input Level
██████████████░░

Source
Korean

Target
German

┌──────────────────────┬──────────────────────┐
│ Korean Source        │ German Translation   │
├──────────────────────┼──────────────────────┤
│ ...                  │ ...                  │
└──────────────────────┴──────────────────────┘

Latency
...

OpenAI
Connected

[ START ]
[ STOP ]
기존 Broadcast 기능을 최대한 유지한다.

31. Listen UX
    Listen 페이지에서는:

Connection status
German subtitle
German translated audio
Volume control
Reconnect state
정도를 제공한다.

가능하다면 source transcript 표시 여부도 고려할 수 있지만, 기본적인 사용자 화면을 복잡하게 만들지는 않는다.

32. Latency
    AudioProcessor의 conversion 자체가 latency의 주요 병목이라고 가정하지 않는다.

가장 중요한 것은:

input chunk buffering
network
OpenAI translation latency
translated audio generation
browser playback buffering
이다.

AudioProcessor는 작은 chunk를 즉시 처리해야 한다.

다음 구조를 피한다.

몇 초간 audio 저장
    ↓
한 번에 변환
    ↓
OpenAI
대신:

small chunk
    ↓
process
    ↓
send
로 처리한다.

OpenAI translation도 continuous streaming을 전제로 한다.

33. Future Provider Replacement
    현재는 OpenAI만 사용한다.

그러나 향후:

OpenAI 가격 상승
서비스 정책 변경
품질 문제
장애
새로운 provider 등장
등의 이유로 API를 교체할 가능성이 있다.

따라서 다음 정도의 abstraction은 유지한다.

TranslationEngine
      ↓
OpenAITranslationEngine
나중에 필요하면:

TranslationEngine
      ↓
OtherTranslationEngine
을 추가한다.

하지만 다음과 같은 거대한 abstraction framework는 만들지 않는다.

❌ Generic AI orchestration framework
❌ Generic agent layer
❌ Multiple provider capability matrix
❌ 모든 API를 완벽하게 추상화하는 layer
핵심은 작은 interface 하나만 유지하면서 provider-specific code를 한 곳에 가두는 것이다.

34. Gemini 제거 방법
    현재 Gemini 코드를 바로 삭제하지 않는다.

먼저 Git baseline을 만든다.

예:

git tag gemini-baseline
또는 repository 방식에 맞는 equivalent backup/branch를 사용한다.

그 다음 개발 branch에서는 Gemini 기능을 더 확장하지 않는다.

OpenAI 구현이 정상 동작하면 Gemini를 제거한다.

삭제 대상 후보:

Gemini Live service
Gemini factory branch
Gemini-specific protocol pieces
Gemini config
Gemini environment variables
Gemini API key UI
Gemini model UI
Gemini dependencies
Gemini tests
Gemini logs/messages
단, TranslationEngine interface나 최소 factory가 미래 provider 교체를 위해 필요하면 유지한다.

35. 최종 Backend 목표
    repository 분석 후 실제 파일명을 결정하되 개념적으로:

backend/
│
├── core/
│   └── config.py
│
├── services/
│   ├── audio/
│   │   ├── device.py
│   │   ├── capture.py
│   │   └── processor.py
│   │
│   ├── translation/
│   │   ├── interface.py
│   │   ├── factory.py
│   │   └── openai.py
│   │
│   ├── session_service.py
│   └── broadcast.py
│
├── models/
│   ├── sermon_session.py
│   ├── translation_profile.py
│   └── glossary.py
│
└── api/
    ├── settings.py
    ├── audio.py
    ├── session.py
    └── broadcast.py
실제 repository 구조를 확인한 후 필요 없는 디렉터리/파일은 만들지 않는다.

36. 최종 데이터 흐름
    Laptop Microphone
    또는
    USB Audio / Mixer
    ↓
    AudioCapture
    ↓
    AudioProcessor
    ↓
    24kHz / Mono / PCM16
    ↓
    TranslationEngine
    ↓
    OpenAITranslationEngine
    ↓
    gpt-realtime-translate
    ↓
    German Transcript + German Audio
    ↓
    BroadcastHub
    ↓
    ┌─────────────────────┬────────────────────┐
    │ Broadcast Operator  │ Listen Users       │
    │ Korean + German     │ German subtitle    │
    │ status / level      │ German audio       │
    └─────────────────────┴────────────────────┘
37. Migration / Development Plan
    Phase 0 — Baseline
    목표:

현재 Gemini 상태를 안전하게 보존한다.

작업:

현재 상태 commit/tag/branch

Gemini baseline 기록

현재 application 동작 확인

Phase 1 — Repository Audit
코드를 수정하기 전에 repository 전체를 분석한다.

반드시 확인:

Backend 구조

Frontend 구조

settings/config

API key 저장 방식

Operator API

Operator UI

Broadcast WebSocket

Listen WebSocket

Session lifecycle

AudioCapture

실제 PyAudio configuration

audio chunk size

sample rate

dependencies

tests

Gemini-specific files

protocol.py

factory.py

environment variables

분석 결과를 다음으로 분류한다.

KEEP
REFACTOR
REPLACE
DELETE
NEW
Phase 2 — Audio Device / Capture
목표:

개발 노트북과 실제 Mixer 환경 모두에서 입력 장치를 선택할 수 있도록 한다.

작업:

audio device discovery

input device API

Operator dropdown

selected device persistence

device validation

audio test

input level

먼저 실제 PyAudio에서 사용하는 input format을 확인한다.

Phase 3 — AudioProcessor
목표:

가변적인 input audio를 OpenAI input format으로 변환한다.

작업:

sample format conversion
channel conversion
sample-rate conversion
streaming processing
target:

24kHz
Mono
PCM16
latency/CPU 테스트를 포함한다.

Phase 4 — Minimal TranslationEngine
현재 Gemini abstraction이 필요 이상으로 크다면 정리한다.

최소한의 interface만 남긴다.

start
send_audio
events
close
OpenAI event format이 위쪽 application으로 새어나가지 않는지 확인한다.

Phase 5 — OpenAITranslationEngine
목표:

AudioCapture
→ AudioProcessor
→ OpenAI
→ BroadcastHub
를 end-to-end로 연결한다.

사용 모델:

gpt-realtime-translate
사용 endpoint:

/v1/realtime/translations
서버-side WebSocket 사용.

공식 API 문서를 구현 시 다시 확인한다.

Phase 6 — End-to-End Testing
개발 환경:

Laptop microphone
실제 환경:

Mixer / USB Audio
에서 각각 테스트한다.

테스트:

연결

audio capture

translation

transcript

translated audio

Listen playback

multiple listeners

start/stop

reconnect

session shutdown

last sentence flush

invalid API key

network failure

device unavailable

audio silence

low input level

high input level

latency

Phase 7 — Gemini Removal
OpenAI end-to-end가 안정화되면:

Gemini service 삭제

Gemini configuration 삭제

Gemini UI 삭제

Gemini dependency 삭제

Gemini tests 삭제

Gemini-specific factory logic 삭제

불필요한 interpreter abstraction 삭제

단:

TranslationEngine interface
등 미래 provider 교체에 필요한 최소 abstraction은 유지한다.

Phase 8 — Sermon Session / Translation Profile / Glossary
기본 realtime translation이 동작한 이후 추가한다.

순서:

Translation Profile
        ↓
Sermon Session
        ↓
Global Glossary
        ↓
Today's Sermon Glossary
처음부터 RAG/embedding을 도입하지 않는다.

Phase 9 — Production UX
추가:

Audio Test

Input Level

API connection status

Translation status

latency

session state

reconnect

clear error messages

Start/Stop state

Listener connection count

volume/playback UX

38. Ticket 작성 규칙
    repository 분석 후 위 Phase를 실제 개발 ticket으로 분해한다.

각 ticket에는 반드시 다음을 포함한다.

Title
Goal
Why
Related files
Dependencies
Implementation notes
Acceptance criteria
Tests
Risks
가능한 경우 작은 ticket으로 분리한다.

예:

AUD-01 Audio Device Discovery
AUD-02 Audio Device Selection UI
AUD-03 Audio Input Test
AUD-04 Audio Level Meter

AUD-10 AudioProcessor
AUD-11 Resampling
AUD-12 PCM Format Conversion

TR-01 TranslationEngine interface
TR-02 OpenAI WebSocket connection
TR-03 OpenAI event adapter
TR-04 Session lifecycle
TR-05 Error/reconnect

MIG-01 Remove Gemini config
MIG-02 Remove Gemini service
MIG-03 Remove Gemini dependencies
실제 ticket 번호와 분량은 repository 분석 결과에 따라 결정한다.

39. Agent의 첫 번째 행동
    코드를 바로 수정하지 않는다.

먼저 repository를 분석하고 다음 보고서를 만든다.

1. Current architecture map
2. Gemini dependency map
3. Audio input flow
4. Current WebSocket flow
5. Current Operator flow
6. Current Listen flow
7. Current configuration flow
8. Files to KEEP
9. Files to REFACTOR
10. Files to DELETE
11. Files to CREATE
12. Risks / unknowns
13. OpenAI migration plan
14. Ticket breakdown
    특히 현재 AudioCapture가 paInt16으로 열리고 있다는 점을 확인하고, 실제 운영 환경의 Mixer가 PCM24라는 사실과 구분해서 분석한다.
15. Agent가 임의로 가정하지 말아야 할 것
    다음을 repository/API 문서 확인 없이 가정하지 않는다.

현재 PyAudio가 실제로 PCM24를 받고 있다고 가정

OpenAI translation session이 일반 voice-agent와 동일하다고 가정

arbitrary prompt/instructions가 반드시 translation model에 동일하게 적용된다고 가정

모든 glossary를 항상 session에 넣어야 한다고 가정

모든 audio device가 24kHz를 지원한다고 가정

모든 provider가 동일한 event 구조라고 가정

Gemini factory/protocol을 반드시 그대로 유지해야 한다고 가정

새로운 provider 지원을 위해 거대한 abstraction layer가 필요하다고 가정

모호하거나 API 문서가 변경된 부분은 최신 공식 OpenAI 문서를 기준으로 확인한다.

41. 최종 설계의 핵심 원칙
    가장 중요한 원칙을 다음과 같이 유지한다.
42. 최종 제품은 OpenAI 중심으로 개발한다.
43. Gemini는 baseline으로만 보존하고 최종 제품에서 제거한다.
44. 입력 audio format은 고정하지 않는다.
45. OpenAI로 들어가는 audio format은 24kHz / Mono / PCM16으로 표준화한다.
46. AudioCapture와 AudioProcessor를 분리한다.
47. TranslationEngine abstraction은 최소한으로 유지한다.
48. SessionService와 BroadcastHub는 OpenAI를 몰라야 한다.
49. API key는 Backend에서만 관리한다.
50. Server lifecycle과 Sermon Session lifecycle을 분리한다.
51. 고정 번역 규칙과 오늘의 설교 context를 분리한다.
52. Glossary는 작고 relevant하게 유지한다.
53. Global Glossary와 Today's Sermon Glossary를 분리한다.
54. 처음부터 RAG/vector DB를 만들지 않는다.
55. Prompt/context는 공식 API가 지원하는 방식만 사용한다.
56. 향후 API 교체가 가능하되 과도한 abstraction은 만들지 않는다.
57. 먼저 end-to-end translation을 성공시키고 이후 품질 개선 UX를 추가한다.
    최종 제품의 한 문장 정의
    교회 Mixer 또는 컴퓨터 마이크에서 들어오는 한국어 설교 음성을 FastAPI 서버가 실시간으로 OpenAI gpt-realtime-translate에 전달하고, 번역된 독일어 자막과 음성을 여러 Listen 사용자에게 스트리밍하는 시스템.
