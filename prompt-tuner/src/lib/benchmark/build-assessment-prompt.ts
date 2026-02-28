import type { BenchmarkResult } from "@/types/benchmark";
import type { ChatMessage } from "@/types/llm";
import { getCategoryDef } from "./categories";

export function buildAssessmentMessages(
  results: BenchmarkResult[],
  renderedText: string,
): ChatMessage[] {
  const category = results[0]?.category;
  const catDef = category ? getCategoryDef(category) : undefined;

  const responsesSection = results
    .map((r, i) => {
      const header = `### Profile ${i + 1}: ${r.profileName} (${r.model})`;
      const stats = `- Total Latency: ${r.totalLatencyMs}ms | Total Tokens: ${r.totalTokens}`;

      const subtaskSections = r.subtasks.map((st) => {
        const stHeader = r.subtasks.length > 1 ? `#### ${st.subtaskLabel}` : "";
        const stStats = `- Latency: ${st.latencyMs}ms | Tokens: ${st.totalTokens} (${st.promptTokens} prompt + ${st.completionTokens} completion)`;
        const stStatus = st.status === "error" ? `- ERROR: ${st.error}` : "";
        const response = st.response || "(no response)";
        const explanationBlock = st.explanation
          ? `\n**Model's Self-Explanation:**\n\`\`\`\n${st.explanation}\n\`\`\``
          : "";
        return [stHeader, stStats, stStatus, `\n\`\`\`\n${response}\n\`\`\``, explanationBlock].filter(Boolean).join("\n");
      }).join("\n\n");

      return `${header}\n${stats}\n\n${subtaskSections}`;
    })
    .join("\n\n---\n\n");

  const systemContent = `You are an expert AI model evaluator specializing in LLM benchmarking for SkyrimNet, an AI-powered NPC dialogue system for Skyrim.

You will be given:
1. Rendered prompts that were sent identically to multiple models
2. Each model's responses to one or more subtasks, along with latency and token usage

Your job is to comparatively evaluate each model's responses and produce a structured assessment.

## Evaluation Criteria

Rate each model's responses on these dimensions (1-10 scale):

**Quality** — How well do the responses fulfill the prompts' intent?
- For dialogue: naturalness, character consistency, appropriate length (8-45 words)
- For structured outputs (action selection, target selection, speaker prediction): correct format, valid output
- For creative tasks (scene planning, diary): richness, coherence, lore accuracy

**Accuracy** — Do the responses correctly follow instructions and constraints?
- Does it respect the system prompt's rules?
- Does it avoid hallucinations or lore breaks?

**Format** — Are the outputs well-structured and properly formatted?
- JSON validity for structured outputs
- Appropriate length and structure

**Efficiency** — Token usage relative to output quality
- Did the model use tokens wisely or waste them on unnecessary verbosity?

**Speed** — Latency assessment
- Relative speed comparison between models

**Self-Awareness** — Quality of the model's self-explanation (when available)
- Does the model accurately identify what it did and why?
- Does it demonstrate understanding of the prompt constraints?
- Is it genuinely self-critical or just generic?

## Output Format

Produce a markdown report with:
1. **Summary** — One-paragraph overview of the comparison
2. **Per-Model Grades** — For each model, give scores on each dimension with brief justification (cover all subtasks)
3. **Ranking** — Order models from best to worst with reasoning
4. **Recommendations** — Which model is best suited for this agent and why`;

  const userContent = `## Agent: ${catDef?.label || category || "Unknown"}
${catDef?.description || ""}
${catDef && catDef.subtasks.length > 1 ? `\nSubtasks: ${catDef.subtasks.map((st) => st.label).join(", ")}` : ""}

## Rendered Prompt(s)
\`\`\`
${renderedText.substring(0, 4000)}${renderedText.length > 4000 ? "\n... (truncated)" : ""}
\`\`\`

## Model Responses

${responsesSection}

Where available, each response includes the model's self-explanation of its reasoning. Factor these into your Self-Awareness evaluation.

Please evaluate these models comparatively across all subtasks.`;

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}
