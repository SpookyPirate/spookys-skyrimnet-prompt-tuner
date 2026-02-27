"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSimulationStore } from "@/stores/simulationStore";
import { useConfigStore } from "@/stores/configStore";
import { useAppStore } from "@/stores/appStore";
import { useTriggerStore } from "@/stores/triggerStore";
import { sendLlmRequest } from "@/lib/llm/client";
import { runTargetSelection, runRealActionSelector, runSpeakerPrediction } from "@/lib/pipeline/chat-pipeline";
import type { ChatMessage } from "@/types/llm";
import type { ChatEntry } from "@/types/simulation";
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

  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [streamingSpeaker, setStreamingSpeaker] = useState("");
  const [copied, setCopied] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [chatHistory, streamingText]);

  const getEligibleActions = useSimulationStore((s) => s.getEligibleActions);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    const playerMessage = input.trim();
    setInput("");

    // Add player message to chat
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

      // Step 2: Generate dialogue response through pipeline
      setStreamingSpeaker(targetNpc.displayName);
      setStreamingText("");

      let dialogueMessages: ChatMessage[];
      let dialogueRenderedText = "";

      try {
        const renderRes = await fetch("/api/prompts/render-dialogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npc: targetNpc,
            player: playerConfig,
            scene,
            selectedNpcs,
            chatHistory: fullChatHistory,
            eligibleActions: getEligibleActions().map((a) => ({
              name: a.name,
              description: a.description,
              parameterSchema: a.parameterSchema,
            })),
            gameEvents,
            promptSetBase: activePromptSet || undefined,
          }),
        });
        const renderData = await renderRes.json();

        if (renderData.messages && renderData.messages.length > 0) {
          dialogueMessages = renderData.messages;
          dialogueRenderedText = renderData.renderedText || "";
          setLastDialoguePreview({
            renderedPrompt: dialogueRenderedText,
            messages: dialogueMessages,
          });
        } else {
          throw new Error(renderData.error || "Empty render result");
        }
      } catch (renderErr) {
        // Fallback to hardcoded prompt
        console.warn("Dialogue pipeline render failed, using fallback:", renderErr);
        toast.warning("Dialogue pipeline failed", {
          description: `Could not render dialogue_response.prompt — using simplified fallback. ${renderErr instanceof Error ? renderErr.message : ""}`,
        });
        dialogueMessages = [
          {
            role: "system",
            content: `You are ${targetNpc.displayName}, a ${targetNpc.gender} ${targetNpc.race} in Skyrim. Location: ${scene.location}. ${scene.worldPrompt ? `World: ${scene.worldPrompt}` : ""} ${scene.scenePrompt ? `Scene: ${scene.scenePrompt}` : ""}\nYou are speaking with ${playerConfig.name}, a ${playerConfig.gender} ${playerConfig.race} (level ${playerConfig.level}).${playerConfig.isInCombat ? " They are currently in combat." : ""}${playerConfig.bio ? ` About them: ${playerConfig.bio}` : ""}\n\nRespond in character as ${targetNpc.displayName}. Keep responses concise (1-3 sentences typically). Stay in character.`,
          },
          ...chatHistory.slice(-20).map((e): ChatMessage => ({
            role: e.type === "player" ? "user" : "assistant",
            content: e.type === "player" ? e.content : `${e.speaker}: ${e.content}`,
          })),
          { role: "user", content: playerMessage },
        ];
        setLastDialoguePreview(null);
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      const dialogueLog = await sendLlmRequest({
        messages: dialogueMessages,
        agent: "default",
        onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
        signal: abortController.signal,
      });
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

        // Step 3: Run action evaluation through the real native_action_selector.prompt
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

        // Step 4: Speaker prediction (if multiple NPCs) through pipeline
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
    }
  }, [
    input, isProcessing, chatHistory, selectedNpcs, scene, playerConfig,
    addChatEntry, setProcessing, addLlmCall, setLastAction, setLastSpeakerPrediction,
    getEligibleActions, activePromptSet, setLastActionSelectorPreview,
    setLastDialoguePreview, setLastTargetSelectorPreview, setLastSpeakerSelectorPreview,
    streamingText, gameEvents,
  ]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setProcessing(false);
    setStreamingText("");
    setStreamingSpeaker("");
  }, [setProcessing]);

  const formatChatMarkdown = useCallback(() => {
    return chatHistory.map((e) => {
      if (e.type === "player") return `**${playerConfig.name}:** ${e.content}`;
      if (e.type === "npc") return `**${e.speaker}:** ${e.content}`;
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

  return (
    <div className="flex h-full flex-col">
      {/* Chat messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden">
        <div className="p-3 space-y-2">
          {chatHistory.length === 0 && !streamingText && (
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
            <ChatBubble key={entry.id} entry={entry} />
          ))}

          {streamingText && (
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
        </div>
      </ScrollArea>

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

function ChatBubble({ entry }: { entry: ChatEntry }) {
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

