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
- ChatEntry type: "player" (player dialogue), "npc" (NPC dialogue), "narration" (environmental events, combat, descriptions — use speaker "Narrator")
- Turn inputType: "player", "npc"`;

const UUID_NOTE = `NPC uuid format: lowercase_name_hexid (e.g. "hulda_66E", "lydia_A2C94"). Use plausible hex IDs.`;

const CATEGORY_INSTRUCTIONS: Record<BenchmarkCategory, string> = {
  dialogue: `Category: dialogue
Use the "turns" array with 3-6 turns. Leave "chatHistory" empty.
Each turn object:
  { "id": "turn-N", "label": "Turn N", "inputType": "player"|"npc", "inputSpeaker": string, "inputSpeakerUuid": string, "inputContent": string, "inputTarget": string, "respondingNpcIndex": number }
- inputSpeakerUuid: for player use "player_001", for NPCs use their uuid from the npcs array.
- respondingNpcIndex: a valid index into the npcs[] array (the NPC who should respond to this turn).
- inputTarget: the name of who the speaker is addressing, or "" for undirected speech.
Include at least 1-2 NPCs. Alternate between player and NPC turns for natural dialogue flow.`,

  meta_eval: `Category: meta_eval (target selection / speaker prediction)
This tests TWO sub-agents: (1) who the player is addressing, and (2) which NPC should speak next.

Populate "chatHistory" with 4-6 entries showing a multi-party conversation. CRITICAL: include 2-3 NPCs ALL actively participating in the conversation — do NOT write a simple back-and-forth between the player and one NPC. Multiple NPCs should speak so it's genuinely ambiguous who the player might be addressing. Mix entry types:
  - Use "npc" type for NPC lines (with different NPCs as speakers)
  - Use "player" type for the player's lines
  - Include at least one NPC-to-NPC exchange
Set "playerMessage" to a new line from the player that could plausibly be directed at different NPCs — e.g. a question relevant to multiple NPCs' expertise, or an ambiguous remark like "What do you think?" Avoid making the target obvious.
Set "lastSpeaker" to the name of who spoke most recently before the player message (this NPC is excluded from speaker prediction candidates).
Include 2-3 NPCs. Give each NPC a reason to speak (personal stakes, expertise, personality trait) so speaker prediction is non-trivial.
Leave turns, eligibleActions, scenePlan, npcResponse, npcName empty/default.`,

  action_eval: `Category: action_eval (action selection from dialogue)
This tests whether the AI picks the correct game action (or "None") after an NPC's dialogue response.

Populate "chatHistory" with 3-5 entries of conversation context leading up to the key exchange. Include both player and NPC lines that build toward the final action-triggering exchange. Use narration entries (type "narration", speaker "Narrator") where appropriate to set the scene (e.g. describing the NPC pulling out a weapon, or reaching for an item).
Set "playerMessage" to what the player just said — this should prompt the NPC to do something specific (e.g. "Show me your wares", "Follow me", "Here, take this").
Set "npcResponse" to how the NPC responded — the response should clearly imply a specific action (e.g. "Of course, take a look!" implies Trade, "I'll follow you." implies Follow).
Set "npcName" to the responding NPC's display name.
Set "eligibleActions" to 4-7 action objects: { "name": string, "description": string }.
  - Include the correct action that matches the dialogue exchange
  - Include { "name": "None", "description": "No action needed" }
  - Include 2-5 plausible distractor actions that don't match the context
  - Example actions: "Attack", "Trade", "Follow", "Wait", "Give Item", "Gesture", "DrawWeapon", "Flee", "Heal"
  - Optionally add "parameterSchema" as a JSON string for actions with parameters
Leave turns, scenePlan, lastSpeaker empty/default.`,

  game_master: `Category: game_master (scene planning + autonomous NPC direction)
This tests TWO sub-agents: (1) generating a scene plan with dramatic beats, and (2) selecting GM actions to execute those beats. The GM orchestrates NPC-only scenes — the player is present but uncontrollable.

Populate "chatHistory" with 3-5 entries showing recent activity in the scene. CRITICAL: this should be primarily NPC-to-NPC interaction (type "npc") since the GM drives NPC behavior, not player dialogue. Include:
  - NPC-to-NPC dialogue entries showing existing dynamics
  - Optionally narration entries (type "narration", speaker "Narrator") for environmental context
  - A player line is optional — the GM scene should work without player involvement
Include 2-3 NPCs with distinct personalities or conflicting motivations that create dramatic potential.
Set "scenePlan" to a JSON string (stringify it) with this structure:
  { "scene_summary": string, "tone": string, "central_tension": string, "beats": [{ "type": "dialogue", "description": string, "primary_characters": string[], "purpose": string }] }
Include 3-4 beats. Beats should heavily favor type "dialogue" (NPC-to-NPC conversation). Each beat should name the involved NPCs and explain its narrative purpose.
Set "isContinuousMode" to true (has scene plan) or false (freestyle GM decisions).
Leave turns, playerMessage, npcResponse, npcName, lastSpeaker empty/default.
Note: eligibleActions for GM are auto-populated (StartConversation, ContinueConversation, Narrate, None).`,

  memory_gen: `Category: memory_gen (generate memories from conversation)
