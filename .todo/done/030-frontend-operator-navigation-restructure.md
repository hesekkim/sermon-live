
# 030 Operator Navigation — Glossary 제외 최종 수정안

## 변경 배경

Glossary 기능은 현재 우선순위에서 제외하기로 했으므로, 030 티켓에서 Glossary 관련 navigation 및 배치 내용을 모두 제거한다.

030은 **Operator의 상위 navigation 구조와 route 연결**에 집중하고, 실제 기능 구현은 각 기능별 티켓에서 담당한다.

---

## 최종 목표

Operator UI를 다음 3개 영역으로 구성한다.

```text
방송
설교
설정
```

각 영역의 역할은 다음과 같다.

```text
방송
→ Translation Dashboard
→ 실제 통역 운영 상태와 제어

설교
→ Sermon Session
→ 설교 제목, 설교자, 성경 본문, 메모 등

설정
→ 화면
→ 오디오
→ OpenAI
→ Safety
```

---

## Glossary 관련 결정

현재는 Glossary 기능을 구현하지 않는다.

따라서 030에서 다음 항목은 제외한다.

```text
❌ Global Glossary
❌ Today's Sermon Glossary
❌ Glossary 관련 sidebar/menu
❌ Glossary 페이지 route
❌ Glossary 배치 작업
```

Glossary 관련 티켓은 현재 구현 범위에서 제외하고 추후 필요할 때 다시 검토한다.

---

## Scope

- 기존 layout과 component를 최대한 재사용
- `방송 / 설교 / 설정` 3개 top-level 영역 구성
- 방송: Translation Dashboard와 실시간 상태
- 설교: Sermon Session metadata
- 설정: 화면, 오디오, OpenAI, Safety
- Translation Profile 메뉴와 별도 페이지를 두지 않음
- Server ON/OFF를 주요 운영 버튼으로 노출하지 않고 Translation Session 제어를 중심으로 구성
- route와 sidebar label을 3개 영역에 맞게 정리
- direct route 진입과 새로고침이 정상 동작하도록 구성

---

## 페이지 구조

### 방송

```text
방송
└── Translation Dashboard
    ├── Server 상태
    ├── Translation 상태
    ├── Audio 상태
    ├── Listener 상태
    ├── Timer
    ├── 한국어 원문
    └── 독일어 번역
```

### 설교

```text
설교
└── Sermon Session
    ├── 제목
    ├── 설교자
    ├── 성경 본문
    └── 메모
```

### 설정

```text
설정
├── 화면
├── 오디오
├── OpenAI
└── Safety
```

---

## 책임 범위

030은 navigation과 route 구조를 담당한다.

```text
030
→ 어떤 페이지가 있고 어디로 이동하는가
→ sidebar
→ route
→ active state
→ direct route / refresh
```

세부 기능은 각 티켓에서 담당한다.

```text
015 / 016
→ Sermon Session

025
→ Broadcast metadata/dashboard

027 / 031
→ Translation Session lifecycle/control

028
→ Safety Timer

032
→ Settings UI

033
→ Listener UX
```

---

## Acceptance Criteria

- `방송 / 설교 / 설정` 세 영역으로 이동할 수 있다.
- 새로고침과 직접 route 진입이 정상 동작한다.
- 현재 route에 맞는 sidebar active state가 표시된다.
- 기존 audio device, transcript download, settings 기능이 회귀하지 않는다.
- 페이지별 hook과 UI 책임이 적절히 분리된다.
- Translation Profile 페이지나 메뉴가 존재하지 않는다.
- Glossary 전용 페이지나 navigation이 존재하지 않는다.

---

## Tests

- route navigation
- sidebar active state
- direct route 진입
- page refresh
- 핵심 페이지 진입
- 기존 기능 regression

---

## 현재 구현 상태 체크

### 완료

```text
[x] /operator 기본 진입과 방송, 설교, 설정 route 구성
[x] Sidebar에 3개 영역 노출
[x] 현재 route에 active 표시
[x] 방송 영역의 Translation Session 제어
[x] 방송 영역의 상태 표시
[x] transcript 다운로드
[x] 설교 영역의 Sermon Session metadata 입력
[x] 설정 영역의 화면, 오디오, OpenAI 설정
[x] route navigation 테스트
[x] sidebar active state 테스트
[x] 직접 route 진입 및 새로고침 테스트
[x] 핵심 페이지 기존 기능 regression 검증
```

### 남은 작업

```text
[ ] 설정 영역에 Safety 설정 연결
```

---

## 최종 판단

030은 유지한다.

다만 현재 범위에서는 **Glossary를 완전히 제외**하고, Operator의 navigation 구조를 다음과 같이 고정한다.

```text
Operator
├── 방송
├── 설교
└── 설정
```

Glossary는 추후 별도 우선순위로 다시 검토한다.
