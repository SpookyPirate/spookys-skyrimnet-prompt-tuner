"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores/appStore";
import { useFileStore } from "@/stores/fileStore";
import { ACTION_YAML_TEMPLATE, TRIGGER_YAML_TEMPLATE } from "@/lib/yaml/templates";
import { toast } from "sonner";

export function CreateYamlDialog() {
  const open = useAppStore((s) => s.createYamlDialogOpen);
  const yamlType = useAppStore((s) => s.createYamlType);
  const setOpen = useAppStore((s) => s.setCreateYamlDialogOpen);
  const activePromptSet = useAppStore((s) => s.activePromptSet);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Set template when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setContent(yamlType === "action" ? ACTION_YAML_TEMPLATE : TRIGGER_YAML_TEMPLATE);
        setName("");
      }
      setOpen(isOpen);
    },
    [yamlType, setOpen]
  );

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Please enter a file name");
      return;
    }

    setSaving(true);
    try {
      const subdir = yamlType === "action" ? "custom_actions" : "triggers";
      const fileName = name.trim().replace(/\s+/g, "_").toLowerCase();
      const filePath = `edited-prompts/${activePromptSet}/${subdir}/${fileName}.yaml`;

      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, content }),
      });

      if (res.ok) {
        toast.success(`Created ${filePath}`);
        useFileStore.getState().refreshTree();
        setOpen(false);
      } else {
        const data = await res.json();
        toast.error(`Failed: ${data.error}`);
      }
    } catch (error) {
      toast.error(`Failed: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [name, content, yamlType, activePromptSet, setOpen]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-sm">
            New {yamlType === "action" ? "Custom Action" : "Trigger"} Config
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">File Name</Label>
            <Input
              placeholder={
                yamlType === "action" ? "my_custom_action" : "my_trigger"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7 text-xs"
            />
            <span className="text-[9px] text-muted-foreground">
              Will be saved to edited-prompts/{activePromptSet}/
              {yamlType === "action" ? "custom_actions" : "triggers"}/
              {name.trim().replace(/\s+/g, "_").toLowerCase() || "..."}.yaml
            </span>
          </div>

          <div>
            <Label className="text-xs">YAML Content</Label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-64 rounded border bg-background p-2 font-mono text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              spellCheck={false}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
