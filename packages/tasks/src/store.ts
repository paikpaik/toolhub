/**
 * 일정 저장소: data/tasks.json
 * 웹 서버와 MCP 서버가 서로 다른 프로세스에서 같은 파일을 고치므로, 잠금 파일(tasks.json.lock)로
 * 읽기-수정-쓰기를 한 번에 하나씩만 하게 한다.
 */
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isOpen,
  nextRepeatDate,
  parseQuickAdd,
  PROJECT_COLORS,
  todayKst,
  type Project,
  type Task,
  type TaskInput,
  type TaskPatch,
  type TaskStore,
} from "./model.ts";

const EMPTY: TaskStore = { nextId: 1, tasks: [], projects: [] };
const LOCK_STALE_MS = 10_000;

const storeFile = (dataDir: string) => path.join(dataDir, "tasks.json");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function readStore(dataDir: string): Promise<TaskStore> {
  try {
    return { ...EMPTY, ...JSON.parse(await readFile(storeFile(dataDir), "utf-8")) };
  } catch {
    return structuredClone(EMPTY);
  }
}

async function writeStore(dataDir: string, store: TaskStore) {
  const file = storeFile(dataDir);
  await writeFile(`${file}.tmp`, JSON.stringify(store, null, 2));
  await rename(`${file}.tmp`, file);
}

/** 잠금을 잡고 저장소를 고친다. 다른 프로세스가 잡고 있으면 기다리고, 오래된 잠금(비정상 종료)은 푼다 */
async function mutate<T>(dataDir: string, fn: (store: TaskStore) => T): Promise<T> {
  await mkdir(dataDir, { recursive: true });
  const lock = `${storeFile(dataDir)}.lock`;
  for (let attempt = 0; ; attempt++) {
    try {
      const handle = await open(lock, "wx");
      await handle.close();
      break;
    } catch {
      const age = await stat(lock).then((s) => Date.now() - s.mtimeMs, () => 0);
      if (age > LOCK_STALE_MS) await rm(lock, { force: true });
      else if (attempt > 200) throw new Error("일정 파일 잠금을 얻지 못했습니다. 잠시 후 다시 시도하세요.");
      else await sleep(25);
    }
  }
  try {
    const store = await readStore(dataDir);
    const result = fn(store);
    await writeStore(dataDir, store);
    return result;
  } finally {
    await rm(lock, { force: true });
  }
}

const now = () => new Date().toISOString();

function findProject(store: TaskStore, nameOrId: string | null | undefined) {
  if (!nameOrId) return null;
  const key = nameOrId.trim().toLowerCase();
  return store.projects.find((p) => p.id === nameOrId || p.name.toLowerCase() === key) ?? null;
}

function newTask(store: TaskStore, input: TaskInput): Task {
  const time = now();
  return {
    id: store.nextId++,
    title: input.title.trim(),
    notes: input.notes ?? "",
    status: input.status ?? "todo",
    priority: input.priority ?? 0,
    dueDate: input.dueDate ?? null,
    dueTime: input.dueTime ?? null,
    projectId: input.projectId ?? null,
    labels: input.labels ?? [],
    repeat: input.repeat ?? null,
    subtasks: input.subtasks ?? [],
    link: input.link ?? null,
    createdAt: time,
    updatedAt: time,
    completedAt: null,
  };
}

export function createTask(dataDir: string, input: TaskInput) {
  return mutate(dataDir, (store) => {
    if (!input.title.trim()) throw new Error("제목이 필요합니다.");
    const task = newTask(store, input);
    store.tasks.push(task);
    return task;
  });
}

/**
 * 자연어 한 줄로 추가한다 ("내일 오후 3시 글 발행 #블로그 @블로그운영 !높음").
 * @프로젝트가 없는 이름이면 새로 만든다.
 */
