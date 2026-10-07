# 10. Columns and eligible patterns

The teacher's 33 sentence patterns (from Grammar_Sentence_Reference_List.pdf) are the source of truth. The column count equals the number of symbols in the pattern. This table is generated directly from those patterns, so use it as test fixtures.

| Columns | Pattern #s | Example sentences |
|---|---|---|
| 2 | 22 | He jumps. |
| 3 | 1, 23 | The cat ran.<br>He jumps slowly. |
| 4 | 2, 4, 13, 28, 33 | The small cat ran.<br>The cat ran quickly.<br>Softly, the girl sings.<br>... |
| 5 | 3, 5, 14, 24, 25, 27, 31, 32 | The small white cat ran.<br>The small cat ran quickly.<br>Softly, the young girl sings.<br>... |
| 6 | 6, 7, 10, 15, 26 | The small white cat ran quickly.<br>The cat and the dog ran.<br>The dog jumped over the cat.<br>... |
| 7 | 11, 18, 29, 30 | The big dog jumped over the cat.<br>Quickly, the boy and the girl ran.<br>She eats and drinks at the table.<br>... |
| 8 | 8, 17, 20, 21 | The small cat and the big dog ran.<br>The fish and the dolphin swam and jumped.<br>A small ball bounced loudly on the floor.<br>... |
| 9 | 9, 12, 16, 19 | The small cat and the big dog ran quickly.<br>The big dog jumped over and around the cat.<br>The bug crawled slowly and the bird flew quickly.<br>... |

## Full pattern table (put this in `src/data/patterns.ts` as data):

| # | Symbols | Example |
|---|---|---|
| 1 | art noun verb | The cat ran. |
| 2 | art adj noun verb | The small cat ran. |
| 3 | art adj adj noun verb | The small white cat ran. |
| 4 | art noun verb adv | The cat ran quickly. |
| 5 | art adj noun verb adv | The small cat ran quickly. |
| 6 | art adj adj noun verb adv | The small white cat ran quickly. |
| 7 | art noun conj art noun verb | The cat and the dog ran. |
| 8 | art adj noun conj art adj noun verb | The small cat and the big dog ran. |
| 9 | art adj noun conj art adj noun verb adv | The small cat and the big dog ran quickly. |
| 10 | art noun verb prep art noun | The dog jumped over the cat. |
| 11 | art adj noun verb prep art noun | The big dog jumped over the cat. |
| 12 | art adj noun verb prep conj prep art noun | The big dog jumped over and around the cat. |
| 13 | adv art noun verb | Softly, the girl sings. |
| 14 | adv art adj noun verb | Softly, the young girl sings. |
| 15 | adv art adj adj noun verb | Softly, the pretty, young girl sings. |
| 16 | art noun verb adv conj art noun verb adv | The bug crawled slowly and the bird flew quickly. |
| 17 | art noun conj art noun verb conj verb | The fish and the dolphin swam and jumped. |
| 18 | adv art noun conj art noun verb | Quickly, the boy and the girl ran. |
| 19 | adv art noun verb conj adv art noun verb | Slowly, the turtle crawled, and quickly the hare ran. |
| 20 | art adj noun verb adv prep art noun | A small ball bounced loudly on the floor. |
| 21 | adv art adj noun verb prep art noun | Loudly, a hard rock broke through the window. |
| 22 | pron verb | He jumps. |
| 23 | pron verb adv | He jumps slowly. |
| 24 | pron verb adv conj adv | He jumps slowly and quietly. |
| 25 | pron verb prep art noun | He runs through the door. |
| 26 | pron verb adv prep art noun | He runs quickly through the door. |
| 27 | pron verb adv conj adv | He sings loudly and proudly. |
| 28 | pron verb conj verb | She cleans and dusts. |
| 29 | pron verb conj verb prep art noun | She eats and drinks at the table. |
| 30 | pron verb conj verb prep art noun | He cooks and bakes in the kitchen. |
| 31 | interj pron verb art noun | Eek! I missed the bus! |
| 32 | interj art noun verb adv | Phew! The plane landed safely. |
| 33 | interj art noun verb | Yuck! The popsicle melted. |

> Notes on the data: patterns 29 and 30 share the same symbol sequence (keep both; they are separate entries). Patterns 24 and 27 are also the same sequence. Pattern 31 contains an object noun directly after the verb and needs a transitive verb (section 13.3). Patterns 16 and 19 are two clauses (two subjects, two verbs).
