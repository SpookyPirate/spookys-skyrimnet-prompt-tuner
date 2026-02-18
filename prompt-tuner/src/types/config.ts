export type AgentType =
  | "default"
  | "game_master"
  | "memory_gen"
  | "profile_gen"
  | "action_eval"
  | "meta_eval"
  | "diary"
  | "tuner";

export const AGENT_LABELS: Record<AgentType, string> = {
  default: "Default",
  game_master: "Game Master",
  memory_gen: "Memory Gen",
  profile_gen: "Profile Gen",
  action_eval: "Action Eval",
  meta_eval: "Meta Eval",
  diary: "Diary",
  tuner: "Tuner",
};

export const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  default: "Primary dialogue response generation",
  game_master: "Scene planning and autonomous NPC behavior",
  memory_gen: "Memory generation and consolidation",
  profile_gen: "Character profile generation",
  action_eval: "Game action evaluation from dialogue",
  meta_eval: "Target selection and speaker prediction",
  diary: "Diary entry generation",
  tuner: "AI tuner agent for prompt editing assistance",
};

export interface ApiSettings {
  modelNames: string;
  apiEndpoint: string;
  apiKey: string;
  maxContextLength: number;
  requestTimeout: number;
  connectTimeout: number;
  useSSE: boolean;
  providerSettings: string;
  providerSorting: "latency" | "price" | "throughput";
  maxRetries: number;
}

export interface AiTuningSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string;
  structuredOutputs: boolean;
  allowReasoning: boolean;
  eventHistoryCount: number;
}

export interface ModelSlot {
  api: ApiSettings;
  tuning: AiTuningSettings;
}

export const DEFAULT_API_SETTINGS: ApiSettings = {
  modelNames: "",
  apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
  apiKey: "",
  maxContextLength: 4096,
  requestTimeout: 30,
  connectTimeout: 10,
  useSSE: true,
  providerSettings: '{"cache": true, "reasoning": {"effort": "minimal"}}',
  providerSorting: "latency",
  maxRetries: 1,
};

export const DEFAULT_TUNING_SETTINGS: AiTuningSettings = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  topK: 5,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  stopSequences: "[]",
  structuredOutputs: false,
  allowReasoning: false,
  eventHistoryCount: 50,
};

export const DEFAULT_MODEL_NAMES: Record<AgentType, string> = {
  default: "google/gemini-2.5-flash",
  game_master: "google/gemini-2.5-flash",
  memory_gen: "google/gemini-2.5-flash",
  profile_gen: "google/gemini-2.5-flash",
  action_eval: "google/gemini-2.5-flash",
  meta_eval: "google/gemini-2.5-flash",
  diary: "google/gemini-2.5-flash",
  tuner: "anthropic/claude-sonnet-4",
};
