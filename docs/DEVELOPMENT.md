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
│       ├── research.ts        # 추이 해석·포화도·최근 7일(급상승)·시즌 알림 날짜·키워드 조사 묶음
│       ├── pivot.ts           # 연관어로 돌리기 (경쟁 센 대표 키워드 → 경쟁 글 적은 연관어) — 브리프, MCP find_pivot_keywords, 웹 키워드 분석
│       ├── batch.ts           # 키워드 여러 개 묶음 분석 (목록 정리·표) — MCP analyze_keywords
│       ├── discover.ts        # 주제로 키워드 찾기 (후보 고르기·추천·최근 주제) — 웹 키워드 찾기, MCP discover_keywords
│       ├── brief.ts           # 글쓰기 브리프·글감 브리핑 생성
│       ├── platforms.ts       # 플랫폼·글 유형·구성 변형 (브라우저에서도 사용)
│       ├── drafts.ts          # 초안 목록·파싱·고치기
│       ├── draft-bundle.ts    # 초안 내보내기·가져오기 (JSON 묶음, 덮어쓰지 않음)
│       ├── image-prompt.ts    # 초안 → Gemini용 본문 이미지 5장 요청문
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
│   ├── lib.js                 # 색·설정·이미지 모음(순서 목록·중복·파일 이름) 순수 함수 (테스트 대상)
│   ├── shelf-store.js         # 이미지 모음 저장소: 원본·미리보기는 IndexedDB, 순서 목록은 storage.local (background·패널 공용)
│   ├── naver-editor.js        # 스마트에디터 ONE 버튼 위치(SELECTORS)와 조작·진단
│   ├── content.js             # 서식 묶음 버튼: 항상 뜨는 서식 도구·단축키·드래그 막대 (Shadow DOM)
│   ├── content-ai.js          # Gemini·ChatGPT·AI Studio에서 새 생성 이미지를 패널로 자동 전송
│   ├── sidepanel.*            # 이미지 모음 패널 (붙여넣기·끌어다 놓기·복사·저장·삽입) + 설정·진단 정보 복사 링크
│   ├── connect.js             # 쇼핑 커넥트: 브랜드커넥트 상품 페이지 글자 해석·요청문 만들기 순수 함수 (테스트 대상)
│   ├── slicer.js              # 긴 상세 이미지를 여백·단색 띠에서 자르는 위치 계산, 담을 이미지 고르기 (테스트 대상)
│   ├── sidepanel-connect.js   # 패널의 쇼핑 커넥트 영역 (상품 페이지에서만 보임): 요청문 복사, 상세 이미지 고르기
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
- MCP 서버는 루트 `package.json`의 버전으로 자신을 알립니다. Claude 앱 화면에는 이 값이 보이지 않아서 `get_version` 도구를 둡니다(2026-11-17): 서버가 시작될 때의 버전·main 커밋(`STARTED`)과 지금 저장소의 버전·커밋을 비교합니다. 커밋이 다르면 Claude 앱을 다시 켜야 새 도구·규칙이 적용된다고 알려 줍니다(Claude 앱은 앱을 다시 켤 때만 MCP 서버를 새로 띄움). 3100(open_web)·3000(npm run web) 웹의 `/api/health`도 1.5초 안에 물어 함께 보여 줍니다.
- 크롬 확장은 `chrome://extensions`와 패널 맨 아래(`v버전`, `chrome.runtime.getManifest()`)에 같은 번호가 보입니다.
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
| `extension` | 색 해석, 팔레트에서 가장 가까운 색 고르기, 설정 병합, 이미지 모음의 중복 제거(해시·원래 주소)·최대 200장·id 겹침 방지·빠진 이미지 찾기·예전 방식 합치기·에디터 문단의 이미지 자리 판별(대표 썸네일 제외)·자동 담기 크기 기준·파일 이름 (`*.test.js`) |

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
- `YYYY-MM-DD`: 그날의 덩어리 칸 `{ chunks: [{ done, note, group, link, time? }] }` (완료·메모·그룹 id·연결된 목표 id·시간 라벨). `time`은 자유 글자이고 적었을 때만 저장해서, 안 쓰면 예전과 같은 모양입니다. 화면은 기본 2칸(`BASE_CHUNKS`)을 늘 보여 주고 최대 6칸(`MAX_CHUNKS`)까지 늘립니다. 처음 모양 `{ b1, b2, n1, n2, g1, g2, l1, l2 }`도 읽고, 그날을 고치면 새 모양으로 저장합니다.
- `w-<월요일 날짜>`: 그 주 목표 `{ goals: [{ id, t, g, d, done }], title?, plan?: [{ id, t, done }] }`. `d`는 0~6(월~일), -1은 요일 미배정입니다. **목표 배열 순서가 화면 순서**입니다. 카드 위에 놓으면 `moveGoal`이 그 카드 앞·뒤로 옮기고, 다른 칸이면 그룹·요일도 `updateGoal`로 바꿉니다. 자동 카드는 순서만 바뀌고 그룹은 덩어리 쪽이 바뀝니다. 그룹 칸은 예전에 요일순으로 정렬했지만, 사람이 정한 순서를 지키려고 정렬을 뺐습니다. `title`·`plan`은 그 주의 큰 목표와 상세 계획 체크리스트입니다(상태의 `plans`). 쓴 주에만 저장해서, 쓰지 않은 주는 예전 모양 그대로입니다.
- `cfg`: 설정 `{ groups: [{ id, name, c }], dayEnd }`. `c`는 `GROUP_COLORS` 번호, `dayEnd`는 하루가 끝나는 시각(0=자정 ~ 8시, 그 전까지는 전날 기록)입니다. 이 문서가 없으면 공방·집·SNS와 자정을 씁니다.

화면은 바뀐 문서만 `PUT /api/chunks/<id>`로 통째로 저장합니다(메모는 입력이 0.7초 멈추면 저장). 덩어리에 메모와 그룹이 모두 있으면 그 주 요일 칸에 `c-<날짜>-<칸 번호>` 카드가 자동으로 생깁니다. 가운데 칸을 지우면 뒤 칸 번호가 당겨지므로 최대 칸 수까지 모든 자동 카드를 다시 맞춥니다. 자동 카드는 그날 덩어리와 짝이라 `updateGoal`·`removeGoal`이 카드 대신 덩어리 칸을 고칩니다(이름→메모, 그룹, 완료; 삭제는 그룹 비우기). 요일 변경·다음 주로는 무시합니다. 제안서(Claude 아티팩트) 시절에 쓰던 기록도 문서 모양이 같아서 이 파일에 그대로 넣으면 됩니다.

### 초안 `drafts/YYYY-MM-DD-<키워드>-<플랫폼>[-home][-n].md`

- **날짜는 발행일**입니다 (2026-11-17). 크리에이터 어드바이저 트렌드를 보고 그날 초안을 한꺼번에 만드는데, 행사 1~3일 전에 올릴 홈판형은 미리 써 둬야 합니다. 발행일을 따로 저장하는 대신 파일 날짜를 발행일로 써서, 날짜별 초안 목록이 곧 "그날 올릴 글"이 되게 했습니다. 만든 날은 파일 수정 시각으로 알 수 있습니다. `save_draft`의 `date`(생략하면 오늘)가 이 날짜이고, `publishDateProblem`이 지난 날과 14일(`PUBLISH_AHEAD_DAYS`)보다 먼 날을 거절합니다.
- **`-home`은 네이버 홈판형**입니다 (`NaverFormat`: `search` 검색형 | `home` 홈판형). 목록이 파일을 열지 않고 형식을 알게 파일 이름에 둡니다. `draftNameInfo`·`draftPlatform`·`draftFormat`이 읽고, `draftFileBase`가 만듭니다 (`-home`은 네이버에만 붙음).

내용 형식은 `docs/prompts/writing.md`의 "출력 형식"(`## 제목 후보`, `## 메타 설명`, `## 태그`, `## 본문`(코드 블록), `## 스레드 홍보글` 등)을 따릅니다. `update_draft`로 고치면 이전 버전이 `drafts/.history/`에 남습니다.

**분량 (`draft-length.ts`)**: 모델은 글자 수를 세지 못하고 범위만 주면 최소에 맞춰 써서(2026-11-03 네이버 초안 16개 중 15개가 1,466~1,648자), 플랫폼 규칙에 범위 가운데의 목표와 소제목별 배분을 두고(`BODY_LENGTH`, `platforms/*.md`와 같게 유지), 저장할 때 실제 글자 수를 잽니다. `bodyLength`는 공백 포함, 줄바꿈·이미지 자리·`■`·`★`·표 머리 표시·HTML 태그 제외. MCP `save_draft`·`update_draft`는 결과에 `lengthFeedback`(목표의 90% 미만이면 보완 후 `update_draft`로 다시 저장, 최대 초과면 줄이기)을 붙이고, 파일을 직접 쓰는 blog-draft 스킬은 `npm run --silent draft-length -- <파일>`로 잽니다.

네이버 홈판형은 범위는 같고 목표만 1,800자입니다(`HOME_BODY_LENGTH`). 피드에서 들어온 사람은 결론이 늦으면 나가서, 2,000자를 맞추려고 소제목을 늘리지 않게 했습니다. 모자랄 때 안내도 "소제목을 늘리지 말고 판단의 근거·상황별 경우를 더하라"로 다릅니다.

