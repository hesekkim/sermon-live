# 011 Settings + Toast 회귀 검증

상태: 대기

## 목표

007~010 작업의 핵심 계약을 자동 테스트와 수동 시나리오로 검증한다.

## 구현 범위

- backend settings store/API 저장 및 key 비노출 테스트
- frontend Toast provider/store의 render, dismiss, auto-dismiss 테스트
- Settings GET/PUT payload와 Apply 성공·실패 테스트
- Broadcast start/stop 성공·실패와 WebSocket/interpreter error 테스트
- Dark Mode에서 Toast theme class와 CSS variable 적용 확인

## 수용 기준

- 핵심 frontend unit test가 모두 통과한다.
- backend unit test가 모두 통과한다.
- TypeScript build가 통과한다.
- Gemini key 저장, 새로고침, Dark Mode Toast, Broadcast start/stop 수동 시나리오가 재현 가능하다.
- API key 원문이 테스트 snapshot이나 사용자 표시 메시지에 포함되지 않는다.

## 검증 명령

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest
Set-Location ..\frontend
npm test -- --run
npm run build
```

## 커밋 경계

007~010에서 추가한 테스트와 최종 검증 문서만 포함한다. 새로운 기능 구현은 각 기능 티켓에서 처리한다.
