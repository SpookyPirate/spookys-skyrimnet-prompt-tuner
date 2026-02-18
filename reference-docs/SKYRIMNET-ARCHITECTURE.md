# SkyrimNet Architecture & Prompt System Documentation

## 1. What is SkyrimNet?

SkyrimNet is an advanced AI integration platform that transforms Skyrim NPCs into dynamic, intelligent characters using LLMs (Large Language Models). It operates as a DLL loaded via SKSE (Skyrim Script Extender), running an in-process web server at `localhost:8080` with a full dashboard UI. It uses **OpenRouter** as its LLM backend and supports multiple TTS engines (XTTS, Zonos, Piper, Chatterbox).

### Key Capabilities
- **3,000+ NPC personalities** with unique backstories, speech styles, and goals
- **Persistent memory system** with vector-based semantic search and importance-weighted recall
- **Streaming LLM responses** for natural dialogue flow
- **Awareness engine** constraining NPC knowledge based on proximity and perception
- **GameMaster system** that orchestrates NPC-to-NPC scenes autonomously
- **Diary system** for NPCs to write personal journal entries
- **Dynamic bio updates** that evolve character profiles over time
- **Universal Translator** that transforms generic dialogue into character-specific speech
- **Embedded action system** where NPCs can perform game actions (follow, trade, attack, etc.)
- **OmniSight** system for environmental/visual descriptions of locations, actors, items, furniture

---

## 2. Technical Architecture

### Core Stack
- **Language:** C++ (DLL core), Papyrus (Skyrim scripting)
- **Template Engine:** **Inja** (C++ template engine, similar to Jinja2 but more limited)
- **Web Interface:** JavaScript/HTML at localhost:8080
- **External APIs:** OpenRouter (LLM), VastAI (optional cloud GPU for TTS)
- **AI Models:** Streaming LLM, embedding models, Whisper (STT), multiple TTS engines

### Directory Structure
```
SKSE/Plugins/         # Core DLL, config, and prompt files
├── SkyrimNet/
│   ├── prompts/      # ALL prompt templates (Inja format)
│   │   ├── *.prompt                    # Top-level prompt templates
│   │   ├── components/                 # Reusable prompt components
│   │   │   ├── context/               # Scene/location context
│   │   │   ├── character_bio_*.prompt  # Character bio renderers
│   │   │   ├── event_history*.prompt   # Event history formatting
│   │   │   └── memory_access.prompt    # Memory retrieval
│   │   ├── submodules/                 # Modular prompt building blocks
│   │   │   ├── system_head/           # System message assembly
│   │   │   ├── character_bio/         # Character profile sections
│   │   │   ├── guidelines/            # Roleplay & format rules
│   │   │   ├── user_final_instructions/ # Final user-message instructions
│   │   │   ├── omnisight_*/           # OmniSight description systems
│   │   │   └── test_decorators/       # Test/debug decorators
│   │   ├── memory/                    # Memory generation/ranking
│   │   ├── helpers/                   # Profile generation, mood eval
│   │   ├── transformers/              # Dialogue transformation
│   │   ├── target_selectors/          # Speaker/target selection
│   │   ├── omnisight/                 # OmniSight description prompts
│   │   ├── translation/              # Translation CSV files
│   │   └── web/                       # Web UI prompts
│   └── characters/   # Per-NPC character prompt files (3000+)
├── Scripts/           # Papyrus script files
└── SkyrimNet.esp      # Plugin file
```

---

## 3. The Prompt System (Inja Templates)

### Template Syntax
SkyrimNet uses **Inja** (NOT Jinja2) — a C++ template engine. Key syntax:

```
{{ variable }}                    # Output variable
{% if condition %}...{% endif %}  # Conditionals
{% for item in list %}...{% endfor %}  # Loops
{# comment #}                    # Comments (not sent to LLM)
{% set x = value %}              # Variable assignment
{% block name %}...{% endblock %} # Template blocks (inheritance)
{% extends "parent.prompt" %}     # Template inheritance
```

