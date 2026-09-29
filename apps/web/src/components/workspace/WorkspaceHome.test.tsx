// @vitest-environment jsdom
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import type { Project, ThreadShell } from "../../types";

const mocks = vi.hoisted(() => ({
  projects: vi.fn(),
  threads: vi.fn(),
  bootstrapped: vi.fn(),
  environments: vi.fn(),
  newThread: vi.fn(),
}));

vi.mock("../../state/entities", () => ({
  useProjects: mocks.projects,
  useThreadShells: mocks.threads,
  useAllEnvironmentShellsBootstrapped: mocks.bootstrapped,
}));
vi.mock("../../state/environments", () => ({ useEnvironments: mocks.environments }));
vi.mock("../../hooks/useHandleNewThread", () => ({
  useNewThreadHandler: () => mocks.newThread,
}));
vi.mock("../../env", () => ({ isElectron: false }));
vi.mock("../ProjectFavicon", () => ({ ProjectFavicon: () => null }));

import { WorkspaceHome } from "./WorkspaceHome";

const local = EnvironmentId.make("local");
const remote = EnvironmentId.make("remote");
const timestamp = "2026-09-29T12:00:00.000Z";
const project: Project = {
  environmentId: local,
  id: ProjectId.make("project"),
  title: "ADE",
  workspaceRoot: "/work/ade",
  defaultModelSelection: null,
  scripts: [],
  createdAt: timestamp,
  updatedAt: timestamp,
};
const thread: ThreadShell = {
  id: ThreadId.make("thread"),
  environmentId: local,
  projectId: project.id,
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
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  mocks.projects.mockReturnValue([project]);
  mocks.threads.mockReturnValue([thread]);
  mocks.bootstrapped.mockReturnValue(true);
  mocks.environments.mockReturnValue({
    environments: [
      { environmentId: local, label: "This machine", connection: { phase: "connected" } },
      { environmentId: remote, label: "Build machine", connection: { phase: "connecting" } },
    ],
  });
  mocks.newThread.mockResolvedValue({ draftId: "draft", threadId: "new-thread" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function openWorkspace() {
  const rootRoute = createRootRoute({ component: Outlet });
  const home = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: WorkspaceHome,
  });
  const detail = createRoute({
    getParentRoute: () => rootRoute,
    path: "/$environmentId/$threadId",
    component: () => <div>Thread details</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([home, detail]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  await act(async () => root.render(<RouterProvider router={router} />));
  return router;
}

function button(label: string) {
  const result = [...container.querySelectorAll("button")].find(
    (element) => element.getAttribute("aria-label") === label || element.textContent === label,
  );
  expect(result, `button ${label}`).toBeDefined();
  return result!;
}

it("keeps loaded work usable while another environment is still connecting", async () => {
  mocks.bootstrapped.mockReturnValue(false);
  await openWorkspace();

  expect(container.textContent).toContain("Showing available work");
  expect(container.querySelector('[aria-label="Loading workspace"]')).toBeNull();
  expect(container.querySelector('a[href="/local/thread"]')?.textContent).toContain(
    "Fix the sidebar",
  );
  await act(async () => button("Start a thread in ADE on This machine").click());
  expect(mocks.newThread).toHaveBeenCalledWith({ environmentId: local, projectId: project.id });

  await act(async () => button("Needs attention").click());
  expect(container.textContent).toContain("No matching threads loaded yet");
  expect(container.textContent).not.toContain("Nothing needs your attention");
  await act(async () => button("Show all threads").click());
  expect(container.querySelector('a[href="/local/thread"]')).not.toBeNull();
});

it("keeps an empty initial snapshot in a loading state", async () => {
  mocks.bootstrapped.mockReturnValue(false);
  mocks.projects.mockReturnValue([]);
  mocks.threads.mockReturnValue([]);
  await openWorkspace();

  expect(container.querySelector('[aria-label="Loading workspace"]')).not.toBeNull();
  expect(container.textContent).not.toContain("Start with a project");
  expect(container.textContent).not.toContain("Your next idea starts here");
});

it("offers reconnection when offline environments have no cached work", async () => {
  mocks.projects.mockReturnValue([]);
  mocks.threads.mockReturnValue([]);
  mocks.environments.mockReturnValue({
    environments: [
      { environmentId: remote, label: "Build machine", connection: { phase: "error" } },
    ],
  });
  await openWorkspace();

  expect(container.textContent).toContain("Reconnect to your work.");
  expect(container.textContent).not.toContain("Start with a project");
  expect(
    [...container.querySelectorAll('a[href="/settings/connections"]')].some((element) =>
      element.textContent?.includes("Open Connections"),
    ),
  ).toBe(true);
});

it("keeps cached remote threads navigable without allowing offline project starts", async () => {
  mocks.projects.mockReturnValue([project, { ...project, environmentId: remote }]);
  mocks.threads.mockReturnValue([thread, { ...thread, environmentId: remote }]);
  const router = await openWorkspace();
  const offlineCard = button(
    "ADE on Build machine is offline. Reconnect in Connections to start a thread.",
  );
  await act(async () => {
    offlineCard.focus();
    offlineCard.click();
  });
  expect(document.activeElement).toBe(offlineCard);
  expect(mocks.newThread).not.toHaveBeenCalled();

  const remoteThread = container.querySelector<HTMLAnchorElement>('a[href="/remote/thread"]');
  expect(remoteThread?.textContent).toContain("Offline");
  expect(remoteThread?.textContent).toContain("ADE · Build machine");
  await act(async () => remoteThread!.click());
  expect(router.state.location.pathname).toBe("/remote/thread");
  expect(container.textContent).toContain("Thread details");
});

it("prevents overlapping project starts and recovers after a failed start", async () => {
  let rejectStart = (_reason: Error) => {};
  mocks.newThread.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectStart = reject;
      }),
  );
  mocks.projects.mockReturnValue([
    project,
    { ...project, id: ProjectId.make("other"), title: "API" },
  ]);
  await openWorkspace();

  await act(async () => {
    button("Start a thread in ADE on This machine").click();
    button("Start a thread in API on This machine").click();
  });
  expect(mocks.newThread).toHaveBeenCalledTimes(1);
  await act(async () => rejectStart(new Error("Connection lost")));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not open ADE");
  await act(async () => button("Start a thread in API on This machine").click());
  expect(mocks.newThread).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("restores snoozed attention at its deadline without waiting for a server event", async () => {
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
  vi.setSystemTime(new Date(timestamp));
  mocks.threads.mockReturnValue([
    {
      ...thread,
      snoozedAt: timestamp,
      snoozedUntil: "2026-09-29T12:00:10.000Z",
      session: {
        threadId: thread.id,
        status: "error",
        providerName: "Codex",
        runtimeMode: "full-access",
        activeTurnId: null,
        lastError: "Connection lost",
        updatedAt: "2026-09-29T11:59:00.000Z",
      },
    },
  ]);
  await openWorkspace();
  await act(async () => button("Needs attention").click());
  expect(container.querySelector('a[href="/local/thread"]')).toBeNull();
  await act(async () => vi.advanceTimersByTime(10_100));
  expect(container.querySelector('a[href="/local/thread"]')?.textContent).toContain("Needs review");
});
