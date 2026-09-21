import fs from 'fs';
import path from 'path';

function createWavBuffer(samples, sampleRate = 44100) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.floor(val), 44 + i * 2);
  }
  return buffer;
}

// Multi-tap reflections
function applyEarlyReflections(samples, delays, decays, sampleRate = 44100) {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i];
    for (let d = 0; d < delays.length; d++) {
      const delaySamples = Math.floor(delays[d] * sampleRate);
      if (i >= delaySamples) {
        out[i] += samples[i - delaySamples] * decays[d];
      }
    }
  }
  return out;
}

/**
 * 1. ICONIC AK-47 7.62x39mm GUNSHOT (重厚なAK-47実銃発射音)
 * 特徴:
 * - 7.62mm大口径の腹を抉る野太い破裂音 (Heavy 7.62mm Bark, 85Hz-105Hz)
 * - 粗野で乾いた火薬燃焼のガス圧ノイズ (Rough Soviet Propellant Crackle)
 * - 重量ロングストローク・ガスピストン＆スチールボルトの強烈な金属衝突音 (Heavy Steel Bolt Slap at 30-70ms)
 * - アリーナ・屋外の長い轟音エコー
 */
function generateAK47Shot(sampleRate = 44100) {
  const duration = 0.55; // 550ms
  const length = Math.floor(sampleRate * duration);
  const raw = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    // 1. 初速の超音速N-Waveショック (Muzzle Pressure Discontinuity)
    let shock = 0;
    if (t < 0.006) {
      shock = (1 - t / 0.003) * Math.exp(-t / 0.0018) * 2.6;
    }

    // 2. 7.62mm特有の野太い火薬爆裂パンチ (Heavy 88Hz Combustion Bark)
    const lowBoom = Math.sin(2 * Math.PI * 88 * t) * Math.exp(-t * 26.0) * 2.2;
    const subBoom = Math.sin(2 * Math.PI * 44 * t) * Math.exp(-t * 18.0) * 1.6;

    // 3. 荒々しいガス噴出・マズルブレーキ乱流 (Rough Gas Blast Noise)
    const blastNoise = (Math.random() * 2 - 1);
    const blastEnv = Math.exp(-t * 18.0);
    // 高周波のザラついた火薬ノイズ
    const blast = blastNoise * blastEnv * 1.8;

    // 4. AK-47特有の重厚なスチールボルト＆ガスピストン激突音 (Heavy Steel Bolt Slam at ~32ms & ~55ms)
    let boltSlap = 0;
    if (t > 0.025 && t < 0.09) {
      const tb = t - 0.025;
      // ボルト後退衝突 (Heavy Metal Slam)
      boltSlap += Math.sin(2 * Math.PI * 1650 * tb) * Math.exp(-tb * 85.0) * 0.75;
      boltSlap += Math.sin(2 * Math.PI * 2400 * tb) * Math.exp(-tb * 110.0) * 0.55;
      boltSlap += (Math.random() * 2 - 1) * Math.exp(-tb * 95.0) * 0.45;
    }

    // 5. 反響テール (Gunshot Reverb Tail)
    const tail = (Math.random() * 2 - 1) * Math.exp(-t * 6.5) * 0.55;

    // レイヤー統合
    let s = shock + lowBoom + subBoom + blast + boltSlap + tail;

    // AK特有の荒削りな歪み（ハード・サチュレーション）
    s = Math.tanh(s * 1.75);
    raw[i] = s;
  }

  // 空間反射音（床バウンス、壁面反響）
  const withReflections = applyEarlyReflections(
    raw,
    [0.005, 0.018, 0.038, 0.08, 0.15],
    [0.4, 0.32, 0.25, 0.18, 0.12],
    sampleRate
  );

  return withReflections;
}

/**
 * 2. 12-Gauge Tactical Shotgun Blast
 */
function generateShotgunShot(sampleRate = 44100) {
  const duration = 0.75;
  const length = Math.floor(sampleRate * duration);
  const raw = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    let shock = 0;
    if (t < 0.008) {
      shock = (1 - t / 0.004) * Math.exp(-t / 0.002) * 2.4;
    }

    const blast = (Math.random() * 2 - 1) * Math.exp(-t * 14.0) * 2.0;
    const subBass = Math.sin(2 * Math.PI * 40 * t) * Math.exp(-t * 16.0) * 2.2;

    // ポンプアクション音
    let pumpRack = 0;
    if (t > 0.22 && t < 0.28) {
      const tp = t - 0.22;
      pumpRack += Math.sin(2 * Math.PI * 920 * tp) * Math.exp(-tp * 80.0) * 0.45;
    }
    if (t > 0.34 && t < 0.42) {
      const tp = t - 0.34;
      pumpRack += Math.sin(2 * Math.PI * 1450 * tp) * Math.exp(-tp * 70.0) * 0.6;
    }

    const tail = (Math.random() * 2 - 1) * Math.exp(-t * 5.0) * 0.65;
    let s = shock + blast + subBass + pumpRack + tail;
    raw[i] = Math.tanh(s * 1.85);
  }

  return applyEarlyReflections(raw, [0.005, 0.02, 0.045, 0.09], [0.4, 0.3, 0.22, 0.16], sampleRate);
}

