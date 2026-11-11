// Build Queue 608: Gilbert's Picture Dictionary. Our own picture dictionary pages (the Oxford Picture Dictionary is
// Oxford's artwork, so it is not used; see 599 and docs/DICTIONARY_THESAURUS.md). Every picture is art already in
// this app: renders of the 3D model library (public/world/thumbnails) and the Restaurant game's food icons
// (public/games/restaurant/icons). Each page is one everyday place, with its things (pictures) and a few things you
// do there (action words, no picture). The part of speech is never written here: the word type engine
// (src/lib/wordTypes.ts) decides it, the same as in the grammar checks.

// `look` is the dictionary form when the label is a plural or a spelling the dictionaries file elsewhere (donut).
export interface PictureWord { word: string; img: string; look?: string }
export interface PicturePage { id: string; title: string; cover: string; color: string; words: PictureWord[]; actions: string[] }

const T = (file: string) => `/world/thumbnails/${file}.png`;
const R = (file: string) => `/games/restaurant/icons/${file}.png`;
const w = (word: string, img: string, look?: string): PictureWord => ({ word, img, look });

export const PICTURE_PAGES: PicturePage[] = [
  {
    id: 'kitchen', title: 'The Kitchen', cover: T('interior_kitchen-fridge'), color: '#f6c26b',
    words: [
      w('fridge', T('interior_kitchen-fridge')), w('oven', T('interior_kitchen-oven')), w('sink', T('interior_kitchen-sink')),
      w('cabinet', T('interior_kitchen-cabinet1')), w('drawers', T('interior_kitchen-3-drawers'), 'drawer'), w('pot', T('restaurant_Environment_Pot_1_Filled')),
      w('pan', T('restaurant_Environment_Pan')), w('bowl', T('restaurant_Environment_Bowl')), w('plate', T('interior_plate-1')),
      w('fork', T('interior_fork')), w('knife', T('interior_knife')), w('spoon', T('interior_spoon')),
      w('mug', T('restaurant_Coffee_Cup_A')), w('blender', T('restaurant_Blender')), w('bottle', T('restaurant_Environment_Bottle')),
      w('stool', T('interior_stool')), w('table', T('interior_table-round-small')), w('trash can', T('interior_trashcan-small1')),
    ],
    actions: ['cook', 'wash', 'stir', 'pour'],
  },
  {
    id: 'home', title: 'At Home', cover: T('interior_couch-medium1'), color: '#9fd8f2',
    words: [
      w('bed', T('interior_bed-single')), w('bunk bed', T('interior_bed-bunk')), w('couch', T('interior_couch-medium1')),
      w('lamp', T('interior_light-floor1')), w('bookshelf', T('interior_bookshelf')), w('rug', T('interior_carpet-round')),
      w('curtains', T('interior_curtains-double'), 'curtain'), w('door', T('interior_door-1')), w('window', T('interior_window-large1')),
      w('fireplace', T('interior_fireplace')), w('dresser', T('interior_drawer-4')), w('plant', T('interior_houseplant-1')),
      w('bathtub', T('interior_bathroom-bathtub')), w('toilet', T('interior_bathroom-toilet')), w('mirror', T('interior_bathroom-mirror1')),
      w('towel', T('interior_bathroom-towel')), w('armchair', T('interior_couch-small1')), w('washing machine', T('interior_bathroom-washing-machine')),
    ],
    actions: ['sleep', 'sit', 'read', 'brush'],
  },
  {
    id: 'classroom', title: 'The Classroom', cover: T('props_computer-screen'), color: '#c7b6e6',
    words: [
      w('desk', T('interior_desk-1')), w('chair', T('props_chair-desk')), w('computer', T('props_computer-screen')),
      w('keyboard', T('props_computer-keyboard')), w('pencil', T('toolsbits_pencil_A_long')), w('scissors', T('toolsbits_scissors')),
      w('notebook', T('toolsbits_journal_closed')), w('book', T('toolsbits_journal_open')), w('map', T('toolsbits_map')),
      w('magnifying glass', T('toolsbits_magnifying_glass')), w('backpack', T('camping_Backpack_A')), w('bookcase', T('fantasy_Bookcase_A')),
      w('lamp', T('interior_light-desk')), w('compass', T('toolsbits_drafting_compass')), w('trash can', T('interior_trashcan-green')),
      w('table', T('interior_table-round-large')),
    ],
    actions: ['write', 'listen', 'learn', 'draw'],
  },
  {
    id: 'food', title: 'Food', cover: R('burger'), color: '#f3a7a0',
    words: [
      w('burger', R('burger')), w('pizza', R('pz-pepperoni')), w('hot dog', R('my-hotdog')), w('taco', R('my-taco')),
      w('fries', R('my-fries')), w('noodles', R('my-ramen'), 'noodle'), w('eggs', R('eggs'), 'egg'), w('donut', R('my-donut'), 'doughnut'),
      w('cupcake', R('my-cupcake')), w('cookie', R('my-cookie')), w('soda', R('soda')), w('waffle', R('my-waffle')),
      w('muffin', R('my-muffin')), w('carrot', R('t-carrot')), w('tomato', R('t-tomato')), w('potato', R('t-potato')),
      w('lettuce', R('t-lettuce')), w('onion', R('t-onion')), w('cheese', R('t-cheese')), w('corn', T('japan_Corn')),
    ],
    actions: ['eat', 'drink', 'chew', 'taste'],
  },
  {
    id: 'farm', title: 'The Farm', cover: T('farm_barn'), color: '#a6d897',
    words: [
      w('barn', T('farm_barn')), w('silo', T('farm_silo')), w('windmill', T('farm_windmill')), w('cow', T('farm_cow-quaternius')),
      w('chicken', T('farm_hen')), w('rooster', T('farm_rooster')), w('chicken coop', T('farm_chicken-coop')),
      w('fence', T('farm_fence')), w('well', T('farm_well')), w('apple tree', T('farm_Apple_Tree_A')), w('basket', T('farm_Egg_Basket')),
      w('pumpkin', T('halloween_pumpkin_orange')), w('cabbage', T('farm_Cabbage_Patch_A')), w('bucket', T('toolsbits_bucket_metal')), w('shovel', T('toolsbits_shovel')),
      w('pitchfork', T('farm_Garden_Fork_A')), w('sack', T('farm_Feed_Sack_A')), w('crops', T('farm_Crops'), 'crop'),
    ],
    actions: ['plant', 'grow', 'feed', 'dig'],
  },
  {
    id: 'park', title: 'The Park', cover: T('props_park_park-slide'), color: '#ffd77a',
    words: [
      w('slide', T('props_park_park-slide')), w('swings', T('props_park_park-swings'), 'swing'), w('seesaw', T('props_park_park-seesaw')),
      w('carousel', T('props_park_park-carousel')), w('trampoline', T('props_park_park-trampoline')), w('bench', T('props_park_park-bench')),
      w('picnic table', T('props_park_park-picnic-table')), w('tree', T('nature-stylized_CommonTree_1')), w('flower', T('nature-stylized_Flower_3_Single')),
      w('bush', T('nature-stylized_Bush_Common_Flowers')), w('rock', T('pond_Rock_1a')), w('frog', T('pond_Frog_1')),
      w('duck', T('pets_animal-duck')), w('bird', T('pond_Bird_1')), w('dog', T('pets_animal-pug')),
      w('butterfly', T('pets-styloo_styloo-butterfly')), w('streetlight', T('city_streetLight')), w('trash can', T('city_garbageBin')),
    ],
    actions: ['run', 'jump', 'climb', 'swing'],
  },
];
