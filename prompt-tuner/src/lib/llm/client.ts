import type { AgentType, ModelSlot } from "@/types/config";
import type { ChatMessage, LlmCallLog } from "@/types/llm";
import { useConfigStore } from "@/stores/configStore";

// ── Internal shared implementation ──────────────────────────────────

interface InternalRequest {
  messages: ChatMessage[];
  agent: AgentType;
  model: string;
  apiKey: string;
  slot: ModelSlot;
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
}

async function _sendLlmRequestInternal({
  messages,
  agent,
  model,
  apiKey,
  slot,
  onChunk,
  signal,
}: InternalRequest): Promise<LlmCallLog> {
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
    reasoningEffort: slot.tuning.reasoningEffort,
    requestTimeout: slot.api.requestTimeout,
    connectTimeout: slot.api.connectTimeout,
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
  let rawRequestBody: Record<string, unknown> | undefined;

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

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
          continue;
        }
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;

        // Capture the request payload event injected by our API route
        if (currentEvent === "__request_payload") {
          try { rawRequestBody = JSON.parse(data); } catch {}
          currentEvent = "";
          continue;
        }
        currentEvent = "";

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
    if (data.__requestPayload) rawRequestBody = data.__requestPayload;
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
    rawRequestBody,
  };
}

// ── Public: reads from global configStore ───────────────────────────

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

  return _sendLlmRequestInternal({
    messages,
    agent,
    model,
    apiKey,
    slot,
    onChunk,
    signal,
  });
}

// ── Public: uses explicit slot + apiKey (for benchmarks) ────────────

export async function sendLlmRequestWithSlot({
  messages,
  agent,
  slot,
  model,
  apiKey,
  onChunk,
  signal,
}: {
  messages: ChatMessage[];
  agent: AgentType;
  slot: ModelSlot;
  model: string;
  apiKey: string;
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<LlmCallLog> {
  return _sendLlmRequestInternal({
    messages,
    agent,
    model,
    apiKey,
    slot,
    onChunk,
    signal,
  });
}

// ── Public: combined render + LLM in one server round-trip ──────────

export interface RenderAndChatResult extends LlmCallLog {
  renderResult?: {
    messages: ChatMessage[];
    renderedText: string;
  };
}

/**
 * Render a prompt template + call the LLM in a single server round-trip.
 * Eliminates the browser↔server hop between render and LLM call (~300-1500ms savings).
 *
 * Works with any render endpoint (dialogue, target selector, action selector, etc.).
 * Defaults to "/api/prompts/render-dialogue" for backward compatibility.
 */
export async function sendRenderAndChat({
  renderEndpoint = "/api/prompts/render-dialogue",
  renderBody,
  agent,
  onChunk,
  onRenderResult,
  signal,
  slot: slotOverride,
  model: modelOverride,
  apiKey: apiKeyOverride,
}: {
  renderEndpoint?: string;
  renderBody: Record<string, unknown>;
  agent: AgentType;
  onChunk?: (chunk: string) => void;
  onRenderResult?: (result: { messages: ChatMessage[]; renderedText: string }) => void;
  signal?: AbortSignal;
  slot?: ModelSlot;
  model?: string;
  apiKey?: string;
}): Promise<RenderAndChatResult> {
  const store = useConfigStore.getState();
  const slot = slotOverride || store.slots[agent];
  const model = modelOverride || store.getNextModel(agent);
  const apiKey = apiKeyOverride || store.getEffectiveApiKey(agent);

  const startTime = Date.now();
  const logId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let stopSequences: string[] = [];
  try {
    stopSequences = JSON.parse(slot.tuning.stopSequences);
  } catch {
    // Ignore
  }

  const requestBody = {
    renderEndpoint,
    renderBody,
    llm: {
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
      reasoningEffort: slot.tuning.reasoningEffort,
      requestTimeout: slot.api.requestTimeout,
      connectTimeout: slot.api.connectTimeout,
    },
  };

  const response = await fetch("/api/llm/chat-dialogue", {
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
      messages: [],
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
  let rawRequestBody: Record<string, unknown> | undefined;
  let renderResult: { messages: ChatMessage[]; renderedText: string } | undefined;

  if (slot.api.useSSE && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
          continue;
        }
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;

        // Capture render result event
        if (currentEvent === "__render_result") {
          try {
            renderResult = JSON.parse(data);
            onRenderResult?.(renderResult!);
          } catch {}
          currentEvent = "";
          continue;
        }

        // Capture request payload event
        if (currentEvent === "__request_payload") {
          try { rawRequestBody = JSON.parse(data); } catch {}
          currentEvent = "";
          continue;
        }
        currentEvent = "";

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullResponse += delta;
            onChunk?.(delta);
          }
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
    const data = await response.json();
    fullResponse = data.choices?.[0]?.message?.content || "";
    promptTokens = data.usage?.prompt_tokens || 0;
    completionTokens = data.usage?.completion_tokens || 0;
    if (data.__requestPayload) rawRequestBody = data.__requestPayload;
    onChunk?.(fullResponse);
  }

  const latencyMs = Date.now() - startTime;

  return {
    id: logId,
    timestamp: startTime,
    agent,
    model,
    messages: renderResult?.messages || [],
    response: fullResponse,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    latencyMs,
    rawRequestBody,
    renderResult,
  };
}

/**
 * Convenience alias: render dialogue template + call LLM in one trip.
 * Equivalent to sendRenderAndChat with renderEndpoint="/api/prompts/render-dialogue".
 */
export function sendDialogueRequest(
  opts: Omit<Parameters<typeof sendRenderAndChat>[0], "renderEndpoint" | "renderBody"> & {
    renderParams: Record<string, unknown>;
  }
): Promise<RenderAndChatResult> {
  const { renderParams, ...rest } = opts;
  return sendRenderAndChat({
    ...rest,
    renderEndpoint: "/api/prompts/render-dialogue",
    renderBody: renderParams,
  });
}