/**
 * 3. High-Caliber Sniper (.50 Caliber Anti-Material Rifle)
 */
function generateSniperShot(sampleRate = 44100) {
  const duration = 0.95;
  const length = Math.floor(sampleRate * duration);
  const raw = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    let crack = 0;
    if (t < 0.004) {
      crack = (1 - t / 0.0018) * Math.exp(-t / 0.001) * 3.0;
    }

    const blast = (Math.random() * 2 - 1) * Math.exp(-t * 10.0) * 2.4;
    const earthRumble = Math.sin(2 * Math.PI * 34 * t) * Math.exp(-t * 11.0) * 2.6;
    const echoEnv = Math.exp(-t * 3.5);
    const rollingThunder = (Math.random() * 2 - 1) * echoEnv * 0.85;

    let s = crack + blast + earthRumble + rollingThunder;
    raw[i] = Math.tanh(s * 2.0);
  }

  return applyEarlyReflections(raw, [0.008, 0.028, 0.07, 0.14, 0.24], [0.45, 0.35, 0.28, 0.2, 0.14], sampleRate);
}

/**
 * 4. REALISTIC COMBAT BOOT FOOTSTEPS (リアルなタクティカル軍靴の足音)
 * 各種バリエーション（ヒール衝突の衝撃音、ゴムソールの摩擦音、装備の微かな揺れ）
 */
function generateFootstep(variant = 1, sampleRate = 44100) {
  const duration = 0.22; // 220ms
  const length = Math.floor(sampleRate * duration);
  const raw = new Float32Array(length);

  // 微妙なピッチと音質の個体差
  const baseThumpFreq = 95 + variant * 12; // 107Hz, 119Hz, 131Hz, 143Hz
  const scuffFreq = 850 + variant * 90;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    // 1. カカト・ソールの床面激突音 (Heel Thud)
    const heelThud = Math.sin(2 * Math.PI * baseThumpFreq * t) * Math.exp(-t * 45.0) * 1.8;

    // 2. 靴底トレッドパターンの摩擦・踏み込みノイズ (Sole Friction Scuff)
    const noise = (Math.random() * 2 - 1);
    const scuffEnv = Math.exp(-t * 32.0);
    const scuffTone = Math.sin(2 * Math.PI * scuffFreq * t) * 0.4;
    const scuff = (noise + scuffTone) * scuffEnv * 1.2;

    // 3. 軍用装備・バックル・ブーツ革の擦れ音 (Tactical Gear Leather Click)
    let gearClick = 0;
    if (t > 0.015 && t < 0.06) {
      const tg = t - 0.015;
      gearClick = (Math.random() * 2 - 1) * Math.exp(-tg * 80.0) * 0.4;
    }

    let s = heelThud + scuff + gearClick;
    raw[i] = Math.tanh(s * 1.4);
  }

  return raw;
}

// 出力ディレクトリ
const outDir = path.resolve('c:/Users/山際涼太/Downloads/browser-fps-game/public/sounds');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Generating authentic AK-47 gunshot and combat boot footsteps...');

// 1. AK-47 Gunshot (ak47.wav & rifle.wav)
const akWav = createWavBuffer(generateAK47Shot());
fs.writeFileSync(path.join(outDir, 'ak47.wav'), akWav);
fs.writeFileSync(path.join(outDir, 'rifle.wav'), akWav); // 互換性のため両方保存
console.log('Created ak47.wav & rifle.wav (' + akWav.length + ' bytes)');

// 2. Shotgun & Sniper
const shotgunWav = createWavBuffer(generateShotgunShot());
fs.writeFileSync(path.join(outDir, 'shotgun.wav'), shotgunWav);
console.log('Created shotgun.wav (' + shotgunWav.length + ' bytes)');

const sniperWav = createWavBuffer(generateSniperShot());
fs.writeFileSync(path.join(outDir, 'sniper.wav'), sniperWav);
console.log('Created sniper.wav (' + sniperWav.length + ' bytes)');

// 3. Footsteps (step1.wav ~ step4.wav)
for (let v = 1; v <= 4; v++) {
  const stepWav = createWavBuffer(generateFootstep(v));
  fs.writeFileSync(path.join(outDir, `step${v}.wav`), stepWav);
  console.log(`Created step${v}.wav (${stepWav.length} bytes)`);
}

console.log('All authentic sound assets generated successfully!');
