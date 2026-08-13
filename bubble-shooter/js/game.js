// ---------- 버블 슈터 (모바일용) ----------

const GAME_W = 480;
const GAME_H = 800;

const RADIUS = 23;
const DIAM = RADIUS * 2;
const ROW_H = DIAM * (Math.sqrt(3) / 2);
const COLS = 10;
const BOARD_LEFT = (GAME_W - COLS * DIAM) / 2;
const BOARD_RIGHT = GAME_W - BOARD_LEFT;
const TOP_Y = 96;
const DANGER_Y = 620;
const SHOOTER_X = GAME_W / 2;
const SHOOTER_Y = 700;
const SHOT_SPEED = 900;

const PALETTE = [
  { key: 'red', color: 0xff6b6b, shade: 0xd6455a },
  { key: 'yellow', color: 0xffd93d, shade: 0xe0ab1a },
  { key: 'green', color: 0x6bcb77, shade: 0x3fa053 },
  { key: 'blue', color: 0x4d96ff, shade: 0x2c6fd1 },
  { key: 'purple', color: 0xc780fa, shade: 0x9a4fd1 },
  { key: 'orange', color: 0xff9f5b, shade: 0xdb7530 },
];

// ---------- 사운드 (오디오 파일 없이 합성) ----------
class SoundFX {
  constructor() {
    this.ctx = null;
  }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq, dur, type = 'sine', vol = 0.18, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  shoot() { this.tone(520, 0.09, 'triangle', 0.12); }
  attach() { this.tone(300, 0.06, 'sine', 0.1); }
  pop(i) { this.tone(700 + i * 90, 0.12, 'square', 0.14, i * 0.04); }
  drop() { this.tone(200, 0.18, 'sine', 0.12); }
  clear() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.15, i * 0.09));
  }
  gameOver() {
    [392, 349, 293, 220].forEach((f, i) => this.tone(f, 0.28, 'sawtooth', 0.1, i * 0.14));
  }
}

class BubbleScene extends Phaser.Scene {
  constructor() {
    super('bubble');
  }

  create() {
    this.sfx = new SoundFX();
    this.grid = new Map(); // "row,col" -> {row,col,color,sprite}
    this.score = 0;
    this.level = 1;
    this.isBusy = false; // shot in flight or resolving
    this.shootingBubble = null;
    this.aiming = false;

    this.drawBackground();
    this.buildTextures();

    this.aimGfx = this.add.graphics();
    this.gridContainer = this.add.container(0, 0);

    this.scoreText = this.add.text(20, 20, '점수 0', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
    }).setShadow(1, 2, '#00000055', 2);

    this.levelText = this.add.text(20, 54, '레벨 1', {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffffcc',
    });