**제목 (`title-check.ts`)**: 하루 15편 안팎을 쓰면 제목 끝맺음이 `정리`·`한눈에`·`확인할 것`으로 몰렸습니다(2026-11-13~15 초안 40개 대부분). `save_draft`·`update_draft`는 분량 안내 뒤에 `titleFeedback`을 붙입니다: 제목 후보 중 금지 끝맺음(`BANNED_TITLE_ENDINGS`, 문장부호 무시, 긴 것 먼저)이 있거나, 추천 제목의 마지막 낱말이 같은 플랫폼 최근 초안 20개(이 초안 제외, 최근 수정 순) 중 3개 이상과 같으면 알립니다. 두 번까지는 우연으로 봅니다. 금지 목록은 `writing.md` 출력 형식·`platforms/naver.md` "제목"과 같게 둡니다.

쇼핑 커넥트 글은 플랫폼과 상관없이 `CONNECT_BODY_LENGTH`(목표 3,500자, 3,000~4,000)로 잽니다. 초안 파일에는 글 유형이 없어서 `isConnectBody`가 본문으로 알아봅니다: 대가성 문구(`CONNECT_DISCLOSURE`, 공백·쉼표·따옴표 차이 무시)나 `[링크: 쇼핑 커넥트]`·"쇼핑 커넥트 활동"이 있으면 쇼핑 커넥트 글입니다. 그런데 대가성 문구가 글자 그대로 없으면 `lengthFeedback`이 분량 안내 앞에 "대가성 문구가 없습니다"를 붙입니다. 쇼핑 커넥트를 소개하는 정보 글에 "쇼핑 커넥트 활동"이 들어가면 쇼핑 커넥트 글로 잘못 볼 수 있지만, 드문 경우라 받아들였습니다.

**정책: 발행됨 초안은 고치지 않습니다.** 발행한 글은 다시 쓰지 않아 고쳐도 토큰 낭비라서, `update_draft`는 `draftEditBlocked`(`draft-status.ts`)로 상태가 발행됨이면 거부하고, `read_draft`는 내용 앞에 "발행됨 초안: 고치지 않는다"를 붙입니다 (인스타 재가공 같은 읽기는 허용). MCP 서버 안내문과 `docs/prompts/project-instructions.md`(claude.ai 프로젝트), 루트 `CLAUDE.md`(Claude Code에서 파일을 직접 고칠 때)에도 같은 정책을 적어 둡니다.

네이버 본문은 일반 텍스트(`■` 소제목, `★` 강조, `[표: 열 | 열]` + `값 | 값` 줄)입니다. 초안 화면의 **서식 포함 복사**는 `apps/web/lib/preview.ts`의 `naverPasteHtml`로 HTML을 만들어 `text/html`과 원래 텍스트(`text/plain`)를 함께 클립보드에 넣습니다. 붙여넣을 때 클래스·스타일시트는 따라가지 않으므로 서식은 태그(`<b>`, `font-size:19px` 인라인 스타일, 선을 인라인으로 넣은 `<table>`)에 직접 넣고, 소제목은 `<p>` 안의 굵고 큰 글씨로 넣습니다. 2026-11-03에 실제로 붙여넣어 보니 굵게·크기·표는 살아 있었지만, `<h3>`로 감싸도 네이버 "소제목" 문단 서식으로는 바뀌지 않았습니다. 진짜 소제목은 크롬 확장이 붙여넣은 뒤에 입힙니다. 텍스트의 빈 줄처럼 블록 사이에 빈 문단(`<p><br></p>`)을 둡니다. 사람이 채울 자리는 형광펜 없이 글자 그대로 둡니다.

예약 발행 시간은 `apps/web/app/blog/schedule/`에 있습니다. 뽑은 시간과 조건은 `saved.ts`가 `localStorage`의 `toolhub:schedule-times`에 두고, 저장할 때 같은 탭에 `toolhub:schedule-times` 창 이벤트를 보냅니다 (`storage` 이벤트는 다른 탭에만 오므로). 사이드 메뉴 맨 아래의 `schedule-widget.tsx`가 이 값을 늘 보여 주고(1분마다 지남·다음 표시 갱신, `scheduleDate`로 실제 시각 계산), 같은 조건으로 다시 뽑거나 `지금부터`(바로 올린 시각만 `nowStart()`로 바꿈)로 뽑아 저장합니다. 예약 발행 화면(`schedule-picker.tsx`)은 열 때 기준 날짜가 오늘 이후면 저장된 값을 그대로 보여 주고, 이벤트를 받아 사이드 메뉴에서 다시 뽑은 시간으로 맞춥니다. 조건(바로 올린 시각·개수·간격)이 마지막으로 뽑거나 복원한 조건과 다를 때만 다시 뽑아서, 복원할 때 시간이 바뀌지 않습니다.

초안 화면의 썸네일은 `/blog/thumbnail`의 `ThumbnailMaker`를 그대로 씁니다 (`apps/web/app/blog/drafts/view/thumbnail-panel.tsx`). 헤더의 버튼과 본문 열의 `<details>` 패널은 떨어져 있어서 창 이벤트(`toolhub:open-thumbnail`)로 열고 스크롤합니다. 썸네일의 **랜덤 조합**은 `apps/web/lib/random-colors.ts`가 배경 분위기(파스텔·어두운 색·선명한 색)와 색상환 관계(보색·분할 보색·삼각·유사색)로 뽑고, WCAG 대비가 글자 7:1·강조 3:1 이상인 조합만 씁니다 (평균 1.6번 만에 나옴, 50번 실패하면 기본 조합). 부제·라벨·블로그 이름·스타일은 `localStorage`의 `toolhub:thumbnail-brand`에 기억하고(주소의 `subtitle`·`label`이 있으면 그 값이 먼저, 고치면 기억), 제목만 초안마다 새로 채웁니다. 캔버스와 글꼴은 처음 펼칠 때 그리기 시작하고, 접어도 언마운트하지 않아 고친 제목이 남습니다. 태그 **전체 복사**는 네이버면 화면에 보이는 `#태그 #태그`, 티스토리·Blogger면 쉼표로 잇습니다. 네이버 태그 칸은 띄어쓰기에서 태그를 끊으므로 `parseDraft`가 태그 안의 공백을 지우고 겹치는 태그를 합칩니다 (규칙 문서에도 붙여 쓰라고 적었지만, 이미 쓴 초안과 모델 실수를 함께 막기 위해).

### 블로그 계정 `data/accounts.json`

`{ "accounts": [{ id, name, topics }] }`. 계정이 여러 개일 때 트렌드 상위를 나눠 쓰면 계정이 늘수록 아래쪽 약한 키워드까지 내려갑니다(계정 3개 → 1~15위, 6개 → 1~30위). 그래서 계정마다 분야를 정해 각자 자기 분야의 1~5위를 쓰게 했습니다(2026-11-17). 계정마다 주제가 일관되면 홈판의 주제 전문성에도 유리합니다. **계정이 없으면 모든 흐름이 예전과 같습니다.**

- `id`는 `acc-xxxxxxxx`(`newAccountId`)라 이름을 바꿔도 초안 기록이 유지됩니다. 이름은 20자, 계정은 `ACCOUNT_MAX`(10)개까지입니다. 저장할 때 `sanitizeAccounts`가 정해진 필드만 남기고 이름·id 중복을 거절합니다.
- `topics`는 네이버 블로그 주제 분류 32개(`BLOG_TOPIC_GROUPS`)에서 고릅니다. 직접 지은 분야 대신 이 분류를 쓴 이유는 크리에이터 어드바이저 트렌드가 같은 분류라 키워드를 계정에 나누는 기준이 흔들리지 않기 때문입니다.
- 초안이 어느 계정 것인지는 초안 파일 이름이 아니라 `data/draft-status.json`의 `account`·`topic`에 둡니다. 파일 이름 규칙(발행일·형식)을 또 바꾸지 않고, 내보내기·가져오기(`sanitizeStatusEntry`)와 초안 삭제(`removeDraftStatus`)도 그대로 따라오게 하려는 것입니다.
- 화면은 `/blog/accounts`(`accounts-editor.tsx`, `PUT /api/accounts`로 통째로 저장)이고, 계정마다 분야별 초안·발행 수(`accountTopicStats`)를 보여 줍니다. 분야가 계정에 맞는지는 지금은 이 편수로만 봅니다. 계정별 조회수 기록은 아직 없습니다.
- MCP
  - `get_writing_rules(task=planning)`은 계정이 있으면 `accountsPlanningNote`(계정·분야와 나누는 규칙)를 끝에 붙입니다.
  - `save_draft`는 `account`(이름이나 id, `findAccount`)와 `topic`을 받아 상태 기록에 넣습니다. 모르는 계정이면 등록된 계정을 알려 주며 거절합니다.
  - `get_writing_rules(task=planning)`의 계정 안내는 "직접 나누지 말고 `assign_account_keywords`로"입니다.
  - `list_drafts`에는 `계정·분야` 칸과 `account` 거르기가 있습니다.
  - **계정 겹침 점검** (`accountOverlapFeedback`): 저장·수정 결과에 붙습니다. 다른 계정에 같은 키워드·같은 플랫폼 초안이 있으면, 형식이 같은지, 추천 제목이 비슷한지(두 글자 묶음 겹침 `textSimilarity` 0.5 이상), 도입 첫 문장이 비슷한지(0.4 이상) 봅니다. 계정끼리 같은 키워드는 허용합니다(홈판 경쟁력이 있는 키워드는 겹치는 게 나을 수 있음). 다만 같은 사람이 비슷한 글을 여러 계정에 올리면 유사문서로 함께 밀리므로 글의 형태가 다르게 나오게 합니다.
