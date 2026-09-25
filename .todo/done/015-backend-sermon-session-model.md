# 015 Sermon Session 모델

상태: 완료

## Goal

설교 메타데이터(제목/설교자/성경 본문/노트)와 준비 상태를 관리하는 Sermon Session을 추가한다. FastAPI Server, AudioCapture, Translation Session과는 별개 개념으로 분리한다.

## Why

`.env`에는 고정 설정만 두고, 매주 바뀌는 설교 정보는 별도 세션으로 관리해야 한다 (Archthecture.md 22~23번).

## Related files

- 신규 `backend/models/sermon_session.py` (또는 `backend/services/sermon_session.py`, 저장소 구조에 맞춰 결정)
- 신규 endpoint `GET/PUT /api/v1/sermon-session`
- 신규 테스트

## Dependencies

001

## Implementation notes

- 필드: `title, speaker, bible_reference, bible_text, notes`.
- sermon 상태: `prepare | ready | ended`. `live`는 Translation Session의 상태로 관리하며 Sermon Session 상태에 섞지 않는다.
- Translation Session 시작/중지가 Sermon Session의 현재 sermon id와 연결될 수는 있지만, `SessionService`가 Sermon Session lifecycle을 직접 소유하지 않는다.
- 저장은 기존 `operator_store.py`와 유사하게 JSON 파일 기반으로 단순하게 시작.

## Acceptance criteria

- 설교 메타데이터를 서버 재시작 여부와 무관하게 저장/조회 가능.
- sermon 상태와 메타데이터가 서버 실행 여부와 독립적으로 조회 가능 (server off여도 이전 sermon 정보 조회 가능).
- Translation Session이 없는 상태에서도 Sermon Session을 저장하고 준비할 수 있다.

## Tests

- lifecycle 전이 규칙, 저장/조회 라운드트립 테스트.

## Risks

- lifecycle과 SessionService 상태를 어떻게 연결할지 설계 판단 필요 — 과도한 결합 피할 것.
