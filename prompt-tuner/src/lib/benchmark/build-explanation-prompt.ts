import type { BenchmarkCategory } from "@/types/benchmark";
import type { ChatMessage } from "@/types/llm";
import type { TunerTurnResult } from "@/types/autotuner";

const MAX_PROMPT_CHARS = 6000;
const MAX_MULTI_PROMPT_CHARS = 4000;

/** Categories where the model generates dialogue/creative text */
const DIALOGUE_CATEGORIES: BenchmarkCategory[] = ["dialogue", "diary", "bio_update", "memory_gen"];

function getExplanationFocus(category: BenchmarkCategory): string {
  if (DIALOGUE_CATEGORIES.includes(category)) {
    return `- **Tone & style choices**: Why did you adopt this particular voice, register, or emotional tone?
- **Character interpretation**: How did you interpret the character's personality, background, and motivations from the prompt?
- **Prompt constraints**: Which instructions or constraints most influenced your response?
- **Trade-offs**: What alternative approaches did you consider and why did you choose this one?`;
  }

  // Meta categories: target selection, speaker prediction, action selection, scene planning
  return `- **Decision reasoning**: What factors led you to this specific output? Walk through your logic step by step.
- **Context analysis**: How did you weigh the different pieces of context (NPC proximity, recent dialogue, relationships, etc.)?
- **Prompt constraints**: Which instructions or constraints most influenced your decision?
- **Alternatives considered**: What other outputs did you consider and why did you reject them?`;
}

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
  // Multi-part: multiple turns or multiple subtasks
  if (turnResults && turnResults.length > 1) {
    return buildMultiPartExplanationMessages(category, subtaskLabel, turnResults);
  }

  const promptSummary = originalMessages
    .map((m) => `[${m.role}] ${m.content}`)
    .join("\n\n");

  const truncatedPrompt =
    promptSummary.length > MAX_PROMPT_CHARS
      ? promptSummary.substring(0, MAX_PROMPT_CHARS) + "\n... (truncated)"
      : promptSummary;

  const focus = getExplanationFocus(category);

  const systemContent = `You were just used as a SkyrimNet "${subtaskLabel}" agent (category: ${category}). Explain your reasoning concisely in 2-4 paragraphs.

Focus on:
${focus}

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

function buildMultiPartExplanationMessages(
  category: BenchmarkCategory,
  subtaskLabel: string,
  turnResults: TunerTurnResult[],
): ChatMessage[] {
  const isDialogueTurns = DIALOGUE_CATEGORIES.includes(category);
  const partWord = isDialogueTurns ? "turn" : "subtask";
  const perPartLimit = Math.floor(MAX_MULTI_PROMPT_CHARS / Math.max(turnResults.length, 1));

  const partsText = turnResults
    .map((turn) => {
      let promptSummary = turn.messages
        .map((m) => `[${m.role}] ${m.content}`)
        .join("\n\n");

      if (promptSummary.length > perPartLimit) {
        promptSummary = promptSummary.substring(0, perPartLimit) + "\n... (truncated)";
      }

      return `### ${turn.label}

**Prompt (key parts):**
${promptSummary}

**Your Response:**
${turn.response}`;
    })
    .join("\n\n---\n\n");

  const focus = getExplanationFocus(category);
  const continuityPoint = isDialogueTurns
    ? `- **Continuity**: How did your response build on or react to the previous turns in the conversation?`
    : `- **Cross-subtask consistency**: How did your approach stay consistent or differ across the subtasks?`;

  const systemContent = `You were just used as a SkyrimNet "${subtaskLabel}" agent (category: ${category}) across ${turnResults.length} ${partWord}s. Explain your reasoning for ALL of your responses.

For each ${partWord}, address:
${focus}
${continuityPoint}

Be specific and self-critical. Reference concrete details from the prompts and your responses.`;

  const userContent = `## ${isDialogueTurns ? "Multi-Turn Dialogue" : "Multiple Subtasks"}

${partsText}

Explain why you responded the way you did across all ${turnResults.length} ${partWord}s.`;

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}
