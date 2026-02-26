import { create } from "zustand";
import type { NpcConfig, SceneConfig, ChatEntry } from "@/types/simulation";
import type { ActionDefinition } from "@/types/actions";
import type { LlmCallLog } from "@/types/llm";
import type { ScenePlan, GmActionEntry } from "@/types/gamemaster";
import { BUILTIN_ACTIONS, DEFAULT_CUSTOM_ACTIONS } from "@/lib/actions/registry";

const ACTIONS_STORAGE_KEY = "skyrimnet-actions";

function loadPersistedActions(): ActionDefinition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ActionDefinition[];
  } catch {}
  return [];
}

function persistActions(actions: ActionDefinition[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIONS_STORAGE_KEY, JSON.stringify(actions));
  } catch {}
}

function initActionRegistry(): ActionDefinition[] {
  const persisted = loadPersistedActions();
  if (persisted.length > 0) return persisted;
  return [...BUILTIN_ACTIONS, ...DEFAULT_CUSTOM_ACTIONS];
}

interface SimulationState {
  // NPCs
  selectedNpcs: NpcConfig[];
  // Scene
  scene: SceneConfig;
  // Chat
  chatHistory: ChatEntry[];
  isProcessing: boolean;
  // LLM call trace
  llmCallLog: LlmCallLog[];
  // Action registry (replaces demoActions)
  actionRegistry: ActionDefinition[];
  // Last action triggered
  lastAction: { name: string; params?: Record<string, string> } | null;
  // Last speaker prediction
  lastSpeakerPrediction: string;
  // Action selector preview
  lastActionSelectorPreview: {
    renderedPrompt: string;
    messages: { role: string; content: string }[];
    rawResponse: string;
    parsedAction: string;
  } | null;
  // F5: GameMaster
  gmEnabled: boolean;
  scenePlan: ScenePlan | null;
  isPlanning: boolean;
  isDirecting: boolean;
  gmAutoAdvance: boolean;
  gmContinuousMode: boolean;
  gmActionLog: GmActionEntry[];

  // NPC actions
  addNpc: (npc: NpcConfig) => void;
  removeNpc: (uuid: string) => void;
  updateNpcDistance: (uuid: string, distance: number) => void;
  // Scene
  setScene: (scene: Partial<SceneConfig>) => void;
  // Chat
  addChatEntry: (entry: ChatEntry) => void;
  clearChat: () => void;
  setProcessing: (processing: boolean) => void;
  // LLM
  addLlmCall: (log: LlmCallLog) => void;
  clearLlmLog: () => void;
  // Actions
  toggleAction: (id: string) => void;
  addCustomAction: (action: ActionDefinition) => void;
  removeCustomAction: (id: string) => void;
  updateCustomAction: (id: string, updates: Partial<Pick<ActionDefinition, "name" | "description" | "parameterSchema">>) => void;
  getEligibleActions: () => ActionDefinition[];
  setLastAction: (action: { name: string; params?: Record<string, string> } | null) => void;
  setLastSpeakerPrediction: (prediction: string) => void;
  setLastActionSelectorPreview: (preview: SimulationState["lastActionSelectorPreview"]) => void;
  // F5 GameMaster
  setGmEnabled: (enabled: boolean) => void;
  setScenePlan: (plan: ScenePlan | null) => void;
  setIsPlanning: (planning: boolean) => void;
  setIsDirecting: (directing: boolean) => void;
  setGmAutoAdvance: (auto: boolean) => void;
  setGmContinuousMode: (continuous: boolean) => void;
  addGmAction: (action: GmActionEntry) => void;
  advanceBeat: () => void;
  clearScenePlan: () => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  selectedNpcs: [],
  scene: {
    location: "Whiterun",
    weather: "Clear",
    timeOfDay: "Afternoon",
    worldPrompt: "",
    scenePrompt: "",
  },
  chatHistory: [],
  isProcessing: false,
  llmCallLog: [],
  actionRegistry: initActionRegistry(),
  lastAction: null,
  lastSpeakerPrediction: "",
  lastActionSelectorPreview: null,
  gmEnabled: false,
  scenePlan: null,
  isPlanning: false,
  isDirecting: false,
  gmAutoAdvance: true,
  gmContinuousMode: false,
  gmActionLog: [],

