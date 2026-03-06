import { create } from "zustand";

const STORAGE_KEY = "skyrimnet-save-bios";

/**
 * Per-save config: whether its character bios are enabled,
 * and optional per-character priority numbers.
 * Key format: "{promptSetName}::{saveId}"
 */
export interface SaveConfig {
  enabled: boolean;
  /** Per-character priority. Key is filename (e.g. "serana_B74.prompt"). Higher = wins. */
  priorities: Record<string, number>;
}

interface SaveBioState {
  /** Map from "{promptSetName}::{saveId}" → SaveConfig */
  saves: Record<string, SaveConfig>;

  toggleSave: (promptSet: string, saveId: string) => void;
  setPriority: (promptSet: string, saveId: string, filename: string, priority: number | null) => void;
  getSaveConfig: (promptSet: string, saveId: string) => SaveConfig | undefined;
  getEnabledSaves: (promptSet: string) => { saveId: string; config: SaveConfig }[];
}

function loadPersisted(): Record<string, SaveConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function persist(saves: Record<string, SaveConfig>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  } catch {}
}

function makeKey(promptSet: string, saveId: string) {
  return `${promptSet}::${saveId}`;
}

export const useSaveBioStore = create<SaveBioState>((set, get) => ({
  saves: loadPersisted(),

  toggleSave: (promptSet, saveId) => {
    const key = makeKey(promptSet, saveId);
    const current = get().saves[key];
    const next = {
      ...get().saves,
      [key]: {
        enabled: current ? !current.enabled : true,
        priorities: current?.priorities ?? {},
      },
    };
    set({ saves: next });
    persist(next);
  },

  setPriority: (promptSet, saveId, filename, priority) => {
    const key = makeKey(promptSet, saveId);
    const current = get().saves[key] ?? { enabled: false, priorities: {} };
    const newPriorities = { ...current.priorities };
    if (priority === null) {
      delete newPriorities[filename];
    } else {
      newPriorities[filename] = priority;
    }
    const next = {
      ...get().saves,
      [key]: { ...current, priorities: newPriorities },
    };
    set({ saves: next });
    persist(next);
  },

  getSaveConfig: (promptSet, saveId) => {
    return get().saves[makeKey(promptSet, saveId)];
  },

  getEnabledSaves: (promptSet) => {
    const prefix = `${promptSet}::`;
    const results: { saveId: string; config: SaveConfig }[] = [];
    for (const [key, config] of Object.entries(get().saves)) {
      if (key.startsWith(prefix) && config.enabled) {
        results.push({ saveId: key.slice(prefix.length), config });
      }
    }
    return results;
  },
}));
