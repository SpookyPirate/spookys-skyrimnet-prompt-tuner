"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScenePresetStore } from "@/stores/scenePresetStore";
import { useSimulationStore } from "@/stores/simulationStore";
import type { ScenePreset } from "@/types/simulation";
import { Copy, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

function applyPresetToSimulation(preset: ScenePreset) {
  const simStore = useSimulationStore.getState();
  simStore.setScene(preset.scene);
  simStore.selectedNpcs.forEach((n) => simStore.removeNpc(n.uuid));
  preset.npcs.forEach((n) => simStore.addNpc(n));
  if (preset.actionStates) {
    for (const action of simStore.actionRegistry) {
      const savedState = preset.actionStates[action.id];
      if (savedState !== undefined && savedState !== action.enabled) {
        simStore.toggleAction(action.id);
      }
    }
  }
  if (preset.player) {
    simStore.setPlayerConfig(preset.player);
  }
}

export function ScenePresetManager() {
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const initialApplied = useRef(false);

  const presets = useScenePresetStore((s) => s.presets);
  const activePresetId = useScenePresetStore((s) => s.activePresetId);
  const setActivePresetId = useScenePresetStore((s) => s.setActivePresetId);
  const addPreset = useScenePresetStore((s) => s.addPreset);
  const deletePreset = useScenePresetStore((s) => s.deletePreset);
  const getPreset = useScenePresetStore((s) => s.getPreset);
  const load = useScenePresetStore((s) => s.load);

  const scene = useSimulationStore((s) => s.scene);
  const selectedNpcs = useSimulationStore((s) => s.selectedNpcs);
  const actionRegistry = useSimulationStore((s) => s.actionRegistry);
  const playerConfig = useSimulationStore((s) => s.playerConfig);
  const setScene = useSimulationStore((s) => s.setScene);
  const setPlayerConfig = useSimulationStore((s) => s.setPlayerConfig);
  const toggleAction = useSimulationStore((s) => s.toggleAction);

  // Load presets on mount
  useEffect(() => {
    load();
  }, [load]);

  // Auto-apply active preset on initial load (restores scene after refresh)
  useEffect(() => {
    if (initialApplied.current || presets.length === 0 || !activePresetId) return;
    const preset = getPreset(activePresetId);
    if (!preset) return;
    applyPresetToSimulation(preset);
    initialApplied.current = true;
  }, [presets, activePresetId, getPreset]);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) {
      toast.error("Preset name is required");
      return;
    }
    addPreset(name, scene, selectedNpcs, actionRegistry, playerConfig);
    toast.success(`Scene preset "${name}" saved`);
    setSaveName("");
    setShowSave(false);
  };

  const handleSelect = (id: string) => {
    if (!id || id === activePresetId) return;
    const preset = getPreset(id);
    if (!preset) return;
    setActivePresetId(id);
    applyPresetToSimulation(preset);
    toast.success(`Scene preset "${preset.name}" loaded`);
  };

  const handleDuplicate = () => {
    const preset = getPreset(activePresetId);
    if (!preset) return;
    const newPreset = addPreset(
      `${preset.name} (Copy)`,
      preset.scene,
      preset.npcs.map((n) => ({ ...n })),
      actionRegistry,
      preset.player,
    );
    applyPresetToSimulation(newPreset);
    toast.success(`Duplicated as "${newPreset.name}"`);
  };

  const handleDelete = () => {
    if (presets.length <= 1) {
      toast.error("Cannot delete the last preset");
      return;
    }
    const preset = getPreset(activePresetId);
    if (!preset) return;
    deletePreset(activePresetId);

    // Load the new active preset
    const newState = useScenePresetStore.getState();
    const newPreset = newState.getPreset(newState.activePresetId);
    if (newPreset) {
      applyPresetToSimulation(newPreset);
    }
    toast.success(`Scene preset "${preset.name}" deleted`);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={activePresetId}
          onChange={(e) => handleSelect(e.target.value)}
          className="h-6 flex-1 rounded-md border bg-background text-foreground px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring [&>option]:bg-background [&>option]:text-foreground"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleDuplicate}
          title="Duplicate preset"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={presets.length <= 1}
          title="Delete preset"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {showSave ? (
        <div className="flex items-center gap-1">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Preset name..."
            className="h-6 text-[10px] flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setShowSave(false);
                setSaveName("");
              }
            }}
            autoFocus
          />
          <Button
            size="sm"
            className="h-6 text-[9px] px-2"
            onClick={handleSave}
            disabled={!saveName.trim()}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[9px] px-2"
            onClick={() => {
              setShowSave(false);
              setSaveName("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[9px] w-full"
          onClick={() => setShowSave(true)}
        >
          <Save className="h-3 w-3 mr-1" />
          Save Scene as New Preset
        </Button>
      )}
    </div>
  );
}
