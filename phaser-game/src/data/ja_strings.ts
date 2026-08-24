import { JA_REMAINING_SPEAKERS, JA_REMAINING_STRINGS } from './ja_remaining';

/** Complete Japanese localization for UI, battle vocabulary, and story text. */
export const JA_STRINGS: Record<string, string> = {
  ...JA_REMAINING_STRINGS,
  // Title / common navigation
  'Language': '言語',
  '▶  NEW GAME': '▶  はじめから',
  '▶  CONTINUE': '▶  つづきから',
  '◆  LEADERBOARD': '◆  ランキング',
  '◆ RANK': '◆ ランク',
  '💾 SAVE': '💾 セーブ',
  '💾 SAVED!': '💾 セーブしました！',
  '⚠ SAVE FAILED': '⚠ セーブ失敗',
  'MAIN MENU': 'メインメニュー',
  '◈  POKÉMON': '◈  ポケモン',
  '▣  BAG': '▣  バッグ',
  '✕ CLOSE': '✕ とじる',
  '✕ TAP OUTSIDE / CLOSE': '✕ 外側をタップ / とじる',
  'B  CLOSE': 'B  とじる',
  'B  RETURN': 'B  もどる',
  'Quest Log': '冒険ログ',
  'QUEST LOG': '冒険ログ',
  'CURRENT OBJECTIVE': '現在の目的',
  'DESTINATION': '目的地',
  'COMPLETED MILESTONES': '達成した主な記録',
  'Your journey has only just begun.': '旅はまだ始まったばかりです。',
  'Choose Your First Partner': '最初のパートナーを選ぼう',
  "Head to Prof. Song's Lab and get your Pokémon!": 'ソン博士の研究所へ行き、最初のポケモンを受け取ろう！',
  'Professor Song’s Lab': 'ソン博士の研究所',
  'Homecoming': '家へ帰ろう',
  "Phew, I'm beat… maybe I'll swing by home first?": '疲れたな……まずは家に寄ってみよう。',
  'Your home in Waterfall City': 'ポッポシティの自宅',
  'A Guardian of Two Lands': '二つの地域の守護者',
  'The main story is complete. Explore, fill the Pokédex, breed Pokémon or challenge both Leagues again.':
    'メインストーリーは完結しました。図鑑、育て屋、二つのリーグへの再挑戦を楽しみましょう。',
  'Free exploration': '自由探索',
  'Win the North’s Trust': '北部の信頼を得よう',
  'Cross the Northern Reaches and complete the border trial to open the road toward the sacred mountain.':
    '北方辺境を越え、国境の試練を達成して霊峰への道を開こう。',
  'Northern Reaches': '北方辺境',
  'Race to the Sacred Peak': '聖なる頂へ急げ',
  'Team Nos has entered the Onseong Mountains. Climb Rangrim Mountain and protect Hwanung.':
    'ノス団がオンソン山脈へ侵入した。ランリム山を登り、ファヌンを守ろう。',
  'Rangrim Mountain → Sacred Peak': 'ランリム山 → 聖なる頂',
  'Return for the Victory Gathering': '勝利の集いへ戻ろう',
  'Meet Professor Song at the Ancient Altar in Capitol City for the next investigation.':
    'スドシティの古代祭壇でソン博士と会い、次の調査を始めよう。',
  'Return to Professor Song’s lab. Your friends are waiting to celebrate the Northern League victory.':
    'ソン博士の研究所へ戻ろう。北方リーグ優勝を祝う仲間たちが待っている。',
  'Capitol City · Professor Song’s Lab': 'スドシティ · ソン博士の研究所',
  'The Northern Inspectorate Circuit': '北部オサデ巡礼',
  'Challenge the Northern League': '北方リーグに挑もう',
  'All eight Mapae are assembled. Enter the Northern League and face its four masters and Taewang.':
    '八つのマペを集めた。北方リーグに入り、四人の達人とテワンに挑もう。',
  'Northern League': '北方リーグ',
  '8 / 8 Mapae': 'マペ 8 / 8',
  'The Onnuri Pokémon League': 'オンヌリ・ポケモンリーグ',
  'Take the western Scholars’ Road from Capitol City, pass the badge scanner and challenge the League.':
    'スドシティ西の学者の道へ進み、バッジスキャナーを通ってリーグに挑もう。',
  'Capitol City → Scholars’ Road': 'スドシティ → 学者の道',
  '8 / 8 Gym Badges': 'ジムバッジ 8 / 8',
  'Rescue the Guardian of Jeju': 'チェジュの守護者を救おう',
  'Return to the summit of the Jeju volcanic vents. Team Nos is moving against Nabihalmang.':
    'チェジュ火山噴気孔の頂へ戻ろう。ノス団がナビハルマンを狙っている。',
  'Jeju Vents Summit': 'チェジュ噴気孔の頂',
  '7 / 8 Gym Badges': 'ジムバッジ 7 / 8',
  'First Steps with a Partner': 'パートナーとの第一歩',
  'Leave Waterfall City by the east road and meet your rival on Route 1.':
    'ポッポシティの東の道から出て、1番道路でライバルに会おう。',
  'Route 1': '1番道路',
  'Find Leader Sandol': 'ジムリーダー・サンドルを探そう',
  'Sandol left the Gym to investigate black-coated diggers. Find him at the dolmen ruins west of Dolmoe.':
    'サンドルは黒服の発掘団を調べるためジムを離れた。トルメ西の支石墓遺跡で探そう。',
  'Dolmoe Dolmen Ruins': 'トルメ支石墓遺跡',
  'Professor Song’s Urgent Call': 'ソン博士からの緊急連絡',
  'Heal your team, then enter Professor Song’s lab in Capitol City and hear what Team Suri and Team Nos are planning.':
    '手持ちを回復し、スドシティのソン博士研究所でスリ団とノス団の計画を聞こう。',
  '5 / 8 Gym Badges': 'ジムバッジ 5 / 8',
  'Explore Onnuri': 'オンヌリを探索しよう',
  'Open the Town Map and continue toward the next unvisited city.': 'タウンマップを開き、まだ訪れていない次の町へ進もう。',
  'Received a first partner Pokémon': '最初のパートナーポケモンを受け取った',
  'Won the first rival battle': '最初のライバル戦に勝利した',
  'Protected Nabihalmang at Jeju': 'チェジュでナビハルマンを守った',
  'Became the Onnuri Champion': 'オンヌリチャンピオンになった',
  'Conquered the Northern League': '北方リーグを制覇した',
  'Protected Hwanung and completed the journey': 'ファヌンを守り、旅を完遂した',
  '← BACK': '← もどる',
  'NEXT PAGE ▶': '次のページ ▶',
  '◀ PREVIOUS PAGE': '◀ 前のページ',
  'AUTO-SAVE: ON': 'オートセーブ：オン',
  'AUTO-SAVE: OFF': 'オートセーブ：オフ',
  'Start a new game?': 'はじめから 遊びますか？',
  'Your current saved game will be erased.\nAre you sure you want to start over?':
    '現在のセーブデータは消去されます。\n本当に はじめから 遊びますか？',
  '  No, keep my save  ': '  いいえ、セーブを残す  ',
  '  Yes, start over  ': '  はい、はじめから  ',
  '↩  Restore previous save': '↩  前のセーブを復元',
  '▶ YES': '▶ はい', '  YES': '  はい', '▶ NO': '▶ いいえ', '  NO': '  いいえ',
  'OK': '決定', '✕ Cancel': '✕ キャンセル', '✕ Close': '✕ とじる',
  'SPACE  to talk': 'SPACE  はなす', 'SPACE — Enter': 'SPACE — はいる',

  // New-game introduction and essential story onboarding
  'Hello there! Welcome to the world of Pokémon!': 'こんにちは！ ポケモンの世界へ ようこそ！',
  'My name is Song. Song Nam-woo. But everyone in the region simply calls me the Professor.':
    'わたしの名前は ソン・ナムウ。みんなからは ソン博士と 呼ばれているよ。',
  'But first — tell me a little about yourself. Are you a boy? Or are you a girl?':
    'その前に きみのことを 教えてほしい。男の子かな？ それとも 女の子かな？',
  'This world is inhabited far and wide by wonderful creatures called Pokémon. We live alongside them — as friends, as partners, and sometimes as rivals in battle.':
    'この世界には ポケモンと呼ばれる 不思議な生き物たちが いたるところに暮らしている。わたしたちは 友として パートナーとして ときには バトルのライバルとして 共に生きているんだ。',
  'This land is the Onnuri region: a peninsula of pine-needle towns and misty highlands, of volcanic isles in the south and a cold, watchful North.':
    'ここは オンヌリ地方。松葉の町と 霧の高原、南の火山島、そして 寒く静かな北方が広がる 半島だ。',
  'For some, Pokémon are beloved companions. For others, they are a subject of study. I have devoted my whole life to understanding the bond between people and Pokémon.':
    'ポケモンを 大切な仲間とする人もいれば 研究する人もいる。わたしは 人とポケモンの絆を知るために 一生を捧げてきた。',
  "Your very own story is about to unfold. A world of dreams and adventures with Pokémon awaits! Let's go!":
    'さあ きみだけの物語が 始まろうとしている。ポケモンと夢と冒険の世界へ！ いこう！',
  'What is your name?': 'きみの名前は？',
  'And what shall I call you, new trainer?': '新しいトレーナーの きみを なんと呼べばいいかな？',
  'Your name': 'あなたの名前', "Your rival's name?": 'ライバルの名前は？',
  "Rival's name": 'ライバルの名前',
  'Prof. Song: Welcome! Three Pokémon from this region are waiting for a trainer.\nChoose the one who calls to you.':
    'ソン博士: よく来たね！ この地方の3匹のポケモンが トレーナーを待っている。\n心ひかれる 1匹を選んでごらん。',
  '◀ ▶ to browse     SPACE to choose': '◀ ▶ えらぶ     SPACE 決定',

  // Mobile controls
  'Movement joystick': '移動スティック',
  'DRAG TO MOVE': 'スライドして移動',
  'Turn your phone sideways': 'スマートフォンを横向きにしてください',
  'This adventure is played in landscape. It starts as soon as you rotate.':
    'このゲームは横画面で遊びます。端末を回転するとすぐに再開します。',

  // Party / box / summary
  'POKÉMON STATUS': 'ポケモンのステータス',
  'POKÉMON SUMMARY': 'ポケモンのつよさ',
  'POKÉMON STORAGE SYSTEM': 'ポケモンボックス',
  'ALL BOXES': 'すべてのボックス',
  'CURRENT PARTY': 'てもちポケモン',
  'CHANGE LEAD POKÉMON': '先頭のポケモンを変更',
  'SET LEAD': '先頭にする',
  '★ LEAD': '★ 先頭',
  'SWAP': 'いれかえる',
  'SEND TO THIS BOX': 'このボックスへ送る',
  'ADD TO PARTY': 'てもちに加える',
  'Select or drag a Pokémon to move it.': 'ポケモンを選ぶかドラッグして移動します。',
  'Tap a Pokémon for details · SET LEAD changes your first battler':
    'ポケモンをタップすると詳細を表示します。「先頭にする」で最初のポケモンを変更できます。',
  'Tap a Pokémon for details. Use SET LEAD to change your first battler.':
    'ポケモンをタップすると詳細を表示します。「先頭にする」で先頭を変更できます。',
  'That Pokémon is no longer there.': 'そのポケモンはもうそこにいません。',
  'This box is full.': 'このボックスはいっぱいです。',
  'Your party is full.': 'てもちがいっぱいです。',
  'You must keep at least one Pokémon in your party.': 'てもちには最低1匹のポケモンが必要です。',
  'Pokémon Egg': 'ポケモンのタマゴ',
  'Walk together to hatch it': 'いっしょに歩くと生まれます',
  'Caught at': '出会った場所',
  'Unknown location': '不明な場所',
  'Unknown': '不明',
  'None': 'なし',

  // Pokémon Center / shop / storage
  'Welcome to the Pokémon Center! 🌸': 'ポケモンセンターへ ようこそ！ 🌸',
  'We restore your tired Pokémon.\nShall I heal your Pokémon?':
    'お疲れのポケモンを 元気にします。\nポケモンを 回復しますか？',
  "We'll take your Pokémon for just a moment!": 'ポケモンを 少しのあいだ お預かりします！',
  'Your Pokémon have been fully restored!\nPlease come again! 🌸':
    'ポケモンは みんな元気になりました！\nまた お越しください！ 🌸',
  'Okay! Please come again anytime. 🌸': 'わかりました！ またいつでも お越しください。 🌸',
  'Welcome! Take a look at our wares.': 'いらっしゃいませ！ 商品を ご覧ください。',
  'Accessing Pokémon storage system...': 'ポケモンボックスに 接続しています……',

  // Status labels
  'HP': 'HP', 'ATTACK': 'こうげき', 'DEFENSE': 'ぼうぎょ',
  'SP. ATK': 'とくこう', 'SP. DEF': 'とくぼう', 'SPEED': 'すばやさ',
  'Attack': 'こうげき', 'Defense': 'ぼうぎょ', 'Sp. Atk': 'とくこう',
  'Sp. Def': 'とくぼう', 'Speed': 'すばやさ', 'Ability': 'とくせい',
  'ABILITY': 'とくせい', 'HELD ITEM': 'もちもの', 'Held item': 'もちもの',
  'MOVES': 'わざ', 'MOVE': 'わざ', 'AVAILABLE MOVES': '使えるわざ',
  'BATTLE STATS': 'のうりょく', 'STATUS': 'ステータス', 'CONDITION': '状態',
  'Healthy': 'げんき', 'Paralyzed': 'まひ', 'Burned': 'やけど',
  'Poisoned': 'どく', 'Asleep': 'ねむり', 'Frozen': 'こおり',
  'Physical': 'ぶつり', 'Special': 'とくしゅ', 'Status': 'へんか',
  'Power': '威力', 'Pow': '威力', 'Acc': '命中',

  // Battle commands and fixed results
  'BATTLE COMMAND': 'バトルコマンド',
  'WHAT WILL YOU DO?': 'どうする？',
  'CHOOSE A MOVE': 'わざを選んでください',
  'FIGHT': 'たたかう', 'BAG': 'バッグ', 'POKÉMON': 'ポケモン', 'RUN': 'にげる',
  'A critical hit!': '急所に当たった！',
  'Super effective!': '効果はバツグンだ！',
  'Not very effective...': '効果はいまひとつのようだ……',
  'It had no effect!': '効果がないようだ……',
  'But it failed!': 'しかし うまく決まらなかった！',
  'You lost...': '負けてしまった……',
  'Will you switch your Pokémon?': 'ポケモンを入れ替えますか？',
  'No usable items in the bag.': 'バッグに 使える道具がありません。',
  'Choose your next Pokémon!': '次のポケモンを 選んでください！',
  'Switch to which Pokémon?': 'どのポケモンと 入れ替えますか？',
  "CAN'T RUN": 'にげられない',
  "You can't run from a trainer battle!": 'トレーナーとの勝負からは にげられない！',
  "You can't flee a Gym Battle!": 'ジムバトルからは にげられない！',
  'Choose a move!': 'わざを 選んでください！',
  'No PP left!': 'わざを出すための PPがない！',
  'The sunlight turned harsh!': '日差しが強くなった！',
  'Snow began to fall!': '雪が降り始めた！',
  'It started to rain!': '雨が降り始めた！',
  'A sandstorm kicked up!': '砂あらしが吹き始めた！',
  'The weather cleared!': '天気が元に戻った！',

  // Common moves/items
  'Tackle': 'たいあたり', 'Quick Attack': 'でんこうせっか', 'Body Slam': 'のしかかり',
  'Ember': 'ひのこ', 'Flamethrower': 'かえんほうしゃ', 'Fire Blast': 'だいもんじ',
  'Water Gun': 'みずでっぽう', 'Water Pulse': 'みずのはどう', 'Hydro Pump': 'ハイドロポンプ',
  'Vine Whip': 'つるのムチ', 'Razor Leaf': 'はっぱカッター', 'Energy Ball': 'エナジーボール',
  'Thunder Shock': 'でんきショック', 'Thunderbolt': '10まんボルト', 'Thunder': 'かみなり',
  'Powder Snow': 'こなゆき', 'Ice Beam': 'れいとうビーム', 'Blizzard': 'ふぶき',
  'Brick Break': 'かわらわり', 'Close Combat': 'インファイト', 'Sludge Bomb': 'ヘドロばくだん',
  'Earthquake': 'じしん', 'Dig': 'あなをほる', 'Fly': 'そらをとぶ',
  'Air Slash': 'エアスラッシュ', 'Psychic': 'サイコキネシス', 'Shadow Ball': 'シャドーボール',
  'Dragon Pulse': 'りゅうのはどう', 'Crunch': 'かみくだく', 'Iron Head': 'アイアンヘッド',
  'Moonblast': 'ムーンフォース', 'Sunny Day': 'にほんばれ', 'Snowscape': 'ゆきげしき',
  'Rain Dance': 'あまごい', 'Sandstorm': 'すなあらし', 'Hail': 'あられ',
  'Potion': 'キズぐすり', 'Super Potion': 'いいキズぐすり',
  'Hyper Potion': 'すごいキズぐすり', 'Max Potion': 'まんたんのくすり',
  'Revive': 'げんきのかけら', 'Full Heal': 'なんでもなおし',
  'Oran Berry': 'オレンのみ', 'Sitrus Berry': 'オボンのみ', 'Lum Berry': 'ラムのみ',
  'Leftovers': 'たべのこし', 'Expert Belt': 'たつじんのおび', 'Charcoal': 'もくたん',
  'Mystic Water': 'しんぴのしずく', 'Miracle Seed': 'きせきのタネ', 'Magnet': 'じしゃく',
  'Poké Ball': 'モンスターボール', 'Great Ball': 'スーパーボール', 'Ultra Ball': 'ハイパーボール',
  'Held: restores 10 HP at low HP.': '持たせると HPが少ないとき 10回復する。',
  'Held: restores one quarter of max HP at low HP.': '持たせると HPが少ないとき 最大HPの4分の1を回復する。',
  'Held: cures any major status condition.': '持たせると 状態異常を一度だけ治す。',
  'Held: gradually restores HP every turn.': '持たせると 毎ターン HPを少しずつ回復する。',
  'Held: powers up super-effective attacks.': '持たせると 効果ばつぐんの技の威力が上がる。',
  'Held: powers up Fire-type attacks.': '持たせると ほのおタイプの技の威力が上がる。',
  'Held: powers up Water-type attacks.': '持たせると みずタイプの技の威力が上がる。',
  'Held: powers up Grass-type attacks.': '持たせると くさタイプの技の威力が上がる。',
  'Held: powers up Electric-type attacks.': '持たせると でんきタイプの技の威力が上がる。',

  // Extended move vocabulary (official names where applicable)
  'Absorb': 'すいとる', 'Aurora Beam': 'オーロラビーム', 'Bite': 'かみつく',
  'Bubblebeam': 'バブルこうせん', 'Bug Bite': 'むしくい', 'Bulldoze': 'じならし',
  'Calm Mind': 'めいそう', 'Confusion': 'ねんりき', 'Dragon Breath': 'りゅうのいぶき',
  'Dragon Claw': 'ドラゴンクロー', 'Draining Kiss': 'ドレインキッス', 'Fire Fang': 'ほのおのキバ',
  'Fairy Wind': 'ようせいのかぜ', 'Flame Burst': 'はじけるほのお', 'Foul Play': 'イカサマ',
  'Giga Drain': 'ギガドレイン', 'Growl': 'なきごえ', 'Headbutt': 'ずつき',
  'Hex': 'たたりめ', 'Hyper Voice': 'ハイパーボイス', 'Karate Chop': 'からてチョップ',
  'Leech Seed': 'やどりぎのタネ', 'Mega Drain': 'メガドレイン', 'Metal Claw': 'メタルクロー',
  'Mist': 'しろいきり', 'Peck': 'つつく', 'Poison Sting': 'どくばり', 'Pound': 'はたく',
  'Psybeam': 'サイケこうせん', 'Psyshock': 'サイコショック', 'Pursuit': 'おいうち',
  'Rock Throw': 'いわおとし', 'Rock Tomb': 'がんせきふうじ', 'Sand Attack': 'すなかけ',
  'Scratch': 'ひっかく', 'Screech': 'いやなおと', 'Shadow Sneak': 'かげうち',
  'Ominous Wind': 'あやしいかぜ', 'Shock Wave': 'でんげきは', 'Silver Wind': 'ぎんいろのかぜ',
  'Smokescreen': 'えんまく', 'Steel Wing': 'はがねのつばさ', 'Sucker Punch': 'ふいうち',
  'Supersonic': 'ちょうおんぱ', 'Surf': 'なみのり', 'Swift': 'スピードスター',
  'Swords Dance': 'つるぎのまい', 'Synthesis': 'こうごうせい', 'Twister': 'たつまき',
  'Venoshock': 'ベノムショック', 'Will-O-Wisp': 'おにび', 'Wing Attack': 'つばさでうつ',
  'X-Scissor': 'シザークロス', 'Hyper Beam': 'はかいこうせん', 'Leaf Blade': 'リーフブレード',
  'Poison Jab': 'どくづき', 'Earth Power': 'だいちのちから', 'Brave Bird': 'ブレイブバード',
  'Bug Buzz': 'むしのさざめき', 'Stone Edge': 'ストーンエッジ', 'Rock Slide': 'いわなだれ',
  'Shadow Claw': 'シャドークロー', 'Draco Meteor': 'りゅうせいぐん', 'Dark Pulse': 'あくのはどう',
  'Flash Cannon': 'ラスターカノン', 'Focus Blast': 'きあいだま', 'Wood Hammer': 'ウッドハンマー',
  'Dazzling Gleam': 'マジカルシャイン', 'Aurora Veil': 'オーロラベール',
  'Glacial Crush': 'グレイシャルクラッシュ', 'Grave Bloom': 'グレイブブルーム',
  'Monsoon Deluge': 'モンスーンデリュージ', 'Night Slash': 'つじぎり',
  'Outlaw Leafstorm': 'アウトローリーフストーム', 'Royal Kiln Roar': 'ロイヤルキルンロア',
  'Soul-Ferry Deluge': 'ソウルフェリーデリュージ',

  // World facilities and districts
  'Pokémon Nursery': 'ポケモン育て屋', 'Pokémon Center': 'ポケモンセンター',
  '🏥 Pokémon Center': '🏥 ポケモンセンター', '✚ Pokémon Center': '✚ ポケモンセンター',
  '✚ Center': '✚ センター', 'Poké Mart': 'フレンドリィショップ',
  '🛒 Poké Mart': '🛒 フレンドリィショップ', '🛒 Mart': '🛒 ショップ',
  '💻 PC': '💻 パソコン', 'Supply Hut': '物資小屋',
  "Prof. Song's Lab": 'ソン博士の研究所', "Professor Song's Lab": 'ソン博士の研究所',
  'Your Home': '自分の家', "Minhyuk's House": 'ミンヒョクの家', 'Town Hall': '町役場',
  'Central Park': '中央公園', 'Forest Path': '森の小道', '⛰ Cave Entrance': '⛰ 洞窟入口',
  '🕳 Cave Passage': '🕳 洞窟通路', '⛩ League Gate': '⛩ リーグゲート',
  '⛩ Rest Pavilion': '⛩ 休憩所', 'Artist\'s Studio': '画家のアトリエ',
  '🚲 Bicycle Shop': '🚲 サイクルショップ', '🏪 Convenience Store': '🏪 コンビニ',
  '🏪 CONVENIENCE STORE': '🏪 コンビニ', '🍢 Tteokbokki Stall': '🍢 トッポッキ屋台',
  'Capitol Tower': 'ソウルタワー', 'Ancient Palace': '古代宮殿', 'Central Market': '中央市場',
  'Royal Archives': '王立文書館', 'National Assembly Hall': 'オンヌリ国会議事堂',
  'Onnuri National Museum': 'オンヌリ国立博物館', 'State Shrine': '宗廟',
  'National Library': '国立図書館', 'So-ol Central Station': 'ソウル中央駅',
  "⛩ Scholars' Road": '⛩ 学者の道', 'Han River': '漢江', '🌉 Han River': '🌉 漢江',
  'Central Plaza': '中央広場', 'Grand Civic Plaza': '市民大広場',
  'Residential District': '住宅地区', 'Royal District': '王宮地区', 'Government Quarter': '官庁街',
  'Museum Promenade': '博物館通り', 'Memorial Gardens': '記念庭園', 'Cultural Ward': '文化地区',
  'Gym District': 'ジム地区', 'Commercial District': '商業地区', ' — Gym District': ' — ジム地区',
  ' — Tower Quarter': ' — タワー地区', ' — Commercial': ' — 商業地区',
  '🏙 Capitol City': '🏙 ソウルシティ', 'Capitol City': 'ソウルシティ',
  'Capitol City\n수도시': 'ソウルシティ', 'So-ol City\n소올 시티 · 온누리의 수도': 'ソウルシティ\nオンヌリの首都',
  '📖 Jeju Library': '📖 済州図書館', 'Jeju Library': '済州図書館', 'Jeju Market': '済州市場',
  '🏖️ Beach Pavilion': '🏖️ 海辺のあずまや', 'Beach Pavilion': '海辺のあずまや',
  '🍺 Harbor Tavern': '🍺 港の酒場', 'Harbor Tavern': '港の酒場', 'Vents Entrance': '噴気孔入口',
  'Cheonjiyeon Waterfall': '天地淵の滝', '💧 Cheonjiyeon Waterfall': '💧 天地淵の滝',
  'Haenyeo Hot Spring': '海女温泉', 'Hallasan Gardens': '漢拏山庭園',
  '🌉 Seonjukgyo': '🌉 善竹橋', '🗼 Lighthouse': '🗼 灯台', '🔭 Observatory': '🔭 展望台',
  '🐟 Fish Market': '🐟 魚市場', 'Fish Market': '魚市場', '🌳 Seaside Park': '🌳 海辺公園',
  '🌊 Harbour': '🌊 港', '⛴ West-Sea Barrage': '⛴ 西海防潮堤',
  '❄ Alpine Lodge': '❄ 高山ロッジ', '❄ ALPINE LODGE': '❄ 高山ロッジ',
  '♨ Snowmelt Baths': '♨ 雪解け温泉', '♨ SNOWMELT BATHS': '♨ 雪解け温泉',
  '🍡 Frost Market': '🍡 霜市場', '🍡 FROST MARKET': '🍡 霜市場',
  '⛸ Skate Shop': '⛸ スケートショップ', '⛸ SKATE SHOP': '⛸ スケートショップ',
  '⛸ SKATE LINK': '⛸ スケート連絡路', '♨ STEAM POOL': '♨ 温泉プール',
  '🍡 LOCAL GOODS': '🍡 特産品', '⛸ SKATE RENTAL': '⛸ スケート貸出', '🔥 WARM HEARTH': '🔥 暖炉',

  // Gyms and landmarks
  'CAPITOL GYM': 'ソウルジム', 'Capitol GYM': 'ソウルジム', '⛏ QUARRY GYM': '⛏ 採石場ジム',
  '🔔 FROSTBELL GYM': '🔔 フロストベルジム', 'Living Temple Gym': '生きた寺院ジム',
  'Lantern Stage Gym': '灯籠舞台ジム', 'Tidal Arena Gym': '潮流アリーナジム',
  'Sunrise Gym': 'サンライズジム', 'Contest Hall': 'コンテストホール',
  '🌿 LIVING TEMPLE': '🌿 生きた寺院', '🏮 LANTERN STAGE': '🏮 灯籠舞台',
  '🌊 TIDAL ARENA': '🌊 潮流アリーナ', '⚡ CLIFF OBSERVATORY': '⚡ 崖の展望台',
  '⛰ SUMMIT DOJO': '⛰ 山頂道場', "⛏ STONEMASON'S QUARRY": '⛏ 石工の採石場',
  'The Winter Bell': '冬の鐘', 'Ice Bell': '氷の鐘', 'Snow Guardian': '雪の守護者',
  'The Bedrock': '岩盤', 'Bedrock Badge': '岩盤バッジ', 'Seven Treasures': '七つの宝',
  'The Grand Obelisk': '大オベリスク', 'The Great Statue': '大石像', 'Triumphal Arch': '凱旋門',
  'The Palace': '宮殿', 'Ore Mine': '鉱山', '🏭 Gangcheoldo Steelworks': '🏭 カンチョルド製鉄所',
  '⛩ Forest Shrine': '⛩ 森のほこら', 'THE COMPLETE PANTHEON': '完全なる神々',
  '⛰ Songak Mountain': '⛰ 松岳山', '👑 Champion\'s Hall': '👑 チャンピオンの間',
  '👑 Hwangeum': '👑 ファングム', '👑 Taewang': '👑 テワン', "👑 Taewang's Throne": '👑 テワンの玉座',

  // Map directions and interaction hints
  '↓ Gangcheoldo': '↓ カンチョルド', '↑ Muyeonhang': '↑ ムヨンハン', '↓ Haesol': '↓ ヘソル',
  '↑ Gangcheoldo': '↑ カンチョルド', '↓ back down': '↓ 下へ', '↑ higher': '↑ 上へ',
  '↓ Haean City': '↓ ヘアンシティ', '↑ Forest City': '↑ フォレストシティ',
  '↓ Parangpo': '↓ パランポ', '↑ Haesol': '↑ ヘソル', '→ Dolmoe City': '→ トルメシティ',
  '↑ Seolbong City': '↑ ソルボンシティ', '↓ Geumgang City': '↓ クムガンシティ',
  '↑ Haean City': '↑ ヘアンシティ', '↓ Ancient Forest': '↓ 古代の森',
  '← Waterfall City': '← ウォーターフォールシティ', 'CAPITOL CITY →': 'ソウルシティ →',
  '↓ Route 2': '↓ 2番道路', '↓ Capitol City': '↓ ソウルシティ', "↓ Scholars' Road": '↓ 学者の道',
  '↓ Songhyeon': '↓ ソンヒョン', '↑ Parangpo': '↑ パランポ', '⬇ Jeju City': '⬇ 済州市',
  '⬆ Summit Trail': '⬆ 山頂への道', '↓ Binghagwan': '↓ ピンハグァン', '↑ Samho': '↑ サムホ',
  '↓ Samho': '↓ サムホ', '↓ Forest City': '↓ フォレストシティ', '↑ Dolmoe City': '↑ トルメシティ',
  '↑ Pokémon League': '↑ ポケモンリーグ', '↓ Border tunnels': '↓ 国境トンネル',
  '↓ Diamond Gorge': '↓ ダイヤモンド峡谷', '↓ Dolmoe City': '↓ トルメシティ',
  '↑ Seorae Pass': '↑ ソレ峠', '↓ Route 6': '↓ 6番道路', '↓ Seolbong City': '↓ ソルボンシティ',
  '↑ Geumgang City': '↑ クムガンシティ', '↓ Dolmoe Mine': '↓ トルメ鉱山',
  '↑ Seorae Town': '↑ ソレタウン', '↓ Muyeonhang': '↓ ムヨンハン', '↑ Binghagwan': '↑ ピンハグァン',
  '↑ Jeju City': '↑ 済州市', 'Route 6 →': '6番道路 →', '← Coastal Road': '← 海岸道路',
  'Ancient Forest →': '古代の森 →', '↓ Jeju Port': '↓ 済州港', '↓ Highland Pass': '↓ 高原峠',
  'Diamond Gorge →': 'ダイヤモンド峡谷 →', '↓ the gate': '↓ 門', '← Ancient Altar': '← 古代祭壇',
  '↓ back south': '↓ 南へ戻る', '↓ Northern Circuit': '↓ 北部巡回路', '⬇ back': '⬇ もどる',
  '⬇ Exit': '⬇ 出口', 'SPACE — Elevator': 'SPACE — エレベーター', 'SPACE — Talk': 'SPACE — はなす',
  'SPACE — Info': 'SPACE — しらべる', '🛗  ELEVATOR': '🛗  エレベーター',
  'WASD: move  SHIFT: run  C: bike  SPACE: talk  M: menu': 'WASD：移動  SHIFT：走る  C：自転車  SPACE：話す  M：メニュー',
  'WASD/Arrows: move  |  SHIFT: run  |  M: menu': 'WASD/方向キー：移動  |  SHIFT：走る  |  M：メニュー',

  // Bag/map/battle utility labels
  'Town Map': 'タウンマップ', 'Pokémon Encyclopedia': 'ポケモン図鑑', 'Gym Badges': 'ジムバッジ',
  'Running Shoes': 'ランニングシューズ', 'You are here': '現在地', '✈  FLY': '✈  そらをとぶ',
  '  FLY  ': '  そらをとぶ  ', ' CANCEL ': ' キャンセル ', '🔴 BAG': '🔴 バッグ',
  '💾 Saved': '💾 セーブ済み', '💾  Game Saved': '💾  セーブしました', '👟 RUNNING': '👟 ダッシュ',
  '● LIVE': '● ライブ', '⚡\nHEAL': '⚡\n回復', 'Potions\n💊': 'キズぐすり\n💊',
  'Berries\n🫐': 'きのみ\n🫐', 'TMs\n📀': 'わざマシン\n📀', 'Pokéballs\n🔴': 'モンスターボール\n🔴',
  '▶ SWITCH': '▶ いれかえる', '  STAY IN': '  そのまま',
  'Click a PARTY Pokémon, then a BOX Pokémon to swap them.':
    'てもちのポケモンを選び、次にボックスのポケモンを選ぶと入れ替えられます。',
  'Tap a Pokémon to make it your lead (first in battle).':
    'ポケモンをタップすると先頭（最初に戦うポケモン）にできます。',
  'Browse every Pokémon you have seen and caught.': '見つけたポケモンや捕まえたポケモンを確認できます。',
  'Use which item?': 'どの道具を使いますか？', 'No usable items. Buy some at a Poké Mart!':
    '使える道具がありません。フレンドリィショップで買いましょう！',
  'Revive which Pokémon?': 'どのポケモンを元気にしますか？',
  'Use on which Pokémon?': 'どのポケモンに使いますか？', 'Will you switch?': '入れ替えますか？',
  '↔  Swap a Pokémon': '↔  ポケモンを入れ替える', 'Send which Pokémon to the PC?': 'どのポケモンをボックスへ送りますか？',

  // Core battle outcomes, move learning, healing, and badges
  "It's super effective!": '効果は バツグンだ！', "It's not very effective...": '効果は いまひとつのようだ……',
  'It had no effect...': '効果が ないようだ……', "You're out of Pokémon!": '戦えるポケモンが いない！',
  "You're out of Pokémon! Better luck next time.": '戦えるポケモンが いない！ 次は がんばろう。',
  'which move to forget?': 'どのわざを 忘れさせますか？', 'Which move should it forget?': 'どのわざを 忘れさせますか？',
  '...Your body feels refreshed!\nAll your Pokémon have been healed! ✨':
    '……体が すっきりした！\nポケモンは みんな元気になった！ ✨',
  'Heal your Pokémon here': 'ここで ポケモンを回復できます', 'Buy supplies and items': '道具を 購入できます',
  'Shadow Court Badge (Capitol)': 'シャドーコートバッジ（ソウル）',
  'Summit Dojo Badge (Baekdu)': 'サミット道場バッジ（白頭）',
  'Lantern Stage Badge (Geumgang)': '灯籠舞台バッジ（クムガン）',
  'Tidal Arena Badge (Haean)': '潮流アリーナバッジ（ヘアン）',
  'Ancient Keeper Badge (Forest)': '古代守護者バッジ（森）',
  'Bedrock Badge (Dolmoe)': '岩盤バッジ（トルメ）',
  'Frostbell Badge (Seorae)': 'フロストベルバッジ（ソレ）',
  'Stormwatcher Badge (Sunrise)': 'ストームウォッチャーバッジ（サンライズ）',

  // Early-game rival and starter journey
  "Let's battle!": '勝負だ！', 'We battle. Right here, right now!': 'ここで 今すぐ 勝負だ！',
  "Oh, it's you. You finally got started?": 'なんだ きみか。やっと旅を始めたの？',
  "I've been training every day.\nDon't expect it to be easy.":
    '毎日ずっと 特訓してきた。\n簡単に勝てると 思わないで。',
  'My Pokémon will be the strongest.\nCount on it.': 'ぼくのポケモンが いちばん強くなる。\n見ててよ。',
  'Still here? Go train.': 'まだいるの？ 特訓してきなよ。',
  "When we battle, I won't hold back.": '勝負するときは 手加減しないから。',
  'I heard you battled near the waterfall.': '滝の近くで バトルしたんだって？',
  "Don't get overconfident.": '調子に乗らないでよ。',
  '...What? Stop staring at my trophies.': '……なに？ ぼくのトロフィーを じろじろ見ないで。',
  'Go get your own.': '自分のを 取りにいけば。',
  'No items in a fair fight!': '正々堂々の勝負に 道具はなしだ！',
  'Hey! Stop right there.': 'おい！ そこで止まれ。',
  'A worthy challenger.': '見事な挑戦者だ。', 'You battled well…': 'いい勝負だった……',
  'The Sunrise Gym is the LAST one. Take this leader down and the League is within reach.':
    'サンライズジムが 最後だ。このリーダーを倒せば リーグはもう目の前だよ。',
  'Eight badges — you did it. The Onnuri League is waiting; the Scholars\' Road opens from the Capitol now.':
    'バッジが8個――やったね。オンヌリリーグが待っている。首都から 学者の道へ進めるようになったよ。',
  'Take the leader down, then it\'s straight on to the Onnuri League.':
    'リーダーを倒したら そのままオンヌリリーグへ向かおう。',
  "Baekdu Peak? That's a story for after we've earned the title. Let's go become Champions first.":
    '白頭峰の話は チャンピオンになってからだ。まずは 頂点を取りにいこう。',
  'To the League, then. 나비할망 will make sure we get there in one piece.':
    'それじゃ リーグへ行こう。ナビハルマンが きっと無事に届けてくれる。',

  // Intro town, first route, and essential interaction copy
  'Welcome to the world of Pokémon!': 'ポケモンの世界へ ようこそ！',
  '🏥  POKÉMON CENTER  🏥': '🏥  ポケモンセンター  🏥', '🏪  POKÉ MART  🏪': '🏪  フレンドリィショップ  🏪',
  'POKéMON': 'ポケモン', '🌟  POKÉMON  KOREA  🌟': '🌟  ポケモン・コリア  🌟',
  'Prof. Song\'s Pokémon Lab': 'ソン博士のポケモン研究所',
  'SPACE — Enter the Pokémon Center': 'SPACE — ポケモンセンターに入る',
  'SPACE — Enter the Poké Mart': 'SPACE — フレンドリィショップに入る',
  'SPACE — Shop (Poké Mart)': 'SPACE — 買い物（ショップ）',
  'SPACE — Scholars\' Road → Pokémon League': 'SPACE — 学者の道 → ポケモンリーグ',
  'SPACE — Enter the Pokémon League': 'SPACE — ポケモンリーグに入る',
  'SPACE — Enter the Northern League': 'SPACE — 北部リーグに入る',
  'SPACE — Enter the Forest Shrine': 'SPACE — 森のほこらに入る',
  'SPACE — Enter the Frostbell Gym': 'SPACE — フロストベルジムに入る',
  'SPACE — Rest & heal your team': 'SPACE — 休んでポケモンを回復',
  'SPACE — Heal your team (Pokémon Center)': 'SPACE — ポケモンを回復（ポケモンセンター）',
  '⬆ THE POKÉMON LEAGUE': '⬆ ポケモンリーグ', '🏯 The Pokémon League': '🏯 ポケモンリーグ',
  '🏟️ Sunrise Gym — 8th Badge': '🏟️ サンライズジム — 8個目のバッジ',
  '🏡 Pine Needle Town (솔잎 마을)': '🏡 松葉タウン', '↓ Pine Needle Town': '↓ 松葉タウン',
  '🗺 Route 1 — Mountain Pass': '🗺 1番道路 — 山道', '↑ Pine Needle Town': '↑ 松葉タウン',
  '🏞️ Route 3 — Diamond Gorge (금강 협곡)': '🏞️ 3番道路 — ダイヤモンド峡谷',
  '🌊 Route 4 — Coastal Cliffside Road (해안 절벽길)': '🌊 4番道路 — 海岸断崖道路',
  '🌳 Route 5 — The Ancient Forest (고목 숲길)': '🌳 5番道路 — 古代の森',
  '🏝️ Jeju City — Island Heart': '🏝️ 済州市 — 島の中心', '↑ Disembark — Jeju City': '↑ 下船 — 済州市',
  '⬇ Return to Jeju City': '⬇ 済州市へ戻る', '↓ Disembark — Haean City': '↓ 下船 — ヘアンシティ',
  '↑ Disembark — Jeju Vents': '↑ 下船 — 済州噴気孔', '↑ Route 6 · Dolmoe City': '↑ 6番道路・トルメシティ',
  '↓ Eastern Shore Road': '↓ 東海岸道路', 'Center & Rescue Station': 'センター＆救助所',
  'Pokémon Center & Gallery': 'ポケモンセンター＆ギャラリー',
  '↑ Baekdu Peak — the climb': '↑ 白頭峰 — 登山道', '🏔 Baekdu Peak — The Final Confrontation': '🏔 白頭峰 — 最終決戦',
  '⛓ Seolbong Pass — The Garrison Gate': '⛓ ソルボン峠 — 守備隊の門',
  '↓ Ancient Altar (Onseong)': '↓ 古代祭壇（オンソン）', '⛰ Out of the woods → Sacred Peak': '⛰ 森を抜ける → 聖なる峰',
  '↑ Seolbong Highland Pass': '↑ ソルボン高原峠', '↓ Seorae Pass · Dolmoe': '↓ ソレ峠・トルメ',
  '⛸ Skate Link → Sunrise City': '⛸ スケート連絡路 → サンライズシティ',
  '← LEADER BYEOKSAN →': '← ジムリーダー ビョクサン →', '← LEADER SANDOL →': '← ジムリーダー サンドル →',
  '← LEADER NAMSUN →': '← ジムリーダー ナムスン →', '← LEADER HARANG →': '← ジムリーダー ハラン →',
  '← LEADER BEONGE →': '← ジムリーダー ボンゲ →', '← LEADER YEONA →': '← ジムリーダー ヨナ →',
  '← KEEPER NOKSAEK →': '← 守護者 ノクセク →',
  '✈  ARROWS: choose city   ·   ENTER/SPACE or click: Fly   ·   ESC/M: close':
    '✈  方向キー：街を選ぶ   ·   ENTER/SPACE またはクリック：飛ぶ   ·   ESC/M：閉じる',
  'Beat the Pokémon League to earn HM Fly and travel the region instantly.   ·   ESC/M: close':
    'ポケモンリーグを制覇して「そらをとぶ」を手に入れると、地方をすぐに移動できます。   ·   ESC/M：閉じる',
  '✈ You received HM01 FLY!  Use it from your Bag to teach Fly to a Flying-type — if its moves are full, you choose which to forget.':
    '✈ HM01「そらをとぶ」を手に入れた！ バッグからひこうタイプに覚えさせよう。わざが4つなら 忘れさせるわざを選べる。',

  // Character selection and starter screen
  'PROF. SONG': 'ソン博士', 'Who are you?': 'きみは どちら？',
  'Choose your character. Your rival will be the opposite.':
    '主人公を選んでください。ライバルは もう一方の主人公になります。',
  'Boy': '男の子', 'Girl': '女の子', 'Rival: a girl': 'ライバル：女の子', 'Rival: a boy': 'ライバル：男の子',
  '← →  choose      SPACE / click  confirm': '← →  選ぶ      SPACE / クリック  決定',
  'Tap a Poké Ball, then tap again to choose': 'モンスターボールをタップし、もう一度タップすると決定',
  '◀ ▶ to browse     SPACE / ENTER to choose': '◀ ▶ 選ぶ     SPACE / ENTER 決定',

  // Route 1 tutorial and first trainers
  '← walk in the grass to find them': '← 草むらを歩くと 見つかります',
  'WASD: move  SPACE: enter/talk  M: menu': 'WASD：移動  SPACE：入る/話す  M：メニュー',
  'Kisun: Hey! You must be heading to Capitol City for the first time!':
    'キスン: やあ！ 初めてソウルシティへ向かうんだね！',
  'Kisun: These mountains are full of wild Pokémon. You will need these!':
    'キスン: この山には 野生のポケモンがたくさんいるよ。これが必要になるはず！',
  'Kisun: I am giving you 20 Pokéballs. Use them to catch Pokémon on the route!':
    'キスン: モンスターボールを20個あげる。道中のポケモンを捕まえてみて！',
  'Kisun: Press A in battle to throw a ball. Good luck, trainer! 🔴':
    'キスン: バトル中にAを押すと ボールを投げられるよ。がんばって、トレーナー！ 🔴',
  'Hey, I spotted you! You look like a trainer!': '見つけた！ きみ、トレーナーだね！',
  'Show me the road\'s lesson!': 'この道で学んだことを 見せてみろ！',

  // Pine Needle Town chapter
  'You arrived at Pine Needle Town (솔잎 마을).': '松葉タウンに 到着した。',
  'A quiet artisan village famous for ink painting and hanji paper-making.':
    '水墨画と韓紙づくりで知られる 静かな職人の村だ。',
  'Paper lanterns sway between the houses. The air smells of pine and ink.':
    '家々の間で 紙提灯が揺れている。松と墨の香りが 漂っている。',
  "Rival: Finally. I've been here an hour. Try this — the lady makes it with a doenjang base. Incredible.":
    'ライバル: やっと来た。もう1時間も待ったよ。これ食べてみて――このおばさんの味噌だれ、最高なんだ。',
  "Rival: Anyway. Some group has been up in the highland caves to the north — they keep locals away, call it 'research.'":
    'ライバル: それより 北の高原洞窟に 妙な集団がいる。地元の人を追い返して「研究」だと言ってるんだ。',
  "Rival: Research with that many people and that much equipment doesn't look like research to me.":
    'ライバル: あれだけの人数と機材を持ち込んでるんだ。ぼくには研究には見えない。',
  'Rival: Professor Song sent me a message too. Something about Pokémon behaving strangely near Baekdu Peak.':
    'ライバル: ソン博士から ぼくにも連絡が来た。白頭峰の近くで ポケモンの様子がおかしいらしい。',
  'Rival: We should check it out after the next gym. Seolbong City — north through the highland pass.':
    'ライバル: 次のジムを終えたら 調べに行こう。高原峠を北へ進んだ ソルボンシティだ。',
  'Rival: Oh — there\'s an artist near the studio looking for her lost Smeargle. You should help her. (Side quest!)':
    'ライバル: そうだ――アトリエの近くで 画家が迷子のドーブルを探してる。助けてあげなよ。（サブクエスト！）',
  'The path north climbs steeply into snow and cloud.': '北への道は 雪と雲の中へ 急に登っている。',
  "You don't know the way yet — better find a guide or a map first.":
    'まだ道が分からない――先に案内人か地図を 探したほうがよさそうだ。',
  'Prof. Song: One more thing — take this Exp. Share.\nWhile it\'s ON, every Pokémon in your party gains EXP from battle,\neven benched ones. Open your BAG anytime to switch it on or off.':
    'ソン博士: もうひとつ――この「がくしゅうそうち」も 持っていきなさい。\nオンにしていると バトルに出なかったポケモンも含め、\nてもち全員が経験値をもらえる。バッグから いつでも切り替えられるよ。',

  // Onnuri League and Champion Hwangeum story arc
  "The Sunrise Gym's right there in the plaza — the last badge before the League.":
    'サンライズジムは 広場のすぐそこだ――リーグ前 最後のバッジだよ。',
  'The Onnuri Pokémon League rises before you — a great palace hall in the old style, its tiered roofs sweeping skyward, eaves bright with dancheong, vermilion pillars catching the light.':
    'オンヌリポケモンリーグが 目の前にそびえている。空へ反り上がる重層の屋根、鮮やかな丹青の軒、光を受ける朱塗りの柱――古式の大宮殿だ。',
  'Receptionist: Welcome, challenger, to the Onnuri Pokémon League.':
    '受付: ようこそ 挑戦者。オンヌリポケモンリーグへ。',
  'Receptionist: Beyond these doors wait the Elite Four — Gyeoul, Hwageum, Baram, and Saleum — and then the Champion, Hwangeum.':
    '受付: この扉の先には 四天王――キョウル、ファグム、バラム、サルム――そして チャンピオンのファングムが待っています。',
  'Receptionist: Heal here, steady yourself, and walk through. Hwangeum is waiting at the throne.':
    '受付: ここで回復し、心を整えて進んでください。ファングムが 玉座で待っています。',
  'Nurse: Welcome to the League Pokémon Center.': '看護師: リーグのポケモンセンターへ ようこそ。',
  'The Onnuri Pokémon League. Four masters guard the road to the Champion, each in their own hall.':
    'オンヌリポケモンリーグ。4人の達人が それぞれの間で チャンピオンへの道を守っている。',
  'The League is a single trial — best all four masters again, in one unbroken run, to reach the Champion.':
    'リーグは 一度きりの連戦だ。4人の達人を続けて倒し、チャンピオンのもとへ進め。',
  'You were defeated. The League tower returns to its first floor and the stairways seal once more.':
    '敗北した。リーグ塔は1階へ戻り、階段は再び封印された。',
  'The League is a single ascent — best all four masters again, in one unbroken run, to reach the Champion.':
    'リーグは 一度きりの登頂だ。4人の達人を続けて倒し、チャンピオンのもとへ進め。',
  'Hwangeum: So the Champion who dethroned me climbs back to my stage. I have waited for this rematch.':
    'ファングム: 私を王座から下ろしたチャンピオンが またこの舞台へ来たか。この再戦を待っていた。',
  'Hwangeum: How long has it been since anyone pushed me this far!':
    'ファングム: ここまで追い詰められたのは いったい何年ぶりだ！',
  'Hwangeum: ...Beaten again — and by a wider margin than before. Of course. You truly are the Champion of the south.':
    'ファングム: ……また負けた。それも前より大きな差で。さすがだ。きみこそ 真の南部チャンピオンだ。',
  'Hwangeum: Every one of us climbed back stronger to challenge you, and still you stand above us all.':
    'ファングム: 私たちは全員 さらに強くなって挑んだ。それでも きみは私たちの上に立っている。',
  'Hwangeum kneels to his fallen ace first — always his Pokémon first — then stands.':
    'ファングムは まず倒れたエースに膝をつく――いつでも ポケモンが最優先だ――そして立ち上がる。',
  'Hwangeum (extending his hand): Welcome to the Hall of Fame. You earned every step of it.':
    'ファングム（手を差し出して）: 殿堂入りへ ようこそ。ここまでの一歩一歩を きみは自分で勝ち取った。',
  'Hwangeum: The registration room is through here. Walk in with me — your team should hear their own names read out.':
    'ファングム: 登録室は この先だ。一緒に行こう――きみの仲間たちにも 自分の名前が呼ばれる瞬間を聞かせてやろう。',
  'Hwangeum: Come. The register is waiting, same as always.':
    'ファングム: 来たまえ。いつも通り 記録装置が待っている。',
  'Hwangeum: This is the recorder. Set your team on it — all six.':
    'ファングム: これが記録装置だ。6匹すべてのボールを ここへ置くんだ。',
  'Hwangeum: It reads them itself. Names, levels, everything they became with you.':
    'ファングム: 名前もレベルも、きみと共に築いたすべてを 装置が読み取ってくれる。',
  'Hwangeum: You know the drill. Six balls, six sockets.':
    'ファングム: やり方は分かるな。6つのボールを 6つの台座へ。',
  'The recorder hums, and one by one your Pokémon are entered into the register of the Onnuri League.':
    '記録装置が低く響き、ポケモンたちは1匹ずつ オンヌリリーグの記録に刻まれていく。',
  'Your Pokémon have been fully restored. You will now return to the Pokémon League entrance.':
    'ポケモンは すべて元気になった。ポケモンリーグ入口へ戻ります。',
  'Reporter: From Baekdu Peak to the throne of the League — the trainer who healed the land now wears the crown. What a day for the region!':
    '記者: 白頭峰からリーグの王座へ――大地を癒やしたトレーナーが 今、頂点に立ちました。地方にとって歴史的な一日です！',
  'The great doors of the Pokémon League swing open. You step through.':
    'ポケモンリーグの大扉が開く。きみは その先へ足を踏み入れた。',
  'In old Onnuri, scholars walked this road TO the capital to sit the royal exam. Today, trainers walk it OUT, to sit the highest exam of all — the Pokémon League.':
    '昔のオンヌリでは 学者が科挙を受けるため この道を都へ歩いた。今はトレーナーが逆向きに歩き、最高の試練――ポケモンリーグへ向かう。',
  'Rest at the pavilion midway (SPACE) to heal. The League waits at the summit.':
    '途中のあずまやで休めば（SPACE）回復できる。リーグは山頂で待っている。',
  'Your Rival leans against the final gate, arms crossed — exactly the way they did outside their house on the first morning.':
    '最後の門に ライバルが腕を組んでもたれている――旅立ちの朝、家の前で待っていた時と まったく同じ姿だ。',
  'Rival: We started this whole thing racing each other to Capitol City. And now here we are — same city behind us, the very top of the region in front of us.':
    'ライバル: ソウルシティまで競争したところから 全部が始まった。そして今、同じ街を背にして 地方の頂点を目の前にしてる。',
  'Rival: Go on. The Four are waiting — and so is HE, at the very top.':
    'ライバル: 行って。四天王が待ってる――そして いちばん上には あの人も。',
  'Rival: Whatever happens in there... you already proved everything you needed to prove. To me, anyway. Now go win it.':
    'ライバル: この先で何が起きても……きみは もう証明すべきことを全部証明した。少なくとも ぼくにはね。さあ 勝ってきて。',
  '— The credits roll over a montage of the Onnuri League arc — Capitol City, the Diamond Gorge, the tidal coasts, the ancient forest, the Jeju vents, the Jeju Summit —':
    '――ソウルシティ、ダイヤモンド峡谷、潮の海岸、古代の森、済州噴気孔、済州山頂――オンヌリリーグへの旅を映しながら スタッフロールが流れる。',
  'At the bottom of the League steps, your Rival is waiting — because of course they are.':
    'リーグの階段の下では ライバルが待っている――もちろん、そうでなくちゃ。',
  'Phase 1: Onnuri League — COMPLETE ✓': '第1部：オンヌリリーグ — クリア ✓',
  'Phase 2: Northern League — UNLOCKED': '第2部：北部リーグ — 解放',

  // Northern League transition and late Champion presence
  'The Northern League rises before you — a colossal grey-granite palace, severe and symmetrical, banked with red banners under a single gold star. Trainers from a dozen regions cross the forecourt.':
    '北部リーグが 目の前にそびえる。灰色の花崗岩で築かれた巨大な宮殿は厳格で左右対称。ひとつの金星の下に赤い旗が並び、各地のトレーナーが前庭を行き交う。',
  'League Warden: Eight southern badges first, southerner. Come back a Champion.':
    'リーグ門番: まず南部のバッジを8個集めろ。チャンピオンになって戻ってこい。',
  'League Warden: The Northern League awaits you, Champion. Prove yourself worthy of the title.':
    'リーグ門番: 北部リーグが待っている、チャンピオン。その称号にふさわしい力を示せ。',
  'Nurse: Welcome to the Northern League Pokémon Center.': '看護師: 北部リーグのポケモンセンターへ ようこそ。',
  'Champion Hwangeum: ...You actually did it. You beat Taewang. Three years I carried that loss — you lifted it clean off me. Thank you.':
    'チャンピオン・ファングム: ……本当にやったんだな。テワンを倒した。私は3年間 あの敗北を背負ってきた――きみが きれいに取り去ってくれた。ありがとう。',
  'Professor Song: Two leagues, north and south. There has never been a trainer like you in all of Onnuri\'s history.':
    'ソン博士: 南北ふたつのリーグ。オンヌリの歴史に きみのようなトレーナーは一人もいなかった。',
  'Rival: I always said I\'d catch up to you someday. ...Yeah, I\'m nowhere close. And honestly? I have never been prouder to lose.':
    'ライバル: いつか追いつくって ずっと言ってた。……うん、まだ全然届かない。でも正直、負けたことを こんなに誇らしく思ったのは初めてだ。',
  'Hwangeum: For one night — no titles, no battles. Just us and the region we love. Eat. Dance. You earned this.':
    'ファングム: 今夜だけは 称号もバトルもなしだ。私たちと 愛するこの地方だけ。食べて、踊ろう。きみには その資格がある。',
  'Rival: Come on, Champion — one last race. First to the fountain! ...For old times\' sake.':
    'ライバル: ほら、チャンピオン――最後にもう一度競争だ。噴水まで先に着いたほうが勝ち！ ……昔みたいに。',

  // Professor Song, home, and the main post-game thread
  'Mom: Professor Song called earlier. Her lab is up in the north-east of town, right next to the Pokémon Center.':
    'ママ: さっきソン博士から電話があったわ。研究所は町の北東、ポケモンセンターのすぐ隣よ。',
  'Mom: Now go see Professor Song — north-east of town, right beside the Pokémon Center! 💕':
    'ママ: さあ ソン博士に会ってらっしゃい。町の北東、ポケモンセンターのすぐ隣よ！ 💕',
  'Mom: Professor Song is waiting at the lab, honey!': 'ママ: ソン博士が研究所で待っているわよ！',
  'Prof. Song: Ah, there you are! I have three Pokémon here, and each is hoping to find a trainer.':
    'ソン博士: ああ 来たね！ ここに3匹のポケモンがいる。みんな トレーナーとの出会いを待っているんだ。',
  'Prof. Song: Go on — take a good look at all three, and choose the one who calls to you.':
    'ソン博士: さあ――3匹をよく見て 心ひかれる1匹を選びなさい。',
  'Prof. Song: Your journey is out there, not in my lab. Head south when you\'re ready!':
    'ソン博士: きみの旅は研究所の中ではなく 外にある。準備ができたら南へ向かいなさい！',
  'Your Pokédex buzzes — it\'s Professor Song.': 'ポケモン図鑑が鳴った――ソン博士からだ。',
  '📟 Your Pokédex buzzes — Professor Song.': '📟 ポケモン図鑑が鳴った――ソン博士だ。',
  '📟 Your Pokédex buzzes — Professor Song, urgent.': '📟 ポケモン図鑑が激しく鳴る――ソン博士からの緊急連絡だ。',
  'Your Pokédex chirps — Professor Song checking in.': 'ポケモン図鑑が鳴る――ソン博士からの定時連絡だ。',
  'Prof. Song: You earned the Tidekeeper Badge — well done. But drop everything and come back to Sudo City.':
    'ソン博士: タイドキーパーバッジを取ったんだね――よくやった。だが今は 何もかも置いてスドシティへ戻ってきて。',
  'Prof. Song: The Ancient Keeper Badge — your fifth. Well done. But drop everything and come back to 소올 (So-ol).':
    'ソン博士: 古代守護者バッジ――5個目だね。よくやった。だが今は 何もかも置いてソウルへ戻ってきて。',
  'Prof. Song: I\'ve pieced together what Team Suri and 노스단 are really after. You need to hear this in person.':
    'ソン博士: スリ団とノス団が 本当に狙っているものが分かった。これは直接 話さなければならない。',
  'Prof. Song: Heal your team at the Pokémon Center first, then come to my lab — you\'ll want to be at full strength.':
    'ソン博士: まずポケモンセンターで回復してから 研究所へ来なさい。万全の準備が必要になる。',
  'Rival: I\'ll meet you at the lab. Let\'s move.': 'ライバル: 研究所で会おう。急ごう。',
  'You hurry across 소올 to Professor Song\'s lab.': 'きみはソウルを駆け抜け、ソン博士の研究所へ急いだ。',
  'Prof. Song: Team Suri is unknowingly doing 노스단\'s work for them.':
    'ソン博士: スリ団は 知らないうちにノス団の計画を手伝っている。',
  'Prof. Song: 나비할망 — the Grandmother Moth. Fairy/Steel. She sleeps near the Jeju volcanic vents.':
    'ソン博士: ナビハルマン――大いなる蛾の祖母。フェアリー／はがねタイプ。済州の火山噴気孔の近くで眠っている。',
  'Prof. Song: Her metallic wings can ABSORB and neutralize enormous energy. 노스단 knows this.':
    'ソン博士: 彼女の金属の翼は 莫大なエネルギーを吸収し中和できる。ノス団も それを知っている。',
  'Prof. Song: It\'s begun. 노스단 has moved on 나비할망 at the Jeju vents — RIGHT NOW. Your Frostbell Badge says you\'re finally ready for this.':
    'ソン博士: 始まった。ノス団が 今まさに済州噴気孔のナビハルマンへ動いた。フロストベルバッジを得たきみなら もう立ち向かえる。',
  'Prof. Song (comms): You made it across! 노스단\'s barge hit the same storm, so their head start is gone.':
    'ソン博士（通信）: 渡り切ったんだね！ ノス団のはしけも同じ嵐に遭った。先行したぶんは もう消えた。',
  'Prof. Song: 나비할망 sleeps at the summit. Rest and stock up here, then climb. Run — they\'re already on the mountain.':
    'ソン博士: ナビハルマンは山頂で眠っている。ここで休み 道具を整えてから登りなさい。急いで――敵はもう山にいる。',
  'Prof. Song: Your Master Ball — this is the moment Dosik meant. Weaken her first, then throw it.':
    'ソン博士: マスターボール――ドシクが言っていたのは この時だ。まず力を弱めてから投げなさい。',
  'Prof. Song: You have to SURVIVE. Hold out — keep your team alive — until the moment is right. Then release her.':
    'ソン博士: 生き延びるんだ。仲間を守って耐え、時が来るまで待つ。その瞬間に 彼女を解き放ちなさい。',
  'Professor Song hurries across the plaza to meet you as you return home, Champion.':
    '故郷へ戻ったきみを迎えるため、ソン博士が広場を急いで駆けてくる。',
  'Professor Song: The whole region saw it. You did what no one else could — and you never once stopped putting your Pokémon first.':
    'ソン博士: 地方中が見ていたよ。誰にもできなかったことを成し遂げ、それでも最後まで ポケモンを第一に考え続けた。',
  'Prof. Song: Come home, Champion. All of Sudo City is waiting to celebrate you one last time.':
    'ソン博士: 帰っておいで、チャンピオン。スドシティのみんなが 最後のお祝いをするため待っている。',
  'Professor Song: There\'s one road left to walk. The Onnuri Pokémon League sits beyond the mountains — and Scholars\' Road begins right here, behind the palace where your journey started.':
    'ソン博士: 残る道は ひとつ。山の向こうにオンヌリポケモンリーグがある。学者の道は 旅が始まった宮殿の裏から続いている。',
  'Professor Song: The HM stays in your Bag — teach Fly to any Flying-type. Then open the Town Map, pick a city you\'ve visited, and Fly straight there.':
    'ソン博士: ひでんマシンはバッグに残る。ひこうタイプに「そらをとぶ」を覚えさせ、タウンマップで訪れた街を選べば すぐに飛んでいける。',
  'Professor Song: And there\'s something else. Word from beyond the northern border — the Northern League, and the eight 어사대 provinces that guard the road to it. They\'ve heard of you.':
    'ソン博士: もうひとつある。北の国境の向こう、北部リーグと そこへ続く道を守る8つの王室監察領から知らせが来た。彼らも きみのことを知っている。',
  'Professor Song: They say a coach runs from Waterfall City now, all the way up to Songhyeon — first of the eight. If you mean to go north, that bus is how you\'ll get there. Go — see the region you saved, and the one beyond it.':
    'ソン博士: ウォーターフォールシティから 8領の最初ソンヒョンまで長距離バスが出ているそうだ。北へ行くなら それに乗りなさい。きみが救った地方と、その先を見ておいで。',
  'Prof. Song: Something is stirring in the sealed northern reaches. 노스단 is moving again — and this time they reach for something far older than the Spirit of Cheonji.':
    'ソン博士: 封鎖された北方で 何かが動き始めている。ノス団が再び動いた――今度の狙いは 天池の精霊より はるかに古い存在だ。',
  'Prof. Song: If 노스단 captures Hwanung, they command the very force that shaped the region — north and south, in a single stroke.':
    'ソン博士: ノス団がファヌンを捕らえれば、この地方を形作った力そのものを支配する。南も北も 一撃でだ。',
  'Prof. Song: But the Sovereign only descends for one who has gathered his three attendants — 풍백 the Wind, 우사 the Rain, 운사 the Clouds. Find and catch them before 노스단 does.':
    'ソン博士: だが君主が降臨するのは 3人の従者――風のプンベク、雨のウサ、雲のウンサ――を集めた者の前だけだ。ノス団より先に見つけて 捕まえなさい。',
  'Prof. Song: Whatever legend they tell of this region a thousand years from now, it starts with you. Thank you, Champion.':
    'ソン博士: 千年後、この地方にどんな伝説が語られていても その始まりはきみだ。ありがとう、チャンピオン。',
  'Prof. Song: 노스단 is finished. 환웅, 풍백, 우사, 운사, 나비할망 — the entire pantheon, at peace and in your care.':
    'ソン博士: ノス団は終わった。ファヌン、プンベク、ウサ、ウンサ、ナビハルマン――すべての神々が平穏を取り戻し、きみを信じている。',

  // Items, storage, nursery, and remaining high-frequency gameplay copy
  'Paralyze Heal': 'まひなおし', 'Burn Heal': 'やけどなおし', 'Ice Heal': 'こおりなおし',
  'Awakening': 'ねむけざまし', 'Antidote': 'どくけし', 'Ether': 'ピーピーエイド',
  'Max Ether': 'ピーピーリカバー', 'Elixir': 'ピーピーエイダー', 'Max Elixir': 'ピーピーマックス',
  'Max Revive': 'げんきのかたまり', 'Fresh Water': 'おいしいみず', 'Moomoo Milk': 'モーモーミルク',
  'Restores 20 HP.': 'HPを20回復する。', 'Restores 60 HP.': 'HPを60回復する。',
  'Restores 120 HP.': 'HPを120回復する。', 'Fully restores HP.': 'HPをすべて回復する。',
  'Revives a fainted Pokémon to half HP.': 'ひんしのポケモンを HP半分で元気にする。',
  'Revives a fainted Pokémon to full HP.': 'ひんしのポケモンを HP満タンで元気にする。',
  'Thaws a frozen Pokémon.': 'こおり状態を治す。', 'Wakes a sleeping Pokémon.': 'ねむり状態を治す。',
  "Restores 20 PP to each of a Pokémon's moves.": 'ポケモンのすべてのわざのPPを20ずつ回復する。',
  "Fully restores the PP of all of a Pokémon's moves.": 'ポケモンのすべてのわざのPPを完全に回復する。',
  'Teach Fly to a Flying-type Pokémon. Reusable.': 'ひこうタイプのポケモンに「そらをとぶ」を覚えさせる。何度でも使える。',
  'Shares battle EXP with every Pokémon in your party, even benched ones.':
    'バトルに出ていないポケモンも含め、てもち全員で経験値を分け合う。',
  'Mountain spring water. Restores 30 HP.': '山の湧き水。HPを30回復する。',
  'Rich, nourishing milk. Restores 120 HP.': '栄養たっぷりのミルク。HPを120回復する。',
  'Choose an item!': '道具を選んでください！', 'Box is empty.': 'ボックスは空です。',
  'Moved to box.': 'ボックスへ移動しました。', 'Moved to party.': 'てもちへ移動しました。',
  'What? The Egg is beginning to move!': 'おや？ タマゴが動き始めた！',
  'It joined your party!': 'てもちに加わった！', 'It was sent to the PC Box.': 'ボックスへ送られた。',
  'All your Pokémon fainted!': 'ポケモンが みんな倒れてしまった！',
  'No Pokémon are available.': '選べるポケモンがいません。',
  'Two compatible Pokémon can produce an Egg as you walk.':
    '相性のよい2匹を預けて歩くと タマゴが見つかることがあります。',
  'Leave two compatible Pokémon with us and they may produce an Egg.':
    '相性のよい2匹を預けると タマゴが見つかるかもしれません。',
  'Summit Seal Badge': 'サミットシールバッジ', 'Lantern Stage Badge': '灯籠舞台バッジ',
  'Tidekeeper Badge': 'タイドキーパーバッジ', 'Ancient Keeper Badge': '古代守護者バッジ',
  'Frostbell Badge': 'フロストベルバッジ', 'Stormwatcher Badge': 'ストームウォッチャーバッジ',
  '🏛 Onnuri Pokémon League': '🏛 オンヌリポケモンリーグ',
  'Defeat one to unseal the way to the next. Each hall has a healing machine, so your team is restored to full before every match.':
    'ひとり倒すごとに 次の間への封印が解ける。各部屋に回復装置があり、試合前にてもち全員が回復する。',
  'Heal at the Center, stock up at the Mart, then approach the great doors when you are ready.':
    'センターで回復し、ショップで道具を整え、準備ができたら大扉へ進もう。',
  'WASD move  SPACE enter/exam  C bike  M menu': 'WASD：移動  SPACE：入る/試験  C：自転車  M：メニュー',
  'Arrows / WASD: move   ·   SPACE: exit': '方向キー / WASD：移動   ·   SPACE：出る',
  'WASD/Arrows: move  (slide back down the entry side to escape any stage)  M: menu':
    'WASD/方向キー：移動  （入口側へ滑り戻ると各階から脱出）  M：メニュー',

  // Starter and evolution Pokédex descriptions
  'Its tail has a special power to keep food fresh. It always carries prey like fruit in its tail.':
    'しっぽには 食べ物を新鮮に保つ 不思議な力がある。木の実などの獲物を いつもしっぽに入れて運ぶ。',
  'Before winter it stores food in its tail. Fruit it forgets to eat sprouts and becomes part of the tail.':
    '冬の前に しっぽへ食べ物を蓄える。食べ忘れた木の実は芽を出し、しっぽの一部になる。',
  'Smoke from burning food drifts from its neck organ. Elements in the smoke make prey feel strangely at ease.':
    '首の器官から 食べ物をいぶした煙が漂う。その成分には 獲物を不思議と安心させる働きがある。',
  'It draws attention with S-shaped movements. When prey lets its guard down, Vipour bites and paralyzes them.':
    'S字を描く動きで 相手の注意を引く。油断した瞬間に ヴァイパーがかみつき まひさせる。',
  'Based on the crane, the Korean Grim Reaper, and Hwatu cards. It silently guides lost souls across still water.':
    'ツルと冥界の使者、花札を思わせる姿。静かな水面を渡り、迷った魂を無言で導く。',
  'Its hollow, mournful cry echoes across rivers at dusk. Fishermen say hearing it means rain — or something else.':
    '夕暮れの川に 物悲しい空ろな鳴き声が響く。漁師は その声を聞くと雨が来る――あるいは別の何かが来ると言う。',
  'Its tail has grown into a small tree. Fruit that sprouts there feeds the whole forest.':
    'しっぽが 小さな木へ成長した。そこに実る果実が 森じゅうのポケモンを養う。',
  'It guards its grove fiercely, striking from shadow with leaf-bladed claws.':
    '自分の森を勇ましく守る。影から飛び出し 葉の刃のような爪で切りつける。',
  'A masked forest bandit. Its acorn helm and leaf-blade tail are feared across the highlands.':
    '仮面をつけた森の義賊。どんぐりの兜と 葉の刃のしっぽは 高原じゅうで恐れられている。',
  'It moves between trees unseen, defending the wild from those who would harm it.':
    '姿を見せず 木々の間を移動する。自然を傷つける者から 野生を守っている。',
  'When it twists and dances, heat pours from its flower-shaped scales, spreading toxic smoke.':
    '身をひねって踊ると 花形のうろこから熱があふれ、毒の煙を広げる。',
  'Its smoke carries a fascinating scent. In ancient times, nobles bred Scorpent for pleasure.':
    '煙には 人を魅了する香りがある。古代には 貴族が観賞用にスコーペントを育てた。',
  'A crane magistrate of the spirit world. Its fanned tail judges the worthy from the damned.':
    '霊界を治める ツルの裁判官。扇状のしっぽで 善き魂と罪ある魂を裁く。',
  'Under the gat hat its eyes see beyond the veil. Where it walks, the drowned find peace.':
    '笠の下の目は 現世の幕の向こうまで見通す。その歩いた場所では 水に沈んだ魂が安らぎを得る。',

  // Additional world labels, city summaries, and gym objectives
  'Forest Elder': '森の長老', 'Mart Clerk': 'フレンドリィショップ店員', 'CITY\nMAP': 'シティ\nマップ',
  'Disciple\n③ Beach': '弟子\n③ ビーチ', '▶  City View — 563m above ground': '▶  都市展望 — 地上563m',
  '— Balcony over Capitol City —': '— ソウルシティを望む展望台 —',
  '↑ ↓ select    SPACE go    X cancel': '↑ ↓ 選択    SPACE 決定    X キャンセル',
  'Lanterns drift over the Han River and the whole city stays out until dawn.':
    '漢江に灯籠が流れ、街じゅうが夜明けまで祭りを楽しんでいる。',
  'Capitol City\'s secrets are now open to you. Journey on, trainer.':
    'ソウルシティの秘密は もうきみに開かれた。旅を続けなさい、トレーナー。',
  'Sanbangsan — sacred peak shrine of the island spirits': '山房山――島の精霊をまつる聖なる峰',
  'Rest spot overlooking the black-sand beach': '黒砂海岸を見下ろす休憩所',
  '⬇ Black-Sand Beach → Ferry': '⬇ 黒砂海岸 → フェリー', '↑ Vent Trail (the climb)': '↑ 噴気孔登山道',
  '↓ Ferry → back to Haean City': '↓ フェリー → ヘアンシティへ戻る', '↓ Back to the plaza': '↓ 広場へ戻る',
  '↑ Grand Avenue → Northern League': '↑ 大通り → 北部リーグ',
  'SPACE — Grand Avenue → Northern League': 'SPACE — 大通り → 北部リーグ',
  '\nReturning to Waterfall City...': '\nウォーターフォールシティへ戻っています……',
  'Returning to Waterfall City...': 'ウォーターフォールシティへ戻っています……',
  '↑ Coastal Road (Route 4)': '↑ 海岸道路（4番道路）', 'Parangpo Beach': 'パランポビーチ',
  'Kalma Beach': 'カルマビーチ', '↑ Dolmoe Mine (→ Seorae)': '↑ トルメ鉱山（→ ソレ）',
  '🏖 Kalma Beach (갈마 해변)': '🏖 カルマビーチ',
  '⛏ Gangcheoldo Ore Mine (강철도 광산)': '⛏ カンチョルド鉱山', '⛰ Bukpung Pass (북풍 고개)': '⛰ 北風峠',
  '☕ 갈마 해변 카페 (Beach Café)': '☕ カルマビーチカフェ', '⛱ Beach Promenade (해안 산책로)': '⛱ 海辺の遊歩道',
  '🏨 Beach Resort (해수욕장 호텔)': '🏨 ビーチリゾート', '↑ 관문성 (Gwanmunseong)': '↑ クァンムンソン',
  '↓ 해솔 (Haesol)': '↓ ヘソル', '↓ 제단의 방 (Altar Hall)': '↓ 祭壇の間',
  '☀ The Sacred Peak — 환웅의 강림': '☀ 聖なる峰 — ファヌン降臨', '⛏ Dolmoe City — 돌뫼 시티': '⛏ トルメシティ',
  '⛏ Dolmoe Mine (돌뫼 광산)': '⛏ トルメ鉱山', '⛩️ FOREST SHRINE (숲 신전)': '⛩️ 森のほこら',
  "⛰ Route 2 — Scholar's Road (선비길)": '⛰ 2番道路 — 学者の道', '❄ Seorae Pass — 설령 고개': '❄ ソレ峠',
  '북방 리그 · NORTHERN LEAGUE': '北部リーグ', '이깔나무 숲\nLarch Forest': 'カラマツの森',
  '🌅 Route 6 — Eastern Shore Road (동해 해안도로)': '🌅 6番道路 — 東海岸道路',
  '🌅 Sunrise City (일출 시티)': '🌅 サンライズシティ', '🌲 Forest City (숲 시티)': '🌲 フォレストシティ',
  '🏔️ Seolbong Highland Pass (설봉 고갯길)': '🏔️ ソルボン高原峠', '🏙️ Seolbong City (설봉시티)': '🏙️ ソルボンシティ',
  '🏙️ Geumgang City (금강 시티)': '🏙️ クムガンシティ', '🏙️ Haean City (해안 시티)': '🏙️ ヘアンシティ',
  '🏯 Northern League — 북방 리그': '🏯 北部リーグ', '🔔 Seorae Town — 서래 마을': '🔔 ソレタウン',
  "🔬 Professor Song's Lab — Sudo City (수도 시티)": '🔬 ソン博士の研究所 — スドシティ',
  '🚌 Bus → Songhyeon 송현': '🚌 バス → ソンヒョン', '↓ Below Deck': '↓ 船室へ',
  '→ Up to Deck': '→ 甲板へ', '⛴️ Casting off — Haean Harbour → Jeju': '⛴️ 出航 — ヘアン港 → 済州',
  '↓ League Plaza': '↓ リーグ広場', 'Han River Park →': '漢江公園 →', "← Scholars' Road": '← 学者の道',
  '← → page   ·   click an entry for details   ·   ESC to close':
    '← → ページ   ·   項目をクリックして詳細   ·   ESCで閉じる',
  'Explore the city, visit the Capitol Tower,\nand challenge the Capitol Gym!':
    '街を探索し、ソウルタワーを訪れ、\nソウルジムに挑戦しよう！',
  'An elegant river city famous for its Contest Hall and thousand-lantern stage.':
    'コンテストホールと 千の灯籠が輝く舞台で知られる 優雅な川辺の街。',
  'Hillside houses stacked to the ridge, a roaring fish market, a container port, and a black-sand beach.':
    '尾根まで重なる坂の家々、活気ある魚市場、コンテナ港、そして黒砂海岸が広がる。',
  'Bioluminescent plants light the paths with a soft green glow.': '発光植物が 柔らかな緑の光で道を照らしている。',
  'Volcanic rock, a black-sand beach, and a lighthouse over the East Sea. The great Gym crowns the plaza.':
    '火山岩と黒砂海岸、東海を望む灯台。大きなジムが広場の頂に立つ。',
  'Defeat the two Gym Trainers, then face Leader Noksaek, the Ancient Keeper.':
    '2人のジムトレーナーを倒し、古代守護者ノクセクに挑もう。',
  'Defeat the two Gym Trainers, then face Leader Beonge, the Stormwatcher.':
    '2人のジムトレーナーを倒し、嵐の監視者ボンゲに挑もう。',
  'Defeat the two Gym Trainers, then face Leader Sandol — The Bedrock.':
    '2人のジムトレーナーを倒し、岩盤のサンドルに挑もう。',
  'Defeat the two Gym Trainers, then face Leader Namsun, the Eternal Performer.':
    '2人のジムトレーナーを倒し、永遠の演者ナムスンに挑もう。',
  'Defeat the two Gym Trainers, then face Leader Harang, the Tidekeeper.':
    '2人のジムトレーナーを倒し、潮の守り人ハランに挑もう。',
  'Defeat the two Gym Trainers, then face Leader Yeona — The Winter Bell.':
    '2人のジムトレーナーを倒し、冬の鐘ヨナに挑もう。',
  'Half gym, half observatory, bolted into the sea-cliffs. Current crackles through rotating panels.':
    '海食崖に組み込まれた 半分ジム、半分観測所。回転パネルを電流が走る。',
};

