// ---------- 짝꿍 찾기 (카드 매칭) ----------

const GAME_W = 480;
const GAME_H = 800;

const PLAY_LEFT = 20;
const PLAY_RIGHT = 460;
const PLAY_TOP = 112;
const PLAY_BOTTOM = 780;
const GAP = 10;
const MAX_CARD_SIZE = 108;

const LEVELS = [
  { pairs: 3, cols: 3, rows: 2 },
  { pairs: 4, cols: 4, rows: 2 },
  { pairs: 6, cols: 4, rows: 3 },
  { pairs: 8, cols: 4, rows: 4 },
  { pairs: 10, cols: 4, rows: 5 },
];

const THEMES = {
  animal: { label: '동물', icons: ['🐶', '🐱', '🐰', '🐻', '🦊', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐵'], bg: 0xeafaf0, border: 0x4caf7d },
  fruit: { label: '과일', icons: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍑', '🍒', '🍍', '🥝', '🍐'], bg: 0xfff3e0, border: 0xff9f5b },
  vehicle: { label: '탈것', icons: ['🚗', '🚕', '🚌', '🚓', '🚑', '🚒', '🚚', '🚲', '🏍️', '🚂', '✈️', '⛵'], bg: 0xe8f1ff, border: 0x4d96ff },
  sea: { label: '바다생물', icons: ['🐠', '🐡', '🐙', '🦀', '🐬', '🐳', '🦈', '🐢', '🦑', '🐚', '🦐', '🦞'], bg: 0xe0f7fa, border: 0x26a9c4 },
  dessert: { label: '디저트', icons: ['🍦', '🍩', '🍪', '🍫', '🍭', '🍬', '🎂', '🧁', '🍮', '🍯', '🍡', '🍧'], bg: 0xffe8f0, border: 0xff6b9d },
  space: { label: '우주', icons: ['🚀', '⭐', '🌙', '☄️', '🪐', '🌍', '👽', '🛸', '✨', '🌌', '🧑‍🚀', '🌠'], bg: 0xefe8ff, border: 0x8b6fd6 },
};
const THEME_KEYS = Object.keys(THEMES);

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
  flip() { this.tone(420, 0.06, 'sine', 0.08); }
  match() { [660, 880, 1100].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.15, i * 0.07)); }
  noMatch() { this.tone(260, 0.16, 'sine', 0.09); this.tone(220, 0.18, 'sine', 0.07, 0.05); }
  stageClear() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.14, i * 0.09)); }
  allClear() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.15, i * 0.1)); }
}

class MatchScene extends Phaser.Scene {
  constructor() { super('match'); }

