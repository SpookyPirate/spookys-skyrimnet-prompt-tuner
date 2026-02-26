export enum TriggerEventType {
  spell_cast = "spell_cast",
  combat = "combat",
  death = "death",
  equip = "equip",
  activation = "activation",
  hit = "hit",
  book_read = "book_read",
  quest_stage = "quest_stage",
  location_change = "location_change",
  shout_cast = "shout_cast",
  item_pickup = "item_pickup",
  skill_increase = "skill_increase",
}

export interface EventFieldSchema {
  name: string;
  description: string;
  example: string;
  type: "string" | "number" | "boolean";
  suggestions?: string[];
}

export const EVENT_FIELD_SCHEMAS: Record<TriggerEventType, EventFieldSchema[]> = {
  [TriggerEventType.spell_cast]: [
    { name: "spell", description: "Name of the spell cast", example: "Ironflesh", type: "string", suggestions: [
      "Flames", "Frostbite", "Sparks", "Healing", "Fast Healing", "Close Wounds",
      "Ironflesh", "Oakflesh", "Stoneflesh", "Ebonyflesh", "Dragonhide",
      "Fireball", "Ice Storm", "Chain Lightning", "Incinerate", "Icy Spear", "Thunderbolt",
      "Conjure Familiar", "Conjure Flame Atronach", "Conjure Frost Atronach", "Conjure Storm Atronach", "Conjure Dremora Lord",
      "Raise Zombie", "Reanimate Corpse", "Revenant", "Dread Zombie",
      "Soul Trap", "Bound Sword", "Bound Bow",
      "Muffle", "Invisibility", "Calm", "Fear", "Fury", "Courage", "Rally",
      "Clairvoyance", "Candlelight", "Magelight", "Detect Life", "Detect Dead",
      "Paralyze", "Mass Paralysis", "Telekinesis", "Transmute",
      "Ward", "Lesser Ward", "Steadfast Ward", "Greater Ward",
    ] },
    { name: "school", description: "Magic school", example: "Alteration", type: "string", suggestions: [
      "Alteration", "Conjuration", "Destruction", "Enchanting", "Illusion", "Restoration",
    ] },
    { name: "target", description: "Target of the spell", example: "self", type: "string", suggestions: [
      "self", "player", "enemy", "ally", "ground", "object",
    ] },
  ],
  [TriggerEventType.combat]: [
    { name: "state", description: "Combat state", example: "enter", type: "string", suggestions: [
      "enter", "exit", "stagger", "knockdown", "block", "bash", "power_attack", "kill",
    ] },
    { name: "enemy", description: "Enemy involved", example: "Bandit", type: "string", suggestions: [
      "Bandit", "Bandit Chief", "Bandit Marauder", "Draugr", "Draugr Deathlord", "Draugr Scourge",
      "Dragon", "Frost Dragon", "Elder Dragon", "Ancient Dragon", "Legendary Dragon",
      "Wolf", "Bear", "Sabre Cat", "Snowy Sabre Cat", "Ice Wolf", "Cave Bear",
      "Skeleton", "Vampire", "Master Vampire", "Falmer", "Falmer Gloomlurker",
      "Giant", "Mammoth", "Troll", "Frost Troll", "Ice Wraith", "Wisp",
      "Spriggan", "Spriggan Matron", "Hagraven", "Forsworn", "Forsworn Briarheart",
      "Dwarven Sphere", "Dwarven Spider", "Dwarven Centurion",
      "Chaurus", "Frostbite Spider", "Giant Frostbite Spider",
      "Mudcrab", "Horker", "Skeever",
    ] },
  ],
  [TriggerEventType.death]: [
    { name: "victim", description: "Who died", example: "Bandit Chief", type: "string", suggestions: [
      "Bandit", "Bandit Chief", "Draugr", "Dragon", "Wolf", "Bear",
      "Skeleton", "Vampire", "Falmer", "Giant", "Troll", "Frost Troll",
      "Forsworn", "Spriggan", "Hagraven", "Chaurus", "Frostbite Spider",
      "Dwarven Sphere", "Dwarven Centurion", "Mudcrab", "Skeever",
    ] },
    { name: "cause", description: "Cause of death", example: "sword", type: "string", suggestions: [
      "sword", "greatsword", "mace", "war hammer", "battleaxe", "dagger", "bow", "crossbow",
      "fire", "frost", "shock", "poison", "fall", "bleed", "shout", "unarmed",
    ] },
  ],
  [TriggerEventType.equip]: [
    { name: "item", description: "Item equipped", example: "Daedric Sword", type: "string", suggestions: [
      "Iron Sword", "Steel Sword", "Orcish Sword", "Dwarven Sword", "Elven Sword", "Glass Sword", "Ebony Sword", "Daedric Sword", "Dragonbone Sword",
      "Iron Greatsword", "Steel Greatsword", "Ebony Greatsword", "Daedric Greatsword",
      "Hunting Bow", "Long Bow", "Orcish Bow", "Glass Bow", "Ebony Bow", "Daedric Bow", "Dragonbone Bow",
      "Iron Dagger", "Steel Dagger", "Ebony Dagger", "Daedric Dagger", "Blade of Woe",
      "Iron Shield", "Steel Shield", "Ebony Shield", "Daedric Shield",
      "Iron Helmet", "Steel Helmet", "Ebony Helmet", "Daedric Helmet",
      "Hide Armor", "Leather Armor", "Elven Armor", "Glass Armor", "Ebony Armor", "Daedric Armor", "Dragonscale Armor", "Dragonplate Armor",
      "Mage Robes", "Apprentice Robes", "Adept Robes", "Expert Robes", "Master Robes",
      "Staff of Fireballs", "Staff of Ice Storms", "Staff of Chain Lightning",
      "Amulet of Talos", "Amulet of Mara", "Amulet of Arkay",
      "Ring of Minor Smithing", "Ring of Major Alchemy",
    ] },
    { name: "slot", description: "Equipment slot", example: "right_hand", type: "string", suggestions: [
      "right_hand", "left_hand", "both_hands", "head", "body", "hands", "feet", "shield", "amulet", "ring",
    ] },
  ],
  [TriggerEventType.activation]: [
    { name: "object", description: "Activated object", example: "Lever", type: "string", suggestions: [
      "Lever", "Pull Chain", "Button", "Chest", "Door", "Gate",
      "Bed", "Chair", "Throne", "Bench", "Workbench", "Grindstone", "Smelter", "Tanning Rack",
      "Alchemy Lab", "Enchanting Table", "Arcane Enchanter", "Anvil", "Forge",
      "Cooking Pot", "Cooking Spit", "Wood Chopping Block", "Ore Vein",
      "Shrine of Talos", "Shrine of Mara", "Shrine of Arkay", "Shrine of Akatosh",
      "Word Wall", "Dragon Claw Door", "Puzzle Pillar",
      "Trap", "Pressure Plate", "Tripwire",
    ] },
    { name: "type", description: "Object type", example: "furniture", type: "string", suggestions: [
      "furniture", "container", "door", "crafting_station", "shrine", "trap", "puzzle", "activator",
    ] },
  ],
  [TriggerEventType.hit]: [
    { name: "target", description: "Who was hit", example: "Dragon", type: "string", suggestions: [
      "Dragon", "Bandit", "Bandit Chief", "Draugr", "Draugr Deathlord",
      "Wolf", "Bear", "Sabre Cat", "Troll", "Giant",
      "Vampire", "Falmer", "Forsworn", "Skeleton",
      "Dwarven Sphere", "Dwarven Centurion", "Chaurus", "Frostbite Spider",
      "player",
    ] },
    { name: "weapon", description: "Weapon used", example: "Bow", type: "string", suggestions: [
      "Sword", "Greatsword", "Mace", "War Hammer", "Battleaxe", "Dagger",
      "Bow", "Crossbow", "Fists",
      "Fire spell", "Frost spell", "Shock spell",
      "Staff", "Shout",
    ] },
    { name: "damage", description: "Damage dealt", example: "45", type: "number", suggestions: [
      "10", "25", "45", "75", "100", "150", "200", "500",
    ] },
  ],
  [TriggerEventType.book_read]: [
    { name: "title", description: "Book title", example: "The Lusty Argonian Maid", type: "string", suggestions: [
      "The Lusty Argonian Maid", "The Real Barenziah", "A Dance in Fire",
      "The Book of the Dragonborn", "The Song of Pelinal", "Wabbajack",
      "Mystery of Talara", "Thief of Virtue", "Immortal Blood",
      "Lost Legends", "The Aetherium Wars", "Kolb and the Dragon",
      "Physicalities of Werewolves", "Herbalist's Guide to Skyrim",
      "Catalogue of Armor Enchantments", "Enchanter's Primer",
      "Spell Tome: Fireball", "Spell Tome: Healing", "Spell Tome: Invisibility",
      "Skill Book: Heavy Armor", "Skill Book: Light Armor", "Skill Book: One-Handed",
      "Black Book: Epistolary Acumen", "Black Book: The Winds of Change", "Black Book: Untold Legends",
      "Elder Scroll (Dragon)", "Oghma Infinium",
    ] },
    { name: "type", description: "Book type (normal/spell)", example: "normal", type: "string", suggestions: [
      "normal", "spell_tome", "skill_book", "journal", "note", "recipe", "black_book", "elder_scroll",
    ] },
  ],
  [TriggerEventType.quest_stage]: [
    { name: "quest", description: "Quest ID", example: "MQ101", type: "string", suggestions: [
      "MQ101", "MQ102", "MQ103", "MQ104", "MQ105", "MQ106",
      "MQ201", "MQ202", "MQ203", "MQ204", "MQ301", "MQ302", "MQ303", "MQ304",
      "MS01", "MS02", "MS03", "MS04", "MS05", "MS06", "MS07", "MS08", "MS09",
      "DB01", "DB02", "DB03", "DB04", "DB05", "DB06", "DB07", "DB08", "DB09", "DB10", "DB11",
      "TG01", "TG02", "TG03", "TG04", "TG05", "TG06", "TG07", "TG08", "TG09",
      "CW01", "CW02", "CW03",
      "DA01", "DA02", "DA03", "DA04", "DA05", "DA06", "DA07", "DA08", "DA09", "DA10",
      "DA11", "DA13", "DA14", "DA15", "DA16",
      "C00", "C01", "C02", "C03", "C04", "C05", "C06",
      "MG01", "MG02", "MG03", "MG04", "MG05", "MG06", "MG07", "MG08",
    ] },
    { name: "stage", description: "Stage number", example: "50", type: "number", suggestions: [
      "10", "20", "30", "40", "50", "60", "100", "200",
    ] },
  ],
  [TriggerEventType.location_change]: [
    { name: "from", description: "Previous location", example: "Whiterun", type: "string", suggestions: [
      "Whiterun", "Dragonsreach", "Jorrvaskr", "The Bannered Mare", "Breezehome", "Whiterun Stables",
      "Solitude", "Blue Palace", "Castle Dour", "The Winking Skeever", "Proudspire Manor",
      "Windhelm", "Palace of the Kings", "Candlehearth Hall", "Hjerim",
      "Riften", "Mistveil Keep", "The Bee and Barb", "The Ratway", "Honeyside",
      "Markarth", "Understone Keep", "Silver-Blood Inn", "Vlindrel Hall", "Cidhna Mine",
      "Falkreath", "Dead Man's Drink", "Morthal", "Moorside Inn",
      "Dawnstar", "The White Hall", "Winterhold", "College of Winterhold",
      "Riverwood", "Sleeping Giant Inn", "Ivarstead", "Vilemyr Inn",
      "High Hrothgar", "Sky Haven Temple", "Blackreach",
      "Bleak Falls Barrow", "Dustman's Cairn", "Labyrinthian", "Saarthal",
      "Skyrim", "Sovngarde",
    ] },
    { name: "to", description: "New location", example: "Dragonsreach", type: "string", suggestions: [
      "Whiterun", "Dragonsreach", "Jorrvaskr", "The Bannered Mare", "Breezehome", "Whiterun Stables",
      "Solitude", "Blue Palace", "Castle Dour", "The Winking Skeever", "Proudspire Manor",
      "Windhelm", "Palace of the Kings", "Candlehearth Hall", "Hjerim",
      "Riften", "Mistveil Keep", "The Bee and Barb", "The Ratway", "Honeyside",
      "Markarth", "Understone Keep", "Silver-Blood Inn", "Vlindrel Hall", "Cidhna Mine",
      "Falkreath", "Dead Man's Drink", "Morthal", "Moorside Inn",
      "Dawnstar", "The White Hall", "Winterhold", "College of Winterhold",
      "Riverwood", "Sleeping Giant Inn", "Ivarstead", "Vilemyr Inn",
      "High Hrothgar", "Sky Haven Temple", "Blackreach",
      "Bleak Falls Barrow", "Dustman's Cairn", "Labyrinthian", "Saarthal",
      "Skyrim", "Sovngarde",
    ] },
  ],
  [TriggerEventType.shout_cast]: [
    { name: "shout", description: "Shout name", example: "Unrelenting Force", type: "string", suggestions: [
      "Unrelenting Force", "Fire Breath", "Frost Breath",
      "Whirlwind Sprint", "Become Ethereal", "Clear Skies",
      "Storm Call", "Call Dragon", "Dragonrend",
      "Aura Whisper", "Throw Voice", "Disarm",
      "Dismay", "Elemental Fury", "Ice Form",
      "Kyne's Peace", "Marked for Death", "Slow Time",
      "Animal Allegiance", "Call of Valor", "Soul Tear",
      "Bend Will", "Dragon Aspect", "Cyclone", "Battle Fury",
    ] },
    { name: "words", description: "Number of words", example: "3", type: "number", suggestions: [
      "1", "2", "3",
    ] },
  ],
  [TriggerEventType.item_pickup]: [
    { name: "item", description: "Item picked up", example: "Gold (50)", type: "string", suggestions: [
      "Gold (50)", "Gold (100)", "Gold (500)",
      "Health Potion", "Magicka Potion", "Stamina Potion",
      "Potion of Ultimate Healing", "Potion of Ultimate Magicka",
      "Iron Ingot", "Steel Ingot", "Ebony Ingot", "Gold Ingot", "Silver Ingot",
      "Diamond", "Ruby", "Emerald", "Sapphire", "Amethyst", "Garnet", "Flawless Diamond",
      "Lockpick", "Soul Gem (Petty)", "Soul Gem (Common)", "Soul Gem (Greater)", "Soul Gem (Grand)", "Black Soul Gem",
      "Dragon Bone", "Dragon Scale", "Daedra Heart",
      "Wheat", "Blue Mountain Flower", "Red Mountain Flower", "Nightshade", "Deathbell",
      "Iron Arrow", "Steel Arrow", "Ebony Arrow", "Daedric Arrow",
      "Septim", "Key", "Letter", "Journal", "Map",
    ] },
    { name: "type", description: "Item type", example: "currency", type: "string", suggestions: [
      "currency", "potion", "weapon", "armor", "ingredient", "gem", "soul_gem", "key",
      "book", "scroll", "food", "misc", "ammo", "material",
    ] },
  ],
  [TriggerEventType.skill_increase]: [
    { name: "skill", description: "Skill name", example: "Smithing", type: "string", suggestions: [
      "One-Handed", "Two-Handed", "Archery", "Block", "Heavy Armor", "Light Armor",
      "Smithing", "Alchemy", "Enchanting", "Speech", "Lockpicking", "Pickpocket", "Sneak",
      "Destruction", "Conjuration", "Restoration", "Alteration", "Illusion",
    ] },
    { name: "level", description: "New level", example: "50", type: "number", suggestions: [
      "15", "20", "25", "30", "40", "50", "60", "75", "90", "100",
    ] },
  ],
};

export interface TriggerCondition {
  field: string;
  operator: "equals" | "contains" | "starts_with" | "regex" | "gt" | "lt";
  value: string | number;
}

export interface CustomActionYaml {
  name: string;
  description: string;
  parameterSchema?: Record<string, string>;
  category?: string;
}

export interface TriggerYaml {
  name: string;
  description: string;
  eventType: TriggerEventType;
  conditions: TriggerCondition[];
  response: string;
  cooldownSeconds?: number;
  probability?: number;
  priority?: number;
}

export interface SimulatedEvent {
  id: string;
  eventType: TriggerEventType;
  fields: Record<string, string | number>;
  timestamp: number;
}

export interface TriggerMatchResult {
  trigger: TriggerYaml;
  matched: boolean;
  matchedConditions: string[];
  failedConditions: string[];
  renderedResponse?: string;
  blockedReason?: string;
}
