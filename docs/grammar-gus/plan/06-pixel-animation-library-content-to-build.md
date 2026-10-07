# 6. Pixel animation library (content to build)

## 6.1 Look

- Pixel-art style (16-bit feel): a 160 x 90 internal canvas, a fixed 32-color palette, 1 px dark outlines, two-tone shading, characters about 24 px tall (small 16, big 40), stepped animation at 12 frames per second. Details in section 3.17.
- Every video opens and closes with red pixel theater curtains (section 3.17). Scene changes inside a story use a quick pixel dissolve.
- Characters are simple on purpose: a pixel cat reads as a cat from ears, whiskers and tail. Faces are two dots and a line. Expressions come from the adjective (happy, brave, lazy) and the adverb.

## 6.2 Rig templates (so 60 nouns do not mean 60 separate animations)

| Rig | Nouns using it | Notes |
|---|---|---|
| Biped (person) | boy girl man woman mom dad son aunt uncle grandmother sister doctor spy (children x3, family x3, crowd x5, team x4 as groups) | Small pixel person; accessory kit (stethoscope, glasses, hat, beard) differentiates roles. |
| Quadruped | cat dog cow pig horse deer zebra tiger rabbit kitten animal pet | Body shape, ears, tail and stripes/spots from a feature kit. |
| Small critter | rat mice frog snail clam | Low to the ground; hop, scurry, slide. |
| Bird | bird chicken owl goose bat (bat uses wings) | Wings flap; walk or fly. |
| Serpent | snake | Wavy line body. |
| Vehicle | car van bike wheel | Rolls; honks; can carry the avatar if relevant. |
| Object | ball balloon kite book apple crayon dime rose shoe straw swing tank rain crowd-prop etc. | **Sprout limbs:** any object grows sprite legs and arms for verbs it cannot do, which is the silly default (The rain chopped the zebra). |
| Weather | rain | Cloud with drops; falls, follows, pours. |
| Prop (scenery nouns) | door window table floor kitchen bus (and any noun used as a ground in a preposition phrase) | The Core pack adds these scenery nouns; patterns 20, 21, 25 to 33 use them. |

## 6.3 Verb clips

| Verb | Clip | Needs object | Kid-safe notes |
|---|---|---|---|
| run | Fast stride cycle across the stage; speed lines when fast | no |  |
| walk | Steady stride, relaxed arms | either | walk the dog uses a leash prop |
| jump | Squash-and-stretch hop arc | no | over/onto handled by prepositions |
| climb | Climbs a drawn ladder or the object | either |  |
| fall | Tumble down with stars and a bounce | no | Never hurt: bounce and wobble |
| slide | Slides down a sprite ramp | no |  |
| spin | Twirl with swirl lines | either | Spin the object if present |
| kick | Leg swing, the object flies off screen with a swoosh | yes |  |
| chop | Karate chop; object splits into two cartoon halves with a "chop" burst | yes | Objects only, never characters |
| mix | Bowl and spoon swirl, colored swirl grows | yes |  |
| eat | Mouth opens, object shrinks into mouth, cheeks puff | either | Without an object, an apple appears |
| drink | Cup tilt and gulp, level goes down | either |  |
| hide | Goes behind the object or a bush, eyes peek out | either |  |
| sing | Music notes float, mouth open, optional microphone | either |  |
| talk | Speech bubble with squiggle lines or a few real words | no | Words in the bubble use the caption words if present |

> **Action Pack (verbs beyond the teacher's list; needed for the example sentences):** attack (a cartoon pounce with a poof and stars, target bounces away, nobody is hurt), chase, hug, push, pull, throw, catch, carry, paint, build, dance, fly, swim, laugh, cry, sleep, wave, open, close. Each needs a clip, the verb forms, and the object flag. Teachers can switch off any verb, and a "gentle verbs only" setting hides attack, push and similar.

## 6.4 Adverb modifiers

| Adverb | Effect on the clip |
|---|---|
| quickly, swiftly | Speed x1.8 to x2; speed lines; short dust puffs |
| slowly | Speed x0.4; wobbly effort lines; a small snail-trail sprite |
| loudly | Big sound-wave arcs; shaking line; bigger voice sfx |
| quietly | Tiptoe pose; finger-to-lips shh icon; tiny sound waves |
| softly, gently, lightly | Smaller, eased movement; light bounce; feather or cloud puffs for lightly |
| tenderly | Gentle ease and floating hearts |
| warmly | Yellow glow and a small sun sprite behind the character |
| messily | Ink splats and scribble lines trail the action; items scatter |
| wildly | Zigzag path, spiral lines, bigger arms and legs |
| innocently | Halo and whistling notes, wide eyes, sideways glance |
| zealously | Sparkly eyes, star bursts, extra energy bounce |

## 6.5 Adjective effects

| Group | Words | Effect |
|---|---|---|
| Size | big, great, chubby, plump, small, tiny | Scale up or down; chubby and plump widen the body |
| Mood | happy, calm, gentle, brave, lazy, polite, silly, thankful | Face and pose: smile, relaxed eyes, chest out, drooping, bow, goofy tongue, hands together |
| Look | beautiful, pretty, handsome, fancy, dazzling, plain, bald | Sparkles, bow or hat, shine star, no extra details, no hair |
| Color pack (add in v1) | red, blue, green, yellow, white, black, pink, purple, orange, brown, gray, striped, spotted | Recolors the sprite with the palette color or pattern; needed for white cat / black cat |

## 6.6 Preposition motion

| Words | Motion relative to the ground noun |
|---|---|
| over, above, upon, on, up | Arc over, hover above, or stand on top |
| under, underneath, below, down | Go beneath (the ground noun lifts), sink below, move down |
| through, into, in, within | Pass through a hole drawn in it, or go inside (it opens like a box) |
| around, along, across, past, from, to, behind | Circle around, follow along, cross over, pass by, start from, travel to, hide behind |

## 6.7 Sound

> Short, gentle sound effects per verb and a Gus voice (text to speech) for narration; all volumes capped and every sound has an off switch. Exported videos include sound effects and an optional recorded voice note but not browser text to speech (section 7.5).

## 6.8 Coverage and fallback rules (the screen is never blank)

- Noun x verb: if a rig cannot do a verb, the noun sprouts limbs and does the biped version of the clip. If the verb has no clip for any rig, the director plays a generic wiggle with the verb word floating over the character ("jump!").
- Adverb without an effect for a clip: apply only speed and size changes; always show the adverb word as a tiny caption tag.
- Preposition with a ground noun that cannot be a prop: draw the ground noun as a simple blob with its name label.
- Coverage test (section 31): every noun x every verb x every adverb x every preposition produces a script that the renderer plays without errors.

## 6.9 Content budget: MVP vs later

| Content | MVP (first playable) | Full |
|---|---|---|
| Nouns | 20 across biped, quadruped, bird, object rigs | All 60 plus packs |
| Verbs | run, walk, jump, eat, drink, sing, talk, fall, spin, hide | All 15 plus Action Pack (attack, chase, hug and others) |
| Adverbs | quickly, slowly, loudly, quietly, wildly, softly | All 14 |
| Adjectives | Color pack plus big, small, happy, lazy, silly | All 26 plus color pack |
| Prepositions | over, under, through, on, behind, to, around | All 25 |
| Housings | WHO, WHAT THEY DID, HOW THEY DID IT, WHERE | Plus WHAT IT HAPPENED TO, SHOUT, JOIN |
| Paragraph | Up to 4 sentence machines, script playback | Up to 8, WebM export, storybook PDF |
| Later | Plural gear (-s), Question Machine (Did the cat run?), more packs |  |
