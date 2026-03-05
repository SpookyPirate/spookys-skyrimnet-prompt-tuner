"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Loader2, CheckCircle2, FileText } from "lucide-react";

interface FilePair {
  relativePath: string;
  tempPath: string;
  targetPath: string;
  newContent: string;
  oldContent: string;
}

interface PromptReviewDialogProps {
  open: boolean;
  onClose: () => void;
  targetSetName: string;
  tempFilePaths: string[];
  onSaved: () => void;
}

export function PromptReviewDialog({
  open,
  onClose,
  targetSetName,
  tempFilePaths,
  onSaved,
}: PromptReviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pairs, setPairs] = useState<FilePair[]>([]);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || tempFilePaths.length === 0) return;

    setLoading(true);
    setSaved(false);
    setError(null);
    setPairs([]);
    setSelectedIdx(0);

    fetch("/api/export/get-file-pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempAbsPaths: tempFilePaths, targetSetName }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const loadedPairs: FilePair[] = data.pairs ?? [];
        setPairs(loadedPairs);
        const initial: Record<string, string> = {};
        for (const p of loadedPairs) {
          initial[p.relativePath] = p.newContent;
        }
        setEditedContent(initial);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, tempFilePaths, targetSetName]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      for (const pair of pairs) {
        const content = editedContent[pair.relativePath] ?? pair.newContent;
        const resp = await fetch("/api/files/write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: pair.targetPath, content }),
        });
        if (!resp.ok) {
          const d = await resp.json();
          throw new Error(d.error || `Failed to write ${pair.relativePath}`);
        }
      }
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [pairs, editedContent, onSaved]);

  const currentPair = pairs[selectedIdx];
  const displayName = (relativePath: string) =>
    relativePath.split(/[/\\]/).pop() ?? relativePath;
  const displayParent = (relativePath: string) => {
    const parts = relativePath.split(/[/\\]/);
    return parts.length > 1 ? parts[parts.length - 2] : "";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b shrink-0">
          <DialogTitle className="text-sm">
            Review Prompt Changes — saving to &quot;{targetSetName}&quot;
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {pairs.length} file{pairs.length !== 1 ? "s" : ""} will be written. Edit the new content on the right before saving.
          </p>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pairs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No modified prompt files found.
            </div>
          ) : (
            <>
              {/* File list sidebar */}
              <div className="w-52 shrink-0 border-r flex flex-col">
                <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b shrink-0">
                  Modified Files
                </div>
                <ScrollArea className="flex-1">
                  {pairs.map((pair, idx) => (
                    <button
                      key={pair.relativePath}
                      onClick={() => setSelectedIdx(idx)}
                      className={`w-full text-left px-2 py-1.5 hover:bg-accent/50 transition-colors border-b border-border/30 ${
                        idx === selectedIdx
                          ? "bg-accent text-accent-foreground"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="text-xs truncate font-mono">
                          {displayName(pair.relativePath)}
                        </span>
                      </div>
                      {displayParent(pair.relativePath) && (
                        <div className="text-[9px] text-muted-foreground truncate pl-4">
                          {displayParent(pair.relativePath)}
                        </div>
                      )}
                      {!pair.oldContent && (
                        <div className="text-[9px] text-blue-400 pl-4">new file</div>
                      )}
                    </button>
                  ))}
                </ScrollArea>
              </div>

              {/* Split diff view */}
              {currentPair && (
                <div className="flex flex-1 min-w-0 overflow-hidden">
                  {/* Old content (read-only) */}
                  <div className="flex flex-1 flex-col min-w-0 border-r">
                    <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b bg-muted/30 shrink-0">
                      {currentPair.oldContent ? "Current (read-only)" : "New File"}
                    </div>
                    <textarea
                      readOnly
                      value={
                        currentPair.oldContent || "(this file does not exist in the target set yet)"
                      }
                      className="flex-1 font-mono text-[11px] bg-muted/20 px-3 py-2 resize-none text-muted-foreground leading-relaxed outline-none"
                      spellCheck={false}
                    />
                  </div>

                  {/* New content (editable) */}
                  <div className="flex flex-1 flex-col min-w-0">
                    <div className="px-3 py-1.5 text-[10px] font-medium text-green-400 uppercase tracking-wider border-b bg-green-500/5 shrink-0">
                      New Content (editable)
                    </div>
                    <textarea
                      value={
                        editedContent[currentPair.relativePath] ??
                        currentPair.newContent
                      }
                      onChange={(e) =>
                        setEditedContent((prev) => ({
                          ...prev,
                          [currentPair.relativePath]: e.target.value,
                        }))
                      }
                      className="flex-1 font-mono text-[11px] bg-background px-3 py-2 resize-none leading-relaxed outline-none"
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="px-4 py-1.5 text-xs text-destructive border-t shrink-0">
            {error}
          </div>
        )}

        <DialogFooter className="px-4 py-3 border-t shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loading || pairs.length === 0 || saved}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-3 w-3 text-green-400" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {saved
              ? "Saved!"
              : `Save ${pairs.length} File${pairs.length !== 1 ? "s" : ""} to "${targetSetName}"`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
