import path from "path";

// The Next.js app lives in prompt-tuner/, so the project root is one level up
export const PROJECT_ROOT = path.resolve(process.cwd(), "..");

export const ORIGINAL_PROMPTS_DIR = path.join(
  PROJECT_ROOT,
  "reference-docs",
  "skyrimnet-prompts",
  "SkyrimNet-beta15.4_hotfix01",
  "original_prompts"
);

export const EDITED_PROMPTS_DIR = path.join(PROJECT_ROOT, "edited-prompts");

export const REFERENCE_DOCS_DIR = path.join(PROJECT_ROOT, "reference-docs");

/** MO2-ready subpath: prompts live at {set}/SKSE/Plugins/SkyrimNet/prompts/ */
export const MO2_PROMPTS_SUBPATH = path.join("SKSE", "Plugins", "SkyrimNet", "prompts");

/** MO2-ready subpath: config lives at {set}/SKSE/Plugins/SkyrimNet/config/ */
export const MO2_CONFIG_SUBPATH = path.join("SKSE", "Plugins", "SkyrimNet", "config");

/**
 * Parse a character filename like "aela_the_huntress_697.prompt" into "Aela the Huntress"
 * The last segment after the final underscore is the ID (hex or "generic"), everything before is the name.
 */
export function parseCharacterName(filename: string): {
  displayName: string;
  id: string;
} {
  const base = filename.replace(/\.prompt$/, "");
  const lastUnderscore = base.lastIndexOf("_");

  if (lastUnderscore === -1) {
    return { displayName: base, id: "" };
  }

  const possibleId = base.substring(lastUnderscore + 1);
  // IDs are either hex strings (like 697, E7A, 8D4) or "generic"
  const isId =
    possibleId === "generic" || /^[0-9A-Fa-f]{2,4}$/.test(possibleId);

  if (!isId) {
    // The whole thing is the name
    return {
      displayName: base
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      id: "",
    };
  }

  const namePart = base.substring(0, lastUnderscore);
  const displayName = namePart
    .split("_")
    .map((w) => {
      // Handle hyphenated words like "battle-born"
      return w
        .split("-")
        .map((hw) => hw.charAt(0).toUpperCase() + hw.slice(1))
        .join("-");
    })
    .join(" ");

  return { displayName, id: possibleId };
}

/**
 * Resolve a prompt set name (e.g. "v1.0") to the absolute path of its prompts directory.
 * If the value is already an absolute path, returns it as-is.
 * If falsy, returns ORIGINAL_PROMPTS_DIR.
 */
export function resolvePromptSetBase(nameOrPath: string | undefined | null): string {
  if (!nameOrPath) return ORIGINAL_PROMPTS_DIR;
  if (path.isAbsolute(nameOrPath)) return nameOrPath;
  return path.join(EDITED_PROMPTS_DIR, nameOrPath, "prompts");
}

/**
 * Ensure a path is within the allowed project directories
 */
export function isPathAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return (
    resolved.startsWith(ORIGINAL_PROMPTS_DIR) ||
    resolved.startsWith(EDITED_PROMPTS_DIR) ||
    resolved.startsWith(REFERENCE_DOCS_DIR)
  );
}

/**
 * Check if a path is in a read-only area (original prompts)
 */
export function isReadOnly(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(ORIGINAL_PROMPTS_DIR);
}
