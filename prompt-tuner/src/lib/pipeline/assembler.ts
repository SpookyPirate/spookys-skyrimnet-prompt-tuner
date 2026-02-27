import { render, extractBlocks, type RenderContext, type InjaValue } from "@/lib/inja/renderer";
import { parseSections } from "./section-parser";
import type { ChatMessage } from "@/types/llm";

export interface FileLoader {
  readFile: (path: string) => Promise<string>;
  listDir: (path: string) => Promise<string[]>;
}

export interface SimulationState {
  npc: Record<string, InjaValue>;
  player: Record<string, InjaValue>;
  location: string;
  sceneContext: string;
  recentEvents: string;
  relevantMemories: string;
  nearbyNpcs: InjaValue[];
  eligibleActions: InjaValue[];
  dialogueRequest: string;
  dialogueResponse: string;
  lastSpeaker: Record<string, InjaValue>;
  candidateDialogues: InjaValue[];
  renderMode: string;
  structuredJsonActions: boolean;
  customVariables: Record<string, InjaValue>;
  // New fields
  recentEventsArray: InjaValue[];
  responseTarget: Record<string, InjaValue> | null;
  triggeringEvent: Record<string, InjaValue> | null;
  crosshairTarget: Record<string, InjaValue> | null;
  embedActionsInDialogue: boolean;
  promptForDialogue: string;
  gameTime: string;
  gameTimeJson: Record<string, InjaValue>;
  gameTimeNumeric: number;
  timeDesc: string;
  currentWeather: Record<string, InjaValue>;
  isIndoors: boolean;
  locationObject: Record<string, InjaValue>;
  shortLivedEvents: InjaValue[];
  scenePlan: Record<string, InjaValue> | null;
  isContinuousMode: boolean;
  hasScenePlan: boolean;
}

/**
 * Build the full set of context variables from SimulationState.
 * Shared between assemblePrompt and inner template rendering.
 */
function buildContextVariables(simState: SimulationState): Record<string, InjaValue> {
  return {
    npc: simState.npc,
    player: simState.player,
    location: simState.location,
    dialogue_request: simState.dialogueRequest,
    dialogue_response: simState.dialogueResponse,
    lastSpeaker: simState.lastSpeaker,
    candidateDialogues: simState.candidateDialogues,
    eligible_actions: simState.eligibleActions,
    render_mode: simState.renderMode,
    structured_json_actions: simState.structuredJsonActions,
    actorUUID: (simState.npc as Record<string, InjaValue>)?.UUID ?? "",
    // New context variables
    responseTarget: simState.responseTarget,
    triggeringEvent: simState.triggeringEvent,
    crosshairTarget: simState.crosshairTarget,
    embed_actions_in_dialogue: simState.embedActionsInDialogue,
    promptForDialogue: simState.promptForDialogue,
    gameTime: simState.gameTime,
    gameTimeJson: simState.gameTimeJson,
    gameTimeNumeric: simState.gameTimeNumeric,
    time_desc: simState.timeDesc,
    currentWeather: simState.currentWeather,
    is_indoors: simState.isIndoors,
    sceneContext: simState.sceneContext,
    locationObject: simState.locationObject,
    location_object: simState.locationObject,
    scene: {
      short_lived_events: simState.shortLivedEvents,
    } as unknown as InjaValue,
    scene_plan: simState.scenePlan,
    is_continuous_mode: simState.isContinuousMode,
    has_scene_plan: simState.hasScenePlan,
    isTimePaused: false,
    ...simState.customVariables,
  };
}

/**
 * Assemble a prompt through the full Inja pipeline.
 * Renders the template, resolves all decorators, and returns LLM messages.
 */
export async function assemblePrompt(
  templateSource: string,
  simState: SimulationState,
  fileLoader: FileLoader,
  characterBlocks?: Record<string, string>
): Promise<{ messages: ChatMessage[]; renderedText: string }> {
  const ctx: RenderContext = {
    variables: buildContextVariables(simState),
    blocks: characterBlocks || {},
    functions: buildDecoratorFunctions(simState, fileLoader),
  };

  const renderedText = await render(templateSource, ctx);
  const messages = parseSections(renderedText);

  return { messages, renderedText };
}

// --- Helper: resolve an actor by UUID ---

