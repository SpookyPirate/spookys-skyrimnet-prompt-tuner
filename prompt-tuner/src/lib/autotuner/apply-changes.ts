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
 * Escape special regex characters in a string.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a regex from search text that allows flexible whitespace matching.
 * Splits the text into non-whitespace tokens and joins them with \s+ patterns,
 * so "foo  bar\nbaz" matches "foo bar\n  baz" etc.
 */
function buildFlexibleRegex(searchText: string): RegExp | null {
  const tokens = searchText.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const pattern = tokens.map(escapeRegex).join("\\s+");
  return new RegExp(pattern, "s");
}

/**
 * Apply prompt changes by writing modified files via the API.
 * Each change is a search/replace within a file.
 * Tries exact match first, then falls back to flexible whitespace matching.
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

    let modifiedContent: string;

    if (originalContent.includes(change.searchText)) {
      // Exact match
      modifiedContent = originalContent.replace(change.searchText, change.replaceText);
    } else {
      // Fallback: flexible whitespace matching
      const flexRegex = buildFlexibleRegex(change.searchText);
      if (!flexRegex || !flexRegex.test(originalContent)) {
        throw new Error(`Search text not found in ${change.filePath}: "${change.searchText.substring(0, 80)}..."`);
      }
      modifiedContent = originalContent.replace(flexRegex, change.replaceText);
    }

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
