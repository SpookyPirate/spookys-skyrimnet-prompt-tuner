import { create } from "zustand";
import type { BenchmarkCategory } from "@/types/benchmark";
import type { AiTuningSettings } from "@/types/config";
import type { AiTuningSettings as AiTuningSettingsType } from "@/types/config";
import type {
  TuningTarget,
  TunerPhase,
  TunerRound,
  TunerProposal,
} from "@/types/autotuner";
import type { BenchmarkSubtaskResult } from "@/types/benchmark";

const STORAGE_KEY = "skyrimnet-autotuner";

function loadPersisted(): {
  selectedProfileId: string;
  selectedCategory: BenchmarkCategory | null;
  selectedScenarioId: string;
  selectedPromptSet: string;
  tuningTarget: TuningTarget;
  maxRounds: number;
  lockedSettings: (keyof AiTuningSettingsType)[];
  customInstructions: string;
} {
  const defaults = {
    selectedProfileId: "",
    selectedCategory: null as BenchmarkCategory | null,
    selectedScenarioId: "",
    selectedPromptSet: "",
    tuningTarget: "settings" as TuningTarget,
    maxRounds: 5,
    lockedSettings: [] as (keyof AiTuningSettingsType)[],
    customInstructions: "",
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        selectedProfileId: data.selectedProfileId ?? "",
        selectedCategory: data.selectedCategory ?? null,
        selectedScenarioId: data.selectedScenarioId ?? "",
        selectedPromptSet: data.selectedPromptSet ?? "",
        tuningTarget: data.tuningTarget ?? "settings",
        maxRounds: data.maxRounds ?? 5,
        lockedSettings: data.lockedSettings ?? [],
        customInstructions: data.customInstructions ?? "",
      };
    }
  } catch { /* ignore */ }
  return defaults;
}

interface AutoTunerState {
  // Config (persisted)
  selectedProfileId: string;
  selectedCategory: BenchmarkCategory | null;
  selectedScenarioId: string;
  selectedPromptSet: string;
  tuningTarget: TuningTarget;
  maxRounds: number;
  lockedSettings: (keyof AiTuningSettingsType)[];
  customInstructions: string;

  // Run state (volatile)
  isRunning: boolean;
  currentRound: number;
  phase: TunerPhase;
  rounds: TunerRound[];
  abortController: AbortController | null;

  // Working state
  workingSettings: AiTuningSettings | null;
  originalSettings: AiTuningSettings | null;
  workingPromptSet: string;

  // Streaming
  explanationStream: string;
  assessmentStream: string;
  proposalStream: string;

  // Actions - config
  setSelectedProfileId: (id: string) => void;
  setSelectedCategory: (cat: BenchmarkCategory | null) => void;
  setSelectedScenarioId: (id: string) => void;
  setSelectedPromptSet: (name: string) => void;
  setTuningTarget: (target: TuningTarget) => void;
  setMaxRounds: (n: number) => void;
  setLockedSettings: (keys: (keyof AiTuningSettingsType)[]) => void;
  setCustomInstructions: (text: string) => void;

  // Actions - run state
  setIsRunning: (running: boolean) => void;
  setPhase: (phase: TunerPhase) => void;
  setCurrentRound: (n: number) => void;
  setAbortController: (ctrl: AbortController | null) => void;

  // Actions - working state
  setWorkingSettings: (settings: AiTuningSettings | null) => void;
  setOriginalSettings: (settings: AiTuningSettings | null) => void;
  setWorkingPromptSet: (name: string) => void;

  // Actions - rounds
  startNewRound: (roundNumber: number) => void;
  updateCurrentRound: (updates: Partial<TunerRound>) => void;
  setRoundBenchmarkResult: (roundIdx: number, result: BenchmarkSubtaskResult) => void;
  setRoundAssessment: (roundIdx: number, text: string) => void;
  setRoundProposal: (roundIdx: number, proposal: TunerProposal, raw: string) => void;
  setRoundPhase: (roundIdx: number, phase: TunerPhase) => void;
  setRoundError: (roundIdx: number, error: string) => void;
  setRoundAppliedSettings: (roundIdx: number, settings: AiTuningSettings) => void;

