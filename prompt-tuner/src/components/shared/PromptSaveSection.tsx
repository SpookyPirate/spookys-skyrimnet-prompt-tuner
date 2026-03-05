"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PromptReviewDialog } from "./PromptReviewDialog";
import { SaveModeOption } from "./SaveModeOption";
import { CheckCircle2, Save, FolderOpen } from "lucide-react";
import type { TuningTarget } from "@/types/autotuner";
import type { TunerRound } from "@/types/autotuner";
import type { CopycatRound } from "@/types/copycat";

interface PromptSaveSectionProps {
  rounds: (TunerRound | CopycatRound)[];
  workingPromptSet: string | null;
  tuningTarget: TuningTarget;
  onSaved?: () => void;
}

export function PromptSaveSection({
  rounds,
  workingPromptSet,
  tuningTarget,
  onSaved,
}: PromptSaveSectionProps) {
  type PromptSaveMode = "new" | "existing";
  const [promptSaveMode, setPromptSaveMode] = useState<PromptSaveMode>("new");
  const [promptSetTarget, setPromptSetTarget] = useState("");
  const [existingSets, setExistingSets] = useState<string[]>([]);
  const [existingSetTarget, setExistingSetTarget] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [promptsSaved, setPromptsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const modifiedFilePaths = useMemo(() => {
    const seen = new Set<string>();
    for (const round of rounds) {
      for (const pc of round.proposal?.promptChanges ?? []) {
        seen.add(pc.filePath);
      }
    }
    return Array.from(seen);
  }, [rounds]);

  const hasPromptChanges =
    tuningTarget !== "settings" && modifiedFilePaths.length > 0;

  useEffect(() => {
    if (!hasPromptChanges || !workingPromptSet) return;
    fetch("/api/export/list-sets")
      .then((r) => r.json())
      .then((data) => {
        const sets: string[] = (data.sets ?? []).filter(
          (s: string) => s !== "__tuner_temp__"
        );
        setExistingSets(sets);
        if (sets.length > 0 && !existingSetTarget) {
          setExistingSetTarget(sets[0]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPromptChanges, workingPromptSet]);

  const effectiveTarget =
    promptSaveMode === "existing" ? existingSetTarget : promptSetTarget;

  const handleOpenReview = useCallback(() => {
    if (!effectiveTarget.trim()) {
      setSaveError("Enter a prompt set name.");
      return;
    }
    if (modifiedFilePaths.length === 0) {
      setSaveError("No prompt changes to save.");
      return;
    }
    setSaveError(null);
    setReviewDialogOpen(true);
  }, [effectiveTarget, modifiedFilePaths]);

  const handlePromptsSaved = useCallback(() => {
    setPromptsSaved(true);
    onSaved?.();
  }, [onSaved]);

  if (!hasPromptChanges || !workingPromptSet) return null;

  return (
    <div className="space-y-2 px-1">
      <div className="text-[10px] text-muted-foreground">Save prompts to set:</div>

      <SaveModeOption
        selected={promptSaveMode === "new"}
        onSelect={() => setPromptSaveMode("new")}
        disabled={promptsSaved}
        label="Save as new set"
        description="Create a new prompt set with these changes"
        icon={<Save className="h-3 w-3" />}
      >
        {promptSaveMode === "new" && (
          <input
            type="text"
            value={promptSetTarget}
            onChange={(e) => setPromptSetTarget(e.target.value)}
            className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground mt-1"
            placeholder="Enter new set name…"
            autoFocus
          />
        )}
      </SaveModeOption>

      <SaveModeOption
        selected={promptSaveMode === "existing"}
        onSelect={() => setPromptSaveMode("existing")}
        disabled={promptsSaved}
        label="Overwrite existing set"
        description="Apply changes to prompts in an existing set"
        icon={<FolderOpen className="h-3 w-3" />}
      >
        {promptSaveMode === "existing" && (
          existingSets.length > 0 ? (
            <select
              value={existingSetTarget}
              onChange={(e) => setExistingSetTarget(e.target.value)}
              className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground mt-1 [&>option]:bg-background [&>option]:text-foreground"
            >
              {existingSets.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <div className="text-[10px] text-muted-foreground mt-1 pl-1">
              No existing prompt sets found.
            </div>
          )
        )}
      </SaveModeOption>

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        disabled={
          promptsSaved ||
          (promptSaveMode === "new" && !promptSetTarget.trim()) ||
          (promptSaveMode === "existing" && !existingSetTarget)
        }
        onClick={handleOpenReview}
      >
        {promptsSaved ? (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        ) : (
          <Save className="h-3 w-3" />
        )}
        {promptsSaved ? "Prompts Saved" : "Review & Save Prompts"}
      </Button>

      {saveError && (
        <div className="text-xs text-destructive">{saveError}</div>
      )}

      {reviewDialogOpen && (
        <PromptReviewDialog
          open={reviewDialogOpen}
          onClose={() => setReviewDialogOpen(false)}
          targetSetName={effectiveTarget}
          tempFilePaths={modifiedFilePaths}
          onSaved={handlePromptsSaved}
        />
      )}
    </div>
  );
}
