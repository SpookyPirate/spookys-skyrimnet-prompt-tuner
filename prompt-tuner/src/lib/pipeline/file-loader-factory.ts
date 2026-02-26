import fs from "fs/promises";
import path from "path";
import type { FileLoader } from "./assembler";
import { ORIGINAL_PROMPTS_DIR } from "@/lib/files/paths";

/**
 * Create a FileLoader that resolves paths from a base directory,
 * falling back to the original prompts directory.
 */
export function createFileLoader(baseDir: string): FileLoader {
  return {
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
}

/**
 * Read a template by name, trying baseDir first then ORIGINAL_PROMPTS_DIR.
 */
export async function readTemplate(baseDir: string, templateName: string): Promise<string> {
  try {
    return await fs.readFile(path.join(baseDir, templateName), "utf-8");
  } catch {
    return await fs.readFile(path.join(ORIGINAL_PROMPTS_DIR, templateName), "utf-8");
  }
}
