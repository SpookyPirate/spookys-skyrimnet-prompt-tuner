"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/appStore";
import { useFileStore } from "@/stores/fileStore";
import { FolderOpen, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface LoadPromptSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoadPromptSetDialog({
  open,
  onOpenChange,
}: LoadPromptSetDialogProps) {
  const [sets, setSets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const activePromptSet = useAppStore((s) => s.activePromptSet);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/export/list-sets")
      .then((res) => res.json())
      .then((data) => setSets(data.sets ?? []))
      .catch(() => toast.error("Failed to load prompt sets"))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSelect = async (name: string) => {
    if (name === activePromptSet) {
      onOpenChange(false);
      return;
    }

    setSwitching(name);
    try {
      useAppStore.getState().setActivePromptSet(name);
      useFileStore.getState().closeAllFiles();

      // Refresh file tree
      await useFileStore.getState().refreshTree();

      toast.success(`Prompt set "${name}" loaded`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to switch prompt set");
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Load Prompt Set</DialogTitle>
          <DialogDescription>
            Choose a prompt set to work with. Open tabs will be closed.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sets.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No prompt sets found in edited-prompts/
          </div>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="space-y-0.5">
              {sets.map((name) => {
                const isActive = name === activePromptSet;
                const isSwitching = name === switching;
                return (
                  <button
                    key={name}
                    onClick={() => handleSelect(name)}
                    disabled={isSwitching}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    {isSwitching ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : isActive ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={isActive ? "font-medium" : ""}>
                      {name}
                    </span>
                    {isActive && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
