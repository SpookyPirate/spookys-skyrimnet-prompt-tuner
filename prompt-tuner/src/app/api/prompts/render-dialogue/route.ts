import { NextRequest, NextResponse } from "next/server";
import { assemblePrompt } from "@/lib/pipeline/assembler";
import { resolvePromptSetBase } from "@/lib/files/paths";
import { buildFullSimulationState } from "@/lib/pipeline/build-sim-state";
import { createFileLoader, readTemplate } from "@/lib/pipeline/file-loader-factory";

/**
 * Render the dialogue_response.prompt template.
 * POST body: { npc, player, scene, selectedNpcs, chatHistory, responseTarget?, eligibleActions?, promptSetBase? }
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
      responseTarget,
      eligibleActions = [],
      gameEvents = [],
      promptSetBase,
      dialogueRequest: bodyDialogueRequest,
    } = body;

    const baseDir = resolvePromptSetBase(promptSetBase);
    const fileLoader = createFileLoader(baseDir);

    let templateSource: string;
    try {
      templateSource = await readTemplate(baseDir, "dialogue_response.prompt");
    } catch {
      return NextResponse.json(
        { error: "Template not found: dialogue_response.prompt" },
        { status: 404 }
      );
    }

    const simState = buildFullSimulationState({
      npc: npc || selectedNpcs[0],
      player,
      scene: scene || { location: "Whiterun", weather: "Clear", timeOfDay: "Afternoon", worldPrompt: "", scenePrompt: "" },
      selectedNpcs,
      chatHistory,
      eligibleActions,
      dialogueRequest: bodyDialogueRequest || "",
      responseTarget: responseTarget || {
        type: "player",
        UUID: "player_001",
      },
      renderMode: "full",
      gameEvents,
    });

    const result = await assemblePrompt(templateSource, simState, fileLoader);

    return NextResponse.json({
      messages: result.messages,
      renderedText: result.renderedText,
    });
  } catch (error) {
    console.error("Render dialogue error:", error);
    return NextResponse.json(
      { error: `Render failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
