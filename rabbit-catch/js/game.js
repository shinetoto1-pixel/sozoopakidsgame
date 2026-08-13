// ---------- 토끼 잡기 ----------

const GAME_W = 480;
const GAME_H = 800;
const HOLE_R = 58;
const ROUND_TIME = 45;

const COLS = [110, 240, 370];
const ROWS = [270, 420, 570];

class SoundFX {
  constructor() { this.ctx = null; }
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
  catch_() { this.tone(700, 0.1, 'triangle', 0.16); this.tone(950, 0.1, 'triangle', 0.12, 0.05); }
  gold() { [700, 950, 1200].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.15, i * 0.06)); }
  wrong() { this.tone(160, 0.22, 'sawtooth', 0.14); }
  tick() { this.tone(500, 0.05, 'square', 0.06); }
  end() { [523, 440, 349, 261].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.12, i * 0.11)); }
}

class RabbitScene extends Phaser.Scene {
  constructor() { super('rabbit'); }

  create() {
    this.sfx = new SoundFX();
    this.score = 0;
    this.timeLeft = ROUND_TIME;
    this.roundOver = true;

    this.drawBackground();
    this.buildTextures();
    this.drawBurrows();

    this.holes = [];
    for (const y of ROWS) for (const x of COLS) this.holes.push({ x, y, occupant: null, hideTimer: null });

    this.scoreText = this.add.text(20, 20, '점수 0', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
    }).setShadow(1, 2, '#00000055', 2);

