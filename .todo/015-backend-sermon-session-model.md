# 015 Sermon Session 모델

상태: 대기

## Goal

설교 메타데이터(제목/설교자/성경 본문/노트)와 lifecycle(Prepare/Ready/Live/Ended)을 관리하는 Sermon Session을 추가한다. 서버 on/off(SessionService)와는 별개 개념으로 분리한다.

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
- lifecycle: `prepare | ready | live | ended`. `SessionService.start()`가 자동으로 `live`로, `stop()`이 `ended`로 전이시키되, lifecycle 상태 자체는 SessionService와 별도 모듈이 소유한다 (SessionService가 sermon lifecycle을 몰라야 하면 이벤트/콜백으로 연결).
- 저장은 기존 `operator_store.py`와 유사하게 JSON 파일 기반으로 단순하게 시작.

## Acceptance criteria

- 설교 메타데이터를 서버 재시작 여부와 무관하게 저장/조회 가능.
- lifecycle 상태가 서버 실행 여부와 독립적으로 조회 가능 (server off여도 이전 sermon 정보 조회 가능).

## Tests

- lifecycle 전이 규칙, 저장/조회 라운드트립 테스트.

## Risks

- lifecycle과 SessionService 상태를 어떻게 연결할지 설계 판단 필요 — 과도한 결합 피할 것.
