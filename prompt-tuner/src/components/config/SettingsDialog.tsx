"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useConfigStore } from "@/stores/configStore";
import { ModelSlotPanel } from "./ModelSlotPanel";
import {
  AGENT_LABELS,
  type AgentType,
} from "@/types/config";
import { Key, RotateCcw } from "lucide-react";

const SKYRIMNET_AGENTS: AgentType[] = [
  "default",
  "game_master",
  "memory_gen",
  "profile_gen",
  "action_eval",
  "meta_eval",
  "diary",
];

const ALL_AGENTS: AgentType[] = [...SKYRIMNET_AGENTS, "tuner"];

export function SettingsDialog() {
  const settingsOpen = useConfigStore((s) => s.settingsOpen);
  const setSettingsOpen = useConfigStore((s) => s.setSettingsOpen);
  const globalApiKey = useConfigStore((s) => s.globalApiKey);
  const setGlobalApiKey = useConfigStore((s) => s.setGlobalApiKey);
  const load = useConfigStore((s) => s.load);

  const [activeAgent, setActiveAgent] = useState<AgentType>("default");

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-[600px] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Global API Key */}
          <div className="px-6 py-3 border-b bg-card/50">
            <div className="flex items-center gap-3">
              <Key className="h-4 w-4 text-muted-foreground shrink-0" />
              <Label htmlFor="global-key" className="text-xs font-medium shrink-0">
                Global API Key
              </Label>
              <Input
                id="global-key"
                type="password"
                value={globalApiKey}
                onChange={(e) => setGlobalApiKey(e.target.value)}
                placeholder="sk-or-... (inherited by all slots unless overridden)"
                className="h-7 text-xs font-mono flex-1"
              />
            </div>
          </div>

          {/* Model Slot Tabs */}
          <Tabs
            value={activeAgent}
            onValueChange={(v) => setActiveAgent(v as AgentType)}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="border-b px-4 py-2 shrink-0 space-y-2">
              <div>
                <div className="mb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prompt Tuner</span>
                </div>
                <TabsList className="h-auto bg-transparent p-0 w-full justify-center">
                  <TabsTrigger
                    value="tuner"
                    className="text-xs h-7 data-[state=active]:bg-background px-2.5 rounded-md w-full"
                  >
                    {AGENT_LABELS["tuner"]}
                  </TabsTrigger>
                </TabsList>
              </div>
              <div>
                <div className="mb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">SkyrimNet Models</span>
                </div>
                <TabsList className="h-auto bg-transparent gap-1 justify-center p-0 flex-wrap">
                  {SKYRIMNET_AGENTS.map((agent) => (
                    <TabsTrigger
                      key={agent}
                      value={agent}
                      className="text-xs h-7 data-[state=active]:bg-background px-2.5 rounded-md"
                    >
                      {AGENT_LABELS[agent]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              {ALL_AGENTS.map((agent) => (
                <TabsContent key={agent} value={agent} className="mt-0 p-0">
                  <ModelSlotPanel agent={agent} />
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
