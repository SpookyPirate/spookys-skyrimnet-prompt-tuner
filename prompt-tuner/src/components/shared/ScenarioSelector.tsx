"use client";

import type { BenchmarkCategory } from "@/types/benchmark";
import { getBuiltinScenarios } from "@/lib/benchmark/default-scenarios";

export function ScenarioSelector({
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
      className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50 [&>option]:bg-background [&>option]:text-foreground"
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
