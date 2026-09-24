---
description: backend unit, frontend unit, e2e 3축 테스트. 중요한 것만 테스트한다
applyTo: '**/*'
---

# Testing

테스트는 세 가지만 둔다.

1. backend unit: `backend/tests/unit/` (pytest)
2. frontend unit: `frontend/tests/unit/` (Vitest)
3. e2e: `frontend/tests/e2e/` (Playwright)

integration test 폴더를 기본으로 두지 않는다.

## 무엇을 테스트하나

- interpreter factory 선택
- Echo adapter 이벤트 형태
- 자막 필터 규칙
- PCM odd-byte 결합
- 실패하면 핵심 듣기 흐름이 깨지는 로직
- 실패하면 인증, 데이터 손실, 핵심 사용자 흐름이 깨지는 로직
- 분기와 규칙이 있는 계산, 권한, 폼 검증, 상태 전환
- e2e는 홈 진입, 핵심 페이지 이동처럼 짧은 사용자 경로만

## 무엇을 테스트하지 않나

- 디자인/레이아웃
- 레이아웃 component
- 스타일, className, snapshot
- Gemini/OpenAI 실호출
- 외부 서비스 실호출
- 실제 마이크 캡처
- 실제 API key 사용 또는 테스트 결과·로그에 API key 출력
- 코드 한 줄을 그대로 재현하는 테스트

새 테스트를 추가하기 전에 "이 테스트가 깨졌을 때 실제로 고칠 가치가 있는가"를 먼저 본다.
