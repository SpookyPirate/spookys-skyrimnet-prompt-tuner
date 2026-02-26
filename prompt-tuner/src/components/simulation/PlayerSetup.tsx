"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSimulationStore } from "@/stores/simulationStore";

const SKYRIM_RACES = [
  "Nord",
  "Imperial",
  "Breton",
  "Redguard",
  "Dunmer",
  "Altmer",
  "Bosmer",
  "Orsimer",
  "Khajiit",
  "Argonian",
];

export function PlayerSetup() {
  const playerConfig = useSimulationStore((s) => s.playerConfig);
  const setPlayerConfig = useSimulationStore((s) => s.setPlayerConfig);
  const [showBio, setShowBio] = useState(!!playerConfig.bio);

  return (
    <div className="space-y-1.5">
      <div>
        <Label className="text-[10px] text-muted-foreground">Name</Label>
        <Input
          value={playerConfig.name}
          onChange={(e) => setPlayerConfig({ name: e.target.value })}
          placeholder="Player"
          className="h-6 text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <Label className="text-[10px] text-muted-foreground">Gender</Label>
          <select
            value={playerConfig.gender}
            onChange={(e) => setPlayerConfig({ gender: e.target.value })}
            className="h-6 w-full rounded-md border bg-background text-foreground px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring [&>option]:bg-background [&>option]:text-foreground"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-binary">Non-binary</option>
          </select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Race</Label>
          <select
            value={playerConfig.race}
            onChange={(e) => setPlayerConfig({ race: e.target.value })}
            className="h-6 w-full rounded-md border bg-background text-foreground px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring [&>option]:bg-background [&>option]:text-foreground"
          >
            {SKYRIM_RACES.map((race) => (
              <option key={race} value={race}>
                {race}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Level</Label>
        <Input
          type="number"
          min={1}
          max={100}
          value={playerConfig.level}
          onChange={(e) =>
            setPlayerConfig({ level: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) })
          }
          className="h-6 text-xs"
        />
      </div>

      {showBio ? (
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Bio</Label>
            <button
              onClick={() => {
                setShowBio(false);
                setPlayerConfig({ bio: "" });
              }}
              className="text-[9px] text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          </div>
          <textarea
            value={playerConfig.bio}
            onChange={(e) => setPlayerConfig({ bio: e.target.value })}
            placeholder="Optional flavor text about your character..."
            className="w-full h-12 rounded-md border bg-transparent px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      ) : (
        <button
          onClick={() => setShowBio(true)}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          + Add Bio
        </button>
      )}
    </div>
  );
}
