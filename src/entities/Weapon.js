import * as THREE from 'three';

/**
 * Base Weapon Class
 * Procedural 3D model, ADS alignment, recoil recovery, muzzle flash.
 */
export class Weapon {
  constructor(config, camera, scene, audioManager, particleSystem) {
    this.name = config.name;
    this.type = config.type;
    this.camera = camera;
    this.scene = scene;
    this.audio = audioManager;
    this.particles = particleSystem;

    // Stats
    this.damage = config.damage;
    this.headshotMultiplier = config.headshotMultiplier || 2.0;
    this.baseFireRate = config.fireRate;
    this.fireRate = config.fireRate; // delay in seconds
    this.fireRateMultiplier = 1.0;
    this.baseRecoilRecovery = config.recoilRecoverySpeed || 14.0;
    this.magazineSize = config.magazineSize;
    this.currentAmmo = config.magazineSize;
    this.reserveAmmo = config.reserveAmmo;
    this.reloadTime = config.reloadTime; // seconds
    this.range = config.range || 120;
    this.spread = config.spread || 0.015;
    this.pellets = config.pellets || 1;
    this.automatic = config.automatic || false;
    this.fireMode = config.fireMode || 'AUTO';

    // State
    this.canFire = true;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.isADS = false;

    // Offsets for Hipfire & ADS
    this.hipPos = config.hipPos || new THREE.Vector3(0.24, -0.22, -0.45);
    this.adsPos = config.adsPos || new THREE.Vector3(0.0, -0.165, -0.32);
    this.currentPos = this.hipPos.clone();

    // Recoil state
    this.recoilZ = 0;
    this.recoilRotX = 0;
    this.maxRecoilZ = config.maxRecoilZ || 0.07;
    this.maxRecoilRotX = config.maxRecoilRotX || 0.12;
    this.recoilRecoverySpeed = config.recoilRecoverySpeed || 14.0;

    // Sway state
    this.swayX = 0;
    this.swayY = 0;

    // Multi-Gun Wield State (1: Single, 2: Dual, 3: Tri)
    this.wieldMode = 1;
    this.leftGun = null;
    this.centerGun = null;
    this.leftMuzzleLight = null;
    this.centerMuzzleLight = null;

    // 3D Model Container
    this.root = new THREE.Group();
    this.mesh = this.buildModel();
    this.root.add(this.mesh);

    // Muzzle Flash Light (Right Gun)
    this.muzzleLight = new THREE.PointLight(config.muzzleColor || 0x00f3ff, 0, 10);
    this.muzzleLight.position.copy(config.muzzleOffset || new THREE.Vector3(0, 0.05, -0.6));
    this.root.add(this.muzzleLight);
    this.muzzleFlashTimer = 0;

    // Attach to camera
    this.camera.add(this.root);
    this.root.position.copy(this.hipPos);
    this.root.visible = false;
  }

  setWieldMode(mode) {
    if (this.wieldMode === mode && this.leftGun) return;
    this.wieldMode = mode;
    this.updateWieldModels();
  }

