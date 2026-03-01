import type { BenchmarkCategory } from "@/types/benchmark";
import type { ChatMessage } from "@/types/llm";

const SCHEMA = `{
  "name": string,
  "description": string,
  "player": { "name": string, "gender": "Male"|"Female", "race": Race, "level": number (1-80) },
  "scene": { "location": string, "weather": Weather, "timeOfDay": Time, "worldPrompt": string, "scenePrompt": string },
  "npcs": [{ "uuid": string, "name": string, "displayName": string, "gender": string, "race": Race, "distance": number }],
  "chatHistory": [{ "type": "player"|"npc"|"narration", "speaker": string, "content": string }],
  "turns": Turn[] | [],
  "playerMessage": string | "",
  "npcResponse": string | "",
  "npcName": string | "",
  "lastSpeaker": string | "",
  "eligibleActions": Action[] | [],
  "scenePlan": string | "",
  "isContinuousMode": boolean
}`;

const ENUMS = `Valid enums:
- Race: "Nord", "Imperial", "Breton", "Redguard", "Dunmer", "Altmer", "Bosmer", "Orsimer", "Khajiit", "Argonian"
- Gender: "Male", "Female"
- Weather: "Clear", "Cloudy", "Rainy", "Snowy", "Foggy", "Stormy"
- Time: "Dawn", "Morning", "Afternoon", "Evening", "Night", "Midnight"
- ChatEntry type: "player", "npc", "narration"
- Turn inputType: "player", "npc"`;

const UUID_NOTE = `NPC uuid format: lowercase_name_hexid (e.g. "hulda_66E", "lydia_A2C94"). Use plausible hex IDs.`;

const CATEGORY_INSTRUCTIONS: Record<BenchmarkCategory, string> = {
  dialogue: `Category: dialogue
Use the "turns" array with 3-6 turns. Leave "chatHistory" empty.
Each turn object:
  { "id": "turn-N", "label": "Turn N", "inputType": "player"|"npc", "inputSpeaker": string, "inputSpeakerUuid": string, "inputContent": string, "inputTarget": string, "respondingNpcIndex": number }
- inputSpeakerUuid: for player use "player_001", for NPCs use their uuid from the npcs array.
- respondingNpcIndex: a valid index into the npcs[] array (the NPC who should respond to this turn).
- inputTarget: the name of who the speaker is addressing.
Include at least 1-2 NPCs. Alternate between player and NPC turns for natural dialogue flow.`,

  meta_eval: `Category: meta_eval (target selection / speaker prediction)
Populate "chatHistory" with 4-6 entries showing a multi-party conversation.
Set "playerMessage" to the player's latest message that needs target/speaker evaluation.
Set "lastSpeaker" to the name of who spoke most recently before the player message.
Include 2-3 NPCs so target selection is non-trivial.
Leave turns, eligibleActions, scenePlan, npcResponse, npcName empty/default.`,

  action_eval: `Category: action_eval (action selection from dialogue)
Populate "chatHistory" with 3-5 entries of conversation context.
Set "playerMessage" to what the player just said.
Set "npcResponse" to how the NPC responded.
Set "npcName" to the responding NPC's display name.
Set "eligibleActions" to 3-7 action objects: { "name": string, "description": string }.
One action MUST be { "name": "None", "description": "No action needed" }.
Other actions should be contextually appropriate (e.g. "Attack", "Trade", "Follow", "Give Item").
Leave turns, scenePlan, lastSpeaker empty/default.`,

  game_master: `Category: game_master (scene planning / autonomous NPC direction)
Populate "chatHistory" with 3-5 entries.
Set "scenePlan" to a JSON string (stringify it) with this structure:
  { "scene_summary": string, "tone": string, "central_tension": string, "beats": [{ "description": string, "involved_npcs": string[] }] }
Include 2-3 beats in the plan.
Set "isContinuousMode" to true or false.
Leave turns, eligibleActions, playerMessage, npcResponse, npcName, lastSpeaker empty/default.`,

  memory_gen: `Category: memory_gen (generate memories from conversation)
Populate "chatHistory" with 4-8 entries showing a meaningful conversation worth remembering.
Include emotionally significant or plot-relevant exchanges.
Leave turns, eligibleActions, scenePlan, playerMessage, npcResponse, npcName, lastSpeaker empty/default.`,

  diary: `Category: diary (generate diary entries)
Populate "chatHistory" with 4-8 entries showing events an NPC would want to write about.
Include a mix of notable happenings: combat, trade, personal moments, or lore discoveries.
Leave turns, eligibleActions, scenePlan, playerMessage, npcResponse, npcName, lastSpeaker empty/default.`,

  bio_update: `Category: bio_update (update character bios)
Populate "chatHistory" with 4-8 entries revealing character development or new information.
Include dialogue that shows personality traits, relationship changes, or new facts about the NPC.
Leave turns, eligibleActions, scenePlan, playerMessage, npcResponse, npcName, lastSpeaker empty/default.`,
};

export function buildSceneGenMessages(
  category: BenchmarkCategory,
  userDescription?: string,
): ChatMessage[] {
  const system = `You are a Skyrim scenario generator for SkyrimNet benchmark testing. You create realistic, lore-accurate test scenarios for evaluating AI NPC agents.

Output a single JSON object matching this schema:
${SCHEMA}

${ENUMS}

${UUID_NOTE}

${CATEGORY_INSTRUCTIONS[category]}

Rules:
- Use lore-accurate Skyrim locations, NPC names, races, and settings.
- "worldPrompt" should be 1-2 sentences of world context. "scenePrompt" should describe the immediate scenario.
- Give the scenario a descriptive "name" and brief "description".
- Output ONLY valid JSON. No markdown fences, no explanation, no extra text.`;

  const user = userDescription?.trim()
    ? `Generate a ${category} benchmark scenario based on this description: ${userDescription.trim()}`
    : `Generate a creative, lore-accurate ${category} benchmark scenario set in Skyrim. Pick an interesting location, characters, and situation at random.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
