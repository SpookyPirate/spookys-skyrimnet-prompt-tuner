import { create } from "zustand";
import type { ScenePreset, SceneConfig, NpcConfig, PlayerConfig } from "@/types/simulation";
import type { ActionDefinition } from "@/types/actions";

const STORAGE_KEY = "skyrimnet-scene-presets";

function buildActionStates(actions: ActionDefinition[]): Record<string, boolean> {
  return Object.fromEntries(actions.map((a) => [a.id, a.enabled]));
}

interface ScenePresetState {
  presets: ScenePreset[];
  activePresetId: string;

  load: () => void;
  save: () => void;
  addPreset: (name: string, scene: SceneConfig, npcs: NpcConfig[], actions: ActionDefinition[], player?: PlayerConfig) => ScenePreset;
  deletePreset: (id: string) => void;
  getPreset: (id: string) => ScenePreset | undefined;
  setActivePresetId: (id: string) => void;
  updateActivePreset: (scene: SceneConfig, npcs: NpcConfig[], actions: ActionDefinition[], player?: PlayerConfig) => void;
}

export const useScenePresetStore = create<ScenePresetState>((set, get) => ({
  presets: [],
  activePresetId: "",

  load: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const presets: ScenePreset[] = data.presets || [];
        const activePresetId: string = data.activePresetId || "";

        if (presets.length > 0) {
          const valid = presets.some((p) => p.id === activePresetId);
          set({
            presets,
            activePresetId: valid ? activePresetId : presets[0].id,
          });
          return;
        }
      }
    } catch {
      // Ignore parse errors
    }

    // No saved presets — create a default
    const defaultPreset: ScenePreset = {
      id: crypto.randomUUID(),
      name: "Default",
      createdAt: new Date().toISOString().split("T")[0],
      scene: {
        location: "Whiterun",
        weather: "Clear",
        timeOfDay: "Afternoon",
        worldPrompt: "",
        scenePrompt: "",
      },
      npcs: [],
    };
    set({ presets: [defaultPreset], activePresetId: defaultPreset.id });
    get().save();
  },

  save: () => {
    if (typeof window === "undefined") return;
    const { presets, activePresetId } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ presets, activePresetId }));
  },

  addPreset: (name, scene, npcs, actions, player) => {
    const preset: ScenePreset = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString().split("T")[0],
      scene: JSON.parse(JSON.stringify(scene)),
      npcs: JSON.parse(JSON.stringify(npcs)),
      actionStates: buildActionStates(actions),
      player: player ? JSON.parse(JSON.stringify(player)) : undefined,
    };
    set((state) => ({
      presets: [...state.presets, preset],
      activePresetId: preset.id,
    }));
    get().save();
    return preset;
  },

  deletePreset: (id) => {
    const state = get();
    const remaining = state.presets.filter((p) => p.id !== id);
    if (remaining.length === 0) return;
    const newActiveId =
      state.activePresetId === id ? remaining[0].id : state.activePresetId;
    set({ presets: remaining, activePresetId: newActiveId });
    get().save();
  },

  getPreset: (id) => {
    return get().presets.find((p) => p.id === id);
  },

  setActivePresetId: (id) => {
    set({ activePresetId: id });
    get().save();
  },

  updateActivePreset: (scene, npcs, actions, player) => {
    const { activePresetId, presets } = get();
    if (!activePresetId) return;
    const idx = presets.findIndex((p) => p.id === activePresetId);
    if (idx === -1) return;

    const updated = [...presets];
    updated[idx] = {
      ...updated[idx],
      scene: JSON.parse(JSON.stringify(scene)),
      npcs: JSON.parse(JSON.stringify(npcs)),
      actionStates: buildActionStates(actions),
      player: player ? JSON.parse(JSON.stringify(player)) : undefined,
    };
    set({ presets: updated });
    get().save();
  },
}));
