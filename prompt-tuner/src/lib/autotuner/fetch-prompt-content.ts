import type { BenchmarkCategory } from "@/types/benchmark";
import { getCategoryDef } from "@/lib/benchmark/categories";

/**
 * Maps agent types to the most relevant prompt submodule directories for tuning.
 */
const AGENT_PROMPT_DIRS: Record<string, string[]> = {
  default: ["submodules/system_head", "submodules/system_tail", "submodules/user_head"],
  game_master: ["submodules/system_head", "submodules/gm"],
  memory_gen: ["submodules/system_head", "submodules/memory"],
  profile_gen: ["submodules/system_head", "submodules/profile"],
  action_eval: ["submodules/system_head", "submodules/action"],
  meta_eval: ["submodules/system_head", "submodules/meta"],
  diary: ["submodules/system_head", "submodules/diary"],
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
  const dirs = AGENT_PROMPT_DIRS[agent] || ["submodules/system_head"];

  const allFiles: { path: string; name: string; content: string }[] = [];
  let totalLength = 0;
  const MAX_TOTAL = 8000;

  for (const dir of dirs) {
    const dirPath = `${promptSetBasePath}/${dir}`.replace(/\\/g, "/");

    try {
      const listResp = await fetch(
        `/api/files/children?path=${encodeURIComponent(dirPath)}&limit=50`,
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

          allFiles.push({ path: file.path, name: `${dir}/${file.name}`, content });
          totalLength += content.length;
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  // Format for the tuner LLM
  const sections = allFiles.map((f) => {
    const truncated = f.content.length > 2000
      ? f.content.substring(0, 2000) + "\n... (truncated)"
      : f.content;
    return `### ${f.name}\n\`\`\`\n${truncated}\n\`\`\``;
  });

  if (totalLength > MAX_TOTAL) {
    sections.push(`\n... (additional files truncated for context)`);
  }

  return { content: sections.join("\n\n"), files: allFiles };
}
