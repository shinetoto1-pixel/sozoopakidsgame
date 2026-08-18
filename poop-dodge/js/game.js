// ---------- 똥벼락을 피해라! ----------

const GAME_W = 480;
const GAME_H = 800;
const FIELD_TOP = 96;
const FIELD_BOTTOM = 800;

const CHAR_Y = 730;
const CHAR_SCALE = 0.7;
const CHAR_HALF_W = 30;
const CHAR_X_MIN = 46;
const CHAR_X_MAX = 434;
const CHAR_FOLLOW_SPEED = 620;

const ROUND_TIME = 150; // 2분 30초
const PHASE_DURATION = ROUND_TIME / 8;
const DIZZY_TIME = 1000;
const CLOVER_TIME = 3000;
const POOP_PENALTY = 20;

const ITEM_R = 20;

// 8단계 — 좋은 아이템과 똥을 완전히 분리된 스폰 주기로 관리.
// 좋은 아이템은 큰 변화 없이 꾸준히 떨어지고, 똥은 단계가 오를수록 훨씬 자주 + 커짐.
const PHASE_CONFIG = [
  { goodInterval: 750, poopInterval: 2200, fallSpeed: 165, poopScale: [0.65, 1.1] },
  { goodInterval: 720, poopInterval: 1800, fallSpeed: 185, poopScale: [0.7, 1.15] },
  { goodInterval: 690, poopInterval: 1450, fallSpeed: 205, poopScale: [0.75, 1.25] },
  { goodInterval: 660, poopInterval: 1150, fallSpeed: 225, poopScale: [0.8, 1.35] },
  { goodInterval: 630, poopInterval: 900, fallSpeed: 250, poopScale: [0.85, 1.45] },
  { goodInterval: 600, poopInterval: 700, fallSpeed: 275, poopScale: [0.9, 1.55] },
  { goodInterval: 570, poopInterval: 550, fallSpeed: 300, poopScale: [0.95, 1.7] },
  { goodInterval: 540, poopInterval: 420, fallSpeed: 340, poopScale: [1.05, 1.9] },
];

const GOOD_TIERS = [
  { tier: 'common', points: 10, weight: 0.65, icons: ['🍎', '🍓', '🍬', '🍭'] },
  { tier: 'uncommon', points: 25, weight: 0.25, icons: ['⭐', '🍇', '🧁', '💐'] },
  { tier: 'rare', points: 50, weight: 0.08, icons: ['💎', '👑', '🏆'] },
  { tier: 'bonus', points: 0, weight: 0.02, icons: ['🍀'] },
];

const CHARACTERS = ['rabbit', 'dino'];
const CHAR_LABELS = { rabbit: '토끼', dino: '공룡' };

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
  catch_(tier) {
    const base = tier === 'rare' ? 900 : tier === 'uncommon' ? 760 : 620;
    this.tone(base, 0.1, 'triangle', 0.15);
    this.tone(base + 220, 0.1, 'triangle', 0.12, 0.05);
  }
  clover() { [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.14, i * 0.05)); }
  poop() { this.tone(150, 0.28, 'sawtooth', 0.14); this.tone(100, 0.3, 'sawtooth', 0.1, 0.05); }
  timeUp() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.14, i * 0.1)); }
}

class DodgeScene extends Phaser.Scene {
  constructor() { super('dodge'); }

