import type { InjaValue } from "@/lib/inja/renderer";
import type { NpcConfig, SceneConfig, ChatEntry, PlayerConfig } from "@/types/simulation";
import type { SimulatedEvent } from "@/types/yaml-configs";
import type { SimulationState } from "./assembler";
import { buildPlayerObject } from "./player-defaults";
import { enrichNpc, enrichLocation, type EnrichedNpc } from "./npc-enricher";

// --- Time helpers ---

const WEEKDAYS = ["Sundas", "Morndas", "Tirdas", "Middas", "Turdas", "Fredas", "Loredas"];
const MONTHS = [
  "Morning Star", "Sun's Dawn", "First Seed", "Rain's Hand", "Second Seed", "Mid Year",
  "Sun's Height", "Last Seed", "Hearthfire", "Frostfall", "Sun's Dusk", "Evening Star",
];

const TIME_MAP: Record<string, { hour: number; minute: number }> = {
  "Dawn": { hour: 6, minute: 0 },
  "Early Morning": { hour: 7, minute: 30 },
  "Morning": { hour: 9, minute: 0 },
  "Late Morning": { hour: 10, minute: 30 },
  "Noon": { hour: 12, minute: 0 },
  "Early Afternoon": { hour: 13, minute: 30 },
  "Afternoon": { hour: 14, minute: 0 },
  "Late Afternoon": { hour: 16, minute: 0 },
  "Evening": { hour: 18, minute: 0 },
  "Dusk": { hour: 19, minute: 30 },
  "Night": { hour: 21, minute: 0 },
  "Late Night": { hour: 23, minute: 0 },
  "Midnight": { hour: 0, minute: 0 },
};

export function deriveGameTime(timeOfDay: string) {
  const mapped = TIME_MAP[timeOfDay] || { hour: 14, minute: 0 };
  const displayHour = mapped.hour === 0 ? 12 : mapped.hour > 12 ? mapped.hour - 12 : mapped.hour;
  const ampm = mapped.hour >= 12 ? "PM" : "AM";
  const minuteStr = mapped.minute.toString().padStart(2, "0");

  const weekdayName = WEEKDAYS[3]; // Middas (Wednesday)
  const day = 17;
  const monthName = MONTHS[7]; // Last Seed (August)
  const year = "4E 201";

  const gameTime = `${weekdayName}, ${displayHour}:${minuteStr} ${ampm}, ${day}th of ${monthName}, ${year}`;
  const gameTimeJson: Record<string, InjaValue> = {
    hour: mapped.hour,
    minute: mapped.minute,
    displayHour,
    ampm,
    day,
    monthName,
    weekdayName,
    year,
  };
  const gameTimeNumeric = mapped.hour * 60 + mapped.minute;

  return { gameTime, gameTimeJson, gameTimeNumeric, time_desc: timeOfDay };
}

// --- Weather helpers ---

const WEATHER_MAP: Record<string, { isRaining: boolean; isSnowing: boolean; windSpeed: number }> = {
  "Clear": { isRaining: false, isSnowing: false, windSpeed: 0 },
  "Cloudy": { isRaining: false, isSnowing: false, windSpeed: 10 },
  "Overcast": { isRaining: false, isSnowing: false, windSpeed: 15 },
  "Fog": { isRaining: false, isSnowing: false, windSpeed: 5 },
  "Light Rain": { isRaining: true, isSnowing: false, windSpeed: 10 },
  "Rain": { isRaining: true, isSnowing: false, windSpeed: 20 },
  "Heavy Rain": { isRaining: true, isSnowing: false, windSpeed: 30 },
  "Thunderstorm": { isRaining: true, isSnowing: false, windSpeed: 40 },
  "Light Snow": { isRaining: false, isSnowing: true, windSpeed: 10 },
  "Snow": { isRaining: false, isSnowing: true, windSpeed: 20 },
  "Blizzard": { isRaining: false, isSnowing: true, windSpeed: 50 },
};

