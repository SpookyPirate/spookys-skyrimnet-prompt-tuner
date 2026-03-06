"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useFileStore } from "@/stores/fileStore";
import { useAppStore } from "@/stores/appStore";
import { FileTreeNode } from "./FileTreeNode";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Archive, Lock, File, RefreshCw, FolderInput, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { FileNode } from "@/types/files";
import { cn } from "@/lib/utils";
import { FileContextMenu } from "./FileContextMenu";
import { toast } from "sonner";

function SearchResultRow({ node }: { node: FileNode }) {
  const openFiles = useFileStore((s) => s.openFiles);
  const selectedPath = useFileStore((s) => s.selectedPath);
  const setSelectedPath = useFileStore((s) => s.setSelectedPath);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isSelected = selectedPath === node.path;
  const isModified = openFiles.some((f) => f.path === node.path && f.isDirty);

  const handleClick = useCallback(async () => {
    setSelectedPath(node.path);
    const store = useFileStore.getState();
    if (store.openFiles.some((f) => f.path === node.path)) {
      store.setActiveFile(node.path);
      return;
    }
    store.setLoadingFile(true);
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(node.path)}`);
      const data = await res.json();
      if (data.error) return;
      store.openFile({
        path: node.path,
        name: node.name,
        displayName: node.displayName || node.name,
        content: data.content,
        originalContent: data.content,
        isDirty: false,
        isReadOnly: data.isReadOnly,
      });
    } finally {
      store.setLoadingFile(false);
    }
  }, [node, setSelectedPath]);

  return (
    <>
      <button
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
        className={cn(
          "flex w-full flex-col rounded-sm px-2 py-1 text-left hover:bg-accent",
          isSelected && "bg-accent text-accent-foreground"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs">{node.displayName || node.name}</span>
          {isModified && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-blue-400" />}
          {node.isReadOnly && <Lock className="ml-auto h-3 w-3 shrink-0 text-yellow-500/60" />}
        </div>
        {node.promptSetName && (
          <div className="pl-5 text-[10px] text-muted-foreground truncate">{node.promptSetName}</div>
        )}
      </button>
      {contextMenu && (
        <FileContextMenu node={node} position={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </>
  );
}

export function FileExplorer() {
  const tree = useFileStore((s) => s.tree);
  const setTree = useFileStore((s) => s.setTree);
  const isLoadingTree = useFileStore((s) => s.isLoadingTree);
  const setLoadingTree = useFileStore((s) => s.setLoadingTree);
  const searchQuery = useFileStore((s) => s.searchQuery);
  const setSearchQuery = useFileStore((s) => s.setSearchQuery);

  const [searchResults, setSearchResults] = useState<FileNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ folderName: string; files: DroppedFile[] } | null>(null);
  const [importName, setImportName] = useState("");
  const dragCounter = useRef(0);

  // Fetch file tree on mount
  useEffect(() => {
    async function loadTree() {
      setLoadingTree(true);
      try {
        const res = await fetch("/api/files/tree");
        const data = await res.json();
        setTree(data.tree);
      } catch (error) {
        console.error("Failed to load file tree:", error);
      } finally {
        setLoadingTree(false);
      }
    }
    loadTree();
  }, [setTree, setLoadingTree]);

  const handleRefresh = useCallback(async () => {
    await useFileStore.getState().refreshTree();
    useAppStore.getState().bumpPromptSetList();
    toast.success("File tree refreshed");
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    // Use webkitGetAsEntry to read folder contents
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }

    if (entries.length === 0) {
      toast.error("Could not read dropped items");
      return;
    }

    const rootEntry = entries[0];
    if (!rootEntry.isDirectory) {
      toast.error("Please drop a folder, not individual files");
      return;
    }

    const folderName = rootEntry.name;

    // Read files first, then show naming dialog
    setIsImporting(true);
    try {
      const files = await readDirectoryRecursive(rootEntry as FileSystemDirectoryEntry, "");

      if (files.length === 0) {
        toast.error("No .prompt files found in the dropped folder");
        return;
      }

      // Stage the files and show the naming dialog
      setPendingImport({ folderName, files });
      setImportName(folderName);
    } catch (err) {
      toast.error(`Failed to read folder: ${(err as Error).message}`);
    } finally {
      setIsImporting(false);
    }
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImport || !importName.trim()) return;

    setIsImporting(true);
    setPendingImport(null);

    try {
      const res = await fetch("/api/files/import-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: importName.trim(),
          files: pendingImport.files.map((f) => ({ relativePath: f.relativePath, content: f.content })),
        }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Imported "${data.name}" (${data.filesImported} prompt files)`);
      await useFileStore.getState().refreshTree();
      useAppStore.getState().bumpPromptSetList();
    } catch (err) {
      toast.error(`Import failed: ${(err as Error).message}`);
    } finally {
      setIsImporting(false);
      setImportName("");
    }
  }, [pendingImport, importName]);

  // Search with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/files/search?q=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div
      className={cn("relative flex h-full flex-col", isDragOver && "ring-2 ring-inset ring-primary/50")}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <FolderInput className="h-8 w-8" />
            <span className="text-xs font-medium">Drop folder to import</span>
            <span className="text-[10px] text-muted-foreground">Only .prompt files will be kept</span>
          </div>
        </div>
      )}

      {/* Import progress overlay */}
      {isImporting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Importing prompt set...</span>
          </div>
        </div>
      )}

      <div className="flex h-8 items-center border-b px-3">
        <span className="text-xs font-medium text-muted-foreground">Explorer</span>
      </div>
      <div className="px-2 py-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 pr-7 text-xs"
          />
          {searchQuery && !isSearching && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {isSearching && (
            <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="px-1 pb-4">
          {isLoadingTree ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : searchQuery.length >= 2 ? (
            // Search results
            searchResults.length > 0 ? (
              <div className="py-1">
                {searchResults.map((node) => (
                  <SearchResultRow key={node.path} node={node} />
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No results found
              </div>
            )
          ) : (
            // Normal tree view
            tree.map((node, index) => (
              <div key={node.path}>
                {index === 0 && (
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    SkyrimNet
                  </div>
                )}
                <FileTreeNode node={node} depth={0} />
                {node.name === "Original Prompts" && (
                  <div className="px-2 pt-3 pb-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="mx-auto flex h-6 w-fit gap-1.5 px-3 text-[11px]"
                      onClick={() =>
                        useAppStore.getState().setUpdateOriginalsDialogOpen(true)
                      }
                    >
                      <Archive className="h-3 w-3" />
                      Update Prompts
                    </Button>
                    <Separator className="mt-3" />
                    <div className="mt-2 flex items-center justify-between px-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Custom Prompt Sets
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={handleRefresh}
                        title="Refresh file tree"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Import naming dialog */}
      <Dialog
        open={!!pendingImport}
        onOpenChange={(open) => {
          if (!open) {
            setPendingImport(null);
            setImportName("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Import Prompt Set</DialogTitle>
            <DialogDescription>
              Found {pendingImport?.files.length ?? 0} prompt file(s). Choose a name for this set.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="import-name">Prompt Set Name</Label>
            <Input
              id="import-name"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmImport()}
              placeholder="e.g. v2.0, custom-npcs"
            />
            <p className="text-[10px] text-muted-foreground">
              Will be saved to edited-prompts/{importName.trim().replace(/[^a-zA-Z0-9._-]/g, "_") || "..."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPendingImport(null); setImportName(""); }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} disabled={!importName.trim()}>
              <FolderInput className="h-4 w-4 mr-2" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Helpers for reading dropped folders via File System Access API ─── */

interface DroppedFile {
  relativePath: string;
  content: string;
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const allEntries: FileSystemEntry[] = [];
    function readBatch() {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(allEntries);
        } else {
          allEntries.push(...entries);
          readBatch();
        }
      }, reject);
    }
    readBatch();
  });
}

function readFileAsText(fileEntry: FileSystemFileEntry): Promise<string> {
  return new Promise((resolve, reject) => {
    fileEntry.file((file) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    }, reject);
  });
}

async function readDirectoryRecursive(
  dirEntry: FileSystemDirectoryEntry,
  prefix: string,
): Promise<DroppedFile[]> {
  const results: DroppedFile[] = [];
  const entries = await readEntries(dirEntry.createReader());

  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory) {
      const children = await readDirectoryRecursive(
        entry as FileSystemDirectoryEntry,
        relPath,
      );
      results.push(...children);
    } else if (entry.isFile) {
      // Only read .prompt files to reduce payload size
      if (entry.name.endsWith(".prompt")) {
        try {
          const content = await readFileAsText(entry as FileSystemFileEntry);
          results.push({ relativePath: relPath, content });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  return results;
}
