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
}

export const EVENT_FIELD_SCHEMAS: Record<TriggerEventType, EventFieldSchema[]> = {
  [TriggerEventType.spell_cast]: [
    { name: "spell", description: "Name of the spell cast", example: "Ironflesh", type: "string" },
    { name: "school", description: "Magic school", example: "Alteration", type: "string" },
    { name: "target", description: "Target of the spell", example: "self", type: "string" },
  ],
  [TriggerEventType.combat]: [
    { name: "state", description: "Combat state", example: "enter", type: "string" },
    { name: "enemy", description: "Enemy involved", example: "Bandit", type: "string" },
  ],
  [TriggerEventType.death]: [
    { name: "victim", description: "Who died", example: "Bandit Chief", type: "string" },
    { name: "cause", description: "Cause of death", example: "sword", type: "string" },
  ],
  [TriggerEventType.equip]: [
    { name: "item", description: "Item equipped", example: "Daedric Sword", type: "string" },
    { name: "slot", description: "Equipment slot", example: "right_hand", type: "string" },
  ],
  [TriggerEventType.activation]: [
    { name: "object", description: "Activated object", example: "Lever", type: "string" },
    { name: "type", description: "Object type", example: "furniture", type: "string" },
  ],
  [TriggerEventType.hit]: [
    { name: "target", description: "Who was hit", example: "Dragon", type: "string" },
    { name: "weapon", description: "Weapon used", example: "Bow", type: "string" },
    { name: "damage", description: "Damage dealt", example: "45", type: "number" },
  ],
  [TriggerEventType.book_read]: [
    { name: "title", description: "Book title", example: "The Lusty Argonian Maid", type: "string" },
    { name: "type", description: "Book type (normal/spell)", example: "normal", type: "string" },
  ],
  [TriggerEventType.quest_stage]: [
    { name: "quest", description: "Quest ID", example: "MQ101", type: "string" },
    { name: "stage", description: "Stage number", example: "50", type: "number" },
  ],
  [TriggerEventType.location_change]: [
    { name: "from", description: "Previous location", example: "Whiterun", type: "string" },
    { name: "to", description: "New location", example: "Dragonsreach", type: "string" },
  ],
  [TriggerEventType.shout_cast]: [
    { name: "shout", description: "Shout name", example: "Unrelenting Force", type: "string" },
    { name: "words", description: "Number of words", example: "3", type: "number" },
  ],
  [TriggerEventType.item_pickup]: [
    { name: "item", description: "Item picked up", example: "Gold (50)", type: "string" },
    { name: "type", description: "Item type", example: "currency", type: "string" },
  ],
  [TriggerEventType.skill_increase]: [
    { name: "skill", description: "Skill name", example: "Smithing", type: "string" },
    { name: "level", description: "New level", example: "50", type: "number" },
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
