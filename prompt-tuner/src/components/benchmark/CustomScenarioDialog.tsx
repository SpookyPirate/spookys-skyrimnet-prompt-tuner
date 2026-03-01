"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBenchmarkStore } from "@/stores/benchmarkStore";
import { BENCHMARK_CATEGORIES } from "@/lib/benchmark/categories";
import { getDefaultScenario } from "@/lib/benchmark/default-scenarios";
import type {
  BenchmarkCategory,
  BenchmarkScenario,
  BenchmarkChatEntry,
  BenchmarkNpc,
  BenchmarkDialogueTurn,
} from "@/types/benchmark";
import { Trash2, Copy, Search, X, MapPin, Sparkles, Loader2 } from "lucide-react";
import type { FileNode } from "@/types/files";
import { parseCharacterName } from "@/lib/files/paths";
import { sendLlmRequest } from "@/lib/llm/client";
import { buildSceneGenMessages } from "@/lib/benchmark/build-scene-gen-prompt";
import { toast } from "sonner";

const GENDERS = ["Male", "Female"];
const SKYRIM_RACES = ["Nord", "Imperial", "Breton", "Redguard", "Dunmer", "Altmer", "Bosmer", "Orsimer", "Khajiit", "Argonian"];
const WEATHER_OPTIONS = ["Clear", "Cloudy", "Rainy", "Snowy", "Foggy", "Stormy"];
const TIME_OPTIONS = ["Dawn", "Morning", "Afternoon", "Evening", "Night", "Midnight"];

const selectClass = "h-6 w-full rounded-md border bg-background text-foreground px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring [&>option]:bg-background [&>option]:text-foreground";

interface CustomScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory: BenchmarkCategory;
}

type FormScenario = Omit<BenchmarkScenario, "id" | "isBuiltin">;

function createEmptyForm(category: BenchmarkCategory): FormScenario {
  return {
    name: "",
    description: "",
    category,
    player: { name: "Dragonborn", gender: "Male", race: "Nord", level: 15 },
    scene: {
      location: "Whiterun",
      weather: "Clear",
      timeOfDay: "Afternoon",
      worldPrompt: "",
      scenePrompt: "",
    },
    npcs: [],
    chatHistory: [],
    turns: [],
    playerMessage: "",
    npcResponse: "",
    npcName: "",
    lastSpeaker: "",
    eligibleActions: [],
    scenePlan: "",
    isContinuousMode: false,
  };
}