  create() {
    this.sfx = new SoundFX();
    this.playing = false;
    this.score = 0;
    this.timeLeft = ROUND_TIME;
    this.selectedChar = 'rabbit';
    this.items = [];
    this.dizzyLeft = 0;
    this.cloverLeft = 0;
    this.animFrame = 0;
    this.pointerDown = false;
    this.pointerX = GAME_W / 2;

    this.drawBackground();
    this.buildTextures();
    this.buildUI();
    this.buildOverlay();

    this.itemLayer = this.add.container(0, 0);

    this.input.on('pointerdown', (p) => { this.sfx.ensure(); if (p.y < FIELD_TOP - 10) return; this.pointerDown = true; this.pointerX = p.x; });
    this.input.on('pointermove', (p) => { if (this.pointerDown) this.pointerX = p.x; });
    this.input.on('pointerup', () => { this.pointerDown = false; });

    this.time.addEvent({ delay: 160, loop: true, callback: () => { this.animFrame = 1 - this.animFrame; this.updateCharTexture(); } });

    this.overlay.setVisible(true);
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0xfff3d6, 0xfff3d6, 0xffe0b8, 0xffe0b8, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(0xffffff, 0.45);
    const cloud = (cx, cy, s) => {
      g.fillEllipse(cx, cy, 70 * s, 28 * s);
      g.fillEllipse(cx - 28 * s, cy + 5 * s, 42 * s, 22 * s);
      g.fillEllipse(cx + 30 * s, cy + 6 * s, 46 * s, 20 * s);
    };
    cloud(90, 140, 0.7);
    cloud(370, 190, 0.55);
    cloud(60, 300, 0.5);
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(0, FIELD_BOTTOM - 6, GAME_W, 6);
  }

