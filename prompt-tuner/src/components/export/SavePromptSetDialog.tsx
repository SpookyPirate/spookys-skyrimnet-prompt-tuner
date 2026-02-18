"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface SavePromptSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSetName?: string;
  onSaved?: (name: string) => void;
}

export function SavePromptSetDialog({
  open,
  onOpenChange,
  currentSetName,
  onSaved,
}: SavePromptSetDialogProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/export/save-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sourceSet: currentSetName,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success(`Prompt set "${data.name}" created`);
      onSaved?.(data.name);
      onOpenChange(false);
      setName("");
    } catch (e) {
      toast.error(`Failed to save: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save as New Prompt Set</DialogTitle>
          <DialogDescription>
            {currentSetName
              ? `Copy "${currentSetName}" to a new named version.`
              : "Create a new empty prompt set."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="set-name">Name</Label>
          <Input
            id="set-name"
            placeholder="e.g. v2.0, custom-npcs, test-build"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <p className="text-[10px] text-muted-foreground">
            Will be saved to edited-prompts/{name.trim().replace(/[^a-zA-Z0-9._-]/g, "_") || "..."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
