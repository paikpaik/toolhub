/**
 * MCP에서 toolhub 웹을 켜고 끄고, 브라우저로 여는 기능.
 *
 * 웹은 작업 중인 코드가 아니라 항상 로컬 main 브랜치의 최신 커밋으로 띄운다.
 * - 저장소 밖의 실행 폴더(git worktree)를 main 최신 커밋으로 맞추고, 의존성이 바뀌었으면 npm install
 * - 떠 있는 웹이 옛 커밋이면 재시작
 * - 포트는 개발용 npm run web(3000)과 겹치지 않게 3100
 * 데이터(data/)와 검색광고 키(apps/web/.env.local)는 원래 저장소의 것을 쓴다.
 *
 * 웹 서버는 MCP 서버와 분리된 프로세스라 데스크톱 앱을 꺼도 계속 실행된다. stop_web으로 끈다.
 */
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseEnv, promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, "../../..");
const BRANCH = "main";
const RUNTIME_DIR = process.env.TOOLHUB_RUNTIME_DIR ?? path.join(os.homedir(), ".toolhub", "runtime", path.basename(ROOT));

const STATE_DIR = path.join(ROOT, ".toolhub");
const PID_FILE = path.join(STATE_DIR, "web.pid");
/** 지금 떠 있는 웹의 커밋 */
const COMMIT_FILE = path.join(STATE_DIR, "web.commit");
/** 실행 폴더에 마지막으로 설치한 package-lock.json의 해시 */
const INSTALLED_LOCK_FILE = path.join(STATE_DIR, "runtime-lock.sha256");
export const WEB_LOG_FILE = path.join(STATE_DIR, "web.log");

export const WEB_PORT = Number(process.env.TOOLHUB_WEB_PORT ?? 3100);
export const WEB_URL = `http://localhost:${WEB_PORT}`;
const START_TIMEOUT_MS = 60_000;

// 데스크톱 앱이 실행한 프로세스는 PATH가 제한적이라 node·git이 있을 만한 경로를 덧붙인다
const ENV_PATH = [path.dirname(process.execPath), process.env.PATH, "/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin"]
  .filter(Boolean)
  .join(":");
const NPM_CLI = path.join(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (line: string) => appendFile(WEB_LOG_FILE, `[${new Date().toISOString()}] ${line}\n`).catch(() => {});

async function git(cwd: string, ...args: string[]) {
  const { stdout } = await execFileAsync("git", args, { cwd, env: { ...process.env, PATH: ENV_PATH } });
  return stdout.trim();
}

export interface CommitInfo {
  hash: string;
  short: string;
  subject: string;
}

async function mainCommit(): Promise<CommitInfo> {
  const [hash = "", subject = ""] = (await git(ROOT, "log", "-1", "--format=%H%n%s", BRANCH)).split("\n");
  return { hash, short: hash.slice(0, 7), subject };
}

/** 명령을 실행하고 출력은 로그 파일에 남긴다 */
async function run(command: string, args: string[], cwd: string) {
  await log(`$ ${path.basename(command)} ${args.join(" ")} (cwd: ${cwd})`);
  const out = await open(WEB_LOG_FILE, "a");
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(command, args, { cwd, stdio: ["ignore", out.fd, out.fd], env: { ...process.env, PATH: ENV_PATH } });
      child.once("error", reject);
      child.once("exit", resolve);
    });
    if (code !== 0) throw new Error(`${path.basename(command)} ${args[0] ?? ""} 실패 (종료 코드 ${code}). 로그: ${WEB_LOG_FILE}`);
  } finally {
    await out.close();
  }
}

/** 실행 폴더를 커밋에 맞추고, 의존성이 바뀌었으면 설치한다 */
async function syncRuntime(commit: string) {
  if (!existsSync(path.join(RUNTIME_DIR, ".git"))) {
    await mkdir(path.dirname(RUNTIME_DIR), { recursive: true });
    await git(ROOT, "worktree", "prune");
    await git(ROOT, "worktree", "add", "--detach", "--force", RUNTIME_DIR, commit);
    await log(`실행 폴더 생성: ${RUNTIME_DIR}`);
  } else {
    // 실행 폴더는 toolhub가 관리하므로 남은 변경(npm install이 고친 lock 파일 등)은 버린다
    await git(RUNTIME_DIR, "checkout", "--detach", "--force", commit);
  }

  const lock = await readFile(path.join(RUNTIME_DIR, "package-lock.json"));
  const lockHash = createHash("sha256").update(lock).digest("hex");
  const installed = await readFile(INSTALLED_LOCK_FILE, "utf-8").catch(() => "");
  if (lockHash !== installed.trim() || !existsSync(path.join(RUNTIME_DIR, "node_modules/next"))) {
    const npm = existsSync(NPM_CLI) ? [process.execPath, NPM_CLI] : ["npm"];
    await run(npm[0]!, [...npm.slice(1), "install", "--no-audit", "--no-fund"], RUNTIME_DIR);
    await writeFile(INSTALLED_LOCK_FILE, lockHash);
  }
}

