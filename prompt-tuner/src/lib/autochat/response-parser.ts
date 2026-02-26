import type { SimulatedEvent } from "@/types/yaml-configs";
import { TriggerEventType } from "@/types/yaml-configs";

export interface AutochatParseResult {
  dialogue: string | null;
  events: SimulatedEvent[];
}

const EVENT_PATTERN = /^EVENT:\s*(\w+)\s+PARAMS:\s*(\{.*\})\s*$/;

const VALID_EVENT_TYPES = new Set(Object.values(TriggerEventType) as string[]);

export function parseAutochatResponse(response: string): AutochatParseResult {
  if (!response || !response.trim()) {
    return { dialogue: null, events: [] };
  }

  const lines = response.split("\n");
  const dialogueLines: string[] = [];
  const events: SimulatedEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(EVENT_PATTERN);
    if (match) {
      const eventType = match[1];
      const paramsStr = match[2];

      if (VALID_EVENT_TYPES.has(eventType)) {
        try {
          const fields = JSON.parse(paramsStr);
          events.push({
            id: `autochat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            eventType: eventType as TriggerEventType,
            fields,
            timestamp: Date.now(),
          });
        } catch {
          // Invalid JSON, treat as dialogue
          dialogueLines.push(trimmed);
        }
      } else {
        // Unknown event type, treat as dialogue
        dialogueLines.push(trimmed);
      }
    } else {
      dialogueLines.push(trimmed);
    }
  }

  // Clean up dialogue: strip wrapping quotes if present
  let dialogue = dialogueLines.join(" ").trim() || null;
  if (dialogue && dialogue.startsWith('"') && dialogue.endsWith('"')) {
    dialogue = dialogue.slice(1, -1).trim();
  }

  return { dialogue, events };
}