  // Actions - streaming
  appendExplanationStream: (chunk: string) => void;
  appendAssessmentStream: (chunk: string) => void;
  appendProposalStream: (chunk: string) => void;
  clearStreams: () => void;

  // Actions - lifecycle
  reset: () => void;
  persist: () => void;
}

const _persisted = loadPersisted();

export const useAutoTunerStore = create<AutoTunerState>((set, get) => ({
  // Config
  selectedProfileId: _persisted.selectedProfileId,
  selectedCategory: _persisted.selectedCategory,
  selectedScenarioId: _persisted.selectedScenarioId,
  selectedPromptSet: _persisted.selectedPromptSet,
  tuningTarget: _persisted.tuningTarget,
  maxRounds: _persisted.maxRounds,
  lockedSettings: _persisted.lockedSettings,
  customInstructions: _persisted.customInstructions,

  // Run state
  isRunning: false,
  currentRound: 0,
  phase: "idle",
  rounds: [],
  abortController: null,

  // Working state
  workingSettings: null,
  originalSettings: null,
  workingPromptSet: "",

  // Streaming
  explanationStream: "",
  assessmentStream: "",
  proposalStream: "",

  // Config actions
  setSelectedProfileId: (id) => {
    set({ selectedProfileId: id });
    get().persist();
  },
  setSelectedCategory: (cat) => {
    set({ selectedCategory: cat });
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

  // Run state actions
  setIsRunning: (running) => set({ isRunning: running }),
  setPhase: (phase) => set({ phase }),
  setCurrentRound: (n) => set({ currentRound: n }),
  setAbortController: (ctrl) => set({ abortController: ctrl }),

  // Working state actions
  setWorkingSettings: (settings) => set({ workingSettings: settings }),
  setOriginalSettings: (settings) => set({ originalSettings: settings }),
  setWorkingPromptSet: (name) => set({ workingPromptSet: name }),

  // Round actions
  startNewRound: (roundNumber) => {
    const newRound: TunerRound = {
      roundNumber,
      benchmarkResult: null,
      assessmentText: "",
      proposal: null,
      proposalRaw: "",
      appliedSettings: null,
      phase: "benchmarking",
      error: undefined,
    };
    set((s) => ({
      rounds: [...s.rounds, newRound],
      currentRound: roundNumber,
      explanationStream: "",
      assessmentStream: "",
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

  setRoundBenchmarkResult: (roundIdx, result) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], benchmarkResult: result };
      return { rounds };
    }),

  setRoundAssessment: (roundIdx, text) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], assessmentText: text };
      return { rounds };
    }),

  setRoundProposal: (roundIdx, proposal, raw) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], proposal, proposalRaw: raw };
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

  setRoundAppliedSettings: (roundIdx, settings) =>
    set((s) => {
      const rounds = [...s.rounds];
      if (!rounds[roundIdx]) return s;
      rounds[roundIdx] = { ...rounds[roundIdx], appliedSettings: settings };
      return { rounds };
    }),

  // Streaming actions
  appendExplanationStream: (chunk) =>
    set((s) => ({ explanationStream: s.explanationStream + chunk })),
  appendAssessmentStream: (chunk) =>
    set((s) => ({ assessmentStream: s.assessmentStream + chunk })),
  appendProposalStream: (chunk) =>
    set((s) => ({ proposalStream: s.proposalStream + chunk })),
  clearStreams: () => set({ explanationStream: "", assessmentStream: "", proposalStream: "" }),

  // Lifecycle
  reset: () =>
    set({
      isRunning: false,
      currentRound: 0,
      phase: "idle",
      rounds: [],
      abortController: null,
      workingSettings: null,
      originalSettings: null,
      workingPromptSet: "",
      explanationStream: "",
      assessmentStream: "",
      proposalStream: "",
    }),

  persist: () => {
    if (typeof window === "undefined") return;
    const { selectedProfileId, selectedCategory, selectedScenarioId, selectedPromptSet, tuningTarget, maxRounds, lockedSettings, customInstructions } = get();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ selectedProfileId, selectedCategory, selectedScenarioId, selectedPromptSet, tuningTarget, maxRounds, lockedSettings, customInstructions })
      );
    } catch { /* ignore */ }
  },
}));