- **계정별 글감 나누기** (`account-plan.ts`, `account-plan-store.ts`, MCP `assign_account_keywords`): 규칙 문장만으로는 Claude가 계정당 편수를 어기거나 계정을 빠뜨려서, 나누기와 개수 세기를 코드로 옮겼습니다. Claude는 우선순위(넘기는 순서)와 키워드마다 분야·형식·발행일만 정합니다.
  - `accountQuotas`: 편수 ÷ 계정 수, 나머지는 앞 계정부터.
  - `assignAccountKeywords`: 순서대로 그 분야를 맡은 계정(분야를 안 고른 계정은 모든 분야) 중 몫이 남고 적게 받은 계정에 넣습니다. 몫이 찼거나 맡은 계정이 없거나 이미 계획에 있으면 이유와 함께 남깁니다. 다시 부르면 오늘 계획에 이어 넣고(모자란 계정 채우기), `reset`이면 새로 나눕니다.
  - 계획은 만든 날(KST)별로 `data/account-plans.json`에 둡니다(최근 14일). 행사 전 홈판형은 파일 날짜(발행일)가 뒤라서, 발행일이 아니라 만든 날 계획으로 세야 "오늘 5편"이 맞습니다.
  - `save_draft`: 계정이 등록돼 있으면 네이버 초안은 `account`가 없을 때 거절합니다(계정은 네이버 블로그 계정이라 티스토리·Blogger는 그대로). 오늘 계획이 있으면 `checkAgainstPlan`으로 계정 몫·형식·발행일·편수를 대조해 현황과 경고를 붙입니다. 연관어로 메인 키워드를 바꾸면 계획 키워드와 달라지므로 `plan_keyword`로 원래 키워드를 받습니다. 어긋나도 거절하지 않고 경고만 합니다(연관어·사용자 요청으로 바뀌는 경우가 있어서).
- **계정 썸네일** (2026-11-17, `thumbnail-style.ts`): 썸네일이 하루 15편의 병목이라, 계정마다 스타일을 두고 초안 채우기 때 자동으로 넣게 했습니다.
  - `BlogAccount.thumbnail`(`ThumbnailStyle`: template·fontId·colors·blogName·label·overlay·backgrounds). 예전 `accounts.json`에 없으면 `sanitizeThumbnailStyle`이 기본값을 넣습니다.
  - 배경 이미지는 `data/thumbnails/<계정 id>/bg-<hex>.<png|jpg|webp>`(`addBackground`·`removeBackground`, `/api/accounts/background` GET·POST·DELETE). 배경 목록은 올리기·지우기로만 바뀌고, `writeAccounts`(계정 목록 통째 저장)는 디스크의 목록을 지킵니다(화면이 오래된 목록으로 저장해도 빠지지 않게). 계정을 지우면 그 폴더도 지웁니다.
  - 어느 배경을 쓸지는 `pickBackground`: 초안에서 고른 배경 → 없으면 파일 이름 해시로 돌려 고름(한 장이면 고정, 같은 초안은 늘 같음), `none`이면 단색.
  - 문구는 `thumbnailText`: 초안 기록의 `thumbnail.text` → 대표 썸네일 표시의 `문구:`(` / `는 줄바꿈) → 추천 제목. 작성 규칙(writing.md)이 `문구:`를 2줄로 쓰게 합니다.
  - 그리기는 웹 `draw.ts`(배경 이미지는 꽉 차게 잘라 그리고 배경색을 `overlay`만큼 덮음)와 `account-thumbnail.tsx`(`renderAccountThumbnail`, 1080×1080). 계정 화면·초안 화면 미리보기와 확장이 같은 코드·글꼴을 씁니다.
  - **확장이 받는 방법**: 초안 채우기는 본문을 붙여넣는 동안 `/blog/thumbnail/render?file=`을 화면 밖 iframe으로 열고, 그 화면이 그린 PNG(data URL)를 `postMessage`로 받습니다(`e.origin`이 찾은 웹 주소일 때만). 확장에 그리기 코드·글꼴을 따로 두지 않으려는 것입니다. 배경 이미지는 웹과 같은 주소에서 불러와 캔버스가 오염되지 않습니다. 소제목 정리 뒤 클립보드에 PNG를 쓰고 `insertClipboardImage(tab, "thumbnail")`(패널 이미지 삽입과 같은 드래그 → 지우기 → 확인 → 붙여넣기, `locateImageSlot(kind)`)로 대표 썸네일 자리에 넣습니다. 썸네일이 실패해도 제목·본문은 그대로 두고 이유만 알립니다. 패널의 `썸네일도 자동으로 넣기`(`draftsThumbnail`)로 끕니다.
  - 확인 (2026-11-17): Chrome for Testing에서 가짜 글쓰기 화면(이미지 붙여넣기 흉내 추가)과 실제 3000번 웹의 렌더 화면으로 제목·본문·소제목·태그에 이어 PNG 썸네일이 대표 썸네일 자리에 들어가고 본문 이미지 자리는 남는 것을 확인했습니다. 배경 이미지를 얹은 그림은 실제 데이터를 바꾸지 않으려고 자동 확인하지 않았습니다.
- 초안 목록은 `모든 계정 · 계정들 · 계정 없음` 탭(`matchesAccount`, `localStorage`의 `toolhub:draft-account`)으로 거르고, 줄을 펼치면 계정·분야를 바꿀 수 있습니다(`PUT /api/drafts/status`의 `account`·`topic`, 빈 문자열은 지움).

### 초안 상태 `data/draft-status.json`

초안 파일(.md)은 Claude가 `update_draft`로 통째로 고쳐 쓰므로 상태를 파일 안에 두지 않고 따로 둡니다. `{ "drafts": { "<초안 파일 이름>": { status, url?, at?, answers?, account?, topic? } } }`.

| 필드 | 설명 |
|---|---|
| `status` | `draft`(초안) · `published`(발행됨). 기록이 없으면 초안. 예전에 저장한 `scheduled`(예약됨, 없앤 상태)는 발행됨으로 봄 (`effectiveStatus`). 새로 저장할 수는 없음 |
| `url` | 발행한 글 주소. http(s)만 (`normalizePostUrl`). 지식iN 답변 링크로 씀 |
| `at` | 발행 시각 (ISO). 발행됨으로 바꿀 때 비어 있으면 그 시각 |
| `answers` | 이 글로 답한 지식iN 질문 `{ link, title, answeredAt }` (같은 질문 주소는 하나만) |
| `account` | 이 초안을 올릴 블로그 계정 id (`data/accounts.json`). MCP `save_draft`의 `account`나 초안 목록에서 정함. 지운 계정 id는 계정 없음으로 보임 |
| `topic` | 분야 (네이버 블로그 주제 분류, `BLOG_TOPICS`). 계정 탭의 분야별 집계에 씀 |

**초안 삭제**: 목록 맨 앞 칸에서 고르고 필터 줄의 `선택 삭제`를 누르면, 초안마다 `DELETE /api/drafts/content?file=`을 차례로 부릅니다. 고른 것 중 지금 보이는 줄만 지웁니다(거르기를 바꿔 안 보이게 된 줄은 빠짐). 지우는 것은 아래와 같습니다.
- 초안 파일과 `drafts/.history`의 이전 버전(`deleteDraftFile`). 이름이 `<이름>.<ISO 시각>.md`라서 `…-naver-2`의 이전 버전은 `…-naver`와 섞이지 않습니다.
- 이 파일의 상태·발행 주소·답변 기록(`removeDraftStatus`).
- 브라우저의 체크리스트 기록(`toolhub:draft-check:<파일>`).

되돌릴 수 없으므로 `confirm`으로 한 번 더 묻습니다. 발행됨이 섞여 있으면 기록이 사라진다고 덧붙입니다. 중간에 실패하면 거기서 멈추고, 이미 지운 것까지만 목록에서 뺍니다. `선택 삭제` 버튼은 늘 같은 자리에 둡니다. 고를 때 나타나면 표가 밀려서 누르던 줄이 움직이기 때문입니다. 일정 관리의 할 일에 넣은 초안 링크는 사용자가 만든 할 일이라 건드리지 않습니다.

**초안 내보내기·가져오기** (`packages/collector/src/draft-bundle.ts`, 화면 `apps/web/app/blog/drafts/draft-transfer.tsx`): 다른 PC로 옮기거나 백업하려고 씁니다.
- **내보내기**는 `POST /api/drafts/export { files }`입니다. `buildDraftBundle`이 `{ format: "toolhub-drafts", version: 1, exportedAt, drafts: [{ file, content, status? }] }`를 만들고, 화면이 `toolhub-drafts-<날짜>-<n>개.json`으로 내려받습니다. 이전 버전(`.history`)과 브라우저 체크리스트 기록은 담지 않습니다.
- **가져오기**는 `POST /api/drafts/import`입니다. 내보낸 JSON의 `drafts`와 `.md`·`.txt` 파일을 화면에서 `{ file, content }`로 바꿔 한 번에 보냅니다. 그러면 `parseDraftBundle`이 모양을 확인하고(최대 `IMPORT_MAX`개), 상태는 `sanitizeStatusEntry`로 정해진 필드만 남깁니다. 이어서 `importDrafts`가 하나씩 저장합니다.
  - 파일 이름은 `safeDraftFileName`이 정리합니다. 폴더·금지 문자를 지우고, 앞의 점을 없애 숨김 파일이 되지 않게 하고, `.md`를 붙입니다.
  - **기존 초안은 덮어쓰지 않습니다.** 이름과 내용이 같으면 건너뛰고, 내용이 다르면 `-2`, `-3` 번호를 붙입니다(MCP `save_draft`와 같은 규칙). 쓰기도 `wx` 플래그라서 이미 있는 파일에는 쓰지 못합니다. 발행됨 초안을 고치지 않는 정책과 같은 이유입니다.
  - 상태는 `restoreDraftStatus`로 넣습니다. 기록이 이미 있으면 그대로 둡니다.
  - 파일 이름의 날짜가 그대로라서, 발행일은 원래 날짜로 보입니다.
