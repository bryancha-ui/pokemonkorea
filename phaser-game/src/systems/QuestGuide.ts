import Phaser from 'phaser';
import { t } from './i18n';
import { mobileSafeInsets } from './TouchControls';
import { BADGES } from '../data/Badges';
import { MAPAE } from '../data/Mapae';
import { SUMMIT_COUNTERWEIGHTS, summitWeightTrainerDefeated } from './SummitDojoPuzzle';
import {
  LANTERN_DANCE_SEQUENCE,
  LANTERN_STAGE_LANTERNS,
  lanternDanceComplete,
  lanternTrainerDefeated,
} from './LanternStagePuzzle';
import { WAVE_POOL_COURSES, waveCourseCleared } from './WavePoolGymPuzzle';
import {
  WORLD_TREE_REQUIRED_BRANCHES,
  worldTreeComplete,
  worldTreeVisitedCount,
} from './WorldTreeGymPuzzle';
import { strengthQuarryFilledCount, strengthQuarrySolved } from './StrengthQuarryPuzzle';
import { ICE_SPORT_TRIALS, iceArenaClearedCount, iceArenaComplete, iceSportCleared } from './IceArenaGymPuzzle';
import { activeStormRod, stormCliffChargedCount, stormCliffComplete } from './StormCliffGymPuzzle';

export interface QuestObjective {
  title: string;
  detail: string;
  destination: string;
  progress?: string;
}

/**
 * Full-story objective guidance, shown as a translucent notification widget and
 * in the menu's adventure log. The active objective is derived from canonical
 * story flags, so old saves recover automatically without storing duplicate
 * quest state.
 */
