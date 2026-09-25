# 032 Operator 설정 UI

상태: 완료

## Goal

일반 사용자가 소스코드나 `.env`를 수정하지 않고 Operator UI에서 변경 가능한 운영 설정을 관리한다.

## Why

개인용 프로그램이지만 개발자 전용 설정 방식으로 만들지 않는다. 예배 전 필요한 설정은 처음부터 화면에서 편집할 수 있어야 한다.

## Dependencies

```text
002, 009, 010, 011, 012, 013, 014, 028
```

> Glossary를 현재 우선 구현하지 않으므로 `019`, `021` dependency는 제외한다.

---

## Scope

### UI

- UI language
- Theme

### Audio

- Audio Input Device
- Audio status / input level
- Audio Test
- 사용자가 선택한 입력 장치의 상태 확인
- 입력 신호와 level 확인

### Safety

- Auto Stop
- Warning
- Extension
- Hard Limit

### OpenAI

- OpenAI API key 입력 및 저장 상태
- OpenAI model 설정
- API key 원문은 frontend state와 API 응답에 반환하지 않고 masked status만 표시

### 기타 원칙

- 오디오 포맷 변환, resampling, channel conversion은 backend 책임이며 사용자 설정으로 노출하지 않는다.
- 기술적 server/deployment 설정은 이 화면에 노출하지 않는다.
- Translation Profile CRUD/settings는 제공하지 않는다.
- Glossary 관련 설정이나 페이지는 현재 범위에 포함하지 않는다.

---

## Acceptance Criteria

- 설정을 저장하고 새로고침 후 조회할 수 있다.
- 숫자 설정의 범위와 상호 제약이 표시/검증된다.
- API key는 저장 상태만 확인할 수 있고 원문이 노출되지 않는다.
- Audio device 설정은 기존 선택 기능과 회귀 없이 동작한다.
- 사용자가 입력 장치를 선택하고 Audio Test와 input signal/level 상태를 확인할 수 있다.
- Translation Profile CRUD/settings가 노출되지 않는다.
- Glossary 관련 UI나 설정이 추가되지 않는다.

---

## Tests

- 설정 load/save
- timer validation
- secret masking과 저장 상태 표시
- Audio Test 요청과 audio status/input level 상태 연동
- Input Device 선택 및 저장/조회
