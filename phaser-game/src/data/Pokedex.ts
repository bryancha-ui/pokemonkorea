/**
 * Onnuri Pokédex — the full encyclopedia.
 * Custom Pokémon use local sprites in /assets or /assets/dex.
 * PokéAPI wild Pokémon use the official sprite URL and a key of "api-<id>".
 */

export type DexDist = 'Starter' | 'Wild' | 'Trainer' | 'Gym' | 'Legendary';

export interface DexEntry {
  num:        number;
  key:        string;      // canonical dex key (matches party spriteKey for customs, "api-<id>" for PokéAPI)
  name:       string;
  type1:      string;
  type2?:     string;
  ability?:   string;
  dexText:    string;
  spriteUrl:  string;
  evolvesTo?: string;      // key of next form
  evolvesAtLevel?: number;
  dist:       DexDist;
  where:      string;      // human-readable location
  legendary?: boolean;
}

const A = 'assets/';
const D = 'assets/dex/';
const R = 'assets/remaster/';

export const REMASTER_SPRITE_URLS: Readonly<Record<string, string>> = {
  thanatoat: R + 'thanatoat-hq.png',
  banderado: R + 'banderado-hq.png',
  pipetiger: R + 'pipetiger-hq.png',
};

export function remasteredSpriteUrl(key: string): string | undefined {
  return REMASTER_SPRITE_URLS[key.toLowerCase()];
}

// PokéAPI official front sprite by national id
const api = (id: number) =>
  `assets/pokemon-official/${id}.png`;

