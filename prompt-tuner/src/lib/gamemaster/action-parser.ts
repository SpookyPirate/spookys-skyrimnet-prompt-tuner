import type { GmActionType } from "@/types/gamemaster";

export interface ParsedGmAction {
  action: GmActionType;
  params: {
    speaker?: string;
    target?: string;
    topic?: string;
    text?: string;
  };
}

const VALID_ACTIONS: GmActionType[] = [
  "StartConversation", "ContinueConversation", "Narrate", "None",
];

/**
 * Map common LLM-invented or alternate action names to valid actions.
 * LLMs may output these when the template doesn't list valid actions,
 * or they may come from older prompt versions.
 */
const ACTION_ALIASES: Record<string, GmActionType> = {
  gamemaster_dialogue: "StartConversation",
  gm_dialogue: "StartConversation",
  start_conversation: "StartConversation",
  continue_conversation: "ContinueConversation",
  narrate: "Narrate",
  narration: "Narrate",
  none: "None",
};

/**
 * Parse a GameMaster action from an LLM response.
 *
 * Real SkyrimNet format (from gamemaster_action_selector.prompt):
 *   ACTION: StartConversation PARAMS: {"speaker": "Lydia", "target": "Player", "topic": "dragons"}
 *   ACTION: ContinueConversation PARAMS: {"speaker": "Lydia", "topic": "the weather"}
 *   ACTION: Narrate PARAMS: {"text": "The wind howls through the mountains..."}
 *   ACTION: None
 *
 * Also handles legacy function-call format for robustness:
 *   ACTION: StartConversation(speaker="Lydia", target="Player", topic="dragons")
 */
export function parseGmAction(response: string): ParsedGmAction {
  const trimmed = response.trim();

  // Match ACTION: <name> with optional PARAMS: {json} or (key="value") style
  const actionLine = trimmed.match(/ACTION:\s*(\w+)([\s\S]*)/);
  if (!actionLine) {
    return { action: "None", params: {} };
  }

  // Normalize: check exact match first, then aliases, then case-insensitive
  let actionName: GmActionType;
  const rawAction = actionLine[1];
  if (VALID_ACTIONS.includes(rawAction as GmActionType)) {
    actionName = rawAction as GmActionType;
  } else if (ACTION_ALIASES[rawAction.toLowerCase()]) {
    actionName = ACTION_ALIASES[rawAction.toLowerCase()];
  } else {
    console.warn(`[GM Parser] Unknown action "${rawAction}", treating as None`);
    return { action: "None", params: {} };
  }

  if (actionName === "None") {
    return { action: "None", params: {} };
  }

  const remainder = actionLine[2].trim();
  const params: ParsedGmAction["params"] = {};

  // Try real format: PARAMS: {json}
  const paramsJsonMatch = remainder.match(/PARAMS:\s*(\{[\s\S]*\})/);
  if (paramsJsonMatch) {
    try {
      const parsed = JSON.parse(paramsJsonMatch[1]);
      if (parsed.speaker) params.speaker = String(parsed.speaker);
      if (parsed.target) params.target = String(parsed.target);
      if (parsed.topic) params.topic = String(parsed.topic);
      if (parsed.dialogue) params.topic = String(parsed.dialogue); // alias: "dialogue" → topic
      if (parsed.text) params.text = String(parsed.text);
      if (parsed.narration) params.text = String(parsed.narration); // alias: "narration" → text
      return { action: actionName, params };
    } catch {
      // JSON parse failed, fall through to legacy parsing
    }
  }

  // Legacy format: (key="value", key="value")
  const legacyMatch = remainder.match(/\(([^)]*(?:\([^)]*\))*[^)]*)\)/);
  if (legacyMatch) {
    const paramRegex = /(\w+)\s*=\s*"([^"]*)"/g;
    let match;
    while ((match = paramRegex.exec(legacyMatch[1])) !== null) {
      const key = match[1] as keyof ParsedGmAction["params"];
      if (["speaker", "target", "topic", "text"].includes(key)) {
        params[key] = match[2];
      }
    }
  }

  return { action: actionName, params };
}
