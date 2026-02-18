"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSimulationStore } from "@/stores/simulationStore";
import { useConfigStore } from "@/stores/configStore";
import { sendLlmRequest } from "@/lib/llm/client";
import type { ChatMessage } from "@/types/llm";
import type { ChatEntry } from "@/types/simulation";
import { Send, Loader2, Trash2, Square } from "lucide-react";

export function PreviewChat() {
  const chatHistory = useSimulationStore((s) => s.chatHistory);
  const addChatEntry = useSimulationStore((s) => s.addChatEntry);
  const clearChat = useSimulationStore((s) => s.clearChat);
  const isProcessing = useSimulationStore((s) => s.isProcessing);
  const setProcessing = useSimulationStore((s) => s.setProcessing);
  const addLlmCall = useSimulationStore((s) => s.addLlmCall);
  const selectedNpcs = useSimulationStore((s) => s.selectedNpcs);
  const scene = useSimulationStore((s) => s.scene);
  const demoActions = useSimulationStore((s) => s.demoActions);
  const setLastAction = useSimulationStore((s) => s.setLastAction);
  const setLastSpeakerPrediction = useSimulationStore((s) => s.setLastSpeakerPrediction);
  const globalApiKey = useConfigStore((s) => s.globalApiKey);

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

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    const playerMessage = input.trim();
    setInput("");

    // Add player message to chat
    const playerEntry: ChatEntry = {
      id: `${Date.now()}-player`,
      type: "player",
      speaker: "Player",
      content: playerMessage,
      timestamp: Date.now(),
    };
    addChatEntry(playerEntry);
    setProcessing(true);

    try {
      // Build event history from chat
      const eventHistory = chatHistory
        .concat([playerEntry])
        .map((e) => {
          if (e.type === "player") return `Player: ${e.content}`;
          if (e.type === "npc") return `${e.speaker}: ${e.content}`;
          return e.content;
        })
        .join("\n");

      // Step 1: If multiple NPCs, run target selector
      let targetNpc = selectedNpcs[0];
      if (selectedNpcs.length > 1) {
        try {
          const targetResult = await runTargetSelection(
            playerMessage,
            eventHistory,
            selectedNpcs,
            scene
          );
          addLlmCall(targetResult.log);

          // Parse target from response
          const targetName = targetResult.response.trim();
          const found = selectedNpcs.find(
            (n) => n.displayName.toLowerCase() === targetName.toLowerCase().split(">")[0].trim()
          );
          if (found) targetNpc = found;
        } catch (e) {
          console.error("Target selection failed:", e);
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

      // Step 2: Generate dialogue response
      setStreamingSpeaker(targetNpc.displayName);
      setStreamingText("");

      const dialogueMessages: ChatMessage[] = [
        {
          role: "system",
          content: `You are ${targetNpc.displayName}, a ${targetNpc.gender} ${targetNpc.race} in Skyrim. Location: ${scene.location}. ${scene.worldPrompt ? `World: ${scene.worldPrompt}` : ""} ${scene.scenePrompt ? `Scene: ${scene.scenePrompt}` : ""}\n\nRespond in character as ${targetNpc.displayName}. Keep responses concise (1-3 sentences typically). Stay in character.`,
        },
        ...chatHistory.slice(-20).map((e): ChatMessage => ({
          role: e.type === "player" ? "user" : "assistant",
          content: e.type === "player" ? e.content : `${e.speaker}: ${e.content}`,
        })),
        { role: "user", content: playerMessage },
      ];

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
          target: "Player",
          content: npcResponse,
          timestamp: Date.now(),
        });

        // Step 3: Run action evaluation
        if (demoActions.length > 0) {
          try {
            const actionResult = await runActionEvaluation(
              targetNpc.displayName,
              playerMessage,
              npcResponse,
              eventHistory,
              demoActions,
              scene
            );
            addLlmCall(actionResult.log);

            const actionStr = actionResult.response.trim();
            if (actionStr && !actionStr.includes("None")) {
              const actionMatch = actionStr.match(/ACTION:\s*(\w+)/);
              if (actionMatch) {
                setLastAction({ name: actionMatch[1] });
                addChatEntry({
                  id: `${Date.now()}-action`,
                  type: "system",
                  content: `[Action: ${actionMatch[1]}]`,
                  timestamp: Date.now(),
                  action: { name: actionMatch[1] },
                });
              }
            } else {
              setLastAction(null);
            }
          } catch (e) {
            console.error("Action eval failed:", e);
          }
        }

        // Step 4: Speaker prediction (if multiple NPCs)
        if (selectedNpcs.length > 1) {
          try {
            const speakerResult = await runSpeakerPrediction(
              targetNpc.displayName,
              eventHistory + `\n${targetNpc.displayName}: ${npcResponse}`,
              selectedNpcs,
              scene
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
    input, isProcessing, chatHistory, selectedNpcs, scene, demoActions,
    addChatEntry, setProcessing, addLlmCall, setLastAction, setLastSpeakerPrediction,
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

  if (isSystem) {
    return (
      <div className="text-center text-[10px] text-muted-foreground py-0.5">
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
          </div>
        )}
        <div className="whitespace-pre-wrap">{entry.content}</div>
      </div>
    </div>
  );
}

// Helper functions for pipeline steps

async function runTargetSelection(
  playerMessage: string,
  eventHistory: string,
  npcs: { displayName: string; gender: string; race: string; distance: number }[],
  scene: { location: string }
) {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Select which NPC the player is addressing. Output only the NPC's name.\n\nCandidates:\n${npcs.map((n) => `- ${n.displayName} (${n.gender} ${n.race}, ${n.distance} units away)`).join("\n")}`,
    },
    {
      role: "user",
      content: `Location: ${scene.location}\n\nRecent dialogue:\n${eventHistory}\n\nPlayer says: "${playerMessage}"\n\nWho is the player addressing? Output only the name.`,
    },
  ];

  const log = await sendLlmRequest({ messages, agent: "meta_eval" });
  return { response: log.response, log };
}

async function runActionEvaluation(
  npcName: string,
  playerMessage: string,
  npcResponse: string,
  eventHistory: string,
  actions: { name: string; description: string; parameterSchema?: string }[],
  scene: { location: string }
) {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Determine what game action should accompany ${npcName}'s dialogue. Return one line: ACTION: ActionName or ACTION: None\n\nEligible actions:\n${actions.map((a) => `- ${a.name}${a.parameterSchema ? ` PARAMS: ${a.parameterSchema}` : ""} — ${a.description}`).join("\n")}\n- None — No action fits`,
    },
    {
      role: "user",
      content: `Location: ${scene.location}\n\nPlayer: "${playerMessage}"\n${npcName}: "${npcResponse}"\n\nDoes ${npcName}'s response satisfy any action? Return ACTION: line only.`,
    },
  ];

  const log = await sendLlmRequest({ messages, agent: "action_eval" });
  return { response: log.response, log };
}

async function runSpeakerPrediction(
  lastSpeaker: string,
  eventHistory: string,
  npcs: { displayName: string; gender: string; race: string; distance: number }[],
  scene: { location: string }
) {
  const candidates = npcs.filter((n) => n.displayName !== lastSpeaker);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Select who speaks next. Output: 0 (silence) or [speaker]>[target]\nDo NOT select ${lastSpeaker} as speaker.\n\nCandidates:\n${candidates.map((n) => `- ${n.displayName} (${n.gender} ${n.race})`).join("\n")}`,
    },
    {
      role: "user",
      content: `Location: ${scene.location}\n\nRecent dialogue:\n${eventHistory}\n\nWho speaks next? Output 0 or [Name]>[target]`,
    },
  ];

  const log = await sendLlmRequest({ messages, agent: "meta_eval" });
  return { response: log.response, log };
}
