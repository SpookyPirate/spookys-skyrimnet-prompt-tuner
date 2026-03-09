"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSimulationStore } from "@/stores/simulationStore";
import { useProfileStore } from "@/stores/profileStore";
import { Columns3, X } from "lucide-react";

export function MultichatSelector() {
  const multichatProfileIds = useSimulationStore((s) => s.multichatProfileIds);
  const setMultichatProfileIds = useSimulationStore((s) => s.setMultichatProfileIds);
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);

  const isActive = multichatProfileIds.length > 0;

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId),
    [profiles, activeProfileId]
  );

  const toggleProfile = (id: string) => {
    if (multichatProfileIds.includes(id)) {
      setMultichatProfileIds(multichatProfileIds.filter((pid) => pid !== id));
    } else {
      setMultichatProfileIds([...multichatProfileIds, id]);
    }
  };

  const clearAll = () => setMultichatProfileIds([]);

  // Get model name for a profile's dialogue slot
  const getDialogueModel = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return "unknown";
    return profile.slots?.default?.api?.modelNames || "not set";
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors ${
            isActive
              ? "text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Columns3 className="h-3.5 w-3.5" />
          Multichat
          {isActive && (
            <span className="ml-0.5 flex items-center justify-center h-3.5 min-w-[14px] rounded-full bg-cyan-400 text-[8px] font-bold text-black px-0.5">
              {multichatProfileIds.length}
            </span>
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
            <span className="text-xs font-semibold">Multichat Comparison</span>
            {isActive && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground"
              >
                <X className="h-2.5 w-2.5" />
                Clear
              </button>
            )}
          </div>

          {/* Info note */}
          <div className="rounded bg-muted/50 px-2 py-1.5 text-[10px] text-muted-foreground leading-relaxed">
            Select profiles to compare side-by-side. Only the <strong>dialogue model</strong> from
            each profile is compared. All other pipeline stages (target selection, actions,
            speaker prediction, GameMaster) use the active profile
            {activeProfile ? ` ("${activeProfile.name}")` : ""}.
            {multichatProfileIds.length > 0 && (
              <span className="block mt-1">
                Inference Mixer overrides apply to all compared models.
              </span>
            )}
          </div>

          {/* Profile list */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Profiles ({profiles.length})
            </Label>
            <div className="max-h-48 overflow-auto space-y-0.5">
              {profiles.map((profile) => {
                const isSelected = multichatProfileIds.includes(profile.id);
                const isActiveProfile = profile.id === activeProfileId;
                const model = getDialogueModel(profile.id);

                return (
                  <label
                    key={profile.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-cyan-500/10 hover:bg-cyan-500/15"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleProfile(profile.id)}
                      className="h-3 w-3 accent-cyan-500 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium truncate">
                          {profile.name}
                        </span>
                        {isActiveProfile && (
                          <span className="text-[8px] px-1 py-0 rounded bg-primary/20 text-primary shrink-0">
                            active
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-muted-foreground font-mono truncate">
                        {model}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Selected count */}
          {multichatProfileIds.length > 0 && (
            <div className="text-[10px] text-muted-foreground border-t pt-2">
              {multichatProfileIds.length} profile{multichatProfileIds.length !== 1 ? "s" : ""} selected
              {multichatProfileIds.length > 3 && " (horizontal scrolling enabled)"}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
