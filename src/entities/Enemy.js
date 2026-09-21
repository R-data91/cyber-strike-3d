import * as THREE from 'three';
import { disposeHierarchy } from '../utils/dispose.js';

/**
 * Cyber AI Enemies & Bosses (Ver 4.0)
 * - 4 Distinct Normal Enemy Shapes:
 *   1. scout: 四足クモ型・俊足自爆/偵察ドローン (Spider Recon Drone)
 *   2. assault: 人型戦闘サイバー兵士 (Humanoid Cyber Trooper)
 *   3. heavy: 重装甲ゴリラ型ウォーブルート (Armored Heavy Brute Mech)
 *   4. seeker: 反重力浮遊UAVドローン (Hovering Anti-Grav Drone)
 * - 4 Distinct Raid Boss Shapes (5ステージごとのレイドボス):
 *   Tier 1 (Stage 5): 重装蜘蛛要塞 TITAN-ARACHNE (16,000 HP)
 *   Tier 2 (Stage 10): 反重力浮遊要塞 GOLIATH-LEVIATHAN (24,000 HP)
 *   Tier 3 (Stage 15): 殲滅巨神 COLOSSUS-PRIME (32,000 HP)
 *   Tier 4+ (Stage 20+): 終焉神官 APOCALYPSE-CORE (40,000 HP)
 */
const _scratchEnemyEye = new THREE.Vector3();
const _scratchPlayerEye = new THREE.Vector3();
const _scratchDir = new THREE.Vector3();
const _scratchRay = new THREE.Ray();
const _scratchHitPoint = new THREE.Vector3();

export class EnemyHumanoid {
  constructor(config, scene, audio, particles) {
    this.scene = scene;
    this.audio = audio;
    this.particles = particles;

    this.config = config || {};
    this.type = config.type || 'assault'; // 'scout' | 'assault' | 'heavy' | 'seeker'
    this.maxHealth = config.health || 100;
    this.health = this.maxHealth;
    this.speed = config.speed || 4.2;
    this.fireRate = config.fireRate || 2.0;
    this.fireTimer = Math.random() * this.fireRate;
    this.damage = config.damage || 12;
    this.scoreValue = config.score || 100;

    this.isDead = false;
    this.isDying = false;
    this.deathTimer = 0.6;
    this.position = config.position ? config.position.clone() : new THREE.Vector3(0, 0, 0);

    // Animation states
    this.walkCycle = Math.random() * Math.PI * 2;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 2.0;
    this.damageFlashTimer = 0;

    // Tactical Line-of-Sight AI States: 'ALERT' | 'INVESTIGATING' | 'PATROL'
    this.aiState = 'ALERT';
    this.hasLineOfSight = true;
    this.losTimer = Math.random() * 0.2;
    this.lastKnownPlayerPos = this.position.clone();
    this.investigateTimer = 0;
    this.patrolTimer = 2.0 + Math.random() * 3.0;
    this.patrolTarget = this.position.clone();

    // Build 3D Model based on type
    this.targetMeshes = [];
    this.mesh = this.buildModel();
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    // 3D Billboard Health Bar & Detection Badges
    this.createHealthBar();
    this.createStatusIndicator();
    this.updateIndicator('alert');
  }

  buildModel() {
    if (this.type === 'scout') {
      return this.buildScoutSpiderModel();
    } else if (this.type === 'heavy') {
      return this.buildHeavyBruteModel();
    } else if (this.type === 'seeker') {
      return this.buildSeekerDroneModel();
    } else {
      return this.buildAssaultHumanoidModel();
    }
  }