  makeEmojiTexture(key, emoji, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.font = Math.floor(size * 0.78) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 1);
    this.textures.addCanvas(key, canvas);
  }

  buildTextures() {
    GOOD_TIERS.forEach((t) => t.icons.forEach((e, i) => this.makeEmojiTexture('item_' + t.tier + '_' + i, e, 48)));
    this.makeEmojiTexture('poop', '💩', 56);

    const pg = this.add.graphics();
    pg.fillStyle(0xffffff, 1);
    pg.fillCircle(6, 6, 6);
    pg.generateTexture('spark', 12, 12);
    pg.destroy();

    this.drawRabbit('rabbit_0', false);
    this.drawRabbit('rabbit_1', true);
    this.drawDino('dino_0', false);
    this.drawDino('dino_1', true);
  }

  drawRabbit(key, hop) {
    const s = 100;
    const cx = s / 2, groundY = s - 12;
    const g = this.add.graphics();
    const bodyC = 0xffaed1, earC = 0xff6f9c;
    const bounce = hop ? -6 : 0;
    const legSpread = hop ? 12 : 5;

    g.fillStyle(0xd88fb0, 0.5);
    g.fillEllipse(cx, s - 6, 26, 7);

    // 다리
    g.fillStyle(bodyC, 1);
    g.fillEllipse(cx - legSpread, groundY - 6 + (hop ? -4 : 0), 12, 16);
    g.fillEllipse(cx + legSpread, groundY - 6 + (hop ? -4 : 0), 12, 16);

    // 몸통
    g.fillStyle(bodyC, 1);
    g.fillEllipse(cx, groundY - 24 + bounce, 34, 30);

    // 귀
    [-1, 1].forEach((side) => {
      g.save();
      g.translateCanvas(cx + side * 12, groundY - 54 + bounce);
      g.rotateCanvas(side * 0.22);
      g.fillStyle(bodyC, 1);
      g.fillRoundedRect(-8, -34, 16, 34, 8);
      g.fillStyle(earC, 1);
      g.fillRoundedRect(-5, -28, 10, 22, 5);
      g.restore();
    });

    // 얼굴
    const headY = groundY - 40 + bounce;
    g.fillStyle(bodyC, 1);
    g.fillCircle(cx, headY, 22);
    g.fillStyle(0xffffff, 0.4);
    g.fillEllipse(cx - 7, headY - 8, 12, 8);
    g.fillStyle(0xff9db3, 0.55);
    g.fillEllipse(cx - 13, headY + 6, 7, 4);
    g.fillEllipse(cx + 13, headY + 6, 7, 4);
    [-1, 1].forEach((side) => {
      g.fillStyle(0x2b2b2b, 1);
      g.fillCircle(cx + side * 7, headY - 1, 3.4);
    });
    g.fillStyle(0xff8fa3, 1);
    g.fillTriangle(cx - 3, headY + 8, cx + 3, headY + 8, cx, headY + 13);

    g.generateTexture(key, s, s);
    g.destroy();
  }

  drawDino(key, step) {
    // 티라노사우루스: 큰 머리+턱, 아주 작은 팔, 두꺼운 다리, 긴 꼬리로 균형
    const s = 110;
    const cx = s / 2, groundY = s - 12;
    const g = this.add.graphics();
    const bodyC = 0x6a9950, bellyC = 0xe4edc8, darkC = 0x4a7038;
    const tilt = step ? 0.05 : -0.05;
    const legOffset = step ? 8 : -8;

    g.fillStyle(0x3a5a2e, 0.5);
    g.fillEllipse(cx, s - 6, 34, 7);

    g.save();
    g.translateCanvas(cx, groundY - 26);
    g.rotateCanvas(tilt);

    // 두꺼운 다리 (직립 자세)
    g.fillStyle(darkC, 1);
    g.fillEllipse(-13 + legOffset * 0.3, 32, 14, 17);
    g.fillEllipse(13 + legOffset * 0.3, 32 - Math.abs(legOffset) * 0.3, 14, 17);
    g.fillStyle(0xffd166, 1);
    g.fillTriangle(-16, 44, -10, 44, -13, 38);
    g.fillTriangle(10, 44, 16, 44, 13, 38);

    // 긴 꼬리 (뒤로 균형)
    g.fillStyle(bodyC, 1);
    g.fillTriangle(20, 6, 58, -4, 22, 16);

    // 몸통 (앞으로 살짝 기울어진 자세)
    g.fillStyle(bodyC, 1);
    g.fillEllipse(-2, 2, 30, 26);
    g.fillStyle(bellyC, 1);
    g.fillEllipse(-4, 10, 17, 13);

    // 등 돌기
    g.fillStyle(darkC, 1);
    [-14, -2, 10].forEach((dx) => g.fillTriangle(dx - 5, -12, dx + 5, -12, dx, -21));

    // 아주 작은 팔 (티렉스 특징)
    g.fillStyle(bodyC, 1);
    g.fillEllipse(-18, 6, 5, 8);
    g.fillEllipse(14, 6, 5, 8);

    // 큰 머리 + 턱
    const headX = 8, headY = -22;
    g.fillStyle(bodyC, 1);
    g.fillCircle(headX, headY, 21);
    g.fillEllipse(headX + 20, headY + 4, 20, 13);
    // 아래턱
    g.fillStyle(darkC, 1);
    g.fillEllipse(headX + 20, headY + 11, 17, 7);
    // 이빨
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 3; i++) g.fillTriangle(headX + 12 + i * 7, headY + 8, headX + 16 + i * 7, headY + 8, headX + 14 + i * 7, headY + 13);
    // 하이라이트
    g.fillStyle(0xffffff, 0.3);
    g.fillEllipse(headX - 8, headY - 10, 10, 7);
    // 눈 (귀엽게)
    g.fillStyle(0xffffff, 1);
    g.fillCircle(headX + 6, headY - 6, 6);
    g.fillStyle(0x2b2b2b, 1);
    g.fillCircle(headX + 8, headY - 5, 3.4);
    // 볼
    g.fillStyle(0xff9db3, 0.45);
    g.fillEllipse(headX - 4, headY + 2, 7, 5);

    g.restore();
    g.generateTexture(key, s, s);
    g.destroy();
  }

  buildUI() {
    this.scoreText = this.add.text(16, 16, '점수 0', {
      fontFamily: 'sans-serif', fontSize: '24px', color: '#6b4f3a', fontStyle: 'bold',
    }).setShadow(1, 1, '#ffffff88', 0);
    this.timerText = this.add.text(GAME_W - 16, 16, '⏱ 2:30', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#6b4f3a', fontStyle: 'bold',
    }).setOrigin(1, 0);
    this.restartBtn = this.add.text(GAME_W / 2, 16, '🔄', { fontSize: '26px' })
      .setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.restartBtn.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); this.sfx.ensure(); this.showCharSelect(); });

    this.charSprite = this.add.sprite(GAME_W / 2, CHAR_Y, 'rabbit_0').setDepth(3).setScale(CHAR_SCALE);
    this.dizzyStars = [];
    for (let i = 0; i < 3; i++) {
      this.dizzyStars.push(this.add.text(0, 0, '⭐', { fontSize: '18px' }).setVisible(false).setDepth(6));
    }
  }

  buildOverlay() {
    this.overlay = this.add.container(0, 0).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0);
    this.overlayTitle = this.add.text(GAME_W / 2, GAME_H / 2 - 200, '똥벼락을 피해라! 💩', {
      fontFamily: 'sans-serif', fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(2, 3, '#00000088', 4);
    this.overlaySub = this.add.text(GAME_W / 2, GAME_H / 2 - 140, '화면을 누르고 있으면 그 방향으로 움직여요.\n떨어지는 좋은 것들을 받고, 똥은 피하세요!\n똥 맞아도 안 죽어요, 잠깐 어지러울 뿐이에요.', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#ffffffdd', align: 'center', lineSpacing: 5,
    }).setOrigin(0.5);

    this.charLabel = this.add.text(GAME_W / 2, GAME_H / 2 - 60, '캐릭터를 골라주세요', {
      fontFamily: 'sans-serif', fontSize: '17px', color: '#ffffff',
    }).setOrigin(0.5);

    this.charButtons = {};
    const xs = { rabbit: GAME_W / 2 - 70, dino: GAME_W / 2 + 70 };
    CHARACTERS.forEach((key) => {
      const bg = this.add.circle(xs[key], GAME_H / 2 + 10, 52, 0xffffff, 0.15).setStrokeStyle(3, 0xffffff, 0.5);
      const sp = this.add.sprite(xs[key], GAME_H / 2 + 10, key + '_0').setScale(0.85);
      const label = this.add.text(xs[key], GAME_H / 2 + 66, CHAR_LABELS[key], {
        fontFamily: 'sans-serif', fontSize: '14px', color: '#ffffff',
      }).setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); this.sfx.ensure(); this.selectChar(key); });
      this.charButtons[key] = { bg, sp, label };
      this.overlay.add([bg, sp, label]);
    });

    this.overlayBtn = this.add.text(GAME_W / 2, GAME_H / 2 + 150, '시작하기 ▶', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#6b4f3a', fontStyle: 'bold', backgroundColor: '#ffd93d',
      padding: { x: 26, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.overlayBtn.on('pointerdown', () => { this.sfx.ensure(); this.startRun(); });

    this.overlay.add([dim, this.overlayTitle, this.overlaySub, this.charLabel, this.overlayBtn]);
    this.overlay.sendToBack(dim);
    this.selectChar('rabbit');
  }

  selectChar(key) {
    this.selectedChar = key;
    CHARACTERS.forEach((k) => {
      const selected = k === key;
      this.charButtons[k].bg.setFillStyle(0xffffff, selected ? 0.4 : 0.15);
      this.charButtons[k].bg.setStrokeStyle(3, selected ? 0xffd93d : 0xffffff, selected ? 1 : 0.5);
      this.charButtons[k].sp.setScale(selected ? 0.95 : 0.8);
    });
  }

  showCharSelect() {
    this.playing = false;
    this.overlayTitle.setText('똥벼락을 피해라! 💩');
    this.overlaySub.setText('화면을 누르고 있으면 그 방향으로 움직여요.\n떨어지는 좋은 것들을 받고, 똥은 피하세요!\n똥 맞아도 안 죽어요, 잠깐 어지러울 뿐이에요.');
    this.overlayBtn.setText('시작하기 ▶');
    this.charLabel.setVisible(true);
    Object.values(this.charButtons).forEach((c) => { c.bg.setVisible(true); c.sp.setVisible(true); c.label.setVisible(true); });
    this.overlay.setVisible(true);
  }

  updateCharTexture() {
    const key = this.selectedChar + '_' + this.animFrame;
    if (this.charSprite && this.textures.exists(key)) this.charSprite.setTexture(key);
  }

  startRun() {
    this.overlay.setVisible(false);
    this.score = 0;
    this.timeLeft = ROUND_TIME;
    this.dizzyLeft = 0;
    this.cloverLeft = 0;
    this.updateScoreText();
    this.items.forEach((it) => it.sprite.destroy());
    this.items = [];
    this.charSprite.setPosition(GAME_W / 2, CHAR_Y).setVisible(true);
    this.goodSpawnTimer = 300;
    this.poopSpawnTimer = 1500;
    this.playing = true;

    if (this.countdownEvent) this.countdownEvent.remove(false);
    this.countdownEvent = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickTimer() });
  }

  tickTimer() {
    if (!this.playing) return;
    this.timeLeft--;
    this.updateTimerText();
    if (this.timeLeft <= 0) this.endRound();
  }

  updateScoreText() { this.scoreText.setText('점수 ' + this.score); }
  updateTimerText() {
    const m = Math.max(0, Math.floor(this.timeLeft / 60));
    const s = Math.max(0, this.timeLeft % 60);
    this.timerText.setText('⏱ ' + m + ':' + String(s).padStart(2, '0'));
  }

  currentPhase() {
    const elapsed = ROUND_TIME - this.timeLeft;
    const idx = Phaser.Math.Clamp(Math.floor(elapsed / PHASE_DURATION), 0, PHASE_CONFIG.length - 1);
    return PHASE_CONFIG[idx];
  }

  update(time, delta) {
    if (!this.playing) return;
    const dt = Math.min(delta, 50) / 1000;

    if (this.dizzyLeft > 0) {
      this.dizzyLeft -= delta;
      this.updateDizzyStars(time);
      if (this.dizzyLeft <= 0) this.hideDizzyStars();
    } else if (this.pointerDown) {
      const dx = this.pointerX - this.charSprite.x;
      const step = Math.sign(dx) * Math.min(Math.abs(dx), CHAR_FOLLOW_SPEED * dt);
      const nx = Phaser.Math.Clamp(this.charSprite.x + step, CHAR_X_MIN, CHAR_X_MAX);
      this.charSprite.x = nx;
    }

    if (this.cloverLeft > 0) {
      this.cloverLeft -= delta;
      this.charSprite.setAlpha(Math.sin(time / 60) > 0 ? 1 : 0.55);
      if (this.cloverLeft <= 0) this.charSprite.setAlpha(1);
    }

    this.updateItems(dt);
    this.trySpawnGood(dt);
    this.trySpawnPoop(dt);
  }

  updateDizzyStars(time) {
    for (let i = 0; i < this.dizzyStars.length; i++) {
      const a = time / 200 + (i * Math.PI * 2) / this.dizzyStars.length;
      this.dizzyStars[i].setPosition(this.charSprite.x + Math.cos(a) * 24, this.charSprite.y - 60 + Math.sin(a) * 10).setVisible(true);
    }
  }
  hideDizzyStars() { this.dizzyStars.forEach((s) => s.setVisible(false)); }

  trySpawnGood(dt) {
    this.goodSpawnTimer -= dt * 1000;
    if (this.goodSpawnTimer > 0) return;
    this.goodSpawnTimer = this.currentPhase().goodInterval;

    const x = Phaser.Math.Between(30, GAME_W - 30);
    const y = FIELD_TOP - 20;
    const roll = Math.random();
    let acc = 0, chosen = GOOD_TIERS[0];
    for (const t of GOOD_TIERS) { acc += t.weight; if (roll <= acc) { chosen = t; break; } }
    const iconIdx = Phaser.Math.Between(0, chosen.icons.length - 1);
    const sprite = this.add.sprite(x, y, 'item_' + chosen.tier + '_' + iconIdx).setDepth(2);
    this.itemLayer.add(sprite);
    this.items.push({ sprite, kind: 'good', tier: chosen.tier, points: chosen.points });
  }

  trySpawnPoop(dt) {
    this.poopSpawnTimer -= dt * 1000;
    if (this.poopSpawnTimer > 0) return;
    const phase = this.currentPhase();
    this.poopSpawnTimer = phase.poopInterval;

    const x = Phaser.Math.Between(30, GAME_W - 30);
    const y = FIELD_TOP - 20;
    const scale = Phaser.Math.FloatBetween(phase.poopScale[0], phase.poopScale[1]);
    const sprite = this.add.sprite(x, y, 'poop').setScale(scale).setDepth(2);
    this.itemLayer.add(sprite);
    this.items.push({ sprite, kind: 'poop', scale });
  }

  updateItems(dt) {
    const speed = this.currentPhase().fallSpeed;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.sprite.y += speed * dt;

      if (it.sprite.y > CHAR_Y - 20 && it.sprite.y < CHAR_Y + 40) {
        const r = it.kind === 'poop' ? ITEM_R * it.scale : ITEM_R;
        if (Math.abs(it.sprite.x - this.charSprite.x) < CHAR_HALF_W + r) {
          this.onCatch(it);
          it.sprite.destroy();
          this.items.splice(i, 1);
          continue;
        }
      }
      if (it.sprite.y > GAME_H + 30) {
        it.sprite.destroy();
        this.items.splice(i, 1);
      }
    }
  }

  onCatch(it) {
    if (it.kind === 'poop') {
      if (this.cloverLeft > 0) { this.sfx.catch_('common'); return; }
      this.sfx.poop();
      this.dizzyLeft = DIZZY_TIME;
      this.score = Math.max(0, this.score - POOP_PENALTY);
      this.updateScoreText();
      this.cameras.main.shake(150, 0.008);
      this.floatText(this.charSprite.x, this.charSprite.y - 60, '으엑! -' + POOP_PENALTY, '#c0392b');
    } else if (it.tier === 'bonus') {
      this.sfx.clover();
      this.cloverLeft = CLOVER_TIME;
      this.floatText(it.sprite.x, it.sprite.y, '무적!', '#6fbf5c');
      this.burstSpark(it.sprite.x, it.sprite.y, 0x6fbf5c);
    } else {
      this.sfx.catch_(it.tier);
      this.score += it.points;
      this.updateScoreText();
      this.floatText(it.sprite.x, it.sprite.y, '+' + it.points, it.tier === 'rare' ? '#ffd93d' : '#ff9db3');
      this.burstSpark(it.sprite.x, it.sprite.y, 0xffd93d);
    }
  }

  floatText(x, y, str, color) {
    const t = this.add.text(x, y, str, {
      fontFamily: 'sans-serif', fontSize: '20px', color, fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(1, 2, '#ffffff88', 0).setDepth(10);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 550, onComplete: () => t.destroy() });
  }

  burstSpark(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const s = this.add.sprite(x, y, 'spark').setTint(color).setScale(0.7).setDepth(10);
      const angle = (Math.PI * 2 * i) / 8;
      this.tweens.add({
        targets: s, x: x + Math.cos(angle) * 32, y: y + Math.sin(angle) * 32,
        alpha: 0, scale: 0.1, duration: 350, ease: 'Cubic.easeOut', onComplete: () => s.destroy(),
      });
    }
  }

  endRound() {
    this.playing = false;
    if (this.countdownEvent) this.countdownEvent.remove(false);
    this.sfx.timeUp();
    this.overlayTitle.setText('시간 종료! ⏰');
    this.overlaySub.setText('이번 판 점수: ' + this.score + '점\n정말 잘했어요!');
    this.charLabel.setVisible(false);
    Object.values(this.charButtons).forEach((c) => { c.bg.setVisible(false); c.sp.setVisible(false); c.label.setVisible(false); });
    this.overlayBtn.setText('다시하기');
    this.overlay.setVisible(true);
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: 'game-container',
  backgroundColor: '#fff3d6',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [DodgeScene],
};

const game = new Phaser.Game(config);
