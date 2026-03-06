"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSimulationStore } from "@/stores/simulationStore";
import { useConfigStore } from "@/stores/configStore";
import { useProfileStore } from "@/stores/profileStore";
import type { AiTuningSettings, SkyrimNetAgentType } from "@/types/config";
import { SlidersHorizontal, RotateCcw, Save, CopyPlus } from "lucide-react";
import { toast } from "sonner";

const TUNING_FIELDS: {
  key: keyof AiTuningSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  type: "number" | "boolean";
}[] = [
  { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.05, type: "number" },
  { key: "maxTokens", label: "Max Tokens", min: 1, max: 32000, step: 1, type: "number" },
  { key: "topP", label: "Top P", min: 0, max: 1, step: 0.05, type: "number" },
  { key: "topK", label: "Top K", min: 0, max: 100, step: 1, type: "number" },
  { key: "frequencyPenalty", label: "Frequency Penalty", min: -2, max: 2, step: 0.05, type: "number" },
  { key: "presencePenalty", label: "Presence Penalty", min: -2, max: 2, step: 0.05, type: "number" },
  { key: "allowReasoning", label: "Allow Reasoning", min: 0, max: 1, step: 1, type: "boolean" },
];

export function InferenceMixer() {
  const inferenceOverrides = useSimulationStore((s) => s.inferenceOverrides);
  const setInferenceOverrides = useSimulationStore((s) => s.setInferenceOverrides);
  const profileSlot = useConfigStore((s) => s.slots["default"]);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const profiles = useProfileStore((s) => s.profiles);
  const [copyName, setCopyName] = useState("");
  const [showCopyInput, setShowCopyInput] = useState(false);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId),
    [profiles, activeProfileId]
  );

  // The effective values: overrides merged on top of the profile's dialogue tuning
  const effective = useMemo<AiTuningSettings>(() => {
    return { ...profileSlot.tuning, ...inferenceOverrides };
  }, [profileSlot.tuning, inferenceOverrides]);

  const hasOverrides = inferenceOverrides !== null && Object.keys(inferenceOverrides).length > 0;

  const handleChange = useCallback(
    (key: keyof AiTuningSettings, value: number | boolean) => {
      const profileVal = profileSlot.tuning[key];
      const current = inferenceOverrides ?? {};

      if (value === profileVal) {
        // Value matches profile — remove this override
        const { [key]: _, ...rest } = current;
        setInferenceOverrides(Object.keys(rest).length > 0 ? rest : null);
      } else {
        setInferenceOverrides({ ...current, [key]: value });
      }
    },
    [inferenceOverrides, profileSlot.tuning, setInferenceOverrides]
  );

  const handleReset = useCallback(() => {
    setInferenceOverrides(null);
  }, [setInferenceOverrides]);

  const handleSaveToProfile = useCallback(() => {
    if (!inferenceOverrides || Object.keys(inferenceOverrides).length === 0) {
      toast.info("No changes to save");
      return;
    }
    const configStore = useConfigStore.getState();
    configStore.updateSlotTuning("default", inferenceOverrides);
    setInferenceOverrides(null);
    toast.success("Saved to active profile", {
      description: `Updated dialogue settings in "${activeProfile?.name || "Default"}"`,
    });
  }, [inferenceOverrides, setInferenceOverrides, activeProfile]);

  const handleSaveToCopy = useCallback(() => {
    if (!copyName.trim()) return;
    const configStore = useConfigStore.getState();
    const profileStore = useProfileStore.getState();

    // Build the new slot set: copy all current profile slots, apply mixer overrides to dialogue
    const currentSlots = { ...configStore.slots };
    const dialogueSlot = {
      ...currentSlots["default"],
      tuning: { ...currentSlots["default"].tuning, ...(inferenceOverrides || {}) },
    };
    const slotsForProfile = Object.fromEntries(
      Object.entries(currentSlots).filter(([k]) =>
        ["default", "game_master", "memory_gen", "profile_gen", "action_eval", "meta_eval", "diary"].includes(k)
      )
    ) as Record<SkyrimNetAgentType, typeof dialogueSlot>;
    slotsForProfile["default"] = dialogueSlot;

    const newProfile = profileStore.addProfile(
      copyName.trim(),
      configStore.globalApiKey,
      slotsForProfile
    );

    // Switch to the new profile
    profileStore.setActiveProfileId(newProfile.id);
    configStore.applyProfile(newProfile.globalApiKey, newProfile.slots);

    setInferenceOverrides(null);
    setCopyName("");
    setShowCopyInput(false);
    toast.success("Switched to new profile", {
      description: `Created and activated "${newProfile.name}"`,
    });
  }, [copyName, inferenceOverrides, setInferenceOverrides]);

  const isOverridden = (key: keyof AiTuningSettings) => {
    return inferenceOverrides !== null && key in inferenceOverrides;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors ${
            hasOverrides
              ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Inference Mixer
          {hasOverrides && (
            <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 p-0"
        sideOffset={8}
      >
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Dialogue Inference Settings</span>
            {hasOverrides && (
              <span className="text-[9px] text-amber-400">Modified</span>
            )}
          </div>

          {/* Profile switcher */}
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Active Profile</Label>
            <select
              value={activeProfileId}
              onChange={(e) => {
                const id = e.target.value;
                const profile = profiles.find((p) => p.id === id);
                if (!profile) return;
                const profileStore = useProfileStore.getState();
                const configStore = useConfigStore.getState();
                profileStore.setActiveProfileId(id);
                configStore.applyProfile(profile.globalApiKey, profile.slots);
                setInferenceOverrides(null);
              }}
              className="w-full h-6 rounded border border-input bg-background px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Settings */}
          <div className="space-y-2">
            {TUNING_FIELDS.map((field) => {
              const val = effective[field.key];
              const modified = isOverridden(field.key);

              if (field.type === "boolean") {
                return (
                  <div key={field.key} className="flex items-center justify-between">
                    <Label
                      className={`text-[10px] ${modified ? "text-amber-400" : "text-muted-foreground"}`}
                    >
                      {field.label}
                    </Label>
                    <input
                      type="checkbox"
                      checked={!!val}
                      onChange={(e) => handleChange(field.key, e.target.checked)}
                      className="h-3 w-3 accent-amber-500"
                    />
                  </div>
                );
              }

              return (
                <div key={field.key} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <Label
                      className={`text-[10px] ${modified ? "text-amber-400" : "text-muted-foreground"}`}
                    >
                      {field.label}
                    </Label>
                    <Input
                      type="number"
                      value={val as number}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) handleChange(field.key, v);
                      }}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      className={`h-5 w-20 text-[10px] text-right px-1 ${
                        modified ? "border-amber-500/50" : ""
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="border-t pt-2 space-y-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-6 text-[10px] gap-1.5 justify-start"
              onClick={handleReset}
            >
              <RotateCcw className="h-3 w-3" />
              Reset to Active Profile
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-6 text-[10px] gap-1.5 justify-start"
              onClick={handleSaveToProfile}
            >
              <Save className="h-3 w-3" />
              Save to &ldquo;{activeProfile?.name || "Default"}&rdquo;
            </Button>

            {showCopyInput ? (
              <div className="flex gap-1">
                <Input
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveToCopy()}
                  placeholder="New profile name..."
                  className="h-6 text-[10px] flex-1"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={handleSaveToCopy}
                  disabled={!copyName.trim()}
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-1.5"
                  onClick={() => {
                    setShowCopyInput(false);
                    setCopyName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-6 text-[10px] gap-1.5 justify-start"
                onClick={() => {
                  setShowCopyInput(true);
                  setCopyName(activeProfile ? `${activeProfile.name} (tuned)` : "");
                }}
              >
                <CopyPlus className="h-3 w-3" />
                Save to Copy...
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
