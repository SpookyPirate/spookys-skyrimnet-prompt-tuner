import type { ChatMessage } from "@/types/llm";
import type { AgentType } from "@/types/config";
import { AGENT_LABELS } from "@/types/config";
import { useSimulationStore } from "@/stores/simulationStore";
import { useConfigStore } from "@/stores/configStore";
import { useTriggerStore } from "@/stores/triggerStore";

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export function buildAnalysisMessages(): ChatMessage[] {
  const sim = useSimulationStore.getState();
  const config = useConfigStore.getState();
  const triggers = useTriggerStore.getState();

  // Scene config
  const sceneSection = [
    "## Scene Configuration",
    `- Location: ${sim.scene.location}`,
    `- Weather: ${sim.scene.weather}`,
    `- Time of Day: ${sim.scene.timeOfDay}`,
    sim.scene.worldPrompt ? `- World Prompt: ${truncate(sim.scene.worldPrompt, 500)}` : null,
    sim.scene.scenePrompt ? `- Scene Prompt: ${truncate(sim.scene.scenePrompt, 500)}` : null,
  ].filter(Boolean).join("\n");

  // Player config
  const playerSection = [
    "## Player Configuration",
    `- Name: ${sim.playerConfig.name}`,
    `- Race: ${sim.playerConfig.race}`,
    `- Gender: ${sim.playerConfig.gender}`,
    `- Level: ${sim.playerConfig.level}`,
    `- In Combat: ${sim.playerConfig.isInCombat}`,
    sim.playerConfig.bio ? `- Bio: ${truncate(sim.playerConfig.bio, 300)}` : null,
  ].filter(Boolean).join("\n");

  // NPCs
  const npcSection = sim.selectedNpcs.length > 0
    ? "## NPCs in Scene\n" + sim.selectedNpcs.map(
        (n) => `- ${n.displayName} (${n.gender} ${n.race}, ${n.distance} units away)`
      ).join("\n")
    : "## NPCs in Scene\n(none)";

  // Agent model configuration
  const agents: AgentType[] = [
    "default", "game_master", "memory_gen", "profile_gen",
    "action_eval", "meta_eval", "diary", "tuner", "autochat",
  ];
  const agentSection = "## Agent Model Configuration\n" + agents.map((agent) => {
    const slot = config.slots[agent];
    return [
      `### ${AGENT_LABELS[agent]} (${agent})`,
      "API Settings:",
      `  - Models: ${slot.api.modelNames || "(none)"}`,
      `  - Endpoint: ${slot.api.apiEndpoint}`,
      `  - Max Context Length: ${slot.api.maxContextLength}`,
      `  - Request Timeout: ${slot.api.requestTimeout}s`,
      `  - Connect Timeout: ${slot.api.connectTimeout}s`,
      `  - SSE Streaming: ${slot.api.useSSE}`,
      `  - Max Retries: ${slot.api.maxRetries}`,
      `  - Provider Sorting: ${slot.api.providerSorting}`,
      slot.api.providerSettings ? `  - Provider Settings: ${slot.api.providerSettings}` : null,
      "Tuning Settings:",
      `  - Temperature: ${slot.tuning.temperature}`,
      `  - Max Tokens: ${slot.tuning.maxTokens}`,
      `  - Top P: ${slot.tuning.topP}`,
      `  - Top K: ${slot.tuning.topK}`,
      `  - Frequency Penalty: ${slot.tuning.frequencyPenalty}`,
      `  - Presence Penalty: ${slot.tuning.presencePenalty}`,
      `  - Stop Sequences: ${slot.tuning.stopSequences}`,
      `  - Structured Outputs: ${slot.tuning.structuredOutputs}`,
      `  - Allow Reasoning: ${slot.tuning.allowReasoning}`,
      `  - Event History Count: ${slot.tuning.eventHistoryCount}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  // Chat history (last 100)
  const recentChat = sim.chatHistory.slice(-100);
  const chatSection = recentChat.length > 0
    ? "## Chat History (last " + recentChat.length + " entries)\n" + recentChat.map((e) => {
        const speaker = e.type === "player" ? sim.playerConfig.name
          : e.type === "npc" ? (e.speaker || "NPC")
          : e.type === "narration" ? "[Narration]"
          : "[System]";
        return `${speaker}: ${truncate(e.content, 300)}`;
      }).join("\n")
    : "## Chat History\n(empty)";

  // LLM call log (last 50)
  const recentLlm = sim.llmCallLog.slice(-50);
  const llmSection = recentLlm.length > 0
    ? "## LLM Call Log (last " + recentLlm.length + " entries)\n" + recentLlm.map((log) => {
        const msgs = log.messages.map(
          (m) => `  [${m.role}] ${truncate(m.content, 200)}`
        ).join("\n");
        return [
          `### ${AGENT_LABELS[log.agent]} — ${log.model} (${log.latencyMs}ms, ${log.totalTokens} tokens)`,
          msgs,
          `  Response: ${truncate(log.response, 300)}`,
          log.error ? `  ERROR: ${log.error}` : null,
        ].filter(Boolean).join("\n");
      }).join("\n\n")
    : "## LLM Call Log\n(empty)";

  // GM scene plan + action log
  let gmSection = "";
  if (sim.gmEnabled && sim.scenePlan) {
    const plan = sim.scenePlan;
    gmSection = [
      "## GameMaster Scene Plan",
      `- Summary: ${plan.summary}`,
      `- Tone: ${plan.tone}`,
      `- Central Tension: ${plan.centralTension}`,
      `- Tension Level: ${plan.tension}`,
      `- Current Beat: ${plan.currentBeatIndex + 1} / ${plan.beats.length}`,
      "",
      "Beats:",
      ...plan.beats.map((b, i) =>
        `  ${i + 1}. [${b.type}] ${b.description} (${b.primaryCharacters.join(", ")})`
      ),
      "",
      sim.gmActionLog.length > 0
        ? "GM Action Log:\n" + sim.gmActionLog.map((a) =>
            `  - [Beat ${a.beatIndex + 1}] ${a.action}: ${JSON.stringify(a.params)}`
          ).join("\n")
        : "GM Action Log: (empty)",
    ].join("\n");
  }

  // Game events (last 30)
  const recentEvents = triggers.eventHistory.slice(-30);
  const eventsSection = recentEvents.length > 0
    ? "## Game Events (last " + recentEvents.length + ")\n" + recentEvents.map((e) => {
        const fields = Object.entries(e.fields).map(([k, v]) => `${k}=${v}`).join(", ");
        return `- [${e.eventType}] ${fields}`;
      }).join("\n")
    : "## Game Events\n(none)";

  // Enabled actions
  const enabledActions = sim.actionRegistry.filter((a) => a.enabled);
  const actionsSection = enabledActions.length > 0
    ? "## Enabled Actions\n" + enabledActions.map(
        (a) => `- ${a.name}: ${a.description}`
      ).join("\n")
    : "## Enabled Actions\n(none)";

  // Assemble user message
  const userContent = [
    sceneSection,
    playerSection,
    npcSection,
    agentSection,
    chatSection,
    llmSection,
    gmSection,
    eventsSection,
    actionsSection,
  ].filter(Boolean).join("\n\n");

  const systemContent = `You are an expert AI prompt engineer and dialogue quality analyst for SkyrimNet, an AI-powered NPC dialogue system for Skyrim. The user will provide complete session data from a prompt tuning session. Analyze it thoroughly and produce a structured markdown report.

Your report MUST include these sections:

# Session Analysis Report

## 1. Session Overview
Brief summary of the conversation: who was involved, what happened, key themes.

## 2. Dialogue Quality Analysis
- Overall grade (A-F)
- Naturalness of dialogue
- Character consistency (do NPCs stay in character?)
- Best exchanges (quote specific lines)
- Worst exchanges (quote specific lines with explanation)
- Immersion breaks or anachronisms

## 3. Agent Performance Grades
For each agent that was actually used in the session, grade A-F:
- How well it adhered to its role/prompt
- Quality of its outputs
- Any notable failures or successes

If the **game_master** agent was used, additionally evaluate:
- Did it output structured ACTION lines (e.g. ACTION: StartConversation {"speaker":"...","target":"...","topic":"..."}) rather than free-form dialogue or narration?
- Did it prioritize NPC-to-NPC interactions over NPC-to-Player when multiple NPCs are present?
- Were topic directions brief (2-6 words like "questioning the scouting report") rather than full dialogue lines?
- If continuous mode was active, did it follow scene plan beats in order and advance through them?
- Was Narrate used sparingly (0-1 per cycle) with dialogue beats as the primary action type?
- Did it avoid selecting "None" excessively in continuous mode (None is only valid in normal mode)?

## 4. Model Evaluation & Recommendations
For each model used:
- Speed assessment (based on latency data)
- Quality assessment (based on output quality)
- Token efficiency
- Recommend model swaps if appropriate

## 5. Tuning Parameter Recommendations
For each agent, recommend specific parameter changes with reasoning:
- Temperature adjustments
- Top P / Top K tweaks
- Penalty adjustments
- Max token changes

## 6. Prompt Improvement Suggestions
Specific, actionable suggestions for:
- System/world prompt improvements
- Scene prompt tweaks
- Any prompt patterns that could be improved

Be specific. Reference actual dialogue and data from the session. Use the LLM call log to understand what prompts were sent and what responses came back. Grade strictly but fairly.`;

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}