  // ==================== SHAPE 1: SCOUT (四足クモ型ドローン) ====================
  buildScoutSpiderModel() {
    const root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    root.add(this.bodyGroup);

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x182433,
      roughness: 0.35,
      metalness: 0.85,
    });
    this.armorMat = armorMat;

    const amberGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      blending: THREE.AdditiveBlending,
    });

    // 1. Central Spider Pod Chassis
    const podGeo = new THREE.CylinderGeometry(0.38, 0.46, 0.28, 8);
    const pod = new THREE.Mesh(podGeo, armorMat);
    pod.position.set(0, 0.55, 0);
    pod.castShadow = true;
    pod.userData.enemy = this;
    this.targetMeshes.push(pod);
    this.bodyGroup.add(pod);

    // 2. Head / Rotating Optical Turret (CRITICAL HEADSHOT)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.76, 0.1);
    this.bodyGroup.add(this.headGroup);

    const eyeGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const eye = new THREE.Mesh(eyeGeo, amberGlowMat);
    eye.userData.enemy = this;
    eye.userData.isCritical = true; // Critical eye hit
    this.targetMeshes.push(eye);
    this.headGroup.add(eye);

    // Twin Needle Stinger Cannons
    const stingerGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6);
    stingerGeo.rotateX(Math.PI / 2);
    const s1 = new THREE.Mesh(stingerGeo, armorMat);
    s1.position.set(-0.14, 0.54, 0.32);
    const s2 = new THREE.Mesh(stingerGeo, armorMat);
    s2.position.set(0.14, 0.54, 0.32);
    this.bodyGroup.add(s1, s2);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), amberGlowMat);
    muzzle.position.set(0, 0.54, 0.5);
    this.bodyGroup.add(muzzle);
    this.muzzleMesh = muzzle;

    // 3. 4 Quadruped Spider Legs
    this.spiderLegs = [];
    const legAngles = [Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.75, -Math.PI * 0.25];
    legAngles.forEach((angle, idx) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(Math.cos(angle) * 0.35, 0.55, Math.sin(angle) * 0.35);

      // Upper joint
      const upperGeo = new THREE.BoxGeometry(0.08, 0.36, 0.08);
      const upper = new THREE.Mesh(upperGeo, armorMat);
      upper.position.set(Math.cos(angle) * 0.18, 0.1, Math.sin(angle) * 0.18);
      upper.rotation.z = (idx % 2 === 0 ? -1 : 1) * 0.5;
      legGroup.add(upper);

      // Lower knee & claw
      const lowerGeo = new THREE.BoxGeometry(0.07, 0.44, 0.07);
      const lower = new THREE.Mesh(lowerGeo, armorMat);
      lower.position.set(Math.cos(angle) * 0.35, -0.2, Math.sin(angle) * 0.35);
      legGroup.add(lower);

      this.bodyGroup.add(legGroup);
      this.spiderLegs.push(legGroup);
    });

    root.scale.set(1.1, 1.1, 1.1);
    return root;
  }

  // ==================== SHAPE 2: ASSAULT (人型戦闘アンドロイド) ====================
  buildAssaultHumanoidModel() {
    const root = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x151d28,
      roughness: 0.35,
      metalness: 0.8,
    });
    this.armorMat = armorMat;

    const visorMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      blending: THREE.AdditiveBlending,
    });

    this.bodyGroup = new THREE.Group();
    root.add(this.bodyGroup);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.28), armorMat);
    torso.position.set(0, 1.25, 0);
    torso.castShadow = true;
    torso.userData.enemy = this;
    this.targetMeshes.push(torso);
    this.bodyGroup.add(torso);

    // Chest reactor
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), visorMat);
    core.geometry.rotateX(Math.PI / 2);
    core.position.set(0, 1.35, 0.02);
    this.bodyGroup.add(core);

    // Head / Visor (CRITICAL HEADSHOT)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.72, 0);
    this.bodyGroup.add(this.headGroup);

    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.3), armorMat);
    helmet.userData.enemy = this;
    helmet.userData.isCritical = true;
    this.targetMeshes.push(helmet);
    this.headGroup.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.09, 0.14), visorMat);
    visor.position.set(0, 0.02, 0.11);
    visor.userData.enemy = this;
    visor.userData.isCritical = true;
    this.targetMeshes.push(visor);
    this.headGroup.add(visor);

    // Arms & Held Rifle
    const armGeo = new THREE.BoxGeometry(0.14, 0.52, 0.14);
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.32, 1.48, 0);
    const rArmMesh = new THREE.Mesh(armGeo, armorMat);
    rArmMesh.position.set(0, -0.2, 0.12);
    rArmMesh.rotation.x = -Math.PI / 4;
    rArmMesh.userData.enemy = this;
    this.targetMeshes.push(rArmMesh);
    this.rightArm.add(rArmMesh);
    this.bodyGroup.add(this.rightArm);

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.32, 1.48, 0);
    const lArmMesh = new THREE.Mesh(armGeo, armorMat);
    lArmMesh.position.set(0.12, -0.2, 0.18);
    lArmMesh.rotation.x = -Math.PI / 4;
    lArmMesh.rotation.y = Math.PI / 6;
    lArmMesh.userData.enemy = this;
    this.targetMeshes.push(lArmMesh);
    this.leftArm.add(lArmMesh);
    this.bodyGroup.add(this.leftArm);

    // Rifle
    const rifleGroup = new THREE.Group();
    rifleGroup.position.set(0.16, 1.26, 0.35);
    const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.48), armorMat);
    rifleGroup.add(rBody);
    const rMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.06), visorMat);
    rMuzzle.position.set(0, 0.02, 0.5);
    rifleGroup.add(rMuzzle);
    this.muzzleMesh = rMuzzle;
    this.bodyGroup.add(rifleGroup);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.88, 0.18);
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.16, 0.92, 0);
    const lLegMesh = new THREE.Mesh(legGeo, armorMat);
    lLegMesh.position.set(0, -0.44, 0);
    lLegMesh.userData.enemy = this;
    this.targetMeshes.push(lLegMesh);
    this.leftLeg.add(lLegMesh);
    root.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.16, 0.92, 0);
    const rLegMesh = new THREE.Mesh(legGeo, armorMat);
    rLegMesh.position.set(0, -0.44, 0);
    rLegMesh.userData.enemy = this;
    this.targetMeshes.push(rLegMesh);
    this.rightLeg.add(rLegMesh);
    root.add(this.rightLeg);

    return root;
  }

  // ==================== SHAPE 3: HEAVY (重装甲ブルートメック) ====================
  buildHeavyBruteModel() {
    const root = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1f1416,
      roughness: 0.3,
      metalness: 0.9,
    });
    this.armorMat = armorMat;

    const redGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      blending: THREE.AdditiveBlending,
    });

    this.bodyGroup = new THREE.Group();
    root.add(this.bodyGroup);

    // Massive Chest & Reinforced Gorilla Pauldrons
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 0.45), armorMat);
    torso.position.set(0, 1.35, 0);
    torso.userData.enemy = this;
    this.targetMeshes.push(torso);
    this.bodyGroup.add(torso);

    // Dual Heavy Shoulder Shield Armor Pauldrons
    const pauldronGeo = new THREE.BoxGeometry(0.35, 0.4, 0.5);
    const lPaul = new THREE.Mesh(pauldronGeo, armorMat);
    lPaul.position.set(-0.55, 1.6, 0);
    const rPaul = new THREE.Mesh(pauldronGeo, armorMat);
    rPaul.position.set(0.55, 1.6, 0);
    this.bodyGroup.add(lPaul, rPaul);

    // Head Dome (CRITICAL TARGET)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.85, 0);
    this.bodyGroup.add(this.headGroup);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.36), armorMat);
    head.userData.enemy = this;
    head.userData.isCritical = true;
    this.targetMeshes.push(head);
    this.headGroup.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.16), redGlowMat);
    visor.position.set(0, 0.02, 0.14);
    visor.userData.enemy = this;
    visor.userData.isCritical = true;
    this.targetMeshes.push(visor);
    this.headGroup.add(visor);

    // Heavy Rotary Cannons on Both Forearms
    const cannonGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.7, 8);
    cannonGeo.rotateX(Math.PI / 2);
    const rCannon = new THREE.Mesh(cannonGeo, armorMat);
    rCannon.position.set(0.48, 1.15, 0.4);
    const lCannon = new THREE.Mesh(cannonGeo, armorMat);
    lCannon.position.set(-0.48, 1.15, 0.4);
    this.bodyGroup.add(rCannon, lCannon);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), redGlowMat);
    muzzle.position.set(0.48, 1.15, 0.8);
    this.bodyGroup.add(muzzle);
    this.muzzleMesh = muzzle;

    // Bulky Heavy Legs
    const legGeo = new THREE.BoxGeometry(0.3, 0.95, 0.3);
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.25, 0.95, 0);
    const lLegMesh = new THREE.Mesh(legGeo, armorMat);
    lLegMesh.position.set(0, -0.45, 0);
    lLegMesh.userData.enemy = this;
    this.targetMeshes.push(lLegMesh);
    this.leftLeg.add(lLegMesh);
    root.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.25, 0.95, 0);
    const rLegMesh = new THREE.Mesh(legGeo, armorMat);
    rLegMesh.position.set(0, -0.45, 0);
    rLegMesh.userData.enemy = this;
    this.targetMeshes.push(rLegMesh);
    this.rightLeg.add(rLegMesh);
    root.add(this.rightLeg);

    root.scale.set(1.25, 1.25, 1.25);
    return root;
  }

  // ==================== SHAPE 4: SEEKER (反重力浮遊UAVドローン) ====================
  buildSeekerDroneModel() {
    const root = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x121e2a,
      roughness: 0.25,
      metalness: 0.9,
    });
    this.armorMat = armorMat;

    const cyanGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      blending: THREE.AdditiveBlending,
    });

    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.y = 1.4; // Hovering high
    root.add(this.bodyGroup);

    // Floating Central Orb Chassis
    const orbGeo = new THREE.SphereGeometry(0.36, 12, 12);
    const orb = new THREE.Mesh(orbGeo, armorMat);
    orb.userData.enemy = this;
    this.targetMeshes.push(orb);
    this.bodyGroup.add(orb);

    // Glowing Equator Ring (CRITICAL TARGET)
    this.headGroup = new THREE.Group();
    this.bodyGroup.add(this.headGroup);
    const ringGeo = new THREE.TorusGeometry(0.42, 0.05, 8, 24);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, cyanGlowMat);
    ring.userData.enemy = this;
    ring.userData.isCritical = true;
    this.targetMeshes.push(ring);
    this.headGroup.add(ring);

    // Dual Ion Thruster Wings
    this.droneWings = [];
    [-0.55, 0.55].forEach(x => {
      const wingGeo = new THREE.BoxGeometry(0.4, 0.08, 0.3);
      const wing = new THREE.Mesh(wingGeo, armorMat);
      wing.position.set(x, 0, 0);
      this.bodyGroup.add(wing);
      this.droneWings.push(wing);

      const thrusterGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.25, 8);
      const thruster = new THREE.Mesh(thrusterGeo, cyanGlowMat);
      thruster.position.set(x > 0 ? x + 0.15 : x - 0.15, -0.1, 0);
      this.bodyGroup.add(thruster);
    });

    // Underslung Pulse Blaster Turret
    const turretGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
    turretGeo.rotateX(Math.PI / 2);
    const turret = new THREE.Mesh(turretGeo, armorMat);
    turret.position.set(0, -0.32, 0.18);
    this.bodyGroup.add(turret);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), cyanGlowMat);
    muzzle.position.set(0, -0.32, 0.38);
    this.bodyGroup.add(muzzle);
    this.muzzleMesh = muzzle;

    return root;
  }

  createHealthBar() {
    const width = 1.2;
    const height = 0.12;

    const bgGeo = new THREE.PlaneGeometry(width, height);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
    this.hpBg = new THREE.Mesh(bgGeo, bgMat);
    this.hpBg.position.set(0, 2.1, 0);
    this.hpBg.visible = false;
    this.mesh.add(this.hpBg);

    const fillGeo = new THREE.PlaneGeometry(width, height);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide });
    this.hpFill = new THREE.Mesh(fillGeo, fillMat);
    this.hpFill.position.set(0, 2.1, 0.01);
    this.hpFill.visible = false;
    this.mesh.add(this.hpFill);
    this._lastHpColorTier = 0;
  }

  createStatusIndicator() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    this.indicatorCanvas = canvas;
    this.indicatorCtx = canvas.getContext('2d');

    this.indicatorTexture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: this.indicatorTexture,
      transparent: true,
      depthTest: false,
    });
    this.indicatorSprite = new THREE.Sprite(mat);
    this.indicatorSprite.scale.set(0.9, 0.9, 1);
    this.indicatorSprite.position.set(0, 2.5, 0);
    this.indicatorSprite.visible = false;
    this.mesh.add(this.indicatorSprite);
  }

  updateIndicator(type) {
    if (!this.indicatorCtx) return;
    const ctx = this.indicatorCtx;
    ctx.clearRect(0, 0, 128, 128);

    if (type === 'none') {
      this.indicatorSprite.visible = false;
      return;
    }

    this.indicatorSprite.visible = true;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.fillStyle = type === 'alert' ? 'rgba(255, 0, 85, 0.85)' : 'rgba(255, 170, 0, 0.85)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type === 'alert' ? '!' : '?', 64, 66);

    this.indicatorTexture.needsUpdate = true;
  }

  updateHealthBar(camera) {
    if (!this.hpBg || !this.hpFill) return;
    // 満タンの敵（被弾していない敵）はヘルスバーを非表示にしてThree.js描画＆計算をスキップ
    if (!this.isBoss && this.health >= this.maxHealth) {
      if (this.hpBg.visible) {
        this.hpBg.visible = false;
        this.hpFill.visible = false;
      }
      return;
    }
    if (!this.hpBg.visible) {
      this.hpBg.visible = true;
      this.hpFill.visible = true;
    }

    // カメラクォータニオンの直接適用 (毎フレームの逆行列lookAt計算を廃止)
    this.hpBg.quaternion.copy(camera.quaternion);
    this.hpFill.quaternion.copy(camera.quaternion);

    const hpPct = Math.max(0, Math.min(1, this.health / this.maxHealth));
    this.hpFill.scale.x = hpPct;
    this.hpFill.position.x = -(1.2 * (1 - hpPct)) / 2;

    const colorTier = hpPct > 0.5 ? 1 : (hpPct > 0.25 ? 2 : 3);
    if (this._lastHpColorTier !== colorTier) {
      this._lastHpColorTier = colorTier;
      if (colorTier === 1) this.hpFill.material.color.setHex(0x00ff88);
      else if (colorTier === 2) this.hpFill.material.color.setHex(0xffaa00);
      else this.hpFill.material.color.setHex(0xff0044);
    }
  }

  takeDamage(amount, isCritical = false) {
    if (this.isDead || this.isDying) return false;

    const actualDmg = isCritical ? Math.round(amount * 1.5) : amount;
    this.health = Math.max(0, this.health - actualDmg);
    this.damageFlashTimer = 0.12;

    if (this.armorMat) {
      this.armorMat.color.setHex(0xffffff);
    }

    // 被弾時は即座にヘルスバーを表示
    if (this.hpBg) {
      this.hpBg.visible = true;
      this.hpFill.visible = true;
    }

    // Hit by player immediately puts enemy into ALERT state
    if (this.aiState !== 'ALERT') {
      this.aiState = 'ALERT';
      this.updateIndicator('alert');
    }

    if (this.health <= 0) {
      this.isDying = true;
      this.deathTimer = 0.4;
      return true;
    }

    return false;
  }

  checkLineOfSight(playerPos, colliders = []) {
    _scratchEnemyEye.set(this.mesh.position.x, this.mesh.position.y + 1.4, this.mesh.position.z);
    _scratchPlayerEye.set(playerPos.x, playerPos.y, playerPos.z);

    _scratchDir.subVectors(_scratchPlayerEye, _scratchEnemyEye);
    const dist = _scratchDir.length();
    if (dist < 0.1) return true;
    _scratchDir.normalize();

    _scratchRay.set(_scratchEnemyEye, _scratchDir);

    for (let i = 0; i < colliders.length; i++) {
      const col = colliders[i];
      if (!col.box) continue;
      // プレイヤーより遠方のコライダーは視線遮蔽判定をスキップ
      const box = col.box;
      const midX = (box.min.x + box.max.x) * 0.5;
      const midZ = (box.min.z + box.max.z) * 0.5;
      const distSq = (midX - _scratchEnemyEye.x) ** 2 + (midZ - _scratchEnemyEye.z) ** 2;
      if (distSq > (dist + 4) ** 2) continue;

      const hit = _scratchRay.intersectBox(box, _scratchHitPoint);
      if (hit) {
        const hitDist = _scratchEnemyEye.distanceTo(_scratchHitPoint);
        if (hitDist < dist - 0.5) {
          return false;
        }
      }
    }
    return true;
  }

  update(delta, playerPos, camera, projectilesList, colliders = []) {
    if (this.isDead) return;

    if (this.isDying) {
      this.deathTimer -= delta;
      this.mesh.position.y = Math.max(-0.5, this.mesh.position.y - delta * 2.0);
      this.mesh.rotation.x += delta * 2.5;
      if (this.deathTimer <= 0) {
        this.isDead = true;
        this.scene.remove(this.mesh);
        disposeHierarchy(this.mesh);
      }
      return;
    }

    // Flash reset
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= delta;
      if (this.damageFlashTimer <= 0 && this.armorMat) {
        this.armorMat.color.setHex(this.type === 'heavy' ? 0x1f1416 : (this.type === 'scout' ? 0x182433 : 0x151d28));
      }
    }

    // Line of Sight
    this.losTimer -= delta;
    if (this.losTimer <= 0) {
      this.losTimer = 0.15 + Math.random() * 0.1;
      this.hasLineOfSight = this.checkLineOfSight(playerPos, colliders);

      if (this.hasLineOfSight) {
        this.lastKnownPlayerPos.copy(playerPos);
        if (this.aiState !== 'ALERT') {
          this.aiState = 'ALERT';
          this.updateIndicator('alert');
        }
      } else {
        if (this.aiState === 'ALERT') {
          this.aiState = 'INVESTIGATING';
          this.investigateTimer = 3.5;
          this.updateIndicator('investigate');
        }
      }
    }

    // Movement & AI
    const distToPlayer = this.mesh.position.distanceTo(playerPos);
    let targetMovePos = null;
    let targetLookPos = null;
    let currentMoveSpeed = this.speed;
    let allowShoot = false;

    if (this.aiState === 'ALERT') {
      targetLookPos = playerPos.clone();
      allowShoot = true;

      const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
      toPlayer.y = 0;
      toPlayer.normalize();
      const rightDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);

      this.strafeTimer -= delta;
      if (this.strafeTimer <= 0) {
        this.strafeDir *= -1;
        this.strafeTimer = 1.6 + Math.random() * 2.0;
      }

      let moveVec = new THREE.Vector3();
      if (distToPlayer > 15) {
        moveVec.addScaledVector(toPlayer, 1.0);
      } else if (distToPlayer < 6) {
        moveVec.addScaledVector(toPlayer, -0.7);
      }
      moveVec.addScaledVector(rightDir, this.strafeDir * 0.5);

      if (moveVec.lengthSq() > 0.01) {
        moveVec.normalize();
        targetMovePos = this.mesh.position.clone().add(moveVec);
      }
    } else if (this.aiState === 'INVESTIGATING') {
      targetLookPos = this.lastKnownPlayerPos.clone();
      targetMovePos = this.lastKnownPlayerPos.clone();
      currentMoveSpeed = this.speed * 0.9;
      allowShoot = false;

      this.investigateTimer -= delta;
      const distToLastKnown = this.mesh.position.distanceTo(this.lastKnownPlayerPos);

      if (distToLastKnown < 2.0 || this.investigateTimer <= 0) {
        this.aiState = 'PATROL';
        this.updateIndicator('none');
        this.patrolTimer = 3.5 + Math.random() * 3.5;
        const pX = this.mesh.position.x + (Math.random() - 0.5) * 16;
        const pZ = this.mesh.position.z + (Math.random() - 0.5) * 16;
        const pDist = Math.hypot(pX, pZ);
        if (pDist > 42) {
          this.patrolTarget.set((pX / pDist) * 38, 0, (pZ / pDist) * 38);
        } else {
          this.patrolTarget.set(pX, 0, pZ);
        }
      }
    } else if (this.aiState === 'PATROL') {
      allowShoot = false;
      this.patrolTimer -= delta;

      const distToPatrol = this.mesh.position.distanceTo(this.patrolTarget);
      if (distToPatrol > 1.2) {
        targetLookPos = this.patrolTarget.clone();
        targetMovePos = this.patrolTarget.clone();
        currentMoveSpeed = this.speed * 0.42;
      } else {
        if (this.patrolTimer <= 0) {
          this.patrolTimer = 3.5 + Math.random() * 3.0;
          const nX = this.mesh.position.x + (Math.random() - 0.5) * 14;
          const nZ = this.mesh.position.z + (Math.random() - 0.5) * 14;
          const nDist = Math.hypot(nX, nZ);
          if (nDist > 42) {
            this.patrolTarget.set((nX / nDist) * 38, 0, (nZ / nDist) * 38);
          } else {
            this.patrolTarget.set(nX, 0, nZ);
          }
        }
      }
    }

    if (targetLookPos) {
      targetLookPos.y = this.mesh.position.y;
      this.mesh.lookAt(targetLookPos);
    }

    let isMoving = false;
    if (targetMovePos) {
      const moveDir = new THREE.Vector3().subVectors(targetMovePos, this.mesh.position);
      moveDir.y = 0;
      if (moveDir.lengthSq() > 0.05) {
        moveDir.normalize();
        let nextX = this.mesh.position.x + moveDir.x * currentMoveSpeed * delta;
        let nextZ = this.mesh.position.z + moveDir.z * currentMoveSpeed * delta;
        const enemyRadius = this.isBoss ? 2.2 : (this.type === 'heavy' ? 1.0 : 0.65);

        // 障害物コライダーとの衝突・押し出し判定 (壁埋まり防止)
        if (Array.isArray(colliders)) {
          for (const item of colliders) {
            const box = item.box;
            if (box.max.y <= 0.3) continue; // 地面は除外

            if (
              nextX + enemyRadius > box.min.x &&
              nextX - enemyRadius < box.max.x &&
              nextZ + enemyRadius > box.min.z &&
              nextZ - enemyRadius < box.max.z
            ) {
              const overlapL = (nextX + enemyRadius) - box.min.x;
              const overlapR = box.max.x - (nextX - enemyRadius);
              const overlapT = (nextZ + enemyRadius) - box.min.z;
              const overlapB = box.max.z - (nextZ - enemyRadius);

              const minOverlapX = Math.min(overlapL, overlapR);
              const minOverlapZ = Math.min(overlapT, overlapB);

              if (minOverlapX < minOverlapZ) {
                nextX = (overlapL < overlapR) ? box.min.x - enemyRadius : box.max.x + enemyRadius;
              } else {
                nextZ = (overlapT < overlapB) ? box.min.z - enemyRadius : box.max.z + enemyRadius;
              }
            }
          }
        }

        this.mesh.position.x = nextX;
        this.mesh.position.z = nextZ;
        isMoving = true;
      }
    }

    if (isNaN(this.mesh.position.x) || isNaN(this.mesh.position.y) || isNaN(this.mesh.position.z)) {
      this.mesh.position.set(0, 0, 0);
    }
    this.position.copy(this.mesh.position);

    // Animation updates per shape
    this.walkCycle += delta * currentMoveSpeed * 2.2;
    if (this.leftLeg && this.rightLeg) {
      if (isMoving) {
        this.leftLeg.rotation.x = Math.sin(this.walkCycle) * 0.55;
        this.rightLeg.rotation.x = -Math.sin(this.walkCycle) * 0.55;
        this.bodyGroup.position.y = Math.abs(Math.sin(this.walkCycle * 2)) * 0.06;
      } else {
        this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 8);
        this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 8);
        this.bodyGroup.position.y = 0;
      }
    } else if (this.spiderLegs) {
      // Quadruped spider scamper
      this.spiderLegs.forEach((leg, idx) => {
        const offset = (idx % 2 === 0 ? 0 : Math.PI);
        leg.rotation.z = Math.sin(this.walkCycle * 2 + offset) * (isMoving ? 0.35 : 0.05);
      });
      this.bodyGroup.position.y = Math.sin(this.walkCycle * 4) * 0.04;
    } else if (this.droneWings) {
      // Hovering bob
      this.bodyGroup.position.y = 1.4 + Math.sin(this.walkCycle * 1.5) * 0.12;
      this.bodyGroup.rotation.z = Math.sin(this.walkCycle) * 0.08;
    }

    // Keep within bounds
    const maxRadius = 46.5;
    const curRad = Math.hypot(this.mesh.position.x, this.mesh.position.z);
    if (curRad > maxRadius) {
      this.mesh.position.x = (this.mesh.position.x / curRad) * maxRadius;
      this.mesh.position.z = (this.mesh.position.z / curRad) * maxRadius;
    }
    this.position.copy(this.mesh.position);

    // Shooting
    this.fireTimer -= delta;
    if (allowShoot && this.fireTimer <= 0 && distToPlayer < 44) {
      this.shootAtPlayer(playerPos, projectilesList);
      this.fireTimer = this.fireRate * (0.8 + Math.random() * 0.4);
    }

    this.updateHealthBar(camera);
  }

  shootAtPlayer(playerPos, projectilesList) {
    if (!this.muzzleMesh) return;
    const muzzleWorld = new THREE.Vector3();
    this.muzzleMesh.getWorldPosition(muzzleWorld);

    const aimTarget = playerPos.clone().add(new THREE.Vector3(0, 0.4, 0));
    aimTarget.x += (Math.random() - 0.5) * 1.0;
    aimTarget.y += (Math.random() - 0.5) * 0.8;
    aimTarget.z += (Math.random() - 0.5) * 1.0;

    const dir = new THREE.Vector3().subVectors(aimTarget, muzzleWorld).normalize();

    const geo = new THREE.SphereGeometry(0.16, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: this.type === 'heavy' ? 0xff0044 : (this.type === 'scout' ? 0xffaa00 : 0x00f3ff),
      blending: THREE.AdditiveBlending,
    });
    const projMesh = new THREE.Mesh(geo, mat);
    projMesh.position.copy(muzzleWorld);
    this.scene.add(projMesh);

    projectilesList.push({
      mesh: projMesh,
      position: muzzleWorld.clone(),
      velocity: dir.multiplyScalar(24.0),
      damage: this.damage,
      life: 3.5,
    });

    this.audio.playEnemyLaser(this.mesh.position.distanceTo(playerPos));
  }
}

