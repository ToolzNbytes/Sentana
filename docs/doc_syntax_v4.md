## Document v0.1 TO BE REVIEWED

Below is a practical, step-by-step **user documentation** for doing a **manual sentence structural analysis** with the notation and tags defined in the rules document. Itƒ?Ts meant to be used like a small workflow/checklist, not like a grammar textbookƒ?"this method takes a few liberties on purpose to stay useful for ƒ?osentence-buildingƒ?? structure. 

---

## 1) What youƒ?Tre producing

For each sentence, you output a **multiline, hierarchical breakdown** where:

* **Clauses / phrase-units** are wrapped in **parentheses**: `(ICƒ?İ)`, `(DCƒ?İ)`, `(FGƒ?İ)`, `(PPƒ?İ)`, `(APƒ?İ)`
* **Additional coordinated predicates / parallel constituents** use **square brackets**: `[CPƒ?İ]`
* **Indentation** uses `~` (tildes), one per nesting level
* **Every unit has a unique numeric id**, assigned in order of appearance across the whole sentence (regardless of tag type)
* **Every original word appears exactly once, in the same order**, with punctuation preserved (the notation is inserted *between* words, not rewriting the sentence) 

---

## 2) The syntax you will write

### 2.1 Clause openings (parentheses)

A clause/phrase opening is **one line**, starting with:

* Independent clause: `(IC1 ƒ?İ`
* Dependent clause: `(DC2<1 ƒ?İ` or `(DC2>1 ƒ?İ`
* Fragment: `(FG1 ƒ?İ`
* Participial phrase: `(PP2<1 ƒ?İ` or `(PP2>1 ƒ?İ`
* Adjunct phrase (non-PP): `(AP2<1 ƒ?İ` or `(AP2>1 ƒ?İ`

**Meaning of `<y` and `>y`:**

* `<y` = ƒ?othis depends on something earlier (id y)ƒ??
* `>y` = ƒ?othis depends on something that comes later (id y)ƒ??
  The ƒ?osomethingƒ?? is usually the subject/verb (or hosting unit) you conceptually attach to. 

### 2.2 Closing parentheses (their own lines)

Each opening `(` must have a matching `)` on its **own line**, and the closing line must have the **same number of `~`** as the opening line.

### 2.3 Nesting indentation with `~`

* Top level: no leading `~`
* One level inside: `~( ƒ?İ`
* Two levels inside: `~~( ƒ?İ`
* Continuation text lines inside a clause keep the same indentation and begin with `~` + a space if needed.

### 2.4 CP blocks (square brackets)

`[CPx ƒ?İ ]` are used for **additional coordinated predicates** (and sometimes other ƒ?oparallel constituentsƒ?? when you decide they behave like a series). They:

* **Do not** add indentation level
* Must open on their own line with `[CPx ƒ?İ`
* Close with `]` on its own line
* Live ƒ?oinsideƒ?? the current clause level 

---

## 3) Tags, in plain language

### IC ƒ?" Independent Clause

A clause that can stand as a full sentence (for our purposes).

### DC ƒ?" Dependent Clause

A clause that ƒ?ohangs offƒ?? another unit (IC, another DC, or sometimes a CP predicate), marked with `<y` or `>y`.

### FG ƒ?" Fragment

Used when there is **no proper independent clause** (headline-like chunks, descriptive fragments, etc.). Coordinated top-level fragments may be split into multiple FGs if they are parallel. 

### PP ƒ?" Participial Phrase (-ing / -ed), optional

Use PP when the participial phrase is **removable without breaking syntax**, and/or **easily rewritable as a dependent clause** (ƒ?owho/that ƒ?İƒ??).
Do **not** tag it as PP if it is syntactically obligatory (cleft-like focus) or if itƒ?Ts acting as a noun (ƒ?oMaking him happyƒ?İƒ??). 

### AP ƒ?" Adjunct Phrase (non-PP), optional

Use AP for other **optional adjunct bundles** that behave like ƒ?oadd-onsƒ?? (e.g., certain purpose infinitives, postposed descriptive bundles, afterthought modifiers).

### CP ƒ?" Coordinated Parallel Constituent

Use CP for:

* **Compound predicates** after the first predicate in a clause (the first predicate stays in the clause text)
* Sometimes for coordinated non-finite complements / series-like parallel phrases, when it helps keep structure readable 

---

## 4) Manual workflow: do one sentence

### Step 0 ƒ?" Copy the sentence exactly

Youƒ?Tll be reusing every character (including punctuation). Donƒ?Tt ƒ?oclean it up.ƒ??

### Step 1 ƒ?" Decide: IC or FG at the top?

* If the sentence contains a clear finite predicate that can stand as a sentence ƒÅ' start with an **IC**
* If not ƒÅ' start with an **FG**
* If there are multiple top-level coordinated full clauses/fragments, you may split them into multiple top-level `(ICƒ?İ)` / `(FGƒ?İ)` blocks

### Step 2 ƒ?" Create the first top-level block and assign id ƒ?o1ƒ??

Example skeleton:

```text
(IC1 ƒ?İsentence textƒ?İ 
)
```

or

```text
(FG1 ƒ?İfragment textƒ?İ
)
```

### Step 3 ƒ?" Walk left-to-right and ƒ?ocut inƒ?? embedded units

Read the sentence from start to end and whenever you hit something that should become a **nested unit**, you:

1. Stop the current line **right before** that unit begins
2. Open the nested unit on the next line, with proper indentation
3. Close it
4. Continue the parent text *after* it

This is the core discipline: **the original word order must remain intact**. 

