import { NextRequest, NextResponse } from "next/server";
import { assemblePrompt } from "@/lib/pipeline/assembler";
import { resolvePromptSetBase } from "@/lib/files/paths";
import { buildFullSimulationState } from "@/lib/pipeline/build-sim-state";
import { createFileLoader, readTemplate } from "@/lib/pipeline/file-loader-factory";
import type { InjaValue } from "@/lib/inja/renderer";

/**
 * Render the target_selectors/dialogue_speaker_selector.prompt template.
 * POST body: { lastSpeaker, chatHistory, npcs, scene, player, promptSetBase? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lastSpeaker,
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
      templateSource = await readTemplate(baseDir, "target_selectors/dialogue_speaker_selector.prompt");
    } catch {
      return NextResponse.json(
        { error: "Template not found: target_selectors/dialogue_speaker_selector.prompt" },
        { status: 404 }
      );
    }

    // Exclude lastSpeaker from candidate dialogues
    const candidates = npcs.filter(
      (n: Record<string, string>) => (n.displayName || n.name) !== lastSpeaker
    );
    const candidateDialogues: InjaValue[] = candidates.map((n: Record<string, string | number>) => ({
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
      lastSpeaker: lastSpeaker || "",
      candidateDialogues,
      gameEvents,
    });

    const result = await assemblePrompt(templateSource, simState, fileLoader);

    return NextResponse.json({
      messages: result.messages,
      renderedText: result.renderedText,
    });
  } catch (error) {
    console.error("Render speaker selector error:", error);
    return NextResponse.json(
      { error: `Render failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
