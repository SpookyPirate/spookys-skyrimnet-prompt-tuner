"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useBenchmarkStore } from "@/stores/benchmarkStore";
import { getCategoryDef } from "@/lib/benchmark/categories";
import { buildAssessmentMessages } from "@/lib/benchmark/build-assessment-prompt";
import { sendLlmRequest } from "@/lib/llm/client";
import { Copy, Check, Loader2, Sparkles } from "lucide-react";

export function BenchmarkAssessmentPanel() {
  const results = useBenchmarkStore((s) => s.results);
  const activeCategory = useBenchmarkStore((s) => s.activeCategory);
  const assessment = useBenchmarkStore((s) => s.assessment);
  const renderedText = useBenchmarkStore((s) => s.renderedText);
  const isRunning = useBenchmarkStore((s) => s.isRunning);
  const setAssessment = useBenchmarkStore((s) => s.setAssessment);

  const [isAssessing, setIsAssessing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLPreElement>(null);

  const catDef = activeCategory ? getCategoryDef(activeCategory) : undefined;

  const categoryResults = Object.values(results).filter(
    (r) => r.category === activeCategory
  );

  const completedResults = categoryResults.filter(
    (r) => r.overallStatus === "done" || r.overallStatus === "error"
  );

  useEffect(() => {
    if (assessment.status === "streaming" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [assessment.streamedText, assessment.status]);

  const handleAssess = useCallback(async () => {
    const doneResults = completedResults.filter((r) => r.overallStatus === "done");
    if (doneResults.length === 0) return;

    setIsAssessing(true);
    useBenchmarkStore.getState().setAssessment({ streamedText: "", status: "streaming", error: undefined });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const messages = buildAssessmentMessages(doneResults, renderedText);
      await sendLlmRequest({
        messages,
        agent: "tuner",
        onChunk: (chunk) => {
          useBenchmarkStore.getState().updateAssessmentStream(chunk);
        },
        signal: controller.signal,
      });
      useBenchmarkStore.getState().setAssessment({ status: "done" });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      useBenchmarkStore.getState().setAssessment({
        status: "error",
        error: err instanceof Error ? err.message : "Assessment failed",
      });
    } finally {
      setIsAssessing(false);
      abortRef.current = null;
    }
  }, [completedResults, renderedText]);

  const canAssess =
    completedResults.some((r) => r.overallStatus === "done") && !isRunning && !isAssessing;

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-8 items-center border-b px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Benchmark Results
        </span>
      </div>
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-3 space-y-4">
          {/* Metrics Section */}
          {categoryResults.length > 0 && (
            <>
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Metrics Comparison
                </div>
                <div className="space-y-1">
                  {categoryResults.map((r) => (
                    <div
                      key={`${r.profileId}-${r.category}`}
                      className="rounded border text-[10px] p-2 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">
                          {r.profileName}
                        </span>
                        <StatusBadge status={r.overallStatus} />
                      </div>
                      <div className="font-mono text-muted-foreground truncate">
                        {r.model}
                      </div>
                      {r.overallStatus === "done" && (
                        <div className="grid grid-cols-2 gap-1 pt-0.5">
                          <MetricCell
                            label="Total Latency"
                            value={`${(r.totalLatencyMs / 1000).toFixed(1)}s`}
                          />
                          <MetricCell
                            label="Total Tokens"
                            value={r.totalTokens.toLocaleString()}
                          />
                        </div>
                      )}
                      {/* Per-subtask breakdown for multi-subtask agents */}
                      {r.subtasks.length > 1 && r.overallStatus === "done" && (
                        <div className="space-y-0.5 pt-0.5">
                          {r.subtasks.map((st) => (
                            <div
                              key={st.subtaskId}
                              className="flex items-center justify-between text-[9px] text-muted-foreground"
                            >
                              <span>{st.subtaskLabel}</span>
                              <span>
                                {(st.latencyMs / 1000).toFixed(1)}s / {st.totalTokens} tok
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.overallStatus === "error" && (
                        <div className="text-destructive text-[9px]">
                          {r.subtasks
                            .filter((st) => st.error)
                            .map((st) => st.error)
                            .join("; ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
            </>
          )}

          {/* Assessment Section */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Quality Assessment
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              disabled={!canAssess}
              onClick={handleAssess}
            >
              {isAssessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isAssessing ? "Assessing..." : "Assess Quality"}
            </Button>

            {assessment.status !== "idle" && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold">
                    Assessment
                    {assessment.status === "streaming" && (
                      <Loader2 className="inline h-2.5 w-2.5 animate-spin ml-1" />
                    )}
                  </span>
                  {assessment.streamedText && (
                    <CopyButton text={assessment.streamedText} />
                  )}
                </div>
                <pre
                  ref={scrollRef}
                  className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-[10px] font-mono leading-relaxed"
                >
                  {assessment.streamedText || "(waiting...)"}
                  {assessment.status === "streaming" && (
                    <span className="inline-block w-1.5 h-3 bg-foreground/70 animate-pulse ml-0.5 align-text-bottom" />
                  )}
                </pre>
                {assessment.status === "error" && assessment.error && (
                  <div className="text-destructive text-[10px]">
                    {assessment.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Empty state */}
          {categoryResults.length === 0 && (
            <div className="rounded-md border border-dashed p-4 text-center text-[10px] text-muted-foreground">
              Run a benchmark to see results here
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "done":
      return (
        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-400"
        >
          Done
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="text-[9px] px-1 py-0">
          Error
        </Badge>
      );
    case "streaming":
      return (
        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 border-blue-500/30 text-blue-400"
        >
          Running
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[9px] px-1 py-0">
          Pending
        </Badge>
      );
  }
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-1 text-center">
      <div className="text-[8px] text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}