/**
 * Raid Boss AI: 4 Distinct Boss Visuals & Tier Mechanics (Ver 4.0)
 * - Tier 1 (Stage 5): 重装蜘蛛要塞 TITAN-ARACHNE (16,000 HP)
 * - Tier 2 (Stage 10): 反重力浮遊要塞 GOLIATH-LEVIATHAN (24,000 HP)
 * - Tier 3 (Stage 15): 殲滅巨神 COLOSSUS-PRIME (32,000 HP)
 * - Tier 4+ (Stage 20+): 終焉神官 APOCALYPSE-CORE (40,000 HP)
 */
export class EnemyBoss extends EnemyHumanoid {
  constructor(config, scene, audio, particles) {
    const bossTier = config.bossTier || 1;
    const computedShape = config.bossShape || (
      bossTier === 1 ? 'arachne' :
      bossTier === 2 ? 'leviathan' :
      bossTier === 3 ? 'colossus' :
      bossTier === 5 ? 'seraph' : 'apocalypse'
    );
    super({
      ...config,
      bossShape: computedShape,
      type: 'heavy',
      health: config.health || (16000 * Math.pow(3, bossTier - 1)),
      damage: config.damage || (30 + (bossTier - 1) * 10),
      score: config.score || (15000 * Math.pow(2, bossTier - 1)),
      speed: config.speed || 3.0,
      fireRate: config.fireRate || 0.9,
    }, scene, audio, particles);

    this.isBoss = true;
    this.bossTier = bossTier;
    this.bossShape = computedShape;
    this.name = config.name || '機動要塞 TITAN';
    this.missileCooldown = 6.0;
    this.missileTimer = 3.0;
    this.altBarrel = false;
    this.deathTimer = 2.4;
    this.deathExplosionTimer = 0.2;
    if (!this.wingMeshes) this.wingMeshes = [];

    if (this.hpBg && this.hpFill) {
      this.hpBg.scale.set(2.4, 2.0, 1);
      this.hpBg.position.y = 5.6;
      this.hpFill.scale.set(2.4, 2.0, 1);
      this.hpFill.position.y = 5.6;
    }

    // EX 3-Phase Transformation & Gimmick States (OMEGA-SERAPH)
    this.isSeraph = (computedShape === 'seraph');
    this.currentPhase = 1;
    this.maxPhase = this.isSeraph ? 3 : 1;
    this.stunTimer = 0;
    this.spiralTimer = 3.5;
    this.gravityTimer = 6.0;
    this.sentinelBits = [];
    this.onPhaseAnnouncement = null;

    if (this.isSeraph && this.sentinelBits.length > 0) {
      const bitHp = Math.round(this.maxHealth * 0.10);
      this.sentinelBits.forEach(b => {
        b.health = bitHp;
        b.maxHealth = bitHp;
      });
    }
  }

