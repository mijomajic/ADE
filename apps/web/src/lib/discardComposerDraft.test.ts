import {
  scopeProjectRef,
  scopeThreadRef,
  scopedThreadKey,
} from "@t3tools/client-runtime/environment";
import { EnvironmentId, ProjectId, ThreadId, type LocalApi } from "@t3tools/contracts";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DraftId,
  useComposerDraftStore,
  type ComposerThreadDraftState,
} from "../composerDraftStore";
import { discardComposerDraft } from "./discardComposerDraft";

const harness = vi.hoisted(() => ({
  confirm: vi.fn<LocalApi["dialogs"]["confirm"]>(),
  release: vi.fn(),
  available: true,
}));

vi.mock("../localApi", () => ({
  readLocalApi: () => (harness.available ? { dialogs: { confirm: harness.confirm } } : undefined),
}));
vi.mock("./composerDraftUploads", () => ({ releaseComposerDraftUploads: harness.release }));

const environmentId = EnvironmentId.make("draft-environment");
const threadRef = scopeThreadRef(environmentId, ThreadId.make("draft-thread"));
const draftId = DraftId.make("standalone-draft");
const projectRef = scopeProjectRef(environmentId, ProjectId.make("draft-project"));

function seedDraft(target: typeof threadRef | DraftId, patch: Partial<ComposerThreadDraftState>) {
  const draft: ComposerThreadDraftState = {
    prompt: "",
    images: [],
    files: [],
    nonPersistedImageIds: [],
    persistedAttachments: [],
    terminalContexts: [],
    previewAnnotations: [],
    reviewComments: [],
    modelSelectionByProvider: {},
    activeProvider: null,
    runtimeMode: null,
    interactionMode: null,
    ...patch,
  };
  const key = typeof target === "string" ? target : scopedThreadKey(target);
  useComposerDraftStore.setState({ draftsByThreadKey: { [key]: draft } });
  return draft;
}

beforeEach(() => {
  useComposerDraftStore.setState(useComposerDraftStore.getInitialState());
  harness.confirm.mockReset();
  harness.release.mockReset();
  harness.available = true;
});

describe.each([
  { name: "standalone draft", target: draftId, discardSession: true },
  { name: "existing thread draft", target: threadRef, discardSession: false },
])("discard $name", ({ target, discardSession }) => {
  beforeEach(() => {
    if (discardSession) {
      useComposerDraftStore.getState().setProjectDraftThreadId(projectRef, draftId, {
        threadId: threadRef.threadId,
      });
    }
  });

  it("keeps content and uploads while confirmation is pending, then discards on approval", async () => {
    const draft = seedDraft(target, { prompt: "Work I have not sent yet" });
    const session = useComposerDraftStore.getState().getDraftSession(draftId);
    let resolveApproval!: (approved: boolean) => void;
    const approval = new Promise<boolean>((resolve) => {
      resolveApproval = resolve;
    });
    harness.confirm.mockReturnValue(approval);

    const result = discardComposerDraft(target, { discardSession });
    expect(useComposerDraftStore.getState().getComposerDraft(target)).toEqual(draft);
    expect(useComposerDraftStore.getState().getDraftSession(draftId)).toEqual(session);
    expect(harness.release).not.toHaveBeenCalled();

    resolveApproval(true);
    expect(await result).toBe(true);
    expect(useComposerDraftStore.getState().getComposerDraft(target)).toBeNull();
    expect(useComposerDraftStore.getState().getDraftSession(draftId)).toBeNull();
    expect(harness.release).toHaveBeenCalledExactlyOnceWith(target);
  });

  it.each(["cancel", "reject", "missing host"])("preserves unsent work on %s", async (outcome) => {
    const draft = seedDraft(target, { prompt: "Keep this draft" });
    const session = useComposerDraftStore.getState().getDraftSession(draftId);
    if (outcome === "reject") harness.confirm.mockRejectedValue(new Error("Dialog unavailable"));
    else if (outcome === "missing host") harness.available = false;
    else harness.confirm.mockResolvedValue(false);

    expect(await discardComposerDraft(target, { discardSession })).toBe(false);
    expect(useComposerDraftStore.getState().getComposerDraft(target)).toEqual(draft);
    expect(useComposerDraftStore.getState().getDraftSession(draftId)).toEqual(session);
    expect(harness.release).not.toHaveBeenCalled();
  });
});

describe("attachment and context-only drafts", () => {
  const file = new File(["unsent"], "notes.txt", { type: "text/plain" });
  const content: Array<{ name: string; patch: Partial<ComposerThreadDraftState> }> = [
    {
      name: "image",
      patch: {
        images: [
          {
            type: "image",
            id: "image",
            name: "preview.png",
            mimeType: "image/png",
            sizeBytes: 6,
            previewUrl: "blob:preview",
            file,
          },
        ],
      },
    },
    {
      name: "file",
      patch: {
        files: [
          {
            type: "file",
            id: "file",
            name: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            file,
          },
        ],
      },
    },
    {
      name: "persisted attachment awaiting rehydration",
      patch: {
        persistedAttachments: [
          {
            id: "image",
            name: "preview.png",
            mimeType: "image/png",
            sizeBytes: 6,
            dataUrl: "data:image/png;base64,AAAA",
          },
        ],
      },
    },
    {
      name: "terminal context",
      patch: {
        terminalContexts: [
          {
            id: "terminal",
            threadId: threadRef.threadId,
            terminalId: "default",
            terminalLabel: "Terminal",
            lineStart: 1,
            lineEnd: 1,
            text: "unsent log",
            createdAt: "2026-09-01T00:00:00.000Z",
          },
        ],
      },
    },
    {
      name: "preview annotation",
      patch: {
        previewAnnotations: [
          {
            id: "preview",
            pageUrl: "http://localhost:3000",
            pageTitle: "Preview",
            comment: "Fix this",
            elements: [],
            regions: [],
            strokes: [],
            styleChanges: [],
            screenshot: null,
            createdAt: "2026-09-01T00:00:00.000Z",
          },
        ],
      },
    },
    {
      name: "review comment",
      patch: {
        reviewComments: [
          {
            id: "review",
            sectionId: "file",
            sectionTitle: "File",
            filePath: "index.ts",
            startIndex: 0,
            endIndex: 0,
            rangeLabel: "L1",
            text: "Fix this",
            diff: "+ const value = 1;",
          },
        ],
      },
    },
  ];

  it.each(content)("asks before discarding a draft containing only $name", async ({ patch }) => {
    const draft = seedDraft(threadRef, patch);
    harness.confirm.mockResolvedValue(false);

    expect(await discardComposerDraft(threadRef)).toBe(false);
    expect(harness.confirm).toHaveBeenCalledWith(expect.stringContaining("Discard this draft?"), {
      variant: "destructive",
    });
    expect(useComposerDraftStore.getState().getComposerDraft(threadRef)).toEqual(draft);
    expect(harness.release).not.toHaveBeenCalled();
  });

  it("clears an empty draft without asking", async () => {
    seedDraft(threadRef, { prompt: "   " });
    expect(await discardComposerDraft(threadRef)).toBe(true);
    expect(harness.confirm).not.toHaveBeenCalled();
    expect(useComposerDraftStore.getState().getComposerDraft(threadRef)).toBeNull();
  });
});
