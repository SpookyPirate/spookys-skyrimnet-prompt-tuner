"use client";

import { useState } from "react";
import { useSimulationStore } from "@/stores/simulationStore";
import { Badge } from "@/components/ui/badge";
import { Eye, ChevronDown, ChevronRight } from "lucide-react";

export function ActionSelectorPreview() {
  const useRealTemplate = useSimulationStore((s) => s.useRealActionTemplate);
  const setUseRealTemplate = useSimulationStore((s) => s.setUseRealActionTemplate);
  const preview = useSimulationStore((s) => s.lastActionSelectorPreview);
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Eye className="h-3.5 w-3.5" />
        <h3 className="text-xs font-semibold text-foreground">
          Action Selector Preview
        </h3>
      </div>

      <label className="flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          checked={useRealTemplate}
          onChange={(e) => setUseRealTemplate(e.target.checked)}
          className="h-3 w-3 accent-blue-500"
        />
        <span className="text-[10px]">Use Real Template</span>
      </label>

      {preview ? (
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
          {useRealTemplate
            ? "Send a message to see the rendered action selector"
            : "Enable \"Use Real Template\" and send a message"}
        </div>
      )}
    </div>
  );
}
