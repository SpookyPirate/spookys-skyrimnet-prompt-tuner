import { create } from "zustand";
import type { AiTuningSettings } from "@/types/config";
import type {
  TuningTarget,
  TunerProposal,
} from "@/types/autotuner";
import type {
  CopycatPhase,
  CopycatRound,
  CopycatDialogueTurn,
  CopycatVerificationRun,
} from "@/types/copycat";

const STORAGE_KEY = "skyrimnet-copycat";

/** Neutral baseline defaults — designed to give the Copycat LLM maximum tuning room */
export const COPYCAT_DEFAULT_SETTINGS: AiTuningSettings = {
  temperature: 1.0,
  maxTokens: 4096,
  topP: 1.0,
  topK: 0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  stopSequences: "[]",
  structuredOutputs: false,
  allowReasoning: false,
};

function loadPersisted(): {
  referenceModelId: string;
  targetModelId: string;
  selectedScenarioId: string;
  selectedPromptSet: string;
  tuningTarget: TuningTarget;
  maxRounds: number;
  lockedSettings: (keyof AiTuningSettings)[];
  customInstructions: string;
  startingSettings: AiTuningSettings;
} {
  const defaults = {
    referenceModelId: "",
    targetModelId: "",
    selectedScenarioId: "",
    selectedPromptSet: "__active__",
    tuningTarget: "settings" as TuningTarget,
    maxRounds: 5,
    lockedSettings: [] as (keyof AiTuningSettings)[],
    customInstructions: "",
    startingSettings: { ...COPYCAT_DEFAULT_SETTINGS },
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        referenceModelId: data.referenceModelId ?? "",
        targetModelId: data.targetModelId ?? "",
        selectedScenarioId: data.selectedScenarioId ?? "",
        selectedPromptSet: data.selectedPromptSet ?? "__active__",
        tuningTarget: data.tuningTarget ?? "settings",
        maxRounds: data.maxRounds ?? 5,
        lockedSettings: data.lockedSettings ?? [],
        customInstructions: data.customInstructions ?? "",
        startingSettings: data.startingSettings
          ? { ...COPYCAT_DEFAULT_SETTINGS, ...data.startingSettings }
          : { ...COPYCAT_DEFAULT_SETTINGS },
      };
    }
  } catch { /* ignore */ }
  return defaults;
}

interface CopycatState {
  // Config (persisted)
  referenceModelId: string;
  targetModelId: string;
  selectedScenarioId: string;
  selectedPromptSet: string;
  tuningTarget: TuningTarget;
  maxRounds: number;
  lockedSettings: (keyof AiTuningSettings)[];
  customInstructions: string;
  startingSettings: AiTuningSettings;

  // Run state (volatile)
  isRunning: boolean;
  currentRound: number;
  phase: CopycatPhase;
  rounds: CopycatRound[];
  abortController: AbortController | null;

  // Frozen reference dialogue (captured in round 1)
  capturedReferenceDialogue: CopycatDialogueTurn[] | null;

  // Working state
  workingSettings: AiTuningSettings | null;
  originalSettings: AiTuningSettings | null;
  workingPromptSet: string;

  // Streaming buffers
  comparisonStream: string;
  proposalStream: string;

  // Final summary
  effectivenessSummary: number | null;

  // Actions - config
  setReferenceModelId: (id: string) => void;
  setTargetModelId: (id: string) => void;
  setSelectedScenarioId: (id: string) => void;
  setSelectedPromptSet: (name: string) => void;
  setTuningTarget: (target: TuningTarget) => void;
  setMaxRounds: (n: number) => void;
  setLockedSettings: (keys: (keyof AiTuningSettings)[]) => void;
  setCustomInstructions: (text: string) => void;
  setStartingSettings: (settings: AiTuningSettings) => void;
  updateStartingSetting: <K extends keyof AiTuningSettings>(key: K, value: AiTuningSettings[K]) => void;

  // Actions - run state
  setIsRunning: (running: boolean) => void;
  setPhase: (phase: CopycatPhase) => void;
  setCurrentRound: (n: number) => void;
  setAbortController: (ctrl: AbortController | null) => void;

  // Actions - reference
  setCapturedReferenceDialogue: (dialogue: CopycatDialogueTurn[] | null) => void;

  // Actions - working state
  setWorkingSettings: (settings: AiTuningSettings | null) => void;
  setOriginalSettings: (settings: AiTuningSettings | null) => void;
  setWorkingPromptSet: (name: string) => void;

  // Actions - rounds
  startNewRound: (roundNumber: number) => void;
  updateCurrentRound: (updates: Partial<CopycatRound>) => void;
  setRoundPhase: (roundIdx: number, phase: CopycatPhase) => void;
  setRoundError: (roundIdx: number, error: string) => void;
  setRoundReferenceDialogue: (roundIdx: number, dialogue: CopycatDialogueTurn[]) => void;
  setRoundTargetDialogue: (roundIdx: number, dialogue: CopycatDialogueTurn[]) => void;
  setRoundComparison: (roundIdx: number, text: string) => void;
  setRoundProposal: (roundIdx: number, proposal: TunerProposal, raw: string) => void;
  setRoundAppliedSettings: (roundIdx: number, settings: AiTuningSettings) => void;
  setRoundEffectivenessScore: (roundIdx: number, score: number) => void;
  setRoundVerificationRuns: (roundIdx: number, runs: CopycatVerificationRun[]) => void;

  // Actions - streaming
  appendComparisonStream: (chunk: string) => void;
  appendProposalStream: (chunk: string) => void;
  clearStreams: () => void;

  // Actions - lifecycle
  reset: () => void;
  persist: () => void;
}

const _persisted = loadPersisted();

