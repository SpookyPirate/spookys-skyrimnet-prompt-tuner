"use client";

import { useEffect, useRef, useState } from "react";
import { useFileStore } from "@/stores/fileStore";
import { useAppStore } from "@/stores/appStore";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import type { FileNode } from "@/types/files";

interface Position { x: number; y: number }

interface FileContextMenuProps {
  node: FileNode;
  position: Position;
  onClose: () => void;
}

export function FileContextMenu({ node, position, onClose }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showCopyToSet, setShowCopyToSet] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [availableSets, setAvailableSets] = useState<string[]>([]);

  // Close on outside click or Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  // Adjust position so menu doesn't overflow viewport
  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 9999,
    left: Math.min(position.x, window.innerWidth - 220),
    top: Math.min(position.y, window.innerHeight - 320),
  };

  const isFile = node.type === "file";
  const isReadOnly = !!node.isReadOnly;

  const openFile = () => {
    if (!isFile) return;
    const store = useFileStore.getState();
    if (store.openFiles.some((f) => f.path === node.path)) {
      store.setActiveFile(node.path);
      onClose();
      return;
    }
    store.setLoadingFile(true);
    fetch(`/api/files/read?path=${encodeURIComponent(node.path)}`)
      .then((r) => r.json())
      .then((data) => {
        store.openFile({
          path: node.path,
          name: node.name,
          displayName: node.displayName || node.name,
          content: data.content,
          originalContent: data.content,
          isDirty: false,
          isReadOnly: data.isReadOnly,
        });
      })
      .catch(() => toast.error("Failed to open file"))
      .finally(() => store.setLoadingFile(false));
    onClose();
  };

  const openExternal = async () => {
    onClose();
    const res = await fetch("/api/files/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: node.path }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || "Failed to open in external editor");
    }
  };

  const revealInExplorer = async () => {
    onClose();
    const res = await fetch("/api/files/open-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: node.path }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || "Failed to reveal in explorer");
    }
  };

  const deleteFile = async () => {
    onClose();
    if (!confirm(`Delete "${node.name}"? This cannot be undone.`)) return;
    const res = await fetch("/api/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: node.path }),
    });
    if (res.ok) {
      // Close in editor if open
      const store = useFileStore.getState();
      if (store.openFiles.some((f) => f.path === node.path)) {
        store.closeFile(node.path);
      }
      await store.refreshTree();
      toast.success(`Deleted "${node.name}"`);
    } else {
      const d = await res.json();
      toast.error(d.error || "Delete failed");
    }
  };

  const copyToSet = async (targetSetName: string) => {
    if (!targetSetName.trim()) return;
    const res = await fetch("/api/files/copy-to-set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePath: node.path, targetSetName: targetSetName.trim() }),
    });
    if (res.ok) {
      await useFileStore.getState().refreshTree();
      useAppStore.getState().bumpPromptSetList();
      toast.success(`Copied to "${targetSetName.trim()}"`);
      onClose();
    } else {
      const d = await res.json();
      toast.error(d.error || "Copy failed");
    }
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="w-52 rounded-md border bg-popover shadow-lg py-1 text-xs overflow-visible"
    >
      {isFile && (
        <MenuItem onClick={openFile}>Open</MenuItem>
      )}
      <MenuItem onClick={openExternal}>Open in External Editor</MenuItem>
      <MenuItem onClick={revealInExplorer}>Reveal in Explorer</MenuItem>

      <Divider />

      {/* Copy to prompt set — flyout submenu on hover */}
      <div
        className="relative"
        onMouseEnter={() => {
          if (availableSets.length === 0) {
            fetch("/api/export/list-sets")
              .then((r) => r.json())
              .then((d) => setAvailableSets(d.sets ?? []))
              .catch(() => setAvailableSets([]));
          }
          setShowCopyToSet(true);
        }}
        onMouseLeave={() => setShowCopyToSet(false)}
      >
        <button className="flex w-full items-center justify-between px-3 py-1.5 hover:bg-accent transition-colors">
          Save Copy to Prompt Set
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
        {showCopyToSet && (
          <div className="absolute left-full top-0 ml-0.5 z-50 w-52 rounded-md border bg-popover shadow-lg py-1 text-xs">
            {availableSets.map((name) => (
              <button
                key={name}
                onClick={() => copyToSet(name)}
                className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors truncate"
              >
                {name}
              </button>
            ))}
            {availableSets.length > 0 && <div className="my-1 border-t" />}
            <div className="px-3 py-1 text-[10px] text-muted-foreground">New prompt set:</div>
            <div className="flex gap-1 px-2 pb-1.5">
              <input
                className="flex-1 h-6 rounded border bg-background px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Set name..."
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") copyToSet(newSetName);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={() => copyToSet(newSetName)}
                disabled={!newSetName.trim()}
                className="rounded bg-primary px-2 text-[10px] text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {isFile && !isReadOnly && (
        <>
          <Divider />
          <MenuItem onClick={deleteFile} danger>Delete</MenuItem>
        </>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 hover:bg-accent transition-colors ${
        danger ? "text-destructive hover:bg-destructive/10" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t" />;
}
