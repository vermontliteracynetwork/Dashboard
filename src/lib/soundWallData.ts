// Orton-Gillingham-style Sound Wall — direct teacher request: "an
// interactive sound wall. When each phoneme is clicked, a window should
// pop up showing the list of graphemes to spell that sound, an image of
// accurate mouth placement, word list containing that phoneme, and a
// close to return to sound wall." Rebuilds the old alphabetical
// SOUND_WALL (wordData.ts, kept for backward compatibility, no longer
// used by the SoundWall component) into the real OG convention:
// organized by how the sound is actually made (consonants grouped by
// manner+place of articulation; vowels grouped by mouth position), not
// alphabetically by letter — one phoneme can have several spellings
// (graphemes), which is the whole point of a sound wall over a plain
// alphabet chart.
//
// "An image of accurate mouth placement" — this environment has no way
// to source or verify a real photograph/illustration of articulation
// without risking a wrong or misleading image for exactly the students
// this tool serves. Substituted with an honest, accurate TEXT
// description of mouth/tongue/lip position and voicing instead (ordinary
// articulatory phonetics, ANY of it, not a specialized/copyrighted
// curriculum needing outside verification) — flagged here as a
// substitution for a real photo/illustration the teacher could add
// later, not a silent downgrade.

export type ConsonantCategory = 'stop' | 'nasal' | 'fricative' | 'affricate' | 'liquid' | 'glide';
export type VowelCategory = 'short-vowel' | 'long-vowel' | 'r-controlled' | 'diphthong' | 'other-vowel';
export type SoundCategory = ConsonantCategory | VowelCategory;

export interface SoundWallPhoneme {
  id: string;
  displaySymbol: string; // what shows on the tile
  spokenExample: string; // read aloud when tapped from the wall grid
  category: SoundCategory;
  graphemes: string[]; // every real spelling of this sound, shown in the popup
  mouthPlacement: string; // honest text description, not a real image — see header comment
  words: string[];
}

export const CONSONANT_CATEGORY_LABELS: Record<ConsonantCategory, string> = {
  stop: 'Stops (a quick puff, then stop)',
  nasal: 'Nasals (air through the nose)',
  fricative: 'Fricatives (air keeps flowing)',
  affricate: 'Affricates (stop, then flow)',
  liquid: 'Liquids (smooth, flowing)',
  glide: 'Glides (slide into the next sound)',
};

export const VOWEL_CATEGORY_LABELS: Record<VowelCategory, string> = {
  'short-vowel': 'Short vowels',
  'long-vowel': 'Long vowels',
  'r-controlled': 'R-controlled (Bossy R)',
  diphthong: 'Diphthongs (two sounds gliding together)',
  'other-vowel': 'Other vowel sounds',
};

