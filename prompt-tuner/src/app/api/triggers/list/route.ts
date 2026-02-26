import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { EDITED_PROMPTS_DIR, ORIGINAL_PROMPTS_DIR } from "@/lib/files/paths";
import { validateTriggerYaml } from "@/lib/yaml/validator";
import type { TriggerYaml } from "@/types/yaml-configs";

/**
 * List all trigger YAML files from the active prompt set.
 * GET ?promptSet=name
 */
export async function GET(request: NextRequest) {
  try {
    const promptSet = request.nextUrl.searchParams.get("promptSet") || "v1.0";
    const triggers: TriggerYaml[] = [];

    // Check edited triggers first
    const editedTriggersDir = path.join(EDITED_PROMPTS_DIR, promptSet, "triggers");
    try {
      const files = await fs.readdir(editedTriggersDir);
      for (const file of files) {
        if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
        try {
          const content = await fs.readFile(path.join(editedTriggersDir, file), "utf-8");
          const result = validateTriggerYaml(content);
          if (result.valid && result.parsed) {
            triggers.push(result.parsed);
          }
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Directory doesn't exist
    }

    // Check original triggers
    const originalTriggersDir = path.join(ORIGINAL_PROMPTS_DIR, "triggers");
    try {
      const files = await fs.readdir(originalTriggersDir);
      for (const file of files) {
        if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
        try {
          const content = await fs.readFile(path.join(originalTriggersDir, file), "utf-8");
          const result = validateTriggerYaml(content);
          if (result.valid && result.parsed) {
            // Don't add if already exists from edited set
            if (!triggers.some((t) => t.name === result.parsed!.name)) {
              triggers.push(result.parsed);
            }
          }
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return NextResponse.json({ triggers });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to list triggers: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