export function currentQuest(registry: Phaser.Data.DataManager): QuestObjective {
  if (!registry.get('starterChosen')) {
    if (registry.get('metMomAboutSong')) return {
      title: t('Choose Your First Partner', '첫 파트너를 선택하자'),
      detail: t("Head to Prof. Song's Lab and get your Pokémon!", '송 박사 연구소로 가서 포켓몬을 받자!'),
      destination: t('Professor Song’s Lab', '송 박사 연구소'),
    };
    return {
      title: t('Homecoming', '집으로 돌아가자'),
      detail: t("Phew, I'm beat… maybe I'll swing by home first?", '아 피곤하네, 잠깐 집에 들를까?'),
      destination: t('Your home in Waterfall City', '폭포시티의 우리 집'),
    };
  }

  if (registry.get('trueEndDone')) return {
    title: t('A Guardian of Two Lands', '두 지역의 수호자'),
    detail: t('The main story is complete. Explore, fill the Pokédex, breed Pokémon or challenge both Leagues again.',
      '메인 스토리를 완료했습니다. 도감을 채우고, 교배를 하거나 두 리그에 다시 도전해 보세요.'),
    destination: t('Free exploration', '자유 탐험'),
  };

  if (registry.get('partIIStarted')) {
    if (!registry.get('northReachesDone')) return {
      title: t('Win the North’s Trust', '북부의 신뢰를 얻어라'),
      detail: t('Cross the Northern Reaches and complete the border trial to open the road toward the sacred mountain.',
        '북방 변경을 건너 국경의 시련을 완수하고 성산으로 향하는 길을 여세요.'),
      destination: t('Northern Reaches', '북방 변경'),
    };
    return {
      title: t('Race to the Sacred Peak', '성스러운 봉우리로'),
      detail: t('Team Nos has entered the Onseong Mountains. Climb Rangrim Mountain and protect Hwanung.',
        '노스단이 온성산맥에 들어갔습니다. 랑림산을 올라 환웅을 지키세요.'),
      destination: t('Rangrim Mountain → Sacred Peak', '랑림산 → 성스러운 봉우리'),
    };
  }

  if (registry.get('northLeagueDone')) return {
    title: t('Return for the Victory Gathering', '승리의 모임으로 돌아가자'),
    detail: registry.get('sudoPartyDone')
      ? t('Meet Professor Song at the Ancient Altar in Capitol City for the next investigation.',
        '수도시티 고대 제단에서 송 박사를 만나 다음 조사를 시작하세요.')
      : t('Return to Professor Song’s lab. Your friends are waiting to celebrate the Northern League victory.',
        '송 박사의 연구소로 돌아가세요. 북방 리그 우승을 축하하려고 모두가 기다립니다.'),
    destination: t('Capitol City · Professor Song’s Lab', '수도시티 · 송 박사 연구소'),
  };

  if (registry.get('championDefeated')) {
    const missing = MAPAE.find(mapae => !registry.get(`mapae_${mapae.key}`));
    if (missing) {
      const held = MAPAE.filter(mapae => !!registry.get(`mapae_${mapae.key}`)).length;
      return {
        title: t('The Northern Inspectorate Circuit', '북부 어사대 순례'),
        detail: t(`Challenge ${missing.chief} in ${missing.city} and earn the next Mapae.`,
          `${missing.cityKo}의 ${missing.chiefKo}에게 도전해 다음 마패를 획득하세요.`,
          `${missing.city}で${missing.chief}に挑み、次のマペを獲得しよう。`),
        destination: t(missing.city, missing.cityKo),
        progress: t(`${held} / ${MAPAE.length} Mapae`, `마패 ${held} / ${MAPAE.length}`, `マペ ${held} / ${MAPAE.length}`),
      };
    }
    return {
      title: t('Challenge the Northern League', '북방 리그에 도전하자'),
      detail: t('All eight Mapae are assembled. Enter the Northern League and face its four masters and Taewang.',
        '마패 여덟 개를 모두 모았습니다. 북방 리그에 들어가 네 명의 고수와 태왕에게 도전하세요.'),
      destination: t('Northern League', '북방 리그'),
      progress: t('8 / 8 Mapae', '마패 8 / 8'),
    };
  }

  if (registry.get('sunriseGymDefeated')) return {
    title: t('The Onnuri Pokémon League', '온누리 포켓몬리그'),
    detail: t('Take the western Scholars’ Road from Capitol City, pass the badge scanner and challenge the League.',
      '수도시티 서쪽 학자의 길로 가서 배지 스캐너를 통과하고 리그에 도전하세요.'),
    destination: t('Capitol City → Scholars’ Road', '수도시티 → 학자의 길'),
    progress: t('8 / 8 Gym Badges', '체육관 배지 8 / 8'),
  };

  if (registry.get('seoraeGymDefeated') && !registry.get('chapter9Done')) return {
    title: t('Rescue the Guardian of Jeju', '제주의 수호자를 구하라'),
    detail: t('Return to the summit of the Jeju volcanic vents. Team Nos is moving against Nabihalmang.',
      '제주 화산 분화구 정상으로 돌아가세요. 노스단이 나비할망을 노리고 있습니다.'),
    destination: t('Jeju Vents Summit', '제주 분화구 정상'),
    progress: t('7 / 8 Gym Badges', '체육관 배지 7 / 8'),
  };

  if (registry.get('starterChosen') && !registry.get('rivalBattleDone')) return {
    title: t('First Steps with a Partner', '파트너와 함께하는 첫걸음'),
    detail: t('Leave Waterfall City by the east road and meet your rival on Route 1.',
      '폭포시티 동쪽 길로 나가 1번도로에서 라이벌을 만나세요.'),
    destination: t('Route 1', '1번도로'),
  };

  const badgeIndex = BADGES.findIndex(badge => !registry.get(badge.flag));
  if (badgeIndex >= 0) {
    const badge = BADGES[badgeIndex];
    if (badge.flag === 'gymLeaderDefeated') {
      const shadowsCleared = ['shadow-miso', 'shadow-jaemin', 'shade-yuna']
        .filter(key => registry.get(`trainerDefeated_${key}`)).length;
      const room = Math.max(1, Math.min(4, Number(registry.get('shadowGymCurrentRoom')) || 1));
      return {
        title: t('Unmask the True Shadow', '진짜 그림자를 찾아라', '真の影を見破れ'),
        detail: t(
          'Cross four illusion rooms. False shadows hide wild Pokémon; find each real trainer and reach Leader Jin.',
          '네 개의 환영 방을 통과하세요. 가짜 분신에는 야생 포켓몬이 숨어 있습니다. 진짜 트레이너들을 찾아 관장 진에게 도달하세요.',
          '四つの幻影の間を進もう。偽の影には野生のポケモンが潜む。本物のトレーナーを見つけ、ジン館長へたどり着こう。',
        ),
        destination: t(`Capitol Shadow Gym · Trial ${room}`, `소올 섀도우 체육관 · 시련 ${room}`, `ソウル・シャドージム · 試練 ${room}`),
        progress: t(`${shadowsCleared} / 3 Shadow Trainers`, `섀도우 트레이너 ${shadowsCleared} / 3`, `シャドウトレーナー ${shadowsCleared} / 3`),
      };
    }
    if (badge.flag === 'baekduGymDefeated') {
      const movable = SUMMIT_COUNTERWEIGHTS.filter(weight => !!weight.trainerKey);
      const aligned = movable.filter(weight => summitWeightTrainerDefeated(weight, key => registry.get(key))).length;
      return {
        title: t('Align the Summit Weights', '정상의 무게추를 정렬하자', '頂上の重りを整列させよう'),
        detail: t(
          'Defeat Taeguk and Nari to slide both suspended counterweights onto the center line, then cross them to Leader Byeoksan.',
          '태극과 나리에게 승리해 매달린 두 무게추를 중앙선에 정렬한 뒤, 발판을 건너 관장 벽산에게 도전하세요.',
          'テグクとナリを倒して二つの重りを中央線へそろえ、足場を渡ってビョクサン館長に挑もう。',
        ),
        destination: t('Baekdu · Summit Dojo', '설봉 · 정상 도장', 'ソルボン・頂上道場'),
        progress: t(`${aligned} / ${movable.length} Weights`, `무게추 ${aligned} / ${movable.length}`, `重り ${aligned} / ${movable.length}`),
      };
    }
    if (badge.flag === 'geumgangGymDefeated') {
      const performers = LANTERN_STAGE_LANTERNS
        .filter(lantern => lanternTrainerDefeated(lantern, key => registry.get(key))).length;
      const danceDone = lanternDanceComplete(key => registry.get(key));
      return {
        title: t('Complete the Lantern Stage', '등불 무대를 완성하자', '灯籠舞台を完成させよう'),
        detail: danceDone
          ? t('The light curtain is open. Cross the stage and challenge Leader Namsun.', '빛의 장막이 열렸습니다. 무대를 건너 관장 남순에게 도전하세요.', '光の幕が開いた。舞台を渡り、ナムスン館長に挑もう。')
          : t('Defeat the three performers, overlap their lantern beams on the lotus, then repeat the four dance steps.', '세 공연자에게 승리하고 등불의 빛을 연꽃에 겹친 뒤 네 걸음의 춤을 따라 하세요.', '三人の演者を倒し、灯籠の光を蓮へ重ねてから、四歩の舞を再現しよう。'),
        destination: t('Geumgang · Lantern Stage', '금강 · 등불 무대', 'クムガン・灯籠舞台'),
        progress: danceDone
          ? t('Final curtain raised', '마지막 장막 개방', '最後の幕が開いた')
          : registry.get('geumgangLanternsAligned')
            ? t(`Dance ${Math.min(Number(registry.get('geumgangDanceStep')) || 0, LANTERN_DANCE_SEQUENCE.length)} / ${LANTERN_DANCE_SEQUENCE.length}`, `춤 ${Math.min(Number(registry.get('geumgangDanceStep')) || 0, LANTERN_DANCE_SEQUENCE.length)} / ${LANTERN_DANCE_SEQUENCE.length}`, `舞 ${Math.min(Number(registry.get('geumgangDanceStep')) || 0, LANTERN_DANCE_SEQUENCE.length)} / ${LANTERN_DANCE_SEQUENCE.length}`)
            : t(`${performers} / 3 Performers`, `공연자 ${performers} / 3`, `演者 ${performers} / 3`),
      };
    }
    if (badge.flag === 'haeanGymDefeated') {
      const cleared = WAVE_POOL_COURSES
        .filter(course => waveCourseCleared(course, key => registry.get(key))).length;
      const trainers = ['haean-haedo', 'haean-byungchan']
        .filter(key => registry.get(`trainerDefeated_${key}`)).length;
      return {
        title: t('Ride Harang\'s Three Currents', '하랑의 세 파도를 타자', 'ハランの三つの潮流に乗ろう'),
        detail: cleared >= WAVE_POOL_COURSES.length
          ? t('All wave pools are clear. Cross the final checkpoint and challenge Leader Harang.', '모든 파도풀을 통과했습니다. 마지막 체크포인트를 건너 관장 하랑에게 도전하세요.', 'すべてのプールを突破した。最後のチェックポイントを渡り、ジムリーダー・ハランに挑もう。')
          : t('Use LEFT and RIGHT to balance on the rental surfboard. Falling triggers a wild Water Pokémon battle.', '대여 서핑보드에서 좌우 입력으로 균형을 잡으세요. 물에 빠지면 야생 물 포켓몬 배틀이 시작됩니다.', 'レンタルボード上で左右入力を使ってバランスを取ろう。落水すると野生のみずポケモンとのバトルになる。'),
        destination: t('Haean · Wave Gym', '해안 · 파도 체육관', 'ヘアン・波ジム'),
        progress: t(`${cleared} / 3 Wave Pools · ${trainers} / 2 Trainers`, `파도풀 ${cleared} / 3 · 트레이너 ${trainers} / 2`, `プール ${cleared} / 3・トレーナー ${trainers} / 2`),
      };
    }
    if (badge.flag === 'forestGymDefeated') {
      const visited = worldTreeVisitedCount(key => registry.get(key));
      const trainers = ['forest-chungha', 'forest-minho']
        .filter(key => registry.get(`trainerDefeated_${key}`)).length;
      const complete = worldTreeComplete(key => registry.get(key));
      return {
        title: t('Climb Every Bough of the World Tree', '세계수의 모든 가지를 오르자', '世界樹のすべての枝を登ろう'),
        detail: complete && trainers === 2
          ? t('The summit vines are open. Jump from a crown branch to Leader Noksaek.', '정상 덩굴이 열렸습니다. 수관 가지에서 뛰어 관장 녹색에게 도전하세요.', '頂上のツタが開いた。樹冠の枝から跳び、ジムリーダー・ノクセクに挑もう。')
          : t('Select connected branches with LEFT or RIGHT and jump with SPACE / A. Visit every branch and defeat any Trainer you find.', '좌우로 연결된 가지를 선택하고 SPACE / A로 점프하세요. 모든 가지를 방문하고 발견한 트레이너에게 승리해야 합니다.', '左右でつながった枝を選び、SPACE / Aでジャンプしよう。すべての枝を訪れ、見つけたトレーナーに勝利しよう。'),
        destination: t('Forest · World Tree Canopy', '숲 · 세계수 수관', '森・世界樹の樹冠'),
        progress: t(
          `${visited} / ${WORLD_TREE_REQUIRED_BRANCHES.length} Branches · ${trainers} / 2 Trainers`,
          `가지 ${visited} / ${WORLD_TREE_REQUIRED_BRANCHES.length} · 트레이너 ${trainers} / 2`,
          `枝 ${visited} / ${WORLD_TREE_REQUIRED_BRANCHES.length}・トレーナー ${trainers} / 2`,
        ),
      };
    }
    if (badge.flag === 'dolmoeGymDefeated' && !registry.get('dolmoeRuinsDone')) return {
      title: t('Find Leader Sandol', '관장 산돌을 찾아라'),
      detail: t('Sandol left the Gym to investigate black-coated diggers. Find him at the dolmen ruins west of Dolmoe.',
        '산돌은 검은 옷의 발굴단을 조사하러 체육관을 비웠습니다. 돌뫼 서쪽 고인돌 유적에서 찾아보세요.'),
      destination: t('Dolmoe Dolmen Ruins', '돌뫼 고인돌 유적'),
      progress: t(`${badgeIndex} / ${BADGES.length} Gym Badges`, `체육관 배지 ${badgeIndex} / ${BADGES.length}`, `ジムバッジ ${badgeIndex} / ${BADGES.length}`),
    };
    if (badge.flag === 'dolmoeGymDefeated' && !registry.get('chapter7Done')) return {
      title: t('Professor Song’s Urgent Call', '송 박사의 긴급 호출'),
      detail: t('Heal your team, then enter Professor Song’s lab in Capitol City and hear what Team Suri and Team Nos are planning.',
        '팀을 회복한 뒤 수도시티 송 박사 연구소로 들어가 수리단과 노스단의 계획을 확인하세요.'),
      destination: t('Capitol City · Professor Song’s Lab', '수도시티 · 송 박사 연구소'),
      progress: t('5 / 8 Gym Badges', '체육관 배지 5 / 8'),
    };
    if (badge.flag === 'dolmoeGymDefeated') {
      const filled = strengthQuarryFilledCount(key => registry.get(key));
      const trainers = ['dolmoe-bawoo', 'dolmoe-doran']
        .filter(key => registry.get(`trainerDefeated_${key}`)).length;
      const solved = strengthQuarrySolved(key => registry.get(key));
      return {
        title: t('Build the Rune Boulder Bridge', '문양 바위 다리를 완성하자', '紋章岩の橋を完成させよう'),
        detail: solved && trainers === 2
          ? t('The fissure is bridged. Cross to the north dais and challenge Leader Sandol.', '균열 위에 다리가 완성됐습니다. 북쪽 단상으로 건너가 관장 산돌에게 도전하세요.', '裂け目に橋が完成した。北の壇上へ渡り、ジムリーダー・サンドルに挑もう。')
          : t('Push the circle, triangle and square boulders one tile at a time into their matching holes, and defeat both stoneworkers.', '원형·삼각형·사각형 바위를 한 칸씩 밀어 같은 문양의 홈에 넣고 두 석공에게 모두 승리하세요.', '円・三角・四角の岩を1マスずつ押して同じ紋章の穴へ入れ、二人の石工に勝利しよう。'),
        destination: t('Dolmoe · Strength Quarry Gym', '돌뫼 · 괴력 채석장 체육관', 'トルメ・怪力採石場ジム'),
        progress: t(
          `${filled} / 3 Rune Boulders · ${trainers} / 2 Trainers`,
          `문양 바위 ${filled} / 3 · 트레이너 ${trainers} / 2`,
          `紋章岩 ${filled} / 3・トレーナー ${trainers} / 2`,
        ),
      };
    }
    if (badge.flag === 'seoraeGymDefeated') {
      const events = iceArenaClearedCount(key => registry.get(key));
      const coaches = ['seorae-nunsong', 'seorae-baram']
        .filter(key => registry.get(`trainerDefeated_${key}`)).length;
      const complete = iceArenaComplete(key => registry.get(key));
      const nextEvent = ICE_SPORT_TRIALS.find(trial => !iceSportCleared(trial, key => registry.get(key)));
      return {
        title: t('Master the Three Ice Sports', '세 가지 빙상 종목을 마스터하자', '三つの氷上競技を極めよう'),
        detail: complete && coaches === 2
          ? t('All result boards are lit. Cross the final gate and challenge Leader Yeona.', '모든 기록판에 불이 들어왔습니다. 마지막 관문을 지나 관장 연아에게 도전하세요.', 'すべてのリザルトボードが点灯した。最後のゲートを越え、ジムリーダー・ヨナに挑もう。')
          : t('Complete short track, speed skating and figure skating in order, defeating each rink coach between events.', '쇼트트랙, 스피드스케이팅, 피겨스케이팅을 순서대로 완주하고 종목 사이의 링크 코치들에게 승리하세요.', 'ショートトラック、スピードスケート、フィギュアを順番に完走し、各リンクコーチに勝利しよう。'),
        destination: nextEvent
          ? t(`Seorae Ice Arena · ${nextEvent.index + 1}`, `서래 빙상 경기장 · ${nextEvent.index + 1}종목`, `ソレ氷上競技場・第${nextEvent.index + 1}種目`)
          : t('Seorae Ice Arena · Final Gate', '서래 빙상 경기장 · 마지막 관문', 'ソレ氷上競技場・最終ゲート'),
        progress: t(
          `${events} / 3 Events · ${coaches} / 2 Coaches`,
          `종목 ${events} / 3 · 코치 ${coaches} / 2`,
          `種目 ${events} / 3・コーチ ${coaches} / 2`,
        ),
      };
    }
    if (badge.flag === 'sunriseGymDefeated') {
      const rods = stormCliffChargedCount(key => registry.get(key));
      const engineers = ['sunrise-seongwoo', 'sunrise-daehwi']
        .filter(key => registry.get(`trainerDefeated_${key}`)).length;
      const activeRod = activeStormRod(key => registry.get(key));
      const liftReady = stormCliffComplete(key => registry.get(key)) && engineers === 2;
      return {
        title: t('Chain the Lightning to the Summit', '낙뢰를 정상까지 연쇄 전달하자', '落雷を頂まで連鎖させよう'),
        detail: liftReady
          ? t('All rods are charged. Ride the lightning elevator and challenge Leader Beonge.', '모든 피뢰침이 충전됐습니다. 번개 승강기를 타고 관장 번개에게 도전하세요.', 'すべての避雷針が充電された。雷エレベーターでジムリーダー・ポンゲに挑もう。')
          : t('Match each rod to its receiver’s direction and height, then shelter on the insulated pad when lightning strikes.', '각 피뢰침의 방향과 높이를 수신기에 맞춘 뒤 낙뢰 순간에는 절연 발판으로 대피하세요.', '各避雷針の方向と高さを受電器に合わせ、落雷時は絶縁パッドへ避難しよう。'),
        destination: activeRod
          ? t(`Stormwatcher Cliffs · Rod ${activeRod.index + 1}`, `폭풍관측 절벽 · ${activeRod.index + 1}번 피뢰침`, `嵐見の断崖・避雷針${activeRod.index + 1}`)
          : t('Stormwatcher Cliffs · Upper Circuit', '폭풍관측 절벽 · 상층 회로', '嵐見の断崖・上層回路'),
        progress: t(
          `${rods} / 3 Rods · ${engineers} / 2 Engineers`,
          `피뢰침 ${rods} / 3 · 기술자 ${engineers} / 2`,
          `避雷針 ${rods} / 3・技師 ${engineers} / 2`,
        ),
      };
    }
    return {
      title: t(`Earn the ${badge.name}`, `${badge.city} 체육관에 도전하자`, `${badge.city}ジムのバッジを獲得しよう`),
      detail: t(`Travel to ${badge.city} and defeat ${badge.leader}.`, `${badge.city}로 가서 ${badge.leader}에게 승리하세요.`,
        `${badge.city}へ向かい、${badge.leader}に勝利しよう。`),
      destination: t(`${badge.city} Gym`, `${badge.city} 체육관`, `${badge.city}ジム`),
      progress: t(`${badgeIndex} / ${BADGES.length} Gym Badges`, `체육관 배지 ${badgeIndex} / ${BADGES.length}`, `ジムバッジ ${badgeIndex} / ${BADGES.length}`),
    };
  }

  // Reconciled badge progress normally makes this unreachable, but keeping a
  // deterministic fallback protects imported/legacy saves with unusual flags.
  return {
    title: t('Explore Onnuri', '온누리를 탐험하자'),
    detail: t('Open the Town Map and continue toward the next unvisited city.', '타운맵을 열고 아직 방문하지 않은 다음 도시로 향하세요.'),
    destination: t('Town Map', '타운맵'),
  };
}

