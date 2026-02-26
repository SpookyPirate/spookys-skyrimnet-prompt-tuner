"use client";

import { useTriggerStore } from "@/stores/triggerStore";
import { Badge } from "@/components/ui/badge";
import { Target, Check, X, Ban } from "lucide-react";

export function TriggerMatchResults() {
  const results = useTriggerStore((s) => s.lastMatchResults);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Target className="h-3.5 w-3.5" />
        <h3 className="text-xs font-semibold text-foreground">
          Trigger Match Results
        </h3>
      </div>

      {results.length > 0 ? (
        <div className="space-y-1.5">
          {results.map((result, i) => (
            <div key={i} className="rounded border p-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 mb-1">
                {result.matched ? (
                  <Badge className="bg-green-600 text-[9px] px-1.5 py-0 gap-0.5">
                    <Check className="h-2.5 w-2.5" />
                    Match
                  </Badge>
                ) : result.blockedReason ? (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-0.5">
                    <Ban className="h-2.5 w-2.5" />
                    Blocked
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 gap-0.5">
                    <X className="h-2.5 w-2.5" />
                    Miss
                  </Badge>
                )}
                <span className="font-semibold">{result.trigger.name}</span>
              </div>

              {result.matchedConditions.length > 0 && (
                <div className="ml-2 space-y-0.5">
                  {result.matchedConditions.map((c, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-1 text-[9px] text-green-400"
                    >
                      <Check className="h-2.5 w-2.5 shrink-0" />
                      <span className="font-mono">{c}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.failedConditions.length > 0 && (
                <div className="ml-2 space-y-0.5">
                  {result.failedConditions.map((c, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-1 text-[9px] text-red-400"
                    >
                      <X className="h-2.5 w-2.5 shrink-0" />
                      <span className="font-mono">{c}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.blockedReason && (
                <div className="ml-2 text-[9px] text-yellow-500">
                  {result.blockedReason}
                </div>
              )}

              {result.renderedResponse && (
                <div className="mt-1 rounded bg-background p-1.5">
                  <span className="text-[9px] text-muted-foreground">
                    Response:
                  </span>
                  <p className="text-[10px] italic mt-0.5">
                    {result.renderedResponse}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-2 text-center text-[10px] text-muted-foreground">
          Fire an event to see trigger matches
        </div>
      )}
    </div>
  );
}
