import type { ChatMessage } from "@/types/llm";

/**
 * Parse rendered template output into LLM messages based on section markers.
 * Section markers: [ system ], [ user ], [ assistant ], [ cache ]
 * End markers: [ end system ], [ end user ], [ end assistant ], [ end cache ]
 */
export function parseSections(rendered: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const lines = rendered.split(/\r?\n/);

  let currentRole: "system" | "user" | "assistant" | null = null;
  let buffer: string[] = [];

  const sectionRegex =
    /^\s*\[\s*(system|user|assistant|cache)\s*\]\s*$/i;
  const endSectionRegex =
    /^\s*\[\s*end\s+(system|user|assistant|cache)\s*\]\s*$/i;

  for (const line of lines) {
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch) {
      // Flush previous buffer
      if (currentRole && buffer.length > 0) {
        const content = buffer.join("\n").trim();
        if (content) {
          messages.push({ role: currentRole, content });
        }
      }
      buffer = [];

      const role = sectionMatch[1].toLowerCase();
      // "cache" maps to "system" with special handling
      currentRole = role === "cache" ? "system" : (role as "system" | "user" | "assistant");
      continue;
    }

    const endMatch = line.match(endSectionRegex);
    if (endMatch) {
      // Flush buffer
      if (currentRole && buffer.length > 0) {
        const content = buffer.join("\n").trim();
        if (content) {
          messages.push({ role: currentRole, content });
        }
      }
      buffer = [];
      currentRole = null;
      continue;
    }

    if (currentRole !== null) {
      buffer.push(line);
    } else {
      // Text outside sections — treat as system message if non-empty
      if (line.trim()) {
        buffer.push(line);
        if (!currentRole) currentRole = "system";
      }
    }
  }

  // Flush remaining buffer
  if (currentRole && buffer.length > 0) {
    const content = buffer.join("\n").trim();
    if (content) {
      messages.push({ role: currentRole, content });
    }
  }

  return messages;
}
