import { NextRequest, NextResponse } from "next/server";
import { assemblePrompt } from "@/lib/pipeline/assembler";
import { ORIGINAL_PROMPTS_DIR } from "@/lib/files/paths";
import { buildFullSimulationState } from "@/lib/pipeline/build-sim-state";
import { createFileLoader, readTemplate } from "@/lib/pipeline/file-loader-factory";
import type { InjaValue } from "@/lib/inja/renderer";

/**
 * Render the gamemaster_action_selector.prompt template.
 * POST body: { npcs, scene, chatHistory?, eventHistory?, scenePlan?, isContinuousMode?, promptSetBase?, player? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      npcs = [],
      scene,
      chatHistory = [],
      eventHistory,
      scenePlan,
      isContinuousMode,
      gameEvents = [],
      promptSetBase,
      player,
    } = body;

    const baseDir = promptSetBase || ORIGINAL_PROMPTS_DIR;
    const fileLoader = createFileLoader(baseDir);

    let templateSource: string;
    try {
      templateSource = await readTemplate(baseDir, "gamemaster_action_selector.prompt");
    } catch {
      return NextResponse.json(
        { error: "Template not found: gamemaster_action_selector.prompt" },
        { status: 404 }
      );
    }

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
      scenePlan: scenePlan || null,
      isContinuousMode: !!isContinuousMode,
      gameEvents,
      customVariables: eventHistory
        ? { event_history_string: eventHistory } as Record<string, InjaValue>
        : {},
    });

    const result = await assemblePrompt(templateSource, simState, fileLoader);

    return NextResponse.json({
      messages: result.messages,
      renderedText: result.renderedText,
    });
  } catch (error) {
    console.error("Render GM action selector error:", error);
    return NextResponse.json(
      { error: `Render failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