    this.timerText = this.add.text(GAME_W / 2, 26, '⏱ 45', {
      fontFamily: 'sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setShadow(1, 2, '#00000055', 2);

    this.restartBtn = this.add.text(GAME_W - 20, 20, '🔄', { fontSize: '30px' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.restartBtn.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); this.startRound(); });

    this.overlay = this.add.container(0, 0).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0);
    this.overlayTitle = this.add.text(GAME_W / 2, GAME_H / 2 - 70, '토끼 잡기 🐰', {
      fontFamily: 'sans-serif', fontSize: '34px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(2, 3, '#00000088', 4);
    this.overlaySub = this.add.text(GAME_W / 2, GAME_H / 2 - 10, '구멍에서 나오는 토끼를 빠르게 탭해서 잡으세요!\n두더지는 건드리지 마세요.', {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffffdd', align: 'center',
    }).setOrigin(0.5);
    this.overlayBtn = this.add.text(GAME_W / 2, GAME_H / 2 + 80, '시작하기 ▶', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#3a5a40', fontStyle: 'bold', backgroundColor: '#ffd93d',
      padding: { x: 26, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.overlay.add([dim, this.overlayTitle, this.overlaySub, this.overlayBtn]);

    this.overlayBtn.on('pointerdown', () => { this.sfx.ensure(); this.startRound(); });
    this.input.on('pointerdown', () => this.sfx.ensure());

    this.overlay.setVisible(true);
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x8fd3a5, 0x8fd3a5, 0xd7f0c0, 0xd7f0c0, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(410, 90, 46);
    const cloud = (cx, cy, s) => {
      g.fillStyle(0xffffff, 0.6);
      g.fillEllipse(cx, cy, 70 * s, 28 * s);
      g.fillEllipse(cx - 28 * s, cy + 5 * s, 42 * s, 22 * s);
      g.fillEllipse(cx + 30 * s, cy + 6 * s, 46 * s, 20 * s);
    };
    cloud(90, 70, 0.7);
    cloud(330, 130, 0.55);
    const flower = (cx, cy, color) => {
      g.fillStyle(color, 0.85);
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5;
        g.fillCircle(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 5);
      }
      g.fillStyle(0xffe066, 1);
      g.fillCircle(cx, cy, 4);
    };
    flower(40, 700, 0xff8fa3);
    flower(440, 660, 0xffd6a5);
    flower(30, 200, 0xffd6a5);
    flower(450, 220, 0xff8fa3);
  }

  buildTextures() {
    // 토끼 (일반 핑크 / 고득점 골든핑크)
    this.drawRabbitTexture('rabbit', 0xffaed1, 0xff6f9c, false);
    this.drawRabbitTexture('rabbit_gold', 0xffc2e0, 0xffd700, true);

    // 두더지(방해꾼)
    const g = this.add.graphics();
    const s = HOLE_R * 2;
    const cx = s / 2, cy = s / 2 + 6;
    g.fillStyle(0x7a5c48, 1);
    g.fillEllipse(cx, cy, s * 0.62, s * 0.5);
    g.fillStyle(0x9c7a5f, 1);
    g.fillEllipse(cx, cy + 4, s * 0.5, s * 0.34);
    g.fillStyle(0x3d2b22, 1);
    g.fillEllipse(cx - 12, cy - 6, 7, 4);
    g.fillEllipse(cx + 12, cy - 6, 7, 4);
    g.lineStyle(3, 0x3d2b22, 1);
    g.beginPath(); g.moveTo(cx - 18, cy - 12); g.lineTo(cx - 8, cy - 8); g.strokePath();
    g.beginPath(); g.moveTo(cx + 18, cy - 12); g.lineTo(cx + 8, cy - 8); g.strokePath();
    g.fillStyle(0xd88a8a, 1);
    g.fillEllipse(cx, cy + 6, 10, 7);
    g.generateTexture('decoy', s, s);
    g.destroy();

    // 반짝이 파편
    const pg = this.add.graphics();
    pg.fillStyle(0xffffff, 1);
    pg.fillCircle(6, 6, 6);
    pg.generateTexture('spark', 12, 12);
    pg.destroy();
  }

  drawRabbitTexture(key, bodyColor, earColor, isGold) {
    const g = this.add.graphics();
    const s = HOLE_R * 2.3;
    const cx = s / 2, cy = s * 0.68;
    const r = HOLE_R * 0.6;

    // 귀 (바깥으로 살짝 벌어진 둥근 캡슐 모양)
    const earW = r * 0.5, earH = r * 1.7;
    [-1, 1].forEach((side) => {
      g.save();
      g.translateCanvas(cx + side * r * 0.42, cy - r * 0.78);
      g.rotateCanvas(side * 0.24);
      g.fillStyle(bodyColor, 1);
      g.fillRoundedRect(-earW / 2, -earH, earW, earH, earW / 2);
      g.fillStyle(earColor, 1);
      g.fillRoundedRect(-earW * 0.32, -earH * 0.86, earW * 0.64, earH * 0.68, earW * 0.32);
      g.restore();
    });

    // 볼살 (통통한 실루엣)
    g.fillStyle(bodyColor, 1);
    g.fillCircle(cx - r * 0.78, cy + r * 0.42, r * 0.55);
    g.fillCircle(cx + r * 0.78, cy + r * 0.42, r * 0.55);

    // 얼굴
    g.fillCircle(cx, cy, r);
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(cx - r * 0.32, cy - r * 0.42, r * 0.55, r * 0.36);

    // 블러셔
    g.fillStyle(0xff9db3, 0.55);
    g.fillEllipse(cx - r * 0.62, cy + r * 0.28, r * 0.32, r * 0.2);
    g.fillEllipse(cx + r * 0.62, cy + r * 0.28, r * 0.32, r * 0.2);

    // 눈 (반짝임 포함)
    [-1, 1].forEach((side) => {
      g.fillStyle(0x2b2b2b, 1);
      g.fillCircle(cx + side * r * 0.34, cy - r * 0.02, r * 0.13);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(cx + side * r * 0.34 - r * 0.04, cy - r * 0.06, r * 0.045);
    });

    // 코 & 입
    g.fillStyle(0xff8fa3, 1);
    g.fillEllipse(cx, cy + r * 0.24, r * 0.16, r * 0.11);
    g.lineStyle(2, 0x2b2b2b, 0.6);
    g.beginPath();
    g.moveTo(cx, cy + r * 0.3);
    g.lineTo(cx, cy + r * 0.38);
    g.strokePath();
    g.beginPath(); g.arc(cx - r * 0.12, cy + r * 0.42, r * 0.14, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false); g.strokePath();
    g.beginPath(); g.arc(cx + r * 0.12, cy + r * 0.42, r * 0.14, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), true); g.strokePath();

    // 수염 (짧고 은은하게)
    g.lineStyle(1.4, 0x2b2b2b, 0.35);
    [-1, 1].forEach((side) => {
      g.beginPath(); g.moveTo(cx + side * r * 0.28, cy + r * 0.24); g.lineTo(cx + side * r * 0.75, cy + r * 0.16); g.strokePath();
      g.beginPath(); g.moveTo(cx + side * r * 0.28, cy + r * 0.32); g.lineTo(cx + side * r * 0.75, cy + r * 0.34); g.strokePath();
    });

    if (isGold) {
      g.lineStyle(3, 0xffd700, 0.9);
      g.strokeCircle(cx, cy, r + 3);
      this.drawSparkle(g, cx - r * 1.15, cy - r * 0.9, r * 0.22, 0xffd700);
      this.drawSparkle(g, cx + r * 1.2, cy - r * 0.5, r * 0.16, 0xffe680);
      this.drawSparkle(g, cx + r * 0.9, cy + r * 1.05, r * 0.14, 0xffd700);
    }

    g.generateTexture(key, s, s);
    g.destroy();
  }

  drawSparkle(g, x, y, s, color) {
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + s * 0.28, y - s * 0.28);
    g.lineTo(x + s, y);
    g.lineTo(x + s * 0.28, y + s * 0.28);
    g.lineTo(x, y + s);
    g.lineTo(x - s * 0.28, y + s * 0.28);
    g.lineTo(x - s, y);
    g.lineTo(x - s * 0.28, y - s * 0.28);
    g.closePath();
    g.fillPath();
  }