export function deriveWeather(weather: string) {
  const mapped = WEATHER_MAP[weather] || { isRaining: false, isSnowing: false, windSpeed: 0 };
  return {
    currentWeather: {
      name: weather,
      ...mapped,
    } as Record<string, InjaValue>,
    is_indoors: false,
  };
}

// --- NPC builder ---

export function buildNpcObject(
  npc: NpcConfig,
  scene?: SceneConfig,
  allNpcs?: NpcConfig[]
): { npcObj: Record<string, InjaValue>; enriched: EnrichedNpc } {
  const isFemale = npc.gender === "Female";
  const displayName = npc.displayName || npc.name;

  // Enrich NPC with plausible game data
  const dummyScene: SceneConfig = scene || { location: "", weather: "Clear", timeOfDay: "Afternoon", worldPrompt: "", scenePrompt: "" };
  const enriched = enrichNpc(npc, dummyScene, allNpcs || []);

  const npcObj: Record<string, InjaValue> = {
    name: displayName,
    UUID: npc.uuid,
    firstName: displayName.split(" ")[0],
    lastName: displayName.split(" ").slice(1).join(" ") || "",
    gender: npc.gender,
    sex: npc.gender,
    race: npc.race,
    isFemale,
    subjectivePronoun: isFemale ? "she" : "he",
    objectivePronoun: isFemale ? "her" : "him",
    possessiveAdjective: isFemale ? "her" : "his",
    reflexivePronoun: isFemale ? "herself" : "himself",
    level: enriched.level,
    class: enriched.class,
    health: enriched.health,
    maxHealth: enriched.health,
    magicka: enriched.magicka,
    maxMagicka: enriched.magicka,
    stamina: enriched.stamina,
    maxStamina: enriched.stamina,
    isInCombat: false,
    isDead: false,
    isVirtual: npc.isVirtual || false,
    isVirtualPrivate: npc.isVirtualPrivate || false,
    universalTranslatorSpeechPattern: "",
    distance: npc.distance || 200,
    isFollowing: false,
    isGuard: enriched.isGuard,
    isEssential: enriched.isEssential,
    isBusy: false,
    isHostile: false,
    gold: enriched.gold,
    furniture: "None",
    voiceType: enriched.voiceType,
    // Collections
    factions: enriched.factions as unknown as InjaValue,
    keywords: enriched.keywords as unknown as InjaValue,
    skills: enriched.skills as unknown as InjaValue,
    // Flat skill properties for template compatibility
    oneHanded: enriched.skills.OneHanded ?? 20,
    twoHanded: enriched.skills.TwoHanded ?? 15,
    marksman: enriched.skills.Marksman ?? 15,
    block: enriched.skills.Block ?? 15,
    smithing: enriched.skills.Smithing ?? 15,
    heavyArmor: enriched.skills.HeavyArmor ?? 15,
    lightArmor: enriched.skills.LightArmor ?? 20,
    pickpocket: enriched.skills.Pickpocket ?? 15,
    lockpicking: enriched.skills.Lockpicking ?? 15,
    sneak: enriched.skills.Sneak ?? 15,
    alchemy: enriched.skills.Alchemy ?? 15,
    speech: enriched.skills.Speech ?? 20,
    alteration: enriched.skills.Alteration ?? 15,
    conjuration: enriched.skills.Conjuration ?? 15,
    destruction: enriched.skills.Destruction ?? 15,
    illusion: enriched.skills.Illusion ?? 15,
    restoration: enriched.skills.Restoration ?? 15,
    enchanting: enriched.skills.Enchanting ?? 15,
  };

  return { npcObj, enriched };
}

// --- Event array builder ---

