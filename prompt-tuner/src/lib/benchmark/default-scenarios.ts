import type {
  BenchmarkCategory,
  BenchmarkScenario,
  BenchmarkChatEntry,
  BenchmarkDialogueTurn,
  BenchmarkPlayer,
  BenchmarkScene,
  BenchmarkNpc,
} from "@/types/benchmark";

// ── Shared test data ────────────────────────────────────────────────

const DEFAULT_PLAYER: BenchmarkPlayer = {
  name: "Dragonborn",
  gender: "Male",
  race: "Nord",
  level: 15,
};

const DEFAULT_SCENE: BenchmarkScene = {
  location: "The Bannered Mare, Whiterun",
  weather: "Clear",
  timeOfDay: "Evening",
  worldPrompt: "",
  scenePrompt: "The tavern is warm and lively. Hulda tends the bar while Mikael plays his lute in the corner. A fire crackles in the hearth.",
};

const DEFAULT_NPCS: BenchmarkNpc[] = [
  { uuid: "benchmark-npc-0", name: "Hulda", displayName: "Hulda", gender: "Female", race: "Nord", distance: 150 },
  { uuid: "benchmark-npc-1", name: "Mikael", displayName: "Mikael", gender: "Male", race: "Nord", distance: 400 },
];

const SHARED_CHAT_HISTORY: BenchmarkChatEntry[] = [
  { type: "player", speaker: "Dragonborn", content: "I've been traveling for days. What's the news in Whiterun?", target: "Hulda" },
  { type: "npc", speaker: "Hulda", content: "The Companions have been busy. Something about a fragment of Wuuthrad.", target: "Dragonborn" },
  { type: "player", speaker: "Dragonborn", content: "Interesting. And what about the war?", target: "Hulda" },
  { type: "npc", speaker: "Hulda", content: "Best not to talk about that too loudly. The Jarl tries to stay neutral.", target: "Dragonborn" },
  { type: "player", speaker: "Dragonborn", content: "I heard there's trouble with the Grey-Manes and Battle-Borns.", target: "Hulda" },
  { type: "npc", speaker: "Mikael", content: "Everyone in Whiterun knows about that feud. Best to steer clear of it.", target: "Dragonborn" },
];

const DEFAULT_ELIGIBLE_ACTIONS = [
  { name: "None", description: "No action" },
  { name: "Gesture", description: "Perform a gesture or animation", parameterSchema: '{"gesture": "string"}' },
  { name: "Trade", description: "Open trade dialogue", parameterSchema: "{}" },
  { name: "Follow", description: "Follow the player", parameterSchema: "{}" },
  { name: "Wait", description: "Wait at current location", parameterSchema: "{}" },
];

// ── Multi-turn dialogue data ────────────────────────────────────────

const DIALOGUE_PLAYER: BenchmarkPlayer = {
  name: "Dragonborn-Bill",
  gender: "Male",
  race: "Nord",
  level: 15,
};

const DIALOGUE_SCENE: BenchmarkScene = {
  location: "The Bannered Mare, Whiterun",
  weather: "Clear",
  timeOfDay: "Afternoon",
  worldPrompt: "",
  scenePrompt: "The tavern is warm and lively. Hulda tends the bar while Mikael plays his lute in the corner. A fire crackles in the hearth.",
};

const DIALOGUE_NPCS: BenchmarkNpc[] = [
  { uuid: "hulda_66E", name: "Hulda", displayName: "Hulda", gender: "Female", race: "Nord", distance: 150 },
  { uuid: "mikael_671", name: "Mikael", displayName: "Mikael", gender: "Male", race: "Nord", distance: 400 },
  { uuid: "saadia_505", name: "Saadia", displayName: "Saadia", gender: "Female", race: "Redguard", distance: 350 },
  { uuid: "uthgerd_the_unbroken_918", name: "Uthgerd the Unbroken", displayName: "Uthgerd the Unbroken", gender: "Female", race: "Nord", distance: 500 },
];

