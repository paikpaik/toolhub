# toolhub 개발 문서

사용법은 [README](../README.md)를 보세요. 이 문서는 구조, 명령, 테스트, 데이터 형식, 내부 동작을 다룹니다.

## 구조

npm workspaces 모노레포입니다. Node 24가 TypeScript를 바로 실행하므로 빌드 단계가 없고, `tsc`는 타입 검사에만 씁니다.

```
toolhub/
├── packages/collector/   # 키워드 수집·저장·네이버 API·브리프·초안 (웹·CLI·MCP 공용)
│   └── src/
│       ├── sources.ts         # 실시간 키워드 소스 (Google Trends RSS, 네이트, signal.bz)
│       ├── storage.ts         # 날짜별 파일 저장·병합, 기간 집계
│       ├── collect.ts         # 수집 → 기록 → 검색량 채우기
│       ├── naver-searchad.ts  # 네이버 검색광고 API (검색량·경쟁도·연관 키워드)
│       ├── naver-hub.ts       # NAVER API HUB (검색어 트렌드·쇼핑 인사이트·블로그/지식iN/뉴스/카페/지역 검색)
│       ├── research.ts        # 추이 해석·포화도·시즌 알림 날짜·키워드 조사 묶음
│       ├── batch.ts           # 키워드 여러 개 묶음 분석 (목록 정리·표) — MCP analyze_keywords
│       ├── discover.ts        # 주제로 키워드 찾기 (후보 고르기·추천·최근 주제) — 웹 키워드 찾기, MCP discover_keywords
│       ├── brief.ts           # 글쓰기 브리프·글감 브리핑 생성
│       ├── platforms.ts       # 플랫폼·글 유형·구성 변형 (브라우저에서도 사용)
│       ├── drafts.ts          # 초안 목록·파싱·고치기
│       ├── image-prompt.ts    # 초안 → Gemini용 이미지 6장 요청문
│       ├── cli.ts             # npm run collect
│       └── brief-cli.ts       # npm run brief
├── packages/insta/       # 인스타그램 (웹·MCP 공용, 브라우저에서도 사용)
│   └── src/
│       ├── hooks.ts           # 릴스 훅 공식 26가지
│       ├── reel.ts            # 대본 → 초 단위 구성표(한국어 음절 기준), 훅 점검
│       └── caption.ts         # 캡션 점검 (해시태그 5개·링크·요청·쿠팡 대가성 문구·검색어)
├── packages/tasks/       # 일정 관리 (웹·MCP 공용)
│   └── src/
│       ├── model.ts           # 할 일 모델, 날짜·반복 계산, 자연어 빠른 추가 해석 (브라우저에서도 사용)
│       ├── store.ts           # data/tasks.json 읽기·쓰기
│       ├── chunks.ts          # 덩어리 기록 모델: 하루 2덩어리·주간 목표·그룹, 덩어리 → 주간 카드 맞추기 (브라우저에서도 사용)
│       ├── chunks-store.ts    # data/chunks.json 읽기·쓰기 (문서 단위)
│       └── lock.ts            # 잠금 파일로 웹·MCP 동시 쓰기 보호, 임시 파일 후 바꿔치기 저장
├── packages/mcp/         # MCP 서버 (Claude 데스크톱 앱·Claude Code)
│   └── src/
│       ├── server.ts          # 블로그 도구·프롬프트
│       ├── tasks-tools.ts     # 일정 도구
│       └── web.ts             # open_web / stop_web (main 커밋으로 웹 실행)
├── apps/web/             # Next.js 16 로컬 웹
│   ├── app/
│   │   ├── layout.tsx, sidebar.tsx, icons.tsx  # 사이드바 레이아웃 (icon.svg: 브라우저 탭 아이콘)
│   │   ├── add-task-popover.tsx  # 블로그 화면의 "할 일로 추가"
│   │   ├── tasks/             # 일정 관리 (목록·보드·캘린더·상세 패널·빠른 추가)
│   │   ├── blog/              # 블로그 (page.tsx 실시간, discover, history, keyword, drafts, schedule, thumbnail, guide)
│   │   │   └── guide/content.ts   # 작성 가이드 내용 (플랫폼별 발행 순서·수익·품질)
│   │   └── api/               # tasks, projects, brief, stats/enrich, health
│   └── lib/                   # 데이터 경로, 입력 검증, 미리보기, 예약 발행 시간, 검색량 백그라운드 채우기
├── extension/            # 크롬 확장 (빌드 없음, 일반 JS). 네이버 에디터 드래그 서식 + 이미지 모음 사이드 패널
│   ├── lib.js                 # 색·설정·이미지 모음(data URL·중복·파일 이름) 순수 함수 (테스트 대상)
│   ├── naver-editor.js        # 스마트에디터 ONE 버튼 위치(SELECTORS)와 조작·진단
│   ├── content.js             # 서식 묶음 버튼: 항상 뜨는 서식 도구·단축키·드래그 막대 (Shadow DOM)
│   ├── content-ai.js          # Gemini·ChatGPT·AI Studio에서 새 생성 이미지를 패널로 자동 전송
│   ├── sidepanel.*            # 이미지 모음 패널 (붙여넣기·끌어다 놓기·복사·저장) + 설정·진단 정보 복사 링크
│   ├── background.js          # 아이콘 클릭 → 사이드 패널, 오른쪽 클릭 "toolhub 패널에 담기"
│   ├── options.*              # 서식 설정 (storage.sync)
│   └── icons/                 # 확장 아이콘 (apps/web/app/icon.svg를 PNG로 뽑은 것)
├── docs/prompts/         # 글감 선정·초안 작성 프롬프트 (claude.ai 프로젝트·MCP·/blog-draft 공용)
│   └── instagram/             # 인스타 규칙: account(내 계정) · reel · caption · carousel · story · comment · repurpose
└── .claude/skills/       # Claude Code 스킬 (/blog-draft)
```

## 명령

