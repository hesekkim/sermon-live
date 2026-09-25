# 030 Operator navigation restructure

상태: 대기

## Goal

Operator UI를 `방송 / 설교 / 설정` 3개 영역으로 재구성한다.

## Why

실제 예배 운영 화면과 예배 전 준비 화면을 분리해야 Operator가 방송 중 필요한 상태를 빠르게 확인할 수 있다.

## Dependencies

015, 016, 021, 025

## Scope

- 기존 layout과 component를 최대한 재사용
- 방송: Translation Dashboard와 실시간 상태
- 설교: Sermon Session metadata와 Today's Sermon Glossary
- 설정: 화면, 오디오, OpenAI, Safety, Global Glossary
- Global Glossary는 Settings에, Today's Sermon Glossary는 Sermon에 둔다.
- Translation Profile 메뉴와 별도 페이지를 두지 않는다.
- Server ON/OFF를 주요 운영 버튼으로 노출하지 않고 Translation Session 제어를 중심으로 구성
- route와 sidebar label을 3개 영역에 맞게 정리

## Acceptance criteria

- 세 영역으로 이동할 수 있다.
- 새로고침과 직접 route 진입이 정상 동작한다.
- 기존 audio device, transcript download, settings 기능이 회귀하지 않는다.
- 페이지별 hook과 UI 책임이 분리된다.

## Tests

- route navigation
- sidebar active state
- 핵심 페이지 진입과 기존 기능 회귀
