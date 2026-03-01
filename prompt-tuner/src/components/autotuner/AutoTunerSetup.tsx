"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAutoTunerStore } from "@/stores/autoTunerStore";
import { useProfileStore } from "@/stores/profileStore";
import { useBenchmarkStore } from "@/stores/benchmarkStore";
import { BENCHMARK_CATEGORIES } from "@/lib/benchmark/categories";
import { getDefaultScenario, getBuiltinScenarios, findBuiltinScenario } from "@/lib/benchmark/default-scenarios";
import { runTuningLoop, stopTuningLoop } from "@/lib/autotuner/run-tuning-loop";
import type { BenchmarkCategory } from "@/types/benchmark";
import type { TuningTarget } from "@/types/autotuner";
import {
  MessageSquare,
  Swords,
  Theater,
  Brain,
  BookOpen,
  UserCog,
  Square,
  Loader2,
  ScanSearch,
  Play,
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

export function AutoTunerSetup() {
  const profiles = useProfileStore((s) => s.profiles);
  const selectedProfileId = useAutoTunerStore((s) => s.selectedProfileId);
  const setSelectedProfileId = useAutoTunerStore((s) => s.setSelectedProfileId);
  const selectedCategory = useAutoTunerStore((s) => s.selectedCategory);
  const setSelectedCategory = useAutoTunerStore((s) => s.setSelectedCategory);
  const selectedScenarioId = useAutoTunerStore((s) => s.selectedScenarioId);
  const setSelectedScenarioId = useAutoTunerStore((s) => s.setSelectedScenarioId);
  const tuningTarget = useAutoTunerStore((s) => s.tuningTarget);
  const setTuningTarget = useAutoTunerStore((s) => s.setTuningTarget);
  const maxRounds = useAutoTunerStore((s) => s.maxRounds);
  const setMaxRounds = useAutoTunerStore((s) => s.setMaxRounds);
  const isRunning = useAutoTunerStore((s) => s.isRunning);
  const reset = useAutoTunerStore((s) => s.reset);

  const customScenarios = useBenchmarkStore((s) => s.customScenarios);

  const handleSelectProfile = (profileId: string) => {
    if (isRunning) return;
    setSelectedProfileId(profileId);
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

    runTuningLoop(selectedCategory, profile, tuningTarget, maxRounds, scenario);
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
          {/* Profile Selection (single-select radio) */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Model to Tune
            </div>
            {profiles.length === 0 ? (
              <div className="text-xs text-muted-foreground px-1">
                No profiles found. Create profiles in Settings.
              </div>
            ) : (
              <div className="space-y-1">
                {profiles.map((profile) => {
                  const isSelected = selectedProfileId === profile.id;
                  return (
                    <button
                      key={profile.id}
                      onClick={() => handleSelectProfile(profile.id)}
                      disabled={isRunning}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-accent/50 border border-transparent"
                      } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
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
                      <span className="truncate font-medium">{profile.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Category Selection */}
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

          {/* Scenario (for active category) */}
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
              </div>
            </>
          )}

          <Separator />

          {/* Tuning Options */}
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
          </div>

          <Separator />

          {/* Run / Stop Button */}
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
