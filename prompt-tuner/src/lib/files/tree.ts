import fs from "fs/promises";
import path from "path";
import type { FileNode } from "@/types/files";
import {
  ORIGINAL_PROMPTS_DIR,
  EDITED_PROMPTS_DIR,
  parseCharacterName,
} from "./paths";

const MAX_IMMEDIATE_FILES = 100;

/**
 * Build the file tree for the entire project.
 * Returns top-level nodes: "Original Prompts", each edited prompt set, etc.
 */
export async function buildFileTree(): Promise<FileNode[]> {
  const nodes: FileNode[] = [];

  // Original Prompts
  try {
    const originalTree = await buildDirectoryTree(ORIGINAL_PROMPTS_DIR, {
      isReadOnly: true,
      lazyLoadThreshold: MAX_IMMEDIATE_FILES,
    });
    nodes.push({
      name: "Original Prompts",
      path: ORIGINAL_PROMPTS_DIR,
      type: "directory",
      children: originalTree,
      isReadOnly: true,
      isLoaded: true,
    });
  } catch {
    // Directory may not exist
  }

  // Edited Prompt Sets
  try {
    const editedEntries = await fs.readdir(EDITED_PROMPTS_DIR, {
      withFileTypes: true,
    });
    for (const entry of editedEntries) {
      if (entry.isDirectory()) {
        const setPath = path.join(EDITED_PROMPTS_DIR, entry.name);
        const setTree = await buildDirectoryTree(setPath, {
          isReadOnly: false,
          lazyLoadThreshold: MAX_IMMEDIATE_FILES,
        });
        nodes.push({
          name: entry.name,
          path: setPath,
          type: "directory",
          children: setTree,
          isReadOnly: false,
          isLoaded: true,
        });
      }
    }
  } catch {
    // Directory may not exist
  }

  return nodes;
}

interface TreeOptions {
  isReadOnly: boolean;
  lazyLoadThreshold: number;
}

async function buildDirectoryTree(
  dirPath: string,
  options: TreeOptions
): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  // Separate directories and files
  const dirs = entries.filter((e) => e.isDirectory());
  const files = entries.filter((e) => e.isFile());

  // Process directories
  for (const dir of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dirPath, dir.name);

    // Check if this is a large directory (like characters/) that should be lazy-loaded
    if (dir.name === "characters") {
      const charEntries = await fs.readdir(fullPath);
      nodes.push({
        name: "characters",
        path: fullPath,
        type: "directory",
        children: [], // Will be lazy-loaded
        isLoaded: false,
        isReadOnly: options.isReadOnly,
        displayName: `characters (${charEntries.length} files)`,
      });
    } else {
      const children = await buildDirectoryTree(fullPath, options);
      nodes.push({
        name: dir.name,
        path: fullPath,
        type: "directory",
        children,
        isLoaded: true,
        isReadOnly: options.isReadOnly,
      });
    }
  }

  // Process files
  for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dirPath, file.name);
    const node: FileNode = {
      name: file.name,
      path: fullPath,
      type: "file",
      isReadOnly: options.isReadOnly,
    };

    // Parse display name for character files
    if (
      file.name.endsWith(".prompt") &&
      dirPath.endsWith("characters")
    ) {
      const { displayName } = parseCharacterName(file.name);
      node.displayName = displayName;
    }

    nodes.push(node);
  }

  return nodes;
}

/**
 * Load children of a lazy-loaded directory (e.g., characters/)
 * Supports pagination via offset/limit.
 */
export async function loadDirectoryChildren(
  dirPath: string,
  offset: number = 0,
  limit: number = 200,
  isReadOnly: boolean = false
): Promise<{ nodes: FileNode[]; total: number }> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .sort((a, b) => a.name.localeCompare(b.name));

  const total = files.length;
  const slice = files.slice(offset, offset + limit);

  const nodes: FileNode[] = slice.map((file) => {
    const fullPath = path.join(dirPath, file.name);
    const node: FileNode = {
      name: file.name,
      path: fullPath,
      type: "file",
      isReadOnly,
    };

    if (file.name.endsWith(".prompt")) {
      const { displayName } = parseCharacterName(file.name);
      node.displayName = displayName;
    }

    return node;
  });

  return { nodes, total };
}
