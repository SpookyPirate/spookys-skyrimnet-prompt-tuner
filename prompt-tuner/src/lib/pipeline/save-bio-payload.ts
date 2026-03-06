import { useSaveBioStore } from "@/stores/saveBioStore";
import { useAppStore } from "@/stores/appStore";

/**
 * Build the enabledSaves payload for render API calls.
 * Reads from the saveBioStore and the active prompt set.
 * Returns undefined if no saves are enabled (to avoid sending empty arrays).
 */
export function buildEnabledSavesPayload() {
  const activePromptSet = useAppStore.getState().activePromptSet;
  if (!activePromptSet) return undefined;

  const enabled = useSaveBioStore.getState().getEnabledSaves(activePromptSet);
  if (enabled.length === 0) return undefined;

  return enabled.map((s) => ({
    saveId: s.saveId,
    priorities: s.config.priorities,
  }));
}
