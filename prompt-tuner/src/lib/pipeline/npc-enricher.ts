/**
 * NPC Enrichment Engine — derives plausible Skyrim game data from NPC config.
 * Takes basic NPC info (name, race, gender) and produces full game-state data
 * including equipment, skills, factions, spells, and merchant inventory.
 */

import type { NpcConfig, SceneConfig } from "@/types/simulation";
import type { InjaValue } from "@/lib/inja/renderer";
import {
  VOICE_TYPES,
  ARCHETYPES,
  EQUIPMENT_SETS,
  KNOWN_NPCS,
  SPELLS_BY_SCHOOL,
  MERCHANT_INVENTORIES,
  MOODS_LIST,
  findLocation,
  isLocationIndoors,
  type ArchetypeDef,
  type EquipmentSet,
  type EquipmentItem,
  type SpellDef,
  type MerchantTemplate,
  type LocationDef,
} from "./skyrim-data";

// ============================================================
// Types
// ============================================================

export interface EnrichedNpc {
  // Identity
  archetype: string;
  voiceType: string;

  // Stats
  class: string;
  level: number;
  health: number;
  magicka: number;
  stamina: number;
  gold: number;

  // Flags
  isGuard: boolean;
  isEssential: boolean;
  isChild: boolean;

  // Skills (all 18)
  skills: Record<string, number>;

  // Equipment
  equipment: EquipmentSet;
  equipmentKeywords: Set<string>;

  // Factions
  factions: string[];
  factionSet: Set<string>;

  // Keywords
  keywords: string[];

  // Magic
  spells: SpellDef[];

  // Merchant
  merchantData: {
    isMerchant: boolean;
    merchantType?: string;
    template?: MerchantTemplate;
  };
}

export interface EnrichedLocation {
  hold: string;
  crimeFaction: string;
  isIndoors: boolean;
  defaultFactions: string[];
}

// ============================================================
// Deterministic PRNG from name hash
// ============================================================

function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0; // Ensure positive
}