**Section Markers** (SkyrimNet-specific, maps to LLM message roles):
```
[ system ]...[ end system ]       # System message
[ user ]...[ end user ]           # User message
[ assistant ]...[ end assistant ] # Assistant message
[ cache ]...[ end cache ]         # Cached content block
```

### Key Template Functions (Decorators)
These are C++ callbacks registered in the Inja engine:

| Function | Description |
|----------|-------------|
| `decnpc(UUID)` | Get NPC data object (name, race, gender, stats, pronouns, etc.) |
| `render_template(name)` | Include another template file |
| `render_subcomponent(name, mode)` | Render a submodule with a render mode |
| `render_character_profile(mode, UUID)` | Render character bio in specified mode |
| `get_scene_context(UUID, targetUUID, mode)` | Get scene/location context |
| `get_relevant_memories(UUID)` | Retrieve semantically relevant memories |
| `get_recent_events(count, filter)` | Get recent event history |
| `format_event(event, mode)` | Format an event for display |
| `get_nearby_npc_list(UUID)` | List nearby NPCs |
| `is_in_combat(UUID)` | Check combat state |
| `is_narration_enabled()` | Check if narration mode is on |
| `get_worn_equipment(UUID)` | Get equipped items |
| `is_follower(UUID)` | Check if NPC is following player |
| `get_location(UUID)` | Get current location name |
| `track_entity_state(UUID, key, value, window)` | Track state changes over time |

### Render Modes
Templates use `render_mode` to control what information is shown:

| Mode | Purpose | Info Shown |
|------|---------|------------|
| `full` | Main dialogue response | Full internal profile + context |
| `transform` | Rewriting generic dialogue | Full profile for voice matching |
| `thoughts` | Internal monologue | Full profile, thought-focused |
| `book` | React to reading a book | Full profile, reading-focused |
| `dialogue_target` | Bio of person being spoken TO | Limited: summary + appearance only |
| `short_inline` | Brief NPC summary | Summary block only |
| `interject_inline` | Interjection triggers | Interject summary only |
| `speech_style` | Speech pattern reference | Speech style block only |
| `equipment` | Equipment listing | Worn equipment only |

---

## 4. Top-Level Prompt Templates (The Main Entry Points)

These are the primary prompts that get sent to the LLM for different scenarios:

### 4.1 `dialogue_response.prompt` — Main NPC Dialogue
**When used:** Player talks to an NPC, NPC responds
**Structure:**
```
[SYSTEM]
  "You are {NPC name}, a {gender} {race} in Skyrim. Speaking to {target}."
  → render_subcomponent("system_head", "full")
    → 0010_instructions.prompt  (Task description)
    → 0020_format_rules.prompt  (Guidelines + length rules)
    → 0100_actor_bios.prompt    (Full character profile of speaker)
    → 0100_actor_bios.prompt    (Dialogue target profile - limited)
    → 0200_scene_context.prompt (Location, nearby NPCs, weather, time)
    → 0250_omnisight.prompt     (Visual scene/location descriptions)
    → 0400_speech_style_bio.prompt (Speech pattern reference)

[EVENT HISTORY - multiple user/assistant turns]
  → event_history.prompt (Recent dialogue, events, time gaps)

[USER]
  → render_subcomponent("user_final_instructions", "full")
    → 0150_environmental_awareness.prompt
    → 0200_combat_status.prompt
    → 0650_audio_tags.prompt (TTS voice tags)
    → 0700_extra_instructions.prompt (narration toggle)
    → 0750_embedded_actions.prompt (available game actions)
    → 0800_direct_narration.prompt
    → 8000_recent_state_changes.prompt (health/equipment changes)
  → Speech Pattern reminder (if universal translator active)
  → "Respond in character now."
```

