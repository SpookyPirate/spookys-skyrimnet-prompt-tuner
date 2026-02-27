import { create } from "zustand";
import type {
  BenchmarkCategory,
  BenchmarkResult,
  BenchmarkSubtaskResult,
  BenchmarkAssessment,
  BenchmarkScenario,
  BenchmarkDialogueTurn,
} from "@/types/benchmark";
import type { ChatMessage } from "@/types/llm";

const STORAGE_KEY = "skyrimnet-benchmark";

function loadPersisted(): {
  selectedProfileIds: string[];
  customScenarios: BenchmarkScenario[];
  activeScenarioIds: Record<string, string>;
} {
  if (typeof window === "undefined") return { selectedProfileIds: [], customScenarios: [], activeScenarioIds: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        selectedProfileIds: data.selectedProfileIds ?? [],
        customScenarios: data.customScenarios ?? [],
        activeScenarioIds: data.activeScenarioIds ?? {},
      };
    }
  } catch { /* ignore */ }
  return { selectedProfileIds: [], customScenarios: [], activeScenarioIds: {} };
}

interface BenchmarkState {
  selectedProfileIds: string[];
  activeCategory: BenchmarkCategory | null;
  activeScenarioIds: Record<string, string>;
  results: Record<string, BenchmarkResult>;
  assessment: BenchmarkAssessment;
  isRunning: boolean;
  activeTurns: BenchmarkDialogueTurn[] | null;
  renderedMessages: ChatMessage[] | null;
  renderedText: string;
  customScenarios: BenchmarkScenario[];
  abortController: AbortController | null;

  setActiveTurns: (turns: BenchmarkDialogueTurn[] | null) => void;
  setSelectedProfileIds: (ids: string[]) => void;
  toggleProfileId: (id: string) => void;
  setActiveCategory: (cat: BenchmarkCategory | null) => void;
  setActiveScenarioId: (category: BenchmarkCategory, scenarioId: string) => void;
  setRendered: (messages: ChatMessage[], text: string) => void;
  setIsRunning: (running: boolean) => void;
  setAbortController: (ctrl: AbortController | null) => void;
  initResult: (key: string, result: BenchmarkResult) => void;
  updateSubtask: (key: string, subtaskIdx: number, updates: Partial<BenchmarkSubtaskResult>) => void;
  appendSubtaskStream: (key: string, subtaskIdx: number, chunk: string) => void;
  finalizeResult: (key: string) => void;
  clearResults: () => void;
  setAssessment: (assessment: Partial<BenchmarkAssessment>) => void;
  updateAssessmentStream: (chunk: string) => void;
  addCustomScenario: (scenario: BenchmarkScenario) => void;
  updateCustomScenario: (id: string, scenario: BenchmarkScenario) => void;
  deleteCustomScenario: (id: string) => void;
  persist: () => void;
}

const _persisted = loadPersisted();

export const useBenchmarkStore = create<BenchmarkState>((set, get) => ({
  selectedProfileIds: _persisted.selectedProfileIds,
  activeCategory: null,
  activeScenarioIds: _persisted.activeScenarioIds,
  results: {},
  assessment: { streamedText: "", status: "idle" },
  isRunning: false,
  activeTurns: null,
  renderedMessages: null,
  renderedText: "",
  customScenarios: _persisted.customScenarios,
  abortController: null,

  setActiveTurns: (turns) => set({ activeTurns: turns }),

  setSelectedProfileIds: (ids) => {
    set({ selectedProfileIds: ids });
    get().persist();
  },

  toggleProfileId: (id) => {
    const current = get().selectedProfileIds;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    set({ selectedProfileIds: next });
    get().persist();
  },

  setActiveCategory: (cat) => set({ activeCategory: cat }),

  setActiveScenarioId: (category, scenarioId) => {
    set((s) => ({
      activeScenarioIds: { ...s.activeScenarioIds, [category]: scenarioId },
    }));
    get().persist();
  },

  setRendered: (messages, text) =>
    set({ renderedMessages: messages, renderedText: text }),

  setIsRunning: (running) => set({ isRunning: running }),

  setAbortController: (ctrl) => set({ abortController: ctrl }),

  initResult: (key, result) =>
    set((s) => ({ results: { ...s.results, [key]: result } })),

  updateSubtask: (key, subtaskIdx, updates) =>
    set((s) => {
      const prev = s.results[key];
      if (!prev) return s;
      const newSubtasks = [...prev.subtasks];
      newSubtasks[subtaskIdx] = { ...newSubtasks[subtaskIdx], ...updates };
      return {
        results: {
          ...s.results,
          [key]: { ...prev, subtasks: newSubtasks },
        },
      };
    }),

  appendSubtaskStream: (key, subtaskIdx, chunk) =>
    set((s) => {
      const prev = s.results[key];
      if (!prev) return s;
      const newSubtasks = [...prev.subtasks];
      newSubtasks[subtaskIdx] = {
        ...newSubtasks[subtaskIdx],
        streamedText: newSubtasks[subtaskIdx].streamedText + chunk,
      };
      return {
        results: {
          ...s.results,
          [key]: { ...prev, subtasks: newSubtasks },
        },
      };
    }),

  finalizeResult: (key) =>
    set((s) => {
      const prev = s.results[key];
      if (!prev) return s;
      const totalLatencyMs = prev.subtasks.reduce((sum, st) => sum + st.latencyMs, 0);
      const totalTokens = prev.subtasks.reduce((sum, st) => sum + st.totalTokens, 0);
      const hasError = prev.subtasks.some((st) => st.status === "error");
      const allDone = prev.subtasks.every((st) => st.status === "done" || st.status === "error");
      const overallStatus = hasError ? "error" : allDone ? "done" : "streaming";
      return {
        results: {
          ...s.results,
          [key]: { ...prev, totalLatencyMs, totalTokens, overallStatus },
        },
      };
    }),

  clearResults: () =>
    set({
      results: {},
      activeTurns: null,
      renderedMessages: null,
      renderedText: "",
      assessment: { streamedText: "", status: "idle" },
    }),

  setAssessment: (assessment) =>
    set((s) => ({ assessment: { ...s.assessment, ...assessment } })),

  updateAssessmentStream: (chunk) =>
    set((s) => ({
      assessment: {
        ...s.assessment,
        streamedText: s.assessment.streamedText + chunk,
      },
    })),

  addCustomScenario: (scenario) => {
    set((s) => ({ customScenarios: [...s.customScenarios, scenario] }));
    get().persist();
  },

  updateCustomScenario: (id, scenario) => {
    set((s) => ({
      customScenarios: s.customScenarios.map((sc) =>
        sc.id === id ? scenario : sc
      ),
    }));
    get().persist();
  },

  deleteCustomScenario: (id) => {
    set((s) => ({
      customScenarios: s.customScenarios.filter((sc) => sc.id !== id),
    }));
    get().persist();
  },

  persist: () => {
    if (typeof window === "undefined") return;
    const { selectedProfileIds, customScenarios, activeScenarioIds } = get();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ selectedProfileIds, customScenarios, activeScenarioIds })
      );
    } catch { /* ignore */ }
  },
}));
