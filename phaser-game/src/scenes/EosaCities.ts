import { EosaCityScene, EosaCity } from './EosaCityScene';

// ── The six new 어사대 circuit cities (Songhyeon is its own bespoke scene) ──────────
// Circuit order:  Pyeongyang → Songhyeon → Parangpo → Haesol → Gangcheoldo → Muyeonhang →
//                 Binghagwan → Samho → Northern League.  Each Chief's exam awards a 마패.
// Entering a city from the SOUTH neighbour spawns you at the city's south road;
// returning from the NORTH spawns you at its north road.
const SOUTH = { x: 13.5 * 32, y: 17 * 32 + 16 };   // spawn when arriving from the south
const NORTH = { x: 13.5 * 32, y: 2 * 32 + 16 };    // spawn when arriving from the north

const NAMPO: EosaCity = {
  key: 'NampoCityScene', name: 'Parangpo (파랑포)', mapaeKey: 'nampo', bgm: 'nampo',
  chiefKey: 'eosa-nampo', chiefName: '어사대장 Haemin',
  ground: 0xcabfa2, accent: 0x2f78b4, hallRoof: 0x2a6a9a, robe: 0x2a6a8a,   // coastal sand/stone (was green 0x5a8a6a that read as grass/tree cover)
  team: [{ id: 130, level: 68 }, { id: 121, level: 68 }, { id: 272, level: 69 }, { id: 230, level: 69 }, { id: 350, level: 70 }],
  expPool: 4000,
  intro: ['Parangpo (파랑포) — the great West-Sea barrage holds back the tide beyond the quay, its sluice-gates gleaming with salt.',
          '어사대장 Haemin waits by the water, patient as the turning tide.'],
  examLead: '어사대장 Haemin: Power without patience drowns itself. Read the tide, and read me. Begin.',
  award: ['어사대장 Haemin: You waited for the right wave. Good.', '🐎 You received the Parangpo 마패!'],
  mission: {
    threatKey: 'eosa-nampo-threat', threatName: 'Rampaging Gyarados (난동 갸라도스)',
    threatMon: { id: 130, level: 71 }, col: 0, row: 0, remote: true,   // confronted on Parangpo Beach
    blurb: ['어사대장 Haemin: Before any exam — the province needs you.',
            'A great Gyarados has been battering the West-Sea barrage from out on the open water. One more night and the sluice-gates give way, and the tide takes the lower town.',
            'Take the shore path west out to Parangpo Beach, then Surf out to it. But mind the water — its 부하 (underlings) stir up whirlpools that wander the whole bay. Weave between them, or be dragged under.'],
    reminder: '어사대장 Haemin: The barrage still groans under that beast. Head to Parangpo Beach, surf out past the whirlpools and quell the Gyarados, then return.',
    approach: ['The Gyarados rears from the swell, sluice-water sheeting off its coils, and fixes its glare on you.', 'It lunges, jaws wide. No turning back now!'],
    cleared: ['어사대장 Haemin: The gates hold, and the town sleeps easy. Word travels fast on the water — they already speak your name.',
              'Now I will see it for myself.'],
  },
  // A wide West-Sea port, expanded east into a harbour quarter.
  size: { cols: 36, rows: 24 },
  landmarks: [
    { col: 31, row: 2,  w: 2, h: 5, color: 0xd63b3b, label: '🗼 Parangpo Lighthouse (등대)',   kind: 'lighthouse', solid: true },
    { col: 27, row: 4,  w: 4, h: 4, color: 0x3a6a9a, label: '⚓ Harbour Warehouse (부두)',    kind: 'building',   solid: true },
    { col: 28, row: 13, w: 5, h: 4, color: 0x2a7a6a, label: '🐟 Parangpo Fish Market (어시장)',  kind: 'building',   solid: true },
    { col: 30, row: 20, w: 2, h: 3, color: 0xb8a24a, label: '🏛 Barrage Monument (방조제비)', kind: 'monument' },
    { col: 8,  row: 20, w: 3, h: 3, color: 0x9a3a3a, label: '⛱ Seaside Pavilion (해안 정자)', kind: 'pavilion' },
    { col: 20, row: 21, w: 3, h: 2, color: 0x6a8ab0, label: '🧂 Salt Flats (염전)',           kind: 'pavilion' },
    { col: 26, row: 17, w: 4, h: 3, color: 0x5a3a2a, label: "🍺 뱃사람 주막 (Sailors' Tavern)", kind: 'building', solid: true, enter: 'NorthernBuildingScene', enterId: 'nampo-tavern' },
  ],
  npcs: [
    { col: 9,  row: 13, color: 0x2f6f9a, label: 'Fishmonger', lines: ['Fishmonger: Fresh off the West Sea this morning! ...You want the good stuff, come before the fog.'] },
    { col: 20, row: 14, color: 0x4a7a5a, label: 'Sluice Keeper', lines: ['Sluice Keeper: The great barrage holds the tide back, day and night.', 'Since you dealt with that Gyarados, the gates run smooth. The whole town owes you a bowl.'] },
    { col: 24, row: 20, color: 0x8a6a3a, label: 'Salt Farmer', lines: ['Salt Farmer: We rake the flats at low tide. Parangpo salt seasons half the northern coast!'] },
    { col: 11, row: 18, color: 0x6a5a7a, label: 'Dock Boy', lines: ['Dock Boy: Wanna know a secret? If you Surf out past the quay, there\'s all kinds of Pokémon on the water!'] },
    { col: 7,  row: 21, color: 0x3a6a8a, label: 'Old Diver', lines: ['Old Diver: These waters go deep and cold. I\'ve pulled up things down there I don\'t talk about.'] },
  ],
  // Seaside palms line the promenade and waterfront edges (avoiding landmark/NPC
  // footprints) so the port reads as a warm West-Sea town in 3D.
  trees: [
    { col: 2, row: 23, kind: 'palm' }, { col: 5, row: 23, kind: 'palm' },
    { col: 13, row: 23, kind: 'palm' }, { col: 16, row: 23, kind: 'palm' },
    { col: 24, row: 23, kind: 'palm' }, { col: 33, row: 23, kind: 'palm' },
    { col: 2, row: 10, kind: 'palm' }, { col: 2, row: 16, kind: 'palm' },
    { col: 34, row: 10, kind: 'palm' }, { col: 34, row: 18, kind: 'palm' },
  ],
  sideExit: { col: 4, scene: 'NampoBeachScene', label: 'Parangpo Beach', icon: '🏖' },
  prev: { scene: 'RyesongValleyScene', returnKey: 'ryesong', x: 12 * 32 + 16, y: 2 * 32 + 16 },
  next: { scene: 'AhobiryongPassScene', returnKey: 'ahobiryong', x: 11 * 32 + 16, y: 47 * 32 + 16 },
};