    this.restartBtn = this.add.text(GAME_W - 20, 20, '🔄', { fontSize: '30px' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.restartBtn.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); this.startLevel(this.startRows || 5); this.score = 0; this.updateScore(0); });

    // 발사대
    this.shooterBase = this.add.circle(SHOOTER_X, SHOOTER_Y + 4, RADIUS + 10, 0x1f2a44, 0.5);
    this.nextLabel = this.add.text(SHOOTER_X + 62, SHOOTER_Y - 6, 'NEXT', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#ffffff99',
    }).setOrigin(0.5);
    this.nextSprite = this.add.sprite(SHOOTER_X + 62, SHOOTER_Y + 14, 'bubble_red').setScale(0.62);

    this.currentSprite = this.add.sprite(SHOOTER_X, SHOOTER_Y, 'bubble_red');

    this.overlay = this.add.container(0, 0).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0);
    this.overlayTitle = this.add.text(GAME_W / 2, GAME_H / 2 - 60, '', {
      fontFamily: 'sans-serif', fontSize: '40px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(2, 3, '#00000088', 4);
    this.overlaySub = this.add.text(GAME_W / 2, GAME_H / 2 - 4, '', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffffdd',
    }).setOrigin(0.5);
    this.overlayBtn = this.add.text(GAME_W / 2, GAME_H / 2 + 70, '', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#2b3a55', fontStyle: 'bold', backgroundColor: '#ffd93d',
      padding: { x: 26, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.overlay.add([dim, this.overlayTitle, this.overlaySub, this.overlayBtn]);

    this.startRows = 5;
    this.startLevel(this.startRows);

    this.input.on('pointerdown', (p) => { this.sfx.ensure(); this.onPointerDown(p); });
    this.input.on('pointermove', (p) => this.onPointerMove(p));
    this.input.on('pointerup', (p) => this.onPointerUp(p));
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x8ec9ff, 0x8ec9ff, 0xdff2ff, 0xdff2ff, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    const cloud = (cx, cy, s) => {
      g.fillStyle(0xffffff, 0.55);
      g.fillEllipse(cx, cy, 70 * s, 30 * s);
      g.fillEllipse(cx - 30 * s, cy + 6 * s, 45 * s, 24 * s);
      g.fillEllipse(cx + 34 * s, cy + 8 * s, 50 * s, 22 * s);
    };
    cloud(90, 130, 0.8);
    cloud(360, 200, 1.1);
    cloud(60, 480, 0.7);
    cloud(420, 560, 0.9);
  }

  buildTextures() {
    PALETTE.forEach((p) => {
      const size = DIAM + 8;
      const key = 'bubble_' + p.key;
      const g = this.add.graphics();
      const cx = size / 2, cy = size / 2, r = RADIUS;
      g.fillStyle(p.shade, 1);
      g.fillCircle(cx, cy, r);
      g.fillStyle(p.color, 1);
      g.fillCircle(cx, cy, r - 2);
      g.fillStyle(0xffffff, 0.55);
      g.fillEllipse(cx - r * 0.35, cy - r * 0.4, r * 0.7, r * 0.45);
      g.fillStyle(0x2b2b2b, 0.85);
      g.fillCircle(cx - r * 0.28, cy + r * 0.05, r * 0.09);
      g.fillCircle(cx + r * 0.28, cy + r * 0.05, r * 0.09);
      g.lineStyle(Math.max(1.5, r * 0.09), 0x2b2b2b, 0.65);
      g.beginPath();
      g.arc(cx, cy + r * 0.12, r * 0.32, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
      g.strokePath();
      g.generateTexture(key, size, size);
      g.destroy();
    });

    // 터지는 파편 텍스처 (작은 원)
    const pg = this.add.graphics();
    pg.fillStyle(0xffffff, 1);
    pg.fillCircle(6, 6, 6);
    pg.generateTexture('spark', 12, 12);
    pg.destroy();
  }

  colsInRow(row) { return row % 2 === 1 ? COLS - 1 : COLS; }

  cellPixel(row, col) {
    const isOdd = row % 2 === 1;
    const x = isOdd ? BOARD_LEFT + DIAM + col * DIAM : BOARD_LEFT + RADIUS + col * DIAM;
    const y = TOP_Y + RADIUS + row * ROW_H;
    return { x, y };
  }

  neighborsOf(row, col) {
    const { x, y } = this.cellPixel(row, col);
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
      const r = row + dr;
      if (r < 0) continue;
      const cCount = this.colsInRow(r);
      for (let c = 0; c < cCount; c++) {
        if (dr === 0 && c === col) continue;
        const p = this.cellPixel(r, c);
        const dist = Phaser.Math.Distance.Between(x, y, p.x, p.y);
        if (dist <= DIAM * 1.05) result.push({ row: r, col: c });
      }
    }
    return result;
  }

  key(row, col) { return row + ',' + col; }
  getBubble(row, col) { return this.grid.get(this.key(row, col)); }

  addBubble(row, col, colorKey) {
    const { x, y } = this.cellPixel(row, col);
    const sprite = this.add.sprite(x, y, 'bubble_' + colorKey);
    this.gridContainer.add(sprite);
    const entry = { row, col, colorKey, sprite };
    this.grid.set(this.key(row, col), entry);
    return entry;
  }

  removeBubbleEntry(entry) {
    this.grid.delete(this.key(entry.row, entry.col));
  }

  randomPaletteSubset() {
    return PALETTE.slice(0, Math.min(PALETTE.length, 3 + Math.min(3, this.level)));
  }

  startLevel(rows) {
    this.grid.forEach((e) => e.sprite.destroy());
    this.grid.clear();
    this.isBusy = false;
    this.shootingBubble = null;
    this.overlay.setVisible(false);

    const palette = this.randomPaletteSubset();
    for (let r = 0; r < rows; r++) {
      const cCount = this.colsInRow(r);
      for (let c = 0; c < cCount; c++) {
        const p = Phaser.Utils.Array.GetRandom(palette);
        this.addBubble(r, c, p.key);
      }
    }
    this.currentColor = this.pickColorFromGrid();
    this.nextColor = this.pickColorFromGrid();
    this.currentSprite.setTexture('bubble_' + this.currentColor);
    this.nextSprite.setTexture('bubble_' + this.nextColor);
    this.currentSprite.setPosition(SHOOTER_X, SHOOTER_Y).setVisible(true);
  }

  pickColorFromGrid() {
    const colorsPresent = new Set();
    this.grid.forEach((e) => colorsPresent.add(e.colorKey));
    if (colorsPresent.size === 0) {
      return Phaser.Utils.Array.GetRandom(this.randomPaletteSubset()).key;
    }
    return Phaser.Utils.Array.GetRandom(Array.from(colorsPresent));
  }

  updateScore(add) {
    this.score += add;
    this.scoreText.setText('점수 ' + this.score);
  }

  onPointerDown(p) {
    if (this.isBusy || p.y < GAME_H - 260) return;
    this.aiming = true;
    this.updateAim(p.x, p.y);
  }

  onPointerMove(p) {
    if (!this.aiming) return;
    this.updateAim(p.x, p.y);
  }

  onPointerUp(p) {
    if (!this.aiming) return;
    this.aiming = false;
    this.aimGfx.clear();
    this.fireCurrentBubble();
  }

  computeAimAngle(px, py) {
    let dx = px - SHOOTER_X;
    let dy = py - SHOOTER_Y;
    let angle = Math.atan2(dy, dx);
    const minA = Phaser.Math.DegToRad(-165);
    const maxA = Phaser.Math.DegToRad(-15);
    angle = Phaser.Math.Clamp(angle, minA, maxA);
    return angle;
  }

  updateAim(px, py) {
    this.lastPointerX = px;
    this.lastPointerY = py;
    const angle = this.computeAimAngle(px, py);
    const g = this.aimGfx;
    g.clear();
    g.fillStyle(0xffffff, 0.85);

    let x = SHOOTER_X, y = SHOOTER_Y;
    let dx = Math.cos(angle), dy = Math.sin(angle);
    const step = 16;
    let remaining = 620;
    let dotIndex = 0;
    while (remaining > 0 && y > TOP_Y) {
      x += dx * step;
      y += dy * step;
      remaining -= step;
      if (x - RADIUS <= BOARD_LEFT) { x = BOARD_LEFT + RADIUS; dx = -dx; }
      else if (x + RADIUS >= BOARD_RIGHT) { x = BOARD_RIGHT - RADIUS; dx = -dx; }
      if (dotIndex % 2 === 0) g.fillCircle(x, y, 3.2);
      dotIndex++;
    }
  }

  fireCurrentBubble() {
    this.isBusy = true;
    const angle = this.computeAimAngle(this.lastPointerX ?? SHOOTER_X, this.lastPointerY ?? (SHOOTER_Y - 200));
    this.sfx.shoot();
    this.currentSprite.setVisible(false);
    const sprite = this.add.sprite(SHOOTER_X, SHOOTER_Y, 'bubble_' + this.currentColor);
    this.shootingBubble = {
      sprite,
      colorKey: this.currentColor,
      vx: Math.cos(angle) * SHOT_SPEED,
      vy: Math.sin(angle) * SHOT_SPEED,
    };
  }

  update(time, delta) {
    if (!this.shootingBubble) return;
    const dt = delta / 1000;
    const b = this.shootingBubble;
    b.sprite.x += b.vx * dt;
    b.sprite.y += b.vy * dt;

    if (b.sprite.x - RADIUS <= BOARD_LEFT) { b.sprite.x = BOARD_LEFT + RADIUS; b.vx = Math.abs(b.vx); }
    else if (b.sprite.x + RADIUS >= BOARD_RIGHT) { b.sprite.x = BOARD_RIGHT - RADIUS; b.vx = -Math.abs(b.vx); }

    if (b.sprite.y - RADIUS <= TOP_Y) {
      this.attachShotBubble(null);
      return;
    }

    let hit = null;
    for (const entry of this.grid.values()) {
      const d = Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, entry.sprite.x, entry.sprite.y);
      if (d <= DIAM * 0.98) { hit = entry; break; }
    }
    if (hit) this.attachShotBubble(hit);
  }

  attachShotBubble(hitEntry) {
    const b = this.shootingBubble;
    this.shootingBubble = null;
    this.sfx.attach();

    let targetRow, targetCol;
    if (!hitEntry) {
      targetRow = 0;
      let bestCol = 0, bestDist = Infinity;
      for (let c = 0; c < this.colsInRow(0); c++) {
        const p = this.cellPixel(0, c);
        const d = Math.abs(p.x - b.sprite.x);
        if (d < bestDist) { bestDist = d; bestCol = c; }
      }
      targetCol = bestCol;
      if (this.getBubble(targetRow, targetCol)) {
        const empty = this.findNearestEmptyAnywhere(b.sprite.x, b.sprite.y);
        if (empty) { targetRow = empty.row; targetCol = empty.col; }
      }
    } else {
      const candidates = this.neighborsOf(hitEntry.row, hitEntry.col).filter(
        (n) => !this.getBubble(n.row, n.col)
      );
      if (candidates.length === 0) {
        const empty = this.findNearestEmptyAnywhere(b.sprite.x, b.sprite.y);
        targetRow = empty ? empty.row : hitEntry.row + 1;
        targetCol = empty ? empty.col : 0;
      } else {
        let best = candidates[0], bestDist = Infinity;
        for (const c of candidates) {
          const p = this.cellPixel(c.row, c.col);
          const d = Phaser.Math.Distance.Between(p.x, p.y, b.sprite.x, b.sprite.y);
          if (d < bestDist) { bestDist = d; best = c; }
        }
        targetRow = best.row; targetCol = best.col;
      }
    }

    b.sprite.destroy();
    const entry = this.addBubble(targetRow, targetCol, b.colorKey);

    const matched = this.findMatchGroup(entry);
    if (matched.length >= 3) {
      this.time.delayedCall(80, () => this.resolveMatches(matched));
    } else {
      this.afterShotResolved();
    }
  }

  findNearestEmptyAnywhere(x, y) {
    let best = null, bestDist = Infinity;
    const maxRow = Math.ceil((DANGER_Y - TOP_Y) / ROW_H) + 1;
    for (let r = 0; r <= maxRow; r++) {
      const cCount = this.colsInRow(r);
      for (let c = 0; c < cCount; c++) {
        if (this.getBubble(r, c)) continue;
        const p = this.cellPixel(r, c);
        const d = Phaser.Math.Distance.Between(p.x, p.y, x, y);
        if (d < bestDist) { bestDist = d; best = { row: r, col: c }; }
      }
    }
    return best;
  }

  findMatchGroup(startEntry) {
    const visited = new Set();
    const stack = [startEntry];
    const group = [];
    visited.add(this.key(startEntry.row, startEntry.col));
    while (stack.length) {
      const cur = stack.pop();
      group.push(cur);
      for (const n of this.neighborsOf(cur.row, cur.col)) {
        const nb = this.getBubble(n.row, n.col);
        if (nb && nb.colorKey === startEntry.colorKey && !visited.has(this.key(n.row, n.col))) {
          visited.add(this.key(n.row, n.col));
          stack.push(nb);
        }
      }
    }
    return group;
  }

  resolveMatches(group) {
    group.forEach((entry, i) => {
      this.removeBubbleEntry(entry);
      this.sfx.pop(i);
      this.time.delayedCall(i * 40, () => {
        this.tweens.add({
          targets: entry.sprite,
          scale: 0,
          alpha: 0,
          duration: 180,
          ease: 'Back.easeIn',
          onComplete: () => entry.sprite.destroy(),
        });
      });
    });
    this.updateScore(group.length * 10);

    this.time.delayedCall(group.length * 40 + 200, () => {
      this.dropFloatingBubbles();
    });
  }

  dropFloatingBubbles() {
    const reachable = new Set();
    const stack = [];
    for (let c = 0; c < this.colsInRow(0); c++) {
      const e = this.getBubble(0, c);
      if (e) { stack.push(e); reachable.add(this.key(0, c)); }
    }
    while (stack.length) {
      const cur = stack.pop();
      for (const n of this.neighborsOf(cur.row, cur.col)) {
        const nb = this.getBubble(n.row, n.col);
        if (nb && !reachable.has(this.key(n.row, n.col))) {
          reachable.add(this.key(n.row, n.col));
          stack.push(nb);
        }
      }
    }

    const floating = [];
    this.grid.forEach((e) => {
      if (!reachable.has(this.key(e.row, e.col))) floating.push(e);
    });

    if (floating.length > 0) this.sfx.drop();
    floating.forEach((entry, i) => {
      this.removeBubbleEntry(entry);
      this.tweens.add({
        targets: entry.sprite,
        y: entry.sprite.y + 400,
        angle: Phaser.Math.Between(-200, 200),
        alpha: 0,
        duration: 500,
        delay: i * 20,
        ease: 'Cubic.easeIn',
        onComplete: () => entry.sprite.destroy(),
      });
    });
    if (floating.length) this.updateScore(floating.length * 5);

    this.afterShotResolved();
  }

  afterShotResolved() {
    if (this.grid.size === 0) {
      this.time.delayedCall(250, () => this.onLevelClear());
      return;
    }
    let gameOver = false;
    this.grid.forEach((e) => { if (e.sprite.y + RADIUS >= DANGER_Y) gameOver = true; });
    if (gameOver) {
      this.onGameOver();
      return;
    }

    this.currentColor = this.nextColor;
    this.nextColor = this.pickColorFromGrid();
    this.currentSprite.setTexture('bubble_' + this.currentColor).setPosition(SHOOTER_X, SHOOTER_Y).setScale(1).setVisible(true);
    this.nextSprite.setTexture('bubble_' + this.nextColor);
    this.isBusy = false;
  }

  onLevelClear() {
    this.sfx.clear();
    this.level++;
    this.levelText.setText('레벨 ' + this.level);
    this.overlayTitle.setText('레벨 클리어! 🎉');
    this.overlaySub.setText('점수 ' + this.score);
    this.overlayBtn.setText('다음 레벨 ▶');
    this.overlay.setVisible(true);
    this.overlayBtn.removeAllListeners();
    this.overlayBtn.on('pointerdown', () => {
      this.overlay.setVisible(false);
      this.startLevel(Math.min(5 + this.level, 10));
    });
  }

  onGameOver() {
    this.sfx.gameOver();
    this.isBusy = true;
    this.overlayTitle.setText('게임 오버');
    this.overlaySub.setText('점수 ' + this.score);
    this.overlayBtn.setText('다시하기');
    this.overlay.setVisible(true);
    this.overlayBtn.removeAllListeners();
    this.overlayBtn.on('pointerdown', () => {
      this.overlay.setVisible(false);
      this.level = 1;
      this.levelText.setText('레벨 1');
      this.score = 0;
      this.updateScore(0);
      this.startLevel(this.startRows);
    });
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: 'game-container',
  backgroundColor: '#8ec9ff',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BubbleScene],
};

const game = new Phaser.Game(config);
