import type { AgentType } from "@/types/config";
import type { ChatMessage, LlmCallLog } from "@/types/llm";
import { useConfigStore } from "@/stores/configStore";

/**
 * Send an LLM request through the proxy API route.
 * Handles streaming by calling onChunk for each delta.
 * Returns the full response text and a log entry.
 */
export async function sendLlmRequest({
  messages,
  agent,
  onChunk,
  signal,
}: {
  messages: ChatMessage[];
  agent: AgentType;
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<LlmCallLog> {
  const store = useConfigStore.getState();
  const slot = store.slots[agent];
  const model = store.getNextModel(agent);
  const apiKey = store.getEffectiveApiKey(agent);

  const startTime = Date.now();
  const logId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let stopSequences: string[] = [];
  try {
    stopSequences = JSON.parse(slot.tuning.stopSequences);
  } catch {
    // Ignore
  }

  const requestBody = {
    messages,
    model,
    apiEndpoint: slot.api.apiEndpoint,
    apiKey,
    temperature: slot.tuning.temperature,
    maxTokens: slot.tuning.maxTokens,
    topP: slot.tuning.topP,
    topK: slot.tuning.topK,
    frequencyPenalty: slot.tuning.frequencyPenalty,
    presencePenalty: slot.tuning.presencePenalty,
    stopSequences,
    stream: slot.api.useSSE,
    providerSettings: slot.api.providerSettings,
    providerSorting: slot.api.providerSorting,
    allowReasoning: slot.tuning.allowReasoning,
  };

  const response = await fetch("/api/llm/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    return {
      id: logId,
      timestamp: startTime,
      agent,
      model,
      messages,
      response: "",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs,
      error: data.error || `HTTP ${response.status}`,
    };
  }

  let fullResponse = "";
  let promptTokens = 0;
  let completionTokens = 0;

  if (slot.api.useSSE && response.body) {
    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullResponse += delta;
            onChunk?.(delta);
          }

          // Capture usage from final chunk
          if (parsed.usage) {
            promptTokens = parsed.usage.prompt_tokens || 0;
            completionTokens = parsed.usage.completion_tokens || 0;
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  } else {
    // Non-streaming
    const data = await response.json();
    fullResponse = data.choices?.[0]?.message?.content || "";
    promptTokens = data.usage?.prompt_tokens || 0;
    completionTokens = data.usage?.completion_tokens || 0;
    onChunk?.(fullResponse);
  }

  const latencyMs = Date.now() - startTime;

  return {
    id: logId,
    timestamp: startTime,
    agent,
    model,
    messages,
    response: fullResponse,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    latencyMs,
  };
}
