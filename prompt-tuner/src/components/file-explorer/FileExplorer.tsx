"use client";

import { useEffect, useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useFileStore } from "@/stores/fileStore";
import { useAppStore } from "@/stores/appStore";
import { FileTreeNode } from "./FileTreeNode";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Archive } from "lucide-react";
import type { FileNode } from "@/types/files";

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
      <ScrollArea className="flex-1">
        <div className="px-1 pb-4">
          {isLoadingTree ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : searchQuery.length >= 2 ? (
            // Search results
            searchResults.length > 0 ? (
              <div className="space-y-0.5 py-1">
                {searchResults.map((node) => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                  />
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No results found
              </div>
            )
          ) : (
            // Normal tree view
            tree.map((node) => (
              <div key={node.path}>
                <FileTreeNode node={node} depth={0} />
                {node.name === "Original Prompts" && (
                  <div className="px-2 py-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-full gap-1.5 text-[11px]"
                      onClick={() =>
                        useAppStore.getState().setUpdateOriginalsDialogOpen(true)
                      }
                    >
                      <Archive className="h-3 w-3" />
                      Update Prompts
                    </Button>
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
