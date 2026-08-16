import Phaser from 'phaser';
import { BADGES } from '../data/Badges';
import { MAPAE } from '../data/Mapae';
import { LeaderboardApi, type LeaderboardCategory, type LeaderboardEntry } from '../systems/LeaderboardApi';
import { LeaderboardProgress } from '../systems/LeaderboardProgress';
import { getLang, t, tr } from '../systems/i18n';
import { fontScaleForScene } from '../systems/UiScale';
import { deckSetImmersiveView } from '../systems/TouchControls';

interface LeaderboardSceneData {
  returnTo?: 'TitleScene' | 'MenuScene';
  fixtureEntries?: LeaderboardEntry[];
  readOnly?: boolean;
}

const CATEGORIES: LeaderboardCategory[] = [
  'overall',
  'badge-1', 'badge-2', 'badge-3', 'badge-4', 'badge-5', 'badge-6', 'badge-7', 'badge-8',
  'mapae-1', 'mapae-2', 'mapae-3', 'mapae-4', 'mapae-5', 'mapae-6', 'mapae-7', 'mapae-8',
  'south-league', 'north-league', 'captures',
];

function formatTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return t('Previous save · time unknown', '이전 저장 · 시간 미상');
  const totalSeconds = Math.max(0, Math.floor(ms / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (getLang() === 'ko') return hours > 0 ? `${hours}시간 ${minutes}분 ${seconds}초` : `${minutes}분 ${seconds}초`;
  return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
}

function leagueCount(entry: { southLeagueCleared: boolean; northLeagueCleared: boolean }): number {
  return Number(entry.southLeagueCleared) + Number(entry.northLeagueCleared);
}

function leaderboardErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : '';
  if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
    return t(
      'Firebase setup is incomplete. Enable Anonymous sign-in, then press R to retry.',
      'Firebase 설정이 완료되지 않았습니다. 익명 로그인을 활성화한 뒤 R을 눌러 다시 시도하세요.',
    );
  }
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return t(
      'Leaderboard security rules are not deployed yet. Press R after deployment.',
      '리더보드 보안 규칙이 아직 배포되지 않았습니다. 배포 후 R을 눌러 다시 시도하세요.',
    );
  }
  return t(
    'Could not reach the leaderboard server. Press R to retry.',
    '리더보드 서버에 연결할 수 없습니다. R을 눌러 다시 시도하세요.',
  );
}

export class LeaderboardScene extends Phaser.Scene {
  private returnTo: 'TitleScene' | 'MenuScene' = 'TitleScene';
  private categoryIndex = 0;
  private page = 0;
  private entries: LeaderboardEntry[] = [];
  private fixtureEntries?: LeaderboardEntry[];
  private readOnly = false;
  private content!: Phaser.GameObjects.Container;
  private categoryText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;
  private rowsPerPage = 7;
  private compactMobile = false;
  private closed = false;
  /** Invalidates leaderboard requests that outlive this scene or a newer tab. */
  private refreshGeneration = 0;

  private get W() { return this.scale.width; }
  private get H() { return this.scale.height; }

  constructor() { super('LeaderboardScene'); }

  init(data: LeaderboardSceneData): void {
    this.returnTo = data.returnTo ?? 'TitleScene';
    this.fixtureEntries = data.fixtureEntries;
    this.readOnly = !!data.readOnly;
    this.categoryIndex = 0;
    this.page = 0;
    this.entries = [];
    this.closed = false;
    this.refreshGeneration = 0;
  }

