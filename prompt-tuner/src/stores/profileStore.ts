import { create } from "zustand";
import type {
  AgentType,
  SettingsProfile,
  SkyrimNetAgentType,
  ModelSlot,
} from "@/types/config";
import {
  SKYRIMNET_AGENTS,
  AGENT_LABELS,
  DEFAULT_API_SETTINGS,
  DEFAULT_TUNING_SETTINGS,
  DEFAULT_MODEL_NAMES,
  DEFAULT_AGENT_TUNING_OVERRIDES,
  DEFAULT_AGENT_API_OVERRIDES,
} from "@/types/config";

const STORAGE_KEY = "skyrimnet-profiles";

interface ProfileState {
  profiles: SettingsProfile[];
  activeProfileId: string;

  load: (currentGlobalApiKey: string, currentSlots: Record<AgentType, ModelSlot>) => void;
  save: () => void;
  addProfile: (
    name: string,
    globalApiKey: string,
    slots: Record<SkyrimNetAgentType, ModelSlot>
  ) => SettingsProfile;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  getProfile: (id: string) => SettingsProfile | undefined;
  setActiveProfileId: (id: string) => void;
  updateActiveProfile: (
    globalApiKey: string,
    allSlots: Record<AgentType, ModelSlot>
  ) => void;
  exportToMarkdown: (id: string) => string | null;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  activeProfileId: "",

  load: (currentGlobalApiKey, currentSlots) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const profiles: SettingsProfile[] = data.profiles || [];
        const activeProfileId: string = data.activeProfileId || "";

