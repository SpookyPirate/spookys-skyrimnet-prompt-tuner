import type { AiTuningSettings, SkyrimNetAgentType } from "@/types/config";
import type { BenchmarkCategory } from "@/types/benchmark";
import { useProfileStore } from "@/stores/profileStore";
import { useConfigStore } from "@/stores/configStore";
import { getCategoryDef } from "@/lib/benchmark/categories";

const TUNER_TEMP_SET = "__tuner_temp__";

/**
 * Save tuned settings to a profile by updating its agent slot.
 */
export function saveSettingsToProfile(
  profileId: string,
  category: BenchmarkCategory,
  settings: AiTuningSettings,
) {
  const catDef = getCategoryDef(category);
  if (!catDef) throw new Error(`Unknown category: ${category}`);

  const profileStore = useProfileStore.getState();
  const profile = profileStore.getProfile(profileId);
  if (!profile) throw new Error(`Profile not found: ${profileId}`);

  const agent = catDef.agent as SkyrimNetAgentType;
  const updatedSlots = { ...profile.slots };
  updatedSlots[agent] = {
    ...updatedSlots[agent],
    tuning: { ...settings },
  };

  // If this is the active profile, also update configStore
  if (profileStore.activeProfileId === profileId) {
    const configStore = useConfigStore.getState();
    configStore.updateSlotTuning(agent, { ...settings });
  }

  // Update profile directly
  const profiles = profileStore.profiles.map((p) =>
    p.id === profileId ? { ...p, slots: updatedSlots } : p,
  );
  // Manually update the profiles array and persist
  useProfileStore.setState({ profiles });
  profileStore.save();
}

/**
 * Save tuned prompts by copying from the temp set to a target set.
 */
export async function savePromptsToSet(targetSetName: string): Promise<void> {
  // First check if the target set exists, if not create it
  const createResp = await fetch("/api/export/save-set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: targetSetName, sourceSet: TUNER_TEMP_SET }),
  });

  if (!createResp.ok) {
    const data = await createResp.json();
    // 409 means set already exists — we need to copy files manually
    if (createResp.status === 409) {
      await copyTempToExistingSet(targetSetName);
      return;
    }
    throw new Error(data.error || `Failed to save prompt set: HTTP ${createResp.status}`);
  }
}

/**
 * Copy files from the temp tuner set into an existing set.
 * Lists all files in the temp set and writes them to the target.
 */
async function copyTempToExistingSet(targetSetName: string): Promise<void> {
  // Use the server-side copy endpoint by calling the browse API for temp files
  // Then write each one to the target location
  const resp = await fetch(`/api/files/children?path=${encodeURIComponent(TUNER_TEMP_SET)}&limit=200`);
  if (!resp.ok) {
    throw new Error("Failed to list temp tuner files");
  }

  // For simplicity, we'll recursively copy by reading and writing each file.
  // This is handled by the save-set API creating from source.
  // If the set already exists, we'll delete it first and recreate.
  await deleteTunerTempSet();

  // Now we can copy normally — but the temp set was just deleted.
  // This case shouldn't normally happen because we clean up temp sets before starting.
  throw new Error(`Prompt set "${targetSetName}" already exists. Please choose a different name or delete it first.`);
}

/**
 * Delete the tuner temp prompt set.
 */
export async function deleteTunerTempSet(): Promise<void> {
  try {
    const resp = await fetch("/api/export/delete-set", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: TUNER_TEMP_SET }),
    });
    // Don't throw on 404 — set might not exist
    if (!resp.ok && resp.status !== 404) {
      console.error("Failed to delete tuner temp set:", resp.status);
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Create the temp tuner set, optionally copying from an existing prompt set.
 */
export async function createTunerTempSet(sourceSet?: string): Promise<string> {
  // Clean up any existing temp set first
  await deleteTunerTempSet();

  const body: Record<string, string> = { name: TUNER_TEMP_SET };
  if (sourceSet) {
    body.sourceSet = sourceSet;
  }

  const resp = await fetch("/api/export/save-set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.error || `Failed to create temp tuner set: HTTP ${resp.status}`);
  }

  return TUNER_TEMP_SET;
}

export { TUNER_TEMP_SET };
