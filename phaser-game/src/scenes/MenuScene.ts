import Phaser from 'phaser';
import { tr, typeName, abilityName, t, pokeName, pokeNameEn } from '../systems/i18n';
import { STARTERS, TYPE_COLORS, findForm } from '../data/StarterData';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem, PartyEntry } from '../systems/PartySystem';
import { displayMoves, buildFromEntry } from '../systems/PartyBattle';
import { TM_MOVE_DATA } from '../data/TMs';
import type { MoveData } from '../battle/Pokemon';
import { caughtOriginForDexKey, dexEntry, dexKeyFor } from '../data/Pokedex';
import { fetchPokemon, fetchPokemonSpeciesInfo, fetchPokemonAbilityInfo } from '../data/PokeAPI';
import { genderForPokemon, genderSymbol } from '../data/PokemonGender';
import { deckHideLeadPicker, deckShowLeadPicker } from '../systems/TouchControls';
import { fontScaleForScene } from '../systems/UiScale';
import { BreedingSystem, type NurseryEgg } from '../systems/BreedingSystem';

// Battle data for HM field moves, so teaching one on a full moveset can offer the
// same "which move to forget?" picker that TMs use.
const HM_MOVE_DATA: Record<string, MoveData> = {
  fly: { name: 'Fly', type: 'flying', category: 'physical', power: 90, accuracy: 95, pp: 15 },
};
import { DexTracker } from '../systems/DexTracker';
import { ITEMS, Inventory, itemDef, itemDescription, itemName, useItemOnSlot, teachHM, canLearnMove, formatMoney } from '../systems/Items';
import { TMS } from '../data/TMs';
import { BADGES, reconcileBadgeProgress } from '../data/Badges';
import { MAPAE, hasMapae, mapaeCount } from '../data/Mapae';
import { preloadRewardAssets, rewardTextureKey } from '../systems/RewardCeremony';
import { PROD_UI, roundedPanel } from '../systems/ProductionUi';
import { sfxCancel, sfxConfirm, sfxMove } from '../systems/UiSfx';
import { localizedCaughtLocation } from '../data/PokemonOrigin';
import { completedQuestMilestones, currentQuest } from '../systems/QuestGuide';
import { hasPendingEvolution } from '../systems/EvolutionSystem';

export class MenuScene extends Phaser.Scene {
  private tab: 'pokemon' | 'bag' = 'pokemon';
  private tabPokemon!: Phaser.GameObjects.Text;
  private tabBag!:     Phaser.GameObjects.Text;
  private contentContainer!: Phaser.GameObjects.Container;
  private escKey!: Phaser.Input.Keyboard.Key;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private bagScroll = 0;       // first row of the current bag page
  private bagMaxScroll = 0;    // first row of the final bag page
  private readonly BAG_PAGE_SIZE = 7;
  // The menu window grows on mobile (where the font is scaled up) so party cards
  // aren't cramped; desktop keeps the compact 780×540 panel.
  private winW = 780;
  private winH = 540;
  private mobileMenu = false;

  private get W() { return this.scale.width; }
  private get H() { return this.scale.height; }

  constructor() { super({ key: 'MenuScene' }); }

  preload() {
    preloadRewardAssets(this);
    // Load sprites for any caught Pokémon whose textures aren't cached yet
    STARTERS.forEach(s => {
      if (!this.textures.exists(s.spriteKey))
        this.load.image(s.spriteKey, s.data.spriteUrl);
    });
    const party = PartySystem.get(this.registry);
    party.forEach(entry => {
      if (entry.spriteKey && !this.textures.exists(entry.spriteKey) && entry.spriteUrl) {
        this.load.image(entry.spriteKey, entry.spriteUrl);
      }
    });
  }

  create() {
    this.scene.bringToTop();   // render above the field/route scene that launched it
    this.cameras.main.fadeIn(180);
    this.events.once('shutdown', () => deckHideLeadPicker());

    // Retroactive: any trainer who already has a starter owns a Pokédex
    if (this.registry.get('starterChosen') && !this.registry.get('hasPokedex')) {
      DexTracker.grantPokedex(this.registry);
    }
    DexTracker.syncCaughtFromParty(this.registry);

    // Retroactive: champions who earned Fly before it was a Bag item get the HM now.
    if (this.registry.get('hasFlyHM') && Inventory.count(this.registry, 'hm_fly') === 0) {
      Inventory.add(this.registry, 'hm_fly', 1);
    }
    // Retroactive: any gym already beaten grants its TM (they weren't Bag items before).
    for (const tm of TMS) {
      if (this.registry.get(tm.badgeFlag) && Inventory.count(this.registry, tm.key) === 0) {
        Inventory.add(this.registry, tm.key, 1);
      }
    }

    // On mobile the on-canvas font is scaled up, so grow the window to fit; the
    // chrome (header/tabs/buttons) is then positioned relative to the window edges.
    this.mobileMenu = fontScaleForScene(this) > 1;
    this.winW = this.mobileMenu ? Math.min(this.W - 16, 1248) : Math.min(this.W - 36, 980);
    this.winH = this.mobileMenu ? Math.min(this.H - 12, 704) : Math.min(this.H - 24, 620);
    const winTop = this.H / 2 - this.winH / 2;
    const winLeft = this.W / 2 - this.winW / 2;
    const winRight = this.W / 2 + this.winW / 2;

    // Cinematic glass overlay: the world remains visible behind a deep blue,
    // production-style panel instead of being replaced by an opaque pause box.
    this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x020812, 0.72);
    const atmosphere = this.add.graphics();
    atmosphere.fillGradientStyle(0x0d4971, 0x081a32, 0x07101f, 0x112942, 0.32, 0.18, 0.35, 0.24);
    atmosphere.fillRect(0, 0, this.W, this.H);
    roundedPanel(this, winLeft, winTop, this.winW, this.winH, {
      fill: PROD_UI.ink, alpha: 0.94, stroke: 0x5e8bb4, radius: 22,
    });
    this.add.rectangle(winLeft + 4, this.H / 2, 7, this.winH - 24, PROD_UI.cyan, 0.9);

