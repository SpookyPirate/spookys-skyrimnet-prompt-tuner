"use client";

import { useState, useCallback } from "react";
import { useFileStore } from "@/stores/fileStore";
import type { FileNode } from "@/types/files";
import {
  ChevronRight,
  ChevronDown,
  File,
  FolderOpen,
  Folder,
  Users,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
}

export function FileTreeNode({ node, depth }: FileTreeNodeProps) {
  const expandedPaths = useFileStore((s) => s.expandedPaths);
  const toggleExpanded = useFileStore((s) => s.toggleExpanded);
  const selectedPath = useFileStore((s) => s.selectedPath);
  const setSelectedPath = useFileStore((s) => s.setSelectedPath);
  const openFiles = useFileStore((s) => s.openFiles);

  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const isModified = openFiles.some((f) => f.path === node.path && f.isDirty);

  const [lazyChildren, setLazyChildren] = useState<FileNode[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [lazyTotal, setLazyTotal] = useState(0);

  const handleClick = useCallback(async () => {
    if (node.type === "directory") {
      toggleExpanded(node.path);

      // Lazy load children if not already loaded
      if (!node.isLoaded && !isExpanded && lazyChildren.length === 0) {
        setIsLoadingChildren(true);
        try {
          const res = await fetch(
            `/api/files/children?path=${encodeURIComponent(node.path)}&limit=200`
          );
          const data = await res.json();
          setLazyChildren(data.nodes);
          setLazyTotal(data.total);
        } catch (error) {
          console.error("Failed to load children:", error);
        } finally {
          setIsLoadingChildren(false);
        }
      }
    } else {
      setSelectedPath(node.path);
      handleOpenFile(node);
    }
  }, [node, isExpanded, lazyChildren.length, toggleExpanded, setSelectedPath]);

  const handleOpenFile = useCallback(
    async (fileNode: FileNode) => {
      const store = useFileStore.getState();

      // Already open? Just switch to it
      if (store.openFiles.some((f) => f.path === fileNode.path)) {
        store.setActiveFile(fileNode.path);
        return;
      }

      store.setLoadingFile(true);
      try {
        const res = await fetch(
          `/api/files/read?path=${encodeURIComponent(fileNode.path)}`
        );
        const data = await res.json();
        if (data.error) {
          console.error(data.error);
          return;
        }
        store.openFile({
          path: fileNode.path,
          name: fileNode.name,
          displayName: fileNode.displayName || fileNode.name,
          content: data.content,
          originalContent: data.content,
          isDirty: false,
          isReadOnly: data.isReadOnly,
        });
      } catch (error) {
        console.error("Failed to open file:", error);
      } finally {
        store.setLoadingFile(false);
      }
    },
    []
  );

  const loadMore = useCallback(async () => {
    setIsLoadingChildren(true);
    try {
      const res = await fetch(
        `/api/files/children?path=${encodeURIComponent(node.path)}&offset=${lazyChildren.length}&limit=200`
      );
      const data = await res.json();
      setLazyChildren((prev) => [...prev, ...data.nodes]);
      setLazyTotal(data.total);
    } catch (error) {
      console.error("Failed to load more children:", error);
    } finally {
      setIsLoadingChildren(false);
    }
  }, [node.path, lazyChildren.length]);

  const displayLabel = node.displayName || node.name;
  const children = node.isLoaded ? node.children : lazyChildren;
  const isCharactersDir = node.name === "characters" && node.type === "directory";

  const icon =
    node.type === "directory" ? (
      isCharactersDir ? (
        <Users className="h-4 w-4 shrink-0 text-amber-500" />
      ) : isExpanded ? (
        <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" />
      ) : (
        <Folder className="h-4 w-4 shrink-0 text-blue-400" />
      )
    ) : (
      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
    );

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-accent",
          isSelected && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {node.type === "directory" && (
          <span className="shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        )}
        {node.type === "file" && <span className="w-3.5 shrink-0" />}
        {icon}
        <span className="truncate">{displayLabel}</span>
        {isModified && (
          <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-blue-400" />
        )}
        {node.isReadOnly && node.type === "file" && (
          <Lock className="ml-auto h-3 w-3 shrink-0 text-yellow-500/60" />
        )}
      </button>

      {isExpanded && node.type === "directory" && (
        <div>
          {isLoadingChildren && !children?.length && (
            <div
              className="py-1 text-xs text-muted-foreground"
              style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
            >
              Loading...
            </div>
          )}
          {children?.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
          {!node.isLoaded && lazyTotal > lazyChildren.length && (
            <button
              onClick={loadMore}
              disabled={isLoadingChildren}
              className="w-full py-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
              style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
            >
              {isLoadingChildren
                ? "Loading..."
                : `Load more (${lazyChildren.length} of ${lazyTotal})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
