// Alchemy (teacher 2026-10-08: "lets get the alchemy game going. make an app in the computer").
// Elements and recipes from her prototype, docs/games/alchemy-prototype.html: [id, emoji, name]
// and [a, b, result]. Start with fire, water, earth and air.
export const ELEMENTS: [string, string, string][] = [
  ["fire","🔥","Fire"],["water","💧","Water"],["earth","🌍","Earth"],["air","💨","Air"],
  ["steam","♨️","Steam"],["mud","🟫","Mud"],["lava","🌋","Lava"],["cloud","☁️","Cloud"],["smoke","🌫️","Smoke"],
  ["stone","🪨","Stone"],["sand","🏖️","Sand"],["glass","🪟","Glass"],["rain","🌧️","Rain"],["lightning","⚡","Lightning"],
  ["storm","⛈️","Storm"],["sky","🌤️","Sky"],["sun","☀️","Sun"],["moon","🌙","Moon"],["star","⭐","Star"],["rainbow","🌈","Rainbow"],
  ["plant","🌱","Plant"],["tree","🌳","Tree"],["flower","🌸","Flower"],["fruit","🍎","Apple"],["wood","🪵","Wood"],
  ["forest","🌲","Forest"],["wheat","🌾","Wheat"],["bread","🍞","Bread"],["campfire","🏕️","Campfire"],
  ["metal","🔩","Metal"],["hammer","🔨","Hammer"],["axe","🪓","Axe"],["sword","🗡️","Sword"],
  ["gold","🪙","Gold"],["diamond","💎","Diamond"],["ring","💍","Ring"],["crown","👑","Crown"],
  ["life","🧬","Life"],["animal","🐾","Animal"],["bug","🐛","Bug"],["fish","🐟","Fish"],["bird","🐦","Bird"],
  ["lizard","🦎","Lizard"],["frog","🐸","Frog"],["egg","🥚","Egg"],["chicken","🐔","Chicken"],
  ["cow","🐄","Cow"],["horse","🐎","Horse"],["wolf","🐺","Wolf"],["dragon","🐉","Dragon"],
  ["human","🧑","Human"],["love","❤️","Love"],["baby","👶","Baby"],["family","👪","Family"],
  ["house","🏠","House"],["castle","🏰","Castle"],["farmer","🧑‍🌾","Farmer"],["garden","🌷","Garden"],
  ["milk","🥛","Milk"],["cheese","🧀","Cheese"],["pizza","🍕","Pizza"],
  ["boat","⛵","Boat"],["ship","🚢","Ship"],["fishing","🎣","Fishing Rod"],["rocket","🚀","Rocket"],
  ["paper","📄","Paper"],["book","📚","Book"],["lightbulb","💡","Lightbulb"],["telescope","🔭","Telescope"],["potion","🧪","Potion"],
  ["mountain","⛰️","Mountain"],["river","🏞️","River"],["ocean","🌊","Ocean"],["island","🏝️","Island"],
  ["ice","🧊","Ice"],["snow","❄️","Snow"],["snowman","⛄","Snowman"],["desert","🏜️","Desert"],["cactus","🌵","Cactus"],
  ["magic","✨","Magic"],["wizard","🧙","Wizard"],["fairy","🧚","Fairy"],["unicorn","🦄","Unicorn"],["ghost","👻","Ghost"],["music","🎵","Music"]
  ,
  // Fantasy chain (teacher 2026-10-08: "make more combinations of things to get into fantasy elements. like somehow
  // after lots of combinations, thye should be ale to combine a dinosaur and fire to get a dragon").
  ["hourglass","⏳","Hourglass"],["time","🕰️","Time"],["dinosaur","🦖","Dinosaur"],["fossil","🦴","Fossil"],["night","🌌","Night"],
  ["mermaid","🧜","Mermaid"],["elf","🧝","Elf"],["lamp","🪔","Lamp"],["genie","🧞","Genie"],["vampire","🧛","Vampire"],["zombie","🧟","Zombie"],
  ["princess","👸","Princess"],["knight","🛡️","Knight"],["map","🗺️","Map"],["treasure","💰","Treasure"],["crystalball","🔮","Crystal Ball"],
  ["wand","🪄","Wand"],["broom","🧹","Broom"],["witch","🧙‍♀️","Witch"],["lovepotion","💘","Love Potion"],["monster","👹","Monster"],
  ["kraken","🦑","Kraken"],["yeti","🦍","Yeti"],["pirate","🏴‍☠️","Pirate"],["legend","📜","Legend"],["troll","🧌","Troll"]
  ,
  // Mythology and magic (teacher 2026-10-08: "fantas, magic and mythological alchemy stuff was recomned by the studnets").
  ["phoenix","🔥🐦","Phoenix"],["pegasus","🐎🪶","Pegasus"],["griffin","🦅🦁","Griffin"],["centaur","🧑🐎","Centaur"],["minotaur","🐂💪","Minotaur"],
  ["serpent","🐍🌊","Sea Serpent"],["medusa","🐍👩","Medusa"],["hydra","🐲","Hydra"],["cyclops","👁️","Cyclops"],["golem","🗿","Golem"],
  ["leprechaun","🍀","Leprechaun"],["gnome","🍄","Gnome"],["dwarf","⛏️","Dwarf"],["angel","😇","Angel"],["werewolf","🐺🌕","Werewolf"],
  ["nessie","🦕","Loch Ness Monster"],["dragonegg","🥚🔥","Dragon Egg"],["pyramid","🔺","Pyramid"],["sphinx","🦁🔺","Sphinx"],
  ["cauldron","🫕","Cauldron"],["spellbook","📖","Spellbook"],["thunderhammer","🔨⚡","Thunder Hammer"],["trident","🔱","Trident"],
  ["seaking","🔱👑","Sea King"],["atlantis","🏛️🌊","Atlantis"],["swordstone","🗡️🪨","Sword in the Stone"]
];
export const START = ["fire","water","earth","air"];
export const RECIPES: [string, string, string][] = [
  ["fire","water","steam"],["earth","water","mud"],["fire","earth","lava"],["air","water","cloud"],["air","fire","smoke"],
  ["lava","water","stone"],["stone","air","sand"],["sand","fire","glass"],
  ["cloud","water","rain"],["cloud","fire","lightning"],["rain","lightning","storm"],
  ["cloud","air","sky"],["fire","sky","sun"],["sky","stone","moon"],["sky","lightning","star"],["rain","sun","rainbow"],
  ["earth","rain","plant"],["plant","plant","tree"],["plant","sun","flower"],["tree","flower","fruit"],["tree","stone","wood"],
  ["tree","tree","forest"],["plant","mud","wheat"],["wheat","fire","bread"],["wood","fire","campfire"],
  ["lava","stone","metal"],["metal","wood","hammer"],["metal","tree","axe"],["metal","fire","sword"],
  ["metal","sun","gold"],["stone","star","diamond"],["gold","diamond","ring"],["gold","human","crown"],
  ["mud","lightning","life"],["life","earth","animal"],["life","plant","bug"],["life","water","fish"],["life","air","bird"],
  ["life","sand","lizard"],["fish","mud","frog"],["bird","bird","egg"],["egg","earth","chicken"],
  ["animal","plant","cow"],["animal","wheat","horse"],["animal","moon","wolf"],
  ["animal","fire","human"],["human","human","love"],["love","human","baby"],["baby","human","family"],
  ["human","wood","house"],["house","stone","castle"],["human","wheat","farmer"],["flower","human","garden"],
  ["cow","human","milk"],["milk","air","cheese"],["bread","cheese","pizza"],
  ["wood","water","boat"],["boat","metal","ship"],["wood","fish","fishing"],["ship","star","rocket"],
  ["wood","rain","paper"],["paper","paper","book"],["glass","lightning","lightbulb"],["glass","star","telescope"],["glass","water","potion"],
  ["earth","earth","mountain"],["water","mountain","river"],["water","water","ocean"],["sand","water","island"],
  ["water","moon","ice"],["ice","cloud","snow"],["snow","human","snowman"],["sand","sun","desert"],["desert","plant","cactus"],
  ["star","life","magic"],["human","magic","wizard"],["magic","flower","fairy"],["horse","magic","unicorn"],["human","smoke","ghost"],["human","bird","music"]
  ,
  // Fantasy chain: a dragon now takes a dinosaur, which takes time, which takes magic.
  ["sand","glass","hourglass"],["hourglass","magic","time"],["lizard","time","dinosaur"],["dinosaur","fire","dragon"],["dinosaur","stone","fossil"],
  ["moon","star","night"],["human","ocean","mermaid"],["human","forest","elf"],["glass","fire","lamp"],["lamp","magic","genie"],
  ["human","night","vampire"],["ghost","mud","zombie"],["crown","castle","princess"],["human","sword","knight"],["paper","earth","map"],
  ["gold","map","treasure"],["glass","magic","crystalball"],["wood","magic","wand"],["wood","wheat","broom"],["wizard","broom","witch"],
  ["potion","love","lovepotion"],["animal","ghost","monster"],["monster","ocean","kraken"],["monster","snow","yeti"],["ship","sword","pirate"],
  ["dragon","knight","legend"],["stone","human","troll"]
  ,
  // Mythology and magic.
  ["bird","fire","phoenix"],["horse","bird","pegasus"],["bird","monster","griffin"],["human","horse","centaur"],["monster","cow","minotaur"],
  ["lizard","ocean","serpent"],["human","serpent","medusa"],["dragon","dragon","hydra"],["monster","telescope","cyclops"],["stone","life","golem"],
  ["elf","rainbow","leprechaun"],["elf","garden","gnome"],["human","mountain","dwarf"],["human","sky","angel"],["wolf","night","werewolf"],
  ["dinosaur","river","nessie"],["dragon","egg","dragonegg"],["sand","stone","pyramid"],["pyramid","animal","sphinx"],
  ["potion","fire","cauldron"],["book","magic","spellbook"],["hammer","lightning","thunderhammer"],["metal","ocean","trident"],
  ["trident","crown","seaking"],["castle","ocean","atlantis"],["sword","stone","swordstone"]
];