export function buildEventArray(
  chatHistory: ChatEntry[],
  playerUUID: string,
  location: string,
  baseGameTimeNumeric: number,
  gameTimeStr: string,
  npcMap: Map<string, Record<string, InjaValue>>
): InjaValue[] {
  const events: InjaValue[] = [];
  let timeOffset = 0;

  for (const entry of chatHistory) {
    // Derive a pseudo game-time that increments slightly per event
    const eventTimeNumeric = baseGameTimeNumeric + timeOffset;
    timeOffset += 1;
    const eventHour = Math.floor(eventTimeNumeric / 60) % 24;
    const eventMin = eventTimeNumeric % 60;
    const dispHour = eventHour === 0 ? 12 : eventHour > 12 ? eventHour - 12 : eventHour;
    const ampm = eventHour >= 12 ? "PM" : "AM";
    const eventGameTimeStr = `${dispHour}:${eventMin.toString().padStart(2, "0")} ${ampm}`;

    let type: string;
    let originatingActor = "";
    let targetActor = "";
    let data: Record<string, InjaValue> = {};

    if (entry.type === "player") {
      type = "dialogue_player_text";
      originatingActor = playerUUID;
      // Resolve target: look up NPC by name, fall back to empty
      const targetName = entry.target || "";
      if (targetName === "Player" || targetName === entry.speaker) {
        targetActor = "";
      } else {
        const targetNpc = [...npcMap.entries()].find(
          ([, v]) => v.name === targetName
        );
        targetActor = targetNpc ? String(targetNpc[0]) : "";
      }
      data = { speaker: entry.speaker || "Player", text: entry.content };
    } else if (entry.type === "npc") {
      type = "dialogue";
      // Find UUID from npc name
      const npcEntry = [...npcMap.entries()].find(
        ([, v]) => v.name === entry.speaker
      );
      originatingActor = npcEntry ? String(npcEntry[0]) : "";
      // Resolve target: "Player" → playerUUID, NPC name → NPC UUID, else playerUUID
      const targetName = entry.target || "";
      if (targetName === "Player") {
        targetActor = playerUUID;
      } else if (targetName) {
        const targetNpc = [...npcMap.entries()].find(
          ([, v]) => v.name === targetName
        );
        targetActor = targetNpc ? String(targetNpc[0]) : playerUUID;
      } else {
        targetActor = playerUUID;
      }
      data = { speaker: entry.speaker || "NPC", text: entry.content };
    } else if (entry.type === "narration") {
      type = entry.gmAction === "Narrate" ? "gamemaster_dialogue" : "direct_narration";
      data = { text: entry.content };
    } else {
      // system messages — GM directives become gamemaster_dialogue events
      type = entry.gmAction ? "gamemaster_dialogue" : "system";
      data = { text: entry.content };
    }

    events.push({
      type,
      gameTime: eventTimeNumeric,
      gameTimeStr: eventGameTimeStr,
      originatingActor,
      targetActor,
      location,
      data,
    } as unknown as InjaValue);
  }

  return events;
}

// --- Game event converters ---

/**
 * Convert a SimulatedEvent from the trigger store into a structured event
 * object matching the format used by SkyrimNet's event history system.
 */