export function currentQuestHint(registry: Phaser.Data.DataManager): string {
  const quest = currentQuest(registry);
  return `${quest.title} · ${quest.destination}${quest.progress ? `  ${quest.progress}` : ''}`;
}

/** Completed headline milestones for the menu quest log. */
export function completedQuestMilestones(registry: Phaser.Data.DataManager): string[] {
  const result: string[] = [];
  if (registry.get('starterChosen')) result.push(t('Received a first partner Pokémon', '첫 파트너 포켓몬을 받음'));
  if (registry.get('rivalBattleDone')) result.push(t('Won the first rival battle', '첫 라이벌 배틀에서 승리'));
  const badges = BADGES.filter(badge => !!registry.get(badge.flag)).length;
  if (badges) result.push(t(`Earned ${badges} of 8 Gym Badges`, `체육관 배지 ${badges}/8 획득`, `ジムバッジ ${badges}/8 獲得`));
  if (registry.get('chapter9Done')) result.push(t('Protected Nabihalmang at Jeju', '제주에서 나비할망을 지킴'));
  if (registry.get('championDefeated')) result.push(t('Became the Onnuri Champion', '온누리 챔피언 등극'));
  const mapae = MAPAE.filter(entry => !!registry.get(`mapae_${entry.key}`)).length;
  if (mapae) result.push(t(`Earned ${mapae} of 8 Northern Mapae`, `북부 마패 ${mapae}/8 획득`, `北部マペ ${mapae}/8 獲得`));
  if (registry.get('northLeagueDone')) result.push(t('Conquered the Northern League', '북방 리그 제패'));
  if (registry.get('trueEndDone')) result.push(t('Protected Hwanung and completed the journey', '환웅을 지키고 여정을 완수함'));
  return result;
}

