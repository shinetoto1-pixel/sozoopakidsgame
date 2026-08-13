// ---------- 탱크 대작전 ----------

const GAME_W = 480;
const GAME_H = 800;

const CELL = 32;
const GRID = 13;
const ARENA_LEFT = (GAME_W - GRID * CELL) / 2;
const ARENA_TOP = 90;
const ARENA_SIZE = GRID * CELL;
const ARENA_BOTTOM = ARENA_TOP + ARENA_SIZE;

const TANK_SIZE = 24;
const TANK_HALF = TANK_SIZE / 2;
const BULLET_R = 4;

const BASE_POS = { row: 12, col: 6 };
const PLAYER_SPAWN = { row: 11, col: 6 };
const ENEMY_SPAWNS = [{ row: 0, col: 1 }, { row: 0, col: 6 }, { row: 0, col: 11 }];
const NOOK_BRICKS = [{ row: 11, col: 5 }, { row: 11, col: 7 }, { row: 12, col: 5 }, { row: 12, col: 7 }];

const MAX_CONCURRENT_ENEMIES = 4;
const STAR_DROP_CHANCE = 0.15;
const START_LIVES = 3;

const JOY_CENTER = { x: 108, y: 668 };
const JOY_RADIUS = 54;
const KNOB_RADIUS = 26;
const FIRE_CENTER = { x: 380, y: 668 };
const FIRE_RADIUS = 46;

const LEVEL_STATS = {
  1: { cooldown: 550, bulletSpeed: 260, maxBullets: 1, breaksSteel: false },
  2: { cooldown: 400, bulletSpeed: 300, maxBullets: 1, breaksSteel: false },
  3: { cooldown: 260, bulletSpeed: 320, maxBullets: 2, breaksSteel: false },
  4: { cooldown: 180, bulletSpeed: 360, maxBullets: 2, breaksSteel: true },
};

const ENEMY_TYPES = {
  basic: { speed: 70, hp: 1, fireMin: 1800, fireMax: 3200, dirMin: 1000, dirMax: 2200, color: 0xb0b0b0, points: 100 },
  fast: { speed: 118, hp: 1, fireMin: 1500, fireMax: 2600, dirMin: 600, dirMax: 1400, color: 0x4ecdc4, points: 150 },
  armored: { speed: 48, hp: 3, fireMin: 2000, fireMax: 3400, dirMin: 1400, dirMax: 2800, color: 0xc0392b, points: 300 },
  star: { speed: 70, hp: 1, fireMin: 1800, fireMax: 3200, dirMin: 1000, dirMax: 2200, color: 0xff6bcb, points: 200, guaranteedStar: true },
};

const DIRS = {
  up: { x: 0, y: -1, angle: 0 },
  right: { x: 1, y: 0, angle: 90 },
  down: { x: 0, y: 1, angle: 180 },
  left: { x: -1, y: 0, angle: 270 },
};

// 13x13 스테이지 맵 (.=빈칸 #=벽돌 S=강철), 좌우 대칭으로 디자인
const STAGE_TEMPLATES = [
  // 1단계 - 기본형
  [
    '.............',
    '.............',
    '..##.....##..',
    '..##.....##..',
    '.............',
    '....##.##....',
    '.............',
    '....##.##....',
    '.............',
    '..##.....##..',
    '..##.....##..',
    '.............',
    '.............',
  ],
  // 2단계 - 미로형
  [
    '.............',
    '.###.....###.',
    '.............',
    '...###.###...',
    '.............',
    '.....###.....',
    '.............',
    '.....###.....',
    '.............',
    '...###.###...',
    '.............',
    '.###.....###.',
    '.............',
  ],
  // 3단계 - 요새형
  [
    '.............',
    '.............',
    '..S.......S..',
    '..S.......S..',
    '..###...###..',
    '.............',
    '....SSSSS....',
    '.............',
    '...#.....#...',
    '...#.SSS.#...',
    '...#.....#...',
    '.............',
    '.............',
  ],
  // 4단계 - 개방형
  [
    '.............',
    '.............',
    '.............',
    '.....#.#.....',
    '.............',
    '.............',
    '......S......',
    '.............',
    '.............',
    '.....#.#.....',
    '.............',
    '.............',
    '.............',
  ],
  // 5단계 - 결전형
  [
    '.............',
    '.#.#.....#.#.',
    '.#.#.....#.#.',
    '.............',
    '..S##...##S..',
    '..S##...##S..',
    '.............',
    '....#.S.#....',
    '.............',
    '..###...###..',
    '..###...###..',
    '.............',
    '.............',
  ],
];

