"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useSimulationStore } from "@/stores/simulationStore";
import { ActionSelectorPreview } from "@/components/analysis/ActionSelectorPreview";
import { TriggerMatchResults } from "@/components/triggers/TriggerMatchResults";
import { ScenePlanDisplay } from "@/components/gamemaster/ScenePlanDisplay";
import { ChevronDown, ChevronRight, Zap, Users, BarChart3, Activity } from "lucide-react";
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

          <ActionSelectorPreview />

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

          <TriggerMatchResults />

          <Separator />

          <ScenePlanDisplay />

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
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      </div>
      {children}
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

function LlmCallEntry({ log }: { log: LlmCallLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
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
            <span className="font-semibold">Messages ({log.messages.length}):</span>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-1.5 text-[9px]">
              {log.messages
                .map((m) => `[${m.role}] ${m.content.substring(0, 200)}${m.content.length > 200 ? "..." : ""}`)
                .join("\n\n")}
            </pre>
          </div>
          <div>
            <span className="font-semibold">Response:</span>
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-background p-1.5 text-[9px]">
              {log.response || "(empty)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
