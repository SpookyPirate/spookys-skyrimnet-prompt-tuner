import type { ChatMessage } from "@/types/llm";
import type { AiTuningSettings } from "@/types/config";
import type { TuningTarget, TunerRound } from "@/types/autotuner";
import type { BenchmarkCategory } from "@/types/benchmark";
import { getCategoryDef } from "@/lib/benchmark/categories";
import { AGENT_DESCRIPTIONS } from "@/types/config";

const SETTINGS_DESCRIPTIONS: Record<keyof AiTuningSettings, string> = {
  temperature: "Controls randomness. Lower = more deterministic, higher = more creative. Range: 0.0-2.0",
  maxTokens: "Maximum tokens in the response. Higher allows longer outputs.",
  topP: "Nucleus sampling. Lower values focus on more likely tokens. Range: 0.0-1.0",
  topK: "Top-K sampling. Number of top tokens to consider. 0 = disabled.",
  frequencyPenalty: "Penalizes repeated tokens based on frequency. Range: -2.0 to 2.0",
  presencePenalty: "Penalizes tokens that have appeared at all. Range: -2.0 to 2.0",
  stopSequences: "JSON array of strings that stop generation when encountered.",
  structuredOutputs: "Whether to use structured/JSON output mode.",
  allowReasoning: "Whether to allow the model to use extended thinking/reasoning. In SkyrimNet, reasoning OFF usually produces better and faster roleplay results. Only enable if the task genuinely requires complex multi-step analysis.",
};

/**
 * Build messages for the proposal step of auto-tuning.
 * The tuner LLM receives context about the agent, current settings/prompts,
 * previous rounds, and the latest benchmark + assessment, then proposes changes.
 */
