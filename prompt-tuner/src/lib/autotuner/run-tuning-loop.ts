import type { BenchmarkCategory, BenchmarkScenario, BenchmarkChatEntry } from "@/types/benchmark";
import type { SettingsProfile } from "@/types/config";
import type { ChatMessage } from "@/types/llm";
import type { TuningTarget, TunerTurnResult } from "@/types/autotuner";
import { getCategoryDef } from "@/lib/benchmark/categories";
import { getDefaultScenario, buildRenderBody, buildMultiTurnRenderBody } from "@/lib/benchmark/default-scenarios";
import { buildAssessmentMessages } from "@/lib/benchmark/build-assessment-prompt";
import { buildExplanationMessages } from "@/lib/benchmark/build-explanation-prompt";
import { buildProposalMessages } from "./build-proposal-prompt";
import { parseProposal } from "./parse-proposal";
import { applySettingsChanges, applyPromptChanges } from "./apply-changes";
import { fetchPromptContent } from "./fetch-prompt-content";
import { createTunerTempSet, deleteTunerTempSet, TUNER_TEMP_SET } from "./save-results";
import { sendLlmRequest, sendLlmRequestWithSlot } from "@/lib/llm/client";
import { useAutoTunerStore } from "@/stores/autoTunerStore";

/**
 * Main auto-tuning loop orchestrator.
 * Runs benchmark → assess → propose → apply for each round.
 */
