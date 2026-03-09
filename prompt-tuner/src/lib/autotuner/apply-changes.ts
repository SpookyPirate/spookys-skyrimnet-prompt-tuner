import type { AiTuningSettings } from "@/types/config";
import type { SettingsChange, PromptChange } from "@/types/autotuner";

/**
 * Normalize a parameter name from snake_case (LLM output) to camelCase (store keys).
 * e.g. "max_tokens" → "maxTokens", "frequency_penalty" → "frequencyPenalty"
 */
const PARAM_ALIASES: Record<string, keyof AiTuningSettings> = {
  max_tokens: "maxTokens",
  top_p: "topP",
  top_k: "topK",
  frequency_penalty: "frequencyPenalty",
  presence_penalty: "presencePenalty",
  stop_sequences: "stopSequences",
  structured_outputs: "structuredOutputs",
  allow_reasoning: "allowReasoning",
  reasoning_effort: "reasoningEffort",
};

function normalizeParamKey(key: string): keyof AiTuningSettings {
  return PARAM_ALIASES[key] || key as keyof AiTuningSettings;
}

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
    const key = normalizeParamKey(change.parameter);
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
 *
 * @param changes - The proposed prompt changes to apply.
 * @param sourceSetName - Optional: name of the original source prompt set the temp set
 *   was derived from. When a file doesn't exist in the temp set yet (because the temp
 *   set is now empty by default), it is seeded from this set, falling back to the
 *   original prompts if the source set doesn't have it either.
 *
 * Returns the changes with originalContent and modifiedContent filled in.
 */
export async function applyPromptChanges(
  changes: PromptChange[],
  sourceSetName?: string,
): Promise<PromptChange[]> {
  const applied: PromptChange[] = [];

  for (const change of changes) {
    // Build the read URL with optional fallbacks so that if the file doesn't exist in
    // the temp set yet, we seed it from the source set (or the original prompts).
    let readUrl = `/api/files/read?path=${encodeURIComponent(change.filePath)}`;
    if (sourceSetName && sourceSetName !== "__tuner_temp__") {
      readUrl += `&fallback=${encodeURIComponent(sourceSetName)}`;
    }
    readUrl += `&fallback=__original__`;

    // Read current content
    const readResp = await fetch(readUrl);
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
