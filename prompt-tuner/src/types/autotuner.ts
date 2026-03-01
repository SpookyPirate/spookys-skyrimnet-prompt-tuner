import type { AiTuningSettings } from "./config";
import type { BenchmarkCategory, BenchmarkSubtaskResult } from "./benchmark";

export type TuningTarget = "prompts" | "settings" | "both";

export type TunerPhase =
  | "idle"
  | "benchmarking"
  | "explaining"
  | "assessing"
  | "proposing"
  | "applying"
  | "complete"
  | "error"
  | "stopped";

export interface SettingsChange {
  parameter: keyof AiTuningSettings;
  oldValue: string | number | boolean;
  newValue: string | number | boolean;
  reason: string;
}

export interface PromptChange {
  filePath: string;
  searchText: string;
  replaceText: string;
  originalContent: string;
  modifiedContent: string;
  reason: string;
}

export interface TunerProposal {
  stopTuning: boolean;
  stopReason?: string;
  settingsChanges: SettingsChange[];
  promptChanges: PromptChange[];
  reasoning: string;
}

export interface TunerRound {
  roundNumber: number;
  benchmarkResult: BenchmarkSubtaskResult | null;
  assessmentText: string;
  proposal: TunerProposal | null;
  proposalRaw: string;
  appliedSettings: AiTuningSettings | null;
  phase: TunerPhase;
  error?: string;
}

export interface AutoTunerConfig {
  selectedProfileId: string;
  selectedCategory: BenchmarkCategory | null;
  selectedScenarioId: string;
  selectedPromptSet: string;
  tuningTarget: TuningTarget;
  maxRounds: number;
  lockedSettings: (keyof AiTuningSettings)[];
  customInstructions: string;
}
