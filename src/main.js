import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { AudioManager } from './core/AudioManager.js';
import { InputManager } from './core/InputManager.js';
import { ParticleSystem } from './world/Particles.js';
import { Level } from './world/Level.js';
import { Player } from './entities/Player.js';
import { EnemyHumanoid, EnemyBoss, EnemyEXDrone, EnemyEXValkyrie } from './entities/Enemy.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';
import { disposeHierarchy } from './utils/dispose.js';

const BOSS_SHAPES = ['arachne', 'leviathan', 'colossus', 'apocalypse'];
const BOSS_INFO = {
  arachne: { shape: 'arachne', name: '重装蜘蛛要塞 TITAN-ARACHNE', baseDamage: 30 },
  leviathan: { shape: 'leviathan', name: '反重力浮遊要塞 GOLIATH-LEVIATHAN', baseDamage: 34 },
  colossus: { shape: 'colossus', name: '殲滅巨神 COLOSSUS-PRIME', baseDamage: 38 },
  apocalypse: { shape: 'apocalypse', name: '終焉神官 APOCALYPSE-CORE', baseDamage: 42 },
  seraph: { shape: 'seraph', name: '終焉天核 OMEGA-SERAPH', baseDamage: 48 },
};

// 3D戦術アイテム用 共有ジオメトリキャッシュ (ドロップ生成時のGPUアロケーションと破棄スタッターをゼロ化)
const _sharedPickupGeoCache = {
  boxHealth: new THREE.BoxGeometry(0.7, 0.45, 0.5),
  cross1: new THREE.BoxGeometry(0.36, 0.1, 0.52),
  cross2: new THREE.BoxGeometry(0.1, 0.36, 0.52),
  beam32: new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8),
  beam38: new THREE.CylinderGeometry(0.04, 0.04, 3.8, 8),
  beam40: new THREE.CylinderGeometry(0.04, 0.04, 4.0, 8),
  beam45: new THREE.CylinderGeometry(0.06, 0.06, 4.5, 8),
  prism: new THREE.CylinderGeometry(0.24, 0.28, 0.45, 6),
  ring40: new THREE.TorusGeometry(0.4, 0.03, 8, 20),
  octa32: new THREE.OctahedronGeometry(0.32, 0),
  ring44: new THREE.TorusGeometry(0.44, 0.03, 8, 20),
  cyl24: new THREE.CylinderGeometry(0.24, 0.24, 0.44, 8),
  ringCyl: new THREE.CylinderGeometry(0.27, 0.27, 0.06, 8),
  cone26: new THREE.CylinderGeometry(0.22, 0.28, 0.44, 6),
  ring42: new THREE.TorusGeometry(0.42, 0.028, 8, 20),
  ring48: new THREE.TorusGeometry(0.48, 0.03, 8, 24),
  ring38: new THREE.TorusGeometry(0.38, 0.025, 8, 20),
  turbCyl: new THREE.CylinderGeometry(0.18, 0.26, 0.48, 6),
  finRing: new THREE.TorusGeometry(0.38, 0.04, 6, 16),
  dodec32: new THREE.DodecahedronGeometry(0.32, 0),
  ring46: new THREE.TorusGeometry(0.46, 0.03, 8, 24),
  octa28: new THREE.OctahedronGeometry(0.28, 0),
  ico36: new THREE.IcosahedronGeometry(0.36, 0),
  halo52: new THREE.TorusGeometry(0.52, 0.035, 8, 24),
  boxAmmo: new THREE.BoxGeometry(0.75, 0.45, 0.5),
  stripeAmmo: new THREE.BoxGeometry(0.8, 0.12, 0.52),
};

function createCachedPickupMesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.userData.preserveGeometry = true;
  return m;
}

