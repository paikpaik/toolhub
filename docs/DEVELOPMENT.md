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
│       ├── image-prompt.ts    # 초안 → Gemini용 이미지 5장 요청문
│       ├── cli.ts             # npm run collect
│       └── brief-cli.ts       # npm run brief
├── packages/tasks/       # 일정 관리 (웹·MCP 공용)
│   └── src/
│       ├── model.ts           # 할 일 모델, 날짜·반복 계산, 자연어 빠른 추가 해석 (브라우저에서도 사용)
│       └── store.ts           # data/tasks.json 읽기·쓰기 (잠금 파일로 웹·MCP 동시 쓰기 보호)
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
│   │   ├── blog/              # 블로그 (page.tsx 실시간, discover, history, keyword, drafts, thumbnail, guide)
│   │   │   └── guide/content.ts   # 작성 가이드 내용 (플랫폼별 발행 순서·수익·품질)
│   │   └── api/               # tasks, projects, brief, stats/enrich, health
│   └── lib/                   # 데이터 경로, 입력 검증, 미리보기, 검색량 백그라운드 채우기
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

toolhub 전체가 하나의 버전(`0.3.0` 형식)을 씁니다. 올릴 때는 루트 `package.json`과 각 패키지(`packages/*`, `apps/web`)의 `package.json`, `extension/manifest.json`을 같은 번호로 고칩니다. 하나라도 다르면 `packages/mcp/src/version.test.ts`가 실패합니다.

- 웹 사이드바에 `v버전`이 보이고, `open_web`으로 띄운 웹은 실행 중인 커밋(`· abc1234`)도 함께 보입니다. `/api/health`도 버전을 돌려줍니다.
- MCP 서버는 루트 `package.json`의 버전으로 자신을 알립니다.
- 크롬 확장은 `chrome://extensions`에 같은 번호가 보입니다.
- 기능이 늘면 가운데 자리, 고치기만 하면 끝자리를 올립니다.

## 테스트

외부 API를 부르지 않는 핵심 로직을 테스트합니다. 테스트 파일은 대상 파일 옆에 `*.test.ts`로 둡니다. 기능을 고치거나 버그를 찾으면 그 경우를 테스트에 추가하세요.

| 위치 | 테스트하는 것 |
|---|---|
| `packages/tasks` | 자연어 빠른 추가 해석, 날짜·반복 계산, 보기·그룹·정렬, 저장소(반복 완료·프로젝트 삭제·여러 프로세스 동시 쓰기) |
| `packages/collector` | 추이 해석·포화도·시즌 알림 날짜, 묶음 분석의 키워드 목록 정리·정렬·표, 브리프·글감 브리핑 형식, 초안 파싱·도입 문장·고치기(백업·경로 차단), 키워드 병합·기간 집계 |
| `apps/web/lib` | 할 일 수정 요청 검증, 초안 미리보기 |
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

웹과 MCP는 서로 다른 프로세스에서 이 파일을 고치므로 `tasks.json.lock` 잠금 파일로 읽기-수정-쓰기를 순서대로 처리합니다. 10초 넘은 잠금은 비정상 종료로 보고 풉니다.

### 초안 `drafts/YYYY-MM-DD-<키워드>-<플랫폼>[-n].md`

내용 형식은 `docs/prompts/writing.md`의 "출력 형식"(`## 제목 후보`, `## 메타 설명`, `## 태그`, `## 본문`(코드 블록), `## 스레드 홍보글` 등)을 따릅니다. `update_draft`로 고치면 이전 버전이 `drafts/.history/`에 남습니다.

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
| `types/{info,review,place}.md` | 유형별 구성 변형 A~D와 이미지·직접 작성 기준 |
| `platforms/{tistory,blogger,naver}.md` | 플랫폼별 본문 형식 |
| `threads.md` | 스레드 홍보글 |

- 구성 변형의 이름을 바꾸면 `packages/collector/src/platforms.ts`의 `STRUCTURE_NAMES`도 함께 바꿉니다.
- 브리프의 형식을 바꾸면 `writing.md`의 "입력 형식"과 `brief.test.ts`도 맞춥니다.

## MCP 서버

데스크톱 앱 설정은 README를 보세요. Claude Code는 저장소의 `.mcp.json`으로 연결됩니다.

**일정**: `list_tasks`, `add_task`(자연어 `text` 또는 필드 지정), `update_task`, `complete_task`, `delete_task`, `add_project`

