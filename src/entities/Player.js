import * as THREE from 'three';
import { PulseRifle, ScatterCannon, VortexRailgun, PlasmaSMG, HeavyGrenadeLauncher, NebulaBeamCannon } from './Arsenal.js';

/**
 * First-Person Player Controller
 * Handles physics, movement, jumping, collisions, health/shields, and weapon management.
 */
export class Player {
  constructor(engine, inputManager, audioManager, particleSystem, level) {
    this.engine = engine;
    this.camera = engine.camera;
    this.scene = engine.scene;
    this.input = inputManager;
    this.audio = audioManager;
    this.particles = particleSystem;
    this.level = level;

    // Position & Physics
    this.position = new THREE.Vector3(0, 1.7, 25);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;

    // Movement Parameters
    this.walkSpeed = 9.0;
    this.sprintSpeed = 15.0;
    this.crouchSpeed = 4.5;
    this.jumpForce = 10.5;
    this.gravity = 26.0;
    this.isGrounded = false;
    this.wasGrounded = true;
    this.isCrouched = false;
    this.standingHeight = 1.7;
    this.crouchHeight = 0.95;
    this.currentHeight = 1.7;

    // Vitals (シールド初期値0、上限倍増200、アイテム拾得でのみ獲得)
    this.maxHealth = 100;
    this.health = 100;
    this.maxShield = 200;
    this.shield = 0;
    this.maxStamina = 100;
    this.stamina = 100;

    // Footstep timer
    this.footstepTimer = 0;
    this.walkTime = 0;

    // Tactical Sliding (スライディング)
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = 0.82;
    this.slideDirection = new THREE.Vector3();
    this.slideSpeed = 0;
    this.slideHeight = 0.72;
    this.roll = 0;
    this.slideDustTimer = 0;
    this.wasCrouchKey = false;

    // Tactical Grenades & Adrenaline Bullet Time
    this.grenades = 3;
    this.maxGrenades = 999; // 所持数制限撤廃 (無限ストック可能)
    this.adrenaline = 0;
    this.maxAdrenaline = 100;
    this.isBulletTime = false;
    this.bulletTimeTimer = 0;

    // Screen Shake (爆風・被弾カメラシェイク)
    this.shakeIntensity = 0.0;
    this.shakeDuration = 0.0;
    this.shakeTimer = 0.0;

    // Weapon Permanent Upgrades
    this.damageMultiplier = 1.0;
    this.damageUpgradeLevel = 0;
    this.magUpgradeLevel = 0;
    this.hitRangeBonus = 0.0;
    this.hitRangeUpgradeLevel = 0;
    this.speedMultiplier = 1.0;
    this.speedUpgradeLevel = 0;
    this.fireRateMultiplier = 1.0;
    this.fireRateUpgradeLevel = 0;

    // 新規バフ: ドロップ率向上 & 倍ドロップ & トリプルドロップ
    this.dropRateBonus = 0.0;
    this.dropRateUpgradeLevel = 0;
    this.doubleDropChance = 0.0;
    this.doubleDropUpgradeLevel = 0;
    this.tripleDropChance = 0.0;
    this.tripleDropUpgradeLevel = 0;

    // EXステージ状態 & 空中ジャンプ
    this.isEXStage = false;
    this.jumpCount = 0;
    this.wasJumpKey = false;

    // 5秒無敵バリア
    this.invincibleTimer = 0.0;
    this.invincibleShieldMesh = this.createInvincibleShieldMesh();
    this.scene.add(this.invincibleShieldMesh);

    // Raycaster for shooting
    this.raycaster = new THREE.Raycaster();

    // Weapons (全6スロット)
    this.weapons = [
      new PulseRifle(this.camera, this.scene, this.audio, this.particles),
      new ScatterCannon(this.camera, this.scene, this.audio, this.particles),
      new VortexRailgun(this.camera, this.scene, this.audio, this.particles),
      new PlasmaSMG(this.camera, this.scene, this.audio, this.particles),
      new HeavyGrenadeLauncher(this.camera, this.scene, this.audio, this.particles),
      new NebulaBeamCannon(this.camera, this.scene, this.audio, this.particles),
    ];
    this.currentWeaponIndex = 0;
    this.activeWeapon = this.weapons[0];
    this.activeWeapon.setActive(true);

    // Camera container
    this.camera.position.copy(this.position);

    // Callbacks
    this.onHitEnemy = null;     // (damage, isCritical, isLethal) => {}
    this.onTakeDamage = null;   // (amount, shieldDamage, hpDamage) => {}
    this.onPlayerDeath = null;  // () => {}
    this.onWeaponFired = null;  // () => {}
    this.onScopeToggle = null;  // (isSniperScopeActive) => {}
  }