function convertGameEvent(
  event: SimulatedEvent,
  playerUUID: string,
  location: string,
  baseGameTimeNumeric: number,
  timeOffset: number
): Record<string, InjaValue> {
  const eventTimeNumeric = baseGameTimeNumeric + timeOffset;
  const eventHour = Math.floor(eventTimeNumeric / 60) % 24;
  const eventMin = eventTimeNumeric % 60;
  const dispHour = eventHour === 0 ? 12 : eventHour > 12 ? eventHour - 12 : eventHour;
  const ampm = eventHour >= 12 ? "PM" : "AM";
  const eventGameTimeStr = `${dispHour}:${eventMin.toString().padStart(2, "0")} ${ampm}`;

  // Map TriggerEventType to SkyrimNet event types
  // SkyrimNet uses shorter type names internally (e.g. "spell", "hit", "combat")
  const TYPE_MAP: Record<string, string> = {
    spell_cast: "spell",
    combat: "combat",
    death: "death",
    equip: "equip",
    activation: "activation",
    hit: "hit",
    book_read: "book_read",
    quest_stage: "quest_stage",
    location_change: "location_change",
    shout_cast: "shout",
    item_pickup: "item_pickup",
    skill_increase: "skill_increase",
  };

  const type = TYPE_MAP[event.eventType] || event.eventType;

  // Build data object from event fields
  const data: Record<string, InjaValue> = { ...event.fields } as Record<string, InjaValue>;

  // Build a human-readable text summary for format_event fallback
  data.text = formatGameEventText(event);

  // Determine originating actor (player for most simulated events)
  let originatingActor = playerUUID;
  let targetActor = "";

  // For hit/death events, the target field may reference another actor
  if (event.eventType === "hit" && event.fields.target) {
    // Player hits target
    targetActor = String(event.fields.target);
  } else if (event.eventType === "death") {
    // Something died
    originatingActor = String(event.fields.victim || playerUUID);
  }

  return {
    type,
    gameTime: eventTimeNumeric,
    gameTimeStr: eventGameTimeStr,
    originatingActor,
    targetActor,
    location,
    data,
  };
}

/**
 * Generate a human-readable text description for a game event,
 * used by format_event when rendering in templates.
 */
function formatGameEventText(event: SimulatedEvent): string {
  const f = event.fields;
  switch (event.eventType) {
    case "spell_cast":
      return `Cast ${f.spell || "a spell"}${f.school ? ` (${f.school})` : ""}${f.target && f.target !== "self" ? ` at ${f.target}` : ""}`;
    case "hit":
      return `Hit ${f.target || "target"} with ${f.weapon || "a weapon"}${f.damage ? ` for ${f.damage} damage` : ""}`;
    case "combat":
      return `${f.state === "enter" ? "Entered" : f.state === "exit" ? "Left" : String(f.state || "In")} combat${f.enemy ? ` with ${f.enemy}` : ""}`;
    case "death":
      return `${f.victim || "Someone"} died${f.cause ? ` from ${f.cause}` : ""}`;
    case "equip":
      return `Equipped ${f.item || "an item"}${f.slot ? ` in ${f.slot}` : ""}`;
    case "activation":
      return `Activated ${f.object || "an object"}${f.type ? ` (${f.type})` : ""}`;
    case "book_read":
      return `Read "${f.title || "a book"}"${f.type && f.type !== "normal" ? ` (${f.type})` : ""}`;
    case "quest_stage":
      return `Quest ${f.quest || "unknown"} advanced to stage ${f.stage || "?"}`;
    case "location_change":
      return `Moved from ${f.from || "?"} to ${f.to || "?"}`;
    case "shout_cast":
      return `Used ${f.shout || "a shout"}${f.words ? ` (${f.words} word${Number(f.words) !== 1 ? "s" : ""})` : ""}`;
    case "item_pickup":
      return `Picked up ${f.item || "an item"}${f.type ? ` (${f.type})` : ""}`;
    case "skill_increase":
      return `${f.skill || "Skill"} increased to ${f.level || "?"}`;
    default:
      return Object.entries(f).filter(([, v]) => v !== "").map(([k, v]) => `${k}=${v}`).join(", ");
  }
}

/**
 * Build short-lived events from recent game events.
 * These appear in scene_context_full.prompt via get_active_short_lived_events().
 */
function buildShortLivedEvents(
  gameEvents: SimulatedEvent[],
  playerUUID: string,
  location: string,
  baseGameTimeNumeric: number
): InjaValue[] {
  return gameEvents.map((event, i) => {
    const structured = convertGameEvent(event, playerUUID, location, baseGameTimeNumeric, i);
    return {
      ...structured,
      source_uuid: structured.originatingActor,
      entity: structured.originatingActor,
      timestamp: event.timestamp,
    } as unknown as InjaValue;
  });
}

