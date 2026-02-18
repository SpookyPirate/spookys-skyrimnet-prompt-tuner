"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSimulationStore } from "@/stores/simulationStore";
import { MapPin, Cloud, Clock } from "lucide-react";

export function SceneSetup() {
  const scene = useSimulationStore((s) => s.scene);
  const setScene = useSimulationStore((s) => s.setScene);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold">Scene Setup</span>
      </div>

      <div className="space-y-1.5">
        <div>
          <Label className="text-[10px] text-muted-foreground">Location</Label>
          <Input
            value={scene.location}
            onChange={(e) => setScene({ location: e.target.value })}
            placeholder="Whiterun, The Bannered Mare"
            className="h-6 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <Label className="text-[10px] text-muted-foreground">Weather</Label>
            <select
              value={scene.weather}
              onChange={(e) => setScene({ weather: e.target.value })}
              className="h-6 w-full rounded-md border bg-transparent px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="Clear">Clear</option>
              <option value="Cloudy">Cloudy</option>
              <option value="Rainy">Rainy</option>
              <option value="Snowy">Snowy</option>
              <option value="Foggy">Foggy</option>
              <option value="Stormy">Stormy</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Time</Label>
            <select
              value={scene.timeOfDay}
              onChange={(e) => setScene({ timeOfDay: e.target.value })}
              className="h-6 w-full rounded-md border bg-transparent px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="Dawn">Dawn</option>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Evening">Evening</option>
              <option value="Night">Night</option>
              <option value="Midnight">Midnight</option>
            </select>
          </div>
        </div>

        <div>
          <Label className="text-[10px] text-muted-foreground">World Prompt</Label>
          <textarea
            value={scene.worldPrompt}
            onChange={(e) => setScene({ worldPrompt: e.target.value })}
            placeholder="Custom world/setting notes..."
            className="w-full h-12 rounded-md border bg-transparent px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <Label className="text-[10px] text-muted-foreground">Scene Prompt</Label>
          <textarea
            value={scene.scenePrompt}
            onChange={(e) => setScene({ scenePrompt: e.target.value })}
            placeholder="Roleplay scenario description..."
            className="w-full h-12 rounded-md border bg-transparent px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}
