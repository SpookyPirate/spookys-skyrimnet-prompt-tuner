"use client";

import { useRef, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useCopycatStore } from "@/stores/copycatStore";
import { ProposalDisplay } from "@/components/shared/ProposalDisplay";
import type { CopycatPhase, CopycatRound, CopycatDialogueTurn } from "@/types/copycat";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const PHASE_LABELS: Record<CopycatPhase, string> = {
  idle: "Waiting",
  running_reference: "Running Reference",
  running_target: "Running Target",
  comparing: "Comparing Styles",
  proposing: "Proposing Changes",
  verifying: "Verifying",
  applying: "Applying Changes",
  complete: "Complete",
  error: "Error",
  stopped: "Stopped",
};

function PhaseIcon({ phase }: { phase: CopycatPhase }) {
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

export function CopycatCenter() {
  const phase = useCopycatStore((s) => s.phase);
  const currentRound = useCopycatStore((s) => s.currentRound);
  const maxRounds = useCopycatStore((s) => s.maxRounds);
  const rounds = useCopycatStore((s) => s.rounds);
  const comparisonStream = useCopycatStore((s) => s.comparisonStream);
  const proposalStream = useCopycatStore((s) => s.proposalStream);
  const isRunning = useCopycatStore((s) => s.isRunning);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRunning && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comparisonStream, proposalStream, isRunning, rounds]);

  if (phase === "idle" && rounds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        <div className="text-center space-y-2">
          <p>Configure the copycat in the left panel and click Start.</p>
          <p className="text-xs opacity-60">
            The copycat will run dialogue through both models, compare styles, and iteratively tune the target.
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
            <CopycatRoundCard
              key={round.roundNumber}
              round={round}
              isCurrentRound={idx === rounds.length - 1 && isRunning}
              comparisonStream={idx === rounds.length - 1 ? comparisonStream : ""}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function CopycatRoundCard({
  round,
  isCurrentRound,
  comparisonStream,
}: {
  round: CopycatRound;
  isCurrentRound: boolean;
  comparisonStream: string;
}) {
  const [refOpen, setRefOpen] = useState(round.roundNumber === 1);
  const [targetOpen, setTargetOpen] = useState(true);
  const [sideBySideOpen, setSideBySideOpen] = useState(true);
  const [comparisonOpen, setComparisonOpen] = useState(true);
  const [proposalOpen, setProposalOpen] = useState(true);
  const [verificationOpen, setVerificationOpen] = useState(true);

  const showComparisonStream = isCurrentRound && !round.comparisonText;

  return (
    <div className="rounded-lg border bg-card">
      {/* Round header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <PhaseIcon phase={round.phase} />
        <span className="text-xs font-medium">Round {round.roundNumber}</span>
        {round.effectivenessScore !== null && (
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 py-0 ml-auto ${
              round.effectivenessScore >= 80
                ? "border-green-500/30 text-green-400"
                : round.effectivenessScore >= 50
                  ? "border-yellow-500/30 text-yellow-400"
                  : "border-red-500/30 text-red-400"
            }`}
          >
            {round.effectivenessScore}% match
          </Badge>
        )}
        {round.error && (
          <span className="text-xs text-red-500 ml-auto">{round.error}</span>
        )}
      </div>

      <div className="space-y-0">
        {/* Reference Dialogue */}
        {round.referenceDialogue.length > 0 && (
          <CollapsibleSection
            title="Reference Dialogue"
            open={refOpen}
            onToggle={() => setRefOpen(!refOpen)}
            badge={round.roundNumber > 1 ? "Frozen from Round 1" : undefined}
          >
            <DialogueTurns turns={round.referenceDialogue} colorClass="text-blue-400" bgClass="bg-blue-500/5" />
          </CollapsibleSection>
        )}

        {/* Target Dialogue */}
        {round.targetDialogue.length > 0 && (
          <CollapsibleSection
            title="Target Dialogue"
            open={targetOpen}
            onToggle={() => setTargetOpen(!targetOpen)}
          >
            <DialogueTurns turns={round.targetDialogue} colorClass="text-amber-400" bgClass="bg-amber-500/5" />
          </CollapsibleSection>
        )}

        {/* Side-by-Side Comparison */}
        {round.referenceDialogue.length > 0 && round.targetDialogue.length > 0 && (
          <CollapsibleSection
            title="Side-by-Side"
            open={sideBySideOpen}
            onToggle={() => setSideBySideOpen(!sideBySideOpen)}
          >
            <div className="space-y-2">
              {round.referenceDialogue.map((refTurn, i) => {
                const targetTurn = round.targetDialogue[i];
                return (
                  <div key={i} className="space-y-1">
                    <div className="text-[10px] font-medium text-muted-foreground">{refTurn.label}</div>
                    <div className="grid grid-cols-2 gap-1">
                      <div className="rounded bg-blue-500/5 p-2">
                        <div className="text-[9px] font-medium text-blue-400 mb-0.5">Reference</div>
                        <pre className="whitespace-pre-wrap text-xs max-h-32 overflow-auto">{refTurn.response}</pre>
                      </div>
                      <div className="rounded bg-amber-500/5 p-2">
                        <div className="text-[9px] font-medium text-amber-400 mb-0.5">Target</div>
                        <pre className="whitespace-pre-wrap text-xs max-h-32 overflow-auto">{targetTurn?.response || "(no response)"}</pre>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Copycat Analysis */}
        {(round.comparisonText || showComparisonStream) && (
          <CollapsibleSection
            title="Copycat Analysis"
            open={comparisonOpen}
            onToggle={() => setComparisonOpen(!comparisonOpen)}
            streaming={showComparisonStream && !!comparisonStream}
          >
            <pre className="whitespace-pre-wrap text-xs max-h-64 overflow-auto">
              {round.comparisonText || comparisonStream || "Analyzing styles..."}
            </pre>
          </CollapsibleSection>
        )}

        {/* Proposed Changes */}
        {round.proposal && (
          <CollapsibleSection
            title="Proposed Changes"
            open={proposalOpen}
            onToggle={() => setProposalOpen(!proposalOpen)}
          >
            <ProposalDisplay proposal={round.proposal} />
          </CollapsibleSection>
        )}

        {/* Verification Runs */}
        {round.verificationRuns.length > 0 && (
          <CollapsibleSection
            title="Verification Runs"
            open={verificationOpen}
            onToggle={() => setVerificationOpen(!verificationOpen)}
          >
            <div className="space-y-2">
              {round.verificationRuns.map((vr, i) => (
                <div key={i} className="rounded border p-2 space-y-1">
                  <div className="text-[10px] text-muted-foreground italic">&quot;{vr.customLine}&quot;</div>
                  <pre className="whitespace-pre-wrap text-xs bg-muted/50 rounded p-1.5 max-h-32 overflow-auto">
                    {vr.response}
                  </pre>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

function DialogueTurns({
  turns,
  colorClass,
  bgClass,
}: {
  turns: CopycatDialogueTurn[];
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="space-y-2">
      {turns.map((turn, i) => (
        <div key={i} className="space-y-0.5">
          <div className={`text-[10px] font-medium uppercase tracking-wider ${colorClass}`}>
            {turn.label}
          </div>
          <pre className={`whitespace-pre-wrap text-xs ${bgClass} rounded p-2 max-h-48 overflow-auto`}>
            {turn.response || "(no response)"}
          </pre>
          {turn.latencyMs != null && (
            <div className="text-[9px] text-muted-foreground">
              {turn.latencyMs}ms {turn.totalTokens != null && `· ${turn.totalTokens} tok`}
            </div>
          )}
        </div>
      ))}
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
