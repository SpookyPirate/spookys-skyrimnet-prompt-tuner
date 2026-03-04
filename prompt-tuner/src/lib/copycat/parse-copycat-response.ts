import type { TunerProposal, SettingsChange, PromptChange } from "@/types/autotuner";

export interface CopycatParsedResponse {
  effectivenessScore: number;
  comparison: string;
  proposal: TunerProposal;
  verificationRequests: string[];
}

/**
 * Parse the Copycat LLM's JSON response into structured data.
 * Extends the base proposal parsing with effectiveness_score, comparison, and verification_requests.
 */
export function parseCopycatResponse(raw: string): CopycatParsedResponse {
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
    throw new Error(`Failed to parse copycat response JSON: ${raw.substring(0, 200)}`);
  }

  // Extract copycat-specific fields
  const effectivenessScore = Number(parsed.effectiveness_score ?? parsed.effectivenessScore ?? 0);
  const comparison = String(parsed.comparison ?? "");

  // Extract standard proposal fields
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

  const verificationRequests: string[] = [];
  const rawVerification = parsed.verification_requests ?? parsed.verificationRequests;
  if (Array.isArray(rawVerification)) {
    for (const v of rawVerification) {
      if (typeof v === "string" && v.trim()) {
        verificationRequests.push(v.trim());
      }
    }
  }

  return {
    effectivenessScore: Math.max(0, Math.min(100, effectivenessScore)),
    comparison,
    proposal: { stopTuning, stopReason, settingsChanges, promptChanges, reasoning },
    verificationRequests,
  };
}
