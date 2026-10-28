// Plants and wild critters for the Habitat (Build Queue 135, 136, her words, 2026-10-14: "add
// plants/flora/fauna" and "plants should have a level of naturopathy/alchemy. plants can be used in
// potion making. some plants should be bad for you and have negative effects, and some should be
// healing. plants can be planted and harvested within biomes (relative to their actual survival: coral
// in water, for example). flora/fauna exists naturally in biomes too and should be planted sparsely and
// randomly to be collected"). Each plant grows only where it really could, has a real plant-lore fact
// and an alchemy use, and is healing, food, magic or harmful. Picked or harvested plants go into the
// pantry as Cauldron ingredients.
import { SN } from './supernature';
import { KIND_CHOICES, STEMS, LEAVES, plantUrl, whereItLives, type MadePlant, type PlantSpec } from './supernaturePlantMaker';

export type PlantKind = 'healing' | 'food' | 'magic' | 'harmful';
export type PlantPlace = 'grassland' | 'forest' | 'desert' | 'snow' | 'swamp' | 'ocean';
export interface Plant { id: string; name: string; kind: PlantKind; where: PlantPlace[]; winter?: boolean; lore: string; alchemy: string; eaten: string; status?: string }
const P = `${SN}plants/`;
// Her Plants pack (2026-10-14): garden growing stages and the snapjaw flower come from it.
export const plantImg = (id: string) => (SPECS.has(id) ? plantUrl(SPECS.get(id)!) : id === 'snapjaw' ? `${P}pack/snapjaw.png` : id === 'seed' ? `${P}pack/stage-seed.png` : id === 'sprout' ? `${P}pack/stage-sprout.png` : `${P}${id}.png`);
export const SNAPJAW_STRIP = `${P}pack/snapjaw0.png`;
export const PLANTS: Plant[] = [
  { id: 'chamomile', name: 'Chamomile', kind: 'healing', where: ['grassland'], lore: 'Chamomile tea has been used for thousands of years to help people feel calm and sleepy.', alchemy: 'Calms: used in Calma.', eaten: 'feels calm and rested' },
  { id: 'lavender', name: 'Lavender', kind: 'healing', where: ['grassland'], lore: 'The smell of lavender helps many people relax. Bees love it too.', alchemy: 'Calms: used in Calma.', eaten: 'smells lovely and relaxes' },
  { id: 'peppermint', name: 'Peppermint', kind: 'healing', where: ['grassland', 'swamp'], lore: 'Peppermint tea can help an upset tummy feel better.', alchemy: 'Settles: used in Antidota.', eaten: 'feels fresh and minty' },
  { id: 'echinacea', name: 'Coneflower', kind: 'healing', where: ['grassland'], lore: 'Coneflower (echinacea) is a prairie flower people use when they have a cold.', alchemy: 'Protects: used in Antidota.', eaten: 'feels stronger' },
  { id: 'clover', name: 'Clover', kind: 'food', where: ['grassland', 'forest'], lore: 'A four-leaf clover is rare: about 1 in every 5,000 clovers.', alchemy: 'Grows: used in Germina.', eaten: 'munches a tasty snack' },
  { id: 'sneezeweed', name: 'Sneezeweed', kind: 'harmful', where: ['grassland', 'swamp'], lore: 'Its name says it all: sniffing the dried flowers makes people sneeze. It is not good to eat.', alchemy: 'Too sneezy for potions.', eaten: 'starts sneezing and sneezing', status: 'sneezy' },
  { id: 'fern', name: 'Fern', kind: 'food', where: ['forest', 'swamp'], lore: 'Ferns are older than the dinosaurs. They grow from tiny spores, not seeds.', alchemy: 'Grows: used in Germina.', eaten: 'nibbles the soft fronds' },
  { id: 'foxglove', name: 'Foxglove', kind: 'harmful', where: ['forest'], lore: 'Foxglove is beautiful but poisonous to eat. Doctors make a careful heart medicine from it.', alchemy: 'Only a doctor may use it. Never in a potion.', eaten: 'gets a tummy ache', status: 'tummy' },
  { id: 'glowcap', name: 'Glowcap mushroom', kind: 'magic', where: ['forest', 'swamp'], lore: 'Some real mushrooms glow in the dark. This is called bioluminescence.', alchemy: 'Glows: a magic plant for night potions.', eaten: 'glows softly for a moment' },
  { id: 'willow', name: 'Willow bark', kind: 'healing', where: ['swamp', 'forest'], lore: 'Long ago people chewed willow bark for aches. Aspirin medicine was first made from it.', alchemy: 'Soothes: used in Herba.', eaten: 'feels its aches go away' },
  { id: 'cattail', name: 'Cattail', kind: 'food', where: ['swamp'], lore: 'Almost every part of a cattail can be eaten. Ducks and muskrats nest in them.', alchemy: 'Feeds: a good potion base.', eaten: 'chews a crunchy stalk' },
  { id: 'sundew', name: 'Sundew', kind: 'harmful', where: ['swamp'], lore: 'Sundews catch bugs with sticky drops on their leaves. They are meat-eating plants!', alchemy: 'Too sticky for potions.', eaten: 'gets stuck in the sticky drops', status: 'sticky' },
  { id: 'waterlily', name: 'Water lily', kind: 'healing', where: ['swamp'], lore: 'Water lily flowers close at night and open again in the morning.', alchemy: 'Calms: used in Calma.', eaten: 'feels peaceful' },
  { id: 'nettle', name: 'Stinging nettle', kind: 'harmful', where: ['forest', 'grassland'], lore: 'Tiny hairs on nettle leaves sting when you touch them. Cooked nettle soup is healthy, though.', alchemy: 'Use gloves! Strong when cooked.', eaten: 'gets itchy from the stinging hairs', status: 'itchy' },
  { id: 'arcticmoss', name: 'Arctic moss', kind: 'food', where: ['snow'], winter: true, lore: 'Reindeer and caribou eat arctic moss all winter long.', alchemy: 'Warms: a base for cold-weather potions.', eaten: 'munches moss under the snow' },
  { id: 'snowlotus', name: 'Snow lotus', kind: 'healing', where: ['snow'], winter: true, lore: 'The snow lotus grows high in cold mountains, where few plants can live.', alchemy: 'Warms and heals: used in Herba.', eaten: 'feels warm inside' },
  { id: 'aloe', name: 'Aloe', kind: 'healing', where: ['desert'], lore: 'The cool gel inside aloe leaves soothes sunburns.', alchemy: 'Soothes: used in Herba.', eaten: 'feels cool and soothed' },
  { id: 'pricklypear', name: 'Prickly pear', kind: 'food', where: ['desert'], lore: 'Prickly pear fruit is sweet, but it is covered in tiny spines. Desert animals eat it for water.', alchemy: 'Feeds: holds water for desert potions.', eaten: 'eats the juicy fruit' },
  { id: 'sagebrush', name: 'Sagebrush', kind: 'food', where: ['desert', 'grassland'], lore: 'Sagebrush smells strong after rain. Many desert animals live under it.', alchemy: 'Feeds: a base for dry-land potions.', eaten: 'nibbles the silver leaves' },
  { id: 'kelp', name: 'Kelp', kind: 'food', where: ['ocean'], lore: 'Giant kelp can grow half a meter in one day. Kelp forests are homes for sea otters.', alchemy: 'Feeds: a sea potion base.', eaten: 'munches kelp' },
  { id: 'coral', name: 'Coral', kind: 'food', where: ['ocean'], lore: 'Coral looks like a plant, but it is made of tiny animals. Coral reefs are homes for many fish.', alchemy: 'Protects: a sea potion base.', eaten: 'swims through the reef' },
  { id: 'snapjaw', name: 'Snapjaw flower', kind: 'harmful', where: ['forest', 'swamp', 'grassland'], lore: 'Like a giant Venus flytrap: it snaps at anything that comes too close. Admire it from far away!', alchemy: 'Too snappy for potions.', eaten: 'got snapped at and jumped back', status: 'startled' },
  { id: 'anemone', name: 'Sea anemone', kind: 'harmful', where: ['ocean'], lore: 'Sea anemones sting small fish, but clownfish live safely inside them.', alchemy: 'Too stingy for potions.', eaten: 'gets stung by the tentacles', status: 'stung' },
];
// Plants the student made in the Plant Maker (Build Queue 157) live alongside the real ones.
let MADE_PLANTS: Plant[] = [];
const SPECS = new Map<string, PlantSpec>();
export function setMadePlants(list: MadePlant[]) {
  SPECS.clear();
  MADE_PLANTS = list.map((m) => {
    SPECS.set(m.id, m.spec);
    const w = whereItLives(m.spec).where;
    const stem = STEMS.find((x) => x.id === m.spec.stem)!, leaf = LEAVES.find((x) => x.id === m.spec.leaf)!;
    return { id: m.id, name: m.name, kind: m.kind, where: w, winter: w.includes('snow'), lore: m.sentence?.trim() || `A plant you made. Its ${stem.label.toLowerCase()} ${stem.does}, and its ${leaf.label.toLowerCase()} ${leaf.does}.`,
      alchemy: KIND_CHOICES.find((k) => k.id === m.kind)!.alchemy, eaten: m.kind === 'harmful' ? 'gets itchy from it' : m.kind === 'healing' ? 'feels better' : m.kind === 'magic' ? 'sparkles for a moment' : 'munches a tasty snack', status: m.kind === 'harmful' ? 'itchy' : undefined };
  });
}
export const madePlantIds = () => MADE_PLANTS.map((p) => p.id);
export const PLANT = (id: string) => PLANTS.find((p) => p.id === id) ?? MADE_PLANTS.find((p) => p.id === id);
export const KIND_LABEL: Record<PlantKind, string> = { healing: '💚 Healing', food: '🍽️ Food', magic: '✨ Magic', harmful: '⚠️ Harmful' };
export const EFFECT_STATUS: Record<string, string> = { sneezy: '🤧 Sneezing from sneezeweed', tummy: '🤢 A tummy ache from foxglove', sticky: '🍯 Stuck in sticky sundew drops', itchy: '😣 Itchy from stinging nettle', stung: '🫧 Stung by a sea anemone', startled: '😳 Startled by a snapjaw flower' };