### 4.2 `player_dialogue.prompt` — NPC Autonomous Speech
**When used:** NPC speaks without direct player interaction (reacting to events, transforming vanilla dialogue, idle speech)
**Structure:**
```
[SYSTEM]
  "You are {NPC}, a {gender} {race} in Skyrim."
  → Triggering event description (if any)
  → render_subcomponent("system_head", "transform")

[EVENT HISTORY]

[USER]
  → If event: "React audibly to this event"
  → If transform: "Transform this line in YOUR voice" + original line
  → If idle: "Say something aloud—a brief spoken reaction"
  → user_final_instructions("transform")
  → "Respond in character now."
```

### 4.3 `player_thoughts.prompt` — NPC Internal Monologue
**When used:** NPC thinks privately (not spoken)
**Structure:**
```
[SYSTEM]
  Character setup + system_head("thoughts")

[EVENT HISTORY]

[USER]
  → Forced thought topic (if specified)
  → Active quests listing
  → React to: combat / book read / event / general moment
  → "1-2 sentences of silent internal thought only"
```

### 4.4 `gamemaster_action_selector.prompt` — GameMaster Scene Director
**When used:** The GameMaster AI decides what happens next in a scene
**Actions:** StartConversation, ContinueConversation, Narrate, None
**Includes:** Scene plan beats, nearby NPC profiles, recent event history

### 4.5 `gamemaster_scene_planner.prompt` — Scene Planning
**When used:** Creating a 4-6 beat scene plan (like a film director)
**Output:** JSON with beats, tone, central tension, escalations

### 4.6 `native_action_selector.prompt` — Post-Dialogue Action Selection
**When used:** After NPC speaks, determine if a game action should follow
**Output:** `ACTION: ActionName` or `ACTION: None`

### 4.7 `diary_entry.prompt` — NPC Diary Writing
**When used:** NPC writes a personal diary entry
**Output:** JSON with importance_score, emotion, and content (markdown)

### 4.8 `dynamic_bio_update.prompt` — Character Evolution
**When used:** Updating NPC bio based on significant events
**Philosophy:** Conservative — "95% of updates should be MINIMAL or require NO CHANGE"

### 4.9 `universal_translator.prompt` — Speech Pattern Transformation
**When used:** Transforming dialogue to match a specific speech pattern
**Uses:** `npc.universalTranslatorSpeechPattern` field for pattern instructions

### 4.10 `native_dialogue_transformer.prompt` — Vanilla Dialogue Rewriting
**When used:** Transforming vanilla Skyrim dialogue lines to be more natural and character-appropriate

### 4.11 `agent_chat.prompt` — In-Game AI Assistant
**When used:** Player queries the AI assistant (extends agent_tools_base)

### 4.12 `warmup.prompt` — Cache Preheating
**When used:** Pre-renders templates to populate Inja callback caches during hotkey prep

---

## 5. Character Profile System

### Character Prompt Files (`.prompt`)
Each NPC has a dedicated file (e.g., `aela_the_huntress_697.prompt`) containing **Inja block definitions** that fill the character_bio submodule template:

```
{% block summary %}...{% endblock %}
{% block interject_summary %}...{% endblock %}
{% block background %}...{% endblock %}
{% block personality %}...{% endblock %}
{% block appearance %}...{% endblock %}
{% block aspirations %}...{% endblock %}
{% block relationships %}...{% endblock %}
{% block occupation %}...{% endblock %}
{% block skills %}...{% endblock %}
{% block speech_style %}...{% endblock %}
```

### Character Bio Submodule Assembly Order
The `character_bio/` submodule files are numbered and assembled in order:

