import fs from "fs";
import path from "path";
import { ORIGINAL_PROMPTS_DIR, EDITED_PROMPTS_DIR, MO2_PROMPTS_SUBPATH } from "./paths";

/**
 * Server-only: resolve a prompt set name to its prompts directory,
 * checking MO2 layout first, then legacy flat layout.
 */
export function resolvePromptSetBaseServer(nameOrPath: string | undefined | null): string {
  if (!nameOrPath) return ORIGINAL_PROMPTS_DIR;
  if (path.isAbsolute(nameOrPath)) return nameOrPath;

  const mo2Path = path.join(EDITED_PROMPTS_DIR, nameOrPath, MO2_PROMPTS_SUBPATH);
  if (fs.existsSync(mo2Path)) return mo2Path;

  return path.join(EDITED_PROMPTS_DIR, nameOrPath, "prompts");
}