- 결과는 추가·번호 붙여 저장·건너뜀 수로 알려 주고, `router.refresh()`로 목록을 다시 읽습니다. 표는 바뀐 `statuses` prop을 상태에 합칩니다.
- 표 위 필터 줄에 `가져오기 · 내보내기 · 선택 삭제 · 발행일`을 한 줄로 두고, 발행일 버튼과 같은 둥근 모양으로 맞춥니다. 초안이 하나도 없으면 표가 없으므로, 빈 목록 안내 문장에 가져오기 버튼을 둡니다. 내보내기는 고른 키워드를 보여 주며 `confirm`으로 한 번 묻습니다.

초안 목록 순서는 `sortDrafts`(발행됨 → 초안, 같은 상태끼리는 `updatedAt` 내림차순)로 서버에서 정합니다. 사용자가 표 머리를 누르면 `apps/web/lib/draft-sort.ts`의 `cycleSort`(없으면 우선순위 맨 뒤에 추가 → 방향 바꾸기 → 빼기)로 규칙 목록을 만들고, `sortByRules`로 앞 규칙이 같을 때만 다음 규칙을 봅니다(모두 같으면 서버 순서 유지, 안정 정렬). 규칙은 `localStorage`의 `toolhub:draft-sort`에 두고 `parseSavedSort`로 복원합니다. 상태·답변 수 정렬은 화면을 연 때의 값으로 해서 펼친 줄에서 상태를 바꿔도 줄이 튀지 않습니다. 화면에서 상태를 바꿔도 줄이 튀지 않게 클라이언트에서는 다시 정렬하지 않습니다. MCP `list_drafts`는 최근 초안의 패턴을 피하려고 쓰므로 그대로 최근 수정 순입니다. 초안 화면의 이전·다음 버튼은 `adjacentDrafts`(같은 `sortDrafts` 순서에서 `effectiveStatus`가 초안인 글만)로 찾습니다. 이 버튼은 클라이언트 이동이라 화면의 클라이언트 컴포넌트가 다시 만들어지지 않으므로, 상태를 들고 있는 상태 카드·썸네일 패널·발행 할 일 버튼에는 `key={file}`를 줘서 앞 초안의 상태가 남지 않게 합니다.

초안 목록의 발행일 거르기(`apps/web/app/blog/drafts/date-filter.tsx`)는 파일 이름의 날짜(`DraftSummary.date`)로 달력에 개수를 표시합니다. 발행일 칸에는 홈판형에 `홈판`, 오늘(KST)보다 뒤 날짜에 `예정`을 붙입니다. 기본 순서(`sortDrafts`)는 발행됨 → 초안, 발행일 늦은 순, 같은 날이면 홈판형 먼저, 최근 수정 순입니다. 상태 탭 개수는 고른 발행일 안에서, 달력의 날짜별 개수는 고른 상태 안에서 셉니다. 발행일은 여러 날을 고를 수 있고(`apps/web/lib/draft-dates.ts`의 `toggleDate`), 고른 날은 `localStorage`의 `toolhub:draft-dates`에 둡니다. 목록을 열 때 브라우저에서 읽고(서버 화면과 어긋나지 않게), `parseSavedDates`로 지금 초안이 있는 날만 남겨서 지운 초안의 날짜 때문에 목록이 비지 않게 합니다. 달력 칸 계산(`monthGrid`, `shiftMonth`)은 일정 캘린더와 함께 `@toolhub/tasks/model`에 있습니다.

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

### 경쟁 판단과 연관어로 돌리기 (2026-11-06)

**왜**: 초안 15개(2026-11-05)가 모두 "가습기", "절임배추" 같은 대표 키워드(월 4.7만~26만 회, 블로그 문서 5만~200만 개)였고 글당 조회수가 30~100에 그쳤습니다. 그런데 포화도는 비율(문서 수 ÷ 검색량)만 봐서 15개 모두 `기회`로 나왔습니다. 검색량이 크면 문서가 60만 개여도 비율은 낮게 나오기 때문입니다. 글이 적은 블로그에 중요한 건 경쟁 글의 절대 수입니다. 같은 주제의 연관어 "절임배추 20kg 몇포기"는 검색량이 1/7(11,780)이지만 문서는 1/117(5,280)이었습니다.

- **포화도** (`computeSaturation`): 비율 기준(10배·50배)은 그대로 두고, 문서 수 절대 기준 `SATURATION_DOCS`를 더했습니다. 2만 개 이상이면 `보통`부터, 10만 개 이상이면 `높음`이고, 올린 이유는 `cap`에 담아 `formatSaturation`이 `높음 (7.1배 · 문서 10만 개 이상)`처럼 보여 줍니다. 모든 화면·도구가 이 함수를 써서 한 곳만 바꿨습니다. 키워드 찾기의 `추천`도 따라서 엄격해졌습니다.
- **광고 경쟁도**: 검색광고 `compIdx`(낮음·중간·높음)는 입찰 경쟁이라 블로그 노출 경쟁과 무관합니다. 판단 근거로 오해하지 않게 표·브리프에서 "광고 경쟁도"로 이름을 바꾸고 규칙(`planning.md`·`writing.md`)에 판단에 쓰지 말라고 적었습니다.
- **최근 7일** (`fetchDailyTrends` + `summarizeSurge`): 데이터랩 일간 추이(어제까지 35일)로 최근 7일 평균 ÷ 그 전 28일 평균을 구해 2배 이상 `급상승`, 1.3배 이상 `상승`, 0.7배 이하 `하락`으로 봅니다. 크리에이터 어드바이저의 "검색 유입 트렌드"(지금 오르는 검색어)를 대신하는 용도이고, 월간 추이는 지난달까지만 봐서 이번 주 변화를 놓치기 때문에 따로 둡니다. 데이터랩은 한 요청에 키워드 묶음 5개까지라 5개씩 묶어 부르고(값은 묶음 안 최댓값 기준이지만 키워드마다 자기 안의 비율만 보므로 상관없음), 검색이 없는 날은 빠져 오므로 0으로 채워 날짜를 맞춥니다. 묶음 분석·키워드 찾기·키워드 조사·브리프·웹 키워드 분석에 나옵니다. "메인 유입 트렌드"(홈판)는 대신할 공개 API가 없어 캡처로 봅니다.
- **연관어로 돌리기** (`pivot.ts`의 `findPivots`): 포화도가 `기회`가 아니면(`needsPivot`) 돌릴 연관어를 찾습니다.
  1. 후보: 이미 받은 연관 키워드 + `fetchTopicKeywords`(키워드와 `키워드+신청·조건·방법·추천` 힌트). "독감증상"처럼 붙여 쓴 4글자 이상 키워드는 검색광고가 연관어를 거의 주지 않아, 후보가 5개 미만이면 앞 두 글자로 한 번 더 넓게 받습니다.
  2. `pivotCandidates`: 대표 키워드의 단어를 모두 품고(붙여 쓴 4글자 이상 단어는 앞뒤 두 글자씩만 봐서 "독감초기증상"도 포함), 월 300~3만 회, 사이트 찾기 검색어가 아닌 것을 검색량 순으로 25개까지. 처음에는 정보형 단어를 앞에 두고 15개만 봤는데, "가습기추천"처럼 경쟁이 센 상업 키워드만 조회돼 쓸 만한 후보를 놓쳐서 바꿨습니다.
  3. 후보마다 블로그 문서 수(API HUB, 5개씩 동시)와 일간 추이(5개씩 묶음)를 조회해 `pivotScore` = 검색량 ÷ (문서 수 + 1,000) × (급상승 1.5 · 상승 1.2 · 하락 0.8) 순으로 정렬합니다. 1,000은 문서가 몇 개뿐인 키워드가 과하게 튀지 않게 하는 값입니다.
  - 비용: 검색광고 1~2번(1초 간격) + API HUB 후보 수(최대 25) + 묶음 추이 5번. 브리프 한 번이 2~3초 늘어나서, 대표 키워드 경쟁이 셀 때만 부릅니다.
  - `hasOpenPivot`: 후보 중 포화도 `기회`가 있으면 브리프가 "추천 타깃 키워드 중 기회인 하나로 브리프를 다시 받아 쓰라"고, 없으면 "연관어도 경쟁이 세니 사용자에게 알리고 제목을 좁히라"고, 후보가 없으면 "좁혀 쓰라"고 적습니다.
  - 한계: 건강·의료 키워드는 검색광고가 의료 광고 제한 때문에 연관어를 거의 주지 않습니다(독감 → 독감예방접종 계열만, 노로바이러스 → 없음). 이때는 후보 없음으로 나옵니다.