export function quickAddTask(dataDir: string, text: string, defaults: Partial<TaskInput> = {}) {
  return mutate(dataDir, (store) => {
    const parsed = parseQuickAdd(
      text,
      todayKst(),
      store.projects.map((p) => p.name),
    );
    if (!parsed.title) throw new Error("제목이 필요합니다.");
    let project = findProject(store, parsed.projectName);
    if (parsed.projectName && !project) {
      project = { id: randomUUID().slice(0, 8), name: parsed.projectName, color: PROJECT_COLORS[store.projects.length % PROJECT_COLORS.length]! };
      store.projects.push(project);
    }
    const task = newTask(store, {
      ...defaults,
      title: parsed.title,
      dueDate: parsed.dueDate ?? defaults.dueDate ?? null,
      dueTime: parsed.dueTime ?? defaults.dueTime ?? null,
      priority: parsed.priority || defaults.priority || 0,
      labels: [...new Set([...(defaults.labels ?? []), ...parsed.labels])],
      projectId: project?.id ?? defaults.projectId ?? null,
      repeat: parsed.repeat ?? defaults.repeat ?? null,
    });
    store.tasks.push(task);
    return task;
  });
}

export interface UpdateResult {
  task: Task;
  /** 반복 할 일을 완료해서 새로 만들어진 다음 할 일 */
  next: Task | null;
}

/**
 * 할 일을 고친다. 완료로 바꾸면 completedAt을 남기고, 반복 할 일이면 다음 날짜로 새 할 일을 만든다
 * (TickTick처럼 완료 기록은 남고 다음 회차가 생긴다).
 */
export function updateTask(dataDir: string, id: number, patch: TaskPatch) {
  return mutate(dataDir, (store): UpdateResult => {
    const task = store.tasks.find((t) => t.id === id);
    if (!task) throw new Error(`#${id} 할 일을 찾을 수 없습니다.`);
    const wasOpen = isOpen(task);
    Object.assign(task, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), { updatedAt: now() });
    if (patch.title !== undefined) task.title = patch.title.trim() || task.title;

    let next: Task | null = null;
    if (wasOpen && !isOpen(task)) {
      task.completedAt = now();
      if (task.status === "done" && task.repeat && task.dueDate) {
        next = newTask(store, {
          ...task,
          status: "todo",
          dueDate: nextRepeatDate(task.dueDate, task.repeat),
          subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
        });
        store.tasks.push(next);
      }
    } else if (!wasOpen && isOpen(task)) {
      task.completedAt = null;
    }
    return { task, next };
  });
}

export function deleteTask(dataDir: string, id: number) {
  return mutate(dataDir, (store) => {
    const index = store.tasks.findIndex((t) => t.id === id);
    if (index < 0) throw new Error(`#${id} 할 일을 찾을 수 없습니다.`);
    return store.tasks.splice(index, 1)[0]!;
  });
}

export function createProject(dataDir: string, name: string, color?: string) {
  return mutate(dataDir, (store): Project => {
    const existing = findProject(store, name);
    if (existing) return existing;
    const project = { id: randomUUID().slice(0, 8), name: name.trim(), color: color ?? PROJECT_COLORS[store.projects.length % PROJECT_COLORS.length]! };
    store.projects.push(project);
    return project;
  });
}

export function updateProject(dataDir: string, id: string, patch: Partial<Omit<Project, "id">>) {
  return mutate(dataDir, (store) => {
    const project = store.projects.find((p) => p.id === id);
    if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
    Object.assign(project, patch);
    return project;
  });
}

/** 프로젝트를 지운다. 그 프로젝트의 할 일은 지우지 않고 프로젝트 없음으로 옮긴다 */
export function deleteProject(dataDir: string, id: string) {
  return mutate(dataDir, (store) => {
    store.projects = store.projects.filter((p) => p.id !== id);
    for (const t of store.tasks) if (t.projectId === id) t.projectId = null;
    return true;
  });
}

/** 이름 또는 id로 프로젝트를 찾는다 (MCP에서 이름으로 지정할 때) */
export async function resolveProject(dataDir: string, nameOrId: string) {
  return findProject(await readStore(dataDir), nameOrId);
}
