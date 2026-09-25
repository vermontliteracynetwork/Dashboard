// Direct teacher instruction: a "what's new" changelog, shown as a real
// page-turning book (same BookPanel the Joke Book/Pet Book already use),
// one change per page, auto-opening the first time a student logs in
// after something new that affects them has shipped. This file is the
// one place that list lives — student-facing only (a Build Mode tooling
// fix, for instance, never belongs here), plain language, newest first.
// Maintenance convention: add a new entry here whenever a change actually
// visible/usable by a student ships, using today's date and a short id.
export interface ChangelogEntry {
  id: string; // stable, unique, sorts newest-first alongside `date`
  date: string; // YYYY-MM-DD
  icon: string;
  title: string;
  body: string;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: '2026-09-25-lm-print-projector',
    date: '2026-09-25',
    icon: '🖨️',
    title: 'Print your board or go big for the class',
    body: 'Literacy Manipulatives now has a Print button that prints your board, and a Projector Mode button that makes everything bigger and easier to see from across the room.',
  },
  {
    id: '2026-09-25-lm-morpheme-spelling-rule',
    date: '2026-09-25',
    icon: '✂️',
    title: 'Spelling changes show up when word parts join',
    body: 'When you connect morpheme pieces that make a real word, sometimes the spelling changes a little, like the silent e dropping in "care" plus "-ing" makes "caring." Now a little badge pops up right where the pieces meet to show you.',
  },
  {
    id: '2026-09-25-lm-grapheme-colors-connector',
    date: '2026-09-25',
    icon: '🎨',
    title: 'Vowel and consonant colors, plus connector letters',
    body: 'Alphabet and Grapheme tiles now have a "Vowel/consonant colors" button that colors vowels red and consonants blue. Split-vowel tiles like a_e now show a little curved line connecting the two letters instead of a plain underscore.',
  },
  {
    id: '2026-09-25-lm-listening-chime',
    date: '2026-09-25',
    icon: '🎙️',
    title: 'A little chime when the microphone starts',
    body: 'When you tap the microphone button in Literacy Manipulatives, you now hear a little chime letting you know it is listening, and another one when it stops.',
  },
  {
    id: '2026-09-25-lm-punctuation-tiles',
    date: '2026-09-25',
    icon: '❓',
    title: 'New Punctuation tiles',
    body: 'Some students now have a Punctuation category in Literacy Manipulatives with tiles for periods, question marks, commas, and more. Hover over a tile to see what it does. Ask your teacher if you do not see it and want it.',
  },
  {
    id: '2026-09-25-boats-splash-sound',
    date: '2026-09-25',
    icon: '⛵',
    title: 'Boats have splash and engine sound now',
    body: 'Sail a boat and you will hear a soft engine sound and see a splash trail behind you that gets bigger the faster you go, plus a gentle bump sound near a dock or shore. Check Settings if you want to turn vehicle sound off, or turn on Reduce Motion to turn off the splash trail.',
  },
  {
    id: '2026-09-25-marketplace-amazon-look',
    date: '2026-09-25',
    icon: '🛍️',
    title: 'Marketplace has a new look',
    body: 'The Marketplace now has a sidebar on the side to pick what you want to shop for, and bigger item cards with a big Add to Cart button on each one. Searching and filtering still work just like before.',
  },
  {
    id: '2026-09-25-computer-laptop-look',
    date: '2026-09-25',
    icon: '💻',
    title: 'More screens look like real webpages now',
    body: 'Cinema, Arcade, Gallery, Farmer\'s Market, and Silly Quizzes all show up inside the laptop screen look now, with the same Back button as everywhere else on your Computer. Chat has a browser-style bar at the top too.',
  },
  {
    id: '2026-09-25-lm-synced-tts',
    date: '2026-09-25',
    icon: '🔈',
    title: 'Words light up when they are read aloud',
    body: 'In Literacy Manipulatives, when you tap a 🔈 button on a word list, a morpheme card, or a finished Sentence Formula sentence, the word being spoken lights up as it is read. It works on most devices; on a few it will still read aloud, just without the light-up.',
  },
  {
    id: '2026-09-25-lm-new-symbols',
    date: '2026-09-25',
    icon: '🔺',
    title: 'Brand new Grammar Symbols look',
    body: 'Grammar Symbols got a whole new set of pictures and colors! Noun is a red triangle now, verb is a green circle, pronoun is a yellow upside-down triangle, and more. The new look shows up everywhere symbols do, including Symbol Sentences.',
  },
  {
    id: '2026-09-24-lm-keyboard-delete',
    date: '2026-09-24',
    icon: '⌫',
    title: 'Delete key removes a selected item',
    body: 'Select something on your Literacy Manipulatives board and press Backspace or Delete on your keyboard to remove it, same as tapping the X.',
  },
  {
    id: '2026-09-24-lm-shape-settings-textfield',
    date: '2026-09-24',
    icon: '⚙️',
    title: 'Grammar Symbols can get their own text field',
    body: 'Select a Grammar Symbol on your board and a settings button shows up next to the X. Tap it and choose "Add a text field" to drop a real text box right next to the symbol, so you can write in your own word.',
  },
  {
    id: '2026-09-24-lm-formulas-symbol-sentences',
    date: '2026-09-24',
    icon: '🧷',
    title: 'Sentence Formulas move now, and more Literacy Manipulatives fixes',
    body: 'You can drag a Sentence Formula card around by its title now, and drop one right under another to join them into a paragraph. Symbol Sentences move as one piece now, and tap the little symbols row to see its settings, where you can type in the real words. Letters and graphemes snap right into Sound Boxes. The X to delete something only shows up once you pick it or tap it, so your board looks cleaner. Grammar Symbols in the side list are a bit smaller so more fits on screen, and Symbol Sentences are grouped with names like Descriptive and Complex Sentences instead of page numbers.',
  },
  {
    id: '2026-09-23-lm-tense-symbols',
    date: '2026-09-23',
    icon: '🔺',
    title: 'Bigger symbols, sentence settings, and hover hints',
    body: 'Grammar Symbols are twice as big now. Hover or tap and hold on a symbol to see its name and what it means. Sentence Formulas have two new buttons next to the X: a gear for settings (change your sentence to past, present, or future, and your words update to match) and a copy button to duplicate a formula with all your words still in it.',
  },
  {
    id: '2026-09-23-lm-paragraphs',
    date: '2026-09-23',
    icon: '📋',
    title: 'Build paragraphs with Sentence Formulas',
    body: 'Finish a Sentence Formula and it now shows your full sentence in a box, capitalized and ready. Tap "Add to paragraph" to send it to a text box, and keep adding more sentences to build a whole paragraph. The check now looks at capital letters too. Word lists in the dropdowns are in ABC order now, scroll to see more, and you can type the start of a word to find it fast. Dropdowns and text boxes both have a microphone button to talk instead of typing.',
  },
  {
    id: '2026-09-23-lm-grammar-check-more',
    date: '2026-09-23',
    icon: '✅',
    title: 'Sentence check and more fixes in Literacy Manipulatives',
    body: 'Fill in a whole Sentence Formula and a new card checks your words and tells you exactly what to fix, with a speaker button to hear it. Morpheme word definitions now have a speaker button too. Puzzle pieces click together better. Graphemes are sorted into groups now instead of one long list. You can drag something back onto the left side to delete it. The voice picker no longer shows a confusing "My Voice" option.',
  },
  {
    id: '2026-09-23-lm-zoom-delete',
    date: '2026-09-23',
    icon: '🔍',
    title: 'Zoom and delete in Literacy Manipulatives',
    body: 'Use the new zoom buttons at the top to make your board bigger or smaller. Every symbol, letter, and tile now has a small X on it so you can delete just that one thing. Sound Frames is now called Sound Boxes, and letters always show up in front of the boxes now. There is also a quick Text button right next to Draw.',
  },
  {
    id: '2026-09-23-lm-text-box',
    date: '2026-09-23',
    icon: '⌨️',
    title: 'New Text Box in Literacy Manipulatives',
    body: 'Tap Text Box on the left and drag it onto your board. Double-tap it to type, or tap the microphone to talk instead. You can also make the words bigger or smaller.',
  },
  {
    id: '2026-09-23-lm-drag-fix',
    date: '2026-09-23',
    icon: '🔧',
    title: 'Fixed dragging in Literacy Manipulatives',
    body: 'Dragging things from the left side onto your board is working right again.',
  },
  {
    id: '2026-09-23-lm-symbol-sentences',
    date: '2026-09-23',
    icon: '📜',
    title: 'New Symbol Sentences in Literacy Manipulatives',
    body: 'Tap Symbol Sentences on the left to see ready-made sentence cards made of just symbols. Drag one onto your board and its whole row of symbols comes with it. Once it is on your board you can pull the symbols apart and move them just like any other symbol.',
  },
  {
    id: '2026-09-23-lm-grammar-symbols-real',
    date: '2026-09-23',
    icon: '🔺',
    title: 'Real grammar symbol pictures in Literacy Manipulatives',
    body: 'Grammar Shapes is now called Grammar Symbols, and its tiles show the real symbol pictures instead of plain drawn shapes. The morpheme puzzle pieces got a new look too, with a little bump on top like a real puzzle piece. Word Lists can now be dragged onto your board too, not just tapped to hear, and the tool list on the left scrolls properly now so you can always see every section. The Sentence Grammar section is taking a short break and will be back later.',
  },
  {
    id: '2026-09-22-lm-save-toolbar',
    date: '2026-09-22',
    icon: '💾',
    title: 'Save your Literacy Manipulatives board!',
    body: 'Tap "Save" at the top to name and save your board, then find it again anytime in "My Boards." There is also a Redo button now next to Undo, and you can tap "Hide bar" to get more room to work.',
  },
  {
    id: '2026-09-22-lm-redesign',
    date: '2026-09-22',
    icon: '🧩',
    title: 'Literacy Manipulatives got a big redesign!',
    body: 'Everything is on one board now. Tap a tool on the left, like Alphabet, Grammar Shapes, Morphemes, Graphemes, Sound Frames, or Sentence Formulas, and drag it anywhere. Double-tap a letter to flip it upper or lower case. Morpheme puzzle pieces click together and show you the word\'s meaning when they spell something real. Draw and Mark are one button now, with a highlighter too.',
  },
  {
    id: '2026-09-22-sound-wall',
    date: '2026-09-22',
    icon: '🧱',
    title: 'New Sound Wall in My Tools!',
    body: 'Tap any sound to hear it, see the letters that spell it, how your mouth makes it, and a list of words with that sound. Tap Close to go back.',
  },
  {
    id: '2026-09-22-read-highlight',
    date: '2026-09-22',
    icon: '🔈',
    title: 'New: hear any part you highlight in Articles!',
    body: 'Select some text in an Article and tap "Read it" to hear just that part. Already saved a highlight? Open it and tap "Read this part."',
  },
  {
    id: '2026-09-22-lm-sidebar-collapse',
    date: '2026-09-22',
    icon: '🧩',
    title: 'Literacy Manipulatives sidebar is tidier now',
    body: 'Tap a section like "Naming words" or "Action words" to open just that one, instead of seeing everything at once.',
  },
  {
    id: '2026-09-22-nav-buttons-clean',
    date: '2026-09-22',
    icon: '🕹️',
    title: 'Driving and walking buttons are easier to hold now',
    body: 'Holding down a move button, or the gas and brake, used to sometimes pop up a copy menu on your screen and stop you from moving. Fixed! The buttons are icons only now, no more getting stuck.',
  },
  {
    id: '2026-09-22-solid-everywhere',
    date: '2026-09-22',
    icon: '🧱',
    title: 'Everything you place is solid now, everywhere',
    body: 'In your Home Room, furniture you bought from the Marketplace now stops you from walking through it too, just like everywhere else.',
  },
  {
    id: '2026-09-22-unstuck',
    date: '2026-09-22',
    icon: '🚶',
    title: 'No more getting stuck next to things',
    body: 'If you brushed up against something while walking or driving, you could sometimes get a little stuck. Fixed in Town Square, Creative Island, and your Home Room.',
  },
  {
    id: '2026-09-22-pet-more-colors',
    date: '2026-09-22',
    icon: '🎨',
    title: 'More pet colors to pick from',
    body: 'Your pet’s Color row now has a "more colors" option too, not just the 12 squares, so you can pick any color you want.',
  },
  {
    id: '2026-09-22-music-fixed',
    date: '2026-09-22',
    icon: '🎶',
    title: 'Skipping songs works right now',
    body: 'Next and Previous on the music player were not working. Fixed!',
  },
  {
    id: '2026-09-22-auto-questions',
    date: '2026-09-22',
    icon: '🧠',
    title: 'New practice questions for gas refills',
    body: 'If there are not enough questions loaded yet, you might get a math fact or a word-parts question instead, so you can always keep playing.',
  },
  {
    id: '2026-09-22-laptop-screens',
    date: '2026-09-22',
    icon: '💻',
    title: 'The Bank, Mail, and Marketplace look like a real computer now',
    body: 'Those screens show up inside a laptop now, just like your Computer at home already did. Same look everywhere you go.',
  },
  {
    id: '2026-09-22-music-background',
    date: '2026-09-22',
    icon: '🎵',
    title: 'Music keeps playing now!',
    body: 'Pick a song from the radio, Concert Hall, or Boom Box, and it keeps playing even after you leave Town Square, like while you are doing an assignment. Look for the little music button in the corner. Tap it to see the full controls.',
  },
  {
    id: '2026-09-22-gas-pump',
    date: '2026-09-22',
    icon: '⛽',
    title: 'Fill up your car with a Gas Pump!',
    body: 'Cars use gas now while you drive. If you find a Gas Pump in Town Square, walk up and tap it to answer a question and fill your tank. You can also tap the gas gauge at the top of the screen any time.',
  },
  {
    id: '2026-09-22-driving-fixed',
    date: '2026-09-22',
    icon: '🚗',
    title: 'Driving feels right now',
    body: 'Left and right were switched while driving a car or boat. Fixed! Turning now goes the way you expect.',
  },
  {
    id: '2026-09-22-solid-things',
    date: '2026-09-22',
    icon: '🧱',
    title: 'Things in Town Square are solid now',
    body: 'Buildings, trees, and everything else placed in Town Square now stop you from walking or driving through them, just like real things do.',
  },
  {
    id: '2026-09-22-sky-fixed',
    date: '2026-09-22',
    icon: '☀️',
    title: 'The sky looks right again',
    body: 'The sky is one clean color now, no more weird shapes.',
  },
  {
    id: '2026-09-16-camera-look-up-down',
    date: '2026-09-16',
    icon: '🔭',
    title: 'Look up and down now too!',
    body: 'The camera can tilt up and down while you play, not just side to side. Use the new Up and Down buttons, or drag with your mouse.',
  },
  {
    id: '2026-09-16-pie-menu',
    date: '2026-09-16',
    icon: '🧭',
    title: 'Tap yourself for a quick menu!',
    body: 'Tap your own character to open a quick menu for Settings, the Map, My Stuff, and My Home. No more hunting around the screen for buttons.',
  },
  {
    id: '2026-09-16-pet-book',
    date: '2026-09-16',
    icon: '🐾',
    title: 'A new Pet Book!',
    body: 'Open your backpack and look for the Pet Book. Flip through every pet you own, just like the Joke Book.',
  },
  {
    id: '2026-09-16-pet-walk',
    date: '2026-09-16',
    icon: '🐶',
    title: 'Pets walk beside you the right size now',
    body: 'Your pet companion is properly sized next to you now, and turns to face the same way you do while it walks along beside you.',
  },
  {
    id: '2026-09-16-island',
    date: '2026-09-16',
    icon: '🏝️',
    title: 'A brand new Creative Island!',
    body: 'Ask your teacher to unlock your very own Creative Island, a free-build space where you can place anything from the whole catalog, no limits.',
  },
  {
    id: '2026-09-16-wizard',
    date: '2026-09-16',
    icon: '⚡',
    title: 'Meet Wizard ThunderSword',
    body: 'If you’ve been playing a long time without working on your assignments, Wizard ThunderSword will fly in to help point you back to what you still need to do.',
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG_ENTRIES[0]?.id ?? null;

export function hasUnseenChangelog(lastSeenId: string | null | undefined): boolean {
  return !!LATEST_CHANGELOG_ID && lastSeenId !== LATEST_CHANGELOG_ID;
}
