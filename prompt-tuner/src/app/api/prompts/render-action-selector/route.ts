import { NextRequest, NextResponse } from "next/server";
import { assemblePrompt } from "@/lib/pipeline/assembler";
import { resolvePromptSetBase } from "@/lib/files/paths";
import { buildFullSimulationState } from "@/lib/pipeline/build-sim-state";
import { createFileLoader, readTemplate } from "@/lib/pipeline/file-loader-factory";

/**
 * Render the native_action_selector.prompt template.
 * POST body: { npcName, npcUUID, playerMessage, npcResponse, eligibleActions, eventHistory, scene, promptSetBase?, player? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      npcName,
      npcUUID,
      playerMessage,
      npcResponse,
      eligibleActions,
      eventHistory,
      scene,
      promptSetBase,
      player,
      selectedNpcs = [],
      chatHistory,
      gameEvents = [],
    } = body;

    const baseDir = resolvePromptSetBase(promptSetBase);
    const fileLoader = createFileLoader(baseDir);

    let templateSource: string;
    try {
      templateSource = await readTemplate(baseDir, "native_action_selector.prompt");
    } catch {
      return NextResponse.json(
        { error: "Template not found: native_action_selector.prompt" },
        { status: 404 }
      );
    }

    const actions = (eligibleActions || []).map((a: { name: string; description: string; parameterSchema?: string }) => ({
      name: a.name,
      description: a.description,
      parameterSchema: a.parameterSchema || "",
    }));

    // Build a minimal NPC config for the primary NPC
    const primaryNpc = {
      uuid: npcUUID || "npc_001",
      name: npcName || "NPC",
      displayName: npcName || "NPC",
      gender: "Unknown",
      race: "Unknown",
      distance: 200,
      filePath: "",
    };

    const simState = buildFullSimulationState({
      npc: primaryNpc,
      player,
      scene: scene
        ? { location: scene.location || "Whiterun", weather: scene.weather || "Clear", timeOfDay: scene.timeOfDay || "Afternoon", worldPrompt: scene.worldPrompt || "", scenePrompt: scene.scenePrompt || "" }
        : { location: "Whiterun", weather: "Clear", timeOfDay: "Afternoon", worldPrompt: "", scenePrompt: "" },
      selectedNpcs: selectedNpcs.length > 0 ? selectedNpcs : [primaryNpc],
      chatHistory: chatHistory || [],
      eligibleActions: actions,
      dialogueRequest: playerMessage || "",
      dialogueResponse: npcResponse || "",
      gameEvents,
      customVariables: eventHistory ? { event_history_string: eventHistory } : {},
    });

    const result = await assemblePrompt(templateSource, simState, fileLoader);

    return NextResponse.json({
      messages: result.messages,
      renderedText: result.renderedText,
    });
  } catch (error) {
    console.error("Render action selector error:", error);
    return NextResponse.json(
      { error: `Render failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