- **이슈 우선 전략 (2026-11-06)**: 사용자는 매일 5편을 쓰며 반짝 이슈도 챙겨 홈판(네이버 메인)에 공격적으로 들어가는 전략이라, `planning.md`의 "반짝 이슈는 원칙적으로 제외"와 "속보성 주제 제외"를 없앴습니다. 이제 판단 순서는 지금 뜨는가(최근 7일·실시간·홈판) → 블로그 각도(속보를 "나는 해당되나·언제·어떻게·정리"로) → 경쟁 글로 타깃 키워드(연관어로 돌리기) 순이고, 제외는 루머·피해자·사생활·정보 없는 키워드·초안 있는 키워드뿐입니다. 키워드 찾기의 `추천`도 급등 이력을 빼지 않고, 하락세라도 최근 7일이 오르면 추천합니다. 네이버 규칙에 "홈판(메인) 노출"(속도·제목·썸네일·도입 3줄·날짜 기준)을 더했는데, 네이버가 기준을 공개하지 않아 알려진 경향 수준입니다.
- **검색형·홈판형 (2026-11-17)**: 크리에이터 어드바이저(한 계정, 11/9~15)를 보니 유입의 약 90%가 검색이고 홈판은 1.7%였습니다. 잘 된 글은 지역 행사·개관(시흥 어린이과학관 159회)이었고 연예·이슈 글은 한 자릿수였습니다. 기존 "홈판(메인) 노출" 규칙은 3줄 요약·소제목마다 질문 하나에 답하기·표라 사실상 검색용 구조였습니다. 그래서 네이버 글을 둘로 나눴습니다.
  - `planning.md` 판단 기준 4번이 키워드마다 형식과 발행일을 정합니다. 홈판형은 생활 밀착 + 판단할 근거(숫자·비교)가 있음 + 속보 아님을 모두 만족할 때만이고, 개수 상한은 없습니다. 나머지는 검색형이고, 정점이 지난 트렌드 키워드는 세부 질문형 연관어로 돌립니다.
  - `platforms/naver.md`에 "검색형"·"홈판형"·"발행 순서" 절을 두었습니다. 홈판형의 "판단"은 개인 의견이 아니라 공개 정보의 계산·비교라서 사람이 할 일은 검색형과 같습니다 ("내 판단 1~2줄"은 선택).
  - 브리프의 `글 형식:` 줄(`formatLine`, 네이버만·쇼핑 커넥트 제외, 기본 검색형)이 어느 절을 따를지 알려 줍니다. MCP `get_writing_brief`·`save_draft`의 `format`, CLI `--format`.
  - 사용자는 계정 3개에 나눠 하루 15편 안팎을 올립니다 (계정당 5편 꼴). 초안을 계정별로 나누지는 않습니다.
- **흐름**: 브리프(`buildWritingBrief`)가 `경쟁 판단`과 `추천 타깃 키워드` 표를 연관 키워드보다 앞에 넣습니다. `writing.md`의 "메인 키워드 정하기"가 그중 하나로 브리프를 다시 받아 그 키워드를 메인으로 쓰게 하고(파일 이름·`save_draft` 키워드도), `/blog-draft` 스킬과 MCP 안내문도 같은 순서를 따릅니다. 묶음 분석 결과는 포화도 보통·높음인 키워드를 `find_pivot_keywords`로 돌리라고 안내합니다 (키워드마다 연관어까지 조회하면 호출이 너무 많아 따로 둠).

## 글쓰기 프롬프트 (`docs/prompts/`)

| 파일 | 내용 |
|---|---|
| `project-instructions.md` | 역할, 내 블로그 정보, 공통 원칙 (claude.ai 프로젝트 지침) |
| `planning.md` | 글감 선정 규칙 (`[글감 브리핑]`) |
| `writing.md` | 초안 작성 공통 규칙 (`[글쓰기 브리프]` 항목 쓰는 법, 문체 규칙, 사람이 채울 자리, 출력 형식) |
| `types/{info,review,place,connect}.md` | 유형별 구성 변형 A~D와 이미지·덧붙일 경험 기준 (connect는 분량·대가성 문구·링크·이미지 규칙도 직접 정함) |
| `platforms/{tistory,blogger,naver}.md` | 플랫폼별 본문 형식 |
| `threads.md` | 스레드 홍보글 |

- 본문에 남기는 표시는 `[이미지: …]`뿐입니다 (2026-11-03부터). 경험(`[직접 작성]`)과 확인 못 한 정보(`[확인 필요]`)는 본문을 완성된 문장으로 쓰고 본문 밖 "사람이 할 일"에 정리합니다. 본문을 복사해 바로 올릴 때 지울 표시가 남지 않게 하려는 것입니다. 예전 초안을 위해 `MARKER_PATTERN`·체크리스트·미리보기는 세 표시를 계속 읽습니다.
- 내보내기 전 확인 (`writing.md` 작성 순서 6번, 2026-11-04): 분량·제목 글자 수·메인 키워드 횟수(이미지 자리 alt는 세지 않음)·남은 표시를 직접 세어 보고 고친 뒤 내보냅니다. 2026-11-03에 쓴 네이버 초안 16개 중 10개가 1,500자 아래(1,362~1,479자)로 나와서 넣었습니다. `blog-draft` 스킬은 저장 전에 이 확인을 하고 보고에 본문 글자 수를 적습니다.
- 추천 제목은 `writing.md`에서 제목 끝 ` (추천)`으로 정했습니다 (2026-11-04, 그 전에는 모양을 정하지 않아 `⭐추천:`, `<-추천` 등이 섞임). 파서는 예전 초안을 위해 `(추천)`, `[추천]`, `⭐`·`★`, 줄 앞의 `추천:`, 끝의 `<- 추천`·`← 추천`·`- 추천`도 알아보고, 끝의 `(34자)` 같은 글자 수 표시는 파서(`parseDraft`)가 걷어냅니다. 제목 속 낱말 "추천"은 표시로 보지 않습니다.
- 구성 변형의 이름을 바꾸면 `packages/collector/src/platforms.ts`의 `STRUCTURE_NAMES`도 함께 바꿉니다.
- 쇼핑 커넥트(`connect`, 2026-11-15): 네이버 브랜드커넥트 제휴 링크를 넣는 상품 글입니다.
  - 사람만 아는 정보(링크, 글 방식, 경험 메모)와 상품 페이지 글자(상품명·가격·평점·상세 FAQ·표)는 `get_writing_brief`의 `link`·`mode`·`product`·`experience`로 받습니다. 브리프의 `connectBriefLines`가 `글 방식`·`쇼핑 커넥트 링크`·`대가성 문구`·`상품 정보`(5,000자에서 자름)·`경험 메모` 줄을 만듭니다. CLI는 `--link`·`--mode`·`--product`·`--experience`입니다.
  - 글 방식은 `guide`(구매 가이드)와 `experience`(실제 경험)입니다. 경험 메모가 비어 있으면 `experience`를 골라도 `guide`로 씁니다. 써 보지 않은 상품을 쓴 것처럼 쓰는 것은 공정위 추천·보증 심사지침상 기만 광고라서, 지어낸 경험이 들어갈 길을 막은 것입니다.
  - 대가성 문구는 브랜드커넥트가 링크 발급 화면에 "반드시 기재"하라고 둔 문장을 글자 그대로 씁니다(`CONNECT_DISCLOSURE`). 링크 4곳(도입 직후·가격 표 아래·장단점 뒤·마무리)은 커넥트 블로거들이 흔히 쓰는 배치를 따른 것으로, 수익 데이터로 검증하지는 않았습니다.
  - 본문 이미지는 `추천: 상세 캡처`입니다. `photoSlots`의 AI·사진 자리 패턴에 걸리지 않아 이미지 프롬프트 대상에서 빠집니다.
  - 링크 없이 쓰면 `[링크: 쇼핑 커넥트]` 줄을 남깁니다. `MARKER_PATTERN`에는 넣지 않아서 체크리스트에는 나오지 않고, 사람이 할 일에 적힙니다.
- 브리프의 형식을 바꾸면 `writing.md`의 "입력 형식"과 `brief.test.ts`도 맞춥니다.
- 네이버 형식 이름(검색형·홈판형)이나 절 이름을 바꾸면 `platforms.ts`의 `NAVER_FORMAT_LABELS`와 `brief.ts`의 `FORMAT_GUIDES`도 함께 바꿉니다.

## MCP 서버

데스크톱 앱 설정은 README를 보세요. Claude Code는 저장소의 `.mcp.json`으로 연결됩니다.

**일정**: `list_tasks`, `add_task`(자연어 `text` 또는 필드 지정), `update_task`, `complete_task`, `delete_task`, `add_project`

**블로그**: `get_live_keywords`, `get_daily_keywords`, `analyze_keyword`, `analyze_keywords`(목록·캡처 묶음 분석), `discover_keywords`(주제로 키워드 찾기), `research_keyword`, `search_places`, `get_shopping_trend`, `get_writing_rules`, `get_writing_brief`, `save_draft`, `list_drafts`, `read_draft`, `update_draft`, `get_version`(버전·최신 여부)

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