const WONSAN: EosaCity = {
  key: 'WonsanCityScene', name: 'Haesol (해솔)', mapaeKey: 'wonsan', bgm: 'wonsan',
  chiefKey: 'eosa-wonsan', chiefName: '어사대장 Haegang',
  // Haesol is a beach capital, so its open lots use pale sand-stone paving
  // instead of the former saturated green ground that became grass in 3D.
  ground: 0xcbbfa8, accent: 0xf0c040, hallRoof: 0xd8873a, robe: 0xaa5533,
  team: [{ id: 297, level: 69 }, { id: 237, level: 69 }, { id: 534, level: 70 }, { id: 475, level: 70 }, { id: 448, level: 71 }],
  expPool: 4100,
  intro: ['Haesol (해솔) — sunlight off Kalma Beach, the blue shoulder of Mt. Kumgang on the horizon, sand still warm from dawn training.',
          '어사대장 Haegang cracks his knuckles and grins.'],
  examLead: '어사대장 Haegang: No tricks on my sand — just conviction and clean technique. Show me. Begin!',
  award: ['어사대장 Haegang: HA! Now THAT was a bout. You\'ve got it.', '🐎 You received the Haesol 마패!'],
  // Haesol's challenge is a DOJO GAUNTLET — best Haegang's three beach disciples,
  // scattered across the town, before he'll grant you a bout. (Fitting for a Fighting Chief.)
  mission: {
    threatKey: 'eosa-wonsan-threat', threatName: 'Haegang\'s Disciples', threatMon: { id: 0, level: 0 },
    col: 0, row: 0, gauntlet: ['wonsan-disciple-1', 'wonsan-disciple-2', 'wonsan-disciple-3'],
    blurb: ['어사대장 Haegang: Hah — eager for a bout? Not yet. Anyone can win one fight. A fighter is forged by fighting through exhaustion.',
            'Baekho waits by the pier and Miru at the training ground, here in town. Cheon, the last, trains down at KALMA BEACH — take the shore road off the EAST edge of town (look for the 🏖 sign).',
            'Best all three, back to back, then come to me. Show me you can keep your feet when your legs are burning!'],
    reminder: '어사대장 Haegang: You haven\'t bested all three yet. Baekho\'s at the pier, Miru at the training ground — and Cheon is down at KALMA BEACH, along the shore road off the east edge of town. Beat all three, then return.',
    approach: [], color: 0xaa5533,
    cleared: ['어사대장 Haegang: HAH! Three of my best, one after another, and still standing! THAT is endurance.',
              'You didn\'t just win — you outlasted. Now let\'s see if you\'ve anything left for ME. Begin!'],
  },
  // A wide East-Sea resort town, with a paved route down to Kalma Beach.
  size: { cols: 40, rows: 28 },
  landmarks: [
    { col: 34, row: 2,  w: 2, h: 5, color: 0xd63b3b, label: '🗼 Kalma Lighthouse (등대)',       kind: 'lighthouse', solid: true },
    { col: 30, row: 4,  w: 3, h: 4, color: 0x2a7a6a, label: '🐟 Haesol Seafood Market (수산시장)', kind: 'building',   solid: true },
    { col: 36, row: 12, w: 3, h: 4, color: 0x3a6a9a, label: '🏨 Beach Resort (해수욕장 호텔)',      kind: 'building',   solid: true },
    { col: 37, row: 19, w: 2, h: 3, color: 0xb8a24a, label: '🏔 Mt. Kumgang Viewpoint (금강산 전망)', kind: 'monument' },
    { col: 6,  row: 20, w: 3, h: 3, color: 0x2f6a3a, label: '🌲 Songdowon Pine Grove (송도원)',    kind: 'pavilion' },
    { col: 20, row: 21, w: 3, h: 2, color: 0x6a8ab0, label: '⛱ Beach Promenade (해안 산책로)',     kind: 'pavilion' },
    { col: 30, row: 17, w: 4, h: 3, color: 0x3a6a8a, label: '☕ 갈마 해변 카페 (Beach Café)', kind: 'building', solid: true, enter: 'NorthernBuildingScene', enterId: 'wonsan-cafe' },
  ],
  // The road to Gwanmunseong is a walk-through gateway in the NORTH wall (opening
  // at cols 37–38): stroll north through it, off the top edge, to the capital
  // checkpoint — no solid gate building blocking the way.
  gateExit: { col: 37, scene: 'PyeongseongCheckpointScene', label: '🛡 관문성 관문 (Gwanmunseong)' },
  npcs: [
    { col: 9,  row: 13, color: 0xcc6a4a, label: 'Sunbather', lines: ['Sunbather: Kalma Beach in summer — nothing beats it! Well... maybe a cold drink at the café.'] },
    { col: 25, row: 14, color: 0xaa5533, label: 'Retired Boxer', lines: ['Retired Boxer: Chief Haegang trained me, back in the day.', 'Best his three disciples and he\'ll respect you. He respects nothing else.'] },
    { col: 28, row: 20, color: 0x3a8a6a, label: 'Hiker', lines: ['Hiker: On a clear day you can see the blue shoulder of Mt. Kumgang from the viewpoint. Breathtaking.'] },
    { col: 15, row: 18, color: 0xcc8aaa, label: 'Beach Vendor', lines: ['Beach Vendor: Ice cream! Cold drinks! Get \'em before the tide comes in!'] },
    { col: 7,  row: 21, color: 0x2f6a3a, label: 'Old Woodsman', lines: ['Old Woodsman: The Songdowon pines have shaded this shore for a thousand years. Sit awhile.'] },
    { col: 35, row: 8, color: 0x5a4a3a, label: 'Gate Guard', lines: ['Gate Guard: The Gwanmunseong checkpoint is just ahead. Have your 마패 ready.'] },
  ],
  sideExit: { col: 34, scene: 'WonsanBeachScene', label: 'Kalma Beach', icon: '🏖' },
  // A dedicated two-tile avenue branches north from the main east-west road to
  // the Gwanmunseong gate, with a sign at the junction so it reads at a glance.
  trainers: [
    { key: 'wonsan-disciple-1', name: 'Disciple Baekho', col: 5, row: 13, color: 0xcc7a3a, label: 'Disciple\n① Pier',
      line: 'Master Haegang sent you? Then you\'ll start with me — down here by the pier. Come on!',
      pokemon: JSON.stringify([{ id: 62, level: 67 }, { id: 297, level: 68 }]), expPool: 2000 },
    { key: 'wonsan-disciple-2', name: 'Disciple Miru', col: 22, row: 13, color: 0xba5a3a, label: 'Disciple\n② Ground',
      line: 'Still on your feet after Baekho? Good. The training ground is MY dojo. Show me your stance!',
      pokemon: JSON.stringify([{ id: 68, level: 68 }, { id: 447, level: 68 }]), expPool: 2100 },
    // Disciple ③ waits at the far end of the gauntlet — down at Kalma Beach (WonsanBeachScene).
  ],
  prev: { scene: 'AhobiryongPassScene', returnKey: 'ahobiryong', x: 11 * 32 + 16, y: 4 * 32 + 16 },
  next: { scene: 'SijungCoastScene', returnKey: 'sijung', x: 9 * 32 + 16, y: 47 * 32 + 16 },
};

