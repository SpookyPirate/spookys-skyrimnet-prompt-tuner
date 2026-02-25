"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFileStore } from "@/stores/fileStore";
import {
  Archive,
  Loader2,
  CheckCircle2,
  XCircle,
  Folder,
  FileArchive,
  ChevronUp,
  Home,
} from "lucide-react";
import { toast } from "sonner";

interface BrowseEntry {
  name: string;
  path: string;
  type: "file" | "directory";
}

interface UpdateOriginalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "browse" | "extracting" | "done" | "error";

export function UpdateOriginalsDialog({
  open,
  onOpenChange,
}: UpdateOriginalsDialogProps) {
  const [phase, setPhase] = useState<Phase>("browse");
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [currentDir, setCurrentDir] = useState<string | null>(null);
  const [parentDir, setParentDir] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [result, setResult] = useState<{
    filesExtracted?: number;
    source?: string;
    error?: string;
  }>({});

  const fetchDir = useCallback(async (dir?: string) => {
    setLoading(true);
    try {
      const url = dir
        ? `/api/browse?dir=${encodeURIComponent(dir)}&extensions=.zip,.7z`
        : `/api/browse?extensions=.zip,.7z`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setEntries(data.entries ?? []);
      setCurrentDir(data.current);
      setParentDir(data.parent);
    } catch {
      toast.error("Failed to browse directory");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial directory listing on open
  useEffect(() => {
    if (!open) return;
    setPhase("browse");
    setSelectedPath("");
    setResult({});
    fetchDir();
  }, [open, fetchDir]);

  const handleEntryClick = (entry: BrowseEntry) => {
    if (entry.type === "directory") {
      fetchDir(entry.path);
    } else {
      setSelectedPath(entry.path);
    }
  };

  const handleClose = (openState: boolean) => {
    if (phase === "extracting") return;
    if (!openState) {
      setPhase("browse");
      setResult({});
    }
    onOpenChange(openState);
  };

  const handleUpdate = async () => {
    const trimmed = selectedPath.trim();
    if (!trimmed) return;

    setPhase("extracting");
    setResult({});

    try {
      const res = await fetch("/api/prompts/update-originals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivePath: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ error: data.error || `HTTP ${res.status}` });
        setPhase("error");
        return;
      }

      setResult({
        filesExtracted: data.filesExtracted,
        source: data.source,
      });
      setPhase("done");

      // Refresh file tree
      const treeRes = await fetch("/api/files/tree");
      const treeData = await treeRes.json();
      useFileStore.getState().setTree(treeData.tree);

      toast.success(
        `Original prompts updated (${data.filesExtracted} files from ${data.source})`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setResult({ error: msg });
      setPhase("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Update Original Prompts
          </DialogTitle>
          <DialogDescription>
            Select a SkyrimNet release archive (.zip or .7z) to extract original
            prompts from. This replaces the current originals.
          </DialogDescription>
        </DialogHeader>

        {phase === "browse" && (
          <>
            {/* Path input — manual entry or shows selected file */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Archive path
              </label>
              <Input
                placeholder="Browse below or paste a path..."
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && selectedPath.trim()) handleUpdate();
                }}
                className="h-8 text-xs"
              />
            </div>

            {/* Navigation bar */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => fetchDir()}
                title="Quick access"
              >
                <Home className="h-3.5 w-3.5" />
              </Button>
              {parentDir && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => fetchDir(parentDir)}
                  title="Go up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
              )}
              {currentDir && (
                <span
                  className="truncate text-[11px] text-muted-foreground"
                  title={currentDir}
                >
                  {currentDir}
                </span>
              )}
            </div>

            {/* Directory listing */}
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="max-h-56 rounded-md border">
                <div className="p-1">
                  {entries.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      {currentDir
                        ? "No folders or archives here"
                        : "Loading..."}
                    </div>
                  ) : (
                    entries.map((entry) => {
                      const isSelected = entry.path === selectedPath;
                      return (
                        <button
                          key={entry.path}
                          onClick={() => handleEntryClick(entry)}
                          className={`flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs transition-colors hover:bg-accent ${
                            isSelected ? "bg-accent font-medium" : ""
                          }`}
                        >
                          {entry.type === "directory" ? (
                            <Folder className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                          ) : (
                            <FileArchive className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          )}
                          <span className="truncate">{entry.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={!selectedPath.trim()}
                className="gap-1.5"
              >
                <Archive className="h-4 w-4" />
                Extract & Update
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "extracting" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Extracting prompts from archive...
            </p>
            <p className="text-xs text-muted-foreground">
              This may take a moment for large archives.
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Original prompts updated successfully
            </div>
            <p className="text-xs text-muted-foreground">
              Extracted {result.filesExtracted} files from {result.source}. The
              file tree has been refreshed.
            </p>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{result.error}</span>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setPhase("browse");
                  setResult({});
                }}
              >
                Try Again
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