  buildModel() {
    const shape = this.config?.bossShape || this.bossShape || 'arachne';
    this.bossShape = shape;
    if (shape === 'arachne') {
      return this.buildTitanArachneModel();
    } else if (shape === 'leviathan') {
      return this.buildGoliathLeviathanModel();
    } else if (shape === 'colossus') {
      return this.buildColossusPrimeModel();
    } else if (shape === 'seraph') {
      return this.buildOmegaSeraphModel();
    } else {
      return this.buildApocalypseCoreModel();
    }
  }

  // ==================== BOSS TIER 1: TITAN-ARACHNE (重装蜘蛛要塞) ====================
  buildTitanArachneModel() {
    const root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    root.add(this.bodyGroup);

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x0e080b,
      metalness: 0.92,
      roughness: 0.25,
    });
    this.armorMat = armorMat;

    const crimsonMat = new THREE.MeshBasicMaterial({
      color: 0xff1100,
      blending: THREE.AdditiveBlending,
    });

    // Central Citadel Bunker Hull (4.0m wide)
    const hullGeo = new THREE.BoxGeometry(3.2, 1.8, 3.8);
    const hull = new THREE.Mesh(hullGeo, armorMat);
    hull.position.set(0, 2.4, 0);
    hull.castShadow = true;
    hull.userData.enemy = this;
    this.targetMeshes.push(hull);
    this.bodyGroup.add(hull);

    // Rotating Radar Dish & Command Dome (CRITICAL HEADSHOT)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 3.5, 0.4);
    this.bodyGroup.add(this.headGroup);

    const domeGeo = new THREE.SphereGeometry(0.85, 12, 12);
    const dome = new THREE.Mesh(domeGeo, crimsonMat);
    dome.userData.enemy = this;
    dome.userData.isCritical = true;
    this.targetMeshes.push(dome);
    this.headGroup.add(dome);

    // Twin Missile Pods (Shoulders)
    const podGeo = new THREE.BoxGeometry(0.9, 0.7, 1.4);
    this.leftPod = new THREE.Mesh(podGeo, armorMat);
    this.leftPod.position.set(-2.0, 3.0, 0);
    this.rightPod = new THREE.Mesh(podGeo, armorMat);
    this.rightPod.position.set(2.0, 3.0, 0);
    this.bodyGroup.add(this.leftPod, this.rightPod);

    // Dual Heavy Rotary Gatlings
    const lGat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.8, 8), armorMat);
    lGat.geometry.rotateX(Math.PI / 2);
    lGat.position.set(-1.2, 1.9, 2.2);
    const rGat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.8, 8), armorMat);
    rGat.geometry.rotateX(Math.PI / 2);
    rGat.position.set(1.2, 1.9, 2.2);
    this.bodyGroup.add(lGat, rGat);

    this.muzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), crimsonMat);
    this.muzzleMesh.position.set(1.2, 1.9, 3.1);
    this.leftMuzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), crimsonMat);
    this.leftMuzzleMesh.position.set(-1.2, 1.9, 3.1);
    this.bodyGroup.add(this.muzzleMesh, this.leftMuzzleMesh);

    // 4 Giant Heavy Crawler Hydraulic Legs
    this.bossCrawlerLegs = [];
    [
      [-2.4, 0, 2.0], [2.4, 0, 2.0],
      [-2.4, 0, -2.0], [2.4, 0, -2.0],
    ].forEach(([lx, ly, lz]) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(lx, 2.0, lz);

      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.8, 0.45), armorMat);
      upper.position.set(lx > 0 ? 0.6 : -0.6, 0.4, 0);
      legGroup.add(upper);

      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), armorMat);
      lower.position.set(lx > 0 ? 1.1 : -1.1, -1.0, 0);
      legGroup.add(lower);

      this.bodyGroup.add(legGroup);
      this.bossCrawlerLegs.push(legGroup);
    });

    root.scale.set(1.3, 1.3, 1.3);
    return root;
  }

  // ==================== BOSS TIER 2: GOLIATH-LEVIATHAN (反重力浮遊要塞) ====================
  buildGoliathLeviathanModel() {
    const root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.y = 2.4; // Hovering high in air
    root.add(this.bodyGroup);

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x081320,
      metalness: 0.95,
      roughness: 0.2,
    });
    this.armorMat = armorMat;

    const cyanGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      blending: THREE.AdditiveBlending,
    });

    // Arrowhead Stealth Dreadnought Fuselage
    const hullGeo = new THREE.ConeGeometry(2.4, 6.2, 4);
    hullGeo.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, armorMat);
    hull.userData.enemy = this;
    this.targetMeshes.push(hull);
    this.bodyGroup.add(hull);

    // Bridge Command Dome (CRITICAL HEADSHOT)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.8, -0.4);
    this.bodyGroup.add(this.headGroup);

    const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 10), cyanGlowMat);
    bridge.userData.enemy = this;
    bridge.userData.isCritical = true;
    this.targetMeshes.push(bridge);
    this.headGroup.add(bridge);

    // 4 Plasma Hover Engines
    this.hoverPods = [];
    [
      [-2.2, -0.4, 1.5], [2.2, -0.4, 1.5],
      [-2.2, -0.4, -1.5], [2.2, -0.4, -1.5],
    ].forEach(([px, py, pz]) => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8), cyanGlowMat);
      pod.position.set(px, py, pz);
      this.bodyGroup.add(pod);
      this.hoverPods.push(pod);
    });

    // Dorsal Missile Launchers
    const podGeo = new THREE.BoxGeometry(0.8, 0.6, 1.2);
    this.leftPod = new THREE.Mesh(podGeo, armorMat);
    this.leftPod.position.set(-1.4, 0.6, 0.5);
    this.rightPod = new THREE.Mesh(podGeo, armorMat);
    this.rightPod.position.set(1.4, 0.6, 0.5);
    this.bodyGroup.add(this.leftPod, this.rightPod);

    // Prow Heavy Plasma Battery
    this.muzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), cyanGlowMat);
    this.muzzleMesh.position.set(0.6, 0, 3.4);
    this.leftMuzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), cyanGlowMat);
    this.leftMuzzleMesh.position.set(-0.6, 0, 3.4);
    this.bodyGroup.add(this.muzzleMesh, this.leftMuzzleMesh);

    root.scale.set(1.4, 1.4, 1.4);
    return root;
  }

  // ==================== BOSS TIER 3: COLOSSUS-PRIME (殲滅巨神ウォーメック) ====================
  buildColossusPrimeModel() {
    const root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    root.add(this.bodyGroup);

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x140d12,
      metalness: 0.94,
      roughness: 0.22,
    });
    this.armorMat = armorMat;

    const goldGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      blending: THREE.AdditiveBlending,
    });

    // 6.5m Imposing Colossus Chassis
    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 1.4), armorMat);
    torso.position.set(0, 3.6, 0);
    torso.userData.enemy = this;
    this.targetMeshes.push(torso);
    this.bodyGroup.add(torso);

    // Rotating Arc Reactor in Chest
    const reactor = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 24), goldGlowMat);
    reactor.position.set(0, 3.7, 0.72);
    this.bodyGroup.add(reactor);
    this.reactorRing = reactor;

    // Giant Fortress Head Crest (CRITICAL HEADSHOT)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 5.0, 0);
    this.bodyGroup.add(this.headGroup);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), armorMat);
    head.userData.enemy = this;
    head.userData.isCritical = true;
    this.targetMeshes.push(head);
    this.headGroup.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.4), goldGlowMat);
    visor.position.set(0, 0.1, 0.35);
    visor.userData.enemy = this;
    visor.userData.isCritical = true;
    this.targetMeshes.push(visor);
    this.headGroup.add(visor);

    // Shoulder Shield Towers & Missile Pods
    const podGeo = new THREE.BoxGeometry(1.1, 0.9, 1.8);
    this.leftPod = new THREE.Mesh(podGeo, armorMat);
    this.leftPod.position.set(-2.2, 4.8, 0);
    this.rightPod = new THREE.Mesh(podGeo, armorMat);
    this.rightPod.position.set(2.2, 4.8, 0);
    this.bodyGroup.add(this.leftPod, this.rightPod);

    // Heavy Dual Forearm Beam Cannons
    this.muzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), goldGlowMat);
    this.muzzleMesh.position.set(1.9, 3.0, 2.0);
    this.leftMuzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), goldGlowMat);
    this.leftMuzzleMesh.position.set(-1.9, 3.0, 2.0);
    this.bodyGroup.add(this.muzzleMesh, this.leftMuzzleMesh);

    // Massive Hydraulic Biped Legs
    const legGeo = new THREE.BoxGeometry(0.8, 2.4, 0.8);
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.8, 2.4, 0);
    const lLegMesh = new THREE.Mesh(legGeo, armorMat);
    lLegMesh.position.set(0, -1.2, 0);
    lLegMesh.userData.enemy = this;
    this.targetMeshes.push(lLegMesh);
    this.leftLeg.add(lLegMesh);
    root.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.8, 2.4, 0);
    const rLegMesh = new THREE.Mesh(legGeo, armorMat);
    rLegMesh.position.set(0, -1.2, 0);
    rLegMesh.userData.enemy = this;
    this.targetMeshes.push(rLegMesh);
    this.rightLeg.add(rLegMesh);
    root.add(this.rightLeg);

    return root;
  }

  // ==================== BOSS TIER 4+: APOCALYPSE-CORE (終焉神官コア) ====================
  buildApocalypseCoreModel() {
    const root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.y = 3.2; // Hovering entity
    root.add(this.bodyGroup);

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x050408,
      metalness: 0.98,
      roughness: 0.1,
    });
    this.armorMat = darkMat;

    const violetGlowMat = new THREE.MeshBasicMaterial({
      color: 0xd446ff,
      blending: THREE.AdditiveBlending,
    });

    // Dark Matter Singularity Sphere (CRITICAL HEADSHOT)
    this.headGroup = new THREE.Group();
    this.bodyGroup.add(this.headGroup);

    const core = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 16), violetGlowMat);
    core.userData.enemy = this;
    core.userData.isCritical = true;
    this.targetMeshes.push(core);
    this.headGroup.add(core);

    // 3 Triple Concentric Gyroscopic Rings
    this.gyroRings = [];
    [2.3, 3.0, 3.7].forEach((r, idx) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 8, 32), darkMat);
      ring.rotation.x = idx * 0.7;
      ring.rotation.y = idx * 0.5;
      this.bodyGroup.add(ring);
      this.gyroRings.push(ring);
    });

    // Floating Quantum Missile Conduits
    const podGeo = new THREE.BoxGeometry(0.8, 0.8, 1.2);
    this.leftPod = new THREE.Mesh(podGeo, violetGlowMat);
    this.leftPod.position.set(-3.2, 0.6, 0);
    this.rightPod = new THREE.Mesh(podGeo, violetGlowMat);
    this.rightPod.position.set(3.2, 0.6, 0);
    this.bodyGroup.add(this.leftPod, this.rightPod);

    this.muzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), violetGlowMat);
    this.muzzleMesh.position.set(0, -0.6, 2.4);
    this.leftMuzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), violetGlowMat);
    this.leftMuzzleMesh.position.set(0, 0.6, 2.4);
    this.bodyGroup.add(this.muzzleMesh, this.leftMuzzleMesh);

    return root;
  }

  // ==================== BOSS TIER 5: OMEGA-SERAPH (終焉天核・熾天使要塞) ====================
  buildOmegaSeraphModel() {
    const root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.y = 3.6; // High hovering celestial entity
    root.add(this.bodyGroup);

    const goldCoreMat = new THREE.MeshStandardMaterial({
      color: 0x332800,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0xffd700,
      emissiveIntensity: 0.8,
    });
    const whiteHullMat = new THREE.MeshStandardMaterial({
      color: 0xf0f5ff,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.2,
    });
    const cyanPhotonMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const goldPhotonMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // Central Divine Singularity Core (CRITICAL HEADSHOT TARGET)
    this.headGroup = new THREE.Group();
    this.bodyGroup.add(this.headGroup);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), goldCoreMat);
    core.userData.enemy = this;
    core.userData.isCritical = true;
    this.targetMeshes.push(core);
    this.headGroup.add(core);

    const innerSphere = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 16), goldPhotonMat);
    innerSphere.userData.enemy = this;
    innerSphere.userData.isCritical = true;
    this.targetMeshes.push(innerSphere);
    this.headGroup.add(innerSphere);

    // 6 Angelic Cyber Photon Wings (3 pairs)
    this.wingMeshes = [];
    const wingConfigs = [
      { y: 0.8, span: 3.8, angle: 0.45, mat: cyanPhotonMat },
      { y: 0.0, span: 4.8, angle: 0.15, mat: goldPhotonMat },
      { y: -0.8, span: 3.2, angle: -0.35, mat: cyanPhotonMat },
    ];
    wingConfigs.forEach((cfg) => {
      // Left Wing
      const lWingGeo = new THREE.PlaneGeometry(cfg.span, 1.1);
      lWingGeo.translate(-cfg.span / 2, 0, 0);
      const lWing = new THREE.Mesh(lWingGeo, cfg.mat);
      lWing.position.set(-1.2, cfg.y, -0.4);
      lWing.rotation.z = cfg.angle;
      lWing.userData.baseZ = cfg.angle;
      this.bodyGroup.add(lWing);
      this.wingMeshes.push(lWing);

      // Right Wing
      const rWingGeo = new THREE.PlaneGeometry(cfg.span, 1.1);
      rWingGeo.translate(cfg.span / 2, 0, 0);
      const rWing = new THREE.Mesh(rWingGeo, cfg.mat);
      rWing.position.set(1.2, cfg.y, -0.4);
      rWing.rotation.z = -cfg.angle;
      rWing.userData.baseZ = -cfg.angle;
      this.bodyGroup.add(rWing);
      this.wingMeshes.push(rWing);
    });

    // Spinning Celestial Halo
    this.gyroRings = [];
    const halo1 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.08, 8, 32), goldPhotonMat);
    halo1.rotation.x = Math.PI * 0.4;
    this.bodyGroup.add(halo1);
    this.gyroRings.push(halo1);

    const halo2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.06, 8, 28), cyanPhotonMat);
    halo2.rotation.y = Math.PI * 0.3;
    this.bodyGroup.add(halo2);
    this.gyroRings.push(halo2);

    // Missile Battery Pods
    const podGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.6, 8);
    this.leftPod = new THREE.Mesh(podGeo, whiteHullMat);
    this.leftPod.position.set(-2.8, 0.4, 0);
    this.leftPod.rotation.x = Math.PI / 2;
    this.rightPod = new THREE.Mesh(podGeo, whiteHullMat);
    this.rightPod.position.set(2.8, 0.4, 0);
    this.rightPod.rotation.x = Math.PI / 2;
    this.bodyGroup.add(this.leftPod, this.rightPod);

    // Dual Forward Laser Cannons
    this.muzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.4), goldPhotonMat);
    this.muzzleMesh.position.set(1.2, -0.6, 1.8);
    this.leftMuzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.4), goldPhotonMat);
    this.leftMuzzleMesh.position.set(-1.2, -0.6, 1.8);
    this.bodyGroup.add(this.muzzleMesh, this.leftMuzzleMesh);

    // ==================== EX BOSS GIMMICK: CELESTIAL BARRIER & SENTINEL BITS ====================
    const barrierGeo = new THREE.SphereGeometry(3.6, 16, 16);
    const barrierMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    this.barrierShieldMesh = new THREE.Mesh(barrierGeo, barrierMat);
    this.bodyGroup.add(this.barrierShieldMesh);

    // 2 Orbiting Sentinel Aegis Bits (Phase 1 Gimmick)
    this.sentinelBits = [];
    [-1, 1].forEach((side, idx) => {
      const bitGroup = new THREE.Group();
      const bitCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), goldCoreMat);
      bitCore.userData.enemy = this;
      bitCore.userData.isShieldBit = true;
      bitCore.userData.bitIndex = idx;
      this.targetMeshes.push(bitCore);
      bitGroup.add(bitCore);

      const bitHalo = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 20), cyanPhotonMat);
      bitHalo.rotation.x = Math.PI / 2;
      bitGroup.add(bitHalo);

      this.bodyGroup.add(bitGroup);
      this.sentinelBits.push({
        mesh: bitGroup,
        side: side,
        angle: idx * Math.PI,
        health: 2000,
        maxHealth: 2000,
        isDead: false,
      });
    });

    return root;
  }

  shootAtPlayer(playerPos, projectilesList) {
    this.altBarrel = !this.altBarrel;
    const targetMuzzle = (this.altBarrel && this.leftMuzzleMesh) ? this.leftMuzzleMesh : this.muzzleMesh;
    if (!targetMuzzle) return;

    const muzzleWorld = new THREE.Vector3();
    targetMuzzle.getWorldPosition(muzzleWorld);

    const aimTarget = playerPos.clone().add(new THREE.Vector3(0, 0.5, 0));
    aimTarget.x += (Math.random() - 0.5) * 1.2;
    aimTarget.y += (Math.random() - 0.5) * 0.9;
    aimTarget.z += (Math.random() - 0.5) * 1.2;

    const dir = new THREE.Vector3().subVectors(aimTarget, muzzleWorld).normalize();

    const beamColor = this.bossShape === 'seraph' ? 0xffea00 :
      (this.bossTier === 2 || this.bossShape === 'leviathan' ? 0x00f3ff :
      (this.bossTier >= 4 || this.bossShape === 'apocalypse' ? 0xd446ff : 0xff1100));

    const geo = new THREE.SphereGeometry(0.24, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: beamColor,
      blending: THREE.AdditiveBlending,
    });
    const projMesh = new THREE.Mesh(geo, mat);
    projMesh.position.copy(muzzleWorld);
    this.scene.add(projMesh);

    projectilesList.push({
      mesh: projMesh,
      position: muzzleWorld.clone(),
      velocity: dir.multiplyScalar(24.0),
      damage: this.damage,
      life: 4.0,
      isHeavyLaser: true,
    });

    this.audio.playEnemyLaser(this.mesh.position.distanceTo(playerPos));
  }

  launchMissiles(playerPos, projectilesList) {
    if (!this.leftPod || !this.rightPod) return;
    this.audio.playBossMissile();

    [this.leftPod, this.rightPod].forEach((pod, idx) => {
      const spawnWorld = new THREE.Vector3();
      pod.getWorldPosition(spawnWorld);
      spawnWorld.y += 0.2;

      const missileGroup = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x220505, metalness: 0.9, roughness: 0.2 })
      );
      body.rotation.x = Math.PI / 2;
      missileGroup.add(body);

      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.28, 8),
        new THREE.MeshBasicMaterial({ color: 0xff4400 })
      );
      nose.rotation.x = -Math.PI / 2;
      nose.position.z = 0.44;
      missileGroup.add(nose);

      missileGroup.position.copy(spawnWorld);
      this.scene.add(missileGroup);

      const toPlayer = new THREE.Vector3().subVectors(playerPos, spawnWorld).normalize();
      const spreadX = (idx === 0 ? -1 : 1) * 3.5;
      const initialVelocity = toPlayer.clone().multiplyScalar(16.0).add(new THREE.Vector3(spreadX, 5.0, 0));

      projectilesList.push({
        mesh: missileGroup,
        position: spawnWorld.clone(),
        velocity: initialVelocity,
        targetPlayer: true,
        damage: Math.round(this.damage * 1.5),
        isRocket: true,
        life: 5.0,
        blastRadius: 5.5,
      });
    });
  }

  takeDamage(amount, isCritical = false, hitMesh = null) {
    if (this.isDead || this.isDying) return false;

    // Phase 1 Gimmick: Hit on Sentinel Aegis Bit
    if (this.isSeraph && this.currentPhase === 1 && hitMesh?.userData?.isShieldBit) {
      const bitIdx = hitMesh.userData.bitIndex;
      const bit = this.sentinelBits ? this.sentinelBits[bitIdx] : null;
      if (bit && !bit.isDead) {
        const actualDmg = isCritical ? Math.round(amount * 1.5) : amount;
        bit.health -= actualDmg;
        const sparkPos = new THREE.Vector3();
        hitMesh.getWorldPosition(sparkPos);
        if (!isNaN(sparkPos.x)) {
          this.particles.createImpactSparks(sparkPos, new THREE.Vector3(0, 1, 0), 0x00f3ff, 14);
        }

        if (bit.health <= 0) {
          bit.isDead = true;
          bit.mesh.visible = false;
          this.particles.createBlastExplosion(sparkPos, 0x00f3ff, 1.8);
          this.audio.playExplosion(10);

          const remainingBits = this.sentinelBits.filter(b => !b.isDead).length;
          if (remainingBits === 0) {
            if (this.barrierShieldMesh) this.barrierShieldMesh.visible = false;
            this.stunTimer = 4.5;
            this.audio.playShieldBreak();
            if (this.onPhaseAnnouncement) {
              this.onPhaseAnnouncement('⚡【天界防壁崩壊！】全ビット撃滅！ ボスが一時気絶・弱体化 (被ダメージ200%)！', 3800);
            }
          } else {
            if (this.onPhaseAnnouncement) {
              this.onPhaseAnnouncement(`⚠️【防壁ビット1基撃破】残存ビット: ${remainingBits}基！`, 2200);
            }
          }
        }
        return false;
      }
    }

    let actualDmg = isCritical ? Math.round(amount * 1.5) : amount;

    // Seraph Phase 1: If barrier active, damage is reduced by 85%
    if (this.isSeraph && this.currentPhase === 1 && this.sentinelBits && this.sentinelBits.some(b => !b.isDead)) {
      actualDmg = Math.round(actualDmg * 0.15);
      this.particles.createImpactSparks(this.mesh.position, new THREE.Vector3(0, 1, 0), 0x00f3ff, 6);
    }

    // Stun vulnerability window (200% damage)
    if (this.stunTimer > 0) {
      actualDmg = Math.round(actualDmg * 2.0);
    }

    this.health = Math.max(0, this.health - actualDmg);
    this.damageFlashTimer = 0.12;

    if (this.armorMat) {
      this.armorMat.color.setHex(0xffffff);
    }

    if (this.aiState !== 'ALERT') {
      this.aiState = 'ALERT';
      this.updateIndicator('alert');
    }

    // Phase Transitions for OMEGA-SERAPH
    if (this.isSeraph) {
      const hpPct = this.health / this.maxHealth;

      // Phase 1 -> Phase 2 (HP <= 66%)
      if (this.currentPhase === 1 && hpPct <= 0.66) {
        this.currentPhase = 2;
        this.speed *= 1.4;
        this.fireRate *= 0.65;
        if (this.barrierShieldMesh) this.barrierShieldMesh.visible = false;
        if (this.sentinelBits) {
          this.sentinelBits.forEach(b => { b.isDead = true; b.mesh.visible = false; });
        }
        if (this.wingMeshes) {
          this.wingMeshes.forEach(w => {
            if (w.material) w.material.color.setHex(0xff0055);
          });
        }
        this.audio.playBossRoar();
        this.particles.createBlastExplosion(this.mesh.position, 0xff0055, 3.5);
        if (this.onPhaseAnnouncement) {
          this.onPhaseAnnouncement('⚡【第2形態移行】熾天使 OMEGA-SERAPH 激昂！\n全方位聖光弾幕 ＆ 超高速空中機動開始！', 4500);
        }
      }

      // Phase 2 -> Phase 3 (HP <= 33%)
      if (this.currentPhase === 2 && hpPct <= 0.33) {
        this.currentPhase = 3;
        this.speed *= 1.25;
        this.fireRate *= 0.7;
        if (this.wingMeshes) {
          this.wingMeshes.forEach(w => {
            if (w.material) w.material.color.setHex(0x9900ff);
          });
        }
        this.audio.playBossRoar();
        this.particles.createBlastExplosion(this.mesh.position, 0x9900ff, 4.5);
        if (this.onPhaseAnnouncement) {
          this.onPhaseAnnouncement('🔥【第3形態・最終決戦】終焉神核・虚空覚醒！\n虚空引力パルスを回避し、完全殲滅せよ！', 5000);
        }
      }
    }

    if (this.health <= 0) {
      this.isDying = true;
      this.deathTimer = 2.4;
      return true;
    }

    return false;
  }

  fireSpiralBarrage(projectilesList) {
    if (!this.mesh) return;
    const center = this.mesh.position.clone().add(new THREE.Vector3(0, 2.0, 0));
    const baseAngle = performance.now() * 0.003;
    const count = 8;
    for (let i = 0; i < count; i++) {
      const ang = baseAngle + (i / count) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(ang), 0.08, Math.sin(ang)).normalize();
      const projGeo = new THREE.SphereGeometry(0.32, 8, 8);
      const projMat = new THREE.MeshBasicMaterial({ color: 0xff0066, blending: THREE.AdditiveBlending });
      const projMesh = new THREE.Mesh(projGeo, projMat);
      projMesh.position.copy(center);
      this.scene.add(projMesh);

      projectilesList.push({
        mesh: projMesh,
        position: center.clone(),
        velocity: dir.multiplyScalar(22.0),
        damage: Math.round(this.damage * 1.1),
        life: 4.5,
        isHeavyLaser: true,
      });
    }
    this.audio.playBossMissile();
  }

  triggerGravityWell(playerPos, projectilesList) {
    if (!this.mesh || !playerPos) return;
    this.audio.playBossRoar();
    this.particles.createBlastExplosion(this.mesh.position, 0x9900ff, 3.0);

    // 引力パルス: プレイヤーをボス方向へ引き寄せる
    const pullDir = new THREE.Vector3().subVectors(this.mesh.position, playerPos);
    pullDir.y = 0;
    if (pullDir.lengthSq() > 1.0) {
      pullDir.normalize();
      if (playerPos.addScaledVector && !isNaN(pullDir.x)) {
        playerPos.addScaledVector(pullDir, 4.2);
      }
    }

    // 4連量子ホーミングミサイル一斉発射
    this.launchMissiles(playerPos, projectilesList);
  }

  update(delta, playerPos, camera, projectilesList, colliders = []) {
    if (this.isDead) return;

    if (this.isDying) {
      this.deathTimer -= delta;
      this.deathExplosionTimer -= delta;

      if (this.deathExplosionTimer <= 0) {
        this.deathExplosionTimer = 0.22;
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 3.5,
          Math.random() * 3.5,
          (Math.random() - 0.5) * 3.5
        );
        const expPos = this.mesh.position.clone().add(offset);
        this.particles.createExplosion(expPos, Math.random() > 0.5 ? 0xff0044 : 0xffaa00);
        this.audio.playExplosion(this.mesh.position.distanceTo(playerPos));
      }

      this.mesh.position.y = Math.max(0.4, this.mesh.position.y - delta * 1.2);
      this.mesh.rotation.z += delta * 0.4;

      if (this.deathTimer <= 0) {
        this.isDead = true;
        this.particles.createExplosion(this.mesh.position, 0xffaa00);
        this.particles.createExplosion(this.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xff0055);
        this.scene.remove(this.mesh);
        disposeHierarchy(this.mesh);
      }
      return;
    }

    // 気絶 (Stunned) 状態: 行動停止
    if (this.stunTimer > 0) {
      this.stunTimer -= delta;
      this.mesh.rotation.y += delta * 0.3;
      return;
    }

    // Sentinel Aegis Bits の公転アニメーション (Phase 1)
    if (this.isSeraph && this.sentinelBits) {
      this.sentinelBits.forEach(bit => {
        if (bit.isDead) return;
        bit.angle += delta * 2.2;
        bit.mesh.position.set(
          Math.cos(bit.angle) * 4.6,
          Math.sin(bit.angle * 2) * 0.9,
          Math.sin(bit.angle) * 4.6
        );
        bit.mesh.rotation.y += delta * 3.5;
      });
    }

    // Dynamic Boss Model Animations
    if (this.wingMeshes && this.wingMeshes.length > 0) {
      const flap = Math.sin(performance.now() * 0.0035) * (this.currentPhase >= 2 ? 0.32 : 0.18);
      this.wingMeshes.forEach((w, idx) => {
        const side = idx % 2 === 0 ? 1 : -1;
        w.rotation.z = w.userData.baseZ + flap * side;
      });
    }
    if (this.gyroRings) {
      this.gyroRings.forEach((ring, idx) => {
        ring.rotation.x += delta * (1.2 + idx * 0.6);
        ring.rotation.y += delta * (0.8 + idx * 0.4);
      });
    }
    if (this.reactorRing) {
      this.reactorRing.rotation.z += delta * 2.5;
    }
    if (this.hoverPods) {
      this.bodyGroup.position.y = 2.4 + Math.sin(performance.now() * 0.002) * 0.2;
    }

    // Seraph Phase 2+: Spiral Barrage
    if (this.isSeraph && this.currentPhase >= 2 && !this.isDead && !this.isDying) {
      this.spiralTimer -= delta;
      if (this.spiralTimer <= 0) {
        this.spiralTimer = this.currentPhase === 3 ? 3.0 : 4.5;
        this.fireSpiralBarrage(projectilesList);
      }
    }

    // Seraph Phase 3: Gravity Well
    if (this.isSeraph && this.currentPhase === 3 && !this.isDead && !this.isDying) {
      this.gravityTimer -= delta;
      if (this.gravityTimer <= 0) {
        this.gravityTimer = 6.5;
        this.triggerGravityWell(playerPos, projectilesList);
      }
    }

    // Missile Barrage Timer
    this.missileTimer -= delta;
    const distToPlayer = this.mesh.position.distanceTo(playerPos);

    if (this.aiState === 'ALERT' && this.missileTimer <= 0 && distToPlayer < 55) {
      this.launchMissiles(playerPos, projectilesList);
      this.missileTimer = this.missileCooldown * (0.85 + Math.random() * 0.3);
    }

    super.update(delta, playerPos, camera, projectilesList, colliders);
  }
}

