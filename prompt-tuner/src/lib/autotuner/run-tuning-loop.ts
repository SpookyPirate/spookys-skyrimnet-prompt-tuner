import type { BenchmarkCategory, BenchmarkScenario, BenchmarkChatEntry } from "@/types/benchmark";
import type { SettingsProfile } from "@/types/config";
import type { ChatMessage } from "@/types/llm";
import type { TuningTarget, TunerTurnResult } from "@/types/autotuner";
import { getCategoryDef } from "@/lib/benchmark/categories";
import { getDefaultScenario, buildRenderBody, buildMultiTurnRenderBody, resolveScenarioNpcs } from "@/lib/benchmark/default-scenarios";
import { buildTunerAssessmentMessages } from "./build-tuner-assessment";
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
  ignoreFormatScoring?: boolean,
) {
  const _t = (label: string) => console.log(`[tuner] ${label} @ ${Date.now()}`);
  _t("runTuningLoop START");

  const store = useAutoTunerStore.getState();
  const catDef = getCategoryDef(category);
  if (!catDef) throw new Error(`Unknown category: ${category}`);

  const activeScenario = scenario
    ? { ...scenario, npcs: [...scenario.npcs] }
    : { ...getDefaultScenario(category), npcs: [...getDefaultScenario(category).npcs] };
  await resolveScenarioNpcs(activeScenario);
  const agent = catDef.agent;
  const agentSlot = profile.slots[agent];

  _t(`agent=${agent} model=${agentSlot.api.modelNames}`);

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

  // Cleanup any leftover temp set
  await deleteTunerTempSet();

  // When tuning prompts, create the temp set upfront so fetchPromptContent
  // returns writable paths that applyPromptChanges can target.
  // The original selectedPromptSet (before being replaced by temp) is kept as
  // sourceSetName so applyPromptChanges can seed files from it on first modification.
  const sourceSetName = workingPromptSet || undefined;
  if (tuningTarget === "prompts" || tuningTarget === "both") {
    await createTunerTempSet();
    workingPromptSet = TUNER_TEMP_SET;
    store.setWorkingPromptSet(workingPromptSet);
    tempSetCreated = true;
  }

  const models = agentSlot.api.modelNames.split(",").map((m) => m.trim()).filter(Boolean);
  const model = models[0] || "";
  const apiKey = agentSlot.api.apiKey || profile.globalApiKey;
  _t(`resolved model=${model} apiKey=${apiKey ? "set" : "MISSING"}`);

  try {
    for (let round = 1; round <= maxRounds; round++) {
      if (abortController.signal.aborted) break;

      store.startNewRound(round);
      const roundIdx = round - 1;

      // ── BENCHMARK PHASE ──
      _t(`round ${round} START`);
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
            const respondingNpc = activeScenario.npcs[turn.respondingNpcIndex];
            store.setStatusMessage(`Turn ${turnIdx + 1}/${turns.length}: ${turn.inputSpeaker} → ${respondingNpc?.displayName || "NPC"} — rendering prompt...`);

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

            store.setStatusMessage(`Turn ${turnIdx + 1}/${turns.length}: ${turn.inputSpeaker} → ${respondingNpc?.displayName || "NPC"} — waiting for LLM...`);

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

            // Store per-turn data incrementally
            const turnResult: TunerTurnResult = {
              label: `Turn ${turnIdx + 1}: ${turn.inputSpeaker} → ${respondingNpc?.displayName || "NPC"}`,
              messages: [...renderedMessages],
              response: log.response,
            };
            roundTurnResults.push(turnResult);
            store.addRoundTurnResult(roundIdx, turnResult);

            // Push NPC response to accumulated chat for next turn
            accumulatedChat.push({
              type: "npc",
              speaker: respondingNpc?.displayName || "NPC",
              content: log.response,
              target: turn.inputSpeaker,
            });
          }

          // Aggregate all turn responses for assessment
          benchResponse = allResponses.map((r, i) => `[Turn ${i + 1}] ${r}`).join("\n\n");
        } else {
          // ── Single-turn path: run ALL subtasks for this category ──
          const allSubtaskResponses: string[] = [];

          for (let stIdx = 0; stIdx < catDef.subtasks.length; stIdx++) {
            if (abortController.signal.aborted) break;

            const subtask = catDef.subtasks[stIdx];
            const subtaskProgress = catDef.subtasks.length > 1
              ? `Subtask ${stIdx + 1}/${catDef.subtasks.length}: ${subtask.label}`
              : subtask.label;
            store.setStatusMessage(`${subtaskProgress} — rendering prompt...`);

            _t(`subtask ${stIdx} "${subtask.label}" render START`);
            const renderBody = buildRenderBody(subtask.id, activeScenario, promptSetBase);

            const renderResponse = await fetch(subtask.renderEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(renderBody),
              signal: abortController.signal,
            });
            _t(`subtask ${stIdx} render DONE (${renderResponse.status})`);

            if (!renderResponse.ok) {
              const errData = await renderResponse.json().catch(() => ({}));
              throw new Error(errData.error || `Render failed for ${subtask.label}: HTTP ${renderResponse.status}`);
            }

            const renderData = await renderResponse.json();
            const subtaskMessages: ChatMessage[] = renderData.messages;
            if (stIdx === 0) renderedText = renderData.renderedText || "";

            store.setStatusMessage(`${subtaskProgress} — waiting for LLM...`);

            _t(`subtask ${stIdx} LLM START (model=${model})`);
            const log = await sendLlmRequestWithSlot({
              messages: subtaskMessages,
              agent,
              slot: workingSlot,
              model,
              apiKey,
              onChunk: () => {},
              signal: abortController.signal,
            });
            _t(`subtask ${stIdx} LLM DONE (${log.latencyMs}ms, ${log.totalTokens}tok)`);

            if (log.error) throw new Error(log.error);

            allSubtaskResponses.push(log.response);
            benchLatencyMs += log.latencyMs;
            benchPromptTokens += log.promptTokens;
            benchCompletionTokens += log.completionTokens;
            benchTotalTokens += log.totalTokens;

            // Keep last subtask's messages as the primary renderedMessages
            renderedMessages = subtaskMessages;

            // Store per-subtask data incrementally when there are multiple subtasks
            if (catDef.subtasks.length > 1) {
              const turnResult: TunerTurnResult = {
                label: subtask.label,
                messages: [...subtaskMessages],
                response: log.response,
                latencyMs: log.latencyMs,
                promptTokens: log.promptTokens,
                completionTokens: log.completionTokens,
                totalTokens: log.totalTokens,
              };
              roundTurnResults.push(turnResult);
              store.addRoundTurnResult(roundIdx, turnResult);
            }
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
      _t("EXPLAIN START");
      store.setPhase("explaining");
      store.setRoundPhase(roundIdx, "explaining");
      store.setStatusMessage("Generating self-explanation...");
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

        // Store explanation input messages
        store.updateCurrentRound({ explanationMessages: [...explanationMessages] });

        // Use a slot with a guaranteed minimum token budget for the explanation,
        // so that low maxTokens being tuned (e.g. 100) doesn't truncate diagnostics.
        const explanationSlot = {
          api: { ...workingSlot.api },
          tuning: { ...workingSlot.tuning, maxTokens: Math.max(workingSlot.tuning.maxTokens, 1024) },
        };

        const explanationLog = await sendLlmRequestWithSlot({
          messages: explanationMessages,
          agent,
          slot: explanationSlot,
          model,
          apiKey,
          onChunk: (chunk) => {
            useAutoTunerStore.getState().appendExplanationStream(chunk);
          },
          signal: abortController.signal,
        });

        _t("EXPLAIN DONE");
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
      _t("ASSESS START");
      store.setPhase("assessing");
      store.setRoundPhase(roundIdx, "assessing");
      store.setStatusMessage("Assessing quality...");
      store.clearStreams();

      let assessmentText = "";
      try {
        // Build context-aware rendered text for assessment
        let assessRenderedText = renderedText;
        const isMultiPart = roundTurnResults.length > 1;

        if (isMultiPart) {
          const isDialogueTurns = isMultiTurn;
          const typeLabel = isDialogueTurns
            ? `MULTI-TURN DIALOGUE TEST — ${roundTurnResults.length} turns`
            : `MULTI-SUBTASK TEST — ${roundTurnResults.length} subtasks`;
          const typeExplanation = isDialogueTurns
            ? `Each turn below was sent as a SEPARATE prompt to the model with its own system prompt. Different turns may have DIFFERENT NPCs responding — check each turn's system prompt header ("You are X") to see which character the model was asked to roleplay. The model responded once per turn, not all at once. Evaluate each response individually for the character it was assigned.`
            : `Each subtask below was sent as a SEPARATE prompt to the model. Evaluate each response individually for its specific task.`;

          assessRenderedText = `[${typeLabel}]\n${typeExplanation}\n\n` +
            roundTurnResults.map((turn) => {
              const promptSummary = turn.messages
                .map((m) => `[${m.role}] ${m.content}`)
                .join("\n\n");
              const truncated = promptSummary.length > 3000
                ? promptSummary.substring(0, 3000) + "\n... (truncated)"
                : promptSummary;
              return `--- ${turn.label} ---\n\nPrompt:\n${truncated}\n\nModel Response:\n${turn.response}`;
            }).join("\n\n===\n\n");
        }

        const assessPreviousRounds = useAutoTunerStore.getState().rounds.slice(0, roundIdx);

        const assessmentMessages = buildTunerAssessmentMessages({
          category,
          model,
          renderedText: assessRenderedText,
          response: benchResponse,
          explanation: explanationText,
          latencyMs: benchLatencyMs,
          totalTokens: benchTotalTokens,
          promptTokens: benchPromptTokens,
          completionTokens: benchCompletionTokens,
          turnResults: isMultiPart ? roundTurnResults : undefined,
          previousRounds: assessPreviousRounds,
          ignoreFormatScoring,
          customInstructions,
        });

        // Store assessment input messages
        store.updateCurrentRound({ assessmentMessages: [...assessmentMessages] });

        const assessLog = await sendLlmRequest({
          messages: assessmentMessages,
          agent: "tuner",
          onChunk: (chunk) => {
            useAutoTunerStore.getState().appendAssessmentStream(chunk);
          },
          signal: abortController.signal,
        });

        _t("ASSESS DONE");
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
      _t("PROPOSE START");
      store.setPhase("proposing");
      store.setRoundPhase(roundIdx, "proposing");
      store.setStatusMessage("Proposing changes...");

      let promptContent = "";
      if (tuningTarget === "prompts" || tuningTarget === "both") {
        _t("fetchPromptContent START");
        // Fetch prompt file contents for the tuner LLM to analyze
        // Falls back to the source (active) set for files not yet in the temp set
        const promptSetPath = workingPromptSet || "";
        const fetched = await fetchPromptContent(category, promptSetPath, sourceSetName || "", activeScenario.npcs);
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
          ignoreFormatScoring,
        });

        // Store proposal input messages
        store.updateCurrentRound({ proposalMessages: [...proposalMessages] });

        _t("PROPOSE LLM START");
        const proposalLog = await sendLlmRequest({
          messages: proposalMessages,
          agent: "tuner",
          onChunk: (chunk) => {
            useAutoTunerStore.getState().appendProposalStream(chunk);
          },
          signal: abortController.signal,
        });

        _t("PROPOSE LLM DONE");
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
        store.setStatusMessage("Applying changes...");

        // Apply settings changes
        if (proposal.settingsChanges.length > 0) {
          workingSettings = applySettingsChanges(workingSettings, proposal.settingsChanges);
          store.setWorkingSettings(workingSettings);
          store.setRoundAppliedSettings(roundIdx, workingSettings);
        }

        // Apply prompt changes (non-fatal — bad search text shouldn't kill the loop)
        if (proposal.promptChanges.length > 0 && tuningTarget !== "settings") {
          // Create temp set if not already created
          if (!tempSetCreated) {
            await createTunerTempSet();
            workingPromptSet = TUNER_TEMP_SET;
            store.setWorkingPromptSet(workingPromptSet);
            tempSetCreated = true;
          }

          try {
            const appliedPrompts = await applyPromptChanges(proposal.promptChanges, sourceSetName);
            // Update proposal with actual content
            const currentProposal = useAutoTunerStore.getState().rounds[roundIdx]?.proposal;
            if (currentProposal) {
              store.setRoundProposal(roundIdx, {
                ...currentProposal,
                promptChanges: appliedPrompts,
              }, proposalLog.response);
            }
          } catch (promptErr: unknown) {
            const msg = promptErr instanceof Error ? promptErr.message : "Prompt change failed";
            console.warn(`[tuner] Prompt change failed in round ${round}: ${msg}`);
            store.setRoundError(roundIdx, msg);
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
    // Sync the last round's phase with the global phase so spinners stop
    const finalState = useAutoTunerStore.getState();
    const lastIdx = finalState.rounds.length - 1;
    if (lastIdx >= 0) {
      const roundPhase = finalState.rounds[lastIdx].phase;
      if (roundPhase !== "complete" && roundPhase !== "error" && roundPhase !== "stopped") {
        store.setRoundPhase(lastIdx, finalState.phase === "error" ? "error" : "stopped");
      }
    }
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
  // Update the current round's phase so its spinner stops
  const lastRoundIdx = store.rounds.length - 1;
  if (lastRoundIdx >= 0 && store.rounds[lastRoundIdx].phase !== "complete") {
    store.setRoundPhase(lastRoundIdx, "stopped");
  }
  store.setIsRunning(false);
  store.setAbortController(null);
  store.setPhase("stopped");
}
