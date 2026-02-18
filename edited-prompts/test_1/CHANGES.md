# v1.0 — Forensic Linguistics-Informed Dialogue Authenticity

Targeted edits to reduce AI-sounding dialogue patterns identified through forensic linguistics, stylometry, and AI detection research. All changes use positive instructions only (~180 tokens added in dialogue mode).

## New Files

### `guidelines/0600_dialogue_authenticity.prompt`
Core anti-AI-pattern injection. Positioned between roleplay guidelines (0500) and response format (0900).

**Dialogue modes** (`full`/`transform`):
- Contractions and sentence length variation (burstiness)
- Plain, direct vocabulary over fancy synonyms
- Emotion through speech patterns, not labeling (anti-therapy-speak)
- Subtext: half-answers, sidesteps, going quiet (Gricean violations)
- Conviction and bias over artificial balance

**Thought modes** (`thoughts`/`book`):
- Sentence rhythm variation
- Feelings through thought formation, not labels
- Wandering, contradicting, trailing thoughts

### `target_selectors/dialogue_speaker_selector.prompt` (REVISED)
Restructured speaker selection from a flat criteria list to a decision-tree with explicit turn-taking logic.

**Key improvements:**
- **Concrete anchoring:** Uses `{{ lastSpeaker.name }}` to tell the model exactly who spoke last, eliminating ambiguity when parsing event history
- **Step 1 (Direct Address):** If someone was spoken to by name, asked a question, or given a command — they respond. Includes group address handling ("Anyone think...", "Listen up...")
- **Step 2 (Active Conversation):** Let ongoing exchanges finish before switching speakers — prevents bystander hijacking
- **Step 3 (Interjection):** Bystanders only interject when their profile specifically matches
- **Step 4 (Duty/Stakes):** Role or personal connection makes silence unnatural
- **Step 5 (Silence):** Explicit default — "One strong exchange beats two forced ones"
- **User message:** Directs model to check the last event first, reducing parsing errors

## Modified Files

### `system_head/0010_instructions.prompt`
**Added** (dialogue mode only): Voice-to-text tolerance instruction.
> "Player speech is transcribed from voice—treat approximate names and minor wording errors as intended."

Prevents NPCs from reacting to STT transcription errors (e.g., commenting on a misspelled name instead of responding naturally). Scoped to the `full` dialogue mode where the player actually speaks.

### `guidelines/0500_roleplay_guidelines.prompt`
**Added** (dialogue branch only): Register shifting and social marker guidance.
> "Adjust how you speak based on who you're talking to—more formal with authority, more casual with peers, guarded with strangers. Let your character's education, class, and background show in your grammar and word choices."

### `guidelines/0900_response_format.prompt`
Two surgical line edits:

1. **Anti-echo line** — "your own thoughts" → "your own perspective" + "what was said" → "what was said to you" (more specific targeting)
2. **Conversation-advancing line** — "new question, detail, realization, or decision" → "new information, a question, a realization, or even a refusal to answer" (allows indirectness without encouraging multi-character bleed)

### `character_bio/9990_speech_style.prompt`
**Added** instruction line after the Speech Profile header:
> "Match this voice exactly—vocabulary, rhythm, sentence length, and mannerisms:"

Converts the speech profile from a passive reference into an active voice specification.

## Removed (from earlier draft)

### `user_final_instructions/0500_dialogue_voice.prompt` — DELETED
Voice reinforcement in the final user message was redundant with the speech profile header change and was positioned before the action system (0750), causing the model to over-prioritize speech at the expense of action recognition.

### `native_action_selector.prompt` (REVISED)
Restructured post-dialogue action selection for better accuracy and significantly reduced token usage.

**Token savings:**
- NPC profile: `full` → `short_inline` (saves ~200-400 tokens depending on character)
- Nearby actors: removed `short_inline` profiles, kept names + distance only
- Removed verbatim instruction repetition between system and user messages

**Logic improvements:**
- Clarified that actions are **game mechanics** (trading, following, animations), not physical descriptions
- **Step 1 (Explicit Agreement):** NPC agreed to, offered, or initiated something matching an action's description
- **Step 2 (Strong Implication):** Dialogue context satisfies an action's description without stating it directly
- **Step 3 (None):** Conversational dialogue with no game action implied — neutral framing avoids biasing weaker models
- Instructs model to check each action's own description for when it applies, rather than guessing from narration cues

### `target_selectors/player_dialogue_target_selector.prompt` (REVISED)
Restructured player targeting from a flat instruction list to a priority-ordered decision tree.

**Key improvements:**
- **STT awareness:** "Player speech is transcribed from voice — names may be approximate" (in system message AND Check 1)
- **Check 1 (Named Address):** Player named an NPC — match closest name (tolerant of STT errors)
- **Check 2 (Crosshair):** Player is looking at someone — strong targeting signal
- **Check 3 (Ongoing Conversation):** Continue active exchange rather than switching targets
- **Check 4 (Group Address):** Player addressing multiple NPCs — select most relevant by role, stakes, or proximity
- **Check 5 (Proximity + Relevance):** Closest NPC whose role matches the speech content
- **Check 6 (NPC-to-NPC Direction):** Player directing one NPC to address another
- **Check 7 (No Target):** Default to `0`
- Removed redundant instruction blocks — tighter, more scannable prompt

## What's NOT Changed
- Length constraints (`0020_format_rules.prompt`) — already well-tuned
- Narration rules — "1 in 4 responses" frequency is correct
- Character bio blocks other than speech_style — per-character content
- Event history system — works well as-is
- No word blacklists — positive framing ("use plain, direct vocabulary") replaces negative lists

## Token Budget
~195 tokens added in dialogue mode (~4.8% of 4096 budget). Speaker selector is a separate prompt with its own context.
