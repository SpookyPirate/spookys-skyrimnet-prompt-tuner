import { NextRequest, NextResponse } from "next/server";
import { assemblePrompt } from "@/lib/pipeline/assembler";
import { resolvePromptSetBase } from "@/lib/files/paths";
import { buildFullSimulationState } from "@/lib/pipeline/build-sim-state";
import { createFileLoader, readTemplate } from "@/lib/pipeline/file-loader-factory";
import type { InjaValue } from "@/lib/inja/renderer";

/**
 * Render the memory/generate_memory.prompt template for a single NPC.
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
      templateSource = await readTemplate(baseDir, "memory/generate_memory.prompt");
    } catch {
      return NextResponse.json(
        { error: "Template not found: memory/generate_memory.prompt" },
        { status: 404 }
      );
    }

    // Build actors_involved from selectedNpcs + player
    const playerName = player?.name || "Player";
    const playerUUID = "player_001";
    const actorsInvolved: InjaValue[] = [
      {
        name: playerName,
        race: player?.race || "Nord",
        gender: player?.gender || "Male",
        is_main_actor: false,
        is_player: true,
        UUID: playerUUID,
      } as unknown as InjaValue,
      ...selectedNpcs.map((n: { displayName?: string; name: string; race: string; gender: string; uuid: string }) => ({
        name: n.displayName || n.name,
        race: n.race,
        gender: n.gender,
        is_main_actor: n.uuid === npc?.uuid,
        is_player: false,
        UUID: n.uuid,
      } as unknown as InjaValue)),
    ];

    const simState = buildFullSimulationState({
      npc: npc || selectedNpcs[0],
      player,
      scene: scene || { location: "Whiterun", weather: "Clear", timeOfDay: "Afternoon", worldPrompt: "", scenePrompt: "" },
      selectedNpcs,
      chatHistory,
      gameEvents,
      renderMode: "full",
      customVariables: {
        actor_name: (npc?.displayName || npc?.name || selectedNpcs[0]?.displayName || "NPC") as InjaValue,
        actor_uuid: (npc?.uuid || selectedNpcs[0]?.uuid || "npc_001") as InjaValue,
        current_location: (scene?.location || "Whiterun") as InjaValue,
        num_events: chatHistory.length as InjaValue,
        actors_involved: actorsInvolved as unknown as InjaValue,
      },
    });

    const result = await assemblePrompt(templateSource, simState, fileLoader);

    return NextResponse.json({
      messages: result.messages,
      renderedText: result.renderedText,
    });
  } catch (error) {
    console.error("Render memory-gen error:", error);
    return NextResponse.json(
      { error: `Render failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
