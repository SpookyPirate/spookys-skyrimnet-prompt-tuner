import { create } from "zustand";

const STORAGE_KEY = "skyrimnet-app";
const DEFAULT_PROMPT_SET = "v1.0";

type AppTab = "editor" | "tuner" | "preview" | "benchmark" | "autotuner";

function loadPersistedState(): { activePromptSet: string; activeTab: AppTab } {
  if (typeof window === "undefined") return { activePromptSet: DEFAULT_PROMPT_SET, activeTab: "editor" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const tab = parsed.activeTab;
      return {
        activePromptSet: parsed.activePromptSet ?? DEFAULT_PROMPT_SET,
        activeTab: tab === "editor" || tab === "tuner" || tab === "preview" || tab === "benchmark" || tab === "autotuner" ? tab : "editor",
      };
    }
  } catch {}
  return { activePromptSet: DEFAULT_PROMPT_SET, activeTab: "editor" };
}

function persistState(state: { activePromptSet: string; activeTab: string }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activePromptSet: state.activePromptSet, activeTab: state.activeTab }));
  } catch {}
}

interface AppState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  activeTab: AppTab;
  exportDialogOpen: boolean;
  saveSetDialogOpen: boolean;
  loadPromptSetDialogOpen: boolean;
  enhanceSpeechDialogOpen: boolean;
  updateOriginalsDialogOpen: boolean;
  activePromptSet: string;
  createYamlDialogOpen: boolean;
  createYamlType: "action" | "trigger";

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setActiveTab: (tab: AppTab) => void;
  setExportDialogOpen: (open: boolean) => void;
  setSaveSetDialogOpen: (open: boolean) => void;
  setLoadPromptSetDialogOpen: (open: boolean) => void;
  setEnhanceSpeechDialogOpen: (open: boolean) => void;
  setUpdateOriginalsDialogOpen: (open: boolean) => void;
  setActivePromptSet: (name: string) => void;
  setCreateYamlDialogOpen: (open: boolean, type?: "action" | "trigger") => void;
}

const _persisted = loadPersistedState();

export const useAppStore = create<AppState>((set, get) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  activeTab: _persisted.activeTab,
  exportDialogOpen: false,
  saveSetDialogOpen: false,
  loadPromptSetDialogOpen: false,
  enhanceSpeechDialogOpen: false,
  updateOriginalsDialogOpen: false,
  activePromptSet: _persisted.activePromptSet,
  createYamlDialogOpen: false,
  createYamlType: "action" as const,

  toggleLeftPanel: () =>
    set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setActiveTab: (tab) => {
    set({ activeTab: tab });
    persistState({ activePromptSet: get().activePromptSet, activeTab: tab });
  },
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
  setSaveSetDialogOpen: (open) => set({ saveSetDialogOpen: open }),
  setLoadPromptSetDialogOpen: (open) => set({ loadPromptSetDialogOpen: open }),
  setEnhanceSpeechDialogOpen: (open) => set({ enhanceSpeechDialogOpen: open }),
  setUpdateOriginalsDialogOpen: (open) => set({ updateOriginalsDialogOpen: open }),
  setActivePromptSet: (name) => {
    set({ activePromptSet: name });
    persistState({ activePromptSet: name, activeTab: get().activeTab });
  },
  setCreateYamlDialogOpen: (open, type) =>
    set({ createYamlDialogOpen: open, ...(type ? { createYamlType: type } : {}) }),
}));