/**
 * Mount the top-left quest guide widget onto a scene — call once in create(). It
 * is screen-fixed and renders nothing when there is no active objective. Re-derived
 * on every scene create, so returning to a scene always shows the current step.
 */
export function mountQuestHint(scene: Phaser.Scene): Phaser.GameObjects.Container | undefined {
  const hint = currentQuestHint(scene.registry);

  const padX = 11, padY = 9, badgeR = 12, gap = 10, wrap = 300;
  const textX = padX + badgeR * 2 + gap;

  const label = scene.add.text(0, 0, hint, {
    fontSize: '13px', color: '#16233b', fontStyle: 'bold',
    wordWrap: { width: wrap }, lineSpacing: 3,
  }).setOrigin(0, 0);

  const boxW = textX + Math.min(wrap, Math.ceil(label.width)) + padX;
  const boxH = Math.max(badgeR * 2 + padY * 2, Math.ceil(label.height) + padY * 2);
  label.setPosition(textX, (boxH - label.height) / 2);

  // Frosted white translucent panel.
  const panel = scene.add.graphics();
  panel.fillStyle(0xffffff, 0.72); panel.fillRoundedRect(0, 0, boxW, boxH, 9);
  panel.lineStyle(1.5, 0xffffff, 0.9); panel.strokeRoundedRect(0, 0, boxW, boxH, 9);

  // Gold "!" quest badge.
  const cx = padX + badgeR, cy = boxH / 2;
  const badge = scene.add.graphics();
  badge.fillStyle(0xffcf3a, 1); badge.fillCircle(cx, cy, badgeR);
  badge.lineStyle(1.5, 0x9a6a00, 0.75); badge.strokeCircle(cx, cy, badgeR);
  const bang = scene.add.text(cx, cy - 1, '!', {
    fontSize: '16px', color: '#5a3a00', fontStyle: 'bold',
  }).setOrigin(0.5);

  const widget = scene.add.container(0, 0, [panel, badge, bang, label]);
  widget.setScrollFactor(0).setDepth(400);
  // Anchor to the on-screen safe area so a covered mobile viewport never clips the
  // widget off the top-left corner; re-anchor when the viewport changes.
  const place = () => {
    const safe = mobileSafeInsets(scene.scale.width, scene.scale.height);
    widget.setPosition(safe.left + 12, safe.top + 12);
  };
  place();
  scene.scale.on('resize', place);
  window.addEventListener('pokemonkorea:mobile-layout', place);
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', place);
    window.removeEventListener('pokemonkorea:mobile-layout', place);
  });
  // A soft entrance so the notification "pops" when it changes.
  widget.setAlpha(0).setScale(0.96);
  scene.tweens.add({ targets: widget, alpha: 1, scale: 1, duration: 260, ease: 'Back.out' });
  return widget;
}
