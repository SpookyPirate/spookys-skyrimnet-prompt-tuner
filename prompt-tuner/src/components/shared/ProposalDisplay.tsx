"use client";

import type { TunerRound } from "@/types/autotuner";
import { CheckCircle2 } from "lucide-react";

export function ProposalDisplay({ proposal }: { proposal: NonNullable<TunerRound["proposal"]> }) {
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
