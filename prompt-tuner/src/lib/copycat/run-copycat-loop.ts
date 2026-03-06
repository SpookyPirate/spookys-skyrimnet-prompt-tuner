import type { BenchmarkScenario, BenchmarkChatEntry } from "@/types/benchmark";
import type { ChatMessage } from "@/types/llm";
import type { TuningTarget } from "@/types/autotuner";
import type { AiTuningSettings, ModelSlot } from "@/types/config";
import type { CopycatDialogueTurn } from "@/types/copycat";
import { buildMultiTurnRenderBody, getDefaultScenario, resolveScenarioNpcs } from "@/lib/benchmark/default-scenarios";
import { buildCopycatMessages } from "./build-copycat-prompt";
import { parseCopycatResponse } from "./parse-copycat-response";
import { applySettingsChanges, applyPromptChanges } from "@/lib/autotuner/apply-changes";
import { fetchPromptContent } from "@/lib/autotuner/fetch-prompt-content";
import { createTunerTempSet, deleteTunerTempSet, TUNER_TEMP_SET } from "@/lib/autotuner/save-results";
import { sendLlmRequest, sendLlmRequestWithSlot } from "@/lib/llm/client";
import { useCopycatStore } from "@/stores/copycatStore";
import { useConfigStore } from "@/stores/configStore";

interface CopycatLoopParams {
  referenceModelId: string;
  targetModelId: string;
  scenario?: BenchmarkScenario;
  tuningTarget: TuningTarget;
  maxRounds: number;
  selectedPromptSet: string;
  lockedSettings: (keyof AiTuningSettings)[];
  customInstructions: string;
}

/**
 * Run multi-turn dialogue through a model and collect per-turn results.
 */
async function runDialogue(
  scenario: BenchmarkScenario,
  slot: ModelSlot,
  model: string,
  apiKey: string,
  promptSetBase: string | undefined,
  abortSignal: AbortSignal,
): Promise<CopycatDialogueTurn[]> {
  const turns = scenario.turns;
  if (!turns || turns.length === 0) {
    throw new Error("Scenario has no dialogue turns");
  }

  const accumulatedChat: BenchmarkChatEntry[] = [];
  const results: CopycatDialogueTurn[] = [];

  for (let turnIdx = 0; turnIdx < turns.length; turnIdx++) {
    if (abortSignal.aborted) break;

    const turn = turns[turnIdx];

    accumulatedChat.push({
      type: turn.inputType === "player" ? "player" : "npc",
      speaker: turn.inputSpeaker,
      content: turn.inputContent,
      target: turn.inputTarget,
    });

    const renderBody = buildMultiTurnRenderBody(
      turn,
      scenario,
      accumulatedChat,
      promptSetBase,
    );

    const renderResponse = await fetch("/api/prompts/render-dialogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(renderBody),
      signal: abortSignal,
    });

    if (!renderResponse.ok) {
      const errData = await renderResponse.json().catch(() => ({}));
      throw new Error(errData.error || `Render failed on turn ${turnIdx + 1}: HTTP ${renderResponse.status}`);
    }

    const renderData = await renderResponse.json();
    const messages: ChatMessage[] = renderData.messages;

    const log = await sendLlmRequestWithSlot({
      messages,
      agent: "default",
      slot,
      model,
      apiKey,
      onChunk: () => {},
      signal: abortSignal,
    });

    if (log.error) throw new Error(log.error);

    const respondingNpc = scenario.npcs[turn.respondingNpcIndex];

    results.push({
      label: `Turn ${turnIdx + 1}: ${turn.inputSpeaker} → ${respondingNpc?.displayName || "NPC"}`,
      messages: [...messages],
      response: log.response,
      latencyMs: log.latencyMs,
      promptTokens: log.promptTokens,
      completionTokens: log.completionTokens,
      totalTokens: log.totalTokens,
    });

    accumulatedChat.push({
      type: "npc",
      speaker: respondingNpc?.displayName || "NPC",
      content: log.response,
      target: turn.inputSpeaker,
    });
  }

  return results;
}

/**
 * Main copycat loop orchestrator.
 */
