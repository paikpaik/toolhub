import { readStore, todayKst, VIEWS, type View } from "@toolhub/tasks";
import { DATA_DIR } from "../../lib/data";
import { TaskApp } from "./task-app";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; project?: string; label?: string; task?: string }>;
}) {
  const params = await searchParams;
  const view: View = VIEWS.find((v) => v === params.view) ?? "today";
  const { tasks, projects } = await readStore(DATA_DIR);
  const projectId = params.project && projects.some((p) => p.id === params.project) ? params.project : null;

  return (
    <TaskApp
      initialTasks={tasks}
      projects={projects}
      today={todayKst()}
      view={projectId || params.label ? "all" : view}
      projectId={projectId}
      label={params.label ?? null}
      initialSelectedId={Number(params.task) || null}
    />
  );
}
