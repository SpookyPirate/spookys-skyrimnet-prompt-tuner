import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { assemblePrompt, type FileLoader, type SimulationState } from "@/lib/pipeline/assembler";
import { ORIGINAL_PROMPTS_DIR, EDITED_PROMPTS_DIR } from "@/lib/files/paths";
import type { InjaValue } from "@/lib/inja/renderer";

/**
 * Render the native_action_selector.prompt template.
 * POST body: { npcName, npcUUID, playerMessage, npcResponse, eligibleActions, eventHistory, scene, promptSetBase? }
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
    } = body;

    const baseDir = promptSetBase || ORIGINAL_PROMPTS_DIR;

    // Find the action selector prompt
    const templateName = "native_action_selector.prompt";
    let templateSource: string;
    try {
      templateSource = await fs.readFile(path.join(baseDir, templateName), "utf-8");
    } catch {
      try {
        templateSource = await fs.readFile(path.join(ORIGINAL_PROMPTS_DIR, templateName), "utf-8");
      } catch {
        return NextResponse.json(
          { error: `Template not found: ${templateName}` },
          { status: 404 }
        );
      }
    }

    const fileLoader: FileLoader = {
      readFile: async (filePath: string) => {
        const editedPath = path.join(baseDir, filePath);
        try {
          return await fs.readFile(editedPath, "utf-8");
        } catch {
          return await fs.readFile(path.join(ORIGINAL_PROMPTS_DIR, filePath), "utf-8");
        }
      },
      listDir: async (dirPath: string) => {
        const results: string[] = [];
        try {
          const files = await fs.readdir(path.join(baseDir, dirPath));
          results.push(...files);
        } catch {}
        try {
          const files = await fs.readdir(path.join(ORIGINAL_PROMPTS_DIR, dirPath));
          for (const f of files) if (!results.includes(f)) results.push(f);
        } catch {}
        return results;
      },
    };

    const actions = (eligibleActions || []).map((a: { name: string; description: string; parameterSchema?: string }) => ({
      name: a.name,
      description: a.description,
      parameterSchema: a.parameterSchema || "",
    }));

    const simState: SimulationState = {
      npc: { name: npcName || "NPC", UUID: npcUUID || "npc_001", gender: "Unknown", race: "Unknown" },
      player: { name: "Player", UUID: "player_001", gender: "Male", race: "Nord" },
      location: scene?.location || "Whiterun",
      sceneContext: scene?.scenePrompt || "",
      recentEvents: eventHistory || "",
      relevantMemories: "",
      nearbyNpcs: [],
      eligibleActions: actions as InjaValue[],
      dialogueRequest: playerMessage || "",
      dialogueResponse: npcResponse || "",
      lastSpeaker: { name: npcName || "" },
      candidateDialogues: [],
      renderMode: "full",
      structuredJsonActions: false,
      customVariables: {},
    };

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
