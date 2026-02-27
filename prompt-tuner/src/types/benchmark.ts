import type { SkyrimNetAgentType } from "./config";
import type { ChatMessage } from "./llm";

// ── Category types (one per model agent) ────────────────────────────

export type BenchmarkCategory =
  | "dialogue"
  | "meta_eval"
  | "action_eval"
  | "game_master"
  | "memory_gen"
  | "diary"
  | "bio_update";

export interface BenchmarkSubtask {
  id: string;
  label: string;
  renderEndpoint: string;
}

export interface BenchmarkCategoryDef {
  id: BenchmarkCategory;
  label: string;
  description: string;
  agent: SkyrimNetAgentType;
  subtasks: BenchmarkSubtask[];
}

// ── Scenario types ──────────────────────────────────────────────────

export interface BenchmarkNpc {
  uuid: string;
  name: string;
  displayName: string;
  gender: string;
  race: string;
  distance: number;
}

export interface BenchmarkPlayer {
  name: string;
  gender: string;
  race: string;
  level: number;
}

export interface BenchmarkScene {
  location: string;
  weather: string;
  timeOfDay: string;
  worldPrompt: string;
  scenePrompt: string;
}

export interface BenchmarkDialogueTurn {
  id: string;
  label: string;
  inputType: "player" | "npc";
  inputSpeaker: string;
  inputSpeakerUuid: string;
  inputContent: string;
  inputTarget: string;
  respondingNpcIndex: number;
}

export interface BenchmarkChatEntry {
  type: "player" | "npc" | "narration";
  speaker: string;
  content: string;
  target?: string;
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  category: BenchmarkCategory;
  isBuiltin: boolean;
  player: BenchmarkPlayer;
  scene: BenchmarkScene;
  npcs: BenchmarkNpc[];
  chatHistory: BenchmarkChatEntry[];
  // Multi-turn dialogue
  turns?: BenchmarkDialogueTurn[];
  // Category-specific fields
  playerMessage?: string;
  npcResponse?: string;
  npcName?: string;
  lastSpeaker?: string;
  eligibleActions?: { name: string; description: string; parameterSchema?: string }[];
  scenePlan?: string;
  isContinuousMode?: boolean;
}

// ── Result types ────────────────────────────────────────────────────

export interface BenchmarkSubtaskResult {
  subtaskId: string;
  subtaskLabel: string;
  messages: ChatMessage[];
  response: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  streamedText: string;
  status: "pending" | "streaming" | "done" | "error";
  error?: string;
}

export interface BenchmarkResult {
  profileId: string;
  profileName: string;
  category: BenchmarkCategory;
  model: string;
  subtasks: BenchmarkSubtaskResult[];
  // Aggregates (computed from subtasks)
  totalLatencyMs: number;
  totalTokens: number;
  overallStatus: "pending" | "streaming" | "done" | "error";
}

export interface BenchmarkAssessment {
  streamedText: string;
  status: "idle" | "streaming" | "done" | "error";
  error?: string;
}