  create() {
    this.sfx = new SoundFX();
    this.stage = 1;
    this.stageGen = 0;
    this.cards = [];
    this.firstCard = null;
    this.secondCard = null;
    this.inputLocked = true;

    this.drawBackground();
    this.buildTextures();
    this.buildUI();
    this.buildOverlays();

    this.cardLayer = this.add.container(0, 0);

    const saved = parseInt(localStorage.getItem('cardMatchStage'), 10);
    if (saved >= 1 && saved <= LEVELS.length) {
      this.stage = saved;
      this.startStage(); // 새로고침 시 저장해둔 단계로 바로 이어서 시작 (소재는 새로 랜덤)
    } else {
      this.overlay.setVisible(true);
    }
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x8b6fd6, 0x8b6fd6, 0xd6c8ff, 0xd6c8ff, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(0xffffff, 0.12);
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(10, GAME_W - 10);
      const y = Phaser.Math.Between(PLAY_TOP, PLAY_BOTTOM);
      g.fillCircle(x, y, Phaser.Math.Between(3, 7));
    }
  }

  roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  makeCardTexture(key, emoji, bgHex, borderHex) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const bg = '#' + bgHex.toString(16).padStart(6, '0');
    const border = '#' + borderHex.toString(16).padStart(6, '0');
    this.roundRectPath(ctx, 4, 4, size - 8, size - 8, 18);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = border;
    ctx.stroke();
    ctx.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 4);
    this.textures.addCanvas(key, canvas);
  }

  buildTextures() {
    this.makeCardTexture('card_back', '🧩', 0x5b4b8a, 0x3d3163);
    THEME_KEYS.forEach((key) => {
      const theme = THEMES[key];
      theme.icons.forEach((emoji, i) => {
        this.makeCardTexture('face_' + key + '_' + i, emoji, theme.bg, theme.border);
      });
    });

    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('spark', 12, 12);
    g.destroy();
  }

  buildUI() {
    this.stageText = this.add.text(20, 20, '1 / 5 단계', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setShadow(1, 2, '#00000055', 2);

    this.restartBtn = this.add.text(GAME_W - 20, 20, '🔄', { fontSize: '30px' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.restartBtn.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); this.sfx.ensure(); this.startRun(); });

    this.stageBanner = this.add.text(GAME_W / 2, PLAY_TOP / 2 + 20, '', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold', backgroundColor: '#00000055',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setDepth(20).setVisible(false);
  }

  buildOverlays() {
    this.overlay = this.add.container(0, 0).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0);
    this.overlayTitle = this.add.text(GAME_W / 2, GAME_H / 2 - 90, '짝꿍 찾기 🧩', {
      fontFamily: 'sans-serif', fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(2, 3, '#00000088', 4);
    this.overlaySub = this.add.text(GAME_W / 2, GAME_H / 2 - 20, '카드를 뒤집어서 같은 그림 두 장을\n찾아보세요! 시간 제한은 없어요.', {
      fontFamily: 'sans-serif', fontSize: '17px', color: '#ffffffdd', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);
    this.overlayBtn = this.add.text(GAME_W / 2, GAME_H / 2 + 70, '시작하기 ▶', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#4a3f6b', fontStyle: 'bold', backgroundColor: '#ffd93d',
      padding: { x: 26, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.overlayBtn.on('pointerdown', () => { this.sfx.ensure(); this.overlayBtn.off('pointerdown'); this.startRun(); });
    this.overlay.add([dim, this.overlayTitle, this.overlaySub, this.overlayBtn]);
  }

  startRun() {
    this.overlay.setVisible(false);
    this.stage = 1;
    this.startStage();
  }

  startStage() {
    this.stageGen++;
    localStorage.setItem('cardMatchStage', this.stage);
    this.inputLocked = true;
    this.firstCard = null;
    this.secondCard = null;
    this.cards.forEach((c) => c.sprite.destroy());
    this.cards = [];

    const level = LEVELS[this.stage - 1];
    const themeKey = Phaser.Utils.Array.GetRandom(THEME_KEYS);
    const theme = THEMES[themeKey];

    const iconIdxs = Phaser.Utils.Array.Shuffle([...Array(theme.icons.length).keys()]).slice(0, level.pairs);
    const deck = Phaser.Utils.Array.Shuffle([...iconIdxs, ...iconIdxs]);

    const availW = PLAY_RIGHT - PLAY_LEFT;
    const availH = PLAY_BOTTOM - PLAY_TOP;
    const cardW = (availW - (level.cols - 1) * GAP) / level.cols;
    const cardH = (availH - (level.rows - 1) * GAP) / level.rows;
    const size = Math.min(cardW, cardH, MAX_CARD_SIZE);
    const gridW = level.cols * size + (level.cols - 1) * GAP;
    const gridH = level.rows * size + (level.rows - 1) * GAP;
    const startX = PLAY_LEFT + (availW - gridW) / 2 + size / 2;
    const startY = PLAY_TOP + (availH - gridH) / 2 + size / 2;

    deck.forEach((iconIdx, i) => {
      const row = Math.floor(i / level.cols);
      const col = i % level.cols;
      const x = startX + col * (size + GAP);
      const y = startY + row * (size + GAP);
      const sprite = this.add.sprite(x, y, 'card_back').setDisplaySize(size, size).setInteractive({ useHandCursor: true });
      this.cardLayer.add(sprite);
      const card = {
        sprite, faceTexKey: 'face_' + themeKey + '_' + iconIdx, iconIdx,
        matched: false, faceUp: false, baseScaleX: sprite.scaleX, baseScaleY: sprite.scaleY,
      };
      sprite.on('pointerdown', () => this.onCardTap(card));
      this.cards.push(card);
    });

    this.matchedPairs = 0;
    this.totalPairs = level.pairs;
    this.stageText.setText(this.stage + ' / ' + LEVELS.length + ' 단계');

    this.stageBanner.setText(this.stage + '단계 - ' + theme.label + ' ' + theme.icons[0]).setAlpha(1).setVisible(true);
    this.time.delayedCall(1400, () => {
      this.tweens.add({
        targets: this.stageBanner, alpha: 0, duration: 300,
        onComplete: () => { this.stageBanner.setVisible(false); this.inputLocked = false; },
      });
    });
  }

  onCardTap(card) {
    if (this.inputLocked || card.matched || card.faceUp) return;
    this.sfx.ensure();
    card.faceUp = true;
    this.sfx.flip();
    this.flipCard(card, true, () => {
      if (!this.firstCard) {
        this.firstCard = card;
        return;
      }
      this.secondCard = card;
      this.inputLocked = true;
      this.evaluatePair();
    });
  }

  flipCard(card, toFaceUp, cb) {
    this.tweens.add({
      targets: card.sprite, scaleX: 0, duration: 130, ease: 'Cubic.easeIn',
      onComplete: () => {
        card.sprite.setTexture(toFaceUp ? card.faceTexKey : 'card_back');
        this.tweens.add({
          targets: card.sprite, scaleX: card.baseScaleX, duration: 130, ease: 'Cubic.easeOut',
          onComplete: cb,
        });
      },
    });
  }

  evaluatePair() {
    const a = this.firstCard, b = this.secondCard;
    if (a.iconIdx === b.iconIdx) {
      a.matched = true; b.matched = true;
      this.sfx.match();
      this.burstSpark(a.sprite.x, a.sprite.y);
      this.burstSpark(b.sprite.x, b.sprite.y);
      [a, b].forEach((c) => {
        this.tweens.add({ targets: c.sprite, scale: c.baseScaleX * 1.12, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
      });
      this.firstCard = null;
      this.secondCard = null;
      this.inputLocked = false;
      this.matchedPairs++;
      if (this.matchedPairs >= this.totalPairs) {
        this.time.delayedCall(300, () => this.onStageClear());
      }
    } else {
      this.sfx.noMatch();
      const gen = this.stageGen;
      this.time.delayedCall(750, () => {
        if (this.stageGen !== gen) return; // 그 사이 재시작/다음 단계로 넘어갔으면 무시
        this.flipCard(a, false, () => { a.faceUp = false; });
        this.flipCard(b, false, () => {
          b.faceUp = false;
          this.firstCard = null;
          this.secondCard = null;
          this.inputLocked = false;
        });
      });
    }
  }

  burstSpark(x, y) {
    for (let i = 0; i < 8; i++) {
      const s = this.add.sprite(x, y, 'spark').setTint(0xffd93d).setScale(0.7).setDepth(10);
      const angle = (Math.PI * 2 * i) / 8;
      this.tweens.add({
        targets: s, x: x + Math.cos(angle) * 36, y: y + Math.sin(angle) * 36,
        alpha: 0, scale: 0.1, duration: 380, ease: 'Cubic.easeOut', onComplete: () => s.destroy(),
      });
    }
  }

  onStageClear() {
    this.inputLocked = true;
    if (this.stage >= LEVELS.length) {
      this.sfx.allClear();
      this.overlayTitle.setText('모두 클리어! 🏆');
      this.overlaySub.setText('5단계를 전부 다 맞췄어요!\n정말 대단해요!');
      this.overlayBtn.setText('처음부터 다시 ▶');
      this.overlayBtn.on('pointerdown', () => { this.sfx.ensure(); this.overlayBtn.off('pointerdown'); this.startRun(); });
      this.overlay.setVisible(true);
    } else {
      this.sfx.stageClear();
      this.overlayTitle.setText(this.stage + '단계 클리어! 🎉');
      this.overlaySub.setText('잘했어요!');
      this.overlayBtn.setText('다음 단계 ▶');
      this.overlayBtn.on('pointerdown', () => {
        this.sfx.ensure();
        this.overlayBtn.off('pointerdown');
        this.overlay.setVisible(false);
        this.stage++;
        this.startStage();
      });
      this.overlay.setVisible(true);
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: 'game-container',
  backgroundColor: '#8b6fd6',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MatchScene],
};

const game = new Phaser.Game(config);
