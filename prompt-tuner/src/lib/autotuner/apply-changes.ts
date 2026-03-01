import type { AiTuningSettings } from "@/types/config";
import type { SettingsChange, PromptChange } from "@/types/autotuner";

/**
 * Apply settings changes to a copy of the working settings.
 * Returns a new AiTuningSettings object (does not mutate).
 */
export function applySettingsChanges(
  current: AiTuningSettings,
  changes: SettingsChange[],
): AiTuningSettings {
  const result = { ...current };

  for (const change of changes) {
    const key = change.parameter;
    if (!(key in result)) continue;

    const currentVal = result[key];
    let newVal: typeof currentVal;

    if (typeof currentVal === "number") {
      newVal = Number(change.newValue);
      if (isNaN(newVal as number)) continue;
    } else if (typeof currentVal === "boolean") {
      newVal = change.newValue === true || change.newValue === "true";
    } else {
      newVal = String(change.newValue);
    }

    (result as Record<string, unknown>)[key] = newVal;
  }

  return result;
}

/**
 * Apply prompt changes by writing modified files via the API.
 * Each change is a search/replace within a file.
 * Returns the changes with originalContent and modifiedContent filled in.
 */
export async function applyPromptChanges(
  changes: PromptChange[],
): Promise<PromptChange[]> {
  const applied: PromptChange[] = [];

  for (const change of changes) {
    // Read current content
    const readResp = await fetch(`/api/files/read?path=${encodeURIComponent(change.filePath)}`);
    if (!readResp.ok) {
      throw new Error(`Failed to read ${change.filePath}: HTTP ${readResp.status}`);
    }
    const { content: originalContent } = await readResp.json();

    if (!originalContent.includes(change.searchText)) {
      throw new Error(`Search text not found in ${change.filePath}: "${change.searchText.substring(0, 50)}..."`);
    }

    const modifiedContent = originalContent.replace(change.searchText, change.replaceText);

    // Write modified content
    const writeResp = await fetch("/api/files/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: change.filePath, content: modifiedContent }),
    });

    if (!writeResp.ok) {
      throw new Error(`Failed to write ${change.filePath}: HTTP ${writeResp.status}`);
    }

    applied.push({
      ...change,
      originalContent,
      modifiedContent,
    });
  }

  return applied;
}
