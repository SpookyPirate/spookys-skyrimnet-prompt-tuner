"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAutoTunerStore } from "@/stores/autoTunerStore";
import { useProfileStore } from "@/stores/profileStore";
import { useAppStore } from "@/stores/appStore";
import { saveSettingsToProfile, savePromptsToSet, deleteTunerTempSet } from "@/lib/autotuner/save-results";
import type { AiTuningSettings } from "@/types/config";
import type { TunerPhase } from "@/types/autotuner";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";

const PHASE_LABELS: Record<TunerPhase, string> = {
  idle: "Idle",
  benchmarking: "Benchmarking",
  assessing: "Assessing",
  proposing: "Proposing",
  applying: "Applying",
  complete: "Complete",
  error: "Error",
  stopped: "Stopped",
};

export function AutoTunerReport() {
  const phase = useAutoTunerStore((s) => s.phase);
  const rounds = useAutoTunerStore((s) => s.rounds);
  const isRunning = useAutoTunerStore((s) => s.isRunning);
  const originalSettings = useAutoTunerStore((s) => s.originalSettings);
  const workingSettings = useAutoTunerStore((s) => s.workingSettings);
  const selectedCategory = useAutoTunerStore((s) => s.selectedCategory);
  const selectedProfileId = useAutoTunerStore((s) => s.selectedProfileId);
  const workingPromptSet = useAutoTunerStore((s) => s.workingPromptSet);

  const profiles = useProfileStore((s) => s.profiles);
  const activePromptSet = useAppStore((s) => s.activePromptSet);

  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPrompts, setSavingPrompts] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [promptsSaved, setPromptsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [targetProfileId, setTargetProfileId] = useState(selectedProfileId);
  const [promptSetTarget, setPromptSetTarget] = useState(activePromptSet || "tuned-v1");

  const hasChanges = rounds.length > 0;
  const hasSettingsChanges = rounds.some(
    (r) => r.proposal?.settingsChanges && r.proposal.settingsChanges.length > 0
  );
  const hasPromptChanges = rounds.some(
    (r) => r.proposal?.promptChanges && r.proposal.promptChanges.length > 0
  );

  const handleSaveSettings = useCallback(async () => {
    if (!selectedCategory || !workingSettings) return;
    setSavingSettings(true);
    setSaveError(null);
    try {
      saveSettingsToProfile(targetProfileId, selectedCategory, workingSettings);
      setSettingsSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }, [selectedCategory, workingSettings, targetProfileId]);

  const handleSavePrompts = useCallback(async () => {
    if (!workingPromptSet) return;
    setSavingPrompts(true);
    setSaveError(null);
    try {
      await savePromptsToSet(promptSetTarget);
      setPromptsSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save prompts");
    } finally {
      setSavingPrompts(false);
    }
  }, [workingPromptSet, promptSetTarget]);

  const handleDiscardTemp = useCallback(async () => {
    await deleteTunerTempSet();
  }, []);

  if (phase === "idle" && rounds.length === 0) {
    return (
      <div className="flex h-full flex-col bg-card">
        <div className="flex h-8 items-center border-b px-3">
          <span className="text-xs font-medium text-muted-foreground">
            Tuning Report
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-xs text-muted-foreground p-4">
            Run the auto tuner to see results here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-8 items-center border-b px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Tuning Report
        </span>
      </div>
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-3 space-y-4">
          {/* Status */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Status
            </div>
            <div className="flex items-center gap-2 px-1">
              {phase === "complete" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : phase === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              ) : isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
              )}
              <span className="text-xs">{PHASE_LABELS[phase]}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">
                {rounds.length} round{rounds.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Settings Diff */}
          {originalSettings && workingSettings && hasSettingsChanges && (
            <>
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Settings Changes
                </div>
                <SettingsDiffTable
                  original={originalSettings}
                  modified={workingSettings}
                />
              </div>
              <Separator />
            </>
          )}

          {/* Round Timeline */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Round Summary
            </div>
            <div className="space-y-1 px-1">
              {rounds.map((round) => (
                <div
                  key={round.roundNumber}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="font-mono text-muted-foreground w-4 shrink-0 text-right">
                    {round.roundNumber}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {round.phase === "complete" ? (
                        <CheckCircle2 className="h-2.5 w-2.5 text-green-500 shrink-0" />
                      ) : round.phase === "error" ? (
                        <AlertCircle className="h-2.5 w-2.5 text-red-500 shrink-0" />
                      ) : (
                        <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-500 shrink-0" />
                      )}
                      <span className="truncate">
                        {round.proposal?.stopTuning
                          ? "Stopped — performing well"
                          : round.error
                            ? `Error: ${round.error}`
                            : round.proposal
                              ? `${round.proposal.settingsChanges.length} setting${round.proposal.settingsChanges.length !== 1 ? "s" : ""}, ${round.proposal.promptChanges.length} prompt change${round.proposal.promptChanges.length !== 1 ? "s" : ""}`
                              : PHASE_LABELS[round.phase]
                        }
                      </span>
                    </div>
                    {round.benchmarkResult && (
                      <div className="text-[10px] text-muted-foreground">
                        {round.benchmarkResult.latencyMs}ms · {round.benchmarkResult.totalTokens} tok
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Section */}
          {hasChanges && !isRunning && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Save Results
                </div>

                {/* Save Settings */}
                {hasSettingsChanges && workingSettings && (
                  <div className="space-y-1 px-1">
                    <div className="text-[10px] text-muted-foreground">Save settings to profile:</div>
                    <select
                      value={targetProfileId}
                      onChange={(e) => setTargetProfileId(e.target.value)}
                      className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.id === selectedProfileId ? " (tuned)" : ""}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      disabled={savingSettings || settingsSaved}
                      onClick={handleSaveSettings}
                    >
                      {savingSettings ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : settingsSaved ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      {settingsSaved ? "Settings Saved" : "Save Settings"}
                    </Button>
                  </div>
                )}

                {/* Save Prompts */}
                {hasPromptChanges && workingPromptSet && (
                  <div className="space-y-1 px-1">
                    <div className="text-[10px] text-muted-foreground">Save prompts to set:</div>
                    <input
                      type="text"
                      value={promptSetTarget}
                      onChange={(e) => setPromptSetTarget(e.target.value)}
                      className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground"
                      placeholder="Prompt set name"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      disabled={savingPrompts || promptsSaved || !promptSetTarget}
                      onClick={handleSavePrompts}
                    >
                      {savingPrompts ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : promptsSaved ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      {promptsSaved ? "Prompts Saved" : "Save Prompts"}
                    </Button>
                  </div>
                )}

                {/* Discard temp set */}
                {workingPromptSet && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1.5 text-xs text-muted-foreground"
                    onClick={handleDiscardTemp}
                  >
                    <Trash2 className="h-3 w-3" />
                    Discard Temp Changes
                  </Button>
                )}

                {saveError && (
                  <div className="text-xs text-destructive px-1">{saveError}</div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SettingsDiffTable({
  original,
  modified,
}: {
  original: AiTuningSettings;
  modified: AiTuningSettings;
}) {
  const keys = Object.keys(original) as (keyof AiTuningSettings)[];
  const changedKeys = keys.filter(
    (k) => JSON.stringify(original[k]) !== JSON.stringify(modified[k])
  );

  if (changedKeys.length === 0) {
    return (
      <div className="text-xs text-muted-foreground px-1">No settings changed.</div>
    );
  }

  return (
    <div className="rounded border overflow-hidden">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-2 py-1 font-medium">Parameter</th>
            <th className="text-left px-2 py-1 font-medium">Before</th>
            <th className="text-left px-2 py-1 font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {changedKeys.map((key) => (
            <tr key={key} className="border-t">
              <td className="px-2 py-1 font-mono">{key}</td>
              <td className="px-2 py-1 text-red-500 font-mono">
                {JSON.stringify(original[key])}
              </td>
              <td className="px-2 py-1 text-green-500 font-mono">
                {JSON.stringify(modified[key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
