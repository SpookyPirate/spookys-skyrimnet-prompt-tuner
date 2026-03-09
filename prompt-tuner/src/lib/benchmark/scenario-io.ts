import type { BenchmarkCategory, BenchmarkScenario } from "@/types/benchmark";

const FORMAT_ID = "skyrimnet-benchmark-scenarios";
const FORMAT_VERSION = 1;

const VALID_CATEGORIES: BenchmarkCategory[] = [
  "dialogue",
  "meta_eval",
  "action_eval",
  "game_master",
  "memory_gen",
  "diary",
  "bio_update",
];

interface ScenarioExportEnvelope {
  format: string;
  version: number;
  exportedAt: string;
  scenarios: Omit<BenchmarkScenario, "id" | "isBuiltin">[];
}

type ValidationResult =
  | { valid: true; scenarios: BenchmarkScenario[] }
  | { valid: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function freshId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function stripForExport(
  scenario: BenchmarkScenario,
): Omit<BenchmarkScenario, "id" | "isBuiltin"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, isBuiltin: _isBuiltin, ...rest } = scenario;
  return rest;
}

function triggerDownload(json: string, filename: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildEnvelope(
  scenarios: BenchmarkScenario[],
): ScenarioExportEnvelope {
  return {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    scenarios: scenarios.map(stripForExport),
  };
}

// ── Export functions ──────────────────────────────────────────────────

export function exportSingleScenario(scenario: BenchmarkScenario) {
  const envelope = buildEnvelope([scenario]);
  const filename = `scenario_${slugify(scenario.name)}.json`;
  triggerDownload(JSON.stringify(envelope, null, 2), filename);
}

export function exportCategoryScenarios(
  scenarios: BenchmarkScenario[],
  category: BenchmarkCategory,
) {
  const envelope = buildEnvelope(scenarios);
  const filename = `scenarios_${category}.json`;
  triggerDownload(JSON.stringify(envelope, null, 2), filename);
}

// ── Import / validation ──────────────────────────────────────────────

export async function parseScenarioFile(file: File): Promise<ValidationResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { valid: false, error: "Could not read file" };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { valid: false, error: "Invalid JSON" };
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { valid: false, error: "Expected a JSON object" };
  }

  const envelope = data as Record<string, unknown>;

  if (envelope.format !== FORMAT_ID) {
    return {
      valid: false,
      error: `Unrecognized format: "${String(envelope.format)}". Expected "${FORMAT_ID}".`,
    };
  }

  if (typeof envelope.version !== "number" || envelope.version > FORMAT_VERSION) {
    return {
      valid: false,
      error: `Unsupported version: ${String(envelope.version)}. This app supports up to version ${FORMAT_VERSION}.`,
    };
  }

  if (!Array.isArray(envelope.scenarios) || envelope.scenarios.length === 0) {
    return { valid: false, error: "No scenarios found in file" };
  }

  const results: BenchmarkScenario[] = [];

  for (let i = 0; i < envelope.scenarios.length; i++) {
    const s = envelope.scenarios[i] as Record<string, unknown>;

    if (!s || typeof s !== "object") {
      return { valid: false, error: `Scenario ${i + 1}: not a valid object` };
    }

    if (!VALID_CATEGORIES.includes(s.category as BenchmarkCategory)) {
      return {
        valid: false,
        error: `Scenario ${i + 1}: invalid category "${String(s.category)}"`,
      };
    }

    if (typeof s.name !== "string" || !s.name.trim()) {
      return { valid: false, error: `Scenario ${i + 1}: missing or empty name` };
    }

    if (!s.player || typeof s.player !== "object") {
      return { valid: false, error: `Scenario ${i + 1}: missing player data` };
    }
    if (!s.scene || typeof s.scene !== "object") {
      return { valid: false, error: `Scenario ${i + 1}: missing scene data` };
    }
    if (!Array.isArray(s.npcs)) {
      return { valid: false, error: `Scenario ${i + 1}: missing npcs array` };
    }

    results.push({
      ...(s as unknown as Omit<BenchmarkScenario, "id" | "isBuiltin">),
      id: freshId(),
      isBuiltin: false,
    } as BenchmarkScenario);
  }

  return { valid: true, scenarios: results };
}