  drawBurrows() {
    const g = this.add.graphics();
    for (const y of ROWS) {
      for (const x of COLS) {
        g.fillStyle(0x000000, 0.18);
        g.fillEllipse(x, y + 10, HOLE_R * 1.5, HOLE_R * 0.6);
        g.fillStyle(0x6b4a34, 1);
        g.fillEllipse(x, y, HOLE_R * 1.3, HOLE_R * 0.62);
        g.fillStyle(0x3a2a1e, 1);
        g.fillEllipse(x, y, HOLE_R * 0.95, HOLE_R * 0.42);
      }
    }
  }

  updateScoreText() { this.scoreText.setText('점수 ' + this.score); }

  startRound() {
    this.overlay.setVisible(false);
    this.holes.forEach((h) => this.hideOccupant(h, false, true));
    this.score = 0;
    this.timeLeft = ROUND_TIME;
    this.roundOver = false;
    this.updateScoreText();
    this.timerText.setText('⏱ ' + this.timeLeft);

    if (this.countdownEvent) this.countdownEvent.remove(false);
    this.countdownEvent = this.time.addEvent({
      delay: 1000, loop: true, callback: () => this.tickCountdown(),
    });

    this.scheduleNextSpawn();
  }

  tickCountdown() {
    if (this.roundOver) return;
    this.timeLeft--;
    this.timerText.setText('⏱ ' + Math.max(0, this.timeLeft));
    if (this.timeLeft <= 10) this.sfx.tick();
    if (this.timeLeft <= 0) this.endRound();
  }

  progress() { return Phaser.Math.Clamp(1 - this.timeLeft / ROUND_TIME, 0, 1); }

  scheduleNextSpawn() {
    if (this.roundOver) return;
    const delay = Phaser.Math.Linear(850, 420, this.progress());
    this.spawnEvent = this.time.delayedCall(delay, () => {
      this.trySpawn();
      this.scheduleNextSpawn();
    });
  }