  addNpc: (npc) =>
    set((s) => ({
      selectedNpcs: s.selectedNpcs.some((n) => n.uuid === npc.uuid)
        ? s.selectedNpcs
        : [...s.selectedNpcs, npc],
    })),

  removeNpc: (uuid) =>
    set((s) => ({
      selectedNpcs: s.selectedNpcs.filter((n) => n.uuid !== uuid),
    })),

  updateNpcDistance: (uuid, distance) =>
    set((s) => ({
      selectedNpcs: s.selectedNpcs.map((n) =>
        n.uuid === uuid ? { ...n, distance } : n
      ),
    })),

  setScene: (scene) =>
    set((s) => ({ scene: { ...s.scene, ...scene } })),

  addChatEntry: (entry) =>
    set((s) => ({ chatHistory: [...s.chatHistory, entry] })),

  clearChat: () =>
    set({
      chatHistory: [],
      llmCallLog: [],
      lastAction: null,
      lastSpeakerPrediction: "",
      lastActionSelectorPreview: null,
      gmActionLog: [],
    }),

  setProcessing: (processing) => set({ isProcessing: processing }),

  addLlmCall: (log) =>
    set((s) => ({ llmCallLog: [...s.llmCallLog, log] })),

  clearLlmLog: () => set({ llmCallLog: [] }),

  toggleAction: (id) =>
    set((s) => {
      const updated = s.actionRegistry.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      );
      persistActions(updated);
      return { actionRegistry: updated };
    }),

  addCustomAction: (action) =>
    set((s) => {
      const updated = [...s.actionRegistry, action];
      persistActions(updated);
      return { actionRegistry: updated };
    }),

  removeCustomAction: (id) =>
    set((s) => {
      const updated = s.actionRegistry.filter((a) => a.id !== id);
      persistActions(updated);
      return { actionRegistry: updated };
    }),

  updateCustomAction: (id, updates) =>
    set((s) => {
      const updated = s.actionRegistry.map((a) =>
        a.id === id && a.category === "custom" ? { ...a, ...updates } : a
      );
      persistActions(updated);
      return { actionRegistry: updated };
    }),

  getEligibleActions: () => {
    return get().actionRegistry.filter((a) => a.enabled);
  },

  setLastAction: (action) => set({ lastAction: action }),

  setLastSpeakerPrediction: (prediction) =>
    set({ lastSpeakerPrediction: prediction }),

  setLastActionSelectorPreview: (preview) =>
    set({ lastActionSelectorPreview: preview }),

  setGmEnabled: (enabled) => set({ gmEnabled: enabled }),

  setScenePlan: (plan) => set({ scenePlan: plan }),

  setIsPlanning: (planning) => set({ isPlanning: planning }),

  setIsDirecting: (directing) => set({ isDirecting: directing }),

  setGmAutoAdvance: (auto) => set({ gmAutoAdvance: auto }),

  setGmContinuousMode: (continuous) => set({ gmContinuousMode: continuous }),

  addGmAction: (action) =>
    set((s) => ({ gmActionLog: [...s.gmActionLog, action] })),

  advanceBeat: () =>
    set((s) => {
      if (!s.scenePlan) return {};
      const next = s.scenePlan.currentBeatIndex + 1;
      if (next >= s.scenePlan.beats.length) return {};
      return {
        scenePlan: { ...s.scenePlan, currentBeatIndex: next },
      };
    }),

  clearScenePlan: () =>
    set({ scenePlan: null, gmActionLog: [], isPlanning: false, isDirecting: false }),
}));
