"use client";

import { FileExplorer } from "@/components/file-explorer/FileExplorer";
import { NpcSelector } from "@/components/npc/NpcSelector";
import { SceneSetup } from "@/components/world/SceneSetup";
import { ActionManager } from "@/components/actions/ActionManager";
import { EventSimulator } from "@/components/triggers/EventSimulator";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/appStore";

export function LeftPanel() {
  const activeTab = useAppStore((s) => s.activeTab);

  if (activeTab === "preview") {
    return (
      <div className="flex h-full flex-col bg-card">
        <div className="flex h-8 items-center border-b px-3">
          <span className="text-xs font-medium text-muted-foreground">
            Simulation Setup
          </span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            <NpcSelector />
            <Separator />
            <SceneSetup />
            <Separator />
            <ActionManager />
            <Separator />
            <EventSimulator />
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <FileExplorer />
    </div>
  );
}