class SoundFX {
  constructor() { this.ctx = null; }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq, dur, type = 'sine', vol = 0.15, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  shoot() { this.tone(500, 0.07, 'square', 0.1); }
  hitWall() { this.tone(280, 0.06, 'square', 0.1); }
  explode(big) { this.tone(big ? 110 : 160, big ? 0.35 : 0.18, 'sawtooth', big ? 0.18 : 0.13); }
  star() { [660, 880, 1100].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.14, i * 0.06)); }
  stageClear() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.14, i * 0.09)); }
  gameOver() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'sawtooth', 0.1, i * 0.13)); }
}

class TankScene extends Phaser.Scene {
  constructor() { super('tank'); }

  create() {
    this.sfx = new SoundFX();
    this.playing = false;
    this.score = 0;
    this.lives = START_LIVES;
    this.stage = 1;
    this.cycle = 0;
    this.playerLevel = 1;
    this.invuln = false;
    this.moveDir = null;
    this.facing = 'up';
    this.fireHeld = false;
    this.fireCooldownLeft = 0;
    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.pickups = [];
    this.grid = null;
    this.baseAlive = true;

    this.drawBackground();
    this.buildTextures();
    this.buildControls();
    this.buildUI();
    this.buildOverlay();

    this.gridLayer = this.add.container(0, 0);
    this.entityLayer = this.add.container(0, 0);

    this.input.on('pointerup', () => { this.fireHeld = false; });

    this.overlay.setVisible(true);
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillStyle(0x1c1c1c, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(ARENA_LEFT, ARENA_TOP, ARENA_SIZE, ARENA_SIZE);
    g.lineStyle(3, 0x555555, 1);
    g.strokeRect(ARENA_LEFT, ARENA_TOP, ARENA_SIZE, ARENA_SIZE);
  }

  buildTextures() {
    // 벽돌
    let g = this.add.graphics();
    g.fillStyle(0xb35a3a, 1);
    g.fillRect(0, 0, CELL, CELL);
    g.lineStyle(1.5, 0x7a3a22, 1);
    g.strokeRect(0, 0, CELL, CELL);
    g.beginPath(); g.moveTo(0, CELL * 0.33); g.lineTo(CELL, CELL * 0.33); g.strokePath();
    g.beginPath(); g.moveTo(0, CELL * 0.66); g.lineTo(CELL, CELL * 0.66); g.strokePath();
    g.beginPath(); g.moveTo(CELL * 0.5, 0); g.lineTo(CELL * 0.5, CELL * 0.33); g.strokePath();
    g.beginPath(); g.moveTo(CELL * 0.2, CELL * 0.33); g.lineTo(CELL * 0.2, CELL * 0.66); g.strokePath();
    g.beginPath(); g.moveTo(CELL * 0.8, CELL * 0.33); g.lineTo(CELL * 0.8, CELL * 0.66); g.strokePath();
    g.beginPath(); g.moveTo(CELL * 0.5, CELL * 0.66); g.lineTo(CELL * 0.5, CELL); g.strokePath();
    g.generateTexture('brick', CELL, CELL);
    g.destroy();

    // 강철
    g = this.add.graphics();
    g.fillStyle(0x8a95a0, 1);
    g.fillRect(0, 0, CELL, CELL);
    g.fillStyle(0xaeb8c2, 1);
    g.fillRect(2, 2, CELL / 2 - 3, CELL / 2 - 3);
    g.fillRect(CELL / 2 + 1, CELL / 2 + 1, CELL / 2 - 3, CELL / 2 - 3);
    g.fillStyle(0x5c6670, 1);
    g.fillRect(CELL / 2 + 1, 2, CELL / 2 - 3, CELL / 2 - 3);
    g.fillRect(2, CELL / 2 + 1, CELL / 2 - 3, CELL / 2 - 3);
    g.lineStyle(1, 0x3d454d, 1);
    g.strokeRect(0, 0, CELL, CELL);
    g.generateTexture('steel', CELL, CELL);
    g.destroy();

    // 기지
    this.makeEmojiTexture('base_icon', '🛡️', CELL);

    // 탱크 텍스처들 (전방=위쪽)
    this.drawTankTexture('tank_player', 0xffd93d, 0xc9a622);
    Object.keys(ENEMY_TYPES).forEach((key) => {
      this.drawTankTexture('tank_' + key, ENEMY_TYPES[key].color, this.shade(ENEMY_TYPES[key].color, 0.7));
    });

    // 탄환
    g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(BULLET_R + 2, BULLET_R + 2, BULLET_R);
    g.generateTexture('bullet', (BULLET_R + 2) * 2, (BULLET_R + 2) * 2);
    g.destroy();

    // 별 파워업 + 반짝이
    this.makeEmojiTexture('star_pickup', '⭐', 40);
    g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('spark', 12, 12);
    g.destroy();
  }

  shade(color, factor) {
    const c = Phaser.Display.Color.IntegerToColor(color);
    return Phaser.Display.Color.GetColor(c.red * factor, c.green * factor, c.blue * factor);
  }

  drawTankTexture(key, bodyColor, darkColor) {
    const s = TANK_SIZE + 8;
    const cx = s / 2, cy = s / 2;
    const g = this.add.graphics();
    g.fillStyle(darkColor, 1);
    g.fillRect(cx - TANK_SIZE / 2 - 2, cy - TANK_SIZE / 2, 4, TANK_SIZE);
    g.fillRect(cx + TANK_SIZE / 2 - 2, cy - TANK_SIZE / 2, 4, TANK_SIZE);
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(cx - TANK_SIZE / 2, cy - TANK_SIZE / 2, TANK_SIZE, TANK_SIZE, 4);
    g.fillStyle(darkColor, 1);
    g.fillCircle(cx, cy, TANK_SIZE * 0.32);
    g.fillStyle(bodyColor, 1);
    g.fillRect(cx - 2, cy - TANK_SIZE / 2 - 4, 4, TANK_SIZE / 2);
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(cx - TANK_SIZE / 2 + 2, cy - TANK_SIZE / 2 + 2, TANK_SIZE * 0.35, TANK_SIZE * 0.25);
    g.generateTexture(key, s, s);
    g.destroy();
  }

  makeEmojiTexture(key, emoji, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.font = Math.floor(size * 0.75) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 1);
    this.textures.addCanvas(key, canvas);
  }

