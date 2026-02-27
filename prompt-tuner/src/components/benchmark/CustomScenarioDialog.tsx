"use client";

import { useState, useEffect } from "react";
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
import { Plus, Trash2, Copy } from "lucide-react";

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

  useEffect(() => {
    if (open) {
      setSelectedCategory(initialCategory);
      setEditingId(null);
      setForm(createEmptyForm(initialCategory));
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

  const handleAddNpc = () => {
    setForm((f) => ({
      ...f,
      npcs: [
        ...f.npcs,
        { uuid: "", name: "", displayName: "", gender: "Male", race: "Nord", distance: 200 },
      ],
    }));
  };

  const handleRemoveNpc = (idx: number) => {
    setForm((f) => ({
      ...f,
      npcs: f.npcs.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateNpc = (
    idx: number,
    field: keyof BenchmarkNpc,
    value: string | number
  ) => {
    setForm((f) => ({
      ...f,
      npcs: f.npcs.map((n, i) => (i === idx ? { ...n, [field]: value } : n)),
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
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize Benchmark Scenarios</DialogTitle>
          <DialogDescription>
            Create custom test scenarios for benchmarking
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 flex-1 min-h-0">
          {/* Left: category + existing scenarios */}
          <div className="w-48 shrink-0 space-y-2">
            <Label className="text-[10px]">Category</Label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                const cat = e.target.value as BenchmarkCategory;
                setSelectedCategory(cat);
                setEditingId(null);
                setForm(createEmptyForm(cat));
              }}
              className="w-full rounded border bg-background px-2 py-1 text-xs"
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
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  {editingId ? "Edit Scenario" : "New Scenario"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-[10px]"
                  onClick={handleCopyFromDefault}
                >
                  <Copy className="h-3 w-3" />
                  Copy from Default
                </Button>
              </div>

              {/* Name / Description */}
              <div className="space-y-1">
                <Label className="text-[10px]">Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Scenario name"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Brief description"
                  className="h-7 text-xs"
                />
              </div>

              <Separator />

              {/* Player */}
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Player
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  <div>
                    <Label className="text-[9px]">Name</Label>
                    <Input
                      value={form.player.name}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          player: { ...f.player, name: e.target.value },
                        }))
                      }
                      className="h-6 text-[10px]"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px]">Gender</Label>
                    <Input
                      value={form.player.gender}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          player: { ...f.player, gender: e.target.value },
                        }))
                      }
                      className="h-6 text-[10px]"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px]">Race</Label>
                    <Input
                      value={form.player.race}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          player: { ...f.player, race: e.target.value },
                        }))
                      }
                      className="h-6 text-[10px]"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px]">Level</Label>
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
                      className="h-6 text-[10px]"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Scene */}
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Scene
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <Label className="text-[9px]">Location</Label>
                    <Input
                      value={form.scene.location}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          scene: { ...f.scene, location: e.target.value },
                        }))
                      }
                      className="h-6 text-[10px]"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px]">Weather</Label>
                    <Input
                      value={form.scene.weather}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          scene: { ...f.scene, weather: e.target.value },
                        }))
                      }
                      className="h-6 text-[10px]"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px]">Time of Day</Label>
                    <Input
                      value={form.scene.timeOfDay}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          scene: { ...f.scene, timeOfDay: e.target.value },
                        }))
                      }
                      className="h-6 text-[10px]"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[9px]">Scene Prompt</Label>
                  <textarea
                    value={form.scene.scenePrompt}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        scene: { ...f.scene, scenePrompt: e.target.value },
                      }))
                    }
                    rows={2}
                    className="w-full rounded border bg-background px-2 py-1 text-[10px] resize-none"
                  />
                </div>
                <div>
                  <Label className="text-[9px]">World Prompt</Label>
                  <textarea
                    value={form.scene.worldPrompt}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        scene: { ...f.scene, worldPrompt: e.target.value },
                      }))
                    }
                    rows={2}
                    className="w-full rounded border bg-background px-2 py-1 text-[10px] resize-none"
                  />
                </div>
              </div>

              <Separator />

              {/* NPCs */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    NPCs ({form.npcs.length})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 gap-1 text-[9px] px-1"
                    onClick={handleAddNpc}
                  >
                    <Plus className="h-2.5 w-2.5" />
                    Add
                  </Button>
                </div>
                {form.npcs.map((npc, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <Input
                        value={npc.displayName}
                        onChange={(e) =>
                          handleUpdateNpc(i, "displayName", e.target.value)
                        }
                        placeholder="Display Name"
                        className="h-6 text-[10px] flex-1"
                      />
                      <Input
                        value={npc.gender}
                        onChange={(e) =>
                          handleUpdateNpc(i, "gender", e.target.value)
                        }
                        placeholder="Gender"
                        className="h-6 text-[10px] w-16"
                      />
                      <Input
                        value={npc.race}
                        onChange={(e) =>
                          handleUpdateNpc(i, "race", e.target.value)
                        }
                        placeholder="Race"
                        className="h-6 text-[10px] w-16"
                      />
                      <Input
                        type="number"
                        value={npc.distance}
                        onChange={(e) =>
                          handleUpdateNpc(
                            i,
                            "distance",
                            parseInt(e.target.value) || 0
                          )
                        }
                        placeholder="Dist"
                        className="h-6 text-[10px] w-14"
                      />
                      <button
                        onClick={() => handleRemoveNpc(i)}
                        className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 pl-1">
                      <Input
                        value={npc.uuid}
                        onChange={(e) =>
                          handleUpdateNpc(i, "uuid", e.target.value)
                        }
                        placeholder="UUID (e.g. hulda_66E)"
                        className="h-5 text-[9px] flex-1 text-muted-foreground"
                      />
                      <Input
                        value={npc.name}
                        onChange={(e) =>
                          handleUpdateNpc(i, "name", e.target.value)
                        }
                        placeholder="Internal name"
                        className="h-5 text-[9px] w-28 text-muted-foreground"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Dialogue: Turns editor; others: Chat History */}
              {isDialogue ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Dialogue Turns ({(form.turns ?? []).length})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 gap-1 text-[9px] px-1"
                      onClick={handleAddTurn}
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Add Turn
                    </Button>
                  </div>
                  {(form.turns ?? []).map((turn, i) => (
                    <div key={turn.id} className="space-y-0.5 rounded border border-border/50 p-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-medium text-muted-foreground w-10 shrink-0">
                          #{i + 1}
                        </span>
                        <select
                          value={turn.inputType}
                          onChange={(e) =>
                            handleUpdateTurn(i, "inputType", e.target.value)
                          }
                          className="h-6 rounded border bg-background px-1 text-[10px] w-16 shrink-0"
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
                          className="h-6 text-[10px] w-24 shrink-0"
                        />
                        <Input
                          value={turn.inputTarget}
                          onChange={(e) =>
                            handleUpdateTurn(i, "inputTarget", e.target.value)
                          }
                          placeholder="Target"
                          className="h-6 text-[10px] w-24 shrink-0"
                        />
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Label className="text-[8px] text-muted-foreground">Responds:</Label>
                          <select
                            value={turn.respondingNpcIndex}
                            onChange={(e) =>
                              handleUpdateTurn(i, "respondingNpcIndex", parseInt(e.target.value) || 0)
                            }
                            className="h-6 rounded border bg-background px-1 text-[10px] w-24"
                          >
                            {form.npcs.map((npc, ni) => (
                              <option key={ni} value={ni}>
                                {npc.displayName || `NPC ${ni}`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => handleRemoveTurn(i)}
                          className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0"
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
                        rows={2}
                        className="w-full rounded border bg-background px-2 py-1 text-[10px] resize-none"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Chat History ({form.chatHistory.length})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 gap-1 text-[9px] px-1"
                      onClick={handleAddChat}
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Add
                    </Button>
                  </div>
                  {form.chatHistory.map((entry, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <select
                        value={entry.type}
                        onChange={(e) =>
                          handleUpdateChat(i, "type", e.target.value)
                        }
                        className="h-6 rounded border bg-background px-1 text-[10px] w-16 shrink-0"
                      >
                        <option value="player">Player</option>
                        <option value="npc">NPC</option>
                        <option value="narration">Narr.</option>
                      </select>
                      <Input
                        value={entry.speaker}
                        onChange={(e) =>
                          handleUpdateChat(i, "speaker", e.target.value)
                        }
                        placeholder="Speaker"
                        className="h-6 text-[10px] w-20 shrink-0"
                      />
                      <Input
                        value={entry.content}
                        onChange={(e) =>
                          handleUpdateChat(i, "content", e.target.value)
                        }
                        placeholder="Content"
                        className="h-6 text-[10px] flex-1"
                      />
                      <button
                        onClick={() => handleRemoveChat(i)}
                        className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
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
                        <Label className="text-[9px]">Player Message</Label>
                        <Input
                          value={form.playerMessage || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              playerMessage: e.target.value,
                            }))
                          }
                          className="h-6 text-[10px]"
                        />
                      </div>
                    )}
                    {needsNpcName && (
                      <div>
                        <Label className="text-[9px]">NPC Name</Label>
                        <Input
                          value={form.npcName || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              npcName: e.target.value,
                            }))
                          }
                          className="h-6 text-[10px]"
                        />
                      </div>
                    )}
                    {needsNpcResponse && (
                      <div>
                        <Label className="text-[9px]">NPC Response</Label>
                        <Input
                          value={form.npcResponse || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              npcResponse: e.target.value,
                            }))
                          }
                          className="h-6 text-[10px]"
                        />
                      </div>
                    )}
                    {needsLastSpeaker && (
                      <div>
                        <Label className="text-[9px]">Last Speaker</Label>
                        <Input
                          value={form.lastSpeaker || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              lastSpeaker: e.target.value,
                            }))
                          }
                          className="h-6 text-[10px]"
                        />
                      </div>
                    )}
                    {needsScenePlan && (
                      <div>
                        <Label className="text-[9px]">Scene Plan (JSON)</Label>
                        <textarea
                          value={form.scenePlan || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              scenePlan: e.target.value,
                            }))
                          }
                          rows={4}
                          className="w-full rounded border bg-background px-2 py-1 text-[10px] font-mono resize-none"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!form.name.trim()}
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
