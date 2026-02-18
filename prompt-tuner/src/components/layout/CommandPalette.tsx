"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useFileStore } from "@/stores/fileStore";
import { useAppStore } from "@/stores/appStore";
import { FileText, Search, FolderOpen, MessageSquare, Eye, Code } from "lucide-react";

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: "file" | "command" | "tab";
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<
    { name: string; displayName?: string; path: string }[]
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const openFiles = useFileStore((s) => s.openFiles);
  const setActiveFile = useFileStore((s) => s.setActiveFile);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setExportDialogOpen = useAppStore((s) => s.setExportDialogOpen);
  const setSaveSetDialogOpen = useAppStore((s) => s.setSaveSetDialogOpen);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+P / Cmd+P — open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setOpen(true);
        setQuery("");
        setSelectedIndex(0);
        setSearchResults([]);
      }
      // Ctrl+Tab — cycle open files
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const files = useFileStore.getState().openFiles;
        const active = useFileStore.getState().activeFilePath;
        if (files.length > 1 && active) {
          const idx = files.findIndex((f) => f.path === active);
          const nextIdx = (idx + (e.shiftKey ? -1 : 1) + files.length) % files.length;
          useFileStore.getState().setActiveFile(files[nextIdx].path);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Search files when query changes
  useEffect(() => {
    if (!query.trim() || query.startsWith(">")) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/files/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = await res.json();
        setSearchResults((data.results || []).slice(0, 20));
      } catch {
        setSearchResults([]);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const openFileFromSearch = useCallback(
    async (filePath: string, name: string, displayName?: string) => {
      const existing = openFiles.find((f) => f.path === filePath);
      if (existing) {
        setActiveFile(filePath);
        setActiveTab("editor");
        setOpen(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/files/read?path=${encodeURIComponent(filePath)}`
        );
        const data = await res.json();
        if (data.content !== undefined) {
          useFileStore.getState().openFile({
            path: filePath,
            name,
            displayName: displayName || name,
            content: data.content,
            originalContent: data.content,
            isDirty: false,
            isReadOnly: data.isReadOnly ?? false,
          });
          setActiveTab("editor");
        }
      } catch {
        // ignore
      }
      setOpen(false);
    },
    [openFiles, setActiveFile, setActiveTab]
  );

  // Build items list
  const items: PaletteItem[] = [];

  const isCommandMode = query.startsWith(">");

  if (isCommandMode) {
    // Command mode
    const cmdQuery = query.slice(1).toLowerCase().trim();
    const commands: PaletteItem[] = [
      {
        id: "tab-editor",
        label: "Switch to Editor",
        icon: <Code className="h-3.5 w-3.5" />,
        action: () => { setActiveTab("editor"); setOpen(false); },
        category: "tab",
      },
      {
        id: "tab-tuner",
        label: "Switch to Tuner Chat",
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        action: () => { setActiveTab("tuner"); setOpen(false); },
        category: "tab",
      },
      {
        id: "tab-preview",
        label: "Switch to Preview",
        icon: <Eye className="h-3.5 w-3.5" />,
        action: () => { setActiveTab("preview"); setOpen(false); },
        category: "tab",
      },
      {
        id: "cmd-export",
        label: "Export as Zip",
        icon: <FolderOpen className="h-3.5 w-3.5" />,
        action: () => { setExportDialogOpen(true); setOpen(false); },
        category: "command",
      },
      {
        id: "cmd-save-set",
        label: "Save as New Prompt Set",
        icon: <FolderOpen className="h-3.5 w-3.5" />,
        action: () => { setSaveSetDialogOpen(true); setOpen(false); },
        category: "command",
      },
    ];
    items.push(
      ...commands.filter(
        (c) => !cmdQuery || c.label.toLowerCase().includes(cmdQuery)
      )
    );
  } else {
    // File mode — show open files first, then search results
    for (const file of openFiles) {
      if (
        !query.trim() ||
        file.name.toLowerCase().includes(query.toLowerCase()) ||
        (file.displayName || "").toLowerCase().includes(query.toLowerCase())
      ) {
        items.push({
          id: file.path,
          label: file.displayName || file.name,
          description: file.path,
          icon: <FileText className="h-3.5 w-3.5" />,
          action: () => {
            setActiveFile(file.path);
            setActiveTab("editor");
            setOpen(false);
          },
          category: "file",
        });
      }
    }

    for (const result of searchResults) {
      if (!items.some((i) => i.id === result.path)) {
        items.push({
          id: result.path,
          label: result.displayName || result.name,
          description: result.path,
          icon: <Search className="h-3.5 w-3.5" />,
          action: () =>
            openFileFromSearch(result.path, result.name, result.displayName),
          category: "file",
        });
      }
    }
  }

  const clampedIndex = Math.min(selectedIndex, items.length - 1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[clampedIndex]) {
        items[clampedIndex].action();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search files or type > for commands..."
            className="border-0 focus-visible:ring-0 h-10 text-sm"
            autoFocus
          />
        </div>

        <ScrollArea className="max-h-72">
          {items.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {query.trim()
                ? "No results found"
                : "Type to search files, or > for commands"}
            </div>
          ) : (
            <div className="py-1">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent/50 ${
                    i === clampedIndex ? "bg-accent" : ""
                  }`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  {item.icon}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.category === "tab" && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      tab
                    </Badge>
                  )}
                  {item.category === "command" && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      cmd
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
