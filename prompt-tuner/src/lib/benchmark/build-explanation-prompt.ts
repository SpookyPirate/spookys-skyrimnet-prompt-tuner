import type { BenchmarkCategory } from "@/types/benchmark";
import type { ChatMessage } from "@/types/llm";

const MAX_PROMPT_CHARS = 6000;

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
): ChatMessage[] {
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
