---
description: backend unit, frontend unit, e2e 3축 테스트. 중요한 것만 테스트한다
applyTo: "**"
---

# Testing

테스트는 세 가지만 둔다.

1. backend unit: `backend/tests/unit/` (pytest)
2. frontend unit: `frontend/tests/unit/` (Vitest)
3. e2e: `frontend/tests/e2e/` (Playwright, 필요할 때만)

integration test 폴더를 기본으로 두지 않는다.

## 무엇을 테스트하나

- interpreter factory 선택
- Echo adapter 이벤트 형태
- 자막 필터 규칙
- PCM odd-byte 결합
- 실패하면 핵심 듣기 흐름이 깨지는 로직

## 무엇을 테스트하지 않나

- 디자인/레이아웃
- Gemini/OpenAI 실호출
- 실제 마이크 캡처
- 코드 한 줄을 그대로 재현하는 테스트
