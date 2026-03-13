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
  reasoningEffort: "Controls how much reasoning budget to allocate when allowReasoning is enabled. Values: 'none', 'minimal' (~10%), 'low' (~20%), 'medium' (~50%), 'high' (~80%), 'xhigh' (~95%). Lower effort = faster responses, higher effort = deeper analysis. Only relevant when allowReasoning is true.",
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
  ignoreFormatScoring = false,
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
  ignoreFormatScoring?: boolean;
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
  let promptsSection = "";
  if (canModifyPrompts) {
    if (promptContent) {
      promptsSection = `## Current Prompt Files

The following prompt files are used by this agent. You can propose search/replace changes to modify them.
**IMPORTANT:** The file_path in each section header is the exact path you must use in your prompt_changes proposals. Copy it exactly.

${promptContent}`;
    } else {
      promptsSection = `## Prompt Files

No prompt files could be loaded for this prompt set. You cannot propose prompt changes this round.`;
    }
  }

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
${canModifyPrompts ? `7. **For prompt changes: prefer adding over replacing.** The existing prompt files contain carefully crafted instructions tested across thousands of SkyrimNet NPC dialogues. Your default approach should be:
   - ADD new paragraphs or instructions after existing content
   - Make surgical wording changes to existing lines when a specific phrase is directly causing the problem
   - Only replace or rewrite a section if it directly conflicts with the improvement you're trying to make and a smaller edit won't fix it — and even then, preserve as much of the original intent as possible
   - Your \`search_text\` should be a SHORT, specific portion where possible; avoid replacing entire files or large blocks unnecessarily
8. **Prompt changes must be universal.** These prompts are used for THOUSANDS of different NPC dialogues across all of Skyrim — guards, merchants, innkeepers, quest characters, companions, etc. Proposed changes must improve dialogue quality for ANY NPC in ANY context. NEVER propose changes that are specific to the current benchmark scenario (e.g., referencing specific locations, quests, or NPC names from the test). Test your proposed instruction mentally: would it help a blacksmith AND a jarl AND a bard? If not, don't propose it.
## SkyrimNet Template Syntax (Inja)

Prompt files use the Inja template engine (similar to Jinja2 but NOT identical). Key syntax rules:
- Variables: \`{{ variable_name }}\`, e.g. \`{{ decnpc(npc.UUID).name }}\`
- Conditionals: \`{% if condition %}\`, \`{% else if condition %}\`, \`{% else %}\`, \`{% endif %}\` — NOTE: use \`else if\`, NOT \`elif\`
- Loops: \`{% for item in list %}\`...\`{% endfor %}\`
- Section markers: \`[ system ]\`, \`[ user ]\`, \`[ assistant ]\`, \`[ cache ]\` — these separate prompt sections
- Common decorators: \`render_subcomponent(name, mode)\`, \`render_template(path)\`, \`render_character_profile(mode, UUID)\`, \`decnpc(UUID).name\`, \`is_in_combat(UUID)\`, \`is_narration_enabled()\`
- The \`render_mode\` variable controls which variant of submodules to render (e.g. "full", "transform", "thoughts")
- Some files (especially in \`submodules/\`) are assembled by the engine into larger prompts — a file like \`0020_format_rules.prompt\` may call \`render_subcomponent("guidelines", render_mode)\` to include files from \`submodules/guidelines/\`

**IMPORTANT:** When proposing prompt changes, only modify plain-text instruction content. Do NOT modify template syntax (\`{{ }}\`, \`{% %}\`), section markers, or decorator calls unless you fully understand the Inja engine. Adding or editing natural-language instructions between template blocks is safe.` : ""}
9. **Avoid enabling reasoning.** For SkyrimNet roleplay agents, \`allowReasoning: false\` produces better results 9 times out of 10. Reasoning adds latency and token cost without improving dialogue quality. Only enable it if the task requires complex multi-step logical analysis (not creative text generation).
10. **Ignore self-explanation quality.** The model's self-explanation is generated in a separate diagnostic call with its own token budget. Changing inference settings (especially maxTokens) will NOT affect explanation verbosity. Focus only on the actual benchmark response quality.${ignoreFormatScoring ? `
11. **IGNORE FORMAT.** The user has opted to skip format scoring. Do NOT propose changes aimed at fixing format, JSON structure, metadata fields, importance scores, emotion fields, or any output format aspects. The output format is dictated by SkyrimNet's engine requirements and is correct as-is. Focus exclusively on content quality, accuracy, and efficiency.` : ""}
${customInstructions.trim() ? `
## User Instructions (PRIORITY — follow these above all other guidelines)

${customInstructions.trim()}
` : ""}
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

If no changes are needed for a category, use an empty array. Always include all fields.${!canModifyPrompts ? " Do NOT include prompt_changes — you are only tuning inference settings." : ""}`;

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
