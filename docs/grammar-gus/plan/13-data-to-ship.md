# 13. Data to ship

## 13.1 Symbols and colors

| Part of speech | Key | Asset file (teacher's recreated set) | Color | Kid hint |
|---|---|---|---|---|
| noun | N | Recreated Grammar Symbols/11.png | #D2232D red triangle | person, place, thing, animal |
| verb | V | .../9.png | #43AD73 green circle | action word |
| adjective | J | .../10.png | #4DB6E6 blue triangle | tells more about a noun |
| adverb | D | .../7.png | #1A67AD dark blue circle | tells HOW |
| article | A | .../4.png | #F08DB5 pink triangle | a, an, the |
| pronoun | R | .../12.png | #E0C800 yellow inverted triangle | takes the place of a noun |
| conjunction | C | .../8.png | #9B7AB9 purple arrow | connects words |
| preposition | P | .../6.png | #7A4318 brown crescent | tells WHERE |
| interjection | I | .../5.png | #F97316 orange drop | a word you shout |

> Use the supplied 4000x4000 PNGs; export 256px and 512px versions for the app. Keep transparent backgrounds. Also ship 1.png (the symbol key chart) as an optional help screen.

## 13.2 Word bank (from the teacher's word-list PDF)

| Type | Words |
|---|---|
| Nouns tier 1 (CVC) | ball bat boy car cat cow dad dog girl kite man mom pet pig rat son van |
| Nouns tier 2 | apple bike bird book clam crayon crowd dime mice rain rose shoe snail snake straw swing tank team woman |
| Nouns tier 3 | animal aunt balloon chicken children deer doctor family frog goose grandmother horse kitten owl rabbit sister spy tiger uncle wheel zebra |
| Adjectives | bald beautiful big brave calm chubby dazzling fancy gentle great handsome happy lazy plain plump polite pretty silly small thankful tiny |
| Adverbs | gently innocently lightly loudly messily quickly quietly slowly softly swiftly tenderly warmly wildly zealously |
| Prepositions | above across along around below behind down from in into on over past through to under underneath up upon within |
| Pronouns | I he she it they we you |
| Articles | a (becomes an automatically), the |
| Conjunctions | and but for nor or (see rules in section 12) |
| Interjections | Eek Golly Wow Whew Yuck |

> Plural nouns: mice, children. Non-count (no "a"): rain. Collective nouns (crowd, team, family) are singular. Give each noun an emoji or picture for decoding support (examples: cat, dog, apple, zebra); keep a map `nounEmoji`. Words in tier order follow level: tier 1 only at the easiest setting, all tiers at the hardest. Make tiers a teacher setting.

## 13.3 Verb table

| base | 3rd person (he/she/it) | past | object use |
|---|---|---|---|
| chop | chops | chopped | needs object (T) |
| climb | climbs | climbed | either (B) |
| drink | drinks | drank | either (B) |
| eat | eats | ate | either (B) |
| fall | falls | fell | no object (I) |
| hide | hides | hid | either (B) |
| jump | jumps | jumped | no object (I) |
| kick | kicks | kicked | needs object (T) |
| mix | mixes | mixed | needs object (T) |
| run | runs | ran | no object (I) |
| sing | sings | sang | either (B) |
| slide | slides | slid | no object (I) |
| spin | spins | spun | either (B) |
| talk | talks | talked | no object (I) |
| walk | walks | walked | either (B) |

> Decision for the teacher: the word list has "hid" and "slid"; this plan stores the base forms "hide" and "slide" so tense works. Pattern 31 may use T or B verbs only; all other patterns use B or I verbs only.

## 13.4 TypeScript model

```
type Pos = 'N'|'V'|'J'|'D'|'A'|'R'|'C'|'P'|'I';
type Tense = 'past' | 'present' | 'future';

interface Pattern { id: number; symbols: Pos[]; example: string; }
interface Reel   { pos: Pos; word: string | null; locked: boolean; }

interface VerbEntry { base: string; third: string; past: string; objectUse: 'T'|'B'|'I'; }
interface NounEntry { word: string; tier: 1|2|3; plural?: boolean; noA?: boolean; emoji?: string;
                      kind: 'human'|'animal'|'thing'; }

interface Settings { columns: number; tense: Tense | 'random'; nounTier: 1|2|3;
                     symbolSpin: boolean; readAloud: boolean; sound: boolean; calm: boolean;
                     patternFocus?: number; }

interface SpinResult { pattern: Pattern; reels: Reel[]; text: string; segments: Segment[]; silly: number; }
```
