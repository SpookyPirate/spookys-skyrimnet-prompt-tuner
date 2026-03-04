export type AgentType =
  | "default"
  | "game_master"
  | "memory_gen"
  | "profile_gen"
  | "action_eval"
  | "meta_eval"
  | "diary"
  | "tuner"
  | "autochat"
  | "copycat";

export type SkyrimNetAgentType = Exclude<AgentType, "tuner" | "autochat" | "copycat">;

export const SKYRIMNET_AGENTS: SkyrimNetAgentType[] = [
  "default",
  "game_master",
  "memory_gen",
  "profile_gen",
  "action_eval",
  "meta_eval",
  "diary",
];

export const AGENT_LABELS: Record<AgentType, string> = {
  default: "Default",
  game_master: "Game Master",
  memory_gen: "Memory Gen",
  profile_gen: "Profile Gen",
  action_eval: "Action Eval",
  meta_eval: "Meta Eval",
  diary: "Diary",
  tuner: "Tuner",
  autochat: "Autochat",
  copycat: "Copycat",
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
  autochat: "Autonomous player character dialogue generation",
  copycat: "Style-matching agent that copies one model's dialogue quality to another",
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
  providerSettings: "",
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
};

export const DEFAULT_MODEL_NAMES: Record<AgentType, string> = {
  default: "deepseek/deepseek-chat-v3-0324",
  game_master: "anthropic/claude-haiku-4.5",
  memory_gen: "deepseek/deepseek-chat-v3-0324",
  profile_gen: "deepseek/deepseek-r1-0528",
  action_eval: "x-ai/grok-4.1-fast",
  meta_eval: "x-ai/grok-4.1-fast",
  diary: "anthropic/claude-sonnet-4.5",
  tuner: "anthropic/claude-sonnet-4-6",
  autochat: "anthropic/claude-sonnet-4-6",
  copycat: "anthropic/claude-opus-4-6",
};

/** Per-agent tuning overrides (merged on top of DEFAULT_TUNING_SETTINGS) */
export const DEFAULT_AGENT_TUNING_OVERRIDES: Partial<
  Record<AgentType, Partial<AiTuningSettings>>
> = {
  game_master: { temperature: 0.8, maxTokens: 256 },
  memory_gen: { maxTokens: 4000 },
  profile_gen: { maxTokens: 10000, allowReasoning: true },
  action_eval: { maxTokens: 500 },
  meta_eval: { maxTokens: 100 },
  diary: { temperature: 0.8, maxTokens: 12000 },
  copycat: { maxTokens: 16000, temperature: 1.0, allowReasoning: true },
};

/** Per-agent API overrides (merged on top of DEFAULT_API_SETTINGS) */
export const DEFAULT_AGENT_API_OVERRIDES: Partial<
  Record<AgentType, Partial<ApiSettings>>
> = {
  memory_gen: { requestTimeout: 60 },
  profile_gen: { requestTimeout: 300 },
  diary: { requestTimeout: 120 },
  copycat: { requestTimeout: 180 },
};

export interface SettingsProfile {
  id: string;
  name: string;
  createdAt: string;
  globalApiKey: string;
  slots: Record<SkyrimNetAgentType, ModelSlot>;
}
