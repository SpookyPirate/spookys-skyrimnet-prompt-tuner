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

      // Reasoning is a top-level parameter, not inside provider.
      // Non-reasoning models silently ignore it.
      if (allowReasoning) {
        payload.reasoning = { effort: "minimal" };
      }
    }

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "SkyrimNet Prompt Tuner",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
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

    if (stream && response.body) {
      // Proxy the SSE stream directly
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming response
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("LLM proxy error:", error);
    return Response.json(
      { error: `LLM proxy error: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