**블로그**: `get_live_keywords`, `get_daily_keywords`, `analyze_keyword`, `analyze_keywords`(목록·캡처 묶음 분석), `discover_keywords`(주제로 키워드 찾기), `research_keyword`, `search_places`, `get_shopping_trend`, `get_writing_rules`, `get_writing_brief`, `save_draft`, `list_drafts`, `read_draft`, `update_draft`

**웹**: `open_web`, `stop_web` · **프롬프트**: `blog_draft`, `pick_topics`

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

내용은 `apps/web/app/blog/guide/content.ts`에 데이터로 있습니다 (`**굵게**`, `` `코드` ``만 지원). 분량·제목 길이는 `docs/prompts/platforms/*.md`와 맞추고, 애드포스트 가입 기준처럼 자주 바뀌는 정책은 숫자로 단정하지 않고 공식 안내 링크로 보냅니다.
- 시작한 웹 서버는 데스크톱 앱을 꺼도 계속 돕니다 (`stop_web`으로 종료). PID·로그는 `.toolhub/`에 남습니다.
- `git worktree list`에 실행 폴더가 보이는 것은 정상입니다. `git worktree remove --force ~/.toolhub/runtime/toolhub`로 지우면 다음 `open_web` 때 다시 만듭니다.

## 크롬 확장 (`extension/`)

- 스마트에디터 ONE은 글 내용을 내부 모델로 관리해서 DOM을 직접 고치면 저장 때 사라질 수 있습니다. 그래서 툴바 버튼(굵게·글자 크기·글자색·배경색)을 `click()`으로 대신 누릅니다. 굵게는 이미 눌려 있으면(`se-is-selected`) 다시 누르지 않습니다.
- 쓰는 방법은 세 가지입니다. 드래그 감지가 실제 에디터에서 안 될 수 있어(첫 시험에서 안 뜸) 감지에 기대지 않는 방법을 함께 둡니다.
  - **서식 도구**: 에디터가 있는 프레임(500×300 이상, `.se-content`나 편집 가능한 영역이 있는 곳)에만 오른쪽 아래에 항상 띄웁니다. 에디터는 늦게 뜨므로 1초마다 찾다가 찾으면 멈춥니다. 이게 안 보이면 확장이 그 프레임에 못 들어간 것이라 원인 구분에도 씁니다.
  - **단축키**: `commands`(⌥⇧1·2·3)는 브라우저가 먼저 받아 에디터가 키를 가로채도 동작합니다. background가 탭으로 보내고, `document.hasFocus()`인 에디터 프레임만 처리합니다.
  - **드래그 막대**: mouseup·selectionchange를 캡처 단계에서 듣고, 선택이 본문(`.se-content` 또는 편집 가능한 영역) 안일 때 띄웁니다.
- 막대는 모두 `mousedown`을 막아 눌러도 선택이 풀리지 않게 합니다. 선택이 없으면 누르라고 안내합니다. 에디터가 iframe(주소 없는 프레임 포함) 안에 있어서 `all_frames`와 `match_origin_as_fallback`으로 넣습니다.
- 에디터 클래스 이름은 로그인 없이 확인할 수 없어 공개 자료 기준으로 잡았습니다. **실제 에디터에서 처음 확인할 때나 네이버가 에디터를 바꿨을 때**는 패널의 "진단 정보 복사" 결과(프레임별 확장 동작 여부·편집 영역·선택 상태, 툴바 버튼 클래스, 드롭다운을 잠깐 열어 본 항목·팔레트 색)를 보고 `naver-editor.js`의 `SELECTORS`만 고치면 됩니다.
- 같은 구조의 모의 페이지에서 드래그 → 막대 → 버튼 순서(크기 19 → 굵게, 팔레트 가까운 색), 선택 유지, 본문 밖 선택 무시, 버튼 없음 안내, 진단 수집을 헤드리스 크롬으로 확인했습니다 (2026-11-01).

### 이미지 모음 (사이드 패널)

이미지는 Gemini·ChatGPT 등에서 만들고, 이 패널은 캡처·저장 없이 모아서 에디터에 붙여넣는 용도입니다 (이미지 생성은 하지 않음).