export async function runTuningLoop(
  category: BenchmarkCategory,
  profile: SettingsProfile,
  tuningTarget: TuningTarget,
  maxRounds: number,
  scenario?: BenchmarkScenario,
  selectedPromptSet?: string,
  lockedSettings?: (keyof import("@/types/config").AiTuningSettings)[],
  customInstructions?: string,
) {
  const store = useAutoTunerStore.getState();
  const catDef = getCategoryDef(category);
  if (!catDef) throw new Error(`Unknown category: ${category}`);

  const activeScenario = scenario || getDefaultScenario(category);
  const agent = catDef.agent;
  const agentSlot = profile.slots[agent];

  // Snapshot original settings
  const originalSettings = { ...agentSlot.tuning };
  let workingSettings = { ...originalSettings };
  let workingPromptSet = selectedPromptSet || "";
  let tempSetCreated = false;

  const abortController = new AbortController();

  store.setAbortController(abortController);
  store.setOriginalSettings(originalSettings);
  store.setWorkingSettings(workingSettings);
  store.setIsRunning(true);
  store.setPhase("benchmarking");

  // Clean up any existing temp set
  await deleteTunerTempSet();

  const models = agentSlot.api.modelNames.split(",").map((m) => m.trim()).filter(Boolean);
  const model = models[0] || "";
  const apiKey = agentSlot.api.apiKey || profile.globalApiKey;

  try {
    for (let round = 1; round <= maxRounds; round++) {
      if (abortController.signal.aborted) break;

      store.startNewRound(round);
      const roundIdx = round - 1;

      // ── BENCHMARK PHASE ──
      store.setPhase("benchmarking");
      store.setRoundPhase(roundIdx, "benchmarking");

      // Build a working slot that uses the current workingSettings
      const workingSlot = {
        api: { ...agentSlot.api },
        tuning: { ...workingSettings },
      };

      let benchResponse = "";
      let benchLatencyMs = 0;
      let benchPromptTokens = 0;
      let benchCompletionTokens = 0;
      let benchTotalTokens = 0;
      let renderedMessages: ChatMessage[] = [];
      let renderedText = "";
      let roundTurnResults: TunerTurnResult[] = [];

      const isMultiTurn = activeScenario.turns && activeScenario.turns.length > 0;

      try {
        const promptSetBase = workingPromptSet || undefined;

        if (isMultiTurn) {
          // ── Multi-turn dialogue: iterate all turns sequentially ──
          const turns = activeScenario.turns!;
          const accumulatedChat: BenchmarkChatEntry[] = [];
          const allResponses: string[] = [];

          for (let turnIdx = 0; turnIdx < turns.length; turnIdx++) {
            if (abortController.signal.aborted) break;

            const turn = turns[turnIdx];

            // Push scripted input to accumulated chat
            accumulatedChat.push({
              type: turn.inputType === "player" ? "player" : "npc",
              speaker: turn.inputSpeaker,
              content: turn.inputContent,
              target: turn.inputTarget,
            });

            // Render the prompt for the responding NPC with current chat
            const renderBody = buildMultiTurnRenderBody(
              turn,
              activeScenario,
              accumulatedChat,
              promptSetBase,
            );

            const renderResponse = await fetch("/api/prompts/render-dialogue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(renderBody),
              signal: abortController.signal,
            });

            if (!renderResponse.ok) {
              const errData = await renderResponse.json().catch(() => ({}));
              throw new Error(errData.error || `Render failed on turn ${turnIdx + 1}: HTTP ${renderResponse.status}`);
            }

            const renderData = await renderResponse.json();
            renderedMessages = renderData.messages;
            if (turnIdx === 0) renderedText = renderData.renderedText || "";

            // Send to LLM
            const log = await sendLlmRequestWithSlot({
              messages: renderedMessages,
              agent,
              slot: workingSlot,
              model,
              apiKey,
              onChunk: () => {},
              signal: abortController.signal,
            });

            if (log.error) throw new Error(log.error);

            allResponses.push(log.response);
            benchLatencyMs += log.latencyMs;
            benchPromptTokens += log.promptTokens;
            benchCompletionTokens += log.completionTokens;
            benchTotalTokens += log.totalTokens;

            // Store per-turn data
            const respondingNpc = activeScenario.npcs[turn.respondingNpcIndex];
            roundTurnResults.push({
              label: `Turn ${turnIdx + 1}: ${turn.inputSpeaker} → ${respondingNpc?.displayName || "NPC"}`,
              messages: [...renderedMessages],
              response: log.response,
            });

            // Push NPC response to accumulated chat for next turn
            accumulatedChat.push({
              type: "npc",
              speaker: respondingNpc?.displayName || "NPC",
              content: log.response,
              target: turn.inputSpeaker,
            });
          }

          // Store per-turn results
          store.setRoundTurnResults(roundIdx, roundTurnResults);

          // Aggregate all turn responses for assessment
          benchResponse = allResponses.map((r, i) => `[Turn ${i + 1}] ${r}`).join("\n\n");
        } else {
          // ── Single-turn path: run ALL subtasks for this category ──
          const allSubtaskResponses: string[] = [];

          for (let stIdx = 0; stIdx < catDef.subtasks.length; stIdx++) {
            if (abortController.signal.aborted) break;

            const subtask = catDef.subtasks[stIdx];
            const renderBody = buildRenderBody(subtask.id, activeScenario, promptSetBase);

            const renderResponse = await fetch(subtask.renderEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(renderBody),
              signal: abortController.signal,
            });

            if (!renderResponse.ok) {
              const errData = await renderResponse.json().catch(() => ({}));
              throw new Error(errData.error || `Render failed for ${subtask.label}: HTTP ${renderResponse.status}`);
            }

            const renderData = await renderResponse.json();
            const subtaskMessages: ChatMessage[] = renderData.messages;
            if (stIdx === 0) renderedText = renderData.renderedText || "";

            const log = await sendLlmRequestWithSlot({
              messages: subtaskMessages,
              agent,
              slot: workingSlot,
              model,
              apiKey,
              onChunk: () => {},
              signal: abortController.signal,
            });

            if (log.error) throw new Error(log.error);

            allSubtaskResponses.push(log.response);
            benchLatencyMs += log.latencyMs;
            benchPromptTokens += log.promptTokens;
            benchCompletionTokens += log.completionTokens;
            benchTotalTokens += log.totalTokens;

            // Keep last subtask's messages as the primary renderedMessages
            renderedMessages = subtaskMessages;

            // Store per-subtask data when there are multiple subtasks
            if (catDef.subtasks.length > 1) {
              roundTurnResults.push({
                label: subtask.label,
                messages: [...subtaskMessages],
                response: log.response,
              });
            }
          }

          // Store per-subtask results for multi-subtask categories
          if (roundTurnResults.length > 1) {
            store.setRoundTurnResults(roundIdx, roundTurnResults);
          }

          benchResponse = catDef.subtasks.length > 1
            ? allSubtaskResponses.map((r, i) => `[${catDef.subtasks[i].label}] ${r}`).join("\n\n")
            : allSubtaskResponses[0] || "";
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") break;
        store.setRoundError(roundIdx, err instanceof Error ? err.message : "Benchmark failed");
        store.setPhase("error");
        break;
      }

      // Store benchmark result (explanation pending)
      const subtaskLabel = catDef.subtasks.length > 1
        ? catDef.subtasks.map((s) => s.label).join(" + ")
        : catDef.subtasks[0].label;
      store.setRoundBenchmarkResult(roundIdx, {
        subtaskId: catDef.subtasks[0].id,
        subtaskLabel,
        messages: renderedMessages,
        response: benchResponse,
        latencyMs: benchLatencyMs,
        promptTokens: benchPromptTokens,
        completionTokens: benchCompletionTokens,
        totalTokens: benchTotalTokens,
        streamedText: benchResponse,
        status: "done",
        explanation: "",
        explanationStreamedText: "",
        explanationStatus: "idle",
      });

      if (abortController.signal.aborted) break;

      // ── EXPLAIN PHASE ──
      store.setPhase("explaining");
      store.setRoundPhase(roundIdx, "explaining");
      store.clearStreams();

      let explanationText = "";
      try {
        const subtaskLabel = catDef.subtasks.map((s) => s.label).join(" + ");
        const explanationMessages = buildExplanationMessages(
          category,
          subtaskLabel,
          renderedMessages,
          benchResponse,
          roundTurnResults.length > 1 ? roundTurnResults : undefined,
        );

        const explanationLog = await sendLlmRequestWithSlot({
          messages: explanationMessages,
          agent,
          slot: workingSlot,
          model,
          apiKey,
          onChunk: (chunk) => {
            useAutoTunerStore.getState().appendExplanationStream(chunk);
          },
          signal: abortController.signal,
        });

        explanationText = explanationLog.response;
        if (explanationLog.error) {
          // Non-fatal — continue without explanation
          explanationText = "";
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") break;
        // Non-fatal — continue without explanation
      }

      // Update benchmark result with explanation
      store.setRoundBenchmarkResult(roundIdx, {
        subtaskId: catDef.subtasks[0].id,
        subtaskLabel,
        messages: renderedMessages,
        response: benchResponse,
        latencyMs: benchLatencyMs,
        promptTokens: benchPromptTokens,
        completionTokens: benchCompletionTokens,
        totalTokens: benchTotalTokens,
        streamedText: benchResponse,
        status: "done",
        explanation: explanationText,
        explanationStreamedText: explanationText,
        explanationStatus: explanationText ? "done" : "idle",
      });

      if (abortController.signal.aborted) break;

      // ── ASSESS PHASE ──
      store.setPhase("assessing");
      store.setRoundPhase(roundIdx, "assessing");
      store.clearStreams();

      let assessmentText = "";
      try {
        // Build context-aware rendered text for assessment
        let assessRenderedText = renderedText;
        const isMultiPart = roundTurnResults.length > 1;
        const isMultiSubtask = !isMultiTurn && isMultiPart;

        if (isMultiPart) {
          const typeLabel = isMultiTurn
            ? `MULTI-TURN DIALOGUE TEST — ${roundTurnResults.length} turns`
            : `MULTI-SUBTASK TEST — ${roundTurnResults.length} subtasks`;
          const typeExplanation = isMultiTurn
            ? `Each turn below was sent as a SEPARATE prompt to the model. The model responded once per turn, not all at once. Evaluate each response individually.`
            : `Each subtask below was sent as a SEPARATE prompt to the model. Evaluate each response individually for its specific task.`;

          assessRenderedText = `[${typeLabel}]\n${typeExplanation}\n\n` +
            roundTurnResults.map((turn) => {
              const promptSummary = turn.messages
                .map((m) => `[${m.role}] ${m.content}`)
                .join("\n\n");
              const truncated = promptSummary.length > 2000
                ? promptSummary.substring(0, 2000) + "\n... (truncated)"
                : promptSummary;
              return `--- ${turn.label} ---\n\nPrompt:\n${truncated}\n\nModel Response:\n${turn.response}`;
            }).join("\n\n===\n\n");
        }

        // Build subtasks array — one per subtask for multi-subtask, or one aggregated for single/multi-turn
        const assessSubtasks = isMultiSubtask
          ? roundTurnResults.map((tr, i) => ({
              subtaskId: catDef.subtasks[i]?.id || `subtask_${i}`,
              subtaskLabel: tr.label,
              messages: tr.messages,
              response: tr.response,
              latencyMs: 0,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              streamedText: tr.response,
              status: "done" as const,
              explanation: explanationText,
              explanationStreamedText: explanationText,
              explanationStatus: explanationText ? "done" as const : "idle" as const,
            }))
          : [{
              subtaskId: catDef.subtasks[0].id,
              subtaskLabel: catDef.subtasks[0].label,
              messages: renderedMessages,
              response: benchResponse,
              latencyMs: benchLatencyMs,
              promptTokens: benchPromptTokens,
              completionTokens: benchCompletionTokens,
              totalTokens: benchTotalTokens,
              streamedText: benchResponse,
              status: "done" as const,
              explanation: explanationText,
              explanationStreamedText: explanationText,
              explanationStatus: explanationText ? "done" as const : "idle" as const,
            }];

        const benchmarkResult = {
          profileId: profile.id,
          profileName: profile.name,
          category,
          model,
          subtasks: assessSubtasks,
          totalLatencyMs: benchLatencyMs,
          totalTokens: benchTotalTokens,
          overallStatus: "done" as const,
        };

        const assessmentMessages = buildAssessmentMessages([benchmarkResult], assessRenderedText);

        const assessLog = await sendLlmRequest({
          messages: assessmentMessages,
          agent: "tuner",
          onChunk: (chunk) => {
            useAutoTunerStore.getState().appendAssessmentStream(chunk);
          },
          signal: abortController.signal,
        });

        assessmentText = assessLog.response;
        if (assessLog.error) {
          throw new Error(assessLog.error);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") break;
        store.setRoundError(roundIdx, err instanceof Error ? err.message : "Assessment failed");
        store.setPhase("error");
        break;
      }

      store.setRoundAssessment(roundIdx, assessmentText);

      if (abortController.signal.aborted) break;

      // ── PROPOSE PHASE ──
      store.setPhase("proposing");
      store.setRoundPhase(roundIdx, "proposing");

      let promptContent = "";
      if (tuningTarget === "prompts" || tuningTarget === "both") {
        // Fetch prompt file contents for the tuner LLM to analyze
        const promptSetPath = workingPromptSet || "";
        const fetched = await fetchPromptContent(category, promptSetPath);
        promptContent = fetched.content;
      }

      const previousRounds = useAutoTunerStore.getState().rounds.slice(0, roundIdx);

      try {
        const proposalMessages = buildProposalMessages({
          category,
          tuningTarget,
          currentSettings: workingSettings,
          originalSettings,
          promptContent,
          previousRounds,
          currentAssessment: assessmentText,
          currentResponse: benchResponse,
          currentLatencyMs: benchLatencyMs,
          currentTokens: benchTotalTokens,
          lockedSettings,
          customInstructions,
        });

        const proposalLog = await sendLlmRequest({
          messages: proposalMessages,
          agent: "tuner",
          onChunk: (chunk) => {
            useAutoTunerStore.getState().appendProposalStream(chunk);
          },
          signal: abortController.signal,
        });

        if (proposalLog.error) {
          throw new Error(proposalLog.error);
        }

        const proposal = parseProposal(proposalLog.response);
        store.setRoundProposal(roundIdx, proposal, proposalLog.response);

        // Check if tuner wants to stop
        if (proposal.stopTuning) {
          store.setRoundPhase(roundIdx, "complete");
          store.setPhase("complete");
          break;
        }

        if (abortController.signal.aborted) break;

        // ── APPLY PHASE ──
        store.setPhase("applying");
        store.setRoundPhase(roundIdx, "applying");

        // Apply settings changes
        if (proposal.settingsChanges.length > 0) {
          workingSettings = applySettingsChanges(workingSettings, proposal.settingsChanges);
          store.setWorkingSettings(workingSettings);
          store.setRoundAppliedSettings(roundIdx, workingSettings);
        }

        // Apply prompt changes
        if (proposal.promptChanges.length > 0) {
          // Create temp set if not already created
          if (!tempSetCreated) {
            const activePromptSet = workingPromptSet || undefined;
            await createTunerTempSet(activePromptSet || undefined);
            workingPromptSet = TUNER_TEMP_SET;
            store.setWorkingPromptSet(workingPromptSet);
            tempSetCreated = true;
          }

          const appliedPrompts = await applyPromptChanges(proposal.promptChanges);
          // Update proposal with actual content
          const currentProposal = useAutoTunerStore.getState().rounds[roundIdx]?.proposal;
          if (currentProposal) {
            store.setRoundProposal(roundIdx, {
              ...currentProposal,
              promptChanges: appliedPrompts,
            }, proposalLog.response);
          }
        }

        store.setRoundPhase(roundIdx, "complete");
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") break;
        store.setRoundError(roundIdx, err instanceof Error ? err.message : "Proposal failed");
        store.setPhase("error");
        break;
      }
    }

    // Mark complete if we finished all rounds without error
    const finalStore = useAutoTunerStore.getState();
    if (finalStore.phase !== "error" && !abortController.signal.aborted) {
      store.setPhase("complete");
    } else if (abortController.signal.aborted) {
      store.setPhase("stopped");
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      store.setPhase("stopped");
    } else {
      console.error("Auto tuner error:", err);
      store.setPhase("error");
    }
  } finally {
    store.setIsRunning(false);
    store.setAbortController(null);
  }
}

/**
 * Stop the auto tuner.
 */
export function stopTuningLoop() {
  const store = useAutoTunerStore.getState();
  store.abortController?.abort();
  store.setIsRunning(false);
  store.setAbortController(null);
  store.setPhase("stopped");
}