/**
 * EX STAGE AERIAL ENEMY 1: EnemyEXDrone (エーテル・ヴェクタードローン)
 * High-speed aerial UAV drone hovering at 4-7m altitude, evading fire and strafing
 */
export class EnemyEXDrone extends EnemyHumanoid {
  constructor(config, scene, audio, particles) {
    super({
      ...config,
      type: 'seeker',
      health: config.health || 160,
      damage: config.damage || 20,
      speed: config.speed || 5.8,
      fireRate: config.fireRate || 1.3,
      score: config.score || 250,
    }, scene, audio, particles);

    this.isEX = true;
    this.altitudeTarget = 4.5 + Math.random() * 2.5;
    this.hoverBob = Math.random() * Math.PI * 2;
    this.rotors = [];
  }

  buildModel() {
    const root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.y = this.altitudeTarget;
    root.add(this.bodyGroup);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x091424,
      metalness: 0.95,
      roughness: 0.2,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.3,
    });
    const photonBlueMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      blending: THREE.AdditiveBlending,
    });

    // Central chassis
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.45, 8), metalMat);
    body.userData.enemy = this;
    this.targetMeshes.push(body);
    this.bodyGroup.add(body);

    // Glowing core eye (Critical spot)
    this.headGroup = new THREE.Group();
    this.bodyGroup.add(this.headGroup);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), photonBlueMat);
    eye.position.set(0, 0, 0.6);
    eye.userData.enemy = this;
    eye.userData.isCritical = true;
    this.targetMeshes.push(eye);
    this.headGroup.add(eye);

    // 4 Vector Rotors
    this.rotors = [];
    [
      { x: -1.0, z: -1.0 },
      { x: 1.0, z: -1.0 },
      { x: -1.0, z: 1.0 },
      { x: 1.0, z: 1.0 },
    ].forEach((pos) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.9), metalMat);
      arm.position.set(pos.x * 0.6, 0.1, pos.z * 0.6);
      arm.lookAt(pos.x * 1.5, 0.1, pos.z * 1.5);
      this.bodyGroup.add(arm);

      const rotor = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 16), photonBlueMat);
      rotor.rotation.x = Math.PI / 2;
      rotor.position.set(pos.x, 0.15, pos.z);
      this.bodyGroup.add(rotor);
      this.rotors.push(rotor);
    });

    // Twin Blaster Muzzles
    this.muzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.4), photonBlueMat);
    this.muzzleMesh.position.set(0.45, -0.15, 0.7);
    this.leftMuzzleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.4), photonBlueMat);
    this.leftMuzzleMesh.position.set(-0.45, -0.15, 0.7);
    this.bodyGroup.add(this.muzzleMesh, this.leftMuzzleMesh);

    return root;
  }

  update(delta, playerPos, camera, projectilesList, colliders = []) {
    if (this.isDead) return;

    if (this.rotors) {
      this.rotors.forEach((r, idx) => {
        r.rotation.z += delta * (18 + idx * 2);
      });
    }

    this.hoverBob += delta * 2.0;
    this.position.y = this.altitudeTarget + Math.sin(this.hoverBob) * 0.4;
    this.mesh.position.y = this.position.y;

    super.update(delta, playerPos, camera, projectilesList, colliders);
  }
}