- 자동 담기: `content-ai.js`(Gemini·AI Studio·ChatGPT)가 이미지 `load` 이벤트를 캡처 단계에서 받아, 주소가 2.5초 동안 그대로이고(생성 중 흐린 미리보기 제외) 400×400 이상인 이미지만 페이지 안에서 data URL로 읽어 background에 보냅니다. background는 패널이 연결(`runtime.connect` 포트)돼 있고 `autoCollect`가 켜져 있을 때만 담습니다. 같은 이미지가 다시 그려지면 원래 주소(`source`)로 중복을 거릅니다.
- 오른쪽 클릭 메뉴(`contextMenus`, 이미지에만)는 `background.js`가 받아 담습니다. 패널 열기(`sidePanel.open`)는 사용자가 누른 직후에만 허용돼서 이미지를 받기 전에 먼저 엽니다.
- 받는 순서: 확장 권한(`<all_urls>`)으로 직접 `fetch` → 실패하거나 `blob:` 주소면 `scripting.executeScript`로 그 페이지(프레임을 모르면 모든 프레임) 안에서 읽습니다. Gemini 등은 생성 이미지를 페이지 안에서만 유효한 `blob:` 주소로 띄웁니다.
- 패널에 붙여넣기·끌어다 놓기는 이미지 파일 → HTML 속 `<img>`의 src 속성 → uri-list → 텍스트 순으로 찾고, 패널이 직접 못 받는 주소(`blob:`, 로그인 필요)는 background가 지금 탭에서 읽습니다.
- 담기(추가)는 background의 큐로 차례로 저장해 동시에 써서 빠지는 일을 막습니다. 패널·background 모두 `storage.local`의 `shelf`를 쓰고 패널은 `storage.onChanged`로 다시 그립니다.
- 클립보드는 PNG만 받아서 복사할 때 `OffscreenCanvas`로 PNG로 바꿉니다. 최근 30장은 data URL로 두고 `unlimitedStorage`로 용량 제한을 풉니다.
- 확인 (2026-11-01): Chrome for Testing에 확장을 실제로 설치(`--remote-debugging-pipe --enable-unsafe-extension-debugging` + CDP `Extensions.loadUnpacked`. 일반 크롬은 `--load-extension`을 막음)하고, `gemini.google.com` 요청을 가짜 페이지로 바꿔 자동 담기(작은 아이콘 제외), 다시 그려져도 중복 없음, `blob:` 이미지 끌어다 놓기, 자동 담기 끄기를 확인했습니다. 실제 Gemini·ChatGPT 화면 구조는 로그인이 필요해 설치 후 확인이 필요합니다.

## 이미지 5장 프롬프트 (`image-prompt.ts`)

초안 화면에서 Gemini에 붙여넣을 요청문을 만듭니다. 초안의 `[이미지: …]`는 대부분 직접 캡처할 화면·표라서 AI가 그리면 사실과 다른 가짜 화면이 되므로 쓰지 않고, **대표 1장 + 소제목별 4장**(소제목이 많으면 글 전체에 고르게, 적으면 주제로 채움)으로 요청합니다. 소제목은 네이버 본문의 `■`, 마크다운 `##`·`###`, HTML `h2`·`h3`에서 찾고, 소제목 아래 첫 문단(표시 자리 제외)을 장면 단서로 붙입니다. 공통 규칙: 가로 4:3, 색감 통일, 한국 배경, 글자·로고·가짜 화면·실존 인물 금지, 이미지마다 alt 한 줄.

블로그에 맞게 다듬은 점 (2026-11-02):
- **숫자 걷어내기**: 장면 단서에 금액·날짜가 있으면 Gemini가 달력·그래프·숫자를 그려 넣어 한글이 깨지기 쉬워서, 소제목은 단위가 붙은 숫자만 지우고(4대보험 같은 이름은 유지) 첫 문단은 숫자가 든 문장을 통째로 뺍니다.
- **장면 정하기**: 세금·제도처럼 추상적인 내용은 그 상황의 사람·사물로 표현하고, 5장은 사물 가까이·사람 상반신·공간 전체로 구도를 섞게 합니다 (같은 "노트북 앞 사람" 5장 방지).
- **AI 티 줄이기(사진)**: 스마트폰으로 찍은 듯한 자연광 사진, 과한 보정·번들거림 금지, 얼굴 정면·손가락 클로즈업 피하기, 노트북·휴대폰 화면은 흐리게.
- **한 번에 5장**: "다음"을 매번 치지 않도록 한 답변에서 1~5번을 모두 생성하라고 요청합니다. 실제로 한 번에 나오는지는 Gemini 쪽 동작이라 확인이 필요합니다.

## 웹 주소

일정 관리는 `/tasks?view=today|week|inbox|all|done|board|calendar[&project=ID|&label=태그][&task=번호]`, 블로그는 `/blog`, `/blog/discover?q=주제,주제`, `/blog/history`, `/blog/keyword?q=`, `/blog/drafts`, `/blog/drafts/view?file=`, `/blog/thumbnail?title=`. 예전 주소(`/history`, `/keyword`, `/drafts`, `/thumbnail`)는 `next.config.ts`에서 새 주소로 보냅니다.

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