const DIALOGUE_TURNS: BenchmarkDialogueTurn[] = [
  {
    id: "turn-1", label: "Turn 1",
    inputType: "player", inputSpeaker: "Dragonborn-Bill", inputSpeakerUuid: "player_001",
    inputContent: "Good afternoon! I just got in from the road. What's been happening around Whiterun?",
    inputTarget: "Hulda", respondingNpcIndex: 0,
  },
  {
    id: "turn-2", label: "Turn 2",
    inputType: "player", inputSpeaker: "Dragonborn-Bill", inputSpeakerUuid: "player_001",
    inputContent: "What do you think about the Thalmor, Hulda? They seem to be everywhere these days.",
    inputTarget: "Hulda", respondingNpcIndex: 0,
  },
  {
    id: "turn-3", label: "Turn 3",
    inputType: "player", inputSpeaker: "Dragonborn-Bill", inputSpeakerUuid: "player_001",
    inputContent: "I've been looking for adventure. Any suggestions for someone like me?",
    inputTarget: "Hulda", respondingNpcIndex: 0,
  },
  {
    id: "turn-4", label: "Turn 4",
    inputType: "player", inputSpeaker: "Dragonborn-Bill", inputSpeakerUuid: "player_001",
    inputContent: "Has anyone heard about Bleak Falls Barrow? I'm thinking of exploring it.",
    inputTarget: "Hulda", respondingNpcIndex: 0,
  },
  {
    id: "turn-5", label: "Turn 5",
    inputType: "npc", inputSpeaker: "Mikael", inputSpeakerUuid: "mikael_671",
    inputContent: "You seem rather quiet tonight, Saadia. Is something troubling you?",
    inputTarget: "Saadia", respondingNpcIndex: 2,
  },
  {
    id: "turn-6", label: "Turn 6",
    inputType: "npc", inputSpeaker: "Uthgerd the Unbroken", inputSpeakerUuid: "uthgerd_the_unbroken_918",
    inputContent: "Still serenading the wenches, Mikael? When are you going to pick up a real weapon?",
    inputTarget: "Mikael", respondingNpcIndex: 1,
  },
];

// ── Default scenarios per category (one per model agent) ────────────