    // ── Header ──────────────────────────────────────────────────────────────
    this.add.text(this.W / 2, winTop + 24, t('MAIN MENU', '메인 메뉴'), {
      fontSize: '19px', color: '#f6fbff', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5);
    this.add.text(this.W / 2, winTop + 44, t('TRAINER CONTROL CENTER', '트레이너 컨트롤 센터'), {
      fontSize: '8px', color: '#70cce9', letterSpacing: 2,
    }).setOrigin(0.5);

    // ── Tab buttons ──────────────────────────────────────────────────────────
    const tabY = winTop + (this.mobileMenu ? 120 : 70);
    this.tabPokemon = this.add.text(this.W / 2 - 102, tabY, t('◈  POKÉMON', '◈  포켓몬'), {
      fontSize: '14px', color: '#ffffff', backgroundColor: '#267f9f',
      padding: { x: 20, y: 9 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.switchTab('pokemon'));

    this.tabBag = this.add.text(this.W / 2 + 102, tabY, t('▣  BAG', '▣  가방'), {
      fontSize: '14px', color: '#9fb1c3', backgroundColor: '#16283c',
      padding: { x: 28, y: 9 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.switchTab('bag'));

    // ── Save button ──────────────────────────────────────────────────────────
    let refreshPlayTime = () => {};
    const saveBtn = this.add.text(winLeft + 58, winTop + 28, t('💾 SAVE', '💾 저장'), {
      fontSize: '12px', color: '#e9fff0', backgroundColor: '#1a5237',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    saveBtn.on('pointerdown', () => {
      // Save into the scene the player is ACTUALLY in right now, read live from the
      // running gameplay scene (it has px/py). lastScene/lastX/lastY go stale for any
      // scene that doesn't autosave, which warped resumes back to Waterfall City.
      const active = this.game.scene.getScenes(true).find(s =>
        s.scene.key !== 'MenuScene' && typeof (s as unknown as { px?: number }).px === 'number',
      ) as unknown as { scene: { key: string }; px: number; py: number } | undefined;
      const scene = active?.scene.key ?? (this.registry.get('lastScene') as string) ?? 'WorldMapScene';
      const px = active?.px ?? (this.registry.get('lastX') as number) ?? (this.registry.get('returnX') as number) ?? 22 * 32 + 16;
      const py = active?.py ?? (this.registry.get('lastY') as number) ?? (this.registry.get('returnY') as number) ?? 24 * 32 + 16;
      const ok = SaveManager.save(this.registry, px, py, scene, 'manual');
      refreshPlayTime();
      if (ok) saveBtn.setText(tr('💾 SAVED!')).setColor('#aaffaa');
      else    saveBtn.setText(tr('⚠ SAVE FAILED')).setColor('#ff8888');
      this.time.delayedCall(1800, () => saveBtn.setText(t('💾 SAVE', '💾 저장')).setColor('#ffe44e'));
    });

    const rankBtn = this.add.text(winLeft + 146, winTop + 28, t('◆ RANK', '◆ 순위'), {
      fontSize: '12px', color: '#e7e4ff', backgroundColor: '#393363', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    rankBtn.on('pointerdown', () => {
      this.scene.pause();
      this.scene.launch('LeaderboardScene', { returnTo: 'MenuScene' });
    });

    // Auto-save is enabled by default to preserve the game's existing safety.
    // It can be disabled without affecting the explicit SAVE button above.
    const autoSaveBtn = this.add.text(winLeft + 268, winTop + 28, '', {
      fontSize: '12px', color: '#aaffc2', backgroundColor: '#17452a', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    let playTimeText: Phaser.GameObjects.Text | undefined;
    const refreshAutoSaveButton = () => {
      const enabled = SaveManager.isAutoSaveEnabled();
      autoSaveBtn
        .setText(t(`AUTO-SAVE: ${enabled ? 'ON' : 'OFF'}`, `자동저장: ${enabled ? '켜짐' : '꺼짐'}`))
        .setColor(enabled ? '#aaffc2' : '#ffb5b5')
        .setBackgroundColor(enabled ? '#17452a' : '#52212a');
      if (this.mobileMenu && playTimeText) {
        playTimeText.setPosition(autoSaveBtn.x + autoSaveBtn.displayWidth + 14, autoSaveBtn.y);
      }
    };
    autoSaveBtn.on('pointerdown', () => {
      SaveManager.toggleAutoSave();
      refreshAutoSaveButton();
    });

    playTimeText = this.add.text(0, 0, '', {
      fontSize: '10px', color: '#a9c8dd', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const formatPlayTime = (milliseconds: number) => {
      const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    refreshPlayTime = () => playTimeText!.setText(
      t(`PLAY TIME  ${formatPlayTime(SaveManager.playTimeMs(this.registry))}`,
        `플레이 시간  ${formatPlayTime(SaveManager.playTimeMs(this.registry))}`),
    );

    if (this.mobileMenu) {
      // Two compact rows prevent globally enlarged mobile fonts from colliding:
      // SAVE/RANK above, AUTO-SAVE/play time below.
      saveBtn.setOrigin(0, 0.5).setPosition(winLeft + 18, winTop + 25);
      rankBtn.setOrigin(0, 0.5).setPosition(saveBtn.x + saveBtn.displayWidth + 12, saveBtn.y);
      autoSaveBtn.setOrigin(0, 0.5).setPosition(winLeft + 18, winTop + 67);
    } else {
      playTimeText.setOrigin(1, 0.5).setPosition(winRight - 150, winTop + 28);
    }
    refreshAutoSaveButton();
    refreshPlayTime();
    this.time.addEvent({ delay: 1000, loop: true, callback: refreshPlayTime });

    // ── Close button ─────────────────────────────────────────────────────────
    this.add.text(winRight - 20, winTop + 28, t('B  RETURN', 'B  돌아가기'), {
      fontSize: '12px', color: '#d8e6f3', backgroundColor: '#15283c', padding: { x: 10, y: 6 },
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setData('uiCancel', true)
      .on('pointerdown', () => this.closeMenu(false))
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#ffffff'); })
      .on('pointerout',  function(this: Phaser.GameObjects.Text) { this.setColor('#aaaaaa'); });

    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => this.closeMenu());
    this.upKey   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    // One consistent audio layer covers every interactive menu row, tab and
    // picker—including dynamically created item buttons.
    this.input.on('gameobjectover', (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      if (object.getData('uiHovering')) return;
      object.setData('uiHovering', true);
      sfxMove(this);
    });
    this.input.on('gameobjectout', (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) =>
      object.setData('uiHovering', false));
    this.input.on('gameobjectdown', (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      if (object.getData('uiCancel')) sfxCancel(this);
      else sfxConfirm(this);
    });
    // Mouse-wheel paging for the bag list. Moving a whole page makes the
    // behaviour predictable on trackpads and prevents items being stranded
    // between overlapping seven-row windows.
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.tab === 'bag') this.scrollBag(dy > 0 ? this.BAG_PAGE_SIZE : -this.BAG_PAGE_SIZE);
    });

    this.bagScroll = 0;
    this.contentContainer = this.add.container(0, 0);
    this.renderPokemonTab();
    void this.hydratePartyMetadata();
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeMenu();
    if (this.tab === 'bag') {
      if (Phaser.Input.Keyboard.JustDown(this.downKey)) this.scrollBag(this.BAG_PAGE_SIZE);
      if (Phaser.Input.Keyboard.JustDown(this.upKey))   this.scrollBag(-this.BAG_PAGE_SIZE);
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  private switchTab(tab: 'pokemon' | 'bag') {
    if (tab === 'bag') deckHideLeadPicker();
    if (tab === 'bag' && this.tab !== 'bag') this.bagScroll = 0;   // fresh bag view starts at the top
    this.tab = tab;
    this.tabPokemon.setColor(tab === 'pokemon' ? '#ffffff' : '#9fb1c3')
      .setBackgroundColor(tab === 'pokemon' ? '#267f9f' : '#16283c');
    this.tabBag.setColor(tab === 'bag' ? '#ffffff' : '#9fb1c3')
      .setBackgroundColor(tab === 'bag' ? '#267f9f' : '#16283c');
    this.contentContainer.destroy(true);
    this.contentContainer = this.add.container(0, 0);
    if (tab === 'pokemon') this.renderPokemonTab();
    else                   this.renderBagTab();
  }

  // ── Pokémon tab — shows ALL party members ────────────────────────────────

  private renderPokemonTab() {
    // Reading nursery state first also migrates older saves that carried an Egg
    // alongside six Pokémon. The overflow Pokémon is safely moved to the PC.
    const egg = BreedingSystem.getState(this.registry).carriedEgg;
    const party = PartySystem.get(this.registry);
    const occupiedCount = party.length + (egg ? 1 : 0);
    const cx    = this.W / 2;
    const cy    = this.H / 2;

    if (occupiedCount === 0) {
      deckHideLeadPicker();
      const t = this.add.text(cx, cy + 20,
        tr("You have no Pokémon yet.\nVisit Prof. Song's Lab to choose your starter!"),
        { fontSize: '14px', color: '#cccccc', align: 'center', lineSpacing: 8 },
      ).setOrigin(0.5);
      this.contentContainer.add(t);
      return;
    }

    // ── Mobile: single-column, roomy cards sized to fit the enlarged font ──
    if (this.mobileMenu) {
      const winTop = cy - this.winH / 2, winBottom = cy + this.winH / 2;
      const gridTop = winTop + 160, gridBottom = winBottom - 32;
      const gap = 4;
      const n = Math.max(1, occupiedCount);
      const cardH = Math.min(152, (gridBottom - gridTop - gap * (n - 1)) / n);
      const cardW = this.winW - 40;
      party.forEach((entry, i) => {
        const y = gridTop + cardH / 2 + i * (cardH + gap);
        this.drawPartyCardMobile(entry, cx, y, cardW, cardH, i === 0, i);
      });
      if (egg) {
        const y = gridTop + cardH / 2 + party.length * (cardH + gap);
        this.drawEggCardMobile(egg, cx, y, cardW, cardH);
      }
      deckShowLeadPicker(party.map((entry, index) => ({
        name: this.partyName(entry), level: entry.level,
        hp: entry.hp, maxHp: entry.maxHp, isLead: index === 0,
      })), index => this.setPartyLead(index));
      this.contentContainer.add(this.add.text(cx, winBottom - 18,
        t('Tap a Pokémon for details · SET LEAD changes your first battler', '포켓몬을 누르면 상세 정보 · 선두 변경으로 첫 포켓몬 지정'),
        { fontSize: '11px', color: '#8899bb', align: 'center', wordWrap: { width: cardW } }).setOrigin(0.5));
      return;
    }

    // ── Layout: 2-column card grid ────────────────────────────────────────
    const cardW = 348, cardH = 90;
    const gridX = [cx - 194, cx + 194];   // left / right column centers
    const startY = cy - 165;
    const rowH   = 100;

    party.forEach((entry, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x   = gridX[col];
      const y   = startY + row * rowH;

      this.drawPartyCard(entry, x, y, cardW, cardH, i === 0, i);
    });
    if (egg) {
      const index = party.length;
      const col = index % 2;
      const row = Math.floor(index / 2);
      this.drawEggCard(egg, gridX[col], startY + row * rowH, cardW, cardH);
    }

    // The Phaser canvas is heavily scaled down on phones, so expose the same
    // action as large native-size buttons on the mobile lower control screen.
    deckShowLeadPicker(party.map((entry, index) => ({
      name: this.partyName(entry), level: entry.level,
      hp: entry.hp, maxHp: entry.maxHp, isLead: index === 0,
    })), index => this.setPartyLead(index));

    // Hint
    this.contentContainer.add(this.add.text(cx, cy + 196,
      t('Tap a Pokémon for details. Use SET LEAD to change your first battler.', '포켓몬을 누르면 상세 정보를 볼 수 있습니다. 선두 변경 버튼으로 첫 포켓몬을 정하세요.'),
      { fontSize: '11px', color: '#8899bb' }).setOrigin(0.5));

    // Empty slots
    for (let i = occupiedCount; i < 6; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x   = gridX[col];
      const y   = startY + row * rowH;
      const bg  = this.add.rectangle(x, y, cardW, cardH, 0x0b1725, 0.72)
        .setStrokeStyle(1, 0x2b4258, 0.68);
      const lbl = this.add.text(x, y, tr('— empty —'), { fontSize: '12px', color: '#334466' })
        .setOrigin(0.5);
      this.contentContainer.add([bg, lbl]);
    }
  }

  /** A carried Egg is deliberately not a PartyEntry: battles must never select
   *  it. It still appears as the final occupied slot in the Pokémon menu. */
  private drawEggCard(egg: NurseryEgg, x: number, y: number, w: number, h: number): void {
    const left = x - w / 2;
    const total = Math.max(1, egg.totalSteps);
    const remaining = Phaser.Math.Clamp(egg.stepsRemaining, 0, total);
    const progress = Phaser.Math.Clamp((total - remaining) / total, 0, 1);
    const bg = this.add.rectangle(x, y, w, h, 0x29213b, 1)
      .setStrokeStyle(2, 0xf1d58a);
    const icon = this.add.text(left + 42, y - 2, '🥚', { fontSize: '48px' }).setOrigin(0.5);
    const name = this.add.text(left + 78, y - 31, t('Pokémon Egg', '포켓몬의 알'), {
      fontSize: '15px', color: '#fff2bd', fontStyle: 'bold',
    });
    const remainingText = this.add.text(left + 78, y - 8,
      t(`${remaining} steps until hatching`, `부화까지 ${remaining}걸음`),
      { fontSize: '12px', color: '#d9c9ef' });
    const barX = left + 78;
    const barW = w - 98;
    const track = this.add.rectangle(barX + barW / 2, y + 18, barW, 10, 0x171327);
    const fill = this.add.rectangle(barX, y + 18, barW * progress, 10, 0xe7bf67).setOrigin(0, 0.5);
    const pct = this.add.text(left + w - 10, y + 27, `${Math.floor(progress * 100)}%`, {
      fontSize: '9px', color: '#bbaed0',
    }).setOrigin(1, 0);
    this.contentContainer.add([bg, icon, name, remainingText, track, fill, pct]);
  }

  private drawPartyCard(entry: PartyEntry, x: number, y: number, w: number, h: number, isLead: boolean, index = 0) {
    // The card opens a separate full status window. Lead selection remains a
    // small, explicit button so opening details never silently reorders party.
    const shadow = this.add.rectangle(x + 4, y + 5, w, h, 0x000000, 0.26);
    this.contentContainer.add(shadow);
    const bg = this.add.rectangle(x, y, w, h, isLead ? 0x203f51 : 0x14273a, 0.98)
      .setStrokeStyle(isLead ? 2 : 1, isLead ? 0xffdc5e : 0x416b8f)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setStrokeStyle(2, isLead ? 0xffe44e : 0x77aaff))
      .on('pointerout',  () => bg.setStrokeStyle(isLead ? 2 : 1, isLead ? 0xffe44e : 0x3355aa))
      .on('pointerdown', () => this.showPokemonDetails(index));
    this.contentContainer.add(bg);
    const accent = TYPE_COLORS[entry.type1 as keyof typeof TYPE_COLORS] ?? PROD_UI.cyan;
    this.contentContainer.add(this.add.rectangle(x - w / 2 + 4, y, 7, h - 12, accent, 0.95));
    // Lead badge
    const tag = this.add.text(x + w / 2 - 8, y + h / 2 - 8,
      isLead ? t('★ LEAD', '★ 선두') : t('SET LEAD', '선두 변경'),
      { fontSize: isLead ? '10px' : '11px', color: isLead ? '#ffe44e' : '#ffffff',
        backgroundColor: isLead ? undefined : '#315a9a', padding: { x: isLead ? 5 : 10, y: isLead ? 3 : 7 } }).setOrigin(1, 1);
    if (!isLead) tag.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setPartyLead(index));
    this.contentContainer.add(tag);

    const lx = x - w / 2 + 8;   // left edge

    // Sprite (if texture cached in this scene, show it; otherwise type square)
    const sprKey = entry.spriteKey;
    if (this.textures.exists(sprKey)) {
      const halo = this.add.circle(x - w / 2 + 40, y, 35, accent, 0.16).setStrokeStyle(1, accent, 0.45);
      this.contentContainer.add(halo);
      const img = this.add.image(x - w / 2 + 40, y, sprKey);
      const tex = this.textures.get(sprKey).getSourceImage();
      const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
      img.setScale(Math.min(70, 70) / dim);
      this.contentContainer.add(img);
    } else {
      // Coloured square based on type
      const typeCol = TYPE_COLORS[entry.type1 as keyof typeof TYPE_COLORS] ?? 0x555577;
      const sq = this.add.circle(x - w / 2 + 40, y, 31, typeCol, 0.35)
        .setStrokeStyle(1, typeCol);
      const tl = this.add.text(x - w / 2 + 40, y, typeName(entry.type1).slice(0, 1),
        { fontSize: '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      this.contentContainer.add([sq, tl]);
    }

    // Name + level
    const name = this.add.text(lx + 72, y - 28, this.partyName(entry), {
      fontSize: '15px', color: isLead ? '#ffe44e' : '#ffffff', fontStyle: 'bold',
    });
    const lv = this.add.text(x + w / 2 - 8, y - 28, `Lv.${entry.level}`,
      { fontSize: '13px', color: '#aaccff' }).setOrigin(1, 0);
    this.contentContainer.add([name, lv]);

    // Types
    const types = [entry.type1, entry.type2].filter(Boolean) as string[];
    types.forEach((t, ti) => {
      const pill = this.add.rectangle(lx + 80 + ti * 56, y - 6, 50, 14,
        TYPE_COLORS[t as keyof typeof TYPE_COLORS] ?? 0x334466, 1);
      const tTxt = this.add.text(lx + 80 + ti * 56, y - 6, typeName(t),
        { fontSize: '8px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
      this.contentContainer.add([pill, tTxt]);
    });

    // HP bar
    const ratio = Math.max(0, entry.hp / entry.maxHp);
    const barW  = w - 90;
    const barColor = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xddcc00 : 0xcc4444;
    const hpTrack  = this.add.rectangle(lx + 72 + barW / 2, y + 16, barW, 8, 0x222244);
    const hpFill   = this.add.rectangle(lx + 72, y + 16, Math.max(0, barW * ratio), 8, barColor).setOrigin(0, 0.5);
    const hpTxt    = this.add.text(x + w / 2 - 8, y + 11, `${entry.hp}/${entry.maxHp}`,
      { fontSize: '10px', color: '#aaaaaa' }).setOrigin(1, 0);
    this.contentContainer.add([hpTrack, hpFill, hpTxt]);

    // Moves (compact) — computed from the current level/form so newly-learned
    // moves show up as the Pokémon grows, not just its capture-time moves.
    const moveSummary = displayMoves(entry).slice(0, 2).map(m => tr(m)).join('  ·  ');
    if (moveSummary) {
      const mt = this.add.text(lx + 72, y + 28, moveSummary,
        { fontSize: '10px', color: '#7788bb' });
      this.contentContainer.add(mt);
    }

    // Six battle stats at the current level. These are the exact values used
    // by physical/special damage and turn-order calculations.
    const mon = buildFromEntry(entry);
    const statLine = t(
      `HP ${mon.maxHp}  Atk ${mon.atk}  Def ${mon.def}  SpA ${mon.spAtk}  SpD ${mon.spDef}  Spe ${mon.spd}`,
      `체력 ${mon.maxHp}  공격 ${mon.atk}  방어 ${mon.def}  특공 ${mon.spAtk}  특방 ${mon.spDef}  스피드 ${mon.spd}`,
    );
    this.contentContainer.add(this.add.text(lx + 72, y + 40, statLine, {
      fontSize: '7px', color: '#9fb6d8',
    }));
  }

  /** Roomy single-column party card for mobile: only essentials (sprite, name,
   *  Lv, HP, and types when there's height), so the enlarged font never spills.
   *  Full stats/moves live in the tap-to-open detail view; lead is set on the deck. */
  private drawPartyCardMobile(entry: PartyEntry, x: number, y: number, w: number, h: number, isLead: boolean, index = 0) {
    const left = x - w / 2, right = x + w / 2, top = y - h / 2, bottom = y + h / 2;
    const pad = 16;
    const shadow = this.add.rectangle(x + 5, y + 6, w, h, 0x000000, 0.27);
    this.contentContainer.add(shadow);
    const bg = this.add.rectangle(x, y, w, h, isLead ? 0x203f51 : 0x14273a, 0.98)
      .setStrokeStyle(isLead ? 3 : 1, isLead ? 0xffdc5e : 0x416b8f)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setStrokeStyle(3, isLead ? 0xffe44e : 0x77aaff))
      .on('pointerout',  () => bg.setStrokeStyle(isLead ? 3 : 1, isLead ? 0xffe44e : 0x3355aa))
      .on('pointerdown', () => this.showPokemonDetails(index));
    this.contentContainer.add(bg);
    const accent = TYPE_COLORS[entry.type1 as keyof typeof TYPE_COLORS] ?? PROD_UI.cyan;
    this.contentContainer.add(this.add.rectangle(left + 5, y, 9, h - 14, accent, 0.95));

    // Sprite (left) — or a type-coloured square if its texture isn't cached.
    const sprSize = h * 0.74;
    const sprX = left + h * 0.54;
    if (this.textures.exists(entry.spriteKey)) {
      this.contentContainer.add(this.add.circle(sprX, y, sprSize * 0.48, accent, 0.14)
        .setStrokeStyle(1, accent, 0.5));
      const img = this.add.image(sprX, y, entry.spriteKey);
      const tex = this.textures.get(entry.spriteKey).getSourceImage();
      const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
      img.setScale(sprSize / dim);
      this.contentContainer.add(img);
    } else {
      const typeCol = TYPE_COLORS[entry.type1 as keyof typeof TYPE_COLORS] ?? 0x555577;
      this.contentContainer.add(this.add.rectangle(sprX, y, sprSize, sprSize, typeCol, 0.5).setStrokeStyle(1, typeCol));
    }

    const lx = left + h + 14;
    // Row 1: name (★ marks the lead) + level, well apart across the wide card.
    this.contentContainer.add(this.add.text(lx, top + 12, (isLead ? '★ ' : '') + this.partyName(entry), {
      fontSize: '18px', color: isLead ? '#ffe44e' : '#ffffff', fontStyle: 'bold',
    }));
    this.contentContainer.add(this.add.text(right - pad, top + 12, `Lv.${entry.level}`,
      { fontSize: '15px', color: '#aaccff' }).setOrigin(1, 0));

    // Bottom row: HP bar + HP text.
    const ratio = Math.max(0, entry.hp / entry.maxHp);
    const hpY = bottom - 24;
    const barW = Math.max(60, (right - 160) - lx);
    const barColor = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xddcc00 : 0xcc4444;
    this.contentContainer.add(this.add.rectangle(lx + barW / 2, hpY, barW, 12, 0x222244));
    this.contentContainer.add(this.add.rectangle(lx, hpY, Math.max(0, barW * ratio), 12, barColor).setOrigin(0, 0.5));
    this.contentContainer.add(this.add.text(right - pad, hpY, `${entry.hp}/${entry.maxHp}`,
      { fontSize: '12px', color: '#cfe0ff' }).setOrigin(1, 0.5));

    // Type pills on the middle line — only when the card is tall enough to spare it.
    if (h >= 112) {
      const midY = (top + 12 + hpY) / 2 + 6;
      ([entry.type1, entry.type2].filter(Boolean) as string[]).forEach((tp, ti) => {
        const px = lx + 6 + ti * 118;
        const col = TYPE_COLORS[tp as keyof typeof TYPE_COLORS] ?? 0x334466;
        this.contentContainer.add(this.add.rectangle(px + 52, midY, 104, 30, col, 1).setOrigin(0.5));
        this.contentContainer.add(this.add.text(px + 52, midY, typeName(tp),
          { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
      });
    }
  }

  private drawEggCardMobile(egg: NurseryEgg, x: number, y: number, w: number, h: number): void {
    const left = x - w / 2, right = x + w / 2, top = y - h / 2, bottom = y + h / 2;
    const total = Math.max(1, egg.totalSteps);
    const remaining = Phaser.Math.Clamp(egg.stepsRemaining, 0, total);
    const progress = Phaser.Math.Clamp((total - remaining) / total, 0, 1);
    const bg = this.add.rectangle(x, y, w, h, 0x29213b, 1).setStrokeStyle(3, 0xf1d58a);
    const icon = this.add.text(left + h * 0.5, y, '🥚', {
      fontSize: `${Math.max(38, Math.min(68, h * 0.48))}px`,
    }).setOrigin(0.5);
    const contentX = left + h + 12;
    const name = this.add.text(contentX, top + 12, t('Pokémon Egg', '포켓몬의 알'), {
      fontSize: '18px', color: '#fff2bd', fontStyle: 'bold',
    });
    const remainingText = this.add.text(right - 16, top + 14,
      t(`${remaining} steps left`, `${remaining}걸음 남음`),
      { fontSize: '14px', color: '#d9c9ef' }).setOrigin(1, 0);
    const barY = bottom - 25;
    const barW = Math.max(80, right - 16 - contentX);
    const track = this.add.rectangle(contentX + barW / 2, barY, barW, 13, 0x171327);
    const fill = this.add.rectangle(contentX, barY, barW * progress, 13, 0xe7bf67).setOrigin(0, 0.5);
    this.contentContainer.add([bg, icon, name, remainingText, track, fill]);
    if (h >= 112) {
      this.contentContainer.add(this.add.text(contentX, barY - 27,
        t('Walk together to hatch it', '함께 걸으면 알이 부화합니다'),
        { fontSize: '12px', color: '#a89bbc' }));
    }
  }

  private partyName(entry: PartyEntry): string {
    const key = dexKeyFor(entry.spriteKey);
    const korean = entry.nameKo ?? pokeName(key, pokeNameEn(entry.name));
    const japanese = entry.nameJa ?? pokeName(key, pokeNameEn(entry.name));
    const english = entry.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return t(english, korean, japanese);
  }

  /** Shared by the on-canvas button and the large mobile lower-screen picker. */
  private setPartyLead(index: number): void {
    const party = PartySystem.get(this.registry);
    const entry = party[index];
    if (!entry || index === 0) return;
    const name = this.partyName(entry);
    PartySystem.setLead(this.registry, index);
    this.showToast(t(`${name} is now your lead!`, `${name}을(를) 선두로 지정했습니다!`));
    this.switchTab('pokemon');
  }

  /** Enrich old saves without requiring the player to recapture anything. The
   * official Korean name lives on PokeAPI's species record, while battle data
   * supplies the primary ability. Failures are harmless when playing offline. */
  private async hydratePartyMetadata(): Promise<void> {
    const party = PartySystem.get(this.registry);
    let changed = false;
    await Promise.all(party.map(async entry => {
      const key = dexKeyFor(entry.spriteKey);
      const local = dexEntry(key);
      if (!entry.ability) {
        const ability = findForm(entry.spriteKey)?.ability ?? local?.ability;
        if (ability) { entry.ability = ability; changed = true; }
      }
      if (!entry.caughtAt || /^Evolve\b/i.test(entry.caughtAt)) {
        const inferredOrigin = caughtOriginForDexKey(key);
        if (inferredOrigin) { entry.caughtAt = inferredOrigin; changed = true; }
      }

      const officialId = key.match(/^api-(\d+)$/)?.[1];
      if (!officialId) return;
      if (!entry.ability) try {
        const battle = await fetchPokemon(Number(officialId));
        if (battle.ability) { entry.ability = battle.ability; changed = true; }
      } catch { /* offline: retain the local dictionary / English fallback */ }
      if (!entry.nameKo || !entry.nameJa) try {
        const species = await fetchPokemonSpeciesInfo(Number(officialId));
        if (species.nameKo) { entry.nameKo = species.nameKo; changed = true; }
        if (species.nameJa) { entry.nameJa = species.nameJa; changed = true; }
      } catch { /* offline: retain the local dictionary / English fallback */ }

      if (entry.ability && (!entry.abilityKo || !entry.abilityJa)) {
        try {
          const localized = await fetchPokemonAbilityInfo(entry.ability);
          if (localized.nameKo) { entry.abilityKo = localized.nameKo; changed = true; }
          if (localized.nameJa) { entry.abilityJa = localized.nameJa; changed = true; }
        } catch { /* local ability dictionary remains available offline */ }
      }
    }));

    if (!changed) return;
    PartySystem.set(this.registry, party);
    if (this.scene.isActive() && this.tab === 'pokemon') this.switchTab('pokemon');
  }

  private showPokemonDetails(index: number) {
    const entry = PartySystem.get(this.registry)[index];
    if (!entry) return;
    const mon = buildFromEntry(entry);
    const key = dexKeyFor(entry.spriteKey);
    const dex = dexEntry(key);
    if (this.mobileMenu) { this.showPokemonDetailsMobile(entry, mon, key, dex, index); return; }
    const cx = this.W / 2, cy = this.H / 2;
    const modalW = Math.min(this.W - 42, 1180);
    const modalH = Math.min(this.H - 34, 660);
    const left = cx - modalW / 2, top = cy - modalH / 2;
    const accent = TYPE_COLORS[entry.type1 as keyof typeof TYPE_COLORS] ?? PROD_UI.cyan;
    const overlay = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(cx, cy, this.W, this.H, 0x02060d, 0.88).setInteractive();
    overlay.add(dim);
    overlay.add(roundedPanel(this, left, top, modalW, modalH, {
      fill: 0x091626, alpha: 0.995, stroke: accent, radius: 22,
    }));
    const blocker = this.add.rectangle(cx, cy, modalW, modalH, 0xffffff, 0.001).setInteractive();
    overlay.add(blocker);

    // Type-coloured production header, inspired by the attached status screen.
    overlay.add(this.add.rectangle(cx, top + 31, modalW - 4, 58, accent, 0.88));
    overlay.add(this.add.rectangle(cx, top + 59, modalW - 4, 4, 0xffffff, 0.13));
    overlay.add(this.add.text(left + 24, top + 18, t('POKÉMON STATUS', '포켓몬 스테이터스'), {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold', letterSpacing: 2,
    }));

    const gender = genderForPokemon({
      name: entry.name, key: entry.spriteKey, gender: entry.gender,
      id: Number(key.match(/^api-(\d+)$/)?.[1]) || undefined,
    }, entry.breedingId ?? `party-${index}`);
    const symbol = genderSymbol(gender);
    const genderColor = gender === 'male' ? '#6fb5ff' : gender === 'female' ? '#ff91c8' : '#b8bfd0';
    const ability = entry.ability ?? findForm(entry.spriteKey)?.ability ?? dex?.ability ?? t('Unknown', '알 수 없음');
    const heldItemDefinition = entry.heldItem ? itemDef(entry.heldItem) : undefined;
    const heldItemName = heldItemDefinition ? itemName(heldItemDefinition) : entry.heldItem ?? t('None', '없음');
    const storedOrigin = entry.caughtAt && !/^Evolve\b/i.test(entry.caughtAt) ? entry.caughtAt : undefined;
    const origin = storedOrigin ?? caughtOriginForDexKey(key)
      ?? (STARTERS.some(s => s.spriteKey === entry.spriteKey) ? "Prof. Song's Lab" : 'Unknown location');
    const statusNames: Record<string, string> = {
      none: t('Healthy', '정상'), psn: t('Poisoned', '독'), tox: t('Badly poisoned', '맹독', 'もうどく'), par: t('Paralyzed', '마비'),
      brn: t('Burned', '화상'), frz: t('Frozen', '얼음'), slp: t('Asleep', '잠듦'),
    };

    // Left rail: all six party members remain one-click accessible.
    const party = PartySystem.get(this.registry);
    const railX = left + 50;
    const railTop = top + 82;
    const railGap = 7;
    const railH = (modalH - 116 - railGap * 5) / 6;
    party.forEach((member, partyIndex) => {
      const selected = partyIndex === index;
      const y = railTop + railH / 2 + partyIndex * (railH + railGap);
      const color = TYPE_COLORS[member.type1 as keyof typeof TYPE_COLORS] ?? 0x557790;
      const card = this.add.rectangle(railX, y, 72, railH, selected ? accent : 0x15283a, selected ? 0.94 : 0.76)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xffffff : color, selected ? 0.9 : 0.55)
        .setInteractive({ useHandCursor: true });
      overlay.add(card);
      if (this.textures.exists(member.spriteKey)) {
        const image = this.add.image(railX, y - 5, member.spriteKey);
        const source = this.textures.get(member.spriteKey).getSourceImage();
        image.setScale(Math.min(48, railH * 0.62) / Math.max(Number(source.width) || 1, Number(source.height) || 1));
        overlay.add(image);
      }
      overlay.add(this.add.text(railX, y + railH / 2 - 12, `Lv.${member.level}`, {
        fontSize: '8px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5));
      card.on('pointerdown', () => {
        if (partyIndex === index) return;
        overlay.destroy(true);
        this.showPokemonDetails(partyIndex);
      });
    });

    const contentLeft = left + 100;
    const splitX = left + Math.round(modalW * 0.50);
    const identityY = top + 79;
    overlay.add(this.add.text(contentLeft, identityY, this.partyName(entry), {
      fontSize: '23px', color: '#ffffff', fontStyle: 'bold',
    }));
    overlay.add(this.add.text(splitX - 22, identityY + 3, `Lv.${entry.level}`, {
      fontSize: '16px', color: '#ffe98c', fontStyle: 'bold',
    }).setOrigin(1, 0));
    overlay.add(this.add.text(contentLeft + 235, identityY + 3, symbol, {
      fontSize: '16px', color: genderColor, fontStyle: 'bold',
    }));
    ([entry.type1, entry.type2].filter(Boolean) as string[]).forEach((type, typeIndex) => {
      const x = contentLeft + typeIndex * 92 + 40;
      const color = TYPE_COLORS[type as keyof typeof TYPE_COLORS] ?? 0x556688;
      overlay.add(this.add.rectangle(x, identityY + 44, 80, 23, color, 0.95).setStrokeStyle(1, 0xffffff, 0.22));
      overlay.add(this.add.text(x, identityY + 44, typeName(type), {
        fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5));
    });
    overlay.add(this.add.text(splitX - 22, identityY + 34,
      `${t('Condition', '상태')} · ${statusNames[entry.status ?? 'none'] ?? entry.status}`, {
        fontSize: '10px', color: '#a9c0d3',
      }).setOrigin(1, 0));

    // Move list mirrors the reference's clean, high-contrast cards.
    const moveTop = top + 158;
    overlay.add(this.add.text(contentLeft, moveTop - 24, t('AVAILABLE MOVES', '사용 가능 기술'), {
      fontSize: '12px', color: '#8fdcf2', fontStyle: 'bold', letterSpacing: 1,
    }));
    const moveW = splitX - contentLeft - 24;
    mon.moves.forEach((move, i) => {
      const m = move.data, y = moveTop + i * 66;
      const category = m.category === 'physical' ? t('Physical', '물리')
        : m.category === 'special' ? t('Special', '특수') : t('Status', '변화');
      const color = TYPE_COLORS[m.type as keyof typeof TYPE_COLORS] ?? 0x365782;
      overlay.add(this.add.rectangle(contentLeft + moveW / 2, y + 24, moveW, 56, 0x13263a, 0.98).setStrokeStyle(1.5, color, 0.82));
      overlay.add(this.add.rectangle(contentLeft + 5, y + 24, 8, 46, color, 0.96));
      overlay.add(this.add.text(contentLeft + 18, y + 7, tr(m.name), { fontSize: '13px', color: '#fff', fontStyle: 'bold' }));
      overlay.add(this.add.text(contentLeft + moveW - 14, y + 8, `${move.pp}/${m.pp}`, {
        fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(1, 0));
      overlay.add(this.add.text(contentLeft + 18, y + 31,
        `${typeName(m.type)} · ${category} · ${t('Power', '위력')} ${m.power || '—'} · ${t('Acc', '명중')} ${m.accuracy}`,
        { fontSize: '9px', color: '#aabed0' }));
    });

    // Right: six-axis radar chart with exact battle values around it.
    const rightLeft = splitX + 20;
    const rightW = left + modalW - 24 - rightLeft;
    overlay.add(this.add.text(rightLeft, top + 79, t('BATTLE STATS', '능력치'), {
      fontSize: '13px', color: '#8fdcf2', fontStyle: 'bold', letterSpacing: 1,
    }));
    const radarX = rightLeft + rightW / 2;
    const radarY = top + 242;
    const radarR = 105;
    const stats: Array<[string, number, string]> = [
      [t('HP', '체력'), mon.maxHp, `${mon.hp}/${mon.maxHp}`],
      [t('Attack', '공격'), mon.atk, String(mon.atk)],
      [t('Defense', '방어'), mon.def, String(mon.def)],
      [t('Sp. Def', '특수방어'), mon.spDef, String(mon.spDef)],
      [t('Speed', '스피드'), mon.spd, String(mon.spd)],
      [t('Sp. Atk', '특수공격'), mon.spAtk, String(mon.spAtk)],
    ];
    const radar = this.add.graphics();
    const point = (radius: number, i: number) => ({
      x: radarX + Math.cos(-Math.PI / 2 + i * Math.PI / 3) * radius,
      y: radarY + Math.sin(-Math.PI / 2 + i * Math.PI / 3) * radius,
    });
    for (const scale of [0.25, 0.5, 0.75, 1]) {
      radar.lineStyle(1, 0x82a9c5, scale === 1 ? 0.55 : 0.22);
      radar.beginPath();
      for (let i = 0; i < 6; i++) {
        const p = point(radarR * scale, i);
        if (i === 0) radar.moveTo(p.x, p.y); else radar.lineTo(p.x, p.y);
      }
      const first = point(radarR * scale, 0); radar.lineTo(first.x, first.y); radar.strokePath();
    }
    for (let i = 0; i < 6; i++) {
      const p = point(radarR, i);
      radar.lineStyle(1, 0x8eb5ce, 0.28); radar.beginPath(); radar.moveTo(radarX, radarY); radar.lineTo(p.x, p.y); radar.strokePath();
    }
    const maxStat = Math.max(80, ...stats.map(stat => stat[1]));
    radar.fillStyle(0x65c7ff, 0.66); radar.lineStyle(2, 0xb8e9ff, 0.95); radar.beginPath();
    stats.forEach((stat, i) => {
      const p = point(radarR * Phaser.Math.Clamp(stat[1] / maxStat, 0.12, 1), i);
      if (i === 0) radar.moveTo(p.x, p.y); else radar.lineTo(p.x, p.y);
    });
    const firstData = point(radarR * Phaser.Math.Clamp(stats[0][1] / maxStat, 0.12, 1), 0);
    radar.lineTo(firstData.x, firstData.y); radar.closePath(); radar.fillPath(); radar.strokePath();
    overlay.add(radar);
    stats.forEach(([label, _value, display], i) => {
      const p = point(radarR + 42, i);
      overlay.add(this.add.text(p.x, p.y, `${label}\n${display}`, {
        fontSize: '10px', color: i === 0 ? '#ffe487' : '#d8e7f2', fontStyle: 'bold',
        align: 'center', lineSpacing: 2,
      }).setOrigin(0.5));
    });

    const abilityY = top + 413;
    overlay.add(this.add.rectangle(rightLeft + rightW / 2, abilityY + 43, rightW, 84, 0x13263a, 0.98)
      .setStrokeStyle(1, 0x466b87, 0.72));
    overlay.add(this.add.text(rightLeft + 14, abilityY + 10, t('ABILITY', '특성'), {
      fontSize: '9px', color: '#86bad8', fontStyle: 'bold',
    }));
    overlay.add(this.add.text(rightLeft + 14, abilityY + 27, abilityName(ability, entry.abilityKo, entry.abilityJa), {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
    }));
    overlay.add(this.add.text(rightLeft + 14, abilityY + 50,
      t('This ability affects how the Pokémon battles.', '이 특성은 배틀 중 포켓몬의 행동과 효과에 영향을 줍니다.'), {
        fontSize: '10px', color: '#aabed0', wordWrap: { width: rightW - 28 },
      }));

    const originY = top + modalH - 91;
    overlay.add(this.add.rectangle(rightLeft + rightW / 2, originY + 27, rightW, 54, 0x101f31, 0.98).setStrokeStyle(1, 0x35536d, 0.65));
    overlay.add(this.add.text(rightLeft + 14, originY + 8,
      `${t('Caught at', '잡은 위치')} · ${localizedCaughtLocation(origin)}`, {
        fontSize: '11px', color: '#d5e5f2', fontStyle: 'bold', fixedWidth: rightW - 28,
      }));
    overlay.add(this.add.text(rightLeft + 14, originY + 29,
      `${t('Held item', '지닌 물건')} · ${heldItemName}`, {
        fontSize: '9px', color: '#92abc0',
      }));

    const closeOverlay = () => overlay.destroy(true);
    dim.on('pointerdown', closeOverlay);
    const close = this.add.text(left + modalW - 20, top + 31, t('B  RETURN', 'B  돌아가기'), {
      fontSize: '11px', color: '#ffffff', backgroundColor: '#173047', padding: { x: 12, y: 7 },
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setData('uiCancel', true);
    close.on('pointerdown', closeOverlay);
    overlay.add(close);
  }

  /** Mobile status screen: a full-screen, single-column layout laid out with a
   *  MEASURED y-cursor (advances by each element's real, font-scaled height) so
   *  the enlarged text never overlaps. Tapping the dim backdrop closes it. */
  private showPokemonDetailsMobile(entry: PartyEntry, mon: ReturnType<typeof buildFromEntry>, key: string, dex: ReturnType<typeof dexEntry>, index: number) {
    const cx = this.W / 2, cy = this.H / 2;
    const modalW = this.W - 16, modalH = this.H - 8;
    const left = cx - modalW / 2, top = cy - modalH / 2;
    const padX = 26;
    const overlay = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0.85).setInteractive();
    dim.on('pointerdown', () => overlay.destroy(true));
    overlay.add(dim);
    overlay.add(this.add.rectangle(cx, cy, modalW, modalH, 0x0d142b, 0.99).setStrokeStyle(3, 0x6f95d8));

    let y = top + 12;
    const title = this.add.text(cx, y, t('— POKÉMON STATUS —', '— 포켓몬 상태 —'),
      { fontSize: '16px', color: '#ffe44e', fontStyle: 'bold' }).setOrigin(0.5, 0);
    overlay.add(title); y += title.height + 8;

    // Portrait (left) + name / level / gender / types (right).
    const portrait = Math.round(this.H * 0.15);
    const pxc = left + padX + portrait / 2;
    if (this.textures.exists(entry.spriteKey)) {
      const img = this.add.image(pxc, y + portrait / 2, entry.spriteKey);
      const src = this.textures.get(entry.spriteKey).getSourceImage();
      const d = Math.max((src.width as number) || 1, (src.height as number) || 1);
      img.setScale(portrait / d); overlay.add(img);
    } else {
      const col = TYPE_COLORS[entry.type1 as keyof typeof TYPE_COLORS] ?? 0x556688;
      overlay.add(this.add.circle(pxc, y + portrait / 2, portrait / 2, col, 0.5).setStrokeStyle(2, col));
    }
    const ix = pxc + portrait / 2 + 18;
    const gender = genderForPokemon({ name: entry.name, key: entry.spriteKey, gender: entry.gender,
      id: Number(key.match(/^api-(\d+)$/)?.[1]) || undefined }, entry.breedingId ?? `party-${index}`);
    const gcol = gender === 'male' ? '#6fb5ff' : gender === 'female' ? '#ff91c8' : '#b8bfd0';
    const nameT = this.add.text(ix, y + 2, this.partyName(entry), { fontSize: '20px', color: '#fff', fontStyle: 'bold' });
    overlay.add(nameT);
    const lvT = this.add.text(ix, y + 6 + nameT.height, `Lv.${entry.level}`, { fontSize: '15px', color: '#ffe44e' });
    overlay.add(lvT);
    overlay.add(this.add.text(ix + lvT.width + 16, y + 6 + nameT.height, genderSymbol(gender),
      { fontSize: '15px', color: gcol, fontStyle: 'bold' }));
    const typeY = y + 10 + nameT.height + lvT.height;
    [entry.type1, entry.type2].filter(Boolean).forEach((tp, i) => {
      const tw = Math.round(this.W * 0.085), tk = tp as string;
      const tx = ix + i * (tw + 14);
      overlay.add(this.add.rectangle(tx + tw / 2, typeY + 16, tw, 30,
        TYPE_COLORS[tk as keyof typeof TYPE_COLORS] ?? 0x556688).setStrokeStyle(1, 0xffffff, 0.25));
      overlay.add(this.add.text(tx + tw / 2, typeY + 16, typeName(tk),
        { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
    });
    y = top + 12 + title.height + 8 + portrait + 12;

    // Ability + condition (one wrapped line).
    const ability = entry.ability ?? findForm(entry.spriteKey)?.ability ?? dex?.ability ?? t('Unknown', '알 수 없음');
    const statusNames: Record<string, string> = {
      none: t('Healthy', '정상'), psn: t('Poisoned', '독'), tox: t('Badly poisoned', '맹독', 'もうどく'), par: t('Paralyzed', '마비'),
      brn: t('Burned', '화상'), frz: t('Frozen', '얼음'), slp: t('Asleep', '잠듦'),
    };
    const abilT = this.add.text(left + padX, y,
      `${t('Ability', '특성')}: ${abilityName(ability, entry.abilityKo, entry.abilityJa)}    ·    ${t('Condition', '상태')}: ${statusNames[entry.status ?? 'none'] ?? entry.status}`,
      { fontSize: '13px', color: '#bcd3ff', wordWrap: { width: modalW - padX * 2 } });
    overlay.add(abilT); y += abilT.height + 12;
    const storedOrigin = entry.caughtAt && !/^Evolve\b/i.test(entry.caughtAt) ? entry.caughtAt : undefined;
    const origin = storedOrigin ?? caughtOriginForDexKey(key)
      ?? (STARTERS.some(s => s.spriteKey === entry.spriteKey) ? "Prof. Song's Lab" : 'Unknown location');
    const heldDef = entry.heldItem ? itemDef(entry.heldItem) : undefined;
    const heldName = heldDef ? itemName(heldDef) : entry.heldItem ?? t('None', '없음');
    const originText = this.add.text(left + padX, y,
      `${t('Caught at', '잡은 위치')}: ${localizedCaughtLocation(origin)}    ·    ${t('Held item', '지닌 물건')}: ${heldName}`,
      { fontSize: '11px', color: '#98afc4', wordWrap: { width: modalW - padX * 2 } });
    overlay.add(originText); y += originText.height + 10;

    // Six battle stats — 3 columns × 2 rows.
    const sh = this.add.text(left + padX, y, t('BATTLE STATS', '능력치'), { fontSize: '14px', color: '#ffe44e', fontStyle: 'bold' });
    overlay.add(sh); y += sh.height + 6;
    const stats: [string, string | number][] = [
      [t('HP', '체력'), `${mon.hp}/${mon.maxHp}`], [t('Atk', '공격'), mon.atk], [t('Def', '방어'), mon.def],
      [t('SpA', '특공'), mon.spAtk], [t('SpD', '특방'), mon.spDef], [t('Spe', '스피드'), mon.spd],
    ];
    const scolW = Math.round((modalW - padX * 2) / 3), scellH = Math.round(this.H * 0.056);
    stats.forEach(([label, value], i) => {
      const c = i % 3, r = Math.floor(i / 3);
      const sxx = left + padX + c * scolW, syy = y + r * (scellH + 8);
      overlay.add(this.add.rectangle(sxx + scolW / 2 - 6, syy + scellH / 2, scolW - 12, scellH, 0x172743).setStrokeStyle(1, 0x365782));
      overlay.add(this.add.text(sxx + 8, syy + scellH / 2, `${label} ${value}`, { fontSize: '12px', color: '#dbe7ff' }).setOrigin(0, 0.5));
    });
    y += 2 * (scellH + 8) + 10;

    // Moves.
    const mh = this.add.text(left + padX, y, t('MOVES', '기술'), { fontSize: '14px', color: '#ffe44e', fontStyle: 'bold' });
    overlay.add(mh); y += mh.height + 6;
    const mrowH = Math.round(this.H * 0.072);
    mon.moves.forEach((move, i) => {
      const m = move.data, my = y + i * (mrowH + 5);
      const category = m.category === 'physical' ? t('Physical', '물리')
        : m.category === 'special' ? t('Special', '특수') : t('Status', '변화');
      overlay.add(this.add.rectangle(cx, my + mrowH / 2, modalW - padX * 2, mrowH, 0x172743)
        .setStrokeStyle(1, TYPE_COLORS[m.type as keyof typeof TYPE_COLORS] ?? 0x365782));
      overlay.add(this.add.text(left + padX + 12, my + Math.round(mrowH * 0.14), tr(m.name),
        { fontSize: '13px', color: '#fff', fontStyle: 'bold' }));
      overlay.add(this.add.text(left + padX + 12, my + Math.round(mrowH * 0.56),
        `${typeName(m.type)} · ${category} · ${t('Pow', '위력')} ${m.power || '—'} · ${t('Acc', '명중')} ${m.accuracy} · PP ${move.pp}/${m.pp}`,
        { fontSize: '9px', color: '#aab8d0' }));
    });

    const close = this.add.text(cx, top + modalH - 4, t('✕ TAP OUTSIDE / CLOSE', '✕ 바깥을 눌러 닫기'),
      { fontSize: '12px', color: '#aab8d0' }).setOrigin(0.5, 1);
    overlay.add(close);
  }

  // ── Bag tab ───────────────────────────────────────────────────────────────

  private renderBagTab() {
    const cx = this.W / 2;
    Inventory.ensureInit(this.registry);
    const hasShoes = !!this.registry.get('hasRunningShoes');
    const hasDex   = !!this.registry.get('hasPokedex');

    // Money
    const moneyX = this.mobileMenu ? cx + this.winW / 2 - 24 : cx + 390;
    const moneyY = this.mobileMenu ? this.H / 2 - this.winH / 2 + 67 : this.H / 2 - 245;
    const moneyBg = this.add.rectangle(moneyX - 78, moneyY, 156, 32, 0x25443c, 0.96)
      .setStrokeStyle(1, 0x62c69a, 0.62);
    const moneyText = this.add.text(moneyX - 8, moneyY,
      `₩  ${formatMoney(Inventory.money(this.registry))}`,
      { fontSize: '14px', color: '#dcffeb', fontStyle: 'bold' }).setOrigin(1, 0.5);
    this.contentContainer.add([moneyBg, moneyText]);

    type Row = { key?: string; name: string; desc: string; icon: string; count?: number; onClick?: () => void };
    const rows: Row[] = [];

    const quest = currentQuest(this.registry);
    rows.push({
      name: t('Quest Log', '모험 기록'), icon: '❗',
      desc: `${quest.title} · ${quest.destination}${quest.progress ? ` · ${quest.progress}` : ''}`,
      onClick: () => this.showQuestLog(),
    });

    // Town Map — always available; view the whole region and (post-League) Fly.
    rows.push({
      name: tr('Town Map'), icon: '🗺️',
      desc: tr('See the region and where you are.')
        + (this.registry.get('hasFlyHM') ? tr(' Fly between cities.') : ''),
      onClick: () => { this.scene.launch('RegionMapScene', { parentKey: 'MenuScene' }); this.scene.pause(); },
    });

    if (hasDex) rows.push({
      name: tr('Pokémon Encyclopedia'), icon: '📖',
      desc: tr('Browse every Pokémon you have seen and caught.'),
      onClick: () => { this.scene.launch('PokedexScene', { parentKey: 'MenuScene' }); this.scene.pause(); },
    });

    // Gym Badges — showcase every badge earned so far.
    const badgeCount = reconcileBadgeProgress(this.registry);
    rows.push({
      name: tr('Gym Badges'), icon: '🏅',
      desc: tr(`${badgeCount} of ${BADGES.length} badges collected. Tap to view your case.`),
      onClick: () => this.showBadgeCase(),
    });

    // Northern Inspectorate tablets — kept separately from southern Gym Badges.
    const heldMapae = mapaeCount(this.registry);
    rows.push({
      name: t('Mapae Pouch', '마패 파우치'), icon: '🐎',
      desc: t(
        `${heldMapae} of ${MAPAE.length} northern tablets collected. Tap to view your pouch.`,
        `북부 마패 ${MAPAE.length}개 중 ${heldMapae}개 획득. 탭하면 파우치를 봅니다.`,
      ),
      onClick: () => this.showMapaePouch(),
    });

    // Key items — HMs sit near the top (with the map/dex) so they're always visible.
    const inv = Inventory.all(this.registry);
    for (const def of ITEMS) {
      if (def.category !== 'hm' || (inv[def.key] ?? 0) <= 0) continue;
      rows.push({
        key: def.key,
        name: itemName(def), icon: def.icon,
        desc: itemDescription(def) + (def.move ? t(' Tap to teach.', ' 눌러서 가르치기.') : ''),
        onClick: () => this.beginTeachHM(def.key),
      });
    }

    // Consumable items (heal / status / revive / ball)
    for (const def of ITEMS) {
      const n = inv[def.key] ?? 0;
      if (n <= 0 || def.category === 'hm') continue;
      // Exp. Share is a toggle: tapping it switches party-wide EXP sharing on/off.
      if (def.key === 'expshare') {
        const on = !this.registry.get('expShareOff');
        rows.push({
          key: def.key,
          icon: on ? '📡' : '📴',
          name: itemName(def) + (on ? t('  [ON]', '  [켜짐]') : t('  [OFF]', '  [꺼짐]')),
          desc: itemDescription(def) + (on ? t(' Tap to switch OFF.', ' 눌러서 끄기.') : t(' Tap to switch ON.', ' 눌러서 켜기.')),
          onClick: () => {
            this.registry.set('expShareOff', on);   // currently on → set OFF, and vice-versa
            this.contentContainer.destroy(true);
            this.contentContainer = this.add.container(0, 0);
            this.renderBagTab();
          },
        });
        continue;
      }
      rows.push({
        key: def.key,
        name: itemName(def), icon: def.icon, desc: itemDescription(def), count: n,
        onClick: (def.category === 'ball' || def.category === 'souvenir' || def.category === 'key') ? undefined : () => this.beginUseItem(def.key),
      });
    }

    if (hasShoes) rows.push({
      name: tr('Running Shoes'), desc: tr('Hold SHIFT to run fast.'), icon: '👟',
    });

    // Seven items per page. The previous one-row scrolling used a final
    // overlapping window and tiny arrows, so mobile players reasonably read
    // the first seven entries as the entire bag.
    const VISIBLE = this.BAG_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(rows.length / VISIBLE));
    this.bagMaxScroll = (pageCount - 1) * VISIBLE;
    const focusKey = this.registry.get('bagFocusItem') as string | undefined;
    if (focusKey) {
      const focusIndex = rows.findIndex(row => row.key === focusKey);
      if (focusIndex >= 0) this.bagScroll = Math.floor(focusIndex / VISIBLE) * VISIBLE;
      this.registry.remove('bagFocusItem');
    }
    this.bagScroll = Phaser.Math.Clamp(this.bagScroll, 0, this.bagMaxScroll);
    // Mobile: fill the enlarged window with wider, taller rows so the (scaled-up)
    // icon/name/desc read clearly instead of spilling out of a narrow strip.
    const cy = this.H / 2;
    const rowW = this.mobileMenu ? this.winW - 44 : 600;
    const rowLeft = cx - rowW / 2;
    const listTop = this.mobileMenu ? (cy - this.winH / 2 + 160) : (cy - 178);
    const step = this.mobileMenu
      ? Math.floor((cy + this.winH / 2 - 74 - listTop) / VISIBLE) : 50;
    const rowH = this.mobileMenu ? Math.round(step * 0.84) : 44;
    const iconX = this.mobileMenu ? rowLeft + 32 : cx - 282;
    const textX = this.mobileMenu ? rowLeft + 66 : cx - 252;
    const countX = this.mobileMenu ? cx + rowW / 2 - 22 : cx + 285;
    rows.slice(this.bagScroll, this.bagScroll + VISIBLE).forEach((item, i) => {
      const y = this.mobileMenu ? (listTop + step / 2 + i * step) : (listTop + i * 50);
      const rowShadow = this.add.rectangle(cx + 3, y + 4, rowW, rowH, 0x000000, 0.22);
      const row = this.add.rectangle(cx, y, rowW, rowH, 0x14283a, 0.98).setStrokeStyle(1, 0x416783, 0.72);
      const accent = this.add.rectangle(rowLeft + 4, y, 7, rowH - 8,
        item.onClick ? PROD_UI.cyan : 0x536679, item.onClick ? 0.9 : 0.48);
      const icon = this.add.text(iconX, y, item.icon, { fontSize: '22px' }).setOrigin(0.5);
      const nm   = this.add.text(textX, y - Math.round(rowH * 0.2), item.name, { fontSize: '14px', color: '#f5fbff', fontStyle: 'bold' });
      const desc = this.add.text(textX, y + Math.round(rowH * 0.1), item.desc,
        { fontSize: '11px', color: '#9fb5c9', wordWrap: { width: rowW - (textX - rowLeft) - 70 } });
      this.contentContainer.add([rowShadow, row, accent, icon, nm, desc]);
      if (item.count !== undefined) {
        const countBg = this.add.rectangle(countX - 24, y, 54, 26, 0x213e56, 0.95).setStrokeStyle(1, 0x4f7898, 0.55);
        const countText = this.add.text(countX, y, `×${item.count}`, { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(1, 0.5);
        this.contentContainer.add([countBg, countText]);
      }
      if (item.onClick) {
        row.setInteractive({ useHandCursor: true })
          .on('pointerover', () => row.setFillStyle(0x214763))
          .on('pointerout',  () => row.setFillStyle(0x14283a))
          .on('pointerdown', item.onClick!);
      }
    });

    // Large page controls remain usable after the Phaser canvas is scaled down
    // on an iPhone. Keyboard arrows and the mouse wheel call the same pager.
    if (this.bagMaxScroll > 0) {
      const controlsY = this.mobileMenu ? (this.H / 2 + this.winH / 2 - 36) : (this.H / 2 + 194);
      const mkPageButton = (x: number, label: string, delta: number, enabled: boolean) => {
        const bg = this.add.rectangle(x, controlsY, 190, 38, enabled ? 0x315a9a : 0x1a2033, 1)
          .setStrokeStyle(1, enabled ? 0x77aaff : 0x30384d);
        const txt = this.add.text(x, controlsY, label, {
          fontSize: '13px', color: enabled ? '#ffffff' : '#596174', fontStyle: 'bold',
        }).setOrigin(0.5);
        if (enabled) bg.setInteractive({ useHandCursor: true })
          .on('pointerover', () => bg.setFillStyle(0x4474ba))
          .on('pointerout', () => bg.setFillStyle(0x315a9a))
          .on('pointerdown', () => this.scrollBag(delta));
        this.contentContainer.add([bg, txt]);
      };
      mkPageButton(cx - 210, t('◀ PREVIOUS PAGE', '◀ 이전 페이지'), -VISIBLE, this.bagScroll > 0);
      mkPageButton(cx + 210, t('NEXT PAGE ▶', '다음 페이지 ▶'), VISIBLE, this.bagScroll < this.bagMaxScroll);
      const currentPage = Math.floor(this.bagScroll / VISIBLE) + 1;
      this.contentContainer.add(this.add.text(cx, controlsY,
        t(`${currentPage} / ${pageCount}\n${rows.length} entries`, `${currentPage} / ${pageCount}\n총 ${rows.length}개`),
        { fontSize: '11px', color: '#aab8d0', align: 'center' }).setOrigin(0.5));
    }
  }

  /** Move the bag by one page and redraw (no-op off the bag tab). */
  private scrollBag(delta: number) {
    if (this.tab !== 'bag') return;
    const next = Phaser.Math.Clamp(this.bagScroll + delta, 0, this.bagMaxScroll);
    if (next === this.bagScroll) return;
    sfxMove(this);
    this.bagScroll = next;
    this.contentContainer.destroy(true);
    this.contentContainer = this.add.container(0, 0);
    this.renderBagTab();
  }

  /** Always-available main-story objective and recovered milestone history. */
  private showQuestLog() {
    const cx = this.W / 2, cy = this.H / 2;
    const quest = currentQuest(this.registry);
    const history = completedQuestMilestones(this.registry);
    const panelW = this.mobileMenu ? Math.min(this.W - 40, 1100) : 650;
    const panelH = this.mobileMenu ? Math.min(this.H - 32, 660) : 470;
    const left = cx - panelW / 2;
    const top = cy - panelH / 2;
    const overlay = this.add.container(0, 0).setDepth(70);
    const shade = this.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0.74)
      .setInteractive({ useHandCursor: true });
    const panel = this.add.rectangle(cx, cy, panelW, panelH, 0x09182b, 0.99)
      .setStrokeStyle(2, 0xffd34d);
    overlay.add([shade, panel]);

    overlay.add(this.add.text(left + 28, top + 26, t('QUEST LOG', '모험 기록'), {
      fontSize: '20px', color: '#ffdf69', fontStyle: 'bold', letterSpacing: 2,
    }));
    overlay.add(this.add.text(left + 28, top + 62, t('CURRENT OBJECTIVE', '현재 목표'), {
      fontSize: '10px', color: '#65d8ff', fontStyle: 'bold', letterSpacing: 1,
    }));
    overlay.add(this.add.text(left + 28, top + 84, quest.title, {
      fontSize: this.mobileMenu ? '18px' : '17px', color: '#ffffff', fontStyle: 'bold',
      wordWrap: { width: panelW - 56 },
    }));
    overlay.add(this.add.text(left + 28, top + 120, quest.detail, {
      fontSize: this.mobileMenu ? '14px' : '13px', color: '#c7d8ea', lineSpacing: 6,
      wordWrap: { width: panelW - 56 },
    }));
    overlay.add(this.add.text(left + 28, top + 190,
      `${t('DESTINATION', '목적지')}  ◆  ${quest.destination}${quest.progress ? `    ${quest.progress}` : ''}`, {
        fontSize: '13px', color: '#ffe894', fontStyle: 'bold',
        wordWrap: { width: panelW - 56 },
      }));
    overlay.add(this.add.rectangle(cx, top + 229, panelW - 56, 1, 0x42617c, 0.85));
    overlay.add(this.add.text(left + 28, top + 246, t('COMPLETED MILESTONES', '완료한 주요 기록'), {
      fontSize: '10px', color: '#65d8ff', fontStyle: 'bold', letterSpacing: 1,
    }));
    const historyText = history.length
      ? history.slice(-8).map(entry => `✓  ${entry}`).join('\n')
      : t('Your journey has only just begun.', '이제 막 여정이 시작되었습니다.');
    overlay.add(this.add.text(left + 32, top + 271, historyText, {
      fontSize: this.mobileMenu ? '13px' : '12px', color: '#b9cce0', lineSpacing: 8,
      wordWrap: { width: panelW - 64 },
    }));

    const close = this.add.text(cx, top + panelH - 26, t('B  CLOSE', 'B  닫기'), {
      fontSize: '13px', color: '#d9e8f7', backgroundColor: '#203854', padding: { x: 14, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setData('uiCancel', true);
    const destroy = () => { sfxCancel(this); overlay.destroy(true); };
    close.on('pointerdown', destroy);
    shade.on('pointerdown', destroy);
    overlay.add(close);
  }

  /** Badge case — an 8-slot showcase of every Gym Badge, earned ones lit up. */
  private showBadgeCase() {
    const cx = this.W / 2, cy = this.H / 2;
    const earned = reconcileBadgeProgress(this.registry);
    const caseW = this.mobileMenu ? Math.min(this.W - 48, 1180) : 620;
    const caseH = this.mobileMenu ? Math.min(this.H - 40, 680) : 470;

    const overlay = this.add.container(0, 0).setDepth(60);
    overlay.add(this.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0.7));
    overlay.add(this.add.rectangle(cx, cy, caseW, caseH, 0x10142a, 0.99).setStrokeStyle(2, 0xffe44e));
    const caseTop = cy - caseH / 2;
    overlay.add(this.add.text(cx, caseTop + 30, t('— GYM BADGES —', '— 체육관 배지 —'), { fontSize: '18px', color: '#ffe44e', fontStyle: 'bold' }).setOrigin(0.5));
    overlay.add(this.add.text(cx, caseTop + 58,
      t(`${earned} / ${BADGES.length} collected`, `${earned} / ${BADGES.length} 획득`),
      { fontSize: '13px', color: '#9ab' }).setOrigin(0.5));

    // 4 columns × 2 rows
    const cols = 4;
    const cellW = this.mobileMenu ? (caseW - 56) / cols : 142;
    const cellH = this.mobileMenu ? 205 : 150;
    const startX = cx - ((cols - 1) / 2) * cellW;
    const startY = this.mobileMenu ? cy - 105 : cy - 70;
    BADGES.forEach((b, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * cellW;
      const y = startY + row * cellH;
      const has = !!this.registry.get(b.flag);
      const col0 = TYPE_COLORS[b.type as keyof typeof TYPE_COLORS] ?? 0x556699;

      // High-resolution Higgsfield emblem — full colour when earned, a locked
      // metal silhouette before discovery.
      const disc = this.add.circle(x, y - 18, 42, has ? col0 : 0x1a1e33)
        .setStrokeStyle(3, has ? 0xffe44e : 0x2a3050);
      overlay.add(disc);
      const emblem = this.add.image(x, y - 18, rewardTextureKey('badge', b.flag)).setDisplaySize(82, 82);
      if (!has) emblem.setTint(0x22283c).setAlpha(0.32);
      overlay.add(emblem);
      if (!has) overlay.add(this.add.text(x, y - 18, '🔒', { fontSize: '22px' }).setOrigin(0.5));

      // Labels
      overlay.add(this.add.text(x, y + 24, has ? tr(b.name) : '? ? ?',
        { fontSize: '11px', color: has ? '#ffffff' : '#556', fontStyle: 'bold', align: 'center', wordWrap: { width: cellW - 20 } }).setOrigin(0.5, 0));
      overlay.add(this.add.text(x, y + (this.mobileMenu ? 66 : 52), has ? `${tr(b.leader)} · ${tr(b.city)}` : '',
        { fontSize: '9px', color: '#8899bb', align: 'center', wordWrap: { width: cellW - 20 } }).setOrigin(0.5, 0));
    });

    const close = this.add.text(cx, cy + caseH / 2 - 28, tr('✕ Close'), { fontSize: '14px', color: '#aaa' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerover', () => close.setColor('#fff'));
    close.on('pointerout',  () => close.setColor('#aaa'));
    close.on('pointerdown', () => overlay.destroy(true));
    overlay.add(close);
  }

  /** Mapae pouch — the eight northern 어사대장 tablets in circuit order. */
  private showMapaePouch() {
    const cx = this.W / 2, cy = this.H / 2;
    const held = mapaeCount(this.registry);
    const pouchW = this.mobileMenu ? Math.min(this.W - 48, 1180) : 660;
    const pouchH = this.mobileMenu ? Math.min(this.H - 40, 680) : 470;
    const overlay = this.add.container(0, 0).setDepth(60);

    overlay.add(this.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0.72));
    overlay.add(this.add.rectangle(cx, cy, pouchW, pouchH, 0x24170e, 0.99)
      .setStrokeStyle(3, 0xd8a74f));
    const pouchTop = cy - pouchH / 2;
    overlay.add(this.add.text(cx, pouchTop + 30, t('— NORTHERN MAPAE POUCH —', '— 북부 마패 파우치 —'), {
      fontSize: '18px', color: '#ffd77b', fontStyle: 'bold',
    }).setOrigin(0.5));
    overlay.add(this.add.text(cx, pouchTop + 58,
      t(`${held} / ${MAPAE.length} collected`, `${held} / ${MAPAE.length} 획득`),
      { fontSize: '13px', color: '#d3b98c' }).setOrigin(0.5));

    const cols = 4;
    const cellW = this.mobileMenu ? (pouchW - 56) / cols : 152;
    const cellH = this.mobileMenu ? 205 : 150;
    const startX = cx - ((cols - 1) / 2) * cellW;
    const startY = this.mobileMenu ? cy - 105 : cy - 70;
    MAPAE.forEach((mapae, index) => {
      const col = index % cols, row = Math.floor(index / cols);
      const x = startX + col * cellW;
      const y = startY + row * cellH;
      const has = hasMapae(this.registry, mapae.key);
      const tablet = this.add.circle(x, y - 18, 43, has ? 0x7a4a1c : 0x211b18)
        .setStrokeStyle(3, has ? 0xffd77b : 0x55473d);
      overlay.add(tablet);
      const emblem = this.add.image(x, y - 18, rewardTextureKey('mapae', mapae.key)).setDisplaySize(84, 84);
      if (!has) emblem.setTint(0x302821).setAlpha(0.34);
      overlay.add(emblem);
      if (!has) overlay.add(this.add.text(x, y - 18, '🔒', { fontSize: '22px' }).setOrigin(0.5));
      overlay.add(this.add.text(x, y + 22,
        has ? t(`${mapae.city} Mapae`, `${mapae.cityKo} 마패`) : '? ? ?', {
          fontSize: '11px', color: has ? '#fff4d6' : '#6d625b', fontStyle: 'bold', align: 'center',
          wordWrap: { width: cellW - 18 },
        }).setOrigin(0.5, 0));
      overlay.add(this.add.text(x, y + (this.mobileMenu ? 66 : 52), has ? t(mapae.chief, mapae.chiefKo) : '', {
        fontSize: '9px', color: '#c4a879', align: 'center', wordWrap: { width: cellW - 18 },
      }).setOrigin(0.5, 0));
    });

    const close = this.add.text(cx, cy + pouchH / 2 - 28, tr('✕ Close'), {
      fontSize: '14px', color: '#c8b89d',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerover', () => close.setColor('#ffffff'));
    close.on('pointerout', () => close.setColor('#c8b89d'));
    close.on('pointerdown', () => overlay.destroy(true));
    overlay.add(close);
  }

  /** Pick which party Pokémon to use a consumable on. */
  private beginUseItem(itemKey: string) {
    const party = PartySystem.get(this.registry);
    const cx = this.W / 2, cy = this.H / 2;
    const overlay = this.add.container(0, 0).setDepth(60);
    overlay.add(this.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0.6));
    overlay.add(this.add.rectangle(cx, cy, 460, 420, 0x10142a, 0.99).setStrokeStyle(2, 0x5577aa));
    const selectedDef = itemDef(itemKey);
    const selectedName = selectedDef ? itemName(selectedDef) : itemKey;
    overlay.add(this.add.text(cx, cy - 178, t(`Use ${selectedName} on…`, `${selectedName}을 사용할 포켓몬`, `${selectedName}を 使う ポケモン`), { fontSize: '16px', color: '#ffe44e', fontStyle: 'bold' }).setOrigin(0.5));

    party.forEach((e, i) => {
      const y = cy - 140 + i * 48;
      const r = this.add.rectangle(cx, y, 400, 42, e.hp <= 0 ? 0x2a1414 : 0x14223a).setStrokeStyle(1, 0x3a5a8a).setInteractive({ useHandCursor: true });
      overlay.add(r);
      overlay.add(this.add.text(cx - 180, y - 9, `${this.partyName(e)}  Lv.${e.level}`, { fontSize: '14px', color: '#fff' }));
      overlay.add(this.add.text(cx - 180, y + 9, `HP ${e.hp}/${e.maxHp}  ${(e.status && e.status !== 'none') ? e.status.toUpperCase() : ''}`, { fontSize: '11px', color: '#9ab' }));
      r.on('pointerdown', () => {
        const res = useItemOnSlot(this.registry, itemKey, i);
        overlay.destroy(true);
        this.showToast(tr(res.message));
        if (res.ok && hasPendingEvolution(this.registry)) {
          this.time.delayedCall(280, () => {
            this.scene.launch('EvolutionScene', { parentKey: 'MenuScene' });
            this.scene.pause();
          });
          return;
        }
        this.switchTab('bag');   // refresh
      });
    });

    const cancel = this.add.text(cx, cy + 176, tr('✕ Cancel'), { fontSize: '14px', color: '#aaa' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancel.on('pointerdown', () => overlay.destroy(true));
    overlay.add(cancel);
  }

  /** Pick which party Pokémon learns an HM's move (reusable — the HM is not consumed). */
  private beginTeachHM(itemKey: string) {
    const def = itemDef(itemKey);
    const move = def?.move ?? '';
    const party = PartySystem.get(this.registry);
    const cx = this.W / 2, cy = this.H / 2;
    const overlay = this.add.container(0, 0).setDepth(60);
    overlay.add(this.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0.6));
    overlay.add(this.add.rectangle(cx, cy, 460, 420, 0x10142a, 0.99).setStrokeStyle(2, 0x5577aa));
    overlay.add(this.add.text(cx, cy - 178, `Teach ${move} to…`, { fontSize: '16px', color: '#ffe44e', fontStyle: 'bold' }).setOrigin(0.5));

    party.forEach((e, i) => {
      const y = cy - 140 + i * 48;
      const knows    = e.moves.some(m => m.toLowerCase() === move.toLowerCase());
      const eligible = def ? canLearnMove(e, def) : false;
      const usable   = eligible && !knows;
      const r = this.add.rectangle(cx, y, 400, 42, usable ? 0x14223a : 0x241f2e)
        .setStrokeStyle(1, usable ? 0x3a5a8a : 0x443355);
      if (usable) r.setInteractive({ useHandCursor: true });
      overlay.add(r);
      overlay.add(this.add.text(cx - 180, y - 9, `${this.partyName(e)}  Lv.${e.level}`, { fontSize: '14px', color: usable ? '#fff' : '#888' }));
      const types = [e.type1, e.type2].filter(Boolean).join(' / ');
      const note  = knows ? `already knows ${move}` : eligible ? `can learn ${move}` : `can't learn ${move}`;
      overlay.add(this.add.text(cx - 180, y + 9, `${types}  ·  ${note}`, { fontSize: '11px', color: usable ? '#9ab' : '#776688' }));
      if (usable) r.on('pointerdown', () => {
        overlay.destroy(true);
        this.teachToSlot(itemKey, i);
      });
    });

    const cancel = this.add.text(cx, cy + 176, tr('✕ Cancel'), { fontSize: '14px', color: '#aaa' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancel.on('pointerdown', () => overlay.destroy(true));
    overlay.add(cancel);
  }

  /** Teach the item's move to a slot. For damaging TMs on a full moveset, ask
   *  which move to forget; otherwise fall back to the simple teach. */
  private teachToSlot(itemKey: string, slot: number) {
    const def = itemDef(itemKey);
    const move = def?.move ?? '';
    // Battle data for the taught move — a gym TM or an HM (Fly). Status/unknown moves
    // have none, so they keep the simple append/replace teach.
    const newData = TM_MOVE_DATA[move.toLowerCase()] ?? HM_MOVE_DATA[move.toLowerCase()];
    if (!newData || newData.power <= 0) {
      const res = teachHM(this.registry, itemKey, slot);
      this.showToast(tr(res.message));
      this.switchTab('bag');
      return;
    }
    const entry = PartySystem.get(this.registry)[slot];
    if (!entry) return;
    const current = buildFromEntry(entry).moves.map(m => m.data);
    if (current.some(m => m.name.toLowerCase() === move.toLowerCase())) {
      this.showToast(`${this.partyName(entry)} already knows ${move}.`);
      return;
    }
    if (current.length < 4) {
      // Free slot — just add it (keeps the Pokémon's normal move growth).
      const res = teachHM(this.registry, itemKey, slot);
      this.showToast(tr(res.message));
      this.switchTab('bag');
      return;
    }
    // Full moveset — let the player choose which move to forget.
    this.showForgetPicker(slot, current, newData, move);
  }

  /** With 4 moves known, let the player pick which one to forget for the new move. */
  private showForgetPicker(slot: number, current: MoveData[], tmData: MoveData, move: string) {
    const entry = PartySystem.get(this.registry)[slot];
    const cx = this.W / 2, cy = this.H / 2;
    const overlay = this.add.container(0, 0).setDepth(60);
    overlay.add(this.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0.6));
    overlay.add(this.add.rectangle(cx, cy, 480, 400, 0x10142a, 0.99).setStrokeStyle(2, 0x5577aa));
    overlay.add(this.add.text(cx, cy - 168, `${this.partyName(entry)} wants to learn ${move}.`, { fontSize: '15px', color: '#ffe44e', fontStyle: 'bold' }).setOrigin(0.5));
    overlay.add(this.add.text(cx, cy - 144, tr('Which move should it forget?'), { fontSize: '12px', color: '#9ab' }).setOrigin(0.5));

    current.forEach((m, j) => {
      const y = cy - 110 + j * 46;
      const r = this.add.rectangle(cx, y, 420, 40, 0x14223a).setStrokeStyle(1, 0x3a5a8a).setInteractive({ useHandCursor: true });
      overlay.add(r);
      overlay.add(this.add.text(cx - 195, y - 8, tr(m.name), { fontSize: '14px', color: '#fff' }));
      const kind = m.category === 'status' ? t('STATUS', '변화') : `${t('Pow', '위력')} ${m.power}`;
      overlay.add(this.add.text(cx - 195, y + 9, `${typeName(m.type)}  ·  ${kind}`, { fontSize: '10px', color: '#9ab' }));
      r.on('pointerover', () => r.setFillStyle(0x1a4488));
      r.on('pointerout',  () => r.setFillStyle(0x14223a));
      r.on('pointerdown', () => {
        overlay.destroy(true);
        const next = current.slice();
        next[j] = tmData;                       // replace the chosen move with the TM's move
        this.commitCuratedMoves(slot, next, move, m.name);
      });
    });

    const cancel = this.add.text(cx, cy + 168, `✕ Don't learn ${move}`, { fontSize: '13px', color: '#c99' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancel.on('pointerdown', () => { overlay.destroy(true); this.showToast(`${this.partyName(entry)} did not learn ${move}.`); });
    overlay.add(cancel);
  }

  /** Store the chosen moveset on the party entry (overrides the auto-derived set). */
  private commitCuratedMoves(slot: number, moves: MoveData[], learned: string, forgot?: string) {
    const party = PartySystem.get(this.registry);
    const e = party[slot];
    if (!e) return;
    e.battleMoves = moves.slice(0, 4);
    e.moves = e.battleMoves.map(m => m.name);   // keep the display list in sync
    PartySystem.set(this.registry, party);
    this.showToast(forgot ? `${this.partyName(e)} forgot ${forgot} and learned ${learned}!` : `${this.partyName(e)} learned ${learned}!`);
    this.switchTab('bag');
  }

  private showToast(msg: string) {
    const t = this.add.text(this.W / 2, this.H - 40, msg, {
      fontSize: '14px', color: '#aaffaa', backgroundColor: '#000000cc', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(80);
    this.time.delayedCall(1800, () => t.destroy());
  }

  // ── Close ─────────────────────────────────────────────────────────────────

  private closeMenu(playSound = true) {
    if (playSound) sfxCancel(this);
    deckHideLeadPicker();
    this.cameras.main.fadeOut(150, 0, 0, 0, () => {
      this.scene.stop('MenuScene');
    });
  }
}