function seedRandom(name: string): () => number {
  let state = hashString(name);
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

// ============================================================
// Main enrichment function
// ============================================================

export function enrichNpc(
  npc: NpcConfig,
  scene: SceneConfig,
  allNpcs: NpcConfig[]
): EnrichedNpc {
  const displayName = npc.displayName || npc.name;
  const rng = seedRandom(displayName);

  // 1. Name lookup
  const knownDef = KNOWN_NPCS[displayName];

  // 2. Guard heuristic
  const isGuardByName = /guard/i.test(displayName);

  // 3. Determine archetype
  let archetypeName: string;
  if (knownDef) {
    archetypeName = knownDef.archetype;
  } else if (isGuardByName) {
    archetypeName = "guard";
  } else if (/^jarl\s/i.test(displayName)) {
    archetypeName = "jarl";
  } else {
    archetypeName = "citizen";
  }

  // Fallback to farmer (closest to generic citizen) if archetype not found
  const archetype: ArchetypeDef = ARCHETYPES[archetypeName] || ARCHETYPES.farmer;

  // 4. Voice type
  const normalizedRace = normalizeRace(npc.race);
  const voiceType = knownDef?.voiceType
    || VOICE_TYPES[`${npc.gender}_${normalizedRace}`]
    || "MaleNord";

  // 5. Gold — deterministic within archetype's range
  const [minGold, maxGold] = archetype.goldRange;
  const gold = Math.floor(minGold + rng() * (maxGold - minGold));

  // 6. Skills — archetype base with ±5 per-NPC variation
  const skills: Record<string, number> = {};
  for (const [skill, base] of Object.entries(archetype.skills)) {
    const variation = Math.floor(rng() * 11) - 5; // -5 to +5
    skills[skill] = Math.max(5, base + variation);
  }

  // 7. Equipment
  const equipment: EquipmentSet = EQUIPMENT_SETS[archetype.equipmentSet]
    ? deepCopyEquipment(EQUIPMENT_SETS[archetype.equipmentSet])
    : {};

  // Collect all keywords from worn equipment
  const equipmentKeywords = new Set<string>();
  for (const item of Object.values(equipment)) {
    if (item) {
      for (const kw of item.keywords) {
        equipmentKeywords.add(kw);
      }
    }
  }

  // 8. Factions — merge archetype + known NPC + location-based
  const factions = new Set<string>(archetype.factions);
  if (knownDef?.factions) {
    for (const f of knownDef.factions) factions.add(f);
  }
  // Add location-based factions
  const locDef = findLocation(scene.location);
  if (locDef) {
    for (const f of locDef.defaultFactions) factions.add(f);
  }
  const factionArray = [...factions];

  // 9. Spells — for mage/priest, select based on skill levels
  const spells: SpellDef[] = [];
  if (archetype.spellSchools.length > 0) {
    for (const school of archetype.spellSchools) {
      const schoolSpells = SPELLS_BY_SCHOOL[school];
      if (!schoolSpells) continue;
      // Pick 2-4 spells per school based on skill level
      const skillLevel = skills[school] || 15;
      const maxSpells = skillLevel >= 50 ? 4 : skillLevel >= 30 ? 3 : 2;
      // Sort by magicka cost (easier spells first), pick up to maxSpells
      const sorted = [...schoolSpells].sort((a, b) => a.magickaCost - b.magickaCost);
      for (let i = 0; i < Math.min(maxSpells, sorted.length); i++) {
        spells.push(sorted[i]);
      }
    }
  }

  // 10. Merchant data
  const isMerchant = knownDef?.isMerchant || false;
  const merchantType = knownDef?.merchantType;
  const merchantTemplate = merchantType ? MERCHANT_INVENTORIES[merchantType] : undefined;

  // Keywords
  const keywords = [...archetype.keywords];

  // Essential override from known NPC
  const isEssential = knownDef?.isEssential ?? archetype.isEssential;

  // Class override from known NPC
  const npcClass = knownDef?.class || archetype.class;

  // Ignore allNpcs for now (available for future relationship computation)
  void allNpcs;

  return {
    archetype: archetypeName,
    voiceType,
    class: npcClass,
    level: archetype.level,
    health: archetype.health,
    magicka: archetype.magicka,
    stamina: archetype.stamina,
    gold,
    isGuard: archetype.isGuard,
    isEssential,
    isChild: archetype.isChild,
    skills,
    equipment,
    equipmentKeywords,
    factions: factionArray,
    factionSet: factions,
    keywords,
    spells,
    merchantData: {
      isMerchant,
      merchantType,
      template: merchantTemplate,
    },
  };
}

// ============================================================
// Location enrichment
// ============================================================

export function enrichLocation(location: string): EnrichedLocation {
  const locDef: LocationDef | null = findLocation(location);
  return {
    hold: locDef?.hold || "Skyrim",
    crimeFaction: locDef?.crimeFaction || "CrimeFaction",
    isIndoors: isLocationIndoors(location),
    defaultFactions: locDef?.defaultFactions || [],
  };
}

// ============================================================
// Relationship rank computation
// ============================================================

export function getRelationshipRank(
  factions1: Set<string>,
  factions2: Set<string>,
  isFollower: boolean
): number {
  if (isFollower) return 3; // Follower = ally

  // Count shared factions
  let shared = 0;
  for (const f of factions1) {
    if (factions2.has(f)) shared++;
  }

  if (shared >= 2) return 2;  // Friend
  if (shared >= 1) return 1;  // Acquaintance
  return 0;                    // Neutral
}

// ============================================================
// Helpers
// ============================================================

function normalizeRace(race: string): string {
  // Map common race names to the format used in VOICE_TYPES keys
  const map: Record<string, string> = {
    "Nord": "Nord",
    "Imperial": "Imperial",
    "Breton": "Breton",
    "Redguard": "Redguard",
    "Dark Elf": "DarkElf",
    "DarkElf": "DarkElf",
    "Dunmer": "DarkElf",
    "High Elf": "HighElf",
    "HighElf": "HighElf",
    "Altmer": "HighElf",
    "Wood Elf": "WoodElf",
    "WoodElf": "WoodElf",
    "Bosmer": "WoodElf",
    "Orc": "Orc",
    "Orsimer": "Orc",
    "Argonian": "Argonian",
    "Khajiit": "Khajiit",
  };
  return map[race] || race.replace(/\s+/g, "");
}

function deepCopyEquipment(set: EquipmentSet): EquipmentSet {
  const copy: EquipmentSet = {};
  for (const [slot, item] of Object.entries(set)) {
    if (item) {
      copy[slot as keyof EquipmentSet] = { ...item, keywords: [...item.keywords] };
    }
  }
  return copy;
}

/**
 * Convert an EnrichedNpc's equipment into the InjaValue format
 * expected by templates (slot → item record).
 */
export function equipmentToInjaValue(equipment: EquipmentSet): Record<string, InjaValue> {
  const result: Record<string, InjaValue> = {};
  const slots: (keyof EquipmentSet)[] = ["head", "body", "hands", "feet", "rightHand", "leftHand"];
  for (const slot of slots) {
    const item: EquipmentItem | undefined = equipment[slot];
    if (item) {
      result[slot] = {
        name: item.name,
        type: item.type,
        armorRating: item.armorRating ?? 0,
        damage: item.damage ?? 0,
        value: item.value,
        formID: item.formID,
        keywords: item.keywords,
      } as unknown as InjaValue;
    }
  }
  return result;
}

/**
 * Convert spell list to InjaValue array.
 */
export function spellsToInjaValue(spells: SpellDef[]): InjaValue[] {
  return spells.map((s) => ({
    name: s.name,
    school: s.school,
    spellType: s.spellType,
    castingType: s.castingType,
    delivery: s.delivery,
    magickaCost: s.magickaCost,
    chargeTime: s.chargeTime,
    isTwoHanded: s.isTwoHanded,
    isHostile: s.isHostile,
  })) as unknown as InjaValue[];
}

/**
 * Generate a description of an NPC's outfit.
 */
export function describeOutfit(equipment: EquipmentSet): string {
  const parts: string[] = [];
  if (equipment.body) parts.push(equipment.body.name);
  if (equipment.head) parts.push(equipment.head.name);
  if (equipment.hands) parts.push(equipment.hands.name);
  if (equipment.feet) parts.push(equipment.feet.name);
  if (equipment.rightHand) parts.push(equipment.rightHand.name);
  if (equipment.leftHand) parts.push(equipment.leftHand.name);
  return parts.join(", ");
}

/**
 * Generate a small role-appropriate inventory for an NPC.
 */
export function buildSimpleInventory(enriched: EnrichedNpc): InjaValue {
  const items: Record<string, InjaValue>[] = [];

  // Everyone carries a few septims
  if (enriched.gold > 0) {
    items.push({ name: "Gold", count: enriched.gold, type: "Currency", value: 1 } as unknown as Record<string, InjaValue>);
  }

  // Add a key for innkeepers/merchants
  if (enriched.merchantData.isMerchant) {
    items.push({ name: "Shop Key", count: 1, type: "Key", value: 0 } as unknown as Record<string, InjaValue>);
  }

  // Guards carry a torch
  if (enriched.isGuard) {
    items.push({ name: "Torch", count: 1, type: "Misc", value: 2 } as unknown as Record<string, InjaValue>);
  }

  return { items, totalWeight: items.length * 0.5, totalValue: enriched.gold } as unknown as InjaValue;
}

/**
 * Build merchant inventory InjaValue from enriched data.
 */
export function buildMerchantInventory(enriched: EnrichedNpc): InjaValue {
  if (!enriched.merchantData.isMerchant || !enriched.merchantData.template) {
    return { isMerchant: false } as unknown as InjaValue;
  }

  const tmpl = enriched.merchantData.template;
  return {
    isMerchant: true,
    vendorFaction: tmpl.vendorFaction,
    startHour: tmpl.startHour,
    endHour: tmpl.endHour,
    buysStolen: tmpl.buysStolen,
    items: tmpl.items.map((item) => ({
      name: item.name,
      count: item.count,
      value: item.value,
      type: item.type,
    })),
    gold: enriched.gold,
  } as unknown as InjaValue;
}

/**
 * Generate a richer omnisight description using enriched data.
 */
export function buildOmnisightDescription(enriched: EnrichedNpc, actor: Record<string, InjaValue>): string {
  const name = String(actor.name || "NPC");
  const race = String(actor.race || "");
  const gender = String(actor.gender || "");

  const parts: string[] = [];
  parts.push(`${name}`);

  // Race/gender
  const identity = [gender, race].filter(Boolean).join(" ").toLowerCase();
  if (identity) parts.push(`a ${identity}`);

  // Equipment summary
  const outfit = describeOutfit(enriched.equipment);
  if (outfit) parts.push(`wearing ${outfit}`);

  // Class/role
  if (enriched.isGuard) {
    parts.push("on guard duty");
  } else if (enriched.archetype === "merchant" || enriched.merchantData.isMerchant) {
    parts.push("a merchant");
  }

  return parts.join(", ") + ".";
}

/**
 * Build mood-related context variables.
 */
export function getMoodData(): { moodsList: string[]; moodDescriptions: Record<string, string> } {
  // Re-export from skyrim-data to keep imports clean in assembler
  return {
    moodsList: MOODS_LIST,
    moodDescriptions: Object.fromEntries(
      MOODS_LIST.map((m) => [m, MOODS_LIST.includes(m) ? m : m])
    ),
  };
}