1. **0010_header.prompt** — Name, gender, race, health/magicka/stamina status
2. **0050_physical_activity.prompt** — Walking, sneaking, sprinting, swimming, unconscious
3. **0100_summary.prompt** — `{% block summary %}`
4. **0200_background.prompt** — `{% block background %}`
5. **0300_personality.prompt** — `{% block personality %}`
6. **0310_interject_summary.prompt** — `{% block interject_summary %}`
7. **0320_aspirations.prompt** — `{% block aspirations %}`
8. **0400_appearance.prompt** — OmniSight description or `{% block appearance %}`
9. **0410_equipment.prompt** — Worn equipment with OmniSight item names/descriptions
10. **0500_skills.prompt** — `{% block skills %}`
11. **0600_relationships.prompt** — `{% block relationships %}` + travel history
12. **0700_occupation.prompt** — `{% block occupation %}`
13. **7000_memories_and_progression.prompt** — `{% block long_term_memories %}`
14. **7100_memories.prompt** — Semantically retrieved relevant memories
15. **9000_quest_integrations.prompt** — Active quest knowledge
16. **9990_speech_style.prompt** — `{% block speech_style %}` + creature speech rules + universal translator pattern

---

## 6. The System Head Assembly

The `system_head/` submodule builds the system message content:

1. **0010_instructions.prompt** — Task description (varies by render_mode)
2. **0020_format_rules.prompt** — Guidelines submodule + length rules
3. **0100_actor_bios.prompt** — Full NPC profile + dialogue target profile
4. **0200_scene_context.prompt** — Scene context (location, weather, nearby NPCs, events)
5. **0250_omnisight.prompt** — Visual descriptions of surroundings and location
6. **0400_speech_style_bio.prompt** — Speech style reference

---

## 7. Event History System

The `event_history.prompt` builds the conversation context as alternating user/assistant messages:

- **NPC's own dialogue** → `[assistant]` messages
- **Everything else** (player speech, other NPC speech, events, narration) → `[user]` messages
- **Time gaps** are inserted as narrative breaks ("Several hours pass...", "The next day...")
- **Location changes** are noted inline
- **Time indicators** added for old events ("[Yesterday]", "[Many hours ago]")
- **GameMaster dialogue** shown as `[user]` messages

---

## 8. Writing Style & Tone Controls

### Current Style Injection Points

These are the locations in the prompt system where writing style is defined or can be influenced:

1. **`{% block speech_style %}`** (per-character) — Describes HOW the character speaks
   - Example: "Aela speaks with confident, clipped sentences and a strong Nordic accent..."

2. **`universalTranslatorSpeechPattern`** (per-character field) — A specific speech pattern instruction that gets injected into dialogue prompts and the universal translator

3. **`0500_roleplay_guidelines.prompt`** — Global roleplay instructions
   - "Embody {name} fully. Draw from your character profile..."

4. **`0900_response_format.prompt`** — Global format rules
   - Narration rules, asterisk usage, dialogue-only vs narration mode
   - "Speak in your natural voice. Respond with your own thoughts, not echoes..."

5. **`0020_format_rules.prompt`** — Length constraints
   - Combat: "1 sentence, maximum 14 words"
   - Normal: "1-3 sentences (8-40 words typical). 60 words maximum."
   - Transform: "8-45 words"
   - Thoughts: "8-30 words. First sentence 10 words or fewer."

6. **`0010_setting.prompt`** (original_prompts/submodules/system_head/) — World setting description
   - Currently nearly empty: just "# Setting"
   - This is explicitly designed for user customization

7. **`diary_entry.prompt`** — Diary-specific writing instructions
   - Extensive style guidance for flowing paragraphs, emotional depth, etc.

8. **`gamemaster_*.prompt`** — Scene direction style
   - "Grounded, gritty, believable—this is Skyrim"

### Key Observation: The Setting Prompt
The file `original_prompts/submodules/system_head/0010_setting.prompt` is **explicitly designed as a user customization point**. Its comment says:
> "This file controls the 'Setting'. You should describe how your particular world of Skyrim plays, and any other setting changes you want to be universally applied."

