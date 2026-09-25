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
2. `019-backend-glossary-model.md` — Global + Today's Sermon Glossary 최소 모델
3. `021-frontend-glossary-ui.md` — Settings의 Global Glossary와 Sermon의 Today's Glossary UI
4. `027-backend-translation-session-lifecycle.md` — Translation Session lifecycle
5. `028-backend-translation-safety-timer.md` — Translation Safety Timer
6. `029-backend-broadcast-observability.md` — Broadcast 상태 이벤트 계약
7. `030-frontend-operator-navigation-restructure.md` — Operator 3영역 navigation
8. `031-frontend-translation-session-controls.md` — Broadcast Translation 제어
9. `032-frontend-settings-configuration-ui.md` — 운영 설정 UI
10. `033-frontend-listener-core-ux.md` — Listener 핵심 UX
11. `034-e2e-core-live-flow.md` — 핵심 live broadcast 흐름 검증

## 보류 (`hold/`)

1. `020-backend-glossary-injection.md` — OpenAI 공식 Glossary 지원 여부 확인 (미지원으로 보류)
2. `022-backend-runtime-instruction-wiring.md` — runtime context 지원 확인 후 주입 경계 구현 (현재 보류)
3. `023-backend-sermon-session-runtime-context.md` — 실제 Sermon Session 필드 기반 context (현재 보류)

## 완료 및 폐기 기록 (`done/`)

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
14. `015-backend-sermon-session-model.md — Sermon Session 모델`
15. `016-frontend-sermon-session-ui.md — Sermon Session UI`
16. `017-backend-translation-profile-model.md — 폐기/제외 (기존 코드 잔재는 024에서 제거)`
17. `018-frontend-translation-profile-ui.md — 폐기/제외`
18. `024-backend-translation-policy-config.md — Translation Profile CRUD 잔재 제거 및 정책 범위 고정`
19. `026-frontend-listen-volume-control.md — 폐기/제외`
20. `025-frontend-broadcast-metadata-panel.md — Broadcast 메타데이터 패널`

## 결정 사항

- FastAPI + Vite React. Next.js 사용하지 않음
- 룰은 `.agent/rules`. `.cursor/rules` 없음
- 통역 API는 `LiveInterpreter` injection. 파이프라인에 vendor 분기 금지
- 1차 UI: 성도 Listen + 방송실 Operator React
- 최종 제품은 OpenAI(`gpt-realtime-translate`)만 사용. Gemini는 baseline으로만 git tag 보존 후 001에서 제거
- 언어 방향: SOURCE Korean -> TARGET German 고정
- API key는 코드·테스트 fixture·로그·API 응답에 평문으로 남기지 않으며, 노출 시 폐기·재발급을 먼저 수행
- 외부 API 구현은 공식 문서 확인 결과(endpoint/model/event/audio format)를 ticket에 기록한 후 진행
- 2026-09-25 공식 Realtime Translation 문서 기준 `gpt-realtime-translate` 세션에는 `instructions`/Glossary 입력이 문서화되어 있지 않다. 번역 세션의 갱신 가능 항목은 output language, input transcription, noise reduction이므로 020/022/023의 주입 작업은 보류한다.
- Operator 메뉴는 `방송 / 설교 / 설정` 3개 영역으로 구성한다
- `Server ONLINE`과 `Translation LIVE/OFF`는 별도 상태로 표시하고 제어한다
- Translation Safety Timer 기본값은 Auto Stop 90분, Warning 5분 전, Extension 10분, Hard Limit 120분이다
- Listener는 상태, 자막, 명시적 듣기 시작, 글자 크기, 테마만 우선 제공한다
- QR code, join link, 다중 언어, transcript history, RAG/vector DB는 이번 범위에 포함하지 않는다
