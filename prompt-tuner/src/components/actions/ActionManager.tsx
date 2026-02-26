"use client";

import { useState } from "react";
import { useSimulationStore } from "@/stores/simulationStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import type { ActionCategory, ActionDefinition } from "@/types/actions";

export function ActionManager() {
  const actionRegistry = useSimulationStore((s) => s.actionRegistry);
  const toggleAction = useSimulationStore((s) => s.toggleAction);
  const addCustomAction = useSimulationStore((s) => s.addCustomAction);
  const removeCustomAction = useSimulationStore((s) => s.removeCustomAction);
  const updateCustomAction = useSimulationStore((s) => s.updateCustomAction);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["builtin"])
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newParams, setNewParams] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editParams, setEditParams] = useState("");

  const categories: { key: ActionCategory; label: string }[] = [
    { key: "builtin", label: "Built-in" },
    { key: "custom", label: "Custom" },
  ];

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = (category: ActionCategory, enable: boolean) => {
    actionRegistry
      .filter((a) => a.category === category)
      .forEach((a) => {
        if (a.enabled !== enable) toggleAction(a.id);
      });
  };

  const handleAddCustom = () => {
    if (!newName.trim()) return;
    const action: ActionDefinition = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      description: newDesc.trim() || "Custom action",
      parameterSchema: newParams.trim() || undefined,
      category: "custom",
      enabled: true,
    };
    addCustomAction(action);
    setNewName("");
    setNewDesc("");
    setNewParams("");
    setShowAddForm(false);
  };

  const startEdit = (action: ActionDefinition) => {
    setEditingId(action.id);
    setEditName(action.name);
    setEditDesc(action.description);
    setEditParams(action.parameterSchema || "");
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateCustomAction(editingId, {
      name: editName.trim(),
      description: editDesc.trim() || "Custom action",
      parameterSchema: editParams.trim() || undefined,
    });
    setEditingId(null);
  };

  const enabled = actionRegistry.filter((a) => a.enabled).length;

  return (
    <div className="space-y-1">
        {categories.map(({ key, label }) => {
          const actions = actionRegistry.filter((a) => a.category === key);
          if (actions.length === 0 && key !== "custom") return null;
          const catEnabled = actions.filter((a) => a.enabled).length;
          const isExpanded = expandedCategories.has(key);

          return (
            <div key={key}>
              <button
                onClick={() => toggleCategory(key)}
                className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-semibold text-muted-foreground hover:bg-accent/50 uppercase tracking-wider"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {label}
                <span className="ml-auto font-normal">
                  {catEnabled}/{actions.length}
                </span>
              </button>

              {isExpanded && (
                <div className="ml-2 space-y-0.5">
                  {actions.length > 0 && (
                    <div className="flex gap-1 mb-1">
                      <button
                        onClick={() => toggleAll(key, true)}
                        className="text-[9px] text-blue-400 hover:underline"
                      >
                        All on
                      </button>
                      <span className="text-[9px] text-muted-foreground">/</span>
                      <button
                        onClick={() => toggleAll(key, false)}
                        className="text-[9px] text-blue-400 hover:underline"
                      >
                        All off
                      </button>
                    </div>
                  )}
                  {actions.map((action) =>
                    editingId === action.id ? (
                      <div
                        key={action.id}
                        className="space-y-1 rounded border p-1.5"
                      >
                        <Input
                          placeholder="Action name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-6 text-[10px]"
                        />
                        <Input
                          placeholder="Description"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="h-6 text-[10px]"
                        />
                        <Input
                          placeholder="Params JSON (optional)"
                          value={editParams}
                          onChange={(e) => setEditParams(e.target.value)}
                          className="h-6 text-[10px]"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-5 text-[9px] px-2"
                            onClick={handleSaveEdit}
                            disabled={!editName.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 text-[9px] px-2"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={action.id}
                        className="flex items-start gap-1.5 rounded px-1 py-0.5 hover:bg-accent/30"
                      >
                        <input
                          type="checkbox"
                          checked={action.enabled}
                          onChange={() => toggleAction(action.id)}
                          className="mt-0.5 h-3 w-3 shrink-0 accent-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium truncate">
                              {action.name}
                            </span>
                            {action.parameterSchema && (
                              <Badge
                                variant="outline"
                                className="text-[8px] px-1 py-0 shrink-0"
                              >
                                params
                              </Badge>
                            )}
                          </div>
                          <div className="text-[9px] text-muted-foreground truncate">
                            {action.description}
                          </div>
                        </div>
                        {action.category === "custom" && (
                          <div className="flex shrink-0 gap-0.5">
                            <button
                              onClick={() => startEdit(action)}
                              className="p-0.5 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeCustomAction(action.id)}
                              className="p-0.5 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {key === "custom" && (
                    <>
                      {showAddForm ? (
                        <div className="mt-1 space-y-1 rounded border p-1.5">
                          <Input
                            placeholder="Action name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="h-6 text-[10px]"
                          />
                          <Input
                            placeholder="Description"
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                            className="h-6 text-[10px]"
                          />
                          <Input
                            placeholder='Params JSON (optional)'
                            value={newParams}
                            onChange={(e) => setNewParams(e.target.value)}
                            className="h-6 text-[10px]"
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-5 text-[9px] px-2"
                              onClick={handleAddCustom}
                              disabled={!newName.trim()}
                            >
                              Add
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 text-[9px] px-2"
                              onClick={() => setShowAddForm(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddForm(true)}
                          className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline mt-1"
                        >
                          <Plus className="h-3 w-3" />
                          Add Custom Action
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
