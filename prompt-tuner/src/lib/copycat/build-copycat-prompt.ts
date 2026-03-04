import type { ChatMessage } from "@/types/llm";
import type { AiTuningSettings } from "@/types/config";
import type { TuningTarget } from "@/types/autotuner";
import type { CopycatRound, CopycatDialogueTurn } from "@/types/copycat";

const SETTINGS_DESCRIPTIONS: Record<keyof AiTuningSettings, string> = {
  temperature: "Controls randomness. Lower = more deterministic, higher = more creative. Range: 0.0-2.0",
  maxTokens: "Maximum tokens in the response. Higher allows longer outputs.",
  topP: "Nucleus sampling. Lower values focus on more likely tokens. Range: 0.0-1.0",
  topK: "Top-K sampling. Number of top tokens to consider. 0 = disabled.",
  frequencyPenalty: "Penalizes repeated tokens based on frequency. Range: -2.0 to 2.0",
  presencePenalty: "Penalizes tokens that have appeared at all. Range: -2.0 to 2.0",
  stopSequences: "JSON array of strings that stop generation when encountered.",
  structuredOutputs: "Whether to use structured/JSON output mode.",
  allowReasoning: "Whether to allow the model to use extended thinking/reasoning.",
};

/**
 * Build the system+user messages for the Copycat LLM's combined compare+propose call.
 */
