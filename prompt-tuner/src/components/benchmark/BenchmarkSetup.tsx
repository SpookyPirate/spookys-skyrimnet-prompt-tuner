"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useBenchmarkStore } from "@/stores/benchmarkStore";
import { useProfileStore } from "@/stores/profileStore";
import { BENCHMARK_CATEGORIES } from "@/lib/benchmark/categories";
import { getDefaultScenario, getBuiltinScenarios, findBuiltinScenario } from "@/lib/benchmark/default-scenarios";
import { runBenchmark, stopBenchmark } from "@/lib/benchmark/run-benchmark";
import { CustomScenarioDialog } from "./CustomScenarioDialog";
import type { BenchmarkCategory } from "@/types/benchmark";
import {
  MessageSquare,
  Swords,
  Theater,
  Brain,
  BookOpen,
  UserCog,
  Square,
  Loader2,
  Settings2,
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

export function BenchmarkSetup() {
  const profiles = useProfileStore((s) => s.profiles);
  const selectedProfileIds = useBenchmarkStore((s) => s.selectedProfileIds);
  const toggleProfileId = useBenchmarkStore((s) => s.toggleProfileId);
  const isRunning = useBenchmarkStore((s) => s.isRunning);
  const activeCategory = useBenchmarkStore((s) => s.activeCategory);
  const activeScenarioIds = useBenchmarkStore((s) => s.activeScenarioIds);
  const setActiveScenarioId = useBenchmarkStore((s) => s.setActiveScenarioId);
  const customScenarios = useBenchmarkStore((s) => s.customScenarios);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BenchmarkCategory | null>(null);

  const setActiveCategory = useBenchmarkStore((s) => s.setActiveCategory);

  const handleSelectCategory = (category: BenchmarkCategory) => {
    if (isRunning) return;
    setActiveCategory(category);
  };

  const handleRunBenchmark = () => {
    if (!activeCategory) return;
    const selectedProfiles = profiles.filter((p) =>
      selectedProfileIds.includes(p.id)
    );
    if (selectedProfiles.length === 0) return;

    const scenarioId = activeScenarioIds[activeCategory];
    const scenario = scenarioId
      ? customScenarios.find((s) => s.id === scenarioId)
        || findBuiltinScenario(scenarioId)
        || getDefaultScenario(activeCategory)
      : getDefaultScenario(activeCategory);

    runBenchmark(activeCategory, selectedProfiles, scenario);
  };

  const noProfilesSelected = selectedProfileIds.length === 0;

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-8 items-center border-b px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Benchmark Setup
        </span>
      </div>
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-3 space-y-3">
          {/* Profile Selection */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Profiles to Compare
            </div>
            {profiles.length === 0 ? (
              <div className="text-xs text-muted-foreground px-1">
                No profiles found. Create profiles in Settings.
              </div>
            ) : (
              <div className="space-y-1">
                {profiles.map((profile) => {
                  const isSelected = selectedProfileIds.includes(profile.id);
                  return (
                    <button
                      key={profile.id}
                      onClick={() => toggleProfileId(profile.id)}
                      disabled={isRunning}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-accent/50 border border-transparent"
                      } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span
                        className={`h-3 w-3 rounded-sm border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && (
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
                      <span className="truncate font-medium">{profile.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Benchmark Buttons — one per model agent */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
              Run Benchmark
            </div>

            <div className="space-y-1">
              {BENCHMARK_CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat.id;
                const isActive = isRunning && isSelected;
                const subtaskCount = cat.subtasks.length;
                return (
                  <Button
                    key={cat.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start gap-1.5 text-xs"
                    disabled={noProfilesSelected || isRunning}
                    onClick={() => handleSelectCategory(cat.id)}
                    title={cat.description}
                  >
                    {isActive ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      CATEGORY_ICONS[cat.id]
                    )}
                    <span className="flex-1 text-left">{cat.label}</span>
                    {subtaskCount > 1 && (
                      <span className="text-[9px] text-muted-foreground opacity-60">
                        {subtaskCount}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>

            {activeCategory && (
              isRunning ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={stopBenchmark}
                >
                  <Square className="h-3 w-3" />
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  disabled={noProfilesSelected}
                  onClick={handleRunBenchmark}
                >
                  <Play className="h-3 w-3" />
                  Run {BENCHMARK_CATEGORIES.find((c) => c.id === activeCategory)?.label}
                </Button>
              )
            )}
          </div>

          {/* Scenario Dropdown (for active category) */}
          {activeCategory && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Scenario
                </div>
                <ScenarioSelector
                  category={activeCategory}
                  activeScenarioId={activeScenarioIds[activeCategory]}
                  customScenarios={customScenarios.filter(
                    (s) => s.category === activeCategory
                  )}
                  onSelect={(id) => setActiveScenarioId(activeCategory, id)}
                  disabled={isRunning}
                />
              </div>
            </>
          )}

          <Separator />

          {/* Customize Tests */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={() => {
              setEditingCategory(activeCategory || "dialogue");
              setCustomDialogOpen(true);
            }}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Customize Tests
          </Button>
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