const HAMHUNG: EosaCity = {
  key: 'HamhungCityScene', name: 'Gangcheoldo (강철도)', mapaeKey: 'hamhung', bgm: 'hamhung',
  chiefKey: 'eosa-hamhung', chiefName: '어사대장 Cheolju',
  ground: 0x6a655c, accent: 0x8a8a95, hallRoof: 0x6a6a72, robe: 0x556066,
  team: [{ id: 208, level: 71 }, { id: 411, level: 71 }, { id: 530, level: 72 }, { id: 462, level: 72 }, { id: 376, level: 73 }],
  expPool: 4300,
  intro: ['Gangcheoldo (강철도) — furnace-light and clanging steel, the great works pouring iron day and night.',
          '어사대장 Cheolju stands like a girder, arms folded.'],
  examLead: '어사대장 Cheolju: The forge rewards only endurance. Outlast my steel, if you can. Begin.',
  award: ['어사대장 Cheolju: ...Unbent. Hm. You\'ll do.', '🐎 You received the Gangcheoldo 마패!'],
  mission: {
    threatKey: 'eosa-hamhung-threat', threatName: 'Berserk Steelix (폭주 강철톤)',
    threatMon: { id: 208, level: 72 }, col: 0, row: 0, remote: true,   // confronted deep in the ore mine
    blurb: ['어사대장 Cheolju: ...You want the exam. First, the works.',
            'A Steelix has burrowed up from the ore mine that feeds our furnaces and gone berserk in the tunnels. It thrashes when the miners come near — and if it collapses the main gallery, the whole steelworks goes cold.',
            'Take the pit road at the south edge of town down to the mine, and subdue it. No forge runs while it rages. See to it.'],
    reminder: '어사대장 Cheolju: The Steelix still rages in the mine. Take the pit road south to the mine, subdue it, then return to me.',
    approach: ['Heat and ore-dust roll through the gallery. The Steelix rears from the rock, plates glowing dull red.', 'It lunges, shaking the whole tunnel. Hold your ground!'],
    cleared: ['어사대장 Cheolju: ...The mine is quiet and the furnaces are lit again. A thousand families eat because of tonight.',
              'You did not flinch from the heat. Good. Neither will I. Begin.'],
  },
  // A grand steel city with a separate south-eastern bathhouse quarter. The
  // larger footprint keeps the tall bathhouse model out of the Pokémon
  // Center's camera sight-line instead of stacking both buildings visually.
  size: { cols: 44, rows: 30 },
  landmarks: [
    { col: 29, row: 4,  w: 4, h: 4, color: 0x8a3a2a, label: '🍜 강철도냉면 (Gangcheoldo Naengmyeon)', kind: 'building', solid: true, enter: 'HamhungNaengmyeonScene' },
    { col: 38, row: 3,  w: 4, h: 5, color: 0x6a6f7a, label: '🏭 No. 3 Steelworks (제철소)',    kind: 'building', solid: true },
    { col: 35, row: 14, w: 4, h: 4, color: 0x556066, label: '⚙ Iron Foundry (주물공장)',        kind: 'building', solid: true },
    { col: 41, row: 13, w: 2, h: 5, color: 0x8a8a95, label: '🗿 Steelworkers\' Monument (노동비)', kind: 'monument' },
    { col: 6,  row: 25, w: 3, h: 3, color: 0x3a6a4a, label: '🌉 Songchon Bridge (성천강)',        kind: 'pavilion' },
    { col: 20, row: 26, w: 3, h: 2, color: 0x7a7a5a, label: '🏔 Mt. Dongheungsan (동흥산)',        kind: 'monument' },
    { col: 31, row: 20, w: 5, h: 4, color: 0x6a7a8a, label: '♨ 강철도 목욕탕 (Bathhouse)', kind: 'building', solid: true, enter: 'NorthernBuildingScene', enterId: 'hamhung-bathhouse' },
  ],
  accessRoads: [
    { fromCol: 29, fromRow: 9, toCol: 33, toRow: 24, width: 2, label: '♨ 목욕탕 ↓' },
  ],
  npcs: [
    { col: 18, row: 13, color: 0x556066, label: 'Steelworker', lines: ['Steelworker: The No. 3 furnace runs day and night again — thanks to you clearing that Steelix from the mine.', 'Come by the works, I\'ll show you steel being born.'] },
    { col: 27, row: 12, color: 0x8a3a2a, label: 'Noodle Lover', lines: ['Noodle Lover: You HAVE to try the 강철도냉면 — chewy sweet-potato noodles, fiery cold broth. Best in the north!'] },
    { col: 12, row: 25, color: 0x3a6a4a, label: 'Bridge Elder', lines: ['Bridge Elder: The Songchon river has fed this plain for centuries. The steel came later — the water was always here.'] },
    { col: 29, row: 24, color: 0x6a7a8a, label: 'Bathhouse Regular', lines: ['Bathhouse Regular: Aaah, a good soak after a shift at the works. Try it — take your Pokémon in too!'] },
    { col: 38, row: 25, color: 0x7a6a5a, label: 'Miner', lines: ['Miner: The pit road south leads to the ore mine. Watch yourself down there — the deep galleries are no joke.'] },
  ],
  sideExit: { col: 39, scene: 'HamhungMineScene', label: 'Ore Mine', icon: '⛏', road: true },
  prev: { scene: 'SijungCoastScene', returnKey: 'sijung', x: 9 * 32 + 16, y: 4 * 32 + 16 },
  next: { scene: 'ChilboHighlandsScene', returnKey: 'chilbo', x: 10 * 32 + 16, y: 47 * 32 + 16 },
};

