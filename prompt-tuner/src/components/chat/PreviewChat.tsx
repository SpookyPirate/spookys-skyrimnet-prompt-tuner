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
import type { ChatMessage } from "@/types/llm";
import type { ChatEntry } from "@/types/simulation";
import { GmControls } from "@/components/gamemaster/GmControls";
import { Send, Loader2, Trash2, Square } from "lucide-react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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

  const hasApiKey = !!globalApiKey;

  return (
    <div className="flex h-full flex-col">
      {/* Chat messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-3 space-y-2">
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
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
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
              <span className="text-[8px] text-purple-400/70 ml-1">[GM]</span>
            )}
          </div>
        )}
        <div className="whitespace-pre-wrap">{entry.content}</div>
      </div>
    </div>
  );
}

// ===== Pipeline helper functions =====

/**
 * Target selection through rendered pipeline, with hardcoded fallback.
 */
async function runTargetSelection(
  playerMessage: string,
  chatHistory: ChatEntry[],
  npcs: { displayName: string; gender: string; race: string; distance: number; uuid: string }[],
  scene: { location: string; weather: string; timeOfDay: string; worldPrompt: string; scenePrompt: string },
  playerConfig: { name: string; gender: string; race: string; level: number },
  activePromptSet: string,
  setPreview: (preview: { renderedPrompt: string; messages: { role: string; content: string }[]; rawResponse: string } | null) => void,
  gameEvents?: unknown[]
) {
  let messages: ChatMessage[];

  let renderedPrompt = "";

  try {
    const renderRes = await fetch("/api/prompts/render-target-selector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerMessage,
        chatHistory,
        npcs,
        scene,
        player: playerConfig,
        gameEvents,
        promptSetBase: activePromptSet || undefined,
      }),
    });
    const renderData = await renderRes.json();

    if (renderData.messages && renderData.messages.length > 0) {
      messages = renderData.messages;
      renderedPrompt = renderData.renderedText || "";
    } else {
      throw new Error(renderData.error || "Empty render");
    }
  } catch (err) {
    // Fallback to hardcoded prompt
    toast.warning("Target selector pipeline failed", {
      description: `Could not render player_dialogue_target_selector.prompt — using simplified fallback. ${err instanceof Error ? err.message : ""}`,
    });
    messages = [
      {
        role: "system",
        content: `Select which NPC the player is addressing. Output only the NPC's name.\n\nCandidates:\n${npcs.map((n) => `- ${n.displayName} (${n.gender} ${n.race}, ${n.distance} units away)`).join("\n")}`,
      },
      {
        role: "user",
        content: `Location: ${scene.location}\n\nRecent dialogue:\n${chatHistory.map((e) => e.type === "player" ? `${e.speaker || "Player"}: ${e.content}` : e.type === "npc" ? `${e.speaker}: ${e.content}` : e.content).join("\n")}\n\nPlayer says: "${playerMessage}"\n\nWho is the player addressing? Output only the name.`,
      },
    ];
  }

  const log = await sendLlmRequest({ messages, agent: "meta_eval" });

  if (renderedPrompt) {
    setPreview({
      renderedPrompt,
      messages,
      rawResponse: log.response || "",
    });
  } else {
    setPreview(null);
  }

  return { response: log.response, log };
}

/**
 * Action selector through rendered pipeline (already wired).
 */
