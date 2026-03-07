import type { BenchmarkCategory, BenchmarkNpc } from "@/types/benchmark";
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
 * Resolve a prompt set name (e.g. "__tuner_temp__", "Test_3", "")
 * to an absolute base path via the server-side resolve API.
 */
async function resolveBasePath(promptSetName: string): Promise<string> {
  const resp = await fetch(
    `/api/files/resolve-prompt-set?name=${encodeURIComponent(promptSetName)}`,
  );
  if (!resp.ok) {
    throw new Error(`Failed to resolve prompt set "${promptSetName}": HTTP ${resp.status}`);
  }
  const { basePath } = await resp.json();
  return basePath;
}

/**
 * Try reading a file, returning its content or null on failure.
 */
async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    const resp = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
    if (!resp.ok) return null;
    const { content } = await resp.json();
    return content ?? null;
  } catch {
    return null;
  }
}

/**
 * Try listing .prompt children in a directory, returning entries or empty array.
 */
async function tryListPromptFiles(dirPath: string): Promise<FileEntry[]> {
  try {
    const resp = await fetch(`/api/files/children?path=${encodeURIComponent(dirPath)}&limit=50`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.children || [])
      .filter((e: FileEntry) => e.type === "file" && e.name.endsWith(".prompt"))
      .sort((a: FileEntry, b: FileEntry) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/**
 * Fetch relevant prompt file contents for a category.
 * Resolves the prompt set name to an absolute path server-side,
 * then reads files via the children + read APIs.
 *
 * When using a temp set (e.g. __tuner_temp__), files may not exist there yet.
 * Falls back to fallbackSetName (the active prompt set) for any missing
 * files/directories, then to originals. Returns paths using the primary set
 * so the LLM targets the correct writable location in its proposals.
 *
 * If scenarioNpcs are provided, their character bio files are included
 * as read-only context so the tuner LLM understands the NPCs involved.
 */
export async function fetchPromptContent(
  category: BenchmarkCategory,
  promptSetName: string,
  fallbackSetName?: string,
  scenarioNpcs?: BenchmarkNpc[],
): Promise<{ content: string; files: { path: string; name: string; content: string }[] }> {
  const catDef = getCategoryDef(category);
  if (!catDef) return { content: "", files: [] };

  const agent = catDef.agent;
  const paths = AGENT_PROMPT_PATHS[agent] || ["submodules/system_head"];

  // Resolve the set name to an absolute base path on disk
  let basePath: string;
  try {
    basePath = await resolveBasePath(promptSetName);
  } catch {
    console.error(`[fetchPromptContent] Could not resolve prompt set "${promptSetName}"`);
    return { content: "", files: [] };
  }

  // Build fallback chain: active prompt set first, then originals
  const fallbackBasePaths: string[] = [];
  if (promptSetName) {
    if (fallbackSetName) {
      try {
        fallbackBasePaths.push(await resolveBasePath(fallbackSetName));
      } catch { /* skip */ }
    }
    try {
      const originalsPath = await resolveBasePath("");
      // Avoid duplicate if fallback already resolved to originals
      if (!fallbackBasePaths.includes(originalsPath)) {
        fallbackBasePaths.push(originalsPath);
      }
    } catch { /* skip */ }
  }

  const allFiles: { path: string; name: string; content: string }[] = [];
  let totalLength = 0;
  const MAX_TOTAL = 12000;

  for (const entry of paths) {
    if (totalLength > MAX_TOTAL) break;

    const fullPath = `${basePath}/${entry}`.replace(/\\/g, "/");
    const fallbackPaths = fallbackBasePaths.map(
      (fb) => `${fb}/${entry}`.replace(/\\/g, "/")
    );

    try {
      if (entry.endsWith(".prompt")) {
        // Individual file — try primary, then fallback chain
        let content = await tryReadFile(fullPath);
        if (content === null) {
          for (const fb of fallbackPaths) {
            content = await tryReadFile(fb);
            if (content !== null) break;
          }
        }
        if (content === null) continue;

        // Always use primary path so LLM targets the writable set
        allFiles.push({ path: fullPath, name: entry, content });
        totalLength += content.length;
      } else {
        // Directory — try primary, fall back through chain for listing
        let promptFiles = await tryListPromptFiles(fullPath);
        let usedFallbackDir: string | null = null;
        if (promptFiles.length === 0) {
          for (const fb of fallbackPaths) {
            promptFiles = await tryListPromptFiles(fb);
            if (promptFiles.length > 0) {
              usedFallbackDir = fb;
              break;
            }
          }
        }

        for (const file of promptFiles) {
          if (totalLength > MAX_TOTAL) break;

          // Read from wherever the file was listed
          const content = await tryReadFile(file.path);
          if (content === null) continue;

          // Remap path to primary set so LLM targets the writable location
          const primaryFilePath = usedFallbackDir
            ? `${fullPath}/${file.name}`.replace(/\\/g, "/")
            : file.path;

          allFiles.push({ path: primaryFilePath, name: `${entry}/${file.name}`, content });
          totalLength += content.length;
        }
      }
    } catch {
      // Skip inaccessible paths
    }
  }

  // ── Fetch character bios for scenario NPCs (read-only context) ──
  const bioSections: string[] = [];
  if (scenarioNpcs && scenarioNpcs.length > 0) {
    // Try reading bios from the fallback chain (active set → originals)
    // Character bios live in characters/<uuid>.prompt
    const bioBasePaths = [basePath, ...fallbackBasePaths];
    for (const npc of scenarioNpcs) {
      if (totalLength > MAX_TOTAL) break;
      const uuid = npc.uuid;
      if (!uuid) continue;

      let bioContent: string | null = null;
      for (const bp of bioBasePaths) {
        const bioPath = `${bp}/characters/${uuid}.prompt`.replace(/\\/g, "/");
        bioContent = await tryReadFile(bioPath);
        if (bioContent !== null) break;
      }
      if (bioContent) {
        const truncated = bioContent.length > 2000
          ? bioContent.substring(0, 2000) + "\n... (truncated)"
          : bioContent;
        bioSections.push(`### ${npc.displayName} (\`${uuid}\`)\n\`\`\`\n${truncated}\n\`\`\``);
        totalLength += bioContent.length;
      }
    }
  }

  // Format for the tuner LLM — use f.path in headers so the LLM knows the
  // exact file path to use in search/replace prompt_changes proposals
  const sections = allFiles.map((f) => {
    const truncated = f.content.length > 3000
      ? f.content.substring(0, 3000) + "\n... (truncated)"
      : f.content;
    return `### \`${f.path}\`\n\`\`\`\n${truncated}\n\`\`\``;
  });

  if (bioSections.length > 0) {
    sections.push(`\n## Character Bios (read-only context — do not propose changes to these)\n\n${bioSections.join("\n\n")}`);
  }

  if (totalLength > MAX_TOTAL) {
    sections.push(`\n... (additional files truncated for context)`);
  }

  return { content: sections.join("\n\n"), files: allFiles };
}
