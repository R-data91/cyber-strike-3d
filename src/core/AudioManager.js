/**
 * Realistic Firearm & Footstep Audio Manager
 * - Authentic 7.62mm AK-47 gunshot audio buffer
 * - Tactile combat boot footstep sounds (heel thud, rubber tread scuff, tactical gear)
 * - Dedicated volume controls for Master, SFX, and BGM
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.limiter = null;

    this.masterVolume = 0.85;
    this.sfxVolume = 1.0;
    this.musicVolume = 0.10; // BGMデフォルト10%

    // Audio Buffers
    this.buffers = {
      rifle: null,
      ak47: null,
      shotgun: null,
      sniper: null,
      steps: [],
    };

    this.stepIndex = 0;
    this.isMusicPlaying = false;

    // 音種別レートリミット (多重再生時の過大増幅・音割れ防止)
    this.throttleMap = new Map();
  }

  // 同一音の短時間多重発火を抑制するスロットルヘルパー
  checkThrottle(key, minIntervalMs) {
    const now = performance.now();
    const last = this.throttleMap.get(key) || 0;
    if (now - last < minIntervalMs) {
      return false;
    }
    this.throttleMap.set(key, now);
    return true;
  }

  async init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    // ハードリミッターバス (DynamicsCompressorNode: 音声重なり時の過大増幅・音割れ・クリッピングを完全遮断)
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-4, this.ctx.currentTime); // -4 dBFS
    this.limiter.knee.setValueAtTime(10, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(20, this.ctx.currentTime);      // 20:1 brickwall limiting
    this.limiter.attack.setValueAtTime(0.002, this.ctx.currentTime);  // 2ms fast attack
    this.limiter.release.setValueAtTime(0.08, this.ctx.currentTime);  // 80ms release

    // Master bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

    // SFX bus (銃声・足音・被弾音)
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    this.sfxGain.connect(this.limiter);

    // BGM bus
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    this.musicGain.connect(this.limiter);

    // リミッター出力 -> マスターゲイン -> スピーカー
    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Preload audio files
    await this.loadAudioSamples();

    // Ambient background
    this.startAmbientMusic();
  }

  async loadAudioSamples() {
    const files = {
      rifle: 'rifle.wav',
      ak47: 'ak47.wav',
      shotgun: 'shotgun.wav',
      sniper: 'sniper.wav',
      bounce: 'bounce.wav',
    };

    // Calculate candidate path prefixes for root and /mobile/ routes
    const candidatePrefixes = [
      './sounds/',
      '../sounds/',
      '/sounds/',
      window.location.origin + '/sounds/',
    ];

    const fetchSample = async (filename) => {
      for (const prefix of candidatePrefixes) {
        try {
          const res = await fetch(prefix + filename);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            return await this.ctx.decodeAudioData(arrayBuffer);
          }
        } catch (e) {}
      }
      return null;
    };

    for (const [key, filename] of Object.entries(files)) {
      try {
        const buf = await fetchSample(filename);
        if (buf) this.buffers[key] = buf;
      } catch (err) {
        console.warn(`Could not load sample ${filename}:`, err);
      }
    }

    // Load footsteps step1 ~ step4
    for (let i = 1; i <= 4; i++) {
      try {
        const buf = await fetchSample(`step${i}.wav`);
        if (buf) this.buffers.steps.push(buf);
      } catch (err) {
        console.warn(`Could not load step${i}.wav:`, err);
      }
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Reusable procedural noise burst for weapon punch and explosion fallbacks
  playNoiseBurst(duration = 0.08, volume = 0.5, cutoff = 2400, filterType = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const noiseBuf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(cutoff, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noiseSource.start(t);
    noiseSource.stop(t + duration);
  }

  playSample(buffer, volume = 1.0, pitchVariation = 0.04, dest = this.sfxGain) {
    if (!this.ctx || !buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const pitch = 1.0 + (Math.random() - 0.5) * pitchVariation;
    source.playbackRate.setValueAtTime(pitch, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);

    source.connect(gain);
    gain.connect(dest);
    source.onended = () => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch (e) {}
    };
    source.start();
  }

  /**
   * 1. AK-47 銃声 (7.62x39mm 実銃発射音 ＋ プロシージャル合成フォールバック)
   */
  playRifleShot() {
    const buf = this.buffers.ak47 || this.buffers.rifle;
    if (buf) {
      this.playSample(buf, 1.45, 0.06);
      return;
    }
    // High-impact 7.62mm procedural assault rifle crack
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.07);
    oscGain.gain.setValueAtTime(0.85, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.075);
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.08);

    this.playNoiseBurst(0.08, 0.7, 2800);
  }

  /**
   * 2. ショットガン銃声 (12ゲージ・タクティカル散弾 ＋ 合成フォールバック)
   */
  playShotgunShot() {
    if (this.buffers.shotgun) {
      this.playSample(this.buffers.shotgun, 1.55, 0.04);
      return;
    }
    // Heavy 12-gauge blast procedural fallback
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.16);
    oscGain.gain.setValueAtTime(1.1, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.18);

    this.playNoiseBurst(0.14, 0.9, 1800);
  }

  /**
   * 3. 対物スナイパー / レールガン銃声 (.50 BMG 大口径砲撃音 ＋ 合成フォールバック)
   */
  playRailgunShot() {
    if (this.buffers.sniper) {
      this.playSample(this.buffers.sniper, 1.65, 0.03);
      return;
    }
    // .50 BMG Heavy Vortex Railgun blast procedural fallback
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.26);
    oscGain.gain.setValueAtTime(1.2, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.28);

    this.playNoiseBurst(0.20, 0.95, 3400);
  }

  /**
   * 4. リアルな軍靴の足音 (Tactical Combat Boot Footsteps)
   * @param {boolean} isSprinting - ダッシュ中か
   * @param {boolean} isCrouching - しゃがみ歩行中か
   */
  playFootstep(isSprinting = false, isCrouching = false) {
    if (!this.ctx || this.buffers.steps.length === 0) return;

    const buf = this.buffers.steps[this.stepIndex];
    this.stepIndex = (this.stepIndex + 1) % this.buffers.steps.length;

    let vol = 0.85;
    let pitch = 1.0 + (Math.random() - 0.5) * 0.06;

    if (isSprinting) {
      vol = 1.15; // ダッシュ時は踏み込みが強く重い音
      pitch *= 1.08;
    } else if (isCrouching) {
      vol = 0.35; // しゃがみ歩行時は忍び足で控えめな音
      pitch *= 0.92;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    source.playbackRate.setValueAtTime(pitch, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);

    source.connect(gain);
    gain.connect(this.sfxGain);
    source.onended = () => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch (e) {}
    };
    source.start();
  }

  /**
   * 5. 着地音 (Landing Thud)
   */
  playLanding() {
    if (this.buffers.steps.length > 0) {
      // 強い着地音（足音サンプルを低音・高音量で再生）
      const buf = this.buffers.steps[0];
      const source = this.ctx.createBufferSource();
      source.buffer = buf;
      source.playbackRate.setValueAtTime(0.85, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(1.3, this.ctx.currentTime);

      source.connect(gain);
      gain.connect(this.sfxGain);
      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch (e) {}
      };
      source.start();
    }
  }

  // スライディング摩擦音 (Gravel / Dirt Tactical Slide)
  playSlide() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.5);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.45);
    filter.Q.setValueAtTime(2.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.75, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.48);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.48);
  }

  /**
   * 6. 敵兵の銃撃音
   */
  playEnemyLaser(distance = 10) {
    if (!this.ctx) return;
    const vol = Math.max(0.12, 0.85 / (1 + distance * 0.08));

    const buf = this.buffers.ak47 || this.buffers.rifle;
    if (buf) {
      const source = this.ctx.createBufferSource();
      source.buffer = buf;
      source.playbackRate.setValueAtTime(0.88 + Math.random() * 0.08, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);

      source.connect(gain);
      gain.connect(this.sfxGain);
      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch (e) {}
      };
      source.start();
    }
  }

  // ヒットマーカー音 (散弾銃の多重ペレット同時命中による音割れ・クリッピング防止スロットル)
  playHitmarker(isHeadshot = false, isShotgun = false) {
    if (!this.ctx) return;
    // 同一フレーム内の多重発火によるクリッピング防止 (32msスロットル)
    if (!this.checkThrottle('hitmarker', 32)) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isShotgun ? 'triangle' : 'sine';
    const freq = isHeadshot ? 2600 : (isShotgun ? 1400 : 1800);
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + 0.07);

    const baseVol = isHeadshot ? 0.65 : (isShotgun ? 0.50 : 0.40);
    gain.gain.setValueAtTime(baseVol, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.08);

    // 散弾銃の場合は重厚なインパクト低音を追加して打撃感を強化
    if (isShotgun) {
      const thudOsc = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(220, t);
      thudOsc.frequency.exponentialRampToValueAtTime(60, t + 0.09);
      thudGain.gain.setValueAtTime(0.45, t);
      thudGain.gain.exponentialRampToValueAtTime(0.005, t + 0.09);
      thudOsc.connect(thudGain);
      thudGain.connect(this.sfxGain);
      thudOsc.start(t);
      thudOsc.stop(t + 0.09);
    }
  }

  // メカニカル音 (排莢・リロード・操作音)
  playMechanicalClick(frequency = 500, duration = 0.06, vol = 0.35) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, t);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.4, t + duration);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  // リロード音
  playReload() {
    this.playMechanicalClick(400, 0.08, 0.4);
    setTimeout(() => this.playMechanicalClick(880, 0.07, 0.5), 260);
    setTimeout(() => this.playMechanicalClick(560, 0.1, 0.6), 620);
  }

  // ジャンプ音
  playJump() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.15);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // ジャンプパッドカタパルト音
  playJumpPad() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.35);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // 撃破爆発音 (最短60ms間隔で多重爆破時の爆音・過大重なりを防止)
  playExplosion(distance = 15) {
    if (!this.checkThrottle('explosion', 60)) return;
    if (this.buffers.shotgun) {
      this.playSample(this.buffers.shotgun, Math.max(0.15, 0.9 / (1 + distance * 0.05)), 0.05);
    }
  }

  // プレイヤー被弾ダメージ音 (最短80ms間隔で被弾集中時の音割れを防止)
  playPlayerDamage() {
    if (!this.ctx) return;
    if (!this.checkThrottle('player_damage', 80)) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.16);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.16);
    } catch (e) {}
  }

  // グレネードバウンド音
  playGrenadeBounce() {
    if (this.buffers.bounce) {
      this.playSample(this.buffers.bounce, 0.75, 0.1);
    } else {
      this.playMechanicalClick(300, 0.05, 0.4);
    }
  }

  // ピン抜き・投擲音
  playGrenadePin() {
    this.playMechanicalClick(1400, 0.05, 0.6);
    setTimeout(() => this.playMechanicalClick(950, 0.08, 0.5), 80);
  }

  // シールド弾き・シールド破壊音 (高周波サイバーバリア音、最短100msスロットル)
  playShieldBreak() {
    if (!this.ctx) return;
    if (!this.checkThrottle('shield_break', 100)) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.22);

    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (e) {}
    };
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // アイテム・弾薬ピックアップ音 (最短35msスロットル)
  playPickup(isHealth = false) {
    if (!this.ctx) return;
    const throttleKey = isHealth ? 'pickup_hp' : 'pickup_ammo';
    if (!this.checkThrottle(throttleKey, 35)) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = isHealth ? 523.25 : 659.25; // C5 or E5
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.setValueAtTime(baseFreq * 1.5, t + 0.08);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // 敵の警戒アラート音 (LOS検知時)
  playAlert() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1174, t + 0.07);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  // アドレナリン・バレットタイム音 (発動・解除)
  playBulletTime(active = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    if (active) {
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.35);
    } else {
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.25);
    }

    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // レアバフ・ドロップ強化コア取得音 (煌びやかな高音サイバーコード、最短75msスロットル)
  playBuffPickup() {
    if (!this.ctx) return;
    if (!this.checkThrottle('buff_pickup', 75)) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const noteTime = t + idx * 0.04;
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.28, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.005, noteTime + 0.20);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(noteTime);
      osc.stop(noteTime + 0.20);
    });
  }

  // ウェーブクリア時の一括回収専用サウンド (耳に優しく洗練された上昇4音アルペジオチャイム)
  playSweepCollect(count = 1) {
    if (!this.ctx) return;
    if (!this.checkThrottle('sweep_collect', 500)) return;
    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const startTime = t + idx * 0.055;
      const duration = 0.24;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.04, startTime + duration);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.22, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  // プラズマSMG発射音 (高速でクリスピーな高周波パルス)
  playSmgShot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.05);

    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.055);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // 重グレネードランチャー発射音 (重く太いガス圧着弾音)
  playLauncherShot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.28);

    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // 反物質ビーム照射音 (高エネルギー共振レーザーパルス)
  playBeamTick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.07);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.075);
  }

  // レイドボス出現警報サイレン (低音と高音の二重グリッチサイレン)
  playBossAlarm() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 0.45, 0.9].forEach(offset => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, t + offset);
      osc.frequency.exponentialRampToValueAtTime(160, t + offset + 0.38);

      gain.gain.setValueAtTime(0.55, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.42);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.42);
    });
  }

  // ボス重ミサイル発射音 (ロケット噴射＋急加速音)
  playBossMissile() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.28);

    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // ボス地響き・機械咆哮
  playBossRoar() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(45, t + 0.6);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  // BGM再生制御
  playBgm(track = 'orbital') {
    if (!this.isMusicPlaying) {
      this.startAmbientMusic();
    }
  }

  // アンビエントBGM (音量控えめ)
  startAmbientMusic() {
    if (this.isMusicPlaying || !this.ctx) return;
    this.isMusicPlaying = true;

    try {
      const droneOsc = this.ctx.createOscillator();
      droneOsc.type = 'sawtooth';
      droneOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, this.ctx.currentTime);
      filter.Q.setValueAtTime(2, this.ctx.currentTime);

      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.15, this.ctx.currentTime);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(60, this.ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const droneGain = this.ctx.createGain();
      droneGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

      droneOsc.connect(filter);
      filter.connect(droneGain);
      droneGain.connect(this.musicGain);

      droneOsc.start();
      lfo.start();
    } catch (e) {
      console.warn("Ambient music init error:", e);
    }
  }

  // EXステージ専用：急上昇風切り音＆巨大推進反動スラスター環境音ループ
  playAscensionAmbience() {
    if (!this.ctx || this.ascensionWindNode) return;
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(420, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 1.2);

      // Deep rumble oscillator
      const rumble = this.ctx.createOscillator();
      rumble.type = 'sine';
      rumble.frequency.setValueAtTime(45, this.ctx.currentTime);

      const rumbleGain = this.ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      rumble.connect(rumbleGain);
      rumbleGain.connect(this.sfxGain);

      noise.start();
      rumble.start();

      this.ascensionWindNode = { noise, rumble, gain, rumbleGain };
    } catch (e) {
      console.warn('Ascension audio error:', e);
    }
  }

  stopAscensionAmbience() {
    if (!this.ascensionWindNode || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this.ascensionWindNode.gain.gain.linearRampToValueAtTime(0.001, t + 0.5);
      this.ascensionWindNode.rumbleGain.gain.linearRampToValueAtTime(0.001, t + 0.5);
      setTimeout(() => {
        try {
          if (this.ascensionWindNode) {
            this.ascensionWindNode.noise.stop();
            this.ascensionWindNode.rumble.stop();
            this.ascensionWindNode = null;
          }
        } catch (err) {}
      }, 500);
    } catch (e) {}
  }

  // EX空中ジャンプ（ジェットブースト）音
  playDoubleJump() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.22);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}
