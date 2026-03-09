import path from "path";

// ── Path resolution ───────────────────────────────────────────────────────────
//
// In dev:      process.cwd() is prompt-tuner/, so PROJECT_ROOT is one level up.
// In packaged: electron/main.js sets env vars before starting the server so
//              paths point to the correct locations inside the packaged bundle.
//
// SKYRIMNET_DATA_DIR     — writable user data (edited-prompts live here).
//                          Packaged: data/ folder next to the exe.
// SKYRIMNET_ORIGINALS_DIR — absolute path to the bundled original_prompts dir.
//                           Packaged: inside Electron's resourcesPath.

const DATA_DIR = process.env.SKYRIMNET_DATA_DIR
  ? path.resolve(process.env.SKYRIMNET_DATA_DIR)
  : path.resolve(process.cwd(), "..");

export const PROJECT_ROOT = DATA_DIR;

export const ORIGINAL_PROMPTS_DIR = process.env.SKYRIMNET_ORIGINALS_DIR
  ? path.resolve(process.env.SKYRIMNET_ORIGINALS_DIR)
  : path.join(DATA_DIR, "reference-docs", "original-prompts");

export const EDITED_PROMPTS_DIR = path.join(DATA_DIR, "edited-prompts");

// REFERENCE_DOCS_DIR is derived from ORIGINAL_PROMPTS_DIR (1 level up).
// Used by isPathAllowed() to permit reads of bundled reference docs.
export const REFERENCE_DOCS_DIR = process.env.SKYRIMNET_ORIGINALS_DIR
  ? path.resolve(process.env.SKYRIMNET_ORIGINALS_DIR, "..")
  : path.join(DATA_DIR, "reference-docs");

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
 * Returns the legacy path by default — server-side callers should use
 * resolvePromptSetBaseServer() for MO2-aware resolution.
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