export function CustomScenarioDialog({
  open,
  onOpenChange,
  initialCategory,
}: CustomScenarioDialogProps) {
  const customScenarios = useBenchmarkStore((s) => s.customScenarios);
  const addCustomScenario = useBenchmarkStore((s) => s.addCustomScenario);
  const updateCustomScenario = useBenchmarkStore((s) => s.updateCustomScenario);
  const deleteCustomScenario = useBenchmarkStore((s) => s.deleteCustomScenario);

  const [selectedCategory, setSelectedCategory] =
    useState<BenchmarkCategory>(initialCategory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormScenario>(
    createEmptyForm(initialCategory)
  );

  const [generating, setGenerating] = useState(false);
  const [genDescription, setGenDescription] = useState("");
  const [showGenInput, setShowGenInput] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedCategory(initialCategory);
      setEditingId(null);
      setForm(createEmptyForm(initialCategory));
      setGenerating(false);
      setShowGenInput(false);
      setGenDescription("");
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open, initialCategory]);

  const categoryScenarios = customScenarios.filter(
    (s) => s.category === selectedCategory
  );

  const handleCopyFromDefault = () => {
    const def = getDefaultScenario(selectedCategory);
    setForm({
      ...def,
      name: `${def.name} (Copy)`,
      description: def.description,
    });
  };

  const handleGenerateScene = async () => {
    setGenerating(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const messages = buildSceneGenMessages(selectedCategory, genDescription);
      const result = await sendLlmRequest({
        messages,
        agent: "tuner",
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      let text = result.response ?? "";
      // Strip markdown fences if present
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
      const parsed = JSON.parse(text);

      // Defensive: if scenePlan came back as object, stringify it
      if (parsed.scenePlan && typeof parsed.scenePlan === "object") {
        parsed.scenePlan = JSON.stringify(parsed.scenePlan, null, 2);
      }

      const base = createEmptyForm(selectedCategory);
      setForm({ ...base, ...parsed, category: selectedCategory });
      setGenDescription("");
      setShowGenInput(false);
      toast.success("Scene generated");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("Generation failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const handleEdit = (scenario: BenchmarkScenario) => {
    setEditingId(scenario.id);
    setForm({ ...scenario });
  };

  const handleSave = () => {
    if (!form.name.trim()) return;

    if (editingId) {
      updateCustomScenario(editingId, {
        ...form,
        id: editingId,
        isBuiltin: false,
      } as BenchmarkScenario);
    } else {
      addCustomScenario({
        ...form,
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        isBuiltin: false,
        category: selectedCategory,
      } as BenchmarkScenario);
    }
    setEditingId(null);
    setForm(createEmptyForm(selectedCategory));
  };

  const handleDelete = (id: string) => {
    deleteCustomScenario(id);
    if (editingId === id) {
      setEditingId(null);
      setForm(createEmptyForm(selectedCategory));
    }
  };

  // ── NPC search + add ──────────────────────────────────────────
  const [npcQuery, setNpcQuery] = useState("");
  const [npcResults, setNpcResults] = useState<FileNode[]>([]);

  const handleNpcSearch = useCallback(async (q: string) => {
    setNpcQuery(q);
    if (q.length < 2) { setNpcResults([]); return; }
    try {
      const res = await fetch(`/api/files/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setNpcResults(data.results || []);
    } catch { setNpcResults([]); }
  }, []);

  const handleAddNpcFromSearch = useCallback((node: FileNode) => {
    const filename = node.name.replace(".prompt", "");
    const { displayName } = parseCharacterName(node.name);
    const npc: BenchmarkNpc = {
      uuid: filename,
      name: displayName,
      displayName,
      gender: "Unknown",
      race: "Unknown",
      distance: 300,
    };
    setForm((f) => {
      if (f.npcs.some((n) => n.uuid === npc.uuid)) return f;
      return { ...f, npcs: [...f.npcs, npc] };
    });
    setNpcQuery("");
    setNpcResults([]);
  }, []);

  const handleRemoveNpc = (idx: number) => {
    setForm((f) => ({
      ...f,
      npcs: f.npcs.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateNpcDistance = (idx: number, distance: number) => {
    setForm((f) => ({
      ...f,
      npcs: f.npcs.map((n, i) => (i === idx ? { ...n, distance } : n)),
    }));
  };

  const handleAddChat = () => {
    setForm((f) => ({
      ...f,
      chatHistory: [
        ...f.chatHistory,
        { type: "player" as const, speaker: "", content: "" },
      ],
    }));
  };

  const handleRemoveChat = (idx: number) => {
    setForm((f) => ({
      ...f,
      chatHistory: f.chatHistory.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateChat = (
    idx: number,
    field: keyof BenchmarkChatEntry,
    value: string
  ) => {
    setForm((f) => ({
      ...f,
      chatHistory: f.chatHistory.map((c, i) =>
        i === idx ? { ...c, [field]: value } : c
      ),
    }));
  };

  // ── Turn CRUD (dialogue category) ──────────────────────────────
  const handleAddTurn = () => {
    const turns = form.turns ?? [];
    const idx = turns.length + 1;
    setForm((f) => ({
      ...f,
      turns: [
        ...(f.turns ?? []),
        {
          id: `turn-${idx}`,
          label: `Turn ${idx}`,
          inputType: "player" as const,
          inputSpeaker: f.player.name,
          inputSpeakerUuid: "player_001",
          inputContent: "",
          inputTarget: f.npcs[0]?.displayName ?? "",
          respondingNpcIndex: 0,
        },
      ],
    }));
  };

  const handleRemoveTurn = (idx: number) => {
    setForm((f) => ({
      ...f,
      turns: (f.turns ?? []).filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateTurn = (
    idx: number,
    field: keyof BenchmarkDialogueTurn,
    value: string | number
  ) => {
    setForm((f) => ({
      ...f,
      turns: (f.turns ?? []).map((t, i) =>
        i === idx ? { ...t, [field]: value } : t
      ),
    }));
  };

  const isDialogue = selectedCategory === "dialogue";

  const needsPlayerMessage = [
    "meta_eval",
    "action_eval",
  ].includes(selectedCategory);
  const needsNpcResponse = selectedCategory === "action_eval";
  const needsNpcName = selectedCategory === "action_eval";
  const needsLastSpeaker = selectedCategory === "meta_eval";
  const needsScenePlan = selectedCategory === "game_master";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize Benchmark Scenarios</DialogTitle>
          <DialogDescription>
            Create custom test scenarios for benchmarking
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 flex-1 min-h-0">
          {/* Left: category + existing scenarios */}
          <div className="w-48 shrink-0 space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Category</Label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                const cat = e.target.value as BenchmarkCategory;
                setSelectedCategory(cat);
                setEditingId(null);
                setForm(createEmptyForm(cat));
              }}
              className={selectClass}
            >
              {BENCHMARK_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            <Separator />

            <div className="text-[10px] font-medium text-muted-foreground">
              Custom Scenarios ({categoryScenarios.length})
            </div>
            <div className="space-y-1">
              {categoryScenarios.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs cursor-pointer ${
                    editingId === s.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => handleEdit(s)}
                >
                  <span className="truncate flex-1">{s.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id);
                    }}
                    className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <ScrollArea className="flex-1 border rounded-md">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {editingId ? "Edit Scenario" : "New Scenario"}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1.5 text-xs px-2"
                    disabled={generating}
                    onClick={() => setShowGenInput((v) => !v)}
                  >
                    <Sparkles className="h-3 w-3" />
                    Generate Scene
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1.5 text-xs px-2"
                    disabled={generating}
                    onClick={handleCopyFromDefault}
                  >
                    <Copy className="h-3 w-3" />
                    Copy from Default
                  </Button>
                </div>
              </div>
              {showGenInput && (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={genDescription}
                    onChange={(e) => setGenDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !generating) handleGenerateScene();
                    }}
                    placeholder="Describe the scene or leave empty for random"
                    className="h-6 text-xs flex-1"
                    disabled={generating}
                  />
                  <Button
                    variant="default"
                    size="sm"
                    className="h-6 text-xs px-3"
                    disabled={generating}
                    onClick={handleGenerateScene}
                  >
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Go"}
                  </Button>
                  {generating && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => abortRef.current?.abort()}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              )}

              {/* Name / Description */}
              <div className={`space-y-3 ${generating ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Scenario name"
                    className="h-6 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Brief description"
                    className="h-6 text-xs"
                  />
                </div>
              </div>

              <Separator />

              {/* Player */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-muted-foreground">Player</span>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Name</Label>
                  <Input
                    value={form.player.name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        player: { ...f.player, name: e.target.value },
                      }))
                    }
                    className="h-6 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Gender</Label>
                    <select
                      value={form.player.gender}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          player: { ...f.player, gender: e.target.value },
                        }))
                      }
                      className={selectClass}
                    >
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Race</Label>
                    <select
                      value={form.player.race}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          player: { ...f.player, race: e.target.value },
                        }))
                      }
                      className={selectClass}
                    >
                      {SKYRIM_RACES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Level</Label>
                  <Input
                    type="number"
                    value={form.player.level}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        player: {
                          ...f.player,
                          level: parseInt(e.target.value) || 1,
                        },
                      }))
                    }
                    className="h-6 text-xs"
                  />
                </div>
              </div>

              <Separator />

              {/* Scene */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-muted-foreground">Scene</span>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Location</Label>
                  <Input
                    value={form.scene.location}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        scene: { ...f.scene, location: e.target.value },
                      }))
                    }
                    placeholder="Whiterun, The Bannered Mare"
                    className="h-6 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Weather</Label>
                    <select
                      value={form.scene.weather}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          scene: { ...f.scene, weather: e.target.value },
                        }))
                      }
                      className={selectClass}
                    >
                      {WEATHER_OPTIONS.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Time</Label>
                    <select
                      value={form.scene.timeOfDay}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          scene: { ...f.scene, timeOfDay: e.target.value },
                        }))
                      }
                      className={selectClass}
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
                    value={form.scene.worldPrompt}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        scene: { ...f.scene, worldPrompt: e.target.value },
                      }))
                    }
                    placeholder="Custom world/setting notes..."
                    className="w-full h-12 rounded-md border bg-transparent px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Scene Prompt</Label>
                  <textarea
                    value={form.scene.scenePrompt}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        scene: { ...f.scene, scenePrompt: e.target.value },
                      }))
                    }
                    placeholder="Roleplay scenario description..."
                    className="w-full h-12 rounded-md border bg-transparent px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <Separator />

              {/* NPCs */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-muted-foreground">
                  NPCs in Scene
                </span>

                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={npcQuery}
                    onChange={(e) => handleNpcSearch(e.target.value)}
                    placeholder="Search NPCs to add..."
                    className="h-6 pl-6 text-xs"
                  />
                </div>

                {/* Search results dropdown */}
                {npcResults.length > 0 && (
                  <div className="rounded border bg-popover max-h-32 overflow-y-auto">
                    {npcResults.slice(0, 10).map((node) => {
                      const { displayName } = parseCharacterName(node.name);
                      return (
                        <button
                          key={node.path}
                          onClick={() => handleAddNpcFromSearch(node)}
                          className="flex w-full items-center gap-2 px-2 py-1 text-xs hover:bg-accent text-left"
                        >
                          {displayName}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Selected NPCs list */}
                <div className="space-y-1">
                  {form.npcs.map((npc, i) => (
                    <div
                      key={npc.uuid || i}
                      className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
                    >
                      <span className="flex-1 truncate font-medium">{npc.displayName}</span>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <Input
                          type="number"
                          value={npc.distance}
                          onChange={(e) =>
                            handleUpdateNpcDistance(i, parseInt(e.target.value) || 300)
                          }
                          className="h-5 w-14 text-xs text-center p-0"
                          min={0}
                          max={10000}
                        />
                        <span className="text-muted-foreground text-[10px]">units</span>
                      </div>
                      <button
                        onClick={() => handleRemoveNpc(i)}
                        className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {form.npcs.length === 0 && (
                    <div className="text-[10px] text-muted-foreground text-center py-1">
                      No NPCs added yet
                    </div>
                  )}
                  {form.npcs.length > 1 && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setForm((f) => ({ ...f, npcs: [] }))}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear All
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Dialogue: Turns editor; others: Chat History */}
              {isDialogue ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Dialogue Turns ({(form.turns ?? []).length})
                    </span>
                    <button
                      onClick={handleAddTurn}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      + Add Turn
                    </button>
                  </div>
                  {(form.turns ?? []).map((turn, i) => (
                    <div key={turn.id} className="space-y-1">
                      <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: "1.25rem 4.5rem 1fr 1fr 8rem 1.25rem" }}>
                        <span className="text-[10px] font-medium text-muted-foreground text-center">
                          {i + 1}
                        </span>
                        <select
                          value={turn.inputType}
                          onChange={(e) =>
                            handleUpdateTurn(i, "inputType", e.target.value)
                          }
                          className={selectClass}
                        >
                          <option value="player">Player</option>
                          <option value="npc">NPC</option>
                        </select>
                        <Input
                          value={turn.inputSpeaker}
                          onChange={(e) =>
                            handleUpdateTurn(i, "inputSpeaker", e.target.value)
                          }
                          placeholder="Speaker"
                          className="h-6 text-xs"
                        />
                        <Input
                          value={turn.inputTarget}
                          onChange={(e) =>
                            handleUpdateTurn(i, "inputTarget", e.target.value)
                          }
                          placeholder="Target"
                          className="h-6 text-xs"
                        />
                        <select
                          value={turn.respondingNpcIndex}
                          onChange={(e) =>
                            handleUpdateTurn(i, "respondingNpcIndex", parseInt(e.target.value) || 0)
                          }
                          className={selectClass}
                        >
                          {form.npcs.map((npc, ni) => (
                            <option key={ni} value={ni}>
                              {npc.displayName || `NPC ${ni}`}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRemoveTurn(i)}
                          className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive justify-self-center"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <textarea
                        value={turn.inputContent}
                        onChange={(e) =>
                          handleUpdateTurn(i, "inputContent", e.target.value)
                        }
                        placeholder="Dialogue content..."
                        className="w-full h-10 rounded-md border bg-transparent px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      {i < (form.turns ?? []).length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Chat History ({form.chatHistory.length})
                    </span>
                    <button
                      onClick={handleAddChat}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      + Add Entry
                    </button>
                  </div>
                  {form.chatHistory.map((entry, i) => (
                    <div key={i} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: "5rem 7rem 1fr 1.25rem" }}>
                      <select
                        value={entry.type}
                        onChange={(e) =>
                          handleUpdateChat(i, "type", e.target.value)
                        }
                        className={selectClass}
                      >
                        <option value="player">Player</option>
                        <option value="npc">NPC</option>
                        <option value="narration">Narration</option>
                      </select>
                      <Input
                        value={entry.speaker}
                        onChange={(e) =>
                          handleUpdateChat(i, "speaker", e.target.value)
                        }
                        placeholder="Speaker"
                        className="h-6 text-xs"
                      />
                      <Input
                        value={entry.content}
                        onChange={(e) =>
                          handleUpdateChat(i, "content", e.target.value)
                        }
                        placeholder="Content"
                        className="h-6 text-xs"
                      />
                      <button
                        onClick={() => handleRemoveChat(i)}
                        className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive justify-self-center"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Category-specific fields */}
              {(needsPlayerMessage ||
                needsNpcResponse ||
                needsNpcName ||
                needsLastSpeaker ||
                needsScenePlan) && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Category-Specific Fields
                    </span>
                    {needsPlayerMessage && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Player Message</Label>
                        <Input
                          value={form.playerMessage || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              playerMessage: e.target.value,
                            }))
                          }
                          className="h-6 text-xs"
                        />
                      </div>
                    )}
                    {needsNpcName && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">NPC Name</Label>
                        <Input
                          value={form.npcName || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              npcName: e.target.value,
                            }))
                          }
                          className="h-6 text-xs"
                        />
                      </div>
                    )}
                    {needsNpcResponse && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">NPC Response</Label>
                        <Input
                          value={form.npcResponse || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              npcResponse: e.target.value,
                            }))
                          }
                          className="h-6 text-xs"
                        />
                      </div>
                    )}
                    {needsLastSpeaker && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Last Speaker</Label>
                        <Input
                          value={form.lastSpeaker || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              lastSpeaker: e.target.value,
                            }))
                          }
                          className="h-6 text-xs"
                        />
                      </div>
                    )}
                    {needsScenePlan && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Scene Plan (JSON)</Label>
                        <textarea
                          value={form.scenePlan || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              scenePlan: e.target.value,
                            }))
                          }
                          className="w-full h-16 rounded-md border bg-transparent px-2 py-1 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!form.name.trim() || generating}
          >
            {editingId ? "Update" : "Create"} Scenario
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
