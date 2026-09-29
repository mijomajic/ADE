import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId, TurnId } from "@t3tools/contracts";

import type { Project, ThreadShell } from "../../types";
import { buildWorkspaceOverview, filterWorkspaceThreads } from "./workspaceOverview";

const local = EnvironmentId.make("local");
const remote = EnvironmentId.make("remote");
const timestamp = "2026-09-29T12:00:00.000Z";

function project(environmentId = local, title = "ADE"): Project {
  return {
    environmentId,
    id: ProjectId.make("project"),
    title,
    workspaceRoot: "/work/ade",
    defaultModelSelection: null,
    scripts: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function thread(overrides: Partial<ThreadShell> = {}): ThreadShell {
  return {
    id: ThreadId.make("thread"),
    environmentId: local,
    projectId: ProjectId.make("project"),
    title: "Fix the sidebar",
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: "codex/sidebar",
    worktreePath: null,
    latestTurn: null,
    session: null,
    pullRequests: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    ...overrides,
  };
}

describe("workspace overview", () => {
  it("keeps equal project ids on different environments separate", () => {
    const result = buildWorkspaceOverview(
      [project(), project(remote, "Remote project")],
      [thread(), thread({ id: ThreadId.make("remote-thread"), environmentId: remote })],
      new Set([local, remote]),
      timestamp,
    );
    expect(result.rows.map((row) => row.project.title)).toEqual(["ADE", "Remote project"]);
    expect(result.projects.map((entry) => entry.threadCount)).toEqual([1, 1]);
    expect(new Set(result.projects.map((entry) => entry.key)).size).toBe(2);
  });

  it("excludes archived and orphaned threads from recent work and totals", () => {
    const result = buildWorkspaceOverview(
      [project()],
      [
        thread(),
        thread({ id: ThreadId.make("archived"), archivedAt: timestamp, hasPendingApprovals: true }),
        thread({ id: ThreadId.make("orphan"), projectId: ProjectId.make("deleted") }),
      ],
      new Set([local]),
      timestamp,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.attentionCount).toBe(0);
    expect(result.projects[0]?.threadCount).toBe(1);
  });

  it("does not report cached remote work as live activity", () => {
    const running = thread({ backgroundLiveness: "working", hasPendingApprovals: true });
    const offline = buildWorkspaceOverview([project()], [running], new Set(), timestamp);
    expect(offline.rows[0]?.state.label).toBe("Offline");
    expect(offline.workingCount).toBe(0);
    expect(offline.attentionCount).toBe(0);
    const connected = buildWorkspaceOverview([project()], [running], new Set([local]), timestamp);
    expect(connected.rows[0]?.state.label).toBe("Pending Approval");
    expect(connected.attentionCount).toBe(1);
  });

  it("surfaces actionable input and errors separately from background work", () => {
    const result = buildWorkspaceOverview(
      [project()],
      [
        thread({ hasPendingUserInput: true }),
        thread({ id: ThreadId.make("working"), backgroundLiveness: "working" }),
        thread({
          id: ThreadId.make("error"),
          latestTurn: {
            turnId: TurnId.make("turn"),
            state: "error",
            requestedAt: timestamp,
            startedAt: timestamp,
            completedAt: timestamp,
            assistantMessageId: null,
          },
        }),
      ],
      new Set([local]),
      timestamp,
    );
    expect(result.attentionCount).toBe(2);
    expect(result.workingCount).toBe(1);
    expect(
      filterWorkspaceThreads(result.rows, "", "attention").map((row) => row.state.label),
    ).toEqual(["Awaiting Input", "Needs review"]);
  });

  it("sorts newest first without changing the server's thread array", () => {
    const threads = [
      thread(),
      thread({ id: ThreadId.make("newest"), updatedAt: "2026-09-29T13:00:00.000Z" }),
    ];
    const result = buildWorkspaceOverview([project()], threads, new Set([local]), timestamp);
    expect(result.rows[0]?.thread.id).toBe("newest");
    expect(threads[0]?.id).toBe("thread");
    expect(result.projects[0]?.latestAt).toBe("2026-09-29T13:00:00.000Z");
  });

  it("acknowledges settled failures and plans without hiding new requests or live work", () => {
    const settled = thread({
      settledOverride: "settled",
      settledAt: timestamp,
      latestTurn: {
        turnId: TurnId.make("turn"),
        state: "error",
        requestedAt: timestamp,
        startedAt: timestamp,
        completedAt: timestamp,
        assistantMessageId: null,
      },
    });
    const result = buildWorkspaceOverview(
      [project()],
      [
        settled,
        { ...settled, id: ThreadId.make("approval"), hasPendingApprovals: true },
        { ...settled, id: ThreadId.make("working"), backgroundLiveness: "working" },
        {
          ...settled,
          id: ThreadId.make("plan"),
          interactionMode: "plan",
          hasActionableProposedPlan: true,
          latestTurn: { ...settled.latestTurn!, state: "completed" },
        },
      ],
      new Set([local]),
      timestamp,
    );
    expect(result.rows.map((row) => row.state.label)).toEqual([
      "Done",
      "Pending Approval",
      "Working",
      "Done",
    ]);
    expect(result.attentionCount).toBe(1);
    expect(result.workingCount).toBe(1);
    expect(filterWorkspaceThreads(result.rows, "", "all")).toHaveLength(4);
  });

  it("combines case-insensitive query terms across title, project and branch with status filtering", () => {
    const result = buildWorkspaceOverview(
      [project()],
      [
        thread({ hasPendingApprovals: true }),
        thread({ id: ThreadId.make("other"), title: "Review the API", branch: "codex/api" }),
      ],
      new Set([local]),
      timestamp,
    );
    expect(filterWorkspaceThreads(result.rows, " ADE  SIDEBAR ", "attention")).toHaveLength(1);
    expect(filterWorkspaceThreads(result.rows, "codex/api", "all")).toHaveLength(1);
    expect(filterWorkspaceThreads(result.rows, "codex/api", "attention")).toHaveLength(0);
    expect(filterWorkspaceThreads(result.rows, "   ", "all")).toHaveLength(2);
  });

  it("respects acknowledged snoozes but surfaces new failures, input, and ongoing work", () => {
    const snoozed = thread({
      snoozedAt: timestamp,
      snoozedUntil: "2026-09-29T13:00:00.000Z",
      session: {
        threadId: ThreadId.make("thread"),
        status: "error",
        providerName: "Codex",
        runtimeMode: "full-access",
        activeTurnId: null,
        lastError: "Connection lost",
        updatedAt: "2026-09-29T11:59:00.000Z",
      },
    });
    const result = buildWorkspaceOverview(
      [project()],
      [
        snoozed,
        {
          ...snoozed,
          id: ThreadId.make("new-failure"),
          session: { ...snoozed.session!, updatedAt: "2026-09-29T12:01:00.000Z" },
        },
        { ...snoozed, id: ThreadId.make("input"), hasPendingUserInput: true },
        { ...snoozed, id: ThreadId.make("working"), backgroundLiveness: "working" },
      ],
      new Set([local]),
      "2026-09-29T12:02:00.000Z",
    );
    expect(result.rows.map((row) => row.state.label)).toEqual([
      "Snoozed",
      "Needs review",
      "Awaiting Input",
      "Working",
    ]);
    expect(result.attentionCount).toBe(2);
    expect(result.workingCount).toBe(1);
    expect(result.nextSnoozeWakeAt).toBe(Date.parse(snoozed.snoozedUntil!));

    const afterWake = buildWorkspaceOverview(
      [project()],
      [snoozed],
      new Set([local]),
      snoozed.snoozedUntil!,
    );
    expect(afterWake.attentionCount).toBe(1);
    expect(afterWake.nextSnoozeWakeAt).toBeNull();
  });
});
