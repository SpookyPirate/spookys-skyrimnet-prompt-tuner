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

  const actionName = actionLine[1] as GmActionType;
  if (!VALID_ACTIONS.includes(actionName)) {
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
      if (parsed.text) params.text = String(parsed.text);
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
