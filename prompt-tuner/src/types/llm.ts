import type { AgentType } from "./config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  messages: ChatMessage[];
  agent: AgentType;
  // Override settings from configStore
  model?: string;
  apiEndpoint?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  stream?: boolean;
  providerSettings?: Record<string, unknown>;
  providerSorting?: string;
}

export interface LlmCallLog {
  id: string;
  timestamp: number;
  agent: AgentType;
  model: string;
  messages: ChatMessage[];
  response: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  error?: string;
}
