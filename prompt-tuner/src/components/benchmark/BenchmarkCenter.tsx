"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useBenchmarkStore } from "@/stores/benchmarkStore";
import { getCategoryDef } from "@/lib/benchmark/categories";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Maximize2,
  X,
  MessageSquare,
  ArrowRight,
  Brain,
} from "lucide-react";
import type {
  BenchmarkResult,
  BenchmarkSubtaskResult,
  BenchmarkDialogueTurn,
} from "@/types/benchmark";
import type { ChatMessage } from "@/types/llm";

/* ── Helpers ─────────────────────────────────────────────────────────── */

const ROLE_COLORS: Record<string, string> = {
  system: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  user: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  assistant: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

/** Group result entries by subtask index so we can iterate per-subtask. */
function groupBySubtask(resultEntries: [string, BenchmarkResult][]) {
  if (resultEntries.length === 0) return [];
  const subtaskCount = resultEntries[0][1].subtasks.length;
  const groups: {
    subtaskId: string;
    subtaskLabel: string;
    messages: ChatMessage[];
    outputs: {
      key: string;
      profileName: string;
      model: string;
      subtask: BenchmarkSubtaskResult;
      overallStatus: string;
    }[];
  }[] = [];

  for (let i = 0; i < subtaskCount; i++) {
    const first = resultEntries[0][1].subtasks[i];
    groups.push({
      subtaskId: first?.subtaskId ?? `subtask-${i}`,
      subtaskLabel: first?.subtaskLabel ?? `Subtask ${i + 1}`,
      messages: first?.messages ?? [],
      outputs: resultEntries.map(([key, result]) => ({
        key,
        profileName: result.profileName,
        model: result.model,
        subtask: result.subtasks[i],
        overallStatus: result.overallStatus,
      })),
    });
  }
  return groups;
}

/* ── Main Component ──────────────────────────────────────────────────── */

export function BenchmarkCenter() {
  const activeCategory = useBenchmarkStore((s) => s.activeCategory);
  const results = useBenchmarkStore((s) => s.results);
  const isRunning = useBenchmarkStore((s) => s.isRunning);
  const activeTurns = useBenchmarkStore((s) => s.activeTurns);

  const catDef = activeCategory ? getCategoryDef(activeCategory) : undefined;

  const resultEntries = Object.entries(results).filter(
    ([key]) => activeCategory && key.endsWith(`-${activeCategory}`)
  );

  if (resultEntries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <div className="text-center space-y-2">
          <p>No benchmark results yet</p>
          <p className="text-xs">
            Select profiles and run a benchmark from the left panel
          </p>
        </div>
      </div>
    );
  }

  const subtaskGroups = groupBySubtask(resultEntries);
  const isMultiTurn = !!activeTurns && activeTurns.length > 0;
  const hasMultipleSubtasks = subtaskGroups.length > 1;

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex h-8 items-center gap-2 border-b px-3">
        {catDef && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {catDef.label}
          </Badge>
        )}
        {isMultiTurn && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-300">
            Multi-Turn
          </Badge>
        )}
        {hasMultipleSubtasks && (
          <span className="text-[10px] text-muted-foreground">
            {subtaskGroups.length} {isMultiTurn ? "turns" : "subtasks"}
          </span>
        )}
        {isRunning && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running...
          </div>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {resultEntries.length} model
          {resultEntries.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Body — vertical scroll of subtask/turn blocks */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="flex flex-col">
          {subtaskGroups.map((group, i) => (
            <div key={group.subtaskId}>
              {isMultiTurn ? (
                <TurnBlock
                  group={group}
                  turn={activeTurns[i]}
                  turnIndex={i}
                />
              ) : (
                <SubtaskBlock
                  group={group}
                  showLabel={hasMultipleSubtasks}
                />
              )}
              {i < subtaskGroups.length - 1 && (
                <Separator className="border-dashed" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Turn Block (multi-turn dialogue) ─────────────────────────────── */

function TurnBlock({
  group,
  turn,
  turnIndex,
}: {
  group: ReturnType<typeof groupBySubtask>[number];
  turn?: BenchmarkDialogueTurn;
  turnIndex: number;
}) {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [activePromptProfile, setActivePromptProfile] = useState(0);
  const [modalContent, setModalContent] = useState<{
    title: string;
    text: string;
  } | null>(null);

  // Each profile may have different rendered messages in multi-turn
  const activeOutput = group.outputs[activePromptProfile];
  const activeMessages = activeOutput?.subtask?.messages ?? [];
  const messagesText = activeMessages
    .map((m) => `[${m.role}] ${m.content}`)
    .join("\n\n");

  return (
    <div className="p-3 space-y-2">
      {/* Turn input header */}
      {turn && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
          <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-foreground">
                {turn.label}
              </span>
              <span className="text-muted-foreground">
                {turn.inputSpeaker}
              </span>
              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/60" />
              <span className="text-muted-foreground">
                {turn.inputTarget}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground/80 italic leading-relaxed">
              &ldquo;{turn.inputContent}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Per-profile prompt section (collapsed by default) */}
      {group.outputs.some((o) => o.subtask?.messages?.length > 0) && (
        <div className="rounded-md border">
          <div className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-accent/50 rounded-t-md cursor-pointer">
            <div
              className="flex flex-1 items-center gap-1.5 min-w-0"
              onClick={() => setPromptExpanded(!promptExpanded)}
            >
              {promptExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              <span className="text-[11px] font-semibold text-muted-foreground">
                Rendered Prompt
              </span>
              {activeMessages.length > 0 && (
                <span className="text-[10px] text-muted-foreground/60 ml-1">
                  ({activeMessages.length} message
                  {activeMessages.length !== 1 ? "s" : ""})
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <CopyButton text={messagesText} />
              <button
                onClick={() =>
                  setModalContent({
                    title: `${turn?.label ?? group.subtaskLabel} — Rendered Prompt (${activeOutput?.profileName})`,
                    text: messagesText,
                  })
                }
                className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                title="Expand"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {promptExpanded && (
            <div className="border-t">
              {/* Profile selector tabs */}
              {group.outputs.length > 1 && (
                <div className="flex gap-0.5 px-2.5 pt-1.5 border-b pb-1.5">
                  {group.outputs.map((out, idx) => (
                    <button
                      key={out.key}
                      onClick={() => setActivePromptProfile(idx)}
                      className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                        idx === activePromptProfile
                          ? "bg-accent text-foreground font-semibold"
                          : "text-muted-foreground hover:bg-accent/50"
                      }`}
                    >
                      {out.profileName}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-60 overflow-auto px-2.5 py-2 space-y-2">
                {activeMessages.length > 0 ? (
                  activeMessages.map((msg, i) => (
                    <PromptMessage key={i} message={msg} />
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">
                    No prompt rendered yet
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Model output columns */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">
          Model Outputs
        </div>
        <div className="flex gap-2">
          {group.outputs.map((out) => (
            <OutputColumn
              key={out.key}
              profileName={out.profileName}
              model={out.model}
              subtask={out.subtask}
            />
          ))}
        </div>
      </div>

      {modalContent && (
        <TextModal
          title={modalContent.title}
          text={modalContent.text}
          onClose={() => setModalContent(null)}
        />
      )}
    </div>
  );
}

/* ── Subtask Block (standard single-render) ───────────────────────── */

function SubtaskBlock({
  group,
  showLabel,
}: {
  group: ReturnType<typeof groupBySubtask>[number];
  showLabel: boolean;
}) {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    text: string;
  } | null>(null);

  const messagesText = group.messages
    .map((m) => `[${m.role}] ${m.content}`)
    .join("\n\n");

  return (
    <div className="p-3 space-y-3">
      {/* Subtask header — only for multi-subtask categories */}
      {showLabel && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {group.subtaskLabel}
          </span>
        </div>
      )}

      {/* Collapsible rendered prompt section */}
      {group.messages.length > 0 && (
        <div className="rounded-md border">
          <div
            className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-accent/50 rounded-t-md cursor-pointer"
          >
            <div
              className="flex flex-1 items-center gap-1.5 min-w-0"
              onClick={() => setPromptExpanded(!promptExpanded)}
            >
              {promptExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              <span className="text-[11px] font-semibold text-muted-foreground">
                Rendered Prompt
              </span>
              <span className="text-[10px] text-muted-foreground/60 ml-1">
                ({group.messages.length} message
                {group.messages.length !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <CopyButton text={messagesText} />
              <button
                onClick={() =>
                  setModalContent({
                    title: `${group.subtaskLabel} — Rendered Prompt`,
                    text: messagesText,
                  })
                }
                className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                title="Expand"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {promptExpanded && (
            <div className="border-t max-h-60 overflow-auto px-2.5 py-2 space-y-2">
              {group.messages.map((msg, i) => (
                <PromptMessage key={i} message={msg} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model output columns */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">
          Model Outputs
        </div>
        <div className="flex gap-2">
          {group.outputs.map((out) => (
            <OutputColumn
              key={out.key}
              profileName={out.profileName}
              model={out.model}
              subtask={out.subtask}
            />
          ))}
        </div>
      </div>

      {modalContent && (
        <TextModal
          title={modalContent.title}
          text={modalContent.text}
          onClose={() => setModalContent(null)}
        />
      )}
    </div>
  );
}

/* ── Prompt Message ──────────────────────────────────────────────────── */

function PromptMessage({ message }: { message: ChatMessage }) {
  const roleClass = ROLE_COLORS[message.role] ?? "";
  const [expanded, setExpanded] = useState(false);
  const isLong = message.content.length > 500;
  const displayText =
    isLong && !expanded
      ? message.content.substring(0, 500) + "..."
      : message.content;

  return (
    <div>
      <Badge
        variant="outline"
        className={`text-[9px] px-1 py-0 font-mono mb-1 ${roleClass}`}
      >
        {message.role}
      </Badge>
      <pre className="whitespace-pre-wrap break-words text-[10px] font-mono leading-relaxed text-muted-foreground rounded bg-background p-1.5">
        {displayText}
      </pre>
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[9px] text-primary/70 hover:text-primary mt-0.5"
        >
          {expanded ? "Collapse" : "Expand full message"}
        </button>
      )}
    </div>
  );
}

/* ── Output Column ───────────────────────────────────────────────────── */

function OutputColumn({
  profileName,
  model,
  subtask,
}: {
  profileName: string;
  model: string;
  subtask: BenchmarkSubtaskResult;
}) {
  const scrollRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (subtask.status === "streaming" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [subtask.streamedText, subtask.status]);

  const displayText =
    subtask.status === "streaming"
      ? subtask.streamedText
      : subtask.response || subtask.streamedText;

  return (
    <div className="flex flex-1 flex-col rounded-md border min-w-0">
      {/* Column header */}
      <div className="px-2 py-1.5 border-b space-y-0.5">
        <div className="text-xs font-semibold truncate">{profileName}</div>
        <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
          {model}
        </Badge>
      </div>

      {/* Response body */}
      <pre
        ref={scrollRef}
        className="flex-1 whitespace-pre-wrap break-words px-2 py-1.5 text-xs font-mono leading-relaxed min-h-[60px] max-h-[400px] overflow-auto"
      >
        {displayText || (
          <span className="text-muted-foreground italic">Waiting...</span>
        )}
        {subtask.status === "streaming" && (
          <span className="inline-block w-1.5 h-3.5 bg-foreground/70 animate-pulse ml-0.5 align-text-bottom" />
        )}
      </pre>

      {/* Self-Explanation */}
      {subtask.explanationStatus !== "idle" && (
        <ExplanationBlock subtask={subtask} />
      )}

      {/* Footer: stats */}
      <div className="flex items-center gap-2 border-t px-2 py-1 text-[10px] text-muted-foreground">
        {subtask.status === "done" && (
          <>
            <span>{(subtask.latencyMs / 1000).toFixed(1)}s</span>
            <span>{subtask.totalTokens} tok</span>
          </>
        )}
        {subtask.status === "error" && (
          <span className="text-destructive">
            {subtask.error || "Error"}
          </span>
        )}
        {subtask.status === "streaming" && (
          <span className="flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Streaming...
          </span>
        )}
        {subtask.status === "pending" && <span>Pending...</span>}
        <span className="ml-auto">
          <StatusDot status={subtask.status} />
        </span>
      </div>
    </div>
  );
}

/* ── Explanation Block ────────────────────────────────────────────────── */

function ExplanationBlock({ subtask }: { subtask: BenchmarkSubtaskResult }) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (subtask.explanationStatus === "streaming" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [subtask.explanationStreamedText, subtask.explanationStatus]);

  const displayText =
    subtask.explanationStatus === "streaming"
      ? subtask.explanationStreamedText
      : subtask.explanation || subtask.explanationStreamedText;

  return (
    <div className="border-t border-amber-500/20">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left hover:bg-amber-500/5"
      >
        {expanded ? (
          <ChevronDown className="h-2.5 w-2.5 shrink-0 text-amber-400" />
        ) : (
          <ChevronRight className="h-2.5 w-2.5 shrink-0 text-amber-400" />
        )}
        <Brain className="h-2.5 w-2.5 shrink-0 text-amber-400" />
        <span className="text-[10px] font-semibold text-amber-400">
          Self-Explanation
        </span>
        {subtask.explanationStatus === "streaming" && (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400/70 ml-1" />
        )}
        {subtask.explanationStatus === "error" && (
          <span className="text-[9px] text-destructive ml-1">Error</span>
        )}
      </button>

      {expanded && (
        <div className="px-2 pb-1.5">
          {subtask.explanationStatus === "error" && subtask.explanationError && (
            <p className="text-[10px] text-destructive mb-1">
              {subtask.explanationError}
            </p>
          )}
          <pre
            ref={scrollRef}
            className="whitespace-pre-wrap break-words text-[10px] font-mono leading-relaxed text-amber-300/80 max-h-[200px] overflow-auto rounded bg-amber-500/5 p-1.5"
          >
            {displayText || (
              <span className="text-muted-foreground italic">Waiting...</span>
            )}
            {subtask.explanationStatus === "streaming" && (
              <span className="inline-block w-1.5 h-3 bg-amber-400/70 animate-pulse ml-0.5 align-text-bottom" />
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Shared Utility Components ───────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [text]
  );
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

function TextModal({
  title,
  text,
  onClose,
}: {
  title: string;
  text: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-semibold">{title}</span>
          <div className="flex items-center gap-2">
            <CopyButton text={text} />
            <button
              onClick={onClose}
              className="p-0.5 rounded hover:bg-accent/50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <ScrollArea className="flex-1 overflow-auto p-4">
          <pre className="whitespace-pre-wrap break-words text-xs font-mono">
            {text}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "done"
      ? "bg-emerald-400"
      : status === "error"
        ? "bg-destructive"
        : status === "streaming"
          ? "bg-blue-400 animate-pulse"
          : "bg-muted-foreground/50";
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />
  );
}
