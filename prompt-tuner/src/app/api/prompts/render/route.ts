import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { assemblePrompt, type FileLoader, type SimulationState } from "@/lib/pipeline/assembler";
import { ORIGINAL_PROMPTS_DIR, EDITED_PROMPTS_DIR, isPathAllowed } from "@/lib/files/paths";
import type { InjaValue } from "@/lib/inja/renderer";

/**
 * Render a prompt through the Inja pipeline.
 * POST body: { templatePath, simulationState, promptSetBase? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templatePath, simulationState, promptSetBase } = body;

    if (!templatePath) {
      return NextResponse.json(
        { error: "Missing templatePath" },
        { status: 400 }
      );
    }

    // Determine the base directory for file resolution
    const baseDir = promptSetBase || ORIGINAL_PROMPTS_DIR;

    // Read the template
    let templateSource: string;
    if (path.isAbsolute(templatePath)) {
      if (!isPathAllowed(templatePath)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      templateSource = await fs.readFile(templatePath, "utf-8");
    } else {
      templateSource = await fs.readFile(
        path.join(baseDir, templatePath),
        "utf-8"
      );
    }

    // Build a file loader that resolves paths relative to the prompt set
    const fileLoader: FileLoader = {
      readFile: async (filePath: string) => {
        // Try edited prompts first, then originals
        const editedPath = path.join(baseDir, filePath);
        try {
          return await fs.readFile(editedPath, "utf-8");
        } catch {
          // Fall back to original prompts
          const originalPath = path.join(ORIGINAL_PROMPTS_DIR, filePath);
          return await fs.readFile(originalPath, "utf-8");
        }
      },
      listDir: async (dirPath: string) => {
        const results: string[] = [];

        // Merge files from edited and original directories
        const editedDir = path.join(baseDir, dirPath);
        const originalDir = path.join(ORIGINAL_PROMPTS_DIR, dirPath);

        try {
          const editedFiles = await fs.readdir(editedDir);
          results.push(...editedFiles);
        } catch {
          // Directory may not exist in edited set
        }

        try {
          const originalFiles = await fs.readdir(originalDir);
          for (const f of originalFiles) {
            if (!results.includes(f)) results.push(f);
          }
        } catch {
          // Directory may not exist in originals
        }

        return results;
      },
    };

    // Default simulation state if not provided
    const simState: SimulationState = simulationState || {
      npc: { name: "Test NPC", UUID: "test_npc_001", gender: "Male", race: "Nord" },
      player: { name: "Dragonborn", UUID: "player_001", gender: "Male", race: "Nord" },
      location: "Whiterun",
      sceneContext: "",
      recentEvents: "",
      relevantMemories: "",
      nearbyNpcs: [],
      eligibleActions: [],
      dialogueRequest: "",
      dialogueResponse: "",
      lastSpeaker: { name: "" },
      candidateDialogues: [],
      renderMode: "full",
      structuredJsonActions: false,
      customVariables: {},
    };

    const result = await assemblePrompt(
      templateSource,
      simState,
      fileLoader
    );

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
