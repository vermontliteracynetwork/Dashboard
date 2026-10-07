# 16. Lock interactions (the tricky part)

- Locking a noun that cannot take "a" (mice, children, rain) forces the article reel in that noun phrase to "the".
- Locking an article "a" removes plural and non-count nouns from that noun phrase.
- Locking a verb in pattern 31 is only allowed if it is transitive-capable. If the student locks an intransitive verb and the pattern is 31, the new spin must choose a different pattern of the same length that has no object.
- Locking a subject pronoun (I, he, they...) keeps verb agreement correct automatically (agreement is always computed after words are chosen, never stored).
- A locked reel never changes symbol type. The pattern selection step filters on locked symbols.
- If the student changes the column count, clear all locks. Lock states (open, keep word, pin drum) and group lock buttons are described in section 19.3.
