"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAutoTunerStore } from "@/stores/autoTunerStore";
import { useProfileStore } from "@/stores/profileStore";
import { useBenchmarkStore } from "@/stores/benchmarkStore";
import { BENCHMARK_CATEGORIES } from "@/lib/benchmark/categories";
import { getDefaultScenario, getBuiltinScenarios, findBuiltinScenario } from "@/lib/benchmark/default-scenarios";
import { runTuningLoop, stopTuningLoop } from "@/lib/autotuner/run-tuning-loop";
import { CustomScenarioDialog } from "@/components/benchmark/CustomScenarioDialog";
import type { BenchmarkCategory } from "@/types/benchmark";
import type { TuningTarget } from "@/types/autotuner";
import type { AiTuningSettings } from "@/types/config";
import {
  MessageSquare,
  Swords,
  Theater,
  Brain,
  BookOpen,
  UserCog,
  Square,
  ScanSearch,
  Play,
  Settings2,
} from "lucide-react";

const CATEGORY_ICONS: Record<BenchmarkCategory, React.ReactNode> = {
  dialogue: <MessageSquare className="h-3.5 w-3.5" />,
  meta_eval: <ScanSearch className="h-3.5 w-3.5" />,
  action_eval: <Swords className="h-3.5 w-3.5" />,
  game_master: <Theater className="h-3.5 w-3.5" />,
  memory_gen: <Brain className="h-3.5 w-3.5" />,
  diary: <BookOpen className="h-3.5 w-3.5" />,
  bio_update: <UserCog className="h-3.5 w-3.5" />,
};

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