export const CONSONANTS: SoundWallPhoneme[] = [
  { id: 'p', displaySymbol: '/p/', spokenExample: 'p, as in pig', category: 'stop', graphemes: ['p'], words: ['pig', 'map', 'cup'],
    mouthPlacement: 'Both lips press together, then pop open with a quick puff of air. No sound from your throat (unvoiced).' },
  { id: 'b', displaySymbol: '/b/', spokenExample: 'b, as in ball', category: 'stop', graphemes: ['b'], words: ['ball', 'cab', 'web'],
    mouthPlacement: 'Same lip position as /p/, but your throat buzzes (voiced) as your lips pop open.' },
  { id: 't', displaySymbol: '/t/', spokenExample: 't, as in top', category: 'stop', graphemes: ['t'], words: ['top', 'cat', 'sit'],
    mouthPlacement: 'The tip of your tongue taps right behind your top front teeth, then releases a quick puff of air. Unvoiced.' },
  { id: 'd', displaySymbol: '/d/', spokenExample: 'd, as in dog', category: 'stop', graphemes: ['d'], words: ['dog', 'bed', 'mud'],
    mouthPlacement: 'Same tongue spot as /t/, but your throat buzzes as it releases. Voiced.' },
  { id: 'k', displaySymbol: '/k/', spokenExample: 'k, as in kite', category: 'stop', graphemes: ['c', 'k', 'ck'], words: ['kite', 'cat', 'duck'],
    mouthPlacement: 'The back of your tongue lifts to touch the roof of your mouth, then drops with a puff of air. Unvoiced.' },
  { id: 'g', displaySymbol: '/g/', spokenExample: 'g, as in goat', category: 'stop', graphemes: ['g'], words: ['goat', 'bag', 'dig'],
    mouthPlacement: 'Same back-of-tongue spot as /k/, but your throat buzzes as it releases. Voiced.' },
  { id: 'm', displaySymbol: '/m/', spokenExample: 'm, as in moon', category: 'nasal', graphemes: ['m'], words: ['moon', 'mom', 'swim'],
    mouthPlacement: 'Both lips press gently together and air hums out through your nose. Your throat buzzes the whole time.' },
  { id: 'n', displaySymbol: '/n/', spokenExample: 'n, as in nest', category: 'nasal', graphemes: ['n'], words: ['nest', 'sun', 'pin'],
    mouthPlacement: 'The tip of your tongue rests behind your top front teeth, and air hums out through your nose.' },
  { id: 'ng', displaySymbol: '/ng/', spokenExample: 'ng, as in ring', category: 'nasal', graphemes: ['ng', 'n'], words: ['ring', 'sing', 'pink'],
    mouthPlacement: 'The back of your tongue lifts to touch the roof of your mouth (like /g/), but air hums out through your nose instead of popping.' },
  { id: 'f', displaySymbol: '/f/', spokenExample: 'f, as in fish', category: 'fricative', graphemes: ['f', 'ff', 'ph'], words: ['fish', 'leaf', 'phone'],
    mouthPlacement: 'Your top teeth rest lightly on your bottom lip, and air hisses through the gap. Unvoiced.' },
  { id: 'v', displaySymbol: '/v/', spokenExample: 'v, as in van', category: 'fricative', graphemes: ['v'], words: ['van', 'love', 'five'],
    mouthPlacement: 'Same teeth-on-lip spot as /f/, but your throat buzzes. Voiced.' },
  { id: 's', displaySymbol: '/s/', spokenExample: 's, as in sun', category: 'fricative', graphemes: ['s', 'ss', 'c'], words: ['sun', 'bus', 'class'],
    mouthPlacement: 'Your tongue tip sits close behind your top teeth, and air hisses out over it in a thin stream, like a snake. Unvoiced.' },
  { id: 'z', displaySymbol: '/z/', spokenExample: 'z, as in zebra', category: 'fricative', graphemes: ['z', 'zz', 's'], words: ['zebra', 'buzz', 'is'],
    mouthPlacement: 'Same tongue spot as /s/, but your throat buzzes like a bee. Voiced.' },
  { id: 'th-voiceless', displaySymbol: '/th/', spokenExample: 'th, as in thumb', category: 'fricative', graphemes: ['th'], words: ['thumb', 'bath', 'think'],
    mouthPlacement: 'Your tongue tip pokes gently between your top and bottom teeth, and air hisses past it. No buzz (unvoiced) — as in "thumb."' },
  { id: 'th-voiced', displaySymbol: '/th/ (buzzy)', spokenExample: 'th, as in that', category: 'fricative', graphemes: ['th'], words: ['that', 'this', 'mother'],
    mouthPlacement: 'Same tongue-between-teeth spot as thumb\'s /th/, but your throat buzzes — as in "that."' },
  { id: 'sh', displaySymbol: '/sh/', spokenExample: 'sh, as in ship', category: 'fricative', graphemes: ['sh'], words: ['ship', 'fish', 'wash'],
    mouthPlacement: 'Round your lips a little and pull your tongue back slightly from the /s/ spot. Air hisses out in a wider stream. Unvoiced.' },
  { id: 'h', displaySymbol: '/h/', spokenExample: 'h, as in hat', category: 'fricative', graphemes: ['h'], words: ['hat', 'house', 'who'],
    mouthPlacement: 'Your mouth is open and relaxed (shaped for the next vowel) while a soft puff of breath passes through, like fogging a mirror.' },
  { id: 'ch', displaySymbol: '/ch/', spokenExample: 'ch, as in chip', category: 'affricate', graphemes: ['ch', 'tch'], words: ['chip', 'lunch', 'watch'],
    mouthPlacement: 'Starts like /t/ (tongue tip up), then releases into /sh/ in one quick motion. Unvoiced.' },
  { id: 'j', displaySymbol: '/j/', spokenExample: 'j, as in jam', category: 'affricate', graphemes: ['j', 'ge', 'dge'], words: ['jam', 'cage', 'bridge'],
    mouthPlacement: 'Same motion as /ch/ (stop, then release), but your throat buzzes. Voiced.' },
  { id: 'l', displaySymbol: '/l/', spokenExample: 'l, as in lamp', category: 'liquid', graphemes: ['l', 'll'], words: ['lamp', 'ball', 'sleep'],
    mouthPlacement: 'Your tongue tip touches right behind your top teeth while air flows smoothly out around the sides of your tongue. Voiced.' },
  { id: 'r', displaySymbol: '/r/', spokenExample: 'r, as in rain', category: 'liquid', graphemes: ['r', 'rr'], words: ['rain', 'car', 'sorry'],
    mouthPlacement: 'Your tongue curls back slightly without touching the roof of your mouth, and your lips round a little. Voiced.' },
  { id: 'w', displaySymbol: '/w/', spokenExample: 'w, as in web', category: 'glide', graphemes: ['w'], words: ['web', 'wind', 'away'],
    mouthPlacement: 'Round your lips tightly like you\'re about to whistle, then glide quickly into the next vowel. Voiced.' },
  { id: 'y', displaySymbol: '/y/', spokenExample: 'y, as in yarn', category: 'glide', graphemes: ['y'], words: ['yarn', 'yes', 'yellow'],
    mouthPlacement: 'The middle of your tongue lifts close to the roof of your mouth, then glides quickly into the next vowel. Voiced.' },
];

