import Phaser from 'phaser';
import { TYPE_COLORS, findForm } from '../data/StarterData';
import { dexEntry, dexKeyFor } from '../data/Pokedex';
import { abilityName, pokeName, pokeNameEn, t, tr, typeName } from '../systems/i18n';
import {
  BOX_SLOT_COUNT,
  MIN_BOX_COUNT,
  PartySystem,
  type PartyEntry,
  type PokemonBoxStorage,
} from '../systems/PartySystem';
import { hpColor, PROD_UI, roundedPanel } from '../systems/ProductionUi';
import { sfxCancel, sfxConfirm, sfxMove } from '../systems/UiSfx';
import { buildFromEntry } from '../systems/PartyBattle';
import { itemDef, itemName } from '../systems/Items';

type StorageRef =
  | { kind: 'party'; index: number }
  | { kind: 'box'; box: number; slot: number };

interface HitTarget {
  ref: StorageRef;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Production-style PC storage: eight real 30-slot boxes, a live party panel,
 * click/menu transfers and direct drag-and-drop swaps. The storage layer keeps
 * the old dense `box` registry key mirrored so existing captures remain safe.
 */
export class BoxScene extends Phaser.Scene {
  private parentKey = 'PokemonCenterScene';
  private boxPage = 0;
  private content!: Phaser.GameObjects.Container;
  private info!: Phaser.GameObjects.Text;
  private escKey!: Phaser.Input.Keyboard.Key;
  private selected?: StorageRef;
  private target?: StorageRef;
  private hits: HitTarget[] = [];
  private pressed?: { ref: StorageRef; x: number; y: number };
  private dragging = false;
  private dragGhost?: Phaser.GameObjects.Container;
  private lastHover = '';

  private get W() { return this.scale.width; }
  private get H() { return this.scale.height; }

  constructor() { super('BoxScene'); }
  init(data: { parentKey?: string }) { this.parentKey = data.parentKey ?? 'PokemonCenterScene'; }

  preload(): void {
    for (const entry of PartySystem.get(this.registry)) this.queueSprite(entry);
    for (const entry of PartySystem.getBox(this.registry)) this.queueSprite(entry);
  }