export const JA_TYPES: Record<string, string> = {
  normal: 'ノーマル', fire: 'ほのお', water: 'みず', electric: 'でんき', grass: 'くさ',
  ice: 'こおり', fighting: 'かくとう', poison: 'どく', ground: 'じめん', flying: 'ひこう',
  psychic: 'エスパー', bug: 'むし', rock: 'いわ', ghost: 'ゴースト', dragon: 'ドラゴン',
  dark: 'あく', steel: 'はがね', fairy: 'フェアリー',
};

export const JA_ABILITIES: Record<string, string> = {
  overgrow: 'しんりょく', blaze: 'もうか', torrent: 'げきりゅう', sturdy: 'がんじょう',
  levitate: 'ふゆう', intimidate: 'いかく', pressure: 'プレッシャー', drought: 'ひでり',
  drizzle: 'あめふらし', 'snow warning': 'ゆきふらし', 'sand stream': 'すなおこし',
  'swift swim': 'すいすい', chlorophyll: 'ようりょくそ', 'slush rush': 'ゆきかき',
  'snow cloak': 'ゆきがくれ', 'sand veil': 'すながくれ', 'cloud nine': 'ノーてんき',
  'rock head': 'いしあたま', 'magic guard': 'マジックガード',
};

export const JA_SPEAKERS: Record<string, string> = {
  ...JA_REMAINING_SPEAKERS,
  'Prof. Song': 'ソン博士', 'Professor Song': 'ソン博士', 'Prof. Kim': 'キム博士',
  'Rival': 'ライバル', 'Minhyuk': 'ミンヒョク', 'Soohyun': 'スヒョン', 'Mom': 'ママ',
  "Trainer's PC": 'トレーナーのパソコン', 'Nurse': '看護師', 'Nurse Joy': 'ジョーイ',
  'Shopkeeper': '店員', 'Mart Clerk': 'フレンドリィショップ店員', 'Store Clerk': '売店員',
  'Champion Hwangeum': 'チャンピオン・ファングム', 'Hwangeum': 'ファングム',
  'Taewang': 'テワン', 'Champion Taewang': 'チャンピオン・テワン',
  'Sovereign Clemont': '君主クレモン', 'Receptionist': '受付', 'Ranger': 'レンジャー',
  'Ranger Sooyeon': 'レンジャー・スヨン', 'Ranger Hyunwoo': 'レンジャー・ヒョヌ',
  'Guard': '警備員', 'Gate Guard': '門番', 'Gate Warden': '門番', 'League Warden': 'リーグ門番',
  'Royal Warden': '王室管理官', 'Palace Guard': '宮殿警備兵',
  'Leader Jin': 'ジムリーダー ジン', 'Leader Namsun': 'ジムリーダー ナムスン',
  'Leader Harang': 'ジムリーダー ハラン', 'Leader Noksaek': 'ジムリーダー ノクセク',
  'Leader Beonge': 'ジムリーダー ボンゲ', 'Leader Byeoksan': 'ジムリーダー ビョクサン',
  'Byeoksan': 'ビョクサン', 'Namsun': 'ナムスン', 'Harang': 'ハラン', 'Noksaek': 'ノクセク',
  'Beonge': 'ボンゲ', 'Jin': 'ジン', 'Sandol': 'サンドル', 'Yeona': 'ヨナ',
  'Taeguk': 'テグク', 'Nari': 'ナリ', 'Boram': 'ボラム', 'Junho': 'ジュノ',
  'Haedo': 'ヘド', 'Chungha': 'チョンハ', 'Seongwoo': 'ソンウ', 'Miso': 'ミソ',
  'Jaemin': 'ジェミン', 'Yuna': 'ユナ', 'Contest Hall Usher': 'コンテストホール案内係',
  'Usher': '案内係',
  'Gym Trainer': 'ジムトレーナー', 'Ace Trainer': 'エリートトレーナー',
  'Youngster': 'たんぱんこぞう', 'Bug Catcher': 'むしとりしょうねん',
  'Hiker': 'やまおとこ', 'Black Belt': 'からておう', 'Bird Keeper': 'とりつかい',
  'Swimmer': 'かいパンやろう', 'Sailor': 'ふなのり', 'Fisher': 'つりびと',
  'Team Suri': 'スリ団', 'Team Suri Grunt': 'スリ団のしたっぱ', 'Team Suri Grunt A': 'スリ団のしたっぱA',
  'Team Suri Operative': 'スリ団員', 'Director Suri': 'スリ局長', 'Dir. Suri': 'スリ局長',
  'Commander Ryeo': 'リョ司令官', 'Cmdr Ryeo': 'リョ司令官', 'Admin Chaeyeon': '幹部 チェヨン',
  'Chaeyeon': 'チェヨン', 'Executive Mubaek': '幹部 ムベク', 'Grunt': 'したっぱ',
  'Seorak': 'ソラク', 'Hanseol': 'ハンソル', 'Cheolgang': 'チョルガン', 'Baekho': 'ベクホ',
  'Gyeoul': 'キョウル', 'Hwageum': 'ファグム', 'Saleum': 'サルム',
  '어사대장 Jinnok': '王室監察官 ジノク', '어사대장 Jito': '王室監察官 ジト',
  '어사대장 Haemin': '王室監察官 ヘミン', '어사대장 Haegang': '王室監察官 ヘガン',
  '어사대장 Cheolju': '王室監察官 チョルジュ', '어사대장 Mukyeong': '王室監察官 ムギョン',
  '어사대장 Amrok': '王室監察官 アムロク', '어사대장 Seolwon': '王室監察官 ソルウォン',
  '어사대장 Jeongan': '王室監察官 チョンアン', '어사대장 Hyeon': '王室監察官 ヒョン',
  '어사대장 Salmu': '王室監察官 サルム', '어사대장 Gapcheol': '王室監察官 カプチョル',
  'Supreme Gwang': '総帥グァン', 'Driver': '運転手', 'Badge Scanner': 'バッジスキャナー',
  'Forest Elder': '森の長老', 'Old Woodsman': '老木こり', 'Stonemason': '石工',
  'Potter': '陶工', 'Child': '子ども', 'Skater': 'スケーター', 'Sculptor': '彫刻家',
  'Innkeeper': '宿の主人', 'Vendor': '露店商', 'Tourist': '観光客', 'Coach': 'コーチ',
  'Youth': '青年', 'Curator': '学芸員', 'Monk': '僧侶', 'Head Monk': '住職',
  'Old Sailor': '老船乗り', 'Border Guard': '国境警備兵', 'Fur Trader': '毛皮商人',
  'Ice Fisher': '氷上釣り師', 'Aurora Watcher': 'オーロラ観測者', 'Stationmaster': '駅長',
  'Shop Clerk': '店員', 'Pharmacist': '薬剤師', 'Gift Clerk': '土産物店員',
  'Reporter': '記者', 'Clerk': '係員', 'Merchant': '商人', 'Collector': '収集家',
  'Librarian': '司書', 'Speaker': '議長', 'Aide': '補佐官', 'Assembly Aide': '議会補佐官',
  'Nursery Keeper': '育て屋', 'Steward': '船内係', 'Boatswain': '甲板長', 'Engineer': '機関士',
  'Kisun': 'キスン',
};