export const VOWELS: SoundWallPhoneme[] = [
  { id: 'short-a', displaySymbol: 'ă', spokenExample: 'short a, as in cat', category: 'short-vowel', graphemes: ['a'], words: ['cat', 'hat', 'map'],
    mouthPlacement: 'Mouth opens wide, jaw drops low, tongue stays low and flat in the front of your mouth.' },
  { id: 'short-e', displaySymbol: 'ĕ', spokenExample: 'short e, as in bed', category: 'short-vowel', graphemes: ['e'], words: ['bed', 'net', 'hen'],
    mouthPlacement: 'Mouth opens a medium amount, corners pulled slightly back, tongue sits mid-height near the front.' },
  { id: 'short-i', displaySymbol: 'ĭ', spokenExample: 'short i, as in pig', category: 'short-vowel', graphemes: ['i'], words: ['pig', 'sit', 'win'],
    mouthPlacement: 'Mouth barely opens, lips relaxed, tongue high and near the front, close to a smile shape.' },
  { id: 'short-o', displaySymbol: 'ŏ', spokenExample: 'short o, as in dog', category: 'short-vowel', graphemes: ['o'], words: ['dog', 'mop', 'pot'],
    mouthPlacement: 'Mouth opens round like an "O" shape, jaw drops, tongue pulls back and low.' },
  { id: 'short-u', displaySymbol: 'ŭ', spokenExample: 'short u, as in sun', category: 'short-vowel', graphemes: ['u'], words: ['sun', 'cup', 'bus'],
    mouthPlacement: 'Mouth opens just a little, relaxed and neutral, tongue sits in the middle, not pushed forward or back.' },
  { id: 'long-a', displaySymbol: 'ā', spokenExample: 'long a, as in cake', category: 'long-vowel', graphemes: ['a_e', 'ai', 'ay'], words: ['cake', 'rain', 'play'],
    mouthPlacement: 'Lips spread toward a smile, tongue starts mid-high in front and glides slightly higher as you say it (this vowel says its own letter name).' },
  { id: 'long-e', displaySymbol: 'ē', spokenExample: 'long e, as in tree', category: 'long-vowel', graphemes: ['e_e', 'ee', 'ea', 'y'], words: ['tree', 'read', 'baby'],
    mouthPlacement: 'Lips pull back into a wide smile, tongue is high and forward, close to your top teeth.' },
  { id: 'long-i', displaySymbol: 'ī', spokenExample: 'long i, as in bike', category: 'long-vowel', graphemes: ['i_e', 'igh', 'y', 'ie'], words: ['bike', 'night', 'fly'],
    mouthPlacement: 'Starts with mouth open and tongue low, then glides up and forward toward a smile shape (two sounds blended into one).' },
  { id: 'long-o', displaySymbol: 'ō', spokenExample: 'long o, as in boat', category: 'long-vowel', graphemes: ['o_e', 'oa', 'ow', 'o'], words: ['boat', 'home', 'snow'],
    mouthPlacement: 'Lips round into a small circle, tongue pulls back and glides slightly higher as you say it.' },
  { id: 'long-u-yoo', displaySymbol: 'yoo', spokenExample: 'long u, as in cube', category: 'long-vowel', graphemes: ['u_e', 'ue', 'ew'], words: ['cube', 'few', 'music'],
    mouthPlacement: 'Starts with the /y/ glide (tongue high, close to the roof of your mouth), then rounds into an "oo" shape.' },
  { id: 'oo-long', displaySymbol: 'long oo', spokenExample: 'long oo, as in moon', category: 'other-vowel', graphemes: ['oo', 'ue', 'ew', 'u_e'], words: ['moon', 'blue', 'chew'],
    mouthPlacement: 'Lips round tightly into a small circle, tongue pulls high and back.' },
  { id: 'oo-short', displaySymbol: 'short oo', spokenExample: 'short oo, as in book', category: 'other-vowel', graphemes: ['oo'], words: ['book', 'look', 'foot'],
    mouthPlacement: 'Same rounded lips as long "oo," but more relaxed and the sound is shorter and looser.' },
  { id: 'aw', displaySymbol: 'aw', spokenExample: 'aw, as in saw', category: 'other-vowel', graphemes: ['aw', 'au', 'all'], words: ['saw', 'haul', 'ball'],
    mouthPlacement: 'Mouth opens wide and round, jaw drops low, lips slightly rounded.' },
  { id: 'ar', displaySymbol: 'ar', spokenExample: 'ar, as in car', category: 'r-controlled', graphemes: ['ar'], words: ['car', 'star', 'farm'],
    mouthPlacement: 'Mouth opens for a low "ah," then the tongue curls back for the /r/ right after — the vowel and the R blend into one sound.' },
  { id: 'or', displaySymbol: 'or', spokenExample: 'or, as in for', category: 'r-controlled', graphemes: ['or', 'ore', 'oar'], words: ['for', 'more', 'board'],
    mouthPlacement: 'Lips round for "oh," then the tongue curls back for the /r/ right after, blending into one sound.' },
  { id: 'er', displaySymbol: 'er', spokenExample: 'er, as in her', category: 'r-controlled', graphemes: ['er', 'ir', 'ur'], words: ['her', 'bird', 'hurt'],
    mouthPlacement: 'Tongue curls back right away with lips relaxed — this is the same sound for all three spellings (er, ir, ur), only the letters change.' },
  { id: 'oi', displaySymbol: 'oi/oy', spokenExample: 'oi, as in coin', category: 'diphthong', graphemes: ['oi', 'oy'], words: ['coin', 'boy', 'toy'],
    mouthPlacement: 'Lips round for "oh," then glide quickly into a smile shape for "ee" — two sounds gliding together in one syllable.' },
  { id: 'ou', displaySymbol: 'ou/ow', spokenExample: 'ou, as in out', category: 'diphthong', graphemes: ['ou', 'ow'], words: ['out', 'cow', 'shout'],
    mouthPlacement: 'Mouth opens wide for "ah," then lips round quickly into "oo" — two sounds gliding together in one syllable.' },
];

export const SOUND_WALL_PHONEMES: SoundWallPhoneme[] = [...CONSONANTS, ...VOWELS];
