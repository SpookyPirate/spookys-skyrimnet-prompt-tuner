"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sendLlmRequest } from "@/lib/llm/client";
import { useSimulationStore } from "@/stores/simulationStore";
import { useAppStore } from "@/stores/appStore";
import { useTriggerStore } from "@/stores/triggerStore";
import { Loader2, Copy, Check, Download, XCircle, RefreshCw } from "lucide-react";
import type { AgentType } from "@/types/config";
import type { ChatMessage } from "@/types/llm";

interface AgentTestDialogProps {
  title: string;
  agent: AgentType;
  renderEndpoint: string;
  icon?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogPhase = "running" | "done" | "error";

export function AgentTestDialog({
  title,
  agent,
  renderEndpoint,
  icon,
  open,
  onOpenChange,
}: AgentTestDialogProps) {
  const [phase, setPhase] = useState<DialogPhase>("running");
  const [streamedText, setStreamedText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [currentNpc, setCurrentNpc] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  const runTest = useCallback(async () => {
    setPhase("running");
    setStreamedText("");
    setError("");
    setCurrentNpc("");

    const controller = new AbortController();
    abortRef.current = controller;

    const { selectedNpcs, chatHistory, playerConfig, scene, addLlmCall } =
      useSimulationStore.getState();
    const { activePromptSet } = useAppStore.getState();
    const gameEvents = useTriggerStore.getState().eventHistory;

    if (selectedNpcs.length === 0) {
      setError("No NPCs selected");
      setPhase("error");
      return;
    }

    try {
      for (const npc of selectedNpcs) {
        if (controller.signal.aborted) return;

        const npcLabel = npc.displayName || npc.name;
        setCurrentNpc(npcLabel);
        setStreamedText((prev) => prev + (prev ? "\n\n" : "") + `## ${npcLabel}\n`);

        // 1. Render the prompt template
        const renderRes = await fetch(renderEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npc,
            player: playerConfig,
            scene,
            selectedNpcs,
            chatHistory,
            gameEvents,
            promptSetBase: activePromptSet || undefined,
          }),
          signal: controller.signal,
        });

        if (!renderRes.ok) {
          const data = await renderRes.json();
          setStreamedText(
            (prev) => prev + `**Error rendering:** ${data.error || renderRes.statusText}\n`
          );
          continue;
        }

        const { messages } = (await renderRes.json()) as { messages: ChatMessage[] };

        // 2. Send to LLM with streaming
        const result = await sendLlmRequest({
          agent,
          messages,
          onChunk: (chunk) => {
            setStreamedText((prev) => prev + chunk);
          },
          signal: controller.signal,
        });

        addLlmCall(result);

        if (result.error) {
          setStreamedText(
            (prev) => prev + `\n**LLM Error:** ${result.error}\n`
          );
        }
      }

      setPhase("done");
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setPhase("error");
    }
  }, [agent, renderEndpoint]);

  // Start when dialog opens
  useEffect(() => {
    if (open) {
      runTest();
    }
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [open, runTest]);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamedText]);

  const handleClose = (openState: boolean) => {
    if (!openState && abortRef.current) {
      abortRef.current.abort();
    }
    onOpenChange(openState);
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(streamedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [streamedText]);

  const handleDownload = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    const slug = title.toLowerCase().replace(/\s+/g, "-");
    const blob = new Blob([streamedText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [streamedText, title]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon}
            {title}
          </DialogTitle>
          <DialogDescription>
            {phase === "running"
              ? `Processing ${currentNpc || "..."}`
              : phase === "done"
                ? "Complete"
                : "Failed"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {phase === "running" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating for {currentNpc || "..."}
            </div>
          )}

          {phase === "error" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <pre
            ref={outputRef}
            className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap"
          >
            {streamedText || (phase === "running" ? "Waiting for response..." : "")}
          </pre>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {(phase === "error" || phase === "done") && (
            <Button variant="outline" onClick={runTest} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          )}
          {streamedText && (
            <>
              <Button variant="outline" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" onClick={handleDownload} className="gap-1.5">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
