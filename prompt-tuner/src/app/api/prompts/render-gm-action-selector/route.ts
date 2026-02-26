import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { assemblePrompt, type FileLoader, type SimulationState } from "@/lib/pipeline/assembler";
import { ORIGINAL_PROMPTS_DIR } from "@/lib/files/paths";
import type { InjaValue } from "@/lib/inja/renderer";

/**
 * Render the gamemaster_action_selector.prompt template.
 * POST body: { npcs, scene, eventHistory, scenePlan, isContinuousMode, promptSetBase? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { npcs, scene, eventHistory, scenePlan, isContinuousMode, promptSetBase } = body;

    const baseDir = promptSetBase || ORIGINAL_PROMPTS_DIR;

    const templateName = "gamemaster_action_selector.prompt";
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
        try {
          return await fs.readFile(path.join(baseDir, filePath), "utf-8");
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

    const nearbyNpcs = (npcs || []).map((n: Record<string, string>) => ({
      name: n.name || n.displayName,
      UUID: n.uuid || "unknown",
      gender: n.gender || "Unknown",
      race: n.race || "Unknown",
    }));

    const simState: SimulationState = {
      npc: nearbyNpcs[0] || { name: "NPC", UUID: "npc_001", gender: "Unknown", race: "Unknown" },
      player: { name: "Player", UUID: "player_001", gender: "Male", race: "Nord" },
      location: scene?.location || "Whiterun",
      sceneContext: [
        scene?.scenePrompt || "",
        scenePlan ? `Scene Plan: ${JSON.stringify(scenePlan)}` : "",
        isContinuousMode ? "Mode: Continuous (keep directing scene beats)" : "",
      ].filter(Boolean).join("\n"),
      recentEvents: eventHistory || "",
      relevantMemories: "",
      nearbyNpcs: nearbyNpcs as InjaValue[],
      eligibleActions: [],
      dialogueRequest: "",
      dialogueResponse: "",
      lastSpeaker: { name: "" },
      candidateDialogues: [],
      renderMode: "full",
      structuredJsonActions: false,
      customVariables: {
        scene_plan: scenePlan ? JSON.stringify(scenePlan) : "",
        is_continuous_mode: !!isContinuousMode,
      },
    };

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
