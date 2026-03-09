"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFileStore } from "@/stores/fileStore";
import {
  Archive,
  Loader2,
  CheckCircle2,
  XCircle,
  FileArchive,
  Upload,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

interface UpdateOriginalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "browse" | "extracting" | "done" | "error";

const VALID_EXTENSIONS = [".zip", ".7z"];

export function UpdateOriginalsDialog({
  open,
  onOpenChange,
}: UpdateOriginalsDialogProps) {
  const [phase, setPhase] = useState<Phase>("browse");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{
    filesExtracted?: number;
    source?: string;
    error?: string;
  }>({});

  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (!open) return;
    setPhase("browse");
    setSelectedFile(null);
    setResult({});
  }, [open]);

  const handleClose = (openState: boolean) => {
    if (phase === "extracting") return;
    if (!openState) {
      setPhase("browse");
      setResult({});
    }
    onOpenChange(openState);
  };

  const isValidArchive = (name: string) =>
    VALID_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

  const handleFileSelected = (file: File) => {
    if (!isValidArchive(file.name)) {
      toast.error("Please select a .zip or .7z archive");
      return;
    }
    setSelectedFile(file);
  };

  // ── Drag & drop handlers ───────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    handleFileSelected(files[0]);
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────

  const handleUpdate = async () => {
    if (!selectedFile) return;

    setPhase("extracting");
    setResult({});

    try {
      const formData = new FormData();
      formData.append("archive", selectedFile);
      const res = await fetch("/api/prompts/update-originals", {
        method: "POST",
        body: formData,
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

      await useFileStore.getState().refreshTree();

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
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.7z"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelected(file);
                // Reset so the same file can be re-selected
                e.target.value = "";
              }}
            />

            {/* Drop zone + browse button */}
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`relative rounded-lg border-2 border-dashed transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : selectedFile
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex flex-col items-center gap-2 py-6 px-3">
                {selectedFile ? (
                  <>
                    <FileArchive className="h-8 w-8 text-green-500" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB — ready to extract
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-3 text-muted-foreground"
                      onClick={() => setSelectedFile(null)}
                    >
                      Clear
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className={`h-8 w-8 ${dragging ? "text-primary" : "text-muted-foreground/50"}`} />
                    <span className="text-sm text-muted-foreground">
                      {dragging ? "Drop archive here" : "Drag & drop a .zip or .7z archive"}
                    </span>
                    <div className="relative flex items-center gap-3 w-full px-6 mt-1">
                      <div className="flex-1 border-t border-muted-foreground/20" />
                      <span className="text-[10px] text-muted-foreground uppercase">or</span>
                      <div className="flex-1 border-t border-muted-foreground/20" />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 mt-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Browse Files
                    </Button>
                  </>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={!selectedFile}
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
                  setSelectedFile(null);
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
