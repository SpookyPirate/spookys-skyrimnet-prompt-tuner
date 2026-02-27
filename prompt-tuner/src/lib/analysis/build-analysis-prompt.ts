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

  // Chat history (last 100) — include GM metadata for analysis
  const recentChat = sim.chatHistory.slice(-100);
  const chatSection = recentChat.length > 0
    ? "## Chat History (last " + recentChat.length + " entries)\n" + recentChat.map((e) => {
        const speaker = e.type === "player" ? sim.playerConfig.name
          : e.type === "npc" ? (e.speaker || "NPC")
          : e.type === "narration" ? "[Narration]"
          : "[System]";
        const gmTag = e.gmAction ? ` [GM:${e.gmAction}]` : "";
        const targetTag = e.target ? ` → ${e.target}` : "";
        return `${speaker}${targetTag}${gmTag}: ${truncate(e.content, 300)}`;
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

  // GM state + scene plan + action log
  let gmSection = "";
  if (sim.gmEnabled) {
    const parts = [
      "## GameMaster State",
      `- Enabled: true`,
      `- Continuous Mode: ${sim.gmContinuousMode}`,
      `- Cooldown: ${sim.gmCooldown}s`,
      `- Status: ${sim.gmStatus}`,
    ];

    if (sim.scenePlan) {
      const plan = sim.scenePlan;
      parts.push(
        "",
        "### Scene Plan",
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
      );
    }

    parts.push(
      "",
      sim.gmActionLog.length > 0
        ? "### GM Action Log\n" + sim.gmActionLog.map((a) =>
            `  - [Beat ${a.beatIndex + 1}] ${a.action}: ${JSON.stringify(a.params)}`
          ).join("\n")
        : "### GM Action Log\n(empty)",
    );

    gmSection = parts.join("\n");
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

  const systemContent = `You are an expert AI prompt engineer and dialogue quality analyst for SkyrimNet, an AI-powered NPC dialogue system for Skyrim. You have deep knowledge of SkyrimNet's architecture. The user will provide complete session data from a prompt tuning session. Analyze it thoroughly and produce a structured markdown report.

## SkyrimNet Architecture Reference

This is how the system is SUPPOSED to work. Use this to evaluate whether each agent is functioning correctly.

### Pipeline Flow (normal player-initiated dialogue)
1. Player sends message → added to chat history
2. **Target Selector** (meta_eval agent): If multiple NPCs present, picks which NPC should respond. Expected output: a single NPC name.
3. **Dialogue Response** (default agent): Generates the NPC's spoken dialogue using dialogue_response.prompt. The NPC receives: their character bio, scene context, event history (recent dialogue), world/scene prompts, and guidelines. Output: 1-3 sentences of in-character spoken dialogue (typically 8-45 words).
4. **Action Evaluator** (action_eval agent): After dialogue is generated, evaluates if a game action should accompany it (e.g. gesture, trade, follow). Uses native_action_selector.prompt. Expected output: JSON like {"ACTION": "None"} or {"ACTION": "Gesture", "PARAMS": {"gesture": "bow"}}. Actions must be DIRECTLY IMPLIED by the dialogue — never random.
5. **Speaker Prediction** (meta_eval agent): Predicts who should speak next in multi-NPC scenes. Expected output: a single NPC name or "Player".

### GameMaster Pipeline (GM-directed dialogue)
The GM is an invisible **director/orchestrator** — it NEVER generates dialogue directly. It decides what should happen, then the normal dialogue pipeline generates the actual NPC speech.

1. **Scene Planner** (game_master agent): Creates a 4-6 beat scene plan as JSON with: scene_summary, tone, central_tension, beats (each with type/description/primary_characters/purpose), potential_escalations, natural_endings.
   - Scenes must work entirely among NPCs (player is uncontrollable)
   - Heavily favor dialogue beats (0-1 narration beats max)
   - Each beat ~15-30 seconds of real time

2. **Action Selector** (game_master agent): Each tick, selects ONE action. Expected output format: exactly one line:
   - \`ACTION: StartConversation PARAMS: {"speaker": "NPC", "target": "NPC/Player", "topic": "2-6 word direction"}\`
   - \`ACTION: ContinueConversation PARAMS: {"speaker": "NPC", "target": "NPC/Player", "topic": "2-6 word direction"}\`
   - \`ACTION: Narrate PARAMS: {"text": "environmental narration"}\`
   - \`ACTION: None\` (normal mode only — INVALID in continuous mode)

   **Critical rules:**
   - Topic must be brief direction (2-6 words), NOT dialogue lines. Good: "questioning the scouting report". Bad: "You've spent too much time with poets, boy..."
   - NPC-to-NPC interactions strongly preferred over NPC-to-Player
   - Narrate used sparingly (0-1 per cycle)
   - In continuous mode: must select an action (None is invalid), should follow scene plan beats

3. **Action Execution**: The GM's topic direction is injected as a gamemaster_dialogue event in the NPC's event history. The NPC then generates dialogue naturally through the standard pipeline, seeing the GM's direction as context — NOT through promptForDialogue/transform mode.

### Key Template Variables & Modes
- **promptForDialogue**: When non-empty, triggers "transform/rewrite mode" where the NPC rewrites a given sentence in their own voice. This is for player voice input, NOT for normal conversation. If you see this being used for regular dialogue responses, that's a bug.
- **responseTarget**: Determines who the NPC addresses. type="player" = talking to player, type="npc" = talking to another NPC. Check that GM-directed NPC-to-NPC dialogue actually targets NPCs.
- **World Prompt**: Global RP rules/tone that apply everywhere (NOT scene-specific). Shapes how ALL characters behave.
- **Scene Prompt**: What's happening right now in this specific scene.
- **Character Bio**: NPC personality, background, relationships. Check dialogue matches the bio.

### Common Failure Modes to Watch For
- **GM generating dialogue instead of directing**: GM output contains full dialogue sentences instead of ACTION: lines with brief topics
- **Transform mode in normal conversation**: promptForDialogue being set for regular responses, making NPCs "rewrite" something instead of responding naturally
- **NPC-to-Player bias**: GM always directing NPCs to talk to the player instead of to each other
- **Character breaks**: NPCs using modern language, referencing things outside Skyrim lore, breaking their personality
- **Action evaluator hallucinating**: Selecting actions not implied by the dialogue
- **Token waste**: Responses far exceeding the expected length (dialogue should be 8-45 words typically)
- **Repetitive loops**: Same topics or patterns repeating, especially in continuous mode
- **GM ignoring scene plan**: Actions not following the planned beats in continuous mode
- **Speaker prediction failures**: Same NPC always speaking, or inappropriate NPC selection

Your report MUST include these sections:

# Session Analysis Report

## 1. Session Overview
Brief summary of the conversation: who was involved, what happened, key themes.

## 2. Dialogue Quality Analysis
- Overall grade (A-F)
- Naturalness of dialogue (does it sound like spoken words, not written prose?)
- Character consistency (do NPCs stay in character per their bios?)
- Response length appropriateness (8-45 words typical for dialogue)
- Best exchanges (quote specific lines)
- Worst exchanges (quote specific lines with explanation)
- Immersion breaks or anachronisms

## 3. Agent Performance Grades
For each agent that was actually used in the session, grade A-F with specific evaluation:

**Default Model (dialogue generation):**
- Did responses sound like natural spoken dialogue (not prose or narration)?
- Were responses the right length (8-45 words)?
- Did the NPC stay in character per their bio and personality?
- Did the NPC appropriately reference their surroundings, recent events, and relationships?
- Was promptForDialogue/transform mode used correctly (only for explicit directives, not regular conversation)?

**Game Master (if used):**
- Did it output structured ACTION lines (not free-form dialogue or narration)?
- Were topic directions brief (2-6 words) and not full dialogue lines?
- Did it prioritize NPC-to-NPC interactions over NPC-to-Player?
- If continuous mode: did it follow scene plan beats in order?
- Was Narrate used sparingly (0-1 per cycle)?
- Did it avoid "None" in continuous mode?
- Did actions make narrative sense given the scene context?

**Action Evaluator (if used):**
- Did it output valid JSON format?
- Were selected actions DIRECTLY implied by the dialogue (not random)?
- Did it appropriately select "None" when no action was warranted?
- Did it avoid hallucinating actions not available in the eligible actions list?

**Meta Evaluator / Target Selector (if used):**
- Did target selection pick contextually appropriate NPCs?
- Did speaker prediction create natural conversational flow?
- Were predictions varied (not always the same NPC)?

**Scene Planner (if used):**
- Was the plan 4-6 beats with clear dramatic structure?
- Did it heavily favor dialogue beats over narration?
- Were primary_characters correct and varied?
- Was the plan achievable without player cooperation?

**Memory Generation (if used):**
- Did the generated memories capture the most significant events from the conversation?
- Are memories appropriately scoped (not too broad, not too granular)?
- Do memories correctly identify the actors involved and their roles?
- Is the output well-structured JSON matching SkyrimNet's memory format?
- Are emotional/relational details captured (not just bare facts)?
- Would these memories be useful for future dialogue context?

**Diary Generation (if used):**
- Does the diary entry read like an in-character personal journal entry?
- Does it match the NPC's voice, personality, and speech patterns from their bio?
- Does it reference specific events from the conversation accurately?
- Is the tone appropriate (introspective, personal — not a clinical summary)?
- Is the length appropriate (~300 words target)?
- Does it avoid referencing game mechanics or breaking immersion?

**Character Profile / Bio Update (if used):**
- Does the update correctly identify which bio blocks need changes?
- Are updates grounded in actual events from the conversation (not hallucinated)?
- Does it preserve core personality traits while updating dynamic state?
- Is the output well-structured JSON matching SkyrimNet's bio update format?
- Are relationship changes reasonable given what actually happened?
- Does it avoid overwriting stable character traits with transient observations?

## 4. Pipeline Flow Analysis
Evaluate the entire pipeline working together:
- Did the agents hand off correctly (GM → dialogue → action → speaker prediction)?
- Were there any duplicate or parallel responses from the same NPC?
- Did the conversation flow naturally or were there jarring transitions?
- Was the pacing appropriate (not too fast, not too slow)?
- Any signs of systemic issues (transform mode being triggered incorrectly, responseTarget misconfigured, etc.)?

## 5. Model Evaluation & Recommendations
For each model used:
- Speed assessment (based on latency data)
- Quality assessment (based on output quality)
- Token efficiency
- Recommend model swaps if appropriate

## 6. Tuning Parameter Recommendations
For each agent, recommend specific parameter changes with reasoning:
- Temperature adjustments (higher for creative dialogue, lower for structured outputs like action selector)
- Top P / Top K tweaks
- Penalty adjustments (frequency/presence penalties for repetitive dialogue)
- Max token changes
- Event history count adjustments

## 7. Prompt Improvement Suggestions
Specific, actionable suggestions for:
- System/world prompt improvements
- Scene prompt tweaks
- Any prompt template patterns that could be improved
- Character bio improvements if NPCs seem inconsistent

Be specific. Reference actual dialogue lines, LLM call log entries, and agent outputs. Use the architecture reference above to identify when agents aren't behaving as designed. Grade strictly but fairly.`;

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}
