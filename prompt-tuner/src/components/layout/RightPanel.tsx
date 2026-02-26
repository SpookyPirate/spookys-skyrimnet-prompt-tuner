"use client";

import { useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSimulationStore } from "@/stores/simulationStore";
import { ActionSelectorPreviewContent } from "@/components/analysis/ActionSelectorPreview";
import { TriggerMatchResultsContent } from "@/components/triggers/TriggerMatchResults";
import { ScenePlanDisplayContent } from "@/components/gamemaster/ScenePlanDisplay";
import { ChevronDown, ChevronRight, Zap, Users, BarChart3, Activity, Copy, Check, Maximize2, X, Eye, Target, Theater } from "lucide-react";
import type { LlmCallLog } from "@/types/llm";

export function RightPanel() {
  const lastAction = useSimulationStore((s) => s.lastAction);
  const lastSpeakerPrediction = useSimulationStore((s) => s.lastSpeakerPrediction);
  const llmCallLog = useSimulationStore((s) => s.llmCallLog);

  const totalTokens = llmCallLog.reduce((sum, l) => sum + l.totalTokens, 0);
  const totalLatency = llmCallLog.reduce((sum, l) => sum + l.latencyMs, 0);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-8 items-center border-b px-3">
        <span className="text-xs font-medium text-muted-foreground">Analysis</span>
      </div>
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-3 space-y-4">
          <Section title="Action Triggers" icon={<Zap className="h-3.5 w-3.5" />}>
            {lastAction ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {lastAction.name}
                </Badge>
                {lastAction.params && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {JSON.stringify(lastAction.params)}
                  </span>
                )}
              </div>
            ) : (
              <Placeholder text="No action triggered" />
            )}
          </Section>

          <Separator />

          <Section title="Action Selector Preview" icon={<Eye className="h-3.5 w-3.5" />}>
            <ActionSelectorPreviewContent />
          </Section>

          <Separator />

          <Section title="Speaker Prediction" icon={<Users className="h-3.5 w-3.5" />}>
            {lastSpeakerPrediction ? (
              <div className="text-xs font-mono">
                {lastSpeakerPrediction === "0" ? (
                  <span className="text-muted-foreground">Silence (no next speaker)</span>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {lastSpeakerPrediction}
                  </Badge>
                )}
              </div>
            ) : (
              <Placeholder text="No prediction yet" />
            )}
          </Section>

          <Separator />

          <Section title="Trigger Match Results" icon={<Target className="h-3.5 w-3.5" />}>
            <TriggerMatchResultsContent />
          </Section>

          <Separator />

          <Section title="GameMaster Scene" icon={<Theater className="h-3.5 w-3.5 text-purple-400" />}>
            <ScenePlanDisplayContent />
          </Section>

          <Separator />

          <Section title="LLM Call Breakdown" icon={<Activity className="h-3.5 w-3.5" />}>
            {llmCallLog.length > 0 ? (
              <div className="space-y-1">
                {llmCallLog.map((log) => (
                  <LlmCallEntry key={log.id} log={log} />
                ))}
              </div>
            ) : (
              <Placeholder text="No LLM calls yet" />
            )}
          </Section>

          <Separator />

          <Section title="Token Usage" icon={<BarChart3 className="h-3.5 w-3.5" />}>
            {llmCallLog.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Total Calls" value={llmCallLog.length.toString()} />
                <Stat label="Total Tokens" value={totalTokens.toLocaleString()} />
                <Stat label="Total Latency" value={`${(totalLatency / 1000).toFixed(1)}s`} />
                <Stat label="Errors" value={llmCallLog.filter((l) => l.error).length.toString()} />
              </div>
            ) : (
              <Placeholder text="No token data yet" />
            )}
          </Section>
        </div>
      </ScrollArea>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  defaultCollapsed = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-accent/50"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        {icon}
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      </button>
      {!collapsed && <div className="mt-1.5 px-1">{children}</div>}
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-2 text-center text-[10px] text-muted-foreground">
      {text}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold">{value}</div>
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
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-semibold">{title}</span>
          <div className="flex items-center gap-2">
            <CopyButton text={text} />
            <button onClick={onClose} className="p-0.5 rounded hover:bg-accent/50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <ScrollArea className="flex-1 overflow-auto p-4">
          <pre className="whitespace-pre-wrap break-words text-xs font-mono">{text}</pre>
        </ScrollArea>
      </div>
    </div>
  );
}

function LlmCallEntry({ log }: { log: LlmCallLog }) {
  const [expanded, setExpanded] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string; text: string } | null>(null);

  const messagesText = log.messages
    .map((m) => `[${m.role}] ${m.content}`)
    .join("\n\n");

  return (
    <>
      <div className="rounded border text-[10px]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1.5 p-1.5 text-left hover:bg-accent/50"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <Badge
            variant={log.error ? "destructive" : "secondary"}
            className="text-[9px] px-1 py-0"
          >
            {log.agent}
          </Badge>
          <span className="flex-1 truncate font-mono text-muted-foreground">
            {log.model}
          </span>
          <span className="text-muted-foreground">
            {log.latencyMs}ms
          </span>
        </button>
        {expanded && (
          <div className="border-t p-2 space-y-1.5">
            <div>
              <span className="font-semibold">Model:</span>{" "}
              <span className="font-mono">{log.model}</span>
            </div>
            <div>
              <span className="font-semibold">Tokens:</span>{" "}
              {log.promptTokens} prompt + {log.completionTokens} completion ={" "}
              {log.totalTokens}
            </div>
            {log.error && (
              <div className="text-destructive">
                <span className="font-semibold">Error:</span> {log.error}
              </div>
            )}
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Messages ({log.messages.length}):</span>
                <div className="flex items-center gap-1">
                  <CopyButton text={messagesText} />
                  <button
                    onClick={() => setModalContent({ title: `Messages (${log.agent})`, text: messagesText })}
                    className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                    title="Expand"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-1.5 text-[9px]">
                {log.messages
                  .map((m) => `[${m.role}] ${m.content.substring(0, 300)}${m.content.length > 300 ? "..." : ""}`)
                  .join("\n\n")}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Response:</span>
                <div className="flex items-center gap-1">
                  <CopyButton text={log.response || ""} />
                  <button
                    onClick={() => setModalContent({ title: `Response (${log.agent})`, text: log.response || "(empty)" })}
                    className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                    title="Expand"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-1.5 text-[9px]">
                {log.response || "(empty)"}
              </pre>
            </div>
          </div>
        )}
      </div>
      {modalContent && (
        <TextModal
          title={modalContent.title}
          text={modalContent.text}
          onClose={() => setModalContent(null)}
        />
      )}
    </>
  );
}
