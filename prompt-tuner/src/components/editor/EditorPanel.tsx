"use client";

import { useCallback, useState, useEffect } from "react";
import { useFileStore } from "@/stores/fileStore";
import { useAppStore } from "@/stores/appStore";
import { CodeEditor } from "./CodeEditor";
import { EditorTabs } from "./EditorTabs";
import { DiffView } from "./DiffView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileText, Loader2, GitCompare, Eye, Save, FileOutput } from "lucide-react";
import { toast } from "sonner";
import { YamlValidationBadge } from "./YamlValidationBadge";

export function EditorPanel() {
  const openFiles = useFileStore((s) => s.openFiles);
  const activeFilePath = useFileStore((s) => s.activeFilePath);
  const updateFileContent = useFileStore((s) => s.updateFileContent);
  const markFileSaved = useFileStore((s) => s.markFileSaved);
  const isLoadingFile = useFileStore((s) => s.isLoadingFile);

  const [showDiff, setShowDiff] = useState(false);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [showRendered, setShowRendered] = useState(false);
  const [renderedOutput, setRenderedOutput] = useState<string | null>(null);
  const [loadingRender, setLoadingRender] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [availableSets, setAvailableSets] = useState<string[]>([]);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  // Load original content when diff view is toggled
  useEffect(() => {
    if (!showDiff || !activeFilePath || !activeFile) {
      setOriginalContent(null);
      return;
    }
    if (activeFile.isReadOnly) {
      setOriginalContent(null);
      setShowDiff(false);
      return;
    }

    setLoadingOriginal(true);
    fetch(`/api/files/original?path=${encodeURIComponent(activeFilePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.content !== null && data.content !== undefined) {
          setOriginalContent(data.content);
        } else {
          setOriginalContent(null);
          toast.info("No original version found for this file");
          setShowDiff(false);
        }
      })
      .catch(() => {
        setOriginalContent(null);
        setShowDiff(false);
      })
      .finally(() => setLoadingOriginal(false));
  }, [showDiff, activeFilePath, activeFile]);

  // Reset views when switching files
  useEffect(() => {
    setShowDiff(false);
    setShowRendered(false);
    setOriginalContent(null);
    setRenderedOutput(null);
  }, [activeFilePath]);

  const handleChange = useCallback(
    (value: string) => {
      if (activeFilePath) {
        updateFileContent(activeFilePath, value);
      }
    },
    [activeFilePath, updateFileContent]
  );

  const handleSave = useCallback(async () => {
    if (!activeFile || activeFile.isReadOnly || !activeFile.isDirty) return;

    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: activeFile.path,
          content: activeFile.content,
        }),
      });

      if (res.ok) {
        markFileSaved(activeFile.path);
        useFileStore.getState().refreshTree();
        toast.success("File saved");
      } else {
        const data = await res.json();
        toast.error(`Save failed: ${data.error}`);
      }
    } catch (error) {
      toast.error(`Save failed: ${(error as Error).message}`);
    }
  }, [activeFile, markFileSaved]);

  const handleCopyToSet = useCallback(async (targetSetName: string) => {
    if (!activeFile || !targetSetName.trim()) return;
    const res = await fetch("/api/files/copy-to-set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePath: activeFile.path, targetSetName: targetSetName.trim() }),
    });
    if (res.ok) {
      await useFileStore.getState().refreshTree();
      useAppStore.getState().bumpPromptSetList();
      toast.success(`Copied to "${targetSetName.trim()}"`);
      setShowCopyMenu(false);
      setNewSetName("");
    } else {
      const d = await res.json();
      toast.error(d.error || "Copy failed");
    }
  }, [activeFile]);

  const handleRenderPreview = useCallback(async () => {
    if (!activeFile) return;
    setShowRendered(true);
    setLoadingRender(true);
    try {
      const res = await fetch("/api/prompts/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templatePath: activeFile.path,
          simulationState: {
            npcs: [],
            scene: {
              location: "Whiterun",
              weather: "clear",
              timeOfDay: "afternoon",
              worldPrompt: "",
              scenePrompt: "",
            },
          },
        }),
      });
      const data = await res.json();
      if (data.error) {
        setRenderedOutput(`Error: ${data.error}`);
      } else if (data.messages) {
        setRenderedOutput(
          data.messages
            .map(
              (m: { role: string; content: string }) =>
                `--- [${m.role}] ---\n${m.content}`
            )
            .join("\n\n")
        );
      } else {
        setRenderedOutput(data.rendered || "(empty output)");
      }
    } catch (e) {
      setRenderedOutput(`Error: ${(e as Error).message}`);
    } finally {
      setLoadingRender(false);
    }
  }, [activeFile]);

  // Token count estimation (rough: ~4 chars per token for English)
  const tokenEstimate = activeFile
    ? Math.ceil(activeFile.content.length / 4)
    : 0;

  if (isLoadingFile) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (openFiles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <FileText className="h-12 w-12 opacity-20" />
        <div className="text-sm">Open a file from the explorer to start editing</div>
        <div className="text-xs opacity-60">
          Browse prompts in the left panel, or use the search bar
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorTabs />
      {activeFile && (
        <>
          {/* Editor toolbar */}
          <div className="flex items-center gap-0.5 border-b px-2 py-1 bg-card/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showDiff ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setShowDiff(!showDiff);
                    setShowRendered(false);
                  }}
                  disabled={activeFile.isReadOnly}
                >
                  <GitCompare className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Diff against original</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showRendered ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    if (!showRendered) handleRenderPreview();
                    else setShowRendered(false);
                    setShowDiff(false);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Render preview</TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="mx-1 h-4 w-px bg-border shrink-0" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={activeFile.isDirty && !activeFile.isReadOnly ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleSave}
                  disabled={!activeFile.isDirty || activeFile.isReadOnly}
                >
                  <Save className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save (Ctrl+S)</TooltipContent>
            </Tooltip>

            {/* Save copy to prompt set */}
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showCopyMenu ? "secondary" : "ghost"}
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      if (!showCopyMenu) {
                        fetch("/api/export/list-sets")
                          .then((r) => r.json())
                          .then((d) => setAvailableSets(d.sets ?? []))
                          .catch(() => setAvailableSets([]));
                      }
                      setShowCopyMenu((v) => !v);
                    }}
                  >
                    <FileOutput className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save copy to another prompt set</TooltipContent>
              </Tooltip>

              {showCopyMenu && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowCopyMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-md border bg-popover shadow-lg py-1 text-xs">
                    {availableSets.length > 0 && (
                      <>
                        {availableSets.map((name) => (
                          <button
                            key={name}
                            onClick={() => handleCopyToSet(name)}
                            className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors truncate"
                          >
                            {name}
                          </button>
                        ))}
                        <div className="my-1 border-t" />
                      </>
                    )}
                    <div className="px-3 py-1 text-[10px] text-muted-foreground">New prompt set:</div>
                    <div className="flex gap-1 px-2 pb-1.5">
                      <input
                        className="flex-1 h-6 rounded border bg-background px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Set name..."
                        value={newSetName}
                        onChange={(e) => setNewSetName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCopyToSet(newSetName);
                          e.stopPropagation();
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleCopyToSet(newSetName)}
                        disabled={!newSetName.trim()}
                        className="rounded bg-primary px-2 text-[10px] text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex-1" />

            {activeFile.name.endsWith(".yaml") || activeFile.name.endsWith(".yml") ? (
              <YamlValidationBadge content={activeFile.content} filePath={activeFile.path} />
            ) : null}
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
              ~{tokenEstimate.toLocaleString()} tokens
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
              {activeFile.content.split("\n").length} lines
            </Badge>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {showDiff && originalContent !== null && !loadingOriginal ? (
              <DiffView
                original={originalContent}
                modified={activeFile.content}
                originalLabel="Original Prompt"
                modifiedLabel={activeFile.name}
              />
            ) : showRendered ? (
              <div className="h-full overflow-auto bg-background p-3">
                {loadingRender ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <pre className="font-mono text-xs whitespace-pre-wrap text-foreground/80">
                    {renderedOutput}
                  </pre>
                )}
              </div>
            ) : (
              <CodeEditor
                value={activeFile.content}
                onChange={handleChange}
                readOnly={activeFile.isReadOnly}
                onSave={handleSave}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
