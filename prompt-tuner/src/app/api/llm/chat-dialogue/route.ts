import { NextRequest } from "next/server";
import { proxyToLlm, handleProxyError, type LlmProxyParams } from "../proxy";

/**
 * Generic combined render + LLM proxy.
 *
 * Renders any prompt template server-side via an internal fetch to the
 * specified render endpoint, then immediately proxies the rendered messages
 * to the LLM API — eliminating the browser round-trip between render and
 * chat that adds 300-1500ms of latency per call.
 *
 * The rendered prompt data is injected as a __render_result SSE event before
 * the LLM stream begins, so the client still has access to it for previews.
 *
 * POST body: {
 *   renderEndpoint: string,        // e.g. "/api/prompts/render-dialogue"
 *   renderBody: Record<string, unknown>,  // body to POST to the render endpoint
 *   llm: LlmProxyParams            // LLM connection + tuning settings
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { renderEndpoint, renderBody, llm } = body as {
      renderEndpoint: string;
      renderBody: Record<string, unknown>;
      llm: LlmProxyParams;
    };

    if (!renderEndpoint) {
      return Response.json(
        { error: "Missing renderEndpoint" },
        { status: 400 }
      );
    }

    // ── Step 1: Internal server-to-server render call ──────────────
    // Constructs a full URL from the relative endpoint path and fetches
    // on localhost. This is ~1ms vs the ~50-200ms browser round-trip.
    const renderUrl = new URL(renderEndpoint, request.url);

    const renderResponse = await fetch(renderUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(renderBody),
    });

    if (!renderResponse.ok) {
      const errData = await renderResponse.json().catch(() => ({}));
      return Response.json(
        { error: (errData as Record<string, string>).error || `Render failed: HTTP ${renderResponse.status}` },
        { status: renderResponse.status }
      );
    }

    const renderData = await renderResponse.json();
    const messages = renderData.messages;

    if (!messages || messages.length === 0) {
      return Response.json(
        { error: "Template rendered but produced no messages" },
        { status: 500 }
      );
    }

    // ── Step 2: Proxy to LLM with rendered messages ─────────────────

    // Inject render result as an SSE event so the client can populate previews
    const renderEvent = `event: __render_result\ndata: ${JSON.stringify({
      messages: renderData.messages,
      renderedText: renderData.renderedText || "",
    })}\n\n`;

    return await proxyToLlm(llm, messages, request, [renderEvent]);
  } catch (error) {
    return handleProxyError(error);
  }
}
