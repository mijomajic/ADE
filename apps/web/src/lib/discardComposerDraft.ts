import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import type { ScopedThreadRef } from "@t3tools/contracts";
import {
  composerDraftHasUserContent,
  type DraftId,
  useComposerDraftStore,
} from "../composerDraftStore";
import { readLocalApi } from "../localApi";
import { releaseComposerDraftUploads } from "./composerDraftUploads";

/** Discarding unsent work always needs confirmation, including drafts with
 * attachments and no text. Uploads stay owned until confirmation succeeds. */
export async function discardComposerDraft(
  target: ScopedThreadRef | DraftId,
  options: { discardSession?: boolean } = {},
): Promise<boolean> {
  const draft = useComposerDraftStore.getState().getComposerDraft(target);
  if (composerDraftHasUserContent(draft)) {
    const api = readLocalApi();
    if (!api) return false;
    const confirmed = await settlePromise(() =>
      api.dialogs.confirm(
        "Discard this draft?\nYour unsent message and attachments will be permanently removed.",
        { variant: "destructive" },
      ),
    );
    if (confirmed._tag === "Failure" || !confirmed.value) return false;
  }

  releaseComposerDraftUploads(target);
  const store = useComposerDraftStore.getState();
  if (options.discardSession) {
    store.clearDraftThread(target);
  } else {
    store.clearComposerContent(target);
  }
  return true;
}