  trySpawn() {
    if (this.roundOver) return;
    const free = this.holes.filter((h) => !h.occupant);
    if (free.length === 0) return;
    const hole = Phaser.Utils.Array.GetRandom(free);
    const roll = Math.random();
    const type = roll < 0.2 ? 'decoy' : roll < 0.32 ? 'gold' : 'rabbit';
    const duration = Phaser.Math.Linear(1150, 650, this.progress());
    this.spawnAt(hole, type, duration);
  }

  spawnAt(hole, type, duration) {
    const texKey = type === 'decoy' ? 'decoy' : type === 'gold' ? 'rabbit_gold' : 'rabbit';
    const sprite = this.add.sprite(hole.x, hole.y + 18, texKey).setScale(0.2).setAlpha(0.9);
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => this.onTapOccupant(hole));

    hole.occupant = { type, sprite };
    this.tweens.add({
      targets: sprite, y: hole.y - HOLE_R * 0.32, scale: 1,
      duration: 180, ease: 'Back.easeOut',
    });

    hole.hideTimer = this.time.delayedCall(duration, () => this.hideOccupant(hole, false));
  }

  hideOccupant(hole, wasTapped, instant) {
    const occ = hole.occupant;
    hole.occupant = null;
    if (hole.hideTimer) { hole.hideTimer.remove(false); hole.hideTimer = null; }
    if (!occ || !occ.sprite) return;
    if (instant) { occ.sprite.destroy(); return; }
    this.tweens.add({
      targets: occ.sprite, y: '+=24', scale: 0, alpha: 0, duration: 150,
      onComplete: () => occ.sprite.destroy(),
    });
  }

  onTapOccupant(hole) {
    if (this.roundOver || !hole.occupant) return;
    const occ = hole.occupant;

    if (occ.type === 'decoy') {
      this.score = Math.max(0, this.score - 5);
      this.sfx.wrong();
      this.cameras.main.shake(100, 0.006);
      this.floatText(hole.x, hole.y - HOLE_R * 0.6, '-5', '#ff5c5c');
    } else {
      const pts = occ.type === 'gold' ? 30 : 10;
      this.score += pts;
      if (occ.type === 'gold') this.sfx.gold(); else this.sfx.catch_();
      this.floatText(hole.x, hole.y - HOLE_R * 0.6, '+' + pts, occ.type === 'gold' ? '#ffd93d' : '#6bcb77');
      this.burstSpark(hole.x, hole.y - HOLE_R * 0.3);
    }
    this.updateScoreText();
    this.hideOccupant(hole, true);
  }

  floatText(x, y, str, color) {
    const t = this.add.text(x, y, str, {
      fontFamily: 'sans-serif', fontSize: '24px', color, fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(1, 2, '#00000055', 2);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 550, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  burstSpark(x, y) {
    for (let i = 0; i < 8; i++) {
      const s = this.add.sprite(x, y, 'spark').setScale(0.6);
      const angle = (Math.PI * 2 * i) / 8;
      this.tweens.add({
        targets: s,
        x: x + Math.cos(angle) * 40,
        y: y + Math.sin(angle) * 40,
        alpha: 0,
        scale: 0.1,
        duration: 380,
        ease: 'Cubic.easeOut',
        onComplete: () => s.destroy(),
      });
    }
  }

  endRound() {
    this.roundOver = true;
    if (this.countdownEvent) this.countdownEvent.remove(false);
    if (this.spawnEvent) this.spawnEvent.remove(false);
    this.holes.forEach((h) => this.hideOccupant(h, false, true));
    this.sfx.end();

    this.overlayTitle.setText('시간 종료! ⏰');
    this.overlaySub.setText('점수 ' + this.score + '점');
    this.overlayBtn.setText('다시하기');
    this.overlay.setVisible(true);
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: 'game-container',
  backgroundColor: '#8fd3a5',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [RabbitScene],
};

const game = new Phaser.Game(config);
