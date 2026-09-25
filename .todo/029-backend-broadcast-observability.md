# 029 Broadcast 상태 이벤트 계약

상태: 대기

## Goal

Operator와 Listener가 실시간 운영 상태를 일관되게 표시할 수 있도록 broadcast event schema와 측정 책임을 정의한다.

## Why

현재 audio level, session status, latency, interpreter connection, listener count가 서로 다른 흐름으로 추가될 가능성이 있다. 상태 계약을 먼저 고정해야 UI가 vendor-specific 분기를 만들지 않는다.

## Dependencies

011, 027

## Scope

- `server_status`, `translation_status`, `audio_status`, `audio_level`, `latency`, `listener_count`, `connection`, `error`, `session_ended` 이벤트 정의
- translation data events (`source_text`, `translated_text`, `audio`)와 operational status/control events를 분리하고 각 소유 계층을 명시
- input signal과 interpreter connection을 분리
- listener 수 집계와 접속/해제 시점 정의
- latency 측정 기준을 오디오 청크 전송부터 자막 수신까지로 명시
- reconnect/error 상태의 공통 payload 정의
- OpenAI vendor payload는 adapter 밖으로 노출하지 않음

## Acceptance criteria

- Operator와 Listener가 같은 session/connection 상태 계약을 사용한다.
- audio level은 throttle된 값으로 전달된다.
- listener count가 접속과 해제에 따라 갱신된다.
- 오류와 종료 reason이 공통 필드로 전달된다.
- source/translated text와 audio payload가 상태/오류/종료 이벤트와 혼합되지 않는다.
- event payload가 backend unit test로 검증된다.

## Tests

- event schema validation
- source/translated data event와 status event의 schema 및 책임 구분
- level throttle과 listener count
- latency와 connection/error 이벤트

## Risks

- latency는 AI 처리 지연과 browser playback 지연을 모두 의미하지 않으므로 측정 범위를 UI에 명시해야 한다.
