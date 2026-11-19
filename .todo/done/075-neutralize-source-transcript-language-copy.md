# 075 Source transcript 언어 하드코딩 제거

상태: 완료
우선순위: 보통

## 착수 시점

074 출력 언어 설정과 Listener UI 연동이 완료된 뒤 별도 작업으로 진행한다. 074 구현에 포함하거나 범위를 넓히지 않는다.

## Goal

Input/source transcript의 표시 문구가 한국어를 고정 언어로 가정하지 않도록 정리한다. 현재 provider 설정은 입력 언어를 지정하지 않으므로, UI가 특정 source 언어를 보장하는 것처럼 표현하지 않는다.

## Current behavior

- Realtime Translation adapter는 `session.input_transcript.delta`를 input transcript 이벤트로 전달할 수 있다.
- Operator transcript UI와 다운로드 텍스트는 입력 transcript를 Korean으로 표시한다.
- API 오류 메시지와 비활성화된 input-transcript 설정 설명에도 Korean source 가정이 들어 있다.
- Input transcript 설정은 현재 비활성화되어 있다. 이 티켓은 해당 기능을 활성화하지 않는다.

## Scope

- Operator의 input transcript 제목, 다운로드 이름/헤더, 빈 상태 문구에서 Korean 고정 표현을 제거한다.
- `input_transcript_enabled` 설정 설명과 비활성화 안내를 특정 입력 언어를 약속하지 않는 표현으로 정리한다.
- API에서 input transcript 활성화를 거부하는 오류를 언어 중립적으로 바꾸고 관련 테스트를 갱신한다.
- 문서에서 Korean source를 현재 고정 동작으로 서술하는 부분을 실제 동작에 맞게 고친다.
- 한국어/영어/독일어 UI locale 각각에 일관된 언어 중립 표현을 추가한다.

## Out of scope

- 입력 언어를 Operator Settings에서 선택하거나 provider에 지정하는 기능
- Input transcript 기능 활성화 또는 비용 정책 변경
- 출력 언어 설정 및 Listener 출력 언어 UI (074에서 처리)
- transcript 이벤트 처리 파이프라인 변경. 별도 결함이 확인되면 범위를 분리한다.

## Implementation notes

- 입력 언어는 앱에서 고정하거나 사용자 설정으로 지정하지 않는다. 따라서 UI 문구는 `Input transcript` / `Source transcript`처럼 언어 중립적으로 표현한다.
- 기존 input transcript 활성화 거부 동작과 기본 비활성 상태는 보존한다.
- 이 티켓에서는 transcript 본문을 언어 감지해 제목이나 파일명에 자동 반영하지 않는다.
- Provider별 payload나 분기는 추가하지 않는다.

## Acceptance criteria

- [x] Operator input transcript 제목, 빈 상태, 다운로드 헤더 및 안내에 Korean을 고정하는 표현이 없다.
- [x] input transcript 설정이 비활성인 상태와 활성화 요청 거부 동작이 유지된다.
- [x] 거부 응답 및 관련 안내가 특정 입력 언어를 가정하지 않는다.
- [x] `ko`, `en`, `de` UI locale에서 source transcript 관련 문구가 모두 일관되게 표시된다.
- [x] 현재 입력 언어가 설정되거나 강제된 것처럼 UI/문서가 오해를 만들지 않는다.

## Tests and verification

### Backend unit

- Input transcript 활성화 요청이 기존과 같이 거부되는지, 응답 문구에 특정 언어 하드코딩이 없는지 검증한다.
- 상태 응답에서 input transcript가 비활성으로 유지되는지 확인한다.

### Frontend unit

- Transcript pane과 다운로드 결과에서 Input/Source transcript의 언어 중립 라벨을 검증한다.
- 비활성화된 input transcript 설정이 계속 비활성이고, 안내 문구가 세 UI locale에서 제공되는지 검증한다.

## 구현 및 검증 결과

- Transcript 제목, 빈 상태, 다운로드 라벨과 설정 안내를 한국어·영어·독일어 모두 언어 중립적으로 변경했다. 다운로드 파일명은 이미 중립적이어서 유지했다.
- API의 input transcript 활성화 거부와 비활성 기본값은 유지하고, 오류 문구만 언어 중립적으로 변경했다.
- Backend Operator API 테스트 16개 통과.
- Frontend 관련 테스트 21개 통과, production build 성공.
- `git diff --check` 통과.

