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
│       ├── brief.ts           # 글쓰기 브리프·글감 브리핑 생성
│       ├── platforms.ts       # 플랫폼·글 유형·구성 변형 (브라우저에서도 사용)
│       ├── drafts.ts          # 초안 목록·파싱·고치기
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
│   │   ├── layout.tsx, sidebar.tsx, icons.tsx  # 사이드바 레이아웃
│   │   ├── add-task-popover.tsx  # 블로그 화면의 "할 일로 추가"
│   │   ├── tasks/             # 일정 관리 (목록·보드·캘린더·상세 패널·빠른 추가)
│   │   ├── blog/              # 블로그 (page.tsx 실시간, history, keyword, drafts, thumbnail)
│   │   └── api/               # tasks, projects, brief, stats/enrich, health
│   └── lib/                   # 데이터 경로, 입력 검증, 미리보기, 검색량 백그라운드 채우기
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

## 테스트

외부 API를 부르지 않는 핵심 로직을 테스트합니다. 테스트 파일은 대상 파일 옆에 `*.test.ts`로 둡니다. 기능을 고치거나 버그를 찾으면 그 경우를 테스트에 추가하세요.

| 위치 | 테스트하는 것 |
|---|---|
| `packages/tasks` | 자연어 빠른 추가 해석, 날짜·반복 계산, 보기·그룹·정렬, 저장소(반복 완료·프로젝트 삭제·여러 프로세스 동시 쓰기) |
| `packages/collector` | 추이 해석·포화도·시즌 알림 날짜, 브리프·글감 브리핑 형식, 초안 파싱·도입 문장·고치기(백업·경로 차단), 키워드 병합·기간 집계 |
| `apps/web/lib` | 할 일 수정 요청 검증, 초안 미리보기 |

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

### 일정 `data/tasks.json`

`{ nextId, tasks, projects }`. 할 일은 `id`(번호), `title`, `notes`, `status`(todo·in_progress·done·canceled), `priority`(0 없음·1 긴급·2 높음·3 보통·4 낮음), `dueDate`, `dueTime`, `projectId`, `labels`, `repeat`(daily·weekly·monthly·yearly), `subtasks`, `link`, `createdAt`, `updatedAt`, `completedAt`.

웹과 MCP는 서로 다른 프로세스에서 이 파일을 고치므로 `tasks.json.lock` 잠금 파일로 읽기-수정-쓰기를 순서대로 처리합니다. 10초 넘은 잠금은 비정상 종료로 보고 풉니다.

### 초안 `drafts/YYYY-MM-DD-<키워드>-<플랫폼>[-n].md`

내용 형식은 `docs/prompts/writing.md`의 "출력 형식"(`## 제목 후보`, `## 메타 설명`, `## 태그`, `## 본문`(코드 블록), `## 스레드 홍보글` 등)을 따릅니다. `update_draft`로 고치면 이전 버전이 `drafts/.history/`에 남습니다.

## 네이버 API 호출 방식

- **검색광고 API**는 호출 한도가 낮아(429) 요청 사이에 1초 간격을 두고, 429면 2초·4초 뒤 재시도합니다. 힌트 키워드는 한 번에 5개까지라, 롱테일 키워드는 각 단어도 함께 힌트로 넣어 연관 키워드를 넓게 받은 뒤 관련도 순으로 정렬합니다.
- **키워드 기록의 검색량**은 렌더링을 막지 않도록 브라우저가 `/api/stats/enrich`로 뒤에서 채우고, 실시간 화면에서 새 키워드가 기록되면 서버가 바로 백그라운드로 시작합니다. 같은 날짜는 한 번만 돌도록 진행 중인 작업을 공유합니다.
- **API HUB** 조사는 병렬로 하고, 하나가 실패해도 나머지는 채웁니다.

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

**블로그**: `get_live_keywords`, `get_daily_keywords`, `analyze_keyword`, `research_keyword`, `search_places`, `get_shopping_trend`, `get_writing_rules`, `get_writing_brief`, `save_draft`, `list_drafts`, `read_draft`, `update_draft`

**웹**: `open_web`, `stop_web` · **프롬프트**: `blog_draft`, `pick_topics`

stdio 전송은 stdout을 프로토콜에 쓰므로 서버 코드에서 `console.log`를 쓰면 안 됩니다 (로그는 `console.error`).

### `open_web`이 웹을 띄우는 방식

| | 개발용 `npm run web` | 사용용 `open_web` |
|---|---|---|
| 주소 | http://localhost:3000 | http://localhost:3100 |
| 코드 | 작업 중인 코드 | **로컬 main 브랜치의 최신 커밋** |
| 실행 위치 | 이 저장소 | `~/.toolhub/runtime/toolhub` (git worktree) |
| 데이터·키 | `data/`, `drafts/`, `.env.local` | 같은 파일을 공유 |

- main에 커밋하면 다음 `open_web` 때 실행 폴더를 새 커밋으로 맞추고 재시작합니다. `package-lock.json`이 바뀌었으면 `npm install`을 다시 하고, 45초를 넘기면 "준비 중"으로 먼저 응답한 뒤 다음 호출에서 이어받습니다.
- 시작한 웹 서버는 데스크톱 앱을 꺼도 계속 돕니다 (`stop_web`으로 종료). PID·로그는 `.toolhub/`에 남습니다.
- `git worktree list`에 실행 폴더가 보이는 것은 정상입니다. `git worktree remove --force ~/.toolhub/runtime/toolhub`로 지우면 다음 `open_web` 때 다시 만듭니다.

## 웹 주소

일정 관리는 `/tasks?view=today|week|inbox|all|done|board|calendar[&project=ID|&label=태그][&task=번호]`, 블로그는 `/blog`, `/blog/history`, `/blog/keyword?q=`, `/blog/drafts`, `/blog/drafts/view?file=`, `/blog/thumbnail?title=`. 예전 주소(`/history`, `/keyword`, `/drafts`, `/thumbnail`)는 `next.config.ts`에서 새 주소로 보냅니다.

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