const CHONGJIN: EosaCity = {
  key: 'ChongjinCityScene', name: 'Muyeonhang (무연항)', mapaeKey: 'chongjin', bgm: 'chongjin',
  chiefKey: 'eosa-chongjin', chiefName: '어사대장 Mukyeong',
  ground: 0x4a5058, accent: 0x2a2f3a, hallRoof: 0x3a3a44, robe: 0x2a2f3a,
  team: [{ id: 248, level: 72 }, { id: 461, level: 72 }, { id: 229, level: 73 }, { id: 625, level: 73 }, { id: 635, level: 74 }],
  expPool: 4500,
  intro: ['Muyeonhang (무연항) — the last northern harbor, cranes looming out of a cold sea-fog, gulls unseen but heard.',
          'From the mist, 어사대장 Mukyeong watches without a word.'],
  examLead: '어사대장 Mukyeong: In fog, you cannot see what comes. Only adapt. ...Begin.',
  award: ['어사대장 Mukyeong: You saw the hand behind the fog, and you struck it. That is worth more than any drill against me.',
          '🐎 You received the Muyeonhang 마패!'],
  mission: {
    threatKey: 'eosa-chongjin-threat', threatName: 'Fog-Wraith Gengar (안개 팬텀)',
    threatMon: { id: 94, level: 72 }, col: 0, row: 0, remote: true,   // confronted deep in the Fogbound Manor
    blurb: ['어사대장 Mukyeong: ...You came for the exam. But something else came first.',
            'On the fog road at the town\'s edge stands the old Fogbound Manor — abandoned for years. Lately a Gengar has nested inside, and from its windows the fog spills out to lead our night crews off the pier. Two boats are lost.',
            'Take the fog road and go into the manor. End its game. What you cannot see can still be faced... if you keep your nerve. Go.'],
    reminder: '어사대장 Mukyeong: The manor on the fog road still breathes mist over my harbor. Go inside, face the Gengar, then return... if it lets you.',
    approach: ['The manor holds its breath. Then, from the dark, a grin floats up — and the rest of it pours out of the walls.', 'The Fog-Wraith Gengar\'s laugh echoes from everywhere at once. Steady yourself!'],
    cleared: ['어사대장 Mukyeong: ...As I feared. That Gengar wore a trainer\'s command — someone loosed it in the manor to blind my harbor.',
              '노스단. They run cargo through Muyeonhang under the fog, bound for the sacred peak. Now that the mist has lifted, my crews will hunt them down — that is my burden, not yours.',
              'You cleared my harbor of what I could not see. Now show me your steel directly, Champion. Face me — pass my exam, and the 마패 is yours by right.'],
  },
  sideExit: { col: 4, scene: 'FogboundManorScene', label: 'Fogbound Manor', icon: '🏚', road: true },
  // A wide, fog-shrouded northern harbour.
  size: { cols: 36, rows: 24 },
  landmarks: [
    { col: 32, row: 2,  w: 2, h: 5, color: 0x3a4a5a, label: '🗼 Foghorn Light (등대)',      kind: 'lighthouse', solid: true },
    { col: 26, row: 4,  w: 4, h: 4, color: 0x4a5058, label: '🏗 Harbour Cranes (크레인)',    kind: 'building', solid: true },
    { col: 27, row: 13, w: 4, h: 4, color: 0x3a4048, label: '🥫 Fish Cannery (통조림 공장)',  kind: 'building', solid: true },
    { col: 33, row: 12, w: 2, h: 5, color: 0x6a7078, label: '🌊 Sea Wall (방파제)',           kind: 'monument' },
    { col: 20, row: 21, w: 3, h: 2, color: 0x556678, label: '⚓ Old Pier (부두)',             kind: 'pavilion' },
    { col: 26, row: 17, w: 4, h: 3, color: 0x3a3f4a, label: "🛏 뱃사람 여관 (Sailors' Inn)", kind: 'building', solid: true, enter: 'NorthernBuildingScene', enterId: 'chongjin-inn' },
  ],
  // Fog-port townsfolk — Muyeonhang is a busy (if uneasy) harbour.
  npcs: [
    { col: 8,  row: 12, color: 0x4a5a6a, label: 'Dockworker',
      lines: ['Dockworker Namgil: The fog\'s thick as wool tonight. I unloaded a whole hold of crates and never once saw my own hands.'] },
    { col: 20, row: 13, color: 0x2a4a7a, label: 'Old Sailor',
      lines: ['Old Sailor: Fifty years I\'ve sailed off this coast.', 'The sea gives, and the sea takes. Lately... it only takes.'] },
    { col: 11, row: 15, color: 0x3a6a5a, label: 'Fisher',
      lines: ['Fisher: The gulls scream all night, but you never see them through the mist.', 'This town gets into your bones, stranger.'] },
    { col: 18, row: 16, color: 0x5a4a3a, label: 'Night Crew',
      lines: ['Night-crew Worker: Two boats lost this month, right at the pier\'s edge.', 'The Chief says it\'s no accident. ...After what I\'ve seen, I believe him.'] },
    { col: 10, row: 17, color: 0x6a3a3a, label: 'Foghorn Keeper',
      lines: ['Foghorn Keeper: I sound the horn every hour, on the hour.', 'Some nights... I swear something out in the fog answers back.'] },
    { col: 16, row: 17, color: 0xcc7a3a, label: 'Child',
      lines: ['Harbour Child: Mister! Have you seen the old manor on the fog road?', 'Everyone says a GHOST lives there! ...I dare you to go in. Heehee!'] },
    { col: 23, row: 12, color: 0x7a6a3a, label: 'Merchant',
      lines: ['Merchant: Cargo moves through this port at all the odd hours, friend.', 'Whose cargo? ...Best not to ask that too loudly. Not in Muyeonhang.'] },
    { col: 7,  row: 12, color: 0x3a5a6a, label: 'Watcher',
      lines: ['Gull-watcher: When the fog lifts — rare, that — you can see clear to the sea wall.', 'Then it rolls back in, and you\'d swear it was never there at all.'] },
    { col: 19, row: 6,  color: 0x24304a, label: 'Warden',
      lines: ['Harbour Warden: Papers, papers... we\'re meant to log every crate through this port.', 'But the fog makes liars of us all. Half the manifests are ghosts.'] },
  ],
  prev: { scene: 'ChilboHighlandsScene', returnKey: 'chilbo', x: 10 * 32 + 16, y: 4 * 32 + 16 },
  next: { scene: 'KaemaPlateauScene', returnKey: 'kaema', x: 11 * 32 + 16, y: 47 * 32 + 16 },   // north over the plateau → Binghagwan
};

