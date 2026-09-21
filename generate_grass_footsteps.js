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

/**
 * 自然な草地・土を踏みしめるリアルな靴音
 * 以前の耳障りなクリック感や機械的な音を完全に排除し、
 * 「サクッ、ザッ」という柔らかな芝草・土の圧縮音のみで構成。
 */
function generateSoftNaturalFootstep(variant = 1, sampleRate = 44100) {
  const duration = 0.22; // 220ms
  const length = Math.floor(sampleRate * duration);
  const raw = new Float32Array(length);

  const lowFreq = 60 + variant * 6; // 66, 72, 78, 84Hz 非常に落ち着いた低音

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    // 1. 土を踏む柔らかな低音 (Damped low thump)
    const thump = Math.sin(2 * Math.PI * lowFreq * t) * Math.exp(-t * 32.0) * 0.9;

    // 2. 乾いた芝草を踏む「サクッ」という自然なノイズ (Band-limited grass rustle)
    const whiteNoise = (Math.random() * 2 - 1);
    // 指数減衰エンベロープ
    const env = Math.exp(-t * 28.0) * Math.min(1.0, t * 120.0); // わずかにアタックを滑らかに
    const rustle = whiteNoise * env * 0.65;

    let s = thump + rustle;
    raw[i] = Math.tanh(s * 1.1);
  }

  // ローパスフィルターで高域の耳障りなノイズをカット
  const rc = 1.0 / (2200 * 2 * Math.PI);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);
  const filtered = new Float32Array(length);
  filtered[0] = raw[0];
  for (let i = 1; i < length; i++) {
    filtered[i] = filtered[i - 1] + alpha * (raw[i] - filtered[i - 1]);
  }

  return filtered;
}

/**
 * グレネードピン抜き・バウンド音 (Grenade Bounce)
 */
function generateGrenadeBounce(sampleRate = 44100) {
  const duration = 0.15;
  const length = Math.floor(sampleRate * duration);
  const raw = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const tone = Math.sin(2 * Math.PI * 450 * t) * Math.exp(-t * 40.0) * 0.8;
    const click = (Math.random() * 2 - 1) * Math.exp(-t * 70.0) * 0.4;
    raw[i] = tone + click;
  }
  return raw;
}

const outDir = path.resolve('c:/Users/山際涼太/Downloads/browser-fps-game/public/sounds');
for (let v = 1; v <= 4; v++) {
  const stepWav = createWavBuffer(generateSoftNaturalFootstep(v));
  fs.writeFileSync(path.join(outDir, `step${v}.wav`), stepWav);
  console.log(`Generated soft natural footstep: step${v}.wav`);
}

const bounceWav = createWavBuffer(generateGrenadeBounce());
fs.writeFileSync(path.join(outDir, 'bounce.wav'), bounceWav);
console.log('Generated bounce.wav for grenades');
