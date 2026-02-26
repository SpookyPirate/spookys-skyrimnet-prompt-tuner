"use client";

import { usePersistedState } from "@/hooks/usePersistedState";
import { FileExplorer } from "@/components/file-explorer/FileExplorer";
import { NpcSelector } from "@/components/npc/NpcSelector";
import { SceneSetup } from "@/components/world/SceneSetup";
import { ActionManager } from "@/components/actions/ActionManager";
import { EventSimulator } from "@/components/triggers/EventSimulator";
import { AutochatControls } from "@/components/autochat/AutochatControls";
import { PlayerSetup } from "@/components/simulation/PlayerSetup";
import { ScenePresetManager } from "@/components/simulation/ScenePresetManager";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/appStore";
import { useSimulationStore } from "@/stores/simulationStore";
import { useTriggerStore } from "@/stores/triggerStore";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Crown,
  User,
  MapPin,
  Swords,
  Zap,
} from "lucide-react";

export function LeftPanel() {
  const activeTab = useAppStore((s) => s.activeTab);

  const [collapsed, setCollapsed] = usePersistedState<Record<string, boolean>>("left-panel-collapsed", {
    player: false,
    npcs: false,
    scene: false,
    actions: false,
    events: false,
    autochat: false,
  });

  const toggle = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  if (activeTab === "preview") {
    return (
      <div className="flex h-full flex-col bg-card">
        <div className="flex h-8 items-center border-b px-3">
          <span className="text-xs font-medium text-muted-foreground">
            Simulation Setup
          </span>
        </div>
        <div className="border-b px-3 py-2">
          <ScenePresetManager />
        </div>
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-3 space-y-1">
            <CollapsibleSection
              id="player"
              title="Player Character"
              icon={<Crown className="h-3.5 w-3.5" />}
              collapsed={collapsed.player}
              onToggle={() => toggle("player")}
            >
              <PlayerSetup />
            </CollapsibleSection>

            <Separator />

            <CollapsibleSection
              id="npcs"
              title="NPCs in Scene"
              icon={<User className="h-3.5 w-3.5" />}
              collapsed={collapsed.npcs}
              onToggle={() => toggle("npcs")}
            >
              <NpcSelector />
            </CollapsibleSection>

            <Separator />

            <CollapsibleSection
              id="scene"
              title="Scene Setup"
              icon={<MapPin className="h-3.5 w-3.5" />}
              collapsed={collapsed.scene}
              onToggle={() => toggle("scene")}
            >
              <SceneSetup />
            </CollapsibleSection>

            <Separator />

            <CollapsibleSection
              id="actions"
              title="Eligible Actions"
              icon={<Swords className="h-3.5 w-3.5" />}
              collapsed={collapsed.actions}
              onToggle={() => toggle("actions")}
              badge={<ActionsBadge />}
            >
              <ActionManager />
            </CollapsibleSection>

            <Separator />

            <CollapsibleSection
              id="events"
              title="Event Simulator"
              icon={<Zap className="h-3.5 w-3.5" />}
              collapsed={collapsed.events}
              onToggle={() => toggle("events")}
              badge={<TriggersBadge />}
            >
              <EventSimulator />
            </CollapsibleSection>

            <Separator />

            <CollapsibleSection
              id="autochat"
              title="Autochat"
              icon={<Bot className="h-3.5 w-3.5" />}
              collapsed={collapsed.autochat}
              onToggle={() => toggle("autochat")}
              badge={<AutochatBadge />}
            >
              <AutochatControls />
            </CollapsibleSection>
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

function CollapsibleSection({
  title,
  icon,
  collapsed,
  onToggle,
  badge,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-accent/50"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold">{title}</span>
        {badge && <span className="ml-auto">{badge}</span>}
      </button>
      {!collapsed && <div className="mt-1.5 px-1">{children}</div>}
    </div>
  );
}

function ActionsBadge() {
  const actionRegistry = useSimulationStore((s) => s.actionRegistry);
  const enabled = actionRegistry.filter((a) => a.enabled).length;
  return (
    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
      {enabled}/{actionRegistry.length}
    </Badge>
  );
}

function TriggersBadge() {
  const triggers = useTriggerStore((s) => s.triggers);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 cursor-help"
            onClick={(e) => e.stopPropagation()}
          >
            {triggers.length} Custom Triggers
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-56 text-center">
          Add trigger YAML files to your active prompt set&apos;s
          config/triggers/ folder, or use Tools &gt; Create Custom Trigger in
          the toolbar.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function AutochatBadge() {
  const enabled = useSimulationStore((s) => s.autochatEnabled);
  if (!enabled) return null;
  return (
    <Badge
      variant="outline"
      className="text-[9px] px-1.5 py-0 border-emerald-500/30 text-emerald-400"
    >
      Active
    </Badge>
  );
}
