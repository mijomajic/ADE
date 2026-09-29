import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  type ModelSelection,
} from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  resolveThreadActionProjectRef,
  resolveScopedNewThreadProjectRef,
  hasExplicitComposerModelSelection,
  resolveNewDraftStartFromOrigin,
  resolveNewThreadModelSelectionOverride,
  startNewThreadFromContext,
  type ChatThreadActionContext,
} from "./chatThreadActions";
import { buildSidebarProjectSnapshots } from "../sidebarProjectGrouping";
import type { Project } from "../types";

const ENVIRONMENT_ID = EnvironmentId.make("environment-1");
const PROJECT_ID = ProjectId.make("project-1");
const FALLBACK_PROJECT_ID = ProjectId.make("project-2");
const PROJECT_DEFAULT_SELECTION: ModelSelection = {
  instanceId: ProviderInstanceId.make("codex"),
  model: "project-default",
};
const CARRIED_SELECTION: ModelSelection = {
  instanceId: ProviderInstanceId.make("codex"),
  model: "carried-model",
};

function createContext(overrides: Partial<ChatThreadActionContext> = {}): ChatThreadActionContext {
  return {
    activeDraftThread: null,
    activeThread: undefined,
    defaultProjectRef: scopeProjectRef(ENVIRONMENT_ID, FALLBACK_PROJECT_ID),
    handleNewThread: async () => {},
    ...overrides,
  };
}

describe("chatThreadActions", () => {
  it("only treats an active stored selection marked explicit as an explicit pick", () => {
    const draft = {
      activeProvider: PROJECT_DEFAULT_SELECTION.instanceId,
      modelSelectionByProvider: {
        [PROJECT_DEFAULT_SELECTION.instanceId]: PROJECT_DEFAULT_SELECTION,
      },
      modelSelectionExplicit: true,
    };

    expect(hasExplicitComposerModelSelection(draft)).toBe(true);
    expect(hasExplicitComposerModelSelection({ ...draft, modelSelectionExplicit: false })).toBe(
      false,
    );
    expect(hasExplicitComposerModelSelection({ ...draft, activeProvider: null })).toBe(false);
  });

  it("does not carry a non-explicit model from the destination draft back into itself", () => {
    expect(
      resolveNewThreadModelSelectionOverride({
        projectDefaultSelection: null,
        carrySelection: CARRIED_SELECTION,
        carrySourceDraftId: "draft-a",
        destinationDraftId: "draft-a",
      }),
    ).toBeNull();
  });

  it("still carries models between different threads when the project has no default", () => {
    expect(
      resolveNewThreadModelSelectionOverride({
        projectDefaultSelection: null,
        carrySelection: CARRIED_SELECTION,
        carrySourceDraftId: "draft-a",
        destinationDraftId: "draft-b",
      }),
    ).toEqual(CARRIED_SELECTION);
  });

  it("keeps the project default above any carried selection", () => {
    expect(
      resolveNewThreadModelSelectionOverride({
        projectDefaultSelection: PROJECT_DEFAULT_SELECTION,
        carrySelection: CARRIED_SELECTION,
        carrySourceDraftId: "draft-a",
        destinationDraftId: "draft-b",
      }),
    ).toEqual(PROJECT_DEFAULT_SELECTION);
  });

  it("only applies the start-from-origin default to new worktree drafts", () => {
    expect(
      resolveNewDraftStartFromOrigin({
        envMode: "worktree",
        newWorktreesStartFromOrigin: true,
      }),
    ).toBe(true);
    expect(
      resolveNewDraftStartFromOrigin({
        envMode: "local",
        newWorktreesStartFromOrigin: true,
      }),
    ).toBe(false);
  });

  it("prefers the active thread project when resolving thread actions", () => {
    const projectRef = resolveThreadActionProjectRef(
      createContext({
        activeThread: {
          environmentId: ENVIRONMENT_ID,
          projectId: PROJECT_ID,
        },
      }),
    );

    expect(projectRef).toEqual(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID));
  });

  it("falls back to the active draft thread project when there is no active thread", () => {
    const projectRef = resolveThreadActionProjectRef(
      createContext({
        activeDraftThread: {
          environmentId: ENVIRONMENT_ID,
          projectId: PROJECT_ID,
        },
      }),
    );

    expect(projectRef).toEqual(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID));
  });

  it("falls back to the default project ref when there is no active thread context", () => {
    const projectRef = resolveThreadActionProjectRef(
      createContext({
        defaultProjectRef: scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID),
      }),
    );

    expect(projectRef).toEqual(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID));
  });

  it("inherits only the project from context, never branch or worktree state", async () => {
    const handleNewThread = vi.fn<ChatThreadActionContext["handleNewThread"]>(async () => {});

    const didStart = await startNewThreadFromContext(
      createContext({
        activeThread: {
          environmentId: ENVIRONMENT_ID,
          projectId: PROJECT_ID,
        },
        handleNewThread,
      }),
    );

    expect(didStart).toBe(true);
    expect(handleNewThread).toHaveBeenCalledWith(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID));
  });

  it("does not start a thread when there is no project context", async () => {
    const handleNewThread = vi.fn<ChatThreadActionContext["handleNewThread"]>(async () => {});

    const didStart = await startNewThreadFromContext(
      createContext({
        defaultProjectRef: null,
        handleNewThread,
      }),
    );

    expect(didStart).toBe(false);
    expect(handleNewThread).not.toHaveBeenCalled();
  });

  it("creates in the scoped project even while a different project's thread is open", async () => {
    const handleNewThread = vi.fn<ChatThreadActionContext["handleNewThread"]>(async () => {});
    const scopedProjectRef = scopeProjectRef(ENVIRONMENT_ID, FALLBACK_PROJECT_ID);

    await startNewThreadFromContext(
      createContext({
        activeThread: { environmentId: ENVIRONMENT_ID, projectId: PROJECT_ID },
        scopedProjectRef,
        handleNewThread,
      }),
    );

    expect(handleNewThread).toHaveBeenCalledExactlyOnceWith(scopedProjectRef);
  });
});