export async function runCopycatLoop(params: CopycatLoopParams) {
  const {
    referenceModelId,
    targetModelId,
    scenario: inputScenario,
    tuningTarget,
    maxRounds,
    selectedPromptSet,
    lockedSettings,
    customInstructions,
  } = params;

  const store = useCopycatStore.getState();
  const configStore = useConfigStore.getState();
  const activeScenario = inputScenario
    ? { ...inputScenario, npcs: [...inputScenario.npcs] }
    : { ...getDefaultScenario("dialogue"), npcs: [...getDefaultScenario("dialogue").npcs] };
  await resolveScenarioNpcs(activeScenario);

  // Get the copycat slot's API settings (endpoint, apiKey, timeouts)
  const copycatSlot = configStore.slots["copycat"];
  const copycatApiKey = copycatSlot.api.apiKey || configStore.globalApiKey;

  // Build model slots: both use the copycat slot's API config with model overridden
  const baseApi = { ...copycatSlot.api };

  // Snapshot original settings from the store's startingSettings
  const originalSettings = { ...store.startingSettings };
  let workingSettings = { ...originalSettings };
  let workingPromptSet = selectedPromptSet || "";
  let tempSetCreated = false;

  const abortController = new AbortController();

  store.setAbortController(abortController);
  store.setOriginalSettings(originalSettings);
  store.setWorkingSettings(workingSettings);
  store.setIsRunning(true);
  store.setPhase("running_reference");

  // Cleanup any leftover temp set
  await deleteTunerTempSet();

  // When tuning prompts, create the temp set upfront so fetchPromptContent
  // returns writable paths that applyPromptChanges can target.
  // Preserve the original set name for use as a fallback when seeding files.
  const sourceSetName = workingPromptSet || undefined;
  if (tuningTarget === "prompts" || tuningTarget === "both") {
    await createTunerTempSet();
    workingPromptSet = TUNER_TEMP_SET;
    store.setWorkingPromptSet(workingPromptSet);
    tempSetCreated = true;
  }

  try {
    let frozenReference: CopycatDialogueTurn[] | null = null;

    for (let round = 1; round <= maxRounds; round++) {
      if (abortController.signal.aborted) break;

      store.startNewRound(round);
      const roundIdx = round - 1;

      const promptSetBase = workingPromptSet || undefined;

      // ── REFERENCE PHASE (Round 1 only) ──
      if (round === 1) {
        store.setPhase("running_reference");
        store.setRoundPhase(roundIdx, "running_reference");

        try {
          const referenceSlot: ModelSlot = {
            api: { ...baseApi, modelNames: referenceModelId },
            tuning: { ...originalSettings },
          };

          frozenReference = await runDialogue(
            activeScenario,
            referenceSlot,
            referenceModelId,
            copycatApiKey,
            promptSetBase,
            abortController.signal,
          );

          store.setCapturedReferenceDialogue(frozenReference);
          store.setRoundReferenceDialogue(roundIdx, frozenReference);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") break;
          store.setRoundError(roundIdx, `Reference model error: ${err instanceof Error ? err.message : "Unknown"}`);
          store.setPhase("error");
          break;
        }
      } else {
        // Subsequent rounds reuse frozen reference
        if (frozenReference) {
          store.setRoundReferenceDialogue(roundIdx, frozenReference);
        }
      }

      if (abortController.signal.aborted) break;

      // ── TARGET PHASE ──
      store.setPhase("running_target");
      store.setRoundPhase(roundIdx, "running_target");

      let targetDialogue: CopycatDialogueTurn[];
      try {
        const targetSlot: ModelSlot = {
          api: { ...baseApi, modelNames: targetModelId },
          tuning: { ...workingSettings },
        };

        targetDialogue = await runDialogue(
          activeScenario,
          targetSlot,
          targetModelId,
          copycatApiKey,
          promptSetBase,
          abortController.signal,
        );

        store.setRoundTargetDialogue(roundIdx, targetDialogue);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") break;
        store.setRoundError(roundIdx, `Target model error: ${err instanceof Error ? err.message : "Unknown"}`);
        store.setPhase("error");
        break;
      }

      if (abortController.signal.aborted || !frozenReference) break;

      // ── COMPARING PHASE ──
      store.setPhase("comparing");
      store.setRoundPhase(roundIdx, "comparing");
      store.clearStreams();

      let promptContent = "";
      if (tuningTarget === "prompts" || tuningTarget === "both") {
        const fetched = await fetchPromptContent("dialogue", workingPromptSet || "");
        promptContent = fetched.content;
      }

      const previousRounds = useCopycatStore.getState().rounds.slice(0, roundIdx);

      try {
        const copycatMessages = buildCopycatMessages({
          referenceModelId,
          targetModelId,
          tuningTarget,
          currentSettings: workingSettings,
          originalSettings,
          promptContent,
          referenceDialogue: frozenReference,
          targetDialogue,
          previousRounds,
          lockedSettings,
          customInstructions,
        });

        const copycatLog = await sendLlmRequest({
          messages: copycatMessages,
          agent: "copycat",
          onChunk: (chunk) => {
            useCopycatStore.getState().appendComparisonStream(chunk);
          },
          signal: abortController.signal,
        });

        if (copycatLog.error) {
          throw new Error(copycatLog.error);
        }

        const parsed = parseCopycatResponse(copycatLog.response);

        store.setRoundComparison(roundIdx, parsed.comparison);
        store.setRoundEffectivenessScore(roundIdx, parsed.effectivenessScore);
        store.setRoundProposal(roundIdx, parsed.proposal, copycatLog.response);

        // Check if copycat wants to stop
        if (parsed.proposal.stopTuning) {
          store.setRoundPhase(roundIdx, "complete");
          store.setPhase("complete");
          break;
        }

        if (abortController.signal.aborted) break;

        // ── VERIFICATION PHASE (optional) ──
        if (parsed.verificationRequests.length > 0) {
          store.setPhase("verifying");
          store.setRoundPhase(roundIdx, "verifying");

          // Run verification requests are ad-hoc — we skip them for simplicity
          // and just store empty verification runs. Full implementation would
          // inject each custom line as a player message and get the target's response.
          // For now we mark them as requested but not executed.
        }

        // ── APPLY PHASE ──
        store.setPhase("applying");
        store.setRoundPhase(roundIdx, "applying");

        // Apply settings changes
        if (parsed.proposal.settingsChanges.length > 0) {
          workingSettings = applySettingsChanges(workingSettings, parsed.proposal.settingsChanges);
          store.setWorkingSettings(workingSettings);
          store.setRoundAppliedSettings(roundIdx, workingSettings);
        }

        // Apply prompt changes (non-fatal — bad search text shouldn't kill the loop)
        if (parsed.proposal.promptChanges.length > 0 && tuningTarget !== "settings") {
          if (!tempSetCreated) {
            await createTunerTempSet();
            workingPromptSet = TUNER_TEMP_SET;
            store.setWorkingPromptSet(workingPromptSet);
            tempSetCreated = true;
          }

          try {
            const appliedPrompts = await applyPromptChanges(parsed.proposal.promptChanges, sourceSetName);
            const currentProposal = useCopycatStore.getState().rounds[roundIdx]?.proposal;
            if (currentProposal) {
              store.setRoundProposal(roundIdx, {
                ...currentProposal,
                promptChanges: appliedPrompts,
              }, copycatLog.response);
            }
          } catch (promptErr: unknown) {
            const msg = promptErr instanceof Error ? promptErr.message : "Prompt change failed";
            console.warn(`[copycat] Prompt change failed in round ${round}: ${msg}`);
            store.setRoundError(roundIdx, msg);
          }
        }

        store.setRoundPhase(roundIdx, "complete");
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") break;
        store.setRoundError(roundIdx, err instanceof Error ? err.message : "Comparison failed");
        store.setPhase("error");
        break;
      }
    }

    // Mark complete
    const finalStore = useCopycatStore.getState();
    if (finalStore.phase !== "error" && !abortController.signal.aborted) {
      store.setPhase("complete");
    } else if (abortController.signal.aborted) {
      store.setPhase("stopped");
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      store.setPhase("stopped");
    } else {
      console.error("Copycat error:", err);
      store.setPhase("error");
    }
  } finally {
    // Sync the last round's phase with the global phase so spinners stop
    const finalState = useCopycatStore.getState();
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
 * Stop the copycat loop.
 */
export function stopCopycatLoop() {
  const store = useCopycatStore.getState();
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