const SINUIJU: EosaCity = {
  key: 'SinuijuCityScene', name: 'Binghagwan (빙하관)', mapaeKey: 'sinuiju', bgm: 'sinuiju',
  chiefKey: 'eosa-sinuiju', chiefName: '어사대장 Amrok',
  // The frozen border city reuses the snowy Seorae Town building models.
  buildingModels: ['frostbell', 'alpinelodge', 'snowmeltbaths', 'skateshop'],
  ground: 0x8aa0b0, accent: 0xbfe0f0, hallRoof: 0x3a6a9a, robe: 0x3a5a8a,
  team: [{ id: 131, level: 73 }, { id: 471, level: 73 }, { id: 230, level: 74 }, { id: 373, level: 74 }, { id: 149, level: 75 }],
  expPool: 4700,
  intro: ['Binghagwan (빙하관) — the Amrok river locked in blue ice, a broken bridge-span reaching toward the far bank.',
          '어사대장 Amrok bars the crossing, breath fogging in the still cold.'],
  examLead: '어사대장 Amrok: The coldest gate. Cross it before the ice cracks beneath you. Begin.',
  award: ['어사대장 Amrok: ...You crossed. Few do.', '🐎 You received the Binghagwan 마패!'],
  mission: {
    threatKey: 'eosa-sinuiju-threat', threatName: 'Ice-Bound Beartic (얼음 툰베어)',
    threatMon: { id: 614, level: 74 }, col: 0, row: 0, remote: true,   // confronted deep in the ice cave
    blurb: ['어사대장 Amrok: You wish to cross. But no one crosses while the ice is unsafe.',
            'Below the frozen Amrok lies an ice cave, and in its heart a Beartic has woken. Its roars crack the whole sheet — every hour the split creeps closer to the town side. If it reaches us, the crossing is gone until spring.',
            'Take the frozen path to the cave mouth and go DEEP. But mind your footing — the cavern floor is sheer ice; step onto it and you will slide until a boulder stops you. Reach the heart, drive the beast out, then we speak of your exam.'],
    reminder: '어사대장 Amrok: The ice still splinters from below. Slide your way to the heart of the ice cave, drive the Beartic out, then return to me.',
    approach: ['(unused — the Beartic is confronted in the heart of the ice cave.)'],
    cleared: ['어사대장 Amrok: ...The cracking has stopped. The crossing holds. You slid blind through that frozen maze and faced the beast in its own lair.',
              'That is the coldest kind of courage. The gate is yours to earn. Begin.'],
  },
  trees: [],   // no generic tree tiles — one landed in front of the gate/paths in this large frozen city
  sideExit: { col: 18, scene: 'SinuijuIceCaveScene', label: '얼음 동굴 (Ice Cave)', icon: '❄', road: true },   // right of the circuit road so it never collides with the Seolun route
  // A wide frozen-border city on the Amrok river — expanded east into an open railway plaza.
  size: { cols: 48, rows: 24 },
  landmarks: [
    // ── The frontier railway plaza — a wide-open square on the east edge of town, where
    //    the rails leave the known world for the 미지의 대륙 ──
    { col: 40, row: 6,  w: 6, h: 4, color: 0x3a5a7a, label: '🚉 압록강 국제철도역 (Intl. Rail Station)',      kind: 'station', solid: true },
    { col: 38, row: 11, w: 9, h: 1, color: 0x6a6156, label: '🛤 미지의 대륙행 철길 (Line to the 미지의 대륙)',  kind: 'rail' },
    { col: 44, row: 14, w: 3, h: 2, color: 0x8aa0c0, label: '🧭 미지의 대륙 전망대 (Unknown-Continent Overlook)', kind: 'pavilion' },
    { col: 29, row: 2,  w: 6, h: 3, color: 0x6a7a9a, label: '🌉 압록강 대교 (Amrok Bridge — broken)', kind: 'monument' },
    { col: 26, row: 5,  w: 4, h: 4, color: 0x4a6a8a, label: '🏛 Customs House (세관)',        kind: 'building', solid: true },
    { col: 27, row: 14, w: 4, h: 4, color: 0x5a7a9a, label: '❄ Ice Harbour (얼음 항)',        kind: 'building', solid: true },
    { col: 20, row: 21, w: 3, h: 2, color: 0x8ab0d0, label: '⛸ Frozen Amrok (얼음 강)',        kind: 'pavilion' },
    { col: 26, row: 18, w: 4, h: 3, color: 0x6a4a2a, label: '🏪 교역소 (Trading Post)', kind: 'building', solid: true, enter: 'NorthernBuildingScene', enterId: 'sinuiju-post' },
  ],
  npcs: [
    { col: 41, row: 12, color: 0x2a4a6a, label: 'Stationmaster',
      lines: ['Stationmaster: Welcome to the 압록강 국제철도역! Grandest terminal in the north — and the emptiest.',
              'The line was built to run clear across the 미지의 대륙 — the Unknown Continent, off past the frozen river. Iron rails to the very edge of the map, and beyond.',
              'But the far span stands unfinished, and no soul has charted what waits out there. One day the trains will run again. Perhaps you will ride the first, Champion.'] },
    { col: 45, row: 13, color: 0x7a6a9a, label: 'Continental Traveler',
      lines: ['Traveler: I came all this way to catch the train to the 미지의 대륙. They tell me the line has been shut for years.', 'Still... from this overlook I can feel it out there, past the frozen Amrok. A whole continent, waiting to be walked.'] },
    { col: 38, row: 9,  color: 0x5a6a7a, label: 'Rail Porter',
      lines: ['Rail Porter: Mind the platform, Champion. These rails haven\'t felt a train in years, but we sweep them every morning all the same.', 'Old-timers say when the line to the 미지의 대륙 reopens, the whole plaza will fill with travellers again.'] },
    { col: 12, row: 13, color: 0x3a5a8a, label: 'Border Guard', lines: ['Border Guard: The far bank is another country. The bridge broke years ago — now only the ice connects us, and only in winter.'] },
    { col: 20, row: 14, color: 0x6a4a2a, label: 'Fur Trader', lines: ['Fur Trader: Sable, ermine, jade from across the river — the Trading Post has it all. If you can pay.'] },
    { col: 24, row: 20, color: 0x5a7a9a, label: 'Ice Fisher', lines: ['Ice Fisher: Since you drove that Beartic off, the ice holds firm again. My whole village fishes it once more.'] },
    { col: 9,  row: 12, color: 0x8ab0d0, label: 'Skater', lines: ['Skater: When the Amrok freezes solid, we skate clear across it! ...Mind the cracks by the old bridge, though.'] },
    { col: 8,  row: 21, color: 0x4a6a8a, label: 'Bundled Elder', lines: ['Bundled Elder: Coldest gate in the north, they call Binghagwan. Amrok guards it well. You did him proud out on that ice.'] },
  ],
  prev: { scene: 'KaemaPlateauScene', returnKey: 'kaema', x: 11 * 32 + 16, y: 4 * 32 + 16 },   // south over the plateau → Muyeonhang
  next: { scene: 'RangrimFoothillsScene', returnKey: 'rgFoot', x: 11 * 32 + 16, y: 25 * 32 + 16 },   // north up the Onseong mountain (5 maps) → Samho
};