async function runRealActionSelector(
  targetNpc: { displayName: string; uuid: string },
  playerMessage: string,
  npcResponse: string,
  eventHistory: string,
  eligibleActions: { name: string; description: string; parameterSchema?: string }[],
  scene: { location: string; scenePrompt: string; weather: string; timeOfDay: string },
  activePromptSet: string,
  addLlmCall: (log: import("@/types/llm").LlmCallLog) => void,
  setLastAction: (action: { name: string; params?: Record<string, string> } | null) => void,
  setLastActionSelectorPreview: (preview: {
    renderedPrompt: string;
    messages: { role: string; content: string }[];
    rawResponse: string;
    parsedAction: string;
  } | null) => void,
  addChatEntry: (entry: ChatEntry) => void,
  playerConfig?: import("@/types/simulation").PlayerConfig,
  selectedNpcs?: import("@/types/simulation").NpcConfig[],
  chatHistory?: ChatEntry[],
  gameEvents?: unknown[]
) {
  const renderRes = await fetch("/api/prompts/render-action-selector", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      npcName: targetNpc.displayName,
      npcUUID: targetNpc.uuid,
      playerMessage,
      npcResponse,
      eligibleActions: eligibleActions.map((a) => ({
        name: a.name,
        description: a.description,
        parameterSchema: a.parameterSchema,
      })),
      eventHistory,
      scene,
      promptSetBase: activePromptSet || undefined,
      player: playerConfig,
      selectedNpcs: selectedNpcs || [],
      chatHistory: chatHistory || [],
      gameEvents,
    }),
  });

  const renderData = await renderRes.json();

  if (renderData.error) {
    setLastActionSelectorPreview({
      renderedPrompt: `Error: ${renderData.error}`,
      messages: [],
      rawResponse: "",
      parsedAction: "",
    });
    return;
  }

  const messages = renderData.messages || [];
  if (messages.length === 0) {
    setLastActionSelectorPreview({
      renderedPrompt: renderData.renderedText || "(empty)",
      messages: [],
      rawResponse: "",
      parsedAction: "Template produced no messages",
    });
    return;
  }

  const log = await sendLlmRequest({ messages, agent: "action_eval" });
  addLlmCall(log);

  const rawResponse = log.response || "";
  const actionMatch = rawResponse.match(/ACTION:\s*(\w+)/);
  const parsedAction = actionMatch ? actionMatch[1] : "None";

  setLastActionSelectorPreview({
    renderedPrompt: renderData.renderedText || "",
    messages,
    rawResponse,
    parsedAction,
  });

  if (parsedAction && parsedAction !== "None") {
    setLastAction({ name: parsedAction });
    addChatEntry({
      id: `${Date.now()}-action`,
      type: "system",
      content: `[Action: ${parsedAction}]`,
      timestamp: Date.now(),
      action: { name: parsedAction },
    });
  } else {
    setLastAction(null);
  }
}

/**
 * Speaker prediction through rendered pipeline, with hardcoded fallback.
 */
async function runSpeakerPrediction(
  lastSpeaker: string,
  chatHistory: ChatEntry[],
  npcs: { displayName: string; gender: string; race: string; distance: number; uuid: string }[],
  scene: { location: string; weather: string; timeOfDay: string; worldPrompt: string; scenePrompt: string },
  playerConfig: { name: string; gender: string; race: string; level: number },
  activePromptSet: string,
  setPreview: (preview: { renderedPrompt: string; messages: { role: string; content: string }[]; rawResponse: string } | null) => void,
  gameEvents?: unknown[]
) {
  let messages: ChatMessage[];
  let renderedPrompt = "";

  try {
    const renderRes = await fetch("/api/prompts/render-speaker-selector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastSpeaker,
        chatHistory,
        npcs,
        scene,
        player: playerConfig,
        gameEvents,
        promptSetBase: activePromptSet || undefined,
      }),
    });
    const renderData = await renderRes.json();

    if (renderData.messages && renderData.messages.length > 0) {
      messages = renderData.messages;
      renderedPrompt = renderData.renderedText || "";
    } else {
      throw new Error(renderData.error || "Empty render");
    }
  } catch (err) {
    // Fallback to hardcoded prompt
    toast.warning("Speaker selector pipeline failed", {
      description: `Could not render dialogue_speaker_selector.prompt — using simplified fallback. ${err instanceof Error ? err.message : ""}`,
    });
    const candidates = npcs.filter((n) => n.displayName !== lastSpeaker);
    messages = [
      {
        role: "system",
        content: `Select who speaks next. Output: 0 (silence) or [speaker]>[target]\nDo NOT select ${lastSpeaker} as speaker.\n\nCandidates:\n${candidates.map((n) => `- ${n.displayName} (${n.gender} ${n.race})`).join("\n")}`,
      },
      {
        role: "user",
        content: `Location: ${scene.location}\n\nRecent dialogue:\n${chatHistory.map((e) => e.type === "player" ? `${e.speaker || "Player"}: ${e.content}` : e.type === "npc" ? `${e.speaker}: ${e.content}` : e.content).join("\n")}\n\nWho speaks next? Output 0 or [Name]>[target]`,
      },
    ];
  }

  const log = await sendLlmRequest({ messages, agent: "meta_eval" });

  if (renderedPrompt) {
    setPreview({
      renderedPrompt,
      messages,
      rawResponse: log.response || "",
    });
  } else {
    setPreview(null);
  }

  return { response: log.response, log };
}
