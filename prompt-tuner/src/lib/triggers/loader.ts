import type { TriggerYaml } from "@/types/yaml-configs";

/**
 * Load all trigger YAML files from the active prompt set via API.
 */
export async function loadTriggers(promptSet: string): Promise<TriggerYaml[]> {
  try {
    const res = await fetch(`/api/triggers/list?promptSet=${encodeURIComponent(promptSet)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.triggers || [];
  } catch {
    return [];
  }
}
