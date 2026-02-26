import type { PlayerConfig } from "@/types/simulation";

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  name: "Player",
  gender: "Male",
  race: "Nord",
  level: 25,
  isInCombat: false,
  bio: "",
};

/**
 * Build a full player object from partial config, including decnpc()-compatible fields.
 * Used by all render API routes.
 */
export function buildPlayerObject(config?: Partial<PlayerConfig>) {
  const name = config?.name || DEFAULT_PLAYER_CONFIG.name;
  const gender = config?.gender || DEFAULT_PLAYER_CONFIG.gender;
  const level = config?.level ?? DEFAULT_PLAYER_CONFIG.level;
  const isInCombat = config?.isInCombat ?? DEFAULT_PLAYER_CONFIG.isInCombat;
  const race = config?.race || DEFAULT_PLAYER_CONFIG.race;
  const isFemale = gender === "Female";

  return {
    name,
    UUID: "player_001",
    gender,
    race,
    level,
    isInCombat,
    // decnpc() compat fields
    firstName: name.split(" ")[0],
    lastName: name.split(" ").slice(1).join(" ") || "",
    sex: gender,
    isFemale,
    subjectivePronoun: isFemale ? "she" : "he",
    objectivePronoun: isFemale ? "her" : "him",
    possessiveAdjective: isFemale ? "her" : "his",
    reflexivePronoun: isFemale ? "herself" : "himself",
    class: "Adventurer",
    health: 100,
    maxHealth: 100,
    magicka: 100,
    maxMagicka: 100,
    stamina: 100,
    maxStamina: 100,
  };
}
