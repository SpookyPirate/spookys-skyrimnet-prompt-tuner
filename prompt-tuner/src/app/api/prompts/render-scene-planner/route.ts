import { NextRequest, NextResponse } from "next/server";
import { assemblePrompt } from "@/lib/pipeline/assembler";
import { resolvePromptSetBase } from "@/lib/files/paths";
import { buildFullSimulationState } from "@/lib/pipeline/build-sim-state";
import { createFileLoader, readTemplate } from "@/lib/pipeline/file-loader-factory";

/**
 * Render the gamemaster_scene_planner.prompt template.
 * POST body: { npcs, scene, chatHistory?, eventHistory?, gameEvents?, promptSetBase?, player? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { npcs = [], scene, chatHistory = [], eventHistory, gameEvents = [], promptSetBase, player } = body;

    const baseDir = resolvePromptSetBase(promptSetBase);
    const fileLoader = createFileLoader(baseDir);

    let templateSource: string;
    try {
      templateSource = await readTemplate(baseDir, "gamemaster_scene_planner.prompt");
    } catch {
      return NextResponse.json(
        { error: "Template not found: gamemaster_scene_planner.prompt" },
        { status: 404 }
      );
    }

    // Map npcs to NpcConfig shape
    const selectedNpcs = npcs.map((n: Record<string, string | number>) => ({
      uuid: n.uuid || "unknown",
      name: String(n.name || n.displayName || "NPC"),
      displayName: String(n.displayName || n.name || "NPC"),
      gender: String(n.gender || "Unknown"),
      race: String(n.race || "Unknown"),
      distance: Number(n.distance || 200),
      filePath: "",
    }));

    const simState = buildFullSimulationState({
      player,
      scene: scene || { location: "Whiterun", weather: "Clear", timeOfDay: "Afternoon", worldPrompt: "", scenePrompt: "" },
      selectedNpcs,
      chatHistory,
      gameEvents,
      customVariables: eventHistory ? { event_history_string: eventHistory } : {},
    });

    const result = await assemblePrompt(templateSource, simState, fileLoader);

    return NextResponse.json({
      messages: result.messages,
      renderedText: result.renderedText,
    });
  } catch (error) {
    console.error("Render scene planner error:", error);
    return NextResponse.json(
      { error: `Render failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
