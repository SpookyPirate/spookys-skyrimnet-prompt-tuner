"use client";

import { useState } from "react";
import { useFileStore } from "@/stores/fileStore";
import { X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export function EditorTabs() {
  const openFiles = useFileStore((s) => s.openFiles);
  const activeFilePath = useFileStore((s) => s.activeFilePath);
  const setActiveFile = useFileStore((s) => s.setActiveFile);
  const closeFile = useFileStore((s) => s.closeFile);
  const markFileSaved = useFileStore((s) => s.markFileSaved);

  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  const handleClose = (path: string) => {
    const file = useFileStore.getState().openFiles.find((f) => f.path === path);
    if (file?.isDirty && !file.isReadOnly) {
      setConfirmClose(path);
    } else {
      closeFile(path);
    }
  };

  const handleSaveAndClose = async (path: string) => {
    const file = useFileStore.getState().openFiles.find((f) => f.path === path);
    if (!file) return;
    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: file.path, content: file.content }),
      });
      if (res.ok) {
        markFileSaved(file.path);
        useFileStore.getState().refreshTree();
      } else {
        const data = await res.json();
        toast.error(`Save failed: ${data.error}`);
        return;
      }
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
      return;
    }
    closeFile(path);
    setConfirmClose(null);
  };

  const handleDiscardAndClose = (path: string) => {
    closeFile(path);
    setConfirmClose(null);
  };

  return (
    <>
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
                  handleClose(file.path);
                }}
                className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Unsaved changes confirmation */}
      {confirmClose && (() => {
        const file = openFiles.find((f) => f.path === confirmClose);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setConfirmClose(null)}
          >
            <div
              className="mx-4 w-full max-w-sm rounded-lg border bg-card shadow-lg p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm font-semibold">Unsaved Changes</div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{file?.displayName || file?.name}</span> has unsaved changes. Save before closing?
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmClose(null)}
                  className="rounded border px-3 py-1 text-xs hover:bg-accent/50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDiscardAndClose(confirmClose)}
                  className="rounded border border-destructive/50 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Discard
                </button>
                <button
                  onClick={() => handleSaveAndClose(confirmClose)}
                  className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