export function buildProposalMessages({
  category,
  tuningTarget,
  currentSettings,
  originalSettings,
  promptContent,
  previousRounds,
  currentAssessment,
  currentResponse,
  currentLatencyMs,
  currentTokens,
  lockedSettings = [],
  customInstructions = "",
}: {
  category: BenchmarkCategory;
  tuningTarget: TuningTarget;
  currentSettings: AiTuningSettings;
  originalSettings: AiTuningSettings;
  promptContent: string;
  previousRounds: TunerRound[];
  currentAssessment: string;
  currentResponse: string;
  currentLatencyMs: number;
  currentTokens: number;
  lockedSettings?: (keyof AiTuningSettings)[];
  customInstructions?: string;
}): ChatMessage[] {
  const catDef = getCategoryDef(category);
  const agentName = catDef?.label || category;
  const agentDesc = catDef ? AGENT_DESCRIPTIONS[catDef.agent] : "";

  // What the tuner can modify
  const canModifySettings = tuningTarget === "settings" || tuningTarget === "both";
  const canModifyPrompts = tuningTarget === "prompts" || tuningTarget === "both";

  // Build settings section
  const settingsSection = canModifySettings
    ? `## Current Inference Settings

${Object.entries(currentSettings)
  .map(([key, value]) => {
    const desc = SETTINGS_DESCRIPTIONS[key as keyof AiTuningSettings] || "";
    const origVal = originalSettings[key as keyof AiTuningSettings];
    const changed = JSON.stringify(value) !== JSON.stringify(origVal);
    const isLocked = lockedSettings.includes(key as keyof AiTuningSettings);
    return `- **${key}**: \`${JSON.stringify(value)}\` ${changed ? `(originally: \`${JSON.stringify(origVal)}\`)` : ""}${isLocked ? " **(LOCKED — do not change)**" : ""} — ${desc}`;
  })
  .join("\n")}

You may propose changes to any UNLOCKED settings. Use the parameter name exactly as shown.${lockedSettings.length > 0 ? ` Do NOT propose changes to locked settings: ${lockedSettings.join(", ")}.` : ""}`
    : "";

  // Build prompts section
  const promptsSection = canModifyPrompts && promptContent
    ? `## Current Prompt Files

The following prompt files are used by this agent. You can propose search/replace changes to modify them.

${promptContent}`
    : "";

  // Previous rounds summary — include assessment so the tuner can see what improved/regressed
  // Also build a concise "tried settings" ledger so the tuner can see at a glance what was tested
  const triedSettings = new Map<string, Set<string>>();
  // Start with original settings as baseline
  for (const [k, v] of Object.entries(originalSettings)) {
    if (!triedSettings.has(k)) triedSettings.set(k, new Set());
    triedSettings.get(k)!.add(JSON.stringify(v));
  }
  for (const r of previousRounds) {
    if (r.appliedSettings) {
      for (const [k, v] of Object.entries(r.appliedSettings)) {
        if (!triedSettings.has(k)) triedSettings.set(k, new Set());
        triedSettings.get(k)!.add(JSON.stringify(v));
      }
    }
  }
  // Also add current settings
  for (const [k, v] of Object.entries(currentSettings)) {
    if (!triedSettings.has(k)) triedSettings.set(k, new Set());
    triedSettings.get(k)!.add(JSON.stringify(v));
  }

  const triedSettingsLedger = [...triedSettings.entries()]
    .filter(([, vals]) => vals.size > 1)
    .map(([k, vals]) => `- ${k}: tried ${[...vals].join(", ")}`)
    .join("\n");

  const previousRoundsSection = previousRounds.length > 0
    ? `## Previous Rounds

**IMPORTANT:** Review this history carefully. Do NOT propose setting values that were already tested in a previous round and produced poor results. Each round must try something genuinely new.

${triedSettingsLedger ? `### Settings Already Tried\n${triedSettingsLedger}\n` : ""}
${previousRounds.map((r) => {
  const resp = r.benchmarkResult?.response || "";
  const settingsChanges = r.proposal?.settingsChanges?.length
    ? `Settings changes: ${r.proposal.settingsChanges.map((c) => `${c.parameter}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`).join(", ")}`
    : "No settings changes";
  const promptChanges = r.proposal?.promptChanges?.length
    ? `Prompt changes: ${r.proposal.promptChanges.map((c) => `${c.filePath}: ${c.reason}`).join("; ")}`
    : "No prompt changes";
  const assessmentSummary = r.assessmentText
    ? `Assessment:\n${r.assessmentText.substring(0, 1200)}${r.assessmentText.length > 1200 ? "..." : ""}`
    : "Assessment: N/A";
  return `### Round ${r.roundNumber}
- Response: ${resp.substring(0, 600)}${resp.length > 600 ? "..." : ""}
- Latency: ${r.benchmarkResult?.latencyMs || 0}ms | Tokens: ${r.benchmarkResult?.totalTokens || 0}
- ${settingsChanges}
- ${promptChanges}
- Reasoning: ${r.proposal?.reasoning || "N/A"}
- ${assessmentSummary}`;
}).join("\n\n")}`
    : "";

  // Allowed modifications section
  const allowedMods: string[] = [];
  if (canModifySettings) allowedMods.push("inference settings (temperature, topP, topK, maxTokens, penalties, etc.)");
  if (canModifyPrompts) allowedMods.push("prompt file content (via search/replace edits)");

  const systemContent = `You are an expert AI tuner for SkyrimNet, an AI-powered NPC system for Skyrim.

## Your Task

You are tuning the **${agentName}** agent (${agentDesc}).

Your job is to analyze benchmark results and assessments, then propose specific changes to improve the agent's performance. You may modify: ${allowedMods.join(" and ")}.

## Guidelines

1. **Make incremental changes.** Don't change everything at once. Focus on the most impactful improvement.
2. **Consider trade-offs.** Changing temperature affects both creativity and consistency. Changing max tokens affects both completeness and cost.
3. **Stop when performing well.** If the response quality is good and the assessment is positive, set stop_tuning to true.
4. **NEVER repeat a failed approach.** Before proposing any change, check the previous rounds. If a setting value was already tried and produced poor results, do NOT set it back to that value. Each round must try something meaningfully new — not a combination that is logically equivalent to a prior failure.
5. **Be specific in reasoning.** Explain why each change should help and how it differs from what was already tried.
6. **Know your limits.** If the assessment identifies issues that CANNOT be fixed with your available tuning levers (e.g. the prompt needs format changes but you can only tune settings), set stop_tuning to true and explain what changes are needed in stop_reason. Do not waste rounds re-testing settings when the problem is clearly in the prompt.
${canModifyPrompts ? `7. **For prompt changes:** Use exact search/replace text. The search text must exist exactly in the file. Make targeted changes — don't rewrite entire files.` : ""}
8. **Avoid enabling reasoning.** For SkyrimNet roleplay agents, \`allowReasoning: false\` produces better results 9 times out of 10. Reasoning adds latency and token cost without improving dialogue quality. Only enable it if the task requires complex multi-step logical analysis (not creative text generation).

## Response Format

Respond with a JSON object (no markdown fences):

{
  "stop_tuning": false,
  "stop_reason": "optional reason if stopping",
  "reasoning": "explain your analysis and why these changes should help",
  "settings_changes": [
    { "parameter": "temperature", "old_value": 0.7, "new_value": 0.5, "reason": "reduce randomness for more consistent responses" }
  ]${canModifyPrompts ? `,
  "prompt_changes": [
    { "file_path": "/absolute/path/to/file.prompt", "search_text": "exact text to find", "replace_text": "replacement text", "reason": "why this change helps" }
  ]` : ""}
}

If no changes are needed for a category, use an empty array. Always include all fields.${!canModifyPrompts ? " Do NOT include prompt_changes — you are only tuning inference settings." : ""}${customInstructions.trim() ? `

## User Instructions (PRIORITY)

The user has provided the following instructions. Follow them carefully:

${customInstructions.trim()}` : ""}`;

  const userContent = `## This Round's Benchmark Result

**Response:**
\`\`\`
${currentResponse.substring(0, 3000)}${currentResponse.length > 3000 ? "\n... (truncated)" : ""}
\`\`\`

**Performance:** ${currentLatencyMs}ms latency | ${currentTokens} total tokens

## Quality Assessment

${currentAssessment}

${settingsSection}

${promptsSection}

${previousRoundsSection}

Based on the assessment above, propose changes to improve the ${agentName} agent's performance. If performance is already good, set stop_tuning to true.`;

  return [
    { role: "system" as const, content: systemContent },
    { role: "user" as const, content: userContent },
  ];
}
