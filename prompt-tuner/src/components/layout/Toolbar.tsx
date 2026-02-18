"use client";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { useConfigStore } from "@/stores/configStore";
import {
  PanelLeft,
  PanelRight,
  Settings,
  Download,
  Save,
  AudioLines,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Toolbar() {
  const toggleLeftPanel = useAppStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const leftPanelOpen = useAppStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const setSettingsOpen = useConfigStore((s) => s.setSettingsOpen);
  const setExportDialogOpen = useAppStore((s) => s.setExportDialogOpen);
  const setSaveSetDialogOpen = useAppStore((s) => s.setSaveSetDialogOpen);

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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
              <AudioLines className="h-3.5 w-3.5" />
              Generate Speech
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generate enhanced speech style for selected character</TooltipContent>
        </Tooltip>

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
