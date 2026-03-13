# Simulation Data Generator

The Prompt Tuner's render pipeline simulates SkyrimNet's C++ engine using ~70 decorator functions. Previously, most returned hardcoded stubs (`false`, `0`, `""`, `[]`), causing unrealistic rendered prompts — generic voice types, empty equipment sections, flat skill distributions, and missing faction data.

The **Simulation Data Generator** replaces those stubs with a dynamic enrichment system that derives plausible Skyrim game data from each NPC's name, race, gender, and the scene context.

## Architecture

Three-layer approach across four files:

```
skyrim-data.ts       Static knowledge base (lookup tables, no logic)
        |
npc-enricher.ts      Enrichment engine (NpcConfig + SceneConfig -> EnrichedNpc)
        |
build-sim-state.ts   Calls enricher, builds enriched SimulationState
        |
assembler.ts         Decorators read enriched data instead of returning stubs
```

All files live in `prompt-tuner/src/lib/pipeline/`.

## Data Flow

1. A render API route (any of the 12) calls `buildFullSimulationState(params)`
2. For each NPC in the scene, `buildNpcObject(npc, scene, allNpcs)` is called
3. Inside `buildNpcObject`, `enrichNpc()` runs the enrichment pipeline:
   - Name lookup in `KNOWN_NPCS` (~50 well-known Skyrim NPCs)
   - Guard heuristic (`/guard/i` name pattern)
   - Jarl prefix detection (`"Jarl "`)
   - Fallback to citizen archetype
4. The enriched data is stored in `enrichedNpcMap: Map<string, EnrichedNpc>` on the `SimulationState`
5. Decorator functions in `assembler.ts` look up enriched data via `getEnrichedNpc(uuid, simState)` instead of returning stubs

## Coverage

Every tab in the app flows through this pipeline. There are no alternative code paths:

| Tab | API Routes | Enriched |
|-----|-----------|----------|
| Chat | `render-dialogue`, `render-target-selector`, `render-speaker-selector`, `render-action-selector` | Yes |
| GM | `render-scene-planner`, `render-gm-action-selector` | Yes |
| Agent | `render-memory-gen`, `render-diary`, `render-bio-update` | Yes |
| Render | `render` (generic) | Yes |
| Benchmark | Posts to render routes via `buildRenderBody()` | Yes |
| Copycat | Posts to render routes via `buildRenderBody()` | Yes |
| AutoTuner | Posts to render routes via `buildRenderBody()` | Yes |

---

## File: `skyrim-data.ts`

Pure data file — all typed constants, no logic. ~766 lines.

### Voice Types

`VOICE_TYPES: Record<string, string>` — 20 entries keyed by `"Gender_Race"`:

```
Male_Nord -> "MaleNord"       Female_Nord -> "FemaleNord"
Male_Imperial -> "MaleEvenToned"  Female_Imperial -> "FemaleCommoner"
Male_DarkElf -> "MaleDarkElf"    Female_HighElf -> "FemaleElfHaughty"
...etc for all 10 races x 2 genders
```

### Archetypes

`ARCHETYPES: Record<string, ArchetypeDef>` — 15 archetypes defining class, level, health/magicka/stamina, gold range, skill distributions, equipment set, default factions, keywords, and spell schools:

| Archetype | Class | Gold | Key Skills | Equipment |
|-----------|-------|------|------------|-----------|
| guard | Warrior | 25-50 | OneHanded 50, Block 45, HeavyArmor 45 | Steel armor + sword + shield |
| warrior | Warrior | 30-80 | OneHanded 55, TwoHanded 50 | Iron armor + greatsword |
| mage | Mage | 50-150 | Destruction 60, Conjuration 50 | Robes + staff |
| merchant | Citizen | 500-2000 | Speech 65 | Fine clothes |
| innkeeper | Citizen | 200-800 | Speech 55 | Barkeeper clothes |
| blacksmith | Citizen | 100-500 | Smithing 65 | Smithing apron |
| noble | Citizen | 200-500 | Speech 55 | Fine clothes |
| bard | Citizen | 30-100 | Speech 60 | Fine clothes |
| priest | Mage | 50-200 | Restoration 60 | Robes |
| thief | Thief | 50-300 | Sneak 55, Pickpocket 50 | Leather armor + dagger |
| hunter | Warrior | 20-60 | Marksman 55 | Hide armor + bow |
| farmer | Citizen | 5-20 | All low | Farm clothes |
| jarl | Citizen | 500-1000 | Speech 65, essential | Fine clothes |
| housecarl | Warrior | 50-150 | OneHanded 60, essential | Steel plate + sword |
| child | Citizen | 0-5 | All low, isChild, essential | Child clothes |