const SAMJIYON: EosaCity = {
  key: 'SamjiyonCityScene', name: 'Samho (삼호)', mapaeKey: 'samjiyon', bgm: 'samjiyon',
  chiefKey: 'eosa-samjiyon', chiefName: '어사대장 Seolwon',
  ground: 0xd8e4ec, accent: 0xaef0ff, hallRoof: 0x8a9aca, robe: 0xaab0d0,
  team: [{ id: 460, level: 75 }, { id: 478, level: 75 }, { id: 473, level: 76 }, { id: 461, level: 76 }, { id: 614, level: 78 }],
  expPool: 5000,
  intro: ['Samho (삼호) — the three-lake plateau under Baekdu, larch forests deep in snow, an aurora ghosting the sky.',
          '어사대장 Seolwon, last of the eight, stands serene where the world turns white.'],
  examLead: '어사대장 Seolwon: Pass me, and the road to the sacred peak — and the Northern League — is yours. Begin.',
  award: ['어사대장 Seolwon: Eight 마패. You are worthy to climb. The Northern League will know you now.',
          '🐎 You received the Samho 마패!  (Present all eight at the Northern League.)'],
  mission: {
    threatKey: 'nosdan-samjiyon-boss', threatName: 'Sovereign Clemont',
    threatMon: { id: 461, level: 77 }, col: 0, row: 0, remote: true,   // confronted atop the 노스단 아지트
    blurb: ['어사대장 Seolwon: The last of the eight. Steady your breath, Champion — begin—',
            '💥 The Hall doors burst open in a gust of snow! The 노스단 Sovereign strides in, grunts fanning out behind him.',
            'Sovereign Clemont: The exam is cancelled, Inspector. 노스단 has raised its 아지트 at the head of your mountain road — Samho is OURS now, the gateway to the sacred peak.',
            '어사대장 Seolwon: ...So they come at last, into the open. Champion — I cannot grant the exam while that tower stands over my people.',
            'Seolwon: Take the mountain road to their 아지트. Climb it, floor by floor, and cast down the 간부 at its top. Break their hold on Samho — then, and only then, face me.'],
    reminder: '어사대장 Seolwon: The 노스단 아지트 still looms at the head of the mountain road. Climb it, throw down their 간부, and return — then the last exam is yours.',
    approach: ['(unused — the 간부 is confronted at the top of the 노스단 아지트.)'],
    cleared: ['어사대장 Seolwon: ...The tower has fallen. Word came down the mountain — the 노스단 flag is torn down and their grunts scatter into the snow.',
              'You stormed their whole 아지트 alone, on the eve of your own trial. That is the spirit the peak asks for. Now — face me. Begin.'],
  },
  sideExit: { col: 38, scene: 'SamjiyonAjitRoadScene', label: '노스단 산책로 (Nosdan Path)', icon: '🥾', road: true },
  // A wide highland-plateau town beneath Baekdu. The 노스단 아지트 is reached only up the
  // mountain road (노스단 산책로) off the eastern flank — no building sits in the town itself.
  size: { cols: 48, rows: 28 },
  landmarks: [
    { col: 28, row: 2,  w: 6, h: 3,  color: 0xaef0ff, label: '🏔 Baekdu Trailhead (백두산 등산로)', kind: 'monument' },
    { col: 26, row: 5,  w: 4, h: 4,  color: 0x8a9aca, label: '🪵 Larch Sawmill (제재소)',          kind: 'building', solid: true },
    { col: 40, row: 18, w: 3, h: 4,  color: 0xaab0d0, label: '🌌 Aurora Viewpoint (오로라 전망대)', kind: 'monument' },
    { col: 6,  row: 24, w: 4, h: 2,  color: 0xaef0ff, label: '💧 Three Lakes (삼호)',            kind: 'pavilion' },
    { col: 26, row: 22, w: 4, h: 3,  color: 0x6a7590, label: '🏡 고원 산장 (Highland Lodge)', kind: 'building', enter: 'NorthernBuildingScene', enterId: 'samjiyon-lodge' },
  ],
  npcs: [
    { col: 12, row: 13, color: 0x8a9aca, label: 'Larch Cutter', lines: ['Larch Cutter: The larch forests run right up to Baekdu\'s foot. Good timber — if the blizzards let you fell it.'] },
    { col: 20, row: 23, color: 0xaab0d0, label: 'Pilgrim', lines: ['Pilgrim: Beyond the plateau lies the sacred peak itself. Only those worthy of all eight 마패 may climb. ...Is that you?'] },
    { col: 32, row: 15, color: 0xcfe0e8, label: 'Snow Child', lines: ['Snow Child: The snow stopped falling! The Abomasnow used to make it blizzard FOREVER. Thank you, mister!'] },
    { col: 9,  row: 12, color: 0x6a7590, label: 'Lodge Guest', lines: ['Lodge Guest: Warm up at the Highland Lodge before you climb. It\'s a long, cold road to the peak.'] },
    { col: 8,  row: 21, color: 0xaef0ff, label: 'Aurora Watcher', lines: ['Aurora Watcher: On clear nights the sky burns green and violet over the three lakes. There\'s no sight like it in all Onnuri.'] },
    { col: 34, row: 14, color: 0x5a1024, label: '노스단 Lookout', lines: ['노스단 Lookout: The 노스단 산책로 runs east off the plateau, up to our 아지트. Don\'t take that path unless you mean to climb.'] },
  ],
  prev: { scene: 'RangrimSummitScene', returnKey: 'rgPeak', x: 11 * 32 + 16, y: 3 * 32 + 16 },   // south down the Onseong mountain (5 maps) → Binghagwan
  // Samho is the highland terminus of the Onseong branch — it no longer leads to the
  // Northern League. The League (NorthernPlaza) is reached only through Gwanmunseong.
};

export class NampoCityScene    extends EosaCityScene { constructor() { super(NAMPO); } }
export class WonsanCityScene   extends EosaCityScene { constructor() { super(WONSAN); } }
export class HamhungCityScene  extends EosaCityScene { constructor() { super(HAMHUNG); } }
export class ChongjinCityScene extends EosaCityScene { constructor() { super(CHONGJIN); } }
export class SinuijuCityScene  extends EosaCityScene { constructor() { super(SINUIJU); } }
export class SamjiyonCityScene extends EosaCityScene { constructor() { super(SAMJIYON); } }