describe("scoped new-thread project selection", () => {
  const remoteEnvironmentId = EnvironmentId.make("environment-remote");
  const localProject: Project = {
    id: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    title: "ADE",
    workspaceRoot: "/projects/ade",
    repositoryIdentity: {
      canonicalKey: "github.com/example/ade",
      locator: {
        source: "git-remote",
        remoteName: "origin",
        remoteUrl: "https://github.com/example/ade.git",
      },
    },
    defaultModelSelection: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    scripts: [],
  };
  const remoteProject: Project = {
    ...localProject,
    id: ProjectId.make("remote-ade"),
    environmentId: remoteEnvironmentId,
  };
  const [group] = buildSidebarProjectSnapshots({
    projects: [localProject, remoteProject],
    primaryEnvironmentId: ENVIRONMENT_ID,
    settings: { sidebarProjectGroupingMode: "repository", sidebarProjectGroupingOverrides: {} },
    resolveEnvironmentLabel: () => null,
  });

  it("keeps a merged project's active remote checkout", () => {
    expect(
      resolveScopedNewThreadProjectRef(
        group,
        scopeProjectRef(remoteEnvironmentId, remoteProject.id),
      ),
    ).toEqual(scopeProjectRef(remoteEnvironmentId, remoteProject.id));
  });

  it("keeps the active machine when switching from a different project to a merged scope", () => {
    expect(
      resolveScopedNewThreadProjectRef(
        group,
        scopeProjectRef(remoteEnvironmentId, FALLBACK_PROJECT_ID),
      ),
    ).toEqual(scopeProjectRef(remoteEnvironmentId, remoteProject.id));
  });

  it("falls back to the scoped representative when the active machine has no checkout", () => {
    expect(
      resolveScopedNewThreadProjectRef(
        group,
        scopeProjectRef(EnvironmentId.make("third-environment"), FALLBACK_PROJECT_ID),
      ),
    ).toEqual(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID));
    expect(resolveScopedNewThreadProjectRef(group, null)).toEqual(
      scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID),
    );
  });

  it("leaves all-projects and stale project scopes contextual", () => {
    const preferred = scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID);
    expect(resolveScopedNewThreadProjectRef(null, preferred)).toBeNull();
    expect(resolveScopedNewThreadProjectRef(undefined, preferred)).toBeNull();
    expect(
      resolveThreadActionProjectRef(
        createContext({
          activeDraftThread: { environmentId: ENVIRONMENT_ID, projectId: PROJECT_ID },
          scopedProjectRef: null,
        }),
      ),
    ).toEqual(preferred);
  });
});
