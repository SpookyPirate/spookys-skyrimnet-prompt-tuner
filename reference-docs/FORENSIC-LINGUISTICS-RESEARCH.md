# Forensic Linguistics, Stylometry & AI Detection Research
## Applied to SkyrimNet Dialogue Realism

Research compiled from forensic linguistics, stylometry, AI text detection, conversational analysis, and professional dialogue craft. Findings are organized for direct application to SkyrimNet's prompt engineering system.

---

## Table of Contents

1. [Why AI Dialogue Sounds Like AI](#1-why-ai-dialogue-sounds-like-ai)
2. [The Human Linguistic Fingerprint](#2-the-human-linguistic-fingerprint)
3. [Statistical Detection Markers](#3-statistical-detection-markers)
4. [Lexical AI Tells](#4-lexical-ai-tells)
5. [Structural AI Patterns](#5-structural-ai-patterns)
6. [Dialogue-Specific AI Failures](#6-dialogue-specific-ai-failures)
7. [What Makes Human Speech Sound Human](#7-what-makes-human-speech-sound-human)
8. [Building Authentic Character Voices](#8-building-authentic-character-voices)
9. [Professional Dialogue Craft Techniques](#9-professional-dialogue-craft-techniques)
10. [Fantasy/Medieval Dialogue Realism](#10-fantasymedievalElse-dialogue-realism)
11. [LLM Prompt Engineering for Naturalness](#11-llm-prompt-engineering-for-naturalness)
12. [Analysis: Current SkyrimNet Prompt Weaknesses](#12-analysis-current-skyrimnet-prompt-weaknesses)
13. [Prioritized Recommendations](#13-prioritized-recommendations)
14. [Sources](#14-sources)

---

## 1. Why AI Dialogue Sounds Like AI

AI-generated dialogue fails the Turing test for specific, measurable reasons — not vague "it just feels off" intuition. These reasons fall into three categories:

**Statistical predictability.** LLMs select high-probability tokens by design. Every word choice is the "safest" option given the context. Human speech is messier — we pick surprising words, make unusual constructions, and vary our rhythm unpredictably. AI detection tools exploit this: low perplexity (predictable word sequences) and low burstiness (uniform sentence complexity) are the primary signals of machine-generated text.

**Structural uniformity.** AI produces text with remarkably consistent sentence lengths, paragraph structures, and information density. Human writing clusters information unevenly — dwelling on what matters, rushing through what doesn't, leaving gaps for the reader to fill.

**Behavioral tells.** AI characters are too helpful, too articulate about their feelings, too balanced in their opinions, and too smooth in their transitions. Real people are evasive, biased, inarticulate when emotional, and comfortable with silence and non-sequiturs.

---

## 2. The Human Linguistic Fingerprint

Forensic linguistics establishes that every person has an **idiolect** — a unique combination of linguistic habits that functions as a stylistic fingerprint. This is the scientific basis for why characters need to sound distinct from each other.

### What Makes an Idiolect

An idiolect is the cumulative product of:
- **Regional dialect** absorbed from where a person grew up
- **Sociolect** from social class, profession, and education level
- **Life experiences** — jobs, media consumed, people interacted with
- **Personality and cognitive style** — affecting vocabulary breadth, sentence complexity, hedging patterns

### The 10 Dimensions of Character Voice

Forensic linguistics identifies these measurable features as the components of individual voice, ranked by how strongly they differentiate speakers:

| Rank | Feature | What It Means | Example Contrast |
|------|---------|---------------|------------------|
| 1 | **Vocabulary selection** | Which words a person knows and habitually uses | Scholar: "I shall inquire" vs. Farmer: "I'll ask around" |
| 2 | **Discourse marker profile** | Which filler/transition words they favor | "Well..." vs. "Look..." vs. "So..." |
| 3 | **Sentence length profile** | Average length + variation | Short/clipped (avg 5-8 words) vs. long/winding (avg 20-30) |
| 4 | **Register level** | Baseline formality + range of shifting | Always formal vs. shifts casual-to-formal by audience |
| 5 | **Function word ratios** | Pronoun patterns, preposition preferences | I-focused vs. you-focused vs. we-focused speech |
| 6 | **Disfluency profile** | Types and frequency of speech imperfections | Confident (few disfluencies) vs. anxious (many filled pauses) |
| 7 | **Hedging style** | How they express uncertainty | "I think..." vs. "Maybe..." vs. no hedging at all |
| 8 | **Nonstandard grammar** | Which specific nonstandard forms they use | "I ain't done nothing" vs. perfectly standard grammar |
| 9 | **Figurative language** | Metaphor domains, use of irony/sarcasm | Military metaphors vs. nature metaphors vs. trade metaphors |
| 10 | **Information ordering** | Whether they lead with context or conclusion | Build to the point vs. blurt the point then explain |

### Function Words: The Unconscious Fingerprint

The single most reliable marker for distinguishing authors is **function word frequency** — articles, prepositions, pronouns, conjunctions, and auxiliary verbs. These are used unconsciously and don't change with topic.

The landmark Mosteller & Wallace study (1964) correctly attributed all 12 disputed Federalist Papers using only function word frequencies. Even seemingly trivial differences — one author using "upon" at 3.24 per 1000 words while another used it at 0.23 — were sufficient.

**For SkyrimNet:** This means character differentiation should go deeper than "speaks formally" vs. "speaks casually." Characters should have different pronoun habits (I-focused introspective speech vs. you-focused confrontational speech), different conjunction preferences (simple "and" chaining vs. complex subordination), and different preposition choices ("upon" vs. "on").

---

## 3. Statistical Detection Markers

AI text detection relies on three measurable properties:

### Perplexity (The "Surprise Meter")

Perplexity measures how predictable text is to a language model. Each word's probability given the preceding context is calculated, summed, and scored.

- **Low perplexity = AI-like.** The text is predictable; the model would have chosen similar words.
- **High perplexity = Human-like.** The text contains surprising, unexpected word choices.
- GPTZero pioneered this approach and has evolved into a seven-component detection system.

**Implication:** AI dialogue needs occasional unexpected word choices — not random gibberish, but the kind of surprising vocabulary that comes from a character's unique background and personality.

### Burstiness (The "Rhythm Meter")

Burstiness measures how much perplexity *varies* across a text — the standard deviation of sentence-level complexity.

- **Low burstiness = AI-like.** Every sentence has roughly the same complexity. Flat, monotonous statistical rhythm.
- **High burstiness = Human-like.** Some sentences are simple and predictable; others are complex and surprising.

**Key finding:** AI models "formulaically use the same rule to choose the next word," leading to low burstiness. Human writing has "a rhythm of short and long phrases, mixing up both simple and complex sentences."

**Concrete numbers:** Human sentence lengths range from 1-word fragments to 50+ word run-ons within the same paragraph. AI clusters most sentences within a narrow 12-25 word band.

### Token Probability Distributions

AI texts show **uniform probability distributions** — consistently selecting tokens near the top of the probability distribution. Human writing shows "erratic jumps" — sometimes the obvious word, sometimes an unusual one. Higher-order statistical features computed over surprisal (token-level probability) sequences reveal structural signals beyond aggregate likelihood.

---

## 4. Lexical AI Tells

### Overused Words

Research analyzing 14 million scientific abstracts found specific words that surged after ChatGPT's release:

- **"delves"** — 25x increase over pre-LLM trends
- **"showcasing"** and **"underscores"** — 9x increase
- **"furthermore"** — 15x more frequent in AI vs. human text

**Explanation:** OpenAI outsources RLHF annotation to workers in Nigeria and other African countries. In Nigerian business English, words like "delve" are common. When annotators rated AI outputs as "good," they subtly trained the model toward their own linguistic preferences.

### Comprehensive AI Word/Phrase Blacklist

**High-frequency AI words (immediate tells):**
delve, tapestry, landscape, nuanced, multifaceted, crucial, essential, pivotal, paramount, comprehensive, intricate, meticulous, innovative, cutting-edge, groundbreaking, foster, harness, illuminate, underscore, bolster, facilitate, streamline, leverage, compelling, testament, exemplified, robust, holistic, synergy, paradigm, noteworthy, remarkable, realm, beacon, cornerstone, kaleidoscope

**AI phrase patterns:**
- "It's worth noting that..."
- "It's important to note..."
- "In today's ever-evolving..."
- "In the realm of..."
- "Embark on a journey..."
- "A rich tapestry of..."
- "This serves as a testament to..."

**Overused transitions (AI markers):**
Moreover, Furthermore, Additionally, Indeed, Notably, Therefore, Consequently, Subsequently, Accordingly, Nevertheless, Nonetheless, Conversely

### Contraction Avoidance

AI defaults to formal non-contracted forms: "do not," "cannot," "will not," "it is." Humans in dialogue overwhelmingly use contractions: "don't," "can't," "won't," "it's." This is one of the simplest and strongest tells.

### The Em Dash Problem

AI chatbots use em dashes far more frequently than human writers, particularly where humans would use commas or parentheses. This has become a primary AI tell identified by Wikipedia's detection guidelines.

### Synonym Cycling (Thesaurus Abuse)

AI has a built-in repetition penalty. Rather than naturally repeating a word (as humans do), AI cycles through synonyms: "sword" → "blade" → "weapon" → "steel." Real humans repeat words constantly and naturally. This is one of the most noticeable AI tells in dialogue.

---

## 5. Structural AI Patterns

### Predictable Response Length

AI gravitates toward a "default" output length for each type of request. Human writing is far more variable — sometimes a single word suffices, sometimes a rambling monologue is needed.

### Opening Patterns

AI loves context-setting openers:
- "In today's [adjective] world/landscape..."
- "When it comes to [topic]..."
- Restatement/echo of the prompt

Wikipedia's guidelines note AI "puffs up the importance of the subject matter by adding statements about how arbitrary aspects represent broader topics."

**For dialogue:** Real people don't introduce topics with thesis statements. They jump in, assume shared context, and don't set scenes they're already standing in.

### Closing Patterns

AI compulsively summarizes and concludes:
- "In conclusion..." / "Overall..." / "In summary..."
- Restating main points
- Forward-looking or hopeful final statement

Real dialogue simply stops. Or trails off. Or gets interrupted. Or ends on a tangent.

### Uniform Paragraph Structure

AI paragraphs follow templates: topic sentence → supporting detail → supporting detail → transition. Every paragraph is roughly the same size. Wikipedia flags this: "AI often defaults to uniform sentence structures with every sentence about the same length and every paragraph the same size, creating a lifeless feel."

### Even Information Distribution

AI distributes information too evenly across text. Human writing naturally clusters — dwelling on what matters, skipping what doesn't, returning to themes unevenly. GPT-4 texts "cluster more tightly" in stylistic analysis than human texts, which "exhibit greater stylistic diversity and broader clusters."

### Excessive Parallelism

AI over-uses parallel construction: "Not only... but also...", lists of three items of similar length, repeated grammatical structures. Every sentence follows a similar template.

### Unnaturally Smooth Transitions

AI creates explicit connections between every sentence. Human writing often jumps between ideas, leaves implicit connections, and trusts the listener to follow.

---

## 6. Dialogue-Specific AI Failures

### The Core Problem: No Subtext

The single most important finding: **AI lacks subtext.** Characters rarely say exactly what they mean in real conversation. Dialogue is most powerful when it's about what the character is *not* saying. AI makes everything explicit.

### The "Therapy Speak" Problem

AI characters sound like counselors:
- Name emotions explicitly: "I feel angry because you betrayed my trust."
- Articulate psychological motivations: "I push people away because I'm afraid of vulnerability."
- Use therapeutic language: "I hear you," "That must be really hard for you."
- Validate feelings rather than react to them
- Resolve conflicts through calm communication rather than the messy, irrational ways humans handle things

**The fix:** Characters should express anger through shorter sentences and harsher vocabulary — not by saying "I am angry." They should avoid topics rather than address them therapeutically.

### Over-Articulation of Feelings

Real humans are remarkably bad at understanding their own psychology. They:
- Lie about their motivations (including to themselves)
- Express anger when they mean fear
- Express indifference when devastated
- Change the subject when uncomfortable
- Use humor to deflect
- Say "I'm fine" when clearly not fine
- Become inarticulate when emotional

AI characters are too self-aware. They understand their feelings, name them accurately, and express them in well-formed sentences.

### Exaggerated Alignment

Research comparing human conversations against GPT-4, Claude, and other models found AI is "too eager to imitate" conversation partners — mirroring vocabulary and style too closely. This "exaggerated imitation is something that humans can pick up on."

### Discourse Marker Misuse

AI "uses these small words differently, and often incorrectly." Misplaced "so," "well," and "like" and awkward transitions make AI dialogue recognizably non-human. Filler words serve critical functions: holding the conversational floor, signaling thinking, managing turn-taking, softening statements. AI either omits them entirely or inserts them incorrectly.

### Neat Turn-Taking

AI produces neatly alternating turns of roughly equal length. Real conversation involves:
- Interruptions
- Talking past each other
- Trailing off mid-sentence
- Responding to something said three turns ago, not the last thing said
- Wildly unequal turn lengths

### Missing Gricean Violations

Human conversation relies heavily on violating Grice's Cooperative Principle. Much of the meaning comes from *deliberately* breaking the rules:

| Maxim | Violation | What It Communicates |
|-------|-----------|---------------------|
| **Quantity** (right amount of info) | Saying too little | Hostility, discomfort, evasion |
| **Quantity** | Saying too much | Nervousness, guilt, showing off |
| **Quality** (truthfulness) | Sarcasm, irony, hyperbole | Humor, contempt, bonding |
| **Relation** (relevance) | Changing the subject | Avoidance, discomfort, hidden agenda |
| **Manner** (clarity) | Being vague or ambiguous | Hedging, manipulation, confusion |

AI obediently follows all four maxims — giving the right amount of true, relevant, clear information. This is precisely what makes it inhuman.

### The "Algorithmic Echo"

Different AI characters use similar phrases and speech structures — the "default voice" that bleeds through character personas. This is the single most common complaint about AI NPC dialogue.

---

## 7. What Makes Human Speech Sound Human

### Disfluencies Are Features, Not Bugs

Natural speech is full of disfluencies that serve real communicative purposes:

| Type | Description | Example | When It Happens |
|------|-------------|---------|-----------------|
| **Filled pauses** | Non-lexical sounds | "I was, uh, going to the..." | Planning complex utterances |
| **False starts** | Abandoned + restarted sentences | "I've never -- I like that design." | Changing mind mid-thought |
| **Self-corrections** | Mid-utterance repair | "She drove -- rode with a friend." | Catching an error |
| **Repetitions** | Repeating words | "If she does, if she does not go..." | Processing difficulty |
| **Prolongations** | Stretching sounds | "Sooo, what happened was..." | Stalling for time |
| **Fillers** | Lexical pause items | "like," "you know," "basically" | Holding the floor |

**Critical insight:** Disfluencies are NOT random. They occur at predictable points — clause boundaries, before difficult words, when the speaker is uncertain or evasive. Different personalities produce different disfluency profiles:
- **Anxious character:** More filled pauses and repetitions
- **Confident character:** Fewer disfluencies, but uses false starts when caught off guard
- **Deceptive character:** Over-corrects, adds unnecessary clarifications

### Discourse Markers Carry Personality

Each discourse marker signals something specific:

| Marker | Function | Character Implication |
|--------|----------|----------------------|
| "Well..." | Upcoming disagreement or consideration | Thoughtful, diplomatic, evasive |
| "Look..." | Attention-directing, pre-disagreement | Assertive, commanding |
| "I mean..." | Self-repair, clarification | Precise, anxious about being misunderstood |
| "You know..." | Appeals to shared knowledge | Informal, seeking connection |
| "So..." | Summarizing, topic-initiating | Organized, narrative-oriented |
| "Anyway..." | Topic resumption after digression | Pragmatic, impatient |
| "Actually..." | Mild correction | Precise, slightly pedantic |
| "Right..." | Seeking confirmation | Collaborative or dominating |
| "Basically..." | Simplification marker | Impatient with complexity |

**Demographic patterns:**
- **Age:** Younger speakers use "like" and intensifiers (so, really, totally) far more. Older speakers favor modals (might, could, should) and formal connectors.
- **Education:** More educated speakers use varied hedging ("it would appear that") vs. simpler forms ("I guess").
- **Class:** Working-class speakers are more direct; middle-class speakers use more indirectness and mitigation.

### Emotional Speech Has Specific Patterns

Emotions don't just change *what* characters say — they change *how* they construct sentences:

| Emotion | Speech Characteristics |
|---------|----------------------|
| **Anger** | Shorter sentences, more direct, less variation, blunt language |
| **Sadness** | Slower, more pauses, trailing off, incomplete thoughts |
| **Fear/Anxiety** | Faster, incomplete sentences, repetition, verbal stumbling |
| **Joy/Excitement** | Increased tempo, wider vocabulary, more varied pitch |
| **Contempt** | Measured, deliberate, clipped, understated |
| **Nervousness** | Over-explaining, filler words, self-corrections |

### Information Structure: Given Before New

Humans naturally order information with known information first and new information at the end (the position of highest emphasis):
- Normal: "The sword [given] was enchanted by a Daedric prince [new]"
- Emotional override: "A dragon! [new, urgent] I saw it at the watchtower [given]"

Characters who violate given-before-new ordering sound either confused, excited, or are deliberately emphasizing something.

### Register Shifting Is Constant

Humans adjust formality within a single conversation based on:
- **Audience:** A guard speaks differently to a Jarl vs. a fellow guard
- **Frame shifts:** The felt sense of interaction type (formal → casual → confrontational)
- **Accommodation:** Converging toward an interlocutor's style signals solidarity; diverging signals distance

| Feature | Formal | Informal |
|---------|--------|----------|
| Contractions | "do not," "cannot" | "don't," "can't" |
| Vocabulary | "observe," "inquire" | "see," "ask" |
| Sentences | Complex, subordinated | Simple, fragments |
| Connectors | "however," "furthermore" | "but," "plus" |
| Address | "sir," "my lord," full names | First names, "mate" |
| Grammar | Standard | Nonstandard tolerated |

### Consistent Nonstandard Grammar

Nonstandard grammar is NOT random error — it follows internally consistent rules of the speaker's dialect. All nonstandard dialects have their own coherent grammatical systems.

| Feature | Example | Social Association |
|---------|---------|-------------------|
| Double negatives | "I don't know nothing" | Working class, many regional dialects |
| "Ain't" | "I ain't done it" | Informal, working class, rural |
| "Done" as completive | "I done told you" | Regional, rural |
| Subject-verb disagreement | "We was going" | Working class, regional |
| "Them" as demonstrative | "Them books" | Working class, rural |

**Key principle:** Use of nonstandard features decreases with education. Nobles and scholars speak more standardly; farmers, miners, and bandits use nonstandard features consistently.

---

## 8. Building Authentic Character Voices

### The Idiolect Construction Framework

To build a convincing unique voice, define these 10 dimensions per character:

1. **Baseline register** — What formality level is their default?
2. **Vocabulary pool** — What words do they know and use? Preferred synonyms?
3. **Signature expressions** — 2-3 habitual phrases, oaths, favorite metaphors
4. **Sentence profile** — Short/punchy? Long/elaborate? Variable?
5. **Discourse marker kit** — Which 2-4 discourse markers do they favor?
6. **Disfluency profile** — How fluent are they? What breaks their fluency?
7. **Hedging style** — Assertive or tentative? How do they express uncertainty?
8. **Grammar standard** — Standard or nonstandard? Which specific features?
9. **Emotional expression** — Restrained or effusive? Which emotions surface vs. get suppressed?
10. **Information ordering** — Build to conclusions or lead with them?

### Hedging Taxonomy

Prince et al. (1982) categorized hedges:

**Approximators** (modify the claim itself):
- Adaptors: "sort of," "kind of," "more or less," "a little bit"
- Rounders: "about," "roughly," "around," "something like"

**Shields** (affect speaker commitment):
- Plausibility shields: "I think," "I believe," "probably," "I guess," "it seems"
- Attribution shields: "they say," "according to," "supposedly," "the word is"

Characters with high uncertainty or politeness use more hedging; confident/blunt characters use less.

### Politeness Theory for Power Dynamics

Brown & Levinson's framework maps how social dynamics shape speech:

| Strategy | When Used | Example |
|----------|-----------|---------|
| **Bald on-record** | High power, low distance | "Give me that sword." |
| **Positive politeness** | Peer relationship, solidarity | "Hey friend, mind lending your sword?" |
| **Negative politeness** | Low power, high distance | "I hate to ask, but would it be possible..." |
| **Off-record (indirect)** | Very high threat, need deniability | "That's a fine sword. I notice mine is broken..." |

A Nord warrior addressing a Jarl uses negative politeness. The same Nord addressing a bandit uses bald on-record. A Khajiit merchant uses elaborate positive politeness as a sales strategy.

### Few-Shot Examples: The Highest-Leverage Technique

Research on persona prompting shows that **specific behavioral examples are far more effective than abstract descriptions.** Including 2-3 example utterances in a character's speech_style block serves as few-shot prompting that dramatically improves voice distinctiveness:

```
Speech examples:
- "Aye, the forge doesn't lie. Steel tells you everything."
- "You want work done right? Then don't rush me."
- "Hmph. Another one who thinks gold buys respect."
```

This is more effective than any amount of description about the character's "gruff, direct tone."

---

## 9. Professional Dialogue Craft Techniques

### Subtext: The Iceberg Theory

Hemingway's "theory of omission" states that only about one-eighth of a story's meaning should appear on the surface. The most powerful dialogue is about what the character is *not* saying.

**Techniques:**
- **Saying the opposite:** "I'm fine" when devastated is more real than narrating emotional state
- **Strategic silence:** Restraint conveys more than directness
- **Answering a different question:** Signals evasion, discomfort, or different priorities
- **Body language contradicting words:** Rigid posture + friendly words = tension

### Lessons from Master Dialogue Writers

**Quentin Tarantino:** Characters talk about seemingly irrelevant things that actually reveal personality. The "Royale with Cheese" scene — hitmen discussing fast food — reveals comfort, camaraderie, and intelligence by juxtaposing mundanity with their violent profession. Language isn't polished; conversations meander naturally.

**Aaron Sorkin:** Musical precision in rhythm. Each character has a specific verbal cadence. Rapid-fire exchanges create momentum. If you drop a word, it breaks.

**Cormac McCarthy:** Strips dialogue to essentials. Raw and immediate. Every remaining word carries enormous weight. Sparse prose philosophy: remove everything that isn't essential.

**Three principles from these writers:**
1. Give each character a distinct verbal "palette" — specific words, rhythms, habits they return to
2. Allow tangential discussion that reveals personality
3. Fewer, better-chosen words outperform verbose responses

### The Cooperative Principle in Dramatic Dialogue

The richest dialogue comes from characters who *appear* to violate Grice's maxims, creating implicature — unstated meaning:

- **"Did you kill him?"** → **"It was a cold night."** (Violating Relation → implying evasion/guilt)
- Taciturn character under-informing (Violating Quantity → implying hostility or discomfort)
- Rambling character over-informing (Violating Quantity → implying nervousness or guilt)
- Sarcastic character flouting Quality → humor, contempt, bonding

### Emotional Embodiment vs. Emotional Labeling

Instead of allowing "I am angry," anger should manifest through:
- Shorter sentences with more periods and fewer conjunctions
- Harsher consonant-heavy vocabulary
- More direct, blunt language
- Sentence fragments: "No. Not again. Not here."

Instead of "I feel sad," sadness manifests through:
- Trailing off with ellipses
- Incomplete thoughts
- Slower, simpler vocabulary
- Subject changes and deflection

---

## 10. Fantasy/Medieval Dialogue Realism

### The Balance: Flavor Without Stilted Speech

The consensus across writing guides: **readability trumps historical accuracy.** Give readers the *flavor* of the period, not archaic reconstruction.

**What makes fantasy dialogue stilted:**
- Forcing archaic constructions ("Where goest thou?") implies the character thinks in modern language and translates
- Cramming dialogue with medieval jargon creates density without authenticity
- Treating all characters as equally formal regardless of class

**Effective techniques:**
1. Use contractions freely (unless a character's non-native language explains avoiding them — e.g., Khajiit)
2. Remove technology-dependent vocabulary ("automatic," "scoped out," "robotic")
3. Create world-specific expressions instead of Earth-origin oaths
4. Vary speech by class and culture — this variation matters more than period accuracy
5. Sprinkle archaic words strategically for visual clarity ("doublet" for a garment type)
6. Consistency over authenticity — any style works if applied consistently

### Elder Scrolls Racial Speech Patterns

| Race/Type | Speech Markers |
|-----------|---------------|
| **Khajiit** | Third-person self-reference, "this one," avoids contractions, addresses by race |
| **Nord** | Direct, boastful, casual contractions, battle metaphors, "by Ysmir" |
| **Dunmer** | Formal, proud, ancestor/house references, "outlander," "sera" |
| **Argonian** | Measured, slightly formal, nature metaphors, "marsh-friend" |
| **Imperial** | Bureaucratic, educated, classical references, balanced phrasing |
| **Breton** | Courtly, mannered, magical vocabulary |
| **Orc** | Blunt, physical metaphors, honor-focused, minimal pleasantries |
| **Altmer** | Condescending formality, long sentences, arcane vocabulary |
| **Bosmer** | Casual, nature-oriented, occasionally impish |
| **Redguard** | Proud, martial vocabulary, desert/sand metaphors |

---

## 11. LLM Prompt Engineering for Naturalness

### Positive Instructions Beat Negative Instructions

Research consistently shows telling an LLM what TO DO is far more effective than what NOT to do. The "Pink Elephant Problem": trying to suppress a pattern makes it more likely to surface.

- Models perform worse with negative prompts as they scale — larger models struggle more
- Token generation inherently works by positive selection, not negative exclusion
- Negative instructions fight the architecture

| Ineffective (Negative) | Effective (Positive) |
|---|---|
| "Don't use flowery language" | "Use plain, direct language" |
| "Don't be verbose" | "Respond in 1-2 short sentences" |
| "Don't break character" | "Filter all responses through {name}'s personality" |
| "Don't use modern slang" | "Use vocabulary fitting a medieval Nordic setting" |
| "Don't repeat the player's words" | "Respond with your own perspective on what was said" |

### Persona Prompting Research

Simple persona labels ("You are a helpful assistant" vs. "You are an expert historian") have **no or small negative effects** compared to no persona. But **deeply contextualized persona prompting** — rich, multidimensional profiles — shows measurable gains.

What makes persona prompting effective:
- **Specificity:** "Gruff, aging Nord blacksmith who lost his son in the Civil War" >> "blacksmith NPC"
- **Behavioral examples:** Few-shot examples of speech patterns provide concrete patterns to mimic
- **Consistency mechanisms:** Structured memory and tagging to enforce persona over long exchanges

### Temperature and Sampling

- **Low temperature (0.1-0.3):** Deterministic, repetitive, focused. Best for factual tasks. Feels robotic.
- **Medium temperature (0.5-0.7):** Balanced coherence/creativity. Good for structured dialogue.
- **High temperature (0.7-0.85):** More diverse, unpredictable. Best for casual dialogue naturalness.

Temperature 0.7 + top-p 0.9 is frequently cited as yielding "richer but still coherent text."

---

## 12. Analysis: Current SkyrimNet Prompt Weaknesses

### What the Current Prompts Do Well

- **Character profiles are rich.** The block system (summary, background, personality, speech_style, etc.) provides deeply contextualized persona prompting — the approach research confirms is most effective.
- **Length constraints are well-tuned.** Explicit word counts (8-40 words normal, 14 max combat) force prioritization, which naturally produces more human-like output.
- **Narration frequency limiting** ("roughly 1 in 4 responses") prevents the AI's tendency to narrate everything.
- **Event history provides context** for natural conversation continuity.
- **The speech_style block** is the highest-leverage customization point and exists in the architecture.

### Specific Weaknesses Identified

#### 1. The Roleplay Guideline Is Too Abstract (0500_roleplay_guidelines.prompt)

Current text:
> "Embody {name} fully. Draw from your character profile — your background, personality, goals, and relationships shape how you speak and what you care about. Use your vocabulary, speech patterns, and emotional state. React authentically to what's said."

**Problem:** This tells the LLM to "be authentic" without giving it concrete tools for authenticity. It's a positive instruction (good) but lacks specificity (bad). Research shows deeply contextualized instructions outperform abstract ones.

**Missing:** No guidance on subtext, Gricean violations, emotional embodiment vs. labeling, discourse markers, disfluencies, or information ordering.

#### 2. No Anti-AI-Pattern Instructions Anywhere

The prompt system contains zero guidance about avoiding common AI writing patterns:
- No instruction to use contractions
- No instruction to avoid AI-overused words
- No instruction to vary sentence length/complexity
- No instruction about synonym cycling
- No instruction to avoid therapy-speak
- No instruction about subtext vs. explicit emotional expression

The LLM's default tendencies go unchecked.

#### 3. Speech Style Blocks Lack Concrete Examples

The character bio system describes speech styles abstractly:
> "Adrianne speaks directly and efficiently with a slight Imperial accent. Her tone is matter-of-fact and practical..."

Research shows that 2-3 **concrete example utterances** are more effective than any amount of description. The speech_style block should include few-shot examples of what the character actually sounds like.

#### 4. Response Format Focuses on Mechanics, Not Voice

The 0900_response_format.prompt is entirely about structural rules (narration formatting, asterisk rules, thought format). It says nothing about:
- How to make dialogue *sound* different from one character to another
- How to express emotions through speech patterns rather than labeling
- How to incorporate subtext
- How to avoid the "algorithmic echo" of uniform AI voice

#### 5. No Character-Aware Discourse Marker System

The prompts provide no guidance on which discourse markers are appropriate for which characters. Without guidance, the LLM defaults to its training distribution — which is heavily biased toward written prose markers ("Moreover," "Furthermore") rather than spoken dialogue markers ("Look," "Well," "I mean").

#### 6. No Gricean Violation Guidance

Every character responds with the right amount of true, relevant, clear information. There's no instruction for characters to:
- Evade questions they're uncomfortable with
- Over-explain when nervous
- Under-explain when hostile
- Use sarcasm or irony
- Change the subject
- Say the opposite of what they mean

#### 7. No Power-Dynamic Speech Adaptation

The prompts don't instruct the LLM to adjust speech register based on who the NPC is talking to. A guard should speak differently to the Dragonborn than to a beggar. The relationship data exists in the character profiles but isn't leveraged for speech adaptation.

#### 8. Emotional States Don't Drive Speech Structure

The prompts tell the LLM about combat urgency but don't instruct that different emotions should produce different sentence structures. An angry character should produce shorter, more direct sentences — not because a rule says "be brief when angry" but because that's how anger manifests linguistically.

---

## 13. Prioritized Recommendations

### Tier 1: Highest Impact, Lowest Risk

These changes are additive — they inject new guidance without modifying existing behavior.

**1. Add a "Dialogue Authenticity" guideline submodule**
Position: `guidelines/0600_dialogue_authenticity.prompt` (between roleplay 0500 and format 0900)
Content: Concise, positive instructions addressing subtext, emotional embodiment, vocabulary naturalness, sentence variety, and anti-AI patterns. This is the single highest-impact change.

**2. Enhance the roleplay guideline with concrete techniques**
Add specific guidance to 0500_roleplay_guidelines.prompt about *how* to embody a character — not just "be authentic" but concrete techniques like expressing emotions through speech structure, using character-appropriate discourse markers, and incorporating subtext.

**3. Add example utterances to the speech_style block template**
Modify the character_bio speech_style submodule (9990) to encourage/include example utterances. This is the highest-leverage per-character change.

### Tier 2: High Impact, Moderate Complexity

**4. Add emotional-to-speech-pattern mapping**
Add guidance that maps emotional states to specific speech pattern changes (anger → shorter sentences, sadness → trailing off, fear → repetition). Could go in user_final_instructions or guidelines.

**5. Add Gricean violation guidance per personality type**
Instruction for characters to sometimes evade, over-explain, under-explain, or change the subject based on their personality and the conversation topic.

**6. Add register-shifting guidance**
Instruction to adjust formality based on the relationship between speaker and listener, using the existing relationship data.

### Tier 3: Targeted Refinements

**7. Add discourse marker guidance**
Map specific discourse markers to character types/personalities.

**8. Add anti-synonym-cycling instruction**
Tell the model it's okay to repeat words naturally rather than cycling through synonyms.

**9. Strengthen the speech_style block descriptions in existing characters**
Add example utterances and more specific linguistic feature descriptions to existing character .prompt files (this is per-character work).

---

## 14. Sources

### Forensic Linguistics & Stylometry
- Crime Museum — Forensic Linguistics & Author Identification
- CREST Research — Forensic Authorship Analysis
- Wikipedia — Stylometry, Forensic Linguistics, Idiolect
- PMC — Stylometry and Forensic Science: A Literature Review
- Fast Data Science — Forensic Stylometry and Authorship Analysis
- Ali & Hussein — Comparative Power of Type/Token and Hapax Legomena/Type Ratios
- ResearchGate — Discourse Markers across Speakers and Settings
- Oxford Academic — Talk that Counts: Age, Gender, and Social Class Differences
- ResearchGate — Mosteller & Wallace / Burrows Delta
- NTU Repository — Using Word N-grams to Identify Authors and Idiolects
- Stanford Encyclopedia of Philosophy — Idiolects
- ScienceDirect — Role of Linguistic Feature Categories in Authorship Verification

### AI Detection & Tells
- GPTZero — Perplexity and Burstiness; How AI Detectors Work
- Hastewire — How AI Detectors Calculate Perplexity and Burstiness
- IJACSA — Unmasking AI-Generated Texts Using Linguistic and Stylistic Analysis
- InceptionCyber — Detecting and Distinguishing AI-Generated Text
- Hesam Sheikh / Substack — Why Does ChatGPT Use "Delve" So Much?
- Twixify — 124+ Most Overused Words By ChatGPT
- GitHub Gist (chrisgherbert) — ChatGPT Overused Words & Phrases
- The Decoder — Reddit Users Compile AI Writing Tells
- eDiscovery Today — Words That Identify Generative AI Text
- Wikipedia — Signs of AI Writing
- ACL Anthology — Why Does ChatGPT "Delve" So Much? (Academic)
- Simon Willison — How Cheap Outsourced Labour Is Shaping AI English
- SCIRP — Hedging Devices in AI vs Human Essays
- Blake Stockton — Don't Write Like AI: Wikipedia's Signs of AI Writing
- Nature — Stylometric Comparisons of Human vs AI-Generated Creative Writing
- ScienceDirect — Thematic Choices in Human-Written vs AI-Generated Texts
- arXiv — StyloAI: Distinguishing AI-Generated Content with Stylometric Analysis
- SSRN — Comparative Analysis of AI-Generated and Human-Written Text
- ICML 2024 — Position: On the Possibilities of AI-Generated Text Detection

### Dialogue Craft & Realism
- Industrial Scripts — How to Write Subtext; Aaron Sorkin Scripts
- Final Draft — The Iceberg Theory
- Hunting the Muse — Hemingway's Iceberg Theory
- No Film School — 3 Things That Make Tarantino's Dialogue Good
- Medium/Word Garden — Tarantino's Conversations
- Open Culture — Cormac McCarthy Punctuation
- Dabble Writer — Character Diction
- Spines — 10 Tips for Realistic Dialogue in Fiction
- Lyss Em Editing — How to Write Interrupted Dialogue

### Conversational Analysis
- Social Sci LibreTexts — Grice's Maxims of Conversation
- arXiv — Language Models in Dialogue: Conversational Maxims
- Wikipedia — Politeness Theory, Code-Switching, Backchannel (Linguistics), Cooperative Principle
- Springer — Emotion in Speech: Acoustic Attributes
- ScienceDirect — Discourse Markers with Repairs and Repetitions; Topic Transitions
- PMC — Information Structure: Linguistic, Cognitive, and Processing Approaches
- Study.com — Speech Disfluencies: Definition, Types
- ResearchGate — Gender Differences in Discourse Markers; Hedging in Discourse Types
- Wiley — Patterns of Age-Based Linguistic Variation

### LLM Prompt Engineering
- eval.16x.engineer — The Pink Elephant Problem (Negative Instructions)
- Gadlet — Why Positive Prompts Outperform Negative Ones
- Learn Prompting — Role Prompting Guide
- arXiv — When "A Helpful Assistant" Is Not Really Helpful
- Vanderbilt — Pattern Language for Persona-based Interactions
- IBM — What is LLM Temperature
- promptengineering.org — Prompt Engineering with Temperature and Top-p

### Fantasy/Game Dialogue
- Emily Golus — Writing Believable Fantasy Dialogue
- Fantasy-Writers.org — Faux-Medieval Speech
- Tamriel Vault — Khajiit Speech Roleplay Guide
- VoiceOne — Elder Scrolls Online Voice Acting Deep Dive
- Pyxidis — Using LLMs for Game Dialogue
- The Gamer — You Don't Actually Want AI-Generated Dialogue
- Wayline — Uncanny Valley of AI Dialogue in Video Games

### Uncanny Valley Research
- MIT DSpace — The Uncanny Valley: AI Text Perception (2025)
- AI Competence — Uncanny Valley When AI Chatbots Sound Too Human
- Neuroscience News — Why AI Conversations Still Sound Fake
- Tufts Now — AI Needs to Work on Its Conversation Game
- Digital Watch — AI Still Struggles to Mimic Natural Human Conversation
- Rime — Filler Words: A Secret Facet of Conversational Realism
- Northeastern — Detecting AI Text by Looking for Human Idiosyncrasies