// Original Onnuri species keep their proper-noun identity in katakana.
export const JA_POKEMON: Record<string, string> = {
  munkain: 'ムンカイン', munklift: 'ムンクリフト', banderado: 'バンデラド',
  vipour: 'ヴァイパー', scorpent: 'スコーペント', feldaconda: 'フェルダコンダ',
  onnurian: 'オンヌリアン', onnujang: 'オンヌジャン', thanatoat: 'タナトート',
  hwanwoong: 'ファヌン', poongbaek: 'プンベク', woosa: 'ウサ', woonsa: 'ウンサ',
  turtleship: 'タートルシップ', daejangseung: 'テジャンスン', nabihalmang: 'ナビハルマン',
  cheonjisin: 'チョンジシン', disguijar: 'トルジェビ', saekomaga: 'セコムサク',
  saekomassi: 'チャリッセコム', secommamma: 'セコムママ', cerrapin: 'チョヤクゴブク',
};

/** Official species fielded by story trainers and wild encounters. This keeps
 * Japanese battle HUDs fully localized offline; menu metadata can still refresh
 * the same names from PokéAPI when a connection is available. */
export const JA_OFFICIAL_POKEMON: Record<string, string> = {
  Abomasnow: 'ユキノオー', Absol: 'アブソル', Aggron: 'ボスゴドラ', Altaria: 'チルタリス',
  Aurorus: 'アマルルガ', Azumarill: 'マリルリ', Banette: 'ジュペッタ', Basculegion: 'イダイトウ',
  Bastiodon: 'トリデプス', Beartic: 'ツンベアー', Bellsprout: 'マダツボミ', Bibarel: 'ビーダル',
  Bisharp: 'キリキザン', Boldore: 'ガントル', Bouffalant: 'バッフロン', Braviary: 'ウォーグル',
  Bronzong: 'ドータクン', Bronzor: 'ドーミラー', Budew: 'スボミー', Caterpie: 'キャタピー',
  Chimecho: 'チリーン', Clefairy: 'ピッピ', Cloyster: 'パルシェン', Conkeldurr: 'ローブシン',
  Corsola: 'サニーゴ', Cryogonal: 'フリージオ', Cubchoo: 'クマシュン', Delibird: 'デリバード',
  Ditto: 'メタモン', Dragonair: 'ハクリュー', Dragonite: 'カイリュー', Drapion: 'ドラピオン',
  Dratini: 'ミニリュウ', Drifblim: 'フワライド', Drifloon: 'フワンテ', Drilbur: 'モグリュー',
  Dugtrio: 'ダグトリオ', Dusclops: 'サマヨール', Duskull: 'ヨマワル', Empoleon: 'エンペルト',
  Enamorus: 'ラブトロス', Espeon: 'エーフィ', Excadrill: 'ドリュウズ', 'Farfetch’d': 'カモネギ',
  Flygon: 'フライゴン', Froslass: 'ユキメノコ', Gallade: 'エルレイド', Garchomp: 'ガブリアス',
  Gardevoir: 'サーナイト', Gengar: 'ゲンガー', Geodude: 'イシツブテ', Gigalith: 'ギガイアス',
  Glaceon: 'グレイシア', Glalie: 'オニゴーリ', Gligar: 'グライガー', Gliscor: 'グライオン',
  Golbat: 'ゴルバット', Goldeen: 'トサキント', Golduck: 'ゴルダック', Golem: 'ゴローニャ',
  Goodra: 'ヌメルゴン', Graveler: 'ゴローン', Gyarados: 'ギャラドス', Hariyama: 'ハリテヤマ',
  Haunter: 'ゴースト', Hawlucha: 'ルチャブル', Haxorus: 'オノノクス', Hitmonlee: 'サワムラー',
  Hitmontop: 'カポエラー', Honchkrow: 'ドンカラス', Hoothoot: 'ホーホー', Houndoom: 'ヘルガー',
  Houndour: 'デルビル', Hydreigon: 'サザンドラ', Jellicent: 'ブルンゲル', Kakuna: 'コクーン',
  Kingdra: 'キングドラ', Krabby: 'クラブ', Krookodile: 'ワルビアル', Lairon: 'コドラ',
  Lanturn: 'ランターン', Lapras: 'ラプラス', Larvitar: 'ヨーギラス', Latios: 'ラティオス',
  Liepard: 'レパルダス', Linoone: 'マッスグマ', Lucario: 'ルカリオ', Ludicolo: 'ルンパッパ',
  Machamp: 'カイリキー', Machoke: 'ゴーリキー', Machop: 'ワンリキー', Magikarp: 'コイキング',
  Magmar: 'ブーバー', Magnemite: 'コイル', Magneton: 'レアコイル', Magnezone: 'ジバコイル',
  Mamoswine: 'マンムー', Mandibuzz: 'バルジーナ', Mankey: 'マンキー', Mantine: 'マンタイン',
  Mantyke: 'タマンタ', Mareep: 'メリープ', Medicham: 'チャーレム', Metagross: 'メタグロス',
  Metapod: 'トランセル', Milotic: 'ミロカロス', Miltank: 'ミルタンク', Misdreavus: 'ムウマ',
  Mismagius: 'ムウマージ', Murkrow: 'ヤミカラス', Noctowl: 'ヨルノズク', Octillery: 'オクタン',
  Oddish: 'ナゾノクサ', Onix: 'イワーク', Overqwil: 'ハリーマン', Pelipper: 'ペリッパー',
  Pichu: 'ピチュー', Pidgey: 'ポッポ', Pikachu: 'ピカチュウ', Piloswine: 'イノムー',
  Poliwrath: 'ニョロボン', Poochyena: 'ポチエナ', Primarina: 'アシレーヌ', Primeape: 'オコリザル',
  Quagsire: 'ヌオー', Quaquaval: 'ウェーニバル', Quaxly: 'クワッス', Quaxwell: 'ウェルカモ',
  Qwilfish: 'ハリーセン', Rattata: 'コラッタ', Raichu: 'ライチュウ', Rayquaza: 'レックウザ',
  Rhydon: 'サイドン', Rhyhorn: 'サイホーン', Rhyperior: 'ドサイドン', Riolu: 'リオル',
  Roselia: 'ロゼリア', Roserade: 'ロズレイド', Rotom: 'ロトム', Sableye: 'ヤミラミ',
  Salamence: 'ボーマンダ', Sandshrew: 'サンド', Sandslash: 'サンドパン', Sawsbuck: 'メブキジカ',
  Scrafty: 'ズルズキン', Seaking: 'アズマオウ', Sentret: 'オタチ', Sharpedo: 'サメハダー',
  Shellder: 'シェルダー', Shuppet: 'カゲボウズ', Skarmory: 'エアームド', Skeledirge: 'ラウドボーン',
  Skuntank: 'スカタンク', Slowbro: 'ヤドラン', Slugma: 'マグマッグ', Sneasel: 'ニューラ',
  Sneasler: 'オオニューラ', Snorunt: 'ユキワラシ', Snover: 'ユキカブリ', Spearow: 'オニスズメ',
  Stantler: 'オドシシ', Staraptor: 'ムクホーク', Starmie: 'スターミー', Staryu: 'ヒトデマン',
  Steelix: 'ハガネール', Stoutland: 'ムーランド', Sudowoodo: 'ウソッキー', Sunflora: 'キマワリ',
  Swablu: 'チルット', Swellow: 'オオスバメ', Swinub: 'ウリムー', Tangrowth: 'モジャンボ',
  Tauros: 'ケンタロス', Tentacool: 'メノクラゲ', Tentacruel: 'ドククラゲ', Torterra: 'ドダイトス',
  Toxicroak: 'ドクロッグ', Tyranitar: 'バンギラス', Umbreon: 'ブラッキー', Ursaluna: 'ガチグマ',
  Ursaring: 'リングマ', Vanilluxe: 'バイバニラ', Vibrava: 'ビブラーバ', Wailmer: 'ホエルコ',
  Weavile: 'マニューラ', Weedle: 'ビードル', Whiscash: 'ナマズン', Wingull: 'キャモメ',
  Woobat: 'コロモリ', Yanmega: 'メガヤンマ', Zubat: 'ズバット',
};