- **크리에이터 어드바이저 트렌드 복사** (`advisor.js`, 2026-11-06): 복사한 글 맨 위 요청 문장은 "이 키워드들로 오늘 3개의 계정으로 네이버에 쓸 초안 15개를 작성해줘."입니다(2026-11-17, 계정 3개 기준. `formatAdvisorTrends`). 검색 유입·메인 유입 트렌드가 카드 슬라이드라 캡처가 번거로워서, 우클릭 메뉴(`documentUrlPatterns`가 `creator-advisor.naver.com`)를 누르면 background가 `lib.js`·`advisor.js`를 그 탭에 주입해 카드별 키워드를 읽습니다. 버튼을 누를 때 한 번 읽는 방식이라 늘 붙어 있는 content script로 두지 않았습니다.
  - 로그인 화면이라 HTML 구조를 볼 수 없어(스크린샷만 확인) 클래스 이름 대신 **모양**으로 찾습니다: 글자 조각이 2~4개이고 끝이 변동 표시(`new`·숫자·`-`, `isTrendMarker`)인 요소 = 줄, 같은 부모 아래 3줄 이상 = 목록, 목록 앞의 가장 가까운 줄 밖 글자(위로 6단계까지) = 카드 제목. 이어진 목록의 제목이 같으면(카드 안이 5줄씩 나뉜 경우) 한 카드로 합칩니다. 80자 넘는 요소는 줄이 아니라 건너뛰어 화면 전체를 여러 번 훑지 않습니다.
  - 변동 방향(`trendChange`): ▲▼가 아이콘이라 글자에 없을 수 있어 숫자의 계산된 색으로 봅니다(빨강 상승·파랑 하락). 네이버식 숨은 낭독 글자(`상승`·`하락`·`신규`)와 앞의 순위 번호도 처리합니다.
  - 지금 탭: `aria-selected`·`aria-current`·`on|active|selected|current` 클래스 → 없으면 배경색이 혼자 다른 탭. 날짜는 `2026. 11. 05.` 형식 글자.
  - 탭별 결과는 `chrome.storage.session`의 `advisorTrends`에 같은 날짜끼리 모아(`mergeAdvisorTrends`) 지금까지 모은 것을 `formatAdvisorTrends`로 복사합니다. 복사는 페이지 안에서 `navigator.clipboard`, 막히면 숨긴 입력칸 `execCommand("copy")`. 결과는 페이지 아래 토스트로 알립니다.
  - 복사 글의 키워드 뒤 `(▲1)`·`(new)`는 `cleanKeywordList`가 걷어내서 `analyze_keywords`에 그대로 넣어도 됩니다.
  - 스크린샷을 본뜬 모의 페이지 2개(카드가 5줄씩 나뉘고 옆 카드는 화면 밖, ▲▼는 CSS로만·색으로만, 탭은 배경색으로만 구분 / 순위 번호·숨은 상승·하락·신규 글자·aria 탭)를 헤드리스 크롬에서 돌려 카드·제목·변동·탭을 모두 맞게 읽는 것을 확인했습니다. 실제 화면에서 처음 써 볼 때 카드 수가 맞는지 확인이 필요합니다.

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
- 저장(`shelf-store.js`, background·패널 공용): 최근 200장(`MAX_SHELF`). 장수가 늘어도 느려지지 않게 둘로 나눕니다.
  - 원본은 IndexedDB `toolhub-shelf`의 `images`에 한 장씩 `{ id, image: Blob, thumb: Blob | null }`으로 둡니다. 담을 때 그 한 장만 씁니다. 미리보기는 너비 400px WebP(`OffscreenCanvas`)이고, GIF·SVG나 이미 작은 이미지는 `null`(원본을 그대로 보여 줌)입니다.
  - 순서 목록은 `storage.local`의 `shelfIndex`에 `{ id, from, source, hash, type, addedAt }`만 둡니다. 패널은 `storage.onChanged`로 이것만 받아 새 칸만 만들고 나머지는 순서만 맞춥니다.
  - 중복은 내용의 SHA-256(`hash`)이나 원래 주소(`source`)로 거릅니다.
  - 고치는 일(담기·지우기·전체 지우기·옮기기)은 모두 `navigator.locks`로 차례로 해서, 패널과 background가 동시에 써도 빠지지 않습니다. 원본을 먼저 쓰고 목록을 올리며, 목록에서 빠진 원본은 함께 지웁니다.
  - 예전 방식(`storage.local`의 `shelf`, data URL 배열)은 `migrate()`가 설치·업데이트·크롬 시작·패널 열기 때 옮깁니다. 옮기지 못한 것은 `shelf`에 남겨 다음에 다시 시도하고, 목록에 없는 원본(중간에 멈춰 남은 것)은 이때 치웁니다.
  - `unlimitedStorage`로 IndexedDB 용량 제한도 풉니다.
- 패널 칸은 미리보기를 보여 주다가 마우스를 올리면 원본 data URL로 바꿉니다. 에디터로 끌어다 놓을 때 원본이 가게 하려는 것으로, 확장 안의 `blob:` 주소는 에디터가 읽지 못합니다.
- 클립보드는 PNG만 받아서 복사할 때 `OffscreenCanvas`로 PNG로 바꿉니다.
- **삽입** (`sidepanel.js`의 `insert`): 실제 스마트에디터는 확장이 만든 입력을 받지 않습니다(2026-11-12 실제 글쓰기 화면에서 확인).
  - 받지 않은 것: 프로그램으로 고른 범위, `isTrusted: false`인 Backspace `keydown`, `execCommand("delete")`. 그래서 이미지만 들어가고 `[이미지: …]` 표시는 남았습니다.
  - 받은 것: `execCommand("paste")`(진짜 붙여넣기)와 합성 마우스 클릭.
  - 그래서 `debugger` 권한으로 사람과 같은 진짜 입력을 보냅니다. 하는 동안 크롬 위에 "디버깅을 시작함" 띠가 잠깐 뜹니다.
  1. 패널이 이미지를 클립보드에 PNG로 복사합니다.
  2. `chrome.debugger.attach({ tabId })`로 연결하고 `Emulation.setFocusEmulationEnabled`를 켭니다. 포커스가 패널에 있어도 탭이 입력을 받게 하려는 것입니다. 띠가 뜨며 화면이 밀리므로 400ms 기다립니다.
  3. `image-insert-step: locate`: 에디터 프레임의 `content.js` → `locateImageSlot()`.
     - `.se-content .se-text-paragraph` 중 `ToolhubLib.imageSlotKind()`가 `"body"`인 첫 문단을 고릅니다. 문단 전체가 `[이미지: …]` 하나일 때만이고, 대표 썸네일은 `"thumbnail"`이라 빠집니다.
     - 그 문단을 가운데로 스크롤합니다.
     - 첫 글자 왼쪽·끝 글자 오른쪽의 좌표를 줍니다. Range의 글자 단위 `getClientRects`로 재서, 두 줄로 넘어가도 정확합니다.
     - 좌표는 `frameElement`를 따라 올라가며 탭 화면 기준으로 바꿉니다. 에디터가 같은 사이트의 iframe 안에 있기 때문입니다.
     - 삽입 전 모든 문단의 글자도 기억해 둡니다.
  4. `Input.dispatchMouseEvent`로 드래그(누르기 → 네 번 나눠 끌기 → 떼기)하고, `Input.dispatchKeyEvent`로 Backspace를 보냅니다.
  5. `check` → `imageSlotStatus()`: 표시 문단만 비었거나 사라졌으면 `cleared`입니다. 다른 글자까지 바뀌었으면 `changed`이고, 이때는 진짜 ⌘Z(`commands: ["undo"]`)로 되돌리고 멈춥니다. 아무것도 안 바뀌었으면 1초까지 다시 봅니다.
  6. `paste` → `pasteImageAtCaret()`: 에디터의 편집 칸(본문 밖, 클래스 없는 DIV)에 `execCommand("paste")`합니다. 이를 위해 `clipboardRead` 권한이 필요합니다. 그다음 `.se-component.se-image` 개수가 늘 때까지 최대 10초 기다립니다.
  7. 끝나면(실패해도) `debugger.detach`합니다.
  - 실패 안내는 막힌 단계를 함께 보여 줍니다: 자리 없음 / 표시를 지우지 못함 / 다른 글자가 바뀌어 되돌림 / 붙여넣기가 에디터에 닿지 않음 / 클립보드에 이미지 없음 / 에디터가 이미지를 넣지 않음. 이미지는 클립보드에 남아 있어 ⌘V로 이어서 할 수 있습니다. 진단 정보에는 `found.image`, `imageSlots`, `activeElement`, `editables`가 담깁니다.
  - 확인 (2026-11-12): Chrome for Testing에 확장을 설치하고 `blog.naver.com` 요청을 가짜 에디터로 바꿔 패널의 `insert()`를 그대로 돌렸습니다.
    - 가짜 에디터는 실제처럼 진짜 Backspace만 받고, 숨은 편집 칸이 있습니다. 위치를 어긋나게 한 iframe 안과 밖 두 경우를 모두 봤습니다.
    - 확인한 것: 두 줄짜리 표시 드래그 → 지우기 → 그 자리에 이미지, 썸네일 건너뛰기, 순서대로 채우기, 문장 속 표시와 다른 문단 보존, 가짜 키 입력 미사용, 자리가 없을 때 안내.
    - 실제 스마트에디터에서는 설치 후 확인해야 합니다.
- 확인 (2026-11-01): Chrome for Testing에 확장을 실제로 설치(`--remote-debugging-pipe --enable-unsafe-extension-debugging` + CDP `Extensions.loadUnpacked`. 일반 크롬은 `--load-extension`을 막음)하고, `gemini.google.com` 요청을 가짜 페이지로 바꿔 자동 담기(작은 아이콘 제외), 다시 그려져도 중복 없음, `blob:` 이미지 끌어다 놓기, 자동 담기 끄기를 확인했습니다. 실제 Gemini·ChatGPT 화면 구조는 로그인이 필요해 설치 후 확인이 필요합니다.

### 쇼핑 커넥트 (사이드 패널 메뉴)