// --- Master builder ---

export interface BuildSimStateParams {
  npc?: NpcConfig;
  player?: Partial<PlayerConfig>;
  scene: SceneConfig;
  selectedNpcs: NpcConfig[];
  chatHistory: ChatEntry[];
  eligibleActions?: { name: string; description: string; parameterSchema?: string }[];
  dialogueRequest?: string;
  dialogueResponse?: string;
  renderMode?: string;
  // Target selection
  responseTarget?: { type: string; UUID: string } | null;
  triggeringEvent?: Record<string, InjaValue> | null;
  crosshairTarget?: Record<string, InjaValue> | null;
  // Speaker prediction
  lastSpeaker?: string;
  candidateDialogues?: InjaValue[];
  // GM
  scenePlan?: unknown;
  isContinuousMode?: boolean;
  // Game events from trigger store
  gameEvents?: SimulatedEvent[];
  // Custom
  customVariables?: Record<string, InjaValue>;
}

export function buildFullSimulationState(params: BuildSimStateParams): SimulationState {
  const {
    npc,
    player,
    scene,
    selectedNpcs,
    chatHistory,
    eligibleActions = [],
    dialogueRequest = "",
    dialogueResponse = "",
    renderMode = "full",
    responseTarget = null,
    triggeringEvent = null,
    crosshairTarget = null,
    lastSpeaker,
    candidateDialogues,
    scenePlan = null,
    isContinuousMode = false,
    gameEvents = [],
    customVariables = {},
  } = params;

  const playerObj = buildPlayerObject(player);
  const playerUUID = playerObj.UUID;

  // Build NPC objects with enrichment
  const npcMap = new Map<string, Record<string, InjaValue>>();
  const enrichedNpcMap = new Map<string, EnrichedNpc>();
  for (const n of selectedNpcs) {
    const { npcObj, enriched } = buildNpcObject(n, scene, selectedNpcs);
    npcMap.set(n.uuid, npcObj);
    enrichedNpcMap.set(n.uuid, enriched);
  }

  // Primary NPC
  let primaryNpc: Record<string, InjaValue>;
  if (npc) {
    const { npcObj, enriched } = buildNpcObject(npc, scene, selectedNpcs);
    primaryNpc = npcObj;
    enrichedNpcMap.set(npc.uuid, enriched);
  } else if (selectedNpcs.length > 0) {
    primaryNpc = npcMap.get(selectedNpcs[0].uuid) || buildNpcObject(selectedNpcs[0], scene, selectedNpcs).npcObj;
  } else {
    primaryNpc = { name: "NPC", UUID: "npc_001", gender: "Unknown", race: "Unknown" };
  }

  // Nearby NPCs (all selected minus the primary)
  const primaryUuid = npc?.uuid || selectedNpcs[0]?.uuid;
  const nearbyNpcs = selectedNpcs
    .filter((n) => n.uuid !== primaryUuid)
    .map((n) => npcMap.get(n.uuid) || buildNpcObject(n, scene, selectedNpcs).npcObj) as InjaValue[];

  // Derive time, weather, location
  const time = deriveGameTime(scene.timeOfDay || "Afternoon");
  const weather = deriveWeather(scene.weather || "Clear");
  const enrichedLoc = enrichLocation(scene.location);

  // Build event array from chat history
  const chatEvents = buildEventArray(
    chatHistory,
    playerUUID,
    scene.location,
    time.gameTimeNumeric,
    time.gameTime,
    npcMap
  );

  // Convert game events into structured event objects and merge by timestamp
  const structuredGameEvents = gameEvents.map((evt, i) =>
    convertGameEvent(evt, playerUUID, scene.location, time.gameTimeNumeric, chatEvents.length + i) as unknown as InjaValue
  );
  const recentEventsArray = [...chatEvents, ...structuredGameEvents];

  // Build short-lived events for scene context (recent game events only)
  const shortLivedEvents = buildShortLivedEvents(
    gameEvents,
    playerUUID,
    scene.location,
    time.gameTimeNumeric
  );

  // Build event history as string (legacy fallback)
  const recentEvents = chatHistory
    .map((e) => {
      if (e.type === "player") return `${playerObj.name}: ${e.content}`;
      if (e.type === "npc") return `${e.speaker}: ${e.content}`;
      if (e.type === "narration") return `*${e.content}*`;
      return e.content;
    })
    .join("\n");

  // Actions
  const actions = eligibleActions.map((a) => ({
    name: a.name,
    description: a.description,
    parameterSchema: a.parameterSchema || "",
  })) as InjaValue[];

  // Location object for GM templates
  const locationObject: Record<string, InjaValue> = {
    name: scene.location,
    description: scene.scenePrompt || "",
  };

  // Scene context string
  const sceneContext = [scene.worldPrompt, scene.scenePrompt].filter(Boolean).join("\n");

  // Candidate dialogues (for speaker/target selectors)
  const candidateDialoguesFinal = candidateDialogues ?? selectedNpcs.map((n, i) => ({
    id: i + 1,
    name: n.displayName || n.name,
    UUID: n.uuid,
    gender: n.gender,
    race: n.race,
    distance: n.distance || 200,
  })) as InjaValue[];

  // Scene plan — ensure beat index fields have defaults so templates
  // don't render "NaN" when current_beat_index is missing
  let scenePlanObj = scenePlan
    ? (typeof scenePlan === "string" ? JSON.parse(scenePlan) : scenePlan)
    : null;
  if (scenePlanObj) {
    const beats = Array.isArray(scenePlanObj.beats) ? scenePlanObj.beats : [];
    if (scenePlanObj.current_beat_index === undefined || scenePlanObj.current_beat_index === null) {
      scenePlanObj = { ...scenePlanObj, current_beat_index: 0 };
    }
    if (scenePlanObj.total_beats === undefined || scenePlanObj.total_beats === null) {
      scenePlanObj = { ...scenePlanObj, total_beats: beats.length || 1 };
    }
    // Also ensure current_beat exists for templates that reference it
    if (!scenePlanObj.current_beat && beats.length > 0) {
      const idx = Math.min(scenePlanObj.current_beat_index, beats.length - 1);
      scenePlanObj = { ...scenePlanObj, current_beat: beats[idx] };
    }
  }

  return {
    npc: primaryNpc,
    player: playerObj,
    location: scene.location,
    sceneContext,
    recentEvents,
    relevantMemories: "",
    nearbyNpcs,
    eligibleActions: actions,
    dialogueRequest,
    dialogueResponse,
    lastSpeaker: { name: lastSpeaker || "" },
    candidateDialogues: candidateDialoguesFinal,
    renderMode,
    structuredJsonActions: false,
    customVariables,
    // New fields
    recentEventsArray,
    responseTarget: responseTarget as Record<string, InjaValue> | null,
    triggeringEvent: triggeringEvent as Record<string, InjaValue> | null,
    crosshairTarget: crosshairTarget as Record<string, InjaValue> | null,
    embedActionsInDialogue: false,
    promptForDialogue: dialogueRequest,
    gameTime: time.gameTime,
    gameTimeJson: time.gameTimeJson,
    gameTimeNumeric: time.gameTimeNumeric,
    timeDesc: time.time_desc,
    currentWeather: weather.currentWeather,
    isIndoors: enrichedLoc.isIndoors,
    locationObject,
    shortLivedEvents,
    scenePlan: scenePlanObj as Record<string, InjaValue> | null,
    isContinuousMode,
    hasScenePlan: !!scenePlanObj,
    enrichedNpcMap,
  };
}
