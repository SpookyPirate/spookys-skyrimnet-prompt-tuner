"use client";

import { useEffect, useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useFileStore } from "@/stores/fileStore";
import { useAppStore } from "@/stores/appStore";
import { FileTreeNode } from "./FileTreeNode";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Archive, Lock, File } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { FileNode } from "@/types/files";
import { cn } from "@/lib/utils";
import { FileContextMenu } from "./FileContextMenu";

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
    <div className="flex h-full flex-col">
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
            className="h-7 pl-7 text-xs"
          />
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
                    <div className="mt-2 px-1 text-xs font-medium text-muted-foreground">
                      Custom Prompt Sets
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