        if (profiles.length > 0) {
          // Hydrate: fill in any missing tuning/api fields from defaults
          // (handles profiles saved before new fields like allowReasoning were added)
          for (const profile of profiles) {
            for (const agent of SKYRIMNET_AGENTS) {
              if (profile.slots[agent]) {
                const defaultApi = {
                  ...DEFAULT_API_SETTINGS,
                  modelNames: DEFAULT_MODEL_NAMES[agent],
                  ...(DEFAULT_AGENT_API_OVERRIDES[agent] || {}),
                };
                const defaultTuning = {
                  ...DEFAULT_TUNING_SETTINGS,
                  ...(DEFAULT_AGENT_TUNING_OVERRIDES[agent] || {}),
                };
                profile.slots[agent] = {
                  api: { ...defaultApi, ...profile.slots[agent].api },
                  tuning: { ...defaultTuning, ...profile.slots[agent].tuning },
                };
              }
            }
          }

          // Ensure activeProfileId points to a valid profile
          const valid = profiles.some((p) => p.id === activeProfileId);
          set({
            profiles,
            activeProfileId: valid ? activeProfileId : profiles[0].id,
          });
          return;
        }
      }
    } catch {
      // Ignore parse errors, fall through to create default
    }

    // No saved profiles — create a "Default" profile from current config
    const defaultProfile: SettingsProfile = {
      id: crypto.randomUUID(),
      name: "Default",
      createdAt: new Date().toISOString().split("T")[0],
      globalApiKey: currentGlobalApiKey,
      slots: Object.fromEntries(
        SKYRIMNET_AGENTS.map((agent) => [
          agent,
          JSON.parse(JSON.stringify(currentSlots[agent])),
        ])
      ) as Record<SkyrimNetAgentType, ModelSlot>,
    };
    set({ profiles: [defaultProfile], activeProfileId: defaultProfile.id });
    get().save();
  },

  save: () => {
    if (typeof window === "undefined") return;
    const { profiles, activeProfileId } = get();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profiles, activeProfileId })
    );
  },

  addProfile: (name, globalApiKey, slots) => {
    const profile: SettingsProfile = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString().split("T")[0],
      globalApiKey,
      slots: Object.fromEntries(
        SKYRIMNET_AGENTS.map((agent) => [
          agent,
          JSON.parse(JSON.stringify(slots[agent])),
        ])
      ) as Record<SkyrimNetAgentType, ModelSlot>,
    };
    set((state) => ({
      profiles: [...state.profiles, profile],
    }));
    get().save();
    return profile;
  },

  renameProfile: (id, name) => {
    const { profiles } = get();
    const idx = profiles.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const updated = [...profiles];
    updated[idx] = { ...updated[idx], name };
    set({ profiles: updated });
    get().save();
  },

  deleteProfile: (id) => {
    const state = get();
    const remaining = state.profiles.filter((p) => p.id !== id);
    if (remaining.length === 0) return; // Never delete the last profile
    const newActiveId =
      state.activeProfileId === id ? remaining[0].id : state.activeProfileId;
    set({ profiles: remaining, activeProfileId: newActiveId });
    get().save();
  },

  getProfile: (id) => {
    return get().profiles.find((p) => p.id === id);
  },

  setActiveProfileId: (id) => {
    set({ activeProfileId: id });
    get().save();
  },

  updateActiveProfile: (globalApiKey, allSlots) => {
    const { activeProfileId, profiles } = get();
    if (!activeProfileId) return;
    const idx = profiles.findIndex((p) => p.id === activeProfileId);
    if (idx === -1) return;

    const updated = [...profiles];
    updated[idx] = {
      ...updated[idx],
      globalApiKey,
      slots: Object.fromEntries(
        SKYRIMNET_AGENTS.map((agent) => [
          agent,
          JSON.parse(JSON.stringify(allSlots[agent])),
        ])
      ) as Record<SkyrimNetAgentType, ModelSlot>,
    };
    set({ profiles: updated });
    get().save();
  },

  exportToMarkdown: (id) => {
    const profile = get().getProfile(id);
    if (!profile) return null;

    const lines: string[] = [
      `# SkyrimNet Settings Profile: ${profile.name}`,
      `Created: ${profile.createdAt}`,
      "",
    ];

    for (const agent of SKYRIMNET_AGENTS) {
      const slot = profile.slots[agent];
      if (!slot) continue;

      lines.push(`## ${AGENT_LABELS[agent]}`);

      // API Settings (exclude apiKey)
      lines.push("### API Settings");
      lines.push("```toml");
      lines.push(`modelNames       = "${slot.api.modelNames}"`);
      lines.push(`apiEndpoint      = "${slot.api.apiEndpoint}"`);
      lines.push(`maxContextLength = ${slot.api.maxContextLength}`);
      lines.push(`requestTimeout   = ${slot.api.requestTimeout}`);
      lines.push(`connectTimeout   = ${slot.api.connectTimeout}`);
      lines.push(`useSSE           = ${slot.api.useSSE}`);
      lines.push(`providerSettings = "${slot.api.providerSettings}"`);
      lines.push(`providerSorting  = "${slot.api.providerSorting}"`);
      lines.push(`maxRetries       = ${slot.api.maxRetries}`);
      lines.push("```");
      lines.push("");

      // AI Tuning
      lines.push("### AI Tuning");
      lines.push("```toml");
      lines.push(`temperature      = ${slot.tuning.temperature.toFixed(2)}`);
      lines.push(`maxTokens        = ${slot.tuning.maxTokens}`);
      lines.push(`topP             = ${slot.tuning.topP.toFixed(2)}`);
      lines.push(`topK             = ${slot.tuning.topK}`);
      lines.push(
        `frequencyPenalty = ${slot.tuning.frequencyPenalty.toFixed(2)}`
      );
      lines.push(
        `presencePenalty  = ${slot.tuning.presencePenalty.toFixed(2)}`
      );
      lines.push(`stopSequences    = "${slot.tuning.stopSequences}"`);
      lines.push(`structuredOutputs = ${slot.tuning.structuredOutputs}`);
      lines.push(`allowReasoning   = ${slot.tuning.allowReasoning}`);
      lines.push(`reasoningEffort  = "${slot.tuning.reasoningEffort}"`);
      lines.push("```");
      lines.push("");
    }

    return lines.join("\n");
  },
}));
