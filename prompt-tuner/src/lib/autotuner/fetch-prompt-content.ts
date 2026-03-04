import type { BenchmarkCategory } from "@/types/benchmark";
import { getCategoryDef } from "@/lib/benchmark/categories";

/**
 * Maps agent types to prompt paths for tuning.
 * Entries ending in .prompt are individual files; others are directories to list.
 */
const AGENT_PROMPT_PATHS: Record<string, string[]> = {
  default: [
    "submodules/system_head",
    "submodules/user_final_instructions",
    "dialogue_response.prompt",
  ],
  game_master: [
    "submodules/system_head",
    "gamemaster_action_selector.prompt",
    "gamemaster_scene_planner.prompt",
  ],
  memory_gen: [
    "submodules/system_head",
    "memory",
  ],
  profile_gen: [
    "submodules/system_head",
    "character_profile_update.prompt",
    "dynamic_bio_update.prompt",
    "helpers/generate_profile.prompt",
  ],
  action_eval: [
    "submodules/system_head",
    "native_action_selector.prompt",
  ],
  meta_eval: [
    "submodules/system_head",
    "target_selectors",
  ],
  diary: [
    "submodules/system_head",
    "diary_entry.prompt",
  ],
};

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
}

/**
 * Fetch relevant prompt file contents for a category.
 * Uses the prompt set base path (resolved server-side) via the children + read APIs.
 * Returns a formatted string with file paths and contents suitable for the tuner LLM.
 */
export async function fetchPromptContent(
  category: BenchmarkCategory,
  promptSetBasePath: string,
): Promise<{ content: string; files: { path: string; name: string; content: string }[] }> {
  const catDef = getCategoryDef(category);
  if (!catDef) return { content: "", files: [] };

  const agent = catDef.agent;
  const paths = AGENT_PROMPT_PATHS[agent] || ["submodules/system_head"];

  const allFiles: { path: string; name: string; content: string }[] = [];
  let totalLength = 0;
  const MAX_TOTAL = 12000;

  for (const entry of paths) {
    if (totalLength > MAX_TOTAL) break;

    const fullPath = `${promptSetBasePath}/${entry}`.replace(/\\/g, "/");

    try {
      if (entry.endsWith(".prompt")) {
        // Individual file — read directly
        const readResp = await fetch(`/api/files/read?path=${encodeURIComponent(fullPath)}`);
        if (!readResp.ok) continue;
        const { content } = await readResp.json();

        allFiles.push({ path: fullPath, name: entry, content });
        totalLength += content.length;
      } else {
        // Directory — list children and read .prompt files
        const listResp = await fetch(
          `/api/files/children?path=${encodeURIComponent(fullPath)}&limit=50`,
        );
        if (!listResp.ok) continue;

        const data = await listResp.json();
        const entries: FileEntry[] = data.children || [];
        const promptFiles = entries
          .filter((e) => e.type === "file" && e.name.endsWith(".prompt"))
          .sort((a, b) => a.name.localeCompare(b.name));

        for (const file of promptFiles) {
          if (totalLength > MAX_TOTAL) break;

          try {
            const readResp = await fetch(`/api/files/read?path=${encodeURIComponent(file.path)}`);
            if (!readResp.ok) continue;
            const { content } = await readResp.json();

            allFiles.push({ path: file.path, name: `${entry}/${file.name}`, content });
            totalLength += content.length;
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip inaccessible paths
    }
  }

  // Format for the tuner LLM
  const sections = allFiles.map((f) => {
    const truncated = f.content.length > 3000
      ? f.content.substring(0, 3000) + "\n... (truncated)"
      : f.content;
    return `### ${f.name}\n\`\`\`\n${truncated}\n\`\`\``;
  });

  if (totalLength > MAX_TOTAL) {
    sections.push(`\n... (additional files truncated for context)`);
  }

  return { content: sections.join("\n\n"), files: allFiles };
}
