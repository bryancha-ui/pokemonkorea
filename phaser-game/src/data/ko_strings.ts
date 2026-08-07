// ── Korean string dictionary ────────────────────────────────────────────────
// Exact-match English → Korean. Used by i18n `tr()` at the central chokepoints
// (DialogBox lines, menus, battle UI). Lines not present here fall back to English,
// so the game never breaks — the map can be extended incrementally.

export const KO_TYPES: Record<string, string> = {
  normal: '노멀', fire: '불꽃', water: '물', grass: '풀', electric: '전기',
  ice: '얼음', fighting: '격투', poison: '독', ground: '땅', flying: '비행',
  psychic: '에스퍼', bug: '벌레', rock: '바위', ghost: '고스트', dragon: '드래곤',
  dark: '악', steel: '강철', fairy: '페어리',
};

// Speaker names (the part before ": " in a dialogue line). tr() translates these
// separately so a line only needs its spoken text translated to localize fully.
export const KO_SPEAKERS: Record<string, string> = {
  'Prof. Song': '송 박사', 'Professor Song': '송 박사', 'Prof. Kim': '김 박사',
  'Rival': '라이벌', 'Mom': '엄마', 'Nurse Joy': '조이 간호사', 'Mart Clerk': '마트 점원',
  "Trainer's PC": '트레이너 PC', 'Ranger': '레인저', 'Ranger Sooyeon': '레인저 수연', 'Ranger Hyunwoo': '레인저 현우',
  'Byeoksan': '벽산', 'Leader Byeoksan': '관장 벽산', 'Champion Hwangeum': '챔피언 황금',
  'Taewang': '태왕', 'Sovereign Clemont': '군주 클레몽',
  '어사대장 Jinnok': '어사대장 진옥', '어사대장 Jito': '어사대장 지토',
  'Team Suri Grunt A': '수리단 조무래기 A', 'Team Suri Operative': '수리단 대원',
  // Gym leaders + their trainers
  'Taeguk': '태극', 'Nari': '나리', 'Boram': '보람', 'Junho': '준호',
  'Namsun': '남순', 'Leader Namsun': '관장 남순', 'Haedo': '해도',
  'Harang': '하랑', 'Leader Harang': '관장 하랑',
  'Contest Hall Usher': '콘테스트 홀 안내원', 'Usher': '안내원',
  'Chungha': '청하', 'Noksaek': '녹색', 'Leader Noksaek': '관장 녹색',
  'Seongwoo': '성우', 'Beonge': '번개', 'Leader Beonge': '관장 번개',
  'Miso': '미소', 'Jin': '진', 'Leader Jin': '관장 진', 'Jaemin': '재민', 'Yuna': '유나',
  'Commander Ryeo': '사령관 려', 'Director Suri': '수리 국장', 'Admin Chaeyeon': '간부 채연',
  'Grunt': '조무래기', 'Nurse': '간호사',
  // Northern League Elite Four + champion
  'Seorak': '서락', 'Hanseol': '한설', 'Cheolgang': '철강', 'Baekho': '백호',
  'Driver': '기사',
  // 어사대 chiefs (마패 circuit)
  '어사대장 Haemin': '어사대장 해민', '어사대장 Haegang': '어사대장 해강',
  '어사대장 Cheolju': '어사대장 철주', '어사대장 Mukyeong': '어사대장 무경',
  '어사대장 Amrok': '어사대장 압록', '어사대장 Seolwon': '어사대장 설원',
  '어사대장 Jeongan': '어사대장 정안', '어사대장 Hyeon': '어사대장 현',
  // 어사대 city NPC roles
  'Salt Farmer': '소금 농부', 'Old Woodsman': '늙은 나무꾼', 'Gate Guard': '관문 경비병',
  'Disciple Baekho': '제자 백호', 'Disciple Miru': '제자 미루', 'Noodle Lover': '국수 애호가',
  'Bridge Elder': '다리 어르신', 'Bathhouse Regular': '목욕탕 단골', 'Old Sailor': '늙은 뱃사람',
  'Night-crew Worker': '야간 작업자', 'Foghorn Keeper': '무적 지기', 'Rail Porter': '철도 짐꾼',
  'Border Guard': '국경 경비병', 'Fur Trader': '모피 상인', 'Ice Fisher': '얼음 낚시꾼',
  'Larch Cutter': '낙엽송 벌목꾼', 'Aurora Watcher': '오로라 관측자', '노스단 Lookout': '노스단 감시병',
  // Scholars' Road (victory road)
  'Hyeonu': '현우', 'Dawon': '다원', 'Munseok': '문석', 'Badge Scanner': '배지 스캐너',
  // 어사대 inspectors (Northern Reaches) + 노스단 ranks
  '어사대장 Salmu': '어사대장 살무', '어사대장 Gapcheol': '어사대장 갑철',
  '노스단 Grunt': '노스단 조무래기', '노스단 Admin': '노스단 간부',
  'Chaeyeon': '채연', 'Executive Mubaek': '간부 무백', 'Forest Elder': '숲 어르신',
  // Dolmoe / Seorae (side cities + gyms)
  'Stonemason': '석공', 'Potter': '옹기장이', 'Child': '아이',
  'Bawoo': '바우', 'Doran': '도란', 'Sandol': '산돌',
  'Skater': '스케이터', 'Sculptor': '조각가', 'Innkeeper': '여관 주인', 'Vendor': '노점상',
  'Tourist': '관광객', 'Coach': '코치', 'Youth': '청년',
  'Nunsong': '눈송', 'Baram': '바람', 'Yeona': '연아', 'Quarry Worker': '채석장 인부',
  'Observer Park': '관찰자 박', 'Observer': '관찰자', 'Guard': '경비병', 'Curator': '큐레이터',
  'Royal Warden': '왕실 관리인',
  // Onnuri League Elite Four + champion
  'Gyeoul': '겨울', 'Hwageum': '화금', 'Saleum': '살음', 'Hwangeum': '황금',
  // Misc trainers (defeat lines)
  'Bug Catcher': '벌레잡이 소년', 'Hiker': '등산가', 'Youngster': '꼬마', 'Team Suri': '수리단',
  'Watchtower Sentry': '망루 감시병', 'Seollan': '설란', '노스단 Soldier': '노스단 병사',
  '노스단 Sovereign-Claimant': '노스단 군주 참칭자',
  'Monk': '스님', 'Team Suri Grunt': '수리단 조무래기', '노스단 Operative': '노스단 대원',
  '노스단 Garrison Officer': '노스단 수비대 장교', 'Gate Captain Seollan': '문지기 대장 설란', 'Daejangseung': '대장승',
  'Artist Sora': '화가 소라', 'Dock Worker': '부두 인부', 'Trader': '상인',
  'Bishop': '비숍',
  'Shop Clerk': '가게 점원', 'Store Clerk': '편의점 점원', 'Pharmacist': '약사', 'Gift Clerk': '선물 가게 점원',
  // ── Long-tail trainer / NPC names (auto-added) ──
  'Hiker Cheolho': '등산가 철호',
  'Black Belt Muljin': '검은띠 물진',
  'Bird Keeper Sora': '새기르기 소라',
  'Picnicker Yena': '피크닉소녀 예나',
  'Camper Dohyeon': '캠프소년 도현',
  'Gym Trainer Nari': '체육관 트레이너 나리',
  'Hiker Baekcheol': '등산가 백철',
  'Bird Keeper Suna': '새기르기 수나',
  'Ace Trainer Jihu': '엘리트 트레이너 지후',
  'Camper Doha': '캠프소년 도하',
  'Miner Gapdol': '광부 갑돌',
  'Prospector Sunny': '탐광꾼 써니',
  'Digger Baru': '굴착꾼 바루',
  'Rich Boy Hojun': '부잣집 도련님 호준',
  'Sailor Geumdol': '선원 금돌',
  'Deckhand Mira': '갑판원 미라',
  'Hex Maniac Boryeong': '마녀 보령',
  'Medium Yeong': '영매 영',
  'Gym Trainer Minho': '체육관 트레이너 민호',
  'Gym Trainer Junho': '체육관 트레이너 준호',
  'Gym Trainer Byungchan': '체육관 트레이너 병찬',
  'Miner Gwang': '광부 광',
  'Worker Cheol': '작업자 철',
  'Herder Poksil': '목동 복실',
  'Hiker Doam': '등산가 도암',
  'Ace Trainer Seorin': '엘리트 트레이너 서린',
  'Sailor Manho': '선원 만호',
  'Fisher Dohun': '낚시꾼 도훈',
  'Swimmer Yura': '수영선수 유라',
  'Champion Taewang': '챔피언 태왕',
  'Swimmer Miho': '수영선수 미호',
  'Swimmer Jinsu': '수영선수 진수',
  'Sailor Baek': '선원 백',
  'Hiker Daljae': '등산가 달재',
  'Camper Boksun': '캠프소년 복순',
  'Black Belt Museon': '검은띠 무선',
  'Hiker Cheol': '등산가 철',
  'Ace Trainer Hakryun': '엘리트 트레이너 학륜',
  'Psychic Myoja': '초능력자 묘자',
  'Veteran Seolla': '베테랑 설라',
  'Skier Nunbyeol': '스키어 눈별',
  'Hiker Dongsu': '등산가 동수',
  'School Kid Yujin': '학교 학생 유진',
  'Sailor Mansik': '선원 만식',
  'Fisherman Dalsu': '낚시꾼 달수',
  'Aroma Lady Jiyeon': '아로마 아가씨 지연',
  'Bug Catcher Billy': '벌레잡이 소년 빌리',
  'Hiker Minsu': '등산가 민수',
  'Youngster Junho': '꼬마 준호',
  'Paddy Farmer Deoksu': '논 농부 덕수',
  'Angler Miyeon': '낚시꾼 미연',
  'Youngster Jinho': '꼬마 진호',
  'Hiker Bawoo': '등산가 바우',
  'Snow Worker Deok': '제설 작업자 덕',
  'Mountaineer Han': '등반가 한',
  'Fisher Bora': '낚시꾼 보라',
  'Paddy Farmer Deok': '논 농부 덕',
  'Swimmer Haruki': '수영선수 하루키',
  'Steelworker Cheolsu': '제철공 철수',
  'Hiker Baekho': '등산가 백호',
  'Gym Trainer Daehwi': '체육관 트레이너 대휘',
  'Disciple Cheon': '제자 천',
  'Swimmer Haram': '수영선수 하람',
  'Palace Guard': '궁전 경비병',
  'Sluice Keeper': '수문지기',
  'Dock Boy': '부두 소년',
  'Old Diver': '늙은 잠수부',
  'Retired Boxer': '은퇴한 복서',
  'Beach Vendor': '해변 상인',
  'Snow Child': '눈아이',
  'Lodge Guest': '산장 손님',
  'Bundled Elder': '두꺼운 옷의 노인',
  'Lodge Keeper': '산장지기',
  'Bath Attendant': '온천지기',
  'Market Vendor': '시장 상인',
  'Skate Technician': '스케이트 기술자',
  'Barkeep': '선술집 주인',
  'Barista': '바리스타',
  'Sunbather': '일광욕객',
  'Fishmonger': '생선장수',
  'Historian': '역사학자',
  'Merchant': '상인',
  'Collector': '수집가',
  'Reporter': '기자',
  'Receptionist': '안내원',
  'Clerk': '점원',
  'Cmdr Ryeo': '려 사령관',
  'Dir. Suri': '수리 국장',
  'Old Quarryman': '늙은 석공',
  'Old Dosik': '늙은 도식',
  'Harabeoji': '할아버지',
  'Head Monk': '주지 스님',
  'City Warden Cheol': '경비대 철',
  'Gate Warden': '관문 경비대',
  'League Warden': '리그 문지기',
  'Skate Link Attendant': '스케이트 연결로 안내원',
  'Supreme Gwang': '총수 광',
  'Dockworker Namgil': '부두 인부 남길',
  'Harbour Warden': '항구 감독관',
  'Harbour Child': '항구 아이',
  'Gull-watcher': '갈매기 관찰자',
  'Dockworker': '부두 인부',
  'Miner': '광부',
  'Digger': '굴착꾼',
  'Prospector': '탐광꾼',
  'Steelworker': '제철공',
  'Fisher': '낚시꾼',
  'Swimmer': '수영선수',
  'Sailor': '선원',
  'Skier': '스키어',
  'Herder': '목동',
  'Deckhand': '갑판원',
  'Medium': '영매',
  'Scholar': '학자',
  'Attendant Baram': '안내원 바람',
  'Ace Dawon': '에이스 다원',
  'Scholar Hyeonu': '학자 현우',
  'Veteran Munseok': '베테랑 문석',
  'Sunbather ': '일광욕객',
  'Dragon Tamer': '드래곤 조련사',
  'Aroma Lady': '아로마 아가씨',
  'Rich Boy': '부잣집 도련님',
  'School Kid': '학교 학생',
  'Fisherman': '낚시꾼',
  'Angler': '낚시꾼',
  'Paddy Farmer': '논 농부',
  'Black Belt': '검은띠',
  'Bird Keeper': '새기르기',
  'Picnicker': '피크닉소녀',
  'Camper': '캠프소년',
  'Gym Trainer': '체육관 트레이너',
  'Ace Trainer': '엘리트 트레이너',
  'Veteran': '베테랑',
  'Snow Worker': '제설 작업자',
  'Mountaineer': '등반가',
  'Continental Traveler': '대륙 여행자',
  'Traveler': '여행자', 'Attendant': '안내원', 'Warden Cheol': '경비대 철',
  'Hyeon': '현', 'Seolwon': '설원',
  // ── Buildings, landmarks & trainer roles (auto-added) ──
  'Farmer': '농부',
  'Fisher-\nman': '낚시\n꾼',
  'Moun-\ntaineer': '산악\n인',
  'Photo-\ngrapher': '사진\n작가',
  'Pilgrim': '순례자',
  'Pro-\nspector': '탐광\n꾼',
  'Sovereign': '군주',
  'Stationmaster': '역장',
  'Swim-\nmer': '수영\n선수',
  'Warden': '문지기',
  'Watcher': '감시자',
  'Worker': '인부',
  '노스단': '노스단',
  '노스단\nAdmin': '노스단\n간부',
  '노스단\nCourier': '노스단\n전령',
  '노스단\nGrunt': '노스단\n조무래기',
  '노스단\nScout': '노스단\n정찰대',
  '노스단\nSoldier': '노스단\n병사',
  // ── Nametags (auto-added, round 2) ──
  'Kisun': '기선',
  'Vending': '자판기',
  '노스단 Commander Ryeo': '노스단 사령관 려',
  '스님 Monk': '스님',
  '어사대장 Supreme Gwang': '어사대장 총수 광',
  // ── Post-2026-07-29 content (auto-added) ──
  "노스단 Digger": "노스단 발굴꾼",
  "Librarian": "사서",
  "Speaker": "의장",
  "Aide": "보좌관",
  "Assembly Aide": "의회 보좌관",
  "Nursery Keeper": "키우미집 주인",
  "Bathing Climber": "온천욕 등반가",
  "어사대 Inspector": "어사대 조사관",
  "Team Suri Admin Chaeyeon": "수리단 간부 채연",
  "Sailor Yeongho": "선원 영호",
  "Beauty Sora": "미녀 소라",
  "Boatswain Dukman": "갑판장 덕만",
  "Engineer Cheolsu": "기관사 철수",
  "Steward": "승무원",
  "Boatswain": "갑판장",
  "Engineer": "기관사",

};

export const KO_STRINGS: Record<string, string> = {
  'Pokémon Nursery': '포켓몬 키우미집',
  // ── Move names ──
  'Absorb': '흡수',
  'Aurora Beam': '오로라빔',
  'Bite': '물기',
  'Blizzard': '눈보라',
  'Bubblebeam': '거품광선',
  'Bug Bite': '벌레먹기',
  'Bulldoze': '땅고르기',
  'Calm Mind': '명상',
  'Confusion': '염동력',
  'Crunch': '깨물어부수기',
  'Dig': '구멍파기',
  'Dragon Breath': '용의숨결',
  'Dragon Claw': '드래곤클로',
  'Draining Kiss': '드레인키스',
  'Earthquake': '지진',
  'Ember': '불꽃세례',
  'Fire Fang': '불꽃엄니',
  'Fairy Wind': '요정의바람',
  'Flame Burst': '불티지옥',
  'Flamethrower': '화염방사',
  'Fly': '공중날기',
  'Foul Play': '속임수',
  'Giga Drain': '기가드레인',
  'Glacial Crush': '빙하분쇄',
  'Grave Bloom': '무덤개화',
  'Growl': '울음소리',
  'Headbutt': '박치기',
  'Hex': '재앙의부적',
  'Hyper Voice': '하이퍼보이스',
  'Karate Chop': '태권당수',
  'Leech Seed': '씨뿌리기',
  'Mega Drain': '메가드레인',
  'Metal Claw': '메탈클로',
  'Mist': '흰안개',
  'Monsoon Deluge': '장맛비',
  'Moonblast': '문포스',
  'Mud Slap': '진흙뿌리기',
  'Night Slash': '밤의일격',
  'Outrage': '역린',
  'Peck': '쪼기',
  'Poison Sting': '독침',
  'Powder Snow': '눈싸라기',
  'Pound': '막치기',
  'Psybeam': '사이코빔',
  'Psychic': '사이코키네시스',
  'Psyshock': '사이코쇼크',
  'Pursuit': '따라가때리기',
  'Quick Attack': '전광석화',
  'Razor Leaf': '잎날가르기',
  'Rock Throw': '돌떨구기',
  'Rock Tomb': '암석봉인',
  'Sand Attack': '모래뿌리기',
  'Scratch': '할퀴기',
  'Screech': '이상한소리',
  'Shadow Sneak': '그림자기습',
  'Ominous Wind': '이상한바람',
  'Shock Wave': '전기쇼크',
  'Silver Wind': '은빛바람',
  'Smokescreen': '연막',
  'Steel Wing': '강철날개',
  'Sucker Punch': '기습',
  'Supersonic': '초음파',
  'Surf': '파도타기',
  'Swift': '스피드스타',
  'Swords Dance': '칼춤',
  'Synthesis': '광합성',
  'Tackle': '몸통박치기',
  'Thunder': '번개',
  'Thunder Shock': '전기쇼크',
  'Thunderbolt': '10만볼트',
  'Twister': '회오리바람',
  'Venoshock': '벤조쇼크',
  'Vine Whip': '덩굴채찍',
  'Water Gun': '물대포',
  'Water Pulse': '물의파동',
  'Will-O-Wisp': '도깨비불',
  'Wing Attack': '날개치기',
  'X-Scissor': '시저크로스',

  // ── Interpolated NPC/trainer static line-parts ──
  'Let\'s battle!': '배틀하자!',
  'Show me your footing!': '네 발놀림을 보여줘!',
  'Prepare yourself!': '각오해!',
  'Let\'s see you dig in!': '어디 파고들어 봐!',
  'Into the dark, then!': '그럼, 어둠 속으로!',
  'Off the dig — now!': '발굴에서 손 떼 — 당장!',
  'This province has taken your measure. Carry the 마패 with honour.': '이 지방이 너를 가늠했다. 마패를 명예롭게 지녀라.',
  'Take root and fight!': '뿌리내리고 싸워라!',
  '(A wild spirit blocks the aisle — soothe it, or catch it with a Poké Ball!)': '(야생 정령이 통로를 막는다 — 달래거나 몬스터볼로 잡아라!)',
  'Light the stage!': '무대를 밝혀라!',
  'Into the deep!': '깊은 곳으로!',
  'For the north!': '북쪽을 위하여!',
  'Ride or drown!': '타거나 빠지거나!',
  'Hey, I spotted you! You look like a trainer!': '야, 너 발견했어! 트레이너 같은데!',
  'Show me the road\'s lesson!': '이 길의 가르침을 보여줘!',
  'Ring the bell — begin!': '종을 울려 — 시작!',
  'Full current!': '최대 전류!',
  'No items in a fair fight!': '정정당당한 승부엔 도구 없기!',
  'Hey! Stop right there.': '야! 거기 서.',
  'Eerie up here. Watch the lava and keep your footing — no telling what roosts at the top.': '위쪽은 으스스하네. 용암 조심하고 발밑을 잘 봐 — 꼭대기에 뭐가 도사리고 있을지 몰라.',
  'Go on. She\'s been waiting longer than either of us has been alive.': '어서 가. 그분은 우리 둘이 살아온 세월보다 더 오래 기다려왔어.',
  'The 노스단 southern operations are done. Your rig is scrap. Your orders don\'t reach here anymore.': '노스단의 남부 작전은 끝났어. 네 장비는 고철이 됐고. 네 명령은 더 이상 여기까지 닿지 않아.',
  'To the League, then. 나비할망 will make sure we get there in one piece.': '그럼, 리그로 가자. 나비할망이 우리가 무사히 도착하도록 지켜줄 거야.',
  'You lose. We took it. 나비할망 chose our friend. Maybe she knows something about what you\'d actually do with her.': '넌 졌어. 우리가 차지했지. 나비할망은 우리 친구를 택했어. 어쩌면 네가 그분을 어떻게 할지 뭔가 알고 있는지도 몰라.',
  'The Sunrise Gym is the LAST one. Take this leader down and the League is within reach.': '해돋이 체육관이 마지막이야. 이 관장을 쓰러뜨리면 리그가 코앞이지.',
  'Baekdu Peak? That\'s a story for after we\'ve earned the title. Let\'s go become Champions first.': '백두봉? 그건 우리가 타이틀을 딴 다음 이야기야. 먼저 챔피언이 되러 가자.',
  'Eight badges — you did it. The Onnuri League is waiting; the Scholars\' Road opens from the Capitol now.': '배지 여덟 개 — 해냈구나. 온누리 리그가 기다려. 이제 학자의 길이 소올에서 열려.',
  'Take the leader down, then it\'s straight on to the Onnuri League.': '관장을 쓰러뜨리면, 곧장 온누리 리그로 직행이야.',
  'The Sunrise Gym\'s right there in the plaza — the last badge before the League.': '해돋이 체육관은 바로 저 광장에 있어 — 리그 전 마지막 배지지.',
  'A worthy challenger.': '훌륭한 도전자군.',
  'You battled well…': '잘 싸웠어…',
  'You\'re out of Pokémon! Better luck next time.': '포켓몬이 다 쓰러졌어! 다음엔 더 잘해봐.',

  'Waterfall': '폭포',
  // ── Waterfall City — rival-home / cutscene NPC lines ──
  'We battle. Right here, right now!': '배틀하자. 바로 여기서, 지금 당장!',
  'Oh, it\'s you. You finally got started?': '오, 너구나. 드디어 시작한 거야?',
  'I\'ve been training every day.\nDon\'t expect it to be easy.': '난 매일 훈련해왔어.\n쉬울 거라고 기대하지 마.',
  'My Pokémon will be the strongest.\nCount on it.': '내 포켓몬이 제일 강해질 거야.\n장담하지.',
  'Still here? Go train.': '아직도 여기 있어? 가서 훈련해.',
  'When we battle, I won\'t hold back.': '우리가 배틀할 땐, 봐주지 않을 거야.',
  'I heard you battled near the waterfall.': '폭포 근처에서 배틀했다며.',
  'Don\'t get overconfident.': '너무 자만하지 마.',
  '...What? Stop staring at my trophies.': '...뭐? 내 트로피 그만 쳐다봐.',
  'Go get your own.': '네 것도 가서 따와.',

  // ── Signpost / UI / move labels (auto-added) ──
  'Body Slam': '누르기',
  'Hyper Beam': '파괴광선',
  'Fire Blast': '불대문자',
  'Hydro Pump': '하이드로펌프',
  'Energy Ball': '에너지볼',
  'Leaf Blade': '리프블레이드',
  'Ice Beam': '냉동빔',
  'Close Combat': '인파이트',
  'Brick Break': '깨트리기',
  'Sludge Bomb': '오물폭탄',
  'Poison Jab': '독찌르기',
  'Earth Power': '대지의힘',
  'Brave Bird': '브레이브버드',
  'Air Slash': '에어슬래시',
  'Bug Buzz': '벌레의야단법석',
  'Stone Edge': '스톤에지',
  'Rock Slide': '스톤샤워',
  'Shadow Ball': '섀도볼',
  'Shadow Claw': '그림자할퀴기',
  'Draco Meteor': '유성군',
  'Dragon Pulse': '용의파동',
  'Dark Pulse': '악의파동',
  'Flash Cannon': '러스터캐논',
  'Iron Head': '아이언헤드',
  'Focus Blast': '기합구슬',
  'Wood Hammer': '우드해머',
  'Dazzling Gleam': '매지컬샤인',
  'Aurora Veil': '오로라베일',
  'Bedrock Badge': '기반암 배지',
  'LEADER NOKSAEK': '관장 녹색',
  'Leader Noksaek': '관장 녹색',
  'LEADER NAMSUN': '관장 남순',
  'Leader Namsun': '관장 남순',
  'LEADER SANDOL': '관장 산돌',
  'Leader Sandol': '관장 산돌',
  'LEADER BEONGE': '관장 번개',
  'Leader Beonge': '관장 번개',
  'LEADER YEONA': '관장 여나',
  'Leader Yeona': '관장 여나',
  'LEADER BYEOKSAN': '관장 벽산',
  'LEADER HARANG': '관장 하랑',
  'LEADER JIN': '관장 진',
  'Leader Harang': '관장 하랑',
  'Leader Byeoksan': '관장 벽산',
  'CAPITOL GYM': '소올 체육관',
  'Capitol GYM': '소올 체육관',
  '⛏ QUARRY GYM': '⛏ 채석장 체육관',
  '🌿 LIVING TEMPLE': '🌿 살아있는 사원',
  '🏮 LANTERN STAGE': '🏮 등불 무대',
  '🌊 TIDAL ARENA': '🌊 조수 경기장',
  '⚡ CLIFF OBSERVATORY': '⚡ 절벽 전망대',
  '🔔 FROSTBELL SHRINE': '🔔 서리종 사당',
  '⛰ SUMMIT DOJO': '⛰ 정상 도장',
  '⛏ STONEMASON\'S QUARRY': '⛏ 석공의 채석장',
  'Living Temple Gym': '살아있는 사원 체육관',
  'Lantern Stage Gym': '등불 무대 체육관',
  'Tidal Arena Gym': '조수 경기장 체육관',
  'Sunrise Gym': '해돋이 체육관',
  'Contest Hall': '콘테스트 홀',
  'The Winter Bell': '겨울의 종',
  'Ice Bell': '얼음 종',
  'Snow Guardian': '눈의 수호자',
  'The Bedrock': '기반암',
  'Seven Treasures': '여명',
  'Unquiet Ghograss': '뒤숭숭한 고그라스',
  'Restless Foxgeist': '안절부절 여우령',
  'The Grand Obelisk': '거대한 오벨리스크',
  'The Great Statue': '거대한 석상',
  'Triumphal Arch': '개선문',
  'The Palace': '궁전',
  'Ore Mine': '광석 광산',
  '🏭 Gangcheoldo Steelworks': '🏭 강철도 제철소',
  '⛩ Forest Shrine': '⛩ 숲의 사당',
  '❄ Alpine Lodge': '❄ 고산 산장',
  '♨ Snowmelt Baths': '♨ 눈녹임 온천',
  '🍡 Frost Market': '🍡 서리 시장',
  '⛸ Skate Shop': '⛸ 스케이트 가게',
  '⛸ SKATE LINK': '⛸ 스케이트 연결로',
  'Pokémon Center': '포켓몬 센터',
  'Capitol Tower': '소올 타워',
  'Ancient Palace': '고대 궁전',
  'Central Market': '중앙 시장',
  'Royal Archives': '왕립 기록원',
  'National Assembly Hall': '온누리 국회의사당',
  'Onnuri National Museum': '온누리 국립박물관',
  'State Shrine': '종묘',
  'National Library': '국립도서관',
  'So-ol Central Station': '소올 중앙역',
  '⛩ Scholars\' Road': '⛩ 학자의 길',
  'Han River': '한강',
  'Central Plaza': '중앙 광장',
  'Grand Civic Plaza': '대시민 광장',
  'Residential District': '주거 구역',
  'Royal District': '왕궁 구역',
  'Government Quarter': '관청 가',
  'Museum Promenade': '박물관 거리',
  'Memorial Gardens': '기념 정원',
  'Cultural Ward': '문화 구역',
  'Gym District': '체육관 구역',
  'Commercial District': '상업 구역',
  '🏙 Capitol City': '🏙 소올 시티',
  'So-ol City\n소올 시티 · 온누리의 수도': '소올 시티\n온누리의 수도',
  'Capitol City\n수도시': '소올 시티',
  'Capitol City': '소올 시티',
  ' — Gym District': ' — 체육관 구역',
  ' — Tower Quarter': ' — 타워 구역',
  ' — Commercial': ' — 상업 구역',
  '📖 Jeju Library': '📖 제주 도서관',
  '🏖️ Beach Pavilion': '🏖️ 해변 정자',
  '🍺 Harbor Tavern': '🍺 항구 선술집',
  'Harbor Tavern': '항구 선술집',
  'Beach Pavilion': '해변 정자',
  'Vents Entrance': '분화구 입구',
  'Cheonjiyeon Waterfall': '천지연 폭포',
  'Haenyeo Hot Spring': '해녀 온천',
  'Jeju Library': '제주 도서관',
  'Jeju Market': '제주 시장',
  'Hallasan Gardens': '한라산 정원',
  'Poké Mart': '포켓몬 마트',
  '🚲 Bicycle Shop': '🚲 자전거 가게',
  '🏪 Convenience Store': '🏪 편의점',
  '🌉 Han River': '🌉 한강',
  '⛩ Riverside Pavilion': '⛩ 강변 정자',
  'Store Clerk': '편의점 점원',
  '🏪 CONVENIENCE STORE': '🏪 편의점',
  '🏥 Pokémon Center': '🏥 포켓몬 센터',
  '💻 PC': '💻 PC',
  '🛒 Poké Mart': '🛒 포켓몬 마트',
  'Artist\'s Studio': '화가의 화실',
  '🍢 Tteokbokki Stall': '🍢 떡볶이 노점',
  'Missing Smeargle': '사라진 루브도',
  'Your Home': '우리 집',
  'Minhyuk\'s House': '민혁이네 집',
  'Prof. Song\'s Lab': '송 박사의 연구소',
  'Town Hall': '마을 회관',
  'Central Park': '중앙 공원',
  'Forest Path': '숲길',
  '🪺 Disguijar Nest': '🪺 돌제비 둥지',
  '⛰ Cave Entrance': '⛰ 동굴 입구',
  '🕳 Cave Passage': '🕳 동굴 통로',
  'THE COMPLETE PANTHEON': '완전한 신들',
  '⛰ Songak Mountain': '⛰ 송악산',
  '🌉 Seonjukgyo': '🌉 선죽교',
  '🗼 Lighthouse': '🗼 등대',
  '🔭 Observatory': '🔭 전망대',
  '🐟 Fish Market': '🐟 어시장',
  '🌳 Seaside Park': '🌳 해변 공원',
  'Fish Market': '어시장',
  '🌊 Harbour': '🌊 항구',
  '⛴ West-Sea Barrage': '⛴ 서해 방조제',
  'Supply Hut': '물자 창고',
  '⛩ League Gate': '⛩ 리그 관문',
  '⛩ Rest Pavilion': '⛩ 쉼터 정자',
  '❄ ALPINE LODGE': '❄ 고산 산장',
  '♨ SNOWMELT BATHS': '♨ 눈녹임 온천',
  '🍡 FROST MARKET': '🍡 서리 시장',
  '⛸ SKATE SHOP': '⛸ 스케이트 가게',
  '♨ STEAM POOL': '♨ 온천탕',
  '🍡 LOCAL GOODS': '🍡 특산품',
  '⛸ SKATE RENTAL': '⛸ 스케이트 대여',
  '🔥 WARM HEARTH': '🔥 따뜻한 난로',
  '💧 Cheonjiyeon Waterfall': '💧 천지연 폭포',
  '🔬 Prof. Song': '🔬 송 박사',
  '👑 Champion\'s Hall': '👑 챔피언의 전당',
  '👑 Hwangeum': '👑 황금',
  '👑 Taewang': '👑 태왕',
  '👑 Taewang\'s Throne': '👑 태왕의 왕좌',
  '↓ Gangcheoldo': '↓ 강철도',
  '↑ Muyeonhang': '↑ 무연항',
  '↓ Haesol': '↓ 해솔',
  '↑ Gangcheoldo': '↑ 강철도',
  '↓ back down': '↓ 아래로',
  '↑ higher': '↑ 위로',
  '↓ Haean City': '↓ 해안시',
  '↑ Forest City': '↑ 숲의 도시',
  '↓ Parangpo': '↓ 파랑포',
  '↑ Haesol': '↑ 해솔',
  '→ Dolmoe City': '→ 돌뫼시',
  '↑ Seolbong City': '↑ 설봉시티',
  '↓ Geumgang City': '↓ 금강시',
  '↑ Haean City': '↑ 해안시',
  '↓ Ancient Forest': '↓ 고대 숲',
  '← Waterfall City': '← 폭포시',
  'CAPITOL CITY →': '소올 시티 →',
  '↓ Route 2': '↓ 2번 도로',
  '↓ Capitol City': '↓ 소올 시티',
  '↓ Scholars\' Road': '↓ 학자의 길',
  '↓ Songhyeon': '↓ 송현',
  '↑ Parangpo': '↑ 파랑포',
  '⬇ Jeju City': '⬇ 제주시티',
  '⬆ Summit Trail': '⬆ 정상 등반로',
  '↓ Binghagwan': '↓ 빙하관',
  '↑ Samho': '↑ 삼호',
  '↓ Samho': '↓ 삼호',
  '↓ Forest City': '↓ 숲의 도시',
  '↑ Dolmoe City': '↑ 돌뫼시',
  '↑ Pokémon League': '↑ 포켓몬 리그',
  '↓ Border tunnels': '↓ 국경 터널',
  '↓ Diamond Gorge': '↓ 다이아몬드 협곡',
  '↓ Dolmoe City': '↓ 돌뫼시',
  '↑ Seorae Pass': '↑ 서래 고개',
  '↓ Route 6': '↓ 6번 도로',
  '↓ Seolbong City': '↓ 설봉시티',
  '↑ Geumgang City': '↑ 금강시',
  '↓ Dolmoe Mine': '↓ 돌뫼 광산',
  '↑ Seorae Town': '↑ 서래 마을',
  '↓ Muyeonhang': '↓ 무연항',
  '↑ Binghagwan': '↑ 빙하관',
  '↑ Jeju Vents': '↑ 제주 분화구',
  'Route 6 →': '6번 도로 →',
  '← Coastal Road': '← 해안 도로',
  'Ancient Forest →': '고대 숲 →',
  '↓ Jeju Port': '↓ 제주항',
  '↓ Highland Pass': '↓ 고원 고개',
  'Diamond Gorge →': '다이아몬드 협곡 →',
  '↓ the gate': '↓ 관문',
  '← Ancient Altar': '← 고대 재단',
  '↓ back south': '↓ 남쪽으로',
  '↓ Northern Circuit': '↓ 북부 순환로',
  '⬇ back': '⬇ 뒤로',
  '⬇ Exit': '⬇ 나가기',
  'SPACE — Elevator': 'SPACE — 엘리베이터',
  'SPACE — Talk': 'SPACE — 대화',
  'SPACE — Info': 'SPACE — 안내',
  '🛗  ELEVATOR': '🛗  엘리베이터',
  '🥤  Rooftop Vending': '🥤  옥상 자판기',
  '4F · Souvenirs': '4층 · 기념품',
  'Gift Clerk': '선물 가게 점원',
  'TM Seller': '기술머신 판매원',
  '● LIVE': '● 생방송',
  '▶ YES': '▶ 예',
  '  NO': '  아니오',
  '  YES': '  예',
  '▶ NO': '▶ 아니오',
  '💾 Saved': '💾 저장됨',
  '💾  Game Saved': '💾  게임 저장됨',
  '👟 RUNNING': '👟 달리기',
  '✕ Close': '✕ 닫기',
  '✕ Cancel': '✕ 취소',
  '← BACK': '← 뒤로',
  "Professor Song's Lab": '송 박사 연구소',
  '✚ Pokémon Center': '✚ 포켓몬 센터',
  '✚ Center': '✚ 센터',
  '🛒 Mart': '🛒 마트',
  '🔴 BAG': '🔴 가방',
  '⚠ SAVE FAILED': '⚠ 저장 실패',
  '★ LEAD': '★ 선두',
  'Town Map': '마을 지도',
  'Pokémon Encyclopedia': '포켓몬 도감',
  'Gym Badges': '체육관 배지',
  'Running Shoes': '러닝슈즈',
  'You are here': '현재 위치',
  '✈  FLY': '✈  비행',
  '  FLY  ': '  비행  ',
  ' CANCEL ': ' 취소 ',
  'SPACE  to talk': 'SPACE  대화',
  'SPACE — Enter': 'SPACE — 입장',
  'Old Woodsman': '늙은 나무꾼',
  'Gate Guard': '관문 경비병',
  'Noodle Lover': '국수 애호가',
  'Bathhouse Regular': '목욕탕 단골',
  'Old Sailor': '늙은 뱃사람',
  'Night Crew': '야간 작업조',
  'Foghorn Keeper': '무적 지기',
  'Rail Porter': '철도 짐꾼',
  'Fur Trader': '모피 상인',
  'Ice Fisher': '얼음 낚시꾼',
  'Aurora Watcher': '오로라 관측자',
  'Sovereign Clemont': '군주 클레몬',
  'Admin Chaeyeon': '간부 채연',
  'Professor Song': '송 박사',
  'Champion Hwangeum': '챔피언 황금',
  'Team Suri': '수리단',
  'Ranger Sooyeon': '레인저 수연',
  'Team Suri Grunts': '수리단 조무래기들',
  'Forest Elder': '숲의 어른',
  'Fisher Baram': '낚시꾼 바람',
  'Haegang\'s Disciples': '해강의 제자들',
  'Disciple Miru': '제자 미루',
  'Executive Mubaek': '간부 무백',
  'Gate Captain Seollan': '관문장 설란',
  'Ranger Hyunwoo': '레인저 현우',
  'Skier Yuna': '스키어 유나',
  'Ranger Boram': '레인저 보람',
  'Dock Worker': '부두 인부',
  'Mart Clerk': '마트 점원',
  'Team Suri Admin': '수리단 간부',
  'Team Suri Grunt': '수리단 조무래기',
  'Nurse Joy': '간호사 조이',
  'roof of Korea': '한국의 지붕',
  'Bird\nKeeper': '새기르기',
  'Ace\nTrainer': '엘리트\n트레이너',
  'Steel\nWorker': '제철공',
  'Bug\nCatcher': '벌레잡이\n소년',
  'Aroma\nLady': '아로마\n아가씨',
  'Black\nBelt': '검은띠',
  'Sovereign\nClemont': '군주\n클레몬',
  'Dragon\nTamer': '드래곤\n조련사',
  'Hex\nManiac': '마녀',
  'Executive\nMubaek': '간부\n무백',
  'Scholar\nHyeonu': '학자\n현우',
  'Ace\nDawon': '에이스\n다원',
  'Veteran\nMunseok': '베테랑\n문석',
  'School\nKid': '학교\n학생',
  'Snow\nWorker': '제설\n작업자',
  'Highland\nHerder': '고원\n목동',
  'West\nTower': '서쪽\n탑',
  'East\nTower': '동쪽\n탑',
  'Gate Captain\nSeollan': '관문장\n설란',
  'Team\nSuri': '수리단',
  'Rich\nBoy': '부잣집\n도련님',
  'Ancient\nThrone': '고대의\n왕좌',
  'Ancient\nArtifact': '고대\n유물',
  'Royal\nSword': '왕실의\n검',
  'CITY\nMAP': '도시\n지도',
  'CAN\'T\nRUN': '도망칠 수\n없음',
  'TRAIN\nHARD': '맹훈련',
  '⚡\nHEAL': '⚡\n회복',
  'Potions\n💊': '회복약\n💊',
  'Berries\n🫐': '열매\n🫐',
  'TMs\n📀': '기술머신\n📀',
  'Pokéballs\n🔴': '몬스터볼\n🔴',
  'Keeper\n🔑': '지킴이\n🔑',
  'Disciple\n① Pier': '제자\n① 부두',
  'Disciple\n② Ground': '제자\n② 훈련장',
  'Disciple\n③ Beach': '제자\n③ 해변',
  '▶ SWITCH': '▶ 교체',
  '  STAY IN': '  그대로',

  // ── Long-tail dialogue & world text (auto-added) ──
  'I\'ve climbed this pass a hundred times. My team\'s as hard as the granite up here — let\'s go!': '이 고개는 백 번도 넘게 올랐지. 우리 팀은 여기 화강암만큼 단단해 — 가자!',
  'The thin mountain air separates the strong from the weak. Which are you? Let\'s find out!': '희박한 산 공기는 강한 자와 약한 자를 갈라놓지. 넌 어느 쪽이냐? 지금 알아보자!',
  'My birds ride the updrafts off these cliffs. You\'ll not clip their wings easily!': '내 새들은 이 절벽의 상승기류를 타고 날지. 그 날개를 쉽게 꺾진 못할걸!',
  'WASD: move  SHIFT: run  C: bike  SPACE: talk  M: menu': 'WASD: 이동  SHIFT: 달리기  C: 자전거  SPACE: 대화  M: 메뉴',
  'Watchtower Sentry: You\'ll not cut my searchlight, southerner!': '감시탑 보초: 내 탐조등은 못 끈다, 남쪽 것!',
  '↑ Baekdu Peak — the climb': '↑ 백두봉 — 등반로',
  '⛓ The Iron Gate': '⛓ 철문',
  '⛓ Seolbong Pass — The Garrison Gate': '⛓ 설봉 고개 — 수비대 관문',
  'With the towers dark, the garrison\'s commanding officer plants herself before the iron gate.': '탑들이 어두워지자, 수비대의 지휘관이 철문 앞에 버티고 선다.',
  'Gate Captain Seollan: You\'ve cut my lights and scattered my line. Impressive, for a southerner.': '관문장 설란: 내 불을 끄고 내 대열을 흩어놨군. 남쪽 것치곤 제법이다.',
  'Seollan: But this gate does not open for the likes of you.': '설란: 하지만 이 문은 너 같은 자에게 열리지 않는다.',
  'Seollan: Still here? Then we settle it at the gate.': '설란: 아직도 여기 있나? 그럼 문 앞에서 결판을 내지.',
  'Seollan steps aside from the gate. "The gate is yours. But the mountain will not forgive you the way I have."': '설란이 문 앞에서 비켜선다. "문은 네 것이다. 하지만 산은 내가 그랬듯 너를 용서하지 않을 것이다."',
  'The iron gate grinds open. Beyond it, the snow-swept switchbacks of Baekdu Peak rise into a bruised red sky — and far above, six towers pulse.': '철문이 삐걱이며 열린다. 그 너머로 눈보라 치는 백두봉의 굽잇길이 멍든 듯 붉은 하늘로 솟아오르고 — 저 높이, 여섯 개의 탑이 맥동한다.',
  'Rival: That was just the front door. Whatever\'s waiting up there is worse. ...Let\'s finish it.': '라이벌: 방금 건 그냥 현관이었어. 저 위에서 기다리는 건 더 지독할 거야. ...끝내러 가자.',
  '🌊 Cheonji — Heaven Lake': '🌊 천지 — 하늘 호수',
  '♨ Hot Spring Inn': '♨ 온천 여관',
  'Team Suri Operative: ...So you took the Summit Seal too. The Director is watching you now.': '수리단 요원: ...정상의 증표까지 손에 넣었군. 이제 국장님이 널 지켜보고 있다.',
  'Team Suri Operative: Whatever\'s stirring under Cheonji — stay out of it. That\'s a warning, not a threat.': '수리단 요원: 천지 아래에서 뭐가 꿈틀거리든 — 끼어들지 마라. 위협이 아니라 경고다.',
  'Team Suri Operative: Move along, challenger. Nothing here concerns you.': '수리단 요원: 지나가라, 도전자. 여기엔 네가 상관할 일 없다.',
  'Team Suri Operative: ...The lake? Don\'t mind the lake. The lake minds itself.': '수리단 요원: ...호수? 호수는 신경 쓰지 마라. 호수는 알아서 한다.',
  'Ranger: The gorge road\'s only open to challengers who\'ve earned the Summit Seal. Beat our gym first!': '레인저: 이 협곡 길은 정상의 증표를 얻은 도전자에게만 열려. 우리 체육관부터 이겨!',
  '← LEADER BYEOKSAN →': '← 리더 벽산 →',
  'Byeoksan: I felt you coming up the mountain. Your steps are uneven — you\'re used to flat city roads.': '벽산: 네가 산을 올라오는 걸 느꼈다. 발걸음이 고르지 않아 — 평평한 도시 길에 익숙하구나.',
  'Byeoksan: But there\'s something steady in the rhythm.': '벽산: 하지만 그 리듬엔 뭔가 흔들림 없는 것이 있어.',
  'Snow-capped peaks loom above the treeline. The wind carries the cry of cranes.': '눈 덮인 봉우리들이 수목한계선 위로 어렴풋이 솟아 있다. 바람이 학의 울음을 실어 나른다.',
  'The air is thin and cold — wild Pokémon here are hardened by ice and stone.': '공기는 희박하고 차갑다 — 이곳의 야생 포켓몬은 얼음과 돌로 단련되어 있다.',
  '↓ Pine Needle Town': '↓ 솔잎마을',
  'Ranger Sooyeon: You can\'t restrict this area — it\'s public land! The wild Pokémon habitat here is protected!': '레인저 수연: 이 지역을 통제할 순 없어 — 여긴 공공용지야! 여기 야생 포켓몬 서식지는 보호구역이라고!',
  'Team Suri Grunt A: Team Suri operates under provisional research authority. Stand aside.': '수리단 조무래기 A: 수리단은 임시 연구 권한으로 움직인다. 비켜.',
  'Ranger Sooyeon: Provisional — issued by whom?! You\'ve never shown me a single permit!': '레인저 수연: 임시라니 — 누가 발급한 건데?! 나한테 허가증 한 장 보여준 적 없잖아!',
  'You step between the ranger and the grunts.': '너는 레인저와 조무래기들 사이로 끼어든다.',
  'Rival: Oh, perfect timing. I was getting bored.': '라이벌: 오, 완벽한 타이밍이네. 마침 지루하던 참이었어.',
  'Rival: Two of them, two of us. Let\'s clear this road.': '라이벌: 저쪽 둘, 이쪽 둘. 이 길 치워버리자.',
  'Team Suri Grunt A: ...Hmph. Locals AND tourists now. Fine. Don\'t say we didn\'t warn you.': '수리단 조무래기 A: ...흥. 이제 주민에 관광객까지. 좋아. 경고 안 했다고 하진 마라.',
  'Team Suri Grunt A: Back again? The road stays closed.': '수리단 조무래기 A: 또 왔나? 길은 계속 막혀 있다.',
  'Past the broken gate, the snow-swept switchbacks of Baekdu Peak rise into a bruised red-and-violet sky, crackling with siphoned energy bleeding off the six towers.': '부서진 문 너머로, 눈보라 치는 백두봉의 굽잇길이 멍든 듯 붉고 보랏빛인 하늘로 솟아오르고, 여섯 탑에서 새어 나온 에너지로 하늘이 지직거린다.',
  '🏔 Baekdu Peak — The Final Confrontation': '🏔 백두봉 — 최후의 대결',
  'WASD: move  SHIFT: run  SPACE: talk  M: menu  [0: replay finale]': 'WASD: 이동  SHIFT: 달리기  SPACE: 대화  M: 메뉴  [0: 피날레 다시보기]',
  'Director Suri stumbles down the path to meet you — pale, shaken, the seventh tablet\'s rubbing clutched in her notes.': '수리 국장이 창백하고 떨리는 얼굴로 길을 비틀비틀 내려와 너를 맞는다 — 일곱 번째 석판의 탁본을 수첩에 움켜쥔 채.',
  'At the summit gate, a towering, severe figure blocks the way — an Executive answering only to Ryeo herself.': '정상 관문에서, 우뚝 솟은 준엄한 인물이 길을 막는다 — 오직 려에게만 답하는 간부다.',
  'Rival: Six of them and he still won\'t move? Fine by me. We hold this gate together!': '라이벌: 여섯이나 되는데도 안 비켜? 나야 좋지. 이 문은 같이 지키는 거다!',
  'Executive Mubaek: The gate holds while I stand. Come, then.': '간부 무백: 내가 서 있는 한 이 문은 지켜진다. 그럼, 와라.',
  'Prof. Song (comms): Now — while he\'s calm. This is your chance. End his suffering, or make him yours.': '송 박사 (통신): 지금 — 저 녀석이 잠잠할 때. 이게 네 기회야. 저 고통을 끝내주거나, 네 것으로 만들어.',
  'Prof. Song: You have to SURVIVE. Hold out — keep your team alive — until the moment is right. Then release her.': '송 박사: 넌 반드시 살아남아야 해. 버텨 — 팀을 살려둬 — 때가 올 때까지. 그런 다음 그를 풀어놔.',
  'You steel yourself and weather another wave of Hwanwoong\'s fury...': '너는 마음을 다잡고 환웅의 분노가 몰아치는 또 한 번의 파도를 견뎌낸다...',
  'You burst onto the summit. At the center of the ring of towers, the volcanic lake churns — and Hwanwoong rises, dragging the siphoned power of the captured trio in a thrashing red-and-purple corona around its body.': '너는 정상으로 뛰쳐나간다. 탑들이 이룬 고리 한가운데 화산 호수가 소용돌이치고 — 환웅이 솟아오르며, 붙잡힌 삼신의 빨아들인 힘을 붉고 보랏빛으로 요동치는 코로나처럼 제 몸 주위에 휘감고 있다.',
  'Together, you place the final seventh tablet into the central pedestal. The six towers don\'t shut down — they HARMONIZE.': '함께, 너희는 마지막 일곱 번째 석판을 중앙 받침대에 끼워 넣는다. 여섯 탑은 멈추지 않는다 — 조화를 이룬다.',
  'Loading...': '불러오는 중...',
  '⬇ Return to Jeju City': '⬇ 제주시티로 돌아가기',
  '🚲 Han River Bicycle Shop': '🚲 한강 자전거 대여점',
  'Click a PARTY Pokémon, then a BOX Pokémon to swap them.': '동료 포켓몬을 클릭한 다음, 보관함 포켓몬을 클릭하면 서로 교체돼.',
  'You must keep at least one Pokémon in your party.   ·   ESC to close': '동료에는 최소 한 마리의 포켓몬을 남겨야 해.   ·   ESC로 닫기',
  'Dept. Store (6F)': '백화점 (6층)',
  'Chaeyeon leads the regional restoration — real, patient work. Commander Ryeo and Executive Mubaek are taken into custody. Ryeo says only: "The cause was just. The method was wrong. I know the difference now."': '채연이 지역 복구를 이끈다 — 진짜, 끈기 있는 일. 려 사령관과 간부 무백은 구금된다. 려는 이렇게만 말한다: "대의는 옳았다. 방법이 틀렸다. 이제 그 차이를 안다."',
  '✈ You received HM01 FLY!  Use it from your Bag to teach Fly to a Flying-type — if its moves are full, you choose which to forget.': '✈ HM01 비행을 받았다!  가방에서 사용해 비행타입에게 비행을 가르치자 — 기술이 꽉 찼다면 어떤 걸 잊을지 네가 고른다.',
  'Professor Song hurries across the plaza to meet you as you return home, Champion.': '송 박사가 광장을 가로질러 서둘러 와 집으로 돌아온 너, 챔피언을 맞는다.',
  'Professor Song: The whole region saw it. You did what no one else could — and you never once stopped putting your Pokémon first.': '송 박사: 온 지역이 그걸 봤어. 아무도 해내지 못한 일을 네가 해냈지 — 그리고 넌 단 한 번도 네 포켓몬을 최우선으로 두는 걸 멈추지 않았어.',
  'The Capitol station is packed — the whole region has come to meet the trainer who conquered the Northern League.': '소올 역이 인산인해다 — 북부 리그를 정복한 트레이너를 만나러 온 지역 전체가 모여들었다.',
  'Lanterns drift over the Han River and the whole city stays out until dawn.': '한강 위로 등불이 떠다니고 온 도시가 새벽까지 깨어 있다.',
  '— The next morning —': '— 다음 날 아침 —',
  '📟 Your Pokédex buzzes — an incoming call from Professor Song, back at the lab in Sudo City.': '📟 네 포켓몬 도감이 울린다 — 수도시 연구소에 있는 송 박사에게서 걸려온 전화다.',
  'SPACE — Scholars\' Road → Pokémon League': 'SPACE — 학자의 길 → 포켓몬 리그',
  'ONNURI NEWS — Seolbong Highland': '온누리 뉴스 — 설봉 고원',
  'NEWS: Unusual seismic activity reported near the Seolbong Highland area...': '뉴스: 설봉 고원 부근에서 이례적인 지진 활동이 보고되었습니다...',
  'Rival: That\'s the direction of Route 2. Seolbong Highland — that\'s where Professor Song said the trail leads.': '라이벌: 저건 2번 도로 방향이야. 설봉 고원 — 송 박사가 길이 그리로 이어진다고 했던 곳이지.',
  'Rival: Let\'s see who gets there first. Again.': '라이벌: 누가 먼저 도착하는지 보자. 또 한 번.',
  'WASD: move  SPACE: enter  M: menu  SHIFT: run': 'WASD: 이동  SPACE: 입장  M: 메뉴  SHIFT: 달리기',
  'Jaemin: Leader Jin\'s shadows protect this hall!': '재민: 진 관장님의 그림자들이 이 홀을 지킨다!',
  'Yuna: You\'ll face the true dark here!': '유나: 여기서 진정한 어둠을 마주하게 될 거야!',
  'Merchant: Welcome to the Capitol Central Market!': '상인: 소올 중앙시장에 온 걸 환영해!',
  'Merchant: Best items in the whole city, right here.': '상인: 도시 전체에서 제일 좋은 물건, 바로 여기 있어.',
  'Curator: Perhaps that is why dark-type Pokémon are so common here.': '큐레이터: 아마 그래서 이곳에 악타입 포켓몬이 그렇게 흔한 걸지도 모르죠.',
  '▶  City View — 563m above ground': '▶  도시 전망 — 지상 563m',
  'Historian: This tower stands 563 metres tall.': '역사학자: 이 탑은 563미터 높이로 서 있죠.',
  'Historian: It was built to celebrate the 600th year of the capital.': '역사학자: 수도의 600주년을 기념해 지어졌습니다.',
  'Historian: The shadow beneath it? Some say it never quite disappears...': '역사학자: 그 아래의 그림자요? 어떤 이들은 그게 완전히 사라진 적이 없다고 하죠...',
  'Historian: ...perhaps because of the Gym Leader\'s dark-type Pokémon nearby. Ha!': '역사학자: ...아마 근처 체육관 관장의 악타입 포켓몬 때문일지도. 하하!',
  'WASD: move  SHIFT: run  SPACE: exit  M: menu': 'WASD: 이동  SHIFT: 달리기  SPACE: 나가기  M: 메뉴',
  'Yeomyeong\'s rocks have broken tougher trainers than you. My team\'s carved from the same stone — come on!': '여명의 바위는 너보다 강한 트레이너들도 꺾어놨지. 우리 팀은 같은 돌로 깎여 나왔어 — 덤벼!',
  'My birds nest on the sea cliffs and ride the fog itself. You\'ll not catch them off guard!': '내 새들은 바다 절벽에 둥지를 틀고 안개 자체를 타고 날지. 방심한 틈을 노리진 못할걸!',
  'Camped under the maples all autumn. The wild Pokémon up here don\'t play nice — and neither do mine!': '가을 내내 단풍나무 아래서 야영했지. 여기 야생 포켓몬은 만만치 않아 — 내 포켓몬도 마찬가지고!',
  '🏪 Han River Convenience Store': '🏪 한강 편의점',
  '1F · Entrance & Reception': '1층 · 입구 & 안내',
  '2F · Medicine & Grocery': '2층 · 약품 & 식료품',
  '💊  2F — Medicine & Grocery': '💊  2층 — 약품 & 식료품',
  '3F · TM Corner': '3층 · 기술머신 코너',
  '📀  3F — Technical Machines': '📀  3층 — 기술머신',
  'TM Seller: Broaden your team\'s horizons — teach them a new move.': '기술머신 판매원: 팀의 시야를 넓혀봐 — 새로운 기술을 가르쳐.',
  '🧸  4F — Souvenirs': '🧸  4층 — 기념품',
  '5F · Food Court': '5층 · 푸드코트',
  '🥤  5F — Food Court': '🥤  5층 — 푸드코트',
  'Vendor: Fresh drinks and treats — they perk your Pokémon right up!': '판매원: 신선한 음료와 간식 — 포켓몬 기운이 바로 살아나!',
  '6F · Rooftop Garden': '6층 · 옥상 정원',
  'The vending machine hums. Grab a drink and enjoy the view.': '자판기가 웅웅거린다. 음료를 하나 뽑아 전망을 즐기자.',
  'WASD: move  SPACE: talk / use elevator  M: menu': 'WASD: 이동  SPACE: 대화 / 엘리베이터 이용  M: 메뉴',
  '📋 FLOORS\n1 Reception\n2 Medicine\n3 TMs\n4 Souvenirs\n5 Food Court\n6 Rooftop': '📋 층 안내\n1 안내\n2 약품\n3 기술머신\n4 기념품\n5 푸드코트\n6 옥상',
  '— Balcony over Capitol City —': '— 소올 시티가 내려다보이는 발코니 —',
  'SPACE — Vending machine': 'SPACE — 자판기',
  'Receptionist: Welcome to the Capitol Department Store! Take the elevator up — six floors of everything a trainer needs.': '안내원: 소올 백화점에 오신 걸 환영합니다! 엘리베이터를 타고 올라가세요 — 트레이너에게 필요한 모든 게 여섯 층에 있죠.',
  'Clerk: What can I get you?': '점원: 뭘 도와드릴까요?',
  'Collector: Best view in the capital, isn\'t it? The whole city, laid out like a board.': '수집가: 수도에서 제일 좋은 전망이지, 안 그래? 도시 전체가 판처럼 펼쳐져 있잖아.',
  'Collector: You climbed all the way up? Then you appreciate a good view.': '수집가: 여기까지 다 올라왔다고? 그럼 좋은 전망의 진가를 알겠군.',
  '↑ ↓ select    SPACE go    X cancel': '↑ ↓ 선택    SPACE 확인    X 취소',
  'Child: The moth grandmother watches over Dolmoe! We carved her statues so she\'d never forget us.': '아이: 나비할망이 돌뫼를 지켜봐 주셔! 우린 할망이 우릴 절대 잊지 않도록 석상을 새겼어.',
  'Old Quarryman: This granite\'s older than the kingdoms. It\'ll outlast the next ten, too.': '늙은 석공: 이 화강암은 왕국들보다도 오래됐지. 앞으로 열 왕국은 더 버틸 거야.',
  'WASD: move  SHIFT: run  SPACE: enter / heal  M: menu': 'WASD: 이동  SHIFT: 달리기  SPACE: 입장 / 회복  M: 메뉴',
  'SPACE — Enter the Poké Mart': 'SPACE — 포켓몬 마트 들어가기',
  'SPACE — Enter the Stonemason\'s Quarry': 'SPACE — 석공의 채석장 들어가기',
  'SPACE — Enter the Pokémon Center': 'SPACE — 포켓몬 센터 들어가기',
  'Sandol\'s at the ruins': '산돌은 유적지에 있어',
  '← LEADER SANDOL →': '← 리더 산돌 →',
  '(The leader\'s dais stands empty. A quarry-worker leans on a chisel nearby.)': '(관장의 단상은 비어 있다. 채석장 인부 한 명이 근처에서 끌에 기대어 있다.)',
  'Forty years down these shafts. My Pokémon know every seam of rock. You?': '이 갱도를 사십 년. 내 포켓몬은 바위의 모든 결을 알지. 너는?',
  'Steel in the vein, steel in my team. Try to dent it.': '광맥 속에도 강철, 내 팀에도 강철. 어디 흠집이나 내봐.',
  'You came up through the cave-in? Then you\'re tougher than the last three. Let\'s see.': '무너진 갱을 뚫고 올라왔다고? 그럼 지난 세 명보단 강하겠군. 어디 보자.',
  'You step into the Dolmoe Mine — cold air, dripping stone, the clink of picks far below.': '너는 돌뫼 광산으로 들어선다 — 차가운 공기, 물 떨어지는 바위, 저 아래서 울리는 곡괭이 소리.',
  'A cave-in has sealed the main shaft ahead; the miners say the old cart rail still runs. Ride it up, then detour past the rubble to reach the snow.': '앞쪽 주갱은 붕괴로 막혀 있다. 광부들은 낡은 광차 레일이 아직 다닌다고 한다. 그걸 타고 올라간 뒤, 잔해를 우회해 눈밭에 이르자.',
  '⛏ SPACE: ride the cart': '⛏ SPACE: 광차 타기',
  'WASD: move  SHIFT: run  SPACE: talk/ride  M: menu': 'WASD: 이동  SHIFT: 달리기  SPACE: 대화/탑승  M: 메뉴',
  'The cart clatters to a stop at the upper gallery. The cave-in is just ahead — detour west around it.': '광차가 덜컹거리며 위쪽 갱도에 멈춘다. 붕괴 지점이 바로 앞이다 — 서쪽으로 우회하자.',
  'Sandol: ...So that\'s what they woke. The stone-elder that watches the dead. It won\'t know friend from robber — not while it rages.': '산돌: ...그래서 저것들이 깨운 게 저거였군. 죽은 자를 지키는 돌의 어른. 저것이 분노하는 한 — 친구와 도둑을 가리지 못해.',
  'Sandol: You\'ve the arm to fight. Settle it — soothe the elder, or take it with you. Either way, calm the ancestors\' rest.': '산돌: 넌 싸울 팔이 있지. 끝을 내 — 어른을 달래거나, 데려가거나. 어느 쪽이든 조상의 안식을 진정시켜.',
  'The totem-elder lowers its gaze — and chooses to walk the road at your side. The ruins fall quiet.': '토템 어른이 시선을 낮추고 — 네 곁에서 함께 길을 걷기로 한다. 유적이 고요해진다.',
  'Sandol: Hah. The ancestors\' own watchman, and it goes with YOU. The stones don\'t grant that lightly.': '산돌: 하. 조상의 파수꾼이 하필 너와 함께 가다니. 돌은 그걸 쉽게 내주지 않아.',
  'Sandol: Didn\'t crack, didn\'t run. You stood in front of a woken god and held. That\'s bedrock.': '산돌: 금 가지도, 도망치지도 않았어. 깨어난 신 앞에 서서 버텼지. 그게 바로 기반암이야.',
  'You received ₩4,000 and an Elixir ×2!': '₩4,000과 엘릭서 ×2를 받았다!',
  'Sandol: Challenger. Bad time. These crows are trying to crack open a grave the ancestors sealed for a reason.': '산돌: 도전자. 때가 안 좋아. 이 까마귀들이 조상이 이유가 있어 봉인한 무덤을 깨부수려 하고 있어.',
  'Sandol: I can hold the slab or I can hold them. Not both. So — you drive the diggers off, I keep the stone from breaking.': '산돌: 나는 석판을 지키거나 저것들을 막거나 둘 중 하나야. 둘 다는 못 해. 그러니 — 네가 도굴꾼들을 몰아내, 난 돌이 깨지지 않게 지킬 테니.',
  'Sandol: The Bedrock Badge waits at the Quarry. Earn this first: protect the old stones.': '산돌: 기반암 배지는 채석장에서 기다려. 먼저 이걸 해내: 옛 돌을 지켜.',
  'Sandol: Face the elder at the broken slab. Soothe it or catch it — just end its rage.': '산돌: 부서진 석판 앞에서 어른을 마주해. 달래거나 잡거나 — 그 분노를 끝내기만 해.',
  'Sandol: Two diggers left on the field. Drive them off — I\'ll hold the stone.': '산돌: 벌판에 도굴꾼이 둘 남았어. 몰아내 — 난 돌을 지킬 테니.',
  'Fishmonger: Fresh off the West Sea this morning! ...You want the good stuff, come before the fog.': '생선장수: 오늘 아침 서해에서 막 잡아 왔어! ...좋은 물건 원하면, 안개 끼기 전에 와.',
  'Sluice Keeper: The great barrage holds the tide back, day and night.': '수문지기: 거대한 방조제가 밤낮으로 조수를 막아내지.',
  'Dock Boy: Wanna know a secret? If you Surf out past the quay, there\'s all kinds of Pokémon on the water!': '부두 소년: 비밀 하나 알려줄까? 부두 너머로 파도타기 하면, 물 위에 온갖 포켓몬이 다 있어!',
  'Old Diver: These waters go deep and cold. I\'ve pulled up things down there I don\'t talk about.': '늙은 잠수부: 이 바다는 깊고 차가워. 저 아래서 건져 올린 것들 중엔 입에 담지 않는 것도 있지.',
  'Baekho waits by the pier and Miru at the training ground, here in town. Cheon, the last, trains down at KALMA BEACH — take the shore road off the EAST edge of town (look for the 🏖 sign).': '백호는 부두에서, 미루는 이 마을 훈련장에서 기다려. 마지막 천은 저 아래 칼마 해변에서 훈련하지 — 마을 동쪽 끝의 해안 도로를 타고 가 (🏖 표지를 찾아봐).',
  'Sunbather: Kalma Beach in summer — nothing beats it! Well... maybe a cold drink at the café.': '일광욕객: 여름의 칼마 해변 — 여기만 한 데가 없지! 뭐... 카페에서 마시는 시원한 음료라면 몰라도.',
  'Retired Boxer: Chief Haegang trained me, back in the day.': '은퇴한 복서: 왕년엔 해강 관장님이 날 훈련시켰지.',
  'Hiker: On a clear day you can see the blue shoulder of Mt. Kumgang from the viewpoint. Breathtaking.': '등산가: 맑은 날엔 전망대에서 금강산의 푸른 능선이 보여. 숨이 멎을 정도지.',
  'Beach Vendor: Ice cream! Cold drinks! Get \'em before the tide comes in!': '해변 상인: 아이스크림! 시원한 음료! 밀물 들어오기 전에 사가!',
  'Steelworker: The No. 3 furnace runs day and night again — thanks to you clearing that Steelix from the mine.': '제철공: 3호 용광로가 다시 밤낮으로 돌아가 — 네가 광산의 강철톤을 치워준 덕분이야.',
  'Come by the works, I\'ll show you steel being born.': '제철소에 들러, 강철이 태어나는 걸 보여줄게.',
  'Bathhouse Regular: Aaah, a good soak after a shift at the works. Try it — take your Pokémon in too!': '목욕탕 단골: 아아, 제철소 교대 끝나고 하는 온욕이 최고지. 해봐 — 네 포켓몬도 같이 데리고 들어가!',
  'Miner: The pit road south leads to the ore mine. Watch yourself down there — the deep galleries are no joke.': '광부: 남쪽 갱도 길은 광석 광산으로 이어져. 저 아래선 조심해 — 깊은 갱도는 장난이 아니거든.',
  'On the fog road at the town\'s edge stands the old Fogbound Manor — abandoned for years. Lately a Gengar has nested inside, and from its windows the fog spills out to lead our night crews off the pier. Two boats are lost.': '마을 끝 안개 길에 낡은 안개저택이 서 있어 — 수년째 버려진 곳이지. 요즘 그 안에 팬텀이 둥지를 틀었고, 창문에서 안개가 새어 나와 우리 야간 부두 인부들을 홀려 길을 잃게 해. 배 두 척이 사라졌어.',
  'The manor holds its breath. Then, from the dark, a grin floats up — and the rest of it pours out of the walls.': '저택이 숨을 죽인다. 그러다, 어둠 속에서 히죽이는 웃음이 떠오르고 — 나머지가 벽에서 쏟아져 나온다.',
  'Dockworker Namgil: The fog\'s thick as wool tonight. I unloaded a whole hold of crates and never once saw my own hands.': '부두 인부 남길: 오늘 밤 안개가 양털처럼 짙어. 짐칸 하나를 통째로 내렸는데 내 손조차 한 번도 못 봤다니까.',
  'Fisher: The gulls scream all night, but you never see them through the mist.': '낚시꾼: 갈매기들이 밤새 울어대는데, 안개 너머로는 도무지 보이질 않아.',
  'Harbour Child: Mister! Have you seen the old manor on the fog road?': '항구 아이: 아저씨! 안개 길에 있는 낡은 저택 봤어요?',
  'Merchant: Cargo moves through this port at all the odd hours, friend.': '상인: 이 항구는 온갖 이상한 시각에 화물이 오가지, 친구.',
  'Gull-watcher: When the fog lifts — rare, that — you can see clear to the sea wall.': '갈매기 관찰자: 안개가 걷히면 — 드문 일이지만 — 방파제까지 훤히 보여.',
  'Then it rolls back in, and you\'d swear it was never there at all.': '그러다 다시 밀려들면, 애초에 아무것도 없었던 것처럼 느껴진다니까.',
  'Harbour Warden: Papers, papers... we\'re meant to log every crate through this port.': '항구 감독관: 서류, 서류... 이 항구를 지나는 화물 하나하나 다 기록해야 하는데.',
  'But the fog makes liars of us all. Half the manifests are ghosts.': '하지만 안개가 우릴 다 거짓말쟁이로 만들어. 적하목록 절반이 유령이야.',
  'Take the frozen path to the cave mouth and go DEEP. But mind your footing — the cavern floor is sheer ice; step onto it and you will slide until a boulder stops you. Reach the heart, drive the beast out, then we speak of your exam.': '얼어붙은 길을 따라 동굴 입구로 가서 깊숙이 들어가. 하지만 발밑을 조심해 — 동굴 바닥은 완전한 얼음이라, 발을 디디면 바위가 막아설 때까지 미끄러질 거야. 중심에 다다라 짐승을 몰아낸 다음, 네 시험 얘기를 하자.',
  'But the far span stands unfinished, and no soul has charted what waits out there. One day the trains will run again. Perhaps you will ride the first, Champion.': '하지만 저 먼 구간은 아직 미완성이고, 그 너머에 무엇이 기다리는지 아무도 밝혀낸 적이 없어. 언젠가 열차는 다시 달릴 거야. 어쩌면 네가 그 첫 열차를 타게 될지도, 챔피언.',
  'Skater: When the Amrok freezes solid, we skate clear across it! ...Mind the cracks by the old bridge, though.': '스케이터: 압록강이 꽝꽝 얼면, 우린 그 위를 쭉 가로질러 스케이트를 타! ...그래도 낡은 다리 근처 갈라진 틈은 조심해.',
  'Bundled Elder: Coldest gate in the north, they call Binghagwan. Amrok guards it well. You did him proud out on that ice.': '두꺼운 옷의 노인: 사람들은 빙하관를 북쪽에서 가장 추운 관문이라 부르지. 압록이 잘 지켜. 넌 저 얼음판에서 그를 자랑스럽게 했어.',
  'Lodge Guest: Warm up at the Highland Lodge before you climb. It\'s a long, cold road to the peak.': '산장 손님: 오르기 전에 고원 산장에서 몸을 녹여. 정상까지는 멀고 추운 길이거든.',
  'The current yanks you sideways — a whirlpool!': '물살이 너를 옆으로 홱 잡아챈다 — 소용돌이다!',
  'SPACE: take the exam': 'SPACE: 시험 치르기',
  'Daddy chartered the whole upper deck, but the battling\'s free. Try to scratch my Pokémon!': '아빠가 상갑판 전체를 전세 냈지만, 배틀은 공짜야. 어디 내 포켓몬한테 흠집이나 내봐!',
  'Thirty years on this strait, kid. The sea taught my Pokémon to hit like a rogue wave!': '이 해협에서 삼십 년이다, 꼬맹아. 바다가 내 포켓몬한테 미친 파도처럼 후려치는 법을 가르쳤지!',
  '🌅 Old Dosik waves from the dock. "Tell the old Grandmother an old man from Haean still leaves rice cakes out for her."': '🌅 늙은 도식이 부두에서 손을 흔든다. "해안에서 온 늙은이가 아직도 할망께 떡을 올린다고 전해줘."',
  '🌊 The overnight ferry pulls out as the sun sinks into the western sea.': '🌊 해가 서쪽 바다로 저물 무렵 야간 여객선이 출항한다.',
  'Rival: I\'ve never actually left the mainland before. Now we\'re sailing through the dark to stop a doomsday weapon.': '라이벌: 나 사실 육지를 떠나본 적이 한 번도 없어. 그런데 이제 종말 병기를 막으려고 어둠을 가르며 항해 중이라니.',
  'Rival: I wouldn\'t trade it. For the record. (Spar the deck trainers, then talk to the deckhand at the cargo.)': '라이벌: 그래도 이걸 다른 것과 바꾸진 않을 거야. 분명히 말해두는데. (갑판 트레이너들과 겨룬 다음, 화물칸의 갑판원에게 말을 걸어.)',
  '↓ Disembark — Haean City': '↓ 하선 — 해안시',
  'WASD: move  SPACE: talk  M: menu': 'WASD: 이동  SPACE: 대화  M: 메뉴',
  'Deckhand Mira: We need trainers! A squall hit early — the cargo nets snapped!': '갑판원 미라: 트레이너가 필요해! 돌풍이 일찍 몰아쳐서 — 화물 그물이 끊어졌어!',
  'Deckhand Mira: Wild Pokémon got blown aboard and they\'re thrashing across the foredeck!': '갑판원 미라: 야생 포켓몬이 배 위로 날아 들어와 앞갑판을 마구 휘젓고 있어!',
  'Deckhand Mira: If they damage the hull lines we\'re in real trouble. Drive them back!': '갑판원 미라: 저것들이 선체 밧줄을 손상시키면 정말 큰일이야. 몰아내 줘!',
  'Rival: You had me at \'real trouble.\' The forward deck\'s crawling — let\'s go.': '라이벌: \'정말 큰일\'이라는 말에 넘어갔어. 앞갑판이 우글거리네 — 가자.',
  '(Storm-blown Pokémon now appear on the misty foredeck. Push through to the bow.)': '(폭풍에 휩쓸린 포켓몬들이 이제 안개 낀 앞갑판에 나타난다. 뚫고 나가 뱃머리로 가자.)',
  '⛈️ A critical hull line whips loose in the wind!': '⛈️ 중요한 선체 밧줄 하나가 바람에 풀려 채찍처럼 날뛴다!',
  'Together, you send out your lead and the Rival sends his starter — you HAUL the snapped line back into its cleat.': '함께, 너는 선두 포켓몬을 내보내고 라이벌은 자신의 스타팅 포켓몬을 내보낸다 — 너희는 끊어진 밧줄을 다시 고정쇠로 끌어당긴다.',
  'Secured. The boat steadies and rides out the squall.': '고정 완료. 배가 안정을 되찾고 돌풍을 무사히 넘긴다.',
  'Deckhand Mira: Three years on this route and I\'ve never seen passengers do THAT.': '갑판원 미라: 이 항로에서 삼 년인데, 승객이 저런 걸 하는 건 처음 봐.',
  'Deckhand Mira: Here — found it wedged in the cargo. You earned it more than the shipping company did.': '갑판원 미라: 자 — 화물 사이에 끼어 있는 걸 찾았어. 운송회사보다 네가 더 받을 자격이 있지.',
  '💧 Received Mystic Water and ⭐ Big Pearl ×2!': '💧 신비의물방울과 ⭐ 큰진주 ×2를 받았다!',
  'Rival: Get some sleep. For real this time. We land at dawn.': '라이벌: 잠 좀 자. 이번엔 진짜로. 새벽에 도착하니까.',
  '(The bow is clear — disembark to the north when you\'re ready.)': '(뱃머리가 정리됐다 — 준비되면 북쪽으로 하선해.)',
  '↑ Disembark — Jeju Vents': '↑ 하선 — 제주 분화구',
  'Heeheehee... the manor whispered you\'d come. It so wants to keep you. Won\'t you play with my spirits first?': '히히히... 저택이 네가 올 거라고 속삭였어. 널 정말 붙잡아두고 싶어 해. 먼저 내 혼령들과 놀아주지 않을래?',
  'As Medium Yeong\'s spirits scatter, a cold iron key slips from her sleeve and rings on the floor.': '영매 영의 혼령들이 흩어지자, 차가운 쇠열쇠가 그녀의 소매에서 빠져나와 바닥에 쨍그랑 떨어진다.',
  'WASD move  SPACE act  M menu   ·   Find the Fog-Wraith in the séance hall': 'WASD 이동  SPACE 행동  M 메뉴   ·   강령술 홀에서 안개 망령을 찾아라',
  'A wave of cold fog rolls out — and deep within, something is grinning.': '차가운 안개의 물결이 밀려 나오고 — 그 깊은 곳에서, 무언가가 히죽이고 있다.',
  'SPACE — Face the Fog-Wraith': 'SPACE — 안개 망령과 대면',
  '📟 Your Pokédex chirps — a guardian signal you know well.': '📟 네 포켓몬 도감이 삑 울린다 — 네가 잘 아는 수호자의 신호다.',
  '↑ Route 6 · Dolmoe City': '↑ 6번 도로 · 돌뫼시',
  'Forest Elder: You wish to walk the southern road once more?': '숲의 어른: 남쪽 길을 다시 한번 걷고 싶으냐?',
  'Forest Elder: Then I shall set the Grandmother free again, that she may test a worthy guardian anew.': '숲의 어른: 그렇다면 할망을 다시 풀어드리마, 합당한 수호자를 새로이 시험하실 수 있도록.',
  '(The voyage to Jeju restarts — your team sails from Haean once more.)': '(제주로의 항해가 다시 시작된다 — 네 팀이 해안에서 또 한 번 출항한다.)',
  '← KEEPER NOKSAEK →': '← 지킴이 녹색 →',
  '(An old keeper rises from the living dais, bark-skinned and calm.)': '(늙은 지킴이가 살아 있는 단상에서 일어선다, 나무껍질 같은 피부에 고요한 모습으로.)',
  'A monk calls softly: "Heart first, then Dusk, then Dawn. Let the old lullaby lead you."': '한 스님이 나직이 부른다: "마음 먼저, 그다음 황혼, 그다음 새벽. 옛 자장가가 너를 이끌게 하라."',
  'The three bells answer as one — a warm, wooden pulse rolls through the shrine.': '세 개의 종이 하나로 답한다 — 따뜻하고 나무 같은 울림이 사당을 타고 퍼진다.',
  'Monk: Calm the two guardians. Then ring the bells in the old lullaby — Heart, Dusk, Dawn — to open the way.': '스님: 두 수호자를 진정시켜라. 그런 다음 옛 자장가로 종을 울려라 — 마음, 황혼, 새벽 — 길을 열도록.',
  'Monk: The forest breathes easy again. The rhythm is safe — with you, and with the spirit that loved it.': '스님: 숲이 다시 편히 숨 쉰다. 리듬은 안전하다 — 너와 함께, 그리고 그것을 사랑한 정령과 함께.',
  'Monk: Rest here whenever the road wearies you. The shrine is open to you always.': '스님: 길이 지칠 때면 언제든 여기서 쉬어라. 사당은 언제나 네게 열려 있다.',
  'Monk: Calm the two guardian-spirits first. They cannot hear reason until the drum returns.': '스님: 먼저 두 수호 정령을 진정시켜라. 북이 돌아오기 전까진 그들이 이치를 듣지 못한다.',
  'Monk: Now the bells. The old lullaby: Heart, then Dusk, then Dawn.': '스님: 이제 종이다. 옛 자장가: 마음, 그다음 황혼, 그다음 새벽.',
  'Monk: The gate is open. Go gently — grief is a frightened thing.': '스님: 문이 열렸다. 조심히 가라 — 슬픔은 겁먹은 것이니.',
  'A small wooden drum-spirit hovers over the altar, tapping a slow, lonely beat.': '작은 나무 북 정령이 제단 위를 맴돌며, 느리고 외로운 박자를 두드린다.',
  'Monk (from the aisle): It is the old master\'s grief given shape. When he passed, none kept the rhythm — so IT did, alone, all these years.': '스님 (통로에서): 그것은 형체를 얻은 옛 스승의 슬픔이다. 그가 떠났을 때 아무도 리듬을 잇지 않았지 — 그래서 그것이, 홀로, 이 오랜 세월을 이어온 것이다.',
  'Monk: It will not surrender the drum willingly. Free it the only way a trainer can — meet it, and let it choose you.': '스님: 그것은 북을 순순히 내놓지 않을 것이다. 트레이너만이 할 수 있는 방법으로 풀어주어라 — 그것과 마주하고, 그것이 너를 택하게 하라.',
  'The moktak\'s spirit has chosen to walk with you — its rhythm now beats at your side.': '목탁의 정령이 너와 함께 걷기로 했다 — 이제 그 리듬이 네 곁에서 뛴다.',
  'The monks bow deeply. "Then the lullaby is not lost. It simply found new hands."': '스님들이 깊이 절한다. "그렇다면 자장가는 사라지지 않았구나. 그저 새로운 손을 찾았을 뿐."',
  'A monk lifts the drum and begins the old, slow beat. All through the shrine, the tension unwinds.': '한 스님이 북을 들어 올려 옛, 느린 박자를 시작한다. 사당 곳곳에서 긴장이 풀려나간다.',
  'The Ancient Forest exhales. Far off, the lashing vines go still.': '고대 숲이 숨을 내쉰다. 저 멀리, 후려치던 덩굴들이 잠잠해진다.',
  'Head Monk: You have given the forest back its sleep. Take this, with the temple\'s thanks.': '주지 스님: 그대는 숲에 다시 잠을 되돌려주었다. 이걸 받아라, 절의 감사와 함께.',
  'You received ₩3,000, 3 Ultra Balls and an Elixir!': '₩3,000, 하이퍼볼 3개와 엘릭서를 받았다!',
  'Rival: A Fairy-type gym runs the Lantern Stage here. Win the badge — then we keep moving south.': '라이벌: 여기 페어리타입 체육관이 랜턴 무대를 운영해. 배지를 따 — 그런 다음 계속 남쪽으로 가자.',
  'Team Suri Admin Chaeyeon: A trainer who keeps turning up at our digs. You\'ve earned a proper test.': '수리단 간부 채연: 우리 발굴지에 자꾸 나타나는 트레이너로군. 제대로 된 시험을 받을 자격이 있어.',
  'Admin Chaeyeon: Show me whether you\'re worth worrying about.': '간부 채연: 걱정할 가치가 있는 상대인지 어디 보여줘.',
  'Rival: Heading out already? Not before this.': '라이벌: 벌써 떠나려고? 이거 하기 전엔 안 돼.',
  'Rival: I\'ve watched how you fight. Let\'s see if you\'ve actually improved — or just gotten lucky.': '라이벌: 네가 어떻게 싸우는지 지켜봤어. 정말 실력이 는 건지 — 아니면 그냥 운이 좋았던 건지 어디 보자.',
  'Junho: A Fairy\'s charm hides an iron will. Mind the steel under the sparkle.': '준호: 페어리의 매력엔 강철 같은 의지가 숨어 있지. 반짝임 아래의 강철을 조심해.',
  '← LEADER NAMSUN →': '← 리더 남순 →',
  '(A performer in flowing, lantern-lit robes glides to center stage.)': '(하늘거리는, 등불 밝힌 의상을 걸친 공연자가 무대 중앙으로 미끄러지듯 나온다.)',
  'Use which item?': '어떤 도구를 사용할까?',
  'No usable items. Buy some at a Poké Mart!': '쓸 수 있는 도구가 없어. 포켓몬 마트에서 좀 사와!',
  'Leader Jin: Welcome to my domain of shadows.': '리더 진: 내 그림자의 영역에 온 걸 환영해.',
  'Leader Jin: Darkness is not weakness — it is depth.': '리더 진: 어둠은 나약함이 아니야 — 그건 깊이지.',
  'Super effective!': '효과가 굉장했다!',
  'Not very effective...': '효과가 별로인 듯하다...',
  'Leader Jin: Now... my pride. Go, Corrpanda!': '리더 진: 이제... 내 자랑이야. 가랏, Corrpanda!',
  'Leader Jin: Rest and recover. Your spirit is strong.': '리더 진: 쉬면서 회복해. 네 정신은 강하구나.',
  'Leader Jin: ...You defeated Corrpanda.': '리더 진: ...Corrpanda를 쓰러뜨렸구나.',
  'Leader Jin: Your light was stronger than my shadows.': '리더 진: 네 빛이 내 그림자보다 강했어.',
  'Leader Jin: You have earned the Shadow Badge.': '리더 진: 넌 그림자 배지를 손에 넣었어.',
  'Congratulations! Shadow Badge obtained! 🏅': '축하해! 그림자 배지를 획득했다! 🏅',
  'Received: TM — Dark Pulse!  (Check your Bag to teach it.)': '받았다: 기술머신 — 악의파동!  (가방에서 가르칠 수 있어.)',
  'Capitol City\'s secrets are now open to you. Journey on, trainer.': '이제 소올 시티의 비밀이 네게 열렸어. 계속 나아가, 트레이너.',
  'Gulls wheel over the masts. The Tidal Arena juts out over the harbour.': '돛대 위로 갈매기가 맴돈다. 조수 경기장이 항구 위로 튀어나와 있다.',
  'Your Pokédex buzzes — it\'s Professor Song.': '네 포켓몬 도감이 울린다 — 송 박사다.',
  'Prof. Song: You earned the Tidekeeper Badge — well done. But drop everything and come back to Sudo City.': '송 박사: 물지기 배지를 땄구나 — 잘했어. 하지만 다 제쳐두고 수도시로 돌아와.',
  'Rival: Express boat\'s at the dock. Let\'s move.': '라이벌: 부두에 쾌속선이 있어. 움직이자.',
  '🌊 SPACE — Surf out to sea': '🌊 SPACE — 바다로 파도타기',
  'Rival: Haggling for a fresh-caught water Pokémon. The market here is unreal.': '라이벌: 갓 잡은 물 포켓몬을 두고 흥정 중이야. 여기 시장은 정말 굉장해.',
  'Old Dosik: So the shadow-people struck at the Jeju vents. My ferry\'s fueled and waiting at the pier.': '늙은 도식: 그래서 그림자 무리가 제주 분화구를 쳤군. 내 여객선은 연료를 채우고 부두에서 기다리고 있어.',
  'Sail out to the Jeju vents now?': '지금 제주 분화구로 출항할까?',
  'Old Dosik: The sea\'s been restless lately. Mind yourself out there, child.': '늙은 도식: 요즘 바다가 사나워. 저 밖에선 몸조심해, 아이야.',
  'Old Dosik: You two have been chasing these shadow-people across half the peninsula.': '늙은 도식: 너희 둘은 이 그림자 무리를 반도 절반이나 쫓아다녔지.',
  'Old Dosik: I\'m too old to fight. But my son worked for the League\'s research division before he passed.': '늙은 도식: 난 너무 늙어서 싸우진 못해. 하지만 내 아들이 세상 뜨기 전에 리그 연구부서에서 일했지.',
  'Old Dosik: He left me this — said it could catch anything. Even something that doesn\'t want to be caught.': '늙은 도식: 그 애가 이걸 남겼어 — 뭐든 잡을 수 있다더군. 잡히기 싫어하는 것까지도.',
  '🎯 You received a MASTER BALL!': '🎯 마스터볼을 받았다!',
  'Old Dosik: One of a kind. I\'ve kept it ten years waiting for a reason. You\'re the reason. Use it when it matters.': '늙은 도식: 세상에 하나뿐이지. 이유가 생기길 기다리며 십 년을 간직했어. 네가 그 이유야. 중요한 순간에 써.',
  '← LEADER HARANG →': '← 리더 하랑 →',
  '(A weathered figure stands on the dais as the tide laps at the platform.)': '(조수가 단상을 찰싹이는 가운데, 풍파에 시달린 인물이 단 위에 서 있다.)',
  '♨ Haenyeo Hot Spring': '♨ 해녀 온천',
  '🏔️ Hallasan Alpine Gardens': '🏔️ 한라산 고산 정원',
  'Furnace won\'t light till that beast\'s dealt with. Prove you\'re up to it — battle me!': '저 짐승을 처리하기 전엔 용광로에 불이 안 붙어. 감당할 수 있는지 증명해 — 나랑 배틀하자!',
  'WASD move  SPACE act  M menu   ·   Subdue the Steelix in the deep gallery': 'WASD 이동  SPACE 행동  M 메뉴   ·   깊은 갱도의 강철톤을 제압하라',
  'SPACE — Subdue the Steelix': 'SPACE — 강철톤 제압하기',
  'WASD: move  SPACE: talk  C: bike  M: menu': 'WASD: 이동  SPACE: 대화  C: 자전거  M: 메뉴',
  'Welcome to the world of Pokémon!': '포켓몬의 세계에 온 걸 환영해!',
  'Gateway to the volcanic vents': '화산 분화구로 가는 관문',
  'Sanbangsan — sacred peak shrine of the island spirits': '산방산 — 섬 정령들의 성스러운 봉우리 사당',
  'Sailors gather here to share tales': '선원들이 이야기를 나누러 모이는 곳',
  'Heal your Pokémon here': '여기서 포켓몬을 회복하자',
  'Buy supplies and items': '물자와 도구를 사자',
  'Crystal falls flowing into emerald pools': '에메랄드빛 웅덩이로 흘러드는 수정 폭포',
  'Geothermal baths blessed by the diver women': '해녀들의 축복을 받은 지열 온천',
  'Ancient texts and island history': '고대 문헌과 섬의 역사',
  'Traditional market — rare herbs and souvenirs': '전통 시장 — 희귀한 약초와 기념품',
  'Legendary alpine garden paths': '전설적인 고산 정원 길',
  'Rest spot overlooking the black-sand beach': '검은 모래 해변이 내려다보이는 쉼터',
  '⬆ Vents & Summit Trail': '⬆ 분화구 & 정상 등반로',
  '⬇ Black-Sand Beach → Ferry': '⬇ 검은모래 해변 → 여객선',
  'WASD: move  SHIFT: run  SPACE: enter  M: menu': 'WASD: 이동  SHIFT: 달리기  SPACE: 입장  M: 메뉴',
  '🏪 Jeju Traditional Market': '🏪 제주 전통시장',
  '🌅 You step off the ferry onto the black-sand dock. Sulfur hangs on the dawn wind.': '🌅 너는 여객선에서 내려 검은 모래 부두에 발을 딛는다. 새벽 바람에 유황 냄새가 감돈다.',
  'Rival: Heal up, grab supplies, and let\'s go. The trail north leads straight up the vents.': '라이벌: 회복하고, 물자 챙기고, 가자. 북쪽 등반로는 분화구로 곧장 올라가.',
  '↑ Vent Trail (the climb)': '↑ 분화구 등반로 (오르막)',
  '↓ Ferry → back to Haean City': '↓ 여객선 → 해안시로 돌아가기',
  'Dock Worker: Nobody climbs that fast without a reason. The summit\'s no place for tourists — mind the lava.': '부두 인부: 이유 없이 그렇게 빨리 오르는 사람은 없지. 정상은 관광객이 갈 곳이 아니야 — 용암을 조심해.',
  'Commander Ryeo: No. They don\'t. (She turns and walks down the mountain, alone.)': '려 사령관: 그래. 안 오르지. (그는 돌아서서 홀로 산을 내려간다.)',
  '⛰ Summit — the Vents': '⛰ 정상 — 분화구',
  'Commander Ryeo: Hold it. HOLD IT.': '려 사령관: 멈춰. 멈추라고.',
  'Commander Ryeo: ...Impossible. She was never going to be a battery. She\'s not a tool. We were wrong about what she was. (She orders a retreat.)': '려 사령관: ...말도 안 돼. 그는 애초에 동력원이 될 존재가 아니었어. 도구가 아니야. 우린 그가 무엇인지 잘못 알고 있었어. (그는 후퇴를 명령한다.)',
  'Prof. Song (comms): She\'s frightened, and testing you. The old texts say she binds only to a guardian she deems worthy of protecting the south.': '송 박사 (통신): 그는 겁먹은 채 너를 시험하고 있어. 옛 문헌에 따르면 그는 남쪽을 지킬 자격이 있다고 여기는 수호자에게만 마음을 맡긴대.',
  'Prof. Song: Your Master Ball — this is the moment Dosik meant. Weaken her first, then throw it.': '송 박사: 네 마스터볼 — 이게 바로 도식이 말한 그 순간이야. 먼저 그를 약하게 만든 다음, 던져.',
  '🌋 Jeju Vents Portal': '🌋 제주 분화구 관문',
  'WASD: move  SHIFT: run  M: menu': 'WASD: 이동  SHIFT: 달리기  M: 메뉴',
  'My deer graze this whole plateau, from lake to larch. They fear neither cold nor stranger — let\'s see if you do!': '내 사슴들은 이 고원 전체를, 호수에서 낙엽송까지 누비며 풀을 뜯지. 추위도 낯선 이도 두려워하지 않아 — 너는 어떤지 보자!',
  'This is the roof of the whole country — 1,300 metres up. The air\'s thin, but my resolve is not. Battle me!': '여긴 온 나라의 지붕이야 — 1,300미터 위. 공기는 희박해도 내 각오는 그렇지 않지. 나랑 배틀하자!',
  'True or false: a Water-type move is super-effective against a Ground-type Pokémon.': '참 또는 거짓: 물타입 기술은 땅타입 포켓몬에게 효과가 굉장하다.',
  'True or false: an Electric-type move deals normal damage to a Ground-type Pokémon.': '참 또는 거짓: 전기타입 기술은 땅타입 포켓몬에게 보통의 데미지를 준다.',
  'A robed inspector waits on its steps, hands folded. This is the first of the north\'s eight tests.': '예복 차림의 심사관이 계단 위에서 두 손을 맞잡고 기다린다. 이것이 북부의 여덟 시험 중 첫 번째다.',
  'Hyeon: Answer three questions truly. A Champion should understand the world they battle in. Consider each one.': '현: 세 가지 질문에 진실되게 답하라. 챔피언이라면 자신이 싸우는 세계를 이해해야 하지. 하나하나 잘 생각해봐라.',
  'SPACE: take the Songhyeon exam': 'SPACE: 송현 시험 치르기',
  'Hyeon: Reflect on the type-lore of this world, and present yourself to me again.': '현: 이 세계의 타입 지식을 되새긴 다음, 다시 내 앞에 서라.',
  '     ( ▶YES = true  /  NO = false )': '     ( ▶예 = 참  /  아니오 = 거짓 )',
  'Hyeon: ...Correct.': '현: ...정답이다.',
  'Hyeon: ...No. Mark that error, and reason more carefully.': '현: ...아니다. 그 오류를 새기고, 더 신중히 헤아려라.',
  'Veteran: I\'ve stood in this courtyard four times. Reached the Champion twice. Never beat him.': '베테랑: 난 이 뜰에 네 번 섰지. 챔피언까지 두 번 올랐고. 한 번도 그를 못 이겼어.',
  'Veteran: Hwangeum kneels to his Pokémon before he stands. Win or lose. That\'s the trainer you have to surpass.': '베테랑: 황금은 일어서기 전에 자기 포켓몬에게 무릎을 꿇어. 이기든 지든. 네가 뛰어넘어야 할 트레이너가 바로 그런 사람이야.',
  'Reporter: Onnuri News, live from the League steps! You — you came down from Baekdu Peak, didn\'t you?': '기자: 온누리 뉴스, 리그 계단에서 생방송입니다! 당신 — 백두봉에서 내려오셨죠, 그렇죠?',
  'Reporter: The whole region is watching. If you take the title today, you\'ll be the trainer who healed the land AND became Champion. Some story!': '기자: 온 지역이 지켜보고 있습니다. 오늘 타이틀을 차지하면, 땅을 치유하고 챔피언까지 된 트레이너가 되는 거죠. 굉장한 이야깃거리예요!',
  'Beyond the summit gate, the road opens onto a vast stone courtyard.': '정상 관문 너머로, 길이 드넓은 돌 안뜰로 이어진다.',
  'The Onnuri Pokémon League rises before you — a great palace hall in the old style, its tiered roofs sweeping skyward, eaves bright with dancheong, vermilion pillars catching the light.': '온누리 포켓몬 리그가 네 앞에 솟아 있다 — 옛 양식의 거대한 궁궐 전각, 층층이 겹친 지붕이 하늘로 치켜 올라가고, 처마는 단청으로 밝고, 주홍빛 기둥이 빛을 받는다.',
  'Cross the courtyard and climb the steps. The Elite Four and the Champion wait within.': '안뜰을 가로질러 계단을 올라라. 사천왕과 챔피언이 안에서 기다린다.',
  '⬆ THE POKÉMON LEAGUE': '⬆ 포켓몬 리그',
  '🏯 The Pokémon League': '🏯 포켓몬 리그',
  'SPACE — Enter the Pokémon League': 'SPACE — 포켓몬 리그 입장',
  'SPACE — Access the Storage PC': 'SPACE — 보관 PC 접속',
  'Veteran: You did it. You actually beat him. Four times I stood in this courtyard and never could.': '베테랑: 해냈군. 정말로 그를 이겼어. 난 이 뜰에 네 번을 섰어도 결코 못 했는데.',
  'Veteran: The trainer who finally surpassed Hwangeum... I\'m glad I lived to see it. Congratulations, Champion.': '베테랑: 마침내 황금을 뛰어넘은 트레이너라... 살아서 보게 되어 기뻐. 축하하네, 챔피언.',
  'Reporter: Onnuri News, LIVE — we have a NEW CHAMPION, and you saw it here first!': '기자: 온누리 뉴스, 생방송입니다 — 새로운 챔피언이 탄생했고, 여러분은 여기서 가장 먼저 보셨습니다!',
  'Reporter: From Baekdu Peak to the throne of the League — the trainer who healed the land now wears the crown. What a day for the region!': '기자: 백두봉에서 리그의 왕좌까지 — 땅을 치유한 트레이너가 이제 왕관을 씁니다. 지역에 참으로 대단한 날이에요!',
  'Receptionist: Champion! It is an honour to have you back. Your team is enshrined in the Hall of Fame.': '안내원: 챔피언님! 다시 모시게 되어 영광입니다. 당신의 팀은 명예의 전당에 모셔져 있어요.',
  'Receptionist: The whole region heard the news. Whenever you wish to defend your title, the halls are open to you.': '안내원: 온 지역이 소식을 들었습니다. 타이틀을 방어하고 싶으실 때면 언제든 전당은 열려 있어요.',
  'Receptionist: All four of the Elite Four — defeated. Only the Champion remains beyond the final hall.': '안내원: 사천왕 네 명 모두 — 격파. 이제 마지막 전각 너머엔 챔피언만 남았습니다.',
  'Receptionist: Heal here, steady yourself, and walk through. Hwangeum is waiting at the throne.': '안내원: 여기서 회복하고, 마음을 다잡고, 걸어 들어가세요. 황금이 왕좌에서 기다리고 있어요.',
  'Receptionist: Remember, each hall restores your team before the match. Press on, challenger.': '안내원: 각 전각은 대결 전에 팀을 회복시켜 드려요. 계속 나아가세요, 도전자님.',
  'Receptionist: Welcome, challenger, to the Onnuri Pokémon League.': '안내원: 어서 오세요, 도전자님, 온누리 포켓몬 리그에.',
  'Receptionist: Beyond these doors wait the Elite Four — Gyeoul, Hwageum, Baram, and Saleum — and then the Champion, Hwangeum.': '안내원: 이 문 너머엔 사천왕이 기다립니다 — 겨울, 화금, 바람, 그리고 사름 — 그다음엔 챔피언 황금이 있죠.',
  'Receptionist: Each hall restores your team to full before its match, so battle freely. Stock up at the Mart, then climb. Good luck.': '안내원: 각 전각은 대결 전에 팀을 완전히 회복시켜 드리니 마음껏 싸우세요. 마트에서 물자를 채운 다음, 올라가세요. 행운을 빌어요.',
  'Nurse: Welcome to the League Pokémon Center.': '간호사: 리그 포켓몬 센터에 오신 걸 환영합니다.',
  'Nurse: Your Pokémon are fully healed. We hope to see your name in the Hall of Fame!': '간호사: 포켓몬이 완전히 회복됐어요. 명예의 전당에서 당신의 이름을 보길 바랄게요!',
  '🏪  POKÉ MART  🏪': '🏪  포켓몬 마트  🏪',
  'Mart Clerk: Welcome to the Poké Mart! What can I get you?': '마트 점원: 포켓몬 마트에 오신 걸 환영합니다! 뭘 도와드릴까요?',
  'which move to forget?': '어떤 기술을 잊게 할까?',
  '💾 SAVED!': '💾 저장했다!',
  'You have no Pokémon yet.\nVisit Prof. Song\'s Lab to choose your starter!': '아직 포켓몬이 없어.\n송 박사의 연구소에 가서 파트너를 골라!',
  'Tap a Pokémon to make it your lead (first in battle).': '포켓몬을 탭하면 선두(배틀 첫 번째)로 지정할 수 있어.',
  'See the region and where you are.': '지역과 네 위치를 확인하자.',
  ' Fly between cities.': '도시 사이를 비행으로 이동하자.',
  'Browse every Pokémon you have seen and caught.': '네가 본 포켓몬과 잡은 포켓몬을 모두 둘러보자.',
  ' Tap to teach.': '탭하면 가르쳐.',
  'Hold SHIFT to run fast.': 'SHIFT를 누르면 빠르게 달려.',
  'Which move should it forget?': '어떤 기술을 잊게 할까?',
  'WASD move  SHIFT run  SPACE act  M menu   ·   Surf out to the Gyarados, dodge the whirlpools!': 'WASD 이동  SHIFT 달리기  SPACE 행동  M 메뉴   ·   갸라도스에게 파도타기로 나가, 소용돌이를 피해!',
  'SPACE — Confront the Gyarados': 'SPACE — 갸라도스와 대면',
  'A / TAP — Confront the Gyarados': 'A / 터치 — 갸라도스와 대면',
  'Seorak: First of the Northern Elite. My mountains have stood since before your peninsula had a name.': '설악: 북부 사천왕의 첫째다. 내 산들은 네 반도에 이름이 붙기도 전부터 서 있었지.',
  'Hanseol: The northern winter never ends. Neither does my patience.': '한설: 북쪽의 겨울은 끝나지 않아. 내 인내도 마찬가지고.',
  'Cheolgang: Fortress-forged discipline. My steel does not bend, and it does not tire.': '철강: 요새에서 벼려진 규율이지. 내 강철은 휘지 않고, 지치지도 않아.',
  'Baekho: The white tiger of the north. Last gate before the throne.': '백호: 북쪽의 백호다. 왕좌 앞 마지막 관문이지.',
  'Taewang: So. The little southern peninsula finally sends someone who climbed all the way to my throne. Hwangeum never did.': '태왕: 그래. 그 작은 남쪽 반도가 마침내 내 왕좌까지 올라온 자를 보냈군. 황금은 끝내 못 왔지.',
  'Inside, the palace is severe and almost bare — grey granite the height of a canyon, red state banners hanging in the still, cold air, a single gold star burning above the distant throne.': '안으로 들어서니 궁전은 준엄하고 거의 텅 비어 있다 — 협곡 높이의 잿빛 화강암, 고요하고 차가운 공기 속에 걸린 붉은 국기, 멀리 왕좌 위에서 타오르는 단 하나의 금별.',
  '↓ Back to the plaza': '↓ 광장으로 돌아가기',
  'WASD: move  SPACE: challenge  M: menu': 'WASD: 이동  SPACE: 도전  M: 메뉴',
  'Taewang: Until now.': '태왕: 지금까지는 말이지.',
  '🏆 Your team is recorded in the Northern Hall of Fame — the first southern names ever set in this stone!': '🏆 네 팀이 북부 명예의 전당에 기록되었다 — 이 돌에 새겨진 최초의 남쪽 이름들이다!',
  'Taewang: A celebration awaits in Sudo City. Go, Champion. The whole region will want to honor your achievement.': '태왕: 수도시에서 축하연이 기다린다. 가라, 챔피언. 온 지역이 네 업적을 기리고 싶어 할 테니.',
  'The Northern League rises before you — a colossal grey-granite palace, severe and symmetrical, banked with red banners under a single gold star. Trainers from a dozen regions cross the forecourt.': '북부 리그가 네 앞에 솟아 있다 — 거대한 잿빛 화강암 궁전, 준엄하고 좌우대칭으로, 단 하나의 금별 아래 붉은 깃발이 늘어서 있다. 열두 지역의 트레이너들이 앞뜰을 가로지른다.',
  'Rival: You didn\'t think I\'d let you cross an international border without a send-off, did you?': '라이벌: 내가 배웅도 없이 널 국경 너머로 보낼 거라고 생각한 건 아니겠지?',
  'Rival: Everyone back home keeps calling you \'Champion\' this, \'Champion\' that. So before you walk through those doors —': '라이벌: 고향 사람들 다 널 두고 \'챔피언\' 이러니저러니 하더라. 그러니 저 문을 지나기 전에 —',
  'Rival: Now I will challenge the strongest trainer in Onnuri region! One more, for old times\' sake!': '라이벌: 이제 내가 온누리 지역 최강의 트레이너에게 도전하겠어! 옛정을 봐서, 한 판 더!',
  'SPACE — Enter the Northern League': 'SPACE — 북부 리그 입장',
  'League Warden: Eight southern badges first, southerner. Come back a Champion.': '리그 문지기: 남쪽 배지 여덟 개부터다, 남쪽 것. 챔피언이 되어 돌아와.',
  'League Warden: The Northern League awaits you, Champion. Prove yourself worthy of the title.': '리그 문지기: 북부 리그가 당신을 기다립니다, 챔피언. 그 타이틀에 걸맞음을 증명하세요.',
  'Nurse: Welcome to the Northern League Pokémon Center.': '간호사: 북부 리그 포켓몬 센터에 오신 걸 환영합니다.',
  'Nurse: Your team is fully restored. May you climb higher than any southerner before you.': '간호사: 팀이 완전히 회복됐어요. 그 어떤 남쪽 사람보다 더 높이 오르시길.',
  'Beyond the border tunnels, the Northern Reaches open into a vast, silent snow-forest — pines heavy with frost as far as the eye can see, the trail a thin white thread winding north through the trees.': '국경 터널 너머로, 북부 변방이 드넓고 고요한 눈 덮인 숲으로 펼쳐진다 — 눈길 닿는 데까지 서리 무겁게 인 소나무들, 오솔길은 나무 사이로 북쪽을 향해 굽이치는 가느다란 흰 실이다.',
  '⛰ Out of the woods → Sacred Peak': '⛰ 숲을 벗어나 → 성봉',
  '🌲 The Northern Reaches — Snow-Woods': '🌲 북부 변방 — 눈숲',
  'WASD: move  SPACE: challenge / answer  M: menu': 'WASD: 이동  SPACE: 도전 / 대답  M: 메뉴',
  'You slipped past the first floor? The warps here\'ll spin your head — but I\'ll stop you first!': '1층을 몰래 지나쳤다고? 여기 워프는 네 머리를 어지럽힐 거야 — 하지만 내가 먼저 널 막지!',
  'The gap\'s mine to guard. Beat me or wander these warps till you starve!': '이 통로는 내가 지켜. 날 이기거나, 아니면 굶어 죽을 때까지 이 워프들을 헤매!',
  'WASD: move  (warp pads teleport you)  SPACE: talk  M: menu': 'WASD: 이동  (워프 패드가 순간이동시켜)  SPACE: 대화  M: 메뉴',
  'Sovereign Clemont: ...Impossible. The whole tower, floor by floor...': '군주 클레몬: ...말도 안 돼. 이 탑 전체를, 층층이...',
  'You surfed all the way out here? Then you can spare a match!': '여기까지 파도타기로 나왔다고? 그럼 한 판 상대해줄 수 있겠네!',
  'The current\'s strong here — but my Pokémon are stronger.': '여긴 물살이 세 — 하지만 내 포켓몬이 더 세지.',
  'Forty years at sea. Let\'s see if the land-folk can hold a wave.': '바다에서 사십 년. 뭍사람이 파도를 버틸 수 있는지 어디 보자.',
  'You paddle out onto the open sea, your Pokémon carrying you over the swells.': '너는 탁 트인 바다로 노 저어 나가고, 네 포켓몬이 물결 위로 너를 실어 나른다.',
  'Currents run north to the Jeju vents, east to the Route 6 shore, and back south to Haean. Sea Pokémon surface all around you.': '물살은 북쪽으로 제주 분화구, 동쪽으로 6번 도로 해안, 그리고 다시 남쪽으로 해안까지 흐른다. 바다 포켓몬들이 사방에서 수면 위로 떠오른다.',
  '🌊 The Open Sea': '🌊 탁 트인 바다',
  'WASD: surf  SHIFT: sprint  SPACE: talk  M: menu': 'WASD: 파도타기  SHIFT: 전력질주  SPACE: 대화  M: 메뉴',
  'Smeargle?': '루브도?',
  'A Smeargle is curled by the garden window, clutching an ink brush!': '루브도 한 마리가 정원 창가에 웅크린 채, 잉크 붓을 꼭 쥐고 있다!',
  'Smeargle: Smear~ ♪': '루브도: 루브~ ♪',
  'It recognizes the studio\'s scent and happily follows you inside.': '그것은 화실의 냄새를 알아보고 기쁘게 너를 따라 안으로 들어온다.',
  'Artist Sora: Thanks to you, my brush is back. The highland map should help your journey north!': '화가 소라: 네 덕분에 붓이 돌아왔어. 이 고원 지도가 북쪽으로 가는 네 여정에 도움이 될 거야!',
  'Artist Sora: My Smeargle! And my brush! Oh, thank you, thank you!': '화가 소라: 내 루브도! 그리고 내 붓! 오, 고마워, 정말 고마워!',
  'Artist Sora: They look like an ancient seal — but freshly disturbed. Be careful up there.': '화가 소라: 고대의 봉인처럼 보이는데 — 방금 막 건드려진 것 같아. 저 위에선 조심해.',
  'Artist Sora: Have you found my Smeargle yet? Try looking near the garden window out back.': '화가 소라: 내 루브도 벌써 찾았어? 뒤쪽 정원 창가 근처를 찾아봐.',
  'Artist Sora: Oh! A traveler! Could you help me?': '화가 소라: 오! 여행자님! 좀 도와주실 수 있을까요?',
  'Artist Sora: My Smeargle wandered off carrying my most precious ink brush.': '화가 소라: 내 루브도가 내 가장 소중한 잉크 붓을 물고 사라져버렸어요.',
  'Artist Sora: I last heard it chittering out by the garden window. Please, find it!': '화가 소라: 마지막으로 정원 창가 쪽에서 재잘거리는 소릴 들었어요. 제발, 찾아주세요!',
  '(The Smeargle has appeared by the garden window — go talk to it!)': '(루브도가 정원 창가에 나타났어 — 가서 말을 걸어봐!)',
  'Pokémon Center & Gallery': '포켓몬 센터 & 미술관',
  '↑ Seolbong Highland Pass': '↑ 설봉 고원 고개',
  'Rival: Finally. I\'ve been here an hour. Try this — the lady makes it with a doenjang base. Incredible.': '라이벌: 드디어 왔네. 한 시간이나 기다렸어. 이거 먹어봐 — 아주머니가 된장 베이스로 만들어. 끝내줘.',
  'Rival: Anyway. Some group has been up in the highland caves to the north — they keep locals away, call it \'research.\'': '라이벌: 아무튼. 어떤 무리가 북쪽 고원 동굴에 들어와 있어 — 주민들을 못 오게 하면서, \'연구\'라고 부르더라.',
  'Rival: Research with that many people and that much equipment doesn\'t look like research to me.': '라이벌: 그렇게 많은 사람에 그렇게 많은 장비로 하는 연구는, 내 눈엔 연구로 안 보여.',
  'Rival: Professor Song sent me a message too. Something about Pokémon behaving strangely near Baekdu Peak.': '라이벌: 송 박사도 나한테 메시지를 보냈어. 백두봉 근처에서 포켓몬들이 이상하게 행동한다나.',
  'Rival: We should check it out after the next gym. Seolbong City — north through the highland pass.': '라이벌: 다음 체육관 끝나고 확인해보는 게 좋겠어. 설봉시티 — 고원 고개를 지나 북쪽이야.',
  'Rival: Oh — there\'s an artist near the studio looking for her lost Smeargle. You should help her. (Side quest!)': '라이벌: 아 — 화실 근처에 잃어버린 루브도를 찾는 화가가 있어. 도와주는 게 좋을 거야. (사이드 퀘스트!)',
  'You don\'t know the way yet — better find a guide or a map first.': '아직 길을 몰라 — 먼저 안내자나 지도를 구하는 게 좋겠어.',
  'Gyeoul: I am Gyeoul, first of the Elite Four. My cranes nest on the glacier.': '겨울: 나는 겨울, 사천왕의 첫째다. 내 학들은 빙하 위에 둥지를 튼다.',
  'Hwageum: Goryeo smiths folded steel ten thousand times. So have I folded my team.': '화금: 고려의 대장장이는 강철을 만 번 접었지. 나도 내 팀을 그렇게 벼려왔다.',
  'Baram: I am Baram. The eagles and cranes of the cliffs answer to the wind.': '바람: 나는 바람. 절벽의 독수리와 학은 바람에 응답한다.',
  'Saleum: The mudang sees what is, and what is coming. I have seen this battle.': '사름: 무당은 있는 것과 다가올 것을 본다. 나는 이 배틀을 이미 보았지.',
  'You were defeated. The four halls seal shut behind you once more.': '너는 패배했다. 네 개의 전각이 다시 네 뒤로 봉인된다.',
  'The Onnuri Pokémon League. Four masters guard the road to the Champion, each in their own hall.': '온누리 포켓몬 리그. 네 명의 명인이 챔피언으로 가는 길을 지키며, 저마다 자기 전각을 맡고 있다.',
  '🏆 HALL OF FAME': '🏆 명예의 전당',
  'Hwangeum kneels to his fallen ace first — always his Pokémon first — then stands.': '황금은 쓰러진 에이스에게 먼저 무릎을 꿇는다 — 언제나 자기 포켓몬이 먼저다 — 그런 다음 일어선다.',
  'Rival: ...Starting tomorrow, though. Tonight, you\'ve earned the sleep.': '라이벌: ...그래도, 내일부터야. 오늘 밤은 잠 잘 자격이 있어.',
  '— THE END —': '— 끝 —',
  'Supreme Gwang: Your journey ends here — either in triumph, or in defeat. Show me your true power!': '총수 광: 네 여정은 여기서 끝난다 — 승리로든, 패배로든. 네 진정한 힘을 보여라!',
  'Supreme Gwang: ...Incredible. I have not met a trainer of your caliber in decades.': '총수 광: ...놀랍군. 수십 년 만에 처음 만나는 너 같은 격의 트레이너다.',
  'You enter Gwanmunseong, the northern capital — a vast, disciplined city of grey-granite towers and broad ceremonial avenues under a cold, clear sky. A great bronze figure presides over the central plaza.': '너는 북쪽 수도 관문성으로 들어선다 — 잿빛 화강암 탑과 넓은 의식용 대로가 차갑고 맑은 하늘 아래 펼쳐진, 드넓고 규율 잡힌 도시다. 거대한 청동상이 중앙 광장을 굽어보고 있다.',
  'Uniformed City Wardens stand at their posts, still and formal, and incline their heads as you pass.': '제복을 입은 경비대원들이 자기 자리에 미동도 없이 격식 있게 서 있다가, 네가 지나갈 때 고개를 숙인다.',
  'City Warden Cheol: Southern Champion. You are expected. This is an old and proud capital — here, everything keeps its order, and guests keep their decorum.': '경비대 철: 남쪽 챔피언. 기다리고 있었소. 이곳은 유서 깊고 자긍심 높은 수도요 — 여기선 모든 것이 질서를 지키고, 손님은 예의를 지키지.',
  '(The Wardens return to their posts at the edges of the plaza — watchful, but courteous.)': '(경비대원들이 광장 가장자리 자기 자리로 돌아간다 — 경계하되, 정중하게.)',
  '↑ Grand Avenue → Northern League': '↑ 대로 → 북부 리그',
  '🏙 Gwanmunseong — the Northern Capital': '🏙 관문성 — 북쪽 수도',
  'SPACE — Talk to Supreme Gwang': 'SPACE — 총수 광과 대화',
  'Supreme Gwang: Only then will you be worthy of challenging the Supreme Commander of Gwanmunseong.': '총수 광: 그래야만 비로소 관문성의 총사령관에게 도전할 자격이 있을 것이다.',
  'SPACE — Challenge Supreme Gwang': 'SPACE — 총수 광에게 도전',
  'SPACE — Grand Avenue → Northern League': 'SPACE — 대로 → 북부 리그',
  'Gate Warden: ...Southern Champion. You are cleared to the League grounds. The Grand Avenue is yours.': '관문 경비대: ...남쪽 챔피언. 리그 경내로 통과 허가됐소. 대로는 당신 것이오.',
  'Gate Warden: Win or lose up there, you return by this same road. Carry yourself well — the capital is watching, and it remembers.': '관문 경비대: 저 위에서 이기든 지든, 이 같은 길로 돌아오게 되오. 처신을 잘하시오 — 수도가 지켜보고 있고, 기억하니까.',
  'A voice echoes from the stone: "Only those who have proven themselves in the Northern League may ascend. Return after you have conquered the north."': '돌에서 목소리가 울린다: "북부 리그에서 자신을 증명한 자만이 오를 수 있다. 북부를 정복한 뒤에 돌아오라."',
  'You lay your hand on the ancient statue. The stone is ice-cold, but it does not respond.': '너는 고대 석상에 손을 얹는다. 돌은 얼음처럼 차갑지만, 아무 응답이 없다.',
  'A voice echoes from the stone: "Only those who have proven themselves in the Northern League may descend. Return after you have conquered the north."': '돌에서 목소리가 울린다: "북부 리그에서 자신을 증명한 자만이 내려갈 수 있다. 북부를 정복한 뒤에 돌아오라."',
  'Forty years I\'ve climbed the Onseong spine. The mountain keeps its counsel — and so do my Pokémon!': '온성 산줄기를 사십 년 올랐지. 산은 제 속내를 감춰 — 내 포켓몬도 마찬가지고!',
  'Base camp\'s just here. The wild things get bolder the higher you climb — better toughen up now!': '베이스캠프가 바로 여기야. 높이 오를수록 야생 것들이 더 대담해져 — 지금 단단히 단련해두는 게 좋아!',
  'In the dark you fight by sound and instinct. My fists have never needed the light. Come!': '어둠 속에선 소리와 본능으로 싸우지. 내 주먹은 빛이 필요했던 적이 없어. 덤벼!',
  'Careful of the drop by the falls. Lost a good pack down there once. Battle me while you\'re here!': '폭포 옆 낭떠러지를 조심해. 예전에 좋은 배낭을 저 아래로 잃어버렸지. 온 김에 나랑 배틀하자!',
  'They say the altar chose this mountain, not the other way round. Prove your spirit before it!': '재단이 이 산을 골랐지, 그 반대가 아니라고들 해. 그 앞에서 네 기개를 증명해봐!',
  'The stone hums to those who listen. My Pokémon and I have listened a long, long time.': '돌은 귀 기울이는 자에게 울려. 나와 내 포켓몬은 아주 오랫동안 귀 기울여왔지.',
  'SPACE — Touch the Ancient Altar': 'SPACE — 고대 재단 만지기',
  'SPACE — Touch the Statue': 'SPACE — 석상 만지기',
  'You lay your hand on the ancient statue. The stone is ice-cold, and it hums — a deep, charged note that answers from somewhere far below.': '너는 고대 석상에 손을 얹는다. 돌은 얼음처럼 차갑고, 울린다 — 저 아래 어딘가에서 응답하는, 깊고 힘이 실린 울림이다.',
  'I\'ve wintered on this ridge more times than I can count. The cold sharpens a team. Battle me.': '이 능선에서 셀 수 없을 만큼 겨울을 났지. 추위는 팀을 날카롭게 벼려. 나랑 배틀해.',
  'I carve these slopes at dawn before the wind picks up. Race you? No — battle you!': '바람이 거세지기 전 새벽에 이 비탈을 깎듯 활강하지. 경주할까? 아니 — 배틀하자!',
  '✈  ARROWS: choose city   ·   ENTER/SPACE or click: Fly   ·   ESC/M: close': '✈  화살표: 도시 선택   ·   ENTER/SPACE 또는 클릭: 비행   ·   ESC/M: 닫기',
  'FLY': '공중날기',
  'Visit more cities to unlock them as Fly destinations.   ·   ESC/M: close': '더 많은 도시를 방문해 비행 목적지로 해금하자.   ·   ESC/M: 닫기',
  'Beat the Pokémon League to earn HM Fly and travel the region instantly.   ·   ESC/M: close': '포켓몬 리그를 이기면 비행 비술을 얻어 지역을 즉시 오갈 수 있어.   ·   ESC/M: 닫기',
  'It had no effect!': '효과가 없었다!',
  '\nReturning to Waterfall City...': '\n폭포시로 돌아가는 중...',
  'This mountain road has been here for five hundred years. My legs have been here for fifty. That\'s enough for me!': '이 산길은 오백 년째 여기 있었어. 내 다리는 오십 년째 여기 있고. 나한텐 그걸로 충분해!',
  'I\'m studying Pokémon for my science project. Would you mind if I observed your battle style? ...Actually I\'m just going to battle you.': '과학 과제로 포켓몬을 연구하고 있어. 네 배틀 스타일을 관찰해도 될까? ...사실 그냥 너랑 배틀할 거야.',
  'Harabeoji: You\'re heading to Solip Town? Fine place. Used to be a famous ink-and-brush village.': '할아버지: 솔잎마을로 가는 길인가? 좋은 곳이지. 예전엔 붓과 먹으로 유명한 마을이었어.',
  'Harabeoji: These days though... strangers in strange uniforms have been passing through.': '할아버지: 그런데 요즘은... 이상한 제복을 입은 낯선 자들이 지나다녀.',
  'Harabeoji: Black coats. Red thread stitched on the collar. Never seen them before.': '할아버지: 검은 코트. 옷깃엔 붉은 실이 박혀 있고. 처음 보는 자들이야.',
  'Harabeoji: They didn\'t stop to rest. Just kept moving north.': '할아버지: 쉬어 가지도 않더군. 그저 계속 북쪽으로 갔어.',
  'I patrol this gorge. Lately the wildlife\'s been spooked by people in dark coats. Let\'s spar — keeps me sharp.': '난 이 협곡을 순찰해. 요즘 야생동물들이 검은 코트를 입은 자들 때문에 겁에 질려 있어. 한 판 겨루자 — 감을 잃지 않게.',
  'Commander Ryeo: You\'re not Team Suri. You\'re not authority. You\'re a trainer who keeps appearing everywhere.': '려 사령관: 넌 수리단도 아니야. 권력자도 아니고. 그저 어디에나 계속 나타나는 트레이너지.',
  'Rival: And if we don\'t?': '라이벌: 그러지 않으면?',
  'Commander Ryeo: ...Then we\'ll have a quarrel.': '려 사령관: ...그럼 다툼이 있겠지.',
  'Commander Ryeo: Still in my way? So be it.': '려 사령관: 아직도 내 앞을 막나? 그렇다면 어쩔 수 없지.',
  'Been castin\' this stretch forty years. Reel one in with me — winner keeps their pride!': '이 물길에서 사십 년째 낚싯대를 던졌어. 나랑 한 마리 낚아봐 — 이긴 쪽이 자존심을 지키는 거야!',
  'Commander Ryeo: You again. Then you should hear it plainly.': '려 사령관: 또 너로군. 그럼 분명하게 들어둬.',
  'Commander Ryeo: When the Spirit of Cheonji wakes, its first-moment energy output will be immeasurable. We intend to collect that energy.': '려 사령관: 천지의 정령이 깨어날 때, 그 첫 순간의 에너지 방출은 헤아릴 수 없을 정도지. 우린 그 에너지를 거둘 작정이다.',
  'Rival: Collect it for WHAT? What do you mean, useful?': '라이벌: 그걸 뭐에 쓰려고? 유용하다니, 무슨 소리야?',
  'Commander Ryeo: The south has prospered for decades while the north has suffered. The imbalance ends.': '려 사령관: 남쪽은 수십 년간 번영했지만 북쪽은 고통받았다. 그 불균형을 끝낸다.',
  'Commander Ryeo: The Spirit\'s awakening energy — properly weaponized — will correct it.': '려 사령관: 정령의 각성 에너지를 — 제대로 무기화하면 — 그걸 바로잡을 것이다.',
  'Rival: ...That\'s insane. Move.': '라이벌: ...미친 소리야. 비켜.',
  'Commander Ryeo: Still set on stopping us? Come, then.': '려 사령관: 아직도 우릴 막을 셈인가? 그럼, 와라.',
  'Breathe in. The forest\'s scent calms the heart — and sharpens my Pokémon. Shall we?': '숨을 들이마셔. 숲의 향기는 마음을 가라앉히고 — 내 포켓몬을 날카롭게 하지. 시작할까?',
  'Admin Chaeyeon: ...Don\'t misread this. We are NOT allies. The Director\'s orders stand.': '간부 채연: ...오해하지 마. 우린 동맹이 아니야. 국장님의 명령은 유효해.',
  'Admin Chaeyeon: But before you interfere again — show me you\'ve grown.': '간부 채연: 하지만 또 끼어들기 전에 — 네가 성장했다는 걸 보여줘.',
  'Admin Chaeyeon: Still in our way. Fine — again, then.': '간부 채연: 아직도 우리 앞을 막네. 좋아 — 그럼 또 한 번.',
  'Commander Ryeo stands at the shrine gate, silhouetted against the rising sun.': '려 사령관이 떠오르는 해를 등지고, 사당 문 앞에 실루엣으로 서 있다.',
  'Commander Ryeo: You freed the Grandmother. You\'ve cost us our backup plan.': '려 사령관: 네가 할망을 풀어줬군. 우리 예비책을 날려버렸어.',
  'Commander Ryeo: But Cheonji remains. I\'ll see you at the top — and I cannot guarantee your safety.': '려 사령관: 하지만 천지는 그대로다. 정상에서 보지 — 그리고 네 안전은 보장 못 한다.',
  '(She walks on toward the Sunrise Cliffs without another word.)': '(그는 더 말없이 해돋이 절벽 쪽으로 걸어간다.)',
  '← walk in the grass to find them': '← 풀숲을 걸으며 찾아봐',
  '🗺 Route 1 — Mountain Pass': '🗺 1번 도로 — 산길 고개',
  'WASD/Arrows: move  |  SHIFT: run  |  M: menu': 'WASD/화살표: 이동  |  SHIFT: 달리기  |  M: 메뉴',
  'Kisun: Hey! You must be heading to Capitol City for the first time!': '기선: 이봐! 소올 시티에 처음 가는 길이구나!',
  'Kisun: These mountains are full of wild Pokémon. You will need these!': '기선: 이 산들은 야생 포켓몬으로 가득해. 이게 필요할 거야!',
  'Kisun: I am giving you 20 Pokéballs. Use them to catch Pokémon on the route!': '기선: 몬스터볼 20개를 줄게. 이걸로 도로에서 포켓몬을 잡아!',
  'Kisun: Press A in battle to throw a ball. Good luck, trainer! 🔴': '기선: 배틀에서 A를 누르면 볼을 던져. 행운을 빌어, 트레이너! 🔴',
  'This valley\'s fed the old capital for a thousand years. My Pokémon work these dikes — and they don\'t tire easy.': '이 골짜기는 천 년째 옛 수도를 먹여 살렸지. 내 포켓몬들은 이 둑에서 일해 — 쉽게 지치지 않아.',
  'Best fishing on the whole Yeoul, right off this bridge. Care to wager a battle on who\'s got the bigger catch?': '여울강 전체에서 제일 낚시가 잘돼, 바로 이 다리 밑이지. 누가 더 큰 걸 낚나 배틀 걸어볼래?',
  'Walked all the way from Songhyeon! My team\'s tougher than it looks, mister!': '송현에서 여기까지 걸어왔어! 우리 팀은 보기보다 강하다고, 아저씨!',
  'I follow the dikes up to the sea and back. Rock-hard legs, rock-hard team. Let\'s go!': '난 둑을 따라 바다까지 올라갔다 돌아와. 바위처럼 단단한 다리, 바위처럼 단단한 팀. 가자!',
  'You\'re the one nosing around the Chiefs\' business. The valley road is ours tonight — cargo moves north. Turn back, Champion.': '네가 바로 관장님들 일에 코를 들이미는 녀석이군. 오늘 밤 이 골짜기 길은 우리 거야 — 화물이 북쪽으로 간다. 돌아가, 챔피언.',
  'Poongbaek — The Wind': '풍백 — 바람',
  'Woosa — The Rain': '우사 — 비',
  'Woonsa — The Clouds': '운사 — 구름',
  '☀ Altar of the Descent': '☀ 강림의 재단',
  '↓ Ancient Altar (Onseong)': '↓ 고대 재단 (온성)',
  'Sovereign Clemont: You gathered the three so we wouldn\'t have to. How thoughtful. Hand them over, and Hwanung descends for US — and this broken peninsula finally answers to one throne.': '군주 클레몬: 우리가 안 해도 되게 네가 셋을 다 모아왔군. 참 사려 깊기도 하지. 넘겨. 그러면 환웅이 우리를 위해 강림하고 — 이 갈라진 반도가 마침내 하나의 왕좌에 답하게 된다.',
  'Rival (arriving at your side, breathless): Yeah, that\'s a no. They chased you all the way up here, and I chased THEM. Go — I\'ve got your back like always.': '라이벌 (숨을 헐떡이며 네 곁에 도착한다): 그래, 그건 안 되지. 저것들이 널 여기까지 쫓아왔고, 난 저것들을 쫓아왔어. 가 — 늘 그랬듯 내가 뒤를 봐줄게.',
  '🌟  THE COMPLETE PANTHEON': '🌟  완전한 신들',
  'Rival (looking up at the clearing sky): You caught a GOD, you know that? An actual god. ...I\'m never going to catch up to you, am I? Good. Wouldn\'t want it any other way.': '라이벌 (맑아지는 하늘을 올려다보며): 너 신을 잡은 거야, 알아? 진짜 신을. ...난 너를 영영 못 따라잡겠지, 그렇지? 좋아. 다른 식이었으면 싫었을 거야.',
  'Professor Song: The region is whole. North and south, spirit and sovereign — all at peace, all in your care. Whatever comes next for Onnuri... it\'s in good hands.': '송 박사: 지역이 온전해졌어. 남과 북, 정령과 군주 — 모두 평화롭고, 모두 네 보살핌 아래에 있지. 앞으로 온누리에 무엇이 오든... 좋은 손에 맡겨졌어.',
  'Prof. Song: Come home, Champion. All of Sudo City is waiting to celebrate you one last time.': '송 박사: 집으로 돌아와, 챔피언. 수도시 전체가 마지막으로 한 번 더 널 축하하려고 기다리고 있어.',
  'WASD: move  SHIFT: run  C: bike  SPACE: enter/talk  M: menu': 'WASD: 이동  SHIFT: 달리기  C: 자전거  SPACE: 입장/대화  M: 메뉴',
  'Dawon: I\'ve climbed this road three times. The dragons and I know every stone.': '다원: 이 길을 세 번 올랐지. 드래곤들과 나는 돌 하나하나를 다 알아.',
  '"The road tests the prepared. Walk it, and be measured."': '"길은 준비된 자를 시험한다. 걸어라, 그리고 가늠되어라."',
  'In old Onnuri, scholars walked this road TO the capital to sit the royal exam. Today, trainers walk it OUT, to sit the highest exam of all — the Pokémon League.': '옛 온누리에서, 학자들은 왕의 과거를 보러 이 길을 따라 수도로 걸어 들어갔지. 오늘날 트레이너들은 그 반대로 걸어 나가, 가장 높은 시험 — 포켓몬 리그를 치른다.',
  'Rest at the pavilion midway (SPACE) to heal. The League waits at the summit.': '중간 정자에서 쉬며(SPACE) 회복하자. 리그는 정상에서 기다린다.',
  'WASD: move  SHIFT: run  SPACE: talk/rest  M: menu': 'WASD: 이동  SHIFT: 달리기  SPACE: 대화/휴식  M: 메뉴',
  'Badge Scanner: The road tests the prepared. It is yours. Pass.': '배지 스캐너: 길은 준비된 자를 시험한다. 이 길은 네 것이다. 지나가라.',
  'Badge Scanner: Return when you have earned every badge in the region.': '배지 스캐너: 지역의 모든 배지를 얻은 뒤에 돌아오라.',
  'SPACE — Rest & heal your team': 'SPACE — 팀을 쉬게 하고 회복',
  'You rest at the pavilion. Your Pokémon were fully healed!': '너는 정자에서 쉰다. 포켓몬이 완전히 회복됐다!',
  'Your Rival leans against the final gate, arms crossed — exactly the way they did outside their house on the first morning.': '네 라이벌이 마지막 문에 팔짱을 낀 채 기대어 있다 — 첫날 아침 자기 집 앞에서 그랬던 것과 똑같은 모습으로.',
  'Rival: Knew you\'d make it up here. I\'ve been waiting since dawn.': '라이벌: 네가 여기까지 올라올 줄 알았어. 새벽부터 기다리고 있었지.',
  'Rival: We started this whole thing racing each other to Capitol City. And now here we are — same city behind us, the very top of the region in front of us.': '라이벌: 우린 이 모든 걸 소올 시티까지 서로 경주하며 시작했잖아. 그리고 지금 이렇게 — 같은 도시를 등지고, 지역의 맨 꼭대기를 눈앞에 두고 있어.',
  'Rival: I\'m not the Magistrate right now. Not a Gym Leader. Just your friend who\'s chased you across this entire peninsula trying to stay one step ahead.': '라이벌: 지금 난 판관도 아니야. 체육관 관장도 아니고. 그냥 한 발 앞서려고 이 반도 전체를 너를 쫓아다닌 네 친구일 뿐이야.',
  'Rival: One more battle. My best team — everything I\'ve got. Get past me, and you\'re ready for the Four.': '라이벌: 한 판 더. 내 최고의 팀 — 내가 가진 전부. 날 넘어서면, 넌 사천왕을 상대할 준비가 된 거야.',
  'Rival: Don\'t hold back. I\'d never forgive you if you did.': '라이벌: 봐주지 마. 그랬다간 절대 용서 안 할 거야.',
  'Rival: One more battle. Everything I\'ve got. Ready?': '라이벌: 한 판 더. 내가 가진 전부. 준비됐어?',
  'Rival (stepping aside): ...Yeah. That\'s the trainer I\'ve been chasing this whole time.': '라이벌 (비켜서며): ...그래. 이게 바로 내가 이 내내 쫓아온 트레이너지.',
  'Rival: Go on. The Four are waiting — and so is HE, at the very top.': '라이벌: 어서 가. 사천왕이 기다려 — 그리고 맨 꼭대기엔 그도 있고.',
  'Rival: Whatever happens in there... you already proved everything you needed to prove. To me, anyway. Now go win it.': '라이벌: 저 안에서 무슨 일이 일어나든... 넌 이미 증명해야 할 걸 다 증명했어. 적어도 나한테는. 이제 가서 이겨.',
  'The great doors of the Pokémon League swing open. You step through.': '포켓몬 리그의 거대한 문이 활짝 열린다. 너는 그 안으로 발을 들인다.',
  'Lodge Keeper: Welcome in from the cold. The hearth is always warm for travelers in Seorae.': '산장지기: 추위를 피해 어서 들어와요. 서래에선 여행자를 위해 난롯불이 늘 따뜻하죠.',
  'Bath Attendant: The spring comes up hot beneath the snow. Rest your feet and let the mountain steam do its work.': '온천지기: 눈 아래에서 온천이 뜨겁게 솟아나요. 발을 담그고 산의 김이 제 일을 하게 두세요.',
  'Market Vendor: Frost-berries, handwarmers, trail snacks—we have everything a climber needs.': '시장 상인: 서리열매, 손난로, 등산 간식 — 등반가에게 필요한 건 다 있어요.',
  'Skate Technician: Looking to hit the ice? We\'ve got the fastest skates in Onnuri—rent or buy!': '스케이트 기술자: 얼음을 지치러 가시게요? 온누리에서 제일 빠른 스케이트가 있죠 — 대여도 구매도 가능해요!',
  '🍡  SEORAE FROST MARKET': '🍡  서래 서리 시장',
  'Skate Technician: The Skate Link will take you all the way to Sunrise City—fast and safe!': '스케이트 기술자: 스케이트 연결로가 해돋이시까지 쭉 데려다줄 거예요 — 빠르고 안전하게!',
  'Yeona: The thaw you carry will melt more than snow, I think. Go gently with it.': '여나: 네가 지닌 해빙은 눈보다 더 많은 걸 녹일 거야, 아마도. 그걸 조심히 다뤄.',
  'Prof. Song: Sail back to Jeju and climb the vent trail. Old Dosik\'s ferry will carry you. Go — she needs a guardian who can stand.': '송 박사: 제주로 다시 항해해서 분화구 등반로를 올라. 늙은 도식의 여객선이 데려다줄 거야. 가 — 그에겐 굳건히 설 수 있는 수호자가 필요해.',
  '← LEADER YEONA →': '← 리더 여나 →',
  '(A poised woman in white-and-frost-blue robes rings a small frost-bell once. Her breath mists.)': '(하양과 서리 파랑 의상을 입은 침착한 여인이 작은 서리종을 한 번 울린다. 그녀의 숨결이 뿌옇게 서린다.)',
  'Fresh powder and a fresh challenger! Both make my day. Ready?': '갓 내린 눈과 갓 온 도전자! 둘 다 내 하루를 즐겁게 하지. 준비됐어?',
  'I clear this pass every dawn. Nothing on it gets by me — not even you.': '난 매일 새벽 이 고개를 치워. 여기선 아무것도 날 지나치지 못해 — 너조차도.',
  'The summit tests everyone. Consider me your first foothold.': '정상은 모두를 시험하지. 날 네 첫 발판이라고 생각해.',
  'Enter the Alpine Lodge': '고산 산장 들어가기',
  'Enter the Snowmelt Baths': '눈녹임 온천 들어가기',
  'Enter the Frost Market': '서리 시장 들어가기',
  'Enter the Skate Shop': '스케이트 가게 들어가기',
  'The Frostbell Shrine waits in the northwest. The Pokémon Center has a nurse and PC inside, while the Skate Link carries travelers east toward Sunrise City.': '서리종 사당은 북서쪽에 있어. 포켓몬 센터 안엔 간호사와 PC가 있고, 스케이트 연결로는 여행자를 동쪽 해돋이시로 데려다줘.',
  '↓ Seorae Pass · Dolmoe': '↓ 서래 고개 · 돌뫼',
  '⛸ Skate Link → Sunrise City': '⛸ 스케이트 연결로 → 해돋이시',
  '⛸  FROSTBELL PLAZA  ⛸': '⛸  서리종 광장  ⛸',
  'WASD: move  SHIFT: run  SPACE: enter / talk  M: menu': 'WASD: 이동  SHIFT: 달리기  SPACE: 입장 / 대화  M: 메뉴',
  'SPACE — Enter the Frostbell Shrine': 'SPACE — 서리종 사당 들어가기',
  'SPACE — Ask about the Skate Link': 'SPACE — 스케이트 연결로에 대해 묻기',
  'Skate Link Attendant: The ice lane is clear to Sunrise City. Follow the blue markers and enjoy the glide!': '스케이트 연결로 안내원: 얼음 길이 해돋이시까지 뚫려 있어요. 파란 표지를 따라가며 활주를 즐기세요!',
  'The Gangcheoldo plain feeds the whole northeast. My beasts work these paddies — and they don\'t back down!': '강철도 평야가 북동부 전체를 먹여 살리지. 내 짐승들은 이 논에서 일해 — 물러서는 법이 없어!',
  'Cold water, warm heart! Swam the whole bay this morning. Let\'s see if you can keep pace on land!': '찬물, 뜨거운 가슴! 오늘 아침 만 전체를 헤엄쳤지. 뭍에서도 내 속도를 따라올 수 있는지 보자!',
  'Off-shift from the Gangcheoldo works. You\'ll want to be tough before you reach the steel city — try me first!': '강철도 제철소에서 교대 마치고 나온 참이야. 강철 도시에 닿기 전에 강해지는 게 좋을 거야 — 먼저 나부터 상대해!',
  'The Ice-Bound Beartic is driven from the cavern. The groaning of the ice fades to a deep, settled quiet.': '얼음에 갇힌 툰베어가 동굴에서 쫓겨난다. 얼음의 신음이 깊고 가라앉은 고요로 잦아든다.',
  'WASD/Arrows: move  (slide back down the entry side to escape any stage)  M: menu': 'WASD/화살표: 이동  (입구 쪽으로 미끄러져 내려가면 어느 구간에서든 빠져나갈 수 있어)  M: 메뉴',
  'Prof. Song\'s Pokémon Lab': '송 박사의 포켓몬 연구소',
  'You take the express boat back to Sudo City and hurry to Professor Song\'s lab.': '너는 쾌속선을 타고 수도시로 돌아와 송 박사의 연구소로 서둘러 간다.',
  '(She unrolls a faded scroll painting of a vast, moth-like Pokémon.)': '(그녀가 거대한 나방 같은 포켓몬이 그려진 빛바랜 두루마리 그림을 펼친다.)',
  'Prof. Song: If they can\'t harvest Cheonji directly, they\'ll use HER as a living battery instead.': '송 박사: 천지를 직접 거둘 수 없다면, 그들은 대신 그녀를 살아 있는 배터리로 쓸 거야.',
  'Rival: Then we protect her too. ...But first —': '라이벌: 그럼 그녀도 우리가 지키자. ...하지만 먼저 —',
  'Rival: Before we split up to cover ground, one more battle. I told you my starter would evolve.': '라이벌: 흩어져서 넓게 살피기 전에, 한 판 더. 내 스타팅 포켓몬이 진화할 거라고 했잖아.',
  '🌟  POKÉMON  KOREA  🌟': '🌟  포켓몬  코리아  🌟',
  '— TRUE END —': '— 진정한 엔딩 —',
  'You crossed all of Onnuri —': '너는 온누리 전체를 가로질렀다 —',
  'south and north, sea and summit —': '남과 북, 바다와 정상을 —',
  'and united a broken peninsula': '그리고 갈라진 반도를 하나로 이었다,',
  'under a single Champion.': '단 한 명의 챔피언 아래.',
  'Thank you for playing.': '플레이해줘서 고마워요.',
  'Press SPACE to return to the title.': 'SPACE를 누르면 타이틀로 돌아가요.',
  '🏟️ Sunrise Gym — 8th Badge': '🏟️ 해돋이 체육관 — 여덟 번째 배지',
  '⛰ The Sunrise Cliffs': '⛰ 해돋이 절벽',
  '↓ Eastern Shore Road': '↓ 동쪽 해안 도로',
  '⛰️ Sunrise Cliffs — Lower Trail (1/3)': '⛰️ 해돋이 절벽 — 아래쪽 등반로 (1/3)',
  'Twenty years I\'ve climbed these cliffs. The black-coats blew past me like the place was theirs.': '이 절벽을 이십 년째 올랐지. 검은 코트들이 마치 제 땅인 양 날 휙 지나쳐 갔어.',
  '⛰️ Sunrise Cliffs — Mid Ascent (2/3)': '⛰️ 해돋이 절벽 — 중간 오르막 (2/3)',
  '🌅 Sunrise Cliffs — The Summit (3/3)': '🌅 해돋이 절벽 — 정상 (3/3)',
  '← LEADER BEONGE →': '← 리더 번개 →',
  '(A wind-burned woman stands at the rail, watching the storm clouds gather over the sea.)': '(바람에 그을린 여인이 난간에 서서, 바다 위로 몰려드는 폭풍 구름을 지켜본다.)',
  'start over?': '처음부터 시작할까?',
  '▶ SPACE to advance': '▶ SPACE로 넘기기',
  'Revive which Pokémon?': '어떤 포켓몬을 되살릴까?',
  'Use on which Pokémon?': '어떤 포켓몬에게 사용할까?',
  'Hwangeum: ...Good. Three years I\'ve wondered when someone would come who could do this.': '황금: ...좋아. 삼 년 동안, 이걸 해낼 수 있는 누군가가 언제쯤 올지 궁금했지.',
  'Rival: Yeah. YEAH. Go show these northerners what an Onnuri trainer looks like. I\'ll be in the stands, losing my voice for you.': '라이벌: 그래. 그래! 가서 이 북쪽 사람들에게 온누리 트레이너가 어떤 건지 보여줘. 난 관중석에서 널 위해 목이 터져라 응원할게.',
  'Will you switch?': '교체할까?',
  'You have none of that ball!': '그런 볼이 하나도 없어!',
  'Your party is full!': '동료가 가득 찼어!',
  '↔  Swap a Pokémon': '↔  포켓몬 교체',
  '📦  Send to PC': '📦  PC로 보내기',
  'Send which Pokémon to the PC?': '어떤 포켓몬을 PC로 보낼까?',
  'Two down, and you\'ve reached the water\'s edge — the last of us. No rest now. Bring everything!': '둘을 쓰러뜨리고, 물가에 다다랐군 — 우리 중 마지막이야. 이제 쉴 틈 없어. 전부 걸어!',
  'The East Sea\'s cold but it keeps you sharp! Care for a match on the sand?': '동해는 차갑지만 널 날카롭게 해줘! 모래밭에서 한 판 어때?',
  '🚌  The express coach rolls north across the old border to Songhyeon…': '🚌  쾌속 버스가 옛 국경을 넘어 북쪽 송현으로 달린다…',
  'Barkeep: Ahoy! In from the salt air, are ye? Sit by the fire — first bowl of clam broth\'s on the house.': '선술집 주인: 어이! 짠 바닷바람 맞고 왔나? 난롯가에 앉게 — 첫 조갯국 한 그릇은 내가 사지.',
  'Barista: Welcome to Kalma Beach Café! Sea breeze, warm drinks, comfy cushions.': '바리스타: 칼마 해변 카페에 오신 걸 환영해요! 바닷바람, 따뜻한 음료, 폭신한 방석.',
  'Innkeeper: A room away from the fog, friend? You look like you\'ve seen a ghost.': '여관 주인: 안개를 피할 방이 필요한가, 친구? 유령이라도 본 얼굴인데.',
  'Trader: Goods from across the frozen river — furs, jade, medicine, rumours.': '상인: 얼어붙은 강 건너에서 온 물건들 — 모피, 옥, 약, 그리고 소문.',
  'Lodge Keeper: Come in from the cold! The larch fire\'s roaring and the tea is hot.': '산장지기: 추위를 피해 어서 들어와! 낙엽송 장작불이 활활 타고 차도 뜨거워.',
  'You thaw out by the great stone hearth as snow drifts past the windows. Your team is warm and fully healed!': '너는 창밖으로 눈이 흩날리는 가운데 커다란 돌 화덕가에서 몸을 녹인다. 네 팀은 따뜻해지고 완전히 회복됐다!',
  'Mom: Oh, you\'re finally awake!': '엄마: 오, 드디어 일어났구나!',
  'Mom: Professor Song called earlier. She\'s at the lab on the north side of town.': '엄마: 아까 송 박사님이 전화하셨어. 마을 북쪽 연구소에 계신대.',
  'Mom: She said she has something special for new trainers.': '엄마: 새내기 트레이너들에게 줄 특별한 게 있다고 하시더라.',
  'Mom: You should go see her! But first...\nWould you like to rest before heading out?': '엄마: 가서 뵙는 게 좋겠어! 그런데 그 전에...\n나가기 전에 좀 쉬었다 갈래?',
  '...Your body feels refreshed!\nAll your Pokémon have been healed! ✨': '...몸이 개운해진 느낌이야!\n네 포켓몬 모두 회복됐어! ✨',
  'Mom: Now go see Professor Song. North part of town — you can\'t miss it! 💕': '엄마: 이제 송 박사님을 뵈러 가렴. 마을 북쪽이야 — 못 찾을 리 없어! 💕',
  'Mom: Okay! Don\'t forget to visit Professor Song. She\'s waiting! 💕': '엄마: 알았어! 송 박사님께 들르는 거 잊지 마. 기다리고 계셔! 💕',
  'Mom: Professor Song is waiting at the lab, honey!': '엄마: 송 박사님이 연구소에서 기다리고 계셔, 얘야!',
  'Mom: North side of town — go choose your Pokémon! 💕': '엄마: 마을 북쪽으로 — 가서 네 포켓몬을 골라! 💕',
  'Mom: Oh, before you go — I almost forgot!': '엄마: 아, 가기 전에 — 하마터면 잊을 뻔했네!',
  'Mom: I found these in the closet. They were your father\'s Running Shoes.': '엄마: 이걸 옷장에서 찾았어. 네 아빠의 러닝슈즈였단다.',
  'Mom: Hold SHIFT while walking and you\'ll move much faster. 👟': '엄마: 걸으면서 SHIFT를 누르면 훨씬 빨리 움직여. 👟',
  'Mom: Now, would you like to rest before heading out?': '엄마: 자, 나가기 전에 좀 쉬었다 갈래?',
  'Mom: Stay safe out there! I love you! 💕': '엄마: 밖에서 몸조심하렴! 사랑해! 💕',
  'Mom: Welcome home! Would you like to rest?': '엄마: 어서 와! 좀 쉴래?',
  'Mom: Good. Rest well, honey.': '엄마: 그래. 푹 쉬렴, 얘야.',
  'Mom: Alright, no worries!': '엄마: 알았어, 괜찮아!',
  'Mom: Come rest here whenever you want. 💕': '엄마: 언제든 쉬고 싶으면 여기 와서 쉬렴. 💕',
  '🏥  POKÉMON CENTER  🏥': '🏥  포켓몬 센터  🏥',
  'Nurse Joy: We restore your tired Pokémon.\nShall I heal your Pokémon?': '간호사 조이: 지친 포켓몬을 회복시켜 드려요.\n포켓몬을 치료해 드릴까요?',
  'Nurse Joy: Your Pokémon have been fully restored!\nPlease come again! 🌸': '간호사 조이: 포켓몬이 완전히 회복됐어요!\n또 오세요! 🌸',
  'Prof. Song: Your journey is out there, not in my lab. Head south when you\'re ready!': '송 박사: 네 여정은 저 밖에 있지, 내 연구소가 아니야. 준비되면 남쪽으로 가!',
  'Prof. Song: Ah, there you are! I have three Pokémon here, and each is hoping to find a trainer.': '송 박사: 아, 왔구나! 여기 포켓몬 세 마리가 있는데, 저마다 트레이너를 만나길 바라고 있어.',
  'Prof. Song: Go on — take a good look at all three, and choose the one who calls to you.': '송 박사: 어서 — 셋을 잘 살펴보고, 너를 부르는 한 마리를 골라.',

  // ── Intro (Prof. Song's welcome) ──
  'Hello there! Welcome to the world of Pokémon!': '안녕! 포켓몬의 세계에 온 걸 환영해!',
  'My name is Song. Song Nam-woo. But everyone in the region simply calls me the Professor.':
    '내 이름은 송남우란다. 하지만 이 지방 사람들은 모두 나를 송 박사님이라 부르지.',
  'But first — tell me a little about yourself. Are you a boy? Or are you a girl?':
    '하지만 먼저 — 너에 대해 조금 알려주렴. 남자아이니? 아니면 여자아이니?',
  'This world is inhabited far and wide by wonderful creatures called Pokémon. We live alongside them — as friends, as partners, and sometimes as rivals in battle.':
    '이 세계는 널리, 포켓몬이라 불리는 멋진 생명체들이 살고 있단다. 우리는 그들과 함께 살아가지 — 친구로, 파트너로, 때로는 배틀의 라이벌로.',
  'This land is the Onnuri region: a peninsula of pine-needle towns and misty highlands, of volcanic isles in the south and a cold, watchful North.':
    '이 땅은 온누리 지방 — 솔잎 마을과 안개 낀 고원, 남쪽의 화산섬과 차갑고 경계 어린 북쪽으로 이루어진 반도란다.',
  'For some, Pokémon are beloved companions. For others, they are a subject of study. I have devoted my whole life to understanding the bond between people and Pokémon.':
    '누군가에겐 포켓몬은 사랑하는 동반자이고, 누군가에겐 연구의 대상이지. 나는 사람과 포켓몬의 유대를 이해하는 데 평생을 바쳐 왔단다.',
  "Your very own story is about to unfold. A world of dreams and adventures with Pokémon awaits! Let's go!":
    '이제 너만의 이야기가 펼쳐지려 하고 있어. 포켓몬과 함께하는 꿈과 모험의 세계가 기다린다! 자, 가자!',

  // ── Name entry (new game) ──
  'What is your name?': '이름이 뭐니?',
  'And what shall I call you, new trainer?': '그래, 새 트레이너여, 널 뭐라고 부를까?',
  'Your name': '너의 이름',
  "Your rival's name?": '라이벌의 이름은?',
  "Rival's name": '라이벌 이름',
  'OK': '확인',

  // ── Starter select ──
  'Prof. Song: Welcome! Three Pokémon from this region are waiting for a trainer.\nChoose the one who calls to you.':
    '송 박사: 어서 오렴! 이 지방의 포켓몬 세 마리가 트레이너를 기다리고 있단다.\n마음이 이끄는 포켓몬을 골라보렴.',
  '◀ ▶ to browse     SPACE to choose': '◀ ▶ 둘러보기     SPACE 선택',

  // ── Pokémon Center (nurse / clerk / PC) — spoken text (speaker auto-translated) ──
  'Welcome to the Pokémon Center! 🌸': '포켓몬 센터에 오신 걸 환영합니다! 🌸',
  'We restore your tired Pokémon.\nShall I heal your Pokémon?':
    '지친 포켓몬을 회복시켜 드려요.\n포켓몬을 회복할까요?',
  "We'll take your Pokémon for just a moment!": '포켓몬을 잠시 맡아둘게요!',
  '...  ✨  ...  ✨  ...  ✨': '...  ✨  ...  ✨  ...  ✨',
  'Your Pokémon have been fully restored!\nPlease come again! 🌸':
    '포켓몬이 완전히 회복되었습니다!\n또 오세요! 🌸',
  'Okay! Please come again anytime. 🌸': '알겠어요! 언제든 다시 오세요. 🌸',
  'Welcome! Take a look at our wares.': '어서 오세요! 상품을 둘러보세요.',
  'Accessing Pokémon storage system...': '포켓몬 보관 시스템에 접속 중...',

  // ── Common battle lines (dynamic name lines handled in-scene) ──
  'Go!': '가랏!',
  // ── Title / save ──
  '▶  NEW GAME': '▶  새 게임',
  '▶  CONTINUE': '▶  이어하기',
  'Language': '언어',
  'Start a new game?': '새 게임을 시작할까요?',
  'Your current saved game will be erased.\nAre you sure you want to start over?':
    '현재 저장된 게임이 삭제됩니다.\n정말 새로 시작하시겠어요?',
  '  No, keep my save  ': '  아니요, 저장 유지  ',
  '  Yes, start over  ': '  네, 새로 시작  ',
  '↩  Restore previous save': '↩  이전 저장 복구',

  // ── Battle: action menu ──
  'FIGHT': '싸운다', 'BAG': '가방', 'POKÉMON': '포켓몬', 'RUN': '도망',
  'No usable items in the bag.': '가방에 사용할 수 있는 아이템이 없습니다.',
  'Choose your next Pokémon!': '다음 포켓몬을 선택하세요!',
  '▶ SPACE to advance  |  A to throw Pokéball': '▶ SPACE 넘기기  |  A 몬스터볼 던지기',
  'Switch to which Pokémon?': '어느 포켓몬으로 교체할까요?',
  "CAN'T RUN": '도망 불가',
  "You can't run from a trainer battle!": '트레이너 배틀에서는 도망칠 수 없어!',
  "You can't flee a Gym Battle!": '체육관 배틀에서는 도망칠 수 없어!',
  'What will you do?': '무엇을 할까?',
  'Choose a move!': '기술을 선택해!',
  'No PP left!': 'PP가 없어!',

  // ── Battle: outcome / status lines (static) ──
  'A critical hit!': '급소에 맞았다!',
  "It's super effective!": '효과가 굉장했다!',
  "It's not very effective...": '효과가 별로인 듯하다...',
  'It had no effect...': '효과가 없는 것 같다...',
  'But it missed!': '하지만 빗나갔다!',
  'Got away safely!': '무사히 도망쳤다!',
  "Can't escape!": '도망칠 수 없다!',
  'You have no more Pokémon!': '더 이상 싸울 수 있는 포켓몬이 없다!',
  "You're out of Pokémon!": '포켓몬이 모두 쓰러졌다!',

  // ── Menu (pause) ──
  'POKéDEX': '도감', 'POKÉDEX': '도감',
  'POKéMON': '포켓몬', 'SAVE': '저장', 'OPTION': '설정',
  'EXIT': '닫기', 'BACK': '뒤로', 'CANCEL': '취소', 'YES': '예', 'NO': '아니오',

  // ── City arrivals / building entries ──
  'You have arrived at Capitol City!': '소올 시티에 도착했다!',
  'This vast capital holds the heart of the nation.': '이 거대한 수도는 나라의 중심지다.',
  'You reach Seolbong City (설봉시티).': '설봉시티에 도착했다.',
  'You descend into Haean City (해안 시티).': '해안 시티로 내려간다.',
  'You reach Sunrise City (일출 시티) — the easternmost city, first to greet the dawn.':
    '일출 시티에 도착했다 — 새벽을 가장 먼저 맞이하는 가장 동쪽의 도시.',
  'You entered the Capitol Gym!': '수도 체육관에 들어섰다!',
  'You entered the Summit Dojo (정상 도장)!': '정상 도장에 들어섰다!',
  'You enter the Living Temple (생명 신전)!': '생명 신전에 들어섰다!',
  'You enter the Tidal Arena (조류 경기장)!': '조류 경기장에 들어섰다!',

  // ── Control hints (shared across scenes) ──
  'WASD: move  SPACE: enter/talk  M: menu': 'WASD: 이동  SPACE: 입장/대화  M: 메뉴',
  'WASD: move  SHIFT: run  SPACE: talk  M: menu': 'WASD: 이동  SHIFT: 달리기  SPACE: 대화  M: 메뉴',
  'WASD: move  SPACE: interact  M: menu': 'WASD: 이동  SPACE: 상호작용  M: 메뉴',

  // ── Seolbong City ──
  'A rugged highland city built around a brilliant blue crater lake — Cheonji, the Heaven Lake.':
    '눈부시게 푸른 화구호 — 천지를 중심으로 세워진 험준한 고산 도시.',
  'Mountaineers in heavy coats trade gear and soak in hot springs.':
    '두꺼운 코트를 입은 등산가들이 장비를 거래하고 온천에 몸을 담근다.',
  'But here and there, figures in black coats with red thread linger... watching.':
    '하지만 곳곳에 붉은 실이 새겨진 검은 코트의 인물들이 서성인다... 지켜보면서.',
  'A ranger blocks the eastern trail to Diamond Gorge.':
    '레인저가 다이아몬드 협곡으로 가는 동쪽 길을 막고 있다.',
  'Center & Rescue Station': '센터 & 구조대',
  'Mountain Gear Shop': '등산 장비점',

  // ── Geumgang City ──
  'You arrive in Geumgang City (금강 시티).': '금강 시티에 도착했다.',
  'An elegant river city famous for its Contest Hall and thousand-lantern stage.':
    '콘테스트 홀과 천 개의 등불 무대로 유명한 우아한 강변 도시.',
  'Contest Hall Usher: Welcome to the Geumgang Contest Hall!':
    '콘테스트 홀 안내원: 금강 콘테스트 홀에 오신 걸 환영합니다!',
  'Usher: Coordinators dazzle the crowd here with their Pokémon. (Contests coming soon!)':
    '안내원: 코디네이터들이 포켓몬으로 관중을 매료시키는 곳이에요. (콘테스트 곧 추가 예정!)',

  // ── Route 2 / signposts ──
  '↑ Pine Needle Town': '↑ 솔잎 마을',
  '🏯 Roadside Pavilion': '🏯 길가 정자',
  '↑ Coastal Road (Route 4)': '↑ 해안 도로 (4번 도로)',

  // ── Haean City ──
  'Hillside houses stacked to the ridge, a roaring fish market, a container port, and a black-sand beach.':
    '능선까지 층층이 쌓인 언덕 위 집들, 활기찬 어시장, 컨테이너 항구, 그리고 검은 모래 해변.',

  // ── Forest City ──
  'A city grown INTO the forest — homes nestled between titanic trees, linked by rope bridges.':
    '숲 속으로 자라난 도시 — 거대한 나무들 사이에 둥지를 튼 집들이 밧줄 다리로 이어져 있다.',
  'Bioluminescent plants light the paths with a soft green glow.':
    '생체발광 식물들이 은은한 초록빛으로 길을 밝힌다.',
  'The Living Temple gym rises among the roots ahead.':
    '앞쪽 뿌리 사이로 생명 신전 체육관이 솟아 있다.',
  'Prof. Song (over the Pokédex): There she is. She never truly left you — the bond holds.':
    '송 박사 (도감 너머로): 저기 있구나. 그녀는 결코 널 떠난 적이 없었어 — 유대는 이어져 있단다.',

  // ── Sunrise City ──
  'Volcanic rock, a black-sand beach, and a lighthouse over the East Sea. The great Gym crowns the plaza.':
    '화산암, 검은 모래 해변, 그리고 동해를 굽어보는 등대. 광장 꼭대기엔 거대한 체육관이 있다.',

  // ── Capitol City ──
  'Explore the city, visit the Capitol Tower,\nand challenge the Capitol Gym!':
    '도시를 둘러보고, 수도 타워를 방문하고,\n수도 체육관에 도전하세요!',
  'The Gym Leader Jin awaits at the northern gym.\nPrepare well — her shadow Pokémon are powerful.':
    '관장 진이 북쪽 체육관에서 기다리고 있어요.\n잘 준비하세요 — 그의 섀도우 포켓몬은 강력합니다.',

  // ── Baekdu Gym (Summit Dojo) ──
  'Open-walled training hall built into the mountainside, overlooking the highland lake.':
    '산비탈에 지어진 개방형 수련장, 고산 호수를 굽어본다.',
  'Cross the weighted stepping stones and defeat the two Gym Trainers to reach Leader Byeoksan.':
    '무게추가 달린 징검다리를 건너 두 체육관 트레이너를 물리치고 관장 벽산에게 도달하라.',
  'You may leave the dojo through the south door whenever you are ready.':
    '준비가 되면 언제든 남쪽 문으로 도장을 나갈 수 있다.',
  'The mountain does not move for anyone. Neither do I!': '산은 누구에게도 움직이지 않아. 나도 마찬가지다!',
  'Speed is more important than strength. Let me prove it!': '속도가 힘보다 중요해. 증명해 보이겠어!',
  '(He turns his weathered gaze toward the highland lake.)': '(그는 풍상에 닳은 시선을 고산 호수로 돌린다.)',
  'Something is disturbing the deep. Be watchful.': '깊은 곳에서 무언가가 요동치고 있어. 경계를 늦추지 마라.',

  // ── Geumgang Gym (Lantern Stage) ──
  'You step onto the Lantern Stage (등불 무대)!': '등불 무대에 올라섰다!',
  'The lanterns choose who advances. Tonight, they chose me!': '등불이 나아갈 자를 고른다. 오늘 밤, 등불은 나를 골랐어!',
  '(He lowers his voice.)': '(그가 목소리를 낮춘다.)',
  'A group in dark uniforms passed through carrying large sealed containers, moving south.':
    '어두운 제복을 입은 무리가 커다란 밀봉 용기를 들고 남쪽으로 지나갔어.',
  'My Pokémon were agitated all night. Whatever they carry, it does not sit right with the living world.':
    '내 포켓몬들이 밤새 안절부절못했어. 그들이 무얼 나르든, 살아있는 세계와는 맞지 않는 것 같아.',
  'You may leave through the south door whenever you are ready.': '준비가 되면 언제든 남쪽 문으로 나갈 수 있다.',

  // ── Haean Gym (Tidal Arena) ──
  'A port-edge arena, half-submerged at high tide. Tidal gates rise and fall on a timer.':
    '만조 때 절반쯤 잠기는 항구 끝의 경기장. 조수 관문이 시간에 맞춰 오르내린다.',
  'The tide waits for no challenger. Neither will I!': '파도는 어떤 도전자도 기다리지 않아. 나도 그럴 거다!',
  'Those dark-coated ones — they loaded sealed crates onto a barge at the Midnight Port and sailed south.':
    '그 검은 코트를 입은 자들 — 자정 항구에서 밀봉된 상자들을 바지선에 싣고 남쪽으로 항해했어.',
  'Whatever the sea is carrying for them, it should have stayed sunk. Watch yourself out there.':
    '바다가 그들을 위해 무얼 나르든, 그건 가라앉은 채로 있어야 했어. 밖에서 조심해.',

  // ── Sudo City finale party ──
  'The whole region floods the streets. Lanterns, music, confetti; north and south celebrating as one people for the first time in living memory.':
    '온 지방 사람들이 거리로 쏟아져 나온다. 등불, 음악, 색종이; 남과 북이 기억하는 한 처음으로 한 민족으로서 축하한다.',
  '🎉 The city celebrates deep into the night in your honour.': '🎉 도시는 너를 기리며 밤늦도록 축하한다.',

  // ── Forest Gym (Living Temple) ──
  'A vast greenhouse-shrine where vines and roots grow in real time, opening and blocking the way.':
    '덩굴과 뿌리가 실시간으로 자라며 길을 열고 막는 거대한 온실 신전.',
  'Defeat the two Gym Trainers, then face Leader Noksaek, the Ancient Keeper.':
    '두 체육관 트레이너를 물리치고, 고대의 수호자 관장 녹색과 맞서라.',
  'The temple grows as it pleases. So do my Pokémon — endlessly!': '신전은 제멋대로 자라나. 내 포켓몬들도 마찬가지지 — 끝없이!',
  'The seventh seal lies near the eastern coast — the Sunrise Cliffs.': '일곱 번째 봉인은 동쪽 해안 — 일출 절벽 근처에 있어.',
  'But I sense something stirring far to the south as well. The Grandmother wakes uneasily.':
    '하지만 남쪽 멀리서도 무언가 꿈틀대는 게 느껴져. 할망이 불안하게 깨어나고 있어.',

  // ── Sunrise Gym (Cliff Observatory) ──
  'You climb into the Cliff Observatory (절벽 천문대)!': '절벽 천문대에 올랐다!',
  'Half gym, half observatory, bolted into the sea-cliffs. Current crackles through rotating panels.':
    '절반은 체육관, 절반은 천문대로 바다 절벽에 박혀 있다. 회전하는 패널 사이로 전류가 튄다.',
  'Defeat the two Gym Trainers, then face Leader Beonge, the Stormwatcher.':
    '두 체육관 트레이너를 물리치고, 폭풍지기 관장 번개와 맞서라.',
  'Read the current, or it reads you. Light it up!': '전류를 읽든지, 전류에 읽히든지. 불을 밝혀!',
  'The sky over Baekdu has been wrong for days — charged, waiting. Whatever you mean to do up there, do it soon.':
    '설봉 위 하늘이 며칠째 이상해 — 잔뜩 충전된 채 기다리고 있어. 거기서 뭘 할 생각이든, 서둘러.',
  'Perfect timing. The sky is yours.': '완벽한 타이밍이야. 하늘은 네 거다.',

  // ── Capitol Gym ──
  'The air feels cold and heavy with shadow...': '공기가 차갑고 그림자로 무겁게 느껴진다...',
  'Defeat the three Shadow Trainers to reach Leader Jin.': '세 명의 섀도우 트레이너를 물리치고 관장 진에게 도달하라.',
  'In darkness, only the strong survive!': '어둠 속에선 강한 자만이 살아남아!',
  'You defeated all my Shadow Trainers. Impressive.': '내 섀도우 트레이너들을 모두 물리쳤군. 인상적이야.',

  // ── Seolbong Highland Pass ──
  'You climb into the Seolbong Highland Pass (설봉 고갯길).': '설봉 고갯길에 들어섰다.',

  // ── Route signs / prompts ──
  '🏞️ Route 3 — Diamond Gorge (금강 협곡)': '🏞️ 3번 도로 — 다이아몬드 협곡 (금강 협곡)',
  '🌊 Route 4 — Coastal Cliffside Road (해안 절벽길)': '🌊 4번 도로 — 해안 절벽길',
  '🌳 Route 5 — The Ancient Forest (고목 숲길)': '🌳 5번 도로 — 고목 숲길',
  'SPACE — Enter the Forest Shrine': 'SPACE — 숲 신전 입장',

  // ── Forest Shrine (lullaby event) ──
  '(A vine-wreathed spirit lurches awake, hissing without its lullaby.)':
    '(덩굴에 감긴 정령이 자장가 없이 쉭쉭대며 깨어난다.)',
  '(A fox-shadow bares its teeth, grieving and afraid.)': '(여우 그림자가 슬픔과 두려움에 이를 드러낸다.)',
  'The rhythm falters and fades... the bells fall silent.': '리듬이 흔들리다 사그라든다... 종소리가 조용해진다.',

  // ── Northern League (Coliseum) ──
  'Four of the Northern Elite guard the way up. Beat each to unseal the next. Every hall restores your team before the match.':
    '북방 엘리트 넷이 위로 가는 길을 지킨다. 각자를 물리쳐 다음을 개방하라. 각 홀은 대결 전에 팀을 회복시킨다.',
  'Let us see if a southerner can move stone. Begin.': '남부인이 돌을 움직일 수 있는지 보자. 시작.',
  'Freeze, southerner — or prove you can weather the cold.': '얼어붙어라, 남부인 — 아니면 추위를 견딜 수 있음을 증명해.',
  'Strike it. See what breaks first.': '내리쳐라. 무엇이 먼저 부서지는지 보자.',
  'My storm-dragons have thrown down every challenger before you. Rise — or fall.':
    '내 폭풍룡들은 네 앞의 모든 도전자를 쓰러뜨렸다. 일어서라 — 아니면 쓰러져라.',
  "You've come a long way from your waterfalls and lantern festivals, southerner.":
    '폭포와 등불 축제에서 참 멀리도 왔구나, 남부인.',
  'Let us see if the journey made you strong — or merely lucky.':
    '그 여정이 널 강하게 만들었는지 — 아니면 그저 운이 좋았는지 보자.',

  // ── Northern Plaza ──
  'Heal at the Center, stock up at the Mart, then approach the great doors when you are ready.':
    '센터에서 회복하고, 마트에서 물품을 챙긴 뒤, 준비가 되면 거대한 문으로 향하라.',
  'WASD: move  SPACE: enter / use  M: menu': 'WASD: 이동  SPACE: 입장 / 사용  M: 메뉴',
  'SPACE — Heal your team (Pokémon Center)': 'SPACE — 팀 회복 (포켓몬 센터)',
  'SPACE — Shop (Poké Mart)': 'SPACE — 상점 (포켓몬 마트)',

  // ── Sacred Peak (finale) ──
  "어사대장 Jinnok: They're here. I'll scatter them — you reach the spirit! Prove yourself its worthy keeper!":
    '어사대장 진옥: 놈들이 왔다. 내가 흩어놓을 테니 — 넌 정령에게 다다르라! 그 자격 있는 지킴이임을 증명해!',

  // ── 어사대 circuit (Eosa cities) ──
  'WASD move  SPACE enter/exam  C bike  M menu': 'WASD 이동  SPACE 입장/시험  C 자전거  M 메뉴',
  "Churned up out of the depths, one of Gyarados's brood lunges at you!":
    '심연에서 솟구쳐, 갸라도스의 무리 하나가 네게 달려든다!',

  // ── Jeju / Ferry ──
  '🏝️ Jeju City — Island Heart': '🏝️ 제주 시티 — 섬의 심장',
  'The volcanic coast of Jeju rises ahead — and far above, the vents glow at the summit.':
    '제주의 화산 해안이 앞에 솟아 있다 — 그리고 저 높이, 정상의 분화구가 빛난다.',
  'The ferry idles at the pier. Sail back to Haean City on the mainland?':
    '연락선이 부두에 정박해 있다. 본토의 해안 시티로 돌아갈까?',
  '↑ Disembark — Jeju City': '↑ 하선 — 제주 시티',
  '⛴️ The Overnight Ferry (남해 연락선)': '⛴️ 밤배 (남해 연락선)',

  // ── Sudo finale party (cont.) ──
  'Rival: Two leagues, a whole villain syndicate, and now an actual GOD. ...I stopped trying to catch up a long time ago. I just get to say I knew you.':
    '라이벌: 리그 두 개, 악당 조직 하나, 그리고 이제 진짜 신까지. ...난 오래전에 널 따라잡길 포기했어. 그냥 널 알았다고 말할 수 있는 걸로 만족해.',
  'Prof. Song: 환웅, 풍백, 우사, 운사, 나비할망 — the entire pantheon, at peace and in your care. Onnuri has never been safer, or more whole.':
    '송 박사: 환웅, 풍백, 우사, 운사, 나비할망 — 모든 신들이 평화롭게 너의 보살핌 아래에 있어. 온누리는 이보다 더 안전하거나 온전한 적이 없었어.',
  'Prof. Song: Whatever legend they tell about this region a thousand years from now, it starts with you. Thank you, Champion.':
    '송 박사: 천 년 뒤 이 지방에 대해 어떤 전설을 이야기하든, 그건 너로부터 시작될 거야. 고맙다, 챔피언.',

  // ── World map / express bus ──
  'SPACE — 🚌 Express Bus to Songhyeon (송현)': 'SPACE — 🚌 송현행 급행 버스',
  '🚌 The northern express coach idles at the stop, engine rumbling.':
    '🚌 북부행 급행 버스가 엔진을 울리며 정류장에 서 있다.',
  'Driver: Non-stop to Songhyeon — first of the eight 어사대 provinces, up across the old border. Riding with me?':
    '기사: 송현까지 논스톱 — 옛 국경 너머, 여덟 어사대 지방의 첫 번째지. 같이 갈래?',

  // ── Pine Needle Town ──
  '🏡 Pine Needle Town (솔잎 마을)': '🏡 솔잎 마을',
  'A quiet artisan village famous for ink painting and hanji paper-making.':
    '수묵화와 한지 제작으로 유명한 조용한 장인 마을.',
  'Paper lanterns sway between the houses. The air smells of pine and ink.':
    '집들 사이로 종이 등불이 흔들린다. 공기에서 소나무와 먹 냄새가 난다.',
  'The path north climbs steeply into snow and cloud.': '북쪽 길은 눈과 구름 속으로 가파르게 오른다.',

  // ── 어사대 circuit — Parangpo (representative; chief lines reused across cities) ──
  'Parangpo (파랑포) — the great West-Sea barrage holds back the tide beyond the quay, its sluice-gates gleaming with salt.':
    '파랑포 — 거대한 서해 방조제가 부두 너머의 조수를 막아서고, 수문이 소금으로 반짝인다.',
  '어사대장 Haemin waits by the water, patient as the turning tide.':
    '어사대장 해민이 물가에서, 밀물처럼 인내심 있게 기다린다.',
  'Power without patience drowns itself. Read the tide, and read me. Begin.':
    '인내 없는 힘은 스스로를 익사시킨다. 조수를 읽고, 나를 읽어라. 시작.',
  'You waited for the right wave. Good.': '알맞은 파도를 기다렸구나. 좋다.',
  'Before any exam — the province needs you.': '시험에 앞서 — 이 지방이 널 필요로 한다.',
  'The barrage still groans under that beast. Head to Parangpo Beach, surf out past the whirlpools and quell the Gyarados, then return.':
    '방조제가 아직도 그 괴수 아래서 신음한다. 파랑포 해변으로 가 소용돌이 너머로 파도타기해 갸라도스를 잠재우고 돌아오라.',
  'The Gyarados rears from the swell, sluice-water sheeting off its coils, and fixes its glare on you.':
    '갸라도스가 물결에서 몸을 일으키고, 똬리에서 수문물이 쏟아지며, 네게 시선을 고정한다.',
  '🐎 You received the Parangpo 마패!': '🐎 파랑포 마패를 받았다!',

  // ── Capitol post-game (epilogue) ──
  'In the weeks after Baekdu Peak, the region steadies. Director Suri turns herself in with full documentation; her late repentance is noted in her case.':
    '백두봉 이후 몇 주 동안 지방이 안정된다. 수리 국장은 모든 자료와 함께 자수하고, 뒤늦은 뉘우침이 사건 기록에 남는다.',
  "Professor Song: The Spirit's return stabilized the region. The three old spirits are free. And 나비할망 found her guardian. Remarkable. Both of you.":
    '송 박사: 정령의 귀환이 지방을 안정시켰어. 세 옛 정령은 자유로워졌고. 그리고 나비할망은 자신의 수호자를 찾았지. 놀라워. 너희 둘 다.',
  "A grand stone gate has opened behind the palace. ⛩ Scholars' Road is now open.":
    '궁궐 뒤로 웅장한 돌문이 열렸다. ⛩ 선비의 길이 이제 열렸다.',
  "Here — I had this prepared the moment I heard the news. Champions shouldn't have to walk everywhere.":
    '자 — 소식을 듣자마자 준비해 뒀단다. 챔피언이 어디든 걸어다닐 순 없지.',

  // ══ 어사대 circuit — full city scripts ══
  // Parangpo
  'Rampaging Gyarados (난동 갸라도스)': '난동 갸라도스',
  'A great Gyarados has been battering the West-Sea barrage from out on the open water. One more night and the sluice-gates give way, and the tide takes the lower town.':
    '거대한 갸라도스가 먼바다에서 서해 방조제를 들이받고 있어. 하룻밤만 더 지나면 수문이 무너지고, 조수가 아랫마을을 삼킬 거야.',
  'Take the shore path west out to Parangpo Beach, then Surf out to it. But mind the water — its 부하 (underlings) stir up whirlpools that wander the whole bay. Weave between them, or be dragged under.':
    '서쪽 해안길을 따라 파랑포 해변으로 가서 파도타기로 다가가라. 하지만 물을 조심해 — 그 부하들이 만 전체를 떠도는 소용돌이를 일으키니까. 그 사이를 헤쳐 나가지 않으면 끌려 들어갈 거야.',
  'It lunges, jaws wide. No turning back now!': '녀석이 아가리를 벌리고 달려든다. 이제 물러설 수 없다!',
  '어사대장 Haemin: The gates hold, and the town sleeps easy. Word travels fast on the water — they already speak your name.':
    '어사대장 해민: 수문은 버티고, 마을은 편히 잠든다. 물길엔 소문이 빠르지 — 벌써 네 이름을 입에 올리더군.',
  'Now I will see it for myself.': '이제 내가 직접 확인하겠다.',
  'Since you dealt with that Gyarados, the gates run smooth. The whole town owes you a bowl.':
    '네가 그 갸라도스를 처리해 준 뒤로 수문이 매끄럽게 돌아가. 온 마을이 네게 한 그릇 빚졌지.',
  'We rake the flats at low tide. Parangpo salt seasons half the northern coast!':
    '썰물 때 갯벌을 긁는단다. 파랑포 소금이 북부 해안 절반을 간 맞추지!',
  // Haesol
  '🐎 You received the Haesol 마패!': '🐎 해솔 마패를 받았다!',
  'Hah — eager for a bout? Not yet. Anyone can win one fight. A fighter is forged by fighting through exhaustion.':
    '하 — 한판 붙고 싶은가? 아직이야. 한 번 이기는 건 누구나 해. 투사는 지쳐 쓰러질 때까지 싸우며 단련되는 법.',
  'Best all three, back to back, then come to me. Show me you can keep your feet when your legs are burning!':
    '셋을 연달아 꺾은 뒤 내게 오라. 다리가 타들어가도 버티고 서 있음을 보여라!',
  "You didn't just win — you outlasted. Now let's see if you've anything left for ME. Begin!":
    '넌 그저 이긴 게 아니라 — 끝까지 버텼다. 이제 나를 상대할 힘이 남았는지 보자. 시작!',
  "Best his three disciples and he'll respect you. He respects nothing else.":
    '그의 제자 셋을 꺾으면 널 인정할 거야. 그것 말곤 아무것도 인정하지 않지.',
  'The Songdowon pines have shaded this shore for a thousand years. Sit awhile.':
    '송도원 소나무들이 천 년 동안 이 해안에 그늘을 드리웠지. 잠시 앉았다 가게.',
  'The Gwanmunseong checkpoint is just ahead. Have your 마패 ready.': '관문성 검문소가 바로 앞이야. 마패를 준비해 두게.',
  "Master Haegang sent you? Then you'll start with me — down here by the pier. Come on!":
    '해강 사부가 보냈다고? 그럼 나부터 시작이다 — 여기 부두에서. 덤벼!',
  'Still on your feet after Baekho? Good. The training ground is MY dojo. Show me your stance!':
    '백호를 이기고도 서 있군? 좋아. 이 훈련장은 내 도장이다. 네 자세를 보여라!',
  // Gangcheoldo
  'Berserk Steelix (폭주 강철톤)': '폭주 강철톤',
  'A Steelix has burrowed up from the ore mine that feeds our furnaces and gone berserk in the tunnels. It thrashes when the miners come near — and if it collapses the main gallery, the whole steelworks goes cold.':
    '용광로에 광석을 대는 광산에서 강철톤이 파고 올라와 갱도에서 폭주하고 있어. 광부가 다가가면 날뛰지 — 주 갱도가 무너지면 제철소 전체가 식어버려.',
  'Take the pit road at the south edge of town down to the mine, and subdue it. No forge runs while it rages. See to it.':
    '마을 남쪽 끝의 갱도길을 따라 광산으로 내려가 제압하라. 녀석이 날뛰는 한 용광로는 돌지 않는다. 처리해라.',
  'Heat and ore-dust roll through the gallery. The Steelix rears from the rock, plates glowing dull red.':
    '열기와 광석 먼지가 갱도를 휘감는다. 강철톤이 바위에서 몸을 일으키고, 비늘이 붉게 달아오른다.',
  'It lunges, shaking the whole tunnel. Hold your ground!': '녀석이 갱도 전체를 뒤흔들며 달려든다. 자리를 지켜라!',
  'You did not flinch from the heat. Good. Neither will I. Begin.': '넌 열기 앞에서 움츠리지 않았다. 좋아. 나도 그럴 것이다. 시작.',
  'The Songchon river has fed this plain for centuries. The steel came later — the water was always here.':
    '성천강이 수백 년 동안 이 평야를 먹여 살렸지. 강철은 나중이야 — 물은 늘 여기 있었어.',
  // Muyeonhang
  'Take the fog road and go into the manor. End its game. What you cannot see can still be faced... if you keep your nerve. Go.':
    '안개길을 따라 저택으로 들어가라. 그 장난을 끝내라. 보이지 않는 것도 맞설 수 있다... 담대함을 잃지 않는다면. 가라.',
  'The Fog-Wraith Gengar\'s laugh echoes from everywhere at once. Steady yourself!':
    '안개망령 팬텀의 웃음이 사방에서 한꺼번에 울린다. 마음을 다잡아라!',
  'You cleared my harbor of what I could not see. Now show me your steel directly, Champion. Face me — pass my exam, and the 마패 is yours by right.':
    '내가 보지 못한 것을 항구에서 몰아냈군. 이제 네 강함을 직접 보여라, 챔피언. 나와 맞서 — 시험을 통과하면 마패는 정당히 네 것이다.',
  // Binghagwan
  'Ice-Bound Beartic (얼음 툰베어)': '얼음 툰베어',
  'You wish to cross. But no one crosses while the ice is unsafe.': '건너고 싶겠지. 하지만 얼음이 위험한 동안엔 누구도 건너지 못한다.',
  'Below the frozen Amrok lies an ice cave, and in its heart a Beartic has woken. Its roars crack the whole sheet — every hour the split creeps closer to the town side. If it reaches us, the crossing is gone until spring.':
    '얼어붙은 압록강 아래 얼음 동굴이 있고, 그 중심에서 툰베어가 깨어났다. 그 포효가 얼음판 전체를 갈라놓지 — 매시간 균열이 마을 쪽으로 다가온다. 우리에게 닿으면 봄까지 강을 건널 수 없어.',
  '어사대장 Amrok: The ice still splinters from below. Slide your way to the heart of the ice cave, drive the Beartic out, then return to me.':
    '어사대장 압록: 아직도 얼음이 아래에서 쪼개지고 있다. 얼음 동굴 중심까지 미끄러져 나아가 툰베어를 몰아낸 뒤, 내게 돌아오라.',
  'That is the coldest kind of courage. The gate is yours to earn. Begin.':
    '그것이야말로 가장 차가운 용기다. 관문을 얻을 자격이 있다. 시작.',

  // ── 어사대 city + landmark labels ──
  'Parangpo (파랑포)': '파랑포', 'Haesol (해솔)': '해솔', 'Gangcheoldo (강철도)': '강철도',
  'Muyeonhang (무연항)': '무연항', 'Binghagwan (빙하관)': '빙하관', 'Samho (삼호)': '삼호',
  '🗼 Parangpo Lighthouse (등대)': '🗼 파랑포 등대', '⚓ Harbour Warehouse (부두)': '⚓ 부두 창고',
  '🗼 Kalma Lighthouse (등대)': '🗼 칼마 등대', '🐟 Haesol Seafood Market (수산시장)': '🐟 해솔 수산시장',
  'Parangpo Beach': '파랑포 해변', 'Kalma Beach': '칼마 해변', 'Fogbound Manor': '안개저택',
  '노스단 산책로 (Nosdan Path)': '노스단 산책로',

  // ── Muyeonhang NPCs (fog port) ──
  "Fifty years I've sailed off this coast.": '이 해안에서 오십 년을 항해했지.',
  'The sea gives, and the sea takes. Lately... it only takes.': '바다는 주고, 바다는 앗아가지. 요즘은... 앗아가기만 해.',
  'This town gets into your bones, stranger.': '이 마을은 뼛속까지 스며든다네, 나그네.',
  "Two boats lost this month, right at the pier's edge.": '이번 달에 배 두 척을 잃었어, 바로 부두 끝에서.',
  "The Chief says it's no accident. ...After what I've seen, I believe him.":
    '대장님은 사고가 아니라고 해. ...내가 본 걸 생각하면, 그 말이 맞아.',
  'I sound the horn every hour, on the hour.': '매시 정각마다 무적을 울리지.',
  'Some nights... I swear something out in the fog answers back.': '어떤 밤엔... 안개 속에서 뭔가가 대답하는 것 같아.',
  'Everyone says a GHOST lives there! ...I dare you to go in. Heehee!': '다들 거기 유령이 산대! ...들어가 볼 테면 봐. 히히!',
  "Whose cargo? ...Best not to ask that too loudly. Not in Muyeonhang.": '누구의 화물이냐고? ...그건 너무 크게 묻지 않는 게 좋아. 여기 무연항에선.',

  // ── Binghagwan NPCs (frozen border) ──
  'Still... from this overlook I can feel it out there, past the frozen Amrok. A whole continent, waiting to be walked.':
    '그래도... 이 전망대에서 얼어붙은 압록강 너머로 그게 느껴져. 걸어볼 날을 기다리는 대륙 전체가.',
  "Mind the platform, Champion. These rails haven't felt a train in years, but we sweep them every morning all the same.":
    '승강장을 조심해요, 챔피언. 이 철로엔 몇 년째 기차가 안 다녔지만, 그래도 매일 아침 쓸어낸답니다.',
  'Old-timers say when the line to the 미지의 대륙 reopens, the whole plaza will fill with travellers again.':
    '노인들은 미지의 대륙으로 가는 노선이 다시 열리면 광장이 다시 여행자들로 가득 찰 거라고 해.',
  'The far bank is another country. The bridge broke years ago — now only the ice connects us, and only in winter.':
    '건너편 강기슭은 다른 나라야. 다리는 몇 년 전에 끊겼고 — 이제 오직 얼음만이, 그것도 겨울에만 우릴 잇지.',
  'Sable, ermine, jade from across the river — the Trading Post has it all. If you can pay.':
    '검은담비, 흰담비, 강 건너 옥까지 — 교역소엔 다 있어. 값을 치를 수 있다면.',
  'Since you drove that Beartic off, the ice holds firm again. My whole village fishes it once more.':
    '네가 그 툰베어를 몰아낸 뒤로 얼음이 다시 단단해졌어. 우리 마을 전체가 다시 얼음낚시를 한다네.',

  // ── Samho NPCs (highland plateau) ──
  "The larch forests run right up to Baekdu's foot. Good timber — if the blizzards let you fell it.":
    '낙엽송 숲이 백두산 발치까지 이어져. 좋은 목재지 — 눈보라가 베게 놔둔다면.',
  "On clear nights the sky burns green and violet over the three lakes. There's no sight like it in all Onnuri.":
    '맑은 밤이면 세 호수 위로 하늘이 초록과 보라로 타올라. 온누리 어디에도 그런 광경은 없지.',
  "The 노스단 산책로 runs east off the plateau, up to our 아지트. Don't take that path unless you mean to climb.":
    '노스단 산책로는 고원 동쪽으로, 우리 아지트까지 이어져. 오를 각오가 아니면 그 길로 들어서지 마.',

  // ── Northern cities — remaining UI, interiors and city scripts ──
  'SPACE:': 'SPACE:',
  'SPACE — Confront': 'SPACE — 대면',
  'AhobiryongPass': '북풍 고개',
  'SijungCoast': '시중호 해안길',
  'ChilboHighlands': '여명산 길',
  'KaemaPlateau': '설운고원',
  'RangrimFoothills': '온성산맥 기슭',
  'RangrimSummit': '온성산맥 정상',
  'RyesongValley': '예성강 들녘',

  // Songhyeon
  'You arrive in Songhyeon (송현) — old Koryo capital, terraced under Songak Mountain, its ginseng fields green to the ridgelines.':
    '송현에 도착했다 — 송악산 아래 계단식으로 자리한 옛 고려의 도읍. 산등성이까지 인삼밭이 푸르게 이어진다.',
  '🏛️ 어사대 Hall — Chief Hyeon': '🏛️ 어사대 전당 — 어사대장 현',
  'True or false: the 마패 you seek is the token of the royal Inspectorate — the 어사대.':
    '참 또는 거짓: 네가 찾는 마패는 왕실 감찰 조직인 어사대의 증표다.',
  "Hyeon: Titles mean nothing to the 어사대 — only what you show us. Read your opponent, adapt, and do not flinch. Begin.":
    '현: 직함은 어사대에 아무 의미가 없다 — 네가 보여주는 것만이 전부다. 상대를 읽고, 적응하고, 물러서지 마라. 시작.',
  "Hyeon: Wisdom before force — that is Songhyeon's way. When you are ready, present yourself for the duel and the 마패.":
    '현: 힘보다 지혜가 먼저다 — 그것이 송현의 방식이지. 준비가 되면 결투와 마패를 위해 내 앞에 다시 서라.',
  '어사대장 Hyeon: ...Composed. Adaptable. You read the exam, not just the battle. The southern Champion is no rumour.':
    '어사대장 현: ...침착하고 유연하군. 넌 배틀뿐 아니라 시험 자체를 읽었다. 남쪽 챔피언의 명성은 헛소문이 아니었어.',
  '어사대장 Hyeon: Before any duel — the 어사대 of Songhyeon tests the mind. This hall was a Confucian academy long before it examined trainers.':
    '어사대장 현: 결투에 앞서 송현 어사대는 지혜를 시험한다. 이 전당은 트레이너를 시험하기 훨씬 전부터 성균관이었지.',
  '어사대장 Hyeon: Songhyeon has taken your measure. The next province waits — carry the 마패 with honour.':
    '어사대장 현: 송현은 네 역량을 확인했다. 다음 지방이 기다린다 — 마패를 명예롭게 지녀라.',
  '어사대장 Hyeon: Your reasoning is sound. Now let us see whether your team matches your mind.':
    '어사대장 현: 판단이 옳다. 이제 네 팀도 네 지혜에 걸맞은지 보자.',

  // Gwanmunseong
  'Supreme Gwang: But Gwanmunseong demands more. The north demands perfection. Only those who can defeat the Supreme Commander may claim the final 마패.':
    '총수 광: 하지만 관문성은 더 많은 것을 요구한다. 북부는 완벽을 요구하지. 어사대 총수를 이긴 자만이 마지막 마패를 차지할 수 있다.',
  'Supreme Gwang: With all eight 마패 in your possession, the Northern League awaits. Go forth and claim your destiny.':
    '총수 광: 여덟 마패를 모두 손에 넣었으니 북방 리그가 기다린다. 나아가 네 운명을 쟁취하라.',
  'Supreme Gwang: You have come far, southern Champion. Seven 마패 adorn your belt — each a testament to your worth.':
    '총수 광: 멀리도 왔군, 남쪽의 챔피언. 허리춤의 일곱 마패 하나하나가 네 자격을 증명한다.',
  'Supreme Gwang: You have mastered every trial the north could devise. The final 마패 is yours.':
    '총수 광: 북부가 마련한 모든 시험을 훌륭히 통과했다. 마지막 마패는 네 것이다.',
  'Warden Cheol: Supreme Commander Gwang awaits in the palace grounds. He holds the final 마패 — defeat him, and the Northern League lies beyond.':
    '경비대 철: 궁궐 뜰에서 어사대 총수 광이 기다리고 있소. 그가 마지막 마패를 지녔지 — 그를 이기면 북방 리그로 가는 길이 열릴 것이오.',
  '🐎 You received the Gwanmunseong 마패 — the eighth and final tablet!':
    '🐎 관문성 마패를 받았다 — 여덟 번째이자 마지막 마패다!',

  // Enterable city interiors
  "파랑포 뱃사람 주막 · Parangpo Sailors' Tavern": '파랑포 뱃사람 주막',
  '갈마 해변 카페 · Kalma Beach Café': '갈마 해변 카페',
  '강철도 대중목욕탕 · Gangcheoldo Bathhouse': '강철도 대중목욕탕',
  "뱃사람 여관 · Foggy Sailors' Inn": '뱃사람 여관',
  '압록강 국경 교역소 · Amrok Border Trading Post': '압록강 국경 교역소',
  '삼호 고원 산장 · Samho Highland Lodge': '삼호 고원 산장',
  'Attendant: 어서오세요! A steaming soak washes the forge-soot right off. Take your team in.':
    '안내원: 어서 오세요! 따뜻한 물에 몸을 담그면 용광로 그을음도 말끔히 씻겨요. 포켓몬들도 함께 데려오세요.',
  '🍜  강철도냉면  ·  HAMHUNG NAENGMYEON  🍜': '🍜  강철도냉면  🍜',
  'You slurp the icy, springy noodles in spicy broth — 시원하고 쫄깃하다! 😋':
    '차갑고 쫄깃한 면을 매콤한 육수와 함께 후루룩 먹는다 — 시원하고 쫄깃하다! 😋',

  // Haesol
  'Haesol (해솔) — sunlight off Kalma Beach, the blue shoulder of Mt. Kumgang on the horizon, sand still warm from dawn training.':
    '해솔 — 갈마 해변에 햇빛이 부서지고, 수평선 너머로 금강산의 푸른 능선이 보인다. 새벽 훈련의 열기가 모래에 아직 남아 있다.',
  '어사대장 Haegang cracks his knuckles and grins.':
    '어사대장 해강이 손가락 마디를 꺾으며 씩 웃는다.',
  '어사대장 Haegang: HA! Now THAT was a bout. You\'ve got it.':
    '어사대장 해강: 하! 바로 이런 승부를 원했지. 합격이다.',
  '어사대장 Haegang: HAH! Three of my best, one after another, and still standing! THAT is endurance.':
    '어사대장 해강: 하하! 내 최고의 제자 셋을 연달아 꺾고도 서 있군! 바로 그게 지구력이다.',
  '어사대장 Haegang: No tricks on my sand — just conviction and clean technique. Show me. Begin!':
    '어사대장 해강: 내 모래밭엔 잔재주 없다 — 오직 신념과 정확한 기술뿐. 보여줘라. 시작!',
  "어사대장 Haegang: You haven't bested all three yet. Baekho's at the pier, Miru at the training ground — and Cheon is down at KALMA BEACH, along the shore road off the east edge of town. Beat all three, then return.":
    '어사대장 해강: 아직 셋 모두를 꺾지 못했다. 백호는 부두, 미루는 훈련장, 천은 마을 동쪽 끝 해안길의 갈마 해변에 있다. 셋을 모두 이긴 뒤 돌아와라.',

  // Gangcheoldo
  'Gangcheoldo (강철도) — furnace-light and clanging steel, the great works pouring iron day and night.':
    '강철도 — 용광로 불빛과 강철 부딪는 소리로 가득한 도시. 거대한 제철소가 밤낮없이 쇳물을 쏟아낸다.',
  '어사대장 Cheolju stands like a girder, arms folded.':
    '어사대장 철주가 대들보처럼 굳건히 팔짱을 끼고 서 있다.',
  "어사대장 Cheolju: ...Unbent. Hm. You'll do.":
    '어사대장 철주: ...꺾이지 않았군. 흠. 합격이다.',
  '어사대장 Cheolju: ...You want the exam. First, the works.':
    '어사대장 철주: ...시험을 원하나. 먼저, 제철소부터다.',
  '어사대장 Cheolju: The Steelix still rages in the mine. Take the pit road south to the mine, subdue it, then return to me.':
    '어사대장 철주: 강철톤이 아직 광산에서 날뛰고 있다. 남쪽 갱도길로 광산에 가서 제압한 뒤 내게 돌아와라.',
  '어사대장 Cheolju: The forge rewards only endurance. Outlast my steel, if you can. Begin.':
    '어사대장 철주: 용광로는 오직 인내에 보답한다. 내 강철보다 오래 버텨 보아라. 시작.',
  '어사대장 Cheolju: ...The mine is quiet and the furnaces are lit again. A thousand families eat because of tonight.':
    '어사대장 철주: ...광산은 조용해졌고 용광로엔 다시 불이 붙었다. 오늘 밤 천 가구가 네 덕분에 밥을 먹는다.',
  'Noodle Lover: You HAVE to try the 강철도냉면 — chewy sweet-potato noodles, fiery cold broth. Best in the north!':
    '국수 애호가: 강철도냉면은 꼭 먹어 봐야 해 — 쫄깃한 고구마 전분 면에 맵고 시원한 육수. 북부 최고야!',
  '🐎 You received the Gangcheoldo 마패!': '🐎 강철도 마패를 받았다!',

  // Muyeonhang
  'Muyeonhang (무연항) — the last northern harbor, cranes looming out of a cold sea-fog, gulls unseen but heard.':
    '무연항 — 차가운 바다 안개 너머로 기중기가 우뚝 솟은 북쪽 끝 항구. 갈매기는 보이지 않고 울음소리만 들린다.',
  'From the mist, 어사대장 Mukyeong watches without a word.':
    '안개 속에서 어사대장 무경이 말없이 지켜본다.',
  'Fog-Wraith Gengar (안개 팬텀)': '안개 팬텀',
  '어사대장 Mukyeong: ...You came for the exam. But something else came first.':
    '어사대장 무경: ...시험을 보러 왔군. 하지만 먼저 온 일이 있다.',
  '어사대장 Mukyeong: The manor on the fog road still breathes mist over my harbor. Go inside, face the Gengar, then return... if it lets you.':
    '어사대장 무경: 안개길의 저택이 아직도 내 항구에 안개를 뿜고 있다. 안으로 들어가 팬텀과 맞선 뒤 돌아와라... 녀석이 보내 준다면.',
  "어사대장 Mukyeong: ...As I feared. That Gengar wore a trainer's command — someone loosed it in the manor to blind my harbor.":
    '어사대장 무경: ...우려한 대로다. 그 팬텀은 트레이너의 명령을 따르고 있었어 — 누군가 항구를 가리려고 저택에 풀어놓은 거다.',
  '어사대장 Mukyeong: In fog, you cannot see what comes. Only adapt. ...Begin.':
    '어사대장 무경: 안개 속에선 무엇이 오는지 볼 수 없다. 오직 적응할 뿐. ...시작.',
  '어사대장 Mukyeong: You saw the hand behind the fog, and you struck it. That is worth more than any drill against me.':
    '어사대장 무경: 안개 뒤의 손을 보고 정확히 쳤군. 나와 하는 어떤 훈련보다 값지다.',
  '노스단. They run cargo through Muyeonhang under the fog, bound for the sacred peak. Now that the mist has lifted, my crews will hunt them down — that is my burden, not yours.':
    '노스단이다. 놈들은 안개를 틈타 무연항으로 화물을 들여와 성스러운 봉우리로 보내고 있다. 이제 안개가 걷혔으니 내 부하들이 추적할 것이다 — 그건 내 짐이지, 네 짐이 아니다.',
  '🐎 You received the Muyeonhang 마패!': '🐎 무연항 마패를 받았다!',

  // Binghagwan
  'Binghagwan (빙하관) — the Amrok river locked in blue ice, a broken bridge-span reaching toward the far bank.':
    '빙하관 — 압록강은 푸른 얼음에 갇혀 있고, 끊어진 교각이 건너편 강기슭을 향해 뻗어 있다.',
  '어사대장 Amrok bars the crossing, breath fogging in the still cold.':
    '어사대장 압록이 고요한 추위 속에서 입김을 피우며 건널목을 막아선다.',
  '어사대장 Amrok: The coldest gate. Cross it before the ice cracks beneath you. Begin.':
    '어사대장 압록: 가장 차가운 관문이다. 발밑 얼음이 갈라지기 전에 건너라. 시작.',
  '어사대장 Amrok: ...You crossed. Few do.':
    '어사대장 압록: ...건넜군. 해내는 이는 드물다.',
  '어사대장 Amrok: ...The cracking has stopped. The crossing holds. You slid blind through that frozen maze and faced the beast in its own lair.':
    '어사대장 압록: ...갈라지는 소리가 멎었다. 건널목은 버텨냈다. 너는 얼어붙은 미로를 앞도 보지 못한 채 지나, 녀석의 소굴에서 정면으로 맞섰군.',
  '(unused — the Beartic is confronted in the heart of the ice cave.)':
    '(사용하지 않음 — 툰베어는 얼음 동굴 중심부에서 대면한다.)',
  'Stationmaster: Welcome to the 압록강 국제철도역! Grandest terminal in the north — and the emptiest.':
    '역장: 압록강 국제철도역에 오신 걸 환영합니다! 북부에서 가장 웅장하고 — 가장 텅 빈 역이지요.',
  'The line was built to run clear across the 미지의 대륙 — the Unknown Continent, off past the frozen river. Iron rails to the very edge of the map, and beyond.':
    '이 철도는 얼어붙은 강 너머 미지의 대륙을 가로지르도록 놓였습니다. 지도의 끝까지, 그리고 그 너머까지 이어지는 철길이죠.',
  'Traveler: I came all this way to catch the train to the 미지의 대륙. They tell me the line has been shut for years.':
    '여행자: 미지의 대륙행 기차를 타려고 여기까지 왔어요. 몇 년째 운행이 중단됐다고 하네요.',
  '🐎 You received the Binghagwan 마패!': '🐎 빙하관 마패를 받았다!',

  // Samho
  'Samho (삼호) — the three-lake plateau under Baekdu, larch forests deep in snow, an aurora ghosting the sky.':
    '삼호 — 백두산 아래 세 호수의 고원. 낙엽송 숲은 깊은 눈에 잠기고, 오로라가 하늘을 유령처럼 스친다.',
  '어사대장 Seolwon, last of the eight, stands serene where the world turns white.':
    '여덟 번째이자 마지막 어사대장 설원이 온 세상이 하얗게 변하는 곳에서 고요히 서 있다.',
  '어사대장 Seolwon: Pass me, and the road to the sacred peak — and the Northern League — is yours. Begin.':
    '어사대장 설원: 나를 통과하면 성스러운 봉우리와 북방 리그로 가는 길이 네 것이다. 시작.',
  '어사대장 Seolwon: Eight 마패. You are worthy to climb. The Northern League will know you now.':
    '어사대장 설원: 마패 여덟 개. 오를 자격이 있다. 이제 북방 리그가 널 알아볼 것이다.',
  '🐎 You received the Samho 마패!  (Present all eight at the Northern League.)':
    '🐎 삼호 마패를 받았다!  (북방 리그에서 여덟 마패를 모두 제시하자.)',
  '어사대장 Seolwon: The last of the eight. Steady your breath, Champion — begin—':
    '어사대장 설원: 마지막 여덟 번째다. 호흡을 가다듬어라, 챔피언 — 시작—',
  '💥 The Hall doors burst open in a gust of snow! The 노스단 Sovereign strides in, grunts fanning out behind him.':
    '💥 눈보라와 함께 전당의 문이 터지듯 열린다! 노스단 군주가 성큼 들어오고, 조무래기들이 뒤로 퍼져 선다.',
  'Sovereign Clemont: The exam is cancelled, Inspector. 노스단 has raised its 아지트 at the head of your mountain road — Samho is OURS now, the gateway to the sacred peak.':
    '군주 클레몽: 시험은 취소다, 감찰관. 노스단이 네 산길 꼭대기에 아지트를 세웠다 — 이제 삼호은 우리의 땅이며, 성스러운 봉우리로 가는 관문이다.',
  '어사대장 Seolwon: ...So they come at last, into the open. Champion — I cannot grant the exam while that tower stands over my people.':
    '어사대장 설원: ...마침내 놈들이 모습을 드러냈군. 챔피언 — 저 탑이 백성들 위에 서 있는 동안엔 시험을 허락할 수 없다.',
  'Seolwon: Take the mountain road to their 아지트. Climb it, floor by floor, and cast down the 간부 at its top. Break their hold on Samho — then, and only then, face me.':
    '설원: 산길을 따라 놈들의 아지트로 가라. 층층이 올라 꼭대기의 간부를 끌어내려라. 삼호에 대한 놈들의 지배를 깨뜨려야 — 그때야 비로소 나와 맞설 수 있다.',
  '어사대장 Seolwon: The 노스단 아지트 still looms at the head of the mountain road. Climb it, throw down their 간부, and return — then the last exam is yours.':
    '어사대장 설원: 노스단 아지트가 아직 산길 꼭대기를 짓누르고 있다. 올라가 간부를 쓰러뜨린 뒤 돌아와라 — 그러면 마지막 시험을 치르게 해주겠다.',
  '어사대장 Seolwon: ...The tower has fallen. Word came down the mountain — the 노스단 flag is torn down and their grunts scatter into the snow.':
    '어사대장 설원: ...탑이 무너졌다. 산 아래서 소식이 왔다 — 노스단 깃발이 찢겨 내려왔고 조무래기들이 눈밭으로 흩어지고 있다.',
  'You stormed their whole 아지트 alone, on the eve of your own trial. That is the spirit the peak asks for. Now — face me. Begin.':
    '자신의 시험 전날에 혼자서 놈들의 아지트를 돌파했군. 그것이 봉우리가 요구하는 정신이다. 이제 — 나와 맞서라. 시작.',
  '(unused — the 간부 is confronted at the top of the 노스단 아지트.)':
    '(사용하지 않음 — 간부는 노스단 아지트 꼭대기에서 대면한다.)',
  'Snow Child: The snow stopped falling! The Abomasnow used to make it blizzard FOREVER. Thank you, mister!':
    '눈아이: 눈이 그쳤어요! 눈설왕 때문에 끝없이 눈보라가 쳤는데. 고마워요, 아저씨!',
  'Pilgrim: Beyond the plateau lies the sacred peak itself. Only those worthy of all eight 마패 may climb. ...Is that you?':
    '순례자: 고원 너머에는 성스러운 봉우리가 있지. 여덟 마패를 모두 지닐 자격이 있는 자만 오를 수 있어. ...그게 자네인가?',

  // ── Gym badge names (Scholars' Road gate + menu badge screen) ──
  'Shadow Court Badge (Capitol)': '섀도우 코트 배지 (수도)',
  'Summit Dojo Badge (Baekdu)': '정상 도장 배지 (설봉)',
  'Lantern Stage Badge (Geumgang)': '등불 무대 배지 (금강)',
  'Tidal Arena Badge (Haean)': '조류 경기장 배지 (해안)',
  'Ancient Keeper Badge (Forest)': '고대 수호자 배지 (숲)',
  'Bedrock Badge (Dolmoe)': '암반 배지 (돌뫼)',
  'Frostbell Badge (Seorae)': '서리종 배지 (서래)',
  'Stormwatcher Badge (Sunrise)': '폭풍지기 배지 (일출)',

  // ── Scholars' Road trainers ──
  'Scholar-Trainer Hyeonu': '학자 트레이너 현우',
  'Ace Trainer Dawon': '에이스 트레이너 다원',
  'The road tests the prepared. Recite your answer in battle.': '이 길은 준비된 자를 시험한다. 네 답을 배틀로 읊어라.',
  'Forty years a trainer. The League gate is just over my shoulder — earn your way past me.':
    '트레이너 생활 사십 년. 리그 관문이 바로 내 어깨 너머에 있다 — 날 지나갈 자격을 얻어라.',

  // ══ ENDING — Northern League party → 노스단 alarm → Onseong shortcut → finale ══
  'The Northern League throws a party in your honour — the whole city out in the streets, cheering the Champion who united north and south.':
    '북방 리그가 너를 기리는 파티를 연다 — 온 도시가 거리로 나와, 남과 북을 하나로 만든 챔피언을 환호한다.',
  "Rival: I never thought anyone would beat Taewang. But it's you — so of course you did.":
    '라이벌: 누가 태왕을 이길 줄은 몰랐어. 근데 너잖아 — 그러니 당연한 거지.',
  "📟 Then, mid-celebration, your Pokédex screams an alarm. Prof. Song's face drains of colour.":
    '📟 그때, 축제 한가운데서 도감이 경보를 울린다. 송 박사의 얼굴이 새하얗게 질린다.',
  "Prof. Song: It's 노스단. They're moving on the Onseong Mountains — RIGHT NOW — racing to reach 환웅 (Hwanwoong), the Sovereign Who Descended, before anyone can stop them.":
    '송 박사: 노스단이야. 놈들이 지금 — 바로 지금 — 온성 산맥으로 움직이고 있어. 아무도 막기 전에 강림한 군주 환웅에게 닿으려 하고 있어.',
  "Prof. Song: They've sealed the whole range behind their lines. But there is another way in — the 고대 제단 (Ancient Altar) opens a hidden stair straight to the Sacred Peak.":
    '송 박사: 놈들이 산맥 전체를 봉쇄했어. 하지만 다른 길이 있지 — 고대 제단이 성스러운 봉우리로 곧장 이어지는 숨겨진 계단을 연단다.',
  "Rival: The party can wait. Go — we'll hold things here. Beat them to the top, Champion!":
    '라이벌: 파티는 나중에 해도 돼. 가 — 여긴 우리가 맡을게. 정상까지 놈들보다 먼저 도착해, 챔피언!',
  '🎉 The music fades behind you as you race for the Onseong Mountains...':
    '🎉 음악이 등 뒤로 멀어지고, 너는 온성 산맥으로 달려간다...',
  // Altar (shortcut past the blockade)
  '노스단 has sealed every pass up the Onseong Mountains — but they never knew about this.':
    '노스단이 온성 산맥의 모든 길목을 봉쇄했다 — 하지만 이곳만은 몰랐다.',
  'You lay your hand on the 고대 제단 (Ancient Altar). The stone hums with divine energy, and it responds to your presence.':
    '고대 제단에 손을 얹는다. 돌이 신성한 기운으로 진동하며, 너의 존재에 응답한다.',
  'The hidden stair opens — a shortcut straight past the blockade to the Sacred Peak, where 환웅 (Hwanwoong) awaits...':
    '숨겨진 계단이 열린다 — 봉쇄를 곧장 지나 성스러운 봉우리로 이어지는 지름길, 그곳엔 환웅이 기다린다...',
  // Finale party + rival one-on-one
  'You beat 노스단 to the summit, defeated Sovereign Clemont, and 환웅 itself descended to your side. The threat is over.':
    '너는 노스단보다 먼저 정상에 올라 군주 클레몽을 물리쳤고, 환웅이 몸소 네 곁으로 강림했다. 위협은 끝났다.',
  "You come home to a hero's welcome — and the party the alarm cut short picks up right where it left off, louder than ever.":
    '영웅의 환대 속에 돌아온다 — 경보로 중단됐던 파티가 그 어느 때보다 뜨겁게 다시 이어진다.',
  'Prof. Song: 노스단 is finished. 환웅, 풍백, 우사, 운사, 나비할망 — the entire pantheon, at peace and in your care.':
    '송 박사: 노스단은 끝났어. 환웅, 풍백, 우사, 운사, 나비할망 — 모든 신들이 평화롭게 너의 보살핌 아래 있어.',
  'Prof. Song: Whatever legend they tell of this region a thousand years from now, it starts with you. Thank you, Champion.':
    '송 박사: 천 년 뒤 이 지방에 대해 어떤 전설을 이야기하든, 그건 너로부터 시작될 거야. 고맙다, 챔피언.',
  '— Later, when the lanterns have burned low, the Rival finds you alone. —':
    '— 이윽고, 등불이 사그라들 무렵, 라이벌이 홀로 있는 너를 찾아온다. —',
  'Rival: ...We really did it. Every gym, both leagues, a whole syndicate, and a god at the end of it.':
    '라이벌: ...우리 정말 해냈어. 모든 체육관, 두 리그, 조직 하나, 그리고 마지막엔 신까지.',
  'Rival: So — what now? Are you going to keep adventuring from here?':
    '라이벌: 그래서 — 이제 어쩔 거야? 앞으로도 모험을 계속할 거야?',
  "(You look out over the sleeping region — north and south, whole at last. Wherever the road goes next... it's yours to walk.)":
    '(잠든 지방을 내려다본다 — 남과 북이 마침내 하나가 되었다. 다음 길이 어디로 향하든... 그건 네가 걸어갈 길이다.)',

  // ── Sacred Peak (climb) ──
  "The Ancient Altar's hidden stair delivers you to a realm above the clouds. Three sealed shrines rise along the ridge to the Sacred Peak, where the oldest myth says the heavens once touched the earth.":
    '고대 제단의 숨겨진 계단이 너를 구름 위의 세계로 데려간다. 능선을 따라 봉인된 세 사당이 성스러운 봉우리로 솟아 있고, 가장 오래된 신화는 이곳에서 하늘이 땅에 닿았다고 전한다.',
  "어사대장 Jinnok: 노스단 is already climbing. Reach the Wind, the Rain and the Clouds before they do. I'll hold the lower wards and heal you as you pass. Go, Champion.":
    '어사대장 진옥: 노스단이 이미 오르고 있어. 놈들보다 먼저 바람, 비, 구름에 다다르라. 아래쪽 결계는 내가 지키고, 지나갈 때 회복시켜 주마. 가라, 챔피언.',
  '🌋 Cheonji — the summit lake': '🌋 천지 — 정상의 호수',

  // ── Northern Reaches (어사대 gauntlet) ──
  'Far enough, southerner. You crossed our woods without a guide — few outsiders manage even that.':
    '거기까지다, 남부인. 안내인도 없이 우리 숲을 건넜군 — 외지인 중 그마저 해내는 자는 드물지.',
  'But the shrines lie beyond me, and I do not move for reputation. Prove your intent — or turn back the way you came.':
    '하지만 사당은 나를 지나야 있고, 나는 명성 따위로 비켜서지 않아. 네 뜻을 증명하라 — 아니면 왔던 길로 돌아가라.',
  "We charted the shrines from the stars already. You're too late — but I'll enjoy slowing you down among the trees.":
    '우린 이미 별자리로 사당의 위치를 파악했어. 넌 너무 늦었지 — 그래도 이 숲에서 널 붙잡아 두는 건 즐겁겠군.',
  'Charming. But the 어사대 do not run on rumor. Show me the trainer beneath the legend.':
    '귀엽군. 하지만 어사대는 소문으로 움직이지 않아. 그 전설 아래의 트레이너를 보여봐.',
  'Iron does not bend for sentiment. Come.': '강철은 감정으로 휘지 않는다. 와라.',

  // ══ Villain arc: Team Suri / 노스단 ══
  // Sudo Lab revelation (Ch.7)
  "...You really are something. Okay. Let's go save a giant moth grandmother.":
    '...너 정말 대단하다. 좋아. 거대 나방 할머니를 구하러 가자.',
  "A sentence I never thought I'd say.": '평생 할 줄 몰랐던 말이네.',
  "노스단 has already moved south, toward the Jeju vents. There's no time to lose.":
    '노스단이 이미 남쪽, 제주 분화구로 이동했어. 지체할 시간이 없어.',
  'Protect 나비할망 — and through her, the whole south. Go. Now.':
    '나비할망을 지켜 — 그리고 그녀를 통해 남부 전체를. 가. 지금.',
  '▶ Chapter 8 — Route 5 & the Ancient Forest — continues your journey south.':
    '▶ 8장 — 5번 도로 & 고목 숲 — 남쪽으로의 여정이 이어진다.',
  "Thank you for coming so fast. I finally understand what we're facing.":
    '이렇게 빨리 와줘서 고마워. 드디어 우리가 뭘 마주하고 있는지 알아냈어.',
  'Team Suri wants to wake the Spirit of Cheonji and control it — to heal the region. Misguided, dangerous.':
    '수리단은 천지의 정령을 깨워 통제하려 해 — 지방을 치유하려고. 그릇되고 위험한 생각이지.',
  "But 노스단 doesn't care about the Spirit. They want to be PRESENT when it wakes —":
    '하지만 노스단은 정령엔 관심 없어. 그들은 정령이 깨어날 때 그 자리에 있으려 해 —',
  '— to harvest the catastrophic awakening energy and weaponize it against the south.':
    '— 그 파국적인 각성 에너지를 수확해 남부를 향한 무기로 삼으려는 거야.',
  // Jeju Vent (나비할망 + Commander Ryeo)
  "Turn back! The Director's orders — no one reaches the summit before our transport secures the moth!":
    '돌아가! 국장님 명령이야 — 우리 수송선이 나방을 확보하기 전엔 누구도 정상에 못 가!',
  'You climb fast for a tourist. It ends here!': '관광객치곤 빨리 오르는군. 여기서 끝이다!',
  '나비할망 folds her glowing, dancheong-patterned wings and settles beside you at last.':
    '나비할망이 단청 무늬로 빛나는 날개를 접고 마침내 네 곁에 내려앉는다.',
  "She's chosen you as her guardian — and the south's. You truly earned her.":
    '그녀가 널 자신의 — 그리고 남부의 수호자로 택했어. 넌 그녀를 얻을 자격이 있었어.',
  'A sound like metal grinding. Commander Ryeo emerges from the shadows of the rig — bloodied, furious, movements sharp with desperation.':
    '금속이 갈리는 듯한 소리. 사령관 려가 굴착 장치의 그림자에서 나타난다 — 피투성이에, 분노에 차, 절박함으로 날카로운 몸짓으로.',
  'That moth was supposed to be OUR key to reshaping this peninsula! And you—':
    '그 나방은 이 반도를 다시 빚을 우리의 열쇠였어! 그런데 네가—',
  "...Then I'll take it from your corpse. One final test. You and me. No team. Just will.":
    '...그럼 네 시체에서 빼앗겠어. 마지막 시험이다. 너와 나. 팀도 없이. 오직 의지로.',
  "...She looks at you like you're not a tool to be used. Like you matter. That's what I never understood about this region. That's what we tried to control.":
    '...그녀는 널 이용할 도구가 아닌 것처럼 봐. 네가 소중한 것처럼. 그게 내가 이 지방에 대해 끝내 이해하지 못한 거야. 그게 우리가 통제하려 했던 거고.',
  // Baekdu Summit (matrix / Director Suri sacrifice)
  "The matrix is almost complete. You're too late to matter!": '매트릭스가 거의 완성됐어. 넌 너무 늦어서 아무 소용 없어!',
  "Commander Ryeo gave the order. The trio's power will wake Hwanwoong — and the south will kneel.":
    '사령관 려가 명령을 내렸어. 세 정령의 힘이 환웅을 깨울 거야 — 그리고 남부는 무릎 꿇겠지.',
  "Keep moving. I'll patch your Pokémon between their patrols. You'll need every one of them at full strength up top.":
    '계속 움직여. 놈들 순찰 사이사이에 네 포켓몬을 회복시켜 줄게. 위에선 전부 최상의 상태여야 할 거야.',
  "I ran the numbers on 노스단's matrix. They didn't. The trio's siphoned energy isn't stabilizing anything — it's CONCENTRATING heat into the magma chamber beneath this peak.":
    '내가 노스단의 매트릭스를 계산해 봤어. 놈들은 안 했지. 세 정령에게서 빨아들인 에너지는 아무것도 안정시키지 못해 — 이 봉우리 아래 마그마 방으로 열을 응집시키고 있어.',
  "If that machine runs to completion, it won't just wake Hwanwoong. It will trigger an eruption that takes the entire northern range with it.":
    '그 기계가 완성되면 환웅만 깨우는 게 아니야. 북방 산맥 전체를 삼키는 분화를 일으킬 거야.',
  "I spent thirty years chasing a way to heal this region. I won't let my work be the thing that ends it. You carry the seventh tablet — and 나비할망. Stop them. Please.":
    '난 삼십 년을 이 지방을 치유할 방법을 좇았어. 내 일이 이 지방을 끝장내는 게 되게 놔둘 순 없어. 넌 일곱 번째 석판과 나비할망을 지녔지. 놈들을 막아줘. 부탁이야.',
  "I've got your team — go!": '네 팀은 내가 맡을게 — 가!',
  'Executive Mubaek: Commander Ryeo retreated. I did not. The matrix completes in minutes, and you will not reach the altar before it does.':
    '간부 무백: 사령관 려는 물러났지만, 나는 아니야. 매트릭스는 몇 분이면 완성돼. 넌 그 전에 제단에 못 닿아.',
  "I didn't take the title of Magistrate just for show. Go! I'll break their line — you fix the sky!":
    '내가 괜히 관찰사 직함을 받은 게 아니야. 가! 놈들 방어선은 내가 뚫을 테니 — 넌 하늘을 되돌려!',
  // Forest City
  'Your Pokédex chirps — Professor Song checking in.': '도감이 삑 울린다 — 송 박사의 연락이다.',
  'The Ancient Keeper Badge is yours — well done. The road climbs north from Forest City, up Route 6 to Dolmoe City. Keep pressing on.':
    '고대 수호자 배지를 얻었구나 — 잘했어. 숲 시티에서 북쪽으로 6번 도로를 따라 돌뫼 시티까지 길이 오른단다. 계속 나아가.',
  'The trees whisper of black-coated strangers heading for the eastern coast.':
    '나무들이 동쪽 해안으로 향하는 검은 코트의 낯선 자들에 대해 속삭여.',
  'Keeper Noksaek guards the Living Temple. Earn his seal, and he may share what the roots remember.':
    '수호자 녹색이 생명 신전을 지키지. 그의 인장을 얻으면, 뿌리가 기억하는 것을 나눠줄지도 몰라.',

  // ── Route trainers (pre-battle taunts) ──
  'Strong, for someone fresh from the capital!': '수도에서 갓 온 사람치곤 강하군!',
  'Fascinating data! Thank you for the sample.': '흥미로운 데이터야! 표본 고마워.',
  'Hold still! ...Actually, my Pokémon are better subjects. And better fighters. Smile!':
    '가만있어! ...아니, 내 포켓몬이 더 나은 피사체지. 그리고 더 잘 싸우고. 웃어!',
  'Ahoy! Salt in my beard, salt in my blood. My sea-Pokémon will wash you right off this cliff!':
    '어이! 수염에도 소금, 피에도 소금. 내 바다 포켓몬이 널 이 절벽에서 씻어내 버릴 거다!',
  'These old trees are crawling with my favourites! Wanna see my best ones? They bite!':
    '이 고목들엔 내가 제일 좋아하는 녀석들이 우글거려! 최고의 녀석들 볼래? 물어!',
  'My birds ride the sea wind off these cliffs. Catch them if you can!':
    '내 새들은 이 절벽의 바닷바람을 타지. 잡을 수 있으면 잡아봐!',
  'The old 용 dragons sleep beneath this coast. My partners carry their blood. Face them!':
    '오래된 용들이 이 해안 아래 잠들어 있어. 내 파트너들은 그 피를 이어받았지. 맞서봐!',
  // Route trainer names
  'Photographer Seulgi': '사진사 슬기',
  'Bug Catcher Beomseok': '벌레잡이 소년 범석',
  'Dragon Tamer Yunho': '드래곤 조련사 윤호',

  // ── Dolmoe City + Gym ──
  'Every dolmen in this valley was raised by hand. My grandfather cut those capstones himself.':
    '이 골짜기의 모든 고인돌은 손으로 세운 거야. 저 덮개돌은 우리 할아버지가 직접 깎으셨지.',
  '옹기 jars breathe, you know. Ferment anything in them and it keeps through the hardest winter.':
    '옹기 항아리는 숨을 쉰단다. 뭐든 그 안에 발효시키면 가장 혹독한 겨울도 버티지.',
  "The Stonemason's Quarry gym lies to the west; the road north climbs into snow toward Seorae. Heal at the Center first if you like.":
    '석공 채석장 체육관은 서쪽에 있고, 북쪽 길은 눈을 헤치며 서래로 오른다. 원한다면 먼저 센터에서 회복해라.',
  '↑ Dolmoe Mine (→ Seorae)': '↑ 돌뫼 광산 (→ 서래)',
  'Mind the rockslides — one wrong push and the quarry pushes back!': '낙석을 조심해 — 잘못 밀면 채석장이 되받아쳐!',
  'Stone and steel, stone and fist. Break one, the next still stands.': '돌과 강철, 돌과 주먹. 하나를 부숴도 다음이 버티고 서 있지.',
  "The road climbs on to Seorae, and the snow. Carry your load steady. Leave through the south door when you're ready.":
    '길은 서래로, 눈 속으로 이어져. 짐을 흔들림 없이 짊어져. 준비되면 남쪽 문으로 나가라.',
  "You descend onto the quarry floor of the Stonemason's Quarry (석공 채석장)!": '석공 채석장 바닥으로 내려선다!',
  'Hewn granite tiers, dolmen slabs, and rock-cut carvings loom overhead.':
    '깎아낸 화강암 층계, 고인돌 판석, 암각 조각이 머리 위로 우뚝 솟아 있다.',
  'Defeat the two Gym Trainers, then face Leader Sandol — The Bedrock.': '두 체육관 트레이너를 물리치고, 암반 관장 산돌과 맞서라.',

  // ── Seorae Town + Gym ──
  'The Skate Link is the fastest way east. Keep your balance when the wind picks up!':
    '스케이트 링크가 동쪽으로 가는 가장 빠른 길이야. 바람이 세지면 균형을 잘 잡아!',
  'Snow remembers every chisel stroke—until the spring asks it to become water again.':
    '눈은 끌질 하나하나를 기억해 — 봄이 다시 물이 되라고 청할 때까지.',
  'The hot spring is open to every traveler. Steam is Seorae’s warmest welcome.':
    '온천은 모든 여행자에게 열려 있어요. 김은 서래의 가장 따뜻한 환영이죠.',
  'These frost-berry skewers stay cold all day. Perfect for a hike!': '이 서리열매 꼬치는 하루 종일 시원해요. 등산에 딱이죠!',
  'The old pine grove shelters more than people realize. Listen closely in the snow.':
    '오래된 소나무 숲은 사람들 생각보다 많은 걸 품고 있어. 눈 속에서 귀 기울여 봐.',
  'What a beautiful resort town! I could stay here all winter.': '정말 아름다운 휴양 도시야! 겨우내 여기 머물 수 있겠어.',
  'The mountain trains champions. Come back strong after your climb.': '산은 챔피언을 단련하지. 등반을 마치고 강해져서 돌아와.',
  'The snow sculptures here are incredible!': '여기 눈 조각들 정말 대단해!',
  'Ring the wrong bell, and the winter answers. Let it answer for you!': '엉뚱한 종을 울리면 겨울이 응답하지. 그 응답을 네가 받아봐!',
  'The frost-bells chose me to slow you. Do not take that lightly.': '서리종이 널 늦추라고 날 골랐어. 가볍게 여기지 마.',
  "Above Seorae the road drops to Sunrise City, and the first light of Onnuri. Leave by the south door when you're ready.":
    '서래 위로 길은 일출 시티, 온누리의 첫 빛으로 내려가. 준비되면 남쪽 문으로 나가.',
  '📟 Your Pokédex buzzes — Professor Song, urgent.': '📟 도감이 울린다 — 송 박사, 긴급.',
  'A sheet of blue ice, frost-bells hung in rows, hot-spring steam curling at the eaves.':
    '푸른 얼음판, 줄지어 걸린 서리종, 처마 끝에 감기는 온천의 김.',

  // ══ Gyms — complete (trainer names, leader intros/wins, descriptions, badges) ══
  // Trainer names
  'Shadow Trainer Miso': '섀도우 트레이너 미소', 'Shadow Trainer Jaemin': '섀도우 트레이너 재민',
  'Shade Trainer Yuna': '섀도우 트레이너 유나',
  'Gym Trainer Taeguk': '체육관 트레이너 태극', 'Gym Trainer Nari': '체육관 트레이너 나리',
  'Gym Trainer Boram': '체육관 트레이너 보람', 'Gym Trainer Junho': '체육관 트레이너 준호',
  'Gym Trainer Haedo': '체육관 트레이너 해도', 'Gym Trainer Byungchan': '체육관 트레이너 병찬',
  'Gym Trainer Chungha': '체육관 트레이너 청하', 'Gym Trainer Minho': '체육관 트레이너 민호',
  'Gym Trainer Bawoo': '체육관 트레이너 바우', 'Gym Trainer Doran': '체육관 트레이너 도란',
  'Gym Trainer Nunsong': '체육관 트레이너 눈송', 'Attendant Baram': '신전 시종 바람',
  'Gym Trainer Seongwoo': '체육관 트레이너 성우', 'Gym Trainer Daehwi': '체육관 트레이너 대휘',
  // Badge names
  'Summit Seal Badge': '정상 봉인 배지', 'Lantern Stage Badge': '등불 무대 배지',
  'Tidekeeper Badge': '조수지기 배지', 'Ancient Keeper Badge': '고대 수호자 배지',
  'Frostbell Badge': '서리종 배지', 'Stormwatcher Badge': '폭풍지기 배지',
  // Capitol — Leader Jin
  'A figure steps out from the shadows...': '그림자에서 한 인물이 걸어 나온다...',
  "I am Jin, Guardian of Capitol City's shadows.": '나는 진, 소올 시티의 그림자를 지키는 자다.',
  'My Corrpanda and I will test your resolve.': '나의 콜판다와 내가 너의 각오를 시험하겠다.',
  'Darkness is not evil — it is the truth behind light.': '어둠은 악이 아니야 — 빛 뒤에 숨은 진실이지.',
  'Come. Show me what you are made of.': '와라. 네가 어떤 자인지 보여봐.',
  // Baekdu — Byeoksan
  '(A broad-shouldered man sits cross-legged on a flat boulder, eyes closed. He rises as you approach.)':
    '(넓은 어깨의 남자가 평평한 바위에 가부좌를 틀고 눈을 감고 있다. 네가 다가가자 일어선다.)',
  'Come. Show me what that potential looks like.': '와라. 그 잠재력이 어떤 것인지 보여봐.',
  'The mountain tested you and you stood.': '산이 널 시험했고 넌 버텼다.',
  'Those black-coated people circling my city — the wild Pokémon near Cheonji Lake have been agitated for weeks.':
    '내 도시 주위를 맴도는 저 검은 코트의 자들 — 천지 호수 근처의 야생 포켓몬들이 몇 주째 동요하고 있어.',
  // Geumgang — Namsun
  'A namsadang performance stage lit by a thousand swaying lanterns.':
    '천 개의 흔들리는 등불로 밝혀진 남사당 공연 무대.',
  'Defeat the two Gym Trainers, then face Leader Namsun, the Eternal Performer.':
    '두 체육관 트레이너를 물리치고, 영원한 광대 관장 남순과 맞서라.',
  'I am Namsun — the Eternal Performer. I have danced this stage forty years.':
    '나는 남순 — 영원한 광대야. 이 무대에서 사십 년을 춤췄지.',
  'Fairy magic is not gentleness. It is the spell that holds a crowd breathless.':
    '페어리의 마법은 상냥함이 아니야. 관중의 숨을 멎게 하는 주문이지.',
  'Let us see if your Pokémon can hold mine. Begin!': '네 포켓몬이 내 것을 감당할 수 있는지 보자. 시작!',
  'A fine performance. The lanterns will remember you.': '멋진 공연이었어. 등불이 널 기억할 거야.',
  'Beautiful. The lanterns have never shone for a finer challenger.': '아름다워. 등불이 이보다 훌륭한 도전자를 위해 빛난 적은 없었어.',
  // Haean — Harang
  'Defeat the two Gym Trainers, then face Leader Harang, the Tidekeeper.':
    '두 체육관 트레이너를 물리치고, 조수지기 관장 하랑과 맞서라.',
  'Cold currents, poison spines — the deep is not kind. Show me you can swim in it.':
    '차가운 해류, 독 가시 — 심해는 자비롭지 않아. 그 속에서 헤엄칠 수 있음을 보여줘.',
  'I am Harang, the Tidekeeper. I read the sea the way you read a face.':
    '나는 하랑, 조수지기야. 나는 네가 얼굴을 읽듯 바다를 읽지.',
  'My Pokémon ride the current and strike when it turns. Can you hold your footing?':
    '내 포켓몬은 해류를 타고 흐름이 바뀔 때 친다. 발을 딛고 버틸 수 있겠어?',
  'High tide rises. Let us begin.': '만조가 차오른다. 시작하자.',
  'The tide turned in your favour. Well earned.': '물결이 네게 유리하게 돌아섰군. 마땅히 얻은 거야.',
  'The tide chose you. Few can say that.': '파도가 널 택했어. 그렇게 말할 수 있는 자는 드물지.',
  // Forest — Noksaek
  'Roots run deeper than you think. Mind your footing.': '뿌리는 네 생각보다 깊어. 발밑을 조심해.',
  'I am Noksaek, Keeper of the Living Temple. I have tended these roots for a hundred years.':
    '나는 녹색, 생명 신전의 수호자야. 백 년 동안 이 뿌리들을 돌봐 왔지.',
  'Grass is not weakness. It is patience that splits stone. Show me yours.':
    '풀은 나약함이 아니야. 돌을 쪼개는 인내지. 네 것을 보여봐.',
  'Let the temple judge you. Begin.': '신전이 널 판단하게 하라. 시작.',
  'The roots accept you. Well fought.': '뿌리가 널 받아들였어. 잘 싸웠다.',
  'The forest has spoken. You are worthy to pass.': '숲이 말했어. 넌 지나갈 자격이 있다.',
  // Dolmoe — Sandol
  "(A broad, quiet man with granite-dust in his hair hefts a chisel-hammer over one shoulder.)":
    '(머리에 화강암 먼지를 뒤집어쓴, 과묵하고 다부진 남자가 정끌망치를 한쪽 어깨에 둘러멘다.)',
  "Sandol: Leader Sandol? Gone up to the 고인돌 유적 — the dolmen ruins west of town. Black-coated diggers were sniffing around the old graves.":
    '채석장 인부: 관장 산돌 말이야? 고인돌 유적으로 올라갔어 — 마을 서쪽의 고인돌 폐허 말이야. 검은 코트의 발굴자들이 옛 무덤 주위를 킁킁대고 있었거든.',
  'Quarry Worker: Leader Sandol? Gone up to the 고인돌 유적 — the dolmen ruins west of town. Black-coated diggers were sniffing around the old graves.':
    '채석장 인부: 관장 산돌 말이야? 고인돌 유적으로 올라갔어 — 마을 서쪽의 고인돌 폐허 말이야. 검은 코트의 발굴자들이 옛 무덤 주위를 킁킁대고 있었거든.',
  'Quarry Worker: No badge today unless you fetch him. Follow the western trail out of the city.':
    '채석장 인부: 그를 데려오지 않으면 오늘 배지는 없어. 도시 서쪽 오솔길을 따라가.',
  "The mountain doesn't rush. Doesn't boast. It just endures, and outlasts everything that tries to break it.":
    '산은 서두르지 않아. 뽐내지도 않지. 그저 견디고, 자신을 부수려는 모든 것보다 오래 버티지.',
  "Let's see if you've got that in you. Or if you crack.": '네게 그런 게 있는지 보자. 아니면 부서지는지.',
  "The mountain remembers those who don't crack. It remembers you now.": '산은 부서지지 않는 자를 기억하지. 이제 널 기억한다.',
  "...Didn't crack. Good. The mountain respects that. Carry it steady.": '...부서지지 않았군. 좋아. 산은 그런 걸 존중해. 흔들림 없이 짊어져.',
  // Seorae — Yeona
  'Defeat the two Gym Trainers, then face Leader Yeona — The Winter Bell.':
    '두 체육관 트레이너를 물리치고, 겨울종 관장 연아와 맞서라.',
  "You've climbed a long way in the cold to reach me. Most turn back at the treeline.":
    '나에게 오려고 추위 속을 멀리도 올라왔군. 대부분은 수목한계선에서 돌아서지.',
  "Winter doesn't ask if you're ready. It simply arrives. So — let it arrive.":
    '겨울은 네가 준비됐는지 묻지 않아. 그냥 찾아오지. 그러니 — 오게 두렴.',
  'Yeona: ...The thaw comes even to the deepest winter. You are that thaw. Go warmly.':
    '연아: ...가장 깊은 겨울에도 해빙은 찾아와. 네가 그 해빙이야. 따뜻하게 가렴.',
  // Sunrise — Beonge
  'The panels only turn for the quick. Keep up!': '패널은 빠른 자에게만 돌아가지. 따라와!',
  'I am Beonge, the Stormwatcher. I have read these skies my whole life.':
    '나는 번개, 폭풍지기야. 평생 이 하늘을 읽어 왔지.',
  'Electricity is not power. It is TIMING — the instant the sky decides to strike.':
    '전기는 힘이 아니야. 타이밍이지 — 하늘이 내리치기로 정하는 그 찰나.',
  'Five partners ride my current. Show me your timing. Begin!':
    '다섯 파트너가 내 전류를 타지. 네 타이밍을 보여봐. 시작!',
  'The storm answered to you. Take the Stormwatcher Badge.': '폭풍이 네게 응답했어. 폭풍지기 배지를 받아.',

  // ── Capitol Tower / Palace NPCs ──
  'WASD/Arrows  |  SPACE: enter  |  SHIFT: run  |  M: menu': 'WASD/방향키  |  SPACE: 입장  |  SHIFT: 달리기  |  M: 메뉴',
  'Welcome to the top of Capitol Tower!': '수도 타워 꼭대기에 오신 걸 환영합니다!',
  'From here you can see the entire city... look at all those lights.': '여기서는 도시 전체가 보여요... 저 불빛들 좀 봐요.',
  "See that green patch to the north? That's the palace grounds.": '북쪽에 저 초록빛 구역 보여요? 저게 궁궐 부지예요.',
  'And to the south — Route 1 cutting through the mountains.': '그리고 남쪽으로는 — 산을 가로지르는 1번 도로가 있죠.',
  'Somewhere out there, the next great trainer is on their journey.': '저 어딘가에서, 다음 위대한 트레이너가 여정을 걷고 있어요.',
  "Maybe that's you! 🌟": '어쩌면 그게 당신일지도! 🌟',
  'This is the Ancient Palace, 600 years of history.': '이곳은 고궁, 육백 년의 역사죠.',
  'The original rulers once walked these halls.': '옛 통치자들이 한때 이 회랑을 거닐었습니다.',
  'They say their spirits still watch over the city.': '그들의 혼이 여전히 도시를 지켜본다고들 하죠.',
  'Welcome to the Capitol Palace Museum!': '수도 궁궐 박물관에 오신 걸 환영합니다!',
  'That artifact was used by the first city founder.': '저 유물은 도시의 첫 창건자가 사용했습니다.',
  'And that sword? It slayed a shadow beast long ago...': '그리고 저 검이요? 아주 오래전 그림자 짐승을 베었죠...',

  // ── Onseong Mountains / Nosdan Hideout / Cheonji ──
  '⛰ 온성산 기슭 (Onseong Foothills)': '⛰ 온성산 기슭',
  '↑ 하부 동굴 (Lower Cavern)': '↑ 하부 동굴',
  '⛰ 온성 하부 동굴 (Lower Cavern)': '⛰ 온성 하부 동굴',
  'Far as you climb, runt. 노스단 owns this tower now — and soon all of Samho!':
    '올라올 테면 올라와, 애송이. 노스단이 이제 이 탑을 차지했어 — 곧 삼호 전체도!',
  'The 노스단 flag is torn down. Their grip on Samho is broken, and the grunts flee down the mountain road.':
    '노스단 깃발이 찢겨 내려온다. 삼호에 대한 그들의 지배가 무너지고, 조무래기들은 산길 아래로 달아난다.',
  'A profound peace settles over you as you gaze across the ancient waters. This is a place of deep contemplation, where the sacred waters gather in eternal stillness.':
    '태고의 물결을 바라보노라니 깊은 평화가 내려앉는다. 이곳은 깊은 사색의 장소, 성스러운 물이 영원한 고요 속에 모이는 곳이다.',

  // ── Northern League (coliseum, cont.) ──
  "(The hall's healing machine restores your team to full health.)": '(홀의 회복 장치가 네 팀을 완전히 회복시킨다.)',
  'Taewang rises from his throne for the first time — slowly, deliberately.': '태왕이 처음으로 옥좌에서 일어선다 — 천천히, 신중하게.',
  'Taewang: ...In thirty years on this throne, I have beaten every Onnuri Champion sent to me. Every one.':
    '태왕: ...이 옥좌에 앉은 삼십 년간, 내게 보내진 모든 온누리 챔피언을 이겼다. 하나도 빠짐없이.',
  "Taewang (inclining his head — a king's respect): The peninsula bred a real trainer at last. Your team is enshrined in the Northern Hall of Fame, beside the north's own legends.":
    '태왕 (고개를 숙이며 — 왕의 예우): 반도가 마침내 진짜 트레이너를 길러냈군. 너의 팀은 북방 명예의 전당에, 북부 자신의 전설들 곁에 봉안된다.',
  'Taewang: You have climbed the Northern League and defeated me once again. Your strength is beyond dispute.':
    '태왕: 다시 북방리그를 올라 나를 꺾었구나. 네 강함에는 이제 누구도 이의를 제기할 수 없다.',
  '🏆 Your team is recorded in the Northern Hall of Fame once more!':
    '🏆 네 팀이 다시 한번 북방 명예의 전당에 등록되었다!',
  'Your Pokémon have been fully restored. You will now return to the Northern League Pokémon Center.':
    '포켓몬이 모두 회복되었다. 북방리그 포켓몬센터 앞으로 돌아간다.',

  // ── Gwanmunseong Checkpoint ──
  '🛡 관문성 관문 (Gwanmunseong Checkpoint)': '🛡 관문성 관문',
  'Royal Warden: Halt. The road into Gwanmunseong is sealed until the seven regional trials are complete.':
    '왕실 관리인: 멈춰라. 일곱 지방 시험을 모두 마칠 때까지 관문성으로 가는 길은 봉쇄되어 있다.',
  'Royal Warden: The gate to Gwanmunseong is open to you. Seek Supreme Gwang in the capital — he holds the final test.':
    '왕실 관리인: 관문성으로 가는 문이 네게 열렸다. 수도에서 최고위 광을 찾아라 — 그가 마지막 시험을 쥐고 있다.',

  // ── Songhyeon capital-road closure ──
  '🚧 Capital road closed': '🚧 평성 방면 도로 폐쇄',
  'SPACE — Inspect closed road': 'SPACE — 폐쇄된 길 확인',
  'The old direct road to Pyeongseong is closed.': '평성으로 바로 이어지던 옛길은 폐쇄되어 있다.',
  'Entry to the capital is permitted only through the Gwanmunseong checkpoint after earning all seven regional 마패.':
    '일곱 지방 마패를 모두 얻은 뒤 관문성 검문소를 통과해야만 평성에 들어갈 수 있다.',

  // ══ Onnuri League (Elite Four + Champion Hwangeum) ══
  '🏛 Onnuri Pokémon League': '🏛 온누리 포켓몬 리그',
  'The League is a single trial — best all four masters again, in one unbroken run, to reach the Champion.':
    '리그는 하나의 시련 — 네 명의 명인을 한 번에, 끊김 없이 다시 꺾어야 챔피언에 이른다.',
  'Defeat one to unseal the way to the next. Each hall has a healing machine, so your team is restored to full before every match.':
    '하나를 물리치면 다음으로 가는 길이 열린다. 각 홀엔 회복 장치가 있어, 매 대결 전에 팀이 완전히 회복된다.',
  'The cold does not rush. Neither will I. Begin.': '추위는 서두르지 않아. 나도 그렇지. 시작.',
  'Let us see what your edge is made of.': '네 칼날이 무엇으로 벼려졌는지 보자.',
  'Rise to meet me — or be swept aside.': '일어서서 나와 맞서 — 아니면 휩쓸려 나가.',
  'Whether the vision holds is up to you. Come.': '환영이 버티는지는 네게 달렸어. 와라.',
  'You made it. I watched your entire journey. The Jeju Summit — 나비할망 choosing you as her guardian. The tests, the battles, the growth.':
    '해냈구나. 나는 네 여정을 전부 지켜봤어. 제주 정상 — 나비할망이 너를 수호자로 택하던 그 순간. 시련도, 배틀도, 성장도 전부.',
  "Eight gyms, one legendary moth, and you still climbed back up here. I became Champion three years ago and called it a fluke for a year. I don't take many battles seriously anymore.":
    '체육관 여덟 개, 전설의 나방 하나, 그런데도 넌 여기까지 다시 올라왔군. 나는 삼 년 전 챔피언이 됐고, 일 년은 그걸 요행이라 여겼지. 이젠 어지간한 배틀은 진지하게 임하지 않아.',
  "This one — I will. Show me everything you've become.": '이번만은 — 진지하게 임하겠다. 네가 되어온 모든 것을 보여봐.',
  "...Good. Three years I've wondered when someone would come who could do this. I think I've been waiting for you specifically.":
    '...훌륭해. 삼 년간 이걸 해낼 수 있는 자가 언제 올까 궁금했지. 아무래도 난 바로 널 기다려 왔던 것 같아.',
  'Hwangeum (extending his hand): Welcome to the Hall of Fame. You earned every step of it.':
    '황금 (손을 내밀며): 명예의 전당에 온 걸 환영해. 그 한 걸음 한 걸음을 네가 이뤄냈어.',
  '🏆 Your team is recorded in the Hall of Fame!': '🏆 너의 팀이 명예의 전당에 기록되었다!',
  '— The credits roll over a montage of the Onnuri League arc — Capitol City, the Diamond Gorge, the tidal coasts, the ancient forest, the Jeju vents, the Jeju Summit —':
    '— 온누리 리그 여정의 몽타주 위로 크레딧이 흐른다 — 소올 시티, 다이아몬드 협곡, 조수의 해안, 고목 숲, 제주 분화구, 제주 정상 —',
  'At the bottom of the League steps, your Rival is waiting — because of course they are.':
    '리그 계단 아래, 라이벌이 기다리고 있다 — 당연하게도.',
  'Rival: I found something while you were climbing the league. In the far north, beyond Baekdu Peak — old texts, older than the gym records. References to another spirit. One that predates the Dancheong calendar.':
    '라이벌: 네가 리그를 오르는 동안 뭔가를 찾았어. 저 먼 북쪽, 백두봉 너머 — 체육관 기록보다 오래된 옛 문헌들. 또 다른 정령에 대한 언급. 단청 달력보다도 앞선 존재에 대한 거야.',
  "Prof. Song (comms): That's... troubling. The north has always been volatile. If something wakes there before we understand it, the whole peninsula could—":
    '송 박사 (통신): 그건... 심상치 않은데. 북쪽은 늘 불안정했어. 우리가 이해하기도 전에 거기서 뭔가 깨어난다면, 반도 전체가—',
  "Rival: Easy, Professor. We're barely sitting down. But when you're ready, Champion — the Taebaek range has some climbing left to do.":
    '라이벌: 진정해요, 박사님. 이제 겨우 한숨 돌리는 중이잖아요. 하지만 준비되면, 챔피언 — 태백 산맥엔 아직 오를 곳이 남아 있어.',
  'Phase 1: Onnuri League — COMPLETE ✓': '1막: 온누리 리그 — 완료 ✓',
  'Phase 2: Northern League — UNLOCKED': '2막: 북방 리그 — 해금',
  'Post-game unlocked: rechallenge the Rival in the Shadow Court, rematch Champion Hwangeum, explore the postgame world, and track the freed trio — 풍백, 우사, 운사 — at their mountain shrines.':
    '포스트게임 해금: 섀도우 코트에서 라이벌 재도전, 챔피언 황금 재대결, 포스트게임 세계 탐험, 그리고 풀려난 세 정령 — 풍백, 우사, 운사 — 을 산속 사당에서 추적하기.',

  // ══ Trainer battle: flow + defeat lines ══
  'Loading…': '불러오는 중…',
  'Choose an item!': '아이템을 선택해!',
  "Can't run from a trainer!": '트레이너에게서는 도망칠 수 없어!',
  // Defeat lines (spoken text; speaker auto-translated)
  'Whoa! Your Pokémon is so strong!': '우와! 네 포켓몬 진짜 세다!',
  "You've got real mountain spirit, kid.": '너 진짜 산사나이 기질이 있구나, 꼬마.',
  'No way! I just polished my sneakers…': '말도 안 돼! 방금 운동화도 닦았는데…',
  "...You're stronger than the locals. The Director will hear of this.": '...현지인들보다 세군. 국장님께 보고하겠어.',
  "...The Spirit of Cheonji will be awakened. The only question is who controls what happens next — and it will NOT be Team Suri.":
    '...천지의 정령은 깨어날 거야. 문제는 그다음을 누가 통제하느냐지 — 그건 수리단이 아니야.',
  "...This changes nothing. The array will be ready when the Spirit wakes. (She withdraws south.)":
    '...이걸로 달라지는 건 없어. 정령이 깨어날 때 장치는 준비돼 있을 거야. (그녀는 남쪽으로 물러난다.)',
  "...Okay. Not luck. You're the real thing. My starter's almost ready for its final form. Next time, you won't recognize it.":
    '...좋아. 운이 아니었어. 넌 진짜야. 내 스타터도 최종 진화가 거의 준비됐어. 다음엔 못 알아볼걸.',
  "Final form and all — and you STILL beat me. You're the real deal. Let's go save that moth grandmother.":
    '최종 진화까지 했는데도 — 넌 날 이겼어. 넌 진짜배기야. 그 나방 할머니를 구하러 가자.',
  "Team Suri isn't the only organization moving through this region anymore. And the other one — they're not here for research.":
    '이 지방을 움직이는 조직은 이제 수리단만이 아니야. 그리고 다른 하나는 — 연구하러 온 게 아니야.',
  "...You've beaten me on the cliff. But the array is the real threat — and it is not yet finished.":
    '...절벽에서 날 이겼군. 하지만 진짜 위협은 장치야 — 아직 완성되지 않았지.',
  "...Enough. You and your friend fight like the region itself is at your back. Perhaps it is.":
    '...그만하면 됐어. 너와 네 친구는 마치 이 지방 전체를 등에 업은 듯 싸우는군. 어쩌면 정말 그런지도.',
  "The perimeter's yours. It won't matter — the towers will hold.": '경계선은 네 거다. 소용없어 — 탑들이 버틸 테니.',
  'Fall back! Fall back to the courtyard!': '후퇴! 안뜰로 후퇴하라!',
  "The west light's dead... the courtyard's exposed!": '서쪽 조명이 꺼졌다... 안뜰이 노출됐어!',
  "Searchlight down! The captain's on her own now.": '탐조등이 나갔다! 이제 대장은 홀로다.',
  "...The Commander said you might reach this far. I didn't believe her. The gate is yours — but the mountain will not forgive you the way I have.":
    '...사령관이 네가 여기까지 올지도 모른다고 했지. 난 안 믿었어. 관문은 네 거다 — 하지만 산은 나처럼 널 용서하지 않을 거야.',
  "You don't understand — the machine doesn't care who wins down here!": '넌 몰라 — 저 기계는 여기서 누가 이기든 상관 안 해!',
  'Climb all you like. The matrix completes with or without us.': '얼마든지 올라가 봐. 매트릭스는 우리가 있든 없든 완성돼.',
  "...Six partners, and still you broke through. Go, then. The Spirit will not be so easily reasoned with.":
    '...여섯 파트너를 두고도 넌 뚫고 왔군. 그럼 가라. 정령은 그리 쉽게 설득되지 않을 거다.',
  'A clean answer. The road has measured you well.': '깔끔한 답이군. 이 길이 널 제대로 가늠했어.',
  "My dragons bow to yours. Go — the gate's just above.": '내 드래곤들이 네 것에 고개를 숙인다. 가 — 관문은 바로 위야.',
  "Forty years, and you've still got something to teach me. Hah! Go on up.": '사십 년인데도 넌 아직 내게 가르칠 게 있군. 하! 올라가라.',
  "...Yeah. Yeah, that's the trainer I've been chasing this whole time. Go on — the Four are waiting, and so is HE.":
    '...그래. 그래, 저게 내가 내내 쫓아온 트레이너야. 가 — 사천왕이 기다리고, 그분도 기다려.',
  "The thaw comes for us all. You've earned the next hall.": '해빙은 우리 모두에게 찾아와. 다음 홀을 얻을 자격이 있어.',
  'My steel held nothing back, and you broke through it. Impressive.': '내 강철은 아무것도 아끼지 않았는데, 넌 그걸 뚫었어. 인상적이야.',
  "Like the wind itself — I couldn't pin you down. Go higher.": '바람 그 자체처럼 — 널 붙잡을 수 없었어. 더 높이 올라가.',
  'The vision held after all. The throne is yours to challenge.': '결국 환영이 버텼군. 옥좌에 도전할 자격은 네 거야.',
  'Yeah. YEAH. Go show these northerners what an Onnuri trainer looks like. I\'ll be in the stands, losing my voice for you.':
    '그래. 그렇지! 가서 저 북부인들에게 온누리 트레이너가 어떤지 보여줘. 난 관중석에서 널 위해 목이 터져라 응원할게.',
  '...You moved the stone. The next hall is yours to enter, southerner.': '...돌을 움직였군. 다음 홀에 들어갈 자격이 있다, 남부인.',
  "The cold couldn't hold you. Go on — climb higher.": '추위도 널 붙잡지 못했군. 가 — 더 높이 올라가.',
  'My steel broke before you did. That has not happened in years. Pass.': '내 강철이 너보다 먼저 부서졌다. 몇 년 만의 일이지. 지나가라.',
  'The white tiger yields. Only the Great King remains above you now.': '백호가 물러선다. 이제 네 위엔 대왕만이 남았다.',
  '...Thirty years, and the first to take my throne is a southerner. The north acknowledges Onnuri.':
    '...삼십 년 만에, 내 옥좌를 빼앗은 첫 번째가 남부인이라니. 북부가 온누리를 인정한다.',
  "...Strong, and you fight clean — no tricks, no cruelty. That tells me more than words. Travel our cities. Show me WHY you're here.":
    '...강하고, 깨끗하게 싸우는군 — 속임수도, 잔인함도 없이. 그게 말보다 많은 걸 말해줘. 우리 도시들을 여행해라. 네가 왜 여기 왔는지 보여봐.',
  "...The stars already gave us the shrines. Beating me changes nothing — the Sovereign will descend for US.":
    '...별들이 이미 우리에게 사당을 알려줬어. 날 이겨도 달라지는 건 없어 — 군주는 우리를 위해 강림한다.',
  'The trainer beneath the legend is real after all. The order takes note.': '전설 아래의 트레이너는 결국 진짜였군. 우리 어사대가 주목하겠다.',
  "Iron tested, iron held. You have the 어사대's respect — and mine.": '강철을 시험했고, 강철은 버텼다. 넌 어사대의 존중을 얻었어 — 그리고 나의 존중도.',
  'The head of the order is satisfied. The wards will open. We climb together, Champion.':
    '어사대의 수장이 만족했다. 결계가 열릴 거야. 함께 오르자, 챔피언.',
  '...Impossible. The throne was ours to take — the pantheon, the peninsula, all of it... (The 어사대 close in around the fallen claimant.)':
    '...말도 안 돼. 옥좌는 우리 것이었어 — 신들도, 반도도, 전부 다... (어사대가 쓰러진 참칭자를 에워싼다.)',

  // ── Forest Shrine (lullaby quest, cont.) ──
  'Heart first, then Dusk, then Dawn. Let the old lullaby lead you.': '먼저 중심, 그다음 황혼, 그다음 새벽. 오래된 자장가가 널 이끌게 하렴.',
  'The vines guarding the inner altar loosen and draw back.': '안쪽 제단을 지키던 덩굴이 느슨해지며 물러난다.',
  'Beyond them, something small and sorrowful drifts in the candlelight... still keeping the rhythm.':
    '그 너머, 작고 슬픈 무언가가 촛불 속을 떠돈다... 여전히 박자를 지키면서.',
  "Traveler — you carry the Keeper's seal. Then perhaps the forest sent you.":
    '나그네여 — 그대는 수호자의 인장을 지녔군. 그렇다면 어쩌면 숲이 그대를 보낸 것이겠지.',
  'Our 목탁 is gone. For a hundred years its beat sang the tree-spirits to sleep.':
    '우리의 목탁이 사라졌소. 백 년 동안 그 소리가 나무 정령들을 잠재웠는데.',
  'Without it the Ancient Forest wakes in grief. The spirits you see are not cruel — only frightened.':
    '그것 없이는 고목 숲이 슬픔 속에 깨어나오. 그대가 보는 정령들은 잔인한 게 아니라 — 그저 겁에 질린 것이오.',
  'The thief fled to the inner altar, but the roused guardians bar the aisle, and the prayer-gate is sealed.':
    '도둑은 안쪽 제단으로 달아났지만, 깨어난 수호령들이 통로를 막고, 기도의 문이 봉인되었소.',

  // ── Jeju Vents (ascent, cont.) ──
  '🌋 Jeju Vents — The Ascent (제주 분화구)': '🌋 제주 분화구 — 등정',
  'The vent trail rises sharply from the port — a long, switchbacked climb through lava and ash.':
    '분화구 길이 항구에서 가파르게 솟는다 — 용암과 재를 지나는 길고 구불구불한 오르막.',
  'For the Director!': '국장님을 위하여!',
  'The vent summit is quiet — only wind, steam and black rock. Nothing stirs here yet.':
    '분화구 정상은 고요하다 — 오직 바람, 김, 검은 바위뿐. 아직 아무것도 움직이지 않는다.',
  'Commander Ryeo: Tighten the restraint field! Her wings can neutralize the Cheonji energy — secure her and the weapon completes itself even without the lake!':
    '사령관 려: 억제장을 조여! 저 나방의 날개는 천지 에너지를 중화할 수 있어 — 저것을 확보하면 호수 없이도 무기가 완성된다!',
  '노스단 Operative: Commander, her output is climbing—': '노스단 대원: 사령관님, 저것의 출력이 치솟고 있습니다—',
  'Commander Ryeo staggers backward, her Pokémon recalled. She looks at the towering moth beside you — at the glow of her wings — and something breaks in her expression.':
    '사령관 려가 비틀거리며 물러서고, 포켓몬을 회수한다. 네 곁에 우뚝 선 나방을 바라본다 — 그 날개의 빛을 — 그러자 그의 표정에서 무언가가 무너진다.',
  'Prof. Song: Reach the Onnuri League, prove yourself champion. Then the world opens up. The north has lessons too.':
    '송 박사: 온누리 리그에 도달해, 챔피언임을 증명해. 그러면 세계가 열릴 거야. 북쪽에도 배울 것들이 있단다.',

  // ── Baekdu Checkpoint (노스단 garrison) ──
  'The plane sets down on a wind-scoured snowfield at the foot of Baekdu. The highland pass ahead has been sealed — a fortified 노스단 checkpoint blocks the trail, with an iron gate, watchtowers, and searchlights sweeping the snow.':
    '비행기가 백두산 발치의 바람에 깎인 설원에 내려앉는다. 앞쪽 고원 고갯길은 봉쇄되었다 — 요새화된 노스단 검문소가 철문, 망루, 눈밭을 훑는 탐조등과 함께 길을 막고 있다.',
  'The southern road ends at this gate. You should have turned back.': '남쪽 길은 이 문에서 끝난다. 돌아섰어야 했어.',
  'Hold the line! Nothing reaches the towers!': '전선을 사수하라! 아무것도 탑에 닿지 못하게!',
  'The east light stays lit. Come and put it out.': '동쪽 조명은 켜져 있다. 와서 꺼봐.',
  '노스단 Garrison Officer: This pass is closed by order of the Commander. The southern road ends here. There is nothing past this gate but the future of the north.':
    '노스단 수비대 장교: 이 고갯길은 사령관의 명으로 폐쇄됐다. 남쪽 길은 여기서 끝이야. 이 문 너머엔 오직 북방의 미래뿐이다.',
  "Chaeyeon: This is a full garrison — they've dug in. We push through one position at a time, take the watchtowers, and force the gate. Stay close. I'll keep your team standing.":
    '채연: 완전한 수비대야 — 진지를 구축했어. 한 거점씩 밀고 나가, 망루를 점령하고, 문을 강행 돌파하자. 바짝 붙어. 네 팀은 내가 계속 세워둘게.',
  'Gate Captain Seollan: My searchlights still sweep this courtyard. Cut them both before you dare approach my gate.':
    '문지기 대장 설란: 내 탐조등이 아직 이 안뜰을 훑고 있다. 감히 내 문에 다가오기 전에 둘 다 꺼라.',

  // ── Dolmoe Ruins (대장승 Daejangseung) ──
  'The great sealed capstone splits with a groan like the mountain waking...': '거대한 봉인된 덮개돌이 산이 깨어나는 듯한 신음과 함께 갈라진다...',
  'From the broken dolmen rises 대장승 Daejangseung — a towering guardian-totem of the ancestors, eyes blazing, furious at the desecration.':
    '부서진 고인돌에서 대장승이 일어선다 — 조상들의 우뚝 솟은 수호 토템, 눈을 이글거리며, 신성모독에 분노한다.',
  '대장승 Daejangseung looms over the shattered dolmen, radiating ancient wrath.': '대장승이 부서진 고인돌 위로 우뚝 솟아, 태고의 분노를 내뿜는다.',
  'Daejangseung: (It fixes its blazing gaze on you — soothe it in battle, or catch it with a Poké Ball!)':
    '대장승: (이글거리는 시선을 네게 고정한다 — 배틀로 달래거나, 몬스터볼로 잡아라!)',
  'Spent and settled, 대장승 Daejangseung sinks back into the mended dolmen, its wrath eased. The ruins fall quiet.':
    '기운을 다하고 가라앉은 대장승이 아문 고인돌 속으로 도로 잠긴다, 분노가 누그러진 채. 폐허가 고요해진다.',
  'Sandol: The 노스단 will answer for this another day. The ancestors rest — thanks to you.':
    '산돌: 노스단은 언젠가 이 일에 대가를 치를 거야. 조상들은 안식한다 — 네 덕분에.',
  "Sandol: Come to the Quarry when you're ready. A challenger who guards the old stones has earned my full attention.":
    '산돌: 준비되면 채석장으로 와. 옛 돌을 지킨 도전자는 내 온전한 관심을 얻을 자격이 있지.',

  // ══ Capitol hub: champion return → Fly → northern invite → reunion → Part II ══
  'The cause was just. The method was wrong. I know the difference now.': '대의는 옳았어. 방법이 틀렸지. 이제 그 차이를 알아.',
  'Freed from the matrix, 풍백, 우사, and 운사 return to roaming the wild peaks — Wind on the high ridges, Rain in the storm valleys, Clouds at the cloud-wreathed summits.':
    '매트릭스에서 풀려난 풍백, 우사, 운사가 야생의 봉우리로 돌아가 떠돈다 — 바람은 높은 능선에, 비는 폭풍의 골짜기에, 구름은 구름에 감긴 정상에.',
  "Professor Song: There's one road left to walk. The Onnuri Pokémon League sits beyond the mountains — and Scholars' Road begins right here, behind the palace where your journey started.":
    '송 박사: 이제 걸어야 할 길이 하나 남았어. 온누리 포켓몬 리그가 산 너머에 있고 — 선비의 길이 바로 여기, 네 여정이 시작된 궁궐 뒤에서 시작돼.',
  "Professor Song: The HM stays in your Bag — teach Fly to any Flying-type. Then open the Town Map, pick a city you've visited, and Fly straight there.":
    '송 박사: 비전머신은 가방에 남아 있어 — 비행 타입 아무에게나 하늘을날기를 가르쳐. 그런 다음 마을 지도를 열어, 가본 도시를 골라 곧장 날아가.',
  "Professor Song: And there's something else. Word from beyond the northern border — the Northern League, and the eight 어사대 provinces that guard the road to it. They've heard of you.":
    '송 박사: 그리고 한 가지 더. 북쪽 국경 너머에서 소식이 왔어 — 북방 리그, 그리고 그곳으로 가는 길을 지키는 여덟 어사대 지방. 그들이 네 소문을 들었대.',
  "Professor Song: They say a coach runs from Waterfall City now, all the way up to Songhyeon — first of the eight. If you mean to go north, that bus is how you'll get there. Go — see the region you saved, and the one beyond it.":
    '송 박사: 폭포 시티에서 송현까지 — 여덟 곳 중 첫 번째까지 버스가 다닌다더군. 북쪽으로 갈 생각이면 그 버스로 가면 돼. 가 — 네가 구한 지방을, 그리고 그 너머의 지방을 보렴.',
  'Champion Hwangeum: ...You actually did it. You beat Taewang. Three years I carried that loss — you lifted it clean off me. Thank you.':
    '챔피언 황금: ...정말 해냈군. 태왕을 이기다니. 삼 년간 그 패배를 짊어졌는데 — 네가 깨끗이 걷어내 줬어. 고마워.',
  "Professor Song: Two leagues, north and south. There has never been a trainer like you in all of Onnuri's history.":
    '송 박사: 리그 둘, 남과 북. 온누리 역사를 통틀어 너 같은 트레이너는 없었어.',
  "Rival: I always said I'd catch up to you someday. ...Yeah, I'm nowhere close. And honestly? I have never been prouder to lose.":
    '라이벌: 언젠가 널 따라잡겠다고 늘 말했지. ...그래, 근처도 못 갔어. 그리고 솔직히? 이렇게 자랑스럽게 진 적은 없어.',
  'Admin Chaeyeon: Even the people you once fought stood in this crowd tonight. The region you healed came out for you.':
    '간부 채연: 네가 한때 맞서 싸운 사람들조차 오늘 밤 이 인파 속에 서 있었어. 네가 치유한 지방이 널 위해 나온 거야.',
  'Leader Byeoksan: Every Gym in Onnuri shut its doors today. Tonight — we drink to the Champion of Champions!':
    '관장 벽산: 오늘 온누리의 모든 체육관이 문을 닫았어. 오늘 밤 — 챔피언 중의 챔피언을 위해 건배하자!',
  'The plaza erupts. Lanterns go up over the Han River, the markets roll out food, and music starts.':
    '광장이 터져 나온다. 한강 위로 등불이 오르고, 시장은 음식을 내오고, 음악이 시작된다.',
  '🎉  The Capitol throws a party in your honour!': '🎉  수도가 너를 기리는 파티를 연다!',
  'Hwangeum: For one night — no titles, no battles. Just us and the region we love. Eat. Dance. You earned this.':
    '황금: 하룻밤만은 — 직함도, 배틀도 없이. 그저 우리와 우리가 사랑하는 지방뿐. 먹고. 춤춰. 넌 이걸 누릴 자격이 있어.',
  "Rival: Come on, Champion — one last race. First to the fountain! ...For old times' sake.":
    '라이벌: 자, 챔피언 — 마지막으로 한 판 달리기. 분수까지 먼저! ...옛정을 봐서.',
  'The night blurs into music and light. For the first time since your journey began, there is nothing left to fight for. Only this.':
    '밤이 음악과 빛 속으로 흐려진다. 여정을 시작한 이래 처음으로, 싸워야 할 것이 아무것도 없다. 오직 이것뿐.',
  "📟 Your Pokédex buzzes before you're even fully awake — an incoming call from Professor Song.":
    '📟 채 잠에서 깨기도 전에 도감이 울린다 — 송 박사의 전화다.',
  'Prof. Song (over the Pokédex, quietly): Champion. I let you have your night — you deserved a hundred of them. But those reports I mentioned...':
    '송 박사 (도감 너머로, 조용히): 챔피언. 너에게 그 밤을 누리게 했어 — 백 번은 누릴 자격이 있었으니까. 하지만 내가 말했던 그 보고들 말이야...',
  'Prof. Song: Something is stirring in the sealed northern reaches. 노스단 is moving again — and this time they reach for something far older than the Spirit of Cheonji.':
    '송 박사: 봉인된 북방 관문에서 무언가 꿈틀대고 있어. 노스단이 다시 움직이고 있어 — 이번엔 천지의 정령보다 훨씬 오래된 무언가를 노리고 있어.',
  "Prof. Song: Rest today. Tomorrow, the last road begins. I'll call again when it's time.  (To be continued…)":
    '송 박사: 오늘은 쉬어. 내일, 마지막 길이 시작돼. 때가 되면 다시 연락할게.  (다음에 계속…)',
  "Prof. Song (over the Pokédex, grim): 노스단. Again — but bigger. With Commander Ryeo imprisoned, someone new has taken the banner, and they've abandoned the old plan entirely.":
    '송 박사 (도감 너머로, 심각하게): 노스단이야. 또 — 하지만 더 커졌어. 사령관 려가 투옥되자, 누군가 새로 깃발을 잡았고, 옛 계획을 완전히 버렸어.',
  "Prof. Song: I'm sending an image to your Pokédex now — an old scroll. A radiant figure descending, three spirits at its side. They reach for the one power above all others. 환웅 — Hwanung, the Sovereign Who Descended.":
    '송 박사: 지금 네 도감으로 이미지를 보내고 있어 — 오래된 두루마리야. 세 정령을 곁에 두고 강림하는 빛나는 존재. 그들은 무엇보다 위대한 단 하나의 힘을 노려. 환웅 — 강림한 군주.',
  'Prof. Song: If 노스단 captures Hwanung, they command the very force that shaped the region — north and south, in a single stroke.':
    '송 박사: 노스단이 환웅을 잡으면, 이 지방을 빚어낸 바로 그 힘을 손에 넣어 — 남과 북을, 단번에.',
  'Prof. Song: But the Sovereign only descends for one who has gathered his three attendants — 풍백 the Wind, 우사 the Rain, 운사 the Clouds. Find and catch them before 노스단 does.':
    '송 박사: 하지만 군주는 세 시종을 모은 자에게만 강림해 — 바람의 풍백, 비의 우사, 구름의 운사. 노스단보다 먼저 그들을 찾아 잡아.',
  "Prof. Song: One more thing. The northern reaches are guarded by the 어사대 — the Royal Inspectorate. They trust outsiders even less than 노스단 does. You'll have to earn them, city by city.":
    '송 박사: 한 가지 더. 북방 관문은 어사대 — 왕실 감찰부가 지켜. 그들은 노스단보다도 외지인을 안 믿어. 도시 하나하나 신뢰를 얻어야 할 거야.',
  "Prof. Song: Ready the strongest team you have ever fielded, then take the road north. I'll stay on the Pokédex the whole way. Shall we go?":
    '송 박사: 네가 꾸린 가장 강한 팀을 준비하고, 북쪽 길에 올라. 가는 내내 내가 도감으로 함께할게. 갈까?',
  '📟 Your Pokédex buzzes — Professor Song.': '📟 도감이 울린다 — 송 박사.',
  'Prof. Song (over the Pokédex): The northern reaches are waiting, Champion — and 노스단 is already climbing toward the shrines. Ready to head north?':
    '송 박사 (도감 너머로): 북방 관문이 기다리고 있어, 챔피언 — 그리고 노스단은 이미 사당을 향해 오르고 있어. 북쪽으로 갈 준비됐어?',
  '❄  Beyond the border tunnels — into the Northern Reaches…': '❄  국경 터널 너머 — 북방 관문으로…',
  'NEWS: Researchers from the Onnuri Pokémon Institute are investigating a pattern linked to rare Pokémon migrations near Cheonji Lake...':
    '뉴스: 온누리 포켓몬 연구소의 연구원들이 천지 호수 근처의 희귀 포켓몬 이동과 연관된 패턴을 조사하고 있습니다...',
  'Route 2 is now open to the NORTH of the city.': '이제 도시 북쪽으로 2번 도로가 열렸다.',

  // ══ Baekdu Summit finale (Ch.11 — 나비할망 shield, Hwanwoong calmed) ══
  '▶ You release 나비할망.': '▶ 나비할망을 풀어놓는다.',
  '나비할망 launches into the center of the storm. Her metallic, dancheong-patterned wings unfurl — wider, and wider — into a vast translucent dome whose patterns exactly match the ancient tablets.':
    '나비할망이 폭풍의 중심으로 날아든다. 금속성 단청 무늬 날개가 펼쳐진다 — 점점, 더 넓게 — 고대 석판의 무늬와 정확히 일치하는 거대한 반투명 돔으로.',
  'The dome drinks in the chaotic red-and-purple spikes torn from 풍백, 우사, and 운사 — and converts them into a slow, gentle aurora that washes down across the peak.':
    '돔이 풍백, 우사, 운사에게서 뜯겨 나온 혼돈의 붉고 보랏빛 가시들을 빨아들인다 — 그리고 그것을 봉우리를 타고 흘러내리는 느리고 부드러운 오로라로 바꾼다.',
  'Far across the Taebaek range, three cries echo — Wind, Rain, and Clouds, set free. The chains of the matrix shatter; the trio scatter back into the wild peaks.':
    '태백 산맥 저편에서 세 울음이 메아리친다 — 풀려난 바람, 비, 구름. 매트릭스의 사슬이 부서지고, 세 정령은 야생의 봉우리로 흩어져 돌아간다.',
  'Hwanwoong, his borrowed agony lifted, slowly stills. His corona fades from violent red to a calm, deep blue.':
    '빌려온 고통이 걷힌 환웅이 천천히 잦아든다. 그의 코로나가 격렬한 붉은빛에서 차분한 짙은 파랑으로 옅어진다.',
  'The aura grows more violent each round as the towers strain... until the moment comes.':
    '탑들이 버티는 동안 오라가 매 턴 더 격렬해진다... 그 순간이 올 때까지.',
  '▶ RELEASE 나비할망?  (Yes — release her / No — hold on)': '▶ 나비할망을 풀어놓을까?  (예 — 풀어놓기 / 아니오 — 기다리기)',
  "He is not attacking out of malice. He is in agony — the matrix is wrenching at his waking mind, and the trio's chained energy feeds the overload.":
    '그는 악의로 공격하는 게 아니다. 고통에 빠진 것이다 — 매트릭스가 깨어나는 그의 정신을 비틀어 대고, 사슬에 묶인 세 정령의 에너지가 과부하를 부추긴다.',
  'Hwanwoong is yours — its corona gone, the lake mirror-still beneath a clearing sky.':
    '환웅은 이제 네 것이다 — 코로나가 사라지고, 개어가는 하늘 아래 호수는 거울처럼 고요하다.',
  'Rival climbs to the summit, Executive Mubaek defeated behind them, and joins you at the central altar.':
    '라이벌이 간부 무백을 뒤에 물리치고 정상에 올라, 중앙 제단에서 너와 합류한다.',
  'Rival: ...We actually did it. Together, then. Like always.': '라이벌: ...우리 정말 해냈어. 그럼 함께한 거네. 늘 그렇듯이.',
  'The bruised red sky clears. Gentle lines of golden light spread outward from the peak, flowing back down across the entire peninsula, settling the disturbed land and restoring its natural balance.':
    '멍든 붉은 하늘이 개인다. 부드러운 황금빛 선들이 봉우리에서 바깥으로 퍼져 나가, 반도 전체를 타고 도로 흘러내리며, 어지러워진 땅을 가라앉히고 그 자연의 균형을 회복시킨다.',
  'Prof. Song (comms, quiet with relief): The geothermal readings are stabilizing. The eruption threat is gone. The trio are free. And the whole region is breathing again.':
    '송 박사 (통신, 안도로 잦아든 목소리): 지열 수치가 안정되고 있어. 분화 위협은 사라졌어. 세 정령은 자유야. 그리고 온 지방이 다시 숨 쉬고 있어.',
  '나비할망 folds her glowing wings and settles beside you. The first clean stars appear over Baekdu Peak.':
    '나비할망이 빛나는 날개를 접고 네 곁에 내려앉는다. 백두봉 위로 첫 맑은 별들이 나타난다.',
  'You and the Rival make the long descent together, off the sacred mountain.':
    '너와 라이벌은 함께 성스러운 산을 내려가는 긴 하산길에 오른다.',
  '▶ Chapter 11 complete. Phase 2: Northern League — COMPLETE ✓': '▶ 11장 완료. 2막: 북방 리그 — 완료 ✓',
  'Post-game begins: The world is yours to explore, and some say the 어사대 still stirs in the unreached corners of the realm.':
    '포스트게임 시작: 세계는 네가 탐험할 몫이고, 어떤 이들은 어사대가 아직 닿지 않은 세상의 구석에서 꿈틀댄다고 말한다.',

  // ── Route 3 / Songhyeon / Pine Needle Studio / Seolun Plateau ──
  'A woman in a dark, silver-trimmed coat blocks the gorge. This is no Team Suri grunt.':
    '은빛 테두리의 어두운 코트를 입은 남자가 협곡을 막는다. 이건 수리단 조무래기가 아니다.',
  'Commander Ryeo: We have no quarrel with you. Step aside.': '사령관 려: 너와는 다툴 일 없어. 비켜.',
  '어사대장 Hyeon presents a small bronze horse-tablet — a 마패.': '어사대장 현이 작은 청동 말 패 하나를 내민다 — 마패다.',
  '🐎 You received the Songhyeon 마패! (1 of 8 the Northern League requires.)':
    '🐎 송현 마패를 받았다! (북방 리그에 필요한 8개 중 1개.)',
  '어사대장 Hyeon: Seven Chiefs remain, across the northern provinces. Earn all eight and the League gate at the far north will know you by them.':
    '어사대장 현: 북방 지방 곳곳에 일곱 어사대장이 남아 있다. 여덟을 모두 얻으면 저 먼 북쪽의 리그 관문이 그것으로 널 알아볼 것이다.',
  'The Seonjukgyo bridge arches over the stream toward the 어사대 Hall, once a Confucian academy.':
    '선죽교가 개울 위로 아치를 그리며 어사대 전당으로 이어진다, 한때 성균관이었던 곳.',
  'Take it back to Artist Sora!': '화가 소라에게 돌려주자!',
  'Artist Sora: Please, take these — a TM for Calm Mind, and a hand-painted map of the highland region.':
    '화가 소라: 이걸 받아줘 — 자기암시 기술머신하고, 손으로 그린 고원 지방 지도야.',
  '📀 Received TM — Calm Mind!  (Check your Bag to teach it.)': '📀 기술머신 — 자기암시를 받았다!  (가방에서 가르칠 수 있어.)',
  '🗺️ Received the Highland Map!': '🗺️ 고원 지도를 받았다!',
  'Artist Sora: One more thing... while searching, did you see those black markings near the northern pass?':
    '화가 소라: 한 가지 더... 찾는 동안, 북쪽 고갯길 근처의 그 검은 표식들 봤어?',
  'I patrol the highland fields for poachers. The frost mist rolls in fast up here — travellers get lost. But you? You battle first.':
    '난 밀렵꾼을 잡으러 고원 들판을 순찰해. 여긴 서리 안개가 빨리 몰려와 — 여행자들이 길을 잃지. 근데 너? 넌 먼저 배틀이다.',
  '❄ 서리 안개 (frost mist)': '❄ 서리 안개',
  '⛰ Seolun Plateau (설운고원)': '⛰ 설운고원',

  // ── Jeju Port + northern beaches/mines/highlands (labels + trainers) ──
  '⚓ Jeju Port (제주 포구)': '⚓ 제주 포구',
  'Dock Worker: The black-coats unloaded heavy gear an hour ago and marched straight up the vent trail.':
    '부두 인부: 검은 코트들이 한 시간 전에 무거운 장비를 내리고 곧장 분화구 길로 올라갔어.',
  'Ahoy! Headed out to that Gyarados? Not before you get past me, landlubber!':
    '어이! 저 갸라도스한테 가려고? 날 지나가기 전엔 안 돼, 육지것아!',
  "That beast scared off every fish on the coast. Show me you're tough enough to face it!":
    '저 괴수가 해안의 물고기를 죄다 쫓아버렸어. 맞설 만큼 강한지 보여줘!',
  'You surfed all the way out here past the whirlpools? Impressive — now battle me!':
    '소용돌이를 지나 여기까지 파도타기해 왔다고? 대단하군 — 이제 나랑 배틀이다!',
  '⚠ Rampaging Gyarados (난동 갸라도스)': '⚠ 난동 갸라도스',
  "Churned up from the depths, one of Gyarados's 부하 lunges at you!":
    '심연에서 솟구쳐, 갸라도스의 부하 하나가 네게 달려든다!',
  'Been casting off this jetty since dawn. Reel in a battle with me!': '새벽부터 이 방파제에서 낚싯대를 던지고 있어. 나랑 한 판 낚아 올려봐!',
  '🏖 Kalma Beach (갈마 해변)': '🏖 갈마 해변',
  'Careful down here — the Steelix has the deep gallery. Warm up on me first!': '여긴 조심해 — 강철톤이 깊은 갱도를 차지했어. 나로 먼저 몸 좀 풀어!',
  '⚠ Berserk Steelix (폭주 강철톤)': '⚠ 폭주 강철톤',
  '⛏ Gangcheoldo Ore Mine (강철도 광산)': '⛏ 강철도 광산',
  'The higher you climb Yeomyeong, the thinner the air — and the fiercer the battles. Prove you belong up here.':
    '여명산을 오를수록 공기는 희박해지고 — 배틀은 더 치열해져. 여기 있을 자격이 있음을 증명해.',
  '☁ 짙은 안개 (dense fog)': '☁ 짙은 안개',
  '⛰ Yeomyeong Highlands (여명산 길)': '⛰ 여명산 길',
  'Best mullet on the whole East Sea coast comes from these waters. Reel in a battle with me!':
    '동해 해안 통틀어 최고의 숭어가 이 물에서 나와. 나랑 한 판 낚아 올려봐!',
  'Waterfowl gather at the lagoon by the thousand. My flock rules these skies — care to test them?':
    '석호에 물새가 수천 마리 모여. 내 무리가 이 하늘을 지배하지 — 시험해 볼래?',
  '🌅 Sijung Coast (시중호 해안길)': '🌅 시중호 해안길',

  // ── Northern routes / dungeons / interiors ──
  'What a view from up here! Oh — you want to battle? By the cairn, then. For luck!':
    '여기서 보는 경치 좀 봐! 어 — 배틀하고 싶다고? 그럼 돌탑 옆에서. 행운을 빌며!',
  'Camped by the summit all week. The wild Pokémon here are no joke — and neither am I!':
    '한 주 내내 정상 옆에서 야영했어. 여기 야생 포켓몬은 만만치 않아 — 나도 그렇고!',
  '⛰ Bukpung Pass (북풍 고개)': '⛰ 북풍 고개',
  '🌾 Yeoul Valley (예성강 들녘)': '🌾 예성강 들녘',
  'Halt! This road belongs to 노스단 now. Turn back to your little plateau — the ajit is off-limits!':
    '멈춰! 이 길은 이제 노스단 거야. 네 작은 고원으로 돌아가 — 아지트는 출입 금지다!',
  '🔑 You obtained the 노스단 아지트 열쇠! The gate ahead will now unlock.': '🔑 노스단 아지트 열쇠를 손에 넣었다! 이제 앞쪽 문이 열린다.',
  '🏢 노스단 아지트 (Team North HQ)': '🏢 노스단 아지트',
  '⛰ 노스단 아지트 진입로 (HQ Approach)': '⛰ 노스단 아지트 진입로',
  "Beat us first if you think you're getting in!": '들어갈 생각이면 우리부터 이겨봐!',
  '어사대장 Amrok will want to know the crossing is safe. Head back to Binghagwan.':
    '어사대장 압록이 강을 건너도 안전한지 알고 싶어할 거다. 빙하관로 돌아가라.',
  'At the heart of the cave, a great bear-shape sleeps frozen into the ice wall.': '동굴 중심, 거대한 곰의 형상이 얼음벽에 얼어붙어 잠들어 있다.',
  'As you draw near, a deep CRACK splinters the ice — and two cold eyes snap open.': '다가가자, 깊은 균열 소리와 함께 얼음이 갈라지고 — 차가운 두 눈이 번쩍 뜨인다.',
  'The Ice-Bound Beartic shatters free of the wall with a roar that shakes frost from the ceiling!':
    '얼음 툰베어가 천장에서 서리를 떨어뜨리는 포효와 함께 벽을 부수고 튀어나온다!',
  '얼음 툰베어 (Ice-Bound Beartic)': '얼음 툰베어',
  'So — you seek the thing that grins in the séance hall? Heh heh... its door is locked, and I keep the only key.\nBest me, if you dare, and the 보석함 key is yours.':
    '그래 — 강령술 방에서 히죽대는 그것을 찾는 거냐? 헤헤... 그 문은 잠겼고, 유일한 열쇠는 내가 갖고 있지.\n감히 날 이긴다면, 보석함 열쇠는 네 거다.',
  '🔑 You obtained the 보석함 (vault) KEY! The locked séance-hall door down the corridor can be opened now.':
    '🔑 보석함 열쇠를 손에 넣었다! 복도 저편의 잠긴 강령술 방 문을 이제 열 수 있다.',
  '⚠ Fog-Wraith Gengar (안개 팬텀)': '⚠ 안개 팬텀',
  '🏚 Fogbound Manor (안개저택)': '🏚 안개저택',
  // Interiors (naengmyeon shop, northern lodging)
  '사장님: 어서 오세요! Welcome to the finest 강철도냉면 house in the city!': '사장님: 어서 오세요! 이 도시 최고의 강철도냉면 집에 오신 걸 환영합니다!',
  '사장님: Take your time! The broth stays nice and cold.': '사장님: 천천히 드세요! 육수는 시원하게 유지된답니다.',
  'You share the big bowl with your team, and everyone eats their fill.': '큰 그릇을 팀과 나눠 먹고, 모두 배불리 먹는다.',
  'Your Pokémon are refreshed and fully restored!': '포켓몬들이 상쾌해지고 완전히 회복되었다!',
  '사장님: 맛있게 드셨어요? 또 오세요 — come again, Champion!': '사장님: 맛있게 드셨어요? 또 오세요, 챔피언!',
  'You and your team share a hot meal by the hearth. Everyone is rested and fully restored!':
    '너와 팀은 화로 옆에서 따뜻한 식사를 나눈다. 모두 쉬고 완전히 회복되었다!',
  'You sip a sweet iced tea while your Pokémon nap in the sun. Everyone feels refreshed and fully healed!':
    '포켓몬들이 햇볕 아래 낮잠 자는 동안 달콤한 아이스티를 마신다. 모두 상쾌해지고 완전히 회복되었다!',
  "You and your Pokémon steam away the day's aches. Everyone emerges glowing — fully restored!":
    '너와 포켓몬들은 하루의 피로를 김으로 씻어낸다. 모두 반짝이며 나온다 — 완전히 회복되었다!',
  'You rest until the foghorns fade to a lullaby. Your team wakes fully restored!':
    '무적 소리가 자장가처럼 잦아들 때까지 쉰다. 팀이 완전히 회복되어 깨어난다!',
  'Trader: The bridge to the far bank is broken, but the trade never stops. Careful who you deal with here, Champion.':
    '상인: 건너편으로 가는 다리는 끊겼지만, 거래는 결코 멈추지 않아. 여기선 누구와 거래할지 조심해, 챔피언.',

  // ── Han River shops (bike / store / dept) + park ──
  'SPACE — talk to Shop Clerk': 'SPACE — 가게 점원과 대화',
  'Shop Clerk: A visiting Champion at MY little shop? An honour — take a Bicycle, on the house.':
    '가게 점원: 내 작은 가게에 챔피언이 오시다니? 영광이에요 — 자전거 하나 가져가세요, 무료로.',
  '🚲 You received the Bicycle!': '🚲 자전거를 받았다!',
  'Shop Clerk: Press C out on the road to hop on. The riverside path runs all the way to the bridge — enjoy the ride!':
    '가게 점원: 길에서 C를 눌러 올라타세요. 강변길이 다리까지 쭉 이어져요 — 즐거운 라이딩 되세요!',
  'Shop Clerk: Everything running smoothly? Good. Press C anywhere to ride.':
    '가게 점원: 다 잘 굴러가나요? 좋아요. 아무 데서나 C를 눌러 타세요.',
  'Shop Clerk: These carbon frames on the rack? Someday, maybe. For now, the rental treats you fine.':
    '가게 점원: 진열대의 이 카본 프레임들이요? 언젠가는요. 지금은 대여용으로도 충분할 거예요.',
  'SPACE — Shop': 'SPACE — 상점',
  '🏪  POKÉ MART': '🏪  포켓몬 마트',
  'Store Clerk: Welcome! Drinks, rice balls, remedies — the riverside classics.':
    '편의점 점원: 어서 오세요! 음료, 주먹밥, 상비약 — 강변의 필수품이죠.',
  'Pharmacist: Potions, cures, Poké Balls — all your travelling needs.':
    '약사: 상처약, 치료제, 몬스터볼 — 여행에 필요한 모든 것.',
  'Gift Clerk: Take home a little piece of Onnuri!': '선물 가게 점원: 온누리의 작은 조각을 집으로 가져가세요!',
  'The Han River opens wide before you — sunlight scattering off the water, a great bridge striding across to the far bank.':
    '한강이 눈앞에 넓게 펼쳐진다 — 물 위로 흩어지는 햇살, 건너편 강기슭까지 성큼 뻗은 거대한 다리.',
  'Cyclists whir along the riverside road; families picnic on the lawns; cherry petals drift over the promenade.':
    '자전거들이 강변길을 스쳐 지나고, 가족들이 잔디밭에서 소풍을 즐기며, 벚꽃잎이 산책로 위로 흩날린다.',
  'A perfect place to breathe between battles. (Rent a bike at the shop, grab a snack at the store, or just take it in.)':
    '배틀 사이에 숨 돌리기 완벽한 곳. (가게에서 자전거를 빌리거나, 상점에서 간식을 사거나, 그냥 풍경을 즐기세요.)',
  '🚲 Han River Park (한강공원)': '🚲 한강공원',

  // ── Common overworld prompts ──
  'SPACE to continue': 'SPACE: 계속',
  'SPACE to advance': 'SPACE: 넘기기',
  // ── Buildings, landmarks & battle UI (auto-added) ──
  'POKEMON': '포켓몬',
  'Summit Dojo (정상 도장)': '정상 도장',
  '☕ 갈마 해변 카페 (Beach Café)': '☕ 갈마 해변 카페',
  '♨ 강철도 목욕탕 (Bathhouse)': '♨ 강철도 목욕탕',
  '⚓ Old Pier (부두)': '⚓ 옛 부두',
  '⚙ Iron Foundry (주물공장)': '⚙ 주물공장',
  '⛱ Beach Promenade (해안 산책로)': '⛱ 해안 산책로',
  '⛱ Seaside Pavilion (해안 정자)': '⛱ 해안 정자',
  '⛸ Frozen Amrok (얼음 강)': '⛸ 얼어붙은 압록강',
  '❄ Ice Harbour (얼음 항)': '❄ 얼음 항',
  '새벽 Dawn': '새벽',
  '심장 Heart': '심장',
  '어사대 Hall': '어사대 전당',
  '얼음 동굴 (Ice Cave)': '얼음 동굴',
  '황혼 Dusk': '황혼',
  '🌉 Songchon Bridge (성천강)': '🌉 성천강 대교',
  '🌉 압록강 대교 (Amrok Bridge — broken)': '🌉 압록강 대교 (끊김)',
  '🌊 Sea Wall (방파제)': '🌊 방파제',
  '🌌 Aurora Viewpoint (오로라 전망대)': '🌌 오로라 전망대',
  '🌲 Songdowon Pine Grove (송도원)': '🌲 송도원 솔밭',
  '🍜 강철도냉면 (Gangcheoldo Naengmyeon)': '🍜 강철도냉면',
  '🍺 뱃사람 주막 (Sailors\' Tavern)': '🍺 뱃사람 주막',
  '🏔 Baekdu Trailhead (백두산 등산로)': '🏔 백두산 등산로',
  '🏔 Mt. Dongheungsan (동흥산)': '🏔 동흥산',
  '🏔 Mt. Kumgang Viewpoint (금강산 전망)': '🏔 금강산 전망대',
  '🏗 Harbour Cranes (크레인)': '🏗 항만 크레인',
  '🏛 Barrage Monument (방조제비)': '🏛 방조제비',
  '🏛 Customs House (세관)': '🏛 세관',
  '🏡 고원 산장 (Highland Lodge)': '🏡 고원 산장',
  '🏨 Beach Resort (해수욕장 호텔)': '🏨 해수욕장 호텔',
  '🏪 교역소 (Trading Post)': '🏪 교역소',
  '🏭 No. 3 Steelworks (제철소)': '🏭 제3제철소',
  '🐟 Parangpo Fish Market (어시장)': '🐟 파랑포 어시장',
  '💧 Three Lakes (삼호)': '💧 삼호',
  '🗼 Foghorn Light (등대)': '🗼 무적 등대',
  '🗿 Steelworkers\' Monument (노동비)': '🗿 노동자 기념비',
  '🚉 압록강 국제철도역 (Intl. Rail Station)': '🚉 압록강 국제철도역',
  '🛏 뱃사람 여관 (Sailors\' Inn)': '🛏 뱃사람 여관',
  '🛡 관문성 관문 (to Gwanmunseong)': '🛡 관문성 관문',
  '🛤 미지의 대륙행 철길 (Line to the 미지의 대륙)': '🛤 미지의 대륙행 철길',
  '🥫 Fish Cannery (통조림 공장)': '🥫 통조림 공장',
  '🧂 Salt Flats (염전)': '🧂 염전',
  '🧭 미지의 대륙 전망대 (Unknown-Continent Overlook)': '🧭 미지의 대륙 전망대',
  '🪵 Larch Sawmill (제재소)': '🪵 낙엽송 제재소',
  'Farmer': '농부',
  'Fisher-\nman': '낚시\n꾼',
  'Moun-\ntaineer': '산악\n인',
  'Photo-\ngrapher': '사진\n작가',
  'Pilgrim': '순례자',
  'Pro-\nspector': '탐광\n꾼',
  'Sovereign': '군주',
  'Stationmaster': '역장',
  'Swim-\nmer': '수영\n선수',
  'Warden': '문지기',
  'Watcher': '감시자',
  'Worker': '인부',
  '노스단': '노스단',
  '노스단\nAdmin': '노스단\n간부',
  '노스단\nCourier': '노스단\n전령',
  '노스단\nGrunt': '노스단\n조무래기',
  '노스단\nScout': '노스단\n정찰대',
  '노스단\nSoldier': '노스단\n병사',
  // ── Titles & landmarks (auto-added, round 2) ──
  'SPACE — Talk to': 'SPACE — 대화:',
  'royal wardens': '왕실 관리인들',
  '— empty —': '— 비어 있음 —',
  '↑ 관문성 (Gwanmunseong)': '↑ 관문성',
  '↓ 해솔 (Haesol)': '↓ 해솔',
  '↓ 제단의 방 (Altar Hall)': '↓ 제단의 방',
  '☀ The Sacred Peak — 환웅의 강림': '☀ 성스러운 봉우리 — 환웅의 강림',
  '⛏ Dolmoe City — 돌뫼 시티': '⛏ 돌뫼 시티',
  '⛏ Dolmoe Mine (돌뫼 광산)': '⛏ 돌뫼 광산',
  '⛩️ FOREST SHRINE (숲 신전)': '⛩️ 숲 신전',
  '⛩️ 산방산 Shrine': '⛩️ 산방산 신전',
  '⛰ Route 2 — Scholar\'s Road (선비길)': '⛰ 2번 도로 — 선비길',
  '❄ Seorae Pass — 설령 고개': '❄ 설령 고개',
  '❄ 빙하관 얼음 동굴 — 5 stages to the heart': '❄ 빙하관 얼음 동굴 — 중심부까지 5단계',
  '❄ 천지 (Cheonji Lake)': '❄ 천지',
  '설운고원\n한국의 지붕': '설운고원\n한국의 지붕',
  '동해\nEast Sea': '동해',
  '북방 리그 · NORTHERN LEAGUE': '북방 리그',
  '시중호\n(Sijung Lagoon)': '시중호',
  '어사대 Inspector\n❓ Quiz Ward': '어사대 조사관\n❓ 시험장',
  '얼음길 — 미끄러진다!\n(ice slides you until a rock stops you)': '얼음길 — 미끄러진다!\n(바위에 부딪힐 때까지 미끄러져)',
  '이깔나무 숲\nLarch Forest': '이깔나무 숲',
  '장진호\nJangjin Lake': '장진호',
  '천지 (Cheonji) — the crater lake': '천지 — 백두산 정상의 화구호',
  '여명산\n(Mt. Yeomyeong)': '여명산',
  '관문성 · PYEONGSEONG': '관문성',
  '강철도 평야\nHamhung Plain': '강철도 평야',
  '환웅 — Hwanwoong': '환웅',
  '～ East Sea (동해) ～': '～ 동해 ～',
  '🌅 Route 6 — Eastern Shore Road (동해 해안도로)': '🌅 6번 도로 — 동해 해안도로',
  '🌅 Sunrise City (일출 시티)': '🌅 일출 시티',
  '🌲 Forest City (숲 시티)': '🌲 숲 시티',
  '🏆 NORTHERN HALL OF FAME · 북방 명예의 전당': '🏆 북방 명예의 전당',
  '🏔️ Seolbong Highland Pass (설봉 고갯길)': '🏔️ 설봉 고갯길',
  '🏙️ Seolbong City (설봉시티)': '🏙️ 설봉시티',
  '🏙️ Geumgang City (금강 시티)': '🏙️ 금강 시티',
  '🏙️ Haean City (해안 시티)': '🏙️ 해안 시티',
  '🏯 Songhyeon (송현)': '🏯 송현',
  '🏯 Northern League — 북방 리그': '🏯 북방 리그',
  '📜 Scholars\' Road (선비로)': '📜 선비로',
  '🔒 보석함 (locked)': '🔒 보석함 (잠김)',
  '🔔 Seorae Town — 서래 마을': '🔔 서래 마을',
  '🔬 Professor Song\'s Lab — Sudo City (수도 시티)': '🔬 송 박사 연구소 — 수도 시티',
  '🗺️  ONNURI REGION MAP  ·  온누리 지역 지도': '🗺️  온누리 지역 지도',
  '🗿 고인돌 유적 — DOLMEN RUINS': '🗿 고인돌 유적',
  '🚌 Bus → Songhyeon 송현': '🚌 버스 → 송현',
  '🏬 Capitol Dept. Store —': '🏬 소올 백화점 —',
  // ── Post-2026-07-29 content (auto-added) ──
  "Nobody reaches the stairs. Those are the 간부's orders. Back down with you!": "아무도 계단엔 못 간다. 그게 간부의 명령이야. 썩 내려가!",
  "One floor from the 간부. You'll go no further — 노스단 rises here!": "간부까지 한 층 남았군. 더는 못 간다 — 노스단은 여기서 일어선다!",
  "The 간부 is just above. Over my body — that's the only way up!": "간부는 바로 위에 계신다. 올라가려면 내 시체를 넘어야 할 거다!",
  "So the 어사대's little champion crawls to the top. I am Clemont — Sovereign of 노스단. We will take Samho, the peak, and everything beyond it. You end HERE.": "어사대의 꼬마 챔피언이 꼭대기까지 기어 올라왔군. 나는 클레몽 — 노스단의 수장이다. 우리는 삼호를, 저 봉우리를, 그리고 그 너머 모든 것을 손에 넣는다. 넌 여기서 끝이다.",
  "어사대장 Seolwon now awaits your challenge at the 어사대 Hall.": "이제 어사대장 설원이 어사대 전당에서 너의 도전을 기다린다.",
  "The last 노스단 grunt flees, dropping a heavy iron key in the snow!": "마지막 노스단 부하가 무거운 쇠 열쇠를 눈밭에 떨어뜨리고 달아난다!",
  "노스단 grunts bar the gate. \"Beat us first if you think you're getting in!\"": "노스단 부하들이 문을 막아선다. \"들어가고 싶으면 먼저 우릴 이겨 봐!\"",
  "🔑 You unlock the 노스단 아지트 gate with the key.": "🔑 열쇠로 노스단 아지트의 문을 열었다.",
  "You got past the first post? The 간부 said to let no 어사대 dog near the gate. So you'll have to go through me!": "첫 초소를 지나왔다고? 간부께서 어사대 개는 문 근처에 얼씬도 못 하게 하라고 하셨지. 그러니 날 넘어야 할 거다!",
  "🌊 Haean is a dark line on the water behind you now; the sun sinks into the western sea.": "🌊 이제 해안은 물 위 저편의 어두운 선이 되었고, 해는 서쪽 바다로 잠긴다.",
  "Rival: Old Dosik said to tell the Grandmother an old man from Haean still leaves rice cakes out for her.": "라이벌: 도식 영감님이 그러시더라 — 할망께 해안의 한 노인이 아직도 떡을 차려 놓는다고 전해 달라고.",
  "Rival: I wouldn't trade it. For the record. (Explore the deck — and the hatch leads below to the cabins. Spar the trainers, then talk to the deckhand at the cargo.)": "라이벌: 그래도 안 바꿔. 분명히 말해 두는데. (갑판을 둘러봐 — 해치로 내려가면 아래 선실이야. 트레이너들과 겨루고, 화물칸의 갑판원에게 말을 걸어.)",
  "↓ Below Deck": "↓ 아래 선실로",
  "🌅 The overnight ferry casts off from Haean Harbour, bound across the dark strait for Jeju.": "🌅 밤 연락선이 해안항을 떠나, 어두운 해협을 건너 제주로 향한다.",
  "Rival: A whole ocean between us and the mainland now. No turning back from here.": "라이벌: 이제 우리와 육지 사이엔 온통 바다뿐이야. 여기서부턴 돌아갈 수 없어.",
  "Rival: The old Grandmother's shrine, the vents, all of it — out there in the dark. Let's go meet it.": "라이벌: 늙은 할망의 사당도, 분화구도, 전부 — 저 어둠 속에 있어. 만나러 가자.",
  "⛴️ Casting off — Haean Harbour → Jeju": "⛴️ 출항 — 해안항 → 제주",
  "SPACE: continue": "SPACE: 계속",
  "Night watch's boring till a challenger walks by. You'll do!": "도전자가 지나가기 전엔 야간 당직도 지루하지. 네가 딱이야!",
  "The sea air is divine — and so is a good battle. Care to entertain me?": "바닷바람은 정말 좋아 — 좋은 배틀도 그렇고. 날 좀 즐겁게 해 주겠어?",
  "Off-watch, but never off my guard. Show me the mainland trains its trainers right.": "당직은 끝났지만, 경계는 늦추지 않아. 육지가 트레이너를 제대로 키우는지 보여 봐.",
  "Keep it down by the engine — she rattles enough. You want a bout? Quick, then.": "엔진 옆에선 조용히 해 — 안 그래도 시끄러우니까. 한 판 붙자고? 그럼 빨리.",
  "Prof. Song (comms): 노스단 hasn't moved on this place. Keep earning badges — I'll call you the moment it matters.": "송 박사 (통신): 노스단은 아직 이곳엔 손대지 않았어. 배지를 계속 모으게 — 중요한 순간이 오면 바로 연락하지.",
  "You crest the black-rock summit. 나비할망 — wings of hammered, dancheong-patterned metal, dusted in luminous fairy scales — thrashes inside a straining 노스단 rig.": "너는 검은 바위 정상에 오른다. 나비할망 — 단청 무늬로 두드려 편 금속 날개에, 빛나는 페어리 비늘이 뿌려진 — 이 팽팽히 당겨진 노스단 장치 안에서 몸부림친다.",
  "나비할망's metallic wings flare — and the restraint field SHATTERS. The 노스단 equipment overloads in a cascade of sparks; operatives are thrown back.": "나비할망의 금속 날개가 번쩍인다 — 그리고 구속 필드가 산산이 부서진다. 노스단 장비가 불꽃을 쏟으며 과부하되고, 요원들은 뒤로 나동그라진다.",
  "Commander Ryeo: That moth was supposed to be OUR key to reshaping this peninsula! And you—": "사령관 려: 그 나방은 이 반도를 뜯어고칠 우리의 열쇠였어! 그런데 네가—",
  "Commander Ryeo: ...Then I'll take it from your corpse. One final test. You and me. No team. Just will.": "사령관 려: ...그럼 네 시체에서 빼앗지. 마지막 시험이다. 너와 나. 팀도 없이. 오직 의지로만.",
  "Commander Ryeo: ...She looks at you like you're not a tool to be used. Like you matter. That's what I never understood about this region. That's what we tried to control.": "사령관 려: ...저 아이는 널 이용할 도구가 아닌 것처럼 봐. 네가 소중한 존재인 것처럼. 그게 내가 이 지역에 대해 끝내 이해하지 못한 거였어. 그게 우리가 통제하려 했던 거였고.",
  "Commander Ryeo: The 노스단 southern operations are done. Your rig is scrap. Your orders don't reach here anymore.": "사령관 려: 노스단의 남부 작전은 끝났어. 네 장치는 고철이고. 네 명령은 더는 여기까지 닿지 않아.",
  "Prof. Song: She's leaving. Let her. 노스단's reach here is broken.": "송 박사: 그녀가 떠나는군. 내버려 둬. 이곳에 뻗친 노스단의 손길은 끊겼어.",
  "나비할망's wings catch the dawn light. You've earned something rare — the choice of a legendary.": "나비할망의 날개가 새벽빛을 머금는다. 너는 드문 것을 얻었다 — 전설의 포켓몬이 스스로 택한 선택을.",
  "나비할망 still thrashes at the summit, testing you. Steady your team and try again.": "나비할망은 아직 정상에서 몸부림치며 너를 시험한다. 팀을 정비하고 다시 도전하자.",
  "Prof. Song: Welcome back. The lab is always open when you need a place to review your journey.": "송 박사: 잘 왔네. 여정을 돌아볼 곳이 필요할 땐 언제든 연구소는 열려 있어.",
  "Prof. Song: Keep your team healthy, and come see me whenever the Pokédex turns up something unusual.": "송 박사: 팀을 건강히 유지하고, 포켓몬 도감에 특이한 게 뜨면 언제든 찾아오게.",
  "You hurry across 소올 to Professor Song's lab.": "너는 소올을 가로질러 송 박사의 연구소로 서둘러 간다.",
  "(Two maps cover the wall: red pins mark Team Suri digs, black pins mark 노스단 installations.)": "(벽에 지도 두 장이 붙어 있다: 붉은 핀은 수리단의 발굴지, 검은 핀은 노스단의 시설을 표시한다.)",
  "Prof. Song: Team Suri is unknowingly doing 노스단's work for them.": "송 박사: 수리단은 자기도 모르게 노스단의 일을 대신 해 주고 있어.",
  "Prof. Song: 나비할망 — the Grandmother Moth. Fairy/Steel. She sleeps near the Jeju volcanic vents.": "송 박사: 나비할망 — 할망 나방이지. 페어리/강철 타입. 제주 화산 분화구 근처에서 잠들어 있어.",
  "Prof. Song: Her metallic wings can ABSORB and neutralize enormous energy. 노스단 knows this.": "송 박사: 그녀의 금속 날개는 막대한 에너지를 흡수해 중화할 수 있어. 노스단도 그걸 알고 있지.",
  "Arrows / WASD: move   ·   SPACE: exit": "방향키 / WASD: 이동   ·   SPACE: 나가기",
  "어사대장 Jinnok: The 어사대 hold the peak. Summon the Sovereign, Champion.": "어사대장 진녹: 어사대가 봉우리를 장악했다. 수장을 소환하라, 챔피언.",
  "노스단's leader is dragged from the altar. For a moment, the peak is silent.": "노스단의 우두머리가 제단에서 끌려 나온다. 잠시 봉우리는 고요해진다.",
  "Then 풍백, 우사 and 운사 rise from your side of their own accord and take their places around the altar — Wind, Rain and Cloud, wheeling in harmony. The sky splits with light.": "그러자 풍백, 우사, 운사가 네 곁에서 스스로 떠올라 제단 주위 제자리를 잡는다 — 바람과 비와 구름이 조화롭게 선회한다. 하늘이 빛으로 갈라진다.",
  "🌟 환웅 (Hwanung), the Sovereign Who Descended, alights upon the altar — but the raw energy of his descent screams off the peak, and the god's eyes blaze with a fury older than the mountains.": "🌟 환웅, 강림한 수장이 제단 위에 내려선다 — 그러나 그 강림의 날것 그대로의 에너지가 봉우리를 뒤흔들며 비명을 지르고, 신의 두 눈은 산맥보다도 오래된 분노로 타오른다.",
  "Prof. Song (at your side, urgent): That awakening energy will tear the peak apart! You need something that can absorb it — 나비할망! Her wings, Champion, NOW!": "송 박사 (네 곁에서 다급하게): 저 각성 에너지가 봉우리를 찢어 놓을 거야! 그걸 흡수할 무언가가 필요해 — 나비할망! 그녀의 날개야, 챔피언, 지금 당장!",
  "You send out 나비할망. The Grandmother Moth spreads her vast metallic wings and drinks in the storm of light, and the god's rage drains away into a deep, ancient calm.": "너는 나비할망을 내보낸다. 할망 나방이 거대한 금속 날개를 펼쳐 빛의 폭풍을 들이마시고, 신의 분노는 깊고 오래된 고요 속으로 잦아든다.",
  "환웅 lowers his head and regards you at last — not as prey, but as the one worthy to summon him. It steadies itself to test your strength.": "환웅이 고개를 숙여 마침내 너를 바라본다 — 먹잇감이 아니라, 자신을 소환할 자격이 있는 자로서. 그는 너의 힘을 시험하려 자세를 가다듬는다.",
  "노스단 is dismantled for good, Sovereign Clemont imprisoned alongside Ryeo. The founding myth's ancient retinue is united under a single trainer for the first time in millennia.": "노스단은 완전히 해체되고, 수장 클레몽은 려와 함께 투옥된다. 건국 신화의 오래된 수행신들이 수천 년 만에 처음으로 한 명의 트레이너 아래 하나로 모인다.",
  "어사대장 Jinnok (bowing, the deepest honour of her order): Four hundred years the 어사대 guarded these peaks against outsiders. Today an outsider guarded them for US. You are no outsider anymore, southerner.": "어사대장 진녹 (그녀의 문파에서 가장 깊은 예를 갖춰 절하며): 사백 년 동안 어사대는 외지인으로부터 이 봉우리들을 지켜 왔다. 오늘은 한 외지인이 우리를 위해 그것들을 지켰지. 너는 더 이상 외지인이 아니다, 남쪽 사람이여.",
  "어사대장 Jinnok: Carry this 마패. Any 어사대 in any northern city will aid you on sight. The north will remember your name as long as the mountains stand.": "어사대장 진녹: 이 마패를 지녀라. 어느 북부 도시의 어사대든 이걸 보면 곧바로 널 도울 것이다. 산이 서 있는 한, 북부는 네 이름을 기억할 것이다.",
  "🏆 You hold 환웅, 풍백, 우사, 운사, 나비할망 — the complete mythological pantheon of Onnuri.": "🏆 너는 환웅, 풍백, 우사, 운사, 나비할망을 거느린다 — 온누리 신화의 완전한 판테온을.",
  "A grand stone gate behind the palace marks the trailhead of Scholars' Road (선비로), inscribed with a single line:": "궁궐 뒤편의 웅장한 돌문이 선비로의 들머리를 표시하며, 한 줄 글귀가 새겨져 있다:",
  "The 어사대 are out there somewhere, watching from the branches. Follow the trail deep enough, and they will show themselves. Mind the thickets — wild things den in these woods.": "어사대는 저 어딘가에서 나뭇가지 사이로 지켜보고 있다. 오솔길을 충분히 깊이 따라가면, 그들이 모습을 드러낼 것이다. 덤불을 조심하라 — 이 숲엔 야생의 것들이 굴을 튼다.",
  "(An 어사대 healer restores your team before the trial.)": "(어사대의 치료사가 시험에 앞서 네 팀을 회복시켜 준다.)",
  "어사대 Inspector: ...Correct. A trainer who knows the land is a trainer who respects it. The trail is yours.": "어사대 조사관: ...정답이다. 땅을 아는 트레이너가 곧 땅을 존중하는 트레이너지. 길을 열어 주마.",
  "어사대 Inspector: Wrong. The woods do not open for the careless. Study the north, and return when you are certain.": "어사대 조사관: 틀렸다. 숲은 경솔한 자에게 길을 열지 않는다. 북부를 공부하고, 확신이 설 때 다시 오너라.",
  "어사대장 Jinnok bows — the deep, formal bow of the order. The gathered inspectors follow.": "어사대장 진녹이 절한다 — 문파의 깊고 격식 있는 절이다. 모여 있던 조사관들이 그 뒤를 따른다.",
  "어사대장 Jinnok: The 어사대 stand with the south's Champion — for the first time in four hundred years.": "어사대장 진녹: 어사대가 남부의 챔피언과 함께 선다 — 사백 년 만에 처음으로.",
  "어사대장 Jinnok: The wards on the three shrines are lifted. 풍백 the Wind, 우사 the Rain, 운사 the Clouds — gather them before 노스단 does, and Hwanung himself will answer.": "어사대장 진녹: 세 사당의 봉인이 풀렸다. 바람의 풍백, 비의 우사, 구름의 운사 — 노스단보다 먼저 그들을 모으면, 환웅께서 친히 응답하실 것이다.",
  "어사대장 Jinnok: I ride with you from here. The woods are behind you. Climb, Champion.": "어사대장 진녹: 여기서부턴 나도 함께 간다. 숲은 이제 네 뒤에 있다. 올라라, 챔피언.",
  "You were defeated. The League tower returns to its first floor and the stairways seal once more.": "너는 패배했다. 리그 탑은 다시 1층으로 되돌아가고, 계단들은 또 한 번 봉인된다.",
  "The League is a single ascent — best all four masters again, in one unbroken run, to reach the Champion.": "리그는 단 한 번의 등정이다 — 네 명의 마스터를 다시, 한 번도 끊기지 않고 연달아 꺾어야 챔피언에게 이른다.",
  "Each master occupies a separate floor. Defeat one, climb the newly opened stairs, and continue upward.": "각 마스터는 서로 다른 층을 차지하고 있다. 하나를 이기고, 새로 열린 계단을 올라, 계속 위로 나아가라.",
  "The Champion awaits on the fifth-floor main stage. Each floor restores your team before its match.": "챔피언은 5층 메인 무대에서 기다린다. 각 층은 대전 전에 네 팀을 회복시켜 준다.",
  "— culminating in 나비할망's metallic wings catching the dawn light as she settles beside you, the guardian of the south you have become.": "— 그리고 그 끝에서, 나비할망의 금속 날개가 새벽빛을 머금으며 네 곁에 내려앉는다. 너는 남부의 수호자가 되었다.",
  "Rival: Champion of the south. And 나비할망's chosen one. Has a ring to it.": "라이벌: 남부의 챔피언. 게다가 나비할망이 택한 자. 어감이 근사하네.",
  "↓ League Plaza": "↓ 리그 광장",
  "Prof. Song (comms): Listen to me — you can't DEFEAT him! That energy isn't his, it's 풍백, 우사, and 운사's power forced through him! Every hit you land just feeds the matrix more!": "송 박사 (통신): 내 말 들어 — 그를 쓰러뜨릴 순 없어! 저 에너지는 그의 것이 아니야, 풍백과 우사와 운사의 힘을 그를 통해 강제로 뿜어낸 거라고! 네가 한 대 칠 때마다 그 장치에 힘만 더 실릴 뿐이야!",
  "Prof. Song: You've done something no one has in a thousand years. The south has its guardian in 나비할망. The north now has its balance restored through 환웅's power. You carry the weight of both now.": "송 박사: 넌 천 년 동안 아무도 못 한 일을 해냈어. 남부에는 나비할망이라는 수호자가 있고, 북부는 이제 환웅의 힘을 통해 균형을 되찾았지. 이제 넌 그 둘의 무게를 함께 짊어진 거야.",
  "Speaker: Welcome to the 온누리 National Assembly Hall.": "의장: 온누리 국회의사당에 오신 것을 환영합니다.",
  "Speaker: Here the province debates the laws that bind every city and route.": "의장: 이곳에서 이 지방은 모든 도시와 길을 아우르는 법을 논의합니다.",
  "Speaker: Even the Pokémon League answers to what is decided on this floor.": "의장: 포켓몬 리그조차 이 의석에서 결정된 바를 따릅니다.",
  "Aide: Mind the benches — the afternoon session runs long.": "보좌관: 의석을 조심하세요 — 오후 회기는 길게 이어지거든요.",
  "Aide: They say the first Champion was sworn in right here, at the rostrum.": "보좌관: 최초의 챔피언이 바로 여기, 이 연단에서 취임 선서를 했다더군요.",
  "The Gym Leader Jin awaits at the northern gym.\nPrepare well — His shadow Pokémon are powerful.": "체육관 관장 진이 북쪽 체육관에서 기다린다.\n단단히 준비해라 — 그의 그림자 포켓몬은 강력하다.",
  "Han River Park →": "한강 공원 →",
  "← Scholars' Road": "← 선비로",
  "The 노스단 crew scatter — but their crowbars have already done the harm.": "노스단 일당이 흩어진다 — 하지만 그들의 쇠지레는 이미 해를 끼친 뒤다.",
  "(You cross into the great dolmen field. 노스단 machinery whines against a sealed capstone deep to the west — and Leader Sandol stands square in its way.)": "(너는 거대한 고인돌 벌판으로 들어선다. 서쪽 깊은 곳에서 노스단의 기계가 봉인된 덮개돌에 대고 윙윙거리고 — 그 앞을 두목 산돌이 정면으로 가로막고 서 있다.)",
  "노스단 Digger: This slab's been sealed a few thousand years. Whatever's under it, the Director wants it.": "노스단 발굴꾼: 이 석판은 수천 년 봉인돼 있었지. 그 아래 뭐가 있든, 국장님이 원하셔.",
  "노스단 Digger: The old stonecutter won't let us work. Move him — and you — aside.": "노스단 발굴꾼: 저 늙은 석공이 작업을 못 하게 막네. 저 영감도 — 너도 — 비켜.",
  "나비할망 — the moth grandmother you bonded with at the Jeju vents — sweeps back to your side, her dancheong wings folding gently. She was returned to your team (or your PC box, if your party was full).": "나비할망 — 제주 분화구에서 유대를 맺은 그 나방 할망 — 이 단청 날개를 곱게 접으며 네 곁으로 돌아온다. 그녀는 네 팀으로 (파티가 꽉 찼다면 PC 박스로) 돌아왔다.",
  "Prof. Song: The Ancient Keeper Badge — your fifth. Well done. But drop everything and come back to 소올 (So-ol).": "송 박사: 고대 수호자 배지 — 다섯 번째로군. 잘했어. 하지만 모든 걸 멈추고 소올로 돌아와 줘.",
  "Prof. Song: I've pieced together what Team Suri and 노스단 are really after. You need to hear this in person.": "송 박사: 수리단과 노스단이 진짜로 노리는 게 뭔지 짜맞췄어. 이건 직접 만나서 들어야 해.",
  "Prof. Song: Heal your team at the Pokémon Center first, then come to my lab — you'll want to be at full strength.": "송 박사: 먼저 포켓몬 센터에서 팀을 회복하고, 그다음 연구소로 와 — 만전을 기하는 게 좋을 거야.",
  "Rival: I'll meet you at the lab. Let's move.": "라이벌: 연구소에서 보자. 움직이자.",
  "You arrive in Forest City (숲 시티).": "너는 숲 시티에 도착한다.",
  "Innkeeper: Welcome to the 온천여관 — warm your bones after the cold pass.": "여관 주인: 온천여관에 오신 걸 환영해요 — 추운 고개를 넘었으니 뼛속까지 녹이세요.",
  "Innkeeper: Soak a while... there. Your Pokémon look right as rain now.": "여관 주인: 잠시 몸을 담그세요... 자, 됐어요. 이제 포켓몬들이 아주 쌩쌩해 보이네요.",
  "Innkeeper: The mountain is kinder to the rested. Come back any time.": "여관 주인: 산은 쉰 자에게 더 너그럽죠. 언제든 다시 오세요.",
  "Bathing Climber: Aaah... this spring bubbles straight up from under Baekdu.": "온천욕 등반가: 아아... 이 온천은 백두 아래에서 곧장 솟아오른대요.",
  "Bathing Climber: Feels like a full night's sleep in one soak, doesn't it?": "온천욕 등반가: 한 번 담그면 밤새 푹 잔 것 같지 않아요?",
  "Bathing Climber: Ask the innkeeper for a soak — it heals your whole team.": "온천욕 등반가: 여관 주인에게 온천욕을 청해 봐요 — 팀 전체가 회복된답니다.",
  "Librarian: Welcome to the 국립도서관 — the National Library of 온누리.": "사서: 국립도서관 — 온누리 국립도서관에 오신 것을 환영합니다.",
  "Librarian: Every Pokédex entry ever recorded is archived on these shelves.": "사서: 지금까지 기록된 모든 포켓몬 도감 항목이 이 서가에 보관돼 있습니다.",
  "Librarian: Read quietly... some of these scrolls are six centuries old.": "사서: 조용히 읽어 주세요... 이 두루마리 중엔 육백 년 된 것도 있으니까요.",
  "Scholar: They say a hidden move-tutor once studied at this very table.": "학자: 숨은 기술 전수자가 바로 이 탁자에서 공부한 적이 있다더군요.",
  "Scholar: Knowledge is the sharpest move of all. Ha!": "학자: 지식이야말로 가장 예리한 기술이지요. 하하!",
  "Rival: Win the Tidal Arena badge — then we figure out where 노스단 hauled those sealed containers.": "라이벌: 조수 투기장 배지를 따 — 그다음 노스단이 그 봉인된 컨테이너들을 어디로 실어 갔는지 알아내자.",
  "You arrived at Pine Needle Town (솔잎 마을).": "너는 솔잎 마을에 도착했다.",
  "You lay your hand on the 고대 제단 (Ancient Altar). The stone is ice-cold, but it does not respond.": "너는 고대 제단에 손을 얹는다. 돌은 얼음처럼 차갑지만, 아무런 반응이 없다.",
  "So the Inspectorate's dog reaches the very peak. Beyond lies Samho — and 노스단's road to the sacred mountain. You go no further!": "어사대의 개가 기어이 정상까지 왔군. 그 너머엔 삼호가 — 그리고 신성한 산으로 향하는 노스단의 길이 있다. 더는 못 간다!",
  "League Warden: Halt. The eight 어사대장 must vouch for you — in 마패.": "리그 관리관: 멈춰라. 여덟 어사대장이 너를 보증해야 한다 — 마패로써.",
  "League Warden: Excellent. All eight 마패 are in your possession, including the final tablet from Supreme Gwang himself.": "리그 관리관: 훌륭하다. 총수 광께서 친히 내리신 마지막 패를 포함해, 여덟 마패가 모두 네 손에 있군.",
  "At the Forest Shrine, Team Suri is mid-excavation. On the ridge, 노스단 watches — then moves on the shrine.": "숲 신전에서 수리단이 한창 발굴 중이다. 능선 위에선 노스단이 지켜보다가 — 이내 신전으로 움직인다.",
  "In the chaos, Admin Chaeyeon's grunts accidentally fight alongside you to drive 노스단 back.": "혼란 속에서, 채연 간부의 부하들이 얼떨결에 너와 나란히 싸우며 노스단을 몰아낸다.",
  "So the Inspectorate's errand-runner reaches Yeomyeong. Beyond this fog is Muyeonhang — and 노스단 runs that port. Turn back!": "어사대의 심부름꾼이 여명까지 왔군. 이 안개 너머는 무연항이다 — 그 항구는 노스단이 장악하고 있지. 돌아가라!",
  "You climb into Dolmoe City (돌뫼 시티) — a city hewn entirely from granite, dolmen fields and rock-cut Buddha carvings watching from the cliffs.": "너는 돌뫼 시티로 올라선다 — 온통 화강암으로 깎아 만든 도시로, 고인돌 벌판과 절벽에서 내려다보는 마애불이 있는 곳이다.",
  "Rival: 노스단 — that's what the locals call them. \"Group North.\" Ryeo's people.": "라이벌: 노스단 — 주민들이 저들을 그렇게 불러. \"북부 조직\"이라는 뜻이지. 려의 부하들이야.",
  "Prof. Song (comms): You made it across! 노스단's barge hit the same storm, so their head start is gone.": "송 박사 (통신): 무사히 건넜구나! 노스단의 바지선도 같은 폭풍에 걸려서, 그들의 앞선 출발은 무의미해졌어.",
  "Prof. Song: 나비할망 sleeps at the summit. Rest and stock up here, then climb. Run — they're already on the mountain.": "송 박사: 나비할망은 정상에서 잠들어 있어. 여기서 쉬고 물자를 채운 다음 올라가. 서둘러 — 저들은 벌써 산에 올랐어.",
  "Camped by 장진호 all season. The lake freezes so hard you can walk clear across it. My team's just as cold and hard!": "한 철 내내 장진호 곁에서 야영했어. 호수가 어찌나 단단히 어는지 걸어서 건널 수 있을 정도야. 내 팀도 그만큼 차갑고 단단하지!",
  "You crossed the whole plateau to sniff after us? 노스단 hauls its cargo over Seolun by night — bound for the peak. You've seen too much. Fall here!": "우릴 캐려고 고원 전체를 가로질렀다고? 노스단은 밤에 설운 너머로 화물을 실어 나른다 — 봉우리로 향하지. 넌 너무 많이 봤어. 여기서 쓰러져라!",
  "Prof. Song: It's begun. 노스단 has moved on 나비할망 at the Jeju vents — RIGHT NOW. Your Frostbell Badge says you're finally ready for this.": "송 박사: 시작됐어. 노스단이 제주 분화구의 나비할망을 덮쳤어 — 바로 지금. 네 서리종 배지가 이제 네가 이 일을 감당할 준비가 됐다고 말해 주는군.",
  "You slide onto the frozen floor of the Frostbell Shrine (서리종 신전)!": "너는 서리종 신전의 얼어붙은 바닥 위로 미끄러져 들어선다!",
  " Road opens from the Capitol now.": " 이제 소올에서 그 길이 열려.",
  "목탁귀 Moktakgwi: ...tok... tok... tok...": "목탁귀: ...똑... 똑... 똑...",
  "The statue's base grinds aside — and a hidden stair opens onto blinding white. You climb out onto the rim of 천지 (Cheonji), the sacred crater lake, frozen mirror-still under a gentle sky.": "석상의 받침이 갈리며 옆으로 밀려나고 — 숨겨진 계단이 눈부신 백색을 향해 열린다. 너는 천지, 그 신성한 화구호의 가장자리로 올라선다. 잔잔한 하늘 아래 거울처럼 얼어붙어 고요하다.",
  "Nursery Keeper: Welcome to Pine Needle Pokémon Nursery!": "키우미집 주인: 솔잎 포켓몬 키우미집에 온 걸 환영해요!",
  "Collector: Here — a 나비할망 charm, from my own collection. May it watch over your road.": "수집가: 자 — 내 소장품 중 나비할망 부적일세. 자네의 여정을 지켜 주기를.",
  "🦋 You received a 나비할망 Charm!": "🦋 나비할망 부적을 받았다!",
  "The treeline opens into Seorae Town (서래 마을), a wide alpine village of pine groves, steaming baths, and enormous snow sculptures.": "나무 경계선이 열리며 서래 마을이 펼쳐진다. 솔숲과 김이 오르는 온천, 그리고 거대한 눈 조각상이 있는 너른 고산 마을이다.",
  "The Northern League rises through five separate storeys. Defeat each master, take the stairs to the chamber above, and climb until you reach Taewang at the summit.": "북부 리그는 다섯 개의 층으로 솟아 있다. 각 마스터를 꺾고, 위층 방으로 향하는 계단을 올라, 정상의 태왕에게 이를 때까지 오르라.",
  "Every floor restores your team before the match.": "각 층은 대전 전에 네 팀을 회복시켜 준다.",
  "(The floor's healing machine restores your team to full health.)": "(그 층의 회복 장치가 네 팀을 최상의 상태로 되돌려 준다.)",
  "You slide onto the frozen floor of the Frostbell Shrine (서리종 신전)! ": "너는 서리종 신전의 얼어붙은 바닥 위로 미끄러져 들어선다!",

  // ── Post-2026-07-29 content (auto-added) ──
  "Potion": "상처약",
  "Super Potion": "좋은상처약",
  "Hyper Potion": "고급상처약",
  "Max Potion": "풀회복약",
  "Revive": "기력의조각",
  "Max Revive": "기력의덩어리",
  "Antidote": "해독제",
  "Paralyze Heal": "마비치료제",
  "Burn Heal": "화상치료제",
  "Ice Heal": "얼음치료제",
  "Awakening": "잠깨는약",
  "Full Heal": "만능치료제",
  "Poké Ball": "몬스터볼",
  "Great Ball": "슈퍼볼",
  "Ultra Ball": "하이퍼볼",
  "Master Ball": "마스터볼",
  "Ether": "PP에이드",
  "Elixir": "PP회복",
  "HM01 · Fly": "비전머신01 · 공중날기",
  "Fresh Water": "신선한물",
  "Soda Pop": "탄산음료",
  "Lemonade": "레모네이드",
  "Moomoo Milk": "무우무우밀크",
  "Lava Cookie": "용암쿠키",
  "Munkain Plush": "문카인 인형",
  "Vipour Plush": "바이포 인형",
  "Onnurian Plush": "온누리안 인형",
  "Corrpanda Doll": "코르판다 인형",
  "나비할망 Charm": "나비할망 부적",
  "대장승 Figurine": "대장승 피규어",
  "Restores 20 HP.": "HP를 20 회복한다.",
  "Restores 60 HP.": "HP를 60 회복한다.",
  "Restores 120 HP.": "HP를 120 회복한다.",
  "Fully restores HP.": "HP를 모두 회복한다.",
  "Revives a fainted Pokémon to half HP.": "쓰러진 포켓몬을 HP 절반으로 되살린다.",
  "Revives a fainted Pokémon to full HP.": "쓰러진 포켓몬을 HP를 모두 채워 되살린다.",
  "Cures poison.": "독을 치료한다.",
  "Cures paralysis.": "마비를 치료한다.",
  "Cures a burn.": "화상을 치료한다.",
  "Thaws a frozen Pokémon.": "얼음 상태를 치료한다.",
  "Wakes a sleeping Pokémon.": "잠듦 상태를 치료한다.",
  "Cures any status problem.": "모든 상태이상을 치료한다.",
  "A device for catching Pokémon.": "포켓몬을 잡기 위한 도구.",
  "A good ball with a higher catch rate.": "포획률이 조금 높은 좋은 볼.",
  "An ultra-performance catch ball.": "포획 성능이 매우 뛰어난 볼.",
  "The best Ball. Catches any Pokémon without fail.": "최고의 볼. 어떤 포켓몬이든 반드시 잡는다.",
  "Restores 20 PP to each of a Pokémon's moves.": "포켓몬의 각 기술 PP를 20씩 회복한다.",
  "Fully restores the PP of all of a Pokémon's moves.": "포켓몬의 모든 기술 PP를 완전히 회복한다.",
  "Teach Fly to a Flying-type Pokémon. Reusable.": "비행타입 포켓몬에게 공중날기를 가르친다. 재사용 가능.",
  "Mountain spring water. Restores 30 HP.": "산속 샘물. HP를 30 회복한다.",
  "A fizzy soft drink. Restores 60 HP.": "톡 쏘는 청량음료. HP를 60 회복한다.",
  "A sweet-tart cooler. Restores 90 HP.": "새콤달콤한 음료. HP를 90 회복한다.",
  "Rich, nourishing milk. Restores 120 HP.": "진하고 영양 많은 우유. HP를 120 회복한다.",
  "A regional treat. Cures any status problem.": "지역 명물 간식. 모든 상태이상을 치료한다.",
  "A plush of the Grass starter. Impossibly soft.": "풀 스타팅 포켓몬 인형. 믿을 수 없이 부드럽다.",
  "A plush of the Fire starter. Warm to the touch.": "불꽃 스타팅 포켓몬 인형. 만지면 따뜻하다.",
  "A plush of the Water starter. Faintly damp.": "물 스타팅 포켓몬 인형. 살짝 축축하다.",
  "A doll of Leader Jin's shadow-panda ace.": "관장 진의 그림자 판다 에이스 인형.",
  "A dancheong-painted charm of the moth grandmother. Said to bring luck.": "단청을 입힌 나방 할망 부적. 행운을 가져다준다고 한다.",
  "A carved granite figurine of the guardian totem.": "수호 토템을 새긴 화강암 피규어.",
  "Deep in the frozen woods, after a long climb through the pines, a figure finally steps onto the trail — dark inspector's robes, a brass 마패 tablet at her belt.": "얼어붙은 숲 깊은 곳, 소나무 사이를 한참 오른 끝에, 마침내 한 인영이 오솔길로 걸어 나온다 — 어두운 조사관의 도포에, 허리춤엔 놋쇠 마패를 찬 채.",
  "노스단 Admin: The 어사대 let a southerner this deep into the woods? How far they've fallen.": "노스단 간부: 어사대가 남쪽 사람을 이 숲 깊은 곳까지 들였다고? 어지간히도 몰락했군.",
  "어사대장 Salmu: Word runs ahead of you through the woods now — the southern champion who chased the shadows off our mountain.": "어사대장 살무: 이제 소문이 숲을 가로질러 너보다 앞서 달린다 — 우리 산에서 그림자들을 몰아낸 남부의 챔피언 이야기가.",
  "어사대장 Gapcheol: You bled for a forest that was never yours. The last of the inspectors will not go easy for it.": "어사대장 갑철: 넌 결코 네 것이 아니었던 숲을 위해 피를 흘렸지. 마지막 조사관인 나는 그렇다고 봐주지 않는다.",
  "At the tree-line, where the woods give way to the bare peak, the head of the order waits with the full 어사대 gathered behind her.": "숲이 헐벗은 봉우리에 자리를 내주는 수목한계선에서, 문파의 수장이 어사대 전원을 뒤에 거느린 채 기다린다.",
  "어사대장 Jinnok: Four hundred years the 어사대 judged outsiders. Today we judge in your favour. You came to save Onnuri — north and south both.": "어사대장 진녹: 사백 년 동안 어사대는 외지인을 심판해 왔다. 오늘 우리는 네 편에 서서 판결한다. 너는 온누리를 — 북과 남 모두를 — 구하러 왔으니.",
  "어사대장 Jinnok: One last measure. Then the wards open, and we climb to the shrines together.": "어사대장 진녹: 마지막 시험 하나. 그것이 끝나면 봉인이 열리고, 우리는 함께 사당으로 오른다.",
  "Steward: Cabins are down this passage — lounge forward, crew berth amidships, cargo hold aft.": "승무원: 선실은 이 통로 아래에 있어요 — 앞쪽이 라운지, 중앙이 선원 침실, 뒤쪽이 화물칸이죠.",
  "Steward: Stairs at the end take you back up to the open deck. Mind the swell.": "승무원: 끝에 있는 계단으로 올라가면 갑판으로 돌아가요. 너울 조심하세요.",
  "Traveler: First crossing to Jeju? The vents glow at night — you can see them from the rail.": "여행자: 제주로 가는 첫 항해예요? 분화구는 밤에 빛나요 — 난간에서도 보인답니다.",
  "Deckhand: Storm cracked a crate loose last run. Watch your step around the lashings.": "갑판원: 지난번 항해 때 폭풍에 화물 상자 하나가 풀렸어요. 결박줄 근처에선 발밑 조심하세요.",
  "The path to the Sacred Peak opens before you, where 환웅 (Hwanwoong) awaits...": "신성한 봉우리로 향하는 길이 네 앞에 열린다. 그곳엔 환웅이 기다리고 있다...",
  "With a grinding of rock, the base splits, revealing a hidden stair winding down toward 천지 (Cheonji), the sacred crater lake...": "바위가 갈리는 소리와 함께 받침이 갈라지며, 신성한 화구호 천지로 굽이쳐 내려가는 숨겨진 계단이 드러난다...",

};
