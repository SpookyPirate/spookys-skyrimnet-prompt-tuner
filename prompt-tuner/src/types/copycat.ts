import type { AiTuningSettings } from "./config";
import type { ChatMessage } from "./llm";
import type { TunerProposal, TuningTarget } from "./autotuner";

export type CopycatPhase =
  | "idle"
  | "running_reference"
  | "running_target"
  | "comparing"
  | "proposing"
  | "verifying"
  | "applying"
  | "complete"
  | "error"
  | "stopped";

export interface CopycatDialogueTurn {
  label: string;
  messages: ChatMessage[];
  response: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface CopycatVerificationRun {
  customLine: string;
  messages: ChatMessage[];
  response: string;
  latencyMs?: number;
}

export interface CopycatRound {
  roundNumber: number;
  referenceDialogue: CopycatDialogueTurn[];
  targetDialogue: CopycatDialogueTurn[];
  comparisonText: string;
  proposal: TunerProposal | null;
  proposalRaw: string;
  verificationRuns: CopycatVerificationRun[];
  appliedSettings: AiTuningSettings | null;
  effectivenessScore: number | null;
  phase: CopycatPhase;
  error?: string;
}

export interface CopycatConfig {
  referenceModelId: string;
  targetModelId: string;
  selectedScenarioId: string;
  selectedPromptSet: string;
  tuningTarget: TuningTarget;
  maxRounds: number;
  lockedSettings: (keyof AiTuningSettings)[];
  customInstructions: string;
}