This file is included in:
- `dynamic_bio_update.prompt`
- `generate_memory.prompt`
- `generate_profile.prompt`
- `character_profile_update.prompt`

---

## 9. Memory System

### Memory Generation (`memory/generate_memory.prompt`)
- Creates first-person memories from NPC perspective
- Outputs JSON: content, location, emotion, importance_score, tags, type
- Types: EXPERIENCE, RELATIONSHIP, KNOWLEDGE, LOCATION, SKILL, TRAUMA, JOY

### Memory Retrieval (`character_bio/7100_memories.prompt`)
- Uses `get_relevant_memories(actorUUID)` — semantic vector search
- Memories include: content, emotion, importance_score, tags
- Injected into character profile during dialogue

### Memory Builder (`memory/memory_builder.prompt`)
- Older/simpler memory summarization system
- Creates summary, details, tags, emotion, memoryType (short/mid/long)

---

## 10. Action System

### Embedded Actions (`user_final_instructions/0750_embedded_actions.prompt`)
NPCs can perform game actions after speaking:
```
ACTION: ActionName PARAMS: {"param": "value"}
```
Available actions are dynamically listed from `eligible_actions` array.

### Native Action Selector (`native_action_selector.prompt`)
A separate LLM call that reviews dialogue and selects an appropriate game action.

---

## 11. OmniSight System

Provides rich environmental descriptions:
- **Actor descriptions** — Visual appearance of NPCs
- **Location descriptions** — Where you are (general knowledge)
- **Scene descriptions** — What you currently see (immediate surroundings)
- **Item descriptions** — Item names and descriptions (gender-aware)
- **Furniture descriptions** — Interactive objects

Each has submodules in `submodules/omnisight_*/` and top-level prompts in `omnisight/`.

---

## 12. Translation System

- `translation/generic/00_SkyrimNet_generic.csv` — Generic translation mappings
- `translation/unique/00_SkyrimNet_unique.csv` — Unique NPC translations
- `transformers/universal_translator.prompt` — Speech pattern transformation
- `transformers/native_dialogue_transformer.prompt` — Vanilla dialogue rewriting

---

## 13. Customization Architecture

### How Prompts Are Loaded
1. SkyrimNet loads `.prompt` files from the `prompts/` directory
2. The Inja engine processes templates, resolving includes and blocks
3. Character profiles are loaded from `characters/` directory
4. The `original_prompts/` directory appears to be an older/alternate prompt set

### Customization Points (Existing)
1. **`0010_setting.prompt`** — Global world/setting description (explicitly for users)
2. **Character `.prompt` files** — Per-NPC personality, background, speech style
3. **`universalTranslatorSpeechPattern`** — Per-NPC speech pattern field
4. **Template overrides** — Any `.prompt` file can be modified/replaced
5. **Submodule files** — Numbered files in submodules can be added/removed

### The Submodule Numbering System
Files in submodule directories are loaded in numerical order:
- `0010_`, `0020_`, `0050_`, `0100_`, etc.
- This allows inserting new files between existing ones
- Example: Adding `0015_custom_style.prompt` between `0010_instructions` and `0020_format_rules`

---

## 14. Implications for a Writing Style Injection Tool

### Where Writing Style Can Be Injected

Based on the architecture, these are the viable injection points:

1. **Global Setting (`0010_setting.prompt`)** — Affects ALL prompts that include it
   - Currently nearly empty, designed for customization
   - Impacts: bio generation, memory generation, profile updates

2. **New Submodule in `system_head/`** — e.g., `0015_writing_style.prompt`
   - Would be included in every dialogue/thought prompt via `render_subcomponent("system_head")`
   - Could contain writing style instructions that apply globally

3. **New Submodule in `guidelines/`** — e.g., `0400_writing_style.prompt`
   - Between roleplay guidelines (0500) and response format (0900)
   - Would affect all dialogue/thought responses

