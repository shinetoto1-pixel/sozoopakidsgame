// ---------- 꼬물꼬물 지렁이 ----------

const GAME_W = 480;
const GAME_H = 800;
const FIELD_TOP = 96;
const FIELD_BOTTOM = 788;
const FIELD_LEFT = 14;
const FIELD_RIGHT = 466;

const SEG_R = 15;
const SEG_SPACING = 17;
const HEAD_R = 19;
const START_SEGMENTS = 6;
const BASE_SPEED = 150;
const TURN_RATE = 3.6; // rad/s
const FOOD_R = 17;
const FOOD_EMOJIS = ['🍎', '🍓', '🍇', '🍊', '🍒', '🍑'];

class SoundFX {
  constructor() { this.ctx = null; }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq, dur, type = 'sine', vol = 0.16, delay = 0) {
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
  eat() { this.tone(680, 0.09, 'triangle', 0.15); this.tone(920, 0.09, 'triangle', 0.12, 0.05); }
  gameOver() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'sawtooth', 0.11, i * 0.13)); }
}

class WormScene extends Phaser.Scene {
  constructor() { super('worm'); }

  create() {
    this.sfx = new SoundFX();
    this.playing = false;
    this.score = 0;
    this.pointerDown = false;
    this.pointerX = GAME_W / 2;
    this.pointerY = GAME_H / 2;

    this.drawBackground();
    this.buildTextures();

    this.foodSprite = null;
    this.bodySprites = [];
    this.headSprite = null;

    this.scoreText = this.add.text(20, 20, '점수 0', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
    }).setShadow(1, 2, '#00000055', 2);

