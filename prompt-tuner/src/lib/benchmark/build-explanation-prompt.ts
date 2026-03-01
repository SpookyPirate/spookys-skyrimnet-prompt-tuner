import type { BenchmarkCategory } from "@/types/benchmark";
import type { ChatMessage } from "@/types/llm";
import type { TunerTurnResult } from "@/types/autotuner";

const MAX_PROMPT_CHARS = 6000;
const MAX_TURN_PROMPT_CHARS = 3000;

/**
 * Build a follow-up prompt asking the model to explain why it responded
 * the way it did. This is a completely separate request — it doesn't
 * interfere with the benchmark itself.
 */
export function buildExplanationMessages(
  category: BenchmarkCategory,
  subtaskLabel: string,
  originalMessages: ChatMessage[],
  modelResponse: string,
  turnResults?: TunerTurnResult[],
): ChatMessage[] {
  // Multi-turn: include all turns' prompts and responses
  if (turnResults && turnResults.length > 1) {
    return buildMultiTurnExplanationMessages(category, subtaskLabel, turnResults);
  }

  const promptSummary = originalMessages
    .map((m) => `[${m.role}] ${m.content}`)
    .join("\n\n");

  const truncatedPrompt =
    promptSummary.length > MAX_PROMPT_CHARS
      ? promptSummary.substring(0, MAX_PROMPT_CHARS) + "\n... (truncated)"
      : promptSummary;

  const systemContent = `You were just used as a SkyrimNet "${subtaskLabel}" agent (category: ${category}). Explain your reasoning concisely in 2-4 paragraphs.

Focus on:
- **Tone & style choices**: Why did you adopt this particular voice, register, or emotional tone?
- **Character interpretation**: How did you interpret the character's personality, background, and motivations from the prompt?
- **Prompt constraints**: Which instructions or constraints most influenced your response?
- **Trade-offs**: What alternative approaches did you consider and why did you choose this one?

Be specific and self-critical. Reference concrete details from the prompt and your response.`;

  const userContent = `## Original Prompt
${truncatedPrompt}

## Your Response
${modelResponse}

Explain why you responded this way.`;

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}

function buildMultiTurnExplanationMessages(
  category: BenchmarkCategory,
  subtaskLabel: string,
  turnResults: TunerTurnResult[],
): ChatMessage[] {
  const perTurnLimit = Math.floor(MAX_TURN_PROMPT_CHARS / Math.max(turnResults.length, 1));

  const turnsText = turnResults
    .map((turn, i) => {
      let promptSummary = turn.messages
        .map((m) => `[${m.role}] ${m.content}`)
        .join("\n\n");

      if (promptSummary.length > perTurnLimit) {
        promptSummary = promptSummary.substring(0, perTurnLimit) + "\n... (truncated)";
      }

      return `### ${turn.label}

**Prompt (key parts):**
${promptSummary}

**Your Response:**
${turn.response}`;
    })
    .join("\n\n---\n\n");

  const systemContent = `You were just used as a SkyrimNet "${subtaskLabel}" agent (category: ${category}) across a ${turnResults.length}-turn dialogue. Explain your reasoning for ALL of your responses.

For each turn, address:
- **Tone & style choices**: Why did you adopt this particular voice, register, or emotional tone?
- **Character interpretation**: How did you interpret the character's personality, background, and motivations?
- **Prompt constraints**: Which instructions or constraints most influenced your response?
- **Continuity**: How did your response build on or react to the previous turns in the conversation?
- **Trade-offs**: What alternative approaches did you consider?

Be specific and self-critical. Reference concrete details from the prompts and your responses.`;

  const userContent = `## Multi-Turn Dialogue

${turnsText}

Explain why you responded the way you did across all ${turnResults.length} turns.`;

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}
