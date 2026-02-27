import { NextRequest, NextResponse } from "next/server";
import { assemblePrompt } from "@/lib/pipeline/assembler";
import { resolvePromptSetBase } from "@/lib/files/paths";
import { buildFullSimulationState } from "@/lib/pipeline/build-sim-state";
import { createFileLoader, readTemplate } from "@/lib/pipeline/file-loader-factory";
import type { InjaValue } from "@/lib/inja/renderer";

/**
 * Render the diary_entry.prompt template for a single NPC.
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
      templateSource = await readTemplate(baseDir, "diary_entry.prompt");
    } catch {
      return NextResponse.json(
        { error: "Template not found: diary_entry.prompt" },
        { status: 404 }
      );
    }

    const simState = buildFullSimulationState({
      npc: npc || selectedNpcs[0],
      player,
      scene: scene || { location: "Whiterun", weather: "Clear", timeOfDay: "Afternoon", worldPrompt: "", scenePrompt: "" },
      selectedNpcs,
      chatHistory,
      gameEvents,
      renderMode: "full",
      customVariables: {
        lastDiaryEntry: "" as InjaValue,
        recentMemories: [] as unknown as InjaValue,
        maxRecentEvents: chatHistory.length as InjaValue,
        targetEntryLength: 300 as InjaValue,
      },
    });

    const result = await assemblePrompt(templateSource, simState, fileLoader);

    return NextResponse.json({
      messages: result.messages,
      renderedText: result.renderedText,
    });
  } catch (error) {
    console.error("Render diary error:", error);
    return NextResponse.json(
      { error: `Render failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
