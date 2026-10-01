# 053 Luther 1912 성경 본문 리소스와 메모리 조회

상태: 완료
우선순위: 높음

## Goal

eBible.org에서 받은 Lutherbibel 1912 VPL XML을 프로젝트의 읽기 전용 성경 본문 리소스로 편입하고, backend가 책·장·절 참조로 정본 본문을 빠르게 조회하게 한다.

운영 중 DB를 추가하지 않는다. XML은 애플리케이션 시작 시 한 번 파싱하고, 정규화된 `(book, chapter, verse)` 키의 메모리 딕셔너리로 보관한다. 세션 중 조회에서는 파일 I/O, XML parsing, 외부 네트워크 요청을 하지 않는다.

## Context

- 사용자는 독일어 성경 장절 참조가 OpenAI 출력에 나타난 경우만 정본 본문을 보여주길 원한다.
- 장절 참조가 없으면 기존 OpenAI 독일어 번역만 표시한다.
- 자막에만 정본을 추가하며 interpreter 출력, 번역 텍스트, 생성 음성은 교체하거나 수정하지 않는다.
- 첨부된 `deu1912_vpl` 자료는 `deu1912_vpl.xml`, `deu1912_vpl.txt`, `deu1912_vpl.sql`, `deu1912_about.htm`로 구성된다. XML은 `<v b="GEN" c="1" v="1">...</v>`처럼 verse 단위 book/chapter/verse 속성을 제공한다.
- `deu1912_about.htm`은 Bible text only와 Public Domain 상태를 표시한다. 앱에 포함할 때 판본명, 원 출처, 라이선스 표기, 조회 날짜/리비전을 함께 보존한다.

## Scope

- 첨부 XML을 `backend/data/scripture/`의 명확한 리소스 경로에 추가한다.
- 필요하면 자료 출처, 판본, Public Domain 표기, 배포 URL, 원 archive 날짜를 담은 짧은 metadata 파일을 함께 둔다.
- VPL XML을 표준 XML parser로 읽는다. SQL dump를 실행하거나 DB dependency를 추가하지 않는다.
- verse key는 source book code와 숫자 chapter/verse로 안정적으로 표준화한다. UI용 독일어 책 이름/표기는 lookup key에 섞지 않는다.
- 범위 참조는 개별 절을 canon order대로 조회하고, popup에 전달할 수 있는 본문과 reference를 반환한다.
- 로딩은 한 프로세스에서 한 번만 한다. 조회 함수는 불변 또는 읽기 전용 index를 재사용한다.
- corpus 로딩 실패가 sermon-live의 기본 실시간 번역을 막지 않도록 scripture 기능만 비활성화하고, 안전한 경고를 기록한다. Bible text 전문을 로그에 남기지 않는다.

## Out of Scope

- OpenAI 번역문과 정본 본문을 비교하거나 번역문을 자동 교정하는 기능.
- 한국어 input transcript 활성화, 입력 오디오 분석, reference 없는 구절 추정.
- SQL/MySQL 운영 DB, 서버 외부 API 조회, 관리자 UI를 통한 verse 편집.
- TTS 또는 OpenAI generated audio 수정.
- Luther 1912 본문을 대량 인용하는 문서/테스트 fixture 생성.

## Implementation Notes

- `xml.etree.ElementTree` 등 표준 XML API를 사용한다. 정규식으로 XML을 파싱하지 않는다.
- 공백만 정리하고 verse text의 구두점, 철자, 대소문자 및 의미 있는 내부 공백은 임의 교정하지 않는다.
- 조회 계약은 `get_verses(book_code, chapter, start_verse, end_verse)`와 같이 순수하고 결정적으로 테스트할 수 있게 한다. 범위의 시작/끝이 장 밖이거나 실제 데이터에 없는 경우는 명시적인 miss로 다룬다.
- XML 리소스 전체를 repo에 둘지, 원본 XML과 생성된 JSON을 같이 두는지는 중복 저장과 시작 비용을 비교해 최소 파일로 결정한다. 런타임 기준은 한 번 읽은 메모리 index이며 request-time JSON/XML 파싱은 금지한다.
- metadata에는 eBible.org가 제공한 판본 표기와 배포 조건을 기록한다. `deu1912_about.htm`의 Public Domain 표기를 보존하되, 자료 제공처의 개별 조건과 적용 지역을 확인하지 않은 추가 권리 주장은 쓰지 않는다.

## Acceptance Criteria

- [ ] Luther 1912 전체 corpus가 알려진 verse key로 조회되며 빈 결과나 중복 key가 없다.
- [ ] `GEN 1:1`, `GEN 1:2`와 범위 `GEN 1:1-3`의 결과가 XML과 일치한다.
- [ ] loader는 application process에서 한 번만 동작하고 이후 lookup은 메모리 index만 사용한다.
- [ ] SQL 파일을 실행하지 않으며 DB나 새 외부 package를 추가하지 않는다.
- [ ] 잘못된 key, 없는 책/장/절, 역전된 범위는 예외 누출 없이 명시적인 miss/validation 결과가 된다.
- [ ] 리소스 누락/손상으로 scripture lookup이 불가능해도 OpenAI 번역, Listen text, audio flow는 계속 동작한다.
- [ ] 출처, 판본, 라이선스 표기와 리소스 갱신 기준을 코드/metadata에서 확인할 수 있다.

## Tests

- backend unit: VPL parser가 verse attributes를 정확히 읽고 key/index를 만든다.
- backend unit: 단일 verse, 여러 verse range, 존재하지 않는 key, 잘못된 범위를 확인한다.
- backend unit: loader의 재사용 및 corrupt/missing resource graceful-degrade를 확인한다.
- 실제 OpenAI 호출, 실제 마이크, 모든 구절의 본문 문자열을 반복하는 테스트는 두지 않는다.

## Dependencies

- Lutherbibel 1912를 정본 판본으로 사용한다는 제품 결정.
- 사용자 제공 eBible VPL archive 및 `deu1912_about.htm` metadata.

## Related Tickets

- `054-backend-german-scripture-reference-events.md`
- `055-frontend-listener-scripture-popup.md`

## 구현 결과

- 사용자 제공 VPL XML을 `backend/data/scripture/deu1912_vpl.xml`에 추가하고 출처·판본·라이선스 표기를 README에 기록했다.
- 표준 XML streaming parser로 31,102개 구절을 읽어 `(book, chapter, verse)` 메모리 index를 만든다. 프로세스 내 singleton loader를 사용하고 SQL 파일이나 DB dependency는 추가하지 않았다.
- 누락/손상/중복 리소스는 corpus 기능만 비활성화하며 실시간 번역 세션의 시작을 막지 않는다.
- Luther 1912에서 확인된 범위 밖 철자/내용 교정은 하지 않는다.
- Genesis 2:19와 3:12의 샘플 문구를 eBible 모바일 HTML과 대조했다. VPL과 동일하므로 원문을 보존하고 임의 교정하지 않는다.

## 검증 결과

- `backend/.venv/Scripts/python.exe -m pytest tests/unit/test_scripture.py tests/unit/test_session_events.py -q`: 10 passed
- Backend 전체 `tests/unit`: 147 passed
