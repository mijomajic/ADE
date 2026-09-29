import { scopedProjectKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId } from "@t3tools/contracts";

import type { Project, ThreadShell } from "../../types";
import { resolveThreadStatusPill } from "../Sidebar.logic";

export type WorkspaceFilter = "all" | "attention" | "working";
export type WorkspaceThreadState = {
  readonly category: WorkspaceFilter | "offline";
  readonly label: string;
  readonly tone: "neutral" | "warning" | "success" | "error";
};

function threadState(thread: ThreadShell, connected: boolean): WorkspaceThreadState {
  // A cached running session is not proof that the remote agent is still working.
  if (!connected) return { category: "offline", label: "Offline", tone: "neutral" };
  const status = resolveThreadStatusPill({ thread });
  if (
    status?.label === "Pending Approval" ||
    status?.label === "Awaiting Input" ||
    status?.label === "Plan Ready"
  ) {
    return { category: "attention", label: status.label, tone: "warning" };
  }
  if (
    status?.label === "Working" ||
    status?.label === "Connecting" ||
    status?.label === "Monitoring"
  ) {
    return { category: "working", label: status.label, tone: "success" };
  }
  if (thread.session?.status === "error" || thread.latestTurn?.state === "error") {
    return { category: "attention", label: "Needs review", tone: "error" };
  }
  if (thread.latestTurn?.state === "completed") {
    return { category: "all", label: "Completed", tone: "neutral" };
  }
  if (thread.latestTurn?.state === "interrupted") {
    return { category: "all", label: "Interrupted", tone: "neutral" };
  }
  return { category: "all", label: "Ready", tone: "neutral" };
}

export function buildWorkspaceOverview(
  projects: readonly Project[],
  threads: readonly ThreadShell[],
  connectedEnvironmentIds: ReadonlySet<EnvironmentId>,
) {
  const projectByKey = new Map(
    projects.map((project) => [
      scopedProjectKey(scopeProjectRef(project.environmentId, project.id)),
      project,
    ]),
  );
  const rows = threads
    .filter((thread) => thread.archivedAt === null)
    .flatMap((thread) => {
      const projectKey = scopedProjectKey(scopeProjectRef(thread.environmentId, thread.projectId));
      const project = projectByKey.get(projectKey);
      // A deleted project can briefly outlive its threads in a reconnecting snapshot.
      if (!project) return [];
      return [
        {
          thread,
          project,
          projectKey,
          state: threadState(thread, connectedEnvironmentIds.has(thread.environmentId)),
        },
      ];
    })
    .sort((a, b) => b.thread.updatedAt.localeCompare(a.thread.updatedAt));

  const projectActivity = new Map<string, { count: number; latestAt: string }>();
  for (const row of rows) {
    const current = projectActivity.get(row.projectKey);
    projectActivity.set(row.projectKey, {
      count: (current?.count ?? 0) + 1,
      latestAt: current?.latestAt ?? row.thread.updatedAt,
    });
  }

  return {
    rows,
    projects: projects
      .map((project) => {
        const key = scopedProjectKey(scopeProjectRef(project.environmentId, project.id));
        const activity = projectActivity.get(key);
        return {
          project,
          key,
          threadCount: activity?.count ?? 0,
          latestAt: activity?.latestAt ?? project.updatedAt,
        };
      })
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt)),
    attentionCount: rows.filter((row) => row.state.category === "attention").length,
    workingCount: rows.filter((row) => row.state.category === "working").length,
  };
}

export type WorkspaceThreadRow = ReturnType<typeof buildWorkspaceOverview>["rows"][number];

export function filterWorkspaceThreads(
  rows: readonly WorkspaceThreadRow[],
  query: string,
  filter: WorkspaceFilter,
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return rows.filter((row) => {
    if (filter !== "all" && row.state.category !== filter) return false;
    const searchable = [row.thread.title, row.project.title, row.thread.branch ?? ""]
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