### Equipment Sets

`EQUIPMENT_SETS: Record<string, EquipmentSet>` — 11 pre-built gear loadouts (`steel_guard`, `iron_warrior`, `mage_robes`, `fine_clothes`, `leather_thief`, `hide_hunter`, `farm_clothes`, `barkeeper`, `smithing`, `steel_plate`, `child_clothes`).

Each set has optional slots: `head`, `body`, `hands`, `feet`, `rightHand`, `leftHand`. Each item includes `name`, `type`, `armorRating`/`damage`, `value`, `formID` (fake hex), and `keywords[]`.

### Known NPCs

`KNOWN_NPCS: Record<string, KnownNpcDef>` — ~50 well-known NPCs with archetype assignment, voice type overrides, faction memberships, essential flags, and merchant types.

Examples:
- **Hulda** -> innkeeper, FemaleCommoner voice, WhiterunFaction, merchant (innkeeper)
- **Balgruuf** -> jarl, essential, WhiterunFaction + JarlFaction
- **Lydia** -> housecarl, essential, WhiterunFaction
- **Brynjolf** -> thief, essential, RiftenFaction + ThievesGuildFaction
- **Farengar Secret-Fire** -> mage, WhiterunFaction, Court Wizard class

### Locations

`LOCATIONS: Record<string, LocationDef>` — 25 locations covering all 9 holds plus specific places (Bannered Mare, Dragonsreach, College of Winterhold, etc.). Each defines `hold`, `crimeFaction`, and `defaultFactions`.

Indoor detection uses keyword matching: "inn", "hall", "temple", "keep", "palace", "house", "shop", "cave", "mine", "barrow", "tower", "tavern", "mare", etc.

### Spells

`SPELLS_BY_SCHOOL: Record<string, SpellDef[]>` — 5-8 spells per school (Destruction, Conjuration, Alteration, Restoration, Illusion). Each spell has `name`, `school`, `spellType`, `castingType`, `delivery`, `magickaCost`, `chargeTime`, `isTwoHanded`, `isHostile`.

### Merchant Inventories

`MERCHANT_INVENTORIES: Record<string, MerchantTemplate>` — templates for `general_goods`, `alchemist`, `blacksmith`, `innkeeper`, `spell_vendor`. Each has vendor faction, hours, and 6-9 typical items.

### Moods

`MOODS_LIST` (16 moods) and `MOOD_DESCRIPTIONS` (mood -> human-readable description).

---

## File: `npc-enricher.ts`

Enrichment engine — ~457 lines. Takes basic NPC config and produces full game-state data.

### `enrichNpc(npc, scene, allNpcs) -> EnrichedNpc`

Main enrichment function. Logic flow:

1. **Name lookup** — check `KNOWN_NPCS[displayName]` for archetype + overrides
2. **Guard heuristic** — name matches `/guard/i` -> guard archetype
3. **Jarl detection** — `"Jarl "` prefix -> jarl archetype
4. **Fallback** — unknown NPCs get citizen (farmer) archetype
5. **Voice type** — known NPC override, then `VOICE_TYPES[gender + "_" + normalizedRace]`
6. **Gold** — deterministic from name hash within archetype's gold range
7. **Skills** — archetype base skills with +/-5 hash-based variation per NPC
8. **Equipment** — deep copy of archetype's equipment set
9. **Factions** — merge archetype + known NPC + location-based factions
10. **Spells** — for mage/priest archetypes, select spells based on skill levels (2-4 per school)
11. **Merchant data** — if known NPC has `isMerchant`, attach merchant template

### `EnrichedNpc` type

```typescript
interface EnrichedNpc {
  archetype: string;
  voiceType: string;
  class: string;
  level: number;
  health: number;
  magicka: number;
  stamina: number;
  gold: number;
  isGuard: boolean;
  isEssential: boolean;
  isChild: boolean;
  skills: Record<string, number>;         // All 18 skills
  equipment: EquipmentSet;                // Structured slot data
  equipmentKeywords: Set<string>;         // All keywords from worn items
  factions: string[];                     // Array for templates
  factionSet: Set<string>;               // Set for fast lookups
  keywords: string[];
  spells: SpellDef[];
  merchantData: { isMerchant, merchantType?, template? };
}
```

