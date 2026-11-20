# 082 Cloud Relay 복구, 보안 및 부하 검증

상태: 대기
우선순위: 높음

## Goal

Local Publisher, Berlin relay, Vercel Listener를 연결한 실제 cloud 흐름의 복구·접근제어·메모리/CPU·Render egress를 검증하고 운영 가능한 청중 규모를 제시한다.

## Depends on

- `.todo/078-berlin-live-relay-websocket.md`
- `.todo/079-local-cloud-publisher-and-opus-encoding.md`
- `.todo/080-operator-cloud-broadcast-controls.md`
- `.todo/081-vercel-listener-cloud-playback.md`

## Scope

- 세션 시작부터 청중 인증, compressed audio/text playback, reconnect, 정상/오류 종료까지 자동화 가능한 E2E 흐름을 검증한다.
- 느린 Listener, 갑작스러운 네트워크 단절, Publisher 재연결, Render deploy/restart, 잘못된 비밀번호, token 만료, session 종료, Origin 오류를 검증한다.
- 동시 Listener 수를 단계적으로 늘려 Berlin CPU/RAM, event loop 지연, 송신 queue, 오디오 bitrate, bytes per listener-hour, reconnect behavior를 수집한다.
- Render Starter의 실제 사양(0.5 CPU/512 MB) 및 account/workspace egress 포함량에 맞춰 작은 규모부터 시험한다. 자동 테스트가 Render 유료 리소스를 무제한 생성하지 않게 한다.
- 개인정보/음성 내용을 기록하지 않고 집계 가능한 연결·오류·대역폭 metadata만 계측한다.
- 대시보드에서 Render outbound bandwidth와 CPU/RAM을 관찰하는 절차 및 예상 사용량 계산식을 남긴다.
- 첫 운영 대상의 최대 권장 청중 수와 동시 방송 수를 측정 결과에 근거해 정한다. 제한이 필요한 경우 설정 가능한 상한과 사용자 오류 안내를 추가한다.

## Out of scope

- 측정 전부터 특정 큰 동시 청중 수나 SLA를 보장하는 것
- Redis/다중 instance로 수평 확장 (현행 단일 instance에서 한계를 확인한 뒤 별도 결정)
- 실제 회중의 원음 또는 개인 정보 저장

## Acceptance criteria

- [ ] E2E가 인증된 청중에게만 해당 session의 자막/압축 오디오가 전달되는지 검증한다.
- [ ] 중단/재시작 후 자동 재연결과 종료/만료 동작이 정의되고, stale session 및 queue leak이 없다.
- [ ] queue, connection, payload 및 session 수 제한에서 과부하가 명시적으로 거부/회복되고 기존 CMS 응답성이 유지된다.
- [ ] 압축 bitrate와 listener-hour egress가 측정되며 PCM baseline 추정 대비 실제 절감률을 보고한다.
- [ ] Starter 실제 환경에서 단계별 동시 Listener 부하를 측정하고 CPU, 메모리, 지연, 오류율, 권장 상한을 기록한다.
- [ ] Hobby/Pro workspace egress included amount 및 overage 적용 방식을 운영자가 대시보드에서 확인할 수 있다.
- [ ] 비용 발생 테스트는 시작 전 목표 사용자 수·시간·예상 GB를 명시하고 승인된 범위에서만 실행한다.
- [ ] 테스트 및 로그에 실제 음성 payload, 비밀번호, token, API key가 저장되지 않는다.

## Tests and verification

- CI에서는 fake relay/load를 이용한 bounded test만 실행한다.
- 실제 Render 부하 검증은 제한된 시간/동시 접속으로 별도 수행하며 대시보드 수치와 함께 기록한다.
- 실제 OpenAI API는 사용하지 않고 합성 오디오나 승인된 test fixture를 사용한다.