  createInvincibleShieldMesh() {
    const geo = new THREE.IcosahedronGeometry(1.6, 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.38,
      wireframe: true,
      roughness: 0.2,
      metalness: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    return mesh;
  }

  reset() {
    this.position.set(0, 1.7, 25);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.maxShield = 200;
    this.shield = 0;
    this.stamina = 100;
    this.shieldRegenTimer = 0;
    this.isSliding = false;
    this.slideTimer = 0;
    this.roll = 0;
    this.grenades = 3;
    this.adrenaline = 0;
    this.isBulletTime = false;
    this.bulletTimeTimer = 0;
    this.damageMultiplier = 1.0;
    this.damageUpgradeLevel = 0;
    this.magUpgradeLevel = 0;
    this.hitRangeBonus = 0.0;
    this.hitRangeUpgradeLevel = 0;
    this.speedMultiplier = 1.0;
    this.speedUpgradeLevel = 0;
    this.fireRateMultiplier = 1.0;
    this.fireRateUpgradeLevel = 0;
    this.dropRateBonus = 0.0;
    this.dropRateUpgradeLevel = 0;
    this.doubleDropChance = 0.0;
    this.doubleDropUpgradeLevel = 0;
    this.tripleDropChance = 0.0;
    this.tripleDropUpgradeLevel = 0;
    this.isEXStage = false;
    this.jumpCount = 0;
    this.invincibleTimer = 0.0;
    if (this.invincibleShieldMesh) this.invincibleShieldMesh.visible = false;

    if (this.onScopeToggle) this.onScopeToggle(false);

    // 全武器を単一武器(wieldMode: 1)にリセット
    this.weapons.forEach(w => {
      if (w.setWieldMode) w.setWieldMode(1);
      else w.wieldMode = 1;
    });

    // 全武器のステータスを初期値に完全リセット (magazineSize, reserveAmmo, fireRate)
    const initialWeaponStats = [
      { magazineSize: 30, reserveAmmo: 180 },  // AK-47
      { magazineSize: 8,  reserveAmmo: 48  },   // Shotgun
      { magazineSize: 4,  reserveAmmo: 20  },   // Railgun
      { magazineSize: 45, reserveAmmo: 270 },   // SMG
      { magazineSize: 6,  reserveAmmo: 24  },   // Grenade Launcher
      { magazineSize: 80, reserveAmmo: 320 },   // Nebula Beam
    ];

    this.weapons.forEach((w, idx) => {
      w.setFireRateMultiplier(1.0);
      if (initialWeaponStats[idx]) {
        w.magazineSize = initialWeaponStats[idx].magazineSize;
        w.reserveAmmo = initialWeaponStats[idx].reserveAmmo;
      }
      w.currentAmmo = w.magazineSize;
      w.isReloading = false;
      // NebulaBeamCannon の過熱・チャネリング蓄積リセット
      if (w.channelDuration !== undefined) {
        w.channelDuration = 0.0;
        w.channelTimer = 0.0;
        w.currentTier = 1;
        w.beamHeat = 0.0;
        w.fireMode = 'BEAM Lv.1 (1.0x)';
      }
    });

    this.switchWeapon(0);
  }

  // 武器威力強化 (元通り+10%)
  upgradeDamage(bonus = 0.10) {
    this.damageMultiplier += bonus;
    this.damageUpgradeLevel++;
    return this.damageMultiplier;
  }

  // 拡張マガジン強化 (戦利品コア)
  upgradeMagazine(ak = 4, shotgun = 2, railgun = 1, smg = 6, launcher = 1, beam = 12) {
    this.magUpgradeLevel++;
    if (this.weapons[0]) {
      this.weapons[0].magazineSize += ak;
      this.weapons[0].currentAmmo = this.weapons[0].magazineSize;
      this.weapons[0].reserveAmmo += ak * 2;
    }
    if (this.weapons[1]) {
      this.weapons[1].magazineSize += shotgun;
      this.weapons[1].currentAmmo = this.weapons[1].magazineSize;
      this.weapons[1].reserveAmmo += shotgun * 2;
    }
    if (this.weapons[2]) {
      this.weapons[2].magazineSize += railgun;
      this.weapons[2].currentAmmo = this.weapons[2].magazineSize;
      this.weapons[2].reserveAmmo += railgun * 2;
    }
    if (this.weapons[3]) {
      this.weapons[3].magazineSize += smg;
      this.weapons[3].currentAmmo = this.weapons[3].magazineSize;
      this.weapons[3].reserveAmmo += smg * 2;
    }
    if (this.weapons[4]) {
      this.weapons[4].magazineSize += launcher;
      this.weapons[4].currentAmmo = this.weapons[4].magazineSize;
      this.weapons[4].reserveAmmo += launcher * 2;
    }
    if (this.weapons[5]) {
      this.weapons[5].magazineSize += beam;
      this.weapons[5].currentAmmo = this.weapons[5].magazineSize;
      this.weapons[5].reserveAmmo += beam * 2;
    }
  }

  // 攻撃範囲強化 (元通り+25cm)
  upgradeHitRange(bonus = 0.25) {
    this.hitRangeBonus += bonus;
    this.hitRangeUpgradeLevel++;
    return this.hitRangeBonus;
  }

  // 移動速度強化 (1/10のまま維持 -> +1.0%)
  upgradeSpeed(bonus = 0.01) {
    this.speedMultiplier += bonus;
    this.speedUpgradeLevel++;
    return this.speedMultiplier;
  }

  // ドロップ率向上強化 (+5%刻み、最大+20%で確定100%)
  upgradeDropRate(bonus = 0.05) {
    this.dropRateBonus = Math.min(0.20, this.dropRateBonus + bonus);
    this.dropRateUpgradeLevel++;
    return this.dropRateBonus;
  }

  // 倍ドロップ強化 (35%刻み、100%到達後はトリプルドロップへ進化！)
  upgradeDoubleDrop(bonus = 0.35) {
    if (this.doubleDropChance < 1.0) {
      this.doubleDropChance = Math.min(1.0, this.doubleDropChance + bonus);
      this.doubleDropUpgradeLevel++;
      return { type: 'double', chance: this.doubleDropChance, level: this.doubleDropUpgradeLevel };
    } else {
      this.tripleDropChance = Math.min(1.0, this.tripleDropChance + bonus);
      this.tripleDropUpgradeLevel++;
      return { type: 'triple', chance: this.tripleDropChance, level: this.tripleDropUpgradeLevel };
    }
  }

  // 5秒無敵バリア発動 (戦利品コア)
  activateInvincibility(duration = 5.0) {
    this.invincibleTimer = Math.max(this.invincibleTimer, duration);
    if (this.invincibleShieldMesh) this.invincibleShieldMesh.visible = true;
    return this.invincibleTimer;
  }

  // 武器連射速度強化 (元通り+12%)
  upgradeFireRate(bonus = 0.12) {
    this.fireRateMultiplier += bonus;
    this.fireRateUpgradeLevel++;
    this.weapons.forEach(w => w.setFireRateMultiplier(this.fireRateMultiplier));
    return this.fireRateMultiplier;
  }

  // シールド補給 (上限200まで回復)
  addShield(amount = 75) {
    this.shield = Math.min(this.maxShield, this.shield + amount);
    return this.shield;
  }

  switchWeapon(index) {
    if (typeof index === 'string') {
      if (index === 'next') {
        index = (this.currentWeaponIndex + 1) % this.weapons.length;
      } else if (index === 'prev') {
        index = (this.currentWeaponIndex - 1 + this.weapons.length) % this.weapons.length;
      }
    }

    if (index === this.currentWeaponIndex || index < 0 || index >= this.weapons.length) {
      return;
    }

    if (this.onScopeToggle) {
      this.onScopeToggle(false);
    }

    this.activeWeapon.setActive(false);
    this.currentWeaponIndex = index;
    this.activeWeapon = this.weapons[index];
    this.activeWeapon.setActive(true);

    const curAmmo = this.activeWeapon.currentAmmo;
    let wieldMode = 1;
    if (curAmmo >= 6000) wieldMode = 3;
    else if (curAmmo >= 3000) wieldMode = 2;
    if (this.activeWeapon.setWieldMode) {
      this.activeWeapon.setWieldMode(wieldMode);
    } else {
      this.activeWeapon.wieldMode = wieldMode;
    }

    this.audio.playMechanicalClick(600, 0.08);
  }

  takeDamage(amount) {
    if (this.health <= 0) return;

    // 5秒無敵バリア発動中: 被ダメージ完全無効化
    if (this.invincibleTimer > 0) {
      this.particles.createImpactSparks(this.position, new THREE.Vector3(0, 1, 0), 0xffd700, 14);
      if (this.audio && typeof this.audio.playShieldBreak === 'function') {
        this.audio.playShieldBreak();
      }
      return;
    }

    this.shieldRegenTimer = this.shieldRegenDelay;
    let shieldDmg = 0;
    let hpDmg = 0;

    if (this.shield > 0) {
      if (this.shield >= amount) {
        this.shield -= amount;
        shieldDmg = amount;
      } else {
        shieldDmg = this.shield;
        const remainder = amount - this.shield;
        this.shield = 0;
        this.health -= remainder;
        hpDmg = remainder;
        if (this.audio && typeof this.audio.playShieldBreak === 'function') {
          this.audio.playShieldBreak();
        }
      }
    } else {
      this.health -= amount;
      hpDmg = amount;
    }

    this.health = Math.max(0, this.health);
    if (this.audio?.playPlayerDamage) this.audio.playPlayerDamage();

    if (this.onTakeDamage) {
      this.onTakeDamage(amount, shieldDmg, hpDmg);
    }

    if (this.health <= 0) {
      if (this.onPlayerDeath) this.onPlayerDeath();
    }
  }

  triggerScreenShake(intensity = 0.08, duration = 0.28) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  update(delta, enemiesList) {
    // 1. Mouse Aim Look
    const { dx, dy } = this.input.consumeMouseDelta();
    this.yaw -= dx;
    this.pitch -= dy;
    this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
    // Keep yaw normalized between -PI and +PI to avoid floating point drift
    this.yaw = (this.yaw + Math.PI) % (2 * Math.PI) - Math.PI;

    // Screen Shake from explosions or heavy hits
    let shakePitch = 0;
    let shakeYaw = 0;
    let shakeRoll = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - delta);
      const factor = this.shakeDuration > 0 ? (this.shakeTimer / this.shakeDuration) : 0;
      const amp = this.shakeIntensity * factor;
      shakePitch = (Math.random() - 0.5) * amp;
      shakeYaw = (Math.random() - 0.5) * amp;
      shakeRoll = (Math.random() - 0.5) * amp * 1.5;
    }