export const POKEDEX: DexEntry[] = [
  // ── Starters & their evolutions ──────────────────────────────────────────
  { num: 1, key: 'munkain', name: 'Munkain', type1: 'grass', ability: 'Overgrow',
    dexText: 'Its tail keeps food fresh. It carries fruit and seeds wherever it roams.',
    spriteUrl: A + 'munkain.png', evolvesTo: 'munklift', evolvesAtLevel: 14, dist: 'Starter', where: "Prof. Song's Lab" },
  { num: 2, key: 'munklift', name: 'Munklift', type1: 'grass', type2: 'dark', ability: 'Overgrow',
    dexText: 'Its tail has grown into a small tree. It strikes from shadow with leaf-bladed claws.',
    spriteUrl: A + 'munklift.png', evolvesTo: 'banderado', evolvesAtLevel: 36, dist: 'Starter', where: 'Evolve Munkain' },
  { num: 3, key: 'banderado', name: 'Banderado', type1: 'grass', type2: 'dark', ability: 'Overgrow',
    dexText: 'A masked forest bandit. Its acorn helm and leaf-blade tail are feared across the highlands.',
    spriteUrl: REMASTER_SPRITE_URLS.banderado, dist: 'Starter', where: 'Evolve Munklift' },

  { num: 4, key: 'vipour', name: 'Vipour', type1: 'fire', type2: 'poison', ability: 'Blaze',
    dexText: 'Smoke from burning food drifts from its neck. The scent puts prey strangely at ease.',
    spriteUrl: A + 'vipour.png', evolvesTo: 'scorpent', evolvesAtLevel: 14, dist: 'Starter', where: "Prof. Song's Lab" },
  { num: 5, key: 'scorpent', name: 'Scorpent', type1: 'fire', type2: 'poison', ability: 'Blaze',
    dexText: 'When it dances, heat pours from flower-shaped scales, spreading a fascinating toxic smoke.',
    spriteUrl: A + 'scorpent.png', dist: 'Starter', where: 'Evolve Vipour' },

  { num: 6, key: 'onnurian', name: 'Onnurian', type1: 'water', type2: 'ghost', ability: 'Torrent',
    dexText: 'Based on the crane and the Grim Reaper. It silently guides lost souls across still water.',
    spriteUrl: A + 'onnurian.png', evolvesTo: 'onnujang', evolvesAtLevel: 14, dist: 'Starter', where: "Prof. Song's Lab" },
  { num: 7, key: 'onnujang', name: 'Onnujang', type1: 'water', type2: 'ghost', ability: 'Torrent',
    dexText: 'A crane magistrate of the spirit world. Under the gat hat its eyes see beyond the veil.',
    spriteUrl: A + 'onnujang.png', dist: 'Starter', where: 'Evolve Onnurian' },

  // ── Earlier custom Pokémon ───────────────────────────────────────────────
  { num: 8, key: 'disguijar', name: 'Disguijar', type1: 'rock', type2: 'flying', ability: 'Sturdy',
    dexText: 'A stone swift with golden eye-spots. It nests on the cliffs of the mountain route.',
    spriteUrl: A + 'disguijar.png', evolvesTo: 'prowlrock', evolvesAtLevel: 37, dist: 'Wild', where: 'Route 1 — Mountain Pass' },
  { num: 9, key: 'corrpanda', name: 'Corrpanda', type1: 'dark', ability: 'Pressure',
    dexText: 'A sleek dark cat-fox. Gym Leader Jin\'s cunning ace, fast and merciless.',
    spriteUrl: A + 'corrpanda.png', evolvesTo: 'tokkigongju', evolvesAtLevel: 36, dist: 'Gym', where: 'Capitol Gym (Leader Jin)' },

  // ── Gawlhawk line (Rock/Flying) ──────────────────────────────────────────
  { num: 10, key: 'gawlhawk', name: 'Gawlhawk', type1: 'rock', type2: 'flying', ability: 'Sturdy',
    dexText: 'A young raptor with stony plumage. It rides updrafts over the highland cliffs.',
    spriteUrl: D + 'gawlhawk.png', evolvesTo: 'prowlrock', evolvesAtLevel: 14, dist: 'Wild', where: 'Seolbong Highland Pass' },
  { num: 11, key: 'prowlrock', name: 'Prowlrock', type1: 'rock', type2: 'flying', ability: 'Sand Force',
    dexText: 'It dives from the peaks in a cloud of grit, talons hard as granite.',
    spriteUrl: D + 'prowlrock.png', evolvesTo: 'prowlnox', evolvesAtLevel: 38, dist: 'Wild', where: 'Seolbong Highland Pass' },
  { num: 170, key: 'prowlnox', name: 'Prowlnox', type1: 'rock', type2: 'flying', ability: 'Stonegaze',
    dexText: 'The silent apex of the highland skies. Its granite-feathered wings blot out the moon, and a single glare from its burning eyes roots quarry to the spot.',
    spriteUrl: D + 'prowlnox.png', dist: 'Wild', where: 'Evolve Prowlrock' },

  // ── Nosepass line (Rock/Psychic) ─────────────────────────────────────────
  { num: 12, key: 'nosepassx', name: 'Nosepass', type1: 'rock', type2: 'psychic', ability: 'Nosemic Power',
    dexText: 'Its magnetic nose always points to a far-off truth only it can sense.',
    spriteUrl: D + 'nosepassx.png', evolvesTo: 'oribioass', evolvesAtLevel: 14, dist: 'Wild', where: 'Caves' },
  { num: 13, key: 'oribioass', name: 'Oribioass', type1: 'rock', type2: 'psychic', ability: 'Nosemic Power',
    dexText: 'Its great nose channels psychic force into a focused, mind-bending beam.',
    spriteUrl: D + 'oribioass.png', dist: 'Wild', where: 'Caves' },

  // ── Sandygast line (Ground/Fairy) ────────────────────────────────────────
  { num: 14, key: 'sandygastx', name: 'Sandygast', type1: 'ground', type2: 'fairy', ability: 'Water Compaction',
    dexText: 'A haunted sand mound. Children who build it unknowingly give it a spirit.',
    spriteUrl: D + 'sandygastx.png', evolvesTo: 'palossandx', evolvesAtLevel: 14, dist: 'Wild', where: 'Coast / Beaches' },
  { num: 15, key: 'palossandx', name: 'Palossand', type1: 'ground', type2: 'fairy', ability: 'Friend Guard',
    dexText: 'A castle of cursed sand. It lures prey with a gentle, protective aura.',
    spriteUrl: D + 'palossandx.png', dist: 'Wild', where: 'Coast / Beaches' },

  // ── Bosongnun line (Ice/Fairy, 3-stage) ──────────────────────────────────
  { num: 16, key: 'bosongnun', name: 'Bosongnun', type1: 'ice', type2: 'fairy', ability: 'Snow Cloak',
    dexText: 'A fluffy snow sprite. It hums softly as it drifts over frozen fields.',
    spriteUrl: D + 'bosongnun.png', evolvesTo: 'luninari', evolvesAtLevel: 14, dist: 'Wild', where: 'Baekdu Snowfields' },
  { num: 17, key: 'luninari', name: 'Luninari', type1: 'ice', type2: 'fairy', ability: 'Snow Cloak',
    dexText: 'Moonlight glints on its crystalline coat. It dances on the longest winter nights.',
    spriteUrl: D + 'luninari.png', evolvesTo: 'snoqueen', evolvesAtLevel: 30, dist: 'Wild', where: 'Baekdu Snowfields' },
  { num: 18, key: 'snoqueen', name: 'Snoqueen', type1: 'ice', type2: 'fairy', ability: 'Snow Warning',
    dexText: 'The sovereign of the snowfields. Where she treads, a gentle blizzard follows.',
    spriteUrl: D + 'snoqueen.png', dist: 'Wild', where: 'Baekdu Snowfields (rare)' },

  // ── Kidstrel line (Flying/Fighting) ──────────────────────────────────────
  { num: 19, key: 'kidstrel', name: 'Kidstrel', type1: 'flying', type2: 'fighting', ability: 'Sheer Force',
    dexText: 'A scrappy young kestrel. It practices dive-kicks on anything that moves.',
    spriteUrl: D + 'kidstrel.png', evolvesTo: 'falcrush', evolvesAtLevel: 14, dist: 'Trainer', where: 'Bird Keepers / Eastern cliffs' },
  { num: 20, key: 'falcrush', name: 'Falcrush', type1: 'flying', type2: 'fighting', ability: 'Sheer Force',
    dexText: 'Its stoop ends in a crushing kick that can shatter stone.',
    spriteUrl: D + 'falcrush.png', dist: 'Trainer', where: 'Bird Keepers / Eastern cliffs' },

  // ── Ureunggul line (Electric) ────────────────────────────────────────────
  { num: 21, key: 'ureunggul', name: 'Ureunggul', type1: 'electric', ability: 'Static',
    dexText: 'A buzzing ball of honey and sparks. Its hum warns of coming storms.',
    spriteUrl: D + 'ureunggul.png', evolvesTo: 'metdoyaroe', evolvesAtLevel: 14, dist: 'Wild', where: 'Eastern Shore' },
  { num: 22, key: 'metdoyaroe', name: 'Metdoyaroe', type1: 'electric', ability: 'Static',
    dexText: 'It stores thunder in its swollen hive-body and unleashes it in a roaring discharge.',
    spriteUrl: D + 'metdoyaroe.png', dist: 'Wild', where: 'Eastern Shore' },

  // ── Agama line (Fire/Dragon) ─────────────────────────────────────────────
  { num: 23, key: 'redheadagama', name: 'Redhead Agama', type1: 'fire', type2: 'dragon', ability: 'Flash Fire',
    dexText: 'A red-crowned lizard whose throat glows like an ember when it threatens rivals.',
    spriteUrl: D + 'redheadagama.png', evolvesTo: 'beardiedragon', evolvesAtLevel: 14, dist: 'Wild', where: 'Volcanic crags' },
  { num: 24, key: 'beardiedragon', name: 'Beardie Dragon', type1: 'fire', type2: 'dragon', ability: 'Flash Fire',
    dexText: 'Its flaring beard of flame can scorch an entire hillside in a single roar.',
    spriteUrl: D + 'beardiedragon.png', dist: 'Wild', where: 'Volcanic crags' },

  // ── Aroryong line (Water/Dragon) ─────────────────────────────────────────
  { num: 25, key: 'aroryong', name: 'Aroryong', type1: 'water', type2: 'dragon', ability: 'Swift Swim',
    dexText: 'A river-serpent hatchling. It is said to be a dragon that has not yet learned to fly.',
    spriteUrl: D + 'aroryong.png', evolvesTo: 'dracopaia', evolvesAtLevel: 14, dist: 'Wild', where: 'Eastern Shore (rare)' },
  { num: 26, key: 'dracopaia', name: 'Dracopaia', type1: 'water', type2: 'dragon', ability: 'Swift Swim',
    dexText: 'A full-grown water dragon. Sailors bow when its coils break the surface.',
    spriteUrl: D + 'dracopaia.png', dist: 'Wild', where: 'Eastern Shore (rare)' },

  // ── Maewoyong line (Grass/Dragon) — northern reaches ─────────────────────
  { num: 142, key: 'maewoyong', name: 'Maewoyong', type1: 'grass', type2: 'dragon', ability: 'Overgrow',
    dexText: 'A humid-jungle drakeling that breathes warm mist. Villagers of the northern reaches say a monsoon follows wherever it roams.',
    spriteUrl: D + 'maewoyong.png', evolvesTo: 'seuphaisin', evolvesAtLevel: 40, dist: 'Wild', where: 'Northern Reaches (rare)' },
  { num: 143, key: 'seuphaisin', name: 'Seuphaisin', type1: 'grass', type2: 'dragon', ability: 'Overgrow',
    dexText: 'The monsoon dragon. It gathers the damp of the high peaks into a living storm and unleashes it as a verdant deluge.',
    spriteUrl: D + 'seuphaisin.png', dist: 'Wild', where: 'Evolve Maewoyong (Lv.40)' },

  // ── Honupup line (Ghost → Grass/Ghost) — the grief-candle that overgrows ──
  { num: 144, key: 'honupup', name: 'Honupup', type1: 'ghost', type2: 'fire', ability: 'Flash Fire',
    dexText: 'A mournful pup with a grave-candle grown from its crown. It pads through cemeteries at dusk, keeping the lonely departed company.',
    spriteUrl: D + 'honupup.png', evolvesTo: 'honutomb', evolvesAtLevel: 36, dist: 'Wild', where: 'Old graveyards & shrines' },
  { num: 145, key: 'honutomb', name: 'Honutomb', type1: 'grass', type2: 'ghost', ability: 'Overgrow',
    dexText: 'When a Honupup finally rests, moss and sprouts overtake it and its candle greens. It becomes a living grave-mound that cradles wandering spirits.',
    spriteUrl: D + 'honutomb.png', dist: 'Wild', where: 'Evolve Honupup (Lv.36)' },

  // ── Arctorodon (Rock/Ice) ────────────────────────────────────────────────
  { num: 146, key: 'arctorodon', name: 'Arctorodon', type1: 'rock', type2: 'ice', ability: 'Sturdy',
    dexText: 'A glacier-backed leviathan that hauls itself across the snowfields. The ancient stone beneath its icy shell has never once thawed.',
    spriteUrl: D + 'arctorodon.png', dist: 'Wild', where: 'Seolbong Highland Pass (rare)' },

  // ── Onnuri-region additions ──────────────────────────────────────────────
  { num: 148, key: 'zoltile', name: 'Zoltile', type1: 'electric', type2: 'rock', ability: 'Volt Absorb',
    dexText: '파치랩터. Restored incorrectly by a scientist and only recently regained its true form — the old dex entry was a sham. Its lightning-shaped feathers split the wind with a thunderous roar.',
    spriteUrl: D + 'zoltile.png', dist: 'Wild', where: 'Ancient strata / Onnuri' },
  { num: 149, key: 'ssaktrin', name: 'Ssaktrin', type1: 'grass', ability: 'Overgrow',
    dexText: '싹트린. A leaf-sprouted fawn of the gigantree woods. It nibbles low shoots, its neck already reaching a little higher each day.',
    spriteUrl: D + 'ssaktrin.png', evolvesTo: 'longroffe', evolvesAtLevel: 30, dist: 'Wild', where: 'Gigantree forest' },
  { num: 151, key: 'longroffe', name: 'Longroffe', type1: 'grass', type2: 'rock', ability: 'Sturdy',
    dexText: '길어프. Its neck grew long enough to reach food high in the gigantree canopy — perhaps drawn out by a strange energy near the gigantree forest.',
    spriteUrl: D + 'longroffe.png', dist: 'Wild', where: 'Evolve Ssaktrin' },
  { num: 153, key: 'onnurigrowlithe', name: 'Growlithe', type1: 'ice', ability: 'Rivalry',
    dexText: 'An Onnuri regional form of Growlithe. It puts out fires with a gust of frigid air. A familiar, beloved companion across the Onnuri region.',
    spriteUrl: D + 'onnurigrowlithe.png', evolvesTo: 'onnuriarcanine', evolvesAtLevel: 35, dist: 'Wild', where: 'Onnuri snowfields' },
  { num: 150, key: 'onnuriarcanine', name: 'Onnurian Arcanine', type1: 'ice', type2: 'fairy', ability: 'Justified',
    dexText: 'An Onnuri regional form of Arcanine. With penetrating eyes it metes out justice to wrongdoers. In old Onnuri, only kings were permitted to raise one.',
    spriteUrl: D + 'onnuriarcanine.png', dist: 'Wild', where: 'Evolve Growlithe' },
  { num: 154, key: 'onnurismoochum', name: 'Smoochum', type1: 'fairy', ability: 'Cute Charm',
    dexText: 'An Onnuri regional form of Smoochum. Crowned with a veil of cherry-blossom light, it hums and sways as petals drift around it.',
    spriteUrl: D + 'onnurismoochum.png', evolvesTo: 'idolena', evolvesAtLevel: 30, dist: 'Wild', where: 'Onnuri festival grounds' },
  { num: 152, key: 'idolena', name: 'Idolena', type1: 'fire', type2: 'fairy', ability: 'Cute Charm',
    dexText: 'Famed for dancing amid fireworks, it serves as a beloved mascot across every kind of media. The evolved form of an Onnurian Smoochum.',
    spriteUrl: D + 'idolena.png', dist: 'Wild', where: 'Evolve Smoochum' },

  // ── More additions ───────────────────────────────────────────────────────
  { num: 155, key: 'groundzoome', name: 'Groundzoome', type1: 'ground', type2: 'ghost', ability: 'Cursed Body',
    dexText: 'A restless spirit bound to a mound of grave-soil. It drifts just beneath the ground, waiting for footsteps to pass overhead.',
    spriteUrl: D + 'groundzoome.png', evolvesTo: 'groundzomber', evolvesAtLevel: 34, dist: 'Wild', where: 'Old burial grounds' },
  { num: 156, key: 'groundzomber', name: 'Groundzomber', type1: 'ground', type2: 'ghost', ability: 'Cursed Body',
    dexText: 'Risen fully from the earth, it lumbers through the dark dragging chains of packed clay. Its hollow eyes never blink.',
    // Groundzomber intentionally shares this identical authored sprite file;
    // avoiding a byte-for-byte duplicate saves both download and texture cache.
    spriteUrl: D + 'groundzoome.png', dist: 'Wild', where: 'Evolve Groundzoome' },
  { num: 157, key: 'kelpoxin', name: 'Kelpoxin', type1: 'poison', type2: 'water', ability: 'Poison Point',
    dexText: 'A tangle of venom-slick kelp. It lurks in murky shallows and stings anything that brushes its fronds.',
    spriteUrl: D + 'kelpoxin.png', dist: 'Wild', where: 'Brackish shallows' },
  { num: 158, key: 'twinkluppy', name: 'Twinkluppy', type1: 'water', type2: 'fairy', ability: 'Water Absorb',
    dexText: 'A tiny tidepool pup that sparkles like sea-foam under moonlight. It yips in bright, bubbly notes.',
    spriteUrl: D + 'twinkluppy.png', evolvesTo: 'nootillunar', evolvesAtLevel: 32, dist: 'Wild', where: 'Moonlit tidepools' },
  { num: 159, key: 'nootillunar', name: 'Nootillunar', type1: 'water', type2: 'fairy', ability: 'Water Absorb',
    dexText: 'Grown into a graceful lunar guardian of the tides, its coat shimmers with the phases of the moon.',
    spriteUrl: D + 'nootillunar.png', dist: 'Wild', where: 'Evolve Twinkluppy' },
  { num: 160, key: 'babymammoth', name: 'Babymammoth', type1: 'ice', ability: 'Thick Fat',
    dexText: 'A woolly calf that huddles against the cold. Its little tusks are still soft, but its heart is warm even in the deepest freeze.',
    spriteUrl: D + 'babymammoth.png', dist: 'Wild', where: 'Snowfields' },

  // ── Bookbug's evolution ──────────────────────────────────────────────────
  { num: 161, key: 'bookmoth', name: 'Bookmoth', type1: 'bug', type2: 'psychic', ability: 'Shield Dust',
    dexText: 'Every page it has ever nested in is copied onto its wings. Scholars follow it to find lost knowledge.',
    spriteUrl: D + 'bookmoth.png', dist: 'Wild', where: 'Old libraries' },

  // ── New bug family (standalone wild) ─────────────────────────────────────
  { num: 162, key: 'venombee', name: 'Venombee', type1: 'poison', type2: 'bug', ability: 'Swarm',
    dexText: 'A tireless hive guardian. Its barbed stinger weeps a paralytic venom that numbs on contact.',
    spriteUrl: D + 'venombee.png', dist: 'Wild', where: 'Flower meadows' },
  { num: 163, key: 'glacewing', name: 'Glacewing', type1: 'ice', type2: 'bug', ability: 'Shield Dust',
    dexText: 'Its frozen wing-scales break off in a numbing flurry when it flutters through cold air.',
    spriteUrl: D + 'glacewing.png', dist: 'Wild', where: 'Snowfields' },
  { num: 164, key: 'volthopper', name: 'Volthopper', type1: 'electric', type2: 'bug', ability: 'Static',
    dexText: 'It stores a charge in its powerful hind legs and springs away like a bolt of lightning.',
    spriteUrl: D + 'volthopper.png', dist: 'Wild', where: 'Grasslands' },
  { num: 165, key: 'dynabeetle', name: 'Dynabeetle', type1: 'bug', type2: 'fire', ability: 'Flame Body',
    dexText: 'Its horned shell superheats before it charges. Rivals scatter from the shimmering heat haze.',
    spriteUrl: D + 'dynabeetle.png', dist: 'Wild', where: 'Volcanic fields' },

  // ── 새콤 line (Grass → Grass/Electric) ────────────────────────────────────
  { num: 166, key: 'saekomaga', name: 'Saekomaga', type1: 'grass', ability: 'Overgrow',
    dexText: 'A sprout-sprite that tastes tart as an unripe berry. It crackles faintly when startled.',
    spriteUrl: D + 'saekomaga.png', evolvesTo: 'saekomassi', evolvesAtLevel: 16, dist: 'Wild', where: 'Orchards' },
  { num: 167, key: 'saekomassi', name: 'Saekomassi', type1: 'grass', type2: 'electric', ability: 'Overgrow',
    dexText: 'As it ripens, static gathers in its leaves. A pinch of its zest can jolt the tongue awake.',
    spriteUrl: D + 'saekomassi.png', evolvesTo: 'secommamma', evolvesAtLevel: 34, dist: 'Wild', where: 'Orchards' },
  { num: 168, key: 'secommamma', name: 'Secommamma', type1: 'grass', type2: 'electric', ability: 'Overgrow',
    dexText: 'The matron of the grove. Her sweet-and-sour aura ripens every fruit for miles and stings any thief.',
    spriteUrl: D + 'secommamma.png', dist: 'Wild', where: 'Orchards' },

  // ── Forest Shrine event boss (the possessed 목탁) ─────────────────────────
  { num: 169, key: 'moktakgwi', name: 'Moktakgwi', type1: 'ghost', type2: 'grass', ability: 'Cursed Body',
    dexText: 'The grief-spirit of a temple 목탁. For a century a monk drummed the forest to sleep with it; when he passed, it kept his rhythm alone so the woods would not wake in sorrow.',
    spriteUrl: D + 'moktakgwi.png', dist: 'Legendary', where: 'Forest Shrine' },

  // ── Moran line (Grass/Flying) ────────────────────────────────────────────
  { num: 27, key: 'moranlovebird', name: 'Moran Lovebird', type1: 'grass', type2: 'flying', ability: 'Friend Guard',
    dexText: 'A peony-feathered lovebird. Pairs are inseparable and sing in perfect harmony.',
    spriteUrl: D + 'moranlovebird.png', evolvesTo: 'moransae', evolvesAtLevel: 14, dist: 'Wild', where: 'Route 2 / Forests' },
  { num: 28, key: 'moransae', name: 'Moransae', type1: 'grass', type2: 'flying', ability: 'Friend Guard',
    dexText: 'A graceful plumed runner. Its trailing feathers bloom like a moving garden.',
    spriteUrl: D + 'moransae.png', dist: 'Wild', where: 'Route 2 / Forests' },

  // ── Squirrel line (Normal → Normal/Flying) ───────────────────────────────
  { num: 29, key: 'squirrel1', name: 'Acornip', type1: 'normal', ability: 'Cheek Pouch',
    dexText: 'A bright-eyed squirrel that hoards acorns in every hollow it can find.',
    spriteUrl: D + 'squirrel1.png', evolvesTo: 'squirrel2', evolvesAtLevel: 14, dist: 'Wild', where: 'Route 2 / Forests' },
  { num: 30, key: 'squirrel2', name: 'Soarrel', type1: 'normal', type2: 'flying', ability: 'Gluttony',
    dexText: 'It glides between pines on furred membranes, snatching seeds in mid-air.',
    spriteUrl: D + 'squirrel2.png', dist: 'Wild', where: 'Route 2 / Forests' },

  // ── Legendary cocoon line (Steel/Fairy) ──────────────────────────────────
  { num: 31, key: 'nabicocoon', name: 'Nabihalmang (Cocoon)', type1: 'steel', type2: 'fairy', ability: 'Shed Skin',
    dexText: 'An ancient iron cocoon. It has slept, dreaming, for a thousand winters.',
    spriteUrl: D + 'nabicocoon.png', evolvesTo: 'nabihalmang', evolvesAtLevel: 30, dist: 'Legendary', where: 'Highland Shrine', legendary: true },
  { num: 32, key: 'nabihalmang', name: 'Nabihalmang', type1: 'steel', type2: 'fairy', ability: 'Shed Skin',
    dexText: 'The Legendary Iron Butterfly. It molts from its cocoon to bless the mountain in spring.',
    spriteUrl: D + 'nabihalmang.png', dist: 'Legendary', where: 'Highland Shrine', legendary: true },

  // ── Single-stage customs ─────────────────────────────────────────────────
  { num: 33, key: 'hambillet', name: 'Hambillet', type1: 'steel', type2: 'flying', ability: 'Keen Eye',
    dexText: 'A steel-feathered duck. Its bill is hard enough to dent armour.',
    spriteUrl: D + 'hambillet.png', dist: 'Trainer', where: 'Highland Trainers' },
  { num: 34, key: 'ivelon', name: 'Ivelon', type1: 'grass', type2: 'normal', ability: 'Color Change',
    dexText: 'A leafy chameleon-beast. Its hide shifts hue to match the forest around it.',
    spriteUrl: D + 'ivelon.png', dist: 'Wild', where: 'Route 2 / Forests' },
  { num: 35, key: 'palmcockatoo', name: 'Palm Cockatoo', type1: 'dark', type2: 'flying', ability: 'Intimidate',
    dexText: 'A black cockatoo that drums hollow logs to mark its territory.',
    spriteUrl: D + 'palmcockatoo.png', dist: 'Wild', where: 'Ancient Forest' },
  { num: 36, key: 'peacockrose', name: 'Peacockrose', type1: 'grass', type2: 'flying', ability: 'Flower Veil',
    dexText: 'When it fans its rose-laden tail, petals drift on a fragrant breeze.',
    spriteUrl: D + 'peacockrose.png', dist: 'Gym', where: 'Geumgang Fairy Gym' },
  { num: 37, key: 'bookbug', name: 'Bookbug', type1: 'bug', type2: 'normal', ability: 'Shield Dust',
    dexText: 'It wraps itself in pages of fallen leaves and hides in old libraries.',
    spriteUrl: D + 'bookbug.png', evolvesTo: 'bookmoth', evolvesAtLevel: 18, dist: 'Wild', where: 'Route 2 / Towns' },
  { num: 38, key: 'camerghoost', name: 'Camerghoost', type1: 'ghost', type2: 'steel', ability: 'Levitate',
    dexText: 'A spirit bound to an antique camera. It traps the faces it photographs.',
    spriteUrl: D + 'camerghoost.png', dist: 'Trainer', where: 'Capitol / Photographers' },
  { num: 39, key: 'burinao', name: 'Burinao', type1: 'ghost', ability: 'Resilience',
    dexText: 'No matter how many times it falls, it always rises once more — seven falls, eight rises.',
    spriteUrl: D + 'burinao.png', dist: 'Gym', where: 'Capitol Shadow Court' },
  { num: 40, key: 'chattyscream', name: 'Chatty Scream', type1: 'normal', type2: 'dark', ability: 'Ancient Activation',
    dexText: 'An ancient relic-beast. Its endless chatter carries fragments of forgotten tongues.',
    spriteUrl: D + 'chattyscream.png', dist: 'Wild', where: 'Ancient sites' },
  { num: 41, key: 'balchataek', name: 'Balchataek', type1: 'dark', type2: 'fighting', ability: 'Technician',
    dexText: 'A back-alley brawler. It chains rapid, precise strikes that overwhelm bigger foes.',
    spriteUrl: D + 'balchataek.png', dist: 'Gym', where: 'Capitol Shadow Court' },
  { num: 42, key: 'crystbeetle', name: 'Crystbeetle', type1: 'bug', type2: 'rock', ability: 'Battle Armor',
    dexText: 'Crystal spines erupt from its shell. They ring like chimes when it burrows.',
    spriteUrl: D + 'crystbeetle.png', dist: 'Wild', where: 'Caves' },

  // ── Newest custom Pokémon ────────────────────────────────────────────────
  { num: 43, key: 'unsilgami', name: 'Unsilgami', type1: 'psychic', type2: 'bug', ability: 'Fate Weaver',
    dexText: 'It weaves the threads upon its head to divine the fate and bonds of all things. From a silent space known to no one, its four eyes watch over the world.',
    spriteUrl: D + 'unsilgami.png', dist: 'Wild', where: 'Onnuri Region — deep wilds' },
  { num: 44, key: 'kkorisagwi', name: 'Kkorisagwi', type1: 'ghost', type2: 'psychic', ability: 'Adaptability / Mimicry',
    dexText: 'It lurks at the highest point of gloomy forests, waiting for prey. Vast ghostly power gathers in its tail, which sways like a living leaf to startle foes.',
    spriteUrl: D + 'kkorisagwi.png', evolvesTo: 'supiryeong', evolvesAtLevel: 30, dist: 'Wild', where: 'Pine forests' },
  { num: 45, key: 'supiryeong', name: 'Supiryeong', type1: 'ghost', type2: 'psychic', ability: 'Color Change / Protean',
    dexText: 'Damp, eerie air awakened the ghost power in its tail until it moved by its own will. The tail is its true body — in a crisis it abandons the rest before the end.',
    spriteUrl: D + 'supiryeong.png', dist: 'Wild', where: 'Evolve Kkorisagwi' },
  { num: 46, key: 'bonejoillion', name: 'Bonejoillion', type1: 'electric', type2: 'steel', ability: 'Early Bird / Insomnia',
    dexText: 'It pines for its home among the stars. With four brains it is brilliantly clever and often partners with researchers. It always looks drowsy, yet somehow can never sleep.',
    spriteUrl: D + 'bonejoillion.png', dist: 'Wild', where: 'Fallen-star site' },
  { num: 47, key: 'samdumae', name: 'Samdumae', type1: 'flying', type2: 'fairy', ability: 'Gale Wings / Shadow Tag',
    dexText: 'It glides the vast Onnuri skies. Spotting prey, it dives at the speed of sound to drop-kick and tear. It hunts Dark-types; the eye-patterns on its wings root them in place.',
    spriteUrl: D + 'samdumae.png', dist: 'Wild', where: 'Onnuri skies' },
  { num: 48, key: 'salmua', name: 'Salmua', type1: 'poison', ability: 'Threat Stance',
    dexText: "Never underestimate its mild venom — it bites again and again to pump in more. Each bite stirs its poison glands until it weeps toxic tears. The young feed on their mother's poison.",
    spriteUrl: D + 'salmua.png', evolvesTo: 'doksalsa', evolvesAtLevel: 30, dist: 'Wild', where: 'Grasslands' },
  { num: 49, key: 'doksalsa', name: 'Doksalsa', type1: 'poison', type2: 'ground', ability: 'Threat Stance',
    dexText: 'Its venom is so potent it seeps from all over its body; nothing survives where it has passed. It brandishes its dripping tail to threaten, then bites in a blink — the struck cannot walk seven steps before collapsing.',
    spriteUrl: D + 'doksalsa.png', dist: 'Wild', where: 'Evolve Salmua' },

  // ── Folk-hero, wildlife & legend custom Pokémon ──────────────────────────
  { num: 50, key: 'dundunguri', name: 'Dundunguri', type1: 'normal', ability: 'Firm Conviction',
    dexText: 'A sturdy raccoon dog famous from a viral photo of it raising one paw. Its calm patience hides a strong sense of right and wrong.',
    spriteUrl: D + 'dundunguri.png', evolvesTo: 'neogulgamyeon', evolvesAtLevel: 30, dist: 'Wild', where: 'Town outskirts' },
  { num: 51, key: 'neogulgamyeon', name: 'Neogulgamyeon', type1: 'normal', type2: 'fighting', ability: 'Heart of Justice',
    dexText: 'A masked vigilante hero of a hit comic and TV drama. Its will to punish evil made Dundunguri evolve; it forms energy into a staff to strike foes on the head.',
    spriteUrl: D + 'neogulgamyeon.png', dist: 'Wild', where: 'Evolve Dundunguri' },
  { num: 52, key: 'doribi', name: 'Doribi', type1: 'normal', ability: 'Klutz / Limber',
    dexText: 'Once so scarce it was hard to find in the Onnuri region, it has recently returned to its old haunts. Tiny but fierce, it squabbles with Burinao over street territory.',
    spriteUrl: D + 'doribi.png', evolvesTo: 'hwidoribi', evolvesAtLevel: 30, dist: 'Wild', where: 'City streets' },
  { num: 53, key: 'hwidoribi', name: 'Hwidoribi', type1: 'normal', type2: 'fighting', ability: 'Technician / Prankster',
    dexText: 'It drags foes in with a freely-moving muffler and locks on a choke hold, reveling in flashy, chaotic battles. Famous as the rival of Neogulgamyeon in the drama.',
    spriteUrl: D + 'hwidoribi.png', dist: 'Wild', where: 'Evolve Doribi' },
  { num: 54, key: 'paratoxin', name: 'Paratoxin', type1: 'water', type2: 'poison', ability: 'Merciless',
    dexText: 'A parasitic horror of stagnant water. Toxins it secretes seep into anything that drinks downstream.',
    spriteUrl: D + 'paratoxin.png', dist: 'Wild', where: 'Stagnant marshes' },
  { num: 55, key: 'silicutis', name: 'Silicutis', type1: 'steel', type2: 'bug', ability: 'Battle Armor',
    dexText: 'Its body is sheathed in silica-hardened plating. It moults a glassy steel husk as it grows.',
    spriteUrl: D + 'silicutis.png', dist: 'Wild', where: 'Quarries' },
  { num: 56, key: 'plumpypu', name: 'Plumpypu', type1: 'ground', ability: 'Sand Veil',
    dexText: 'A plump, soft-bodied burrower that packs loose earth into cozy dens. It hums when content.',
    spriteUrl: D + 'plumpypu.png', evolvesTo: 'capaludar', evolvesAtLevel: 30, dist: 'Wild', where: 'Meadows' },
  { num: 57, key: 'capaludar', name: 'Capaludar', type1: 'ground', type2: 'fairy', ability: 'Friend Guard',
    dexText: 'Mushroom-capped and gentle, it blesses the soil it sleeps in, making flowers bloom overnight.',
    spriteUrl: D + 'capaludar.png', dist: 'Wild', where: 'Evolve Plumpypu' },
  { num: 58, key: 'ottershaman', name: 'Ottershaman', type1: 'water', ability: 'Torrent',
    dexText: 'In the East, otters are said to perform ancestral rites. It lines up its catch in neat rows by the water, as if making an offering.',
    spriteUrl: D + 'ottershaman.png', evolvesTo: 'ottermudang', evolvesAtLevel: 30, dist: 'Wild', where: 'Riverbanks' },
  { num: 59, key: 'ottermudang', name: 'Ottermudang', type1: 'water', type2: 'ghost', ability: 'Torrent',
    dexText: 'Its riverside rites grew real. As a spirit-shaman it now guides the souls of drowned things back to still water.',
    spriteUrl: D + 'ottermudang.png', dist: 'Wild', where: 'Evolve Ottershaman' },
  { num: 60, key: 'liondance', name: 'Liondance', type1: 'fire', type2: 'normal', ability: 'Dancer',
    dexText: 'Born of a festival lion-mask dance. It leaps and whirls to drive off misfortune, trailing sparks from its mane.',
    spriteUrl: D + 'liondance.png', dist: 'Wild', where: 'Festivals' },
  { num: 61, key: 'turtleship', name: 'Turtleship', type1: 'steel', type2: 'dragon', ability: 'Sturdy',
    dexText: 'A living warship modeled on the iron-clad turtle ship. Spikes line its shell and fire breathes from its dragon prow.',
    spriteUrl: D + 'turtleship.png', dist: 'Wild', where: 'Coastal waters' },
  { num: 62, key: 'kingfisher', name: 'Kingfisher', type1: 'flying', type2: 'electric', ability: 'Static',
    dexText: 'A migratory bird that summers in Korea. As winters warm, some no longer leave at all. It dives like a charged bolt.',
    spriteUrl: D + 'kingfisher.png', evolvesTo: 'thunderon', evolvesAtLevel: 30, dist: 'Wild', where: 'Rivers' },
  { num: 63, key: 'thunderon', name: 'Thunderon', type1: 'electric', type2: 'flying', ability: 'Volt Absorb',
    dexText: 'Based on the egret, a bird perfectly adapted to the city. It is found along any river, riding thermals laced with current.',
    spriteUrl: D + 'thunderon.png', dist: 'Wild', where: 'Evolve Kingfisher' },
  { num: 64, key: 'kudzu', name: 'Kudzu', type1: 'grass', type2: 'normal', ability: 'Chlorophyll',
    dexText: 'A wild vine whose sweet-bitter roots are eaten as food. Its tangling with wisteria gave Korean the word for "conflict."',
    spriteUrl: D + 'kudzu.png', dist: 'Wild', where: 'Hillsides' },
  { num: 65, key: 'wildcat', name: 'Wildcat', type1: 'grass', type2: 'electric', ability: 'Limber',
    dexText: 'Once endangered like the native fox, its numbers now climb as it hunts invasive nutria. People mix up its name with kudzu — a running joke.',
    spriteUrl: D + 'wildcat.png', dist: 'Wild', where: 'Riverside thickets' },
  { num: 66, key: 'foxgeist', name: 'Foxgeist', type1: 'poison', type2: 'ghost', ability: 'Cursed Body',
    dexText: 'The ghost of native foxes lost to poisoned-bait traps in the last century. Restoration projects struggle to bring its kind back to life.',
    spriteUrl: D + 'foxgeist.png', dist: 'Wild', where: 'Abandoned hills' },
  { num: 67, key: 'cerrapin', name: 'Cerrapin', type1: 'rock', type2: 'water', ability: 'Solid Rock',
    dexText: 'A pebble-shelled terrapin of mountain streams. It wedges under rocks and waits out any flood.',
    spriteUrl: D + 'cerrapin.png', evolvesTo: 'booktoise', evolvesAtLevel: 30, dist: 'Wild', where: 'Mountain streams' },
  { num: 68, key: 'booktoise', name: 'Booktoise', type1: 'water', type2: 'grass', ability: 'Shell Armor',
    dexText: 'Reeds and water-worn pages layer its shell like a living book. Elders say it remembers every stream it has crossed.',
    spriteUrl: D + 'booktoise.png', dist: 'Wild', where: 'Evolve Cerrapin' },
  { num: 69, key: 'strawtle', name: 'Strawtle', type1: 'grass', type2: 'water', ability: 'Overcoat',
    dexText: 'A marsh turtle cloaked in straw-like reeds. It drifts among paddies, all but invisible until it moves.',
    spriteUrl: D + 'strawtle.png', dist: 'Wild', where: 'Rice paddies & wetlands' },
  { num: 70, key: 'roundtailor', name: 'Roundtailor', type1: 'water', ability: 'Swift Swim',
    dexText: 'Modeled on the round-tailed paradise fish and the snakehead — a fierce native of Korean freshwater.',
    spriteUrl: D + 'roundtailor.png', dist: 'Wild', where: 'Freshwater' },
  { num: 71, key: 'sandfox', name: 'Sandfox', type1: 'ground', ability: 'Sand Rush',
    dexText: 'A dune-dwelling fox that reads the wind by the prickling of its huge ears. It vanishes into blowing sand.',
    spriteUrl: D + 'sandfox.png', dist: 'Wild', where: 'Dunes' },
  { num: 72, key: 'bookkuddoong', name: 'Bookkuddoong', type1: 'normal', type2: 'fairy', ability: 'Inner Focus',
    dexText: 'A bashful little sprite that hides its face the moment it is noticed. It warms only to the gentlest trainers.',
    spriteUrl: D + 'bookkuddoong.png', dist: 'Wild', where: 'Quiet groves' },
  { num: 73, key: 'odamryul', name: 'Odamryul', type1: 'water', ability: 'Hydration',
    dexText: "A goldfish that dreams of wider waters. Its drifting reverie shimmers like scales catching light.",
    spriteUrl: D + 'odamryul.png', dist: 'Wild', where: 'Ponds' },
  { num: 74, key: 'mushvenom', name: 'Mushvenom', type1: 'rock', type2: 'poison', ability: 'Effect Spore',
    dexText: 'Toxic caps sprout from its stony hide. The spores it scatters can fell a foe long after the battle ends.',
    spriteUrl: D + 'mushvenom.png', dist: 'Wild', where: 'Damp caves' },
  { num: 75, key: 'ghograss', name: 'Ghograss', type1: 'grass', type2: 'ghost', ability: 'Natural Cure',
    dexText: 'A wandering tuft of haunted grass. It roots wherever the lonely linger, swaying though there is no wind.',
    spriteUrl: D + 'ghograss.png', dist: 'Wild', where: 'Overgrown ruins' },
  { num: 76, key: 'trumpetcreeper', name: 'Trumpetcreeper', type1: 'grass', ability: 'Flower Veil',
    dexText: 'Based on the trumpet-creeper flower. Its blossoms ring a faint chime that soothes nearby Pokémon.',
    spriteUrl: D + 'trumpetcreeper.png', dist: 'Wild', where: 'Old garden walls' },
  { num: 77, key: 'tokkigongju', name: 'Tokkigongju', type1: 'dark', type2: 'fairy', ability: 'Pixilate',
    dexText: 'A rabbit-princess said to be Corrpanda crowned. Beneath a regal calm hides the same shadowed mischief.',
    spriteUrl: D + 'tokkigongju.png', dist: 'Wild', where: 'Evolve Corrpanda' },
  { num: 78, key: 'tigerbabe', name: 'Tigerbabe', type1: 'fire', type2: 'steel', ability: 'Flame Body',
    dexText: 'A tiger cub with embers in its stripes and iron-hard little claws. It pounces at everything, learning the hunt through play.',
    spriteUrl: D + 'tigerbabe.png', evolvesTo: 'yeomtaeja', evolvesAtLevel: 30, dist: 'Wild', where: 'Mountain forests' },
  { num: 147, key: 'yeomtaeja', name: 'Yeomtaeja', type1: 'fire', type2: 'steel', ability: 'Flame Body',
    dexText: '염태자 — the flame prince. A crown of living fire marks the young heir. Its molten stripes glow brighter as it grows into its birthright.',
    spriteUrl: D + 'yeomtaeja.png', evolvesTo: 'pipetiger', evolvesAtLevel: 44, dist: 'Wild', where: 'Mountain forests' },
  { num: 79, key: 'pipetiger', name: 'Pipetiger', type1: 'fire', type2: 'steel', ability: 'Flame Body',
    dexText: '염흥왕 — the flame king. Smokestack pipes rise from its back like a folk-tale tiger smoking a pipe; it roars jets of white-hot steam.',
    spriteUrl: REMASTER_SPRITE_URLS.pipetiger, dist: 'Wild', where: 'Evolve Yeomtaeja' },
  { num: 80, key: 'layone', name: 'Layone', type1: 'normal', ability: 'Run Away',
    dexText: 'A curious little companion that trails travelers along the road, content simply to keep pace.',
    spriteUrl: D + 'layone.png', dist: 'Wild', where: 'Roadsides' },
  { num: 81, key: 'hwanwoong', name: 'Hwanwoong', type1: 'flying', type2: 'psychic', ability: 'Heavenly Descent',
    dexText: 'Based on Hwanung, who descended from the heavens with three ministers and three thousand followers. Where it alights, the seasons themselves bend to order.',
    spriteUrl: D + 'hwanwoong.png', dist: 'Legendary', where: 'Sacred peak', legendary: true },
  { num: 82, key: 'sotori', name: 'Sotori', type1: 'ghost', type2: 'fighting', ability: 'Guardian Spirit',
    dexText: 'A guardian totem of Sotdae and Jangseung — the village sentinel poles. The duck atop its head watches the sky while it wards off every evil that nears the village.',
    spriteUrl: D + 'sotori.png', evolvesTo: 'daejangseung', evolvesAtLevel: 40, dist: 'Wild', where: 'Village shrines' },

  // ── Wildlife customs & the Hwanung legendary cycle ───────────────────────
  { num: 83, key: 'gorcobat', name: 'Gorcobat', type1: 'grass', type2: 'fighting', ability: 'Sure-Footed',
    dexText: 'Modeled on the long-tailed goral and a tumbling acrobat. It bounds between sheer cliffs, landing flips no foe can follow.',
    spriteUrl: D + 'gorcobat.png', dist: 'Wild', where: 'Cliff trails' },
  { num: 84, key: 'blazekunk', name: 'Blazekunk', type1: 'fire', type2: 'poison', ability: 'Stench',
    dexText: 'It sprays a smouldering, reeking musk that bursts into flame. Foes flee the stink long before the fire reaches them.',
    spriteUrl: D + 'blazekunk.png', dist: 'Wild', where: 'Scrubland' },
  { num: 85, key: 'frysm', name: 'Frysm', type1: 'water', type2: 'psychic', ability: 'Levitate',
    dexText: 'Based on the ocean sunfish (Mola mola). It drifts in sunlit shallows, broadcasting drowsy thoughts that lull onlookers.',
    spriteUrl: D + 'frysm.png', dist: 'Wild', where: 'Open sea' },
  { num: 86, key: 'martbadger', name: 'Martbadger', type1: 'dark', type2: 'steel', ability: 'Tough Claws',
    dexText: 'A fearless badger sheathed in scrap-metal armour. Nothing it decides to dig toward is ever safe.',
    spriteUrl: D + 'martbadger.png', dist: 'Wild', where: 'Junk hills' },
  { num: 87, key: 'poongbaek', name: 'Poongbaek', type1: 'normal', ability: 'Run Away',
    dexText: 'A water deer — 90% of the world\'s kind live in Korea. It screams like a person in the night, and its fanged cries unsettle all who hear them.',
    spriteUrl: D + 'poongbaek.png', evolvesTo: 'waterdeer', evolvesAtLevel: 40, dist: 'Legendary', where: 'Night fields', legendary: true },
  { num: 88, key: 'waterdeer', name: 'Waterdeer', type1: 'electric', type2: 'normal', ability: 'Lightning Rod',
    dexText: "Pungbaek, the Wind Lord and aide of Hwanung, reborn. Legend jokes its hidden current is why Korea's network runs so swift.",
    spriteUrl: D + 'waterdeer.png', dist: 'Legendary', where: 'Evolve Poongbaek', legendary: true },
  { num: 89, key: 'woosa', name: 'Woosa', type1: 'water', type2: 'flying', ability: 'Drizzle',
    dexText: 'Based on Usa, the Rain Lord. One of Hwanung\'s three aides, it wrings storms from a clear sky with a sweep of its sleeve.',
    spriteUrl: D + 'woosa.png', dist: 'Legendary', where: 'Sacred peak', legendary: true },
  { num: 90, key: 'woonsa', name: 'Woonsa', type1: 'flying', type2: 'electric', ability: 'Cloud Nine',
    dexText: 'Based on Unsa, the Cloud Lord. One of Hwanung\'s three aides, it rides the thunderheads, parting and gathering clouds at will.',
    spriteUrl: D + 'woonsa.png', dist: 'Legendary', where: 'Sacred peak', legendary: true },
  { num: 91, key: 'ssangdungori', name: 'Ssangdungori', type1: 'electric', type2: 'flying', ability: 'Static',
    dexText: 'Twin ducklings that never stray apart. A faint current arcs between the pair, and they paddle in perfect, crackling unison.',
    spriteUrl: D + 'ssangdungori.png', evolvesTo: 'ampere', evolvesAtLevel: 30, dist: 'Wild', where: 'Riversides & paddies' },
  { num: 92, key: 'ampere', name: 'Ampere', type1: 'electric', type2: 'flying', ability: 'Lightning Rod',
    dexText: 'The grown pair fused their charge into a single storm-rider. Its wingbeats hum like a live wire and draw lightning to its crest.',
    spriteUrl: D + 'ampere.png', dist: 'Wild', where: 'Evolve Ssangdungori' },
  { num: 93, key: 'rideer', name: 'Rideer', type1: 'normal', type2: 'electric', ability: 'Quick Feet',
    dexText: 'A delivery-courier deer that never misses a drop-off. Antlers like handlebars and hooves charged for speed, it weaves through city traffic faster than any scooter.',
    spriteUrl: D + 'rideer.png', dist: 'Wild', where: 'City streets' },
  { num: 94, key: 'feldaconda', name: 'Feldaconda', type1: 'fire', type2: 'fairy', ability: 'Blaze',
    dexText: "Scorpent's final form. Its flower-scaled coils blaze with a charming, otherworldly heat — a serpent-spirit whose dance enthralls foes before it strikes.",
    spriteUrl: D + 'feldaconda.png', dist: 'Starter', where: 'Evolve Scorpent' },
  { num: 95, key: 'thanatoat', name: 'Thanatoat', type1: 'water', type2: 'ghost', ability: 'Torrent',
    dexText: "Onnujang's final form. A grim-reaper crane of the spirit world; it ferries drowned souls across still water and no tide it claims is ever given back.",
    spriteUrl: REMASTER_SPRITE_URLS.thanatoat, dist: 'Starter', where: 'Evolve Onnujang' },
  { num: 96, key: 'cheonjisin', name: 'Spirit of Cheonji', type1: 'dragon', type2: 'water', ability: 'Multiscale',
    dexText: 'The slumbering guardian of Cheonji, the crater lake atop Baekdu. When its rest is undisturbed its scales run the deep blue of still water; roused, its corona burns a furious red. The whole peninsula breathes by its breathing.',
    spriteUrl: D + 'cheonjisin.png', dist: 'Legendary', where: 'Cheonji Lake — Baekdu Peak', legendary: true },
  { num: 123, key: 'jakdangsae', name: 'Jakdangsae', type1: 'flying', type2: 'dark', ability: 'Prankster',
    dexText: '작당새. A fledgling magpie forever hatching little schemes. It chatters to rooftop flockmates, plotting which yard to raid next.',
    spriteUrl: D + 'jakdangsae.png', evolvesTo: 'jakdangchi', evolvesAtLevel: 16, dist: 'Wild', where: 'Town eaves & rooftops' },
  { num: 124, key: 'jakdangchi', name: 'Jakdangchi', type1: 'flying', type2: 'dark', ability: 'Prankster',
    dexText: '작당치. It runs with a noisy flock of troublemakers, snatching anything that shines and scattering before anyone can catch it.',
    spriteUrl: D + 'jakdangchi.png', evolvesTo: 'kkaakdang', evolvesAtLevel: 34, dist: 'Wild', where: 'Evolve Jakdangsae' },
  { num: 125, key: 'kkaakdang', name: 'Kkaakdang', type1: 'flying', type2: 'dark', ability: 'Intimidate',
    dexText: '까악당. A sharp-suited crow boss. A single caw musters its whole gang; even larger Pokémon clear the sky when it takes wing.',
    spriteUrl: D + 'kkaakdang.png', dist: 'Wild', where: 'Evolve Jakdangchi' },
  { num: 126, key: 'mugunga', name: 'Mugunga', type1: 'grass', type2: 'normal', ability: 'Overgrow',
    dexText: '무궁아. A sprout-child crowned with a Rose of Sharon bloom. It trails a petal skirt and dances on the first warm wind of summer.',
    spriteUrl: D + 'mugunga.png', evolvesTo: 'norigung', evolvesAtLevel: 16, dist: 'Wild', where: 'Flower fields' },
  { num: 127, key: 'norigung', name: 'Norigung', type1: 'grass', type2: 'normal', ability: 'Overgrow',
    dexText: '노리궁. Its blossoms open fuller and brighter. Where it rests, dormant seeds wake and the meadow bursts into color.',
    spriteUrl: D + 'norigung.png', evolvesTo: 'mugungmama', evolvesAtLevel: 34, dist: 'Wild', where: 'Evolve Mugunga' },
  { num: 128, key: 'mugungmama', name: 'Mugungmama', type1: 'grass', type2: 'normal', ability: 'Flower Veil',
    dexText: '무궁마마. A regal flower-queen robed in Rose of Sharon. Her presence is said to keep a whole valley blooming through the harshest winter.',
    spriteUrl: D + 'mugungmama.png', dist: 'Wild', where: 'Evolve Norigung' },
  { num: 129, key: 'gatnannu', name: 'Gatnannu', type1: 'bug', ability: 'Shield Dust',
    dexText: '갓난누. A newborn grub that has only just hatched. It inches along leaf undersides, nibbling quietly and hiding from every shadow.',
    spriteUrl: D + 'gatnannu.png', evolvesTo: 'danachungi', evolvesAtLevel: 16, dist: 'Wild', where: 'Gardens & hedgerows' },
  { num: 130, key: 'danachungi', name: 'Danachungi', type1: 'bug', type2: 'normal', ability: 'Shed Skin',
    dexText: '단아충이. A graceful grub that holds itself with unusual poise. It fasts and stills its body, gathering quiet strength for its final change.',
    spriteUrl: D + 'danachungi.png', evolvesTo: 'nabiguni', evolvesAtLevel: 34, dist: 'Wild', where: 'Evolve Gatnannu' },
  { num: 131, key: 'nabiguni', name: 'Nabiguni', type1: 'bug', type2: 'flying', ability: 'Inner Focus',
    dexText: '나비구니. A serene butterfly said to wield 명상의 힘 — the power of meditation. Its slow wingbeats scatter calming dust that steadies the minds of those nearby.',
    spriteUrl: D + 'nabiguni.png', dist: 'Wild', where: 'Evolve Danachungi' },
  { num: 132, key: 'komodread', name: 'Komodread', type1: 'poison', type2: 'dragon', ability: 'Corrosion',
    dexText: 'Part black-throat monitor lizard, part komodo dragon. Its slab-like hide flickers like a dead monitor and weeps corrosive violet sludge that rots metal and code alike.',
    spriteUrl: D + 'komodread.png', dist: 'Wild', where: 'Server ruins & sunbaked badlands' },
  { num: 133, key: 'noeryong', name: 'Noeryong', type1: 'electric', type2: 'dragon', ability: 'Lightning Rod',
    dexText: '내려치는 우뢰 — the Striking Thunder. A vast thunder-dragon ringed in storm-spines; the blazing star at its tail is a captured bolt it hurls down to split mountains.',
    spriteUrl: D + 'noeryong.png', dist: 'Legendary', where: '천지 (Cheonji Lake) — Onseong altar', legendary: true },
  { num: 134, key: 'merrloween', name: 'Merrloween', type1: 'ghost', type2: 'fairy', ability: 'Cursed Body',
    dexText: 'Based on a candy necklace. Its body is breathtakingly sweet — but bite in and your soul is slowly drawn out, sealed as a grudge inside one of its little wrapped candies. It curses its prey with the power of resentment.',
    spriteUrl: D + 'merrloween.png', dist: 'Wild', where: 'Haunted candy shops & autumn lanes' },
  { num: 135, key: 'hallowknight', name: 'Hallowknight', type1: 'bug', type2: 'steel', ability: 'Battle Armor',
    dexText: 'A solitary insect-knight whose chitin is forged hard as tempered steel. It duels by a silent code, lance raised; those it judges unworthy never land a single blow.',
    spriteUrl: D + 'hallowknight.png', dist: 'Gym', where: 'Pokémon League (Hwageum)' },
  { num: 136, key: 'halubang', name: 'Halubang', type1: 'rock', type2: 'dark', ability: 'Sturdy',
    dexText: 'Based on the dol hareubang, the stone grandfathers of Jeju. Carved from porous basalt, it guards village gates by day and stalks trespassers by night — a single glare turns courage to dread.',
    spriteUrl: D + 'halubang.png', dist: 'Wild', where: 'Jeju coast & old village gates' },
  { num: 137, key: 'ratouille', name: 'Ratouille', type1: 'electric', ability: 'Static',
    dexText: 'A long-snouted kitchen rat with a lightning-bolt tail. It sniffs out the finest ingredients and sears them with a crackle of static — chefs both curse and bless its midnight raids.',
    spriteUrl: D + 'ratouille.png', dist: 'Wild', where: 'City kitchens & alley markets' },
  { num: 138, key: 'mperodactyl', name: 'Mperodactyl', type1: 'rock', type2: 'dragon', ability: 'Rock Head',
    dexText: 'Based on Haenamichnus uhangriensis — the giant azhdarchid pterosaur whose footprints were found at Uhangri, Korea. Its wings span wider than a fishing boat as it stalks the tidal flats.',
    spriteUrl: D + 'mperodactyl.png', dist: 'Wild', where: 'Uhangri tidal flats & coastal cliffs' },
  { num: 139, key: 'dracoelido', name: 'Dracoelido', type1: 'rock', type2: 'dragon', ability: 'Rock Head',
    dexText: 'A heavy-plated dino-dragon whose horned frill and spined back turn aside all but the hardest blows. Its jaws crush boulders to powder to draw out the minerals within.',
    spriteUrl: D + 'dracoelido.png', dist: 'Wild', where: 'Ancient riverbeds & fossil beds' },
  { num: 140, key: 'daejangseung', name: 'Daejangseung', type1: 'ghost', type2: 'fighting', ability: 'Guardian Spirit',
    dexText: '천하대장승. Sotori risen into a towering totem-of-totems, crowned by a sotdae duck. Rooted at the heart of a village, it judges all who pass and strikes down any threat in a single, thunderous blow.',
    spriteUrl: D + 'daejangseung.png', dist: 'Wild', where: 'Evolve Sotori' },
  { num: 141, key: 'butlerawn', name: 'Butlerawn', type1: 'water', ability: 'Iron Fist',
    dexText: 'A mantis shrimp with the bearing of a fine butler, its mustachioed forelimbs folded with poise. Its raptorial claws snap faster than sound, cracking shells — and the odd aquarium pane — with a single courteous strike.',
    spriteUrl: D + 'butlerawn.png', dist: 'Wild', where: 'Tide pools & harbor stones' },

  // ── Notable PokéAPI wild Pokémon (existing encounters) ───────────────────
  { num: 101, key: 'api-10',  name: 'Caterpie',  type1: 'bug',                 dexText: 'A small larva that munches leaves all day.',           spriteUrl: api(10),  evolvesTo: 'api-11', evolvesAtLevel: 7,  dist: 'Wild', where: 'Route 2' },
  { num: 102, key: 'api-13',  name: 'Weedle',    type1: 'bug',  type2: 'poison', dexText: 'Beware the venomous barb on its head.',               spriteUrl: api(13),  evolvesTo: 'api-14', evolvesAtLevel: 7,  dist: 'Wild', where: 'Route 2' },
  { num: 103, key: 'api-16',  name: 'Pidgey',    type1: 'normal', type2: 'flying', dexText: 'A docile bird that avoids conflict.',                spriteUrl: api(16),  dist: 'Wild', where: 'Route 2' },
  { num: 104, key: 'api-19',  name: 'Rattata',   type1: 'normal',              dexText: 'It nibbles on anything it can find.',                 spriteUrl: api(19),  dist: 'Trainer', where: 'Youngsters' },
  { num: 105, key: 'api-21',  name: 'Spearow',   type1: 'normal', type2: 'flying', dexText: 'A short-tempered bird with a loud cry.',             spriteUrl: api(21),  dist: 'Wild', where: 'Route 1' },
  { num: 106, key: 'api-41',  name: 'Zubat',     type1: 'poison', type2: 'flying', dexText: 'It navigates dark caves with ultrasonic waves.',     spriteUrl: api(41),  dist: 'Wild', where: 'Caves' },
  { num: 107, key: 'api-66',  name: 'Machop',    type1: 'fighting',            dexText: 'A muscular Pokémon that trains constantly.',          spriteUrl: api(66),  dist: 'Wild', where: 'Route 1' },
  { num: 108, key: 'api-74',  name: 'Geodude',   type1: 'rock', type2: 'ground', dexText: 'Easily mistaken for a stone on the path.',           spriteUrl: api(74),  dist: 'Wild', where: 'Route 1 / Caves' },
  { num: 109, key: 'api-95',  name: 'Onix',      type1: 'rock', type2: 'ground', dexText: 'A giant rock serpent that tunnels underground.',     spriteUrl: api(95),  dist: 'Wild', where: 'Caves' },
  { num: 110, key: 'api-161', name: 'Sentret',   type1: 'normal',              dexText: 'It stands on its tail to watch for danger.',          spriteUrl: api(161), dist: 'Wild', where: 'Route 2' },
  { num: 111, key: 'api-163', name: 'Hoothoot',  type1: 'normal', type2: 'flying', dexText: 'It keeps perfect time, hooting on the hour.',        spriteUrl: api(163), dist: 'Wild', where: 'Route 2' },
  { num: 142, key: 'api-132', name: 'Ditto',     type1: 'normal', ability: 'Limber', dexText: 'It rearranges its cells to copy the form of another Pokémon.', spriteUrl: api(132), dist: 'Wild', where: 'Route 2 (rare)' },
  { num: 112, key: 'api-198', name: 'Murkrow',   type1: 'dark', type2: 'flying', dexText: 'A mischievous night bird drawn to shiny things.',     spriteUrl: api(198), dist: 'Gym', where: 'Capitol Gym' },
  { num: 113, key: 'api-197', name: 'Umbreon',   type1: 'dark',                dexText: 'Its rings glow in moonlight. A loyal night-walker.',  spriteUrl: api(197), dist: 'Gym', where: 'Capitol Gym' },
  { num: 114, key: 'api-246', name: 'Larvitar',  type1: 'rock', type2: 'ground', dexText: 'Born deep underground, it eats its way to the surface.', spriteUrl: api(246), dist: 'Wild', where: 'Route 1 / Caves' },
  { num: 115, key: 'api-261', name: 'Poochyena', type1: 'dark',                dexText: 'A bold pup that chases anything that flees.',          spriteUrl: api(261), dist: 'Gym', where: 'Capitol Gym' },
  { num: 116, key: 'api-228', name: 'Houndour',  type1: 'dark', type2: 'fire', dexText: 'It hunts in packs, coordinating with eerie howls.',    spriteUrl: api(228), dist: 'Gym', where: 'Capitol Gym' },
  { num: 117, key: 'api-215', name: 'Sneasel',   type1: 'dark', type2: 'ice',  dexText: 'A cruel, quick climber with hooked claws.',           spriteUrl: api(215), dist: 'Gym', where: 'Capitol Gym' },
  { num: 118, key: 'api-315', name: 'Roselia',   type1: 'grass', type2: 'poison', dexText: 'Its bouquet of thorns wards off careless hands.',    spriteUrl: api(315), dist: 'Trainer', where: 'Route 2' },
  { num: 119, key: 'api-406', name: 'Budew',     type1: 'grass', type2: 'poison', dexText: 'A tiny bud that opens its petals in spring sun.',    spriteUrl: api(406), dist: 'Trainer', where: 'Route 2' },
  { num: 120, key: 'api-147', name: 'Dratini',   type1: 'dragon',                dexText: 'The rarely seen Mirage Pokémon. It sheds its skin as it grows, and lives in the deep waters off the eastern shore.',
    spriteUrl: api(147), evolvesTo: 'api-148', evolvesAtLevel: 30, dist: 'Wild', where: 'Route 6 (rare)' },
  { num: 121, key: 'api-148', name: 'Dragonair', type1: 'dragon',                dexText: 'A mystical Pokémon said to gather clouds and storms about its body. The crystal orbs on its neck shine when it stirs the weather.',
    spriteUrl: api(148), evolvesTo: 'api-149', evolvesAtLevel: 55, dist: 'Wild', where: 'Evolve Dratini' },
  { num: 122, key: 'api-149', name: 'Dragonite', type1: 'dragon', type2: 'flying', dexText: 'A kindhearted guardian of the seas. It can circle the globe in barely a day, guiding the lost back to shore.',
    spriteUrl: api(149), dist: 'Wild', where: 'Evolve Dragonair' },
];