class CyberStrikeGame {
  constructor() {
    this.state = 'MENU'; // 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'

    // Core Systems
    this.engine = new Engine('canvas-container');
    this.audio = new AudioManager();
    this.input = new InputManager(this.engine.renderer.domElement);
    this.particles = new ParticleSystem(this.engine.scene);
    this.level = new Level(this.engine.scene);
    this.player = new Player(this.engine, this.input, this.audio, this.particles, this.level);
    this.hud = new HUD();
    this.minimap = new Minimap('minimap-canvas');

    // EX Stage & Altitude State
    this.isEXStage = false;
    this.lastBossShape = null;
    this.currentBossInfo = null;
    this.level.onAltitudeUpdate = (alt) => {
      this.hud.setAltitude(alt);
    };

    // Entities & Projectiles
    this.enemies = [];
    this.enemyProjectiles = [];
    this.grenades = [];
    this.pickups = [];

    // Wave Management & Concurrent Queueing
    this.wave = 1;
    this.totalWaveEnemies = 0;
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesKilled = 0;
    this.pendingEnemySpawns = 0; // 敵補充スタッガーキュー (1フレーム1体スポーンでメッシュ生成スパイクを解消)
    this.maxConcurrentEnemies = 12; // 同時出現上限 (高次ウェーブでのCPU負荷・ドローコール激増を抑制)
    this.waveState = 'IN_PROGRESS'; // 'IN_PROGRESS' | 'CLEARED'
    this.waveIntermissionTimer = 0;

    // Combat Stats & Scoring
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.kills = 0;
    this.headshots = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;

    // Performance & Telemetry Tracking
    this.perfFrames = 0;
    this.perfElapsed = 0;
    this.perfLogTimer = 0;
    this.currentFps = 60;
    this.currentFrameTime = 16.6;

    // DOM UI Overlays
    this.startScreen = document.getElementById('start-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');

    this.bindEvents();
    this.setupPlayerCallbacks();

    // Start Main Render Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  bindEvents() {
    // Start button
    const btnStart = document.getElementById('btn-start-game');
    btnStart.addEventListener('click', () => {
      this.audio.init();
      this.audio.resume();
      this.startGame();
    });

    // EX Stage Instant Start button
    const btnStartEx = document.getElementById('btn-start-ex');
    if (btnStartEx) {
      btnStartEx.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startEXStage();
      });
    }

    // URLクエリまたはハッシュによるEXステージ直行サポート (?ex, ?stage=ex, #ex)
    if (window.location.search.includes('ex') || window.location.hash.includes('ex')) {
      setTimeout(() => {
        this.startEXStage();
      }, 150);
    }
    window.addEventListener('hashchange', () => {
      if (window.location.hash.includes('ex')) {
        this.startEXStage();
      }
    });
    window.startEX = () => this.startEXStage();

    // Pause Resume button
    const btnResume = document.getElementById('btn-resume-game');
    btnResume.addEventListener('click', () => {
      this.resumeGame();
    });

    // Pause EX Stage Jump button
    const btnPauseEx = document.getElementById('btn-pause-ex');
    if (btnPauseEx) {
      btnPauseEx.addEventListener('click', () => {
        this.startEXStage();
      });
    }

    // Restart button
    const btnRestart = document.getElementById('btn-restart-game');
    btnRestart.addEventListener('click', () => {
      this.restartGame();
    });

    // Play again button
    const btnPlayAgain = document.getElementById('btn-play-again');
    btnPlayAgain.addEventListener('click', () => {
      this.restartGame();
    });

    // Mouse Sensitivity Controls (0.05まで細かく設定可能)
    const sensSlider = document.getElementById('input-sens');
    const sensValDisplay = document.getElementById('sens-val-display');
    const pauseSensSlider = document.getElementById('pause-input-sens');
    const pauseSensVal = document.getElementById('pause-sens-val');

    const updateSens = (val) => {
      const num = parseFloat(val);
      this.input.setSensitivity(num);
      sensSlider.value = num;
      pauseSensSlider.value = num;
      sensValDisplay.textContent = num.toFixed(2);
      pauseSensVal.textContent = num.toFixed(2);
    };

    updateSens(0.80);

    sensSlider.addEventListener('input', (e) => updateSens(e.target.value));
    pauseSensSlider.addEventListener('input', (e) => updateSens(e.target.value));

    // SFX (銃声・効果音) Volume Controls
    const sfxSlider = document.getElementById('input-sfx-vol');
    const sfxValDisplay = document.getElementById('sfx-vol-val-display');
    const pauseSfxSlider = document.getElementById('pause-input-sfx-vol');
    const pauseSfxVal = document.getElementById('pause-sfx-vol-val');

    const updateSfxVol = (val) => {
      const num = parseInt(val, 10);
      this.audio.setSfxVolume(num / 100);
      sfxSlider.value = num;
      pauseSfxSlider.value = num;
      sfxValDisplay.textContent = `${num}%`;
      pauseSfxVal.textContent = `${num}%`;
    };

    sfxSlider.addEventListener('input', (e) => updateSfxVol(e.target.value));
    pauseSfxSlider.addEventListener('input', (e) => updateSfxVol(e.target.value));

    // BGM Volume Controls
    const bgmSlider = document.getElementById('input-bgm-vol');
    const bgmValDisplay = document.getElementById('bgm-vol-val-display');
    const pauseBgmSlider = document.getElementById('pause-input-bgm-vol');
    const pauseBgmVal = document.getElementById('pause-bgm-vol-val');

    const updateBgmVol = (val) => {
      const num = parseInt(val, 10);
      this.audio.setMusicVolume(num / 100);
      bgmSlider.value = num;
      pauseBgmSlider.value = num;
      bgmValDisplay.textContent = `${num}%`;
      pauseBgmVal.textContent = `${num}%`;
    };

    bgmSlider.addEventListener('input', (e) => updateBgmVol(e.target.value));
    pauseBgmSlider.addEventListener('input', (e) => updateBgmVol(e.target.value));

    // Graphics Quality Controls (低 / 中 / 高)
    const qualitySelect = document.getElementById('select-quality');
    const pauseQualitySelect = document.getElementById('pause-select-quality');

    const updateQuality = (mode) => {
      this.engine.setQuality(mode);
      if (qualitySelect) qualitySelect.value = mode;
      if (pauseQualitySelect) pauseQualitySelect.value = mode;
      if (this.hud && this.state === 'PLAYING') {
        const labels = { low: '低 (超軽量 60-120FPS)', medium: '中 (標準バランス・推奨)', high: '高 (高画質)' };
        this.hud.showPickupToast(`画質変更: ${labels[mode] || mode}`, 'supply');
      }
    };

    if (qualitySelect) qualitySelect.addEventListener('change', (e) => updateQuality(e.target.value));
    if (pauseQualitySelect) pauseQualitySelect.addEventListener('change', (e) => updateQuality(e.target.value));

    // Pointer Lock Change handler (ポインターロック解除で強制ポーズにせず、シームレスに操作を継続)
    this.input.onLockChange = (isLocked) => {
      // 画面上の視覚的インジケータやカーソル状態の更新のみを行い、強制ポーズはEsc/Pキーのみに委任
    };

    // Weapon slot selection
    const handleWeaponSwitch = (slot) => {
      this.player.switchWeapon(slot);
      const w = this.player.activeWeapon;
      const slotNum = this.player.currentWeaponIndex + 1;
      this.hud.showPickupToast(`【兵装切替】[${slotNum}] ${w.displayName || w.name}`, 'supply');
    };
    this.input.onWeaponSlotSelect = handleWeaponSwitch;
    this.hud.onSlotClick = handleWeaponSwitch;

    // Weapon reload request
    this.input.onReloadRequest = () => {
      this.player.activeWeapon.reload();
    };

    // Pause request (Esc / P)
    this.input.onPauseRequest = () => {
      if (this.state === 'PLAYING') {
        this.pauseGame();
      } else if (this.state === 'PAUSED') {
        this.resumeGame();
      }
    };

    // Grenade request (G key)
    this.input.onGrenadeRequest = () => {
      if (this.state === 'PLAYING') {
        if (!this.player.throwGrenade(this.grenades)) {
          this.hud.showPickupToast('手榴弾の残弾がありません！', 'supply');
        }
      }
    };

    // Adrenaline / Bullet Time request (Q key)
    this.input.onAdrenalineRequest = () => {
      if (this.state === 'PLAYING') {
        if (this.player.activateBulletTime()) {
          this.hud.showAnnouncement('⚡ アドレナリン・バレットタイム発動！', 1800);
        } else {
          this.hud.showPickupToast('アドレナリン不足 (必要: 50%)', 'supply');
        }
      }
    };

    // Performance Telemetry HUD toggle (F3 key)
    this.input.onTogglePerfMonitor = () => {
      const shown = this.togglePerfMonitor();
      if (this.hud && this.state === 'PLAYING') {
        this.hud.showPickupToast(shown ? '📊 性能テレメトリモニタ: 表示 [ON]' : '📊 性能テレメトリモニタ: 非表示 [OFF]', 'supply');
      }
    };

    const togglePerfBtn = document.getElementById('btn-toggle-perf-monitor');
    if (togglePerfBtn) {
      togglePerfBtn.addEventListener('click', () => {
        const shown = this.togglePerfMonitor();
        togglePerfBtn.textContent = shown ? '📊 性能モニタ [ON / F3]' : '📊 性能モニタ [OFF / F3]';
      });
    }

    const exportPerfBtn = document.getElementById('btn-export-perf-report');
    if (exportPerfBtn) {
      exportPerfBtn.addEventListener('click', () => {
        const report = this.getPerfReport();
        console.log(report);
        alert('【性能診断レポート出力完了】\nブラウザのコンソール(F12)に出力しました。\n\n' + report.split('\n').slice(0, 8).join('\n') + '\n...');
      });
    }
  }

  setupPlayerCallbacks() {
    this.player.onWeaponFired = () => {
      this.shotsFired++;
    };

    this.player.onHitEnemy = (damage, isCritical, isLethal, enemy) => {
      this.shotsHit++;
      this.hud.showHitmarker(isCritical);

      if (isLethal) {
        this.onEnemyDefeated(enemy);
        this.kills++;
        this.streak++;
        if (this.streak > this.maxStreak) this.maxStreak = this.streak;

        const bonus = isCritical ? 100 : 0;
        const streakBonus = (this.streak - 1) * 25;
        const totalGain = enemy.scoreValue + bonus + streakBonus;
        this.score += totalGain;

        // 1. 敵撃破時に追加の弾薬を獲得 (全6武器一括補給)
        this.player.addAmmoToAll(30, 6, 2, 45, 2, 60);
        this.hud.showPickupToast('撃破補給: 全武器の予備弾薬を獲得！', 'ammo');

        // アドレナリン蓄積 (通常+15%, 急所+25%)
        this.player.addAdrenaline(isCritical ? 25 : 15);

        // 2. 敵撃破位置にドロップ (ドロップ率バフ適用 & 倍ドロップ確率判定)
        if (enemy.isBoss) {
          this.handleBossDefeated(enemy);
        } else {
          const dropChance = Math.min(1.0, 0.80 + this.player.dropRateBonus);
          if (Math.random() < dropChance) {
            this.spawnPickup(enemy.position);

            let extraDrops = 0;
            if (this.player.doubleDropChance > 0 && Math.random() < this.player.doubleDropChance) {
              extraDrops++;
            }
            if (this.player.tripleDropChance > 0 && Math.random() < this.player.tripleDropChance) {
              extraDrops++;
            }

            if (extraDrops >= 2) {
              const offset1 = new THREE.Vector3(enemy.position.x + 0.9, enemy.position.y, enemy.position.z + 0.6);
              const offset2 = new THREE.Vector3(enemy.position.x - 0.9, enemy.position.y, enemy.position.z - 0.6);
              this.spawnPickup(offset1);
              this.spawnPickup(offset2);
              this.hud.showPickupToast('👑【トリプルドロップ発動！】戦利品が3倍ドロップ！', 'upgrade-invincible');
            } else if (extraDrops === 1) {
              const offsetPos = new THREE.Vector3(enemy.position.x + 0.8, enemy.position.y, enemy.position.z + 0.8);
              this.spawnPickup(offsetPos);
              this.hud.showPickupToast('✨【倍ドロップ発動】追加戦利品が出現！', 'upgrade-double-drop');
            }
          }
          if (isCritical) {
            this.headshots++;
            this.hud.addKillfeedItem(`急所ヘッドショット撃破！ (+${totalGain})`);
          } else {
            this.hud.addKillfeedItem(`敵部隊を撃破！ (+${totalGain})`);
          }
        }

        // Streak announcements
        if (this.streak === 3) this.hud.showAnnouncement('トリプルキル達成！');
        else if (this.streak === 5) this.hud.showAnnouncement('連続殲滅 x5！');
        else if (this.streak === 10) this.hud.showAnnouncement('無双状態！ 10連続キル！');

        // Check if wave is cleared
        this.checkWaveProgress();
      }
    };

    this.player.onTakeDamage = (amount, shieldDmg, hpDmg) => {
      // ユーザー要望: アーマーHPが削られなかった場合 (シールドで被弾吸収) は連続キルを継続
      if (hpDmg > 0) {
        this.streak = 0;
      }
      this.hud.triggerDamageFlash(shieldDmg > 0 && hpDmg === 0);
    };

    this.player.onPlayerDeath = () => {
      this.gameOver();
    };

    // レールガンスコープ展開のHUD連動
    this.player.onScopeToggle = (isRailgunADS) => {
      this.hud.setSniperScope(isRailgunADS);
    };
  }

  startGame() {
    this.state = 'PLAYING';
    this.startScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.hud.show();

    this.input.requestLock();
    this.startWave(1);
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.audio.stopAscensionAmbience();
    this.pauseScreen.classList.remove('hidden');
    this.input.exitLock();
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    if (this.isEXStage) {
      this.audio.playAscensionAmbience();
    }
    this.pauseScreen.classList.add('hidden');
    this.input.requestLock();
  }

  restartGame() {
    this.audio.stopAscensionAmbience();
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesKilled = 0;
    this.pendingEnemySpawns = 0;
    for (const e of this.enemies) {
      if (!e.isDead) {
        this.engine.scene.remove(e.mesh);
        disposeHierarchy(e.mesh);
      }
    }
    this.enemies = [];

    for (const p of this.enemyProjectiles) {
      this.engine.scene.remove(p.mesh);
      disposeHierarchy(p.mesh);
    }
    this.enemyProjectiles = [];

    for (const g of this.grenades) {
      this.engine.scene.remove(g.mesh);
      disposeHierarchy(g.mesh);
    }
    this.grenades = [];

    for (const pk of this.pickups) {
      this.engine.scene.remove(pk.mesh);
      disposeHierarchy(pk.mesh);
    }
    this.pickups = [];

    // 残留エフェクト・光線・パーティクルの完全消去
    if (this.particles) {
      this.particles.clear();
    }

    // HUD通知スタックとボスHUDのリセット
    if (this.hud) {
      this.hud.toastQueue = [];
      this.hud.activeToastCount = 0;
      if (this.hud.pickupToastContainer) this.hud.pickupToastContainer.innerHTML = '';
      if (this.hud.bossHudContainer) this.hud.bossHudContainer.classList.add('hidden');
    }

    this.wave = 1;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.kills = 0;
    this.headshots = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.isEXStage = false;
    this.lastBossShape = null;
    this.currentBossInfo = null;
    this.player.isEXStage = false;
    this.player.reset();
    if (this.hud) this.hud.hideAltitude();

    this.startGame();
  }

  startEXStage() {
    this.audio.init();
    this.audio.resume();

    // Clear existing entities with complete GPU cleanup
    for (const e of this.enemies) {
      this.engine.scene.remove(e.mesh);
      disposeHierarchy(e.mesh);
    }
    this.enemies = [];
    for (const p of this.enemyProjectiles) {
      this.engine.scene.remove(p.mesh);
      disposeHierarchy(p.mesh);
    }
    this.enemyProjectiles = [];
    for (const pk of this.pickups) {
      this.engine.scene.remove(pk.mesh);
      disposeHierarchy(pk.mesh);
    }
    this.pickups = [];
    if (this.particles) this.particles.clear();

    if (this.startScreen) this.startScreen.classList.add('hidden');
    if (this.pauseScreen) this.pauseScreen.classList.add('hidden');
    if (this.gameoverScreen) this.gameoverScreen.classList.add('hidden');

    this.isEXStage = true;
    this.lastBossShape = null;
    this.player.reset();
    this.player.isEXStage = true;

    // EXステージ専用：全武器3丁流モード（装弾数6,500発・虹スタック・実3武器描画）＆超大容量予備弾薬
    this.player.weapons.forEach(w => {
      w.magazineSize = 6500;
      w.currentAmmo = 6500;
      w.reserveAmmo = 99999;
      if (w.setWieldMode) w.setWieldMode(3);
    });

    this.player.maxHealth = 1200;
    this.player.health = 1200;
    this.player.maxShield = 2200;
    this.player.shield = 2200;
    this.player.grenades = 25;
    this.player.upgradeDamage(35.0); // 100ステージ突破相等の超絶火力
    this.player.upgradeFireRate(2.8);
    this.player.upgradeSpeed(0.12);

    this.state = 'PLAYING';
    this.input.requestLock();
    this.hud.show();
    this.hud.setAltitude(100000);

    if (this.audio && typeof this.audio.playBgm === 'function') {
      this.audio.playBgm('orbital');
    }
    if (this.audio && typeof this.audio.playAscensionAmbience === 'function') {
      this.audio.playAscensionAmbience();
    }
    this.startWave(105); // レイドボス OMEGA-SERAPH 迎撃波へ直行！

    this.hud.showAnnouncement('🌌【EX STAGE - エーテル・アセンション】\n高度100,000m突破！超低重力＆空中3段ジェットブースト解放！\n終焉天核【OMEGA-SERAPH】迎撃態勢！', 5000);
    this.hud.showPickupToast('✨【反重力フィールド展開】大跳躍＆空中3段ブースト！超高度決戦を開始せよ！', 'upgrade-invincible');
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.audio.stopAscensionAmbience();
    this.input.exitLock();
    this.hud.hide();

    const finalScoreEl = document.getElementById('stat-final-score');
    const wavesEl = document.getElementById('stat-waves-cleared');
    const killsEl = document.getElementById('stat-kills');
    const accuracyEl = document.getElementById('stat-accuracy');
    const headshotsEl = document.getElementById('stat-headshots');
    const streakEl = document.getElementById('stat-max-streak');

    const accuracy = this.shotsFired > 0 
      ? Math.min(100, Math.round((this.shotsHit / this.shotsFired) * 100)) 
      : 0;

    finalScoreEl.textContent = this.score.toLocaleString();
    wavesEl.textContent = Math.max(0, this.wave - 1);
    killsEl.textContent = this.kills;
    accuracyEl.textContent = `${accuracy}%`;
    headshotsEl.textContent = this.headshots;
    streakEl.textContent = `${this.maxStreak}x`;

    this.gameoverScreen.classList.remove('hidden');
  }

  startWave(waveNumber) {
    this.wave = waveNumber;
    this.waveState = 'IN_PROGRESS';
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesKilled = 0;
    this.pendingEnemySpawns = 0;
    this.maxConcurrentEnemies = 12;

    if (waveNumber > 100) {
      this.isEXStage = true;
      this.player.isEXStage = true;
    }

    // 1. Biome & Lighting Switch for Wave
    const biomeInfo = this.level.setBiome(waveNumber, this.isEXStage);
    this.engine.setBiomeLighting(biomeInfo.name);

    if (this.isEXStage) {
      this.hud.setAltitude(this.level.altitude);
    } else {
      this.hud.hideAltitude();
    }

    // ユーザー要望: 5ステージごとにサイバーシールド上限+50、10ステージごとにアーマーHP上限+50 (10, 20...で重複増加)
    if (waveNumber > 1 && waveNumber % 5 === 0) {
      this.player.maxShield += 50;
      this.player.addShield(50);
      this.hud.showPickupToast(`🛡️【防壁拡張】第${waveNumber}波到達: サイバーシールド上限 +50 (最大: ${this.player.maxShield})！`, 'supply');
    }
    if (waveNumber > 1 && waveNumber % 10 === 0) {
      this.player.maxHealth += 50;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 50);
      this.hud.showPickupToast(`❤️【生体装甲強化】第${waveNumber}波到達: アーマーHP上限 +50 (最大: ${this.player.maxHealth})！`, 'health');
    }

    const isBossWave = (waveNumber % 5 === 0);
    const isMilestoneWave = (waveNumber > 1 && waveNumber % 5 === 1);

    if (isBossWave) {
      let chosenShape;
      if (this.isEXStage || waveNumber > 100) {
        chosenShape = 'seraph';
      } else {
        const available = BOSS_SHAPES.filter(s => s !== this.lastBossShape);
        chosenShape = available[Math.floor(Math.random() * available.length)];
      }
      this.lastBossShape = chosenShape;
      this.currentBossInfo = BOSS_INFO[chosenShape] || BOSS_INFO.arachne;
      const bossTier = Math.floor(waveNumber / 5);
      const bossName = (this.isEXStage || waveNumber > 100)
        ? `${this.currentBossInfo.name} (EX)`
        : `${this.currentBossInfo.name} (Tier ${bossTier})`;

      this.hud.showAnnouncement(`🚨【第${this.wave}波 緊急迎撃警報】\n超大型レイドボス【${bossName}】出現！`, 4200);
      this.hud.showPickupToast(`⚠️【超高脅威度目標】レイドボス接近！迎撃態勢を取れ！`, 'upgrade-dmg');
      this.audio.playBossAlarm();
      this.audio.playBossRoar();
    } else if (this.isEXStage || waveNumber > 100) {
      this.hud.showAnnouncement(`第${this.wave}波 // 作戦開始\n${biomeInfo.label}`, 3500);
      this.hud.showPickupToast(`【天界防衛】超高度空間での殲滅作戦継続中！`, 'supply');
    } else if (isMilestoneWave) {
      const damageTier = Math.floor((waveNumber - 1) / 5);
      const damageBonusPct = Math.round(damageTier * 15);
      this.hud.showAnnouncement(`⚠️【第${this.wave}波 脅威度上昇 (Tier ${damageTier})】\nボス突破！通常部隊の攻撃力 +${damageBonusPct}%！`, 3800);
      this.hud.showPickupToast(`【脅威度上昇】敵兵装の威力強化 (+${damageBonusPct}%)`, 'supply');
    } else if (waveNumber > 1) {
      this.hud.showAnnouncement(`第${this.wave}波 // 作戦開始\n${biomeInfo.label}`, 3000);
      this.hud.showPickupToast(`【作戦区域転換】${biomeInfo.label} へ移動！`, 'supply');
    } else {
      this.hud.showAnnouncement(`第${this.wave}波 // 作戦開始\n${biomeInfo.label}`, 2500);
    }

    this.spawnNextWaveEnemies();
  }

  getSafeSpawnPos(rawX, rawZ, radius = 1.0) {
    let x = rawX;
    let z = rawZ;
    if (this.level && Array.isArray(this.level.colliders)) {
      for (const item of this.level.colliders) {
        const box = item.box;
        if (box.max.y <= 0.3) continue;
        if (x + radius > box.min.x && x - radius < box.max.x && z + radius > box.min.z && z - radius < box.max.z) {
          const overlapL = (x + radius) - box.min.x;
          const overlapR = box.max.x - (x - radius);
          const overlapT = (z + radius) - box.min.z;
          const overlapB = box.max.z - (z - radius);
          if (Math.min(overlapL, overlapR) < Math.min(overlapT, overlapB)) {
            x = overlapL < overlapR ? box.min.x - radius - 0.8 : box.max.x + radius + 0.8;
          } else {
            z = overlapT < overlapB ? box.min.z - radius - 0.8 : box.max.z + radius + 0.8;
          }
        }
      }
    }
    const dist = Math.hypot(x, z);
    if (dist > 44) {
      x = (x / dist) * 42;
      z = (z / dist) * 42;
    }
    return { x, z };
  }

  spawnNextWaveEnemies() {
    // プレイヤーの視線方向を取得 (背後スポーンを防止し、前方の扇状エリアにスポーン)
    const forwardX = -Math.sin(this.player.yaw);
    const forwardZ = -Math.cos(this.player.yaw);
    const centerAngle = Math.atan2(forwardX, forwardZ);

    if (this.wave % 5 === 0) {
      // === レイドボス戦 (第5, 10, 15波...) ===
      const bossTier = Math.floor(this.wave / 5);
      const chosenBoss = this.currentBossInfo || BOSS_INFO.arachne;
      const bossName = (this.isEXStage || this.wave > 100)
        ? `${chosenBoss.name} (EX)`
        : `${chosenBoss.name} (Tier ${bossTier})`;

      // ユーザー要望: ボスHPデフォルト16,000。10波毎(第10, 20, 30波...)は2倍、2倍にならない箇所(第15, 25, 35波...)は1.5倍を継続 (EXステージ以降も完全継続)
      let bossHealth = 16000;
      for (let w = 10; w <= this.wave; w += 5) {
        if (w % 10 === 0) {
          bossHealth = Math.round(bossHealth * 2.0); // 10波毎に2倍
        } else {
          bossHealth = Math.round(bossHealth * 1.5); // 2倍にならない箇所は1.5倍を継続
        }
      }
      const bossDamage = chosenBoss.baseDamage + (bossTier - 1) * 8;
      const bossScore = 15000 * Math.pow(2, Math.min(6, bossTier - 1));

      // ボスはプレイヤーの前方約32mに出現
      const bossAngle = centerAngle + (Math.random() - 0.5) * 0.3;
      let bx = this.player.position.x + Math.sin(bossAngle) * 32;
      let bz = this.player.position.z + Math.cos(bossAngle) * 32;
      const safeBossPos = this.getSafeSpawnPos(bx, bz, 3.0);

      const boss = new EnemyBoss({
        bossTier: bossTier,
        bossShape: chosenBoss.shape,
        name: bossName,
        health: bossHealth,
        damage: bossDamage,
        score: bossScore,
        position: new THREE.Vector3(safeBossPos.x, 0, safeBossPos.z),
      }, this.engine.scene, this.audio, this.particles);

      // EX Seraph ボス形態移行アナウンス連動
      boss.onPhaseAnnouncement = (msg, dur) => {
        if (this.hud) this.hud.showAnnouncement(msg, dur);
      };
      this.enemies.push(boss);

      // ボスに随伴する護衛部隊 (ボスの左右に配置)
      const escortCount = 2 + Math.min(2, bossTier);
      for (let e = 0; e < escortCount; e++) {
        const offsetAngle = (e % 2 === 0 ? 1 : -1) * (0.28 + Math.floor(e / 2) * 0.22);
        const escortAngle = bossAngle + offsetAngle;
        let ex = this.player.position.x + Math.sin(escortAngle) * 28;
        let ez = this.player.position.z + Math.cos(escortAngle) * 28;
        const safeEscortPos = this.getSafeSpawnPos(ex, ez, 1.0);

        if (this.isEXStage || this.wave > 100) {
          const escort = (e % 2 === 0)
            ? new EnemyEXDrone({ position: new THREE.Vector3(safeEscortPos.x, 5.0, safeEscortPos.z) }, this.engine.scene, this.audio, this.particles)
            : new EnemyEXValkyrie({ position: new THREE.Vector3(safeEscortPos.x, 0, safeEscortPos.z) }, this.engine.scene, this.audio, this.particles);
          this.enemies.push(escort);
        } else {
          const escort = new EnemyHumanoid({
            type: e % 3 === 0 ? 'scout' : (e % 3 === 1 ? 'assault' : 'seeker'),
            health: 85,
            speed: 4.6,
            fireRate: 2.0,
            damage: 12,
            score: 120,
            position: new THREE.Vector3(safeEscortPos.x, 0, safeEscortPos.z),
          }, this.engine.scene, this.audio, this.particles);
          this.enemies.push(escort);
        }
      }

      this.totalWaveEnemies = 1 + escortCount;
      this.waveEnemiesSpawned = this.totalWaveEnemies;
      return;
    }

    // === EXステージ通常ウェーブ (空中・天界機動部隊: 100ステージ突破相等の超高ステータス) ===
    if (this.isEXStage || this.wave > 100) {
      this.totalWaveEnemies = 4 + Math.min(16, Math.floor((this.wave - 100) / 2));
      const initialToSpawn = Math.min(this.maxConcurrentEnemies, this.totalWaveEnemies);
      for (let i = 0; i < initialToSpawn; i++) {
        this.spawnSingleEXEnemy(i, this.totalWaveEnemies);
        this.waveEnemiesSpawned++;
      }
      return;
    }

    // === 通常ウェーブ (第1〜4, 6〜9, 11〜14波...) ===
    this.totalWaveEnemies = 3 + this.wave * 2;
    const initialToSpawn = Math.min(this.maxConcurrentEnemies, this.totalWaveEnemies);
    for (let i = 0; i < initialToSpawn; i++) {
      this.spawnSingleNormalEnemy(i, this.totalWaveEnemies);
      this.waveEnemiesSpawned++;
    }
  }

  spawnSingleEXEnemy(index, total) {
    const forwardX = -Math.sin(this.player.yaw);
    const forwardZ = -Math.cos(this.player.yaw);
    const centerAngle = Math.atan2(forwardX, forwardZ);
    const spreadArc = Math.PI * 0.8;
    const offset = ((index / (total - 1 || 1)) - 0.5) * spreadArc + (Math.random() - 0.5) * 0.2;
    const angle = centerAngle + offset;
    const spawnDist = 20 + Math.random() * 14;

    let x = this.player.position.x + Math.sin(angle) * spawnDist;
    let z = this.player.position.z + Math.cos(angle) * spawnDist;
    const safePos = this.getSafeSpawnPos(x, z, 1.0);

    const waveScale = Math.pow(1.035, Math.min(80, this.wave - 100));
    const droneHp = Math.round((45000 + (this.wave - 100) * 5000) * waveScale);
    const valkHp = Math.round((85000 + (this.wave - 100) * 8000) * waveScale);
    const droneDmg = Math.round(55 + (this.wave - 100) * 1.8);
    const valkDmg = Math.round(75 + (this.wave - 100) * 2.4);

    if (index % 2 === 0) {
      const drone = new EnemyEXDrone({
        position: new THREE.Vector3(safePos.x, 5.0, safePos.z),
        health: droneHp,
        damage: droneDmg,
        score: 5000 * Math.floor(this.wave / 10),
      }, this.engine.scene, this.audio, this.particles);
      this.enemies.push(drone);
    } else {
      const valk = new EnemyEXValkyrie({
        position: new THREE.Vector3(safePos.x, 0, safePos.z),
        health: valkHp,
        damage: valkDmg,
        score: 8500 * Math.floor(this.wave / 10),
      }, this.engine.scene, this.audio, this.particles);
      this.enemies.push(valk);
    }
  }

  spawnSingleNormalEnemy(index, total) {
    const forwardX = -Math.sin(this.player.yaw);
    const forwardZ = -Math.cos(this.player.yaw);
    const centerAngle = Math.atan2(forwardX, forwardZ);
    const spreadArc = Math.PI * 0.8;
    const offset = ((index / (total - 1 || 1)) - 0.5) * spreadArc + (Math.random() - 0.5) * 0.2;
    const angle = centerAngle + offset;
    const spawnDist = 24 + Math.random() * 12;

    let x = this.player.position.x + Math.sin(angle) * spawnDist;
    let z = this.player.position.z + Math.cos(angle) * spawnDist;
    const safeEnemyPos = this.getSafeSpawnPos(x, z, 1.0);
    x = safeEnemyPos.x;
    z = safeEnemyPos.z;

    let type = 'scout';
    let health = 75;
    let speed = 5.2;
    let fireRate = 2.2;
    let damage = 10;
    let score = 100;

    if (this.wave >= 2 && index % 3 === 1) {
      type = 'assault';
      health = 115;
      speed = 4.4;
      fireRate = 1.8;
      damage = 14;
      score = 150;
    } else if (this.wave >= 3 && index % 3 === 2) {
      type = 'seeker';
      health = 85;
      speed = 4.8;
      fireRate = 1.5;
      damage = 12;
      score = 180;
    } else if (this.wave >= 4 && index % 4 === 0) {
      type = 'heavy';
      health = 240;
      speed = 3.2;
      fireRate = 2.4;
      damage = 22;
      score = 300;
    }

    const damageTier = Math.floor((this.wave - 1) / 5);
    const waveDamageMultiplier = 1.0 + damageTier * 0.15;
    const scaledDamage = Math.round(damage * waveDamageMultiplier);

    const soldier = new EnemyHumanoid({
      type,
      health,
      speed,
      fireRate,
      damage: scaledDamage,
      score,
      position: new THREE.Vector3(x, 0, z),
    }, this.engine.scene, this.audio, this.particles);

    this.enemies.push(soldier);
  }

  onEnemyDefeated(enemy) {
    this.waveEnemiesKilled++;
    // 次の敵の補充をキューに登録 (1フレーム1体に分散して同期メッシュ生成スタッターを完全根絶)
    if (this.waveEnemiesSpawned + this.pendingEnemySpawns < this.totalWaveEnemies) {
      this.pendingEnemySpawns++;
    }
  }

  handleBossDefeated(boss) {
    this.score += boss.scoreValue;
    this.kills++;
    this.audio.playBossRoar();
    this.audio.playExplosion(10);

    this.hud.addKillfeedItem(`👑 レイドボス【${boss.name}】を撃破！ (+${boss.scoreValue})`);
    this.hud.showAnnouncement(`👑【レイドボス撃破】\n${boss.name} 殲滅完了！ (+${boss.scoreValue} pts)`, 4200);

    // プレイヤー大量補充
    this.player.addAmmoToAll(120, 32, 8);
    this.player.grenades += 3;
    this.player.shield = this.player.maxShield;
    this.player.addAdrenaline(50);

    // 5基の戦利品コアを一斉大放出 (ボス中心に円形配置)
    const bossPos = boss.mesh ? boss.mesh.position : (boss.position || new THREE.Vector3(0, 0, 0));
    const guaranteedCores = ['damage_core', 'fire_rate_core', 'mag_core', 'shield_core', 'invincible_core'];
    guaranteedCores.forEach((ctype, idx) => {
      const dropAngle = (idx / guaranteedCores.length) * Math.PI * 2;
      const dropDist = 3.6;
      const dropPos = new THREE.Vector3(
        bossPos.x + Math.cos(dropAngle) * dropDist,
        0.5,
        bossPos.z + Math.sin(dropAngle) * dropDist
      );
      this.spawnPickup(dropPos, ctype);
    });

    this.hud.showPickupToast('👑【特大戦利品】超高密度強化コア 5基放出！', 'upgrade-invincible');
  }

  checkWaveProgress() {
    const aliveEnemies = this.enemies.filter(e => !e.isDead && !e.isDying);
    if (aliveEnemies.length === 0 && this.waveEnemiesSpawned >= this.totalWaveEnemies && this.waveState === 'IN_PROGRESS') {
      this.waveState = 'CLEARED';
      this.waveIntermissionTimer = 4.0;
      const waveBonus = this.wave * 500;
      this.score += waveBonus;

      // 100ステージクリア時: EXステージへの突入判定
      if (this.wave === 100) {
        this.isEXStage = true;
        this.player.isEXStage = true;
        this.hud.showAnnouncement('🌟【祝・第100波 防衛完遂】\n超軌道昇降機 エーテル・アセンション(EXステージ) へ突入！', 4500);
      }

      // ステージ遷移時: フィールド上の全アイテムを自動回収
      this.collectAllPickups();

      // ユーザー要望: ラウンド突破時の全6武器予備弾薬回復量を倍増＆手榴弾とシールドを回復
      this.player.addAmmoToAll(120, 32, 8, 180, 8, 300);
      this.player.grenades += 2;
      this.player.addShield(50);
      this.player.stamina = this.player.maxStamina;

      this.hud.showAnnouncement(`第${this.wave}波 防衛成功！ (+${waveBonus})`, 3000);
      this.hud.showPickupToast(`【全武器弾薬超回復】予備弾薬大量補給(2倍) 手榴弾+2 シールド+50`, 'supply');
      this.audio.playReload();
      this.audio.playHitmarker(true);
    }
  }

  // ステージ遷移時: フィールド上の全アイテムを一括自動回収 (DOM過負荷と音量暴走・クリッピングを完全根絶)
  collectAllPickups() {
    if (this.pickups.length === 0) return;
    let collected = 0;
    let hpRestored = 0;
    let shieldRestored = 0;
    let coresCollected = 0;
    let ammoBoxes = 0;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (p.type === 'health') {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 35);
        this.player.addShield(25);
        hpRestored += 35;
        shieldRestored += 25;
      } else if (p.type === 'shield_core') {
        this.player.addShield(75);
        shieldRestored += 75;
        coresCollected++;
      } else if (p.type === 'damage_core') {
        this.player.upgradeDamage(0.10);
        coresCollected++;
      } else if (p.type === 'mag_core') {
        this.player.upgradeMagazine(4, 1, 1, 6, 1, 15);
        coresCollected++;
      } else if (p.type === 'fire_rate_core') {
        this.player.upgradeFireRate(0.12);
        coresCollected++;
      } else if (p.type === 'hit_range_core') {
        this.player.upgradeHitRange(0.25);
        coresCollected++;
      } else if (p.type === 'speed_core') {
        this.player.upgradeSpeed(0.01);
        coresCollected++;
      } else if (p.type === 'invincible_core') {
        this.player.activateInvincibility(5.0);
        coresCollected++;
      } else if (p.type === 'drop_rate_core') {
        this.player.upgradeDropRate(0.05);
        coresCollected++;
      } else if (p.type === 'double_drop_core') {
        this.player.upgradeDoubleDrop(0.35);
        coresCollected++;
      } else {
        this.player.addAmmoToAll(45, 12, 3, 60, 3, 90);
        this.player.grenades += 1;
        ammoBoxes++;
      }
      this.engine.scene.remove(p.mesh);
      disposeHierarchy(p.mesh);
      this.pickups.splice(i, 1);
      collected++;
    }

    if (collected > 0) {
      // 1件の統合サマリートーストを表示 (15〜25件のDOM同時生成によるReflow/スタッターを完全抑止)
      let summaryText = `✨【一括自動回収】戦利品 x${collected}個 回収完了！`;
      if (coresCollected > 0) {
        summaryText += ` (強化コアx${coresCollected} / 補給箱x${ammoBoxes})`;
      } else {
        summaryText += ` (予備弾薬・手榴弾x${ammoBoxes})`;
      }
      this.hud.showPickupToast(summaryText, 'upgrade-invincible');

      // 心地よいサイバー上昇和音チャイムを1回だけ再生 (音量重なり・クリッピングを解消)
      this.audio.playSweepCollect(collected);

      console.log(`%c[PERF EVENT]%c Wave ${this.wave} Cleared -> Auto-collected & GPU-disposed ${collected} pickups. Active GPU Geoms: ${this.engine.renderer.info.memory.geometries}`, 'color: #10b981; font-weight: bold;', 'color: #cbd5e1;');
    }
  }

  // 3D戦術アイテムコンテナのスポーン (敵撃破時のドロップ)
  spawnPickup(position, forcedType = null) {
    let type = forcedType;
    if (!type) {
      // 内部ドロップ確率: 弾薬(18%), 医療(14%), シールド(14%), 威力コア(10%), 弾倉コア(10%), 連射コア(8%), 範囲コア(7%), 機動コア(5%), ドロップ率コア(6%), 倍ドロップコア(5%), 無敵コア(3%)
      const roll = Math.random();
      if (roll < 0.18) {
        type = 'ammo';
      } else if (roll < 0.32) {
        type = 'health';
      } else if (roll < 0.46) {
        type = 'shield_core';
      } else if (roll < 0.56) {
        type = 'damage_core';
      } else if (roll < 0.66) {
        type = 'mag_core';
      } else if (roll < 0.74) {
        type = 'fire_rate_core';
      } else if (roll < 0.81) {
        type = 'hit_range_core';
      } else if (roll < 0.86) {
        type = 'speed_core';
      } else if (roll < 0.92) {
        type = 'drop_rate_core';
      } else if (roll < 0.97) {
        type = 'double_drop_core';
      } else {
        type = 'invincible_core';
      }
    }

    const pickupGroup = new THREE.Group();

    if (type === 'health') {
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0x111622,
        roughness: 0.35,
        metalness: 0.8,
        emissive: 0x00ff88,
        emissiveIntensity: 0.25,
      });
      const box = createCachedPickupMesh(_sharedPickupGeoCache.boxHealth, boxMat);
      pickupGroup.add(box);

      const crossMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
      const c1 = createCachedPickupMesh(_sharedPickupGeoCache.cross1, crossMat);
      const c2 = createCachedPickupMesh(_sharedPickupGeoCache.cross2, crossMat);
      pickupGroup.add(c1, c2);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.5,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam32, beamMat);
      beam.position.y = 1.6;
      pickupGroup.add(beam);
    } else if (type === 'shield_core') {
      // サイバーシールドチャージャー (エレクトリックブルーの六角柱 + 2重リング)
      const prismMat = new THREE.MeshStandardMaterial({
        color: 0x051d2e,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x00f3ff,
        emissiveIntensity: 0.8,
      });
      const prism = createCachedPickupMesh(_sharedPickupGeoCache.prism, prismMat);
      pickupGroup.add(prism);

      const ring1 = createCachedPickupMesh(
        _sharedPickupGeoCache.ring40,
        new THREE.MeshBasicMaterial({ color: 0x00f3ff })
      );
      ring1.rotation.x = Math.PI * 0.4;
      pickupGroup.add(ring1);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.7,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam38, beamMat);
      beam.position.y = 1.9;
      pickupGroup.add(beam);
    } else if (type === 'damage_core') {
      // 兵装威力増幅コア (紫色のクリスタル八面体コア + 回転リング)
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x220533,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0xd946ef,
        emissiveIntensity: 0.8,
      });
      const core = createCachedPickupMesh(_sharedPickupGeoCache.octa32, coreMat);
      pickupGroup.add(core);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff44ee });
      const ring = createCachedPickupMesh(_sharedPickupGeoCache.ring44, ringMat);
      ring.rotation.x = Math.PI * 0.35;
      pickupGroup.add(ring);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        transparent: true,
        opacity: 0.6,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam38, beamMat);
      beam.position.y = 1.9;
      pickupGroup.add(beam);
    } else if (type === 'mag_core') {
      // 弾倉拡張モジュール (アンバー/ゴールドの高周波ドラムシリンダー)
      const cylMat = new THREE.MeshStandardMaterial({
        color: 0x241a06,
        roughness: 0.25,
        metalness: 0.85,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.75,
      });
      const cyl = createCachedPickupMesh(_sharedPickupGeoCache.cyl24, cylMat);
      pickupGroup.add(cyl);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const ring1 = createCachedPickupMesh(_sharedPickupGeoCache.ringCyl, ringMat);
      ring1.position.y = 0.14;
      const ring2 = createCachedPickupMesh(_sharedPickupGeoCache.ringCyl, ringMat);
      ring2.position.y = -0.14;
      pickupGroup.add(ring1, ring2);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.6,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam38, beamMat);
      beam.position.y = 1.9;
      pickupGroup.add(beam);
    } else if (type === 'fire_rate_core') {
      // 連射加速コア (真紅／オレンジの高エネルギー六角柱コア + 加速リング)
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x330900,
        roughness: 0.15,
        metalness: 0.9,
        emissive: 0xff3b00,
        emissiveIntensity: 0.85,
      });
      const core = createCachedPickupMesh(_sharedPickupGeoCache.cone26, coreMat);
      pickupGroup.add(core);

      const accRing = createCachedPickupMesh(
        _sharedPickupGeoCache.ring44,
        new THREE.MeshBasicMaterial({ color: 0xff6600 })
      );
      accRing.rotation.x = Math.PI * 0.4;
      pickupGroup.add(accRing);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff3b00,
        transparent: true,
        opacity: 0.7,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam40, beamMat);
      beam.position.y = 2.0;
      pickupGroup.add(beam);
    } else if (type === 'hit_range_core') {
      // 攻撃範囲強化コア (シアン/ディープブルーの電磁集束八面体 + デュアルリング)
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x051a33,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x00f3ff,
        emissiveIntensity: 0.85,
      });
      const core = createCachedPickupMesh(_sharedPickupGeoCache.octa32, coreMat);
      pickupGroup.add(core);

      const ring1 = createCachedPickupMesh(
        _sharedPickupGeoCache.ring48,
        new THREE.MeshBasicMaterial({ color: 0x00ffff })
      );
      ring1.rotation.x = Math.PI * 0.3;
      const ring2 = createCachedPickupMesh(
        _sharedPickupGeoCache.ring38,
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      ring2.rotation.y = Math.PI * 0.35;
      pickupGroup.add(ring1, ring2);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.7,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam40, beamMat);
      beam.position.y = 2.0;
      pickupGroup.add(beam);
    } else if (type === 'speed_core') {
      // 機動ブースターコア (ネオンライムグリーンの高速推進タービン)
      const turbMat = new THREE.MeshStandardMaterial({
        color: 0x0d2810,
        roughness: 0.2,
        metalness: 0.85,
        emissive: 0x22c55e,
        emissiveIntensity: 0.8,
      });
      const turb = createCachedPickupMesh(_sharedPickupGeoCache.turbCyl, turbMat);
      pickupGroup.add(turb);

      const finRing = createCachedPickupMesh(
        _sharedPickupGeoCache.finRing,
        new THREE.MeshBasicMaterial({ color: 0x4ade80 })
      );
      finRing.rotation.x = Math.PI * 0.5;
      pickupGroup.add(finRing);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.7,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam40, beamMat);
      beam.position.y = 2.0;
      pickupGroup.add(beam);
    } else if (type === 'drop_rate_core') {
      // ドロップ率強化コア (エメラルドグリーンの正十二面体 + クォンタムリング)
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x052e16,
        roughness: 0.15,
        metalness: 0.9,
        emissive: 0x10b981,
        emissiveIntensity: 0.85,
      });
      const core = createCachedPickupMesh(_sharedPickupGeoCache.dodec32, coreMat);
      pickupGroup.add(core);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
      const ring = createCachedPickupMesh(_sharedPickupGeoCache.ring46, ringMat);
      ring.rotation.x = Math.PI * 0.35;
      pickupGroup.add(ring);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.7,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam38, beamMat);
      beam.position.y = 1.9;
      pickupGroup.add(beam);
    } else if (type === 'double_drop_core') {
      // 倍ドロップ強化コア (ゴールド＆マゼンタのツインクリスタル)
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x332005,
        roughness: 0.15,
        metalness: 0.95,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.9,
      });
      const core1 = createCachedPickupMesh(_sharedPickupGeoCache.octa28, coreMat);
      core1.position.set(-0.15, 0.1, 0);
      const core2 = createCachedPickupMesh(_sharedPickupGeoCache.octa28, coreMat);
      core2.position.set(0.15, -0.1, 0);
      core2.scale.set(0.8, 0.8, 0.8);
      pickupGroup.add(core1, core2);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
      const ring = createCachedPickupMesh(_sharedPickupGeoCache.ring48, ringMat);
      ring.rotation.y = Math.PI * 0.4;
      pickupGroup.add(ring);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.75,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam40, beamMat);
      beam.position.y = 2.0;
      pickupGroup.add(beam);
    } else if (type === 'invincible_core') {
      // 5秒無敵バリアコア (眩い黄金色の回転正二十面体ハイパーコア)
      const starMat = new THREE.MeshStandardMaterial({
        color: 0x332800,
        roughness: 0.15,
        metalness: 0.95,
        emissive: 0xffd700,
        emissiveIntensity: 1.0,
      });
      const star = createCachedPickupMesh(_sharedPickupGeoCache.ico36, starMat);
      pickupGroup.add(star);

      const halo1 = createCachedPickupMesh(
        _sharedPickupGeoCache.halo52,
        new THREE.MeshBasicMaterial({ color: 0xffea00 })
      );
      halo1.rotation.x = Math.PI * 0.4;
      const halo2 = createCachedPickupMesh(
        _sharedPickupGeoCache.ring42,
        new THREE.MeshBasicMaterial({ color: 0xffc400 })
      );
      halo2.rotation.y = Math.PI * 0.45;
      pickupGroup.add(halo1, halo2);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.8,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam45, beamMat);
      beam.position.y = 2.25;
      pickupGroup.add(beam);
    } else {
      // 弾薬コンテナ (Cyan)
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0x1d291b,
        roughness: 0.4,
        metalness: 0.7,
        emissive: 0x00f3ff,
        emissiveIntensity: 0.25,
      });
      const box = createCachedPickupMesh(_sharedPickupGeoCache.boxAmmo, boxMat);
      pickupGroup.add(box);

      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
      const stripe = createCachedPickupMesh(_sharedPickupGeoCache.stripeAmmo, stripeMat);
      pickupGroup.add(stripe);

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.5,
      });
      const beam = createCachedPickupMesh(_sharedPickupGeoCache.beam32, beamMat);
      beam.position.y = 1.6;
      pickupGroup.add(beam);
    }

    pickupGroup.position.set(position.x, 0.5, position.z);
    this.engine.scene.add(pickupGroup);

    this.pickups.push({
      mesh: pickupGroup,
      type,
      spawnY: 0.5,
      rotSpeed: 1.8 + Math.random() * 0.8,
      bobTime: Math.random() * Math.PI,
      // 永続化: 消滅タイマーを撤廃し、拾うまで戦利品が消えない
    });
  }

  // 3D戦術アイテムコンテナの更新 & 拾得処理
  updatePickups(delta) {
    const playerPos = this.player.position;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.bobTime += delta * 2.5;

      p.mesh.rotation.y += p.rotSpeed * delta;
      p.mesh.position.y = p.spawnY + Math.sin(p.bobTime) * 0.14;

      const dist = p.mesh.position.distanceTo(playerPos);
      if (dist < 2.2) {
        if (p.type === 'health') {
          this.player.health = Math.min(this.player.maxHealth, this.player.health + 35);
          this.player.addShield(25);
          this.audio.playPickup(true);
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0x00ff88, 18);
          this.hud.showPickupToast('【医療物資】HP+35 & シールド+25 回復！', 'health');
        } else if (p.type === 'shield_core') {
          this.player.addShield(75);
          this.audio.playPickup(true);
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0x00f3ff, 24);
          this.hud.showPickupToast(`【シールドチャージャー】シールド+75獲得！ (${Math.ceil(this.player.shield)} / ${this.player.maxShield})`, 'ammo');
          this.hud.showAnnouncement('🛡️ サイバーシールド展開！ (+75)', 1800);
        } else if (p.type === 'damage_core') {
          const mult = this.player.upgradeDamage(0.10);
          this.audio.playBuffPickup();
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0xd946ef, 24);
          this.hud.showPickupToast(`【威力強化コア】全武器の威力 +10.0% 強化！ (現在: x${mult.toFixed(2)})`, 'upgrade-dmg');
          this.hud.showAnnouncement(`⚡ 兵装威力強化 Lv.${this.player.damageUpgradeLevel} 獲得！ (威力 x${mult.toFixed(2)})`, 2000);
        } else if (p.type === 'mag_core') {
          this.player.upgradeMagazine(4, 1, 1, 6, 1, 15);
          this.audio.playReload();
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0xf59e0b, 24);
          this.hud.showPickupToast('【弾倉拡張モジュール】全6武器の装弾数を拡張！', 'upgrade-mag');
          this.hud.showAnnouncement(`🔋 弾倉拡張 Lv.${this.player.magUpgradeLevel} 適用！`, 2000);
        } else if (p.type === 'fire_rate_core') {
          const mult = this.player.upgradeFireRate(0.12);
          this.audio.playBuffPickup();
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0xff3b00, 26);
          this.hud.showPickupToast(`【連射加速コア】全武器の連射速度 +12.0% 向上！ (現在: x${mult.toFixed(2)})`, 'upgrade-rate');
          this.hud.showAnnouncement(`🔥 連射速度強化 Lv.${this.player.fireRateUpgradeLevel} 適用！ (連射 x${mult.toFixed(2)})`, 2000);
        } else if (p.type === 'hit_range_core') {
          const r = this.player.upgradeHitRange(0.25);
          this.audio.playBuffPickup();
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0x00f3ff, 26);
          this.hud.showPickupToast(`【攻撃範囲強化コア】弾道誘導許容 +25cm！ (現在: +${Math.round(r * 100)}cm)`, 'upgrade-range');
          this.hud.showAnnouncement(`🎯 攻撃範囲強化 Lv.${this.player.hitRangeUpgradeLevel} 適用！`, 2000);
        } else if (p.type === 'speed_core') {
          const s = this.player.upgradeSpeed(0.01);
          this.audio.playSlide();
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0x22c55e, 26);
          this.hud.showPickupToast(`【機動ブースターコア】全移動速度 +1.0% 向上！ (現在: x${s.toFixed(2)})`, 'upgrade-speed');
          this.hud.showAnnouncement(`⚡ 機動ブースター Lv.${this.player.speedUpgradeLevel} 適用！`, 2000);
        } else if (p.type === 'invincible_core') {
          this.player.activateInvincibility(5.0);
          this.audio.playBuffPickup();
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0xffd700, 36);
          this.hud.showPickupToast('【無敵バリアコア】5秒間 全ダメージ完全無効化！', 'upgrade-invincible');
          this.hud.showAnnouncement('🛡️【完全無敵バリア発動】5秒間 全ダメージ無効化！', 2500);
        } else if (p.type === 'drop_rate_core') {
          const d = this.player.upgradeDropRate(0.05);
          this.audio.playBuffPickup();
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0x10b981, 26);
          this.hud.showPickupToast(`【ドロップ率強化コア】アイテムドロップ率 +5%！ (現在: +${Math.round(d * 100)}%)`, 'upgrade-drop');
          this.hud.showAnnouncement(`💎 ドロップ率強化 Lv.${this.player.dropRateUpgradeLevel} 適用！`, 2000);
        } else if (p.type === 'double_drop_core') {
          const db = this.player.upgradeDoubleDrop(0.35);
          this.audio.playBuffPickup();
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0xfbbf24, 28);
          this.hud.showPickupToast(`【倍ドロップコア】2個ドロップ発生率 +35%！ (現在: ${Math.round(db * 100)}%)`, 'upgrade-double-drop');
          this.hud.showAnnouncement(`✨ 倍ドロップ確率 Lv.${this.player.doubleDropUpgradeLevel} 適用！`, 2000);
        } else {
          // ammo
          this.player.addAmmoToAll(45, 12, 3, 60, 3, 90);
          this.player.grenades += 1;
          this.audio.playPickup(false);
          this.particles.createImpactSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), 0x00f3ff, 18);
          this.hud.showPickupToast('【弾薬コンテナ】全6武器の予備弾薬＋手榴弾+1 獲得！', 'ammo');
        }

        this.engine.scene.remove(p.mesh);
        disposeHierarchy(p.mesh);
        this.pickups.splice(i, 1);
        continue;
      }
      // 戦利品が消えないように時間経過による消滅判定は行わない
    }
  }

  // 戦術手榴弾の物理挙動 & 誘爆
  updateGrenades(delta) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= delta;

      // 信管LED点滅
      if (g.ledMat) {
        g.ledMat.color.setHex(Math.floor(g.fuse * 12) % 2 === 0 ? 0xff0000 : 0x220000);
      }

      // 弾道物理
      g.velocity.y -= 25.0 * delta;
      g.position.addScaledVector(g.velocity, delta);
      g.mesh.position.copy(g.position);

      g.mesh.rotation.x += g.angularVelocity.x * delta;
      g.mesh.rotation.y += g.angularVelocity.y * delta;
      g.mesh.rotation.z += g.angularVelocity.z * delta;

      // 地面バウンド
      if (g.position.y <= 0.16) {
        g.position.y = 0.16;
        g.velocity.y = -g.velocity.y * 0.52;
        g.velocity.x *= 0.72;
        g.velocity.z *= 0.72;
        g.angularVelocity.multiplyScalar(0.7);

        if (Math.abs(g.velocity.y) > 0.8) {
          this.audio.playGrenadeBounce();
        }
      }

      // 障害物バウンド
      for (const item of this.level.colliders) {
        if (item.box.max.y <= 0.2) continue;
        if (item.box.containsPoint(g.position)) {
          g.velocity.x = -g.velocity.x * 0.6;
          g.velocity.z = -g.velocity.z * 0.6;
          this.audio.playGrenadeBounce();
          break;
        }
      }

      // 爆発 (特大爆風演出 & 衝撃波カメラシェイク)
      if (g.fuse <= 0) {
        this.particles.createBlastExplosion(g.position, 0xff6600, 1.6);
        const distToPlayer = g.position.distanceTo(this.player.position);
        this.audio.playExplosion(distToPlayer);
        if (distToPlayer < 24) {
          const shakeAmount = Math.max(0.04, (1 - distToPlayer / 24) * 0.16);
          this.player.triggerScreenShake(shakeAmount, 0.35);
        }

        // 手榴弾の爆破有効半径 (初期値2.0倍基準)
        const effectiveRadius = g.radius * 2.0 * (1.0 + (this.player.hitRangeBonus || 0) * 0.8);

        // 自爆ダメージ
        if (distToPlayer < effectiveRadius) {
          const dmgRatio = 1 - (distToPlayer / effectiveRadius);
          const selfDamage = Math.round(g.damage * 0.4 * dmgRatio);
          if (selfDamage > 5) this.player.takeDamage(selfDamage);
        }

        // 範囲内の敵へのダメージ判定 (攻撃範囲強化が反映)
        let nadeHits = 0;
        let nadeKills = 0;
        let totalScoreFromNade = 0;

        for (const enemy of this.enemies) {
          if (enemy.isDead || enemy.isDying) continue;
          const distToEnemy = g.position.distanceTo(enemy.mesh.position);
          if (distToEnemy < effectiveRadius) {
            const dmgRatio = 1 - (distToEnemy / effectiveRadius);
            const nadeDmg = Math.round(g.damage * dmgRatio);
            const isLethal = enemy.takeDamage(nadeDmg, false, this.player.position);
            nadeHits++;
            if (isLethal) {
              nadeKills++;
              this.onEnemyDefeated(enemy);
              this.kills++;
              const gain = enemy.scoreValue + 75;
              totalScoreFromNade += gain;
              this.score += gain;
              this.player.addAdrenaline(20);
              if (enemy.isBoss) {
                this.handleBossDefeated(enemy);
              } else {
                const dropChance = Math.min(1.0, 0.50 + this.player.dropRateBonus);
                if (Math.random() < dropChance) {
                  this.spawnPickup(enemy.position);
                  if (Math.random() < this.player.doubleDropChance) {
                    const offsetPos = new THREE.Vector3(enemy.position.x + 0.8, enemy.position.y, enemy.position.z + 0.8);
                    this.spawnPickup(offsetPos);
                  }
                }
              }
            }
          }
        }

        if (nadeHits > 0) {
          this.hud.showHitmarker(false);
        }

        if (nadeKills > 0) {
          this.player.addAmmoToAll(30 * nadeKills, 6 * nadeKills, 2 * nadeKills, 45 * nadeKills, 2 * nadeKills, 60 * nadeKills);
          if (nadeKills >= 2) {
            this.hud.addKillfeedItem(`💣 手榴弾で一網打尽！ ${nadeKills}体同時爆殺！ (+${totalScoreFromNade})`);
            this.hud.showAnnouncement(`💣 MULTI-KILL x${nadeKills}！ 一網打尽！`, 2000);
            this.hud.showPickupToast(`撃破補給: 全武器の予備弾薬を獲得 (x${nadeKills})`, 'ammo');
          } else {
            this.hud.addKillfeedItem(`手榴弾で敵兵を爆砕撃破！ (+${totalScoreFromNade})`);
            this.hud.showPickupToast('撃破補給: 全武器の予備弾薬を獲得！', 'ammo');
          }
          this.checkWaveProgress();
        }

        this.engine.scene.remove(g.mesh);
        disposeHierarchy(g.mesh);
        this.grenades.splice(i, 1);
      }
    }
  }

  updateProjectiles(delta) {
    const playerRadius = 0.8;
    const playerCenter = this.player.camera.position.clone().sub(new THREE.Vector3(0, 0.4, 0));

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.life -= delta;

      // Rocket physics (gravity & smoke effect)
      if (p.isRocket) {
        p.velocity.y -= 4.0 * delta;
        if (Math.random() < 0.35) {
          this.particles.createImpactSparks(p.position, new THREE.Vector3(0, 1, 0), 0xff4400, 2);
        }
      }

      // Move projectile
      p.position.addScaledVector(p.velocity, delta);
      p.mesh.position.copy(p.position);

      const distToPlayer = p.position.distanceTo(playerCenter);

      // Rocket direct hit or proximity detonation
      if (p.isRocket && distToPlayer < (p.blastRadius || 4.5)) {
        this.particles.createBlastExplosion(p.position, 0xff4400, 1.3);
        this.audio.playExplosion(p.position.distanceTo(playerCenter));
        if (distToPlayer < 20) {
          this.player.triggerScreenShake(0.12, 0.3);
        }
        const falloff = Math.max(0.2, 1 - (distToPlayer / (p.blastRadius || 4.5)));
        this.player.takeDamage(Math.round(p.damage * falloff));

        this.engine.scene.remove(p.mesh);
        disposeHierarchy(p.mesh);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Hit Player Check for normal bullets
      if (!p.isRocket && distToPlayer < playerRadius) {
        this.player.takeDamage(p.damage);
        this.particles.createImpactSparks(p.position, new THREE.Vector3(0, 1, 0), 0xff0055, 10);

        this.engine.scene.remove(p.mesh);
        disposeHierarchy(p.mesh);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Hit Ground or Wall check
      let collided = false;
      if (p.position.y <= 0.1) {
        collided = true;
      } else {
        for (const item of this.level.colliders) {
          if (item.box.containsPoint(p.position)) {
            collided = true;
            break;
          }
        }
      }

      if (collided || p.life <= 0) {
        if (p.isRocket) {
          this.particles.createBlastExplosion(p.position, 0xff5500, 1.3);
          this.audio.playExplosion(p.position.distanceTo(playerCenter));
          if (distToPlayer < 20) {
            this.player.triggerScreenShake(0.10, 0.25);
          }
          if (distToPlayer < (p.blastRadius || 5.0)) {
            const falloff = Math.max(0.1, 1 - (distToPlayer / (p.blastRadius || 5.0)));
            this.player.takeDamage(Math.round(p.damage * falloff));
          }
        } else {
          this.particles.createImpactSparks(p.position, new THREE.Vector3(0, 1, 0), 0xff0055, 6);
        }
        this.engine.scene.remove(p.mesh);
        disposeHierarchy(p.mesh);
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = this.engine.getDelta();

    if (this.state === 'PLAYING') {
      // バレットタイム時は敵と弾丸の時間を減速 (0.35倍速)
      const worldDelta = this.player.isBulletTime ? delta * 0.35 : delta;

      // 1. Update Player (通常スピードで精密射撃可能)
      this.player.update(delta, this.enemies);

      // 2. Update Tactical Grenades
      this.updateGrenades(delta);

      // 3. Update Tactical 3D Pickups
      this.updatePickups(delta);

      // 4. Update Humanoid Enemies (視覚外判定用collidersを渡す)
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (enemy.isDead) {
          this.enemies.splice(i, 1);
          continue;
        }
        enemy.update(worldDelta, this.player.position, this.engine.camera, this.enemyProjectiles, this.level.colliders);
      }

      // 4.5. Staggered Enemy Spawning (補充キューから1フレーム最大1体スポーンしてメッシュ同期生成スパイクを解消)
      if (this.pendingEnemySpawns > 0 && this.waveEnemiesSpawned < this.totalWaveEnemies) {
        if (this.isEXStage || this.wave > 100) {
          this.spawnSingleEXEnemy(this.waveEnemiesSpawned, this.totalWaveEnemies);
        } else if (this.wave % 5 !== 0) {
          this.spawnSingleNormalEnemy(this.waveEnemiesSpawned, this.totalWaveEnemies);
        }
        this.waveEnemiesSpawned++;
        this.pendingEnemySpawns--;
      }

      // 5. Update Enemy Projectiles
      this.updateProjectiles(worldDelta);

      // 6. Wave Intermission Logic
      if (this.waveState === 'CLEARED') {
        this.waveIntermissionTimer -= delta;
        if (this.waveIntermissionTimer <= 0) {
          this.startWave(this.wave + 1);
        }
      }

      // 7. Update HUD & Minimap (残敵数を全体の残り数として正確に同期表示)
      const enemiesRemaining = Math.max(0, this.totalWaveEnemies - this.waveEnemiesKilled);
      const activeBoss = this.enemies.find(e => e.isBoss && !e.isDead);
      this.hud.update(
        this.player,
        this.wave,
        enemiesRemaining,
        this.totalWaveEnemies,
        this.score,
        this.streak,
        activeBoss
      );
      this.minimap.update(delta, this.player, this.enemies, this.level.jumpPads);
    }

    // Update World & Particles regardless of play state
    this.level.update(delta);
    this.particles.update(delta);

    // Render Scene
    this.engine.render();

    // Real-time Performance & Telemetry Tracking
    this.perfFrames++;
    this.perfElapsed += delta;
    if (this.perfElapsed >= 0.1) {
      this.currentFps = THREE.MathUtils.lerp(this.currentFps, this.perfFrames / this.perfElapsed, 0.25);
      this.currentFrameTime = delta * 1000;
      this.perfFrames = 0;
      this.perfElapsed = 0;

      const rInfo = this.engine.renderer.info;
      const heapMb = window.performance && window.performance.memory
        ? +(window.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)
        : null;

      const telemetryData = {
        fps: this.currentFps,
        frameTime: this.currentFrameTime,
        drawCalls: rInfo.render.calls,
        triangles: rInfo.render.triangles,
        gpuGeometries: rInfo.memory.geometries,
        gpuTextures: rInfo.memory.textures,
        enemies: this.enemies.length,
        pickups: this.pickups.length,
        projectiles: this.enemyProjectiles.length,
        heapMb,
        wave: this.wave,
      };

      if (this.hud) {
        this.hud.updatePerfTelemetry(telemetryData);
      }

      this.perfLogTimer += 0.1;
      if (this.perfLogTimer >= 5.0) {
        this.perfLogTimer = 0;
        this.recordTelemetrySnapshot(telemetryData);
      }
    }
  }

  togglePerfMonitor(force) {
    if (this.hud) {
      return this.hud.togglePerfMonitor(force);
    }
    return false;
  }

  recordTelemetrySnapshot(data) {
    if (!window.perfTelemetryLog) {
      window.perfTelemetryLog = [];
    }
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      wave: this.wave,
      fps: +data.fps.toFixed(1),
      frameTimeMs: +data.frameTime.toFixed(1),
      drawCalls: data.drawCalls,
      triangles: data.triangles,
      gpuGeometries: data.gpuGeometries,
      activeEnemies: data.enemies,
      activePickups: data.pickups,
      activeProjectiles: data.projectiles,
      jsHeapMb: data.heapMb,
    };
    window.perfTelemetryLog.push(entry);
    if (window.perfTelemetryLog.length > 200) {
      window.perfTelemetryLog.shift();
    }

    console.log(
      `%c[PERF TELEMETRY]%c Wave ${this.wave} | FPS: ${entry.fps} (${entry.frameTimeMs}ms) | DrawCalls: ${entry.drawCalls} | Tri: ${(entry.triangles / 1000).toFixed(1)}k | GPU-Geom: ${entry.gpuGeometries} | Enemies: ${entry.activeEnemies} | Pickups: ${entry.activePickups} | Heap: ${entry.jsHeapMb || 'N/A'}MB`,
      'color: #00f3ff; font-weight: bold; background: #051424; padding: 2px 6px; border-radius: 3px;',
      'color: #cbd5e1;'
    );
  }

  getPerfReport() {
    const logs = window.perfTelemetryLog || [];
    if (logs.length === 0) {
      return '【性能テレメトリレポート】記録されたスナップショットがまだありません。ゲームプレイを進めると自動記録されます。';
    }
    const fpsList = logs.map(l => l.fps);
    const minFps = Math.min(...fpsList);
    const maxFps = Math.max(...fpsList);
    const avgFps = +(fpsList.reduce((a, b) => a + b, 0) / fpsList.length).toFixed(1);
    const latest = logs[logs.length - 1];
    const initial = logs[0];

    const geomDelta = latest.gpuGeometries - initial.gpuGeometries;
    const isLeaking = geomDelta > 200;

    let fpsStatus = '✅ 快適 (60FPS前後を安定維持)';
    if (latest.fps < 40 || avgFps < 45 || minFps < 20) {
      fpsStatus = `❌ 深刻な処理落ち・スタッター発生 (平均: ${avgFps} FPS / 最小: ${minFps} FPS / 現在: ${latest.fps} FPS)`;
    } else if (latest.fps < 54 || avgFps < 52) {
      fpsStatus = `🟡 軽度フレームレート低下 (平均: ${avgFps} FPS / 現在: ${latest.fps} FPS)`;
    }

    let ftStatus = '✅ 良好 (<=18.0ms)';
    if (latest.frameTimeMs > 25.0) {
      ftStatus = `❌ 遅延・スタッター中 (${latest.frameTimeMs}ms)`;
    } else if (latest.frameTimeMs > 18.0) {
      ftStatus = `🟡 軽度遅延 (${latest.frameTimeMs}ms)`;
    }

    let geomStatus = '✅ 健全 (解放サイクルが適正稼働中)';
    if (isLeaking) {
      geomStatus = `⚠️ ジオメトリ過剰累積 (+${geomDelta})`;
    } else if (geomDelta > 90) {
      geomStatus = `🟡 許容範囲 (高次ステージ移行に伴う適正増加: +${geomDelta})`;
    }

    let overallVerdict = '✅ 正常: 高フレームレートを維持し、リソースは正常に解放・再利用されています。';
    if (latest.fps < 40 || avgFps < 45 || minFps < 20) {
      overallVerdict = '❌ 異常: フレームレートの著しい低下を検知しました。';
    } else if (isLeaking) {
      overallVerdict = '⚠️ 警告: GPUジオメトリ数が継続的に肥大化している可能性があります。';
    }

    return `
========================================
 CYBER STRIKE 3D 性能テレメトリ診断レポート
========================================
[セッションサマリー]
・総計測サンプル: ${logs.length}回 (約${Math.round(logs.length * 5 / 60 * 10) / 10}分間)
・現在ウェーブ: Stage ${this.wave}
・現在FPS: ${latest.fps} (平均: ${avgFps}, 最小: ${minFps}, 最大: ${maxFps})
・フレームタイム: ${latest.frameTimeMs}ms
・ドローコール (Draw Calls): ${latest.drawCalls}
・描画ポリゴン (Triangles): ${(latest.triangles / 1000).toFixed(1)}k

[GPUメモリ & リソース状態]
・GPU保持ジオメトリ数: ${latest.gpuGeometries} (初期: ${initial.gpuGeometries}, 変化: ${geomDelta >= 0 ? '+' : ''}${geomDelta})
・フィールド残留敵数: ${latest.activeEnemies}
・未回収アイテム数: ${latest.activePickups}
・飛翔体数: ${latest.activeProjectiles}
・JS Heapメモリ: ${latest.jsHeapMb ? `${latest.jsHeapMb} MB` : '非対応ブラウザ'}

[詳細健全性評価]
・フレームレート評価: ${fpsStatus}
・描画フレームタイム: ${ftStatus}
・GPUジオメトリ状態: ${geomStatus}

[自動診断総合判定]
${overallVerdict}
========================================
`.trim();
  }

  downloadPerfLog() {
    const data = JSON.stringify(window.perfTelemetryLog || [], null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyber_strike_perf_report_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Global Diagnostics & Telemetry API
window.perfTelemetryLog = [];
window.getPerfReport = () => window.game ? window.game.getPerfReport() : 'Game not ready';
window.downloadPerfLog = () => window.game?.downloadPerfLog();
window.togglePerfMonitor = (force) => window.game?.togglePerfMonitor(force);

// Instantiate Game on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  window.game = new CyberStrikeGame();
});
