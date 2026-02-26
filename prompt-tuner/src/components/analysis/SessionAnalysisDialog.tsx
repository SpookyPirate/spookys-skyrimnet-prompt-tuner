"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sendLlmRequest } from "@/lib/llm/client";
import { buildAnalysisMessages } from "@/lib/analysis/build-analysis-prompt";
import { Loader2, Copy, Check, Download, XCircle, BarChart3 } from "lucide-react";

interface SessionAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogPhase = "analyzing" | "done" | "error";

export function SessionAnalysisDialog({
  open,
  onOpenChange,
}: SessionAnalysisDialogProps) {
  const [phase, setPhase] = useState<DialogPhase>("analyzing");
  const [streamedText, setStreamedText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  const runAnalysis = useCallback(async () => {
    setPhase("analyzing");
    setStreamedText("");
    setError("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const messages = buildAnalysisMessages();

      const result = await sendLlmRequest({
        agent: "tuner",
        messages,
        onChunk: (chunk) => {
          setStreamedText((prev) => prev + chunk);
        },
        signal: controller.signal,
      });

      if (result.error) {
        setError(result.error);
        setPhase("error");
        return;
      }

      setPhase("done");
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setPhase("error");
    }
  }, []);

  // Start analysis when dialog opens
  useEffect(() => {
    if (open) {
      runAnalysis();
    }
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [open, runAnalysis]);

  // Auto-scroll streamed output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamedText]);

  const handleClose = (openState: boolean) => {
    if (!openState && abortRef.current) {
      abortRef.current.abort();
    }
    onOpenChange(openState);
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(streamedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [streamedText]);

  const handleDownload = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([streamedText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-analysis-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [streamedText]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Session Analysis
          </DialogTitle>
          <DialogDescription>
            {phase === "analyzing"
              ? "Analyzing session data..."
              : phase === "done"
                ? "Analysis complete"
                : "Analysis failed"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {phase === "analyzing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating report...
            </div>
          )}

          {phase === "error" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <pre
            ref={outputRef}
            className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap"
          >
            {streamedText || (phase === "analyzing" ? "Waiting for response..." : "")}
          </pre>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {phase === "error" && (
            <Button onClick={runAnalysis}>Retry</Button>
          )}
          {streamedText && (
            <>
              <Button variant="outline" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy Markdown"}
              </Button>
              <Button variant="outline" onClick={handleDownload} className="gap-1.5">
                <Download className="h-4 w-4" />
                Download .md
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