function resolveActor(uuid: InjaValue, simState: SimulationState): Record<string, InjaValue> | null {
  const id = String(uuid);
  if (id === simState.player?.UUID) return simState.player as Record<string, InjaValue>;
  if (id === (simState.npc as Record<string, InjaValue>)?.UUID) return simState.npc as Record<string, InjaValue>;
  for (const nearby of simState.nearbyNpcs) {
    if (nearby && typeof nearby === "object" && (nearby as Record<string, InjaValue>).UUID === id) {
      return nearby as Record<string, InjaValue>;
    }
  }
  return null;
}

const BASE_GAME_PLUGINS = new Set([
  "Skyrim.esm", "Update.esm", "Dawnguard.esm", "HearthFires.esm", "Dragonborn.esm",
]);

/**
 * Build all decorator functions for the simulation.
 */
function buildDecoratorFunctions(
  simState: SimulationState,
  fileLoader: FileLoader
): Record<string, (...args: InjaValue[]) => InjaValue | Promise<InjaValue>> {
  return {
    // ===== Core NPC/Actor decorators =====

    decnpc: (uuid: InjaValue) => {
      const actor = resolveActor(uuid, simState);
      if (actor) return actor;
      return { name: `NPC(${uuid})`, gender: "Unknown", race: "Unknown" };
    },

    isValidActor: (uuid: InjaValue) => {
      const id = String(uuid);
      if (!id || id === "0" || id === "") return false;
      return resolveActor(uuid, simState) !== null;
    },

    get_name: (uuid: InjaValue) => {
      const actor = resolveActor(uuid, simState);
      if (actor) return String(actor.name || "Unknown");
      return `NPC(${uuid})`;
    },

    get_location: (..._args: InjaValue[]) => {
      // In real SkyrimNet, returns the location of a specific actor by UUID.
      // In simulation, all actors share the same location.
      return simState.location;
    },

    is_player: (uuid: InjaValue) => {
      return String(uuid) === String(simState.player?.UUID);
    },

    is_in_combat: (uuid: InjaValue) => {
      const actor = resolveActor(uuid, simState);
      if (actor) return !!actor.isInCombat;
      return false;
    },

    get_actor_value: (uuid: InjaValue, stat: InjaValue) => {
      const actor = resolveActor(uuid, simState);
      if (!actor) return 0;
      const statName = String(stat);
      // Check direct properties
      if (statName in actor) return actor[statName] ?? 0;
      // Check skills sub-object
      const skills = actor.skills;
      if (skills && typeof skills === "object" && !Array.isArray(skills)) {
        return (skills as Record<string, InjaValue>)[statName] ?? 0;
      }
      return 0;
    },

    get_base_actor_value: () => 100,

    // ===== Scene & Context =====

    get_scene_context: async (...args: InjaValue[]) => {
      // Real signature: get_scene_context(sourceUUID, targetUUID, variant?)
      // e.g. get_scene_context(npc.UUID, responseTarget.UUID, "full")
      try {
        const sourceUUID = args[0] || null;
        const targetUUID = (args[1] && args[1] !== 0 && args[1] !== "0") ? args[1] : null;
        const variant = typeof args[2] === "string" ? args[2]
          : typeof args[0] === "string" && ["full", "target_selection"].includes(String(args[0])) ? String(args[0])
          : "";

        // Resolve source/target actors for template context
        const sourceEntity = sourceUUID ? resolveActor(sourceUUID, simState) : null;
        const targetEntity = targetUUID ? resolveActor(targetUUID, simState) : null;

        // Load the content template (provides block definitions)
        const contentSource = await fileLoader.readFile("components/context/scene_context.prompt");
        const blocks = extractBlocks(contentSource);

        // Load the layout template if a variant is specified
        let layoutSource: string;
        if (variant) {
          try {
            layoutSource = await fileLoader.readFile(`components/context/scene_context_${variant}.prompt`);
          } catch {
            // Variant not found — render the content template directly
            layoutSource = contentSource;
          }
        } else {
          layoutSource = contentSource;
        }

        const innerVars: Record<string, InjaValue> = {
          ...buildContextVariables(simState),
          sourceEntity: (sourceEntity || null) as unknown as InjaValue,
          targetEntity: (targetEntity || null) as unknown as InjaValue,
        };
        const innerCtx: RenderContext = {
          variables: innerVars,
          blocks,
          functions: buildDecoratorFunctions(simState, fileLoader),
        };
        return await render(layoutSource, innerCtx);
      } catch {
        // Fallback: return structured scene context with key info
        const parts: string[] = [];
        parts.push(`## Current Location\nThe scene is taking place in **${simState.location}**`);
        parts.push(`## Current Time\n**Time**: ${simState.gameTime}\n- ${simState.timeDesc}`);
        const weatherName = simState.currentWeather?.name || "Clear";
        parts.push(`## Current Weather\n**Weather**: ${weatherName}`);
        if (simState.sceneContext) {
          parts.push(`## Scene\n${simState.sceneContext}`);
        }
        return parts.join("\n\n");
      }
    },

    get_recent_events: (...args: InjaValue[]) => {
      // If we have structured events, return them filtered
      if (simState.recentEventsArray && simState.recentEventsArray.length > 0) {
        const count = typeof args[0] === "number" ? args[0] : 20;
        const filterUUID = typeof args[1] === "string" ? args[1] : null;

        let events = simState.recentEventsArray;
        if (filterUUID) {
          events = events.filter((e) => {
            if (!e || typeof e !== "object") return false;
            const ev = e as Record<string, InjaValue>;
            return ev.originatingActor === filterUUID || ev.targetActor === filterUUID;
          });
        }
        return events.slice(-count);
      }
      return simState.recentEvents || "";
    },

    get_relevant_memories: () => {
      return simState.relevantMemories || "";
    },

    get_nearby_npc_list: () => {
      return simState.nearbyNpcs;
    },

    get_event_history_count: () => 20,

    // ===== Event formatting =====

    format_event: (event: InjaValue, format?: InjaValue) => {
      if (!event || typeof event !== "object") return "";
      const ev = event as Record<string, InjaValue>;
      const type = String(ev.type || "");
      const data = ev.data as Record<string, InjaValue> | undefined;
      if (!data) return "";

      const fmt = String(format || "verbose");

      // Dialogue events — return text only; the event_history template
      // already prepends get_name(actor) before calling format_event()
      if (type === "dialogue" || type === "dialogue_player_text") {
        return String(data.text || "");
      }
      if (type === "gamemaster_dialogue" || type === "direct_narration") {
        return `*${data.text}*`;
      }

      // Game events — use the pre-built text description from data.text
      // These types come from convertGameEvent() in build-sim-state.ts
      const GAME_EVENT_TYPES = new Set([
        "spell", "hit", "combat", "death", "equip", "activation",
        "book_read", "quest_stage", "location_change", "shout",
        "item_pickup", "skill_increase",
      ]);

      if (GAME_EVENT_TYPES.has(type)) {
        if (fmt === "recent_events" || fmt === "compact") {
          return String(data.text || "");
        }
        // verbose: include type label
        return `[${type}] ${data.text || ""}`;
      }

      return `[${type}] ${data.text || ""}`;
    },

    // ===== Actions =====

    is_action_enabled: (actionName: InjaValue) => {
      const name = String(actionName);
      if (!Array.isArray(simState.eligibleActions)) return false;
      return simState.eligibleActions.some((a) => {
        if (a && typeof a === "object") {
          return (a as Record<string, InjaValue>).name === name;
        }
        return false;
      });
    },

    is_narration_enabled: () => true,

    // ===== Template rendering =====

    render_template: async (path: InjaValue) => {
      try {
        const filePath = String(path).replace(/\\/g, "/");
        const source = await fileLoader.readFile(filePath + ".prompt");
        const innerCtx: RenderContext = {
          variables: buildContextVariables(simState),
          blocks: {},
          functions: buildDecoratorFunctions(simState, fileLoader),
        };
        return await render(source, innerCtx);
      } catch {
        return `[render_template: ${path} not found]`;
      }
    },

    render_subcomponent: async (name: InjaValue, mode?: InjaValue) => {
      try {
        const dirPath = `submodules/${name}`;
        const files = await fileLoader.listDir(dirPath);
        const promptFiles = files
          .filter((f) => f.endsWith(".prompt"))
          .sort();

        const parts: string[] = [];
        for (const file of promptFiles) {
          const source = await fileLoader.readFile(`${dirPath}/${file}`);
          const overrides: Record<string, InjaValue> = {};
          if (mode !== undefined) overrides.render_mode = mode;
          const innerCtx: RenderContext = {
            variables: { ...buildContextVariables(simState), ...overrides },
            blocks: {},
            functions: buildDecoratorFunctions(simState, fileLoader),
          };
          const rendered = await render(source, innerCtx);
          if (rendered.trim()) parts.push(rendered);
        }
        return parts.join("\n");
      } catch {
        return `[render_subcomponent: ${name} not found]`;
      }
    },

    render_character_profile: async (mode: InjaValue, uuid: InjaValue) => {
      try {
        const charSource = await fileLoader.readFile(`characters/${uuid}.prompt`);
        const blocks = extractBlocks(charSource);

        const bioDir = "submodules/character_bio";
        const bioFiles = await fileLoader.listDir(bioDir);
        const promptFiles = bioFiles
          .filter((f) => f.endsWith(".prompt"))
          .sort();

        const parts: string[] = [];
        for (const file of promptFiles) {
          const bioSource = await fileLoader.readFile(`${bioDir}/${file}`);
          const innerCtx: RenderContext = {
            variables: {
              ...buildContextVariables(simState),
              render_mode: mode ?? "full",
              actorUUID: uuid ?? "",
            },
            blocks,
            functions: buildDecoratorFunctions(simState, fileLoader),
          };
          const rendered = await render(bioSource, innerCtx);
          if (rendered.trim()) parts.push(rendered);
        }
        return parts.join("\n");
      } catch {
        return `[character profile: ${uuid} not found]`;
      }
    },

    prompt_file_exists: async (name: InjaValue, dir?: InjaValue) => {
      try {
        const filePath = dir ? `${dir}/${name}.prompt` : `${name}.prompt`;
        await fileLoader.readFile(filePath);
        return true;
      } catch {
        return false;
      }
    },

    // ===== Distance & conversion =====

    units_to_meters: (units: InjaValue) => {
      if (typeof units === "number") {
        return Math.round(units * 0.01428);
      }
      return units;
    },

    distance_between: () => 200,
    has_line_of_sight: () => true,

    // ===== Combat & status =====

    is_summoned: () => false,
    is_reanimated: () => false,
    is_hostile_to_actor: () => false,
    has_weapon_drawn: () => false,
    is_knocked_down: () => false,
    is_follower: () => false,
    is_sneaking: () => false,
    is_sprinting: () => false,
    is_swimming: () => false,
    is_unconscious: () => false,

    // ===== Equipment & inventory =====

    get_worn_equipment: () => ({}),
    get_inventory: () => ({}),
    get_merchant_inventory: () => ({ isMerchant: false }),
    worn_has_keyword: () => false,

    // ===== Keywords & factions =====

    actor_has_keyword: () => false,
    is_in_faction: () => false,
    get_faction_rank: () => -1,
    get_relationship_rank: () => 0,
    get_crime_gold: () => ({ total: 0, violent: 0, nonViolent: 0 }),
    get_civil_war_side: () => "Neutral",

    // ===== Magic & perks =====

    has_magic_effect: () => false,
    has_spell: () => false,
    get_spell_list: () => [],
    has_perk: () => false,
    get_all_perks: () => [],

    // ===== Scene descriptions =====

    has_current_scene_description: () => !!simState.sceneContext,
    get_current_scene_description: () => simState.sceneContext || "",
    has_current_location_description: () => !!simState.locationObject?.description,
    get_current_location_description: () => String(simState.locationObject?.description || ""),
    is_scene_newer_than_location: () => true,

    // ===== Short-lived events =====

    get_short_lived_events_count: () => simState.shortLivedEvents.length,
    get_active_short_lived_events: () => simState.shortLivedEvents,
    get_short_lived_events_by_type: (type: InjaValue) => {
      const t = String(type);
      return simState.shortLivedEvents.filter((e) => {
        if (!e || typeof e !== "object") return false;
        return (e as Record<string, InjaValue>).type === t;
      });
    },
    get_short_lived_events_by_entity: (uuid: InjaValue) => {
      const id = String(uuid);
      return simState.shortLivedEvents.filter((e) => {
        if (!e || typeof e !== "object") return false;
        const ev = e as Record<string, InjaValue>;
        return ev.source_uuid === id || ev.originatingActor === id || ev.targetActor === id;
      });
    },

    // ===== Entity state tracking =====

    track_entity_state: () => ({ hasPrevious: false, changed: false }),

    // ===== Audio/TTS =====

    is_audio_tags_enabled: () => false,
    get_narrator_uuid: () => "",
    get_actor_tts: () => "",

    // ===== Quests =====

    get_all_active_quests: () => [],
    get_selected_quests: () => [],
    render_quest_template: () => "",
    is_quest_active: () => false,
    get_quest_stage: () => 0,

    // ===== System / environment =====

    is_first_person: () => true,
    is_vr: () => false,

    get_all_loaded_plugins: () => [
      "Skyrim.esm", "Update.esm", "Dawnguard.esm", "HearthFires.esm", "Dragonborn.esm",
    ],

    is_plugin_loaded: (name: InjaValue) => {
      return BASE_GAME_PLUGINS.has(String(name));
    },

    get_global_value: () => 0,
    get_form_name: () => "Item",
  };
}
