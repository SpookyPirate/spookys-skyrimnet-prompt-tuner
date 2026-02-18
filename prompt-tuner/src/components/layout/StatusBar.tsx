"use client";

import { useFileStore } from "@/stores/fileStore";
import { useConfigStore } from "@/stores/configStore";
import { Badge } from "@/components/ui/badge";

export function StatusBar() {
  const activeFilePath = useFileStore((s) => s.activeFilePath);
  const openFiles = useFileStore((s) => s.openFiles);
  const globalApiKey = useConfigStore((s) => s.globalApiKey);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const dirtyCount = openFiles.filter((f) => f.isDirty).length;
  const tokenEstimate = activeFile
    ? Math.ceil(activeFile.content.length / 4)
    : 0;

  return (
    <div className="flex h-6 items-center justify-between border-t bg-card px-3 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="font-medium">Prompt Tuner</span>
        <Badge
          variant={globalApiKey ? "secondary" : "outline"}
          className="text-[9px] px-1 py-0 h-4"
        >
          {globalApiKey ? "API Connected" : "No API Key"}
        </Badge>
        {activeFile && (
          <>
            <span className="text-foreground/30">|</span>
            <span className="truncate max-w-[300px]">
              {activeFile.displayName || activeFile.name}
              {activeFile.isDirty && " *"}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {dirtyCount > 0 && (
          <span>
            {dirtyCount} unsaved
          </span>
        )}
        {activeFile && (
          <>
            <span>~{tokenEstimate.toLocaleString()} tok</span>
            <span>{activeFile.content.split("\n").length} ln</span>
          </>
        )}
        {activeFile?.isReadOnly && (
          <span className="text-yellow-500 font-medium">READ ONLY</span>
        )}
        <span className="text-muted-foreground/50">Ctrl+P: Quick Open</span>
      </div>
    </div>
  );
}
