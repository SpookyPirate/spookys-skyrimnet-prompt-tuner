"use client";

import { useState } from "react";
import { useSimulationStore } from "@/stores/simulationStore";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

export function ActionSelectorPreviewContent() {
  const preview = useSimulationStore((s) => s.lastActionSelectorPreview);
  const [expanded, setExpanded] = useState(false);

  return preview ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Parsed Action:</span>
            <Badge variant="secondary" className="text-[10px]">
              {preview.parsedAction || "None"}
            </Badge>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Rendered Prompt
          </button>

          {expanded && (
            <div className="space-y-1.5">
              <pre className="max-h-40 overflow-auto rounded border bg-background p-1.5 text-[9px] font-mono whitespace-pre-wrap">
                {preview.renderedPrompt || "(empty)"}
              </pre>
              {preview.rawResponse && (
                <>
                  <span className="text-[9px] text-muted-foreground font-semibold">
                    LLM Response:
                  </span>
                  <pre className="max-h-20 overflow-auto rounded border bg-background p-1.5 text-[9px] font-mono whitespace-pre-wrap">
                    {preview.rawResponse}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
  ) : (
    <div className="rounded-md border border-dashed p-2 text-center text-[10px] text-muted-foreground">
      Send a message to see the rendered action selector
    </div>
  );
}
