# todo

티켓 시스템이 없어서 이 폴더를 작업 단위로 쓴다.

- 파일 하나 = 작업 하나
- 파일명: `NNN-짧은-제목.md`
- 상태: `대기` / `진행` / `보류` / `완료`
- 미완료만 `.todo/` 루트에 둔다
- 완료하면 상태를 `완료`로 바꾸고 `done/`으로 옮긴다

## 지금 (미완료)

1. `002-operator-ui.md` — 방송실 React UI
2. `003-openai-realtime.md` — OpenAI Realtime adapter
3. `004-vad-segment.md` — 긴 설교 지연: VAD/구간 분할

## 완료 (`done/`)

1. `done/001-port-prototype.md` — FastAPI + React Listen 이식

## 결정 사항

- FastAPI + Vite React. Next.js 사용하지 않음
- 룰은 `.agent/rules`. `.cursor/rules` 없음
- 통역 API는 `LiveInterpreter` injection. 파이프라인에 vendor 분기 금지
- 1차 UI: 성도 Listen만 React. 방송실은 CLI