  updateWieldModels() {
    if (!this.mesh) return;

    // 2丁流用: 左手用武器モデルの生成 (X反転で左手構え)
    if (!this.leftGun) {
      this.leftGun = this.mesh.clone(true);
      this.leftGun.scale.set(-1, 1, 1);
      this.root.add(this.leftGun);

      this.leftMuzzleLight = new THREE.PointLight(this.muzzleLight.color, 0, 10);
      this.root.add(this.leftMuzzleLight);
    }

    // 3丁流用: 中央上部・浮遊量子マウント武器モデルの生成
    if (!this.centerGun) {
      this.centerGun = this.mesh.clone(true);
      this.centerGun.scale.set(0.88, 0.88, 0.88);
      this.root.add(this.centerGun);

      this.centerMuzzleLight = new THREE.PointLight(this.muzzleLight.color, 0, 10);
      this.root.add(this.centerMuzzleLight);
    }

    if (this.wieldMode === 2) {
      // === 2丁モード (DUAL WIELD) ===
      this.mesh.visible = true;
      this.leftGun.visible = true;
      this.centerGun.visible = false;

      // 左右にバランスよく2丁を構える (右: +0.22, 左: -0.22)
      this.mesh.position.set(0.22, 0, 0);
      this.leftGun.position.set(-0.22, 0, 0);

      const mOff = this.muzzleLight.position;
      if (this.leftMuzzleLight) {
        this.leftMuzzleLight.position.set(-0.22, mOff.y, mOff.z);
      }
    } else if (this.wieldMode >= 3) {
      // === 3丁モード (TRI WIELD) ===
      this.mesh.visible = true;
      this.leftGun.visible = true;
      this.centerGun.visible = true;

      // 左翼・中央上部・右翼の3丁展開 (左: -0.26, 中央: 0, 右: +0.26)
      this.leftGun.position.set(-0.26, -0.02, 0);
      this.mesh.position.set(0.26, -0.02, 0);
      this.centerGun.position.set(0.0, 0.08, -0.05);

      const mOff = this.muzzleLight.position;
      if (this.leftMuzzleLight) {
        this.leftMuzzleLight.position.set(-0.26, mOff.y, mOff.z);
      }
      if (this.centerMuzzleLight) {
        this.centerMuzzleLight.position.set(0.0, mOff.y + 0.08, mOff.z - 0.05);
      }
    } else {
      // === 通常1丁モード ===
      this.mesh.visible = true;
      this.mesh.position.set(0, 0, 0);
      if (this.leftGun) this.leftGun.visible = false;
      if (this.centerGun) this.centerGun.visible = false;
    }
  }

  buildModel() {
    // Override in subclass
    return new THREE.Group();
  }

  setActive(active) {
    this.root.visible = active;
    if (!active) {
      this.isADS = false;
      this.isReloading = false;
    }
  }

  setADS(isAiming) {
    this.isADS = isAiming;
  }

  setFireRateMultiplier(mult) {
    this.fireRateMultiplier = Math.max(0.1, mult);
    this.fireRate = this.baseFireRate / this.fireRateMultiplier;
    this.recoilRecoverySpeed = this.baseRecoilRecovery * Math.sqrt(this.fireRateMultiplier);
  }

  canShoot() {
    return this.canFire && !this.isReloading && this.fireCooldown <= 0 && this.currentAmmo > 0;
  }

  reload() {
    if (this.isReloading || this.currentAmmo === this.magazineSize || this.reserveAmmo <= 0) {
      return false;
    }
    this.isReloading = true;
    this.reloadTimer = this.reloadTime;
    this.audio.playReload();
    return true;
  }

  applySway(mouseDelta, walkBob) {
    // Sway from mouse delta
    this.swayX = THREE.MathUtils.lerp(this.swayX, -mouseDelta.dx * 0.4, 0.2);
    this.swayY = THREE.MathUtils.lerp(this.swayY, mouseDelta.dy * 0.4, 0.2);
  }

  update(delta, isWalking, walkTime, isSliding = false) {
    // Cooldowns
    if (this.fireCooldown > 0) {
      this.fireCooldown -= delta;
    }

    // Reload
    if (this.isReloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        const needed = this.magazineSize - this.currentAmmo;
        const available = Math.min(needed, this.reserveAmmo);
        this.currentAmmo += available;
        this.reserveAmmo -= available;
        this.isReloading = false;
      }
    }