// Wild critters to spot (fauna). Spotting one adds it to the Plant and Critter Book.
// strip/frames/size (Build Queue 410): an animated pixel sprite strip, `frames` frames wide, drawn `size` pixels tall.
export interface Critter { id: string; name: string; img: string; where: PlantPlace[]; lore: string; strip?: string; frames?: number; size?: number }
const HB = `${SN}habitat/`;
export const CRITTERS: Critter[] = [
  { id: 'leafbug', name: 'Leaf bug', img: `${HB}leafbug.png`, where: ['forest', 'grassland'], lore: 'Leaf insects look so much like leaves that birds fly right past them. That is camouflage!' },
  { id: 'firebug', name: 'Firebug', img: `${HB}firebug.png`, where: ['grassland', 'desert'], lore: 'Firebugs gather in big groups in the sun to stay warm.' },
  { id: 'clampbeetle', name: 'Stag beetle', img: `${HB}clampbeetle.png`, where: ['forest', 'swamp'], lore: 'Stag beetles use their big jaws like antlers. They help break down old wood.' },
  { id: 'scorpion', name: 'Scorpion', img: `${HB}scorpion.png`, where: ['desert'], lore: 'Scorpions glow blue under ultraviolet light. Watch, do not touch!' },
  { id: 'starfish', name: 'Sea star', img: `${HB}starfish.png`, where: ['ocean'], lore: 'A sea star can grow back an arm it lost.' },
  // Build Queue 410: her five asset packs (Basic Asset Pack, Garden Birds, Tiny Tiny Heroes Animals and the sea
  // creatures), animated pixel strips. Left out on purpose (her rule: no blood, no worms, no humans): the eel and the
  // snakes (they look like worms), and every hurt, death and attack sheet from the sea pack.
  { id: 'chick', name: 'Chick', img: `${SN}wild/tiny-chick-1.png`, strip: `${SN}wild/tiny-chick.png`, frames: 4, size: 44, where: ['grassland'], lore: 'Chicks peep to tell their mother hen where they are.' },
  { id: 'hen', name: 'Hen', img: `${SN}wild/clucking-chicken-1.png`, strip: `${SN}wild/clucking-chicken.png`, frames: 4, size: 44, where: ['grassland'], lore: 'Hens cluck to their chicks even before the eggs hatch.' },
  { id: 'goose', name: 'Goose', img: `${SN}wild/honking-goose-1.png`, strip: `${SN}wild/honking-goose.png`, frames: 4, size: 44, where: ['swamp', 'grassland'], lore: 'Geese fly in a V shape, which saves energy for the whole flock.' },
  { id: 'piglet', name: 'Pig', img: `${SN}wild/dainty-pig-1.png`, strip: `${SN}wild/dainty-pig.png`, frames: 4, size: 44, where: ['grassland'], lore: 'Pigs are clever and can learn their own names.' },
  { id: 'lamb', name: 'Sheep', img: `${SN}wild/pasturing-sheep-1.png`, strip: `${SN}wild/pasturing-sheep.png`, frames: 4, size: 44, where: ['grassland'], lore: 'A sheep can remember the faces of about 50 other sheep.' },
  { id: 'skunk', name: 'Skunk', img: `${SN}wild/stinky-skunk-1.png`, strip: `${SN}wild/stinky-skunk.png`, frames: 4, size: 44, where: ['forest'], lore: 'A skunk stamps its feet and lifts its tail as a warning first.' },
  { id: 'porcupine', name: 'Porcupine', img: `${SN}wild/spikey-porcupine-1.png`, strip: `${SN}wild/spikey-porcupine.png`, frames: 4, size: 44, where: ['forest'], lore: 'A porcupine has about 30,000 quills, and new ones grow back.' },
  { id: 'boar', name: 'Wild boar', img: `${SN}wild/mad-boar-1.png`, strip: `${SN}wild/mad-boar.png`, frames: 4, size: 44, where: ['forest'], lore: 'Wild boars dig in the dirt with their snouts to find roots.' },
  { id: 'arcticfox', name: 'Arctic fox', img: `${SN}wild/snow-fox-1.png`, strip: `${SN}wild/snow-fox.png`, frames: 4, size: 44, where: ['snow'], lore: 'An arctic fox has fur on the bottoms of its paws to keep warm.' },
  { id: 'timberwolf', name: 'Timber wolf', img: `${SN}wild/timber-wolf-1.png`, strip: `${SN}wild/timber-wolf.png`, frames: 4, size: 44, where: ['snow', 'forest'], lore: 'Wolves howl to find their pack, even from far away.' },
  { id: 'pondturtle', name: 'Turtle', img: `${SN}wild/slow-turtle-1.png`, strip: `${SN}wild/slow-turtle.png`, frames: 4, size: 44, where: ['swamp'], lore: 'A turtle cannot leave its shell: the shell is part of its skeleton.' },
  { id: 'greenfrog', name: 'Frog', img: `${SN}wild/leaping-frog-1.png`, strip: `${SN}wild/leaping-frog.png`, frames: 4, size: 44, where: ['swamp'], lore: 'Frogs drink water through their skin instead of their mouths.' },
  { id: 'toad', name: 'Toad', img: `${SN}wild/croaking-toad-1.png`, strip: `${SN}wild/croaking-toad.png`, frames: 4, size: 44, where: ['swamp', 'grassland'], lore: 'Toads have bumpy dry skin and can live farther from water than frogs.' },
  { id: 'crab', name: 'Crab', img: `${SN}wild/coral-crab-1.png`, strip: `${SN}wild/coral-crab.png`, frames: 4, size: 44, where: ['ocean'], lore: 'Crabs walk sideways because of the way their legs bend.' },
  { id: 'orangecat', name: 'Orange cat', img: `${SN}wild/meowing-cat-1.png`, strip: `${SN}wild/meowing-cat.png`, frames: 4, size: 44, where: ['grassland'], lore: 'Cats spend about two thirds of their lives asleep.' },
  { id: 'cardinal', name: 'Cardinal', img: `${SN}wild/gb-cardinal-1.png`, strip: `${SN}wild/gb-cardinal.png`, frames: 4, size: 44, where: ['forest', 'snow'], lore: 'Cardinals stay bright red all winter, so they are easy to spot in snow.' },
  { id: 'bluejay', name: 'Blue jay', img: `${SN}wild/gb-blue-jay-1.png`, strip: `${SN}wild/gb-blue-jay.png`, frames: 4, size: 44, where: ['forest'], lore: 'Blue jays can copy the call of a hawk.' },
  { id: 'stellersjay', name: "Steller's jay", img: `${SN}wild/gb-steller-s-jay-1.png`, strip: `${SN}wild/gb-steller-s-jay.png`, frames: 4, size: 44, where: ['forest', 'snow'], lore: "Steller's jays hide seeds to eat later and remember where." },
  { id: 'robin', name: 'Robin', img: `${SN}wild/gb-red-robin-1.png`, strip: `${SN}wild/gb-red-robin.png`, frames: 4, size: 44, where: ['grassland', 'forest'], lore: 'Robins tilt their heads to listen and look for food in the grass.' },
  { id: 'chickadee', name: 'Chickadee', img: `${SN}wild/gb-chickadee-1.png`, strip: `${SN}wild/gb-chickadee.png`, frames: 4, size: 44, where: ['forest', 'snow'], lore: 'Chickadees say their own name: chick-a-dee-dee-dee!' },
  { id: 'housefinch', name: 'House finch', img: `${SN}wild/gb-house-finch-1.png`, strip: `${SN}wild/gb-house-finch.png`, frames: 4, size: 44, where: ['grassland'], lore: 'House finches get their red color from the food they eat.' },
  { id: 'waxwing', name: 'Cedar waxwing', img: `${SN}wild/gb-cedar-waxwing-1.png`, strip: `${SN}wild/gb-cedar-waxwing.png`, frames: 4, size: 44, where: ['forest'], lore: 'Cedar waxwings sometimes pass a berry down a line of birds to share it.' },
  { id: 'hummingbird', name: 'Hummingbird', img: `${SN}wild/gb-hummingbird-1.png`, strip: `${SN}wild/gb-hummingbird.png`, frames: 4, size: 44, where: ['grassland', 'forest'], lore: 'A hummingbird can fly backward and beats its wings about 50 times a second.' },
  { id: 'dove', name: 'White dove', img: `${SN}wild/gb-white-dove-1.png`, strip: `${SN}wild/gb-white-dove.png`, frames: 4, size: 44, where: ['grassland'], lore: 'Doves always find their way home, even from far away.' },
  { id: 'thrush', name: 'Wood thrush', img: `${SN}wild/gb-wood-thrush-1.png`, strip: `${SN}wild/gb-wood-thrush.png`, frames: 4, size: 44, where: ['forest'], lore: 'A wood thrush can sing two notes at the same time.' },
  { id: 'crow', name: 'Crow', img: `${SN}wild/gb-crow-1.png`, strip: `${SN}wild/gb-crow.png`, frames: 4, size: 44, where: ['grassland', 'forest', 'snow'], lore: 'Crows are so clever they can use sticks as tools.' },
  { id: 'magpie', name: 'Magpie', img: `${SN}wild/gb-magpie-1.png`, strip: `${SN}wild/gb-magpie.png`, frames: 4, size: 44, where: ['grassland', 'forest'], lore: 'Magpies can recognize themselves in a mirror.' },
  { id: 'pigeon', name: 'Pigeon', img: `${SN}wild/th-pigeon-1.png`, strip: `${SN}wild/th-pigeon.png`, frames: 4, size: 44, where: ['grassland'], lore: 'Pigeons can find their way home from hundreds of miles away.' },
  { id: 'seabird', name: 'Seabird', img: `${SN}wild/th-crow-1.png`, strip: `${SN}wild/th-crow.png`, frames: 4, size: 44, where: ['ocean', 'snow'], lore: 'Seabirds have special glands that let them drink salty sea water.' },
  { id: 'gull', name: 'Seagull', img: `${SN}wild/th-gull-1.png`, strip: `${SN}wild/th-gull.png`, frames: 4, size: 44, where: ['ocean'], lore: 'Seagulls can drink salt water, then sneeze the extra salt out of their noses.' },
  { id: 'brownbear', name: 'Brown bear', img: `${SN}wild/th-brown-bear-1.png`, strip: `${SN}wild/th-brown-bear.png`, frames: 4, size: 44, where: ['forest'], lore: 'Brown bears can smell food from miles away.' },
  { id: 'blackbear', name: 'Black bear', img: `${SN}wild/th-black-bear-1.png`, strip: `${SN}wild/th-black-bear.png`, frames: 4, size: 44, where: ['forest', 'snow'], lore: 'Black bears are great tree climbers.' },
  { id: 'graywolf', name: 'Gray wolf', img: `${SN}wild/th-gray-wolf-1.png`, strip: `${SN}wild/th-gray-wolf.png`, frames: 4, size: 44, where: ['forest', 'snow'], lore: 'A wolf pack works as a team, led by the parents.' },
  { id: 'redfox', name: 'Red fox', img: `${SN}wild/th-red-fox-1.png`, strip: `${SN}wild/th-red-fox.png`, frames: 4, size: 44, where: ['forest', 'grassland'], lore: 'A red fox uses its bushy tail like a warm blanket.' },
  { id: 'hamster', name: 'Hamster', img: `${SN}wild/th-hamster-1.png`, strip: `${SN}wild/th-hamster.png`, frames: 4, size: 44, where: ['grassland', 'desert'], lore: 'Hamsters carry food in their cheek pouches.' },
  { id: 'blacksheep', name: 'Spotted sheep', img: `${SN}wild/th-sheep-1.png`, strip: `${SN}wild/th-sheep.png`, frames: 4, size: 44, where: ['grassland'], lore: 'Sheep have a wide view and can see almost all the way around them.' },
  { id: 'calico', name: 'Calico cat', img: `${SN}wild/th-cat-1.png`, strip: `${SN}wild/th-cat.png`, frames: 4, size: 44, where: ['grassland'], lore: 'A calico cat has three colors: white, orange and black.' },
  // Build Queue 411: her next four packs (GAP Hobbit and Basic Asset Packs 1, 2 and 3: monsters, magical folk and dragons),
  // animated 4-frame strips. Left out on purpose (her rule: no blood, no worms): the Red Cap, the Bloodshot Eye, the
  // Ocular Watcher and the Death Slime (red drips), the five human spell casters (her earlier no-humans rule), and every
  // Hobbit attack, hit and death sheet (only the idle loop is used).
  { id: 'mn-shrieker', name: 'Shrieker mushroom', img: `${SN}wild/mn-shrieker-1.png`, strip: `${SN}wild/mn-shrieker.png`, frames: 4, size: 44, where: ['forest', 'swamp'], lore: 'A shrieker mushroom squeals loudly whenever anything walks close to it.' },
  { id: 'mn-grimlock', name: 'Cave grimlock', img: `${SN}wild/mn-grimlock-1.png`, strip: `${SN}wild/mn-grimlock.png`, frames: 4, size: 44, where: ['forest', 'snow'], lore: 'Grimlocks live in dark caves and find their way by sound and smell instead of sight.' },
  { id: 'mn-myconid', name: 'Myconid', img: `${SN}wild/mn-myconid-1.png`, strip: `${SN}wild/mn-myconid.png`, frames: 4, size: 44, where: ['forest', 'swamp'], lore: 'Myconids are mushroom folk who talk to each other by puffing out spores.' },
  { id: 'mn-ochre-jelly', name: 'Ochre jelly', img: `${SN}wild/mn-ochre-jelly-1.png`, strip: `${SN}wild/mn-ochre-jelly.png`, frames: 4, size: 44, where: ['desert'], lore: 'An ochre jelly is a wobbly blob that can squeeze through the tiniest crack.' },
  { id: 'mn-ogre', name: 'Brawny ogre', img: `${SN}wild/mn-ogre-1.png`, strip: `${SN}wild/mn-ogre.png`, frames: 4, size: 44, where: ['forest'], lore: 'Ogres are huge and strong, but this one mostly likes long naps in the shade.' },
  { id: 'mn-stone-troll', name: 'Stone troll', img: `${SN}wild/mn-stone-troll-1.png`, strip: `${SN}wild/mn-stone-troll.png`, frames: 4, size: 44, where: ['snow'], lore: 'A stone troll sits so still on the mountain that it looks just like a rock.' },
  { id: 'mn-swamp-troll', name: 'Swamp troll', img: `${SN}wild/mn-swamp-troll-1.png`, strip: `${SN}wild/mn-swamp-troll.png`, frames: 4, size: 44, where: ['swamp'], lore: 'Swamp trolls hum to the frogs at night and the frogs croak back.' },
  { id: 'mn-rosy-slaad', name: 'Rosy slaad', img: `${SN}wild/mn-rosy-slaad-1.png`, strip: `${SN}wild/mn-rosy-slaad.png`, frames: 4, size: 44, where: ['swamp'], lore: 'A slaad is a big frog-like creature that hops from puddle to puddle.' },
  { id: 'mn-murky-slaad', name: 'Murky slaad', img: `${SN}wild/mn-murky-slaad-1.png`, strip: `${SN}wild/mn-murky-slaad.png`, frames: 4, size: 44, where: ['swamp'], lore: 'Murky slaads hide at the bottom of the pond with only their eyes peeking out.' },
  { id: 'mn-cyclops', name: 'Cyclops', img: `${SN}wild/mn-cyclops-1.png`, strip: `${SN}wild/mn-cyclops.png`, frames: 4, size: 44, where: ['grassland'], lore: 'A cyclops has just one big eye, so it turns its whole head to look around.' },
  { id: 'mn-ettin', name: 'Two-headed ettin', img: `${SN}wild/mn-ettin-1.png`, strip: `${SN}wild/mn-ettin.png`, frames: 4, size: 44, where: ['grassland'], lore: 'An ettin has two heads that never agree on which way to walk.' },
  { id: 'mg-fire-elemental', name: 'Fire elemental', img: `${SN}wild/mg-fire-elemental-1.png`, strip: `${SN}wild/mg-fire-elemental.png`, frames: 4, size: 44, where: ['desert'], lore: 'A fire elemental is a spirit made of flame. It loves the hot desert sun.' },
  { id: 'mg-wisp', name: 'Glowing wisp', img: `${SN}wild/mg-wisp-1.png`, strip: `${SN}wild/mg-wisp.png`, frames: 4, size: 44, where: ['swamp', 'forest'], lore: 'Wisps are tiny floating lights that bob over the marsh at dusk.' },
  { id: 'mg-water-elemental', name: 'Water elemental', img: `${SN}wild/mg-water-elemental-1.png`, strip: `${SN}wild/mg-water-elemental.png`, frames: 4, size: 44, where: ['ocean', 'swamp'], lore: 'A water elemental is a spirit made of water. It can splash into a puddle and back again.' },
  { id: 'mg-pixie', name: 'Fluttering pixie', img: `${SN}wild/mg-pixie-1.png`, strip: `${SN}wild/mg-pixie.png`, frames: 4, size: 44, where: ['forest', 'grassland'], lore: 'Pixies flutter from flower to flower like butterflies.' },
  { id: 'mg-treant', name: 'Grizzled treant', img: `${SN}wild/mg-treant-1.png`, strip: `${SN}wild/mg-treant.png`, frames: 4, size: 44, where: ['forest'], lore: 'A treant is a walking tree. Old ones move so slowly that moss grows on them.' },
  { id: 'mg-iron-golem', name: 'Iron golem', img: `${SN}wild/mg-iron-golem-1.png`, strip: `${SN}wild/mg-iron-golem.png`, frames: 4, size: 44, where: ['grassland'], lore: 'An iron golem is a magic statue that guards the meadow. Iron is a strong metal.' },
  { id: 'mg-ice-golem', name: 'Ice golem', img: `${SN}wild/mg-ice-golem-1.png`, strip: `${SN}wild/mg-ice-golem.png`, frames: 4, size: 44, where: ['snow'], lore: 'An ice golem is made of frozen water, so it stays where it is below freezing.' },
  { id: 'mg-shadow-treant', name: 'Shadow treant', img: `${SN}wild/mg-shadow-treant-1.png`, strip: `${SN}wild/mg-shadow-treant.png`, frames: 4, size: 44, where: ['forest'], lore: 'Shadow treants only wake up at night and are grumpy when the sun shines.' },
  { id: 'mg-earth-elemental', name: 'Earth elemental', img: `${SN}wild/mg-earth-elemental-1.png`, strip: `${SN}wild/mg-earth-elemental.png`, frames: 4, size: 44, where: ['desert', 'grassland'], lore: 'An earth elemental is a spirit made of rock and soil.' },
  { id: 'mg-fairy', name: 'Magical fairy', img: `${SN}wild/mg-fairy-1.png`, strip: `${SN}wild/mg-fairy.png`, frames: 4, size: 44, where: ['grassland', 'forest'], lore: 'Fairies sprinkle sparkle dust that helps flowers bloom.' },
  { id: 'dr-baby-green', name: 'Baby green dragon', img: `${SN}wild/dr-baby-green-1.png`, strip: `${SN}wild/dr-baby-green.png`, frames: 4, size: 44, where: ['forest'], lore: 'A baby green dragon hides in the leaves. Its green scales are camouflage.' },
  { id: 'dr-viridian-drake', name: 'Viridian drake', img: `${SN}wild/dr-viridian-drake-1.png`, strip: `${SN}wild/dr-viridian-drake.png`, frames: 4, size: 44, where: ['forest'], lore: 'A drake is a dragon cousin. Viridian means a blue-green color.' },
  { id: 'dr-mud-wyvern', name: 'Mud wyvern', img: `${SN}wild/dr-mud-wyvern-1.png`, strip: `${SN}wild/dr-mud-wyvern.png`, frames: 4, size: 44, where: ['swamp'], lore: 'A wyvern has two legs and two wings. This one loves rolling in mud to cool off.' },
  { id: 'dr-adult-white', name: 'White dragon', img: `${SN}wild/dr-adult-white-1.png`, strip: `${SN}wild/dr-adult-white.png`, frames: 4, size: 44, where: ['snow'], lore: 'White dragons have thick scales that keep them warm in the snow.' },
  { id: 'dr-bronze', name: 'Bronze dragon', img: `${SN}wild/dr-bronze-1.png`, strip: `${SN}wild/dr-bronze.png`, frames: 4, size: 44, where: ['ocean'], lore: 'Bronze dragons live by the sea and love to swim with whales.' },
  { id: 'dr-baby-brass', name: 'Baby brass dragon', img: `${SN}wild/dr-baby-brass-1.png`, strip: `${SN}wild/dr-baby-brass.png`, frames: 4, size: 44, where: ['desert'], lore: 'Brass dragons love warm sand and chatting with every traveler they meet.' },
  { id: 'dr-pygmy-wyvern', name: 'Pygmy wyvern', img: `${SN}wild/dr-pygmy-wyvern-1.png`, strip: `${SN}wild/dr-pygmy-wyvern.png`, frames: 4, size: 44, where: ['grassland'], lore: 'Pygmy means very small. This wyvern is about the size of a cat.' },
  { id: 'dr-adult-green', name: 'Green dragon', img: `${SN}wild/dr-adult-green-1.png`, strip: `${SN}wild/dr-adult-green.png`, frames: 4, size: 44, where: ['forest'], lore: 'Green dragons guard the oldest trees in the forest.' },
  { id: 'dr-poison-drake', name: 'Poison drake', img: `${SN}wild/dr-poison-drake-1.png`, strip: `${SN}wild/dr-poison-drake.png`, frames: 4, size: 44, where: ['swamp'], lore: 'A poison drake has bright warning colors, like a poison dart frog. Look, do not touch!' },
  { id: 'dr-aqua-drake', name: 'Aqua drake', img: `${SN}wild/dr-aqua-drake-1.png`, strip: `${SN}wild/dr-aqua-drake.png`, frames: 4, size: 44, where: ['ocean'], lore: 'Aqua drakes glide over the waves and dive for fish.' },
  { id: 'dr-baby-copper', name: 'Baby copper dragon', img: `${SN}wild/dr-baby-copper-1.png`, strip: `${SN}wild/dr-baby-copper.png`, frames: 4, size: 44, where: ['desert', 'grassland'], lore: 'Copper dragons love jokes and riddles.' },
  { id: 'dr-young-brass', name: 'Young brass dragon', img: `${SN}wild/dr-young-brass-1.png`, strip: `${SN}wild/dr-young-brass.png`, frames: 4, size: 44, where: ['desert'], lore: 'A young brass dragon naps in the sun to warm its scales.' },
  { id: 'dr-baby-white', name: 'Baby white dragon', img: `${SN}wild/dr-baby-white-1.png`, strip: `${SN}wild/dr-baby-white.png`, frames: 4, size: 44, where: ['snow'], lore: 'A baby white dragon slides down snowy hills for fun.' },
  { id: 'dr-young-red', name: 'Young red dragon', img: `${SN}wild/dr-young-red-1.png`, strip: `${SN}wild/dr-young-red.png`, frames: 4, size: 44, where: ['desert'], lore: 'Red dragons love heat and sleep near warm rocks.' },
  { id: 'dr-young-bronze', name: 'Young bronze dragon', img: `${SN}wild/dr-young-bronze-1.png`, strip: `${SN}wild/dr-young-bronze.png`, frames: 4, size: 44, where: ['ocean'], lore: 'Juvenile means young. This bronze dragon is still learning to swim.' },
  { id: 'hobbit', name: 'Hobbit', img: `${SN}wild/gap-hobbit-1.png`, strip: `${SN}wild/gap-hobbit.png`, frames: 4, size: 52, where: ['grassland', 'forest'], lore: 'Hobbits are small story folk who love gardens, snacks and cozy homes dug into hills.' },
  { id: 'jellyfish', name: 'Jellyfish', img: `${SN}wild/sea-jellyfish-1.png`, strip: `${SN}wild/sea-jellyfish.png`, frames: 4, size: 64, where: ['ocean'], lore: 'Jellyfish have no brain, no heart and no bones.' },
  { id: 'seaturtle', name: 'Sea turtle', img: `${SN}wild/sea-turtle-1.png`, strip: `${SN}wild/sea-turtle.png`, frames: 6, size: 64, where: ['ocean'], lore: 'Sea turtles swim thousands of miles and come back to the beach where they hatched.' },
  { id: 'swordfish', name: 'Swordfish', img: `${SN}wild/sea-swordfish-1.png`, strip: `${SN}wild/sea-swordfish.png`, frames: 4, size: 64, where: ['ocean'], lore: 'A swordfish is one of the fastest fish in the sea.' },
  { id: 'anglerfish', name: 'Anglerfish', img: `${SN}wild/sea-anglerfish-1.png`, strip: `${SN}wild/sea-anglerfish.png`, frames: 4, size: 64, where: ['ocean'], lore: 'An anglerfish has a glowing light on its head in the dark deep sea.' },
  { id: 'octopus', name: 'Octopus', img: `${SN}wild/sea-octopus-1.png`, strip: `${SN}wild/sea-octopus.png`, frames: 6, size: 64, where: ['ocean'], lore: 'An octopus has three hearts and can change color in a blink.' },
  { id: 'voidbutterfly', name: 'Night butterfly', img: `${HB}voidbutterfly.png`, where: ['forest', 'swamp', 'snow'], lore: 'Some butterflies and moths fly at night and find flowers by smell.' },
];

