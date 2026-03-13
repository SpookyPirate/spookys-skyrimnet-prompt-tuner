import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      model,
      apiEndpoint,
      apiKey,
      temperature,
      maxTokens,
      topP,
      topK,
      frequencyPenalty,
      presencePenalty,
      stopSequences,
      stream,
      providerSettings,
      providerSorting,
      allowReasoning,
      reasoningEffort,
      requestTimeout,
      connectTimeout,
    } = body;

    if (!apiKey) {
      return Response.json(
        { error: "No API key configured. Open Settings to add one." },
        { status: 400 }
      );
    }

    if (!model) {
      return Response.json(
        { error: "No model configured for this agent slot." },
        { status: 400 }
      );
    }

    // Build request payload (OpenAI-compatible format)
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: stream ?? true,
    };

    if (topP !== undefined && topP !== 1) payload.top_p = topP;
    if (topK !== undefined && topK > 0) payload.top_k = topK;
    if (frequencyPenalty) payload.frequency_penalty = frequencyPenalty;
    if (presencePenalty) payload.presence_penalty = presencePenalty;
    if (stopSequences?.length) payload.stop = stopSequences;

    // OpenRouter-specific settings
    if (apiEndpoint.includes("openrouter.ai")) {
      // Provider object controls routing preferences (sort, allow_fallbacks, etc.)
      // sort disables load balancing and tries providers in order of the chosen metric.
      const provider: Record<string, unknown> = {
        sort: providerSorting || "latency",
      };

      // Merge user-provided provider settings JSON (routing preferences only)
      if (providerSettings) {
        try {
          const parsed =
            typeof providerSettings === "string"
              ? JSON.parse(providerSettings)
              : providerSettings;
          Object.assign(provider, parsed);
        } catch {
          // Ignore invalid JSON
        }
      }

      payload.provider = provider;

      // Reasoning: top-level parameter with enabled toggle + effort level.
      // Models like Grok reason by default — omitting the param won't disable it.
      // Must explicitly send enabled:false to turn it off.
      if (allowReasoning) {
        const effort = reasoningEffort || "medium";
        payload.reasoning = { enabled: true, effort };
      } else {
        payload.reasoning = { enabled: false };
      }
    }

    // Use an AbortController so we can cancel the upstream fetch on timeout or client disconnect,
    // but clear the timeout once the response headers arrive (streaming may take much longer).
    // connectTimeout: time to get first response headers (connection phase).
    // requestTimeout: total time budget for non-streaming; unused for streaming (cleared after headers).
    const controller = new AbortController();
    const connectMs = ((connectTimeout as number) || 10) * 1000;
    const timer = setTimeout(() => controller.abort("timeout"), connectMs);

    // Also abort upstream if the client disconnects
    const onClientAbort = () => controller.abort("client_disconnect");
    request.signal.addEventListener("abort", onClientAbort);

    let response: Response;
    try {
      response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "SkyrimNet Prompt Tuner",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      // Response headers received (or fetch threw) — clear the connection timeout.
      // Streaming will continue without a timeout; only client disconnect aborts it.
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

    // Redact API key from payload echo
    const payloadEcho = { ...payload };

    if (stream && response.body) {
      // Inject the request payload as the first SSE event, then proxy the rest.
      // The client abort listener stays active so disconnection cancels the stream.
      const payloadEvent = `event: __request_payload\ndata: ${JSON.stringify(payloadEcho)}\n\n`;
      const encoder = new TextEncoder();
      const prefix = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(encoder.encode(payloadEvent));
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
            // Stream read failed (client disconnected, etc.) — close gracefully
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

    // Non-streaming response — enforce requestTimeout as total body read budget
    const totalMs = ((requestTimeout as number) || 30) * 1000;
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
  } catch (error) {
    // Classify abort errors — Node/undici, DOMException, and edge runtimes
    // all represent aborts differently, so check multiple paths.
    const err = error as Record<string, unknown>;
    const isAbort =
      (error instanceof DOMException && error.name === "AbortError") ||
      err?.name === "AbortError" ||
      err?.code === "ABORT_ERR" ||
      err?.type === "aborted";

    // Extract the abort reason from wherever the runtime put it
    const reason = String(
      err?.reason ?? err?.cause ?? (error instanceof DOMException ? error.message : "") ?? ""
    );
    const isTimeout = reason === "timeout" || String(err?.message ?? "").includes("timeout");
    const isClientDisconnect = reason === "client_disconnect";

    if (isAbort || isTimeout) {
      if (isTimeout) {
        return Response.json(
          { error: "Request timed out waiting for a response. Increase the timeout in Settings or try a faster model." },
          { status: 504 }
        );
      }
      if (isClientDisconnect) {
        return Response.json(
          { error: "Request was cancelled." },
          { status: 499 }
        );
      }
      // Generic abort (unknown reason)
      return Response.json(
        { error: "Request was cancelled." },
        { status: 499 }
      );
    }

    console.error("LLM proxy error:", error);
    const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
    return Response.json(
      { error: `LLM proxy error: ${msg}` },
      { status: 500 }
    );
  }
}
