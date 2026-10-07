# 15. Grammar engine (pure TypeScript, no UI)

Put all grammar logic in `src/engine/` with zero React or DOM imports so it is fully unit testable and reusable by the other modes later.

| File | Responsibility |
|---|---|
| patterns.ts | The 33 patterns as data and `patternsForColumns(n)`. |
| wordbank.ts | Nouns, verbs, adjectives, adverbs, etc., with flags (plural, noA, objectUse, kind, tier). |
| analyze.ts | Finds clauses and subject groups; decides plural/agreement for each verb; marks object nouns and prepositional objects. |
| conjugate.ts | `verbForm(base, tense, plural)` and article a/an fixing. |
| compose.ts | Tokens to display words: capitalization, commas, end mark, subject/predicate segments. |
| generate.ts | `spin(settings, current)`: picks a pattern, fills reels under constraints, respects locks. |
| validate.ts | `validateSentence()` (section 12). |
| silly.ts | The silly score. |

## 15.1 Agreement algorithm

```
analyze(tokens):
  state = 'pre'; group = null
  for each token i:
    if N or R:
       if preceded (skipping J, A) by P:  mark as prepositional object; continue
       if state == 'pred': mark as object; continue
       if no group: group = new Group(plural=false)
       plural = (R in {I, you, we, they}) or (N in pluralNouns)
       if group.andPending: plural = true            // "the cat AND the dog"
       group.plural = (group.count == 0 || group.andPending) ? (group.plural || plural) : plural
       group.andPending = false; state = 'subj'
    if C:
       if state == 'subj' and word == 'and': group.andPending = true
       if state == 'pred' and a subject (N/R not after P) appears before the next V:
            start new clause: state = 'pre'; group = null      // patterns 16, 19
    if V:  verb.group = group; state = 'pred'                  // "cleans AND dusts" shares group
```

## 15.2 Tense forms

```
verbForm(v, tense, plural):
  past    -> v.past
  future  -> "will " + v.base
  present -> plural ? v.base : v.third     // I, you, we, they, plural nouns, "and"-subjects use base
```

## 15.3 Spin algorithm (with locks)

```
spin(settings, reels?):
  patterns = patternsForColumns(settings.columns)
  if settings.patternFocus: patterns = [that pattern]
  if reels has locks: patterns = patterns whose symbols match every locked reel's pos at its index
       (if none match, keep the old pattern: locked reels never change position or type)
  pattern = random(patterns, avoiding repeating the last pattern)
  tokens  = pattern.symbols mapped to reels (carry over locked words)
  repeat up to 200 times:
     for each unlocked reel, in an order that fills locked-dependent reels last:
         choices = candidatesFor(tokens, i)       // grammar constraints
         tokens[i].word = random(choices)         // sample, never uniform over a huge list
     if validateSentence(tokens, tense).ok: return result
  fallback: return the last valid sentence generated for this pattern (never emit an invalid one)

candidatesFor(tokens, i):
  N : noun tier pool; if previous article in this noun phrase is "a", drop noA/plural nouns
  A : ["a","the"]; if the noun in this phrase is locked plural/noA, only "the"
  V : pattern 31 -> objectUse in {T,B}; every other pattern -> objectUse in {B,I}
  C : by position (noun/verb/prep -> and, or; adverb -> and, but, or; clause -> and, but, for)
  others: full list for that part of speech (tiered if needed)
  then intersect with this reel's drum pool (section 19.2); if fewer than 4 valid words remain,
  ignore the pool for this spin; lock 'pin' means re-roll but only from the current drum pool
```

> When the teacher sets tense to "random", pick a tense at random per spin and show it on the dial. Every locked-reel combination must still produce a valid sentence or keep the previous one.
