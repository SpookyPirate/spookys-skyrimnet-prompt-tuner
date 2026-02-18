"use client";

import { useFileStore } from "@/stores/fileStore";
import { X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export function EditorTabs() {
  const openFiles = useFileStore((s) => s.openFiles);
  const activeFilePath = useFileStore((s) => s.activeFilePath);
  const setActiveFile = useFileStore((s) => s.setActiveFile);
  const closeFile = useFileStore((s) => s.closeFile);

  return (
    <div className="flex h-8 items-center border-b bg-card overflow-x-auto">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        return (
          <div
            key={file.path}
            className={cn(
              "group flex h-full items-center gap-1.5 border-r px-3 text-xs cursor-pointer shrink-0",
              isActive
                ? "bg-background text-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveFile(file.path)}
          >
            {file.isDirty && (
              <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
            )}
            {file.isReadOnly && (
              <Lock className="h-3 w-3 text-yellow-500/60 shrink-0" />
            )}
            <span className="truncate max-w-[150px]">
              {file.displayName || file.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
              className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
