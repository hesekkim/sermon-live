# 002a Operator shell + Sidebar

상태: 완료

## 목표

기존 Admin 전용 사이드바를 shared `Sidebar`로 일반화하고, Operator의 두 화면이 동일한 레이아웃과 navigation을 사용하게 한다.

## 구현 범위

- `AdminSidebar`의 공통 동작을 `Sidebar`와 `SidebarItem` API로 이동
- `SidebarPanelIcon`을 접힘/펼침 토글에 사용
- `/operator`는 `/operator/broadcast`로 redirect
- `/operator/settings`, `/operator/broadcast` route 등록
- `OperatorLayout`에서 Sidebar, `<Outlet>`, theme wrapper 구성
- 접힘 상태를 `operatorSidebarCollapsed` localStorage key로 유지
- 1280px 미만에서는 Sidebar를 접고 input pane을 숨긴다. FHD에서는 사용자 토글 상태를 따른다.

## 수용 기준

- Sidebar item은 Settings와 Broadcast 두 개이며 active route가 표시된다.
- Broadcast가 상위로 올라가고 Settings는 그 아래에 있는다. 각각의 item 위에 적절한 라벨을 추가한다.
- Sidebar 접힘/펼침은 `SidebarPanelIcon`으로 동작하고 새로고침 후에도 유지된다.
- `/operator`와 하위 경로에서 shared Sidebar 외에 Admin 전용 컴포넌트를 참조하지 않는다.
- 1920px 화면에서 input/output 두 pane이 보이고, 좁은 데스크톱 화면에서는 output만 보인다.
- 일반적인 layout용 버튼에 Listen 전역 스타일이 적용되지 않는다.

## 검증

- `Push-Location frontend; npm run build; Pop-Location`
- FHD viewport에서 `/operator/settings`, `/operator/broadcast` 수동 확인

## 커밋 경계

라우팅, Sidebar 일반화, Operator layout/CSS만 포함한다. 설정 API와 transcript lifecycle은 포함하지 않는다.
