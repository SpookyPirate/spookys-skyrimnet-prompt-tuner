"use client";

import { useSimulationStore } from "@/stores/simulationStore";
import { Badge } from "@/components/ui/badge";
import { Theater } from "lucide-react";

export function ScenePlanDisplay() {
  const scenePlan = useSimulationStore((s) => s.scenePlan);
  const gmActionLog = useSimulationStore((s) => s.gmActionLog);
  const gmEnabled = useSimulationStore((s) => s.gmEnabled);

  if (!gmEnabled) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Theater className="h-3.5 w-3.5 text-purple-400" />
        <h3 className="text-xs font-semibold text-foreground">
          GameMaster Scene
        </h3>
      </div>

      {scenePlan ? (
        <div className="space-y-2">
          {/* Scene info */}
          <div className="rounded border p-1.5 text-[10px]">
            <div className="font-semibold mb-0.5">{scenePlan.summary}</div>
            <div className="flex gap-2 text-[9px] text-muted-foreground">
              <span>
                Tone:{" "}
                <Badge variant="outline" className="text-[8px] px-1 py-0">
                  {scenePlan.tone}
                </Badge>
              </span>
              <span>
                Tension:{" "}
                <Badge
                  variant="outline"
                  className={`text-[8px] px-1 py-0 ${
                    scenePlan.tension === "high"
                      ? "border-red-500/50 text-red-400"
                      : scenePlan.tension === "medium"
                      ? "border-yellow-500/50 text-yellow-400"
                      : "border-green-500/50 text-green-400"
                  }`}
                >
                  {scenePlan.tension}
                </Badge>
              </span>
            </div>
          </div>

          {/* Beat list */}
          <div className="space-y-0.5">
            {scenePlan.beats.map((beat, i) => (
              <div
                key={i}
                className={`flex items-start gap-1.5 rounded px-1.5 py-1 text-[10px] ${
                  i === scenePlan.currentBeatIndex
                    ? "bg-purple-500/10 border border-purple-500/30"
                    : i < scenePlan.currentBeatIndex
                    ? "opacity-50"
                    : ""
                }`}
              >
                <Badge
                  variant={i === scenePlan.currentBeatIndex ? "default" : "outline"}
                  className="text-[8px] px-1 py-0 shrink-0 mt-0.5"
                >
                  {beat.order}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold capitalize">{beat.type}</span>
                    {beat.primaryCharacters.length > 0 && (
                      <span className="text-[9px] text-muted-foreground">
                        ({beat.primaryCharacters.join(", ")})
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground">{beat.description}</div>
                </div>
              </div>
            ))}
          </div>

          {/* GM Action Log */}
          {gmActionLog.length > 0 && (
            <div>
              <span className="text-[9px] text-muted-foreground font-semibold">
                GM Actions ({gmActionLog.length})
              </span>
              <div className="mt-0.5 max-h-32 overflow-auto space-y-0.5">
                {gmActionLog.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 text-[9px] rounded px-1 py-0.5 bg-accent/30"
                  >
                    <Badge
                      variant="outline"
                      className="text-[8px] px-1 py-0 shrink-0"
                    >
                      B{entry.beatIndex + 1}
                    </Badge>
                    <span className="font-mono font-semibold">
                      {entry.action}
                    </span>
                    {entry.params.speaker && (
                      <span className="text-muted-foreground">
                        by {entry.params.speaker}
                      </span>
                    )}
                    {entry.params.topic && (
                      <span className="text-muted-foreground truncate">
                        re: {entry.params.topic}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-purple-500/20 p-2 text-center text-[10px] text-muted-foreground">
          Click &quot;Plan Scene&quot; in the chat controls to start
        </div>
      )}
    </div>
  );
}
