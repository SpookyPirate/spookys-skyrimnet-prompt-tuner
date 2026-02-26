import { NextRequest, NextResponse } from "next/server";
import { assemblePrompt } from "@/lib/pipeline/assembler";
import { resolvePromptSetBase } from "@/lib/files/paths";
import { buildFullSimulationState } from "@/lib/pipeline/build-sim-state";
import { createFileLoader, readTemplate } from "@/lib/pipeline/file-loader-factory";
import type { InjaValue } from "@/lib/inja/renderer";

/**
 * Render the target_selectors/player_dialogue_target_selector.prompt template.
 * POST body: { playerMessage, chatHistory, npcs, scene, player, promptSetBase? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      playerMessage,
      chatHistory = [],
      npcs = [],
      scene,
      player,
      gameEvents = [],
      promptSetBase,
    } = body;

    const baseDir = resolvePromptSetBase(promptSetBase);
    const fileLoader = createFileLoader(baseDir);

    let templateSource: string;
    try {
      templateSource = await readTemplate(baseDir, "target_selectors/player_dialogue_target_selector.prompt");
    } catch {
      return NextResponse.json(
        { error: "Template not found: target_selectors/player_dialogue_target_selector.prompt" },
        { status: 404 }
      );
    }

    const candidateDialogues: InjaValue[] = npcs.map((n: Record<string, string | number>) => ({
      name: n.displayName || n.name,
      UUID: n.uuid || "unknown",
      gender: n.gender || "Unknown",
      race: n.race || "Unknown",
      distance: n.distance || 200,
    }));

    const simState = buildFullSimulationState({
      npc: npcs[0],
      player,
      scene: scene || { location: "Whiterun", weather: "Clear", timeOfDay: "Afternoon", worldPrompt: "", scenePrompt: "" },
      selectedNpcs: npcs,
      chatHistory,
      triggeringEvent: {
        type: "dialogue_player_text",
        data: { speaker: player?.name || "Player", text: playerMessage } as unknown as InjaValue,
      },
      crosshairTarget: null,
      candidateDialogues,
      dialogueRequest: playerMessage,
      gameEvents,
    });

    const result = await assemblePrompt(templateSource, simState, fileLoader);

    return NextResponse.json({
      messages: result.messages,
      renderedText: result.renderedText,
    });
  } catch (error) {
    console.error("Render target selector error:", error);
    return NextResponse.json(
      { error: `Render failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
