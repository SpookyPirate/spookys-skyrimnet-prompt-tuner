export const ACTION_YAML_TEMPLATE = `# Custom Action Definition
name: MyCustomAction
description: Describe what this action does in-game

# Optional: define parameters the LLM should provide
# parameterSchema:
#   target: "name of the target NPC"
#   intensity: "low|medium|high"
`;

export const TRIGGER_YAML_TEMPLATE = `# Trigger Definition
name: My Custom Trigger
description: Describe when this trigger fires

# Event type that activates this trigger
# Valid types: spell_cast, combat, death, equip, activation, hit,
#   book_read, quest_stage, location_change, shout_cast, item_pickup, skill_increase
eventType: spell_cast

# Conditions that must ALL be true for the trigger to fire
conditions:
  - field: spell
    operator: equals
    value: Ironflesh

# Response text (supports {{ event_json.field }} substitution)
response: "I feel my skin harden as the {{ event_json.spell }} spell takes effect..."

# Optional settings
# probability: 1.0        # 0.0-1.0, chance of firing when conditions match
# cooldownSeconds: 30     # minimum seconds between firings
# priority: 0             # higher priority triggers are checked first
`;
