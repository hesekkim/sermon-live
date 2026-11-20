# 076 Cloud Listener 중계 계약과 오디오 코덱 결정

상태: 대기
우선순위: 높음

## Goal

Local PC의 Sermon Live가 Berlin Saenuree Render backend로 보내고, Vercel Listener가 받아 재생할 실시간 계약을 정한다. Render public egress를 낮추기 위해 압축 오디오를 필수로 하며, 구현 전에 코덱과 인코더/디코더 배포 방식을 검증한다.

## Scope

- 송신자, Listener, Berlin relay의 책임과 연결 방향을 정의한다. Operator와 OpenAI Translation Session은 Local PC에 유지하고, Listener UI는 Vercel에서 정적으로 제공하며 실시간 데이터는 Berlin backend에서 받는다.
- 제어 메시지와 바이너리 오디오 framing, 코덱 식별, sample rate, sequence/timestamp, 자막·상태 이벤트, session identity를 정한다.
- OpenAI Translation 출력 PCM을 Local PC에서 압축한 뒤 Render로 보낸다. Berlin은 가능하면 오디오를 디코드/재인코드하지 않고 검증된 압축 프레임을 fan-out한다.
- Opus 기반 후보를 우선 검증한다. Windows/macOS 패키지에 인코더를 포함할 수 있는지, Vercel Listener가 지원 브라우저에서 안정적으로 저지연 디코딩할 수 있는지 확인한다. 브라우저 기본 API가 불충분하면 유지보수 가능한 WASM 디코더 대안을 평가한다.
- 음성 명료도, 종단 지연, CPU 사용량, 실제 wire bitrate를 PCM baseline과 비교한다. 초기 청취 부하에서 지속 bitrate 목표는 64 kbit/s 이하를 목표로 삼고, 명료도가 부족하면 측정 근거를 기록해 조정한다.
- 기존 LAN Listener 경로를 유지할지, cloud relay로 전환할지와 설정/마이그레이션 UX를 결정한다.

## Out of scope

- 실제 Berlin relay, Operator UI 또는 Listener 기능 구현
- OpenAI API 실호출 및 실제 API key 사용
- 미검증 브라우저/기기에서 코덱 동작을 보장하는 것

## Acceptance criteria

- [ ] JSON 제어 이벤트와 binary audio frame 계약 및 오류/종료 동작이 기록되어 후속 티켓이 그대로 구현에 사용할 수 있다.
- [ ] 지원 대상 Windows/macOS와 청중 브라우저에서 사용할 Opus encoder/decoder 조합을 결정하고, 선택하지 않은 후보의 사유를 남긴다.
- [ ] 실제 인코딩/디코딩 spike에서 샘플 오디오의 손실·깨짐 없이 연속 재생, 측정 bitrate, 지연, CPU 비용을 확인한다.
- [ ] 최종 오디오 framing은 패킷 경계를 보존하고, 혼합 session이나 codec mismatch를 감지할 수 있다.
- [ ] PCM 24 kHz/mono/16-bit(약 384 kbit/s) baseline과 압축 결과를 동일한 조건으로 비교한다.
- [ ] LAN Listener 유지/전환 정책을 명시하고 README의 cloud 목표 상태와 모순되지 않는다.

## Tests and verification

- 코덱 spike는 합성 음성 또는 배포 가능한 테스트 샘플을 사용하고 실제 마이크/API key를 요구하지 않는다.
- 시간, bitrate, decoder error, encoder/decoder CPU를 측정하되 오디오 payload나 음성 내용을 로그에 남기지 않는다.
- 패키징 검증이 필요한 경우 Windows와 macOS 각각에서 native dependency를 로드하고, 깨끗한 패키지 환경에서 테스트한다.

## Depends on

- 없음
