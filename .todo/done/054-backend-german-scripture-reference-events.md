# 054 독일어 장절 참조 감지와 정본 이벤트

상태: 완료
우선순위: 높음

## Goal

interpreter가 이미 생성한 독일어 output text에서 명시적인 성경 장절 참조만 감지해 Lutherbibel 1912 본문을 Listener에 별도 이벤트로 전달한다. 기존 OpenAI 번역문은 계속 정상 자막으로 보여주며 정본 lookup 결과로 대체하지 않는다.

## Product Rules

- `input_text`와 한국어 transcript는 사용하지 않는다. 검사 대상은 공용 `text`/`output_text` 이벤트의 독일어 output text뿐이다.
- 명시적인 reference가 없으면 scripture 이벤트를 만들지 않고 기존 번역만 그대로 통과시킨다.
- reference가 불완전하거나 모호하거나 corpus 조회에 실패하면 기존 번역만 표시한다. 문맥만으로 구절을 추측하지 않는다.
- 성경 구절 정본은 자막 전용 정보다. 기존 translation text, output audio/PCM, latency 측정 및 interpreter lifecycle은 변경하지 않는다.
- OpenAI 이름을 검사하는 vendor 분기를 SessionService나 BroadcastHub에 추가하지 않는다. 일반적인 interpreter output text를 다루는 공용 후처리 경계에 둔다.

## Reference Syntax

독일어로 실제 출력될 수 있는 표기를 지원한다. 최소 사례:

- `Epheser 2, die Verse acht und neun`
- `Römer 3, Vers 28`
- `Johannes 3,16`
- 공백/문장부호가 delta 경계에서 분리되거나 붙은 동일 표현
- `1. Johannes` 등 숫자가 포함된 책 이름과 일반적인 독일어 책 이름 별칭
- 장·절 숫자의 아라비아 숫자 및 자주 나오는 독일어 숫자 표현
- 단일 절과 명시적인 연속 절 범위

지원 문법과 alias 표는 정규화된 canon book code로 매핑한다. 테스트는 사용자가 제공한 첫 OpenAI 출력 사례와 이 문법을 근거로 한다. 자유 문장 안의 숫자, chapter만 언급된 경우, 책 이름 없이 나오는 절 숫자는 성경 reference로 간주하지 않는다.

## Streaming Behavior

- text delta가 책 이름/장/절 중간에서 끊길 수 있으므로 경계가 확인될 때까지 짧고 bounded한 rolling buffer를 사용한다.
- 전체 설교문을 기다리지 않는다. 일반 번역 자막 delta는 기존처럼 즉시 전송해 정상 문장 표시를 지연시키지 않는다.
- 완결된 reference가 최초로 인식된 시점에 corpus lookup을 하고 `scripture` 타입 이벤트를 보낸다. 발생한 각 reference에는 안정적인 ID 또는 offset/dedupe 정보를 적용해 같은 delta가 반복 처리되어 중복 popup이 생기지 않게 한다.
- 같은 장절을 설교자가 나중에 다시 말하면 새 mention으로 다시 이벤트를 보낸다.
- 범위는 요청한 절만 순서대로 합치고, 다른 절을 추정해서 덧붙이지 않는다.

## Event Contract

Listener WebSocket에 별도의 JSON 이벤트를 추가한다. 최소 필드:

- `type: "scripture"`
- 표준 book code, chapter, start/end verse 또는 canonical reference ID
- 사람이 읽을 독일어 reference label
- Lutherbibel 1912 verse text 또는 verse 배열
- edition/version label

이 이벤트는 일반 `{ "text": ... }` 자막 delta와 별개여야 하며 기존 public listener handshake/status allowlist를 우회해 Operator 설정이나 credential을 노출하면 안 된다. operator-only transcript로 보내지 않는다.

## Acceptance Criteria

- [ ] output text에 명시 reference가 있을 때만 정확한 corpus lookup 및 scripture 이벤트가 발생한다.
- [ ] reference가 여러 delta로 분리되어도 유실 없이 인식하며 delta join을 위해 전체 출력문을 버퍼링하지 않는다.
- [ ] 참조가 없는 일반 설교와 깨진/모호한 참조는 현재처럼 번역 자막만 보여준다.
- [ ] `input_text`는 parser에 전달되지 않는다.
- [ ] original output text와 모든 audio bytes, sample rate, 이벤트 순서는 바뀌지 않는다.
- [ ] 부분 event 중복 전송은 억제하지만 세션 내의 독립적인 반복 mention은 다시 전달한다.
- [ ] Echo 및 모든 `LiveInterpreter` 구현에 provider name 분기 없이 같은 공용 계약을 적용한다.
- [ ] lookup 실패가 interpreter error 또는 번역 세션 중단으로 이어지지 않는다.

## Tests

- backend unit: German book aliases, chapter/verse, range, number words, punctuation, chunk boundary와 incomplete input.
- backend unit: no reference, unknown book, invalid chapter/verse, ambiguous form은 event 미발행.
- backend unit: input text 무시, 일반 output text 전달 보존, output audio 전달 불변, 반복 mention dedupe.
- Backend 검증은 fake interpreter와 fake hub를 사용하고 실제 OpenAI endpoint/key를 호출하지 않는다.

## Dependencies

- `053-backend-luther1912-scripture-corpus.md`

## Related Tickets

- `055-frontend-listener-scripture-popup.md`

## 구현 결과

- 독일어 Bible book alias와 숫자/숫자 단어를 표준 book code 및 절 범위로 파싱한다. `Epheser2, die Verse acht und neun`, `Römer3, Vers28`, `Johannes3,16` 형식을 확인했다.
- output text에만 bounded rolling detector를 적용한다. 참조 없는 문장, input transcript, 오디오 PCM은 detector에 전달하지 않는다.
- 일반 번역 text와 operator transcript는 기존대로 보존하면서, corpus 조회에 성공한 명시 reference만 Listener 전용 `scripture` JSON 이벤트로 보낸다.
- 문장 종료 시 buffered reference를 flush하고, delta 중복은 막되 이후 독립된 같은 reference는 다시 보낸다.

## 검증 결과

- Parser의 범위·alias·chunk 경계·참조 없음 사례 및 SessionService 별도 이벤트 단위 테스트 통과.
- Backend 전체 `tests/unit`: 147 passed
- 실제 OpenAI 호출 없이 mock/fake interpreter와 VPL 리소스로 검증했다. 실제 계정·LAN 확인은 008 후속 체크에 남긴다.