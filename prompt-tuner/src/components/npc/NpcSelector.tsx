"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSimulationStore } from "@/stores/simulationStore";
import { Search, X, User, MapPin } from "lucide-react";
import type { NpcConfig } from "@/types/simulation";
import type { FileNode } from "@/types/files";

export function NpcSelector() {
  const selectedNpcs = useSimulationStore((s) => s.selectedNpcs);
  const addNpc = useSimulationStore((s) => s.addNpc);
  const removeNpc = useSimulationStore((s) => s.removeNpc);
  const updateNpcDistance = useSimulationStore((s) => s.updateNpcDistance);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FileNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/files/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleAddNpc = useCallback(
    (node: FileNode) => {
      const filename = node.name.replace(".prompt", "");
      const lastUnderscore = filename.lastIndexOf("_");
      const uuid = filename;
      const npc: NpcConfig = {
        uuid,
        name: node.displayName || filename,
        displayName: node.displayName || filename,
        gender: "Unknown",
        race: "Unknown",
        distance: 300,
        filePath: node.path,
      };
      addNpc(npc);
      setQuery("");
      setResults([]);
    },
    [addNpc]
  );

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search NPCs to add..."
          className="h-6 pl-6 text-xs"
        />
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="rounded border bg-popover max-h-32 overflow-y-auto">
          {results.slice(0, 10).map((node) => (
            <button
              key={node.path}
              onClick={() => handleAddNpc(node)}
              className="flex w-full items-center gap-2 px-2 py-1 text-xs hover:bg-accent text-left"
            >
              <User className="h-3 w-3 text-muted-foreground" />
              {node.displayName || node.name}
            </button>
          ))}
        </div>
      )}

      {/* Selected NPCs */}
      <div className="space-y-1">
        {selectedNpcs.map((npc) => (
          <div
            key={npc.uuid}
            className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
          >
            <span className="flex-1 truncate font-medium">{npc.displayName}</span>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <Input
                type="number"
                value={npc.distance}
                onChange={(e) =>
                  updateNpcDistance(npc.uuid, parseInt(e.target.value) || 300)
                }
                className="h-5 w-14 text-xs text-center p-0"
                min={0}
                max={10000}
              />
              <span className="text-muted-foreground text-[10px]">units</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4"
              onClick={() => removeNpc(npc.uuid)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {selectedNpcs.length === 0 && (
          <div className="text-[10px] text-muted-foreground text-center py-1">
            No NPCs added yet
          </div>
        )}
      </div>
    </div>
  );
}
