"use client";

import { useEffect, useCallback, useRef } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { useAppStore } from "@/stores/appStore";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { LeftPanel } from "./LeftPanel";
import { CenterPanel } from "./CenterPanel";
import { RightPanel } from "./RightPanel";
import { SettingsDialog } from "@/components/config/SettingsDialog";
import { ExportDialog } from "@/components/export/ExportDialog";
import { SavePromptSetDialog } from "@/components/export/SavePromptSetDialog";
import { CommandPalette } from "./CommandPalette";
import { usePanelRef, type PanelImperativeHandle } from "react-resizable-panels";

export function AppShell() {
  const leftPanelOpen = useAppStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const exportDialogOpen = useAppStore((s) => s.exportDialogOpen);
  const setExportDialogOpen = useAppStore((s) => s.setExportDialogOpen);
  const saveSetDialogOpen = useAppStore((s) => s.saveSetDialogOpen);
  const setSaveSetDialogOpen = useAppStore((s) => s.setSaveSetDialogOpen);

  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();

  // Sync store → panel collapse/expand
  useEffect(() => {
    if (leftPanelOpen) {
      leftPanelRef.current?.expand();
    } else {
      leftPanelRef.current?.collapse();
    }
  }, [leftPanelOpen, leftPanelRef]);

  useEffect(() => {
    if (rightPanelOpen) {
      rightPanelRef.current?.expand();
    } else {
      rightPanelRef.current?.collapse();
    }
  }, [rightPanelOpen, rightPanelRef]);

  // Sync panel resize → store (detect drag-to-collapse)
  const handleLeftResize = useCallback(
    (size: { asPercentage: number }) => {
      const store = useAppStore.getState();
      if (size.asPercentage === 0 && store.leftPanelOpen) {
        store.toggleLeftPanel();
      } else if (size.asPercentage > 0 && !store.leftPanelOpen) {
        store.toggleLeftPanel();
      }
    },
    []
  );

  const handleRightResize = useCallback(
    (size: { asPercentage: number }) => {
      const store = useAppStore.getState();
      if (size.asPercentage === 0 && store.rightPanelOpen) {
        store.toggleRightPanel();
      } else if (size.asPercentage > 0 && !store.rightPanelOpen) {
        store.toggleRightPanel();
      }
    },
    []
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Toolbar />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel
            panelRef={leftPanelRef}
            defaultSize="20%"
            minSize="200px"
            maxSize="35%"
            collapsible
            collapsedSize={0}
            onResize={handleLeftResize}
          >
            <LeftPanel />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="55%" minSize="300px">
            <CenterPanel />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            panelRef={rightPanelRef}
            defaultSize="25%"
            minSize="200px"
            maxSize="35%"
            collapsible
            collapsedSize={0}
            onResize={handleRightResize}
          >
            <RightPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <StatusBar />
      <SettingsDialog />
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        promptSetName="v1.0"
      />
      <SavePromptSetDialog
        open={saveSetDialogOpen}
        onOpenChange={setSaveSetDialogOpen}
        currentSetName="v1.0"
      />
      <CommandPalette />
    </div>
  );
}