// ── Lookups ────────────────────────────────────────────────────────────────
const BY_KEY = new Map(POKEDEX.map(e => [e.key, e]));
export function dexEntry(key: string): DexEntry | undefined { return BY_KEY.get(key); }
export const POKEDEX_COUNT = POKEDEX.length;

/** Map any in-game Pokémon identifier to its canonical dex key. */
export function dexKeyFor(idOrSpriteKey: string | number): string {
  if (typeof idOrSpriteKey === 'number') return `api-${idOrSpriteKey}`;
  const s = idOrSpriteKey;
  if (s.startsWith('wild-')) return `api-${s.slice(5)}`;
  if (s.startsWith('te-'))   return `api-${s.slice(3)}`;
  if (s.startsWith('gym-'))  return `api-${s.slice(4)}`;
  return s; // custom key already
}

/** Resolve the habitat/original acquisition location for a caught Pokémon.
 * Evolved Pokédex entries store instructions such as "Evolve Ssangdungori" in
 * `where`; that is useful as an evolution hint but must never be presented as
 * the place where the individual Pokémon was caught. */
export function caughtOriginForDexKey(idOrSpriteKey: string | number): string | undefined {
  const first = dexEntry(dexKeyFor(idOrSpriteKey));
  if (!first) return undefined;
  let current: DexEntry = first;
  const visited = new Set<string>();

  while (!visited.has(current.key)) {
    visited.add(current.key);
    const currentKey = current.key;
    const parentByLink: DexEntry | undefined = POKEDEX.find(entry => entry.evolvesTo === currentKey);
    const hintedName: string | undefined = current.where.match(/^Evolve\s+(.+?)(?:\s*\(.*\))?$/i)?.[1]?.trim().toLowerCase();
    const parentByHint: DexEntry | undefined = hintedName
      ? POKEDEX.find(entry => entry.name.toLowerCase() === hintedName)
      : undefined;
    const parent: DexEntry | undefined = parentByLink ?? parentByHint;
    if (!parent) break;
    current = parent;
  }

  return /^Evolve\b/i.test(current.where) ? undefined : current.where;
}
