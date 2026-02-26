import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { assemblePrompt, type SimulationState } from "@/lib/pipeline/assembler";
import { ORIGINAL_PROMPTS_DIR, resolvePromptSetBase, isPathAllowed } from "@/lib/files/paths";
import { buildFullSimulationState } from "@/lib/pipeline/build-sim-state";
import { createFileLoader } from "@/lib/pipeline/file-loader-factory";

/**
 * Render a prompt through the Inja pipeline.
 * POST body: { templatePath, simulationState?, promptSetBase?, eligibleActions?, player?,
 *              scene?, selectedNpcs?, chatHistory? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templatePath,
      simulationState,
      promptSetBase,
      eligibleActions,
      player,
      scene,
      selectedNpcs,
      chatHistory,
    } = body;

    if (!templatePath) {
      return NextResponse.json(
        { error: "Missing templatePath" },
        { status: 400 }
      );
    }

    const baseDir = resolvePromptSetBase(promptSetBase);

    // Read the template
    let templateSource: string;
    if (path.isAbsolute(templatePath)) {
      if (!isPathAllowed(templatePath)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      templateSource = await fs.readFile(templatePath, "utf-8");
    } else {
      try {
        templateSource = await fs.readFile(path.join(baseDir, templatePath), "utf-8");
      } catch {
        templateSource = await fs.readFile(path.join(ORIGINAL_PROMPTS_DIR, templatePath), "utf-8");
      }
    }

    const fileLoader = createFileLoader(baseDir);

    // If a pre-built simulationState is provided, use it directly (backward compat)
    // Otherwise build one from component params
    let simState: SimulationState;
    if (simulationState && simulationState.recentEventsArray !== undefined) {
      simState = simulationState;
    } else if (simulationState) {
      // Legacy: simulationState without new fields — fill in defaults
      simState = {
        ...simulationState,
        recentEventsArray: simulationState.recentEventsArray || [],
        responseTarget: simulationState.responseTarget || null,
        triggeringEvent: simulationState.triggeringEvent || null,
        crosshairTarget: simulationState.crosshairTarget || null,
        embedActionsInDialogue: simulationState.embedActionsInDialogue ?? false,
        promptForDialogue: simulationState.promptForDialogue || "",
        gameTime: simulationState.gameTime || "",
        gameTimeJson: simulationState.gameTimeJson || {},
        gameTimeNumeric: simulationState.gameTimeNumeric || 0,
        timeDesc: simulationState.timeDesc || "",
        currentWeather: simulationState.currentWeather || { name: "Clear" },
        isIndoors: simulationState.isIndoors ?? false,
        locationObject: simulationState.locationObject || { name: simulationState.location || "Whiterun" },
        scenePlan: simulationState.scenePlan || null,
        isContinuousMode: simulationState.isContinuousMode ?? false,
        hasScenePlan: simulationState.hasScenePlan ?? false,
      };
    } else {
      simState = buildFullSimulationState({
        player,
        scene: scene || { location: "Whiterun", weather: "Clear", timeOfDay: "Afternoon", worldPrompt: "", scenePrompt: "" },
        selectedNpcs: selectedNpcs || [],
        chatHistory: chatHistory || [],
        eligibleActions: eligibleActions || [],
      });
    }

    const result = await assemblePrompt(templateSource, simState, fileLoader);

    return NextResponse.json({
      messages: result.messages,
      renderedText: result.renderedText,
    });
  } catch (error) {
    console.error("Render error:", error);
    return NextResponse.json(
      { error: `Render failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
