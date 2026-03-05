import { create } from "zustand";
import type { ScenePreset, SceneConfig, NpcConfig, PlayerConfig } from "@/types/simulation";
import type { ActionDefinition } from "@/types/actions";

const STORAGE_KEY = "skyrimnet-scene-presets";

function buildActionStates(actions: ActionDefinition[]): Record<string, boolean> {
  return Object.fromEntries(actions.map((a) => [a.id, a.enabled]));
}

// Fixed ID so we can always identify and protect this preset
const BANNERED_MARE_PRESET_ID = "bannered-mare-default";

const BANNERED_MARE_PRESET: ScenePreset = {
  id: BANNERED_MARE_PRESET_ID,
  name: "Bannered Mare (Default)",
  createdAt: "2026-01-01",
  isDefault: true,
  scene: {
    location: "Whiterun, The Bannered Mare",
    weather: "Clear",
    timeOfDay: "Evening",
    worldPrompt: "Skyrim is caught between a civil war and the return of the dragons. NPCs have their own lives, routines, and opinions. Conversations may touch on local rumors, politics, and the dangers lurking in the wilderness.",
    scenePrompt: "The Bannered Mare is lively tonight. Patrons huddle around the central hearth swapping tales over mead. The smell of roasting meat and pine smoke fills the warm tavern as Mikael strums his lute nearby.",
  },
  npcs: [
    {
      uuid: "virtual-hulda-default",
      name: "Hulda",
      displayName: "Hulda",
      gender: "Female",
      race: "Nord",
      distance: 300,
      filePath: "",
      isVirtual: true,
    },
    {
      uuid: "virtual-saadia-default",
      name: "Saadia",
      displayName: "Saadia",
      gender: "Female",
      race: "Redguard",
      distance: 400,
      filePath: "",
      isVirtual: true,
    },
    {
      uuid: "virtual-mikael-default",
      name: "Mikael",
      displayName: "Mikael",
      gender: "Male",
      race: "Nord",
      distance: 600,
      filePath: "",
      isVirtual: true,
    },
  ],
};

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
    let presets: ScenePreset[] = [];
    let activePresetId = "";

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        presets = (data.presets || []) as ScenePreset[];
        activePresetId = data.activePresetId || "";
      }
    } catch {
      // Ignore parse errors
    }

    // Remove any stale placeholder "Default" preset (legacy empty preset)
    presets = presets.filter(
      (p) => !(p.id !== BANNERED_MARE_PRESET_ID && p.name === "Default" && !p.scene?.location && !p.scene?.scenePrompt)
    );

    // Always ensure the Bannered Mare default is at the front
    if (!presets.some((p) => p.id === BANNERED_MARE_PRESET_ID)) {
      presets = [{ ...BANNERED_MARE_PRESET }, ...presets];
      // If there were no user presets, start on the default
      if (!activePresetId) activePresetId = BANNERED_MARE_PRESET_ID;
    }

    const valid = presets.some((p) => p.id === activePresetId);
    set({
      presets,
      activePresetId: valid ? activePresetId : presets[0].id,
    });
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
    // Never delete the built-in default
    if (state.presets.find((p) => p.id === id)?.isDefault) return;
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
    // Never overwrite the built-in default preset
    if (presets[idx].isDefault) return;

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
