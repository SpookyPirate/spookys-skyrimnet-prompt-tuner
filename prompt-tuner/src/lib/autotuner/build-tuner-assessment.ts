import type { BenchmarkCategory } from "@/types/benchmark";
import type { ChatMessage } from "@/types/llm";
import type { TunerTurnResult, TunerRound } from "@/types/autotuner";
import { getCategoryDef } from "@/lib/benchmark/categories";

/**
 * Build assessment messages for the auto-tuner.
 * Unlike the benchmark assessment (which compares multiple models),
 * this evaluates a single model's performance for iterative improvement.
 * Includes previous round summaries so the assessor can track trends.
 */
export function buildTunerAssessmentMessages({
  category,
  model,
  renderedText,
  response,
  explanation,
  latencyMs,
  totalTokens,
  promptTokens,
  completionTokens,
  turnResults,
  previousRounds = [],
}: {
  category: BenchmarkCategory;
  model: string;
  renderedText: string;
  response: string;
  explanation: string;
  latencyMs: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  turnResults?: TunerTurnResult[];
  previousRounds?: TunerRound[];
}): ChatMessage[] {
  const catDef = getCategoryDef(category);
  const agentLabel = catDef?.label || category;
  const agentDesc = catDef?.description || "";

  const hasMultipleParts = turnResults && turnResults.length > 1;

  // Build the response section
  let responseSection: string;
  if (hasMultipleParts) {
    responseSection = turnResults.map((tr) => {
      const stats = tr.latencyMs
        ? `- Latency: ${tr.latencyMs}ms | Tokens: ${tr.totalTokens || 0} (${tr.promptTokens || 0} prompt + ${tr.completionTokens || 0} completion)`
        : "";
      return `### ${tr.label}\n${stats}\n\n\`\`\`\n${tr.response}\n\`\`\``;
    }).join("\n\n");
  } else {
    responseSection = `\`\`\`\n${response}\n\`\`\``;
  }

  const systemContent = `You are an expert AI evaluator for SkyrimNet, an AI-powered NPC dialogue system for Skyrim.

You are evaluating a single model's performance on the **${agentLabel}** agent task to guide iterative tuning improvements.
${hasMultipleParts ? `
## IMPORTANT: Multi-Turn / Multi-NPC Tests

In multi-turn dialogue tests, each turn may have a DIFFERENT NPC responding. Each turn has its own system prompt specifying which character to roleplay (e.g. "You are Hulda", "You are Saadia"). The model is NOT expected to maintain a single persona across all turns — it correctly switches characters based on each turn's system prompt. Do NOT mark character switching as a failure. Evaluate each turn's response against its own system prompt.
` : ""}
## Evaluation Criteria

Rate the response on these dimensions (1-10 scale):

**Quality** — How well does the response fulfill the prompt's intent?
- For dialogue: naturalness, character consistency, appropriate length (8-45 words)
- For structured outputs (action selection, target selection, speaker prediction): correct format, valid output
- For creative tasks (scene planning, diary): richness, coherence, lore accuracy

**Accuracy** — Does the response correctly follow instructions and constraints?
- Does it respect the system prompt's rules?
- Does it avoid hallucinations or lore breaks?
- Is the output factually consistent with the provided context?

**Format** — Is the output well-structured and properly formatted?
- JSON validity for structured outputs
- Correct format as specified in the instructions
- Appropriate length and structure

**Efficiency** — Token usage relative to output quality
- Did the model use tokens wisely or waste them on unnecessary verbosity?

**Self-Awareness** — Quality of the model's self-explanation (when available)
- Does the model accurately identify what it did and why?
- Does it demonstrate understanding of the prompt constraints?

## Output Format

Produce a concise markdown assessment with:
1. **Summary** — 2-3 sentence overview of performance${previousRounds.length > 0 ? ", noting improvement or regression from previous rounds" : ""}
2. **Scores** — Score on each dimension with brief justification${hasMultipleParts ? " (cover all subtasks/turns)" : ""}
3. **Strengths** — What the model did well
4. **Weaknesses** — What needs improvement
5. **Suggestions** — Specific, actionable recommendations for tuning (settings or prompt changes)${previousRounds.length > 0 ? `

## Important

- Note whether performance IMPROVED, REGRESSED, or is UNCHANGED compared to previous rounds.
- Do NOT repeat suggestions that were already tried and failed — reference what was attempted and suggest something new.
- If a persistent issue cannot be fixed by the available tuning levers (e.g. a settings-only session can't fix a prompt format gap), say so explicitly.` : ""}`;

  const userContent = `## Agent: ${agentLabel}
${agentDesc}
${catDef && catDef.subtasks.length > 1 ? `\nSubtasks: ${catDef.subtasks.map((st) => st.label).join(", ")}` : ""}

## Model: ${model}
- Total Latency: ${latencyMs}ms | Tokens: ${totalTokens} (${promptTokens} prompt + ${completionTokens} completion)

## Rendered Prompt(s)
\`\`\`
${renderedText.substring(0, 8000)}${renderedText.length > 8000 ? "\n... (truncated)" : ""}
\`\`\`

## Model Response${hasMultipleParts ? "s" : ""}

${responseSection}
${explanation ? `\n## Model's Self-Explanation\n\`\`\`\n${explanation}\n\`\`\`\n\nFactor this self-explanation into your Self-Awareness evaluation.` : ""}
${previousRounds.length > 0 ? `
## Previous Rounds

Use this history to identify trends — note what improved, what regressed, and what remains unchanged.

${previousRounds.map((r) => {
  const resp = r.benchmarkResult?.response || "";
  const lat = r.benchmarkResult?.latencyMs || 0;
  const tok = r.benchmarkResult?.totalTokens || 0;
  const changes = r.proposal?.settingsChanges?.length
    ? r.proposal.settingsChanges.map((c) => `${c.parameter}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`).join(", ")
    : "none";
  const assessShort = r.assessmentText
    ? r.assessmentText.substring(0, 1000) + (r.assessmentText.length > 1000 ? "..." : "")
    : "N/A";
  return `### Round ${r.roundNumber}
- Response: ${resp.substring(0, 600)}${resp.length > 600 ? "..." : ""}
- Latency: ${lat}ms | Tokens: ${tok}
- Settings changes applied: ${changes}
- Assessment: ${assessShort}`;
}).join("\n\n")}` : ""}
Evaluate this model's performance and provide actionable feedback for improvement.`;

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}
