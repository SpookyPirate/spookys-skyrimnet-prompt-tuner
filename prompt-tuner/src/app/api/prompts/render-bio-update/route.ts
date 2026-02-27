import { NextRequest, NextResponse } from "next/server";
import { assemblePrompt } from "@/lib/pipeline/assembler";
import { resolvePromptSetBase } from "@/lib/files/paths";
import { buildFullSimulationState, deriveGameTime } from "@/lib/pipeline/build-sim-state";
import { createFileLoader, readTemplate } from "@/lib/pipeline/file-loader-factory";
import type { InjaValue } from "@/lib/inja/renderer";

const ALL_UPDATABLE_BLOCKS = [
  "name",
  "appearance",
  "personality",
  "background",
  "current_status",
  "relationships",
  "skills_and_abilities",
  "speech_style",
  "goals_and_motivations",
  "notes",
];

/**
 * Render the dynamic_bio_update.prompt template for a single NPC.
 * POST body: { npc, player, scene, selectedNpcs, chatHistory, gameEvents?, promptSetBase? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      npc,
      player,
      scene,
      selectedNpcs = [],
      chatHistory = [],
      gameEvents = [],
      promptSetBase,
    } = body;

    const baseDir = resolvePromptSetBase(promptSetBase);
    const fileLoader = createFileLoader(baseDir);

    let templateSource: string;
    try {
      templateSource = await readTemplate(baseDir, "dynamic_bio_update.prompt");
    } catch {
      return NextResponse.json(
        { error: "Template not found: dynamic_bio_update.prompt" },
        { status: 404 }
      );
    }

    const targetNpc = npc || selectedNpcs[0];
    const time = deriveGameTime(scene?.timeOfDay || "Afternoon");

    // Build the actor object matching the format templates expect
    const actor: Record<string, InjaValue> = {
      displayName: (targetNpc?.displayName || targetNpc?.name || "NPC") as InjaValue,
      name: (targetNpc?.displayName || targetNpc?.name || "NPC") as InjaValue,
      level: (targetNpc?.level || 10) as InjaValue,
      race: (targetNpc?.race || "Nord") as InjaValue,
      sex: (targetNpc?.gender || "Male") as InjaValue,
      gender: (targetNpc?.gender || "Male") as InjaValue,
      UUID: (targetNpc?.uuid || "npc_001") as InjaValue,
    };

    const simState = buildFullSimulationState({
      npc: targetNpc,
      player,
      scene: scene || { location: "Whiterun", weather: "Clear", timeOfDay: "Afternoon", worldPrompt: "", scenePrompt: "" },
      selectedNpcs,
      chatHistory,
      gameEvents,
      renderMode: "full",
      customVariables: {
        actor: actor as unknown as InjaValue,
        currentGameTime: time.gameTime as InjaValue,
        factions: [] as unknown as InjaValue,
        recentMemories: [] as unknown as InjaValue,
        originalBioContent: "" as InjaValue,
        currentDynamicContent: "" as InjaValue,
        updatableBlocks: ALL_UPDATABLE_BLOCKS as unknown as InjaValue,
        preserveCorePersonality: true as InjaValue,
      },
    });

    const result = await assemblePrompt(templateSource, simState, fileLoader);

    return NextResponse.json({
      messages: result.messages,
      renderedText: result.renderedText,
    });
  } catch (error) {
    console.error("Render bio-update error:", error);
    return NextResponse.json(
      { error: `Render failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
