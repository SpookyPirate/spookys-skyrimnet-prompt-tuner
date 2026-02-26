"use client";

import { useSimulationStore } from "@/stores/simulationStore";
import { useConfigStore } from "@/stores/configStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGmLoop } from "@/hooks/useGmLoop";
import {
  Theater,
  SkipForward,
  RotateCcw,
  Timer,
  Loader2,
} from "lucide-react";

const GM_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idle: { label: "Idle", color: "text-muted-foreground" },
  planning: { label: "Planning...", color: "text-yellow-400" },
  running: { label: "Running", color: "text-green-400" },
  cooldown: { label: "Cooldown", color: "text-blue-400" },
};

export function GmControls() {
  const gmEnabled = useSimulationStore((s) => s.gmEnabled);
  const setGmEnabled = useSimulationStore((s) => s.setGmEnabled);
  const scenePlan = useSimulationStore((s) => s.scenePlan);
  const isPlanning = useSimulationStore((s) => s.isPlanning);
  const gmStatus = useSimulationStore((s) => s.gmStatus);
  const gmCooldown = useSimulationStore((s) => s.gmCooldown);
  const setGmCooldown = useSimulationStore((s) => s.setGmCooldown);
  const gmContinuousMode = useSimulationStore((s) => s.gmContinuousMode);
  const setGmContinuousMode = useSimulationStore((s) => s.setGmContinuousMode);
  const advanceBeat = useSimulationStore((s) => s.advanceBeat);
  const clearScenePlan = useSimulationStore((s) => s.clearScenePlan);
  const globalApiKey = useConfigStore((s) => s.globalApiKey);

  // Initialize the GM loop hook (manages its own lifecycle via store subscriptions)
  useGmLoop();

  if (!gmEnabled) {
    return (
      <div className="border-t px-2 py-1.5">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={gmEnabled}
            onChange={(e) => setGmEnabled(e.target.checked)}
            className="h-3 w-3 accent-purple-500"
            disabled={!globalApiKey}
          />
          <Theater className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-[10px] text-muted-foreground">
            GameMaster Mode
          </span>
        </label>
      </div>
    );
  }

  const statusInfo = GM_STATUS_LABELS[gmStatus] || GM_STATUS_LABELS.idle;

  return (
    <div className="border-t px-2 py-1.5 space-y-1.5 bg-purple-500/5">
      {/* Header: GM toggle + status */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={gmEnabled}
            onChange={(e) => setGmEnabled(e.target.checked)}
            className="h-3 w-3 accent-purple-500"
          />
          <Theater className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-[10px] font-semibold text-purple-400">
            GameMaster
          </span>
        </label>

        {isPlanning ? (
          <span className="flex items-center gap-1 text-[9px] text-yellow-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Planning...
          </span>
        ) : (
          <span className={`text-[9px] ${statusInfo.color}`}>
            {statusInfo.label}
            {gmStatus === "cooldown" && ` (${gmCooldown}s)`}
          </span>
        )}

        {scenePlan && (
          <Badge
            variant="outline"
            className="ml-auto text-[9px] px-1.5 py-0 border-purple-500/30"
          >
            Beat {scenePlan.currentBeatIndex + 1}/{scenePlan.beats.length}
          </Badge>
        )}
      </div>

      {/* Controls row: Continuous toggle + cooldown + beat controls */}
      <div className="flex items-center gap-3">
        {/* Continuous mode (F10 equivalent) */}
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={gmContinuousMode}
            onChange={(e) => setGmContinuousMode(e.target.checked)}
            disabled={isPlanning}
            className="h-2.5 w-2.5 accent-purple-500"
          />
          <span className="text-[9px] text-muted-foreground">Continuous</span>
        </label>

        {/* Cooldown slider */}
        <div className="flex items-center gap-1">
          <Timer className="h-3 w-3 text-muted-foreground" />
          <input
            type="range"
            min={gmContinuousMode ? 3 : 30}
            max={gmContinuousMode ? 30 : 300}
            step={gmContinuousMode ? 1 : 10}
            value={gmCooldown}
            onChange={(e) => setGmCooldown(Number(e.target.value))}
            className="h-1 w-14 accent-purple-500"
          />
          <span className="text-[9px] text-muted-foreground w-8 text-right">
            {gmCooldown}s
          </span>
        </div>

        {/* Beat controls (only in continuous mode with plan) */}
        {scenePlan && (
          <div className="flex gap-1 ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-5 text-[9px] gap-0.5 border-purple-500/30 px-1.5"
              onClick={advanceBeat}
              disabled={scenePlan.currentBeatIndex >= scenePlan.beats.length - 1}
            >
              <SkipForward className="h-2.5 w-2.5" />
              Beat
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 text-[9px] gap-0.5 px-1.5"
              onClick={clearScenePlan}
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Current beat display (continuous mode only) */}
      {scenePlan && scenePlan.beats[scenePlan.currentBeatIndex] && (
        <div className="rounded border border-purple-500/20 bg-purple-500/5 p-1.5">
          <div className="text-[9px] text-purple-400 font-semibold mb-0.5">
            Current Beat: {scenePlan.beats[scenePlan.currentBeatIndex].type}
          </div>
          <div className="text-[10px] text-foreground/80">
            {scenePlan.beats[scenePlan.currentBeatIndex].description}
          </div>
        </div>
      )}
    </div>
  );
}
