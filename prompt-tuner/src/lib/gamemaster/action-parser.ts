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

/**
 * Parse a GameMaster action from an LLM response.
 * Expected formats:
 *   ACTION: StartConversation(speaker="Lydia", target="Player", topic="dragons")
 *   ACTION: ContinueConversation(speaker="Lydia", topic="the weather")
 *   ACTION: Narrate(text="The wind howls through the mountains...")
 *   ACTION: None
 */
export function parseGmAction(response: string): ParsedGmAction {
  const trimmed = response.trim();

  // Try to match ACTION: format
  const actionMatch = trimmed.match(/ACTION:\s*(\w+)(?:\(([^)]*(?:\([^)]*\))*[^)]*)\))?/);
  if (!actionMatch) {
    return { action: "None", params: {} };
  }

  const actionName = actionMatch[1] as GmActionType;
  const paramsStr = actionMatch[2] || "";

  if (!["StartConversation", "ContinueConversation", "Narrate", "None"].includes(actionName)) {
    return { action: "None", params: {} };
  }

  // Parse key="value" parameters
  const params: ParsedGmAction["params"] = {};
  const paramRegex = /(\w+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = paramRegex.exec(paramsStr)) !== null) {
    const key = match[1] as keyof ParsedGmAction["params"];
    if (["speaker", "target", "topic", "text"].includes(key)) {
      params[key] = match[2];
    }
  }

  return { action: actionName, params };
}
