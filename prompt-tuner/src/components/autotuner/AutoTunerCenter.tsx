"use client";

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAutoTunerStore } from "@/stores/autoTunerStore";
import type { TunerPhase, TunerRound } from "@/types/autotuner";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const PHASE_LABELS: Record<TunerPhase, string> = {
  idle: "Waiting",
  benchmarking: "Running Benchmark",
  explaining: "Self-Explanation",
  assessing: "Assessing Quality",
  proposing: "Proposing Changes",
  applying: "Applying Changes",
  complete: "Complete",
  error: "Error",
  stopped: "Stopped",
};

function PhaseIcon({ phase }: { phase: TunerPhase }) {
  switch (phase) {
    case "complete":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "error":
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    case "stopped":
      return <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />;
    case "idle":
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
  }
}

export function AutoTunerCenter() {
  const phase = useAutoTunerStore((s) => s.phase);
  const currentRound = useAutoTunerStore((s) => s.currentRound);
  const maxRounds = useAutoTunerStore((s) => s.maxRounds);
  const rounds = useAutoTunerStore((s) => s.rounds);
  const explanationStream = useAutoTunerStore((s) => s.explanationStream);
  const assessmentStream = useAutoTunerStore((s) => s.assessmentStream);
  const proposalStream = useAutoTunerStore((s) => s.proposalStream);
  const isRunning = useAutoTunerStore((s) => s.isRunning);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isRunning && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [explanationStream, assessmentStream, proposalStream, isRunning, rounds]);

  if (phase === "idle" && rounds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        <div className="text-center space-y-2">
          <p>Configure the tuner in the left panel and click Start.</p>
          <p className="text-xs opacity-60">
            The auto tuner will benchmark, assess, and iteratively improve your model&apos;s settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Progress header */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <PhaseIcon phase={phase} />
        <span className="text-sm font-medium">
          {isRunning
            ? `Round ${currentRound} of ${maxRounds} — ${PHASE_LABELS[phase]}`
            : `${PHASE_LABELS[phase]} — ${rounds.length} round${rounds.length !== 1 ? "s" : ""}`
          }
        </span>
      </div>

      {/* Rounds */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="p-4 space-y-3">
          {rounds.map((round, idx) => (
            <TunerRoundCard
              key={round.roundNumber}
              round={round}
              isCurrentRound={idx === rounds.length - 1 && isRunning}
              explanationStream={idx === rounds.length - 1 ? explanationStream : ""}
              assessmentStream={idx === rounds.length - 1 ? assessmentStream : ""}
              proposalStream={idx === rounds.length - 1 ? proposalStream : ""}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function TunerRoundCard({
  round,
  isCurrentRound,
  explanationStream,
  assessmentStream,
  proposalStream,
}: {
  round: TunerRound;
  isCurrentRound: boolean;
  explanationStream: string;
  assessmentStream: string;
  proposalStream: string;
}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(true);
  const [explanationOpen, setExplanationOpen] = useState(true);
  const [assessOpen, setAssessOpen] = useState(true);
  const [proposalOpen, setProposalOpen] = useState(true);

  const benchResult = round.benchmarkResult;
  const showExplanationStream = isCurrentRound && !!benchResult && !benchResult.explanation;
  const showAssessmentStream = isCurrentRound && !round.assessmentText;
  const showProposalStream = isCurrentRound && !round.proposal;

  // Explanation display text
  const explanationText = benchResult?.explanation || "";
  const explanationDisplay = explanationText || (showExplanationStream ? explanationStream : "");

  return (
    <div className="rounded-lg border bg-card">
      {/* Round header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <PhaseIcon phase={round.phase} />
        <span className="text-xs font-medium">Round {round.roundNumber}</span>
        {benchResult && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {benchResult.latencyMs}ms · {benchResult.totalTokens} tok
          </span>
        )}
        {round.error && (
          <span className="text-xs text-red-500 ml-auto">{round.error}</span>
        )}
      </div>

      <div className="space-y-0">
        {/* Rendered Prompt */}
        {benchResult && benchResult.messages.length > 0 && (
          <CollapsibleSection
            title="Rendered Prompt"
            open={promptOpen}
            onToggle={() => setPromptOpen(!promptOpen)}
            badge={`${benchResult.messages.length} messages`}
          >
            <div className="space-y-1.5">
              {benchResult.messages.map((msg, i) => (
                <div key={i} className="space-y-0.5">
                  <div className={`text-[10px] font-medium uppercase tracking-wider ${
                    msg.role === "system" ? "text-blue-400" : msg.role === "user" ? "text-green-400" : "text-amber-400"
                  }`}>
                    {msg.role}
                  </div>
                  <pre className="whitespace-pre-wrap text-xs bg-muted/50 rounded p-2 max-h-64 overflow-auto">
                    {msg.content}
                  </pre>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Model Response */}
        {benchResult && (
          <CollapsibleSection
            title="Model Response"
            open={responseOpen}
            onToggle={() => setResponseOpen(!responseOpen)}
          >
            <div className="space-y-2">
              <pre className="whitespace-pre-wrap text-xs bg-muted/50 rounded p-2 max-h-64 overflow-auto">
                {benchResult.response || "(no response)"}
              </pre>
              <div className="flex gap-4 text-[10px] text-muted-foreground">
                <span>Latency: {benchResult.latencyMs}ms</span>
                <span>Prompt: {benchResult.promptTokens}</span>
                <span>Completion: {benchResult.completionTokens}</span>
                <span>Total: {benchResult.totalTokens}</span>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Self-Explanation */}
        {(explanationDisplay || showExplanationStream) && (
          <CollapsibleSection
            title="Self-Explanation"
            open={explanationOpen}
            onToggle={() => setExplanationOpen(!explanationOpen)}
            streaming={showExplanationStream && !!explanationStream}
          >
            <pre className="whitespace-pre-wrap text-xs text-amber-300/80 bg-amber-500/5 rounded p-2 max-h-48 overflow-auto">
              {explanationDisplay || "Generating explanation..."}
            </pre>
          </CollapsibleSection>
        )}

        {/* Assessment */}
        {(round.assessmentText || showAssessmentStream) && (
          <CollapsibleSection
            title="Assessment"
            open={assessOpen}
            onToggle={() => setAssessOpen(!assessOpen)}
            streaming={showAssessmentStream && !!assessmentStream}
          >
            <pre className="whitespace-pre-wrap text-xs max-h-64 overflow-auto">
              {round.assessmentText || assessmentStream || "Analyzing..."}
            </pre>
          </CollapsibleSection>
        )}

        {/* Proposal */}
        {(round.proposal || showProposalStream) && (
          <CollapsibleSection
            title="Proposed Changes"
            open={proposalOpen}
            onToggle={() => setProposalOpen(!proposalOpen)}
            streaming={showProposalStream && !!proposalStream}
          >
            {round.proposal ? (
              <ProposalDisplay proposal={round.proposal} />
            ) : proposalStream ? (
              <pre className="whitespace-pre-wrap text-xs max-h-64 overflow-auto">
                {proposalStream}
              </pre>
            ) : (
              <span className="text-xs text-muted-foreground">Thinking...</span>
            )}
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  badge,
  streaming,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  streaming?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t first:border-t-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-accent/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {streaming && <Loader2 className="h-3 w-3 animate-spin text-blue-500 ml-1" />}
        {badge && (
          <span className="ml-auto text-[10px] text-muted-foreground">{badge}</span>
        )}
      </button>
      {open && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
}

function ProposalDisplay({ proposal }: { proposal: NonNullable<TunerRound["proposal"]> }) {
  if (proposal.stopTuning) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="font-medium">Tuning complete</span>
        </div>
        {proposal.stopReason && (
          <p className="text-xs text-muted-foreground">{proposal.stopReason}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {proposal.reasoning && (
        <p className="text-xs text-muted-foreground italic">{proposal.reasoning}</p>
      )}

      {proposal.settingsChanges.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase">Settings Changes</div>
          <div className="rounded border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-2 py-1 font-medium">Parameter</th>
                  <th className="text-left px-2 py-1 font-medium">Old</th>
                  <th className="text-left px-2 py-1 font-medium">New</th>
                  <th className="text-left px-2 py-1 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {proposal.settingsChanges.map((sc, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1 font-mono">{sc.parameter}</td>
                    <td className="px-2 py-1 text-red-500">{JSON.stringify(sc.oldValue)}</td>
                    <td className="px-2 py-1 text-green-500">{JSON.stringify(sc.newValue)}</td>
                    <td className="px-2 py-1 text-muted-foreground">{sc.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {proposal.promptChanges.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase">Prompt Changes</div>
          {proposal.promptChanges.map((pc, i) => (
            <div key={i} className="rounded border p-2 space-y-1">
              <div className="text-[10px] font-mono text-muted-foreground truncate">{pc.filePath}</div>
              <div className="text-xs text-muted-foreground">{pc.reason}</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="bg-red-500/10 rounded p-1.5 font-mono whitespace-pre-wrap max-h-20 overflow-auto">
                  {pc.searchText}
                </div>
                <div className="bg-green-500/10 rounded p-1.5 font-mono whitespace-pre-wrap max-h-20 overflow-auto">
                  {pc.replaceText}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {proposal.settingsChanges.length === 0 && proposal.promptChanges.length === 0 && (
        <p className="text-xs text-muted-foreground">No changes proposed this round.</p>
      )}
    </div>
  );
}
