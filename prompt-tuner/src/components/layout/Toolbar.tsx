"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { useFileStore } from "@/stores/fileStore";
import { useConfigStore } from "@/stores/configStore";
import {
  PanelLeft,
  PanelRight,
  Settings,
  Download,
  Save,
  AudioLines,
  FolderOpen,
  Swords,
  Zap,
  Wrench,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function Toolbar() {
  const toggleLeftPanel = useAppStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const leftPanelOpen = useAppStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const setSettingsOpen = useConfigStore((s) => s.setSettingsOpen);
  const setExportDialogOpen = useAppStore((s) => s.setExportDialogOpen);
  const setSaveSetDialogOpen = useAppStore((s) => s.setSaveSetDialogOpen);
  const setEnhanceSpeechDialogOpen = useAppStore((s) => s.setEnhanceSpeechDialogOpen);
  const setCreateYamlDialogOpen = useAppStore((s) => s.setCreateYamlDialogOpen);

  return (
    <div className="flex h-10 items-center justify-between border-b bg-card px-2">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={leftPanelOpen ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={toggleLeftPanel}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle File Explorer</TooltipContent>
        </Tooltip>

        <span className="ml-2 text-sm font-semibold text-foreground">
          SkyrimNet Prompt Tuner
        </span>
      </div>

      <div className="flex items-center gap-1">
        <PromptSetSwitcher />

        <div className="mx-0.5 h-4 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setSaveSetDialogOpen(true)}>
              <Save className="h-3.5 w-3.5" />
              Save Prompt Set
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save current edits as a new prompt set</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setExportDialogOpen(true)}>
              <Download className="h-3.5 w-3.5" />
              Export Zip
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export modified files as zip</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                  <Wrench className="h-3.5 w-3.5" />
                  Tools
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Prompt tools and YAML config creators</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEnhanceSpeechDialogOpen(true)} className="text-xs gap-2">
              <AudioLines className="h-3.5 w-3.5" />
              Enhance Speech Style
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCreateYamlDialogOpen(true, "action")} className="text-xs gap-2">
              <Swords className="h-3.5 w-3.5" />
              Create Custom Action
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCreateYamlDialogOpen(true, "trigger")} className="text-xs gap-2">
              <Zap className="h-3.5 w-3.5" />
              Create Custom Trigger
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-4 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={rightPanelOpen ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={toggleRightPanel}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Analysis Panel</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

/* ── Prompt Set Switcher ─────────────────────────────────────────────── */

function PromptSetSwitcher() {
  const [sets, setSets] = useState<string[]>([]);
  const activePromptSet = useAppStore((s) => s.activePromptSet);

  useEffect(() => {
    fetch("/api/export/list-sets")
      .then((res) => res.json())
      .then((data) => setSets(data.sets ?? []))
      .catch(() => {});
  }, []);

  const handleSelect = async (value: string) => {
    if (value === activePromptSet) return;
    useAppStore.getState().setActivePromptSet(value);
    useFileStore.getState().closeAllFiles();
    await useFileStore.getState().refreshTree();
    toast.success(
      value ? `Prompt set "${value}" loaded` : "Switched to original prompts",
    );
  };

  // Ensure the current value always has a matching option
  const allSets =
    activePromptSet && !sets.includes(activePromptSet)
      ? [activePromptSet, ...sets]
      : sets;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Active Prompt Set</span>
          <select
            value={activePromptSet}
            onChange={(e) => handleSelect(e.target.value)}
            className="h-7 rounded-md border bg-background text-foreground px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring [&>option]:bg-background [&>option]:text-foreground"
          >
            <option value="">Default (Original Prompts)</option>
            {allSets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </TooltipTrigger>
      <TooltipContent>Switch active prompt set</TooltipContent>
    </Tooltip>
  );
}