export function AutoTunerSetup() {
  const profiles = useProfileStore((s) => s.profiles);
  const selectedProfileId = useAutoTunerStore((s) => s.selectedProfileId);
  const setSelectedProfileId = useAutoTunerStore((s) => s.setSelectedProfileId);
  const selectedCategory = useAutoTunerStore((s) => s.selectedCategory);
  const setSelectedCategory = useAutoTunerStore((s) => s.setSelectedCategory);
  const selectedScenarioId = useAutoTunerStore((s) => s.selectedScenarioId);
  const setSelectedScenarioId = useAutoTunerStore((s) => s.setSelectedScenarioId);
  const selectedPromptSet = useAutoTunerStore((s) => s.selectedPromptSet);
  const setSelectedPromptSet = useAutoTunerStore((s) => s.setSelectedPromptSet);
  const tuningTarget = useAutoTunerStore((s) => s.tuningTarget);
  const setTuningTarget = useAutoTunerStore((s) => s.setTuningTarget);
  const maxRounds = useAutoTunerStore((s) => s.maxRounds);
  const setMaxRounds = useAutoTunerStore((s) => s.setMaxRounds);
  const lockedSettings = useAutoTunerStore((s) => s.lockedSettings);
  const setLockedSettings = useAutoTunerStore((s) => s.setLockedSettings);
  const customInstructions = useAutoTunerStore((s) => s.customInstructions);
  const setCustomInstructions = useAutoTunerStore((s) => s.setCustomInstructions);
  const isRunning = useAutoTunerStore((s) => s.isRunning);
  const reset = useAutoTunerStore((s) => s.reset);

  const customScenarios = useBenchmarkStore((s) => s.customScenarios);

  const [promptSets, setPromptSets] = useState<string[]>([]);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BenchmarkCategory | null>(null);

  useEffect(() => {
    fetch("/api/export/list-sets")
      .then((res) => res.json())
      .then((data) => setPromptSets(data.sets ?? []))
      .catch(() => {});
  }, []);

  // Ensure selected prompt set always has a matching option
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

  const handleSelectCategory = (category: BenchmarkCategory) => {
    if (isRunning) return;
    setSelectedCategory(category);
  };

  const handleRun = () => {
    if (!selectedCategory || !selectedProfileId) return;
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (!profile) return;

    reset();

    // Resolve scenario
    const scenarioId = selectedScenarioId;
    const scenario = scenarioId
      ? customScenarios.find((s) => s.id === scenarioId)
        || findBuiltinScenario(scenarioId)
        || getDefaultScenario(selectedCategory)
      : getDefaultScenario(selectedCategory);

    runTuningLoop(
      selectedCategory,
      profile,
      tuningTarget,
      maxRounds,
      scenario,
      selectedPromptSet,
      lockedSettings,
      customInstructions,
    );
  };

  const canRun = selectedProfileId && selectedCategory && !isRunning;

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-8 items-center border-b px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Auto Tuner Setup
        </span>
      </div>
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-3 space-y-3">
          {/* Section 1: Model Profile to Tune */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Model Profile to Tune
            </div>
            {profiles.length === 0 ? (
              <div className="text-xs text-muted-foreground px-1">
                No profiles found. Create profiles in Settings.
              </div>
            ) : (
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                disabled={isRunning}
                className="h-7 w-full rounded-md border bg-background text-foreground px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Select a profile...</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <Separator />

          {/* Section 2: Prompt Set */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Prompt Set
            </div>
            <select
              value={selectedPromptSet}
              onChange={(e) => setSelectedPromptSet(e.target.value)}
              disabled={isRunning}
              className="h-7 w-full rounded-md border bg-background text-foreground px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Default (Original Prompts)</option>
              {allPromptSets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <Separator />

          {/* Section 3: Agent to Tune */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Agent to Tune
            </div>
            <div className="space-y-1">
              {BENCHMARK_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <Button
                    key={cat.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start gap-1.5 text-xs"
                    disabled={isRunning}
                    onClick={() => handleSelectCategory(cat.id)}
                    title={cat.description}
                  >
                    {CATEGORY_ICONS[cat.id]}
                    <span className="flex-1 text-left">{cat.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Scenario (when category selected) */}
          {selectedCategory && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Scenario
                </div>
                <ScenarioSelector
                  category={selectedCategory}
                  activeScenarioId={selectedScenarioId}
                  customScenarios={customScenarios.filter(
                    (s) => s.category === selectedCategory
                  )}
                  onSelect={(id) => setSelectedScenarioId(id)}
                  disabled={isRunning}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  disabled={isRunning}
                  onClick={() => {
                    setEditingCategory(selectedCategory);
                    setCustomDialogOpen(true);
                  }}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Customize Tests
                </Button>
              </div>
            </>
          )}

          <Separator />

          {/* Section 5: Tuning Options */}
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
                value={maxRounds}
                onChange={(e) => setMaxRounds(parseInt(e.target.value) || 5)}
                disabled={isRunning}
                className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
              />
            </div>

            {/* Settings to Tune (lock/unlock checkboxes) */}
            {showSettingsLocks && (
              <div className="space-y-1 px-1">
                <div className="text-[10px] text-muted-foreground">Settings to tune</div>
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
              </div>
            )}
          </div>

          <Separator />

          {/* Section 6: Custom Instructions */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Custom Instructions
            </div>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              disabled={isRunning}
              placeholder="e.g. Focus on getting the perfect temperature setting..."
              rows={3}
              className="w-full rounded border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50 resize-y"
            />
          </div>

          <Separator />

          {/* Section 7: Run / Stop Button */}
          {isRunning ? (
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={stopTuningLoop}
            >
              <Square className="h-3 w-3" />
              Stop Tuning
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full gap-1.5 text-xs"
              disabled={!canRun}
              onClick={handleRun}
            >
              <Play className="h-3 w-3" />
              Start Auto Tuner
            </Button>
          )}
        </div>
      </ScrollArea>

      <CustomScenarioDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        initialCategory={editingCategory || "dialogue"}
      />
    </div>
  );
}

function ScenarioSelector({
  category,
  activeScenarioId,
  customScenarios,
  onSelect,
  disabled,
}: {
  category: BenchmarkCategory;
  activeScenarioId?: string;
  customScenarios: { id: string; name: string }[];
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const builtinScenarios = getBuiltinScenarios(category);
  const defaultId = builtinScenarios[0]?.id;
  const effectiveId = activeScenarioId || defaultId;

  return (
    <select
      value={effectiveId}
      onChange={(e) => onSelect(e.target.value)}
      disabled={disabled}
      className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
    >
      {builtinScenarios.map((s, i) => (
        <option key={s.id} value={s.id}>
          {s.name}{i === 0 ? " (Default)" : ""}
        </option>
      ))}
      {customScenarios.length > 0 && (
        <option disabled>── Custom ──</option>
      )}
      {customScenarios.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