  create(): void {
    this.scene.bringToTop();
    this.cameras.main.fadeIn(180);
    this.drawChrome();
    this.content = this.add.container(0, 0);
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)
      .on('down', () => this.changePage(1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)
      .on('down', () => this.changePage(-1));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.changePage(dy > 0 ? 1 : -1));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer));
    this.events.once('shutdown', () => this.dragGhost?.destroy(true));
    this.render();
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.close();
  }

  private queueSprite(entry: PartyEntry): void {
    if (entry.spriteKey && entry.spriteUrl && !this.textures.exists(entry.spriteKey)) {
      this.load.image(entry.spriteKey, entry.spriteUrl);
    }
  }

  private drawChrome(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x06101e, 0x06101e, 0x122b43, 0x0a1727, 1);
    bg.fillRect(0, 0, this.W, this.H);
    bg.fillStyle(0x58d7ff, 0.06);
    for (let x = -this.H; x < this.W; x += 92) bg.fillRect(x, 0, 34, this.H);

    this.add.text(24, 22, t('ALL BOXES', '모든 박스'), {
      fontSize: '25px', color: '#f5fbff', fontStyle: 'bold', letterSpacing: 2,
    });
    this.add.text(24, 53, t('POKÉMON STORAGE SYSTEM', '포켓몬 보관 시스템'), {
      fontSize: '10px', color: '#7bcde8', letterSpacing: 2,
    });
    const close = this.add.text(this.W - 24, 32, t('B  RETURN', 'B  돌아가기'), {
      fontSize: '13px', color: '#dceafa', backgroundColor: '#152a40', padding: { x: 13, y: 8 },
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    close.on('pointerover', () => { close.setBackgroundColor('#274866'); sfxMove(this); });
    close.on('pointerout', () => close.setBackgroundColor('#152a40'));
    close.on('pointerdown', () => this.close());

    this.info = this.add.text(24, this.H - 30,
      t('Select or drag a Pokémon to move it.', '포켓몬을 선택하거나 드래그해서 옮기세요.'), {
        fontSize: '12px', color: '#b9cee1', fixedWidth: Math.max(300, this.W - 330),
      }).setOrigin(0, 0.5).setDepth(20);
  }

  private changePage(delta: number): void {
    const storage = PartySystem.getBoxes(this.registry);
    const next = Phaser.Math.Wrap(this.boxPage + delta, 0, storage.boxes.length);
    if (next === this.boxPage) return;
    this.boxPage = next;
    this.target = undefined;
    sfxMove(this);
    this.render();
  }

  private render(): void {
    this.content.removeAll(true);
    this.hits = [];
    const storage = PartySystem.getBoxes(this.registry);
    while (storage.boxes.length < MIN_BOX_COUNT) {
      storage.boxes.push({ name: `Box ${storage.boxes.length + 1}`, slots: Array(BOX_SLOT_COUNT).fill(null) });
    }
    if (this.boxPage >= storage.boxes.length) this.boxPage = 0;
    const party = PartySystem.get(this.registry);

    const margin = 22;
    const gap = 18;
    const leftW = Math.floor(this.W * 0.68);
    const rightX = margin + leftW + gap;
    const rightW = this.W - rightX - margin;
    const bodyY = 112;
    const bodyH = this.H - bodyY - 72;

    this.content.add(roundedPanel(this, margin, bodyY, leftW, bodyH, {
      fill: 0x0b1a2b, alpha: 0.94, stroke: 0x4b7ba0, radius: 18,
    }));
    this.content.add(roundedPanel(this, rightX, bodyY, rightW, bodyH, {
      fill: 0x101c2d, alpha: 0.95, stroke: 0x4e6d8c, radius: 18,
    }));

    this.drawBoxTabs(storage, margin, leftW);
    const current = storage.boxes[this.boxPage];
    this.content.add(this.add.text(margin + 18, bodyY + 15,
      t(`BOX ${this.boxPage + 1} · ${this.occupied(current.slots)}/${BOX_SLOT_COUNT}`,
        `박스 ${this.boxPage + 1} · ${this.occupied(current.slots)}/${BOX_SLOT_COUNT}`), {
        fontSize: '13px', color: '#a9dff2', fontStyle: 'bold',
      }));
    this.content.add(this.add.text(rightX + 18, bodyY + 15, t('CURRENT PARTY', '현재 동료'), {
      fontSize: '13px', color: '#ffe489', fontStyle: 'bold',
    }));

    this.drawBoxGrid(current.slots, margin, bodyY, leftW, bodyH);
    this.drawPartyGrid(party, rightX, bodyY, rightW, bodyH);
    this.drawAction();
    this.drawInfoButton();
    this.refreshInfo(storage, party);
  }

  private drawBoxTabs(storage: PokemonBoxStorage, x: number, width: number): void {
    const visible = Math.min(storage.boxes.length, 8);
    const tabW = Math.min(98, (width - 8) / visible);
    const startX = x + (width - tabW * visible) / 2;
    for (let i = 0; i < visible; i++) {
      const selected = i === this.boxPage;
      const tab = this.add.rectangle(startX + tabW * i + tabW / 2, 87, tabW - 5, 34,
        selected ? 0x2c8bb4 : 0x14283c, selected ? 0.98 : 0.84)
        .setStrokeStyle(1, selected ? 0x8ee9ff : 0x36536d, 0.9)
        .setInteractive({ useHandCursor: true });
      const count = this.occupied(storage.boxes[i].slots);
      const label = this.add.text(tab.x, tab.y, `${i + 1}  ${count}`, {
        fontSize: '11px', color: selected ? '#ffffff' : '#9cb3c8', fontStyle: 'bold',
      }).setOrigin(0.5);
      tab.on('pointerover', () => {
        tab.setFillStyle(selected ? 0x2c8bb4 : 0x214765);
        const key = `tab-${i}`;
        if (this.lastHover !== key) { this.lastHover = key; sfxMove(this); }
      });
      tab.on('pointerout', () => { tab.setFillStyle(selected ? 0x2c8bb4 : 0x14283c); this.lastHover = ''; });
      tab.on('pointerdown', () => {
        if (this.boxPage !== i) { this.boxPage = i; this.target = undefined; sfxConfirm(this); this.render(); }
      });
      this.content.add([tab, label]);
    }
  }

  private drawBoxGrid(slots: Array<PartyEntry | null>, x: number, y: number, width: number, height: number): void {
    const cols = 6;
    const rows = 5;
    const gap = 8;
    const padX = 14;
    const top = y + 44;
    const bottomPad = 14;
    const cellW = (width - padX * 2 - gap * (cols - 1)) / cols;
    const cellH = (height - 44 - bottomPad - gap * (rows - 1)) / rows;
    for (let slot = 0; slot < BOX_SLOT_COUNT; slot++) {
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const cx = x + padX + cellW / 2 + col * (cellW + gap);
      const cy = top + cellH / 2 + row * (cellH + gap);
      this.drawCard(slots[slot] ?? null, { kind: 'box', box: this.boxPage, slot }, cx, cy, cellW, cellH, false);
    }
  }

  private drawPartyGrid(party: PartyEntry[], x: number, y: number, width: number, height: number): void {
    const cols = 2;
    const rows = 3;
    const gap = 10;
    const pad = 12;
    const top = y + 44;
    const cellW = (width - pad * 2 - gap) / cols;
    const cellH = (height - 44 - pad - gap * 2) / rows;
    for (let index = 0; index < 6; index++) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const cx = x + pad + cellW / 2 + col * (cellW + gap);
      const cy = top + cellH / 2 + row * (cellH + gap);
      this.drawCard(party[index] ?? null, { kind: 'party', index }, cx, cy, cellW, cellH, true);
    }
  }

  private drawCard(
    entry: PartyEntry | null,
    ref: StorageRef,
    x: number,
    y: number,
    width: number,
    height: number,
    partyCard: boolean,
  ): void {
    const selected = this.sameRef(this.selected, ref);
    const targeted = this.sameRef(this.target, ref);
    const typeColor = entry ? (TYPE_COLORS as Record<string, number>)[entry.type1] ?? PROD_UI.line : 0x25384b;
    const bg = this.add.rectangle(x, y, width, height,
      selected ? 0x28556d : targeted ? 0x345b42 : entry ? 0x17283b : 0x0d1926,
      entry ? 0.98 : 0.68)
      .setStrokeStyle(selected || targeted ? 2 : 1,
        selected ? PROD_UI.yellow : targeted ? PROD_UI.green : entry ? typeColor : 0x2b4054,
        entry ? 0.9 : 0.5)
      .setInteractive({ useHandCursor: true });
    this.content.add(bg);
    this.hits.push({ ref, x, y, width, height });
    bg.on('pointerover', () => {
      if (!selected && !targeted) bg.setFillStyle(entry ? 0x223c56 : 0x172638, 0.98);
      const key = this.refKey(ref);
      if (this.lastHover !== key) { this.lastHover = key; sfxMove(this); }
    });
    bg.on('pointerout', () => { this.lastHover = ''; });
    bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (entry) this.pressed = { ref, x: pointer.x, y: pointer.y };
      else this.selectTarget(ref);
    });

    if (!entry) {
      this.content.add(this.add.text(x, y, '+', {
        fontSize: partyCard ? '20px' : '16px', color: '#36526a', fontStyle: 'bold',
      }).setOrigin(0.5));
      return;
    }

    this.content.add(this.add.rectangle(x - width / 2 + 4, y, 5, height - 10, typeColor, 0.95));
    const imageY = y - height * 0.12;
    const imageSize = Math.max(30, Math.min(partyCard ? 72 : 54, height * (partyCard ? 0.58 : 0.56), width * 0.62));
    if (this.textures.exists(entry.spriteKey)) {
      const image = this.add.image(x, imageY, entry.spriteKey);
      const source = this.textures.get(entry.spriteKey).getSourceImage();
      const dim = Math.max(Number(source.width) || 1, Number(source.height) || 1);
      image.setScale(imageSize / dim);
      this.content.add(image);
    } else {
      this.content.add(this.add.circle(x, imageY, imageSize * 0.38, typeColor, 0.55));
      this.content.add(this.add.text(x, imageY, typeName(entry.type1).slice(0, 1), {
        fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    const name = this.localName(entry);
    this.content.add(this.add.text(x, y + height * 0.25, name, {
      fontSize: partyCard ? '12px' : '10px', color: '#f5fbff', fontStyle: 'bold',
      fixedWidth: Math.max(30, width - 12), align: 'center',
    }).setOrigin(0.5, 0));
    this.content.add(this.add.text(x, y + height * 0.42, `Lv.${entry.level}`, {
      fontSize: partyCard ? '10px' : '8px', color: '#b6cae0',
    }).setOrigin(0.5, 0));

    if (partyCard) {
      const ratio = Phaser.Math.Clamp(entry.maxHp > 0 ? entry.hp / entry.maxHp : 0, 0, 1);
      const hpW = Math.max(32, width - 18);
      const hpY = y + height / 2 - 8;
      this.content.add(this.add.rectangle(x, hpY, hpW, 6, 0x07101c, 0.9));
      this.content.add(this.add.rectangle(x - hpW / 2, hpY, hpW * ratio, 5, hpColor(ratio)).setOrigin(0, 0.5));
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.pressed) return;
    if (!this.dragging && Phaser.Math.Distance.Between(this.pressed.x, this.pressed.y, pointer.x, pointer.y) > 9) {
      this.dragging = true;
      this.makeDragGhost(this.pressed.ref, pointer.x, pointer.y);
      sfxMove(this);
    }
    if (this.dragGhost) this.dragGhost.setPosition(pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.pressed) return;
    const source = this.pressed.ref;
    if (this.dragging) {
      const destination = this.hitAt(pointer.x, pointer.y);
      this.dragGhost?.destroy(true);
      this.dragGhost = undefined;
      this.dragging = false;
      this.pressed = undefined;
      if (destination && !this.sameRef(source, destination)) this.transfer(source, destination);
      else { sfxCancel(this); this.render(); }
      return;
    }
    this.pressed = undefined;
    this.selectTarget(source);
  }

  private makeDragGhost(ref: StorageRef, x: number, y: number): void {
    const entry = this.entryAt(ref);
    if (!entry) return;
    const ghost = this.add.container(x, y).setDepth(1000).setAlpha(0.9);
    ghost.add(this.add.rectangle(0, 0, 116, 82, 0x173b58, 0.96)
      .setStrokeStyle(2, PROD_UI.yellow, 0.95));
    if (this.textures.exists(entry.spriteKey)) {
      const image = this.add.image(0, -10, entry.spriteKey);
      const source = this.textures.get(entry.spriteKey).getSourceImage();
      image.setScale(48 / Math.max(Number(source.width) || 1, Number(source.height) || 1));
      ghost.add(image);
    }
    ghost.add(this.add.text(0, 27, this.localName(entry), {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold', fixedWidth: 108, align: 'center',
    }).setOrigin(0.5));
    this.dragGhost = ghost;
  }

  private selectTarget(ref: StorageRef): void {
    const occupied = !!this.entryAt(ref);
    if (!this.selected) {
      if (!occupied) return;
      this.selected = ref;
      this.target = undefined;
      sfxConfirm(this);
    } else if (this.sameRef(this.selected, ref)) {
      this.showDetails(ref);
      return;
    } else {
      this.target = ref;
      sfxMove(this);
    }
    this.render();
  }

  private drawAction(): void {
    if (!this.selected) return;
    let label = '';
    let action: (() => void) | undefined;
    if (this.target) {
      const occupied = !!this.entryAt(this.target);
      label = occupied ? t('SWAP', '교체') : t('MOVE', '이동');
      action = () => this.transfer(this.selected!, this.target!);
    } else if (this.selected.kind === 'party') {
      label = t('SEND TO THIS BOX', '현재 박스로 보내기');
      action = () => {
        const storage = PartySystem.getBoxes(this.registry);
        const free = storage.boxes[this.boxPage].slots.findIndex(slot => slot === null);
        if (free < 0) { this.setInfo(t('This box is full.', '현재 박스가 가득 찼습니다.')); sfxCancel(this); return; }
        this.transfer(this.selected!, { kind: 'box', box: this.boxPage, slot: free });
      };
    } else {
      label = t('ADD TO PARTY', '동료로 데려오기');
      action = () => {
        const party = PartySystem.get(this.registry);
        if (party.length >= 6) { this.setInfo(t('Your party is full.', '동료가 가득 찼습니다.')); sfxCancel(this); return; }
        this.transfer(this.selected!, { kind: 'party', index: party.length });
      };
    }
    const width = Math.min(240, Math.max(175, this.W * 0.19));
    const x = this.W - 24 - width / 2;
    const bg = this.add.rectangle(x, this.H - 31, width, 40, 0x267e9e, 0.98)
      .setStrokeStyle(1.5, 0x8ceaff).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, this.H - 31, `A  ${label}`, {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold', fixedWidth: width - 12, align: 'center',
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x37a8c9));
    bg.on('pointerout', () => bg.setFillStyle(0x267e9e));
    bg.on('pointerdown', action);
    this.content.add([bg, text]);
  }

  private drawInfoButton(): void {
    if (!this.selected || !this.entryAt(this.selected)) return;
    const actionWidth = Math.min(240, Math.max(175, this.W * 0.19));
    const width = 132;
    const x = this.W - 24 - actionWidth - 10 - width / 2;
    const bg = this.add.rectangle(x, this.H - 31, width, 40, 0x263d58, 0.98)
      .setStrokeStyle(1.5, 0x729ac0, 0.9).setInteractive({ useHandCursor: true });
    const label = this.add.text(x, this.H - 31, t('Y  SUMMARY', 'Y  정보'), {
      fontSize: '12px', color: '#f4f9ff', fontStyle: 'bold', fixedWidth: width - 10, align: 'center',
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x365c80));
    bg.on('pointerout', () => bg.setFillStyle(0x263d58));
    bg.on('pointerdown', () => this.showDetails(this.selected!));
    this.content.add([bg, label]);
  }

  private showDetails(ref: StorageRef): void {
    const entry = this.entryAt(ref);
    if (!entry) return;
    sfxConfirm(this);
    const mon = buildFromEntry(entry);
    const key = dexKeyFor(entry.spriteKey);
    const ability = entry.ability ?? findForm(entry.spriteKey)?.ability ?? dexEntry(key)?.ability
      ?? t('Unknown', '알 수 없음');
    const heldDef = entry.heldItem ? itemDef(entry.heldItem) : undefined;
    const held = heldDef ? itemName(heldDef) : entry.heldItem || t('None', '없음');
    const cx = this.W / 2;
    const cy = this.H / 2;
    const modalW = Math.min(this.W - 64, 840);
    const modalH = Math.min(this.H - 50, 580);
    const left = cx - modalW / 2;
    const top = cy - modalH / 2;
    const overlay = this.add.container(0, 0).setDepth(2000);
    const dim = this.add.rectangle(cx, cy, this.W, this.H, 0x01050a, 0.8).setInteractive();
    overlay.add(dim);
    overlay.add(roundedPanel(this, left, top, modalW, modalH, {
      fill: 0x0b1727, alpha: 0.99,
      stroke: (TYPE_COLORS as Record<string, number>)[entry.type1] ?? PROD_UI.cyan,
      radius: 22,
    }));
    const blocker = this.add.rectangle(cx, cy, modalW, modalH, 0xffffff, 0.001).setInteractive();
    overlay.add(blocker);

    const closeOverlay = () => { sfxCancel(this); overlay.destroy(true); };
    dim.on('pointerdown', closeOverlay);
    const close = this.add.text(left + modalW - 22, top + 22, t('B  CLOSE', 'B  닫기'), {
      fontSize: '11px', color: '#d7e6f5', backgroundColor: '#20374e', padding: { x: 10, y: 6 },
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', closeOverlay);
    overlay.add(close);

    overlay.add(this.add.text(left + 28, top + 20, t('POKÉMON SUMMARY', '포켓몬 정보'), {
      fontSize: '14px', color: '#7edfff', fontStyle: 'bold', letterSpacing: 2,
    }));
    overlay.add(this.add.text(left + 28, top + 47, this.localName(entry), {
      fontSize: '25px', color: '#ffffff', fontStyle: 'bold',
    }));
    overlay.add(this.add.text(left + modalW - 30, top + 52, `Lv.${entry.level}`, {
      fontSize: '18px', color: '#ffe487', fontStyle: 'bold',
    }).setOrigin(1, 0));

    const portraitX = left + 126;
    const portraitY = top + 160;
    const typeCol = (TYPE_COLORS as Record<string, number>)[entry.type1] ?? PROD_UI.line;
    overlay.add(this.add.circle(portraitX, portraitY, 78, typeCol, 0.14).setStrokeStyle(2, typeCol, 0.6));
    if (this.textures.exists(entry.spriteKey)) {
      const image = this.add.image(portraitX, portraitY, entry.spriteKey);
      const source = this.textures.get(entry.spriteKey).getSourceImage();
      image.setScale(132 / Math.max(Number(source.width) || 1, Number(source.height) || 1));
      overlay.add(image);
    }
    const types = [entry.type1, entry.type2].filter(Boolean) as string[];
    types.forEach((type, index) => {
      const x = portraitX - ((types.length - 1) * 48) + index * 96;
      const color = (TYPE_COLORS as Record<string, number>)[type] ?? PROD_UI.line;
      overlay.add(this.add.rectangle(x, top + 252, 88, 24, color, 0.94).setStrokeStyle(1, 0xffffff, 0.22));
      overlay.add(this.add.text(x, top + 252, typeName(type), {
        fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5));
    });

    const profileX = left + 258;
    const profileW = modalW - 288;
    const profileRows: Array<[string, string]> = [
      [t('ABILITY', '특성'), abilityName(ability, entry.abilityKo, entry.abilityJa)],
      [t('HELD ITEM', '지닌 물건'), held],
      [t('HP', '체력'), `${entry.hp} / ${entry.maxHp}`],
      [t('CONDITION', '상태'), entry.status && entry.status !== 'none' ? tr(entry.status) : t('Healthy', '정상')],
    ];
    profileRows.forEach(([label, value], index) => {
      const y = top + 104 + index * 43;
      overlay.add(this.add.rectangle(profileX + profileW / 2, y + 14, profileW, 36, 0x14283d, 0.96)
        .setStrokeStyle(1, 0x355b78, 0.62));
      overlay.add(this.add.text(profileX + 12, y + 2, label, { fontSize: '8px', color: '#7ba8c8', fontStyle: 'bold' }));
      overlay.add(this.add.text(profileX + 12, y + 15, value, {
        fontSize: '12px', color: '#f5fbff', fontStyle: 'bold', fixedWidth: profileW - 24,
      }));
    });

    const statsTop = top + 292;
    overlay.add(this.add.text(left + 28, statsTop, t('BATTLE STATS', '능력치'), {
      fontSize: '12px', color: '#ffe487', fontStyle: 'bold', letterSpacing: 1,
    }));
    const stats: Array<[string, number | string]> = [
      [t('HP', '체력'), mon.maxHp], [t('ATTACK', '공격'), mon.atk], [t('DEFENSE', '방어'), mon.def],
      [t('SP. ATK', '특수공격'), mon.spAtk], [t('SP. DEF', '특수방어'), mon.spDef], [t('SPEED', '스피드'), mon.spd],
    ];
    const statGap = 8;
    const statW = (modalW - 56 - statGap * 5) / 6;
    stats.forEach(([label, value], index) => {
      const x = left + 28 + statW / 2 + index * (statW + statGap);
      overlay.add(this.add.rectangle(x, statsTop + 43, statW, 54, 0x172d45, 0.98)
        .setStrokeStyle(1, 0x426a88, 0.7));
      overlay.add(this.add.text(x, statsTop + 31, label, {
        fontSize: '8px', color: '#92b0c9', align: 'center', fixedWidth: statW - 6,
      }).setOrigin(0.5));
      overlay.add(this.add.text(x, statsTop + 50, String(value), {
        fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5));
    });

    const movesTop = statsTop + 88;
    overlay.add(this.add.text(left + 28, movesTop, t('MOVES', '기술'), {
      fontSize: '12px', color: '#ffe487', fontStyle: 'bold', letterSpacing: 1,
    }));
    const moveGap = 10;
    const moveW = (modalW - 56 - moveGap) / 2;
    mon.moves.slice(0, 4).forEach((move, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = left + 28 + moveW / 2 + col * (moveW + moveGap);
      const y = movesTop + 34 + row * 48;
      const moveColor = (TYPE_COLORS as Record<string, number>)[move.data.type] ?? PROD_UI.line;
      overlay.add(this.add.rectangle(x, y, moveW, 40, 0x15283b, 0.98).setStrokeStyle(1.5, moveColor, 0.85));
      overlay.add(this.add.rectangle(x - moveW / 2 + 4, y, 6, 32, moveColor, 0.95));
      overlay.add(this.add.text(x - moveW / 2 + 14, y - 12, tr(move.data.name), {
        fontSize: '11px', color: '#ffffff', fontStyle: 'bold', fixedWidth: moveW - 80,
      }));
      overlay.add(this.add.text(x + moveW / 2 - 12, y, `PP ${move.pp}/${move.data.pp}`, {
        fontSize: '9px', color: '#c3d3e2',
      }).setOrigin(1, 0.5));
      overlay.add(this.add.text(x - moveW / 2 + 14, y + 7, typeName(move.data.type), {
        fontSize: '8px', color: '#95afc4',
      }));
    });
  }

  private transfer(source: StorageRef, destination: StorageRef): void {
    if (this.sameRef(source, destination)) return;
    const storage = PartySystem.getBoxes(this.registry);
    const party = PartySystem.get(this.registry);
    const get = (ref: StorageRef): PartyEntry | null => ref.kind === 'party'
      ? party[ref.index] ?? null
      : storage.boxes[ref.box]?.slots[ref.slot] ?? null;
    const moving = get(source);
    const displaced = get(destination);
    if (!moving) { this.setInfo(t('That Pokémon is no longer there.', '해당 위치에 포켓몬이 없습니다.')); return; }

    if (source.kind === 'party' && destination.kind === 'box') {
      if (!displaced && party.length <= 1) {
        this.setInfo(t('You must keep at least one Pokémon in your party.', '동료 포켓몬은 최소 한 마리 남겨야 합니다.'));
        sfxCancel(this);
        return;
      }
      if (displaced) {
        party[source.index] = displaced;
        storage.boxes[destination.box].slots[destination.slot] = moving;
      } else {
        party.splice(source.index, 1);
        storage.boxes[destination.box].slots[destination.slot] = moving;
      }
    } else if (source.kind === 'box' && destination.kind === 'party') {
      if (displaced) {
        party[destination.index] = moving;
        storage.boxes[source.box].slots[source.slot] = displaced;
      } else {
        if (party.length >= 6 || destination.index > party.length) {
          this.setInfo(t('Your party is full.', '동료가 가득 찼습니다.'));
          sfxCancel(this);
          return;
        }
        party.splice(destination.index, 0, moving);
        storage.boxes[source.box].slots[source.slot] = null;
      }
    } else if (source.kind === 'box' && destination.kind === 'box') {
      storage.boxes[source.box].slots[source.slot] = displaced;
      storage.boxes[destination.box].slots[destination.slot] = moving;
    } else if (source.kind === 'party' && destination.kind === 'party') {
      if (destination.index >= party.length) {
        const [entry] = party.splice(source.index, 1);
        party.push(entry);
      } else {
        [party[source.index], party[destination.index]] = [party[destination.index], party[source.index]];
      }
    }

    PartySystem.set(this.registry, party);
    PartySystem.setBoxes(this.registry, storage);
    PartySystem.syncStarterFromLead(this.registry);
    this.selected = undefined;
    this.target = undefined;
    sfxConfirm(this);
    this.setInfo(t(`${this.localName(moving)} was moved.`, `${this.localName(moving)}을(를) 옮겼습니다.`));
    this.render();
  }

  private refreshInfo(storage: PokemonBoxStorage, party: PartyEntry[]): void {
    if (!this.selected) {
      this.info.setText(t('Select or drag a Pokémon to move it.  ·  ← → changes boxes',
        '포켓몬을 선택하거나 드래그해서 옮기세요.  ·  ← → 박스 변경'));
      return;
    }
    const selected = this.entryAt(this.selected, storage, party);
    if (!selected) { this.selected = undefined; this.target = undefined; return; }
    const target = this.target ? this.entryAt(this.target, storage, party) : null;
    this.info.setText(target
      ? t(`${this.localName(selected)} → ${this.localName(target)} · Press A to swap`,
          `${this.localName(selected)} → ${this.localName(target)} · A로 교체`)
      : t(`${this.localName(selected)} selected · choose a destination or drag it`,
          `${this.localName(selected)} 선택됨 · 목적지를 고르거나 드래그하세요`));
  }

  private entryAt(
    ref: StorageRef,
    storage = PartySystem.getBoxes(this.registry),
    party = PartySystem.get(this.registry),
  ): PartyEntry | null {
    return ref.kind === 'party'
      ? party[ref.index] ?? null
      : storage.boxes[ref.box]?.slots[ref.slot] ?? null;
  }

  private hitAt(x: number, y: number): StorageRef | undefined {
    return this.hits.find(hit =>
      x >= hit.x - hit.width / 2 && x <= hit.x + hit.width / 2
      && y >= hit.y - hit.height / 2 && y <= hit.y + hit.height / 2)?.ref;
  }

  private localName(entry: PartyEntry): string {
    const key = dexKeyFor(entry.spriteKey);
    const english = entry.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return t(
      english,
      entry.nameKo ?? pokeName(key, pokeNameEn(entry.name)),
      entry.nameJa ?? pokeName(key, pokeNameEn(entry.name)),
    );
  }

  private occupied(slots: Array<PartyEntry | null>): number {
    return slots.reduce((total, entry) => total + (entry ? 1 : 0), 0);
  }

  private refKey(ref: StorageRef): string {
    return ref.kind === 'party' ? `p-${ref.index}` : `b-${ref.box}-${ref.slot}`;
  }

  private sameRef(a: StorageRef | undefined, b: StorageRef | undefined): boolean {
    if (!a || !b || a.kind !== b.kind) return false;
    return a.kind === 'party'
      ? a.index === (b as Extract<StorageRef, { kind: 'party' }>).index
      : a.box === (b as Extract<StorageRef, { kind: 'box' }>).box
        && a.slot === (b as Extract<StorageRef, { kind: 'box' }>).slot;
  }

  private setInfo(message: string): void { this.info.setText(message); }

  private close(): void {
    sfxCancel(this);
    this.cameras.main.fadeOut(150, 0, 0, 0, () => {
      this.scene.stop();
      this.scene.resume(this.parentKey);
    });
  }
}
