import { NextRequest } from "next/server";

/**
 * Shared LLM proxy logic used by both /api/llm/chat and /api/llm/chat-dialogue.
 * Handles payload construction, OpenRouter-specific settings, timeouts, streaming,
 * and error handling in one place.
 */

export interface LlmProxyParams {
  model: string;
  apiEndpoint: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  stream?: boolean;
  providerSettings?: string | Record<string, unknown>;
  providerSorting?: string;
  allowReasoning?: boolean;
  reasoningEffort?: string;
  requestTimeout?: number;
  connectTimeout?: number;
}

export interface ChatMessage {
  role: string;
  content: string;
}

/** Build the OpenAI-compatible payload from our internal params. */
export function buildLlmPayload(
  params: LlmProxyParams,
  messages: ChatMessage[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: params.model,
    messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    stream: params.stream ?? true,
  };

  if (params.topP !== undefined && params.topP !== 1) payload.top_p = params.topP;
  if (params.topK !== undefined && params.topK > 0) payload.top_k = params.topK;
  if (params.frequencyPenalty) payload.frequency_penalty = params.frequencyPenalty;
  if (params.presencePenalty) payload.presence_penalty = params.presencePenalty;
  if (params.stopSequences?.length) payload.stop = params.stopSequences;

  // OpenRouter-specific settings
  if (params.apiEndpoint.includes("openrouter.ai")) {
    const provider: Record<string, unknown> = {
      sort: params.providerSorting || "latency",
      require_parameters: true,
    };

    if (params.providerSettings) {
      try {
        const parsed =
          typeof params.providerSettings === "string"
            ? JSON.parse(params.providerSettings)
            : params.providerSettings;
        Object.assign(provider, parsed);
      } catch {
        // Ignore invalid JSON
      }
    }

    payload.provider = provider;

    if (params.allowReasoning) {
      const effort = params.reasoningEffort || "medium";
      payload.reasoning = { effort };
    }
  }

  return payload;
}

/**
 * Proxy a request to an LLM API endpoint.
 *
 * @param params   LLM connection & tuning parameters
 * @param messages Chat messages to send
 * @param request  The incoming Next.js request (used for client-disconnect detection)
 * @param prefixEvents Optional SSE events to inject before the upstream stream
 *                     (e.g. rendered prompt data). Each string should be a complete
 *                     SSE event block ending with \n\n.
 */
export async function proxyToLlm(
  params: LlmProxyParams,
  messages: ChatMessage[],
  request: NextRequest,
  prefixEvents?: string[]
): Promise<Response> {
  if (!params.apiKey) {
    return Response.json(
      { error: "No API key configured. Open Settings to add one." },
      { status: 400 }
    );
  }

  if (!params.model) {
    return Response.json(
      { error: "No model configured for this agent slot." },
      { status: 400 }
    );
  }

  const payload = buildLlmPayload(params, messages);
  const shouldStream = params.stream ?? true;

  const controller = new AbortController();
  const connectMs = ((params.connectTimeout as number) || 10) * 1000;
  const timer = setTimeout(() => controller.abort("timeout"), connectMs);

  const onClientAbort = () => controller.abort("client_disconnect");
  request.signal.addEventListener("abort", onClientAbort);

  let response: globalThis.Response;
  try {
    response = await fetch(params.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "SkyrimNet Prompt Tuner",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    request.signal.removeEventListener("abort", onClientAbort);
    const errorText = await response.text();
    let errorMessage: string;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage =
        errorJson.error?.message || errorJson.error || errorText;
    } catch {
      errorMessage = errorText;
    }
    return Response.json(
      { error: `LLM API error (${response.status}): ${errorMessage}` },
      { status: response.status }
    );
  }

  const payloadEcho = { ...payload };

  if (shouldStream && response.body) {
    // Build prefix: optional custom events + request payload event
    const allPrefixEvents = [
      ...(prefixEvents || []),
      `event: __request_payload\ndata: ${JSON.stringify(payloadEcho)}\n\n`,
    ];
    const prefixData = allPrefixEvents.join("");

    const encoder = new TextEncoder();
    const prefix = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(encoder.encode(prefixData));
        ctrl.close();
      },
    });
    const merged = new ReadableStream({
      async start(ctrl) {
        try {
          for (const s of [prefix, response.body!]) {
            const reader = s.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              ctrl.enqueue(value);
            }
          }
          ctrl.close();
        } catch {
          try { ctrl.close(); } catch { /* already closed */ }
        } finally {
          request.signal.removeEventListener("abort", onClientAbort);
        }
      },
    });
    return new Response(merged, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming response
  const totalMs = ((params.requestTimeout as number) || 30) * 1000;
  const bodyTimer = setTimeout(() => controller.abort("timeout"), totalMs);
  let data;
  try {
    data = await response.json();
  } finally {
    clearTimeout(bodyTimer);
  }
  request.signal.removeEventListener("abort", onClientAbort);
  data.__requestPayload = payloadEcho;
  return Response.json(data);
}

/** Shared error handler for timeout/abort/unknown errors. */
export function handleProxyError(error: unknown): Response {
  if (error instanceof DOMException && error.name === "AbortError") {
    const reason = (error as DOMException).message;
    if (reason === "timeout" || String((error as unknown as Record<string, unknown>).cause) === "timeout") {
      return Response.json(
        { error: "Request timed out waiting for a response. Increase the timeout in Settings or try a faster model." },
        { status: 504 }
      );
    }
    return Response.json(
      { error: "Request was cancelled." },
      { status: 499 }
    );
  }
  if ((error as Record<string, unknown>)?.cause === "timeout") {
    return Response.json(
      { error: "Request timed out waiting for a response. Increase the timeout in Settings or try a faster model." },
      { status: 504 }
    );
  }
  if ((error as Record<string, unknown>)?.cause === "client_disconnect") {
    return Response.json(
      { error: "Request was cancelled." },
      { status: 499 }
    );
  }
  console.error("LLM proxy error:", error);
  return Response.json(
    { error: `LLM proxy error: ${(error as Error).message}` },
    { status: 500 }
  );
}
