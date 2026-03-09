"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSimulationStore } from "@/stores/simulationStore";
import { useConfigStore } from "@/stores/configStore";
import { useAppStore } from "@/stores/appStore";
import { useTriggerStore } from "@/stores/triggerStore";
import { sendLlmRequest } from "@/lib/llm/client";
import { parseGmAction } from "@/lib/gamemaster/action-parser";
import { scenePlanToTemplateFormat } from "@/types/gamemaster";
import type { SceneBeat, ScenePlan } from "@/types/gamemaster";
import type { ChatMessage } from "@/types/llm";
import type { ChatEntry } from "@/types/simulation";

/**
 * Standard GM eligible actions matching real SkyrimNet's GameMaster.
 * These populate the template's "Available Actions" section and
 * enable the is_action_enabled() checks for each action block.
 */
const GM_ELIGIBLE_ACTIONS = [
  {
    name: "StartConversation",
    description: "Start a new conversation between two characters",
    parameterSchema: '{"speaker": "NPC Name", "target": "NPC or Player Name", "topic": "brief topic direction (2-6 words)"}',
  },
  {
    name: "ContinueConversation",
    description: "Continue an ongoing conversation",
    parameterSchema: '{"speaker": "NPC Name", "target": "NPC or Player Name", "topic": "brief topic direction (2-6 words)"}',
  },
  {
    name: "Narrate",
    description: "Add environmental narration or describe scene changes",
    parameterSchema: '{"text": "narration text"}',
  },
];

/**
 * Autonomous GM loop hook matching real SkyrimNet behavior.
 *
 * Normal mode (F3):  120s cooldown, no scene plan, action selector only.
 *   - "None" = do nothing this tick, loop continues.
 *
 * Continuous mode (F10): 6s cooldown, auto-plans scene, beat-guided.
 *   - "None" is invalid (template enforces action selection).
 *   - Advances beats after each action. Stops when beats exhausted.
 */