패널 위쪽 메뉴(`sidepanel.js`의 `showTab`)로 **이미지 모음**·**초안**·**쇼핑 커넥트** 화면을 나눕니다. 패널을 열면 늘 이미지 모음부터 보입니다. 메뉴의 이미지 모음 옆에는 담긴 장수를 달아, 쇼핑 커넥트 화면에서 담아도 늘어난 게 보입니다. ⌘V로 이미지 담기는 이미지 모음 화면에서만 받습니다.

쇼핑 커넥트 화면의 입력 영역(`#connect-body`)은 브랜드커넥트 상품 페이지(`brandconnect.naver.com/<채널>/affiliate/products/<상품>`)를 보고 있을 때만 보이고, 아니면 안내 문구(`#connect-none`)만 보입니다. 사람이 입력할 것을 링크 붙여넣기와 글 방식 고르기로 줄이고, 나머지는 페이지에서 읽어 [쇼핑 커넥트 요청] 글을 만듭니다. Claude 앱이 이 글을 받아 MCP `get_writing_brief(type=connect, link, mode, product, experience)`로 초안을 씁니다(서버 안내문의 "쇼핑 커넥트").

- **보일 때** (`sidepanel-connect.js`의 `refresh`): `tabs.onActivated`, 그리고 `tabs.onUpdated`의 주소 변경·로딩 완료 때 지금 탭 주소를 `connectProductId`로 봅니다. 브랜드커넥트는 페이지를 새로 열지 않고 주소만 바꿔 상품을 옮기기 때문입니다.
- **읽기**: `scripting.executeScript`(모든 프레임)로 `document.body.innerText` 줄과 "네이버 쇼핑에서 보기" 링크 주소를 받아 `parseConnectPage`로 해석합니다. **상세 정보는 본문이 아니라 스마트스토어 iframe**(`m.smartstore.naver.com/<스토어>/products/<번호>/shopping-connect-contents`, `isDetailFrame`) 안에 있습니다(2026-11-16 실제 페이지 진단 정보로 확인). 그래서 상세 글자는 그 프레임에서 읽습니다. 본문의 "상세 정보" 뒤에는 사이트 아래쪽 메뉴(TOP·로그아웃·이용약관)만 있어서, 처음 버전은 그걸 상세 정보로 읽었습니다. 페이지가 늦게 그려질 수 있어 못 찾으면 1초 간격으로 5번까지 다시 읽습니다.
  - 화면 구조(클래스 이름)를 몰라 **글자 라벨로** 읽습니다. 그래서 디자인이 바뀌어도 라벨이 같으면 깨지지 않습니다.
  - 상품 정보 영역은 "상품 정보" 줄부터 "링크 복사" 줄까지입니다. 가격 라벨(판매가·할인가·수수료) 앞이 브랜드·상품명·평점이고, 상품명은 가장 긴 줄, 브랜드는 그 앞의 짧은 줄로 봅니다.
  - 이미지 위의 `수수료+` 배지는 라벨로 보지 않습니다. 라벨은 그 글자만 있거나 뒤에 공백·숫자·콜론이 올 때만 인정합니다.
  - 상세 정보는 "상세 정보" 줄 뒤의 글자(판매자가 글자로 넣은 FAQ·표)를 4,000자까지 읽습니다. 이미지 속 글자는 못 읽습니다.
  - 수수료는 글에 쓰지 않으므로 요청문에 넣지 않습니다.
- **입력**: 링크, 글 방식(구매 가이드·실제 경험), 경험 메모(실제 경험일 때만 보임), 키워드(비우면 Claude가 정함). 상품 번호별로 `storage.local`의 `connectInputs`에 최근 30개까지 기억합니다.
- **복사**: `connectRequestProblem`이 링크 없음, 주소 형식 아님, 실제 경험인데 메모 없음을 막습니다. 경험 메모가 비면 브리프도 구매 가이드로 쓰지만, 패널에서 먼저 막아 사람이 고르게 합니다.
- **상세 이미지 고르기** (`sidepanel-connect.js`, 자르는 위치 계산은 `slicer.js`):
  1. `executeScript`(모든 프레임, 상세 이미지가 상세 iframe 안에 있음)로 프레임마다 자기 문서를 한 화면씩(최대 60번, 250ms 간격) 내려 지연 로딩 이미지를 띄우고, 원래 스크롤 위치로 돌아옵니다. 그다음 `document.images`의 주소·원래 크기·보이는 너비를 받습니다.
  2. `pickPageImages`: http(s) 주소만, 같은 주소는 한 번, 가로 300·세로 200 미만(로고·아이콘)은 뺍니다. 지연 로딩 주소(`data-src`·`data-original`·`data-lazy-src`)를 먼저 보고, 그 주소는 아직 안 떴으므로 보이는 너비로 판단합니다.
  3. 패널이 원본을 받아(확장 권한이라 다른 사이트 이미지도 됨) 세로가 가로의 2배 이하면 그대로 둡니다. 더 길면 1,024줄씩 캔버스에 그려 `blankRows`로 빈 줄을 표시합니다. 한 캔버스에 통째로 그리면 아주 긴 이미지가 크기 제한에 걸리기 때문입니다.
     - 빈 줄: 가로 4px마다 본 픽셀이 모두 줄 첫 픽셀과 채널 차이 10 이내. 흰 여백뿐 아니라 단색 띠도 됩니다.
  4. `findCuts`: 조각 목표 높이는 가로의 1.3배(모바일 한 화면쯤)이고, 가로의 0.6~2배 안에서 12줄 이상인 빈 띠를 찾습니다. 점수는 두께(80줄까지) − 목표와의 거리이고, 가장 높은 띠의 가운데에서 자릅니다. 띠가 없으면 목표 높이에서 자르고, 마지막 조각이 0.6배보다 짧아지지 않게 끝을 남깁니다. 12줄보다 얇은 띠는 글자 줄 간격일 수 있어 보지 않습니다.
  5. `trimPiece`: 조각 위아래 빈 줄은 16줄만 남기고, 전부 빈 조각은 버립니다. 원본이 JPEG면 JPEG(품질 0.92), 아니면 PNG로 만듭니다.
  6. 고른 조각을 `ToolhubShelf.addImage`로 담습니다. 이미지 모음은 새것이 맨 앞이라 뒤에서부터 담아 페이지 순서로 보이게 합니다. 이미지 모음은 원본 주소(`source`)가 같으면 같은 이미지로 보고 앞의 것을 지우므로, 주소 뒤에 `#2-1`처럼 조각 번호를 붙입니다.
  - 확인 (2026-11-16): 가짜 상품 페이지(상세 정보는 스마트스토어 주소의 iframe)에 800×4000 상세 이미지(흰 띠 60줄 3개, iframe 안 지연 로딩), 600×600 갤러리, 120×40 로고를 두고 돌렸습니다. 로고 제외, 지연 로딩 이미지 포함, 띠 가운데(1130·2180·3230줄)에서 4조각, 여백 16줄, 스크롤 원위치, 고른 조각만 순서대로 담기를 확인했습니다. 실제 상세 이미지의 띠 기준값(두께 12줄, 색 차이 10)은 써 보고 맞춰야 합니다.
- 패널의 ⌘V(이미지 담기)는 쇼핑 커넥트 화면과 입력칸·메모 칸 안에서는 가로채지 않습니다. 링크를 붙여넣을 수 있게 하려는 것입니다.
- 확인 (2026-11-15): 스크린샷 기준으로 만든 가짜 상품 페이지를 Chrome for Testing에서 `brandconnect.naver.com` 요청 대신 내려주고 확인했습니다.
  - 확인한 것: 다른 페이지에서는 숨김, 상품 탭을 활성화하면 보이고 읽음, 상품명·할인가 표시, 수수료 제외, 링크 칸 붙여넣기를 가로채지 않음, 링크·메모 없을 때 막음, 요청문 복사, 상품별 입력 기억.
  - 실제 페이지의 `innerText` 줄바꿈은 다를 수 있어 설치 후 확인해야 합니다.

### 초안 채우기 (사이드 패널 메뉴, 2026-11-17)

패널 메뉴는 `이미지 모음 | 초안 | 쇼핑 커넥트`입니다. 초안 메뉴(`sidepanel-drafts.js`)는 toolhub 웹에서 그날 올릴 네이버 초안을 받아 네이버 새 글쓰기 화면에 채웁니다. 저장(임시저장)·발행은 누르지 않습니다. 클릭 한 번 아끼는 효과는 작은데, "자동 등록"으로 보일 위험은 그 클릭에서 생기기 때문입니다.

- **웹 API**
  - `GET /api/drafts/naver?date=&account=` → `{ date, drafts: [{ file, keyword, format, title }] }`. `naverDraftsFor`가 네이버·그 발행일·초안 상태(·그 계정, `none`이면 계정 없음)만 고르고, 목록과 같은 순서(홈판형 먼저)로 둡니다.
  - 계정 고르기는 메뉴를 열 때 `GET /api/accounts`로 채웁니다. 계정이 없거나 옛 웹이면 숨기고 모든 초안을 보여 줍니다. 고른 계정은 `chrome.storage.local`의 `draftsAccount`에 둬서 크롬 프로필마다 따로 기억합니다.
  - `GET /api/drafts/naver/fill?file=` → `{ file, title, text, html, tags, images, thumbnail }` (`thumbnail`: 대표 썸네일 자리가 있는지). `naverFillContent`가 만드는 `html`은 초안 화면 "서식 포함 복사"와 같은 `naverPasteHtml` 뒤에 빈 문단 5개와 `#태그 #태그…` 문단을 붙인 것입니다(`text`도 같은 모양). 사용자가 손으로 하던 대로 태그를 본문 맨 아래에 두면 네이버가 본문의 #태그를 태그로 등록하므로, 발행 설정 창의 태그 칸을 따로 채우지 않습니다. 같은 글을 두 번 올리지 않게 발행됨은 409로 거절합니다.
  - 확장은 `http://localhost:3000`(npm run web) → `3100`(MCP open_web) 순으로 찾습니다. 옛 웹(404)은 건너뛰고, 찾은 주소를 기억합니다. 확장 권한(`<all_urls>`)이라 CORS 설정은 필요 없습니다.
