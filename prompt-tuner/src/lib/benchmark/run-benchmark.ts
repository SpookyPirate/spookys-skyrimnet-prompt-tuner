import type { BenchmarkCategory, BenchmarkChatEntry, BenchmarkScenario } from "@/types/benchmark";
import type { ChatMessage } from "@/types/llm";
import type { SettingsProfile } from "@/types/config";
import type { AgentType, ModelSlot } from "@/types/config";
import { getCategoryDef } from "./categories";
import { getDefaultScenario, buildRenderBody, buildMultiTurnRenderBody } from "./default-scenarios";
import { buildExplanationMessages } from "./build-explanation-prompt";
import { useBenchmarkStore } from "@/stores/benchmarkStore";
import { useAppStore } from "@/stores/appStore";
import { sendLlmRequestWithSlot } from "@/lib/llm/client";

/**
 * Run a self-explanation follow-up: asks the same model to explain
 * why it responded the way it did. Streams independently from the
 * main response.
 */
async function runSelfExplanation({
  key,
  subtaskIdx,
  category,
  subtaskLabel,
  originalMessages,
  modelResponse,
  agent,
  slot,
  model,
  apiKey,
  signal,
}: {
  key: string;
  subtaskIdx: number;
  category: BenchmarkCategory;
  subtaskLabel: string;
  originalMessages: ChatMessage[];
  modelResponse: string;
  agent: AgentType;
  slot: ModelSlot;
  model: string;
  apiKey: string;
  signal: AbortSignal;
}) {
  const store = useBenchmarkStore.getState();
  store.updateExplanation(key, subtaskIdx, { explanationStatus: "streaming" });

  try {
    const explanationMessages = buildExplanationMessages(
      category,
      subtaskLabel,
      originalMessages,
      modelResponse,
    );

    const log = await sendLlmRequestWithSlot({
      messages: explanationMessages,
      agent,
      slot,
      model,
      apiKey,
      onChunk: (chunk) => {
        useBenchmarkStore.getState().appendExplanationStream(key, subtaskIdx, chunk);
      },
      signal,
    });

    useBenchmarkStore.getState().updateExplanation(key, subtaskIdx, {
      explanation: log.response,
      explanationStatus: log.error ? "error" : "done",
      explanationError: log.error,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return;
    useBenchmarkStore.getState().updateExplanation(key, subtaskIdx, {
      explanationStatus: "error",
      explanationError: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export async function runBenchmark(
  category: BenchmarkCategory,
  profiles: SettingsProfile[],
  scenario?: BenchmarkScenario,
) {
  const activeScenario = scenario || getDefaultScenario(category);

  // Dispatch to multi-turn runner when turns are defined
  if (activeScenario.turns && activeScenario.turns.length > 0) {
    return runMultiTurnBenchmark(category, profiles, activeScenario);
  }

  const store = useBenchmarkStore.getState();
  const catDef = getCategoryDef(category);
  if (!catDef) throw new Error(`Unknown category: ${category}`);

  const activePromptSet = useAppStore.getState().activePromptSet;

  const abortController = new AbortController();
  store.setAbortController(abortController);
  store.setActiveCategory(category);
  store.setIsRunning(true);
  store.clearResults();

  try {
    // Initialize result slots for each profile with subtask structure
    for (const profile of profiles) {
      const key = `${profile.id}-${category}`;
      const agentSlot = profile.slots[catDef.agent];
      const models = agentSlot.api.modelNames
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      store.initResult(key, {
        profileId: profile.id,
        profileName: profile.name,
        category,
        model: models[0] || "(no model)",
        subtasks: catDef.subtasks.map((st) => ({
          subtaskId: st.id,
          subtaskLabel: st.label,
          messages: [],
          response: "",
          latencyMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          streamedText: "",
          status: "pending",
          explanation: "",
          explanationStreamedText: "",
          explanationStatus: "idle",
        })),
        totalLatencyMs: 0,
        totalTokens: 0,
        overallStatus: "streaming",
      });
    }

    // For each subtask, render once then run all profiles in parallel
    for (let stIdx = 0; stIdx < catDef.subtasks.length; stIdx++) {
      if (abortController.signal.aborted) break;

      const subtask = catDef.subtasks[stIdx];

      // Render this subtask's prompt template once
      const renderBody = buildRenderBody(
        subtask.id,
        activeScenario,
        activePromptSet || undefined,
      );

      const renderResponse = await fetch(subtask.renderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renderBody),
        signal: abortController.signal,
      });

      if (!renderResponse.ok) {
        const errData = await renderResponse.json().catch(() => ({}));
        // Mark this subtask as error for all profiles
        for (const profile of profiles) {
          const key = `${profile.id}-${category}`;
          useBenchmarkStore.getState().updateSubtask(key, stIdx, {
            status: "error",
            error: errData.error || `Render failed: HTTP ${renderResponse.status}`,
          });
        }
        continue;
      }

      const renderData = await renderResponse.json();
      const messages: ChatMessage[] = renderData.messages;
      const renderedText: string = renderData.renderedText || "";

      // Store rendered text (append for multi-subtask agents)
      const currentStore = useBenchmarkStore.getState();
      const sep = currentStore.renderedText ? `\n\n--- ${subtask.label} ---\n\n` : "";
      store.setRendered(
        messages,
        currentStore.renderedText + sep + renderedText,
      );

      // Mark subtasks as streaming and store messages
      for (const profile of profiles) {
        const key = `${profile.id}-${category}`;
        useBenchmarkStore.getState().updateSubtask(key, stIdx, {
          status: "streaming",
          messages,
        });
      }

      // Run all profiles in parallel for this subtask
      const promises = profiles.map(async (profile) => {
        const key = `${profile.id}-${category}`;
        const agentSlot = profile.slots[catDef.agent];
        const models = agentSlot.api.modelNames
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean);
        const model = models[0] || "";
        const apiKey = agentSlot.api.apiKey || profile.globalApiKey;

        try {
          const log = await sendLlmRequestWithSlot({
            messages,
            agent: catDef.agent,
            slot: agentSlot,
            model,
            apiKey,
            onChunk: (chunk) => {
              useBenchmarkStore.getState().appendSubtaskStream(key, stIdx, chunk);
            },
            signal: abortController.signal,
          });

          useBenchmarkStore.getState().updateSubtask(key, stIdx, {
            response: log.response,
            latencyMs: log.latencyMs,
            promptTokens: log.promptTokens,
            completionTokens: log.completionTokens,
            totalTokens: log.totalTokens,
            status: log.error ? "error" : "done",
            error: log.error,
          });

          // Run self-explanation after successful response
          if (log.response && !log.error) {
            await runSelfExplanation({
              key,
              subtaskIdx: stIdx,
              category,
              subtaskLabel: subtask.label,
              originalMessages: messages,
              modelResponse: log.response,
              agent: catDef.agent,
              slot: agentSlot,
              model,
              apiKey,
              signal: abortController.signal,
            });
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") return;
          useBenchmarkStore.getState().updateSubtask(key, stIdx, {
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });

      await Promise.allSettled(promises);
    }

    // Finalize overall status for each profile
    for (const profile of profiles) {
      const key = `${profile.id}-${category}`;
      useBenchmarkStore.getState().finalizeResult(key);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return;
    console.error("Benchmark error:", err);
  } finally {
    useBenchmarkStore.getState().setIsRunning(false);
    useBenchmarkStore.getState().setAbortController(null);
  }
}

/**
 * Multi-turn dialogue benchmark.
 * Profiles run in parallel, turns run sequentially within each profile.
 * Each profile accumulates its own chat history (different LLM responses).
 */
async function runMultiTurnBenchmark(
  category: BenchmarkCategory,
  profiles: SettingsProfile[],
  scenario: BenchmarkScenario,
) {
  const store = useBenchmarkStore.getState();
  const catDef = getCategoryDef(category);
  if (!catDef) throw new Error(`Unknown category: ${category}`);

  const turns = scenario.turns!;

  const abortController = new AbortController();
  store.setAbortController(abortController);
  store.setActiveCategory(category);
  store.setIsRunning(true);
  store.clearResults();
  store.setActiveTurns(turns);

  try {
    // Initialize result slots — one subtask per turn, per profile
    for (const profile of profiles) {
      const key = `${profile.id}-${category}`;
      const agentSlot = profile.slots[catDef.agent];
      const models = agentSlot.api.modelNames
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      store.initResult(key, {
        profileId: profile.id,
        profileName: profile.name,
        category,
        model: models[0] || "(no model)",
        subtasks: turns.map((turn) => ({
          subtaskId: turn.id,
          subtaskLabel: turn.label,
          messages: [],
          response: "",
          latencyMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          streamedText: "",
          status: "pending",
          explanation: "",
          explanationStreamedText: "",
          explanationStatus: "idle",
        })),
        totalLatencyMs: 0,
        totalTokens: 0,
        overallStatus: "streaming",
      });
    }

    // Run all profiles in parallel — turns sequential within each profile
    const profilePromises = profiles.map(async (profile) => {
      const key = `${profile.id}-${category}`;
      const agentSlot = profile.slots[catDef.agent];
      const models = agentSlot.api.modelNames
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      const model = models[0] || "";
      const apiKey = agentSlot.api.apiKey || profile.globalApiKey;

      // Each profile accumulates its own chat independently
      const accumulatedChat: BenchmarkChatEntry[] = [];

      for (let turnIdx = 0; turnIdx < turns.length; turnIdx++) {
        if (abortController.signal.aborted) break;

        const turn = turns[turnIdx];

        // 1. Push scripted input to accumulated chat
        accumulatedChat.push({
          type: turn.inputType === "player" ? "player" : "npc",
          speaker: turn.inputSpeaker,
          content: turn.inputContent,
          target: turn.inputTarget,
        });

        // 2. Render the prompt for the responding NPC with current chat
        const renderBody = buildMultiTurnRenderBody(
          turn,
          scenario,
          accumulatedChat,
        );

        try {
          const renderResponse = await fetch("/api/prompts/render-dialogue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(renderBody),
            signal: abortController.signal,
          });

          if (!renderResponse.ok) {
            const errData = await renderResponse.json().catch(() => ({}));
            useBenchmarkStore.getState().updateSubtask(key, turnIdx, {
              status: "error",
              error: errData.error || `Render failed: HTTP ${renderResponse.status}`,
            });
            continue;
          }

          const renderData = await renderResponse.json();
          const messages: ChatMessage[] = renderData.messages;

          // Mark as streaming and store messages for this turn
          useBenchmarkStore.getState().updateSubtask(key, turnIdx, {
            status: "streaming",
            messages,
          });

          // 3. Send rendered messages to LLM (streaming)
          const log = await sendLlmRequestWithSlot({
            messages,
            agent: catDef.agent,
            slot: agentSlot,
            model,
            apiKey,
            onChunk: (chunk) => {
              useBenchmarkStore.getState().appendSubtaskStream(key, turnIdx, chunk);
            },
            signal: abortController.signal,
          });

          useBenchmarkStore.getState().updateSubtask(key, turnIdx, {
            response: log.response,
            latencyMs: log.latencyMs,
            promptTokens: log.promptTokens,
            completionTokens: log.completionTokens,
            totalTokens: log.totalTokens,
            status: log.error ? "error" : "done",
            error: log.error,
          });

          // Run self-explanation after successful response
          if (log.response && !log.error) {
            await runSelfExplanation({
              key,
              subtaskIdx: turnIdx,
              category,
              subtaskLabel: turn.label,
              originalMessages: messages,
              modelResponse: log.response,
              agent: catDef.agent,
              slot: agentSlot,
              model,
              apiKey,
              signal: abortController.signal,
            });
          }

          // 4. Push NPC response to accumulated chat for next turn
          if (log.response && !log.error) {
            const respondingNpc = scenario.npcs[turn.respondingNpcIndex];
            accumulatedChat.push({
              type: "npc",
              speaker: respondingNpc?.displayName || "NPC",
              content: log.response,
              target: turn.inputSpeaker,
            });
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") return;
          useBenchmarkStore.getState().updateSubtask(key, turnIdx, {
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    });

    await Promise.allSettled(profilePromises);

    // Finalize overall status for each profile
    for (const profile of profiles) {
      const key = `${profile.id}-${category}`;
      useBenchmarkStore.getState().finalizeResult(key);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return;
    console.error("Multi-turn benchmark error:", err);
  } finally {
    useBenchmarkStore.getState().setIsRunning(false);
    useBenchmarkStore.getState().setAbortController(null);
  }
}

export function stopBenchmark() {
  const store = useBenchmarkStore.getState();
  store.abortController?.abort();
  store.setIsRunning(false);
  store.setAbortController(null);
}
