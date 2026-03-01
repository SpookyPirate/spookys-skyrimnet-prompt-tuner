import type { BenchmarkCategory, BenchmarkScenario } from "@/types/benchmark";
import type { SettingsProfile } from "@/types/config";
import type { ChatMessage } from "@/types/llm";
import type { TuningTarget } from "@/types/autotuner";
import { getCategoryDef } from "@/lib/benchmark/categories";
import { getDefaultScenario, buildRenderBody, buildMultiTurnRenderBody } from "@/lib/benchmark/default-scenarios";
import { buildAssessmentMessages } from "@/lib/benchmark/build-assessment-prompt";
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

      try {
        // Render the prompt
        const subtask = catDef.subtasks[0]; // Use first subtask for simplicity
        const promptSetBase = workingPromptSet || undefined;
        const renderBody = buildRenderBody(subtask.id, activeScenario, promptSetBase);

        const renderResponse = await fetch(subtask.renderEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(renderBody),
          signal: abortController.signal,
        });

        if (!renderResponse.ok) {
          const errData = await renderResponse.json().catch(() => ({}));
          throw new Error(errData.error || `Render failed: HTTP ${renderResponse.status}`);
        }

        const renderData = await renderResponse.json();
        renderedMessages = renderData.messages;
        renderedText = renderData.renderedText || "";

        // Send to LLM with working settings
        const log = await sendLlmRequestWithSlot({
          messages: renderedMessages,
          agent,
          slot: workingSlot,
          model,
          apiKey,
          onChunk: () => {
            // We don't stream benchmark results in the auto-tuner for simplicity
          },
          signal: abortController.signal,
        });

        benchResponse = log.response;
        benchLatencyMs = log.latencyMs;
        benchPromptTokens = log.promptTokens;
        benchCompletionTokens = log.completionTokens;
        benchTotalTokens = log.totalTokens;

        if (log.error) {
          throw new Error(log.error);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") break;
        store.setRoundError(roundIdx, err instanceof Error ? err.message : "Benchmark failed");
        store.setPhase("error");
        break;
      }

      // Store benchmark result
      store.setRoundBenchmarkResult(roundIdx, {
        subtaskId: catDef.subtasks[0].id,
        subtaskLabel: catDef.subtasks[0].label,
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

      // ── ASSESS PHASE ──
      store.setPhase("assessing");
      store.setRoundPhase(roundIdx, "assessing");
      store.clearStreams();

      let assessmentText = "";
      try {
        const benchmarkResult = {
          profileId: profile.id,
          profileName: profile.name,
          category,
          model,
          subtasks: [{
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
            explanation: "",
            explanationStreamedText: "",
            explanationStatus: "idle" as const,
          }],
          totalLatencyMs: benchLatencyMs,
          totalTokens: benchTotalTokens,
          overallStatus: "done" as const,
        };

        const assessmentMessages = buildAssessmentMessages([benchmarkResult], renderedText);

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
