import { create } from "zustand";
import type { FileNode, OpenFile, PromptSet } from "@/types/files";

interface FileState {
  // File tree
  tree: FileNode[];
  expandedPaths: Set<string>;
  selectedPath: string | null;

  // Open files (tabs)
  openFiles: OpenFile[];
  activeFilePath: string | null;

  // Prompt sets
  promptSets: PromptSet[];
  activePromptSetId: string | null;

  // Search
  searchQuery: string;
  searchResults: FileNode[];

  // Loading
  isLoadingTree: boolean;
  isLoadingFile: boolean;

  // Actions
  setTree: (tree: FileNode[]) => void;
  toggleExpanded: (path: string) => void;
  setSelectedPath: (path: string | null) => void;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  markFileSaved: (path: string) => void;
  setPromptSets: (sets: PromptSet[]) => void;
  setActivePromptSet: (id: string) => void;
  closeAllFiles: () => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: FileNode[]) => void;
  setLoadingTree: (loading: boolean) => void;
  setLoadingFile: (loading: boolean) => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  tree: [],
  expandedPaths: new Set<string>(),
  selectedPath: null,
  openFiles: [],
  activeFilePath: null,
  promptSets: [],
  activePromptSetId: null,
  searchQuery: "",
  searchResults: [],
  isLoadingTree: false,
  isLoadingFile: false,

  setTree: (tree) => set({ tree }),

  toggleExpanded: (path) =>
    set((state) => {
      const next = new Set(state.expandedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { expandedPaths: next };
    }),

  setSelectedPath: (path) => set({ selectedPath: path }),

  openFile: (file) =>
    set((state) => {
      const existing = state.openFiles.find((f) => f.path === file.path);
      if (existing) {
        return { activeFilePath: file.path };
      }
      return {
        openFiles: [...state.openFiles, file],
        activeFilePath: file.path,
      };
    }),

  closeFile: (path) =>
    set((state) => {
      const filtered = state.openFiles.filter((f) => f.path !== path);
      let nextActive = state.activeFilePath;
      if (state.activeFilePath === path) {
        const idx = state.openFiles.findIndex((f) => f.path === path);
        nextActive =
          filtered.length > 0
            ? filtered[Math.min(idx, filtered.length - 1)].path
            : null;
      }
      return { openFiles: filtered, activeFilePath: nextActive };
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent: (path, content) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path
          ? { ...f, content, isDirty: content !== f.originalContent }
          : f
      ),
    })),

  markFileSaved: (path) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path
          ? { ...f, originalContent: f.content, isDirty: false }
          : f
      ),
    })),

  setPromptSets: (sets) => set({ promptSets: sets }),
  setActivePromptSet: (id) => set({ activePromptSetId: id }),
  closeAllFiles: () => set({ openFiles: [], activeFilePath: null }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setLoadingTree: (loading) => set({ isLoadingTree: loading }),
  setLoadingFile: (loading) => set({ isLoadingFile: loading }),
}));
