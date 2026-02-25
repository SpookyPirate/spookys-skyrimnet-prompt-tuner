# Enhanced Speech Style Template

Reference framework for creating enhanced `{% block speech_style %}` content. Based on forensic linguistics research (see `reference-docs/FORENSIC-LINGUISTICS-RESEARCH.md`).

## Why This Works

The current speech_style blocks are **delivery descriptions** — they describe tone, pace, and accent but give the model zero concrete linguistic features. The research shows:

1. **Few-shot examples** are the single highest-leverage technique (Section 8, 11) — more effective than any amount of description
2. **Vocabulary selection** is the #1 ranked dimension for distinguishing speakers (Section 2)
3. **Discourse markers** are #2 — which filler/transition words a person favors ("Well..." vs "Look..." vs "So...")
4. **Sentence length profile** is #3 — short/clipped vs long/winding, and how much it varies
5. **Signature expressions** anchor the character's voice to specific memorable phrases

The enhanced template adds these concrete features while keeping the existing delivery description.

## Token Budget

- Current speech_style blocks: ~40-70 tokens (2-4 sentences of description)
- Enhanced speech_style blocks: ~130-180 tokens (description + features + examples)
- Additional cost: ~80-120 tokens per enhanced character (~2-3% of 4096 budget)
- This is the highest-value token investment available — it directly shapes every word the character says

## The Template Format

```
{% block speech_style %}
[DELIVERY — Keep/refine the existing description. 2-3 sentences about tone, pace, accent, and how delivery shifts with emotion or audience. This is the "how it sounds" layer.]

Voice: [baseline register] | [sentence tendency] | [grammar standard if nonstandard]
Markers: [2-4 discourse markers/fillers they favor — these are the "Well...", "Look...", "I mean..." words]
Vocabulary: [word preferences, metaphor domains, oaths/exclamations, signature phrases]
Under stress: [how anger, fear, sadness, etc. change their speech — structure not labels]
Examples:
- "[typical line — shows their default voice in normal conversation]"
- "[emotional or high-stakes line — shows how their voice shifts under pressure]"
- "[social context line — shows register shift, e.g., speaking to authority vs. peers]"
{% endblock %}
```

## Field Definitions

### Delivery (existing, refined)
The current delivery description — tone, pace, accent, emotional triggers. Keep what's already there but tighten it. This describes the **auditory** quality of the voice.

### Voice
Three quick specs separated by pipes:
- **Baseline register**: casual / informal / neutral / formal / archaic
- **Sentence tendency**: clipped fragments / short and direct / variable / long and winding
- **Grammar standard** (only if nonstandard): e.g., "double negatives", "drops articles", "ain't"

### Markers
The 2-4 discourse markers this character habitually uses. These are unconscious verbal habits — the most reliable real-world marker of individual identity (Mosteller & Wallace, Section 2).

Research mapping (Section 7):
| Marker | Signals | Character fit |
|--------|---------|--------------|
| "Well..." | Consideration, upcoming disagreement | Thoughtful, diplomatic, evasive |
| "Look..." | Asserting authority, pre-disagreement | Commanding, impatient |
| "I mean..." | Self-correction, precision | Anxious, precise, intellectual |
| "You know..." | Appeals to shared experience | Informal, seeking connection |
| "So..." | Summarizing, initiating | Organized, narrative-driven |
| "Anyway..." | Resuming after tangent | Pragmatic, impatient |
| "Right..." | Seeking confirmation or asserting | Collaborative or dominating |
| "Aye..." | Nordic affirmation | Traditional Nord |
| "Hmph." | Dismissal, contempt | Blunt, unimpressed |

### Vocabulary
Key features of their word choices:
- **Metaphor domains**: Where do they draw comparisons from? (forge/steel, nature/seasons, military/battle, trade/coin, magic/arcane, hunting/prey)
- **Oaths/exclamations**: What they say when surprised or angry ("By Ysmir!", "Shor's bones!", "Divines...", "Hmph.")
- **Signature phrases**: 1-2 habitual expressions that are distinctly theirs
- **Register markers**: Words that reveal education/class (e.g., "ain't" vs "I shall", "gonna" vs "I intend to")

### Under Stress
How emotional states change their speech **structure** (not content). Maps directly to the research findings (Section 7, 9):

| Emotion | Speech change |
|---------|--------------|
| Anger | Shorter sentences, blunt, drops politeness markers |
| Sadness | Trails off, incomplete thoughts, simpler words |
| Fear/anxiety | Faster, repetition, verbal stumbling, over-explains |
| Contempt | Measured, deliberate, clipped, understated |
| Joy/excitement | Faster, more varied vocabulary, longer sentences |

Pick the 1-2 emotions most relevant to this character and describe the shift concisely.

### Examples (THE MOST IMPORTANT PART)
3 lines of dialogue that sound like this character and nobody else. These serve as few-shot examples — the model will pattern-match against them more strongly than any description.

**Rules for good examples:**
- Each line should be something this character would realistically say in-game
- Show different facets: normal conversation, under pressure, different social context
- Keep them short (8-20 words each) — these are dialogue lines, not speeches
- Include their discourse markers, vocabulary, and sentence patterns naturally
- Don't make them generic — "I'll protect you" could be anyone. "I am sworn to carry your burdens" is only Lydia.

## Example: Applying the Template to a Blacksmith

### BEFORE (current style):
```
{% block speech_style %}
Speaks in a gruff, no-nonsense tone with a strong Nordic accent. Delivers statements directly with minimal pleasantries. His voice carries the confidence of decades at the forge.
{% endblock %}
```

### AFTER (enhanced):
```
{% block speech_style %}
Gruff, unhurried delivery with a strong Nordic accent. Speaks louder than necessary — years at the forge. Gets quieter and more deliberate when serious, louder when irritated.

Voice: informal | short and direct | standard with occasional "ain't"
Markers: "Look...", "Aye", "Hmph."
Vocabulary: forge/steel/iron metaphors, measures people like materials ("brittle", "tempered"), "by the Nine", rarely uses names — calls people "you" or their trade
Under stress: anger makes him monosyllabic and percussive; worry makes him talk about work instead of feelings
Examples:
- "Aye, the forge doesn't lie. Steel tells you everything about the hand that shaped it."
- "You want it done right, or you want it done today? Pick one."
- "Hmph. Another one who thinks gold buys skill."
{% endblock %}
```

The "before" tells the model about tone. The "after" gives it a complete voice to inhabit — specific words, specific rhythms, specific examples to pattern-match against.

## Workflow for Enhancing a Character

1. **Read the original character file** — all blocks, not just speech_style
2. **Understand who this person is** — personality, background, occupation, relationships
3. **Identify their linguistic fingerprint** using the 10 dimensions:
   - What's their education/class? (→ register, grammar, vocabulary)
   - What's their emotional default? (→ under stress patterns)
   - What's their social role? (→ discourse markers, politeness strategy)
   - What makes them UNLIKE other characters of similar type? (→ signature features)
4. **Write 3 example lines** that sound like ONLY this character
5. **Fill in the template** — delivery, voice, markers, vocabulary, stress, examples
6. **Check token count** — enhanced block should be ~130-180 tokens total
7. **Save to** `edited-prompts/v1.0/characters/[original_filename].prompt`
