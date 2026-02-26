import type { ChatMessage } from "@/types/llm";
import type { ChatEntry, PlayerConfig, NpcConfig, SceneConfig } from "@/types/simulation";
import type { SimulatedEvent } from "@/types/yaml-configs";
import { EVENT_FIELD_SCHEMAS, TriggerEventType } from "@/types/yaml-configs";

interface BuildAutochatMessagesOpts {
  playerConfig: PlayerConfig;
  scene: SceneConfig;
  selectedNpcs: NpcConfig[];
  chatHistory: ChatEntry[];
  gameEvents: SimulatedEvent[];
}

export function buildAutochatMessages(opts: BuildAutochatMessagesOpts): ChatMessage[] {
  const { playerConfig, scene, selectedNpcs, chatHistory, gameEvents } = opts;

  // Build available event types summary
  const eventTypesList = Object.entries(EVENT_FIELD_SCHEMAS)
    .map(([type, fields]) => {
      const fieldNames = fields.map((f) => `${f.name} (${f.type})`).join(", ");
      return `- ${type}: fields=[${fieldNames}]`;
    })
    .join("\n");

  // Build NPC list
  const npcList = selectedNpcs
    .map((n) => `- ${n.displayName} (${n.gender} ${n.race}, ${n.distance} units away)`)
    .join("\n");

  const systemPrompt = `You are roleplaying as ${playerConfig.name}, the player character in Skyrim. You are having a conversation with the NPCs present in the scene. Speak directly to them, address them by name, react to what they say, and drive the conversation forward.

YOUR CHARACTER:
- Name: ${playerConfig.name}
- Race: ${playerConfig.race}
- Gender: ${playerConfig.gender}
- Level: ${playerConfig.level}
${playerConfig.isInCombat ? "- Currently in combat\n" : ""}${playerConfig.bio ? `- Bio: ${playerConfig.bio}\n` : ""}
CURRENT SCENE:
- Location: ${scene.location}
- Weather: ${scene.weather}
- Time of Day: ${scene.timeOfDay}
${scene.worldPrompt ? `- World context: ${scene.worldPrompt}\n` : ""}${scene.scenePrompt ? `- Scene context: ${scene.scenePrompt}\n` : ""}
NPCs YOU ARE TALKING TO:
${npcList || "(no NPCs present)"}

You MUST interact with these NPCs. Address them by name. Ask them questions, respond to their dialogue, barter, argue, joke, flirt, threaten — whatever fits your character and the situation. Do not narrate or describe actions in prose; speak as ${playerConfig.name} would speak aloud.

GAME EVENTS (optional — trigger when narratively appropriate):
${eventTypesList}

OUTPUT FORMAT:
- Write your dialogue as plain text (no quotes needed). Be concise: 1-3 sentences.
- To trigger a game event, add on a new line: EVENT: <type> PARAMS: <json>
- You can speak AND trigger an event in the same response.
- Only trigger events occasionally, when your character would actually do something.

EXAMPLES:
Dialogue only: Hey Lydia, what do you think about this place? Gives me the creeps.
Event only: EVENT: equip PARAMS: {"item": "Daedric Sword", "slot": "right_hand"}
Both: Stand back, I'll handle this! EVENT: spell_cast PARAMS: {"spell": "Fireball", "school": "Destruction", "target": "enemy"}`;

  // Build conversation context from recent chat history
  const recentChat = chatHistory.slice(-30);
  const chatContext = recentChat
    .map((e) => {
      if (e.type === "player") return `${playerConfig.name}: ${e.content}`;
      if (e.type === "npc") return `${e.speaker}: ${e.content}`;
      if (e.type === "narration") return `[Narration] ${e.content}`;
      return `[System] ${e.content}`;
    })
    .join("\n");

  // Build recent events context
  const recentEvents = gameEvents.slice(-10);
  const eventsContext = recentEvents.length > 0
    ? "\n\nRecent game events:\n" + recentEvents.map((e) => {
        const fields = Object.entries(e.fields).map(([k, v]) => `${k}=${v}`).join(", ");
        return `- [${e.eventType}] ${fields}`;
      }).join("\n")
    : "";

  const userPrompt = chatContext
    ? `Recent conversation:\n${chatContext}${eventsContext}\n\nWhat does ${playerConfig.name} say or do next?`
    : `The scene is set. No conversation yet.${eventsContext}\n\nWhat does ${playerConfig.name} say or do to begin?`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
