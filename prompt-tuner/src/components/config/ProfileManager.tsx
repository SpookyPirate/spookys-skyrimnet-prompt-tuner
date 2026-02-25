"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfileStore } from "@/stores/profileStore";
import { useConfigStore } from "@/stores/configStore";
import type { SkyrimNetAgentType, ModelSlot } from "@/types/config";
import { SKYRIMNET_AGENTS } from "@/types/config";
import {
  Save,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export function ProfileManager() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");

  const profiles = useProfileStore((s) => s.profiles);
  const addProfile = useProfileStore((s) => s.addProfile);
  const deleteProfile = useProfileStore((s) => s.deleteProfile);
  const getProfile = useProfileStore((s) => s.getProfile);
  const exportToMarkdown = useProfileStore((s) => s.exportToMarkdown);

  const globalApiKey = useConfigStore((s) => s.globalApiKey);
  const slots = useConfigStore((s) => s.slots);
  const applyProfile = useConfigStore((s) => s.applyProfile);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) {
      toast.error("Profile name is required");
      return;
    }

    const skyrimSlots = Object.fromEntries(
      SKYRIMNET_AGENTS.map((agent) => [agent, slots[agent]])
    ) as Record<SkyrimNetAgentType, ModelSlot>;

    addProfile(name, globalApiKey, skyrimSlots);
    toast.success(`Profile "${name}" saved`);
    setSaveName("");
    setShowSave(false);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (!id) return;
    const profile = getProfile(id);
    if (!profile) return;
    applyProfile(profile.globalApiKey, profile.slots);
    toast.success(`Profile "${profile.name}" loaded`);
  };

  const handleExport = () => {
    const md = exportToMarkdown(selectedId);
    if (!md) {
      toast.error("Profile not found");
      return;
    }
    navigator.clipboard.writeText(md);
    toast.success("Profile copied to clipboard as markdown");
  };

  const handleDelete = () => {
    const profile = getProfile(selectedId);
    if (!profile) return;
    deleteProfile(selectedId);
    setSelectedId("");
    toast.success(`Profile "${profile.name}" deleted`);
  };

  return (
    <div className="px-6 py-2 border-b bg-card/50 space-y-2">
      {/* Profile selector + actions */}
      <div className="flex items-center gap-1.5">
        <select
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          className="h-7 flex-1 rounded-md border bg-background text-foreground px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring [&>option]:bg-background [&>option]:text-foreground"
        >
          <option value="">Profiles{profiles.length > 0 ? ` (${profiles.length})` : ""}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleExport}
          disabled={!selectedId}
          title="Copy as markdown"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={!selectedId}
          title="Delete profile"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Save section */}
      {showSave ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Profile name..."
            className="h-7 text-xs flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setShowSave(false);
                setSaveName("");
              }
            }}
            autoFocus
          />
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={handleSave}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => {
              setShowSave(false);
              setSaveName("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs w-full"
          onClick={() => setShowSave(true)}
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save Current Settings as Profile
        </Button>
      )}
    </div>
  );
}
