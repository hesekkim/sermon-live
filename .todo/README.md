# todo

티켓 시스템이 없어서 이 폴더를 작업 단위로 쓴다.

- 파일 하나 = 작업 하나
- 파일명: `NNN-짧은-제목.md`
- 상태: `대기` / `진행` / `보류` / `완료`
- 미완료만 `.todo/` 루트에 둔다
- 완료하면 상태를 `완료`로 바꾸고 `done/`으로 옮긴다

## 지금 (미완료)

개인 예배용 실시간 통역 운영 기능. Server는 계속 실행할 수 있고, 비용이 발생하는 Translation Session만 필요할 때 실행한다.

1. `008-backend-openai-e2e-verify.md` — OpenAI 및 Translation Session end-to-end 검증
2. `015-backend-sermon-session-model.md` — Sermon Session 모델
3. `016-frontend-sermon-session-ui.md` — Sermon Session UI
4. `017-backend-translation-profile-model.md` — Translation Profile 모델
5. `018-frontend-translation-profile-ui.md` — Translation Profile UI
6. `019-backend-glossary-model.md` — Glossary 모델 (Global + Sermon)
7. `020-backend-glossary-injection.md` — Glossary 세션 주입 (지원 여부에 따라 보류 가능)
8. `021-frontend-glossary-ui.md` — Glossary UI
9. `022-frontend-broadcast-metadata-panel.md` — Broadcast 메타데이터 패널
10. `023-frontend-listen-volume-control.md` — Listen 볼륨 컨트롤
11. `024-backend-translation-session-lifecycle.md` — Translation Session lifecycle
12. `025-backend-translation-safety-timer.md` — Translation Safety Timer
13. `026-backend-broadcast-observability.md` — Broadcast 상태 이벤트 계약
14. `027-frontend-operator-navigation-restructure.md` — Operator 3영역 navigation
15. `028-frontend-translation-session-controls.md` — Broadcast Translation 제어
16. `029-frontend-settings-configuration-ui.md` — 운영 설정 UI
17. `030-frontend-listener-core-ux.md` — Listener 핵심 UX
18. `031-e2e-core-live-flow.md` — 핵심 live broadcast 흐름 검증

## 완료 (`done/`)

1. `001-remove-gemini.md — Gemini 코드/설정/UI 제거 (git baseline tag 존재, 최우선)`
2. `002-backend-openai-settings.md — OpenAI 모델/타겟 오디오 포맷 설정 추가`
3. `003-backend-audio-device-api.md — 오디오 입력 장치 목록 API`
4. `004-backend-audio-capture-native-format.md — AudioCapture 네이티브 포맷 대응`
5. `005-backend-audio-processor.md — AudioProcessor (포맷 변환)`
6. `006-backend-session-service-processor-wiring.md — SessionService에 AudioProcessor 연결`
7. `007-backend-openai-realtime-adapter.md — OpenAI Realtime Translation adapter 구현`
8. `009-backend-operator-audio-device-setting.md — Operator 설정에 오디오 장치 저장`
9. `010-frontend-audio-device-ui.md — 오디오 장치 선택 UI`
10. `011-backend-audio-level-broadcast.md — 오디오 입력 레벨 브로드캐스트`
11. `012-frontend-audio-level-meter.md — 오디오 레벨 미터 UI`
12. `013-backend-audio-test-endpoint.md — 오디오 테스트 엔드포인트`
13. `014-frontend-audio-test-ux.md — 오디오 테스트 UX`

## 결정 사항

- FastAPI + Vite React. Next.js 사용하지 않음
- 룰은 `.agent/rules`. `.cursor/rules` 없음
- 통역 API는 `LiveInterpreter` injection. 파이프라인에 vendor 분기 금지
- 1차 UI: 성도 Listen + 방송실 Operator React
- 최종 제품은 OpenAI(`gpt-realtime-translate`)만 사용. Gemini는 baseline으로만 git tag 보존 후 001에서 제거
- 언어 방향: SOURCE Korean -> TARGET German 고정
- API key는 코드·테스트 fixture·로그·API 응답에 평문으로 남기지 않으며, 노출 시 폐기·재발급을 먼저 수행
- 외부 API 구현은 공식 문서 확인 결과(endpoint/model/event/audio format)를 ticket에 기록한 후 진행
- Operator 메뉴는 `방송 / 설교 / 설정` 3개 영역으로 구성한다
- `Server ONLINE`과 `Translation LIVE/OFF`는 별도 상태로 표시하고 제어한다
- Translation Safety Timer 기본값은 Auto Stop 90분, Warning 5분 전, Extension 10분, Hard Limit 120분이다
- Listener는 상태, 자막, 명시적 듣기 시작, 글자 크기, 테마만 우선 제공한다
- QR code, join link, 다중 언어, transcript history, RAG/vector DB는 이번 범위에 포함하지 않는다