  buildControls() {
    this.add.circle(JOY_CENTER.x, JOY_CENTER.y, JOY_RADIUS, 0xffffff, 0.12).setStrokeStyle(3, 0xffffff, 0.4);
    this.joyKnob = this.add.circle(JOY_CENTER.x, JOY_CENTER.y, KNOB_RADIUS, 0xffffff, 0.55).setDepth(40);

    this.fireBtnCircle = this.add.circle(FIRE_CENTER.x, FIRE_CENTER.y, FIRE_RADIUS, 0xff5c5c, 0.35).setStrokeStyle(3, 0xffffff, 0.5);
    this.add.text(FIRE_CENTER.x, FIRE_CENTER.y, '🔥', { fontSize: '34px' }).setOrigin(0.5);

    this.joyZone = this.add.zone(JOY_CENTER.x, JOY_CENTER.y, JOY_RADIUS * 2.4, JOY_RADIUS * 2.4).setInteractive();
    this.input.setDraggable(this.joyZone);
    this.joyZone.on('dragstart', () => { this.sfx.ensure(); });
    this.input.on('drag', (pointer, gameObject) => {
      if (gameObject === this.joyZone) this.updateJoystick(pointer.x, pointer.y);
    });
    this.joyZone.on('dragend', () => {
      this.joyKnob.setPosition(JOY_CENTER.x, JOY_CENTER.y);
      this.moveDir = null;
    });

    this.fireZone = this.add.zone(FIRE_CENTER.x, FIRE_CENTER.y, FIRE_RADIUS * 2.2, FIRE_RADIUS * 2.2).setInteractive();
    this.fireZone.on('pointerdown', (p, lx, ly, ev) => {
      ev.stopPropagation(); this.sfx.ensure(); this.fireHeld = true;
      this.fireBtnCircle.setFillStyle(0xff5c5c, 0.6);
    });
    this.fireZone.on('pointerup', () => { this.fireHeld = false; this.fireBtnCircle.setFillStyle(0xff5c5c, 0.35); });
    this.fireZone.on('pointerout', () => { this.fireBtnCircle.setFillStyle(0xff5c5c, 0.35); });
  }

