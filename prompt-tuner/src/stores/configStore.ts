import { create } from "zustand";
import type {
  AgentType,
  SkyrimNetAgentType,
  ModelSlot,
  ApiSettings,
  AiTuningSettings,
} from "@/types/config";
import {
  SKYRIMNET_AGENTS,
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
  "autochat",
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
  applyProfile: (
    globalApiKey: string,
    profileSlots: Record<SkyrimNetAgentType, ModelSlot>
  ) => void;
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

  applyProfile: (globalApiKey, profileSlots) => {
    set((state) => {
      const newSlots = { ...state.slots };
      for (const agent of SKYRIMNET_AGENTS) {
        if (profileSlots[agent]) {
          newSlots[agent] = JSON.parse(JSON.stringify(profileSlots[agent]));
        }
      }
      return { globalApiKey, slots: newSlots };
    });
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

    // Sync changes to the active profile
    const { useProfileStore } = require("@/stores/profileStore");
    const profileState = useProfileStore.getState();
    if (profileState.activeProfileId) {
      profileState.updateActiveProfile(state.globalApiKey, state.slots);
    }
  },

  load: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("skyrimnet-config");
      if (raw) {
        const data = JSON.parse(raw);
        const defaults = createDefaultSlots();
        const mergedSlots = { ...defaults, ...data.slots };

        // Migrate: remove reasoning/cache from providerSettings (these were incorrectly
        // placed there in older versions — reasoning is a top-level API parameter)
        for (const agent of ALL_AGENTS) {
          const ps = mergedSlots[agent]?.api?.providerSettings;
          if (ps) {
            try {
              const parsed = JSON.parse(ps);
              let changed = false;
              if (parsed.reasoning !== undefined) {
                delete parsed.reasoning;
                changed = true;
              }
              if (parsed.cache !== undefined) {
                delete parsed.cache;
                changed = true;
              }
              if (changed) {
                const remaining = Object.keys(parsed);
                mergedSlots[agent].api.providerSettings =
                  remaining.length > 0 ? JSON.stringify(parsed) : "";
              }
            } catch {
              // Not valid JSON, leave as-is
            }
          }
        }

        set({
          globalApiKey: data.globalApiKey || "",
          slots: mergedSlots,
        });
      }
    } catch {
      // Ignore parse errors
    }
  },
}));