### Step 4 ƒ?" Add DCs (with the right arrow direction)

Common DC triggers: *that, which, who, because, when, if, as, whetherƒ?İ*
Pick `<y` vs `>y`:

* If the thing you depend on is already mentioned ƒÅ' `<y`
* If the dependent clause comes first and the anchor shows up later ƒÅ' `>y`

### Step 5 ƒ?" Add PPs (optional participial phrases)

Look for **-ing/-ed sequences** of 2+ words that are optional. If yes:

* tag them as `(PPx<y ƒ?İ)`
* nest them where they occur in the parent text

### Step 6 ƒ?" Add APs (optional adjunct bundles)

Same mechanics as PP, but used for other optional add-ons.

### Step 7 ƒ?" Convert compound predicates to CP

Inside an IC/DC/FG, find the main predicate and keep it in the clause text.
For additional coordinated predicates, put each one in its own CP:

```text
(IC1 ƒ?İ first predicate ƒ?İ
[CP2 ƒ?İ second predicate ƒ?İ
]
[CP3 ƒ?İ third predicate ƒ?İ
]
)
```

A DC may refer to a CP id if it clearly modifies that predicate. 

### Step 8 ƒ?" Close everything carefully

Every `(` gets a `)` on its own line, aligned by tildes.
Every `[` gets a `]` on its own line.

### Step 9 ƒ?" Add a comment only if needed

If something is genuinely ambiguous (attachment, scope), add a single-line note **after** the last closing bracket/parenthesis:

```text
# possible alternative attachment: ƒ?İ
```

One comment per issue. 

---

## 5) Two worked mini-examples

### Example A ƒ?" DC + CP (close to the corpus style)

Sentence:

> He had entertained hopes ƒ?İ, **but** he saw only the father.

Analysis (from the examples file): 

```text
(IC1 He had entertained hopes of being admitted to a sight of the young ladies,
~(DC2<1 of whose beauty he had heard much;
~)
)
(IC3 but he saw only the father.
)
```

What to notice:

* Two top-level IC blocks (coordination / contrast)
* The relative clause ƒ?oof whoseƒ?İƒ?? is nested as DC2<1 inside IC1

### Example B ƒ?" Participial phrase as PP

Sentence:

> Mr. Darcy ƒ?İ spent the rest of the evening ƒ?İ, **speaking** occasionallyƒ?İ

Analysis (from the examples file): 

```text
(IC1 Mr. Darcy danced only once with Mrs. Hurst and once with Miss Bingley,
[CP2 declined being introduced to any other lady,
]
[CP3 and spent the rest of the evening in walking about the room,
~(PP4<1 speaking occasionally to one of his own party.
~)
]
)
```

What to notice:

* The main clause carries the first predicate
* Additional coordinated actions become CP2 and CP3
* The optional participial ƒ?ospeakingƒ?İƒ?? becomes PP4 nested under the relevant action

---

## 6) Space and punctuation rules you must follow

* **Punctuation sticks to the word it follows** (except special handling of em-dash cases described in the rules). 
* **Do not add or remove spaces.** The analysis is conceptually ƒ?oinserted betweenƒ?? original characters.
* One tolerated convenience: the **first tag line** that carries text may have a ƒ?onon-significantƒ?? extra space for clarity (meant to be removed later by tooling). 
* Coordination words like **and / but** are bundled with the clause or phrase they introduce, even if itƒ?Ts slightly debatable. 

---

## 7) Final checklist and common pitfalls

### The quick checklist

* **All original words appear exactly once** and **in the same order**
* **Ids increase in order of appearance** (across IC/DC/FG/PP/AP/CP)
* **Every DC/PP/AP has `<y` or `>y`** and the referenced id exists
* **Indentation is consistent** (opening and closing align)
* **CP uses brackets**, not parentheses, and doesnƒ?Tt add indentation
* **Punctuation and spacing are preserved**

### Pitfalls worth insisting on (because theyƒ?Tre easy to miss)

1. **Losing or duplicating words** when you ƒ?ocut inƒ?? nested units. If youƒ?Tre unsure, rebuild by reading the analysis top-to-bottom and verifying it reproduces the sentence perfectly.
2. **Wrong indentation on closing lines**ƒ?"it breaks the structure even when the text looks right.
3. **Forgetting that ids are global across the sentence** (you can have IC1, DC2, IC3ƒ?İ and thatƒ?Ts fine).
4. **Over-tagging participles**: PP is only for optional participial phrases, not for noun-like gerunds or obligatory constructions. 
5. **Attaching a DC to the wrong anchor id**: if scope is unclear, itƒ?Ts okay to pick one and leave a `#` note.

---

## Dialogue support (IC/FG @ marker)

You can mark a full sentence as a dialogue line by adding `@` right after the id of a **level‑1 IC or FG**.
The optional numeric id after `@` is only informative for the human reader (not used by the tool yet).

Examples:
```
(IC1@0 Dialogue line spoken by a character
~(DC2 who remains unidentified with zero
~)
)
```

```
#@1: James
(IC1@1 Dialogue line by character 1 names James
)
```

Notes:
- `@` on a level‑1 IC/FG triggers a special root (dialogue) rendering.
- `#@id: Name` is currently ignored by the tool (future‑use only).
- `@` on a deeper node (level 2+) marks that node with a dashed white border.

## AT — Attribution tag

Use `AT` for attribution/action segments embedded in dialogue lines (e.g., “he said”, “she whispered”, or brief actions adjacent to quoted speech).
AT behaves like a regular tag (no `<y` or `>y`).
