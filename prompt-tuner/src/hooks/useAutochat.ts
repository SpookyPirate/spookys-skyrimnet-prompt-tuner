"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSimulationStore } from "@/stores/simulationStore";
import { useConfigStore } from "@/stores/configStore";
import { useAppStore } from "@/stores/appStore";
import { useTriggerStore } from "@/stores/triggerStore";
import { sendLlmRequest } from "@/lib/llm/client";
import { buildAutochatMessages } from "@/lib/autochat/system-prompt";
import { parseAutochatResponse } from "@/lib/autochat/response-parser";
import {
  runTargetSelection,
  runRealActionSelector,
  runSpeakerPrediction,
} from "@/lib/pipeline/chat-pipeline";
import type { ChatEntry } from "@/types/simulation";
import type { ChatMessage } from "@/types/llm";

/** Fixed interval between autochat messages (seconds). */
const TICK_INTERVAL_S = 15;

/**
 * Autochat loop hook — an LLM acts as the player character,
 * generating dialogue and triggering events on a timer.
 * Runs for a configured duration then auto-stops.
 */
export function useAutochat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickActiveRef = useRef(false);

  const clearLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /** Check if the duration has expired and stop if so. Returns true if expired. */
  const checkExpired = useCallback((): boolean => {
    const { autochatDuration, autochatStartedAt, setAutochatEnabled, setAutochatStatus, setAutochatStartedAt } =
      useSimulationStore.getState();

    if (autochatDuration === 0 || !autochatStartedAt) return false; // infinite or not started

    const elapsedMs = Date.now() - autochatStartedAt;
    const durationMs = autochatDuration * 60 * 1000;
    if (elapsedMs >= durationMs) {
      setAutochatEnabled(false);
      setAutochatStatus("idle");
      setAutochatStartedAt(null);
      return true;
    }
    return false;
  }, []);

  const tick = useCallback(async () => {
    if (tickActiveRef.current) return;
    tickActiveRef.current = true;

    try {
      // Check duration expiry before doing work
      if (checkExpired()) return;

      const store = useSimulationStore.getState();
      const config = useConfigStore.getState();
      const app = useAppStore.getState();
      const triggerState = useTriggerStore.getState();

      const {
        autochatEnabled,
        isProcessing,
        selectedNpcs,
        scene,
        playerConfig,
        chatHistory,
        addChatEntry,
        addLlmCall,
        setProcessing,
        setAutochatStatus,
        setLastAction,
        setLastSpeakerPrediction,
        setLastActionSelectorPreview,
        setLastDialoguePreview,
        setLastTargetSelectorPreview,
        setLastSpeakerSelectorPreview,
        getEligibleActions,
      } = store;

      // Guards
      if (!autochatEnabled) return;
      if (!config.globalApiKey) return;
      if (selectedNpcs.length === 0) return;
      if (isProcessing) return;

      setAutochatStatus("running");
      setProcessing(true);

      const activePromptSet = app.activePromptSet;
      const gameEvents = triggerState.eventHistory;

      // 1. Build autochat prompt and call LLM
      const autochatMessages = buildAutochatMessages({
        playerConfig,
        scene,
        selectedNpcs,
        chatHistory,
        gameEvents,
      });

      const autochatLog = await sendLlmRequest({
        messages: autochatMessages,
        agent: "autochat",
      });
      addLlmCall(autochatLog);

      if (autochatLog.error || !autochatLog.response) {
        console.warn("[Autochat] LLM error:", autochatLog.error || "empty response");
        setProcessing(false);
        setAutochatStatus(useSimulationStore.getState().autochatEnabled ? "cooldown" : "idle");
        return;
      }

      // 2. Parse response
      const parsed = parseAutochatResponse(autochatLog.response);

      // 3. Fire any events
      for (const event of parsed.events) {
        triggerState.fireEvent(event);
        addChatEntry({
          id: `${Date.now()}-autochat-event-${Math.random().toString(36).slice(2, 5)}`,
          type: "system",
          content: `[${playerConfig.name} triggers ${event.eventType}: ${Object.entries(event.fields).map(([k, v]) => `${k}=${v}`).join(", ")}]`,
          timestamp: Date.now(),
        });
      }

      // 4. If dialogue, add player entry and run full pipeline
      if (parsed.dialogue) {
        const playerEntry: ChatEntry = {
          id: `${Date.now()}-autochat-player`,
          type: "player",
          speaker: playerConfig.name,
          content: parsed.dialogue,
          timestamp: Date.now(),
        };
        addChatEntry(playerEntry);

        const fullChatHistory = [...chatHistory, playerEntry];

        // Build event history string for action selector
        const eventHistory = fullChatHistory
          .map((e) => {
            if (e.type === "player") return `${playerConfig.name}: ${e.content}`;
            if (e.type === "npc") return `${e.speaker}: ${e.content}`;
            return e.content;
          })
          .join("\n");

        // Step A: Target selection (if multiple NPCs)
        let targetNpc = selectedNpcs[0];
        if (selectedNpcs.length > 1) {
          try {
            const targetResult = await runTargetSelection(
              parsed.dialogue,
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
            console.error("[Autochat] Target selection failed, using first NPC:", e);
          }
        }

        if (!targetNpc) {
          setProcessing(false);
          setAutochatStatus(useSimulationStore.getState().autochatEnabled ? "cooldown" : "idle");
          return;
        }

        // Step B: Generate NPC dialogue response (no streaming for autochat)
        let dialogueMessages: ChatMessage[];

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
            setLastDialoguePreview({
              renderedPrompt: renderData.renderedText || "",
              messages: dialogueMessages,
            });
          } else {
            throw new Error(renderData.error || "Empty render result");
          }
        } catch {
          // Fallback
          dialogueMessages = [
            {
              role: "system",
              content: `You are ${targetNpc.displayName}, a ${targetNpc.gender} ${targetNpc.race} in Skyrim. Location: ${scene.location}. Respond in character. Keep responses concise (1-3 sentences).`,
            },
            ...chatHistory.slice(-20).map((e): ChatMessage => ({
              role: e.type === "player" ? "user" : "assistant",
              content: e.type === "player" ? e.content : `${e.speaker}: ${e.content}`,
            })),
            { role: "user", content: parsed.dialogue },
          ];
          setLastDialoguePreview(null);
        }

        const dialogueLog = await sendLlmRequest({
          messages: dialogueMessages,
          agent: "default",
        });
        addLlmCall(dialogueLog);

        const npcResponse = dialogueLog.response || "";

        if (npcResponse && !dialogueLog.error) {
          const npcEntry: ChatEntry = {
            id: `${Date.now()}-autochat-npc`,
            type: "npc",
            speaker: targetNpc.displayName,
            target: playerConfig.name,
            content: npcResponse,
            timestamp: Date.now(),
          };
          addChatEntry(npcEntry);

          const updatedChatHistory = [...fullChatHistory, npcEntry];

          // Step C: Action evaluation
          const eligibleActions = getEligibleActions();
          if (eligibleActions.length > 0) {
            try {
              await runRealActionSelector(
                targetNpc,
                parsed.dialogue,
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
              console.error("[Autochat] Action eval failed:", e);
            }
          }

          // Step D: Speaker prediction (if multiple NPCs)
          if (selectedNpcs.length > 1) {
            try {
              const speakerResult = await runSpeakerPrediction(
                targetNpc.displayName,
                updatedChatHistory,
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
              console.error("[Autochat] Speaker prediction failed:", e);
            }
          }
        }
      }

      // Check duration expiry after processing
      if (checkExpired()) {
        setProcessing(false);
        return;
      }

      setProcessing(false);
      setAutochatStatus(useSimulationStore.getState().autochatEnabled ? "cooldown" : "idle");
    } catch (e) {
      console.error("[Autochat] Tick error:", e);
      try {
        const s = useSimulationStore.getState();
        s.setProcessing(false);
        s.setAutochatStatus(s.autochatEnabled ? "cooldown" : "idle");
      } catch { /* ignore */ }
    } finally {
      tickActiveRef.current = false;
    }
  }, [checkExpired]);

  // Start/stop loop when autochatEnabled changes
  useEffect(() => {
    const unsub = useSimulationStore.subscribe((state, prev) => {
      if (state.autochatEnabled && !prev.autochatEnabled) {
        // Record start time
        state.setAutochatStartedAt(Date.now());
        clearLoop();
        setTimeout(() => {
          tick();
          intervalRef.current = setInterval(tick, TICK_INTERVAL_S * 1000);
        }, 500);
      } else if (!state.autochatEnabled && prev.autochatEnabled) {
        clearLoop();
        state.setAutochatStatus("idle");
        state.setAutochatStartedAt(null);
      }
    });
    return unsub;
  }, [tick, clearLoop]);

  // Duration expiry check (runs every second for accurate countdown)
  useEffect(() => {
    const id = setInterval(() => {
      const { autochatEnabled } = useSimulationStore.getState();
      if (autochatEnabled) {
        checkExpired();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [checkExpired]);

  // Clean up on unmount
  useEffect(() => {
    return () => clearLoop();
  }, [clearLoop]);
}