- **에디터 구조** (2026-11-17 진단): 제목 칸도 본문과 같은 글쓰기 iframe, 같은 `.se-content`의 첫 덩어리(`.se-component.se-documentTitle`)입니다. 빈 칸의 "제목"·"본문" 글자는 `.se-placeholder`라서 글자로 세지 않습니다(`ownText`).
- **순서** (`fill`, 단계는 content.js의 `draft-fill-step` → naver-editor.js)
  1. `state` → `fillState()`: 제목 글자, 본문 글자 수, 덩어리 수입니다. `fillProblem`이 제목이나 본문 글자가 있거나, 덩어리가 2개(제목·본문)보다 많으면(사진만 넣은 글) 멈춥니다.
  2. 클립보드에 `text/html`(+`text/plain`)을 씁니다. 패널을 누른 직후라 포커스가 있습니다.
  3. `debugger.attach` → `Emulation.setFocusEmulationEnabled`를 합니다.
  4. `locate(title)` 좌표로 진짜 클릭 → `caret(title)`로 커서가 제목 덩어리에 들어갔는지 확인 → `Input.insertText`(진짜 입력) → `state`로 제목이 그대로 들어갔는지(`sameText`, 공백 차이 무시) 확인합니다.
  5. `locate(body)` 클릭 → `caret(body)` 확인 → `paste` → `pasteBodyAtCaret()`: 이미지 삽입과 같은 `execCommand("paste")`입니다. paste 이벤트에 `text/html`이 있었는지 보고, 본문 글자 수가 늘 때까지(최대 8초), 다시 멈출 때까지 기다립니다.
  6. debugger를 떼고 `headings` → `convertPastedHeadings()`(기존 소제목 정리)를 합니다.
  7. 본문 글자 수·소제목 수·넣은 태그 수·남은 이미지 자리 수를 보여 줍니다.
- 한 단계라도 어긋나면(커서가 안 들어감, 제목이 다르게 들어감, 붙여넣기가 안 닿음) 거기서 멈추고 이유를 보여 줍니다. 빈 글에서만 시작하므로 되돌릴 것이 생기지 않습니다.
- 확인 (2026-11-17): Chrome for Testing에서 `blog.naver.com` 요청을 가짜 글쓰기 화면으로 바꿨습니다. iframe 안 에디터, 안내 글자, HTML 붙여넣기, 커서 줄에 따라 바뀌는 툴바, 소제목으로 바꾸면 덩어리가 빠지는 문단 서식을 흉내 냈습니다. 개발 서버의 실제 초안 목록(6개)으로 확인한 것: 제목(안내 글자 없이), 본문 49문단, 소제목 6개 모두 변환, 두 번째 채우기는 "제목이 이미 있어요"로 멈춤. 태그 줄을 넣은 뒤에는 웹 API를 가짜 응답으로 바꿔 홈판 표시, 맨 아래 빈 줄 5개 뒤 `#태그` 줄까지 확인했습니다. 실제 네이버 에디터에서도 제목·본문 채우기가 되는 것을 사용자가 확인했습니다(태그 줄 추가 전). 

## 이미지 5장 프롬프트 (`image-prompt.ts`)

초안 화면에서 Gemini에 붙여넣을 요청문을 만듭니다. 늘 5장(`IMAGE_PROMPT_COUNT`): **1~5번이 본문 이미지 1~5번**을 적힌 장면 그대로 요청해 초안과 번호까지 1:1로 맞춥니다. 대표 썸네일은 사람이 썸네일 만들기로 직접 만들어서 요청하지 않습니다 (2026-11-05에 6장 → 5장).

작성 규칙(2026-11-05~, `writing.md`)은 이미지를 모두 이미지 AI로 만든다는 전제로, 모든 초안에 **대표 썸네일 1개(본문 첫 줄 `[이미지: 대표 썸네일 | alt: … | 추천: 썸네일 만들기]`, 장면 없음) + 본문 이미지 5개**를 두고, 본문 이미지는 `추천: AI 생성`의 그릴 수 있는 장면으로만 둡니다. 화면 캡처·표 캡처·직접 제작 카드는 없고, 네이버 표는 서식 포함 복사가 표로 바꿔 주므로 표 이미지 자리도 없습니다. 그 전에는 자리가 3~8개로 들쭉날쭉하고 대부분 직접 캡처·제작이라 프롬프트와 어긋나고 이미지 준비가 병목이었습니다. review·place는 실제 사진이 근거라 같은 개수를 `직접 촬영`으로 둡니다.

`photoSlots`는 대표 썸네일(`대표 썸네일`로 시작하는 자리. 예전 초안은 뒤에 `: 장면`)을 따로 돌려주고(요청문에는 쓰지 않음), 본문 이미지는 썸네일을 빼고 번호를 셉니다 (이미지 목록 번호와 같음). `AI 생성` 자리는 모두, 예전 형식의 `직접 촬영`·`무료 사진` 자리는 화면·표·서류처럼 실제 정보를 담는 장면을 빼고 고릅니다. 본문 자리가 5개보다 많으면 고르게 5개, 모자라면(예전 초안) 이미지 자리가 없는 소제목으로, 그래도 모자라면 주제로 채우고 그 장들에만 alt를 따로 받습니다. 소제목은 네이버 본문의 `■`, 마크다운 `##`·`###`, HTML `h2`·`h3`에서 찾고, 소제목 아래 첫 문단(표시 자리·표 줄 제외, 숫자 문장을 빼고 10자 미만이면 생략)을 장면 단서로 붙입니다. 공통 규칙: 가로 4:3, 색감 통일, 한국 배경, 글자·로고·가짜 화면·실존 인물 금지.

블로그에 맞게 다듬은 점 (2026-11-02):
- **숫자 걷어내기**: 장면 단서에 금액·날짜가 있으면 Gemini가 달력·그래프·숫자를 그려 넣어 한글이 깨지기 쉬워서, 소제목은 단위가 붙은 숫자만 지우고(4대보험 같은 이름은 유지) 첫 문단은 숫자가 든 문장을 통째로 뺍니다.
- **장면 정하기**: 세금·제도처럼 추상적인 내용은 그 상황의 사람·사물로 표현하고, 5장은 사물 가까이·사람 상반신·공간 전체로 구도를 섞게 합니다 (같은 "노트북 앞 사람"만 나오는 것 방지).
- **AI 티 줄이기(사진)**: 스마트폰으로 찍은 듯한 자연광 사진, 과한 보정·번들거림 금지, 얼굴 정면·손가락 클로즈업 피하기, 노트북·휴대폰 화면은 흐리게.
- **한 번에 5장**: "다음"을 매번 치지 않도록 한 답변에서 1~5번을 모두 생성하라고 요청합니다. 실제로 한 번에 나오는지는 Gemini 쪽 동작이라 확인이 필요합니다.
- **목록에서 바로 복사**: 초안 목록의 `프롬프트` 칸(`prompt-copy-button.tsx`)은 누를 때 `GET /api/drafts/image-prompt?file=&style=`로 요청문(텍스트)을 받아 복사합니다. 응답을 기다리는 사이 복사 권한(사용자 동작)이 끊기지 않게 `ClipboardItem`에 Promise를 그대로 넘깁니다 (Safari는 이 방식만 됨, 없으면 `writeText`). 스타일은 초안 화면에서 고른 값을 `localStorage`의 `toolhub:image-prompt-style`에 기억해 함께 씁니다. 키워드는 `draftNameInfo(file)`(파일 이름 해석, `listDrafts`와 공용)로 얻습니다.
- **한 장에 장면 하나**: Gemini가 5개 장면을 격자·콜라주 한 장으로 합쳐 주는 일이 잦아서, 맨 앞에 "서로 다른 이미지 파일 5개"와 `[가장 중요: 한 장에 장면 하나]`(격자·콜라주·분할 화면·비교 이미지 금지, 1번부터 한 장씩 따로 생성)를 두고, 목록 머리(`번호 하나 = 이미지 1장`)와 요청문 맨 끝 줄에 다시 적습니다. 모델은 처음과 끝을 가장 잘 따르므로 끝 줄은 alt 요청보다 뒤에 둡니다.

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
월간 검색량: 58,040 (PC 8,440 / 모바일 49,600) · 광고 경쟁도: 중간
검색 추이: 꾸준함 — …
블로그 문서 수: … · 포화도 높음 (2.2배 · 문서 10만 개 이상) (문서 수 ÷ 검색량)
최근 7일 검색: 상승 ×1.4 (직전 4주 평균 대비)
경쟁 판단: …  /  추천 타깃 키워드 (연관어로 돌리기 …): | 키워드 | 월간 검색량 | 블로그 문서 수 | 포화도 | 최근 7일 |   (경쟁이 셀 때만)
연관 키워드 (관련 높은 순): | 키워드 | 월간 검색량 | 광고 경쟁도 |
실제 질문 (지식iN): - …
상위 블로그 글 (겹치지 않는 각도를 잡기 위한 참고): - …
카페 글 (리뷰·장소) / 장소 정보 (장소)
```
