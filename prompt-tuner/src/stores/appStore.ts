import { create } from "zustand";

interface AppState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  activeTab: "editor" | "tuner" | "preview";
  exportDialogOpen: boolean;
  saveSetDialogOpen: boolean;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setActiveTab: (tab: "editor" | "tuner" | "preview") => void;
  setExportDialogOpen: (open: boolean) => void;
  setSaveSetDialogOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  activeTab: "editor",
  exportDialogOpen: false,
  saveSetDialogOpen: false,

  toggleLeftPanel: () =>
    set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
  setSaveSetDialogOpen: (open) => set({ saveSetDialogOpen: open }),
}));