### Deterministic PRNG

`seedRandom(name)` produces a deterministic pseudo-random number generator from a string hash. This ensures the same NPC always gets the same gold amount, skill variations, etc. across renders.

### Helper functions

| Function | Purpose |
|----------|---------|
| `enrichLocation(location)` | Derives hold, crime faction, indoor status, default factions |
| `getRelationshipRank(factions1, factions2, isFollower)` | Computes 0-3 rank from shared factions |
| `equipmentToInjaValue(equipment)` | Converts EquipmentSet to template-ready format |
| `spellsToInjaValue(spells)` | Converts SpellDef[] to template-ready format |
| `describeOutfit(equipment)` | Generates human-readable outfit description |
| `buildSimpleInventory(enriched)` | Generates role-appropriate inventory (gold, keys, torches) |
| `buildMerchantInventory(enriched)` | Generates full merchant inventory from template |
| `buildOmnisightDescription(enriched, actor)` | Rich visual description using equipment + archetype |

---

## Changes to `build-sim-state.ts`

### `buildNpcObject` signature change

```typescript
// Before:
function buildNpcObject(npc: NpcConfig): Record<string, InjaValue>

// After:
function buildNpcObject(npc, scene?, allNpcs?):
  { npcObj: Record<string, InjaValue>; enriched: EnrichedNpc }
```

Now calls `enrichNpc()` internally and returns both the NPC object (for templates) and the enriched data (for decorators). The NPC object includes:
- Enriched stats (level, health, magicka, stamina from archetype)
- Enriched voice type (race/gender-appropriate)
- Enriched gold (deterministic within archetype range)
- Enriched skills (archetype-based with per-NPC variation)
- Enriched factions and keywords
- Flat skill properties (`oneHanded`, `twoHanded`, etc.) alongside nested `skills` object

### `buildFullSimulationState` changes

- Builds `enrichedNpcMap: Map<string, EnrichedNpc>` for all NPCs (primary + nearby)
- Calls `enrichLocation(scene.location)` for `isIndoors` derivation (replaces hardcoded `false`)
- Includes `enrichedNpcMap` in returned `SimulationState`

---

## Changes to `assembler.ts`

### SimulationState interface

Added: `enrichedNpcMap?: Map<string, EnrichedNpc>`

### Context variables

Added `moodsList` and `moodDescriptions` to `buildContextVariables()`.

### Updated decorators

~25 decorators upgraded from stubs to enriched-data-aware:

**Equipment & Inventory:**
| Decorator | Before | After |
|-----------|--------|-------|
| `get_worn_equipment(uuid)` | `{}` | Structured slot data from enriched equipment |
| `worn_has_keyword(uuid, kw)` | `false` | Checks `enriched.equipmentKeywords` set |
| `get_inventory(uuid)` | `{}` | Role-appropriate inventory (gold, keys, torches) |
| `get_merchant_inventory(uuid)` | `{isMerchant:false}` | Full merchant template if applicable |

**Actor Properties:**
| Decorator | Before | After |
|-----------|--------|-------|
| `get_voice_type(uuid)` | `"MaleNord"` | Race/gender-appropriate voice type |
| `is_essential(uuid)` | `false` | From enriched data (jarls, housecarls, quest NPCs) |
| `is_protected(uuid)` | `false` | Same as is_essential in simulation |
| `is_child(uuid)` | `false` | True for child archetype |
| `get_outfit(uuid)` | `""` | Human-readable outfit description |

**Factions & Relationships:**
| Decorator | Before | After |
|-----------|--------|-------|
| `actor_has_keyword(uuid, kw)` | `false` | Checks enriched keywords |
| `is_in_faction(uuid, faction)` | `false` | Checks enriched faction set |
| `get_faction_rank(uuid, faction)` | `-1` | 0 if in faction, -1 if not |
| `get_relationship_rank(uuid1, uuid2)` | `0` | Computed from shared factions (0-3) |

**Magic:**
| Decorator | Before | After |
|-----------|--------|-------|
| `get_spell_list(uuid)` | `[]` | Archetype-appropriate spells |
| `has_spell(uuid, name)` | `false` | Checks enriched spell list |

