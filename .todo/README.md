# todo

티켓 시스템이 없어서 이 폴더를 작업 단위로 쓴다.

- 파일 하나 = 작업 하나
- 파일명: `NNN-짧은-제목.md`
- 상태: `대기` / `진행` / `보류` / `완료`
- 미완료만 `.todo/` 루트에 둔다
- 완료하면 상태를 `완료`로 바꾸고 `done/`으로 옮긴다

## 지금 (미완료)

OpenAI 통역 전환 (Gemini -> OpenAI `gpt-realtime-translate`). 순서대로 진행.

1. `007-backend-openai-realtime-adapter.md` — OpenAI Realtime Translation adapter 구현
3. `008-backend-openai-e2e-verify.md` — OpenAI end-to-end 검증
4. `009-backend-operator-audio-device-setting.md` — Operator 설정에 오디오 장치 저장
5. `010-frontend-audio-device-ui.md` — 오디오 장치 선택 UI
6. `011-backend-audio-level-broadcast.md` — 오디오 입력 레벨 브로드캐스트
7. `012-frontend-audio-level-meter.md` — 오디오 레벨 미터 UI
8. `013-backend-audio-test-endpoint.md` — 오디오 테스트 엔드포인트
9. `014-frontend-audio-test-ux.md` — 오디오 테스트 UX
10. `015-backend-sermon-session-model.md` — Sermon Session 모델
11. `016-frontend-sermon-session-ui.md` — Sermon Session UI
12. `017-backend-translation-profile-model.md` — Translation Profile 모델
13. `018-frontend-translation-profile-ui.md` — Translation Profile UI
14. `019-backend-glossary-model.md` — Glossary 모델 (Global + Sermon)
15. `020-backend-glossary-injection.md` — Glossary 세션 주입 (지원 여부에 따라 보류 가능)
16. `021-frontend-glossary-ui.md` — Glossary UI
17. `022-frontend-broadcast-metadata-panel.md` — Broadcast 메타데이터 패널
18. `023-frontend-listen-volume-control.md` — Listen 볼륨 컨트롤

## 완료 (`done/`)

1. `001-remove-gemini.md — Gemini 코드/설정/UI 제거 (git baseline tag 존재, 최우선)`
2. `002-backend-openai-settings.md — OpenAI 모델/타겟 오디오 포맷 설정 추가`
3. `003-backend-audio-device-api.md — 오디오 입력 장치 목록 API`
4. `004-backend-audio-capture-native-format.md — AudioCapture 네이티브 포맷 대응`
5. `005-backend-audio-processor.md — AudioProcessor (포맷 변환)`
6. `006-backend-session-service-processor-wiring.md — SessionService에 AudioProcessor 연결`

## 결정 사항

- FastAPI + Vite React. Next.js 사용하지 않음
- 룰은 `.agent/rules`. `.cursor/rules` 없음
- 통역 API는 `LiveInterpreter` injection. 파이프라인에 vendor 분기 금지
- 1차 UI: 성도 Listen + 방송실 Operator React
- 최종 제품은 OpenAI(`gpt-realtime-translate`)만 사용. Gemini는 baseline으로만 git tag 보존 후 001에서 제거
- 언어 방향: SOURCE Korean -> TARGET German 고정
- API key는 코드·테스트 fixture·로그·API 응답에 평문으로 남기지 않으며, 노출 시 폐기·재발급을 먼저 수행
- 외부 API 구현은 공식 문서 확인 결과(endpoint/model/event/audio format)를 ticket에 기록한 후 진행