/** 포트에서 HTTP 응답이 오는지 (상태 코드는 상관없음) */
async function portResponds() {
  try {
    await fetch(`${WEB_URL}/api/health`, { signal: AbortSignal.timeout(10_000) });
    return true;
  } catch {
    return false;
  }
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readPid() {
  const pid = Number(await readFile(PID_FILE, "utf-8").catch(() => ""));
  return pid > 0 ? pid : null;
}

/** MCP가 띄운 웹이 떠 있으면 그 커밋을, 아니면 null */
async function runningCommit() {
  const pid = await readPid();
  if (!pid || !isAlive(pid) || !(await portResponds())) return null;
  return (await readFile(COMMIT_FILE, "utf-8").catch(() => "")).trim() || null;
}

async function startWeb(commit: string) {
  // 실행 폴더에는 .env.local이 없으므로 원래 저장소의 키를 환경변수로 넘긴다
  const envFile = await readFile(path.join(ROOT, "apps/web/.env.local"), "utf-8").catch(() => "");
  const env = {
    ...process.env,
    ...parseEnv(envFile),
    PATH: ENV_PATH,
    TOOLHUB_DATA_DIR: process.env.TOOLHUB_DATA_DIR ?? path.join(ROOT, "data"),
    TOOLHUB_COMMIT: commit,
  };

  const out = await open(WEB_LOG_FILE, "a");
  const child = spawn(process.execPath, [path.join(RUNTIME_DIR, "node_modules/next/dist/bin/next"), "dev", "-p", String(WEB_PORT)], {
    cwd: path.join(RUNTIME_DIR, "apps/web"),
    detached: true,
    stdio: ["ignore", out.fd, out.fd],
    env,
  });
  child.unref();
  await out.close();
  await writeFile(PID_FILE, String(child.pid));
  await writeFile(COMMIT_FILE, commit);

  let exited = false;
  child.once("exit", () => (exited = true));
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline && !exited) {
    if (await portResponds()) return;
    await sleep(1000);
  }
  const tail = (await readFile(WEB_LOG_FILE, "utf-8").catch(() => "")).split("\n").slice(-15).join("\n");
  throw new Error(`웹 서버가 시작되지 않았습니다. 로그(${WEB_LOG_FILE}) 마지막 부분:\n${tail}`);
}

function openBrowser(url: string) {
  if (process.env.TOOLHUB_NO_BROWSER) return; // 테스트용
  const [command, args] =
    process.platform === "darwin"
      ? ["/usr/bin/open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}

export interface WebResult {
  commit: CommitInfo;
  /** none: 이미 최신으로 떠 있음, started: 새로 시작, restarted: 새 커밋으로 재시작 */
  action: "none" | "started" | "restarted";
}

/** main 최신 커밋으로 웹이 떠 있도록 맞춘다. 오래 걸릴 수 있어 동시에 여러 번 불려도 한 번만 진행한다 */
let preparing: Promise<WebResult> | null = null;

export function ensureLatestWeb() {
  preparing ??= (async (): Promise<WebResult> => {
    await mkdir(STATE_DIR, { recursive: true });
    const commit = await mainCommit();
    const running = await runningCommit();
    if (running === commit.hash) return { commit, action: "none" };

    if (running) {
      await log(`새 커밋 ${commit.short}로 재시작 (이전 ${running.slice(0, 7)})`);
      await stopWeb();
    } else if (await portResponds()) {
      throw new Error(
        `${WEB_PORT}번 포트를 다른 프로그램이 쓰고 있습니다. 그 프로그램을 끄거나, MCP 설정에 TOOLHUB_WEB_PORT 환경변수로 다른 포트를 지정하세요.`,
      );
    }
    await syncRuntime(commit.hash);
    await startWeb(commit.hash);
    return { commit, action: running ? "restarted" : "started" };
  })().finally(() => {
    preparing = null;
  });
  return preparing;
}

export async function openWeb(pagePath: string) {
  const result = await ensureLatestWeb();
  const url = `${WEB_URL}${pagePath}`;
  openBrowser(url);
  return { ...result, url };
}

/** MCP가 띄운 웹 서버를 끈다. 터미널에서 직접 띄운 서버는 건드리지 않는다 */
export async function stopWeb() {
  const pid = await readPid();
  await rm(PID_FILE, { force: true });
  await rm(COMMIT_FILE, { force: true });
  if (!pid || !isAlive(pid)) return { stopped: false };
  try {
    // next dev는 자식 프로세스를 여러 개 띄우므로 프로세스 그룹 전체를 끈다
    process.kill(-pid, "SIGTERM");
  } catch {
    // 이미 꺼진 경우
  }
  // 바로 다시 시작할 수 있도록 포트가 비워질 때까지 잠시 기다린다
  for (let i = 0; i < 10 && (await portResponds()); i++) await sleep(500);
  return { stopped: true };
}
