"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCopycatStore, COPYCAT_DEFAULT_SETTINGS } from "@/stores/copycatStore";
import { useProfileStore } from "@/stores/profileStore";
import { useAppStore } from "@/stores/appStore";
import { useBenchmarkStore } from "@/stores/benchmarkStore";
import { getBuiltinScenarios, findBuiltinScenario, getDefaultScenario } from "@/lib/benchmark/default-scenarios";
import { runCopycatLoop, stopCopycatLoop } from "@/lib/copycat/run-copycat-loop";
import { CustomScenarioDialog } from "@/components/benchmark/CustomScenarioDialog";
import { ScenarioSelector } from "@/components/shared/ScenarioSelector";
import type { TuningTarget } from "@/types/autotuner";
import type { AiTuningSettings } from "@/types/config";
import {
  Square,
  Play,
  Settings2,
  ChevronRight,
  RotateCcw,
  CopyCheck,
} from "lucide-react";

const TUNING_TARGET_OPTIONS: { value: TuningTarget; label: string; description: string }[] = [
  { value: "settings", label: "Settings Only", description: "Tune inference parameters (temperature, penalties, etc.)" },
  { value: "prompts", label: "Prompts Only", description: "Tune prompt file content via search/replace edits" },
  { value: "both", label: "Both", description: "Tune both inference settings and prompt content" },
];

const ALL_SETTINGS_KEYS: { key: keyof AiTuningSettings; label: string }[] = [
  { key: "temperature", label: "Temperature" },
  { key: "maxTokens", label: "Max Tokens" },
  { key: "topP", label: "Top P" },
  { key: "topK", label: "Top K" },
  { key: "frequencyPenalty", label: "Frequency Penalty" },
  { key: "presencePenalty", label: "Presence Penalty" },
  { key: "stopSequences", label: "Stop Sequences" },
  { key: "structuredOutputs", label: "Structured Outputs" },
  { key: "allowReasoning", label: "Allow Reasoning" },
];