This tests the memory generation agent, which creates structured memories from an NPC's experiences. Memories include content, emotion, importance score, and tags.

Populate "chatHistory" with 4-8 entries showing events the first NPC experienced. CRITICAL: do NOT write a simple back-and-forth dialogue. Include varied entry types that represent different kinds of experiences:
  - "npc" entries for NPC dialogue (multiple NPCs if relevant)
  - "player" entries for player dialogue
  - "narration" entries (speaker "Narrator") for environmental events, combat, or significant happenings (e.g. "A dragon attacks Whiterun", "The guards arrest the thief", "Rain begins to fall")
Include at least one emotionally significant event and optionally some mundane lines to test importance scoring.
The first NPC is the one generating memories, so make sure they witness or participate in the key moments.
Include 1-2 NPCs (first NPC = the rememberer).
Leave turns, eligibleActions, scenePlan, playerMessage, npcResponse, npcName, lastSpeaker empty/default.`,

  diary: `Category: diary (generate diary entries)
This tests the diary agent, which writes first-person diary entries for an NPC based on their recent experiences.

Populate "chatHistory" with 4-8 entries showing events the first NPC experienced. CRITICAL: include a variety of event types, not just dialogue. A diary covers an NPC's whole day:
  - "npc" entries for meaningful conversations the NPC had
  - "player" entries for player interactions
  - "narration" entries (speaker "Narrator") for non-dialogue events: combat, trade, travel, weather, discoveries, arrivals/departures (e.g. "A courier arrives with a letter", "Hulda serves the last customer and begins cleaning")
Mix significant moments with ordinary ones — the diary agent should prioritize what's worth writing about.
The first NPC is the diary writer. Make sure their day includes events worth reflecting on.
Include 1-2 NPCs (first NPC = the diary author).
Leave turns, eligibleActions, scenePlan, playerMessage, npcResponse, npcName, lastSpeaker empty/default.`,

  bio_update: `Category: bio_update (update character bios dynamically)
This tests the bio update agent, which conservatively updates an NPC's character bio based on new experiences. Most events should NOT trigger bio changes.

Populate "chatHistory" with 4-8 entries. CRITICAL: include mostly routine events that should NOT change the bio, with one or two potentially significant moments:
  - "npc" / "player" entries for routine dialogue (small talk, trading, greetings)
  - "narration" entries (speaker "Narrator") for routine happenings (opening shop, eating, walking)
  - One or two entries that reveal something new: a relationship change, a personality shift, new information about the NPC, or a significant event
The first NPC is the bio update target. The scenario should test whether the agent correctly identifies which events are bio-worthy vs routine.
Include 1-2 NPCs (first NPC = bio update target).
Leave turns, eligibleActions, scenePlan, playerMessage, npcResponse, npcName, lastSpeaker empty/default.`,
};

const COPYCAT_DIALOGUE_OVERRIDE = `Category: dialogue
Use the "turns" array with 3-6 turns. Leave "chatHistory" empty.
Each turn object:
  { "id": "turn-N", "label": "Turn N", "inputType": "player"|"npc", "inputSpeaker": string, "inputSpeakerUuid": string, "inputContent": string, "inputTarget": string, "respondingNpcIndex": number }
- inputSpeakerUuid: for player use "player_001", for NPCs use their uuid from the npcs array.
- respondingNpcIndex: a valid index into the npcs[] array (the NPC who should respond to this turn).
- inputTarget: the name of who the speaker is addressing, or "" for undirected speech.

IMPORTANT: Each turn is a single INPUT line spoken TO an NPC. The NPC at respondingNpcIndex will generate a response via the AI model being tested — you do NOT write the NPC's response. Every turn should be a prompt that elicits an interesting dialogue response from the responding NPC.

Typical pattern: the player says something to an NPC, and that NPC responds (via the AI). So most turns will have inputType "player". You can also have an NPC speak to another NPC (inputType "npc") to test NPC-to-NPC dialogue.

Include at least 1-2 NPCs. Vary the topics and emotional tone across turns to test range (e.g. a greeting, a lore question, a personal question, a provocative remark, a request for help).`;

export function buildSceneGenMessages(
  category: BenchmarkCategory,
  userDescription?: string,
  context?: "tuner" | "copycat",
): ChatMessage[] {
  const categoryInstructions = context === "copycat" && category === "dialogue"
    ? COPYCAT_DIALOGUE_OVERRIDE
    : CATEGORY_INSTRUCTIONS[category];

  const system = `You are a Skyrim scenario generator for SkyrimNet benchmark testing. You create realistic, lore-accurate test scenarios for evaluating AI NPC agents.

Output a single JSON object matching this schema:
${SCHEMA}

${ENUMS}

${UUID_NOTE}

${categoryInstructions}

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
