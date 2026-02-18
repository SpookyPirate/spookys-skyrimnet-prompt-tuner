export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  isLoaded?: boolean;
  isReadOnly?: boolean;
  displayName?: string;
}

export interface OpenFile {
  path: string;
  name: string;
  displayName: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  isReadOnly: boolean;
}

export interface PromptSet {
  id: string;
  name: string;
  basePath: string;
  isOriginal: boolean;
}

export interface CharacterInfo {
  filename: string;
  displayName: string;
  id: string;
  path: string;
}

export interface FileTreeState {
  expanded: Set<string>;
}