    // Update Camera Rotation (Yaw, Pitch, Roll / Dutch Tilt + Screen Shake)
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw + shakeYaw;
    this.camera.rotation.x = this.pitch + shakePitch;
    this.camera.rotation.z = this.roll + shakeRoll;

    // 2. Weapon ADS Handling
    const isAiming = this.input.isAimingDownSight();
    this.activeWeapon.setADS(isAiming);

    const isSniperADS = isAiming && this.activeWeapon.type === 'railgun';
    if (this.onScopeToggle) {
      this.onScopeToggle(isSniperADS);
    }
    // スナイパースコープ展開時は照準器内部を見通すため武器モデルを非表示化
    if (this.activeWeapon.type === 'railgun') {
      this.activeWeapon.root.visible = !isSniperADS;
    }

    // Dynamic FOV Zoom on ADS
    let targetFOV = this.engine.defaultFOV;
    if (isAiming) {
      if (this.activeWeapon.type === 'railgun') {
        targetFOV = 18; // 4.5倍率 スナイパー超望遠ズーム
      } else if (this.activeWeapon.type === 'shotgun') {
        targetFOV = 56; // 戦術散弾 集中照準ズーム
      } else {
        targetFOV = 50; // AK-47 リフレックス照準ズーム
      }
    }
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 16);
    this.camera.updateProjectionMatrix();

    // 5秒無敵バリアのタイマー ＆ シールドメッシュ更新
    if (this.invincibleTimer > 0) {
      this.invincibleTimer = Math.max(0, this.invincibleTimer - delta);
      if (this.invincibleShieldMesh) {
        this.invincibleShieldMesh.visible = true;
        this.invincibleShieldMesh.position.copy(this.position);
        this.invincibleShieldMesh.rotation.y += delta * 2.5;
        this.invincibleShieldMesh.rotation.x += delta * 1.5;
      }
    } else {
      if (this.invincibleShieldMesh) {
        this.invincibleShieldMesh.visible = false;
      }
    }

    // 3. Movement Calculations
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    let moveDir = new THREE.Vector3();
    if (this.input.keys.forward) moveDir.add(forward);
    if (this.input.keys.backward) moveDir.sub(forward);
    if (this.input.keys.right) moveDir.add(right);
    if (this.input.keys.left) moveDir.sub(right);

    const isMoving = moveDir.lengthSq() > 0.01;
    if (isMoving) moveDir.normalize();

    // Sprinting check
    const wantsSprint = this.input.keys.sprint && this.input.keys.forward && !this.input.keys.crouch && !isAiming && !this.activeWeapon.isReloading;

    // Sliding Trigger: 移動中またはダッシュ中にしゃがみ (Cキー) を押すとスライディング発動
    const canInitiateSlide = this.input.keys.crouch && !this.wasCrouchKey && !this.isSliding && this.isGrounded && this.stamina >= 14 && (wantsSprint || isMoving);
    this.wasCrouchKey = this.input.keys.crouch;

    if (canInitiateSlide) {
      this.isSliding = true;
      this.slideTimer = this.slideDuration;
      this.slideSpeed = 22.0 * this.speedMultiplier; // 爆発的な初速ブースト (機動アップ反映)
      this.slideDirection = isMoving ? moveDir.clone() : forward.clone();
      this.stamina = Math.max(0, this.stamina - 18);
      this.audio.playSlide();
      this.particles.createSlideDust(this.position, this.slideDirection);
      this.slideDustTimer = 0.12;
    }

    let currentSpeed = this.walkSpeed * this.speedMultiplier;

    if (this.isSliding) {
      currentSpeed = this.slideSpeed;
      this.slideTimer -= delta;
      // スライディングの減速
      this.slideSpeed = THREE.MathUtils.lerp(this.slideSpeed, this.crouchSpeed, delta * 3.4);
      this.velocity.x = this.slideDirection.x * this.slideSpeed;
      this.velocity.z = this.slideDirection.z * this.slideSpeed;

      // 視点を極限まで低く
      this.currentHeight = THREE.MathUtils.lerp(this.currentHeight, this.slideHeight, delta * 16);

      // カメラロール (ダッチチルトでスピード感を演出)
      this.roll = THREE.MathUtils.lerp(this.roll, -0.10, delta * 12);

      // 滑走中の土埃パーティクル定期発生
      this.slideDustTimer -= delta;
      if (this.slideDustTimer <= 0) {
        this.slideDustTimer = 0.12;
        this.particles.createSlideDust(this.position, this.slideDirection);
      }

      // ジャンプによるスライドキャンセル (Slide-Cancel Jump Shot)
      if (this.input.keys.jump && this.isGrounded) {
        this.isSliding = false;
        this.velocity.y = (this.isEXStage ? 17.5 : this.jumpForce) * 1.05;
        this.isGrounded = false;
        this.audio.playJump();
      }

      if (this.slideTimer <= 0 || !this.isGrounded) {
        this.isSliding = false;
      }
    } else {
      // 通常のしゃがみ ＆ 歩行
      this.isCrouched = this.input.keys.crouch;
      const targetHeight = this.isCrouched ? this.crouchHeight : this.standingHeight;
      this.currentHeight = THREE.MathUtils.lerp(this.currentHeight, targetHeight, delta * 12);
      this.roll = THREE.MathUtils.lerp(this.roll, 0, delta * 12);

      if (this.isEXStage) {
        // EXステージ: 無限スタミナ ＆ 1.35倍超高速移動
        this.stamina = this.maxStamina;
        currentSpeed = (wantsSprint ? this.sprintSpeed * 1.35 : this.walkSpeed * 1.25) * this.speedMultiplier;
      } else if (wantsSprint && this.stamina > 5) {
        currentSpeed = this.sprintSpeed * this.speedMultiplier;
        this.stamina = Math.max(0, this.stamina - delta * 24);
      } else {
        if (this.isCrouched) currentSpeed = this.crouchSpeed * this.speedMultiplier;
        this.stamina = Math.min(this.maxStamina, this.stamina + delta * 18);
      }

      // Accelerate horizontal velocity
      const targetVelX = moveDir.x * currentSpeed;
      const targetVelZ = moveDir.z * currentSpeed;
      // EXステージでは空中でも高い機動性(accelRate: 14.0)を発揮し、空中戦を自在に制御可能
      const accelRate = this.isGrounded ? 18.0 : (this.isEXStage ? 14.0 : 4.0);
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelX, delta * accelRate);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelZ, delta * accelRate);
    }

    // Gravity (EXステージでは超低重力 6.5・壮大な浮遊感)
    const effectiveGravity = this.isEXStage ? 6.5 : this.gravity;
    this.velocity.y -= effectiveGravity * delta;

    // Jumping & EX-Stage Aerial Jet Burst
    const isJumpPressed = !!this.input.keys.jump;
    const isJumpTrigger = isJumpPressed && !this.wasJumpKey;
    this.wasJumpKey = isJumpPressed;

    if (this.isGrounded) {
      this.jumpCount = 0;
      if (isJumpTrigger && !this.isCrouched) {
        this.velocity.y = this.isEXStage ? 16.5 : this.jumpForce;
        this.isGrounded = false;
        this.jumpCount = 1;
        this.audio.playJump();
      }
    } else if (this.isEXStage && isJumpTrigger && this.jumpCount < 3) {
      // EXステージ限定: 空中3段反重力ジェットダッシュ ＆ 超跳躍
      this.velocity.y = 14.5;
      // 水平方向への指向性ジェット噴射 (キー入力方向へ高速ブースト)
      if (isMoving) {
        this.velocity.x += moveDir.x * 9.5;
        this.velocity.z += moveDir.z * 9.5;
      }
      this.jumpCount++;
      this.audio.playDoubleJump();
      // カメラ衝撃演出
      this.pitch += (Math.random() - 0.5) * 0.03;
      this.roll += (Math.random() - 0.5) * 0.04;
      // 金色スラスター衝撃波リング＆プラズマ噴射
      if (this.particles && this.particles.createThrusterBlast) {
        this.particles.createThrusterBlast(this.position, 0xffd700);
      }
    }

    // Jump Pads Interaction
    this.checkJumpPads();

    // 4. Collision & Movement Resolution
    this.resolveMovementAndCollisions(delta);

    // 5. Footsteps & Bobbing (自然なリズムに修正)
    if (this.isGrounded && isMoving) {
      this.walkTime += delta * (currentSpeed / this.walkSpeed);
      this.footstepTimer += delta;
      const stepInterval = wantsSprint ? 0.28 : (this.isCrouched ? 0.52 : 0.38);
      if (this.footstepTimer >= stepInterval) {
        this.audio.playFootstep(wantsSprint, this.isCrouched);
        this.footstepTimer = 0;
      }
    } else {
      this.footstepTimer = 0.12;
    }

    // Landing sound
    if (!this.wasGrounded && this.isGrounded) {
      this.audio.playLanding();
    }
    this.wasGrounded = this.isGrounded;

    // Bullet Time duration update
    if (this.isBulletTime) {
      this.bulletTimeTimer -= delta;
      if (this.bulletTimeTimer <= 0) {
        this.isBulletTime = false;
        this.audio.playBulletTime(false);
      }
    }

    // 6. Shield (自動回復なし: アイテムでのみチャージ)

    // 7. Update Camera Position
    this.camera.position.set(this.position.x, this.position.y + this.currentHeight, this.position.z);

    // 8. Update Active Weapon & Multi-Wield State (2丁流・3丁流の実モデル同期)
    const curAmmo = this.activeWeapon.currentAmmo;
    let wieldMode = 1;
    if (curAmmo >= 6000) wieldMode = 3;
    else if (curAmmo >= 3000) wieldMode = 2;
    if (this.activeWeapon.setWieldMode) {
      this.activeWeapon.setWieldMode(wieldMode);
    } else {
      this.activeWeapon.wieldMode = wieldMode;
    }

    this.activeWeapon.applySway({ dx, dy }, this.walkTime);
    this.activeWeapon.update(delta, isMoving && this.isGrounded, this.walkTime, this.isSliding);

    // 9. Shooting
    if (this.input.isFiring()) {
      if (this.activeWeapon.automatic || !this.wasFiring) {
        this.shoot(enemiesList);
      }
    }
    this.wasFiring = this.input.isFiring();
  }

  checkJumpPads() {
    for (const pad of this.level.jumpPads) {
      const dist = new THREE.Vector2(this.position.x - pad.position.x, this.position.z - pad.position.z).length();
      if (dist < pad.radius && Math.abs(this.position.y - pad.position.y) < 1.0) {
        this.velocity.y = pad.power; // catapult upwards!
        this.isGrounded = false;
        this.jumpCount = 0; // ジャンプパッド射出時に空中ジャンプ回数をリセット
        this.audio.playJumpPad();
        this.particles.createImpactSparks(pad.position, new THREE.Vector3(0, 1, 0), 0x00ff88, 20);
        break;
      }
    }
  }

  resolveMovementAndCollisions(delta) {
    const nextPos = this.position.clone();
    nextPos.x += this.velocity.x * delta;
    nextPos.z += this.velocity.z * delta;
    nextPos.y += this.velocity.y * delta;

    // Player radius & height
    const playerRadius = 0.55;
    this.isGrounded = false;

    // Check collision against level colliders
    for (const item of this.level.colliders) {
      const box = item.box;

      // Vertical ground check
      const groundCheckY = nextPos.y;
      if (
        nextPos.x + playerRadius > box.min.x &&
        nextPos.x - playerRadius < box.max.x &&
        nextPos.z + playerRadius > box.min.z &&
        nextPos.z - playerRadius < box.max.z
      ) {
        // Landing on top of a surface
        if (this.position.y >= box.max.y - 0.2 && nextPos.y <= box.max.y) {
          nextPos.y = box.max.y;
          this.velocity.y = 0;
          this.isGrounded = true;
        }
      }

      // Step-up check for stairs (段差階段のスムーズな自動踏破)
      const stepDiff = box.max.y - this.position.y;
      if (
        stepDiff > 0.02 &&
        stepDiff <= 0.48 &&
        nextPos.x + playerRadius > box.min.x &&
        nextPos.x - playerRadius < box.max.x &&
        nextPos.z + playerRadius > box.min.z &&
        nextPos.z - playerRadius < box.max.z
      ) {
        nextPos.y = box.max.y;
        this.velocity.y = 0;
        this.isGrounded = true;
        continue;
      }

      // Horizontal Wall / Box Collisions
      if (
        nextPos.y + this.currentHeight > box.min.y &&
        nextPos.y < box.max.y
      ) {
        // X-axis collision
        if (
          nextPos.x + playerRadius > box.min.x &&
          nextPos.x - playerRadius < box.max.x &&
          this.position.z + playerRadius > box.min.z &&
          this.position.z - playerRadius < box.max.z
        ) {
          if (this.velocity.x > 0 && this.position.x < box.min.x) {
            nextPos.x = box.min.x - playerRadius;
            this.velocity.x = 0;
          } else if (this.velocity.x < 0 && this.position.x > box.max.x) {
            nextPos.x = box.max.x + playerRadius;
            this.velocity.x = 0;
          }
        }

        // Z-axis collision
        if (
          nextPos.z + playerRadius > box.min.z &&
          nextPos.z - playerRadius < box.max.z &&
          nextPos.x + playerRadius > box.min.x &&
          nextPos.x - playerRadius < box.max.x
        ) {
          if (this.velocity.z > 0 && this.position.z < box.min.z) {
            nextPos.z = box.min.z - playerRadius;
            this.velocity.z = 0;
          } else if (this.velocity.z < 0 && this.position.z > box.max.z) {
            nextPos.z = box.max.z + playerRadius;
            this.velocity.z = 0;
          }
        }
      }
    }

    // Floor fallback
    if (nextPos.y < 0) {
      nextPos.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Circular arena boundary clamp (半径50mの円形フィールド境界)
    const maxRadius = 49.0;
    const distFromCenter = Math.hypot(nextPos.x, nextPos.z);
    if (distFromCenter > maxRadius - playerRadius) {
      const angle = Math.atan2(nextPos.z, nextPos.x);
      nextPos.x = Math.cos(angle) * (maxRadius - playerRadius);
      nextPos.z = Math.sin(angle) * (maxRadius - playerRadius);
    }

    if (isNaN(nextPos.x) || isNaN(nextPos.y) || isNaN(nextPos.z)) {
      nextPos.set(0, 0, 0);
      this.velocity.set(0, 0, 0);
    }
    this.position.copy(nextPos);
  }

  shoot(enemiesList) {
    if (!this.activeWeapon.canShoot()) {
      if (this.activeWeapon.currentAmmo === 0 && !this.activeWeapon.isReloading) {
        this.activeWeapon.reload();
      }
      return;
    }

    // Collect all enemy target meshes
    const enemyMeshes = [];
    enemiesList.forEach(e => {
      if (!e.isDead) enemyMeshes.push(...e.targetMeshes);
    });

    // 2丁モード (3000弾以上) / 3丁モード (6000弾以上) を兵装に設定
    const curAmmo = this.activeWeapon.currentAmmo;
    let wieldMode = 1;
    if (curAmmo >= 6000) wieldMode = 3;
    else if (curAmmo >= 3000) wieldMode = 2;
    this.activeWeapon.wieldMode = wieldMode;

    const obstacleMeshes = this.level.colliderMeshes || this.level.colliders;
    const hit = this.activeWeapon.fire(this.raycaster, enemyMeshes, obstacleMeshes, this.hitRangeBonus, enemiesList);
    if (this.onWeaponFired) {
      this.onWeaponFired();
    }

    if (Array.isArray(hit)) {
      // 散弾銃: 複数ペレット命中時は個別の音を抑止し、まとめて単一の重低音ヒット音を鳴動 (クリッピング解消)
      let hasHit = false;
      let hasCritical = false;
      hit.forEach(h => {
        const res = this.processHit(h, true);
        if (res) {
          hasHit = true;
          if (res.isCritical) hasCritical = true;
        }
      });
      if (hasHit) {
        this.audio.playHitmarker(hasCritical, true);
      }
    } else if (hit) {
      this.processHit(hit, false);
    }
  }

  processHit(hitObj, suppressSound = false) {
    if (hitObj.type === 'enemy' && hitObj.hit && hitObj.hit.object) {
      const mesh = hitObj.hit.object;
      const enemy = mesh.userData.enemy;
      if (enemy && !enemy.isDead) {
        const isCritical = mesh.userData.isCritical === true;
        const multiplier = isCritical ? this.activeWeapon.headshotMultiplier : 1.0;
        const splash = hitObj.hit.splashRatio !== undefined ? hitObj.hit.splashRatio : 1.0;
        const ramp = hitObj.hit.rampMult !== undefined ? hitObj.hit.rampMult : 1.0;
        const totalDamage = Math.round(this.activeWeapon.damage * multiplier * this.damageMultiplier * splash * ramp);

        const isLethal = enemy.takeDamage(totalDamage, isCritical, mesh);
        if (!suppressSound) {
          this.audio.playHitmarker(isCritical, false);
        }

        if (this.onHitEnemy) {
          this.onHitEnemy(totalDamage, isCritical, isLethal, enemy);
        }
        return { isCritical, isLethal };
      }
    }
    return null;
  }

  // 弾薬補給 (全6武器一括) - 2丁流・3丁流に対応するため上限を99,999へ拡張
  addAmmoToAll(ak = 60, shotgun = 16, sniper = 4, smg = 90, launcher = 6, beam = 80) {
    const maxReserve = 99999;
    if (this.weapons[0]) this.weapons[0].reserveAmmo = Math.min(maxReserve, this.weapons[0].reserveAmmo + ak);
    if (this.weapons[1]) this.weapons[1].reserveAmmo = Math.min(maxReserve, this.weapons[1].reserveAmmo + shotgun);
    if (this.weapons[2]) this.weapons[2].reserveAmmo = Math.min(maxReserve, this.weapons[2].reserveAmmo + sniper);
    if (this.weapons[3]) this.weapons[3].reserveAmmo = Math.min(maxReserve, this.weapons[3].reserveAmmo + smg);
    if (this.weapons[4]) this.weapons[4].reserveAmmo = Math.min(maxReserve, this.weapons[4].reserveAmmo + launcher);
    if (this.weapons[5]) this.weapons[5].reserveAmmo = Math.min(maxReserve, this.weapons[5].reserveAmmo + beam);
  }

  // アドレナリン蓄積
  addAdrenaline(amount) {
    this.adrenaline = Math.min(this.maxAdrenaline, this.adrenaline + amount);
  }

  // アドレナリン・バレットタイム発動 (Qキー)
  activateBulletTime() {
    if (this.adrenaline < 50 || this.isBulletTime) return false;
    this.adrenaline = Math.max(0, this.adrenaline - 50);
    this.isBulletTime = true;
    this.bulletTimeTimer = 4.0;
    this.audio.playBulletTime(true);
    return true;
  }

  // 戦術手榴弾投擲 (Gキー)
  throwGrenade(grenadesList) {
    if (this.grenades <= 0) return false;
    this.grenades--;

    // 3D 手榴弾モデル (軍用オリーブドラブ + イエロー識別帯 + 赤色信管LED)
    const grenadeGroup = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x3d4b35,
      roughness: 0.5,
      metalness: 0.7,
    });
    const bodyGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.28, 12);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    grenadeGroup.add(body);

    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const stripeGeo = new THREE.CylinderGeometry(0.122, 0.122, 0.05, 12);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    grenadeGroup.add(stripe);

    const capMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9 });
    const capGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.09, 8);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.16;
    grenadeGroup.add(cap);

    const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const ledGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 0.21, 0);
    grenadeGroup.add(led);

    // 視線方向へ投擲
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    const spawnPos = this.camera.position.clone().addScaledVector(forward, 0.6);
    grenadeGroup.position.copy(spawnPos);
    this.scene.add(grenadeGroup);

    const velocity = forward.clone().multiplyScalar(19.0).add(new THREE.Vector3(0, 4.5, 0));
    const angularVelocity = new THREE.Vector3(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12
    );

    grenadesList.push({
      mesh: grenadeGroup,
      ledMat,
      position: spawnPos,
      velocity,
      angularVelocity,
      fuse: 1.8,
      bounces: 0,
      damage: 140,
      radius: 9.5,
    });

    this.audio.playGrenadePin();
    return true;
  }
}
