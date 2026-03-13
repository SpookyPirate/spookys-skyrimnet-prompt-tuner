/**
 * Skyrim Knowledge Base — static lookup tables for NPC enrichment.
 * Pure data, no logic. Used by npc-enricher.ts to derive plausible game data.
 */

// ============================================================
// Types
// ============================================================

export interface ArchetypeDef {
  class: string;
  level: number;
  health: number;
  magicka: number;
  stamina: number;
  goldRange: [number, number];
  isGuard: boolean;
  isEssential: boolean;
  isChild: boolean;
  skills: Record<string, number>;
  equipmentSet: string;
  factions: string[];
  keywords: string[];
  spellSchools: string[];  // Which schools to pick spells from
}

export interface EquipmentItem {
  name: string;
  type: string;
  armorRating?: number;
  damage?: number;
  value: number;
  formID: string;
  keywords: string[];
}

export interface EquipmentSet {
  head?: EquipmentItem;
  body?: EquipmentItem;
  hands?: EquipmentItem;
  feet?: EquipmentItem;
  rightHand?: EquipmentItem;
  leftHand?: EquipmentItem;
}

export interface KnownNpcDef {
  archetype: string;
  voiceType?: string;
  factions?: string[];
  isEssential?: boolean;
  isMerchant?: boolean;
  merchantType?: string;
  class?: string;
}

export interface LocationDef {
  hold: string;
  crimeFaction: string;
  defaultFactions: string[];
}

export interface SpellDef {
  name: string;
  school: string;
  spellType: "Spell" | "Power" | "LesserPower";
  castingType: "FireAndForget" | "Concentration";
  delivery: "Aimed" | "Self" | "TargetActor";
  magickaCost: number;
  chargeTime: number;
  isTwoHanded: boolean;
  isHostile: boolean;
}

export interface MerchantItem {
  name: string;
  count: number;
  value: number;
  type: string;
}

export interface MerchantTemplate {
  vendorFaction: string;
  startHour: number;
  endHour: number;
  buysStolen: boolean;
  items: MerchantItem[];
}

// ============================================================
// 1a. Voice Types — keyed by "Gender_Race"
// ============================================================

export const VOICE_TYPES: Record<string, string> = {
  Male_Nord: "MaleNord",
  Female_Nord: "FemaleNord",
  Male_Imperial: "MaleEvenToned",
  Female_Imperial: "FemaleCommoner",
  Male_Breton: "MaleEvenToned",
  Female_Breton: "FemaleYoungEager",
  Male_Redguard: "MaleYoungEager",
  Female_Redguard: "FemaleCommoner",
  Male_DarkElf: "MaleDarkElf",
  Female_DarkElf: "FemaleDarkElf",
  Male_HighElf: "MaleElfHaughty",
  Female_HighElf: "FemaleElfHaughty",
  Male_WoodElf: "MaleYoungEager",
  Female_WoodElf: "FemaleYoungEager",
  Male_Orc: "MaleOrc",
  Female_Orc: "FemaleOrc",
  Male_Argonian: "MaleArgonian",
  Female_Argonian: "FemaleArgonian",
  Male_Khajiit: "MaleKhajiit",
  Female_Khajiit: "FemaleKhajiit",
};

// ============================================================
// 1b. NPC Archetypes
// ============================================================

const BASE_SKILLS: Record<string, number> = {
  OneHanded: 20, TwoHanded: 15, Marksman: 15, Block: 15,
  Smithing: 15, HeavyArmor: 15, LightArmor: 20, Pickpocket: 15,
  Lockpicking: 15, Sneak: 15, Alchemy: 15, Speech: 20,
  Alteration: 15, Conjuration: 15, Destruction: 15, Illusion: 15,
  Restoration: 15, Enchanting: 15,
};

function skills(overrides: Record<string, number>): Record<string, number> {
  return { ...BASE_SKILLS, ...overrides };
}

