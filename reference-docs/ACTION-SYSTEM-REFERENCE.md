# SkyrimNet Action System Reference

Actions are **programmed game mechanics** — not physical descriptions or mundane movements. They trigger actual Skyrim gameplay systems (opening menus, applying AI packages, playing animations, transferring items). An NPC can only see actions whose eligibility check passes at that moment.

## Two Execution Paths

| Path | Prompt | When | How |
|------|--------|------|-----|
| **Embedded** | `0750_embedded_actions.prompt` | `embed_actions_in_dialogue` = true | Single LLM call — dialogue + optional ACTION line |
| **Native Selector** | `native_action_selector.prompt` | `embed_actions_in_dialogue` = false | Separate LLM call after dialogue is generated |

When embedded, the NPC outputs dialogue first, then optionally appends `ACTION: Name PARAMS: {...}` on a separate line. When using the native selector, a second LLM call reviews the dialogue and selects an action (or None).

## Built-in Actions (11 total)

### Basic Actions
| Action | Description | Params | When |
|--------|-------------|--------|------|
| **OpenTrade** | Opens barter menu | None | Player explicitly asks to trade AND NPC agrees |
| **AccompanyTarget** | NPC follows player (applies FollowPlayer package) | None | Player specifically requests it |
| **StopAccompanying** | NPC stops following (removes FollowPlayer package) | None | NPC is done accompanying or wants to go home |
| **WaitHere** | NPC waits at current location | None | Player specifically requests it |

### Tavern Actions
| Action | Description | Params | When |
|--------|-------------|--------|------|
| **RentRoom** | Rent a room to player for gold | `{"price": "Int"}` | Player agreed to a price beforehand |

### Animation Actions
| Action | Description | Params | When |
|--------|-------------|--------|------|
| **SlapTarget** | Slap another character | `{"target": "Actor"}` | Not in combat, playable race, not in furniture |
| **Gesture** | Perform an expressive animation | `{"anim": "applaud\|applaud_sarcastic\|drink\|drink_potion\|eat\|laugh\|nervous\|read_note\|pray\|salute\|study\|wave\|wipe_brow"}` | Same eligibility as SlapTarget |

### Companion Actions (only for NPCs in companion faction)
| Action | Description | Params | When |
|--------|-------------|--------|------|
| **CompanionFollow** | Start following player | None | In companion faction + currently waiting |
| **CompanionWait** | Wait at this location | None | In companion faction + not already waiting |
| **CompanionInventory** | Give player access to inventory | None | In companion faction |
| **CompanionGiveTask** | Let player assign a task | None | In companion faction |

## Community Actions (from Action Repository)
| Action | Description |
|--------|-------------|
| **Attack** | Lethal combat, factoring personality and circumstances |
| **Draw Weapon and Threaten** | Brandish weapon as warning |
| **Stop Fighting** | Cease active combat |
| **Drink Health/Magicka/Stamina Potion** | Autonomous potion use |
| **Give Gold** | Creates currency as needed |
| **Give Gold Accounted** | Only transfers existing NPC gold |
| **Start Brawl** | Non-lethal fist fight |
| **CastSpell_Execute** | Cast arbitrary spells |

## GameMaster-Only Actions
These are C++ native actions, not registered via Papyrus:
| Action | Description |
|--------|-------------|
| **StartConversation** | Initiate a new NPC interaction |
| **ContinueConversation** | Maintain an ongoing exchange (topic: 2-6 words) |
| **Narrate** | Environmental narration |
| **None** | No action (not available in continuous mode) |

## Custom Action System (YAML)
Third-party mods define actions as `.yaml` files with:
- **name** + **description** (what the LLM sees)
- **Execution function** (Papyrus function to call)
- **Parameter mapping**: `speaker` (auto), `dynamic` (LLM chooses), `static` (fixed)
- **Eligibility rules**: Decorator-based (faction, distance, combat state, etc.)
- **Cooldowns, priority, event strings**

## Key Architecture Points

1. **Dynamic eligibility** — Only actions passing their eligibility check appear in `eligible_actions`. The LLM never sees actions the NPC can't perform.
2. **Action descriptions use Inja templates** — `{{ player.name }}` is resolved at render time.
3. **The descriptions themselves guide usage** — e.g., OpenTrade's description says "Use ONLY if {{ player.name }} asks to trade and you agree."
4. **Speech before action** — In embedded mode, dialogue must appear before the ACTION line so TTS can start.
5. **One action per response** — Both paths select only ONE action, or None.
6. **Cooldowns** — Default GameMaster cooldown: 120 seconds. Per-action cooldowns configurable.
7. **Action Evaluation model** — DeepSeek V3 (0324) by default.

## Papyrus API

```papyrus
// Register action
int function RegisterAction(String actionName, String description,
    String eligibilityScriptName, String eligibilityFunctionName,
    String executionScriptName, String executionFunctionName,
    String triggeringEventTypesCsv, String categoryStr,
    int defaultPriority, String parameterSchemaJson,
    String customCategory="", String tags="") Global Native

// Other API
int function UnregisterAction(String actionName) Global Native
int function ExecuteAction(string actionName, Actor akOriginator, string argsJson) Global Native
int function SetActionCooldown(string actionName, int cooldownTimeSeconds) Global Native
int function GetRemainingCooldown(string actionName) Global Native
bool function IsActionRegistered(String actionName) Global Native
```