export const useCopycatStore = create<CopycatState>((set, get) => ({
  // Config
  referenceModelId: _persisted.referenceModelId,
  targetModelId: _persisted.targetModelId,
  selectedScenarioId: _persisted.selectedScenarioId,
  selectedPromptSet: _persisted.selectedPromptSet,
  tuningTarget: _persisted.tuningTarget,
  maxRounds: _persisted.maxRounds,
  lockedSettings: _persisted.lockedSettings,
  customInstructions: _persisted.customInstructions,
  startingSettings: _persisted.startingSettings,

  // Run state
  isRunning: false,
  currentRound: 0,
  phase: "idle",
  rounds: [],
  abortController: null,

  // Reference
  capturedReferenceDialogue: null,

  // Working state
  workingSettings: null,
  originalSettings: null,
  workingPromptSet: "",

  // Streaming
  comparisonStream: "",
  proposalStream: "",

  // Summary
  effectivenessSummary: null,

  // Config actions
  setReferenceModelId: (id) => {
    set({ referenceModelId: id });
    get().persist();
  },
  setTargetModelId: (id) => {
    set({ targetModelId: id });
    get().persist();
  },
  setSelectedScenarioId: (id) => {
    set({ selectedScenarioId: id });
    get().persist();
  },
  setSelectedPromptSet: (name) => {
    set({ selectedPromptSet: name });
    get().persist();
  },
  setTuningTarget: (target) => {
    set({ tuningTarget: target });
    get().persist();
  },
  setMaxRounds: (n) => {
    set({ maxRounds: Math.max(1, Math.min(20, n)) });
    get().persist();
  },
  setLockedSettings: (keys) => {
    set({ lockedSettings: keys });
    get().persist();
  },
  setCustomInstructions: (text) => {
    set({ customInstructions: text });
    get().persist();
  },
  setStartingSettings: (settings) => {
    set({ startingSettings: { ...settings } });
    get().persist();
  },
  updateStartingSetting: (key, value) => {
    set((s) => ({
      startingSettings: { ...s.startingSettings, [key]: value },
    }));
    get().persist();
  },

  // Run state actions
  setIsRunning: (running) => set({ isRunning: running }),
  setPhase: (phase) => set({ phase }),
  setCurrentRound: (n) => set({ currentRound: n }),
  setAbortController: (ctrl) => set({ abortController: ctrl }),

  // Reference actions
  setCapturedReferenceDialogue: (dialogue) => set({ capturedReferenceDialogue: dialogue }),

  // Working state actions
  setWorkingSettings: (settings) => set({ workingSettings: settings }),
  setOriginalSettings: (settings) => set({ originalSettings: settings }),
  setWorkingPromptSet: (name) => set({ workingPromptSet: name }),

  // Round actions
  startNewRound: (roundNumber) => {
    const newRound: CopycatRound = {
      roundNumber,
      referenceDialogue: [],
      targetDialogue: [],
      comparisonText: "",
      proposal: null,
      proposalRaw: "",
      verificationRuns: [],
      appliedSettings: null,
      effectivenessScore: null,
      phase: "running_reference",
      error: undefined,
    };
    set((s) => ({
      rounds: [...s.rounds, newRound],
      currentRound: roundNumber,
      comparisonStream: "",
      proposalStream: "",
    }));
  },

  updateCurrentRound: (updates) =>
    set((s) => {
      const rounds = [...s.rounds];
      const idx = rounds.length - 1;
      if (idx < 0) return s;
      rounds[idx] = { ...rounds[idx], ...updates };
      return { rounds };
    }),

  setRoundPhase: (roundIdx, phase) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], phase };
      return { rounds };
    }),

  setRoundError: (roundIdx, error) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], error, phase: "error" };
      return { rounds };
    }),

  setRoundReferenceDialogue: (roundIdx, dialogue) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], referenceDialogue: dialogue };
      return { rounds };
    }),

  setRoundTargetDialogue: (roundIdx, dialogue) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], targetDialogue: dialogue };
      return { rounds };
    }),

  setRoundComparison: (roundIdx, text) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], comparisonText: text };
      return { rounds };
    }),

  setRoundProposal: (roundIdx, proposal, raw) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], proposal, proposalRaw: raw };
      return { rounds };
    }),

  setRoundAppliedSettings: (roundIdx, settings) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], appliedSettings: settings };
      return { rounds };
    }),

  setRoundEffectivenessScore: (roundIdx, score) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], effectivenessScore: score };
      return { rounds, effectivenessSummary: score };
    }),

  setRoundVerificationRuns: (roundIdx, runs) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], verificationRuns: runs };
      return { rounds };
    }),

  // Streaming actions
  appendComparisonStream: (chunk) =>
    set((s) => ({ comparisonStream: s.comparisonStream + chunk })),
  appendProposalStream: (chunk) =>
    set((s) => ({ proposalStream: s.proposalStream + chunk })),
  clearStreams: () => set({ comparisonStream: "", proposalStream: "" }),

  // Lifecycle
  reset: () =>
    set({
      isRunning: false,
      currentRound: 0,
      phase: "idle",
      rounds: [],
      abortController: null,
      capturedReferenceDialogue: null,
      workingSettings: null,
      originalSettings: null,
      workingPromptSet: "",
      comparisonStream: "",
      proposalStream: "",
      effectivenessSummary: null,
    }),

  persist: () => {
    if (typeof window === "undefined") return;
    const {
      referenceModelId, targetModelId, selectedScenarioId,
      selectedPromptSet, tuningTarget, maxRounds, lockedSettings,
      customInstructions, startingSettings,
    } = get();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          referenceModelId, targetModelId, selectedScenarioId,
          selectedPromptSet, tuningTarget, maxRounds, lockedSettings,
          customInstructions, startingSettings,
        })
      );
    } catch { /* ignore */ }
  },
}));
