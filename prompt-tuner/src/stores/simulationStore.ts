import { create } from "zustand";
import type { NpcConfig, SceneConfig, ChatEntry, DemoAction } from "@/types/simulation";
import type { LlmCallLog } from "@/types/llm";

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
  // Demo actions
  demoActions: DemoAction[];
  // Last action triggered
  lastAction: { name: string; params?: Record<string, string> } | null;
  // Last speaker prediction
  lastSpeakerPrediction: string;

  // Actions
  addNpc: (npc: NpcConfig) => void;
  removeNpc: (uuid: string) => void;
  updateNpcDistance: (uuid: string, distance: number) => void;
  setScene: (scene: Partial<SceneConfig>) => void;
  addChatEntry: (entry: ChatEntry) => void;
  clearChat: () => void;
  setProcessing: (processing: boolean) => void;
  addLlmCall: (log: LlmCallLog) => void;
  clearLlmLog: () => void;
  setDemoActions: (actions: DemoAction[]) => void;
  setLastAction: (action: { name: string; params?: Record<string, string> } | null) => void;
  setLastSpeakerPrediction: (prediction: string) => void;
}

const DEFAULT_DEMO_ACTIONS: DemoAction[] = [
  { name: "OpenTrade", description: "Opens barter menu" },
  { name: "AccompanyTarget", description: "NPC follows the player" },
  { name: "DismissTarget", description: "NPC stops following the player" },
  { name: "Gesture", description: "NPC performs an animation", parameterSchema: '{"anim": "applaud|laugh|wave|bow|shrug"}' },
];

export const useSimulationStore = create<SimulationState>((set) => ({
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
  demoActions: DEFAULT_DEMO_ACTIONS,
  lastAction: null,
  lastSpeakerPrediction: "",

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
    set({ chatHistory: [], llmCallLog: [], lastAction: null, lastSpeakerPrediction: "" }),

  setProcessing: (processing) => set({ isProcessing: processing }),

  addLlmCall: (log) =>
    set((s) => ({ llmCallLog: [...s.llmCallLog, log] })),

  clearLlmLog: () => set({ llmCallLog: [] }),

  setDemoActions: (actions) => set({ demoActions: actions }),

  setLastAction: (action) => set({ lastAction: action }),

  setLastSpeakerPrediction: (prediction) =>
    set({ lastSpeakerPrediction: prediction }),
}));
