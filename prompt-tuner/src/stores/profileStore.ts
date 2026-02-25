import { create } from "zustand";
import type {
  SettingsProfile,
  SkyrimNetAgentType,
  ModelSlot,
} from "@/types/config";
import { SKYRIMNET_AGENTS, AGENT_LABELS } from "@/types/config";

const STORAGE_KEY = "skyrimnet-profiles";

interface ProfileState {
  profiles: SettingsProfile[];

  load: () => void;
  save: () => void;
  addProfile: (
    name: string,
    globalApiKey: string,
    slots: Record<SkyrimNetAgentType, ModelSlot>
  ) => SettingsProfile;
  deleteProfile: (id: string) => void;
  getProfile: (id: string) => SettingsProfile | undefined;
  exportToMarkdown: (id: string) => string | null;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],

  load: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ profiles: JSON.parse(raw) });
      }
    } catch {
      // Ignore parse errors
    }
  },

  save: () => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(get().profiles));
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
    set((state) => ({ profiles: [...state.profiles, profile] }));
    get().save();
    return profile;
  },

  deleteProfile: (id) => {
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
    }));
    get().save();
  },

  getProfile: (id) => {
    return get().profiles.find((p) => p.id === id);
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
      lines.push(`eventHistoryCount = ${slot.tuning.eventHistoryCount}`);
      lines.push("```");
      lines.push("");
    }

    return lines.join("\n");
  },
}));
