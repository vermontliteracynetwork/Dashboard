# 12. What "every answer is an actual sentence" means

Write a pure function `validateSentence(tokens, tense)` that returns a list of rule violations. The generator must never output a sentence with violations, and the test suite must prove it (section 31). Rules:

- **Complete clause:** each clause has a subject (noun phrase or pronoun) and a verb.
- **Subject-verb agreement (present tense):** he/she/it and singular nouns take the -s form (the cat jumps); I/you/we/they and plural nouns take the base form (they jump, the mice jump). A compound subject joined by "and" is plural (the cat and the dog jump). With "or"/"but" the verb agrees with the nearest subject noun.
- **Past and future:** past uses the past form for every subject; future is "will + base verb" for every subject.
- **a / an:** use "an" before a vowel-initial next word (an owl, an uncle, an apple), otherwise "a". The student picks "a" and the engine corrects it.
- **Articles and plurals:** "a/an" never goes with a plural or non-count noun (mice, children, rain). Those nouns get "the" or a pronoun-free subject. Lock handling must respect this (section 16).
- **Transitive verbs:** verbs that need an object (chop, kick, mix) appear only in patterns that have an object (pattern 31). Pattern 31 uses only transitive-capable verbs. Intransitive-only verbs (fall, jump, run, slide, talk) never get an object.
- **Conjunction fit:** between nouns, verbs or prepositions use "and" or "or". Between adverbs use "and", "but" or "or". Between two clauses (patterns 16, 19) use "and", "but" or "for". Do not use "nor" in the first release (it needs inverted word order). Make these pools configurable.
- **Capital and end mark:** first word capitalized, "I" always capitalized; the sentence ends with "." or "!" (patterns that start with an interjection end with "!"). The interjection itself ends with "!" and the next word is capitalized.
- **Commas:** comma after an opening adverb (Softly, the girl sings.). Comma before a conjunction that starts a second clause beginning with an adverb (pattern 19). No other commas in v1.
- **Order of describing words:** when a noun phrase has two or more adjectives they must follow the rank order feeling, size, age, look, color (section 3.13). The generator and Hopper always sort; hand-built machines are checked.
- **Who does the work depends on the Grammar Help level** (section 3.6): at Full help the engine applies capitals, stop marks, commas and adjective order; at Guided and Challenge the student does, and the validator checks the result. Every rule here appears as a checklist item (section 3.10).
- **Word choice is free:** any noun with any adjective, any verb with any compatible noun. Nonsense meaning (The tiny zebra drank loudly) is intended and celebrated.

> Bug found in the first prototype (fix in this build): pattern 31 could produce "I jump the cat" because verbs had no transitive flag. The verb table below fixes that.
