import { NextRequest } from "next/server";
import { proxyToLlm, handleProxyError } from "../proxy";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return await proxyToLlm(
      {
        model: body.model,
        apiEndpoint: body.apiEndpoint,
        apiKey: body.apiKey,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        topP: body.topP,
        topK: body.topK,
        frequencyPenalty: body.frequencyPenalty,
        presencePenalty: body.presencePenalty,
        stopSequences: body.stopSequences,
        stream: body.stream,
        providerSettings: body.providerSettings,
        providerSorting: body.providerSorting,
        allowReasoning: body.allowReasoning,
        reasoningEffort: body.reasoningEffort,
        requestTimeout: body.requestTimeout,
        connectTimeout: body.connectTimeout,
      },
      body.messages,
      request
    );
  } catch (error) {
    return handleProxyError(error);
  }
}