  updateJoystick(px, py) {
    const dx = px - JOY_CENTER.x, dy = py - JOY_CENTER.y;
    const mag = Math.hypot(dx, dy);
    const dist = Math.min(mag, JOY_RADIUS);
    const angle = Math.atan2(dy, dx);
    this.joyKnob.setPosition(JOY_CENTER.x + Math.cos(angle) * dist, JOY_CENTER.y + Math.sin(angle) * dist);
    if (mag > 14) {
      this.moveDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    } else {
      this.moveDir = null;
    }
  }

  buildUI() {
    this.scoreText = this.add.text(16, 16, '점수 0', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setShadow(1, 2, '#00000055', 2);
    this.stageText = this.add.text(16, 44, '스테이지 1', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#ffffffbb',
    });
    this.livesText = this.add.text(GAME_W - 16, 16, '♥ x3', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#ff6b6b', fontStyle: 'bold',
    }).setOrigin(1, 0).setShadow(1, 2, '#00000055', 2);
    this.levelText = this.add.text(GAME_W - 16, 44, 'LV 1', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#ffd93dcc',
    }).setOrigin(1, 0);
  }

  buildOverlay() {
    this.overlay = this.add.container(0, 0).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0);
    this.overlayTitle = this.add.text(GAME_W / 2, GAME_H / 2 - 110, '탱크 대작전 🪖', {
      fontFamily: 'sans-serif', fontSize: '30px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(2, 3, '#00000088', 4);
    this.overlaySub = this.add.text(GAME_W / 2, GAME_H / 2 - 30, '조이스틱으로 이동, 버튼으로 발사!\n별을 먹으면 탱크가 강해져요.\n우리 기지 🛡️ 를 꼭 지켜주세요!', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffffdd', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);
    this.overlayBtn = this.add.text(GAME_W / 2, GAME_H / 2 + 70, '시작하기 ▶', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#2b2b2b', fontStyle: 'bold', backgroundColor: '#ffd93d',
      padding: { x: 26, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.overlayBtn.on('pointerdown', () => { this.sfx.ensure(); this.startRun(); });
    this.overlay.add([dim, this.overlayTitle, this.overlaySub, this.overlayBtn]);

    this.stageBanner = this.add.text(GAME_W / 2, GAME_H / 2, '', {
      fontFamily: 'sans-serif', fontSize: '34px', color: '#ffffff', fontStyle: 'bold', backgroundColor: '#00000099',
      padding: { x: 24, y: 14 },
    }).setOrigin(0.5).setDepth(45).setVisible(false);
  }

  // ---------- 좌표 헬퍼 ----------
  cellCenter(row, col) {
    return { x: ARENA_LEFT + col * CELL + CELL / 2, y: ARENA_TOP + row * CELL + CELL / 2 };
  }
  cellAt(x, y) {
    return { row: Math.floor((y - ARENA_TOP) / CELL), col: Math.floor((x - ARENA_LEFT) / CELL) };
  }
  cellBlocked(row, col) {
    if (row < 0 || row >= GRID || col < 0 || col >= GRID) return true;
    return this.grid[row][col].type !== 'empty';
  }
  canOccupy(x, y) {
    if (x - TANK_HALF < ARENA_LEFT || x + TANK_HALF > ARENA_LEFT + ARENA_SIZE) return false;
    if (y - TANK_HALF < ARENA_TOP || y + TANK_HALF > ARENA_BOTTOM) return false;
    const corners = [
      [x - TANK_HALF, y - TANK_HALF], [x + TANK_HALF, y - TANK_HALF],
      [x - TANK_HALF, y + TANK_HALF], [x + TANK_HALF, y + TANK_HALF],
    ];
    for (const [cx, cy] of corners) {
      const c = this.cellAt(cx, cy);
      if (this.cellBlocked(c.row, c.col)) return false;
    }
    return true;
  }

  nearestCellCenter(v, arenaStart) {
    const idx = Math.round((v - arenaStart - CELL / 2) / CELL);
    return arenaStart + idx * CELL + CELL / 2;
  }

  // 좁은 통로 코너에 걸리지 않도록 진행축과 수직인 축을 셀 중심 쪽으로 살짝 보정하며 이동
  attemptMove(sprite, dir, speed, dt) {
    const d = DIRS[dir];
    let nx = sprite.x + d.x * speed * dt;
    let ny = sprite.y + d.y * speed * dt;
    if (d.x !== 0) ny = Phaser.Math.Linear(sprite.y, this.nearestCellCenter(sprite.y, ARENA_TOP), Math.min(1, dt * 6));
    else nx = Phaser.Math.Linear(sprite.x, this.nearestCellCenter(sprite.x, ARENA_LEFT), Math.min(1, dt * 6));
    if (this.canOccupy(nx, ny)) { sprite.setPosition(nx, ny); return true; }
    const nx2 = sprite.x + d.x * speed * dt;
    const ny2 = sprite.y + d.y * speed * dt;
    if (this.canOccupy(nx2, ny2)) { sprite.setPosition(nx2, ny2); return true; }
    return false;
  }

  // ---------- 맵 구성 ----------
  buildGrid(stageIdx) {
    const template = STAGE_TEMPLATES[stageIdx % STAGE_TEMPLATES.length];
    const grid = [];
    for (let r = 0; r < GRID; r++) {
      const row = [];
      for (let c = 0; c < GRID; c++) {
        const ch = template[r][c];
        let type = 'empty';
        if (ch === '#') type = 'brick';
        else if (ch === 'S') type = 'steel';
        row.push({ type, sprite: null });
      }
      grid.push(row);
    }
    NOOK_BRICKS.forEach(({ row, col }) => { grid[row][col].type = 'brick'; });
    grid[BASE_POS.row][BASE_POS.col].type = 'base';
    grid[PLAYER_SPAWN.row][PLAYER_SPAWN.col].type = 'empty';
    ENEMY_SPAWNS.forEach(({ row, col }) => { grid[row][col].type = 'empty'; });
    return grid;
  }

  renderGrid() {
    this.gridLayer.removeAll(true);
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const cell = this.grid[r][c];
        if (cell.type === 'empty') { cell.sprite = null; continue; }
        const p = this.cellCenter(r, c);
        const tex = cell.type === 'brick' ? 'brick' : cell.type === 'steel' ? 'steel' : 'base_icon';
        const sprite = this.add.sprite(p.x, p.y, tex).setDepth(1);
        this.gridLayer.add(sprite);
        cell.sprite = sprite;
      }
    }
  }

  destroyCell(row, col) {
    const cell = this.grid[row][col];
    if (cell.sprite) {
      const sp = cell.sprite;
      this.tweens.add({ targets: sp, alpha: 0, scale: 0.4, duration: 130, onComplete: () => sp.destroy() });
    }
    cell.type = 'empty';
    cell.sprite = null;
  }

  // ---------- 진행 관리 ----------
  startRun() {
    this.overlay.setVisible(false);
    this.score = 0;
    this.lives = START_LIVES;
    this.stage = 1;
    this.cycle = 0;
    this.playerLevel = 1;
    this.updateScoreText();
    this.updateLivesText();
    this.updateLevelText();
    this.startStage();
  }

  startStage() {
    this.playing = true;
    this.clearEntities();
    this.grid = this.buildGrid(this.stage - 1);
    this.renderGrid();
    this.baseAlive = true;

    const p = this.cellCenter(PLAYER_SPAWN.row, PLAYER_SPAWN.col);
    if (this.playerSprite) this.playerSprite.destroy();
    this.playerSprite = this.add.sprite(p.x, p.y, 'tank_player').setDepth(3);
    this.entityLayer.add(this.playerSprite);
    this.facing = 'up';
    this.moveDir = null;
    this.invuln = true;
    this.time.delayedCall(1200, () => { this.invuln = false; });

    this.stageText.setText('스테이지 ' + this.stage + (this.cycle > 0 ? ' (+' + this.cycle + ')' : ''));

    this.stageQueue = this.buildStageQueue();
    this.spawnCooldown = 400;
  }

  clearEntities() {
    this.enemies.forEach((e) => e.sprite.destroy());
    this.enemies = [];
    this.playerBullets.forEach((b) => b.sprite.destroy());
    this.playerBullets = [];
    this.enemyBullets.forEach((b) => b.sprite.destroy());
    this.enemyBullets = [];
    this.pickups.forEach((p) => p.sprite.destroy());
    this.pickups = [];
  }

  buildStageQueue() {
    const baseCounts = [10, 12, 14, 16, 18];
    const total = baseCounts[this.stage - 1] + this.cycle * 4;
    const list = [];
    for (let i = 0; i < total; i++) {
      const armoredChance = Math.min(0.35, 0.08 + this.stage * 0.05 + this.cycle * 0.05);
      const fastChance = Math.min(0.35, 0.12 + this.stage * 0.04 + this.cycle * 0.04);
      const starChance = 0.08;
      const r = Math.random();
      let type;
      if (r < starChance) type = 'star';
      else if (r < starChance + armoredChance) type = 'armored';
      else if (r < starChance + armoredChance + fastChance) type = 'fast';
      else type = 'basic';
      list.push(type);
    }
    return list;
  }

  updateScoreText() { this.scoreText.setText('점수 ' + this.score); }
  updateLivesText() { this.livesText.setText('♥ x' + this.lives); }
  updateLevelText() { this.levelText.setText('LV ' + this.playerLevel); }

  // ---------- 메인 루프 ----------
  update(time, delta) {
    if (!this.playing) return;
    const dt = Math.min(delta, 50) / 1000;

    this.updatePlayer(dt);
    this.updateEnemies(dt, time);
    this.updateBullets(dt, this.playerBullets, 'enemy');
    this.updateBullets(dt, this.enemyBullets, 'player');
    this.updatePickups();
    this.trySpawnEnemy(dt);

    if (this.fireHeld) this.tryPlayerFire(dt);
    else if (this.fireCooldownLeft > 0) this.fireCooldownLeft -= dt * 1000;

    this.checkStageClear();
  }

  updatePlayer(dt) {
    if (this.moveDir) {
      this.facing = this.moveDir;
      const speed = this.playerLevel >= 4 ? 122 : 100;
      this.attemptMove(this.playerSprite, this.moveDir, speed, dt);
    }
    this.playerSprite.setAngle(DIRS[this.facing].angle);
    if (this.invuln) {
      this.playerSprite.setAlpha(Math.sin(this.time.now / 60) > 0 ? 1 : 0.3);
    } else {
      this.playerSprite.setAlpha(1);
    }
  }

  tryPlayerFire(dt) {
    if (this.fireCooldownLeft > 0) { this.fireCooldownLeft -= dt * 1000; return; }
    const stats = LEVEL_STATS[this.playerLevel];
    if (this.playerBullets.length >= stats.maxBullets) return;
    this.spawnBullet(this.playerSprite.x, this.playerSprite.y, this.facing, 'player', stats.bulletSpeed, stats.breaksSteel);
    this.fireCooldownLeft = stats.cooldown;
    this.sfx.shoot();
  }

  spawnBullet(x, y, dir, owner, speed, breaksSteel, ownerRef) {
    const d = DIRS[dir];
    const sprite = this.add.sprite(x + d.x * (TANK_HALF + 4), y + d.y * (TANK_HALF + 4), 'bullet').setDepth(2);
    if (owner === 'enemy') sprite.setTint(0xff8080);
    const bullet = { sprite, dir, owner, speed, breaksSteel: !!breaksSteel, ownerRef };
    this.entityLayer.add(sprite);
    (owner === 'player' ? this.playerBullets : this.enemyBullets).push(bullet);
  }

  updateBullets(dt, list, targetSide) {
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      const d = DIRS[b.dir];
      b.sprite.x += d.x * b.speed * dt;
      b.sprite.y += d.y * b.speed * dt;

      if (b.sprite.x < ARENA_LEFT || b.sprite.x > ARENA_LEFT + ARENA_SIZE ||
          b.sprite.y < ARENA_TOP || b.sprite.y > ARENA_BOTTOM) {
        this.removeBullet(list, i); continue;
      }

      const c = this.cellAt(b.sprite.x, b.sprite.y);
      if (c.row >= 0 && c.row < GRID && c.col >= 0 && c.col < GRID) {
        const cell = this.grid[c.row][c.col];
        if (cell.type === 'brick') {
          this.destroyCell(c.row, c.col);
          this.sfx.hitWall();
          this.removeBullet(list, i); continue;
        } else if (cell.type === 'steel') {
          if (b.breaksSteel) { this.destroyCell(c.row, c.col); this.sfx.explode(false); }
          else { this.sfx.hitWall(); }
          this.removeBullet(list, i); continue;
        } else if (cell.type === 'base') {
          if (b.owner === 'enemy') { this.destroyBase(); }
          this.removeBullet(list, i); continue;
        }
      }

      if (targetSide === 'enemy') {
        let hit = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (e.spawnShield > 0) continue;
          if (Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, e.sprite.x, e.sprite.y) < TANK_HALF + BULLET_R) {
            this.damageEnemy(j);
            hit = true; break;
          }
        }
        if (hit) { this.removeBullet(list, i); continue; }
      } else {
        if (!this.invuln && this.playing &&
            Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, this.playerSprite.x, this.playerSprite.y) < TANK_HALF + BULLET_R) {
          this.removeBullet(list, i);
          this.killPlayer();
          continue;
        }
      }
    }
  }

  removeBullet(list, idx) {
    list[idx].sprite.destroy();
    list.splice(idx, 1);
  }

  damageEnemy(idx) {
    const e = this.enemies[idx];
    e.hp--;
    if (e.hp <= 0) {
      this.score += e.points;
      this.updateScoreText();
      this.sfx.explode(false);
      this.burstSpark(e.sprite.x, e.sprite.y, 0xffaa33);
      const dropStar = e.guaranteedStar || Math.random() < STAR_DROP_CHANCE;
      if (dropStar) this.spawnPickup(e.sprite.x, e.sprite.y);
      e.sprite.destroy();
      this.enemies.splice(idx, 1);
    } else {
      e.sprite.setTint(this.shade(ENEMY_TYPES[e.type].color, 0.55));
      this.sfx.hitWall();
    }
  }

  killPlayer() {
    if (this.invuln) return; // 사망~리스폰 대기 중 중복 피격 방지
    this.invuln = true;
    this.burstSpark(this.playerSprite.x, this.playerSprite.y, 0xffdd55);
    this.sfx.explode(true);
    this.playerSprite.setVisible(false);
    this.lives--;
    this.updateLivesText();
    if (this.lives <= 0) {
      this.gameOver('lives');
      return;
    }
    this.playerLevel = Math.max(1, this.playerLevel - 1);
    this.updateLevelText();
    this.time.delayedCall(900, () => {
      if (!this.playing) return;
      const p = this.cellCenter(PLAYER_SPAWN.row, PLAYER_SPAWN.col);
      this.playerSprite.setPosition(p.x, p.y).setVisible(true);
      this.facing = 'up';
      this.invuln = true;
      this.time.delayedCall(1400, () => { this.invuln = false; });
    });
  }

  destroyBase() {
    if (!this.baseAlive) return;
    this.baseAlive = false;
    const cell = this.grid[BASE_POS.row][BASE_POS.col];
    this.burstSpark(cell.sprite ? cell.sprite.x : 0, cell.sprite ? cell.sprite.y : 0, 0xff5c5c);
    this.sfx.explode(true);
    this.destroyCell(BASE_POS.row, BASE_POS.col);
    this.gameOver('base');
  }

  spawnPickup(x, y) {
    const sprite = this.add.sprite(x, y, 'star_pickup').setDepth(1.5).setScale(0.1);
    this.tweens.add({ targets: sprite, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.entityLayer.add(sprite);
    const pickup = { sprite, life: 8000 };
    this.pickups.push(pickup);
  }

  updatePickups() {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (!this.playing) break;
      if (Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, this.playerSprite.x, this.playerSprite.y) < TANK_HALF + 16) {
        this.playerLevel = Math.min(4, this.playerLevel + 1);
        this.updateLevelText();
        this.sfx.star();
        this.floatText(p.sprite.x, p.sprite.y, 'LV UP!', '#ffd93d');
        p.sprite.destroy();
        this.pickups.splice(i, 1);
        continue;
      }
      p.life -= 16.6;
      if (p.life <= 0) {
        p.sprite.destroy();
        this.pickups.splice(i, 1);
      } else if (p.life < 2000) {
        p.sprite.setAlpha(Math.sin(p.life / 90) > 0 ? 1 : 0.3);
      }
    }
  }

  floatText(x, y, str, color) {
    const t = this.add.text(x, y, str, {
      fontFamily: 'sans-serif', fontSize: '18px', color, fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(1, 2, '#00000055', 2).setDepth(10);
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }

  burstSpark(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const s = this.add.sprite(x, y, 'spark').setTint(color).setScale(0.7).setDepth(10);
      const angle = (Math.PI * 2 * i) / 10;
      this.tweens.add({
        targets: s, x: x + Math.cos(angle) * 40, y: y + Math.sin(angle) * 40,
        alpha: 0, scale: 0.1, duration: 380, ease: 'Cubic.easeOut', onComplete: () => s.destroy(),
      });
    }
  }

  // ---------- 적 탱크 ----------
  trySpawnEnemy(dt) {
    if (!this.stageQueue || this.stageQueue.length === 0) return;
    if (this.enemies.length >= MAX_CONCURRENT_ENEMIES) return;
    this.spawnCooldown -= dt * 1000;
    if (this.spawnCooldown > 0) return;
    this.spawnCooldown = 900;

    if (this.spawnPointIdx === undefined) this.spawnPointIdx = 0;
    const sp = ENEMY_SPAWNS[this.spawnPointIdx % ENEMY_SPAWNS.length];
    this.spawnPointIdx++;
    const p = this.cellCenter(sp.row, sp.col);

    const tooClose = this.enemies.some((e) => Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, p.x, p.y) < CELL * 1.2) ||
      (this.playerSprite && Phaser.Math.Distance.Between(this.playerSprite.x, this.playerSprite.y, p.x, p.y) < CELL * 1.2);
    if (tooClose) return;

    const type = this.stageQueue.shift();
    const stats = ENEMY_TYPES[type];
    const sprite = this.add.sprite(p.x, p.y, 'tank_' + type).setDepth(3).setAngle(180);
    this.entityLayer.add(sprite);
    this.enemies.push({
      sprite, type, hp: stats.hp, speed: stats.speed, points: stats.points,
      guaranteedStar: !!stats.guaranteedStar, dir: 'down',
      dirTimer: Phaser.Math.Between(stats.dirMin, stats.dirMax),
      fireTimer: Phaser.Math.Between(stats.fireMin, stats.fireMax),
      spawnShield: 500,
    });
  }

  updateEnemies(dt, time) {
    for (const e of this.enemies) {
      if (e.spawnShield > 0) { e.spawnShield -= dt * 1000; continue; }

      e.dirTimer -= dt * 1000;
      const moved = this.attemptMove(e.sprite, e.dir, e.speed, dt);
      e.sprite.setAngle(DIRS[e.dir].angle);

      if (!moved || e.dirTimer <= 0) {
        const stats = ENEMY_TYPES[e.type];
        e.dir = this.pickEnemyDir();
        e.dirTimer = Phaser.Math.Between(stats.dirMin, stats.dirMax);
      }

      e.fireTimer -= dt * 1000;
      if (e.fireTimer <= 0) {
        const stats = ENEMY_TYPES[e.type];
        e.fireTimer = Phaser.Math.Between(stats.fireMin, stats.fireMax);
        if (!this.enemyBullets.some((b) => b.ownerRef === e)) {
          this.spawnBullet(e.sprite.x, e.sprite.y, e.dir, 'enemy', 190, false, e);
        }
      }
    }
  }

  pickEnemyDir() {
    const r = Math.random();
    if (r < 0.4) return 'down';
    if (r < 0.6) return 'up';
    if (r < 0.8) return 'left';
    return 'right';
  }

  checkStageClear() {
    if (!this.playing) return;
    if (this.stageQueue && this.stageQueue.length === 0 && this.enemies.length === 0) {
      this.onStageClear();
    }
  }

  onStageClear() {
    this.playing = false;
    this.sfx.stageClear();
    this.stageBanner.setText('스테이지 ' + this.stage + ' 클리어! 🎉').setVisible(true);
    this.time.delayedCall(1600, () => {
      this.stageBanner.setVisible(false);
      this.stage++;
      if (this.stage > STAGE_TEMPLATES.length) {
        this.stage = 1;
        this.cycle++;
      }
      this.startStage();
    });
  }

  gameOver(reason) {
    this.playing = false;
    this.fireHeld = false;
    this.sfx.gameOver();
    this.overlayTitle.setText(reason === 'base' ? '기지가 파괴됐어요! 💥' : '탱크를 모두 잃었어요!');
    this.overlaySub.setText('점수 ' + this.score + '점  (스테이지 ' + this.stage + ')');
    this.overlayBtn.setText('다시하기');
    this.overlay.setVisible(true);
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: 'game-container',
  backgroundColor: '#1c1c1c',
  input: { activePointers: 2 },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TankScene],
};

const game = new Phaser.Game(config);
