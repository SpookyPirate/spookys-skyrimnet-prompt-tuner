"use client";

import { useCallback } from "react";
import { useSimulationStore } from "@/stores/simulationStore";
import { useConfigStore } from "@/stores/configStore";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sendLlmRequest } from "@/lib/llm/client";
import {
  Theater,
  Play,
  SkipForward,
  RotateCcw,
  Loader2,
} from "lucide-react";
import type { SceneBeat, ScenePlan } from "@/types/gamemaster";

export function GmControls() {
  const gmEnabled = useSimulationStore((s) => s.gmEnabled);
  const setGmEnabled = useSimulationStore((s) => s.setGmEnabled);
  const scenePlan = useSimulationStore((s) => s.scenePlan);
  const isPlanning = useSimulationStore((s) => s.isPlanning);
  const setIsPlanning = useSimulationStore((s) => s.setIsPlanning);
  const setScenePlan = useSimulationStore((s) => s.setScenePlan);
  const gmAutoAdvance = useSimulationStore((s) => s.gmAutoAdvance);
  const setGmAutoAdvance = useSimulationStore((s) => s.setGmAutoAdvance);
  const gmContinuousMode = useSimulationStore((s) => s.gmContinuousMode);
  const setGmContinuousMode = useSimulationStore((s) => s.setGmContinuousMode);
  const advanceBeat = useSimulationStore((s) => s.advanceBeat);
  const clearScenePlan = useSimulationStore((s) => s.clearScenePlan);
  const selectedNpcs = useSimulationStore((s) => s.selectedNpcs);
  const scene = useSimulationStore((s) => s.scene);
  const addLlmCall = useSimulationStore((s) => s.addLlmCall);
  const globalApiKey = useConfigStore((s) => s.globalApiKey);
  const activePromptSet = useAppStore((s) => s.activePromptSet);

  const handlePlanScene = useCallback(async () => {
    if (!globalApiKey) return;
    setIsPlanning(true);

    try {
      const npcNames = selectedNpcs.map((n) => n.displayName).join(", ");
      const messages = [
        {
          role: "system" as const,
          content: `You are a Skyrim GameMaster scene planner. Plan a dramatic scene with clear beats.
Output JSON only (no markdown fences):
{
  "summary": "one sentence scene summary",
  "tone": "dramatic|humorous|tense|mysterious|somber",
  "tension": "low|medium|high",
  "beats": [
    {
      "order": 1,
      "type": "dialogue|narration|action|transition",
      "description": "what happens",
      "primaryCharacters": ["Name1"],
      "purpose": "why this beat matters"
    }
  ]
}`,
        },
        {
          role: "user" as const,
          content: `Location: ${scene.location}\nNPCs: ${npcNames || "None specified"}\nScene context: ${scene.scenePrompt || "General Skyrim scene"}\n\nPlan a scene with 3-6 beats.`,
        },
      ];

      const log = await sendLlmRequest({ messages, agent: "game_master" });
      addLlmCall(log);

      if (log.response) {
        try {
          // Strip markdown fences if present
          const jsonStr = log.response.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(jsonStr);
          const plan: ScenePlan = {
            summary: parsed.summary || "Scene plan",
            tone: parsed.tone || "dramatic",
            tension: parsed.tension || "medium",
            beats: (parsed.beats || []).map((b: Partial<SceneBeat>, i: number) => ({
              order: b.order || i + 1,
              type: b.type || "dialogue",
              description: b.description || "",
              primaryCharacters: b.primaryCharacters || [],
              purpose: b.purpose || "",
            })),
            currentBeatIndex: 0,
            upcomingBeats: [],
          };
          plan.upcomingBeats = plan.beats.slice(1).map((b) => b.description);
          setScenePlan(plan);
        } catch {
          console.error("Failed to parse scene plan:", log.response);
        }
      }
    } catch (e) {
      console.error("Scene planning failed:", e);
    } finally {
      setIsPlanning(false);
    }
  }, [
    globalApiKey, selectedNpcs, scene, setIsPlanning, setScenePlan, addLlmCall, activePromptSet,
  ]);

  if (!gmEnabled) {
    return (
      <div className="border-t px-2 py-1.5">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={gmEnabled}
            onChange={(e) => setGmEnabled(e.target.checked)}
            className="h-3 w-3 accent-purple-500"
          />
          <Theater className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-[10px] text-muted-foreground">
            GameMaster Mode
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="border-t px-2 py-1.5 space-y-1.5 bg-purple-500/5">
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

        {scenePlan && (
          <Badge
            variant="outline"
            className="ml-auto text-[9px] px-1.5 py-0 border-purple-500/30"
          >
            Beat {scenePlan.currentBeatIndex + 1}/{scenePlan.beats.length}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-5 text-[9px] gap-1 border-purple-500/30"
          onClick={handlePlanScene}
          disabled={isPlanning}
        >
          {isPlanning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          Plan Scene
        </Button>

        {scenePlan && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-5 text-[9px] gap-1 border-purple-500/30"
              onClick={advanceBeat}
              disabled={scenePlan.currentBeatIndex >= scenePlan.beats.length - 1}
            >
              <SkipForward className="h-3 w-3" />
              Next Beat
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 text-[9px] gap-1"
              onClick={clearScenePlan}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={gmAutoAdvance}
            onChange={(e) => setGmAutoAdvance(e.target.checked)}
            className="h-2.5 w-2.5 accent-purple-500"
          />
          <span className="text-[9px] text-muted-foreground">Auto-advance</span>
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={gmContinuousMode}
            onChange={(e) => setGmContinuousMode(e.target.checked)}
            className="h-2.5 w-2.5 accent-purple-500"
          />
          <span className="text-[9px] text-muted-foreground">Continuous</span>
        </label>
      </div>

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