export function buildCopycatMessages({
  referenceModelId,
  targetModelId,
  tuningTarget,
  currentSettings,
  originalSettings,
  promptContent,
  referenceDialogue,
  targetDialogue,
  previousRounds,
  lockedSettings = [],
  customInstructions = "",
}: {
  referenceModelId: string;
  targetModelId: string;
  tuningTarget: TuningTarget;
  currentSettings: AiTuningSettings;
  originalSettings: AiTuningSettings;
  promptContent: string;
  referenceDialogue: CopycatDialogueTurn[];
  targetDialogue: CopycatDialogueTurn[];
  previousRounds: CopycatRound[];
  lockedSettings?: (keyof AiTuningSettings)[];
  customInstructions?: string;
}): ChatMessage[] {
  const canModifySettings = tuningTarget === "settings" || tuningTarget === "both";
  const canModifyPrompts = tuningTarget === "prompts" || tuningTarget === "both";

  // Build settings section
  const settingsSection = canModifySettings
    ? `## Current Target Inference Settings

${Object.entries(currentSettings)
  .map(([key, value]) => {
    const desc = SETTINGS_DESCRIPTIONS[key as keyof AiTuningSettings] || "";
    const origVal = originalSettings[key as keyof AiTuningSettings];
    const changed = JSON.stringify(value) !== JSON.stringify(origVal);
    const isLocked = lockedSettings.includes(key as keyof AiTuningSettings);
    return `- **${key}**: \`${JSON.stringify(value)}\` ${changed ? `(originally: \`${JSON.stringify(origVal)}\`)` : ""}${isLocked ? " **(LOCKED — do not change)**" : ""} — ${desc}`;
  })
  .join("\n")}

You may propose changes to any UNLOCKED settings.${lockedSettings.length > 0 ? ` Do NOT propose changes to locked settings: ${lockedSettings.join(", ")}.` : ""}`
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

  // Previous rounds summary with tried settings ledger
  const triedSettings = new Map<string, Set<string>>();
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

**IMPORTANT:** Review this history carefully. Do NOT propose setting values that were already tested in a previous round. Each round must try something genuinely new.

${triedSettingsLedger ? `### Settings Already Tried\n${triedSettingsLedger}\n` : ""}
${previousRounds.map((r) => {
  const score = r.effectivenessScore !== null ? `${r.effectivenessScore}%` : "N/A";
  const settingsChanges = r.proposal?.settingsChanges?.length
    ? `Settings changes: ${r.proposal.settingsChanges.map((c) => `${c.parameter}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`).join(", ")}`
    : "No settings changes";
  const promptChanges = r.proposal?.promptChanges?.length
    ? `Prompt changes: ${r.proposal.promptChanges.map((c) => `${c.filePath}: ${c.reason}`).join("; ")}`
    : "No prompt changes";
  return `### Round ${r.roundNumber} (Score: ${score})
- ${settingsChanges}
- ${promptChanges}
- Reasoning: ${r.proposal?.reasoning || "N/A"}
- Comparison: ${r.comparisonText.substring(0, 800)}${r.comparisonText.length > 800 ? "..." : ""}`;
}).join("\n\n")}`
    : "";

  // Format dialogue for display
  const formatDialogue = (turns: CopycatDialogueTurn[]) =>
    turns.map((t) => `**${t.label}:**\n\`\`\`\n${t.response}\n\`\`\``).join("\n\n");

  // Allowed modifications
  const allowedMods: string[] = [];
  if (canModifySettings) allowedMods.push("inference settings");
  if (canModifyPrompts) allowedMods.push("prompt file content (via search/replace edits)");

  const systemContent = `You are an expert AI style-matching agent for SkyrimNet, an AI-powered NPC dialogue system for Skyrim.

## Your Task

You are comparing dialogue output from a **reference model** (\`${referenceModelId}\`) against a **target model** (\`${targetModelId}\`). Your goal is to tune the target model's ${allowedMods.join(" and ")} until its dialogue style closely matches the reference.

## What to Compare

Focus on STYLE matching, not absolute quality:
- **Vocabulary** — word choice complexity, formality, archaic vs modern English
- **Sentence rhythm** — length, cadence, punctuation patterns
- **Character voice** — how well each model captures the NPC's personality
- **Emotional range** — subtlety vs directness of emotional expression
- **Response length** — conciseness vs verbosity
- **Formatting** — action tags, emotes, narration style

## Guidelines

1. **Score objectively.** The effectiveness_score (0-100) measures how closely the target matches the reference style. 100 = indistinguishable. 0 = completely different.
2. **Make incremental changes.** Don't change everything at once.
3. **NEVER repeat a failed approach.** Check previous rounds before proposing.
4. **Stop when matched.** If the target closely matches the reference (score >= 90), set stop_tuning to true.
5. **Know your limits.** If style differences can't be fixed with your available levers, set stop_tuning to true and explain.
${canModifyPrompts ? `6. **For prompt changes:** Use exact search/replace text. The search_text must exist EXACTLY in the file. The file_path must be the exact path shown in the "Current Prompt Files" section headers. Make targeted changes — don't rewrite entire files.
7. **Prompt changes are persistent.** Changes you make in one round carry forward to the next. The target model runs with the modified prompts each round.
8. **Prefer prompt changes for style issues.** Settings like temperature/maxTokens control randomness and length, but prompt instructions are the most effective lever for controlling formatting (action tags, paragraph structure), emotional register, and response style.` : ""}

## Response Format

Respond with a JSON object (no markdown fences):

{
  "effectiveness_score": 65,
  "comparison": "narrative comparison of the two styles",
  "stop_tuning": false,
  "stop_reason": "optional reason if stopping",
  "reasoning": "explain your analysis and why these changes should help",
  "settings_changes": [
    { "parameter": "temperature", "old_value": 1.0, "new_value": 0.8, "reason": "reduce creativity to match reference's more measured tone" }
  ]${canModifyPrompts ? `,
  "prompt_changes": [
    { "file_path": "exact/path/from/section/header", "search_text": "exact text to find in file", "replace_text": "replacement text", "reason": "why this change helps" }
  ]` : ""},
  "verification_requests": ["custom dialogue line to test"]
}

Always include all fields.${!canModifyPrompts ? " Do NOT include prompt_changes." : ""}${customInstructions.trim() ? `

## User Instructions (PRIORITY)

${customInstructions.trim()}` : ""}`;

  const userContent = `## Reference Model Dialogue (\`${referenceModelId}\`)

${formatDialogue(referenceDialogue)}

## Target Model Dialogue (\`${targetModelId}\`)

${formatDialogue(targetDialogue)}

${settingsSection}

${promptsSection}

${previousRoundsSection}

Compare the reference and target dialogue styles above, then propose changes to make the target match the reference more closely.`;

  return [
    { role: "system" as const, content: systemContent },
    { role: "user" as const, content: userContent },
  ];
}
