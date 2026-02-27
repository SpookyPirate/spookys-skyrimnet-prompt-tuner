"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSimulationStore } from "@/stores/simulationStore";
import { sendLlmRequest } from "@/lib/llm/client";
import { Wand2, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { ChatMessage } from "@/types/llm";
import type { NpcConfig } from "@/types/simulation";

const WEATHER_OPTIONS = ["Clear", "Cloudy", "Rainy", "Snowy", "Foggy", "Stormy"];
const TIME_OPTIONS = ["Dawn", "Morning", "Afternoon", "Evening", "Night", "Midnight"];

const AUTO_GEN_FIELDS = {
  location: "Location",
  weather: "Weather",
  timeOfDay: "Time of Day",
  worldPrompt: "World Prompt",
  scenePrompt: "Scene Prompt",
  npcs: "NPCs",
} as const;

type AutoGenFieldKey = keyof typeof AUTO_GEN_FIELDS;

interface CharacterEntry {
  displayName: string;
  filename: string;
  source: string;
  path: string;
}

export function SceneSetup() {
  const scene = useSimulationStore((s) => s.scene);
  const setScene = useSimulationStore((s) => s.setScene);
  const addNpc = useSimulationStore((s) => s.addNpc);
  const selectedNpcs = useSimulationStore((s) => s.selectedNpcs);
  const removeNpc = useSimulationStore((s) => s.removeNpc);
  const addLlmCall = useSimulationStore((s) => s.addLlmCall);

  const [showAutoGen, setShowAutoGen] = useState(false);
  const [autoGenFields, setAutoGenFields] = useState<Record<AutoGenFieldKey, boolean>>({
    location: true,
    weather: true,
    timeOfDay: true,
    worldPrompt: true,
    scenePrompt: true,
    npcs: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleField = useCallback((field: AutoGenFieldKey) => {
    setAutoGenFields((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      // Fetch available NPCs if npcs checkbox is checked
      let availableNpcs: CharacterEntry[] = [];
      if (autoGenFields.npcs) {
        try {
          const res = await fetch("/api/characters/list");
          const data = await res.json();
          availableNpcs = data.characters || [];
        } catch {
          // Continue without NPC list
        }
      }

      const checkedFields = Object.entries(autoGenFields)
        .filter(([, v]) => v)
        .map(([k]) => k as AutoGenFieldKey);

      const uncheckedFields = Object.entries(autoGenFields)
        .filter(([, v]) => !v)
        .map(([k]) => k as AutoGenFieldKey);

      // Build context for fixed (unchecked) values — the LLM should build the scene around these
      let fixedContext = "";
      const fixedValues: Record<string, string> = {};
      for (const field of uncheckedFields) {
        if (field === "npcs") {
          const names = selectedNpcs.map((n) => `${n.displayName} (${n.gender} ${n.race})`).join(", ");
          if (names) fixedValues.npcs = names;
        } else {
          const val = scene[field as keyof typeof scene];
          if (val) fixedValues[field] = val;
        }
      }
      if (Object.keys(fixedValues).length > 0) {
        fixedContext = `\n\nThe following values are ALREADY SET by the user. Do NOT include these fields in your JSON output. Instead, use them as context to generate a cohesive scene that fits with them:\n${JSON.stringify(fixedValues, null, 2)}`;
      }

      // Build the requested JSON shape description
      const fieldDescriptions: Record<AutoGenFieldKey, string> = {
        location: `"location": string (a specific named Skyrim location — use the full breadth of Skyrim: taverns, homes, dungeons, Dwemer ruins, mountain passes, camps, ships, farms, guild halls, caves, forts, Daedric shrines, cities, wilderness, etc.)`,
        weather: `"weather": one of: ${WEATHER_OPTIONS.join(", ")}`,
        timeOfDay: `"timeOfDay": one of: ${TIME_OPTIONS.join(", ")}`,
        worldPrompt: `"worldPrompt": string (1-2 sentences defining the overall world rules, tone, or RP style — e.g. "Skyrim is gripped by civil war. NPCs are suspicious of strangers." This is NOT a scene description; it shapes how ALL characters behave across the entire world)`,
        scenePrompt: `"scenePrompt": string (1-3 sentences describing the current roleplay scenario)`,
        npcs: `"npcs": array of objects with { "name": string, "gender": "Male"|"Female", "race": string (Skyrim race), "distance": number (100-2000) }`,
      };

      const requestedShape = checkedFields.map((f) => fieldDescriptions[f]).join("\n  ");

      let npcListContext = "";
      if (autoGenFields.npcs && availableNpcs.length > 0) {
        const npcNames = availableNpcs.map((c) => c.displayName).slice(0, 100);
        npcListContext = `\n\nAvailable NPC characters (prefer picking from this list):\n${npcNames.join(", ")}`;
      }

      const systemPrompt = `You are a Skyrim scene generator. Generate a creative, immersive scene for The Elder Scrolls V: Skyrim.

Return ONLY valid JSON with the requested fields. No markdown, no explanation, no wrapping.

Requested JSON shape:
{
  ${requestedShape}
}${fixedContext}${npcListContext}

Guidelines:
- Be creative and varied — use the full breadth of Skyrim's world across different holds, dungeons, wilderness, and interiors
- Make the scene feel authentic to Skyrim's world
- If generating NPCs, pick 2-6 characters that make sense for the location
- World prompt defines global RP rules/tone that apply everywhere (NOT scene-specific details)
- Scene prompt should describe what's happening right now in this specific scene
- Distances represent how far the NPC is from the player (300 = nearby conversation distance)
- All generated fields must be cohesive with each other and with any fixed context provided`;

      const locationHints = [
        "A cozy tavern or inn.",
        "A remote wilderness location or dungeon.",
        "A location tied to a Daedric quest or guild.",
        "A Dwemer ruin, Falmer cave, or ancient Nordic tomb.",
        "Somewhere near water — a dock, ship, fishing camp, or lakeside.",
        "Along a road, mountain pass, or border crossing.",
        "A mine, mill, farm, or other working-class location.",
        "A temple, shrine, or place of worship.",
        "A military location — a fort, war camp, or battlefield.",
        "Underground — a cave, smuggler's den, or crypt.",
        "A college, court, or seat of power.",
        "Somewhere high up — a mountain peak, tower, or overlook.",
        "A marketplace, trade caravan, or merchant stall.",
        "A bandit hideout, vampire lair, or necromancer's den.",
        "A peaceful village or homestead.",
        "A Stormcloak or Imperial encampment.",
      ];
      const hint = locationHints[Math.floor(Math.random() * locationHints.length)];

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate a Skyrim scene.${autoGenFields.location ? ` Location idea: ${hint}` : ""}` },
      ];

      const log = await sendLlmRequest({ messages, agent: "meta_eval" });
      addLlmCall(log);

      if (log.error) {
        console.error("Auto-generate failed:", log.error);
        return;
      }

      // Parse the JSON response (strip markdown fences if present)
      let jsonText = log.response.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        // Attempt to repair truncated JSON: close open strings, arrays, objects
        let repaired = jsonText;
        // Close an unterminated string
        const quotes = (repaired.match(/"/g) || []).length;
        if (quotes % 2 !== 0) repaired += '"';
        // Close any open brackets/braces
        const opens = (repaired.match(/[{[]/g) || []).length;
        const closes = (repaired.match(/[}\]]/g) || []).length;
        for (let i = 0; i < opens - closes; i++) {
          // Determine whether to close array or object based on last opener
          const lastOpen = repaired.lastIndexOf("[") > repaired.lastIndexOf("{") ? "]" : "}";
          repaired += lastOpen;
        }
        parsed = JSON.parse(repaired);
      }

      // Apply checked scene fields
      const sceneUpdate: Partial<typeof scene> = {};
      if (autoGenFields.location && parsed.location) {
        sceneUpdate.location = parsed.location;
      }
      if (autoGenFields.weather && parsed.weather) {
        sceneUpdate.weather = WEATHER_OPTIONS.includes(parsed.weather) ? parsed.weather : scene.weather;
      }
      if (autoGenFields.timeOfDay && parsed.timeOfDay) {
        sceneUpdate.timeOfDay = TIME_OPTIONS.includes(parsed.timeOfDay) ? parsed.timeOfDay : scene.timeOfDay;
      }
      if (autoGenFields.worldPrompt && parsed.worldPrompt) {
        sceneUpdate.worldPrompt = parsed.worldPrompt;
      }
      if (autoGenFields.scenePrompt && parsed.scenePrompt) {
        sceneUpdate.scenePrompt = parsed.scenePrompt;
      }

      if (Object.keys(sceneUpdate).length > 0) {
        setScene(sceneUpdate);
      }

      // Apply NPCs if checked
      if (autoGenFields.npcs && Array.isArray(parsed.npcs)) {
        // Clear existing NPCs
        for (const npc of selectedNpcs) {
          removeNpc(npc.uuid);
        }

        for (const npcData of parsed.npcs) {
          // Try to match against available characters
          const match = availableNpcs.find(
            (c) => c.displayName.toLowerCase() === npcData.name?.toLowerCase()
          );

          const npc: NpcConfig = match
            ? {
                uuid: match.filename.replace(".prompt", ""),
                name: match.displayName,
                displayName: match.displayName,
                gender: npcData.gender || "Unknown",
                race: npcData.race || "Unknown",
                distance: npcData.distance || 300,
                filePath: match.path,
              }
            : {
                uuid: `virtual-${npcData.name?.toLowerCase().replace(/\s+/g, "-") || "npc"}-${Date.now()}`,
                name: npcData.name || "Unknown NPC",
                displayName: npcData.name || "Unknown NPC",
                gender: npcData.gender || "Unknown",
                race: npcData.race || "Unknown",
                distance: npcData.distance || 300,
                filePath: "",
                isVirtual: true,
              };

          addNpc(npc);
        }
      }
    } catch (err) {
      console.error("Auto-generate scene error:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [autoGenFields, scene, selectedNpcs, setScene, addNpc, removeNpc, addLlmCall]);

  const hasSceneData = scene.location || scene.worldPrompt || scene.scenePrompt;

  return (
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
              {WEATHER_OPTIONS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Time</Label>
            <select
              value={scene.timeOfDay}
              onChange={(e) => setScene({ timeOfDay: e.target.value })}
              className="h-6 w-full rounded-md border bg-transparent px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
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

        {/* Auto-Generate Scene */}
        <div className="pt-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-6 text-xs gap-1.5"
            onClick={() => setShowAutoGen((v) => !v)}
          >
            <Wand2 className="h-3 w-3" />
            Auto-Generate Scene
            {showAutoGen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </Button>

          {showAutoGen && (
            <div className="mt-1.5 rounded border p-2 space-y-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {(Object.entries(AUTO_GEN_FIELDS) as [AutoGenFieldKey, string][]).map(
                  ([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoGenFields[key]}
                        onChange={() => toggleField(key)}
                        className="h-3 w-3 rounded border-muted-foreground"
                      />
                      {label}
                    </label>
                  )
                )}
              </div>
              <Button
                size="sm"
                className="w-full h-6 text-xs gap-1.5"
                onClick={handleGenerate}
                disabled={isGenerating || Object.values(autoGenFields).every((v) => !v)}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </Button>
            </div>
          )}
        </div>

        {hasSceneData && (
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-destructive gap-1"
              onClick={() => setScene({
                location: "",
                weather: "Clear",
                timeOfDay: "Afternoon",
                worldPrompt: "",
                scenePrompt: "",
              })}
            >
              <Trash2 className="h-3 w-3" />
              Clear Fields
            </Button>
          </div>
        )}
    </div>
  );
}
