import type { TunerProposal, SettingsChange, PromptChange } from "@/types/autotuner";

/**
 * Parse the tuner LLM's JSON response into a TunerProposal.
 * Handles code fences, trailing commas, and other common LLM JSON issues.
 */
export function parseProposal(raw: string): TunerProposal {
  // Strip code fences
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Strip leading/trailing non-JSON text
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse proposal JSON: ${raw.substring(0, 200)}`);
  }

  const stopTuning = Boolean(parsed.stop_tuning ?? parsed.stopTuning ?? false);
  const stopReason = (parsed.stop_reason ?? parsed.stopReason ?? undefined) as string | undefined;
  const reasoning = (parsed.reasoning ?? "") as string;

  const settingsChanges: SettingsChange[] = [];
  const rawSettings = parsed.settings_changes ?? parsed.settingsChanges;
  if (Array.isArray(rawSettings)) {
    for (const sc of rawSettings) {
      if (sc && typeof sc === "object" && "parameter" in sc) {
        settingsChanges.push({
          parameter: sc.parameter,
          oldValue: sc.old_value ?? sc.oldValue ?? "",
          newValue: sc.new_value ?? sc.newValue ?? "",
          reason: sc.reason ?? "",
        });
      }
    }
  }

  const promptChanges: PromptChange[] = [];
  const rawPrompts = parsed.prompt_changes ?? parsed.promptChanges;
  if (Array.isArray(rawPrompts)) {
    for (const pc of rawPrompts) {
      if (pc && typeof pc === "object" && "file_path" in pc) {
        promptChanges.push({
          filePath: pc.file_path ?? pc.filePath ?? "",
          searchText: pc.search_text ?? pc.searchText ?? "",
          replaceText: pc.replace_text ?? pc.replaceText ?? "",
          originalContent: "",
          modifiedContent: "",
          reason: pc.reason ?? "",
        });
      }
    }
  }

  return { stopTuning, stopReason, settingsChanges, promptChanges, reasoning };
}
