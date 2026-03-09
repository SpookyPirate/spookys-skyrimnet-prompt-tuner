"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSimulationStore } from "@/stores/simulationStore";
import { useConfigStore } from "@/stores/configStore";
import { useAppStore } from "@/stores/appStore";
import { useProfileStore } from "@/stores/profileStore";
import { useTriggerStore } from "@/stores/triggerStore";
import { sendLlmRequest, sendLlmRequestWithSlot } from "@/lib/llm/client";
import { runTargetSelection, runRealActionSelector, runSpeakerPrediction } from "@/lib/pipeline/chat-pipeline";
import { buildEnabledSavesPayload } from "@/lib/pipeline/save-bio-payload";
import type { ChatMessage } from "@/types/llm";
import type { ChatEntry, MultichatResponse } from "@/types/simulation";
import { GmControls } from "@/components/gamemaster/GmControls";
import { Send, Loader2, Trash2, Square, Copy, Check, Download } from "lucide-react";
import { toast } from "sonner";

export function PreviewChat() {
  const chatHistory = useSimulationStore((s) => s.chatHistory);
  const addChatEntry = useSimulationStore((s) => s.addChatEntry);
  const clearChat = useSimulationStore((s) => s.clearChat);
  const isProcessing = useSimulationStore((s) => s.isProcessing);
  const setProcessing = useSimulationStore((s) => s.setProcessing);
  const addLlmCall = useSimulationStore((s) => s.addLlmCall);
  const selectedNpcs = useSimulationStore((s) => s.selectedNpcs);
  const scene = useSimulationStore((s) => s.scene);
  const playerConfig = useSimulationStore((s) => s.playerConfig);
  const setLastAction = useSimulationStore((s) => s.setLastAction);
  const setLastSpeakerPrediction = useSimulationStore((s) => s.setLastSpeakerPrediction);
  const setLastActionSelectorPreview = useSimulationStore((s) => s.setLastActionSelectorPreview);
  const setLastDialoguePreview = useSimulationStore((s) => s.setLastDialoguePreview);
  const setLastTargetSelectorPreview = useSimulationStore((s) => s.setLastTargetSelectorPreview);
  const setLastSpeakerSelectorPreview = useSimulationStore((s) => s.setLastSpeakerSelectorPreview);
  const activePromptSet = useAppStore((s) => s.activePromptSet);
  const globalApiKey = useConfigStore((s) => s.globalApiKey);
  const gameEvents = useTriggerStore((s) => s.eventHistory);

  // Multichat state
  const multichatEnabled = useSimulationStore((s) => s.multichatEnabled);
  const multichatProfileIds = useSimulationStore((s) => s.multichatProfileIds);
  const multichatStreaming = useSimulationStore((s) => s.multichatStreaming);
  const setMultichatStreaming = useSimulationStore((s) => s.setMultichatStreaming);
  const clearMultichatStreaming = useSimulationStore((s) => s.clearMultichatStreaming);
  const profiles = useProfileStore((s) => s.profiles);

  // Multichat is active when enabled AND has valid (still-existing) profiles selected
  const validMultichatIds = multichatEnabled
    ? multichatProfileIds.filter((id) => profiles.some((p) => p.id === id))
    : [];
  const isMultichat = validMultichatIds.length > 0;

  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [streamingSpeaker, setStreamingSpeaker] = useState("");
  const [copied, setCopied] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatHistory, streamingText, multichatStreaming]);

  // Refocus input when processing finishes
  useEffect(() => {
    if (!isProcessing) {
      inputRef.current?.focus();
    }
  }, [isProcessing]);

  const getEligibleActions = useSimulationStore((s) => s.getEligibleActions);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    const playerMessage = input.trim();
    setInput("");

    // Add player message to chat (target filled in after target selection)
    const playerEntry: ChatEntry = {
      id: `${Date.now()}-player`,
      type: "player",
      speaker: playerConfig.name,
      content: playerMessage,
      timestamp: Date.now(),
    };
    addChatEntry(playerEntry);
    setProcessing(true);

    try {
      // Build full chat history including the new player message
      const fullChatHistory = chatHistory.concat([playerEntry]);

      // Build event history string (for legacy fallbacks)
      const eventHistory = fullChatHistory
        .map((e) => {
          if (e.type === "player") return `${playerConfig.name}: ${e.content}`;
          if (e.type === "npc") return `${e.speaker}: ${e.content}`;
          return e.content;
        })
        .join("\n");

      // Step 1: If multiple NPCs, run target selector through pipeline
      let targetNpc = selectedNpcs[0];
      if (selectedNpcs.length > 1) {
        try {
          const targetResult = await runTargetSelection(
            playerMessage,
            fullChatHistory,
            selectedNpcs,
            scene,
            playerConfig,
            activePromptSet,
            setLastTargetSelectorPreview,
            gameEvents
          );
          addLlmCall(targetResult.log);

          const targetName = targetResult.response.trim();
          const found = selectedNpcs.find(
            (n) => n.displayName.toLowerCase() === targetName.toLowerCase().split(">")[0].trim()
          );
          if (found) targetNpc = found;
        } catch (e) {
          console.error("Target selection failed, using first NPC:", e);
        }
      }

      if (!targetNpc) {
        addChatEntry({
          id: `${Date.now()}-system`,
          type: "system",
          content: "No NPCs in scene. Add NPCs using the selector in the left panel.",
          timestamp: Date.now(),
        });
        setProcessing(false);
        return;
      }

      // Backfill target on the player entry now that we know who they're addressing
      playerEntry.target = targetNpc.displayName;
      fullChatHistory[fullChatHistory.length - 1] = { ...playerEntry };

      // Step 2: Generate dialogue response through pipeline
      setStreamingSpeaker(targetNpc.displayName);
      setStreamingText("");

      let dialogueMessages: ChatMessage[];
      let dialogueRenderedText = "";

      const renderRes = await fetch("/api/prompts/render-dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npc: targetNpc,
          player: playerConfig,
          scene,
          selectedNpcs,
          chatHistory: fullChatHistory,
          responseTarget: { type: "player", UUID: "player_001" },
          eligibleActions: getEligibleActions().map((a) => ({
            name: a.name,
            description: a.description,
            parameterSchema: a.parameterSchema,
          })),
          gameEvents,
          promptSetBase: activePromptSet || undefined,
          enabledSaves: buildEnabledSavesPayload(),
        }),
      });
      const renderData = await renderRes.json();

      if (!renderData.messages || renderData.messages.length === 0) {
        const errMsg = renderData.error || "Empty render result";
        toast.error("Dialogue pipeline failed", {
          description: `Could not render dialogue_response.prompt: ${errMsg}`,
        });
        setProcessing(false);
        return;
      }
      dialogueMessages = renderData.messages;
      dialogueRenderedText = renderData.renderedText || "";
      setLastDialoguePreview({
        renderedPrompt: dialogueRenderedText,
        messages: dialogueMessages,
      });

      const abortController = new AbortController();
      abortRef.current = abortController;

      // Use inference mixer overrides if active
      const overrides = useSimulationStore.getState().inferenceOverrides;

      if (isMultichat) {
        // ── MULTICHAT MODE ──────────────────────────────────────────
        // Send dialogue to all selected profiles in parallel
        clearMultichatStreaming();

        const multichatProfiles = validMultichatIds
          .map((id) => profiles.find((p) => p.id === id))
          .filter(Boolean) as typeof profiles;

        const promises = multichatProfiles.map(async (profile) => {
          const slot = { ...profile.slots.default };
          if (overrides && Object.keys(overrides).length > 0) {
            slot.tuning = { ...slot.tuning, ...overrides };
          }

          const apiKey = profile.globalApiKey || globalApiKey;
          // Parse model names and pick first (or rotate)
          const modelNames = slot.api.modelNames.split(",").map((m) => m.trim()).filter(Boolean);
          const model = modelNames[0] || "unknown";

          try {
            const log = await sendLlmRequestWithSlot({
              messages: dialogueMessages,
              agent: "default",
              slot,
              model,
              apiKey,
              onChunk: (chunk) => {
                const current = useSimulationStore.getState().multichatStreaming[profile.id] || "";
                setMultichatStreaming(profile.id, current + chunk);
              },
              signal: abortController.signal,
            });
            addLlmCall(log);

            return {
              profileId: profile.id,
              profileName: profile.name,
              model,
              content: log.response || "",
              latencyMs: log.latencyMs,
              totalTokens: log.totalTokens,
              error: log.error,
            } as MultichatResponse;
          } catch (err) {
            return {
              profileId: profile.id,
              profileName: profile.name,
              model,
              content: "",
              error: (err as Error).name === "AbortError" ? "Cancelled" : (err as Error).message,
            } as MultichatResponse;
          }
        });

        const results = await Promise.all(promises);
        clearMultichatStreaming();
        setStreamingText("");
        setStreamingSpeaker("");

        // Find the primary response (from active profile, or first successful)
        const activeProfileId = useProfileStore.getState().activeProfileId;
        const primaryResult = results.find((r) => r.profileId === activeProfileId && !r.error)
          || results.find((r) => !r.error)
          || results[0];

        const npcResponse = primaryResult?.content || "";

        if (npcResponse && !primaryResult?.error) {
          addChatEntry({
            id: `${Date.now()}-npc`,
            type: "npc",
            speaker: targetNpc.displayName,
            target: playerConfig.name,
            content: npcResponse,
            timestamp: Date.now(),
            multichatResponses: results,
          });

          // Step 3: Action evaluation (uses active profile only)
          const eligibleActions = getEligibleActions();
          if (eligibleActions.length > 0) {
            try {
              await runRealActionSelector(
                targetNpc,
                playerMessage,
                npcResponse,
                eventHistory,
                eligibleActions,
                scene,
                activePromptSet,
                addLlmCall,
                setLastAction,
                setLastActionSelectorPreview,
                addChatEntry,
                playerConfig,
                selectedNpcs,
                fullChatHistory,
                gameEvents
              );
            } catch (e) {
              console.error("Action eval failed:", e);
            }
          }

          // Step 4: Speaker prediction (uses active profile only)
          if (selectedNpcs.length > 1) {
            try {
              const updatedHistory = [...fullChatHistory, {
                id: `${Date.now()}-npc-temp`,
                type: "npc" as const,
                speaker: targetNpc.displayName,
                target: playerConfig.name,
                content: npcResponse,
                timestamp: Date.now(),
              }];
              const speakerResult = await runSpeakerPrediction(
                targetNpc.displayName,
                updatedHistory,
                selectedNpcs,
                scene,
                playerConfig,
                activePromptSet,
                setLastSpeakerSelectorPreview,
                gameEvents
              );
              addLlmCall(speakerResult.log);
              setLastSpeakerPrediction(speakerResult.response.trim());
            } catch (e) {
              console.error("Speaker prediction failed:", e);
            }
          }
        } else {
          addChatEntry({
            id: `${Date.now()}-error`,
            type: "system",
            content: `Error: ${primaryResult?.error || "All models failed"}`,
            timestamp: Date.now(),
          });
        }
      } else {
        // ── STANDARD MODE ───────────────────────────────────────────
        let dialogueLog;
        if (overrides && Object.keys(overrides).length > 0) {
          const store = useConfigStore.getState();
          const baseSlot = store.slots["default"];
          const mixedSlot = {
            ...baseSlot,
            tuning: { ...baseSlot.tuning, ...overrides },
          };
          dialogueLog = await sendLlmRequestWithSlot({
            messages: dialogueMessages,
            agent: "default",
            slot: mixedSlot,
            model: store.getNextModel("default"),
            apiKey: store.getEffectiveApiKey("default"),
            onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
            signal: abortController.signal,
          });
        } else {
          dialogueLog = await sendLlmRequest({
            messages: dialogueMessages,
            agent: "default",
            onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
            signal: abortController.signal,
          });
        }
        addLlmCall(dialogueLog);

        const npcResponse = dialogueLog.response || streamingText;
        setStreamingText("");
        setStreamingSpeaker("");

        if (npcResponse && !dialogueLog.error) {
          addChatEntry({
            id: `${Date.now()}-npc`,
            type: "npc",
            speaker: targetNpc.displayName,
            target: playerConfig.name,
            content: npcResponse,
            timestamp: Date.now(),
          });

          // Step 3: Run action evaluation
          const eligibleActions = getEligibleActions();
          if (eligibleActions.length > 0) {
            try {
              await runRealActionSelector(
                targetNpc,
                playerMessage,
                npcResponse,
                eventHistory,
                eligibleActions,
                scene,
                activePromptSet,
                addLlmCall,
                setLastAction,
                setLastActionSelectorPreview,
                addChatEntry,
                playerConfig,
                selectedNpcs,
                fullChatHistory,
                gameEvents
              );
            } catch (e) {
              console.error("Action eval failed:", e);
            }
          }

          // Step 4: Speaker prediction (if multiple NPCs)
          if (selectedNpcs.length > 1) {
            try {
              const updatedHistory = [...fullChatHistory, {
                id: `${Date.now()}-npc-temp`,
                type: "npc" as const,
                speaker: targetNpc.displayName,
                target: playerConfig.name,
                content: npcResponse,
                timestamp: Date.now(),
              }];
              const speakerResult = await runSpeakerPrediction(
                targetNpc.displayName,
                updatedHistory,
                selectedNpcs,
                scene,
                playerConfig,
                activePromptSet,
                setLastSpeakerSelectorPreview,
                gameEvents
              );
              addLlmCall(speakerResult.log);
              setLastSpeakerPrediction(speakerResult.response.trim());
            } catch (e) {
              console.error("Speaker prediction failed:", e);
            }
          }

        } else if (dialogueLog.error) {
          addChatEntry({
            id: `${Date.now()}-error`,
            type: "system",
            content: `Error: ${dialogueLog.error}`,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        addChatEntry({
          id: `${Date.now()}-error`,
          type: "system",
          content: `Error: ${(error as Error).message}`,
          timestamp: Date.now(),
        });
      }
    } finally {
      setProcessing(false);
      abortRef.current = null;
      clearMultichatStreaming();
    }
  }, [
    input, isProcessing, chatHistory, selectedNpcs, scene, playerConfig,
    addChatEntry, setProcessing, addLlmCall, setLastAction, setLastSpeakerPrediction,
    getEligibleActions, activePromptSet, setLastActionSelectorPreview,
    setLastDialoguePreview, setLastTargetSelectorPreview, setLastSpeakerSelectorPreview,
    streamingText, gameEvents, isMultichat, validMultichatIds, profiles,
    globalApiKey, setMultichatStreaming, clearMultichatStreaming,
  ]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setProcessing(false);
    setStreamingText("");
    setStreamingSpeaker("");
    clearMultichatStreaming();
  }, [setProcessing, clearMultichatStreaming]);

  const formatChatMarkdown = useCallback(() => {
    return chatHistory.map((e) => {
      if (e.type === "player") return `**${playerConfig.name}:** ${e.content}`;
      if (e.type === "npc") {
        if (e.multichatResponses && e.multichatResponses.length > 0) {
          const responses = e.multichatResponses
            .map((r) => `  - **${r.profileName}** (${r.model}): ${r.error || r.content}`)
            .join("\n");
          return `**${e.speaker}:**\n${responses}`;
        }
        return `**${e.speaker}:** ${e.content}`;
      }
      if (e.type === "narration") return `*${e.content}*`;
      return `> ${e.content}`;
    }).join("\n\n");
  }, [chatHistory, playerConfig.name]);

  const handleCopyChat = useCallback(() => {
    navigator.clipboard.writeText(formatChatMarkdown()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [formatChatMarkdown]);

  const handleDownloadChat = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([formatChatMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-log-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [formatChatMarkdown]);

  const hasApiKey = !!globalApiKey;

  // Build multichat streaming entries for display
  const multichatStreamingEntries = Object.entries(multichatStreaming);
  const hasMultichatStreaming = multichatStreamingEntries.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Chat messages */}
      <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-2">
          {chatHistory.length === 0 && !streamingText && !hasMultichatStreaming && (
            <div className="text-center text-xs text-muted-foreground py-8">
              {!hasApiKey ? (
                <span>Configure an API key in Settings to start chatting</span>
              ) : selectedNpcs.length === 0 ? (
                <span>Add NPCs and set up a scene in the left panel, then type a message</span>
              ) : (
                <span>Type a message to start the conversation</span>
              )}
            </div>
          )}

          {chatHistory.map((entry) => (
            entry.multichatResponses && entry.multichatResponses.length > 0 ? (
              <MultichatBubble key={entry.id} entry={entry} />
            ) : (
              <ChatBubble key={entry.id} entry={entry} isMultichat={isMultichat} />
            )
          ))}

          {/* Standard streaming (non-multichat) */}
          {streamingText && !isMultichat && (
            <ChatBubble
              entry={{
                id: "streaming",
                type: "npc",
                speaker: streamingSpeaker,
                content: streamingText,
                timestamp: Date.now(),
              }}
            />
          )}

          {/* Multichat streaming */}
          {hasMultichatStreaming && (
            <MultichatStreamingBubble
              speaker={streamingSpeaker}
              streaming={multichatStreaming}
              profileIds={validMultichatIds}
              profiles={profiles}
            />
          )}
        </div>
      </div>

      {/* GameMaster controls */}
      <GmControls />

      {/* Input area */}
      <div className="border-t p-2">
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={clearChat}
            disabled={isProcessing}
            title="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {chatHistory.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleCopyChat}
                title="Copy dialogue"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleDownloadChat}
                title="Download as markdown"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={hasApiKey ? "Type as the player..." : "Set API key in Settings first"}
            disabled={!hasApiKey || isProcessing}
            className="h-8 text-xs"
          />
          {isProcessing ? (
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleStop}
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || !hasApiKey}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Standard Chat Bubble ─────────────────────────────────────────── */

function ChatBubble({ entry, isMultichat }: { entry: ChatEntry; isMultichat?: boolean }) {
  const isPlayer = entry.type === "player";
  const isSystem = entry.type === "system";
  const isNarration = entry.type === "narration";

  if (isSystem) {
    return (
      <div className="text-center text-[10px] text-muted-foreground py-0.5">
        {entry.content}
      </div>
    );
  }

  if (isNarration) {
    return (
      <div className="text-center text-[10px] italic text-purple-400/80 py-1 px-4">
        {entry.gmAction && (
          <span className="text-[8px] text-purple-500/50 block mb-0.5">[GM: {entry.gmAction}]</span>
        )}
        {entry.content}
      </div>
    );
  }

  // In multichat mode, player bubbles span full width and center-align
  // so they don't get lost next to the wide multichat columns
  if (isPlayer && isMultichat) {
    return (
      <div className="flex justify-center py-1">
        <div className="rounded-lg px-4 py-1.5 text-xs bg-primary text-primary-foreground">
          <span className="font-semibold text-[10px] opacity-70 mr-1.5">{entry.speaker || "Player"}:</span>
          {entry.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isPlayer ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${
          isPlayer
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {!isPlayer && entry.speaker && (
          <div className="font-semibold text-[10px] text-blue-400 mb-0.5">
            {entry.speaker}
            {entry.gmAction && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400/60 ml-1 align-middle" title={`GM: ${entry.gmAction}`} />
            )}
          </div>
        )}
        <div className="whitespace-pre-wrap">{entry.content}</div>
      </div>
    </div>
  );
}

/* ── Multichat Bubble (side-by-side completed responses) ──────────── */

function MultichatBubble({ entry }: { entry: ChatEntry }) {
  const responses = entry.multichatResponses!;
  const count = responses.length;

  return (
    <div className="space-y-1">
      {/* Speaker label */}
      <div className="font-semibold text-[10px] text-blue-400 px-1">
        {entry.speaker}
        {entry.gmAction && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400/60 ml-1 align-middle" title={`GM: ${entry.gmAction}`} />
        )}
      </div>

      {/* Side-by-side columns — always scrollable */}
      <div className="overflow-x-auto pb-1">
        <div
          className="flex gap-1.5"
          style={{ width: count > 2 ? `${count * 288}px` : undefined }}
        >
          {responses.map((resp) => (
            <div
              key={resp.profileId}
              className={`rounded-lg border bg-muted/50 overflow-hidden ${count <= 2 ? "flex-1 min-w-0" : "w-[280px] shrink-0"}`}
            >
              {/* Column header */}
              <div className="px-2 py-1 border-b bg-muted/30 flex items-center gap-1.5">
                <span className="text-[10px] font-semibold truncate">{resp.profileName}</span>
                <Badge variant="outline" className="text-[8px] px-1 py-0 font-mono shrink-0">
                  {resp.model}
                </Badge>
              </div>

              {/* Response body */}
              <div className="px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words min-h-[40px]">
                {resp.error ? (
                  <span className="text-destructive text-[10px]">{resp.error}</span>
                ) : (
                  resp.content
                )}
              </div>

              {/* Footer stats */}
              {(resp.latencyMs || resp.totalTokens) && !resp.error && (
                <div className="flex items-center gap-2 border-t px-2 py-0.5 text-[9px] text-muted-foreground">
                  {resp.latencyMs != null && <span>{(resp.latencyMs / 1000).toFixed(1)}s</span>}
                  {resp.totalTokens != null && <span>{resp.totalTokens} tok</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Multichat Streaming Bubble (in-progress responses) ───────────── */

function MultichatStreamingBubble({
  speaker,
  streaming,
  profileIds,
  profiles,
}: {
  speaker: string;
  streaming: Record<string, string>;
  profileIds: string[];
  profiles: { id: string; name: string; slots: Record<string, { api: { modelNames: string } }> }[];
}) {
  const count = profileIds.length;

  return (
    <div className="space-y-1">
      {/* Speaker label */}
      <div className="font-semibold text-[10px] text-blue-400 px-1">
        {speaker}
      </div>

      {/* Side-by-side streaming columns — always scrollable */}
      <div className="overflow-x-auto pb-1">
        <div
          className="flex gap-1.5"
          style={{ width: count > 2 ? `${count * 288}px` : undefined }}
        >
          {profileIds.map((profileId) => {
            const profile = profiles.find((p) => p.id === profileId);
            const text = streaming[profileId] || "";
            const model = profile?.slots?.default?.api?.modelNames?.split(",")[0]?.trim() || "unknown";

            return (
              <div
                key={profileId}
                className={`rounded-lg border bg-muted/50 overflow-hidden ${count <= 2 ? "flex-1 min-w-0" : "w-[280px] shrink-0"}`}
              >
                {/* Column header */}
                <div className="px-2 py-1 border-b bg-muted/30 flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold truncate">
                    {profile?.name || profileId}
                  </span>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 font-mono shrink-0">
                    {model}
                  </Badge>
                </div>

                {/* Streaming body */}
                <div className="px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words min-h-[40px]">
                  {text || (
                    <span className="text-muted-foreground italic flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generating...
                    </span>
                  )}
                  {text && (
                    <span className="inline-block w-1.5 h-3.5 bg-foreground/70 animate-pulse ml-0.5 align-text-bottom" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