// Plant lore rank: how much the student knows about plants and critters (her "level of naturopathy/alchemy").
export const LORE_RANKS = [{ at: 0, name: 'Seed' }, { at: 3, name: 'Sprout' }, { at: 7, name: 'Herbalist' }, { at: 12, name: 'Alchemist' }, { at: 20, name: 'Master Alchemist' }];
export function loreRank(n: number) { let r = LORE_RANKS[0]; for (const x of LORE_RANKS) if (n >= x.at) r = x; const next = LORE_RANKS.find((x) => x.at > n); return { rank: r.name, next }; }

// Where a plant can live, and why not when it cannot.
export function canGrow(p: Plant, place: PlantPlace, season: string): { ok: boolean; why?: string } {
  if (!p.where.includes(place)) return { ok: false, why: `${p.name} only lives in the ${p.where.join(' or ')}.` };
  if (season === 'Winter' && !p.winter && place !== 'ocean') return { ok: false, why: 'It is winter: it is too cold for it to grow until spring.' };
  return { ok: true };
}
// Growing time (Build Queue 190, her words 2026-10-14: "growing faster than currently"): 30 seconds to sprout, 90 seconds
// to be ready (was 1 and 3 minutes). It keeps growing while the student is away.
export const SPROUT_MS = 30_000, GROWN_MS = 90_000;

