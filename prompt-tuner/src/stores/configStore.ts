import { create } from "zustand";
import type {
  AgentType,
  ModelSlot,
  ApiSettings,
  AiTuningSettings,
} from "@/types/config";
import {
  DEFAULT_API_SETTINGS,
  DEFAULT_TUNING_SETTINGS,
  DEFAULT_MODEL_NAMES,
} from "@/types/config";

const ALL_AGENTS: AgentType[] = [
  "default",
  "game_master",
  "memory_gen",
  "profile_gen",
  "action_eval",
  "meta_eval",
  "diary",
  "tuner",
];

function createDefaultSlots(): Record<AgentType, ModelSlot> {
  const slots = {} as Record<AgentType, ModelSlot>;
  for (const agent of ALL_AGENTS) {
    slots[agent] = {
      api: {
        ...DEFAULT_API_SETTINGS,
        modelNames: DEFAULT_MODEL_NAMES[agent],
      },
      tuning: { ...DEFAULT_TUNING_SETTINGS },
    };
  }
  return slots;
}

interface ConfigState {
  globalApiKey: string;
  slots: Record<AgentType, ModelSlot>;
  settingsOpen: boolean;

  // Track model rotation index per agent
  rotationIndex: Record<AgentType, number>;

  setGlobalApiKey: (key: string) => void;
  updateSlotApi: (agent: AgentType, updates: Partial<ApiSettings>) => void;
  updateSlotTuning: (agent: AgentType, updates: Partial<AiTuningSettings>) => void;
  setSettingsOpen: (open: boolean) => void;
  getEffectiveApiKey: (agent: AgentType) => string;
  getNextModel: (agent: AgentType) => string;
  resetSlot: (agent: AgentType) => void;
  save: () => void;
  load: () => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  globalApiKey: "",
  slots: createDefaultSlots(),
  settingsOpen: false,
  rotationIndex: Object.fromEntries(ALL_AGENTS.map((a) => [a, 0])) as Record<
    AgentType,
    number
  >,

  setGlobalApiKey: (key) => {
    set({ globalApiKey: key });
    get().save();
  },

  updateSlotApi: (agent, updates) => {
    set((state) => ({
      slots: {
        ...state.slots,
        [agent]: {
          ...state.slots[agent],
          api: { ...state.slots[agent].api, ...updates },
        },
      },
    }));
    get().save();
  },

  updateSlotTuning: (agent, updates) => {
    set((state) => ({
      slots: {
        ...state.slots,
        [agent]: {
          ...state.slots[agent],
          tuning: { ...state.slots[agent].tuning, ...updates },
        },
      },
    }));
    get().save();
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  getEffectiveApiKey: (agent) => {
    const state = get();
    return state.slots[agent].api.apiKey || state.globalApiKey;
  },

  getNextModel: (agent) => {
    const state = get();
    const models = state.slots[agent].api.modelNames
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    if (models.length === 0) return "";
    const idx = state.rotationIndex[agent] % models.length;
    set((s) => ({
      rotationIndex: {
        ...s.rotationIndex,
        [agent]: idx + 1,
      },
    }));
    return models[idx];
  },

  resetSlot: (agent) => {
    set((state) => ({
      slots: {
        ...state.slots,
        [agent]: {
          api: {
            ...DEFAULT_API_SETTINGS,
            modelNames: DEFAULT_MODEL_NAMES[agent],
          },
          tuning: { ...DEFAULT_TUNING_SETTINGS },
        },
      },
    }));
    get().save();
  },

  save: () => {
    if (typeof window === "undefined") return;
    const state = get();
    localStorage.setItem(
      "skyrimnet-config",
      JSON.stringify({
        globalApiKey: state.globalApiKey,
        slots: state.slots,
      })
    );
  },

  load: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("skyrimnet-config");
      if (raw) {
        const data = JSON.parse(raw);
        set({
          globalApiKey: data.globalApiKey || "",
          slots: { ...createDefaultSlots(), ...data.slots },
        });
      }
    } catch {
      // Ignore parse errors
    }
  },
}));
