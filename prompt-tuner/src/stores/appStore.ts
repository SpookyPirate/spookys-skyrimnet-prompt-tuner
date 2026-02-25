import { create } from "zustand";

const STORAGE_KEY = "skyrimnet-app";
const DEFAULT_PROMPT_SET = "v1.0";

function loadPersistedState(): { activePromptSet: string } {
  if (typeof window === "undefined") return { activePromptSet: DEFAULT_PROMPT_SET };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { activePromptSet: parsed.activePromptSet ?? DEFAULT_PROMPT_SET };
    }
  } catch {}
  return { activePromptSet: DEFAULT_PROMPT_SET };
}

function persistState(state: { activePromptSet: string }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activePromptSet: state.activePromptSet }));
  } catch {}
}

interface AppState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  activeTab: "editor" | "tuner" | "preview";
  exportDialogOpen: boolean;
  saveSetDialogOpen: boolean;
  loadPromptSetDialogOpen: boolean;
  enhanceSpeechDialogOpen: boolean;
  updateOriginalsDialogOpen: boolean;
  activePromptSet: string;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setActiveTab: (tab: "editor" | "tuner" | "preview") => void;
  setExportDialogOpen: (open: boolean) => void;
  setSaveSetDialogOpen: (open: boolean) => void;
  setLoadPromptSetDialogOpen: (open: boolean) => void;
  setEnhanceSpeechDialogOpen: (open: boolean) => void;
  setUpdateOriginalsDialogOpen: (open: boolean) => void;
  setActivePromptSet: (name: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  activeTab: "editor",
  exportDialogOpen: false,
  saveSetDialogOpen: false,
  loadPromptSetDialogOpen: false,
  enhanceSpeechDialogOpen: false,
  updateOriginalsDialogOpen: false,
  activePromptSet: loadPersistedState().activePromptSet,

  toggleLeftPanel: () =>
    set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
  setSaveSetDialogOpen: (open) => set({ saveSetDialogOpen: open }),
  setLoadPromptSetDialogOpen: (open) => set({ loadPromptSetDialogOpen: open }),
  setEnhanceSpeechDialogOpen: (open) => set({ enhanceSpeechDialogOpen: open }),
  setUpdateOriginalsDialogOpen: (open) => set({ updateOriginalsDialogOpen: open }),
  setActivePromptSet: (name) => {
    persistState({ activePromptSet: name });
    set({ activePromptSet: name });
  },
}));