    this.restartBtn = this.add.text(GAME_W - 20, 20, '🔄', { fontSize: '30px' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.restartBtn.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); this.startGame(); });

    this.overlay = this.add.container(0, 0).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0);
    this.overlayTitle = this.add.text(GAME_W / 2, GAME_H / 2 - 90, '꼬물꼬물 지렁이 🐛', {
      fontFamily: 'sans-serif', fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(2, 3, '#00000088', 4);
    this.overlaySub = this.add.text(GAME_W / 2, GAME_H / 2 - 20, '화면을 누르고 있으면 그 방향으로 움직여요.\n과일을 먹고 몸을 길게 만들어보세요!\n벽이나 내 몸에 부딪히면 끝이에요.', {
      fontFamily: 'sans-serif', fontSize: '17px', color: '#ffffffdd', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);
    this.overlayBtn = this.add.text(GAME_W / 2, GAME_H / 2 + 70, '시작하기 ▶', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#345024', fontStyle: 'bold', backgroundColor: '#ffd93d',
      padding: { x: 26, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.overlay.add([dim, this.overlayTitle, this.overlaySub, this.overlayBtn]);
    this.overlayBtn.on('pointerdown', () => { this.sfx.ensure(); this.startGame(); });

    this.input.on('pointerdown', (p) => {
      this.sfx.ensure();
      if (p.y < FIELD_TOP - 6) return;
      this.pointerDown = true;
      this.pointerX = p.x; this.pointerY = p.y;
    });
    this.input.on('pointermove', (p) => {
      if (!this.pointerDown) return;
      this.pointerX = p.x; this.pointerY = p.y;
    });
    this.input.on('pointerup', () => { this.pointerDown = false; });

    this.overlay.setVisible(true);
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0xdff2b0, 0xdff2b0, 0xb7e29a, 0xb7e29a, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(0xffffff, 0.35);
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(20, GAME_W - 20);
      const y = Phaser.Math.Between(FIELD_TOP, FIELD_BOTTOM);
      g.fillCircle(x, y, Phaser.Math.Between(10, 22));
    }
    g.lineStyle(4, 0x6f9c4a, 0.8);
    g.strokeRoundedRect(FIELD_LEFT, FIELD_TOP, FIELD_RIGHT - FIELD_LEFT, FIELD_BOTTOM - FIELD_TOP, 18);
  }

  buildTextures() {
    // 몸통 마디
    const g = this.add.graphics();
    const bs = SEG_R * 2.2;
    g.fillStyle(0x6fbf5c, 1);
    g.fillCircle(bs / 2, bs / 2, SEG_R);
    g.fillStyle(0x8ed97e, 1);
    g.fillCircle(bs / 2, bs / 2, SEG_R * 0.72);
    g.fillStyle(0xffffff, 0.4);
    g.fillEllipse(bs / 2 - SEG_R * 0.3, bs / 2 - SEG_R * 0.35, SEG_R * 0.5, SEG_R * 0.32);
    g.generateTexture('segment', bs, bs);
    g.destroy();

    // 머리 (전방이 오른쪽을 향하도록)
    const hg = this.add.graphics();
    const hs = HEAD_R * 2.6;
    const hcx = hs / 2, hcy = hs / 2;
    hg.fillStyle(0x6fbf5c, 1);
    hg.fillCircle(hcx, hcy, HEAD_R);
    hg.fillStyle(0xffffff, 0.35);
    hg.fillEllipse(hcx - HEAD_R * 0.3, hcy - HEAD_R * 0.35, HEAD_R * 0.5, HEAD_R * 0.32);
    // 더듬이
    hg.lineStyle(2.4, 0x4a9a3a, 1);
    hg.beginPath(); hg.moveTo(hcx - HEAD_R * 0.3, hcy - HEAD_R * 0.85); hg.lineTo(hcx - HEAD_R * 0.55, hcy - HEAD_R * 1.35); hg.strokePath();
    hg.beginPath(); hg.moveTo(hcx + HEAD_R * 0.3, hcy - HEAD_R * 0.85); hg.lineTo(hcx + HEAD_R * 0.55, hcy - HEAD_R * 1.35); hg.strokePath();
    hg.fillStyle(0x8ed97e, 1);
    hg.fillCircle(hcx - HEAD_R * 0.55, hcy - HEAD_R * 1.35, 4);
    hg.fillCircle(hcx + HEAD_R * 0.55, hcy - HEAD_R * 1.35, 4);
    // 볼
    hg.fillStyle(0xff9db3, 0.5);
    hg.fillEllipse(hcx - HEAD_R * 0.1, hcy + HEAD_R * 0.35, HEAD_R * 0.3, HEAD_R * 0.18);
    // 눈 (전방인 오른쪽으로 치우침)
    [-1, 1].forEach((side) => {
      hg.fillStyle(0x2b2b2b, 1);
      hg.fillCircle(hcx + HEAD_R * 0.32, hcy + side * HEAD_R * 0.32, HEAD_R * 0.17);
      hg.fillStyle(0xffffff, 0.9);
      hg.fillCircle(hcx + HEAD_R * 0.26, hcy + side * HEAD_R * 0.32 - HEAD_R * 0.05, HEAD_R * 0.06);
    });
    hg.generateTexture('worm_head', hs, hs);
    hg.destroy();

    // 과일 이모지 텍스처
    FOOD_EMOJIS.forEach((emoji, i) => this.makeEmojiTexture('food' + i, emoji));

    // 반짝이
    const pg = this.add.graphics();
    pg.fillStyle(0xffffff, 1);
    pg.fillCircle(6, 6, 6);
    pg.generateTexture('spark', 12, 12);
    pg.destroy();
  }

  makeEmojiTexture(key, emoji) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.font = '46px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 2);
    this.textures.addCanvas(key, canvas);
  }

  startGame() {
    this.overlay.setVisible(false);
    this.playing = true;
    this.score = 0;
    this.updateScoreText();
    this.pointerDown = false;

    this.bodySprites.forEach((s) => s.destroy());
    this.bodySprites = [];
    if (this.headSprite) this.headSprite.destroy();
    if (this.foodSprite) this.foodSprite.destroy();

    this.headX = GAME_W / 2;
    this.headY = GAME_H / 2;
    this.heading = 0;
    this.segmentCount = START_SEGMENTS;
    this.foodEaten = 0;

    // 시작할 때부터 몸통이 머리 뒤로 일직선으로 펼쳐지도록 경로를 미리 채워둔다
    // (안 그러면 첫 프레임에 모든 마디가 머리와 겹쳐서 즉시 자기 몸 충돌 판정이 나버림)
    const backDist = (this.segmentCount + 4) * SEG_SPACING;
    const steps = 48;
    this.path = [];
    for (let i = steps; i >= 0; i--) {
      const d = (backDist * i) / steps;
      this.path.push({
        x: this.headX - Math.cos(this.heading) * d,
        y: this.headY - Math.sin(this.heading) * d,
      });
    }

    this.headSprite = this.add.sprite(this.headX, this.headY, 'worm_head').setDepth(2);
    for (let i = 0; i < this.segmentCount; i++) {
      const pos = this.getPointAtDistance((i + 1) * SEG_SPACING);
      this.bodySprites.push(this.add.sprite(pos.x, pos.y, 'segment').setDepth(1));
    }

    this.spawnFood();
  }

  updateScoreText() { this.scoreText.setText('점수 ' + this.score); }

  spawnFood() {
    if (this.foodSprite) this.foodSprite.destroy();
    const x = Phaser.Math.Between(FIELD_LEFT + 30, FIELD_RIGHT - 30);
    const y = Phaser.Math.Between(FIELD_TOP + 30, FIELD_BOTTOM - 30);
    const key = 'food' + Phaser.Math.Between(0, FOOD_EMOJIS.length - 1);
    this.foodSprite = this.add.sprite(x, y, key).setDepth(1.5);
    this.tweens.add({ targets: this.foodSprite, scale: { from: 0.7, to: 1 }, duration: 220, ease: 'Back.easeOut' });
  }

  update(time, delta) {
    if (!this.playing) return;
    const dt = Math.min(delta, 50) / 1000;

    if (this.pointerDown) {
      const targetAngle = Math.atan2(this.pointerY - this.headY, this.pointerX - this.headX);
      this.heading = Phaser.Math.Angle.RotateTo(this.heading, targetAngle, TURN_RATE * dt);
    }

    const speed = BASE_SPEED + Math.min(70, this.foodEaten * 3);
    this.headX += Math.cos(this.heading) * speed * dt;
    this.headY += Math.sin(this.heading) * speed * dt;

    if (this.headX - HEAD_R < FIELD_LEFT || this.headX + HEAD_R > FIELD_RIGHT ||
        this.headY - HEAD_R < FIELD_TOP || this.headY + HEAD_R > FIELD_BOTTOM) {
      this.endGame();
      return;
    }

    this.path.push({ x: this.headX, y: this.headY });
    const maxNeeded = (this.segmentCount + 4) * SEG_SPACING;
    while (this.path.length > 4 && this.pathLength() > maxNeeded + 40) this.path.shift();

    this.headSprite.setPosition(this.headX, this.headY).setRotation(this.heading);

    for (let i = 0; i < this.bodySprites.length; i++) {
      const pos = this.getPointAtDistance((i + 1) * SEG_SPACING);
      this.bodySprites[i].setPosition(pos.x, pos.y);
    }

    for (let i = 4; i < this.bodySprites.length; i++) {
      const s = this.bodySprites[i];
      if (Phaser.Math.Distance.Between(this.headX, this.headY, s.x, s.y) < SEG_R * 1.1) {
        this.endGame();
        return;
      }
    }

    if (this.foodSprite && Phaser.Math.Distance.Between(this.headX, this.headY, this.foodSprite.x, this.foodSprite.y) < HEAD_R + FOOD_R) {
      this.eatFood();
    }
  }

  pathLength() {
    let total = 0;
    for (let i = 1; i < this.path.length; i++) {
      total += Phaser.Math.Distance.Between(this.path[i - 1].x, this.path[i - 1].y, this.path[i].x, this.path[i].y);
    }
    return total;
  }

  getPointAtDistance(dist) {
    let remaining = dist;
    for (let i = this.path.length - 1; i > 0; i--) {
      const a = this.path[i], b = this.path[i - 1];
      const segLen = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (remaining <= segLen) {
        const t = segLen === 0 ? 0 : remaining / segLen;
        return { x: Phaser.Math.Linear(a.x, b.x, t), y: Phaser.Math.Linear(a.y, b.y, t) };
      }
      remaining -= segLen;
    }
    return this.path[0];
  }

  eatFood() {
    this.score += 10;
    this.foodEaten++;
    this.updateScoreText();
    this.sfx.eat();
    this.burstSpark(this.foodSprite.x, this.foodSprite.y);
    this.segmentCount++;
    const lastPos = this.bodySprites.length
      ? { x: this.bodySprites[this.bodySprites.length - 1].x, y: this.bodySprites[this.bodySprites.length - 1].y }
      : { x: this.headX, y: this.headY };
    this.bodySprites.push(this.add.sprite(lastPos.x, lastPos.y, 'segment').setDepth(1));
    this.spawnFood();
  }

  burstSpark(x, y) {
    for (let i = 0; i < 8; i++) {
      const s = this.add.sprite(x, y, 'spark').setScale(0.6).setDepth(3);
      const angle = (Math.PI * 2 * i) / 8;
      this.tweens.add({
        targets: s,
        x: x + Math.cos(angle) * 36,
        y: y + Math.sin(angle) * 36,
        alpha: 0,
        scale: 0.1,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => s.destroy(),
      });
    }
  }

  endGame() {
    this.playing = false;
    this.pointerDown = false;
    this.sfx.gameOver();
    this.overlayTitle.setText('게임 오버');
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
  backgroundColor: '#dff2b0',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [WormScene],
};

const game = new Phaser.Game(config);
