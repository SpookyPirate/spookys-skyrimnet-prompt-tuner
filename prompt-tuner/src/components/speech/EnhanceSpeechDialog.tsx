"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/appStore";
import { sendLlmRequest } from "@/lib/llm/client";
import { SPEECH_STYLE_SYSTEM_PROMPT } from "@/lib/speech/prompt";
import {
  AudioLines,
  Loader2,
  Search,
  User,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface CharacterEntry {
  displayName: string;
  filename: string;
  source: string;
  path: string;
  savePath: string;
  isOriginal: boolean;
}

interface EnhanceSpeechDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogPhase = "select" | "enhancing" | "done" | "error";

export function EnhanceSpeechDialog({
  open,
  onOpenChange,
}: EnhanceSpeechDialogProps) {
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CharacterEntry | null>(null);
  const [phase, setPhase] = useState<DialogPhase>("select");
  const [streamedText, setStreamedText] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  // Fetch character list on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPhase("select");
    setSelected(null);
    setSearch("");
    setStreamedText("");
    setError("");

    const activeSet = useAppStore.getState().activePromptSet;
    fetch(`/api/characters/list?activeSet=${encodeURIComponent(activeSet)}`)
      .then((res) => res.json())
      .then((data) => setCharacters(data.characters ?? []))
      .catch(() => toast.error("Failed to load character list"))
      .finally(() => setLoading(false));
  }, [open]);

  // Auto-scroll streamed output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamedText]);

  const filtered = characters.filter((c) =>
    c.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const handleEnhance = useCallback(async () => {
    if (!selected) return;

    setPhase("enhancing");
    setStreamedText("");
    setError("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1. Read the character bio
      const readRes = await fetch(
        `/api/files/read?path=${encodeURIComponent(selected.path)}`
      );
      if (!readRes.ok) throw new Error("Failed to read character bio");
      const { content: bioContent } = await readRes.json();

      // 2. Send to LLM with speech style prompt
      const result = await sendLlmRequest({
        agent: "tuner",
        messages: [
          { role: "system", content: SPEECH_STYLE_SYSTEM_PROMPT },
          { role: "user", content: bioContent },
        ],
        onChunk: (chunk) => {
          setStreamedText((prev) => prev + chunk);
        },
        signal: controller.signal,
      });

      if (result.error) {
        setError(result.error);
        setPhase("error");
        return;
      }

      // 3. Save the enhanced bio (savePath pre-computed by API)
      const writeRes = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: selected.savePath,
          content: result.response,
        }),
      });

      if (!writeRes.ok) throw new Error("Failed to save enhanced bio");

      setPhase("done");
      toast.success(
        `Enhanced speech style for ${selected.displayName} saved`
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setPhase("error");
    }
  }, [selected]);

  const handleClose = (openState: boolean) => {
    if (!openState && abortRef.current) {
      abortRef.current.abort();
    }
    onOpenChange(openState);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AudioLines className="h-4 w-4" />
            Enhance Speech Style
          </DialogTitle>
          <DialogDescription>
            {phase === "select"
              ? "Select a character bio to enhance with a detailed speech style profile."
              : phase === "enhancing"
                ? "Generating enhanced speech style..."
                : phase === "done"
                  ? "Enhancement complete!"
                  : "Enhancement failed"}
          </DialogDescription>
        </DialogHeader>

        {phase === "select" && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search characters..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Originals will be copied to the active prompt set. Edited set bios
              will be overwritten in place.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {search ? "No matching characters" : "No character bios found"}
              </div>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-0.5">
                  {filtered.map((char) => {
                    const isSelected =
                      selected?.path === char.path;
                    return (
                      <button
                        key={char.path}
                        onClick={() => setSelected(char)}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                          isSelected ? "bg-accent" : ""
                        }`}
                      >
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span
                          className={isSelected ? "font-medium" : ""}
                        >
                          {char.displayName}
                        </span>
                        <Badge
                          variant={char.isOriginal ? "outline" : "secondary"}
                          className="ml-auto text-[10px] px-1.5 py-0"
                        >
                          {char.source}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button
                onClick={handleEnhance}
                disabled={!selected}
                className="gap-1.5"
              >
                <AudioLines className="h-4 w-4" />
                Enhance Speech Style
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "enhancing" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enhancing {selected?.displayName}...
            </div>
            <pre
              ref={outputRef}
              className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap"
            >
              {streamedText || "Waiting for response..."}
            </pre>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Enhanced bio saved for {selected?.displayName}
            </div>
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
              {streamedText}
            </pre>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setPhase("select");
                  setStreamedText("");
                  setSelected(null);
                }}
              >
                Enhance Another
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {error}
            </div>
            {streamedText && (
              <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
                {streamedText}
              </pre>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Close
              </Button>
              <Button onClick={handleEnhance}>Retry</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