export const DEFAULT_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "default-dialogue",
    name: "Bannered Mare",
    description: "A busy afternoon at the Bannered Mare — the player chats with Hulda while Mikael, Saadia, and Uthgerd have exchanges of their own.",
    category: "dialogue",
    isBuiltin: true,
    player: DIALOGUE_PLAYER,
    scene: DIALOGUE_SCENE,
    npcs: DIALOGUE_NPCS,
    chatHistory: [],
    turns: DIALOGUE_TURNS,
  },
  {
    id: "default-meta-eval",
    name: "Multi-NPC Conversation Flow",
    description: "Target selection + speaker prediction in a multi-NPC tavern scene",
    category: "meta_eval",
    isBuiltin: true,
    player: DEFAULT_PLAYER,
    scene: DEFAULT_SCENE,
    npcs: DEFAULT_NPCS,
    chatHistory: SHARED_CHAT_HISTORY,
    playerMessage: "Does anyone know where I can find a good sword?",
    lastSpeaker: "Mikael",
  },
  {
    id: "default-action-eval",
    name: "Dialogue Action Evaluation",
    description: "Evaluate what game action should accompany Hulda's response",
    category: "action_eval",
    isBuiltin: true,
    player: DEFAULT_PLAYER,
    scene: DEFAULT_SCENE,
    npcs: DEFAULT_NPCS,
    chatHistory: SHARED_CHAT_HISTORY,
    playerMessage: "Can I get a room for the night?",
    npcResponse: "Of course. That'll be ten gold. Your room is upstairs, second door on the right.",
    npcName: "Hulda",
    eligibleActions: DEFAULT_ELIGIBLE_ACTIONS,
  },
  {
    id: "default-game-master",
    name: "Tavern Scene Direction",
    description: "Scene planning + GM action selection in the Bannered Mare",
    category: "game_master",
    isBuiltin: true,
    player: DEFAULT_PLAYER,
    scene: DEFAULT_SCENE,
    npcs: DEFAULT_NPCS,
    chatHistory: SHARED_CHAT_HISTORY,
    scenePlan: JSON.stringify({
      scene_summary: "A quiet evening in the Bannered Mare turns tense as rumors of the civil war surface",
      tone: "uneasy camaraderie",
      central_tension: "Political loyalties divide the patrons",
      beats: [
        { type: "dialogue", description: "Hulda and Mikael discuss recent trade disruptions", primary_characters: ["Hulda", "Mikael"], purpose: "Establish normalcy before tension" },
        { type: "dialogue", description: "A patron mentions Stormcloak activity nearby", primary_characters: ["Mikael"], purpose: "Introduce political tension" },
        { type: "dialogue", description: "Hulda tries to defuse the situation", primary_characters: ["Hulda"], purpose: "Show Whiterun's neutral stance" },
        { type: "dialogue", description: "The conversation settles into uneasy small talk", primary_characters: ["Hulda", "Mikael"], purpose: "Resolution" },
      ],
    }),
    isContinuousMode: true,
  },
  {
    id: "default-memory-gen",
    name: "Tavern Memory Generation",
    description: "Generate memories from the tavern conversation",
    category: "memory_gen",
    isBuiltin: true,
    player: DEFAULT_PLAYER,
    scene: DEFAULT_SCENE,
    npcs: DEFAULT_NPCS,
    chatHistory: SHARED_CHAT_HISTORY,
  },
  {
    id: "default-diary",
    name: "Hulda's Diary Entry",
    description: "Generate a diary entry for Hulda after the conversation",
    category: "diary",
    isBuiltin: true,
    player: DEFAULT_PLAYER,
    scene: DEFAULT_SCENE,
    npcs: DEFAULT_NPCS,
    chatHistory: SHARED_CHAT_HISTORY,
  },
  {
    id: "default-bio-update",
    name: "Bio Update from Conversation",
    description: "Update Hulda's bio based on what happened",
    category: "bio_update",
    isBuiltin: true,
    player: DEFAULT_PLAYER,
    scene: DEFAULT_SCENE,
    npcs: DEFAULT_NPCS,
    chatHistory: SHARED_CHAT_HISTORY,
  },
];

export function getDefaultScenario(category: BenchmarkCategory): BenchmarkScenario {
  return DEFAULT_SCENARIOS.find((s) => s.category === category)!;
}

export function getBuiltinScenarios(category: BenchmarkCategory): BenchmarkScenario[] {
  return DEFAULT_SCENARIOS.filter((s) => s.category === category);
}

export function findBuiltinScenario(id: string): BenchmarkScenario | undefined {
  return DEFAULT_SCENARIOS.find((s) => s.id === id);
}

// ── Build the POST body for a subtask's render endpoint ─────────────

/** Convert BenchmarkNpc → NpcConfig-compatible object. */
function toNpcConfig(npc: BenchmarkNpc, index: number) {
  return {
    uuid: npc.uuid || `benchmark-npc-${index}`,
    name: npc.name || npc.displayName,
    displayName: npc.displayName,
    gender: npc.gender,
    race: npc.race,
    distance: npc.distance,
    filePath: "",
  };
}

/** Convert BenchmarkChatEntry[] → ChatEntry-compatible objects. */
function chatToSimFormat(entries: BenchmarkChatEntry[]) {
  return entries.map((e, i) => ({
    id: `bench-chat-${i}`,
    type: e.type,
    speaker: e.speaker,
    content: e.content,
    target: e.target || "",
    timestamp: Date.now() - (entries.length - i) * 5000,
  }));
}