4. **New Submodule in `user_final_instructions/`** — e.g., `0600_writing_style.prompt`
   - Injected into the final user message before "Respond in character now"
   - High-impact position (closest to the response generation)

5. **Modifying `0500_roleplay_guidelines.prompt`** — Add style instructions to existing roleplay rules

6. **Modifying `0900_response_format.prompt`** — Add style rules to format instructions

7. **Per-Character `speech_style` blocks** — Modify individual character speech styles

8. **`universalTranslatorSpeechPattern` field** — Per-character speech transformation

### What the Tool Should Modify
To influence the overall "writing quality" and "realism" of NPC dialogue, the most impactful approach would be:

- **A new global submodule** injected into the system_head or guidelines that provides prose quality instructions
- **Modifications to the response_format** to adjust narration, dialogue, and length rules
- **Optional per-character overrides** for speech style
- **Setting prompt** for world tone and atmosphere

### Token Budget Consideration
Current prompts are already substantial. Any writing style injection needs to be concise to avoid exceeding context windows and increasing API costs. The format rules already enforce strict word limits (8-60 words for dialogue).

---

## 15. Seven Specialized Model Agents

SkyrimNet routes different tasks to different LLM models:

| Agent | Default Model | Purpose |
|-------|--------------|---------|
| **Default** | DeepSeek V3 (0324) | Dialogue generation, combat banter, memories |
| **Game Master** | DeepSeek V3 (0324) | Scene planning, NPC interaction initiation |
| **Memory Generation** | DeepSeek V3 (0324) | First-person memory summarization |
| **Profile Generation** | Claude 3.7 Sonnet | NPC identity creation |
| **Action Evaluation** | DeepSeek V3 (0324) | Action/gesture selection matching dialogue |
| **Meta Evaluation** | Gemini 2.5 Flash | Mood tracking, speaker turns, search queries |
| **Diary Creation** | (configurable) | Diary entry generation |

---

## 16. Memory Retrieval Weights

| Factor | Weight |
|--------|--------|
| Semantic similarity | 0.35 |
| Temporal proximity | 0.20 |
| Actor involvement | 0.20 |
| Emotional match | 0.10 |
| Keyword relevance | 0.10 |
| Location match | 0.05 |

- 5 memories retrieved per query (default)
- Max 1000 memories per NPC, 0.2 importance threshold
- 384-dimensional vectors using MiniLM-L6-v2
- SQLite storage with HNSW indexing
- Memory segmentation: 60-minute gaps, 10-480 minute durations

---

## 17. Configuration Defaults

### LLM Settings
- **Max Context Length**: 4096 tokens
- **Temperature**: ~0.7 (recommended 0.2-0.4 for combat, 0.7-0.85 for roleplay)
- **Event History Count**: 50 recent events for context
- **Request Timeout**: 15 seconds

### GameMaster Settings
- Action Cooldown: 120 seconds
- Nearby Actor Radius: 800 game units
- Continuous Scene Cooldown: 6 seconds

### Hotkeys
- F10: Toggle Continuous GameMaster Mode
- Insert: Direct text input
- O: Voice commands
- F8: Continue narration
- F3: Toggle GameMaster
- X: Toggle world event reactions

---

## 18. Wiki Warnings on Prompt Customization

The official wiki explicitly warns:
> "Changing the prompts too much is not encouraged, unless you really know what you are doing."
> "The LLM already knows how to roleplay. Too many rules = more hallucinations."

### Best Practices from Wiki:
- Use template variables (`{{ decnpc(npc.UUID).name }}`), never hardcode
- Guide tone, don't script dialogue
- Avoid hallucination triggers; trust the memory system
- Avoid excessive "DO NOT" rules
- Avoid walls of verbose instructions
- Avoid lore-dumping in prompts
- Focus on current events + relevant memories, not full storylines

This is critical for our tool — writing style injections must be **concise and additive**, not overwrought instruction sets that fight against the existing prompt system.
