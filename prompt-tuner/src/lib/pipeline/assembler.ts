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
  // Build the render context with all variables and decorator functions
  const ctx: RenderContext = {
    variables: {
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
      ...simState.customVariables,
    },
    blocks: characterBlocks || {},
    functions: buildDecoratorFunctions(simState, fileLoader),
  };

  const renderedText = await render(templateSource, ctx);
  const messages = parseSections(renderedText);

  return { messages, renderedText };
}

/**
 * Build mock decorator functions for the simulation.
 */
function buildDecoratorFunctions(
  simState: SimulationState,
  fileLoader: FileLoader
): Record<string, (...args: InjaValue[]) => InjaValue | Promise<InjaValue>> {
  return {
    // NPC data accessor
    decnpc: (uuid: InjaValue) => {
      // In simulation, return mock NPC data based on UUID
      if (uuid === simState.player?.UUID) {
        return simState.player;
      }
      if (uuid === (simState.npc as Record<string, InjaValue>)?.UUID) {
        return simState.npc;
      }
      // Search nearby NPCs
      for (const nearby of simState.nearbyNpcs) {
        if (
          nearby &&
          typeof nearby === "object" &&
          (nearby as Record<string, InjaValue>).UUID === uuid
        ) {
          return nearby;
        }
      }
      return { name: `NPC(${uuid})`, gender: "Unknown", race: "Unknown" };
    },

    // Scene context
    get_scene_context: (...args: InjaValue[]) => {
      return simState.sceneContext || "";
    },

    // Event history
    get_recent_events: () => {
      return simState.recentEvents || "";
    },

    // Memories
    get_relevant_memories: () => {
      return simState.relevantMemories || "";
    },

    // Nearby NPC list
    get_nearby_npc_list: (_playerUUID: InjaValue) => {
      return simState.nearbyNpcs;
    },

    // Distance conversion
    units_to_meters: (units: InjaValue) => {
      if (typeof units === "number") {
        return Math.round(units * 0.01428); // Skyrim units to meters approximation
      }
      return units;
    },

    // Template rendering (loads and renders another .prompt file)
    render_template: async (path: InjaValue) => {
      try {
        const filePath = String(path).replace(/\\/g, "/");
        const source = await fileLoader.readFile(filePath + ".prompt");
        const innerCtx: RenderContext = {
          variables: {
            ...simState.customVariables,
            npc: simState.npc,
            player: simState.player,
            location: simState.location,
          },
          blocks: {},
          functions: buildDecoratorFunctions(simState, fileLoader),
        };
        return await render(source, innerCtx);
      } catch {
        return `[render_template: ${path} not found]`;
      }
    },

    // Subcomponent rendering (loads numbered files from submodule directory)
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
          const innerCtx: RenderContext = {
            variables: {
              ...simState.customVariables,
              npc: simState.npc,
              player: simState.player,
              render_mode: mode ?? simState.renderMode,
              actorUUID: (simState.npc as Record<string, InjaValue>)?.UUID ?? "",
            },
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

    // Character profile rendering with block inheritance
    render_character_profile: async (
      mode: InjaValue,
      uuid: InjaValue
    ) => {
      try {
        // Find the character file and extract blocks
        const charSource = await fileLoader.readFile(
          `characters/${uuid}.prompt`
        );
        const blocks = extractBlocks(charSource);

        // Load character_bio submodule files
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
              ...simState.customVariables,
              npc: simState.npc,
              player: simState.player,
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

    // Summoned/reanimated checks (always false in simulation by default)
    is_summoned: () => false,
    is_reanimated: () => false,
    is_hostile_to_actor: () => false,
  };
}