    // Muzzle flash decay (全銃口の一括減衰)
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= delta;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleLight.intensity = 0;
        if (this.leftMuzzleLight) this.leftMuzzleLight.intensity = 0;
        if (this.centerMuzzleLight) this.centerMuzzleLight.intensity = 0;
      }
    }

    // Recoil recovery
    this.recoilZ = THREE.MathUtils.lerp(this.recoilZ, 0, delta * this.recoilRecoverySpeed);
    this.recoilRotX = THREE.MathUtils.lerp(this.recoilRotX, 0, delta * this.recoilRecoverySpeed);

    // 2丁・3丁流時の視点・構え位置の最適化
    // 1丁時は右腰構え、2丁/3丁時は画面中央を中心に左右対称に展開
    const baseWieldHipPos = (this.wieldMode >= 2)
      ? new THREE.Vector3(0.0, this.hipPos.y, this.hipPos.z)
      : this.hipPos;
    const targetPos = this.isADS ? this.adsPos : baseWieldHipPos;
    this.currentPos.lerp(targetPos, delta * 16);

    // ADS時の二丁集束 (照準時に左右の銃を中央へ引き締める)
    if (this.leftGun && this.mesh) {
      if (this.wieldMode === 2) {
        const targetSeparation = this.isADS ? 0.12 : 0.22;
        this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, targetSeparation, delta * 14);
        this.leftGun.position.x = THREE.MathUtils.lerp(this.leftGun.position.x, -targetSeparation, delta * 14);
      } else if (this.wieldMode >= 3) {
        const targetSeparation = this.isADS ? 0.15 : 0.26;
        this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, targetSeparation, delta * 14);
        this.leftGun.position.x = THREE.MathUtils.lerp(this.leftGun.position.x, -targetSeparation, delta * 14);
      }
    }

    // Weapon Bobbing & Breathing Sway (Idle / Walking / Sliding)
    let bobX = 0;
    let bobY = 0;
    let slideCant = 0;

    if (isSliding) {
      // スライディング時は銃を斜めに構えるタクティカルキャント姿勢
      slideCant = -0.18;
      bobY = -0.04;
    } else if (isWalking && !this.isADS) {
      bobX = Math.cos(walkTime * 8) * 0.012;
      bobY = Math.sin(walkTime * 16) * 0.015;
    } else if (!this.isADS) {
      // 立ち止まり時の自然な呼吸スウェイ (Breathing motion)
      bobY = Math.sin(walkTime * 2.2) * 0.003;
      bobX = Math.cos(walkTime * 1.1) * 0.002;
    }

    // Apply combined transform to weapon root
    this.root.position.x = this.currentPos.x + this.swayX + bobX;
    this.root.position.y = this.currentPos.y + this.swayY + bobY;
    this.root.position.z = this.currentPos.z + this.recoilZ;

    this.root.rotation.x = this.recoilRotX;
    this.root.rotation.y = this.swayX * 0.8;
    this.root.rotation.z = -this.swayX * 0.6 + slideCant;
  }

  triggerRecoil() {
    this.recoilZ = this.maxRecoilZ;
    this.recoilRotX = this.maxRecoilRotX;
    this.muzzleLight.intensity = 3.5;
    if (this.wieldMode >= 2 && this.leftMuzzleLight) this.leftMuzzleLight.intensity = 3.5;
    if (this.wieldMode >= 3 && this.centerMuzzleLight) this.centerMuzzleLight.intensity = 4.0;
    this.muzzleFlashTimer = 0.05;

    // Visual FX: 銃口の硝煙 ＆ 薬莢排出 (2丁・3丁流の全マズルから噴出)
    if (this.particles && this.camera) {
      const muzzleWorld = new THREE.Vector3();
      this.muzzleLight.getWorldPosition(muzzleWorld);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

      // 右銃マズルエフェクト
      this.particles.createMuzzleSmoke(muzzleWorld, forward);
      const chamberWorld = muzzleWorld.clone().addScaledVector(forward, -0.28).addScaledVector(right, 0.04);
      this.particles.createEjectedShell(chamberWorld, right);

      // 左銃マズルエフェクト (2丁流以上)
      if (this.wieldMode >= 2 && this.leftMuzzleLight) {
        const leftMuzzleWorld = new THREE.Vector3();
        this.leftMuzzleLight.getWorldPosition(leftMuzzleWorld);
        this.particles.createMuzzleSmoke(leftMuzzleWorld, forward);
        const leftChamberWorld = leftMuzzleWorld.clone().addScaledVector(forward, -0.28).addScaledVector(right, -0.04);
        const leftDir = right.clone().negate();
        this.particles.createEjectedShell(leftChamberWorld, leftDir);
      }

      // 中央マズルエフェクト (3丁流)
      if (this.wieldMode >= 3 && this.centerMuzzleLight) {
        const centerMuzzleWorld = new THREE.Vector3();
        this.centerMuzzleLight.getWorldPosition(centerMuzzleWorld);
        this.particles.createMuzzleSmoke(centerMuzzleWorld, forward);
      }
    }
  }
}