export function buildRenderBody(
  subtaskId: string,
  scenario: BenchmarkScenario,
  promptSetBase?: string,
): Record<string, unknown> {
  const base = {
    player: scenario.player,
    scene: scenario.scene,
    promptSetBase,
  };

  const npcs = scenario.npcs.map((n, i) => toNpcConfig(n, i));
  const primaryNpc = npcs[0] || undefined;
  const chat = chatToSimFormat(scenario.chatHistory);

  switch (subtaskId) {
    case "dialogue":
      return {
        ...base,
        npc: primaryNpc,
        selectedNpcs: npcs,
        chatHistory: chat,
        eligibleActions: scenario.eligibleActions || [],
        gameEvents: [],
      };

    case "target_selection":
      return {
        ...base,
        playerMessage: scenario.playerMessage || "",
        npcs: npcs,
        chatHistory: chat,
        gameEvents: [],
      };

    case "speaker_prediction":
      return {
        ...base,
        lastSpeaker: scenario.lastSpeaker || "Player",
        npcs: npcs,
        chatHistory: chat,
        gameEvents: [],
      };

    case "action_selection":
      return {
        ...base,
        npcName: scenario.npcName || scenario.npcs[0]?.displayName || "NPC",
        npcUUID: primaryNpc?.uuid || "benchmark-npc-0",
        playerMessage: scenario.playerMessage || "",
        npcResponse: scenario.npcResponse || "",
        eligibleActions: scenario.eligibleActions || DEFAULT_ELIGIBLE_ACTIONS,
        eventHistory: "",
        selectedNpcs: npcs,
        chatHistory: chat,
        gameEvents: [],
      };

    case "scene_planning":
      return {
        ...base,
        npcs: npcs,
        chatHistory: chat,
        eventHistory: "",
        gameEvents: [],
      };

    case "gm_action_selection":
      return {
        ...base,
        npcs: npcs,
        chatHistory: chat,
        eventHistory: "",
        scenePlan: scenario.scenePlan || "",
        isContinuousMode: scenario.isContinuousMode ?? false,
        eligibleActions: scenario.eligibleActions || [],
        gameEvents: [],
      };

    case "memory_generation":
      return {
        ...base,
        npc: primaryNpc,
        selectedNpcs: npcs,
        chatHistory: chat,
        gameEvents: [],
      };

    case "diary_generation":
      return {
        ...base,
        npc: primaryNpc,
        selectedNpcs: npcs,
        chatHistory: chat,
        gameEvents: [],
      };

    case "bio_update":
      return {
        ...base,
        npc: primaryNpc,
        selectedNpcs: npcs,
        chatHistory: chat,
        gameEvents: [],
      };

    default:
      return base;
  }
}

/**
 * Build the POST body for one turn in a multi-turn dialogue benchmark.
 * Sets the responding NPC as primary, the speaker as responseTarget,
 * and passes accumulated chat as the history.
 */
export function buildMultiTurnRenderBody(
  turn: BenchmarkDialogueTurn,
  scenario: BenchmarkScenario,
  accumulatedChat: BenchmarkChatEntry[],
  promptSetBase?: string,
): Record<string, unknown> {
  const npcs = scenario.npcs.map((n, i) => toNpcConfig(n, i));
  const respondingNpc = npcs[turn.respondingNpcIndex];
  const chat = chatToSimFormat(accumulatedChat);

  // Resolve the speaker as the responseTarget
  let responseTarget: { type: string; UUID: string } | undefined;
  if (turn.inputType === "player") {
    responseTarget = { type: "player", UUID: "player_001" };
  } else {
    const speakerNpc = npcs.find((n) => n.uuid === turn.inputSpeakerUuid);
    responseTarget = speakerNpc
      ? { type: "npc", UUID: speakerNpc.uuid }
      : { type: "npc", UUID: turn.inputSpeakerUuid };
  }

  return {
    player: scenario.player,
    scene: scenario.scene,
    // Builtin scenarios force original prompts (no promptSetBase)
    promptSetBase: scenario.isBuiltin ? undefined : promptSetBase,
    npc: respondingNpc,
    selectedNpcs: npcs,
    chatHistory: chat,
    responseTarget,
    eligibleActions: [],
    gameEvents: [],
  };
}