export const ARCHETYPES: Record<string, ArchetypeDef> = {
  guard: {
    class: "Warrior",
    level: 15,
    health: 150,
    magicka: 50,
    stamina: 120,
    goldRange: [25, 50],
    isGuard: true,
    isEssential: false,
    isChild: false,
    skills: skills({ OneHanded: 50, Block: 45, HeavyArmor: 45, TwoHanded: 35, Marksman: 30 }),
    equipmentSet: "steel_guard",
    factions: ["GuardFaction"],
    keywords: ["ActorTypeNPC", "Guard"],
    spellSchools: [],
  },
  warrior: {
    class: "Warrior",
    level: 12,
    health: 140,
    magicka: 50,
    stamina: 130,
    goldRange: [30, 80],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({ OneHanded: 55, TwoHanded: 50, Block: 40, HeavyArmor: 40, Smithing: 30 }),
    equipmentSet: "iron_warrior",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  mage: {
    class: "Mage",
    level: 15,
    health: 100,
    magicka: 200,
    stamina: 80,
    goldRange: [50, 150],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({ Destruction: 60, Conjuration: 50, Alteration: 45, Restoration: 40, Enchanting: 35 }),
    equipmentSet: "mage_robes",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: ["Destruction", "Conjuration", "Alteration", "Restoration"],
  },
  merchant: {
    class: "Citizen",
    level: 6,
    health: 80,
    magicka: 50,
    stamina: 80,
    goldRange: [500, 2000],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({ Speech: 65, Pickpocket: 25 }),
    equipmentSet: "fine_clothes",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  innkeeper: {
    class: "Citizen",
    level: 6,
    health: 80,
    magicka: 50,
    stamina: 80,
    goldRange: [200, 800],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({ Speech: 55, Alchemy: 25 }),
    equipmentSet: "barkeeper",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  blacksmith: {
    class: "Citizen",
    level: 8,
    health: 100,
    magicka: 50,
    stamina: 100,
    goldRange: [100, 500],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({ Smithing: 65, OneHanded: 30, HeavyArmor: 30 }),
    equipmentSet: "smithing",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  noble: {
    class: "Citizen",
    level: 8,
    health: 80,
    magicka: 50,
    stamina: 80,
    goldRange: [200, 500],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({ Speech: 55, OneHanded: 25 }),
    equipmentSet: "fine_clothes",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  bard: {
    class: "Citizen",
    level: 6,
    health: 80,
    magicka: 50,
    stamina: 90,
    goldRange: [30, 100],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({ Speech: 60, Illusion: 25 }),
    equipmentSet: "fine_clothes",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  priest: {
    class: "Mage",
    level: 10,
    health: 90,
    magicka: 150,
    stamina: 80,
    goldRange: [50, 200],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({ Restoration: 60, Alteration: 40, Speech: 35 }),
    equipmentSet: "mage_robes",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: ["Restoration", "Alteration"],
  },
  thief: {
    class: "Thief",
    level: 10,
    health: 90,
    magicka: 50,
    stamina: 120,
    goldRange: [50, 300],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({ Sneak: 55, Pickpocket: 50, Lockpicking: 50, LightArmor: 40, OneHanded: 35 }),
    equipmentSet: "leather_thief",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  hunter: {
    class: "Warrior",
    level: 8,
    health: 110,
    magicka: 50,
    stamina: 120,
    goldRange: [20, 60],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({ Marksman: 55, Sneak: 40, LightArmor: 35, Alchemy: 25 }),
    equipmentSet: "hide_hunter",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  farmer: {
    class: "Citizen",
    level: 4,
    health: 80,
    magicka: 50,
    stamina: 90,
    goldRange: [5, 20],
    isGuard: false,
    isEssential: false,
    isChild: false,
    skills: skills({}),
    equipmentSet: "farm_clothes",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  jarl: {
    class: "Citizen",
    level: 15,
    health: 120,
    magicka: 50,
    stamina: 100,
    goldRange: [500, 1000],
    isGuard: false,
    isEssential: true,
    isChild: false,
    skills: skills({ Speech: 65, OneHanded: 40 }),
    equipmentSet: "fine_clothes",
    factions: ["JarlFaction"],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  housecarl: {
    class: "Warrior",
    level: 20,
    health: 180,
    magicka: 50,
    stamina: 150,
    goldRange: [50, 150],
    isGuard: false,
    isEssential: true,
    isChild: false,
    skills: skills({ OneHanded: 60, Block: 55, HeavyArmor: 55, TwoHanded: 45 }),
    equipmentSet: "steel_plate",
    factions: [],
    keywords: ["ActorTypeNPC"],
    spellSchools: [],
  },
  child: {
    class: "Citizen",
    level: 1,
    health: 50,
    magicka: 50,
    stamina: 50,
    goldRange: [0, 5],
    isGuard: false,
    isEssential: true,
    isChild: true,
    skills: skills({}),
    equipmentSet: "child_clothes",
    factions: [],
    keywords: ["ActorTypeNPC", "ActorTypeChild"],
    spellSchools: [],
  },
};

// ============================================================
// 1c. Equipment Sets
// ============================================================

export const EQUIPMENT_SETS: Record<string, EquipmentSet> = {
  steel_guard: {
    head: { name: "Steel Helmet", type: "Armor", armorRating: 17, value: 125, formID: "0x00013952", keywords: ["ArmorHeavy", "ArmorHelmet"] },
    body: { name: "Guard's Armor", type: "Armor", armorRating: 27, value: 25, formID: "0x0002150E", keywords: ["ArmorHeavy", "ArmorCuirass"] },
    hands: { name: "Steel Nordic Gauntlets", type: "Armor", armorRating: 12, value: 55, formID: "0x00013954", keywords: ["ArmorHeavy", "ArmorGauntlets"] },
    feet: { name: "Steel Boots", type: "Armor", armorRating: 12, value: 55, formID: "0x00013951", keywords: ["ArmorHeavy", "ArmorBoots"] },
    rightHand: { name: "Steel Sword", type: "Weapon", damage: 11, value: 108, formID: "0x00013989", keywords: ["WeapTypeSword"] },
    leftHand: { name: "Steel Shield", type: "Armor", armorRating: 24, value: 150, formID: "0x00013955", keywords: ["ArmorShield"] },
  },
  iron_warrior: {
    body: { name: "Iron Armor", type: "Armor", armorRating: 25, value: 125, formID: "0x00012E49", keywords: ["ArmorHeavy", "ArmorCuirass"] },
    hands: { name: "Iron Gauntlets", type: "Armor", armorRating: 10, value: 25, formID: "0x00012E46", keywords: ["ArmorHeavy", "ArmorGauntlets"] },
    feet: { name: "Iron Boots", type: "Armor", armorRating: 10, value: 25, formID: "0x00012E4B", keywords: ["ArmorHeavy", "ArmorBoots"] },
    rightHand: { name: "Iron Greatsword", type: "Weapon", damage: 16, value: 55, formID: "0x0001359D", keywords: ["WeapTypeGreatsword"] },
  },
  mage_robes: {
    body: { name: "Blue Mage Robes", type: "Armor", armorRating: 0, value: 75, formID: "0x000CEE70", keywords: ["ArmorClothing", "ArmorCuirass", "ClothingRobes"] },
    feet: { name: "Boots", type: "Armor", armorRating: 0, value: 5, formID: "0x000886A8", keywords: ["ArmorClothing", "ArmorBoots"] },
    rightHand: { name: "Staff of Flames", type: "Weapon", damage: 0, value: 215, formID: "0x00029B77", keywords: ["WeapTypeStaff"] },
  },
  fine_clothes: {
    body: { name: "Fine Clothes", type: "Armor", armorRating: 0, value: 45, formID: "0x000CEE70", keywords: ["ArmorClothing", "ArmorCuirass"] },
    feet: { name: "Fine Boots", type: "Armor", armorRating: 0, value: 15, formID: "0x000886A9", keywords: ["ArmorClothing", "ArmorBoots"] },
  },
  leather_thief: {
    body: { name: "Leather Armor", type: "Armor", armorRating: 26, value: 125, formID: "0x0003619E", keywords: ["ArmorLight", "ArmorCuirass"] },
    hands: { name: "Leather Bracers", type: "Armor", armorRating: 7, value: 25, formID: "0x00013921", keywords: ["ArmorLight", "ArmorGauntlets"] },
    feet: { name: "Leather Boots", type: "Armor", armorRating: 7, value: 25, formID: "0x00013920", keywords: ["ArmorLight", "ArmorBoots"] },
    rightHand: { name: "Iron Dagger", type: "Weapon", damage: 5, value: 10, formID: "0x0001397E", keywords: ["WeapTypeDagger"] },
  },
  hide_hunter: {
    body: { name: "Hide Armor", type: "Armor", armorRating: 20, value: 50, formID: "0x00013911", keywords: ["ArmorLight", "ArmorCuirass"] },
    feet: { name: "Hide Boots", type: "Armor", armorRating: 5, value: 10, formID: "0x00013910", keywords: ["ArmorLight", "ArmorBoots"] },
    rightHand: { name: "Hunting Bow", type: "Weapon", damage: 7, value: 50, formID: "0x00013985", keywords: ["WeapTypeBow"] },
  },
  farm_clothes: {
    body: { name: "Farm Clothes", type: "Armor", armorRating: 0, value: 5, formID: "0x000209A4", keywords: ["ArmorClothing", "ArmorCuirass"] },
    feet: { name: "Boots", type: "Armor", armorRating: 0, value: 5, formID: "0x000886A8", keywords: ["ArmorClothing", "ArmorBoots"] },
  },
  barkeeper: {
    body: { name: "Barkeeper's Clothes", type: "Armor", armorRating: 0, value: 15, formID: "0x000D191F", keywords: ["ArmorClothing", "ArmorCuirass"] },
    feet: { name: "Shoes", type: "Armor", armorRating: 0, value: 5, formID: "0x000886AB", keywords: ["ArmorClothing", "ArmorBoots"] },
  },
  smithing: {
    body: { name: "Blacksmith's Apron", type: "Armor", armorRating: 0, value: 15, formID: "0x000209A5", keywords: ["ArmorClothing", "ArmorCuirass"] },
    hands: { name: "Gloves", type: "Armor", armorRating: 0, value: 5, formID: "0x000886AA", keywords: ["ArmorClothing", "ArmorGauntlets"] },
    feet: { name: "Boots", type: "Armor", armorRating: 0, value: 5, formID: "0x000886A8", keywords: ["ArmorClothing", "ArmorBoots"] },
  },
  steel_plate: {
    head: { name: "Steel Plate Helmet", type: "Armor", armorRating: 19, value: 300, formID: "0x0001395C", keywords: ["ArmorHeavy", "ArmorHelmet"] },
    body: { name: "Steel Plate Armor", type: "Armor", armorRating: 40, value: 625, formID: "0x0001395B", keywords: ["ArmorHeavy", "ArmorCuirass"] },
    hands: { name: "Steel Plate Gauntlets", type: "Armor", armorRating: 14, value: 125, formID: "0x0001395E", keywords: ["ArmorHeavy", "ArmorGauntlets"] },
    feet: { name: "Steel Plate Boots", type: "Armor", armorRating: 14, value: 125, formID: "0x0001395D", keywords: ["ArmorHeavy", "ArmorBoots"] },
    rightHand: { name: "Steel Sword", type: "Weapon", damage: 11, value: 108, formID: "0x00013989", keywords: ["WeapTypeSword"] },
    leftHand: { name: "Steel Shield", type: "Armor", armorRating: 24, value: 150, formID: "0x00013955", keywords: ["ArmorShield"] },
  },
  child_clothes: {
    body: { name: "Child's Clothes", type: "Armor", armorRating: 0, value: 2, formID: "0x000209B3", keywords: ["ArmorClothing", "ArmorCuirass"] },
    feet: { name: "Child's Shoes", type: "Armor", armorRating: 0, value: 2, formID: "0x000209B4", keywords: ["ArmorClothing", "ArmorBoots"] },
  },
};

// ============================================================
// 1d. Known NPCs (~50 well-known NPCs)
// ============================================================

export const KNOWN_NPCS: Record<string, KnownNpcDef> = {
  // --- Whiterun ---
  "Hulda": { archetype: "innkeeper", voiceType: "FemaleCommoner", factions: ["WhiterunFaction"], isMerchant: true, merchantType: "innkeeper" },
  "Saadia": { archetype: "innkeeper", voiceType: "FemaleCommoner", factions: ["WhiterunFaction"] },
  "Balgruuf the Greater": { archetype: "jarl", isEssential: true, factions: ["WhiterunFaction", "JarlFaction"] },
  "Balgruuf": { archetype: "jarl", isEssential: true, factions: ["WhiterunFaction", "JarlFaction"] },
  "Proventus Avenicci": { archetype: "noble", factions: ["WhiterunFaction"], voiceType: "MaleEvenToned" },
  "Adrianne Avenicci": { archetype: "blacksmith", factions: ["WhiterunFaction"], isMerchant: true, merchantType: "blacksmith" },
  "Ulfberth War-Bear": { archetype: "blacksmith", factions: ["WhiterunFaction"], isMerchant: true, merchantType: "blacksmith" },
  "Farengar Secret-Fire": { archetype: "mage", factions: ["WhiterunFaction"], class: "Court Wizard" },
  "Lydia": { archetype: "housecarl", isEssential: true, factions: ["WhiterunFaction"] },
  "Irileth": { archetype: "housecarl", isEssential: true, factions: ["WhiterunFaction"], voiceType: "FemaleDarkElf" },
  "Belethor": { archetype: "merchant", factions: ["WhiterunFaction"], isMerchant: true, merchantType: "general_goods", voiceType: "MaleEvenToned" },
  "Arcadia": { archetype: "merchant", factions: ["WhiterunFaction"], isMerchant: true, merchantType: "alchemist", voiceType: "FemaleCommoner" },
  "Carlotta Valentia": { archetype: "merchant", factions: ["WhiterunFaction"], isMerchant: true, merchantType: "general_goods", voiceType: "FemaleCommoner" },
  "Mikael": { archetype: "bard", factions: ["WhiterunFaction"] },
  "Nazeem": { archetype: "noble", factions: ["WhiterunFaction"], voiceType: "MaleYoungEager" },
  "Ysolda": { archetype: "merchant", factions: ["WhiterunFaction"], voiceType: "FemaleYoungEager" },
  "Amren": { archetype: "warrior", factions: ["WhiterunFaction"], voiceType: "MaleYoungEager" },
  "Danica Pure-Spring": { archetype: "priest", factions: ["WhiterunFaction"], voiceType: "FemaleCommoner" },
  "Heimskr": { archetype: "priest", factions: ["WhiterunFaction"] },
  "Lars Battle-Born": { archetype: "child", factions: ["WhiterunFaction", "BattleBornFaction"] },
  "Braith": { archetype: "child", factions: ["WhiterunFaction"] },

  // --- Solitude ---
  "Elisif the Fair": { archetype: "jarl", isEssential: true, factions: ["SolitudeFaction", "JarlFaction"], voiceType: "FemaleYoungEager" },
  "Falk Firebeard": { archetype: "noble", factions: ["SolitudeFaction"], isEssential: true },
  "Sybille Stentor": { archetype: "mage", factions: ["SolitudeFaction"], class: "Court Wizard" },
  "Viarmo": { archetype: "bard", factions: ["SolitudeFaction", "BardFaction"], isEssential: true },

  // --- Riften ---
  "Maven Black-Briar": { archetype: "noble", factions: ["RiftenFaction", "ThievesGuildFaction"], isEssential: true, voiceType: "FemaleCommoner" },
  "Brynjolf": { archetype: "thief", factions: ["RiftenFaction", "ThievesGuildFaction"], isEssential: true },
  "Keerava": { archetype: "innkeeper", factions: ["RiftenFaction"], isMerchant: true, merchantType: "innkeeper", voiceType: "FemaleArgonian" },
  "Maramal": { archetype: "priest", factions: ["RiftenFaction"], voiceType: "MaleYoungEager" },

  // --- Windhelm ---
  "Ulfric Stormcloak": { archetype: "jarl", isEssential: true, factions: ["WindhelmFaction", "JarlFaction", "StormcloakFaction"] },
  "Galmar Stone-Fist": { archetype: "warrior", isEssential: true, factions: ["WindhelmFaction", "StormcloakFaction"] },
  "Candlehearth Hall": { archetype: "innkeeper", factions: ["WindhelmFaction"] },
  "Elda Early-Dawn": { archetype: "innkeeper", factions: ["WindhelmFaction"], isMerchant: true, merchantType: "innkeeper", voiceType: "FemaleNord" },
  "Calixto Corrium": { archetype: "merchant", factions: ["WindhelmFaction"], isMerchant: true, merchantType: "general_goods" },

  // --- Markarth ---
  "Igmund": { archetype: "jarl", isEssential: true, factions: ["MarkarthFaction", "JarlFaction"] },
  "Calcelmo": { archetype: "mage", factions: ["MarkarthFaction"], isEssential: true, voiceType: "MaleElfHaughty" },
  "Muiri": { archetype: "merchant", factions: ["MarkarthFaction"], isMerchant: true, merchantType: "alchemist" },

  // --- Falkreath ---
  "Siddgeir": { archetype: "jarl", isEssential: true, factions: ["FalkreathFaction", "JarlFaction"] },
  "Valga Vinicia": { archetype: "innkeeper", factions: ["FalkreathFaction"], isMerchant: true, merchantType: "innkeeper" },

  // --- Winterhold ---
  "Korir": { archetype: "jarl", isEssential: true, factions: ["WinterholdFaction", "JarlFaction"] },
  "Savos Aren": { archetype: "mage", factions: ["CollegeOfWinterholdFaction"], isEssential: true, voiceType: "MaleDarkElf" },
  "Mirabelle Ervine": { archetype: "mage", factions: ["CollegeOfWinterholdFaction"], isEssential: true, voiceType: "FemaleEvenToned" },
  "Tolfdir": { archetype: "mage", factions: ["CollegeOfWinterholdFaction"], isEssential: true },
  "J'zargo": { archetype: "mage", factions: ["CollegeOfWinterholdFaction"], voiceType: "MaleKhajiit" },

  // --- Dawnstar ---
  "Skald the Elder": { archetype: "jarl", isEssential: true, factions: ["DawnstarFaction", "JarlFaction"] },

  // --- Morthal ---
  "Idgrod Ravencrone": { archetype: "jarl", isEssential: true, factions: ["MorthalFaction", "JarlFaction"], voiceType: "FemaleCommoner" },

  // --- Companions ---
  "Kodlak Whitemane": { archetype: "warrior", isEssential: true, factions: ["CompanionsFaction"], class: "Harbinger" },
  "Vilkas": { archetype: "warrior", isEssential: true, factions: ["CompanionsFaction"] },
  "Farkas": { archetype: "warrior", isEssential: true, factions: ["CompanionsFaction"] },
  "Aela the Huntress": { archetype: "hunter", isEssential: true, factions: ["CompanionsFaction"], voiceType: "FemaleNord" },

  // --- Other ---
  "Delphine": { archetype: "warrior", isEssential: true, factions: ["BladesFaction"], voiceType: "FemaleEvenToned" },
  "Esbern": { archetype: "mage", isEssential: true, factions: ["BladesFaction"] },
  "Serana": { archetype: "mage", isEssential: true, factions: ["DawnguardFaction"], voiceType: "FemaleYoungEager" },
  "Astrid": { archetype: "thief", isEssential: true, factions: ["DarkBrotherhoodFaction"], voiceType: "FemaleCommoner" },
};

// ============================================================
// 1e. Location Data
// ============================================================

const INDOOR_KEYWORDS = [
  "inn", "hall", "temple", "keep", "palace", "house", "shop", "store",
  "cave", "mine", "barrow", "tower", "tavern", "mare", "hearth",
  "flagon", "cistern", "quarters", "chamber",
];

export const LOCATIONS: Record<string, LocationDef> = {
  Whiterun: { hold: "Whiterun Hold", crimeFaction: "WhiterunCrimeFaction", defaultFactions: ["WhiterunFaction"] },
  Dragonsreach: { hold: "Whiterun Hold", crimeFaction: "WhiterunCrimeFaction", defaultFactions: ["WhiterunFaction"] },
  "Bannered Mare": { hold: "Whiterun Hold", crimeFaction: "WhiterunCrimeFaction", defaultFactions: ["WhiterunFaction"] },
  "Breezehome": { hold: "Whiterun Hold", crimeFaction: "WhiterunCrimeFaction", defaultFactions: ["WhiterunFaction"] },
  Jorrvaskr: { hold: "Whiterun Hold", crimeFaction: "WhiterunCrimeFaction", defaultFactions: ["WhiterunFaction", "CompanionsFaction"] },
  Solitude: { hold: "Haafingar", crimeFaction: "SolitudeCrimeFaction", defaultFactions: ["SolitudeFaction"] },
  "Blue Palace": { hold: "Haafingar", crimeFaction: "SolitudeCrimeFaction", defaultFactions: ["SolitudeFaction"] },
  "Bards College": { hold: "Haafingar", crimeFaction: "SolitudeCrimeFaction", defaultFactions: ["SolitudeFaction", "BardFaction"] },
  Riften: { hold: "The Rift", crimeFaction: "RiftenCrimeFaction", defaultFactions: ["RiftenFaction"] },
  "Bee and Barb": { hold: "The Rift", crimeFaction: "RiftenCrimeFaction", defaultFactions: ["RiftenFaction"] },
  "Ragged Flagon": { hold: "The Rift", crimeFaction: "RiftenCrimeFaction", defaultFactions: ["RiftenFaction", "ThievesGuildFaction"] },
  Windhelm: { hold: "Eastmarch", crimeFaction: "WindhelmCrimeFaction", defaultFactions: ["WindhelmFaction"] },
  "Palace of the Kings": { hold: "Eastmarch", crimeFaction: "WindhelmCrimeFaction", defaultFactions: ["WindhelmFaction"] },
  Markarth: { hold: "The Reach", crimeFaction: "MarkarthCrimeFaction", defaultFactions: ["MarkarthFaction"] },
  Understone: { hold: "The Reach", crimeFaction: "MarkarthCrimeFaction", defaultFactions: ["MarkarthFaction"] },
  Falkreath: { hold: "Falkreath Hold", crimeFaction: "FalkreathCrimeFaction", defaultFactions: ["FalkreathFaction"] },
  Morthal: { hold: "Hjaalmarch", crimeFaction: "MorthalCrimeFaction", defaultFactions: ["MorthalFaction"] },
  Dawnstar: { hold: "The Pale", crimeFaction: "DawnstarCrimeFaction", defaultFactions: ["DawnstarFaction"] },
  Winterhold: { hold: "Winterhold", crimeFaction: "WinterholdCrimeFaction", defaultFactions: ["WinterholdFaction"] },
  "College of Winterhold": { hold: "Winterhold", crimeFaction: "WinterholdCrimeFaction", defaultFactions: ["WinterholdFaction", "CollegeOfWinterholdFaction"] },
  Riverwood: { hold: "Whiterun Hold", crimeFaction: "WhiterunCrimeFaction", defaultFactions: ["WhiterunFaction"] },
  "Sleeping Giant Inn": { hold: "Whiterun Hold", crimeFaction: "WhiterunCrimeFaction", defaultFactions: ["WhiterunFaction"] },
  Helgen: { hold: "Falkreath Hold", crimeFaction: "FalkreathCrimeFaction", defaultFactions: ["FalkreathFaction"] },
  Ivarstead: { hold: "The Rift", crimeFaction: "RiftenCrimeFaction", defaultFactions: ["RiftenFaction"] },
  "High Hrothgar": { hold: "The Rift", crimeFaction: "RiftenCrimeFaction", defaultFactions: [] },
};

/**
 * Determine if a location is indoors based on keyword matching.
 */
export function isLocationIndoors(location: string): boolean {
  const lower = location.toLowerCase();
  return INDOOR_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Find the best matching LocationDef for a location string.
 * Does exact match first, then substring match.
 */
export function findLocation(location: string): LocationDef | null {
  // Exact match
  if (LOCATIONS[location]) return LOCATIONS[location];
  // Substring match — find the longest matching key
  let best: LocationDef | null = null;
  let bestLen = 0;
  for (const [key, def] of Object.entries(LOCATIONS)) {
    if (location.includes(key) || key.includes(location)) {
      if (key.length > bestLen) {
        best = def;
        bestLen = key.length;
      }
    }
  }
  return best;
}

// ============================================================
// 1f. Mood System
// ============================================================

export const MOODS_LIST: string[] = [
  "Happy", "Sad", "Angry", "Afraid", "Disgusted", "Surprised",
  "Neutral", "Suspicious", "Amused", "Bored", "Confused", "Determined",
  "Grateful", "Jealous", "Nervous", "Proud",
];

export const MOOD_DESCRIPTIONS: Record<string, string> = {
  Happy: "Feeling cheerful and content",
  Sad: "Feeling sorrowful or melancholic",
  Angry: "Feeling hostile or irritated",
  Afraid: "Feeling fearful or anxious",
  Disgusted: "Feeling revulsion or strong disapproval",
  Surprised: "Feeling caught off guard or astonished",
  Neutral: "Feeling calm and even-tempered",
  Suspicious: "Feeling distrustful or wary",
  Amused: "Feeling entertained or finding humor in the situation",
  Bored: "Feeling uninterested or unstimulated",
  Confused: "Feeling uncertain or bewildered",
  Determined: "Feeling resolute and focused on a goal",
  Grateful: "Feeling thankful and appreciative",
  Jealous: "Feeling envious of another's possessions or qualities",
  Nervous: "Feeling uneasy or apprehensive",
  Proud: "Feeling self-satisfied and confident",
};

// ============================================================
// 1g. Spell Database
// ============================================================

export const SPELLS_BY_SCHOOL: Record<string, SpellDef[]> = {
  Destruction: [
    { name: "Flames", school: "Destruction", spellType: "Spell", castingType: "Concentration", delivery: "Aimed", magickaCost: 14, chargeTime: 0, isTwoHanded: false, isHostile: true },
    { name: "Frostbite", school: "Destruction", spellType: "Spell", castingType: "Concentration", delivery: "Aimed", magickaCost: 16, chargeTime: 0, isTwoHanded: false, isHostile: true },
    { name: "Sparks", school: "Destruction", spellType: "Spell", castingType: "Concentration", delivery: "Aimed", magickaCost: 18, chargeTime: 0, isTwoHanded: false, isHostile: true },
    { name: "Firebolt", school: "Destruction", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 41, chargeTime: 0.5, isTwoHanded: false, isHostile: true },
    { name: "Ice Spike", school: "Destruction", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 48, chargeTime: 0.5, isTwoHanded: false, isHostile: true },
    { name: "Lightning Bolt", school: "Destruction", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 51, chargeTime: 0.5, isTwoHanded: false, isHostile: true },
    { name: "Fireball", school: "Destruction", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 133, chargeTime: 1.0, isTwoHanded: false, isHostile: true },
    { name: "Chain Lightning", school: "Destruction", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 156, chargeTime: 1.0, isTwoHanded: false, isHostile: true },
  ],
  Conjuration: [
    { name: "Raise Zombie", school: "Conjuration", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 103, chargeTime: 1.0, isTwoHanded: false, isHostile: false },
    { name: "Conjure Familiar", school: "Conjuration", spellType: "Spell", castingType: "FireAndForget", delivery: "Self", magickaCost: 107, chargeTime: 1.0, isTwoHanded: false, isHostile: false },
    { name: "Bound Sword", school: "Conjuration", spellType: "Spell", castingType: "FireAndForget", delivery: "Self", magickaCost: 93, chargeTime: 0.5, isTwoHanded: false, isHostile: false },
    { name: "Conjure Flame Atronach", school: "Conjuration", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 150, chargeTime: 1.0, isTwoHanded: false, isHostile: false },
    { name: "Soul Trap", school: "Conjuration", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 107, chargeTime: 0.5, isTwoHanded: false, isHostile: true },
    { name: "Reanimate Corpse", school: "Conjuration", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 144, chargeTime: 1.0, isTwoHanded: false, isHostile: false },
  ],
  Alteration: [
    { name: "Oakflesh", school: "Alteration", spellType: "Spell", castingType: "FireAndForget", delivery: "Self", magickaCost: 103, chargeTime: 0.5, isTwoHanded: false, isHostile: false },
    { name: "Candlelight", school: "Alteration", spellType: "Spell", castingType: "FireAndForget", delivery: "Self", magickaCost: 21, chargeTime: 0.5, isTwoHanded: false, isHostile: false },
    { name: "Magelight", school: "Alteration", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 84, chargeTime: 0.5, isTwoHanded: false, isHostile: false },
    { name: "Stoneflesh", school: "Alteration", spellType: "Spell", castingType: "FireAndForget", delivery: "Self", magickaCost: 194, chargeTime: 0.5, isTwoHanded: false, isHostile: false },
    { name: "Telekinesis", school: "Alteration", spellType: "Spell", castingType: "Concentration", delivery: "Aimed", magickaCost: 22, chargeTime: 0, isTwoHanded: false, isHostile: false },
    { name: "Detect Life", school: "Alteration", spellType: "Spell", castingType: "Concentration", delivery: "Self", magickaCost: 100, chargeTime: 0, isTwoHanded: false, isHostile: false },
  ],
  Restoration: [
    { name: "Healing", school: "Restoration", spellType: "Spell", castingType: "Concentration", delivery: "Self", magickaCost: 12, chargeTime: 0, isTwoHanded: false, isHostile: false },
    { name: "Lesser Ward", school: "Restoration", spellType: "Spell", castingType: "Concentration", delivery: "Self", magickaCost: 34, chargeTime: 0, isTwoHanded: false, isHostile: false },
    { name: "Fast Healing", school: "Restoration", spellType: "Spell", castingType: "FireAndForget", delivery: "Self", magickaCost: 73, chargeTime: 0.5, isTwoHanded: false, isHostile: false },
    { name: "Steadfast Ward", school: "Restoration", spellType: "Spell", castingType: "Concentration", delivery: "Self", magickaCost: 58, chargeTime: 0, isTwoHanded: false, isHostile: false },
    { name: "Turn Undead", school: "Restoration", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 84, chargeTime: 0.5, isTwoHanded: false, isHostile: true },
    { name: "Close Wounds", school: "Restoration", spellType: "Spell", castingType: "FireAndForget", delivery: "Self", magickaCost: 126, chargeTime: 0.5, isTwoHanded: false, isHostile: false },
  ],
  Illusion: [
    { name: "Clairvoyance", school: "Illusion", spellType: "Spell", castingType: "Concentration", delivery: "Self", magickaCost: 25, chargeTime: 0, isTwoHanded: false, isHostile: false },
    { name: "Courage", school: "Illusion", spellType: "Spell", castingType: "FireAndForget", delivery: "TargetActor", magickaCost: 39, chargeTime: 0.5, isTwoHanded: false, isHostile: false },
    { name: "Fury", school: "Illusion", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 67, chargeTime: 0.5, isTwoHanded: false, isHostile: true },
    { name: "Calm", school: "Illusion", spellType: "Spell", castingType: "FireAndForget", delivery: "Aimed", magickaCost: 67, chargeTime: 0.5, isTwoHanded: false, isHostile: true },
    { name: "Muffle", school: "Illusion", spellType: "Spell", castingType: "FireAndForget", delivery: "Self", magickaCost: 144, chargeTime: 0.5, isTwoHanded: false, isHostile: false },
    { name: "Invisibility", school: "Illusion", spellType: "Spell", castingType: "FireAndForget", delivery: "Self", magickaCost: 334, chargeTime: 1.0, isTwoHanded: false, isHostile: false },
  ],
};

// ============================================================
// 1h. Merchant Inventory Templates
// ============================================================

export const MERCHANT_INVENTORIES: Record<string, MerchantTemplate> = {
  general_goods: {
    vendorFaction: "VendorGeneralFaction",
    startHour: 8,
    endHour: 20,
    buysStolen: false,
    items: [
      { name: "Linen Wrap", count: 5, value: 1, type: "Misc" },
      { name: "Iron Ingot", count: 3, value: 7, type: "Misc" },
      { name: "Salt Pile", count: 4, value: 2, type: "Ingredient" },
      { name: "Leather Strips", count: 10, value: 3, type: "Misc" },
      { name: "Torch", count: 5, value: 2, type: "Misc" },
      { name: "Tankard", count: 3, value: 1, type: "Misc" },
      { name: "Petty Soul Gem", count: 2, value: 25, type: "SoulGem" },
    ],
  },
  alchemist: {
    vendorFaction: "VendorAlchemistFaction",
    startHour: 8,
    endHour: 20,
    buysStolen: false,
    items: [
      { name: "Cure Disease Potion", count: 3, value: 79, type: "Potion" },
      { name: "Potion of Minor Healing", count: 5, value: 18, type: "Potion" },
      { name: "Potion of Minor Magicka", count: 3, value: 18, type: "Potion" },
      { name: "Blue Mountain Flower", count: 8, value: 2, type: "Ingredient" },
      { name: "Lavender", count: 5, value: 1, type: "Ingredient" },
      { name: "Red Mountain Flower", count: 6, value: 2, type: "Ingredient" },
      { name: "Wheat", count: 4, value: 5, type: "Ingredient" },
      { name: "Salt Pile", count: 5, value: 2, type: "Ingredient" },
    ],
  },
  blacksmith: {
    vendorFaction: "VendorBlacksmithFaction",
    startHour: 8,
    endHour: 20,
    buysStolen: false,
    items: [
      { name: "Iron Ingot", count: 10, value: 7, type: "Misc" },
      { name: "Steel Ingot", count: 5, value: 20, type: "Misc" },
      { name: "Leather Strips", count: 10, value: 3, type: "Misc" },
      { name: "Iron Sword", count: 2, value: 25, type: "Weapon" },
      { name: "Iron Shield", count: 1, value: 60, type: "Armor" },
      { name: "Hide Armor", count: 1, value: 50, type: "Armor" },
      { name: "Leather", count: 5, value: 10, type: "Misc" },
    ],
  },
  innkeeper: {
    vendorFaction: "VendorInnkeeperFaction",
    startHour: 6,
    endHour: 24,
    buysStolen: false,
    items: [
      { name: "Bread", count: 5, value: 2, type: "Food" },
      { name: "Cheese Wheel", count: 2, value: 10, type: "Food" },
      { name: "Cooked Beef", count: 3, value: 3, type: "Food" },
      { name: "Apple", count: 4, value: 2, type: "Food" },
      { name: "Ale", count: 10, value: 5, type: "Food" },
      { name: "Mead", count: 8, value: 5, type: "Food" },
      { name: "Wine", count: 5, value: 7, type: "Food" },
      { name: "Alto Wine", count: 3, value: 12, type: "Food" },
      { name: "Sweet Roll", count: 3, value: 2, type: "Food" },
    ],
  },
  spell_vendor: {
    vendorFaction: "VendorSpellFaction",
    startHour: 8,
    endHour: 20,
    buysStolen: false,
    items: [
      { name: "Spell Tome: Flames", count: 1, value: 50, type: "Book" },
      { name: "Spell Tome: Healing", count: 1, value: 50, type: "Book" },
      { name: "Spell Tome: Oakflesh", count: 1, value: 95, type: "Book" },
      { name: "Spell Tome: Conjure Familiar", count: 1, value: 97, type: "Book" },
      { name: "Spell Tome: Courage", count: 1, value: 78, type: "Book" },
      { name: "Common Soul Gem", count: 2, value: 50, type: "SoulGem" },
    ],
  },
};

// ============================================================
// Utility: collect all equipment items for formID lookup
// ============================================================

const ALL_ITEMS_BY_FORM_ID = new Map<string, EquipmentItem>();

for (const set of Object.values(EQUIPMENT_SETS)) {
  for (const item of Object.values(set)) {
    if (item) ALL_ITEMS_BY_FORM_ID.set(item.formID, item);
  }
}

export function getItemByFormID(formID: string): EquipmentItem | undefined {
  return ALL_ITEMS_BY_FORM_ID.get(formID);
}
