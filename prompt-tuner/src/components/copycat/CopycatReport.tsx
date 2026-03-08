"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useCopycatStore } from "@/stores/copycatStore";
import { useProfileStore } from "@/stores/profileStore";
import { saveCopycatToExistingProfile, saveCopycatToNewProfile } from "@/lib/copycat/save-copycat-results";
import { deleteTunerTempSet } from "@/lib/autotuner/save-results";
import { buildCopycatReport } from "@/lib/copycat/export-copycat-report";
import { PromptSaveSection } from "@/components/shared/PromptSaveSection";
import { SaveModeOption } from "@/components/shared/SaveModeOption";
import type { AiTuningSettings } from "@/types/config";
import type { CopycatPhase } from "@/types/copycat";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Trash2,
  Copy,
  Download,
} from "lucide-react";

const PHASE_LABELS: Record<CopycatPhase, string> = {
  idle: "Idle",
  running_reference: "Running Reference",
  running_target: "Running Target",
  comparing: "Comparing",
  proposing: "Proposing",
  verifying: "Verifying",
  applying: "Applying",
  complete: "Complete",
  error: "Error",
  stopped: "Stopped",
};

export function CopycatReport() {
  const phase = useCopycatStore((s) => s.phase);
  const rounds = useCopycatStore((s) => s.rounds);
  const isRunning = useCopycatStore((s) => s.isRunning);
  const originalSettings = useCopycatStore((s) => s.originalSettings);
  const workingSettings = useCopycatStore((s) => s.workingSettings);
  const referenceModelId = useCopycatStore((s) => s.referenceModelId);
  const targetModelId = useCopycatStore((s) => s.targetModelId);
  const workingPromptSet = useCopycatStore((s) => s.workingPromptSet);
  const tuningTarget = useCopycatStore((s) => s.tuningTarget);
  const effectivenessSummary = useCopycatStore((s) => s.effectivenessSummary);

  const profiles = useProfileStore((s) => s.profiles);

  const hasChanges = rounds.length > 0;
  const hasSettingsChanges = rounds.some(
    (r) => r.proposal?.settingsChanges && r.proposal.settingsChanges.length > 0
  );

  type SaveMode = "copy" | "other";
  const [saveMode, setSaveMode] = useState<SaveMode>("copy");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copyName, setCopyName] = useState("");
  const [otherProfileId, setOtherProfileId] = useState(() => profiles[0]?.id || "");

  // Effectiveness score display
  const scores = rounds
    .filter((r) => r.effectivenessScore !== null)
    .map((r) => r.effectivenessScore!);
  const latestScore = effectivenessSummary ?? (scores.length > 0 ? scores[scores.length - 1] : null);

  // Reset saved indicator when user changes save mode or inputs
  useEffect(() => { setSettingsSaved(false); }, [saveMode, copyName, otherProfileId]);

  const handleSaveSettings = useCallback(async () => {
    if (!workingSettings) {
      setSaveError("No tuned settings available. Run the copycat first.");
      return;
    }
    setSavingSettings(true);
    setSaveError(null);
    try {
      if (saveMode === "copy") {
        if (!copyName.trim()) throw new Error("Enter a profile name.");
        saveCopycatToNewProfile(copyName.trim(), targetModelId, workingSettings);
      } else {
        if (!otherProfileId) throw new Error("Select a profile.");
        saveCopycatToExistingProfile(otherProfileId, workingSettings);
      }
      setSettingsSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }, [workingSettings, saveMode, copyName, otherProfileId, targetModelId]);

  const handleDiscardTemp = useCallback(async () => {
    await deleteTunerTempSet();
  }, []);

  const handleExport = useCallback(() => {
    const md = buildCopycatReport({
      referenceModelId,
      targetModelId,
      tuningTarget,
      customInstructions: useCopycatStore.getState().customInstructions,
      rounds,
      originalSettings,
      workingSettings,
    });
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `copycat-report-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [referenceModelId, targetModelId, tuningTarget, rounds, originalSettings, workingSettings]);

  if (phase === "idle" && rounds.length === 0) {
    return (
      <div className="flex h-full flex-col bg-card">
        <div className="flex h-8 items-center border-b px-3">
          <span className="text-xs font-medium text-muted-foreground">
            Copycat Report
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-xs text-muted-foreground p-4">
            Run the copycat to see results here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-8 items-center border-b px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Copycat Report
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

          {/* Effectiveness */}
          {latestScore !== null && (
            <>
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Effectiveness
                </div>
                <div className="px-1">
                  <div className={`text-2xl font-bold ${
                    latestScore >= 80
                      ? "text-green-400"
                      : latestScore >= 50
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}>
                    {latestScore}%
                  </div>
                  <div className="w-full bg-muted/50 rounded-full h-1.5 mt-1">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        latestScore >= 80
                          ? "bg-green-500"
                          : latestScore >= 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${latestScore}%` }}
                    />
                  </div>
                  {scores.length > 1 && (
                    <div className="flex items-end gap-0.5 mt-2 h-8">
                      {scores.map((score, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-t ${
                            score >= 80
                              ? "bg-green-500/60"
                              : score >= 50
                                ? "bg-yellow-500/60"
                                : "bg-red-500/60"
                          }`}
                          style={{ height: `${Math.max(4, (score / 100) * 32)}px` }}
                          title={`Round ${i + 1}: ${score}%`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

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

          {/* Round Summary */}
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
                        {round.effectivenessScore !== null
                          ? `${round.effectivenessScore}% match`
                          : round.error
                            ? `Error: ${round.error}`
                            : PHASE_LABELS[round.phase]
                        }
                      </span>
                    </div>
                    {round.proposal && (
                      <div className="text-[10px] text-muted-foreground">
                        {round.proposal.settingsChanges.length} setting{round.proposal.settingsChanges.length !== 1 ? "s" : ""},
                        {" "}{round.proposal.promptChanges.length} prompt change{round.proposal.promptChanges.length !== 1 ? "s" : ""}
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
                  <div className="space-y-2 px-1">
                    <div className="text-[10px] text-muted-foreground">Save settings to:</div>

                    <SaveModeOption
                      selected={saveMode === "copy"}
                      onSelect={() => setSaveMode("copy")}
                      label="Save as new profile"
                      description="Create a new profile with the tuned settings"
                      icon={<Copy className="h-3 w-3" />}
                    >
                      {saveMode === "copy" && (
                        <input
                          type="text"
                          value={copyName}
                          onChange={(e) => setCopyName(e.target.value)}
                          className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground mt-1"
                          placeholder="Enter new profile name…"
                          autoFocus
                        />
                      )}
                    </SaveModeOption>

                    {profiles.length > 0 && (
                      <SaveModeOption
                        selected={saveMode === "other"}
                        onSelect={() => setSaveMode("other")}
                        label="Apply to existing profile"
                        description="Update an existing profile's agent settings"
                        icon={<Save className="h-3 w-3" />}
                      >
                        {saveMode === "other" && (
                          <select
                            value={otherProfileId}
                            onChange={(e) => setOtherProfileId(e.target.value)}
                            className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground mt-1 [&>option]:bg-background [&>option]:text-foreground"
                          >
                            {profiles.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        )}
                      </SaveModeOption>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      disabled={
                        savingSettings ||
                        (saveMode === "copy" && !copyName.trim()) ||
                        (saveMode === "other" && !otherProfileId)
                      }
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

                {/* Save Prompts — shared component */}
                <PromptSaveSection
                  rounds={rounds}
                  workingPromptSet={workingPromptSet}
                  tuningTarget={tuningTarget}
                />

                {/* Discard temp prompt set */}
                {workingPromptSet && tuningTarget !== "settings" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1.5 text-xs text-muted-foreground"
                    onClick={handleDiscardTemp}
                  >
                    <Trash2 className="h-3 w-3" />
                    Discard Changes
                  </Button>
                )}

                {saveError && (
                  <div className="text-xs text-destructive px-1">{saveError}</div>
                )}
              </div>
            </>
          )}

          {/* Export */}
          {rounds.length > 0 && (
            <>
              <Separator />
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={handleExport}
              >
                <Download className="h-3 w-3" />
                Export Report
              </Button>
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