**New decorators added:**
| Decorator | Returns |
|-----------|---------|
| `get_visible_npc_list()` | Alias for `get_nearby_npc_list` |
| `mood_description(mood)` | Lookup from `MOOD_DESCRIPTIONS` |
| `get_actor_position_relative_to_camera(uuid)` | Plausible position data from NPC distance |
| `get_actor_position_relative_to_actor(uuid1, uuid2)` | Relative position between two NPCs |
| `get_item_name(formID)` | Equipment item lookup by formID |
| `get_item_name_for_wearer(formID, uuid)` | Same (no gender variants in sim) |
| `get_item_description_for_wearer(formID, uuid)` | Returns `""` |
| `is_item_enabled(formID)` | Returns `true` |
| `to_number(val)` | `Number(val)` or 0 |
| `is_array(val)` | `Array.isArray(val)` |
| `get_diary_entries(uuid, count)` | Returns `[]` |
| `is_walking(uuid)` | Returns `false` |
| `has_magic_archetype(uuid, arch)` | Returns `false` |
| `is_caching_enabled()` | Returns `false` |
| `is_nude(uuid)` | Checks if equipment.body exists |

**Enhanced decorators:**
| Decorator | Enhancement |
|-----------|-------------|
| `get_omnisight_description("actor", uuid)` | Now includes equipment + archetype in description |

### Unchanged decorators

These remain as before (correct behavior already):
- `inJudgmentMode()` -> `false` (guards don't confront player in sim)
- `papyrus_util()` -> `0` (bounty/debt conditionals stay suppressed)
- `get_crime_gold()` -> `{ total: 0, violent: 0, nonViolent: 0 }`
- All quest-related decorators -> empty/false
- All combat status decorators -> false

---

## Example: Before vs After

### Hulda in the Bannered Mare

| Property | Before | After |
|----------|--------|-------|
| Voice type | MaleNord | FemaleCommoner |
| Gold | 100 | ~200-800 (deterministic) |
| Class | Citizen | Citizen |
| Skills | All flat 15-25 | Speech 55, Alchemy 25, rest low |
| Equipment | Empty `{}` | Barkeeper's Clothes, Shoes |
| Factions | `[]` | WhiterunFaction |
| Merchant | `{isMerchant: false}` | Full innkeeper inventory (bread, ale, mead, etc.) |
| Is indoors | `false` | `true` (location contains "Mare") |

### Whiterun Guard

| Property | Before | After |
|----------|--------|-------|
| Voice type | MaleNord | MaleNord (correct for Male Nord) |
| Gold | 100 | ~25-50 |
| Class | Citizen | Warrior |
| Level | 10 | 15 |
| Health | 100 | 150 |
| Skills | All flat | OneHanded 50, Block 45, HeavyArmor 45 |
| Equipment | Empty | Steel Helmet, Guard's Armor, Steel Sword, Steel Shield |
| isGuard | false | true |
| Factions | `[]` | GuardFaction, WhiterunFaction |
| Keywords | `[]` | ActorTypeNPC, Guard |

### Unknown NPC (e.g. "Sven", Male Nord)

| Property | Before | After |
|----------|--------|-------|
| Voice type | MaleNord | MaleNord (race-appropriate) |
| Gold | 100 | ~5-20 (farmer range) |
| Class | Citizen | Citizen |
| Skills | All flat | Base skills with per-NPC variation |
| Equipment | Empty | Farm Clothes, Boots |
| Factions | `[]` | Location-based factions |

---

## Adding New Data

### Adding a known NPC

Add an entry to `KNOWN_NPCS` in `skyrim-data.ts`:

```typescript
"Enthir": {
  archetype: "merchant",
  factions: ["CollegeOfWinterholdFaction"],
  isMerchant: true,
  merchantType: "general_goods",
  voiceType: "MaleElfHaughty",
},
```

### Adding a new archetype

Add to `ARCHETYPES` in `skyrim-data.ts` with all required fields. Create a matching equipment set in `EQUIPMENT_SETS` if needed.

### Adding a new location

Add to `LOCATIONS` in `skyrim-data.ts`:

```typescript
"Lakeview Manor": {
  hold: "Falkreath Hold",
  crimeFaction: "FalkreathCrimeFaction",
  defaultFactions: ["FalkreathFaction"],
},
```

Indoor keywords are checked automatically — add new ones to `INDOOR_KEYWORDS` if needed.

### Adding spells

Add to the appropriate school array in `SPELLS_BY_SCHOOL`. Mage/priest archetypes automatically pick spells based on their `spellSchools` config and skill levels.
