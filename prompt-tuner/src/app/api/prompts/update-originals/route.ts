import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import JSZip from "jszip";
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
  const contentType = request.headers.get("content-type") || "";

  let archivePath: string | null = null;
  let uploadedData: Buffer | null = null;
  let uploadedName: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    // Drag-and-drop file upload
    const formData = await request.formData();
    const file = formData.get("archive");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No archive file uploaded" },
        { status: 400 }
      );
    }
    uploadedName = (file as File).name || "upload.zip";
    const ext = path.extname(uploadedName).toLowerCase();
    if (ext !== ".zip" && ext !== ".7z") {
      return NextResponse.json(
        { error: "Unsupported archive format. Use .zip or .7z" },
        { status: 400 }
      );
    }
    uploadedData = Buffer.from(await file.arrayBuffer());
  } else {
    // JSON body with file path (file browser flow)
    const body = await request.json();
    archivePath = body.archivePath;

    if (!archivePath || typeof archivePath !== "string") {
      return NextResponse.json(
        { error: "Missing archivePath" },
        { status: 400 }
      );
    }

    archivePath = path.resolve(archivePath);
    const ext = path.extname(archivePath).toLowerCase();

    if (ext !== ".zip" && ext !== ".7z") {
      return NextResponse.json(
        { error: "Unsupported archive format. Use .zip or .7z" },
        { status: 400 }
      );
    }

    try {
      await fs.access(archivePath);
    } catch {
      return NextResponse.json(
        { error: `Archive not found: ${archivePath}` },
        { status: 404 }
      );
    }
  }

  // Use project root for temp dir to avoid cross-drive rename issues on Windows
  const tmpDir = path.join(PROJECT_ROOT, `.tmp-extract-${Date.now()}`);

  try {
    await fs.mkdir(tmpDir, { recursive: true });

    if (uploadedData) {
      // File was uploaded — process from memory (only .zip supported for uploads)
      const ext = path.extname(uploadedName!).toLowerCase();
      if (ext === ".7z") {
        // Write to temp file and use 7z CLI
        const tmpArchive = path.join(tmpDir, uploadedName!);
        await fs.writeFile(tmpArchive, uploadedData);
        return await handle7z(tmpArchive, tmpDir);
      }
      return await handleZipFromBuffer(uploadedData, uploadedName!, tmpDir);
    } else {
      // File path — read from disk
      const ext = path.extname(archivePath!).toLowerCase();
      if (ext === ".zip") {
        return await handleZip(archivePath!, tmpDir);
      } else {
        return await handle7z(archivePath!, tmpDir);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── .zip handling (pure JS via jszip) ──────────────────────────────────────

async function handleZipFromBuffer(data: Buffer, filename: string, tmpDir: string) {
  return handleZipInternal(data, filename, tmpDir);
}

async function handleZip(archivePath: string, tmpDir: string) {
  const data = await fs.readFile(archivePath);
  return handleZipInternal(data, path.basename(archivePath), tmpDir);
}

async function handleZipInternal(data: Buffer, filename: string, tmpDir: string) {
  const zip = await JSZip.loadAsync(data);

  // Find prefix paths by scanning file entries
  const prefixes = findPrefixesFromEntries(Object.keys(zip.files));

  if (!prefixes.originalPrompts) {
    return NextResponse.json(
      {
        error:
          "Could not find original_prompts/ in the archive. Expected a SkyrimNet release with SKSE/Plugins/SkyrimNet/original_prompts/",
      },
      { status: 400 }
    );
  }

  // Extract matching files into temp subdirectories
  const templatesTmpDir = path.join(tmpDir, "templates");
  const originalsTmpDir = path.join(tmpDir, "originals");

  // Extract original_prompts/
  await extractZipSubtree(zip, prefixes.originalPrompts, originalsTmpDir, "original_prompts");

  // Extract prompts/ (templates) if found
  if (prefixes.prompts) {
    await extractZipSubtree(zip, prefixes.prompts, templatesTmpDir, "prompts");
  }

  // Locate extracted directories
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
    // Merge: copy original_prompts/ contents INTO prompts/ (no-clobber)
    await mergeDirectories(extractedOriginalsDir, extractedTemplatesDir);
    mergedDir = extractedTemplatesDir;
  } else {
    mergedDir = extractedOriginalsDir;
  }

  // Extract config/ if present
  if (prefixes.config) {
    const configTmpDir = path.join(tmpDir, "config");
    await extractZipSubtree(zip, prefixes.config, configTmpDir, "config");
    const extractedConfigDir = await findExtractedDir(configTmpDir, "config");
    if (extractedConfigDir) {
      const destConfigDir = path.join(mergedDir, "config");
      await fs.mkdir(destConfigDir, { recursive: true });
      await mergeDirectories(extractedConfigDir, destConfigDir);
    }
  }

  return await finalize(mergedDir, filename, prefixes);
}

/**
 * Extract all files under a given prefix from a JSZip instance,
 * preserving directory structure starting from `rootDirName`.
 */
async function extractZipSubtree(
  zip: JSZip,
  prefix: string,
  destDir: string,
  rootDirName: string,
): Promise<void> {
  const entries = Object.entries(zip.files);

  for (const [entryPath, file] of entries) {
    if (!entryPath.startsWith(prefix)) continue;
    if (file.dir) continue;

    // Compute relative path from the prefix, keeping the root dir name
    const relFromPrefix = entryPath.substring(prefix.length);
    const outputPath = path.join(destDir, rootDirName, relFromPrefix);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const content = await file.async("nodebuffer");
    await fs.writeFile(outputPath, content);
  }
}

// ── .7z handling (requires 7z CLI) ─────────────────────────────────────────

async function handle7z(archivePath: string, tmpDir: string) {
  // Find prefixes by listing archive contents
  const prefixes = await findPrefixes7z(archivePath);

  if (!prefixes.originalPrompts) {
    return NextResponse.json(
      {
        error:
          "Could not find original_prompts/ in the archive. Expected a SkyrimNet release with SKSE/Plugins/SkyrimNet/original_prompts/",
      },
      { status: 400 }
    );
  }

  const templatesTmpDir = path.join(tmpDir, "templates");
  const originalsTmpDir = path.join(tmpDir, "originals");
  await fs.mkdir(templatesTmpDir, { recursive: true });
  await fs.mkdir(originalsTmpDir, { recursive: true });

  if (prefixes.prompts) {
    await extract7zSubtree(archivePath, prefixes.prompts, templatesTmpDir);
  }
  await extract7zSubtree(archivePath, prefixes.originalPrompts, originalsTmpDir);

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
    await mergeDirectories(extractedOriginalsDir, extractedTemplatesDir);
    mergedDir = extractedTemplatesDir;
  } else {
    mergedDir = extractedOriginalsDir;
  }

  if (prefixes.config) {
    const configTmpDir = path.join(tmpDir, "config");
    await fs.mkdir(configTmpDir, { recursive: true });
    await extract7zSubtree(archivePath, prefixes.config, configTmpDir);
    const extractedConfigDir = await findExtractedDir(configTmpDir, "config");
    if (extractedConfigDir) {
      const destConfigDir = path.join(mergedDir, "config");
      await fs.mkdir(destConfigDir, { recursive: true });
      await mergeDirectories(extractedConfigDir, destConfigDir);
    }
  }

  return await finalize(mergedDir, path.basename(archivePath), prefixes);
}

async function findPrefixes7z(archivePath: string): Promise<ArchivePrefixes> {
  const escaped = archivePath.replace(/"/g, '\\"');
  try {
    const { stdout } = await execAsync(`7z l "${escaped}"`, {
      maxBuffer: 50 * 1024 * 1024,
    });
    return findPrefixesFromEntries(stdout.split("\n"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("not recognized")) {
      throw new Error(
        "7z command not found. Please install 7-Zip and add it to your PATH to extract .7z archives, or use a .zip file instead."
      );
    }
    throw err;
  }
}

async function extract7zSubtree(
  archivePath: string,
  prefix: string,
  tmpDir: string
): Promise<void> {
  const escaped = archivePath.replace(/"/g, '\\"');
  const tmpEscaped = tmpDir.replace(/"/g, '\\"');
  await execAsync(
    `7z x "${escaped}" -o"${tmpEscaped}" "${prefix}*" -r -y`,
    { maxBuffer: 50 * 1024 * 1024 }
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────

interface ArchivePrefixes {
  prompts: string | null;
  originalPrompts: string | null;
  config: string | null;
}

/**
 * Scan a list of archive entry paths (or listing output lines) to find
 * the prefix paths for prompts/, original_prompts/, and config/.
 */
function findPrefixesFromEntries(lines: string[]): ArchivePrefixes {
  const result: ArchivePrefixes = { prompts: null, originalPrompts: null, config: null };

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
    if (!result.prompts) {
      const match = line.match(/([\w/\\.-]*(?<!original_)prompts[/\\][\w.-]+\.prompt)/);
      if (match) {
        const full = match[1].replace(/\\/g, "/");
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

    if (result.prompts && result.originalPrompts && result.config) break;
  }

  return result;
}

/**
 * Replace the originals directory with the merged result and return success response.
 */
async function finalize(
  mergedDir: string,
  sourceName: string,
  prefixes: ArchivePrefixes,
) {
  const extractedFiles = await countFiles(mergedDir);
  if (extractedFiles === 0) {
    return NextResponse.json(
      { error: "No files were extracted from the archive" },
      { status: 500 }
    );
  }

  await fs.rm(ORIGINAL_PROMPTS_DIR, { recursive: true, force: true });
  await fs.rename(mergedDir, ORIGINAL_PROMPTS_DIR);

  return NextResponse.json({
    success: true,
    filesExtracted: extractedFiles,
    source: sourceName,
    hasTemplates: !!prefixes.prompts,
    hasConfig: !!prefixes.config,
  });
}

/**
 * Recursively copy all files from src into dest, without overwriting existing files (no-clobber).
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
      try {
        await fs.access(destPath);
        // File exists in dest — skip (template takes priority)
      } catch {
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
      if (entry.name === targetName) return fullPath;
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