export function useGmLoop() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickActiveRef = useRef(false);

  // ---- internal helpers (no React deps) ----

  const clearLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Generate a scene plan by calling the render-scene-planner pipeline,
   * then sending the rendered messages to the LLM.
   */
  const planScene = useCallback(async (): Promise<ScenePlan | null> => {
    const store = useSimulationStore.getState();
    const app = useAppStore.getState();
    const triggerState = useTriggerStore.getState();

    const { selectedNpcs, scene, chatHistory, playerConfig, addLlmCall, setIsPlanning, setGmStatus } = store;
    const activePromptSet = app.activePromptSet;
    const gameEvents = triggerState.eventHistory;

    setIsPlanning(true);
    setGmStatus("planning");

    try {
      const renderRes = await fetch("/api/prompts/render-scene-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npcs: selectedNpcs,
          scene,
          chatHistory,
          gameEvents,
          promptSetBase: activePromptSet || undefined,
          player: playerConfig,
        }),
      });
      const renderData = await renderRes.json();

      if (!renderData.messages || renderData.messages.length === 0) {
        return null;
      }

      const log = await sendLlmRequest({ messages: renderData.messages, agent: "game_master" });
      addLlmCall(log);

      if (!log.response) return null;

      const jsonStr = log.response.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      const plan: ScenePlan = {
        summary: parsed.scene_summary || parsed.summary || "Scene plan",
        tone: parsed.tone || "dramatic",
        centralTension: parsed.central_tension || parsed.centralTension || "",
        tension: parsed.tension || "medium",
        beats: (parsed.beats || []).map((b: Partial<SceneBeat & { primary_characters?: string[] }>, i: number) => ({
          order: b.order || i + 1,
          type: b.type || "dialogue",
          description: b.description || "",
          primaryCharacters: b.primaryCharacters || b.primary_characters || [],
          purpose: b.purpose || "",
        })),
        currentBeatIndex: 0,
        upcomingBeats: [],
        potentialEscalations: parsed.potential_escalations || parsed.potentialEscalations || [],
        naturalEndings: parsed.natural_endings || parsed.naturalEndings || [],
      };
      plan.upcomingBeats = plan.beats.slice(1).map((b) => b.description);
      return plan;
    } catch (e) {
      console.error("Scene planning failed:", e);
      return null;
    } finally {
      setIsPlanning(false);
    }
  }, []);

  /**
   * Execute a single GM action (after the action selector has chosen one).
   * Handles Narrate, StartConversation, ContinueConversation.
   * Returns updated chat history array.
   */
  const executeAction = useCallback(async (
    parsed: ReturnType<typeof parseGmAction>,
    tickChatHistory: ChatEntry[],
    beatIndex: number | undefined,
  ): Promise<ChatEntry[]> => {
    const store = useSimulationStore.getState();
    const app = useAppStore.getState();
    const triggerState = useTriggerStore.getState();

    const { selectedNpcs, scene, playerConfig, addLlmCall, addChatEntry, getEligibleActions, setProcessing } = store;
    const activePromptSet = app.activePromptSet;
    const gameEvents = triggerState.eventHistory;

    if (parsed.action === "Narrate") {
      if (!parsed.params.text) {
        console.warn("[GM] Narrate action has no text, skipping");
        return tickChatHistory;
      }
      const narrationEntry: ChatEntry = {
        id: `${Date.now()}-gm-narration`,
        type: "narration",
        content: parsed.params.text,
        timestamp: Date.now(),
        gmBeatIndex: beatIndex,
        gmAction: "Narrate",
      };
      addChatEntry(narrationEntry);
      return [...tickChatHistory, narrationEntry];
    }

    if (
      (parsed.action === "StartConversation" || parsed.action === "ContinueConversation") &&
      parsed.params.speaker
    ) {
      const speaker = selectedNpcs.find(
        (n) => n.displayName.toLowerCase() === parsed.params.speaker?.toLowerCase()
      );
      if (!speaker) {
        console.warn(`[GM] Speaker "${parsed.params.speaker}" not found in scene NPCs:`, selectedNpcs.map(n => n.displayName));
        return tickChatHistory;
      }

      // Resolve the response target: NPC-to-NPC or NPC-to-Player
      const targetName = parsed.params.target?.toLowerCase();
      const targetNpc = targetName
        ? selectedNpcs.find((n) => n.displayName.toLowerCase() === targetName)
        : null;
      const responseTarget = targetNpc
        ? { type: "npc", UUID: targetNpc.uuid }
        : { type: "player", UUID: "player_001" };

      // Inject GM directive as a system event so the NPC sees it in event history
      // (mirrors real SkyrimNet's gamemaster_dialogue event mechanism)
      const topic = parsed.params.topic || "";
      if (topic) {
        const gmDirective: ChatEntry = {
          id: `${Date.now()}-gm-directive`,
          type: "system",
          content: `[GM directs ${speaker.displayName} to ${parsed.params.target || "Player"}: ${topic}]`,
          timestamp: Date.now(),
          gmAction: parsed.action,
        };
        addChatEntry(gmDirective);
        tickChatHistory = [...tickChatHistory, gmDirective];
      }

      // Render NPC dialogue through pipeline with GM context
      setProcessing(true);
      try {
        let npcMessages: ChatMessage[];
        try {
          const renderRes = await fetch("/api/prompts/render-dialogue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              npc: speaker,
              player: playerConfig,
              scene,
              selectedNpcs,
              chatHistory: tickChatHistory,
              responseTarget,
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
            npcMessages = renderData.messages;
          } else {
            return tickChatHistory;
          }
        } catch {
          return tickChatHistory;
        }

        const npcLog = await sendLlmRequest({ messages: npcMessages, agent: "default" });
        addLlmCall(npcLog);

        if (npcLog.error) {
          console.warn(`[GM] NPC dialogue LLM error for ${speaker.displayName}:`, npcLog.error);
        }

        if (npcLog.response) {
          const npcEntry: ChatEntry = {
            id: `${Date.now()}-gm-npc`,
            type: "npc",
            speaker: speaker.displayName,
            target: parsed.params.target,
            content: npcLog.response,
            timestamp: Date.now(),
            gmBeatIndex: beatIndex,
            gmAction: parsed.action,
          };
          addChatEntry(npcEntry);
          return [...tickChatHistory, npcEntry];
        }
      } finally {
        setProcessing(false);
      }
    }

    return tickChatHistory;
  }, []);

  /** Run tick logic. Called from setInterval — guards against re-entry. */
  const runTick = useCallback(async () => {
    if (tickActiveRef.current) return;
    tickActiveRef.current = true;

    try {
      const store = useSimulationStore.getState();
      const config = useConfigStore.getState();
      const app = useAppStore.getState();
      const triggerState = useTriggerStore.getState();

      const {
        gmEnabled, gmContinuousMode,
        selectedNpcs, scene, playerConfig, chatHistory,
        addLlmCall, addGmAction, advanceBeat, setGmStatus,
      } = store;

      if (!gmEnabled || !config.globalApiKey || selectedNpcs.length === 0) {
        return;
      }

      if (store.isProcessing) {
        console.log("[GM] Skipping tick — dialogue generation in progress");
        return;
      }

      const activePromptSet = app.activePromptSet;
      const gameEvents = triggerState.eventHistory;
      const maxRounds = gmContinuousMode ? 3 : 1;

      setGmStatus("running");

      let tickChatHistory = [...chatHistory];

      for (let round = 0; round < maxRounds; round++) {
        if (gmContinuousMode) {
          const currentPlan = useSimulationStore.getState().scenePlan;
          if (!currentPlan) break;
          const currentBeat = currentPlan.beats[currentPlan.currentBeatIndex];
          if (!currentBeat) {
            console.log("[GM] All beats complete, exiting continuous mode");
            useSimulationStore.getState().setGmContinuousMode(false);
            useSimulationStore.getState().setGmCooldown(120);
            break;
          }
        }

        const currentPlan = useSimulationStore.getState().scenePlan;
        const scenePlanForTemplate = (gmContinuousMode && currentPlan)
          ? scenePlanToTemplateFormat(currentPlan)
          : null;

        let gmMessages: ChatMessage[];
        try {
          const renderRes = await fetch("/api/prompts/render-gm-action-selector", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              npcs: selectedNpcs,
              scene,
              chatHistory: tickChatHistory,
              scenePlan: scenePlanForTemplate,
              isContinuousMode: gmContinuousMode,
              gameEvents,
              eligibleActions: GM_ELIGIBLE_ACTIONS,
              promptSetBase: activePromptSet || undefined,
              player: playerConfig,
            }),
          });
          const renderData = await renderRes.json();
          if (renderData.messages && renderData.messages.length > 0) {
            gmMessages = renderData.messages;
          } else {
            console.warn("[GM] Action selector render returned no messages:", renderData.error || "empty");
            break;
          }
        } catch (renderErr) {
          console.error("[GM] Action selector render failed:", renderErr);
          break;
        }

        const gmLog = await sendLlmRequest({ messages: gmMessages, agent: "game_master" });
        addLlmCall(gmLog);

        if (gmLog.error) {
          console.warn("[GM] LLM call returned error:", gmLog.error);
          break;
        }
        if (!gmLog.response) {
          console.warn("[GM] LLM call returned empty response");
          break;
        }

        const parsed = parseGmAction(gmLog.response);
        const beatIndex = currentPlan?.currentBeatIndex;

        console.log(`[GM] Action: ${parsed.action}`, parsed.params);

        addGmAction({
          action: parsed.action,
          params: parsed.params,
          beatIndex: beatIndex ?? 0,
        });

        if (parsed.action === "None") break;

        tickChatHistory = await executeAction(parsed, tickChatHistory, beatIndex);

        if (gmContinuousMode && currentPlan) {
          advanceBeat();
        }
      }

      const stillEnabled = useSimulationStore.getState().gmEnabled;
      if (stillEnabled) {
        setGmStatus("cooldown");
      } else {
        setGmStatus("idle");
      }
    } catch (e) {
      console.error("[GM] Tick error:", e);
      try {
        const s = useSimulationStore.getState();
        s.setGmStatus(s.gmEnabled ? "cooldown" : "idle");
      } catch { /* ignore */ }
    } finally {
      tickActiveRef.current = false;
    }
  }, [executeAction]);

  /** Start the interval loop at the current cooldown rate. */
  const startLoop = useCallback(() => {
    clearLoop();
    const { gmCooldown, gmEnabled } = useSimulationStore.getState();
    if (!gmEnabled) return;
    console.log(`[GM] Starting loop with ${gmCooldown}s interval`);
    intervalRef.current = setInterval(() => runTick(), gmCooldown * 1000);
  }, [clearLoop, runTick]);

  // Start/stop loop when gmEnabled changes
  useEffect(() => {
    const unsub = useSimulationStore.subscribe((state, prev) => {
      if (state.gmEnabled && !prev.gmEnabled) {
        // GM just turned on — run first tick quickly, then start interval
        runTick().then(() => startLoop());
      } else if (!state.gmEnabled && prev.gmEnabled) {
        clearLoop();
        state.setGmStatus("idle");
      }
    });
    return unsub;
  }, [runTick, startLoop, clearLoop]);

  // Handle continuous mode toggle: auto-plan scene on, clear plan on off
  useEffect(() => {
    const unsub = useSimulationStore.subscribe((state, prev) => {
      if (state.gmContinuousMode && !prev.gmContinuousMode && state.gmEnabled) {
        (async () => {
          state.setGmCooldown(6);
          const plan = await planScene();
          if (plan) {
            useSimulationStore.getState().setScenePlan(plan);
          }
          useSimulationStore.getState().setGmStatus("cooldown");
          startLoop();
        })();
      } else if (!state.gmContinuousMode && prev.gmContinuousMode && state.gmEnabled) {
        state.clearScenePlan();
        state.setGmCooldown(120);
        startLoop();
      }
    });
    return unsub;
  }, [startLoop, clearLoop, planScene]);

  // Restart interval when cooldown changes (only if loop is running)
  useEffect(() => {
    const unsub = useSimulationStore.subscribe((state, prev) => {
      if (state.gmCooldown !== prev.gmCooldown && state.gmEnabled && intervalRef.current) {
        startLoop();
      }
    });
    return unsub;
  }, [startLoop]);

  // Reset cooldown timer when player sends a message
  useEffect(() => {
    const unsub = useSimulationStore.subscribe((state, prev) => {
      if (state.gmEnabled && state.chatHistory.length > prev.chatHistory.length) {
        const lastEntry = state.chatHistory[state.chatHistory.length - 1];
        if (lastEntry?.type === "player" && intervalRef.current) {
          // Player just spoke — restart the interval to reset the cooldown
          useSimulationStore.getState().setGmStatus("cooldown");
          startLoop();
        }
      }
    });
    return unsub;
  }, [startLoop]);

  // Clean up on unmount
  useEffect(() => {
    return () => clearLoop();
  }, [clearLoop]);

  return { planScene };
}