// Wild plants and critters sprinkled sparsely and randomly in each biome. They grow back every day (Build Queue 190, her
// words: "plants should grow every day"): a new day brings new wild plants, even ones that were picked.
export function wildSpots(place: PlantPlace, abs: number, day = 0): { key: string; plant?: string; critter?: string; x: number; y: number }[] {
  let seed = (abs * 9301 + day * 7919 + place.length * 49297 + place.charCodeAt(0) * 233) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const plants = [...PLANTS, ...MADE_PLANTS].filter((p) => p.where.includes(place));
  const critters = CRITTERS.filter((c) => c.where.includes(place));
  const out: { key: string; plant?: string; critter?: string; x: number; y: number }[] = [];
  const n = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < n && plants.length; i++) out.push({ key: `${abs}:${day}:${place}:p${i}`, plant: plants[Math.floor(rnd() * plants.length)].id, x: 250 + Math.floor(rnd() * 520), y: place === 'ocean' ? 470 + Math.floor(rnd() * 40) : 230 + Math.floor(rnd() * 260) });
  if (critters.length && rnd() < 0.8) out.push({ key: `${abs}:${day}:${place}:c`, critter: critters[Math.floor(rnd() * critters.length)].id, x: 260 + Math.floor(rnd() * 500), y: place === 'ocean' ? 480 : 250 + Math.floor(rnd() * 220) });
  return out;
}
// Garden plots in each biome (Build Queue 190, her words: "each biome should have up to 10 plants in each"): 10 plots in two
// rows near the bottom, clear of the pond and the shelter.
export const PLOT_N = 10;
const rows = (x0: number, step: number, y1: number, y2: number) => Array.from({ length: PLOT_N }, (_, i) => ({ x: x0 + (i % 5) * step + (i >= 5 ? step / 2 : 0), y: i < 5 ? y1 : y2 }));
export const PLOTS: Record<PlantPlace, { x: number; y: number }[]> = {
  grassland: rows(220, 84, 448, 512), forest: rows(220, 84, 448, 512), desert: rows(220, 84, 448, 512),
  snow: rows(220, 84, 448, 512), swamp: rows(220, 84, 448, 512), ocean: rows(300, 96, 440, 506),
};