  create(): void {
    deckSetImmersiveView(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Firebase requests can resolve after the leaderboard overlay has already
      // returned to the mobile menu. Never let that stale promise call setText()
      // on a destroyed Phaser canvas-backed Text object (null drawImage).
      this.closed = true;
      this.refreshGeneration += 1;
      deckSetImmersiveView(false);
    });
    this.scene.bringToTop();
    this.cameras.main.fadeIn(220);
    this.compactMobile = fontScaleForScene(this) > 1;
    this.rowsPerPage = this.compactMobile ? 5 : 7;
    this.drawChrome();
    this.setupInput();
    void this.refresh();
  }

  private drawChrome(): void {
    this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x030612, this.returnTo === 'MenuScene' ? 0.93 : 1);
    const halo = this.add.graphics();
    halo.fillGradientStyle(0x201063, 0x10194d, 0x050918, 0x050918, 0.86, 0.7, 0.2, 0.2);
    halo.fillRect(0, 0, this.W, this.H);

    this.add.rectangle(this.W / 2, this.H / 2 + 4, Math.min(this.W - 28, 1160), this.H - 34, 0x091126, 0.96)
      .setStrokeStyle(2, 0x7a68d7);
    this.add.text(this.W / 2, 37, t('ONLINE TRAINER LEADERBOARD', '온라인 트레이너 리더보드'), {
      fontSize: '25px', color: '#fff2a8', fontStyle: 'bold', stroke: '#30205f', strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(this.W / 2, 68,
      t('Anonymous records from trainers playing the GitHub Pages version', 'GitHub Pages 버전을 플레이한 트레이너들의 익명 기록'),
      { fontSize: this.compactMobile ? '15px' : '12px', color: '#aebbe5' }).setOrigin(0.5);

    this.add.text(this.W - 72, 39, t('✕ CLOSE', '✕ 닫기'), {
      fontSize: '13px', color: '#d8e0ff', backgroundColor: '#27345a', padding: { x: 12, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());

    const self = LeaderboardProgress.snapshot(this.registry);
    const code = LeaderboardApi.playerCode();
    const summary = self
      ? t(
        `${self.displayName}${code ? ` #${code}` : ''} · ${self.badgeCount}/8 badges · ${self.mapaeCount}/8 mapae · ${leagueCount(self)}/2 leagues · ${self.totalCaught} catches · ${formatTime(self.playMs)}`,
        `${self.displayName}${code ? ` #${code}` : ''} · 뱃지 ${self.badgeCount}/8 · 마패 ${self.mapaeCount}/8 · 리그 ${leagueCount(self)}/2 · 포획 ${self.totalCaught}마리 · ${formatTime(self.playMs)}`,
      )
      : t('Start a New Game to record your own run.', '새 게임을 시작하면 내 기록이 측정됩니다.');
    this.add.text(this.W / 2, 100, summary, {
      fontSize: this.compactMobile ? '16px' : '13px', color: '#dce6ff', backgroundColor: '#121d3e', padding: { x: 14, y: 7 },
      align: 'center', wordWrap: { width: this.W - 190 },
    }).setOrigin(0.5);

    for (const [x, label, direction] of [[this.W / 2 - 300, '◀', -1], [this.W / 2 + 300, '▶', 1]] as const) {
      this.add.text(x, 144, label, {
        fontSize: '25px', color: '#ffffff', backgroundColor: '#2a3767', padding: { x: 16, y: 5 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changeCategory(direction));
    }
    this.categoryText = this.add.text(this.W / 2, 144, '', {
      fontSize: '19px', color: '#ffe98a', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    this.statusText = this.add.text(this.W / 2, this.H - 28, '', {
      fontSize: this.compactMobile ? '14px' : '11px', color: '#8fa1ca', align: 'center', wordWrap: { width: this.W - 180 },
    }).setOrigin(0.5);

    for (const [x, label, direction] of [[this.W / 2 - 88, '‹', -1], [this.W / 2 + 88, '›', 1]] as const) {
      this.add.text(x, this.H - 61, label, {
        fontSize: '24px', color: '#dfe7ff', backgroundColor: '#1b2b50', padding: { x: 12, y: 0 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changePage(direction));
    }
    this.pageText = this.add.text(this.W / 2, this.H - 61, '1 / 1', { fontSize: '12px', color: '#b9c8ed' }).setOrigin(0.5);
    this.content = this.add.container(0, 0);
    this.updateCategoryText();
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.close());
    keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).on('down', () => this.changeCategory(-1));
    keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).on('down', () => this.changeCategory(1));
    keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.UP).on('down', () => this.changePage(-1));
    keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN).on('down', () => this.changePage(1));
    keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => void this.refresh());
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.changePage(dy > 0 ? 1 : -1));
  }

  private category(): LeaderboardCategory { return CATEGORIES[this.categoryIndex]; }

  private categoryLabel(category: LeaderboardCategory): string {
    if (category === 'overall') return t('OVERALL PROGRESS', '전체 진행도');
    if (category === 'south-league') return t('SOUTHERN LEAGUE CLEAR TIME', '남부 리그 클리어 시간');
    if (category === 'north-league') return t('NORTHERN LEAGUE CLEAR TIME', '북부 리그 클리어 시간');
    if (category === 'captures') return t('TOTAL WILD POKÉMON CAUGHT', '야생 포켓몬 총 포획 수');
    if (category.startsWith('mapae-')) {
      const index = Number(category.slice(6)) - 1;
      const mapae = MAPAE[index];
      return t(`MAPAE ${index + 1} · ${mapae?.city ?? ''}`, `${index + 1}번째 마패 · ${mapae?.cityKo ?? ''}`);
    }
    const index = Number(category.slice(6)) - 1;
    const badge = BADGES[index];
    return t(`BADGE ${index + 1} · ${badge?.name ?? ''}`, `${index + 1}번째 뱃지 · ${badge ? tr(badge.name) : ''}`);
  }

  private updateCategoryText(): void {
    this.categoryText.setText(`${this.categoryLabel(this.category())}  ${this.categoryIndex + 1}/${CATEGORIES.length}`);
  }

  private changeCategory(direction: number): void {
    this.categoryIndex = Phaser.Math.Wrap(this.categoryIndex + direction, 0, CATEGORIES.length);
    this.page = 0;
    this.updateCategoryText();
    void this.refresh();
  }

  private changePage(direction: number): void {
    const maxPage = Math.max(0, Math.ceil(this.entries.length / this.rowsPerPage) - 1);
    this.page = Phaser.Math.Clamp(this.page + direction, 0, maxPage);
    this.renderRows();
  }

  private async refresh(): Promise<void> {
    if (this.closed || !this.sys.isActive()) return;
    const generation = ++this.refreshGeneration;
    const category = this.category();
    this.statusText.setText(t('Loading records…', '기록을 불러오는 중…'));
    try {
      const snapshot = LeaderboardProgress.sync(this.registry);
      if (!this.fixtureEntries && !this.readOnly && LeaderboardApi.configured()) {
        await LeaderboardApi.submitNow(snapshot);
      }
      const response = this.fixtureEntries
        ? { entries: this.fixtureEntries, category, updatedAt: Date.now() }
        : await LeaderboardApi.fetch(category);
      if (!this.canApplyRefresh(generation) || category !== this.category()) return;
      this.entries = response.entries;
      this.page = Math.min(this.page, Math.max(0, Math.ceil(this.entries.length / this.rowsPerPage) - 1));
      this.renderRows();
      if (this.fixtureEntries) {
        this.statusText.setText(t('UI test records · ← → category · ↑ ↓ page · R refresh', 'UI 테스트 기록 · ← → 항목 · ↑ ↓ 페이지 · R 새로고침'));
      } else if (!LeaderboardApi.configured()) {
        this.statusText.setText(t(
          'Shared server is not configured yet. Your run is still recorded locally and will upload after the API is connected.',
          '공용 서버가 아직 연결되지 않았습니다. 내 기록은 로컬에 계속 측정되며 API 연결 후 업로드됩니다.',
        ));
      } else {
        this.statusText.setText(t('← → category · ↑ ↓ page · R refresh · records are anonymous', '← → 항목 · ↑ ↓ 페이지 · R 새로고침 · 모든 기록은 익명입니다'));
      }
    } catch (error) {
      console.warn('[leaderboard] display failed:', error);
      if (!this.canApplyRefresh(generation)) return;
      this.entries = [];
      this.renderRows();
      this.statusText.setText(leaderboardErrorMessage(error));
    }
  }

  private canApplyRefresh(generation: number): boolean {
    return !this.closed
      && generation === this.refreshGeneration
      && this.sys.isActive()
      && !!this.statusText?.active
      && !!this.content?.active;
  }

  private renderRows(): void {
    this.content.destroy(true);
    this.content = this.add.container(0, 0);
    const left = 82;
    const right = this.W - 82;
    const top = 184;
    const bottom = this.H - 92;
    const rowH = (bottom - top) / this.rowsPerPage;
    const headers = [
      { x: left + 25, value: t('RANK', '순위'), origin: 0.5 },
      { x: left + 90, value: t('TRAINER', '트레이너'), origin: 0 },
      { x: this.W * 0.50, value: t('RECORD', '기록'), origin: 0.5 },
      { x: right - 12, value: t('PROGRESS / CAPTURES', '진행도 / 포획'), origin: 1 },
    ];
    headers.forEach(header => this.content.add(this.add.text(header.x, top - 15, header.value, {
      fontSize: this.compactMobile ? '14px' : '11px', color: '#7f91bd', fontStyle: 'bold',
    }).setOrigin(header.origin, 0.5)));

    const visible = this.entries.slice(this.page * this.rowsPerPage, (this.page + 1) * this.rowsPerPage);
    if (visible.length === 0) {
      this.content.add(this.add.text(this.W / 2, top + (bottom - top) / 2,
        LeaderboardApi.configured() || this.fixtureEntries
          ? t('No qualifying records yet.', '아직 이 항목의 기록이 없습니다.')
          : t('Connect the shared API to display worldwide records.', '공용 API를 연결하면 전체 사용자 기록이 표시됩니다.'),
        { fontSize: '17px', color: '#aab7d9', align: 'center' }).setOrigin(0.5));
    }

    visible.forEach((entry, row) => {
      const y = top + row * rowH + rowH / 2;
      const mine = !!entry.isMine;
      const fill = mine ? 0x243969 : (row % 2 === 0 ? 0x111d39 : 0x0d1830);
      this.content.add(this.add.rectangle(this.W / 2, y, right - left, rowH - 7, fill, 0.97)
        .setStrokeStyle(mine ? 2 : 1, mine ? 0xffde67 : 0x233b66));
      const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}`;
      this.content.add(this.add.text(left + 25, y, medal, { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
      this.content.add(this.add.text(left + 90, y, `${entry.displayName}  #${entry.playerCode}`, {
        fontSize: this.compactMobile ? '17px' : '14px', color: mine ? '#ffe98a' : '#eef3ff', fontStyle: mine ? 'bold' : 'normal',
      }).setOrigin(0, 0.5));
      this.content.add(this.add.text(this.W * 0.50, y, this.recordText(entry), {
        fontSize: this.compactMobile ? '17px' : '14px', color: '#aee6ff', fontStyle: 'bold', align: 'center',
      }).setOrigin(0.5));
      this.content.add(this.add.text(right - 12, y,
        t(`${entry.badgeCount}/8 badges · ${entry.mapaeCount}/8 mapae · ${leagueCount(entry)}/2 leagues · ${entry.totalCaught} caught`,
          `뱃지 ${entry.badgeCount}/8 · 마패 ${entry.mapaeCount}/8 · 리그 ${leagueCount(entry)}/2 · 포획 ${entry.totalCaught}`), {
          fontSize: this.compactMobile ? '15px' : '12px', color: '#bac8e8', align: 'right',
        }).setOrigin(1, 0.5));
    });

    const pages = Math.max(1, Math.ceil(this.entries.length / this.rowsPerPage));
    this.pageText.setText(`${this.page + 1} / ${pages}`);
  }

  private recordText(entry: LeaderboardEntry): string {
    const category = this.category();
    if (category === 'captures') return t(`${entry.totalCaught} wild catches`, `야생 포켓몬 ${entry.totalCaught}마리`);
    if (category === 'south-league') return formatTime(entry.southLeagueMs);
    if (category === 'north-league') return formatTime(entry.northLeagueMs);
    if (category.startsWith('badge-')) return formatTime(entry.badgeTimes[Number(category.slice(6)) - 1] ?? null);
    if (category.startsWith('mapae-')) return formatTime(entry.mapaeTimes[Number(category.slice(6)) - 1] ?? null);
    return formatTime(entry.playMs);
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true;
    this.cameras.main.fadeOut(160, 0, 0, 0, () => {
      if (this.returnTo === 'MenuScene'
        && (this.scene.isActive('MenuScene') || this.scene.isPaused('MenuScene'))) {
        this.scene.stop('LeaderboardScene');
        this.scene.resume('MenuScene');
      } else {
        this.scene.start('TitleScene');
      }
    });
  }
}