| 명령 | 설명 |
|---|---|
| `npm run web` | 개발 서버 (http://localhost:3000, 작업 중인 코드) |
| `npm run collect` | 터미널에서 실시간 키워드 수집·기록 (`-- --sources google,nate`로 일부만) |
| `npm run --silent brief -- "키워드" --platform tistory --type info [--structure A]` | 글쓰기 브리프 출력 |
| `npm run typecheck` | 전체 타입 검사 |
| `npm test` | 자동 테스트 (Node 기본 `node:test`) |
| `npm run check` | 타입 검사 + 테스트. **커밋 전에 실행** |

## 버전

toolhub 전체가 하나의 버전(`1.0.0` 형식)을 씁니다. 올릴 때는 루트 `package.json`과 각 패키지(`packages/*`, `apps/web`)의 `package.json`, `extension/manifest.json`을 같은 번호로 고칩니다. 하나라도 다르면 `packages/mcp/src/version.test.ts`가 실패합니다.

- 웹 사이드바에 `v버전`이 보이고, `open_web`으로 띄운 웹은 실행 중인 커밋(`· abc1234`)도 함께 보입니다. `/api/health`도 버전을 돌려줍니다.
- MCP 서버는 루트 `package.json`의 버전으로 자신을 알립니다.
- 크롬 확장은 `chrome://extensions`에 같은 번호가 보입니다.
- 기능이 늘면 가운데 자리, 고치기만 하면 끝자리를 올립니다. 쓰는 방법이 크게 바뀌면(데이터 형식·설정이 바뀌어 옮겨야 할 때) 앞자리를 올립니다.
- toolhub는 MIT 라이선스입니다 (`LICENSE`).

## 테스트

외부 API를 부르지 않는 핵심 로직을 테스트합니다. 테스트 파일은 대상 파일 옆에 `*.test.ts`로 둡니다. 기능을 고치거나 버그를 찾으면 그 경우를 테스트에 추가하세요.

| 위치 | 테스트하는 것 |
|---|---|
| `packages/tasks` | 자연어 빠른 추가 해석, 날짜·반복 계산, 월요일 시작 6주 달력·달 옮기기, 보기·그룹·정렬, 저장소(반복 완료·프로젝트 삭제·여러 프로세스 동시 쓰기), 덩어리 기록(하루 끝 시각·월요일 주, 덩어리 → 주간 카드·연결된 목표 완료, `#그룹 @요일` 해석, 다음 주로, 칸 추가·삭제와 자동 카드 번호, 자동 카드 수정이 덩어리로 반영, 그룹 칸에 놓아도 요일 유지, 목표 이름 고치기, 예전 문서 모양 읽기, 그룹 삭제 시 목표 옮기기, 문서 정리·id 검증) |
| `packages/collector` | 추이 해석·포화도·시즌 알림 날짜, 묶음 분석의 키워드 목록 정리·정렬·표, 브리프·글감 브리핑 형식, 초안 파싱·도입 문장·고치기(백업·경로 차단), 초안 상태(예약 시각 지나면 발행됨·주소 검증·고치기·지식iN 답변 기록·이전·다음 초안 찾기·상태 파일 동시 쓰기·경로 차단), 지식iN 답변 요청문(본문 텍스트화·질문 본문/요약·주소 자리·규칙), 키워드 병합·기간 집계 |
| `apps/web/lib` | 할 일 수정 요청 검증, 초안 미리보기(네이버 표 블록 포함), 네이버 서식 포함 복사 HTML(기호 제거·소제목·강조·표·이스케이프), 예약 발행 시간 뽑기(개수·10분 단위·첫 예약부터 기준 시각 뒤로 간격 안·간격 바꾸기·다음 날 표시), 기억 시간이 있는 캐시(시간 안·지난 뒤·다시 넣기·지우기) |
| `packages/insta` | 훅 공식 26개 형식, 음절 어림, 구성표(긴 줄 나누기·훅 3초·장면 4초·구체성·되감기·목표 길이), 훅 점검, 캡션 점검(한글 해시태그·링크·요청·대가성 문구·검색어) |
| `extension` | 색 해석, 팔레트에서 가장 가까운 색 고르기, 설정 병합, 이미지 모음의 data URL 변환·중복 제거(원래 주소 포함)·자동 담기 크기 기준·파일 이름 (`*.test.js`) |

## 환경변수

`apps/web/.env.local`에 둡니다 (git 제외, 템플릿은 `.env.example`). MCP와 CLI도 이 파일을 읽습니다.

| 변수 | 용도 |
|---|---|
| `NAVER_SEARCHAD_API_KEY`, `NAVER_SEARCHAD_SECRET_KEY`, `NAVER_SEARCHAD_CUSTOMER_ID` | 네이버 검색광고 API |
| `NAVER_API_HUB_CLIENT_ID`, `NAVER_API_HUB_CLIENT_SECRET` | NAVER API HUB |
| `TOOLHUB_DATA_DIR` | 데이터 폴더 (기본: 저장소의 `data/`) |
| `TOOLHUB_DRAFTS_DIR` | 초안 폴더 (기본: 저장소의 `drafts/`) |
| `TOOLHUB_WEB_PORT` | `open_web`이 쓰는 포트 (기본 3100, MCP 설정의 `env`에 지정) |
| `TOOLHUB_RUNTIME_DIR` | `open_web` 실행 폴더 (기본 `~/.toolhub/runtime/toolhub`) |

## 데이터 형식

### 키워드 기록 `data/YYYY-MM-DD.json`

하루에 파일 하나, 키워드당 한 줄. 수집할 때마다 처음 보는 키워드만 추가됩니다(공백·구두점·대소문자 무시).

| 필드 | 설명 |
|---|---|
| `keyword` | 키워드 |
| `sources` | 잡힌 소스 (`google`, `nate`, `signal`) |
| `firstSeen` | 처음 본 시각 (KST HH:mm) |
| `bestRank` | 그날 최고 순위 |
| `maxTraffic` | 구글 트렌드 검색량 (대략값) |
| `related`, `url` | 관련 뉴스 제목과 링크 |
| `stats` | 네이버 검색광고 검색량·경쟁도. 아직 조회하지 않았으면 필드가 없고, 데이터가 없으면 `null` |

### 최근 주제 `data/discover-topics.json`

키워드 찾기에서 조회에 성공한 주제 입력(예: `"캠핑, 연말정산"`)을 최신순으로 최대 8개 담은 문자열 배열. 웹·MCP가 함께 씁니다.

### 일정 `data/tasks.json`

`{ nextId, tasks, projects }`. 할 일은 `id`(번호), `title`, `notes`, `status`(todo·in_progress·done·canceled), `priority`(0 없음·1 긴급·2 높음·3 보통·4 낮음), `dueDate`, `dueTime`, `projectId`, `labels`, `repeat`(daily·weekly·monthly·yearly), `subtasks`, `link`, `createdAt`, `updatedAt`, `completedAt`.

웹과 MCP는 서로 다른 프로세스에서 이 파일을 고치므로 `tasks.json.lock` 잠금 파일로 읽기-수정-쓰기를 순서대로 처리합니다(`lock.ts`). 10초 넘은 잠금은 비정상 종료로 보고 풉니다.

### 덩어리 기록 `data/chunks.json`

"문서 id → 데이터" 객체입니다. 문서는 세 종류이고 자세한 필드는 `packages/tasks/src/chunks.ts` 맨 위 주석에 있습니다.
- `YYYY-MM-DD`: 그날의 덩어리 칸 `{ chunks: [{ done, note, group, link }] }` (완료·메모·그룹 id·연결된 목표 id). 화면은 기본 2칸(`BASE_CHUNKS`)을 늘 보여 주고 최대 6칸(`MAX_CHUNKS`)까지 늘립니다. 처음 모양 `{ b1, b2, n1, n2, g1, g2, l1, l2 }`도 읽고, 그날을 고치면 새 모양으로 저장합니다.
- `w-<월요일 날짜>`: 그 주 목표 `{ goals: [{ id, t, g, d, done }] }`. `d`는 0~6(월~일), -1은 요일 미배정입니다.
- `cfg`: 설정 `{ groups: [{ id, name, c }], dayEnd }`. `c`는 `GROUP_COLORS` 번호, `dayEnd`는 하루가 끝나는 시각(0=자정 ~ 8시, 그 전까지는 전날 기록)입니다. 이 문서가 없으면 공방·집·SNS와 자정을 씁니다.

화면은 바뀐 문서만 `PUT /api/chunks/<id>`로 통째로 저장합니다(메모는 입력이 0.7초 멈추면 저장). 덩어리에 메모와 그룹이 모두 있으면 그 주 요일 칸에 `c-<날짜>-<칸 번호>` 카드가 자동으로 생깁니다. 가운데 칸을 지우면 뒤 칸 번호가 당겨지므로 최대 칸 수까지 모든 자동 카드를 다시 맞춥니다. 자동 카드는 그날 덩어리와 짝이라 `updateGoal`·`removeGoal`이 카드 대신 덩어리 칸을 고칩니다(이름→메모, 그룹, 완료; 삭제는 그룹 비우기). 요일 변경·다음 주로는 무시합니다. 제안서(Claude 아티팩트) 시절에 쓰던 기록도 문서 모양이 같아서 이 파일에 그대로 넣으면 됩니다.

### 초안 `drafts/YYYY-MM-DD-<키워드>-<플랫폼>[-n].md`

내용 형식은 `docs/prompts/writing.md`의 "출력 형식"(`## 제목 후보`, `## 메타 설명`, `## 태그`, `## 본문`(코드 블록), `## 스레드 홍보글` 등)을 따릅니다. `update_draft`로 고치면 이전 버전이 `drafts/.history/`에 남습니다.

**분량 (`draft-length.ts`)**: 모델은 글자 수를 세지 못하고 범위만 주면 최소에 맞춰 써서(2026-11-03 네이버 초안 16개 중 15개가 1,466~1,648자), 플랫폼 규칙에 범위 가운데의 목표와 소제목별 배분을 두고(`BODY_LENGTH`, `platforms/*.md`와 같게 유지), 저장할 때 실제 글자 수를 잽니다. `bodyLength`는 공백 포함, 줄바꿈·이미지 자리·`■`·`★`·표 머리 표시·HTML 태그 제외. MCP `save_draft`·`update_draft`는 결과에 `lengthFeedback`(목표의 90% 미만이면 보완 후 `update_draft`로 다시 저장, 최대 초과면 줄이기)을 붙이고, 파일을 직접 쓰는 blog-draft 스킬은 `npm run --silent draft-length -- <파일>`로 잽니다.

**정책: 발행됨 초안은 고치지 않습니다.** 발행한 글은 다시 쓰지 않아 고쳐도 토큰 낭비라서, `update_draft`는 `draftEditBlocked`(`draft-status.ts`)로 상태가 발행됨이면 거부하고, `read_draft`는 내용 앞에 "발행됨 초안: 고치지 않는다"를 붙입니다 (인스타 재가공 같은 읽기는 허용). MCP 서버 안내문과 `docs/prompts/project-instructions.md`(claude.ai 프로젝트), 루트 `CLAUDE.md`(Claude Code에서 파일을 직접 고칠 때)에도 같은 정책을 적어 둡니다.

네이버 본문은 일반 텍스트(`■` 소제목, `★` 강조, `[표: 열 | 열]` + `값 | 값` 줄)입니다. 초안 화면의 **서식 포함 복사**는 `apps/web/lib/preview.ts`의 `naverPasteHtml`로 HTML을 만들어 `text/html`과 원래 텍스트(`text/plain`)를 함께 클립보드에 넣습니다. 붙여넣을 때 클래스·스타일시트는 따라가지 않으므로 서식은 태그(`<b>`, `font-size:19px` 인라인 스타일, 선을 인라인으로 넣은 `<table>`)에 직접 넣고, 소제목은 `<p>` 안의 굵고 큰 글씨로 넣습니다. 2026-11-03에 실제로 붙여넣어 보니 굵게·크기·표는 살아 있었지만, `<h3>`로 감싸도 네이버 "소제목" 문단 서식으로는 바뀌지 않았습니다. 진짜 소제목은 크롬 확장이 붙여넣은 뒤에 입힙니다. 텍스트의 빈 줄처럼 블록 사이에 빈 문단(`<p><br></p>`)을 둡니다. 사람이 채울 자리는 형광펜 없이 글자 그대로 둡니다.

예약 발행 시간은 `apps/web/app/blog/schedule/`에 있습니다. 뽑은 시간과 조건은 `saved.ts`가 `localStorage`의 `toolhub:schedule-times`에 두고, 저장할 때 같은 탭에 `toolhub:schedule-times` 창 이벤트를 보냅니다 (`storage` 이벤트는 다른 탭에만 오므로). 사이드 메뉴 맨 아래의 `schedule-widget.tsx`가 이 값을 늘 보여 주고(1분마다 지남·다음 표시 갱신, `scheduleDate`로 실제 시각 계산), 같은 조건으로 다시 뽑거나 `지금부터`(바로 올린 시각만 `nowStart()`로 바꿈)로 뽑아 저장합니다. 예약 발행 화면(`schedule-picker.tsx`)은 열 때 기준 날짜가 오늘 이후면 저장된 값을 그대로 보여 주고, 이벤트를 받아 사이드 메뉴에서 다시 뽑은 시간으로 맞춥니다. 조건(바로 올린 시각·개수·간격)이 마지막으로 뽑거나 복원한 조건과 다를 때만 다시 뽑아서, 복원할 때 시간이 바뀌지 않습니다.

초안 화면의 썸네일은 `/blog/thumbnail`의 `ThumbnailMaker`를 그대로 씁니다 (`apps/web/app/blog/drafts/view/thumbnail-panel.tsx`). 헤더의 버튼과 본문 열의 `<details>` 패널은 떨어져 있어서 창 이벤트(`toolhub:open-thumbnail`)로 열고 스크롤합니다. 부제·라벨·블로그 이름·스타일은 `localStorage`의 `toolhub:thumbnail-brand`에 기억하고(주소의 `subtitle`·`label`이 있으면 그 값이 먼저, 고치면 기억), 제목만 초안마다 새로 채웁니다. 캔버스와 글꼴은 처음 펼칠 때 그리기 시작하고, 접어도 언마운트하지 않아 고친 제목이 남습니다. 태그 **전체 복사**는 네이버면 화면에 보이는 `#태그 #태그`, 티스토리·Blogger면 쉼표로 잇습니다.

### 초안 상태 `data/draft-status.json`

초안 파일(.md)은 Claude가 `update_draft`로 통째로 고쳐 쓰므로 상태를 파일 안에 두지 않고 따로 둡니다. `{ "drafts": { "<초안 파일 이름>": { status, url?, at?, answers? } } }`.

| 필드 | 설명 |
|---|---|
| `status` | `draft`(초안) · `published`(발행됨). 기록이 없으면 초안. 예전에 저장한 `scheduled`(예약됨, 없앤 상태)는 발행됨으로 봄 (`effectiveStatus`). 새로 저장할 수는 없음 |
| `url` | 발행한 글 주소. http(s)만 (`normalizePostUrl`). 지식iN 답변 링크로 씀 |
| `at` | 발행 시각 (ISO). 발행됨으로 바꿀 때 비어 있으면 그 시각 |
| `answers` | 이 글로 답한 지식iN 질문 `{ link, title, answeredAt }` (같은 질문 주소는 하나만) |

초안 목록 순서는 `sortDrafts`(발행됨 → 초안, 같은 상태끼리는 `updatedAt` 내림차순)로 서버에서 정합니다. 화면에서 상태를 바꿔도 줄이 튀지 않게 클라이언트에서는 다시 정렬하지 않습니다. MCP `list_drafts`는 최근 초안의 패턴을 피하려고 쓰므로 그대로 최근 수정 순입니다. 초안 화면의 이전·다음 버튼은 `adjacentDrafts`(같은 `sortDrafts` 순서에서 `effectiveStatus`가 초안인 글만)로 찾습니다. 이 버튼은 클라이언트 이동이라 화면의 클라이언트 컴포넌트가 다시 만들어지지 않으므로, 상태를 들고 있는 상태 카드·썸네일 패널·발행 할 일 버튼에는 `key={file}`를 줘서 앞 초안의 상태가 남지 않게 합니다.

초안 목록의 작성일 거르기(`apps/web/app/blog/drafts/date-filter.tsx`)는 파일 이름의 날짜(`DraftSummary.date`)로 달력에 개수를 표시합니다. 상태 탭 개수는 고른 작성일 안에서, 달력의 날짜별 개수는 고른 상태 안에서 셉니다. 작성일은 여러 날을 고를 수 있고(`apps/web/lib/draft-dates.ts`의 `toggleDate`), 고른 날은 `localStorage`의 `toolhub:draft-dates`에 둡니다. 목록을 열 때 브라우저에서 읽고(서버 화면과 어긋나지 않게), `parseSavedDates`로 지금 초안이 있는 날만 남겨서 지운 초안의 날짜 때문에 목록이 비지 않게 합니다. 달력 칸 계산(`monthGrid`, `shiftMonth`)은 일정 캘린더와 함께 `@toolhub/tasks/model`에 있습니다.

로직은 `packages/collector/src/draft-status.ts`(브라우저에서도 쓰는 순수 함수, `@toolhub/collector/draft-status`)와 `draft-status-store.ts`(파일 읽기·쓰기, 임시 파일 + rename, 같은 프로세스 안 쓰기는 차례로)에 있습니다. 웹은 `PUT /api/drafts/status`, `PUT /api/drafts/kin`으로 고치고, MCP `list_drafts`가 상태 열을 보여 줍니다.

## 네이버 API 호출 방식

- **검색광고 API**는 호출 한도가 낮아(429) 요청 사이에 1초 간격을 두고, 429면 2초·4초 뒤 재시도합니다. 힌트 키워드는 한 번에 5개까지라, 롱테일 키워드는 각 단어도 함께 힌트로 넣어 연관 키워드를 넓게 받은 뒤 관련도 순으로 정렬합니다.
- **키워드 기록의 검색량**은 렌더링을 막지 않도록 브라우저가 `/api/stats/enrich`로 뒤에서 채우고, 실시간 화면에서 새 키워드가 기록되면 서버가 바로 백그라운드로 시작합니다. 같은 날짜는 한 번만 돌도록 진행 중인 작업을 공유합니다.
- **API HUB** 조사는 병렬로 하고, 하나가 실패해도 나머지는 채웁니다.
- **묶음 분석**(`analyze_keywords`)은 검색광고(5개씩·1초 간격)와 API HUB(검색 추이·블로그 문서 수, 키워드 5개씩 동시)를 함께 돌립니다. 20개 기준 3~4초, 50개 기준 10초 남짓입니다. 입력은 `cleanKeywordList`가 순위 번호(`1.` `2)` `3위`)·변동 표시(`▲3` `NEW`)·따옴표를 걷어내고 중복을 없애 최대 50개로 자릅니다. 숫자로 시작하는 키워드(`4대보험`, `2026 연말정산`)는 순위로 보지 않습니다.
- **키워드 찾기**(`discoverKeywords`)는 주제마다 검색광고를 한 번 부르는데, 힌트에 주제와 `주제+신청·조건·방법·추천`을 함께 넣습니다. 주제만 넣으면 넓은 주제어 위주로 와서, 예를 들어 "국민연금"은 주제가 들어간 키워드가 1개뿐이었지만 의도 힌트를 넣으면 16개(수령나이·일시금 수령·추가납부 등)로 늘었습니다. 힌트가 400으로 거부되면 주제만으로 다시 부릅니다.
  - `pickCandidates`: 주제가 들어가고 월 300~5만 회, 사이트 찾기 검색어(홈페이지·로그인·공단 등)가 아닌 것만 남기고, 정보형 단어(방법·신청·나이·비용…)가 든 키워드 → 검색량 순으로 정렬합니다. 주제가 여러 개면 주제별로 번갈아 놓아 한 주제가 분석 자리를 독차지하지 않게 합니다.
  - 상위 50개만 API HUB로 추이·블로그 문서 수를 조회합니다 (검색량은 이미 있으니 `analyzeKeywords`를 검색광고 없이 부르고 포화도를 다시 계산). 주제 1개 기준 1~2초입니다.
  - 추천(`pick`)은 포화도 기회이면서 추이가 하락세·급등 이력이 아닌 키워드, `곧 시즌`은 시즌 정점 달이 1~3달 뒤인 키워드입니다.

## 글쓰기 프롬프트 (`docs/prompts/`)

| 파일 | 내용 |
|---|---|
| `project-instructions.md` | 역할, 내 블로그 정보, 공통 원칙 (claude.ai 프로젝트 지침) |
| `planning.md` | 글감 선정 규칙 (`[글감 브리핑]`) |
| `writing.md` | 초안 작성 공통 규칙 (`[글쓰기 브리프]` 항목 쓰는 법, 문체 규칙, 사람이 채울 자리, 출력 형식) |
| `types/{info,review,place}.md` | 유형별 구성 변형 A~D와 이미지·덧붙일 경험 기준 |
| `platforms/{tistory,blogger,naver}.md` | 플랫폼별 본문 형식 |
| `threads.md` | 스레드 홍보글 |

- 본문에 남기는 표시는 `[이미지: …]`뿐입니다 (2026-11-03부터). 경험(`[직접 작성]`)과 확인 못 한 정보(`[확인 필요]`)는 본문을 완성된 문장으로 쓰고 본문 밖 "사람이 할 일"에 정리합니다. 본문을 복사해 바로 올릴 때 지울 표시가 남지 않게 하려는 것입니다. 예전 초안을 위해 `MARKER_PATTERN`·체크리스트·미리보기는 세 표시를 계속 읽습니다.
- 내보내기 전 확인 (`writing.md` 작성 순서 6번, 2026-11-04): 분량·제목 글자 수·메인 키워드 횟수(이미지 자리 alt는 세지 않음)·남은 표시를 직접 세어 보고 고친 뒤 내보냅니다. 2026-11-03에 쓴 네이버 초안 16개 중 10개가 1,500자 아래(1,362~1,479자)로 나와서 넣었습니다. `blog-draft` 스킬은 저장 전에 이 확인을 하고 보고에 본문 글자 수를 적습니다.
- 추천 제목은 `writing.md`에서 제목 끝 ` (추천)`으로 정했습니다 (2026-11-04, 그 전에는 모양을 정하지 않아 `⭐추천:`, `<-추천` 등이 섞임). 파서는 예전 초안을 위해 `(추천)`, `[추천]`, `⭐`·`★`, 줄 앞의 `추천:`, 끝의 `<- 추천`·`← 추천`·`- 추천`도 알아보고, 끝의 `(34자)` 같은 글자 수 표시는 파서(`parseDraft`)가 걷어냅니다. 제목 속 낱말 "추천"은 표시로 보지 않습니다.
- 구성 변형의 이름을 바꾸면 `packages/collector/src/platforms.ts`의 `STRUCTURE_NAMES`도 함께 바꿉니다.
- 브리프의 형식을 바꾸면 `writing.md`의 "입력 형식"과 `brief.test.ts`도 맞춥니다.

## MCP 서버

데스크톱 앱 설정은 README를 보세요. Claude Code는 저장소의 `.mcp.json`으로 연결됩니다.

**일정**: `list_tasks`, `add_task`(자연어 `text` 또는 필드 지정), `update_task`, `complete_task`, `delete_task`, `add_project`

**블로그**: `get_live_keywords`, `get_daily_keywords`, `analyze_keyword`, `analyze_keywords`(목록·캡처 묶음 분석), `discover_keywords`(주제로 키워드 찾기), `research_keyword`, `search_places`, `get_shopping_trend`, `get_writing_rules`, `get_writing_brief`, `save_draft`, `list_drafts`, `read_draft`, `update_draft`

**인스타**: `get_insta_rules`(task: reel·caption·carousel·story·comment·repurpose, 내 계정 정보 포함), `check_reel_script`(훅 후보·대본 점검), `check_caption` — `insta-tools.ts`. 게시·댓글·DM은 사람이 직접 합니다 (자동화는 약관 위반이라 만들지 않음).

**웹**: `open_web`(page: … `reel`, `caption` 포함), `stop_web` · **프롬프트**: `blog_draft`, `pick_topics`

stdio 전송은 stdout을 프로토콜에 쓰므로 서버 코드에서 `console.log`를 쓰면 안 됩니다 (로그는 `console.error`).

### `open_web`이 웹을 띄우는 방식

| | 개발용 `npm run web` | 사용용 `open_web` |
|---|---|---|
| 주소 | http://localhost:3000 | http://localhost:3100 |
| 코드 | 작업 중인 코드 | **로컬 main 브랜치의 최신 커밋** |
| 실행 위치 | 이 저장소 | `~/.toolhub/runtime/toolhub` (git worktree) |
| 실행 방식 | `next dev` (HMR) | `next build` → `next start` (파일 감시 없음) |
| 데이터·키 | `data/`, `drafts/`, `.env.local` | 같은 파일을 공유 |

- main에 커밋하면 다음 `open_web` 때 실행 폴더를 새 커밋으로 맞추고, **커밋마다 한 번** 빌드한 뒤(지금 기준 약 6초) 재시작합니다. `package-lock.json`이 바뀌었으면 `npm install`을 다시 하고, 45초를 넘기면 "준비 중"으로 먼저 응답한 뒤 다음 호출에서 이어받습니다. 빌드한 커밋은 `.toolhub/web.built`, 떠 있는 커밋과 실행 방식은 `.toolhub/web.commit`에 남습니다.
- 3100이 `next dev`가 아닌 이유: 사용용 웹은 코드가 바뀌지 않으므로 HMR·파일 감시가 필요 없습니다.
- **무한 새로고침 주의**: `next dev`의 내장 MCP 서버(AI 에이전트용, toolhub MCP와 무관)는 브라우저 콘솔 로그를 `.next/dev/logs/next-development.log`에 기록하는데, 이 파일 변경을 소스 변경으로 감지해 다시 컴파일 → 브라우저 새로고침 → 로그 기록이 반복됐습니다. 화면 전환이 끝나지 않아 개발 표시기(N 배지)에 **Rendering**이 계속 뜨고 모든 페이지가 느려집니다. `next.config.ts`의 `experimental.mcpServer: false`로 막았습니다. `logging.browserToTerminal: false`는 터미널 출력만 끄고 파일 기록은 막지 못해서 효과가 없었습니다.
- 확인 방법: `next dev` 로그에 `✓ Compiled in 0ms`가 요청마다 반복되거나 `.next/dev/logs/`가 생기면 다시 생긴 것입니다.

## 페이지 로딩

- 클릭 후 화면이 바뀌는 데 0.1초 안쪽, 내용은 실시간 0.7~0.9초(외부 3곳 조회), 키워드 분석 검색 0.8초 안팎(검색광고·API HUB), 나머지 0.4초 안쪽입니다 (개발 서버, 2026-10-31 측정).
- `app/blog/loading.tsx`가 외부 API를 기다리는 동안 "불러오는 중…"을 바로 보여줘서, 이전 화면에 멈춰 있는 것처럼 보이지 않게 합니다.

## 작성 가이드 (`/blog/guide`)

내용은 `apps/web/app/blog/guide/content.ts`에 데이터로 있습니다 (`**굵게**`, `` `코드` ``만 지원). 분량·제목 길이는 `docs/prompts/platforms/*.md`와 맞추고, 애드포스트 가입 기준처럼 자주 바뀌는 정책은 숫자로 단정하지 않고 공식 안내 링크로 보냅니다. 수익 승인 탭(`APPROVAL_GUIDE`)은 2026-11 조사 기준이며, 공식 확인된 것(애드센스 만 18세·글 수 기준 없음 등)만 단정하고 운영자들이 전하는 기준(쿠팡 누적 15만원, 애드포스트 90일·50개·100명)은 출처 성격을 함께 적습니다.
- 시작한 웹 서버는 데스크톱 앱을 꺼도 계속 돕니다 (`stop_web`으로 종료). PID·로그는 `.toolhub/`에 남습니다.
- `git worktree list`에 실행 폴더가 보이는 것은 정상입니다. `git worktree remove --force ~/.toolhub/runtime/toolhub`로 지우면 다음 `open_web` 때 다시 만듭니다.

## 크롬 확장 (`extension/`)

- 스마트에디터 ONE은 글 내용을 내부 모델로 관리해서 DOM을 직접 고치면 저장 때 사라질 수 있습니다. 그래서 툴바 버튼(굵게·글자 크기·글자색·배경색)을 `click()`으로 대신 누릅니다. 굵게는 이미 눌려 있으면(`se-is-selected`) 다시 누르지 않습니다.
- 쓰는 방법은 세 가지입니다. 드래그 감지가 실제 에디터에서 안 될 수 있어(첫 시험에서 안 뜸) 감지에 기대지 않는 방법을 함께 둡니다.
  - **서식 도구**: 에디터가 있는 프레임(500×300 이상, `.se-content`나 편집 가능한 영역이 있는 곳)에만 오른쪽 아래에 항상 띄웁니다. 에디터는 늦게 뜨므로 1초마다 찾다가 찾으면 멈춥니다. 이게 안 보이면 확장이 그 프레임에 못 들어간 것이라 원인 구분에도 씁니다.
  - **단축키**: `commands`(⌥⇧1·2·3)는 브라우저가 먼저 받아 에디터가 키를 가로채도 동작합니다. background가 탭으로 보내고, `document.hasFocus()`인 에디터 프레임만 처리합니다.
  - **드래그 막대**: mouseup·selectionchange를 캡처 단계에서 듣고, 선택이 본문(`.se-content` 또는 편집 가능한 영역) 안일 때 띄웁니다.
- 막대는 모두 `mousedown`을 막아 눌러도 선택이 풀리지 않게 합니다. 선택이 없으면 누르라고 안내합니다. 에디터가 iframe(주소 없는 프레임 포함) 안에 있어서 `all_frames`와 `match_origin_as_fallback`으로 넣습니다.
- 에디터 클래스 이름은 로그인 없이 확인할 수 없어 공개 자료 기준으로 잡았습니다. **실제 에디터에서 처음 확인할 때나 네이버가 에디터를 바꿨을 때**는 패널의 "진단 정보 복사" 결과(프레임별 확장 동작 여부·편집 영역·선택 상태, 툴바 버튼 클래스, 드롭다운을 잠깐 열어 본 항목·팔레트 색, 문단 서식(본문·소제목) 드롭다운 항목, 본문 문단 클래스 — 글자는 담지 않음)를 보고 `naver-editor.js`의 `SELECTORS`만 고치면 됩니다.
- 같은 구조의 모의 페이지에서 드래그 → 막대 → 버튼 순서(크기 19 → 굵게, 팔레트 가까운 색), 선택 유지, 본문 밖 선택 무시, 버튼 없음 안내, 진단 수집을 헤드리스 크롬으로 확인했습니다 (2026-11-01).
- **소제목 정리**(서식 도구의 `소제목 정리`, `convertPastedHeadings`): 네이버 "소제목"은 글자 서식이 아니라 문단 서식(`.se-text-format-toolbar-button` → `.se-toolbar-option-text-format-sectionTitle-button`)이고, 바꾸면 문단이 `se-component se-sectionTitle` 덩어리로 따로 빠집니다 (2026-11-03 진단으로 확인). 붙여넣기 HTML로는 이 서식을 줄 수 없어서, 서식 포함 복사로 붙여넣은 뒤 본문 덩어리(`.se-component.se-text`)의 문단 중 **글자가 모두 굵고(계산된 font-weight 600 이상) `se-fs19`인 줄**을 찾아 드롭다운에서 소제목을 누릅니다.
  - 에디터는 프로그램으로 바꾼 선택만으로는 커서를 옮기지 않습니다. 첫 시도에서 선택만 바꿨더니 붙여넣은 직후 커서가 있던 글 끝 줄이 대신 소제목이 됐습니다. 그래서 그 줄 끝을 클릭한 것처럼 pointer·mouse 누르기/떼기/클릭을 보내며 커서를 둡니다.
  - **안전장치**: 소제목을 누르기 전에 툴바가 "본문"·글자 크기 19를 보이는지 확인하고, 아니면(에디터가 그 줄을 못 잡음) 아무것도 누르지 않고 멈춥니다.
  - 누를 때마다 에디터가 다시 그리므로 매번 처음부터 다시 찾고(상한 50), 바꾼 뒤에도 본문 덩어리에 남아 있으면 멈추고 알립니다. 크기 19는 `apps/web/lib/preview.ts`의 붙여넣기 HTML과 맞춰야 합니다.
  - 모의 페이지(커서는 마우스를 뗄 때만 옮기고 처음엔 글 끝)에서 굵은 19 줄만 바뀌고 15 굵게·19 보통·섞인 줄은 그대로인 것, 합성 마우스를 무시하면 아무것도 바꾸지 않고 멈추는 것을 확인했습니다. 실제 네이버 에디터에서도 정상 동작을 확인했습니다 (2026-11-03).

### 이미지 모음 (사이드 패널)

이미지는 Gemini·ChatGPT 등에서 만들고, 이 패널은 캡처·저장 없이 모아서 에디터에 붙여넣는 용도입니다 (이미지 생성은 하지 않음).

- 자동 담기: `content-ai.js`(Gemini·AI Studio·ChatGPT)가 이미지 `load` 이벤트를 캡처 단계에서 받아, 주소가 2.5초 동안 그대로이고(생성 중 흐린 미리보기 제외) 400×400 이상인 이미지만 페이지 안에서 data URL로 읽어 background에 보냅니다. background는 패널이 열려 있고 `autoCollect`가 켜져 있을 때만 담습니다. 패널이 열려 있는지는 `chrome.runtime.getContexts({ documentUrls: [sidepanel.html] })`로 크롬에 직접 묻습니다 (사이드 패널·탭 모두 잡힘). 예전에는 메모리의 포트 연결 수만 봤는데, MV3 background는 30초쯤 쉬면 꺼졌다가 메시지가 오면 다시 켜지므로 Gemini가 이미지를 만드는 사이 0이 되어 열린 패널에서도 버렸습니다 (2026-11-04 Chrome for Testing에서 background를 끈 뒤 생성해 재현·수정 확인). 패널은 연결이 끊기면 다시 이어 `getContexts`가 없는 크롬에서도 연결 수가 맞게 합니다. 같은 이미지가 다시 그려지면 원래 주소(`source`)로 중복을 거릅니다.
- 오른쪽 클릭 메뉴(`contextMenus`, 이미지에만)는 `background.js`가 받아 담습니다. 패널 열기(`sidePanel.open`)는 사용자가 누른 직후에만 허용돼서 이미지를 받기 전에 먼저 엽니다.
- 받는 순서: 확장 권한(`<all_urls>`)으로 직접 `fetch` → 실패하거나 `blob:` 주소면 `scripting.executeScript`로 그 페이지(프레임을 모르면 모든 프레임) 안에서 읽습니다. Gemini 등은 생성 이미지를 페이지 안에서만 유효한 `blob:` 주소로 띄웁니다.
- 패널에 붙여넣기·끌어다 놓기는 이미지 파일 → HTML 속 `<img>`의 src 속성 → uri-list → 텍스트 순으로 찾고, 패널이 직접 못 받는 주소(`blob:`, 로그인 필요)는 background가 지금 탭에서 읽습니다.
- 담기(추가)는 background의 큐로 차례로 저장해 동시에 써서 빠지는 일을 막습니다. 패널·background 모두 `storage.local`의 `shelf`를 쓰고 패널은 `storage.onChanged`로 다시 그립니다.
- 클립보드는 PNG만 받아서 복사할 때 `OffscreenCanvas`로 PNG로 바꿉니다. 최근 30장은 data URL로 두고 `unlimitedStorage`로 용량 제한을 풉니다.
- 확인 (2026-11-01): Chrome for Testing에 확장을 실제로 설치(`--remote-debugging-pipe --enable-unsafe-extension-debugging` + CDP `Extensions.loadUnpacked`. 일반 크롬은 `--load-extension`을 막음)하고, `gemini.google.com` 요청을 가짜 페이지로 바꿔 자동 담기(작은 아이콘 제외), 다시 그려져도 중복 없음, `blob:` 이미지 끌어다 놓기, 자동 담기 끄기를 확인했습니다. 실제 Gemini·ChatGPT 화면 구조는 로그인이 필요해 설치 후 확인이 필요합니다.

## 이미지 6장 프롬프트 (`image-prompt.ts`)

초안 화면에서 Gemini에 붙여넣을 요청문을 만듭니다. 늘 6장(`IMAGE_PROMPT_COUNT`): **1번 대표 썸네일 + 2~6번 본문 이미지 1~5번**을 적힌 장면 그대로 요청해 초안과 1:1로 맞춥니다.

작성 규칙(2026-11-05~, `writing.md`)은 이미지를 모두 이미지 AI로 만든다는 전제로, 모든 초안에 **대표 썸네일 1개(본문 첫 줄 `[이미지: 대표 썸네일: 장면 | … | 추천: AI 생성]`) + 본문 이미지 5개**를 `추천: AI 생성`의 그릴 수 있는 장면으로만 둡니다. 화면 캡처·표 캡처·직접 제작 카드는 없고, 네이버 표는 서식 포함 복사가 표로 바꿔 주므로 표 이미지 자리도 없습니다. 그 전에는 자리가 3~8개로 들쭉날쭉하고 대부분 직접 캡처·제작이라 프롬프트와 어긋나고 이미지 준비가 병목이었습니다. review·place는 실제 사진이 근거라 같은 개수를 `직접 촬영`으로 둡니다.

`photoSlots`는 대표 썸네일(장면 앞 `대표 썸네일:`)을 따로 돌려주고, 본문 이미지는 썸네일을 빼고 번호를 셉니다 (이미지 목록 번호와 같음). `AI 생성` 자리는 모두, 예전 형식의 `직접 촬영`·`무료 사진` 자리는 화면·표·서류처럼 실제 정보를 담는 장면을 빼고 고릅니다. 본문 자리가 5개보다 많으면 고르게 5개, 모자라면(예전 초안) 이미지 자리가 없는 소제목으로, 그래도 모자라면 주제로 채우고 그 장들에만 alt를 따로 받습니다. 소제목은 네이버 본문의 `■`, 마크다운 `##`·`###`, HTML `h2`·`h3`에서 찾고, 소제목 아래 첫 문단(표시 자리·표 줄 제외, 숫자 문장을 빼고 10자 미만이면 생략)을 장면 단서로 붙입니다. 공통 규칙: 가로 4:3, 색감 통일, 한국 배경, 글자·로고·가짜 화면·실존 인물 금지.

블로그에 맞게 다듬은 점 (2026-11-02):
- **숫자 걷어내기**: 장면 단서에 금액·날짜가 있으면 Gemini가 달력·그래프·숫자를 그려 넣어 한글이 깨지기 쉬워서, 소제목은 단위가 붙은 숫자만 지우고(4대보험 같은 이름은 유지) 첫 문단은 숫자가 든 문장을 통째로 뺍니다.
- **장면 정하기**: 세금·제도처럼 추상적인 내용은 그 상황의 사람·사물로 표현하고, 6장은 사물 가까이·사람 상반신·공간 전체로 구도를 섞게 합니다 (같은 "노트북 앞 사람"만 나오는 것 방지).
- **AI 티 줄이기(사진)**: 스마트폰으로 찍은 듯한 자연광 사진, 과한 보정·번들거림 금지, 얼굴 정면·손가락 클로즈업 피하기, 노트북·휴대폰 화면은 흐리게.
- **한 번에 6장**: "다음"을 매번 치지 않도록 한 답변에서 1~6번을 모두 생성하라고 요청합니다. 실제로 한 번에 나오는지는 Gemini 쪽 동작이라 확인이 필요합니다.

## 지식iN 답변 요청문 (`kin-answer.ts`)

초안 목록에서 줄을 펼치면 `GET /api/kin?q=&sort=date|sim`(HUB 지식iN 검색, 20개)으로 질문을 보여 주고, 질문마다 Claude에 붙여넣을 요청문을 만듭니다 (`buildKinAnswerPrompt`, 브라우저에서 쓰도록 `@toolhub/collector/kin-answer`). 초안 본문은 `GET /api/drafts/content?file=`로 받아 `draftPlainText`로 일반 텍스트로 바꿉니다 (HTML 본문은 소제목 `■`, 목록 `-`, 표 `|`로, 이미지 자리는 뺌).

- 지식iN 검색 API는 질문의 제목과 앞부분 요약만 주고, 답변 수·마감 여부·작성일은 주지 않습니다. 그래서 질문 본문을 붙여넣는 칸을 두고(없으면 요약임을 밝힘), 최신순을 기본으로 합니다.
- 검색 결과는 탭 안 메모리에 10분 기억합니다 (`apps/web/lib/ttl-cache.ts`, 검색어|정렬별). 응답을 기다리는 Promise를 기억해 개발 모드에서 effect가 두 번 돌아도 한 번만 부르고, 실패하면 지웁니다. **검색** 버튼은 기억을 건너뛰고 새로 부릅니다. 새로고침하면 비워집니다.
- 규칙 기반으로 답변을 조립하지 않고 Claude에 맡깁니다 (2026-11-04 결정). 질문 상황을 이해하지 못한 답변은 안 하느니만 못해서, 요청문은 "글로 답할 수 없으면 '답변 비추천: 이유'만" 쓰게 합니다.
- 요청문 규칙: 질문자 상황 한 문장 + 답부터, 글에 있는 내용만, 300~600자, 홍보 말투 금지, 링크는 마지막에 한 번(글에 실제 있는 표·순서·예시를 더 볼 이유로), 질문마다 다른 문장(같은 답변 반복은 지식iN 제재), 마크다운 없이.

## 인스타 자동화

- 점검 로직(`@toolhub/insta`)은 Node API를 쓰지 않아 웹에서는 클라이언트 컴포넌트가 입력할 때마다 바로 계산하고, MCP는 같은 함수의 텍스트 형식을 돌려줍니다.
- 말하는 시간은 한국어 음절 수로 어림합니다: 한글은 글자 수, 숫자는 읽는 소리(0이 아닌 자릿수 × 1.5), 영어 단어 2음절, % 3음절. 기본 초당 6.5음절(빠른 릴스 내레이션 기준, 화면·MCP에서 바꿀 수 있음).
- 훅 점검은 약한 훅(인사·서론·주목 부탁, 3초 초과, 숫자 없음)을 거르는 용도라고 화면·MCP에 밝힙니다. 글자만으로 좋은 훅 둘 중 어느 쪽이 잘될지는 알 수 없습니다.
- 캡션의 "피드에 보이는 부분"은 첫 두 줄 또는 125자 중 먼저 닿는 곳까지로 어림합니다 (기기·글꼴마다 다름). 해시태그 5개 제한은 2025년 12월 변경 기준입니다.
- 사이드바는 세 묶음(`GROUPS`)이고, 지금 페이지의 묶음(`currentGroup`, 경로 앞부분으로 정함)만 펼치고 나머지는 접습니다. 머리글을 눌러 다른 묶음을 잠깐 열 수 있지만 기억하지는 않으며, 다른 묶음의 페이지로 옮기면 다시 그 묶음만 펼칩니다. 경로는 서버에서도 알므로 처음부터 같은 모양으로 그려집니다.

## 웹 주소

일정 관리는 `/tasks?view=today|week|inbox|all|done|board|calendar[&project=ID|&label=태그][&task=번호]`와 `/chunks[?view=week]`(덩어리 기록, 화면 전환은 서버를 다시 부르지 않고 주소만 바꿈), 인스타는 `/insta/reel`, `/insta/caption`(`/insta`는 릴스 대본으로), 블로그는 `/blog`, `/blog/discover?q=주제,주제`, `/blog/history`, `/blog/keyword?q=`, `/blog/drafts`, `/blog/drafts/view?file=`, `/blog/schedule`(예약 발행 시간), `/blog/thumbnail?title=`. 예전 주소(`/history`, `/keyword`, `/drafts`, `/thumbnail`)는 `next.config.ts`에서 새 주소로 보냅니다.

## 브리프 형식 (직접 붙여넣을 때)

첫 줄로 작업을 구분합니다. 자세한 항목 설명은 `docs/prompts/planning.md`, `writing.md`의 "입력 형식"에 있습니다.

```
[글감 브리핑]
날짜: 2026-10-29
| 키워드 | 월간 검색량 | 경쟁도 | 소스 | 처음 본 시각 | 관련 뉴스 |
```

```
[글쓰기 브리프]
플랫폼: 티스토리
유형: 정보
구성: B (결론 먼저형)
키워드: 국민연금 수령나이
월간 검색량: 58,040 (PC 8,440 / 모바일 49,600) · 경쟁도: 중간
검색 추이: 꾸준함 — …
블로그 문서 수: … (검색량의 2.2배 · 포화도 기회)
연관 키워드 (관련 높은 순): | 키워드 | 월간 검색량 | 경쟁도 |
실제 질문 (지식iN): - …
상위 블로그 글 (겹치지 않는 각도를 잡기 위한 참고): - …
카페 글 (리뷰·장소) / 장소 정보 (장소)
```
