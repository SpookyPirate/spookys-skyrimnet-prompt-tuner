import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { ORIGINAL_PROMPTS_DIR, PROJECT_ROOT } from "@/lib/files/paths";

const execAsync = promisify(exec);

/**
 * POST /api/prompts/update-originals
 * Extracts both prompts/ (templates) and original_prompts/ (characters + setting)
 * from a SkyrimNet release archive (.zip or .7z), merges them, and replaces
 * the current originals directory.
 *
 * Merge strategy: original_prompts/ contents are copied into the prompts/ tree
 * with no-clobber — template files from prompts/ are never overwritten by
 * original_prompts/ files. This produces a complete prompt set.
 */
export async function POST(request: Request) {
  const { archivePath } = await request.json();

  if (!archivePath || typeof archivePath !== "string") {
    return NextResponse.json(
      { error: "Missing archivePath" },
      { status: 400 }
    );
  }

  const normalized = path.resolve(archivePath);
  const ext = path.extname(normalized).toLowerCase();

  if (ext !== ".zip" && ext !== ".7z") {
    return NextResponse.json(
      { error: "Unsupported archive format. Use .zip or .7z" },
      { status: 400 }
    );
  }

  // Verify the file exists
  try {
    await fs.access(normalized);
  } catch {
    return NextResponse.json(
      { error: `Archive not found: ${normalized}` },
      { status: 404 }
    );
  }

  // Use project root for temp dir to avoid cross-drive rename issues on Windows
  const tmpDir = path.join(PROJECT_ROOT, `.tmp-extract-${Date.now()}`);

  try {
    await fs.mkdir(tmpDir, { recursive: true });

    // 1. Find both prefixes in the archive
    const prefixes = await findPromptsPrefixes(normalized, ext);
    if (!prefixes.originalPrompts) {
      return NextResponse.json(
        {
          error:
            "Could not find original_prompts/ in the archive. Expected a SkyrimNet release with SKSE/Plugins/SkyrimNet/original_prompts/",
        },
        { status: 400 }
      );
    }

    // 2. Extract both directories into separate temp subdirectories
    const templatesTmpDir = path.join(tmpDir, "templates");
    const originalsTmpDir = path.join(tmpDir, "originals");
    await fs.mkdir(templatesTmpDir, { recursive: true });
    await fs.mkdir(originalsTmpDir, { recursive: true });

    // Extract prompts/ (templates) if found
    if (prefixes.prompts) {
      await extractSubtree(normalized, ext, prefixes.prompts, templatesTmpDir);
    }

    // Extract original_prompts/ (characters + setting)
    await extractSubtree(normalized, ext, prefixes.originalPrompts, originalsTmpDir);

    // 3. Locate the extracted directories
    const extractedOriginalsDir = await findExtractedDir(originalsTmpDir, "original_prompts");
    if (!extractedOriginalsDir) {
      return NextResponse.json(
        { error: "Extraction succeeded but could not locate original_prompts/ in output" },
        { status: 500 }
      );
    }

    let mergedDir: string;

    if (prefixes.prompts) {
      const extractedTemplatesDir = await findExtractedDir(templatesTmpDir, "prompts");
      if (!extractedTemplatesDir) {
        return NextResponse.json(
          { error: "Extraction succeeded but could not locate prompts/ in output" },
          { status: 500 }
        );
      }

      // 4. Merge: copy original_prompts/ contents INTO prompts/ (no-clobber)
      await mergeDirectories(extractedOriginalsDir, extractedTemplatesDir);
      mergedDir = extractedTemplatesDir;
    } else {
      // Fallback: only original_prompts/ found (older release?)
      mergedDir = extractedOriginalsDir;
    }

    // 4b. Extract config/ (actions + triggers) if present in archive
    if (prefixes.config) {
      const configTmpDir = path.join(tmpDir, "config");
      await fs.mkdir(configTmpDir, { recursive: true });
      await extractSubtree(normalized, ext, prefixes.config, configTmpDir);
      const extractedConfigDir = await findExtractedDir(configTmpDir, "config");
      if (extractedConfigDir) {
        const destConfigDir = path.join(mergedDir, "config");
        await fs.mkdir(destConfigDir, { recursive: true });
        await mergeDirectories(extractedConfigDir, destConfigDir);
      }
    }

    // 5. Count files to verify extraction worked
    const extractedFiles = await countFiles(mergedDir);
    if (extractedFiles === 0) {
      return NextResponse.json(
        { error: "No files were extracted from the archive" },
        { status: 500 }
      );
    }

    // 6. Remove old originals and replace with merged result
    await fs.rm(ORIGINAL_PROMPTS_DIR, { recursive: true, force: true });
    await fs.rename(mergedDir, ORIGINAL_PROMPTS_DIR);

    return NextResponse.json({
      success: true,
      filesExtracted: extractedFiles,
      source: path.basename(normalized),
      hasTemplates: !!prefixes.prompts,
      hasConfig: !!prefixes.config,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    // Clean up temp dir
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

interface ArchivePrefixes {
  /** Path prefix to prompts/ (templates), e.g. "SKSE/Plugins/SkyrimNet/prompts/" */
  prompts: string | null;
  /** Path prefix to original_prompts/ (characters + setting), e.g. "SKSE/Plugins/SkyrimNet/original_prompts/" */
  originalPrompts: string | null;
  /** Path prefix to config/ (actions + triggers), e.g. "SKSE/Plugins/SkyrimNet/config/" */
  config: string | null;
}

/**
 * List archive contents and find the prefix paths to both prompts/ and original_prompts/.
 */
async function findPromptsPrefixes(
  archivePath: string,
  ext: string
): Promise<ArchivePrefixes> {
  const escaped = archivePath.replace(/"/g, '\\"');
  let output: string;

  if (ext === ".zip") {
    const { stdout } = await execAsync(`unzip -l "${escaped}"`, {
      maxBuffer: 50 * 1024 * 1024,
    });
    output = stdout;
  } else {
    try {
      const { stdout } = await execAsync(`7z l "${escaped}"`, {
        maxBuffer: 50 * 1024 * 1024,
      });
      output = stdout;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found") || msg.includes("not recognized")) {
        throw new Error(
          "7z command not found. Please install 7-Zip and add it to your PATH to extract .7z archives."
        );
      }
      throw err;
    }
  }

  const result: ArchivePrefixes = { prompts: null, originalPrompts: null, config: null };
  const lines = output.split("\n");

  for (const line of lines) {
    // Find original_prompts/ prefix (look for characters/ subdir as landmark)
    if (!result.originalPrompts) {
      const match = line.match(/([\w/\\.-]*original_prompts[/\\]characters[/\\])/);
      if (match) {
        const full = match[1].replace(/\\/g, "/");
        const idx = full.indexOf("original_prompts/");
        result.originalPrompts = full.substring(0, idx + "original_prompts/".length);
      }
    }

    // Find prompts/ prefix (look for a .prompt file directly under prompts/ as landmark)
    // Must NOT match "original_prompts/" — use negative lookbehind
    if (!result.prompts) {
      const match = line.match(/([\w/\\.-]*(?<!original_)prompts[/\\][\w.-]+\.prompt)/);
      if (match) {
        const full = match[1].replace(/\\/g, "/");
        // Find the last occurrence of "prompts/" that isn't "original_prompts/"
        const idx = full.search(/(?<!original_)prompts\//);
        if (idx !== -1) {
          result.prompts = full.substring(0, idx + "prompts/".length);
        }
      }
    }

    // Find config/ prefix (look for actions/ or triggers/ subdir as landmark)
    if (!result.config) {
      const match = line.match(/([\w/\\.-]*config[/\\](?:actions|triggers)[/\\])/);
      if (match) {
        const full = match[1].replace(/\\/g, "/");
        const idx = full.indexOf("config/");
        result.config = full.substring(0, idx + "config/".length);
      }
    }

    // Early exit if all found
    if (result.prompts && result.originalPrompts && result.config) break;
  }

  return result;
}

/**
 * Extract a subtree from archive into tmpDir.
 */
async function extractSubtree(
  archivePath: string,
  ext: string,
  prefix: string,
  tmpDir: string
): Promise<void> {
  const escaped = archivePath.replace(/"/g, '\\"');
  const tmpEscaped = tmpDir.replace(/"/g, '\\"');

  if (ext === ".zip") {
    // Use ** glob — on Windows/Git Bash, single * doesn't recurse into subdirectories
    await execAsync(
      `unzip -o "${escaped}" "${prefix}**" -d "${tmpEscaped}"`,
      { maxBuffer: 50 * 1024 * 1024 }
    );
  } else {
    // 7z uses its own wildcard matching; -r enables recursive
    await execAsync(
      `7z x "${escaped}" -o"${tmpEscaped}" "${prefix}*" -r -y`,
      { maxBuffer: 50 * 1024 * 1024 }
    );
  }
}

/**
 * Recursively copy all files from src into dest, without overwriting existing files (no-clobber).
 * This merges original_prompts/ contents into the prompts/ tree.
 */
async function mergeDirectories(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await mergeDirectories(srcPath, destPath);
    } else if (entry.isFile()) {
      // No-clobber: only copy if destination doesn't exist
      try {
        await fs.access(destPath);
        // File exists in dest — skip (template takes priority)
      } catch {
        // File doesn't exist in dest — copy it
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

/**
 * Recursively find a directory by name within a root path.
 */
async function findExtractedDir(
  root: string,
  targetName: string
): Promise<string | null> {
  const entries = await fs.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fullPath = path.join(root, entry.name);
      if (entry.name === targetName) {
        return fullPath;
      }
      const found = await findExtractedDir(fullPath, targetName);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Count all files recursively in a directory.
 */
async function countFiles(dir: string): Promise<number> {
  let count = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      count++;
    } else if (entry.isDirectory()) {
      count += await countFiles(path.join(dir, entry.name));
    }
  }
  return count;
}