/**
 * EX STAGE HIGH-TIER ENEMY 2: EnemyEXValkyrie (熾天使型ヴァルキリー機動兵)
 * High-speed aerial cyber-angel with photon wings and devastating holy lance bursts
 */
export class EnemyEXValkyrie extends EnemyHumanoid {
  constructor(config, scene, audio, particles) {
    super({
      ...config,
      type: 'assault',
      health: config.health || 280,
      damage: config.damage || 26,
      speed: config.speed || 5.2,
      fireRate: config.fireRate || 1.1,
      score: config.score || 400,
    }, scene, audio, particles);

    this.isEX = true;
    this.wings = [];
  }

  buildModel() {
    const root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.y = 1.6;
    root.add(this.bodyGroup);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0x221a05,
      metalness: 0.95,
      roughness: 0.18,
      emissive: 0xffd700,
      emissiveIntensity: 0.5,
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x091424,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.2,
    });
    const photonGold = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // Slender Humanoid Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.1, 0.4), armorMat);
    torso.userData.enemy = this;
    this.targetMeshes.push(torso);
    this.bodyGroup.add(torso);

    // Head (Critical Target)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.8, 0);
    this.bodyGroup.add(this.headGroup);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.35), goldMat);
    head.userData.enemy = this;
    head.userData.isCritical = true;
    this.targetMeshes.push(head);
    this.headGroup.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.2), photonGold);
    visor.position.set(0, 0.05, 0.15);
    visor.userData.enemy = this;
    visor.userData.isCritical = true;
    this.targetMeshes.push(visor);
    this.headGroup.add(visor);

    // 2 Angelic Photon Wings
    this.wings = [];
    [-1, 1].forEach((side) => {
      const wingGeo = new THREE.PlaneGeometry(2.4, 0.7);
      wingGeo.translate((side * 2.4) / 2, 0, 0);
      const wing = new THREE.Mesh(wingGeo, photonGold);
      wing.position.set(side * 0.4, 0.3, -0.25);
      wing.rotation.z = side * 0.35;
      wing.userData.baseZ = side * 0.35;
      wing.userData.side = side;
      this.bodyGroup.add(wing);
      this.wings.push(wing);
    });

    // Holy Pulse Lance (Gun)
    this.muzzleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.4, 8), goldMat);
    this.muzzleMesh.rotation.x = Math.PI / 2;
    this.muzzleMesh.position.set(0.55, -0.1, 0.6);
    this.bodyGroup.add(this.muzzleMesh);

    return root;
  }

  update(delta, playerPos, camera, projectilesList, colliders = []) {
    if (this.isDead) return;

    if (this.wings) {
      const flap = Math.sin(performance.now() * 0.005) * 0.22;
      this.wings.forEach((w) => {
        w.rotation.z = w.userData.baseZ + flap * w.userData.side;
      });
    }

    super.update(delta, playerPos, camera, projectilesList, colliders);
  }
}
