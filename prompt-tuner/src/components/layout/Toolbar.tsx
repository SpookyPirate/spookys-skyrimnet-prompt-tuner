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

export function Toolbar() {
  const toggleLeftPanel = useAppStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const leftPanelOpen = useAppStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const setSettingsOpen = useConfigStore((s) => s.setSettingsOpen);
  const setExportDialogOpen = useAppStore((s) => s.setExportDialogOpen);
  const setSaveSetDialogOpen = useAppStore((s) => s.setSaveSetDialogOpen);
  const setLoadPromptSetDialogOpen = useAppStore((s) => s.setLoadPromptSetDialogOpen);
  const setEnhanceSpeechDialogOpen = useAppStore((s) => s.setEnhanceSpeechDialogOpen);
  const setCreateYamlDialogOpen = useAppStore((s) => s.setCreateYamlDialogOpen);
  const activePromptSet = useAppStore((s) => s.activePromptSet);

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
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setLoadPromptSetDialogOpen(true)}>
              <FolderOpen className="h-3.5 w-3.5" />
              Load Prompt Set
              <span className="text-green-500 font-normal">({activePromptSet})</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Switch to a different prompt set</TooltipContent>
        </Tooltip>

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
