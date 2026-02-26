"use client";

import { useState, useEffect, useRef } from "react";
import { useSimulationStore } from "@/stores/simulationStore";
import { useConfigStore } from "@/stores/configStore";
import { Button } from "@/components/ui/button";
import { useAutochat } from "@/hooks/useAutochat";
import { Play, Square, Clock } from "lucide-react";

const DURATION_PRESETS = [
  { label: "1 min", value: 1 },
  { label: "3 min", value: 3 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 },
  { label: "Infinite", value: 0 },
];

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0:00";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AutochatControls() {
  const autochatEnabled = useSimulationStore((s) => s.autochatEnabled);
  const setAutochatEnabled = useSimulationStore((s) => s.setAutochatEnabled);
  const autochatDuration = useSimulationStore((s) => s.autochatDuration);
  const setAutochatDuration = useSimulationStore((s) => s.setAutochatDuration);
  const autochatStartedAt = useSimulationStore((s) => s.autochatStartedAt);
  const autochatStatus = useSimulationStore((s) => s.autochatStatus);
  const globalApiKey = useConfigStore((s) => s.globalApiKey);

  // Initialize the autochat loop hook
  useAutochat();

  // Custom duration input mode
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);

  // Live remaining-time countdown (updates every second)
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!autochatEnabled || !autochatStartedAt || autochatDuration === 0) {
      setRemainingSeconds(0);
      return;
    }
    const update = () => {
      const elapsed = Date.now() - autochatStartedAt;
      const total = autochatDuration * 60 * 1000;
      const left = Math.max(0, Math.ceil((total - elapsed) / 1000));
      setRemainingSeconds(left);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [autochatEnabled, autochatStartedAt, autochatDuration]);

  // Focus custom input when switching to custom mode
  useEffect(() => {
    if (isCustom) customInputRef.current?.focus();
  }, [isCustom]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "custom") {
      setIsCustom(true);
      setCustomValue(String(autochatDuration || ""));
    } else {
      setIsCustom(false);
      setAutochatDuration(Number(val));
    }
  };

  const commitCustom = () => {
    const parsed = parseFloat(customValue);
    if (!isNaN(parsed) && parsed > 0) {
      setAutochatDuration(parsed);
    }
    setIsCustom(false);
  };

  // Check if current duration matches a preset
  const isPresetValue = DURATION_PRESETS.some((p) => p.value === autochatDuration);

  return (
    <div className="space-y-2.5">
      {/* Duration selector */}
      <div className="flex items-center gap-2">
        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground shrink-0">Duration:</span>
        {isCustom ? (
          <div className="flex items-center gap-1">
            <input
              ref={customInputRef}
              type="number"
              min={0.5}
              step={0.5}
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onBlur={commitCustom}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCustom();
                if (e.key === "Escape") setIsCustom(false);
              }}
              className="h-5 w-14 rounded border bg-background px-1.5 text-[10px] text-center"
              disabled={autochatEnabled}
            />
            <span className="text-[10px] text-muted-foreground">min</span>
          </div>
        ) : (
          <select
            value={isPresetValue ? autochatDuration : "custom"}
            onChange={handleSelectChange}
            disabled={autochatEnabled}
            className="h-5 rounded border bg-background px-1 text-[10px] flex-1 min-w-0"
          >
            {DURATION_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="custom">
              {!isPresetValue ? `${autochatDuration} min` : "Custom..."}
            </option>
          </select>
        )}
      </div>

      {/* Start / Stop button + countdown */}
      <div className="flex items-center gap-2">
        {autochatEnabled ? (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 flex-1 gap-1.5 text-[11px]"
            onClick={() => setAutochatEnabled(false)}
          >
            <Square className="h-3 w-3" />
            Stop Autochat
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 flex-1 gap-1.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setAutochatEnabled(true)}
            disabled={!globalApiKey}
          >
            <Play className="h-3 w-3" />
            Start Autochat
          </Button>
        )}

        {/* Countdown timer (visible when running with a finite duration) */}
        {autochatEnabled && autochatDuration > 0 && (
          <div className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
            <Clock className="h-3 w-3 text-emerald-400" />
            <span className="text-[11px] font-mono font-semibold text-emerald-400 tabular-nums">
              {formatCountdown(remainingSeconds)}
            </span>
          </div>
        )}

        {/* Infinite indicator */}
        {autochatEnabled && autochatDuration === 0 && (
          <div className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
            <span className="text-[10px] text-emerald-400">
              {autochatStatus === "running" ? "Running..." : "Waiting..."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
