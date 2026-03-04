import type { AiTuningSettings, SkyrimNetAgentType, ModelSlot } from "@/types/config";
import { useProfileStore } from "@/stores/profileStore";
import { useConfigStore } from "@/stores/configStore";
import { SKYRIMNET_AGENTS, DEFAULT_API_SETTINGS, DEFAULT_TUNING_SETTINGS, DEFAULT_MODEL_NAMES } from "@/types/config";

/**
 * Save copycat-tuned settings to an existing profile's "default" agent slot.
 */
export function saveCopycatToExistingProfile(
  profileId: string,
  settings: AiTuningSettings,
) {
  const profileStore = useProfileStore.getState();
  const profile = profileStore.getProfile(profileId);
  if (!profile) throw new Error(`Profile not found: ${profileId}`);

  const agent: SkyrimNetAgentType = "default";
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

  const profiles = profileStore.profiles.map((p) =>
    p.id === profileId ? { ...p, slots: updatedSlots } : p,
  );
  useProfileStore.setState({ profiles });
  profileStore.save();
}

/**
 * Save copycat-tuned settings to a new profile.
 * Creates a profile with default settings for all agents,
 * then applies the target model + tuned settings to the "default" slot.
 */
export function saveCopycatToNewProfile(
  name: string,
  targetModelId: string,
  settings: AiTuningSettings,
): string {
  const profileStore = useProfileStore.getState();

  // Build default slots from scratch
  const slots = {} as Record<SkyrimNetAgentType, ModelSlot>;
  for (const agent of SKYRIMNET_AGENTS) {
    slots[agent] = {
      api: {
        ...DEFAULT_API_SETTINGS,
        modelNames: DEFAULT_MODEL_NAMES[agent],
      },
      tuning: { ...DEFAULT_TUNING_SETTINGS },
    };
  }

  // Apply tuned settings + model to the default slot
  slots["default"] = {
    api: { ...slots["default"].api, modelNames: targetModelId },
    tuning: { ...settings },
  };

  const configStore = useConfigStore.getState();
  const globalApiKey = configStore.globalApiKey;

  const newProfile = profileStore.addProfile(name, globalApiKey, slots);
  return newProfile.id;
}