export function CopycatSetup() {
  const referenceModelId = useCopycatStore((s) => s.referenceModelId);
  const setReferenceModelId = useCopycatStore((s) => s.setReferenceModelId);
  const targetModelId = useCopycatStore((s) => s.targetModelId);
  const setTargetModelId = useCopycatStore((s) => s.setTargetModelId);
  const startingSettings = useCopycatStore((s) => s.startingSettings);
  const setStartingSettings = useCopycatStore((s) => s.setStartingSettings);
  const updateStartingSetting = useCopycatStore((s) => s.updateStartingSetting);
  const selectedScenarioId = useCopycatStore((s) => s.selectedScenarioId);
  const setSelectedScenarioId = useCopycatStore((s) => s.setSelectedScenarioId);
  const selectedPromptSet = useCopycatStore((s) => s.selectedPromptSet);
  const setSelectedPromptSet = useCopycatStore((s) => s.setSelectedPromptSet);
  const tuningTarget = useCopycatStore((s) => s.tuningTarget);
  const setTuningTarget = useCopycatStore((s) => s.setTuningTarget);
  const maxRounds = useCopycatStore((s) => s.maxRounds);
  const setMaxRounds = useCopycatStore((s) => s.setMaxRounds);
  const lockedSettings = useCopycatStore((s) => s.lockedSettings);
  const setLockedSettings = useCopycatStore((s) => s.setLockedSettings);
  const customInstructions = useCopycatStore((s) => s.customInstructions);
  const setCustomInstructions = useCopycatStore((s) => s.setCustomInstructions);
  const isRunning = useCopycatStore((s) => s.isRunning);
  const reset = useCopycatStore((s) => s.reset);

  const profiles = useProfileStore((s) => s.profiles);
  const customScenarios = useBenchmarkStore((s) => s.customScenarios);
  const activePromptSet = useAppStore((s) => s.activePromptSet);

  const [promptSets, setPromptSets] = useState<string[]>([]);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [inferenceExpanded, setInferenceExpanded] = useState(false);
  const [copyProfileOpen, setCopyProfileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/export/list-sets")
      .then((res) => res.json())
      .then((data) => setPromptSets(data.sets ?? []))
      .catch(() => {});
  }, []);

  const allPromptSets =
    selectedPromptSet && !promptSets.includes(selectedPromptSet)
      ? [selectedPromptSet, ...promptSets]
      : promptSets;

  const showSettingsLocks = tuningTarget === "settings" || tuningTarget === "both";

  const handleToggleLock = (key: keyof AiTuningSettings) => {
    if (isRunning) return;
    const isLocked = lockedSettings.includes(key);
    if (isLocked) {
      setLockedSettings(lockedSettings.filter((k) => k !== key));
    } else {
      setLockedSettings([...lockedSettings, key]);
    }
  };

  const handleRun = () => {
    if (!referenceModelId.trim() || !targetModelId.trim()) return;

    reset();
    useCopycatStore.getState().setIsRunning(true);

    const scenarioId = selectedScenarioId;
    const scenario = scenarioId
      ? customScenarios.find((s) => s.id === scenarioId)
        || findBuiltinScenario(scenarioId)
        || getDefaultScenario("dialogue")
      : getDefaultScenario("dialogue");

    const resolvedPromptSet = selectedPromptSet === "__active__"
      ? useAppStore.getState().activePromptSet || ""
      : selectedPromptSet;

    runCopycatLoop({
      referenceModelId: referenceModelId.trim(),
      targetModelId: targetModelId.trim(),
      scenario,
      tuningTarget,
      maxRounds,
      selectedPromptSet: resolvedPromptSet,
      lockedSettings,
      customInstructions,
    });
  };

  const canRun = referenceModelId.trim() && targetModelId.trim() && !isRunning;

  const handleCopyFromProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    const defaultSlot = profile.slots["default"];
    if (defaultSlot) {
      setStartingSettings({ ...defaultSlot.tuning });
    }
    setCopyProfileOpen(false);
  };

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-8 items-center border-b px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Copycat Setup
        </span>
      </div>
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-3 space-y-3">
          {/* Section 1: Reference Model */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Reference Model (Copy From)
            </div>
            <input
              type="text"
              value={referenceModelId}
              onChange={(e) => setReferenceModelId(e.target.value)}
              disabled={isRunning}
              placeholder="anthropic/claude-opus-4-6"
              className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground font-mono placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
          </div>

          <Separator />

          {/* Section 2: Target Model */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Target Model (Tune)
            </div>
            <input
              type="text"
              value={targetModelId}
              onChange={(e) => setTargetModelId(e.target.value)}
              disabled={isRunning}
              placeholder="deepseek/deepseek-chat-v3-0324"
              className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground font-mono placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
          </div>

          <Separator />

          {/* Section 3: Starting Inference Settings */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setInferenceExpanded((v) => !v)}
              className="flex w-full items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 hover:text-foreground transition-colors"
            >
              <ChevronRight className={`h-3 w-3 transition-transform ${inferenceExpanded ? "rotate-90" : ""}`} />
              Starting Inference Settings
            </button>

            {inferenceExpanded && (
              <div className="space-y-2 px-1">
                {/* Action buttons */}
                <div className="flex gap-1">
                  <div className="relative flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1 text-[10px] h-6"
                      disabled={isRunning}
                      onClick={() => setCopyProfileOpen(!copyProfileOpen)}
                    >
                      <CopyCheck className="h-3 w-3" />
                      Copy from Profile
                    </Button>
                    {copyProfileOpen && profiles.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-0.5 rounded border bg-popover shadow-md">
                        {profiles.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleCopyFromProfile(p.id)}
                            className="w-full text-left px-2 py-1 text-xs hover:bg-accent/50 truncate"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-[10px] h-6"
                    disabled={isRunning}
                    onClick={() => setStartingSettings({ ...COPYCAT_DEFAULT_SETTINGS })}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                </div>

                {/* Temperature */}
                <SettingSlider
                  label="Temperature"
                  value={startingSettings.temperature}
                  min={0}
                  max={2}
                  step={0.05}
                  disabled={isRunning}
                  onChange={(v) => updateStartingSetting("temperature", v)}
                />

                {/* Max Tokens */}
                <SettingNumber
                  label="Max Tokens"
                  value={startingSettings.maxTokens}
                  min={1}
                  max={32000}
                  disabled={isRunning}
                  onChange={(v) => updateStartingSetting("maxTokens", v)}
                />

                {/* Top P */}
                <SettingSlider
                  label="Top P"
                  value={startingSettings.topP}
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={isRunning}
                  onChange={(v) => updateStartingSetting("topP", v)}
                />

                {/* Top K */}
                <SettingNumber
                  label="Top K"
                  value={startingSettings.topK}
                  min={0}
                  max={100}
                  disabled={isRunning}
                  onChange={(v) => updateStartingSetting("topK", v)}
                />

                {/* Frequency Penalty */}
                <SettingSlider
                  label="Freq Penalty"
                  value={startingSettings.frequencyPenalty}
                  min={-2}
                  max={2}
                  step={0.1}
                  disabled={isRunning}
                  onChange={(v) => updateStartingSetting("frequencyPenalty", v)}
                />

                {/* Presence Penalty */}
                <SettingSlider
                  label="Pres Penalty"
                  value={startingSettings.presencePenalty}
                  min={-2}
                  max={2}
                  step={0.1}
                  disabled={isRunning}
                  onChange={(v) => updateStartingSetting("presencePenalty", v)}
                />

                {/* Stop Sequences */}
                <div className="space-y-0.5">
                  <div className="text-[10px] text-muted-foreground">Stop Sequences</div>
                  <input
                    type="text"
                    value={startingSettings.stopSequences}
                    onChange={(e) => updateStartingSetting("stopSequences", e.target.value)}
                    disabled={isRunning}
                    className="w-full rounded border bg-background px-2 py-0.5 text-[10px] text-foreground font-mono disabled:opacity-50"
                  />
                </div>

                {/* Structured Outputs */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={startingSettings.structuredOutputs}
                    onChange={(e) => updateStartingSetting("structuredOutputs", e.target.checked)}
                    disabled={isRunning}
                    className="h-3 w-3"
                  />
                  <span className="text-[10px] text-muted-foreground">Structured Outputs</span>
                </div>

                {/* Allow Reasoning */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={startingSettings.allowReasoning}
                    onChange={(e) => updateStartingSetting("allowReasoning", e.target.checked)}
                    disabled={isRunning}
                    className="h-3 w-3"
                  />
                  <span className="text-[10px] text-muted-foreground">Allow Reasoning</span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Section 4: Prompt Set */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Prompt Set
            </div>
            <select
              value={selectedPromptSet}
              onChange={(e) => setSelectedPromptSet(e.target.value)}
              disabled={isRunning}
              className="h-7 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              style={{ color: selectedPromptSet === "__active__" ? "#22c55e" : selectedPromptSet === "" ? "#60a5fa" : undefined }}
            >
              <option value="__active__" style={{ color: "#22c55e" }}>
                Active: {activePromptSet || "Original Prompts"}
              </option>
              <option value="" style={{ color: "#60a5fa" }}>Default (Original Prompts)</option>
              {allPromptSets.map((name) => (
                <option key={name} value={name} className="text-foreground">
                  {name}
                </option>
              ))}
            </select>
          </div>

          <Separator />

          {/* Section 5: Scenario */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Scenario
            </div>
            <ScenarioSelector
              category="dialogue"
              activeScenarioId={selectedScenarioId}
              customScenarios={customScenarios.filter(
                (s) => s.category === "dialogue"
              )}
              onSelect={(id) => setSelectedScenarioId(id)}
              disabled={isRunning}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              disabled={isRunning}
              onClick={() => setCustomDialogOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Customize Tests
            </Button>
          </div>

          <Separator />

          {/* Section 6: Tuning Options */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Tuning Options
            </div>

            {/* What to tune */}
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground px-1">What to tune</div>
              {TUNING_TARGET_OPTIONS.map((opt) => {
                const isSelected = tuningTarget === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTuningTarget(opt.value)}
                    disabled={isRunning}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-accent/50 border border-transparent"
                    } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={opt.description}
                  >
                    <span
                      className={`h-3 w-3 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                      )}
                    </span>
                    <span className="truncate font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Max rounds */}
            <div className="space-y-1 px-1">
              <div className="text-[10px] text-muted-foreground">Max rounds</div>
              <input
                type="number"
                min={1}
                max={20}
                defaultValue={maxRounds}
                key={maxRounds}
                onBlur={(e) => {
                  const v = parseInt(e.target.value);
                  setMaxRounds(isNaN(v) || v < 1 ? 1 : v > 20 ? 20 : v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                disabled={isRunning}
                className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
              />
            </div>

            {/* Settings to Tune (lock/unlock checkboxes) */}
            {showSettingsLocks && (
              <div className="space-y-1 px-1">
                <button
                  type="button"
                  onClick={() => setSettingsExpanded((v) => !v)}
                  className="flex w-full items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${settingsExpanded ? "rotate-90" : ""}`} />
                  Settings to tune
                  <span className="ml-auto text-[9px] opacity-60">
                    {ALL_SETTINGS_KEYS.length - lockedSettings.length}/{ALL_SETTINGS_KEYS.length}
                  </span>
                </button>
                {settingsExpanded && (
                  <div className="space-y-0.5">
                    {ALL_SETTINGS_KEYS.map(({ key, label }) => {
                      const isUnlocked = !lockedSettings.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => handleToggleLock(key)}
                          disabled={isRunning}
                          className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-accent/50 ${
                            isRunning ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          <span
                            className={`h-3 w-3 rounded-sm border flex items-center justify-center shrink-0 ${
                              isUnlocked
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {isUnlocked && (
                              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-primary-foreground">
                                <path
                                  d="M10 3L4.5 8.5L2 6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          <span className={`truncate ${isUnlocked ? "font-medium" : "text-muted-foreground"}`}>
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Section 7: Custom Instructions */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Custom Instructions
            </div>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              disabled={isRunning}
              placeholder="e.g. Focus on matching the reference model's sentence length and vocabulary..."
              rows={3}
              className="w-full rounded border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50 resize-y"
            />
          </div>

          <Separator />

          {/* Section 8: Run / Stop Button */}
          {isRunning ? (
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={stopCopycatLoop}
            >
              <Square className="h-3 w-3" />
              Stop Copycat
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full gap-1.5 text-xs"
              disabled={!canRun}
              onClick={handleRun}
            >
              <Play className="h-3 w-3" />
              Start Copycat
            </Button>
          )}
        </div>
      </ScrollArea>

      <CustomScenarioDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        initialCategory="dialogue"
        lockCategory
      />
    </div>
  );
}

function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-foreground">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 accent-primary disabled:opacity-50"
      />
    </div>
  );
}

function SettingNumber({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <input
        type="number"
        min={min}
        max={max}
        defaultValue={value}
        key={value}
        onBlur={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        disabled={disabled}
        className="w-full rounded border bg-background px-2 py-0.5 text-[10px] text-foreground font-mono disabled:opacity-50"
      />
    </div>
  );
}
