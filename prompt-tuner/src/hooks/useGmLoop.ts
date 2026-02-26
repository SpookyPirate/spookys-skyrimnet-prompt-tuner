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

    const { selectedNpcs, scene, playerConfig, addLlmCall, addChatEntry } = store;
    const activePromptSet = app.activePromptSet;
    const gameEvents = triggerState.eventHistory;

    if (parsed.action === "Narrate" && parsed.params.text) {
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
      if (!speaker) return tickChatHistory;

      // Render NPC dialogue through pipeline
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
    }

    return tickChatHistory;
  }, []);

  /**
   * A single tick of the GM loop.
   *
   * Normal mode:  Run action selector once. "None" = skip, loop continues.
   * Continuous:   Run action selector guided by scene plan beats.
   *               Up to 3 actions per tick. Advance beat after each action.
   */
  const tick = useCallback(async () => {
    if (tickActiveRef.current) return;
    tickActiveRef.current = true;

    const store = useSimulationStore.getState();
    const config = useConfigStore.getState();
    const app = useAppStore.getState();
    const triggerState = useTriggerStore.getState();

    const {
      gmEnabled, gmContinuousMode, scenePlan,
      selectedNpcs, scene, playerConfig, chatHistory,
      addLlmCall, addGmAction, advanceBeat, setGmStatus,
    } = store;

    if (!gmEnabled || !config.globalApiKey || selectedNpcs.length === 0) {
      tickActiveRef.current = false;
      return;
    }

    const activePromptSet = app.activePromptSet;
    const gameEvents = triggerState.eventHistory;
    const maxRounds = gmContinuousMode ? 3 : 1;

    setGmStatus("running");

    let tickChatHistory = [...chatHistory];

    try {
      for (let round = 0; round < maxRounds; round++) {
        // In continuous mode, check if beats remain
        if (gmContinuousMode) {
          const currentPlan = useSimulationStore.getState().scenePlan;
          if (!currentPlan) break;
          const currentBeat = currentPlan.beats[currentPlan.currentBeatIndex];
          if (!currentBeat) {
            // All beats complete — exit continuous mode
            useSimulationStore.getState().setGmContinuousMode(false);
            useSimulationStore.getState().setGmCooldown(120);
            break;
          }
        }

        // Build the scene plan context for the template
        const currentPlan = useSimulationStore.getState().scenePlan;
        const scenePlanForTemplate = (gmContinuousMode && currentPlan)
          ? scenePlanToTemplateFormat(currentPlan)
          : null;

        // Render action selector through pipeline
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
              promptSetBase: activePromptSet || undefined,
              player: playerConfig,
            }),
          });
          const renderData = await renderRes.json();
          if (renderData.messages && renderData.messages.length > 0) {
            gmMessages = renderData.messages;
          } else {
            break;
          }
        } catch {
          break;
        }

        const gmLog = await sendLlmRequest({ messages: gmMessages, agent: "game_master" });
        addLlmCall(gmLog);

        if (!gmLog.response) break;

        const parsed = parseGmAction(gmLog.response);
        const beatIndex = currentPlan?.currentBeatIndex;

        addGmAction({
          action: parsed.action,
          params: parsed.params,
          beatIndex: beatIndex ?? 0,
        });

        // Normal mode: "None" = skip this tick, loop continues
        if (parsed.action === "None") break;

        // Execute the action
        tickChatHistory = await executeAction(parsed, tickChatHistory, beatIndex);

        // In continuous mode, advance beat after each action
        if (gmContinuousMode && currentPlan) {
          advanceBeat();
        }
      }
    } catch (e) {
      console.error("GM loop tick error:", e);
    } finally {
      tickActiveRef.current = false;
      const stillEnabled = useSimulationStore.getState().gmEnabled;
      if (stillEnabled) {
        setGmStatus("cooldown");
      } else {
        setGmStatus("idle");
      }
    }
  }, [executeAction, clearLoop]);

  /**
   * Start the GM loop interval at the current cooldown rate.
   */
  const startLoop = useCallback(() => {
    clearLoop();
    const { gmCooldown } = useSimulationStore.getState();
    // Run first tick immediately
    tick();
    intervalRef.current = setInterval(tick, gmCooldown * 1000);
  }, [tick, clearLoop]);

  /**
   * Stop the GM loop and set status to idle.
   */
  const stopLoop = useCallback(() => {
    clearLoop();
    useSimulationStore.getState().setGmStatus("idle");
  }, [clearLoop]);

  // Start/stop loop when gmEnabled changes
  useEffect(() => {
    const unsub = useSimulationStore.subscribe((state, prev) => {
      if (state.gmEnabled && !prev.gmEnabled) {
        // GM just turned on — start loop
        clearLoop();
        const cooldownMs = state.gmCooldown * 1000;
        // First tick after a short delay to let UI settle
        setTimeout(() => {
          tick();
          intervalRef.current = setInterval(tick, cooldownMs);
        }, 500);
      } else if (!state.gmEnabled && prev.gmEnabled) {
        // GM just turned off — stop loop
        clearLoop();
        state.setGmStatus("idle");
      }
    });
    return unsub;
  }, [tick, clearLoop]);

  // Handle continuous mode toggle: auto-plan scene on, clear plan on off
  useEffect(() => {
    const unsub = useSimulationStore.subscribe((state, prev) => {
      if (state.gmContinuousMode && !prev.gmContinuousMode && state.gmEnabled) {
        // Continuous mode just turned ON — auto-plan and switch to 6s
        (async () => {
          state.setGmCooldown(6);
          const plan = await planScene();
          if (plan) {
            useSimulationStore.getState().setScenePlan(plan);
          }
          useSimulationStore.getState().setGmStatus("cooldown");
          // Restart loop at new cooldown
          clearLoop();
          tick();
          intervalRef.current = setInterval(tick, 6000);
        })();
      } else if (!state.gmContinuousMode && prev.gmContinuousMode && state.gmEnabled) {
        // Continuous mode just turned OFF — clear plan, revert to 120s
        state.clearScenePlan();
        state.setGmCooldown(120);
        // Restart loop at normal cooldown
        clearLoop();
        tick();
        intervalRef.current = setInterval(tick, 120000);
      }
    });
    return unsub;
  }, [tick, clearLoop, planScene]);

  // Restart interval when cooldown changes manually
  useEffect(() => {
    const unsub = useSimulationStore.subscribe((state, prev) => {
      if (state.gmCooldown !== prev.gmCooldown && state.gmEnabled) {
        clearLoop();
        intervalRef.current = setInterval(tick, state.gmCooldown * 1000);
      }
    });
    return unsub;
  }, [tick, clearLoop]);

  // Clean up on unmount
  useEffect(() => {
    return () => clearLoop();
  }, [clearLoop]);

  return { planScene };
}
