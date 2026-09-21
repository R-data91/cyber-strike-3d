import * as THREE from 'three';
import { Weapon } from './Weapon.js';

function getObstacleMeshes(colliders) {
  if (!colliders) return [];
  if (Array.isArray(colliders) && colliders.length > 0 && colliders[0].isMesh) return colliders;
  return Array.isArray(colliders) ? colliders.map(c => c.mesh || c) : [];
}

function getSafeNormal(hit) {
  if (hit && hit.face && hit.face.normal && !isNaN(hit.face.normal.x)) {
    return hit.face.normal;
  }
  return new THREE.Vector3(0, 1, 0);
}

/**
 * 3D Tactical Combat Arms & Gloves (ミリタリー迷彩スリーブ・ミリタリーウォッチ・ナックルグローブ)
 */
function buildTacticalArms(gunGroup, rightHandPos, leftHandPos) {
  const armsGroup = new THREE.Group();

  // Camouflage Sleeve Material (Tactical Spec-Ops Olive Drab)
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x3d4b35,
    roughness: 0.8,
    metalness: 0.1,
  });

  // Tactical Combat Glove Material (Reinforced Grip Fabric)
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x181a1e,
    roughness: 0.6,
    metalness: 0.25,
  });

  // Carbon Knuckle Armor Material
  const knuckleMat = new THREE.MeshStandardMaterial({
    color: 0x0c0d10,
    roughness: 0.25,
    metalness: 0.85,
  });

  // Smartwatch Bezel & Glowing Cyan Display
  const watchMat = new THREE.MeshStandardMaterial({
    color: 0x141822,
    metalness: 0.9,
    roughness: 0.3,
  });
  const screenMat = new THREE.MeshBasicMaterial({
    color: 0x00f3ff,
  });

  const upVec = new THREE.Vector3(0, 1, 0);

  // ==================== 1. RIGHT ARM (Trigger Grip) ====================
  const pGrip = rightHandPos.clone();
  const pRightShoulder = new THREE.Vector3(0.18, -0.22, 0.18); // enters from bottom-right corner

  const rDir = new THREE.Vector3().subVectors(pGrip, pRightShoulder);
  const rLen = rDir.length();
  const rCenter = new THREE.Vector3().addVectors(pRightShoulder, pGrip).multiplyScalar(0.5);

  const rSleeveGeo = new THREE.CylinderGeometry(0.044, 0.055, rLen, 12);
  const rSleeve = new THREE.Mesh(rSleeveGeo, sleeveMat);
  rSleeve.position.copy(rCenter);
  rSleeve.quaternion.setFromUnitVectors(upVec, rDir.clone().normalize());
  armsGroup.add(rSleeve);

  // Right Hand Glove on pistol grip
  const rHand = new THREE.Group();
  rHand.position.copy(pGrip);

  const rPalm = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.068, 0.075), gloveMat);
  rPalm.rotation.set(-0.25, 0.08, 0.05);
  rHand.add(rPalm);

  const rKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.018, 0.035), knuckleMat);
  rKnuckle.position.set(0, 0.034, 0.005);
  rPalm.add(rKnuckle);

  const rTriggerFinger = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.042), gloveMat);
  rTriggerFinger.position.set(-0.016, 0.012, -0.045);
  rTriggerFinger.rotation.x = -0.32;
  rHand.add(rTriggerFinger);

  armsGroup.add(rHand);

  // ==================== 2. LEFT ARM (Support Handguard Grip) ====================
  const pSupport = leftHandPos.clone();
  const pLeftShoulder = new THREE.Vector3(-0.16, -0.22, 0.12); // enters from bottom-left corner

  const lDir = new THREE.Vector3().subVectors(pSupport, pLeftShoulder);
  const lLen = lDir.length();
  const lCenter = new THREE.Vector3().addVectors(pLeftShoulder, pSupport).multiplyScalar(0.5);

  const lSleeveGeo = new THREE.CylinderGeometry(0.042, 0.054, lLen, 12);
  const lSleeve = new THREE.Mesh(lSleeveGeo, sleeveMat);
  lSleeve.position.copy(lCenter);
  lSleeve.quaternion.setFromUnitVectors(upVec, lDir.clone().normalize());
  armsGroup.add(lSleeve);

  // Smartwatch sitting flush on left wrist
  const pWatch = new THREE.Vector3().lerpVectors(pLeftShoulder, pSupport, 0.72);
  const watchGroup = new THREE.Group();
  watchGroup.position.copy(pWatch);
  watchGroup.position.y += 0.025; // on top surface of forearm
  watchGroup.rotation.set(-0.35, 0.3, -0.2);

  const watchBase = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.018, 0.042), watchMat);
  watchGroup.add(watchBase);

  const watchScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.026), screenMat);
  watchScreen.rotation.x = -Math.PI / 2;
  watchScreen.position.y = 0.01;
  watchGroup.add(watchScreen);

  armsGroup.add(watchGroup);

  // Left Hand Glove cupping under the handguard
  const lHand = new THREE.Group();
  lHand.position.copy(pSupport);

  const lPalm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.062, 0.075), gloveMat);
  lPalm.rotation.set(0.3, -0.15, -0.2);
  lHand.add(lPalm);

  const lKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.018, 0.035), knuckleMat);
  lKnuckle.position.set(0, -0.032, 0.005);
  lPalm.add(lKnuckle);

  const lThumb = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.016, 0.042), gloveMat);
  lThumb.position.set(0.028, 0.025, -0.012);
  lThumb.rotation.set(-0.2, 0.1, 0.25);
  lHand.add(lThumb);

  armsGroup.add(lHand);

  gunGroup.add(armsGroup);
  return armsGroup;
}

/**
 * 1. AK-47 自動小銃 (AK-47 Assault Rifle)
 * 7.62x39mm弾の強烈な威力を誇る伝説的アサルトライフル。野太い重火薬の破裂音とスチールボルトの打撃音。
 */
export class PulseRifle extends Weapon {
  constructor(camera, scene, audio, particles) {
    super({
      name: 'AK-47',
      type: 'rifle',
      damage: 34, // 7.62mmの大火力
      headshotMultiplier: 2.2,
      fireRate: 0.10, // ~600 RPM
      magazineSize: 30,
      reserveAmmo: 180,
      reloadTime: 1.9,
      spread: 0.018,
      pellets: 1,
      automatic: true,
      fireMode: 'フルオート',
      hipPos: new THREE.Vector3(0.20, -0.19, -0.38),
      adsPos: new THREE.Vector3(0.0, -0.105, -0.28),
      maxRecoilZ: 0.065,
      maxRecoilRotX: 0.085,
      recoilRecoverySpeed: 15.0,
      muzzleColor: 0xffaa00,
      muzzleOffset: new THREE.Vector3(0, 0.04, -0.76),
    }, camera, scene, audio, particles);
  }

  buildModel() {
    const gun = new THREE.Group();

    // AKダークスチール素材
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x161a22,
      roughness: 0.38,
      metalness: 0.85,
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x222730,
      roughness: 0.45,
      metalness: 0.7,
    });

    // AK木製・ポリマーハンドガード素材 (茶褐色)
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5a321a,
      roughness: 0.65,
      metalness: 0.15,
    });

    // メインレシーバー
    const bodyGeo = new THREE.BoxGeometry(0.072, 0.11, 0.44);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0, -0.2);
    gun.add(body);

    // バレル (銃身)
    const barrelGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.36, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, trimMat);
    barrel.position.set(0, 0.025, -0.56);
    gun.add(barrel);

    // ガスピストンチューブ (バレル上部)
    const gasTubeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.28, 10);
    gasTubeGeo.rotateX(Math.PI / 2);
    const gasTube = new THREE.Mesh(gasTubeGeo, trimMat);
    gasTube.position.set(0, 0.065, -0.48);
    gun.add(gasTube);

    // AK木製ハンドガード (フォアグリップ)
    const handguardGeo = new THREE.BoxGeometry(0.075, 0.08, 0.2);
    const handguard = new THREE.Mesh(handguardGeo, woodMat);
    handguard.position.set(0, 0.04, -0.44);
    gun.add(handguard);

    // スラントマズルブレーキ (斜めカットのAK特有マズル)
    const brakeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.08);
    const brake = new THREE.Mesh(brakeGeo, bodyMat);
    brake.position.set(0, 0.025, -0.75);
    gun.add(brake);

    // ピストルグリップ
    const gripGeo = new THREE.BoxGeometry(0.055, 0.16, 0.08);
    const grip = new THREE.Mesh(gripGeo, woodMat);
    grip.position.set(0, -0.11, -0.06);
    grip.rotation.x = -0.32;
    gun.add(grip);

    // AK名物の湾曲バナナマガジン (Curved Steel 30-round Mag)
    const magGeo = new THREE.BoxGeometry(0.048, 0.18, 0.08);
    const mag = new THREE.Mesh(magGeo, bodyMat);
    mag.position.set(0, -0.12, -0.22);
    mag.rotation.x = 0.28;
    gun.add(mag);

    // リフレックスサイト
    const sightBaseGeo = new THREE.BoxGeometry(0.048, 0.02, 0.12);
    const sightBase = new THREE.Mesh(sightBaseGeo, trimMat);
    sightBase.position.set(0, 0.07, -0.18);
    gun.add(sightBase);

    // Sight Glass
    const sightGlassGeo = new THREE.RingGeometry(0.015, 0.028, 16);
    const sightGlassMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const sightGlass = new THREE.Mesh(sightGlassGeo, sightGlassMat);
    sightGlass.position.set(0, 0.105, -0.18);
    gun.add(sightGlass);

    // Reticle Center Dot
    const dotGeo = new THREE.CircleGeometry(0.003, 8);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      side: THREE.DoubleSide,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(0, 0.105, -0.181);
    gun.add(dot);

    // プレイヤーの両腕・両手 (Tactical Arms & Combat Gloves)
    buildTacticalArms(gun, new THREE.Vector3(0.01, -0.11, -0.06), new THREE.Vector3(-0.01, 0.02, -0.42));

    return gun;
  }

  fire(raycaster, targets, colliders, hitRangeBonus = 0, enemiesList = []) {
    this.currentAmmo--;
    this.fireCooldown = this.fireRate;
    this.triggerRecoil();
    this.audio.playRifleShot();

    const spreadAngle = this.isADS ? this.spread * 0.35 : this.spread;
    const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    rayDir.x += (Math.random() - 0.5) * spreadAngle;
    rayDir.y += (Math.random() - 0.5) * spreadAngle;
    rayDir.normalize();

    raycaster.set(this.camera.position, rayDir);

    const muzzleWorld = new THREE.Vector3();
    this.muzzleLight.getWorldPosition(muzzleWorld);

    const hits = raycaster.intersectObjects(targets, true);
    const wallHits = raycaster.intersectObjects(getObstacleMeshes(colliders), false);

    let closestHit = null;
    let hitDistance = this.range;

    if (wallHits.length > 0 && wallHits[0].distance < hitDistance) {
      closestHit = { type: 'wall', hit: wallHits[0] };
      hitDistance = wallHits[0].distance;
    }

    if (hits.length > 0 && hits[0].distance < hitDistance) {
      closestHit = { type: 'enemy', hit: hits[0] };
      hitDistance = hits[0].distance;
    }

    // 攻撃範囲 (初期値2.0倍基準 + 強化ボーナス)
    if ((!closestHit || closestHit.type === 'wall') && Array.isArray(enemiesList)) {
      const tolerance = 0.90 + hitRangeBonus; // 0.45 * 2.0 = 0.90
      let bestDist = tolerance;
      let magnetHit = null;
      const camPos = this.camera.position;

      for (const enemy of enemiesList) {
        if (!enemy || enemy.isDead) continue;
        const enemyCenter = enemy.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        const toEnemy = enemyCenter.clone().sub(camPos);
        const forwardDist = toEnemy.dot(rayDir);
        if (forwardDist > 1.5 && forwardDist < hitDistance) {
          const closestPointOnRay = camPos.clone().addScaledVector(rayDir, forwardDist);
          const perpDist = closestPointOnRay.distanceTo(enemyCenter);
          if (perpDist < bestDist) {
            bestDist = perpDist;
            const targetMesh = enemy.targetMeshes && enemy.targetMeshes[0] ? enemy.targetMeshes[0] : null;
            if (targetMesh) {
              magnetHit = {
                type: 'enemy',
                hit: { object: targetMesh, point: enemyCenter, distance: forwardDist }
              };
            }
          }
        }
      }
      if (magnetHit) closestHit = magnetHit;
    }

    const endPoint = closestHit ? closestHit.hit.point : muzzleWorld.clone().addScaledVector(rayDir, this.range);
    this.particles.createBulletTracer(muzzleWorld, endPoint, 0x00f3ff);

    // 2丁流・3丁流時の追加火線トレーサー
    const wield = this.wieldMode || 1;
    if (wield >= 2) {
      const leftMuzzle = muzzleWorld.clone().add(new THREE.Vector3(-0.18, 0, 0));
      this.particles.createBulletTracer(leftMuzzle, endPoint, 0x00f3ff);
    }
    if (wield >= 3) {
      const rightMuzzle = muzzleWorld.clone().add(new THREE.Vector3(0.18, 0.05, 0));
      this.particles.createBulletTracer(rightMuzzle, endPoint, 0x00f3ff);
    }

    if (closestHit) {
      if (closestHit.type === 'wall') {
        this.particles.createImpactSparks(closestHit.hit.point, getSafeNormal(closestHit.hit), 0x00f3ff, 8 * wield);
      }
      return wield > 1 ? Array(wield).fill(closestHit) : closestHit;
    }
    return null;
  }
}

/**
 * 2. スキャッター銃 (SCATTER CANNON)
 * 近距離で圧倒的な面制圧力を誇る8点放射ショットガン。
 */
export class ScatterCannon extends Weapon {
  constructor(camera, scene, audio, particles) {
    super({
      name: 'スキャッター銃',
      type: 'shotgun',
      damage: 18, // 18 x 8 pellets = 最大144ダメージ
      headshotMultiplier: 1.8,
      fireRate: 0.72,
      magazineSize: 8,
      reserveAmmo: 48,
      reloadTime: 2.2,
      spread: 0.075,
      pellets: 8,
      automatic: false,
      fireMode: 'セミオート',
      hipPos: new THREE.Vector3(0.20, -0.20, -0.38),
      adsPos: new THREE.Vector3(0.0, -0.082, -0.28), // 照星・照門の中心線 (y=0.082) に完全整合
      maxRecoilZ: 0.12,
      maxRecoilRotX: 0.18,
      recoilRecoverySpeed: 10.0,
      muzzleColor: 0xff7700,
      muzzleOffset: new THREE.Vector3(0, 0.05, -0.68),
    }, camera, scene, audio, particles);
  }

  buildModel() {
    const gun = new THREE.Group();

    const heavyMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.4,
      metalness: 0.85,
    });

    const heatMat = new THREE.MeshStandardMaterial({
      color: 0x331105,
      emissive: 0xff4400,
      emissiveIntensity: 0.4,
      roughness: 0.3,
    });

    // Heavy Body
    const bodyGeo = new THREE.BoxGeometry(0.12, 0.14, 0.42);
    const body = new THREE.Mesh(bodyGeo, heavyMat);
    body.position.set(0, 0, -0.18);
    gun.add(body);

    // Dual Over-Under Barrels
    const b1Geo = new THREE.CylinderGeometry(0.032, 0.032, 0.42, 12);
    b1Geo.rotateX(Math.PI / 2);
    const b1 = new THREE.Mesh(b1Geo, heavyMat);
    b1.position.set(0, 0.035, -0.48);
    gun.add(b1);

    const b2Geo = new THREE.CylinderGeometry(0.032, 0.032, 0.42, 12);
    b2Geo.rotateX(Math.PI / 2);
    const b2 = new THREE.Mesh(b2Geo, heavyMat);
    b2.position.set(0, -0.035, -0.48);
    gun.add(b2);

    // Heat radiator vents
    const ventGeo = new THREE.BoxGeometry(0.126, 0.03, 0.22);
    const vent = new THREE.Mesh(ventGeo, heatMat);
    vent.position.set(0, 0.04, -0.22);
    gun.add(vent);

    // Pump Handle
    const pumpGeo = new THREE.BoxGeometry(0.13, 0.08, 0.15);
    const pump = new THREE.Mesh(pumpGeo, heavyMat);
    pump.position.set(0, -0.04, -0.38);
    gun.add(pump);

    // Heavy Grip
    const gripGeo = new THREE.BoxGeometry(0.07, 0.18, 0.1);
    const grip = new THREE.Mesh(gripGeo, heavyMat);
    grip.position.set(0, -0.13, -0.04);
    grip.rotation.x = -0.35;
    gun.add(grip);

    // プレイヤーの両腕・両手 (Tactical Arms & Combat Gloves)
    buildTacticalArms(gun, new THREE.Vector3(0.01, -0.13, -0.04), new THREE.Vector3(-0.01, -0.04, -0.38));

    // 高輝度トリチウム フロントビード (Orange Front Sight Bead)
    const frontSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.024, 0.02), heavyMat);
    frontSightBase.position.set(0, 0.075, -0.64);
    gun.add(frontSightBase);

    const frontBeadMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const frontBead = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), frontBeadMat);
    frontBead.position.set(0, 0.082, -0.64);
    gun.add(frontBead);

    // リア ゴーストリング・Uノッチ照門 (Dual Green Tritium Dots)
    const rearSightLeft = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.022, 0.015), heavyMat);
    rearSightLeft.position.set(-0.014, 0.082, -0.15);
    gun.add(rearSightLeft);

    const rearSightRight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.022, 0.015), heavyMat);
    rearSightRight.position.set(0.014, 0.082, -0.15);
    gun.add(rearSightRight);

    const rearDotMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const rearDotL = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), rearDotMat);
    rearDotL.position.set(-0.014, 0.084, -0.142);
    gun.add(rearDotL);

    const rearDotR = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), rearDotMat);
    rearDotR.position.set(0.014, 0.084, -0.142);
    gun.add(rearDotR);

    return gun;
  }

  fire(raycaster, targets, colliders, hitRangeBonus = 0, enemiesList = []) {
    this.currentAmmo--;
    this.fireCooldown = this.fireRate;
    this.triggerRecoil();
    this.audio.playShotgunShot();

    const muzzleWorld = new THREE.Vector3();
    this.muzzleLight.getWorldPosition(muzzleWorld);

    const hitResults = [];
    const wield = this.wieldMode || 1;
    const totalPellets = (this.pellets + Math.round(hitRangeBonus * 8)) * wield;
    const obstacleMeshes = getObstacleMeshes(colliders);

    for (let i = 0; i < totalPellets; i++) {
      const spreadAngle = this.isADS ? this.spread * 0.5 : this.spread;
      const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      rayDir.x += (Math.random() - 0.5) * spreadAngle;
      rayDir.y += (Math.random() - 0.5) * spreadAngle;
      rayDir.normalize();

      raycaster.set(this.camera.position, rayDir);

      const hits = raycaster.intersectObjects(targets, true);
      const wallHits = raycaster.intersectObjects(obstacleMeshes, false);

      let closestHit = null;
      let hitDistance = this.range;

      if (wallHits.length > 0 && wallHits[0].distance < hitDistance) {
        closestHit = { type: 'wall', hit: wallHits[0] };
        hitDistance = wallHits[0].distance;
      }
      if (hits.length > 0 && hits[0].distance < hitDistance) {
        closestHit = { type: 'enemy', hit: hits[0] };
        hitDistance = hits[0].distance;
      }

      // 散弾の近傍ヒットアシスト (初期値2.0倍基準)
      if ((!closestHit || closestHit.type === 'wall') && Array.isArray(enemiesList)) {
        const tolerance = 0.70 + hitRangeBonus * 0.7; // 0.35 * 2.0 = 0.70
        const camPos = this.camera.position;
        for (const enemy of enemiesList) {
          if (!enemy || enemy.isDead) continue;
          const enemyCenter = enemy.position.clone().add(new THREE.Vector3(0, 1.0, 0));
          const toEnemy = enemyCenter.clone().sub(camPos);
          const forwardDist = toEnemy.dot(rayDir);
          if (forwardDist > 1.2 && forwardDist < hitDistance) {
            const pointOnRay = camPos.clone().addScaledVector(rayDir, forwardDist);
            if (pointOnRay.distanceTo(enemyCenter) < tolerance) {
              const targetMesh = enemy.targetMeshes && enemy.targetMeshes[0] ? enemy.targetMeshes[0] : null;
              if (targetMesh) {
                closestHit = { type: 'enemy', hit: { object: targetMesh, point: enemyCenter, distance: forwardDist } };
                break;
              }
            }
          }
        }
      }

      const endPoint = closestHit ? closestHit.hit.point : muzzleWorld.clone().addScaledVector(rayDir, this.range);
      this.particles.createBulletTracer(muzzleWorld, endPoint, 0xff7700);

      if (closestHit) {
        if (closestHit.type === 'wall') {
          this.particles.createImpactSparks(closestHit.hit.point, getSafeNormal(closestHit.hit), 0xff7700, 6);
        } else {
          hitResults.push(closestHit);
        }
      }
    }

    return hitResults;
  }
}

/**
 * 3. ヴォルテックス・レールガン (VORTEX RAILGUN)
 * 4倍率スナイパースコープを備えた電磁加速ビームライフル。急所命中で敵を一撃粉砕。
 */
export class VortexRailgun extends Weapon {
  constructor(camera, scene, audio, particles) {
    super({
      name: 'レールガン',
      type: 'railgun',
      damage: 170,
      headshotMultiplier: 2.5, // 425ダメージ（一撃死）
      fireRate: 1.2,
      magazineSize: 4,
      reserveAmmo: 20,
      reloadTime: 2.5,
      spread: 0.001,
      pellets: 1,
      automatic: false,
      fireMode: 'ボルトアクション',
      hipPos: new THREE.Vector3(0.20, -0.19, -0.40),
      adsPos: new THREE.Vector3(0.0, -0.12, -0.30),
      maxRecoilZ: 0.15,
      maxRecoilRotX: 0.22,
      recoilRecoverySpeed: 8.0,
      muzzleColor: 0x00f3ff,
      muzzleOffset: new THREE.Vector3(0, 0.06, -0.92),
    }, camera, scene, audio, particles);
  }

  buildModel() {
    const gun = new THREE.Group();

    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1d,
      roughness: 0.3,
      metalness: 0.9,
    });

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x052035,
      emissive: 0x00a2ff,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.9,
    });

    const coilMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      blending: THREE.AdditiveBlending,
    });

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.08, 0.12, 0.6);
    const body = new THREE.Mesh(bodyGeo, chassisMat);
    body.position.set(0, 0, -0.28);
    gun.add(body);

    // Magnetic Rails
    const railTopGeo = new THREE.BoxGeometry(0.04, 0.015, 0.55);
    const railTop = new THREE.Mesh(railTopGeo, railMat);
    railTop.position.set(0, 0.065, -0.65);
    gun.add(railTop);

    const railBottomGeo = new THREE.BoxGeometry(0.04, 0.015, 0.55);
    const railBottom = new THREE.Mesh(railBottomGeo, railMat);
    railBottom.position.set(0, 0.005, -0.65);
    gun.add(railBottom);

    // Accelerator Coils
    for (let i = 0; i < 4; i++) {
      const ringGeo = new THREE.TorusGeometry(0.042, 0.008, 8, 16);
      const ring = new THREE.Mesh(ringGeo, coilMat);
      ring.position.set(0, 0.035, -0.42 - i * 0.11);
      gun.add(ring);
    }

    // Optic Scope
    const scopeGeo = new THREE.CylinderGeometry(0.028, 0.032, 0.3, 16);
    scopeGeo.rotateX(Math.PI / 2);
    const scope = new THREE.Mesh(scopeGeo, chassisMat);
    scope.position.set(0, 0.12, -0.26);
    gun.add(scope);

    const lensGeo = new THREE.CircleGeometry(0.026, 16);
    const lens = new THREE.Mesh(lensGeo, coilMat);
    lens.position.set(0, 0.12, -0.411);
    gun.add(lens);

    // Grip
    const gripGeo = new THREE.BoxGeometry(0.05, 0.18, 0.08);
    const grip = new THREE.Mesh(gripGeo, chassisMat);
    grip.position.set(0, -0.12, -0.06);
    grip.rotation.x = -0.3;
    gun.add(grip);

    // プレイヤーの両腕・両手 (Tactical Arms & Combat Gloves)
    buildTacticalArms(gun, new THREE.Vector3(0.01, -0.12, -0.06), new THREE.Vector3(-0.01, 0.01, -0.36));

    return gun;
  }

  fire(raycaster, targets, colliders, hitRangeBonus = 0, enemiesList = []) {
    this.currentAmmo--;
    this.fireCooldown = this.fireRate;
    this.triggerRecoil();
    this.audio.playRailgunShot();

    const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    raycaster.set(this.camera.position, rayDir);

    const muzzleWorld = new THREE.Vector3();
    this.muzzleLight.getWorldPosition(muzzleWorld);

    const hits = raycaster.intersectObjects(targets, true);
    const wallHits = raycaster.intersectObjects(getObstacleMeshes(colliders), false);

    let closestHit = null;
    let hitDistance = this.range * 1.5;

    if (wallHits.length > 0 && wallHits[0].distance < hitDistance) {
      closestHit = { type: 'wall', hit: wallHits[0] };
      hitDistance = wallHits[0].distance;
    }
    if (hits.length > 0 && hits[0].distance < hitDistance) {
      closestHit = { type: 'enemy', hit: hits[0] };
      hitDistance = hits[0].distance;
    }

    // レールガン電磁ビームの範囲判定拡張 (初期値2.0倍基準)
    if ((!closestHit || closestHit.type === 'wall') && Array.isArray(enemiesList)) {
      const beamTolerance = 1.00 + hitRangeBonus * 1.2; // 0.50 * 2.0 = 1.00
      const camPos = this.camera.position;
      for (const enemy of enemiesList) {
        if (!enemy || enemy.isDead) continue;
        const enemyCenter = enemy.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        const toEnemy = enemyCenter.clone().sub(camPos);
        const forwardDist = toEnemy.dot(rayDir);
        if (forwardDist > 2.0 && forwardDist < hitDistance) {
          const pointOnRay = camPos.clone().addScaledVector(rayDir, forwardDist);
          if (pointOnRay.distanceTo(enemyCenter) < beamTolerance) {
            const targetMesh = enemy.targetMeshes && enemy.targetMeshes[0] ? enemy.targetMeshes[0] : null;
            if (targetMesh) {
              closestHit = { type: 'enemy', hit: { object: targetMesh, point: enemyCenter, distance: forwardDist } };
              break;
            }
          }
        }
      }
    }

    const endPoint = closestHit ? closestHit.hit.point : muzzleWorld.clone().addScaledVector(rayDir, this.range * 1.5);
    this.particles.createRailgunBeam(muzzleWorld, endPoint);

    if (closestHit) {
      if (closestHit.type === 'wall') {
        this.particles.createImpactSparks(closestHit.hit.point, getSafeNormal(closestHit.hit), 0x00f3ff, 18);
      }
      return closestHit;
    }
    return null;
  }
}

/**
 * 4. プラズマ・サブマシンガン「サイバー・ヴァイパー」 (Cyber Viper)
 * - 超高速連射 (900 RPM / fireRate: 0.066s)
 * - 装弾数45発 / 近距離高DPS / シアン色の超高速プラズマ弾列
 */
export class PlasmaSMG extends Weapon {
  constructor(camera, scene, audio, particles) {
    super({
      name: 'CYBER VIPER',
      displayName: 'サイバー・ヴァイパー (SMG)',
      type: 'smg',
      damage: 16,
      headshotMultiplier: 2.0,
      fireRate: 0.066,
      magazineSize: 45,
      reserveAmmo: 270,
      reloadTime: 1.25,
      range: 85,
      spread: 0.022,
      automatic: true,
      fireMode: 'AUTO',
      hipPos: new THREE.Vector3(0.22, -0.22, -0.42),
      adsPos: new THREE.Vector3(0.0, -0.16, -0.32),
      muzzleOffset: new THREE.Vector3(0, 0.04, -0.52),
      muzzleColor: 0x00f3ff,
      maxRecoilZ: 0.032,
      maxRecoilRotX: 0.042,
      recoilRecoverySpeed: 22.0,
    }, camera, scene, audio, particles);
  }

  buildModel() {
    const gunGroup = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.35, metalness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x080c12, roughness: 0.5, metalness: 0.7 });
    const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });

    // Main Receiver
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.44), metalMat);
    body.position.set(0, 0, -0.15);
    gunGroup.add(body);

    // Barrel Shroud
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.22, 12), darkMat);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(0, 0.015, -0.42);
    gunGroup.add(shroud);

    // Cyan Heat-sink Ribs
    [-0.1, -0.04, 0.02].forEach(zOff => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.03, 0.015), cyanGlowMat);
      rib.position.set(0, 0.04, zOff);
      gunGroup.add(rib);
    });

    // Curved Translucent Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.065), cyanGlowMat);
    mag.position.set(0, -0.12, -0.18);
    mag.rotation.x = 0.22;
    gunGroup.add(mag);

    // Reflex Sight
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.08), darkMat);
    sight.position.set(0, 0.078, -0.14);
    gunGroup.add(sight);

    const reticleDot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 8), cyanGlowMat);
    reticleDot.position.set(0, 0.08, -0.181);
    gunGroup.add(reticleDot);

    // Tactical spec-ops arms
    const arms = buildTacticalArms(
      gunGroup,
      new THREE.Vector3(0.02, -0.1, -0.06),
      new THREE.Vector3(-0.02, -0.06, -0.32)
    );
    gunGroup.add(arms);

    return gunGroup;
  }

  fire(raycaster, targets, colliders, hitRangeBonus = 0, enemiesList = []) {
    this.currentAmmo--;
    this.fireCooldown = this.fireRate;
    this.triggerRecoil();
    this.audio.playSmgShot();

    const spreadFactor = this.isADS ? 0.35 : 1.0;
    const rayDir = new THREE.Vector3(
      (Math.random() - 0.5) * this.spread * spreadFactor,
      (Math.random() - 0.5) * this.spread * spreadFactor,
      -1
    ).applyQuaternion(this.camera.quaternion).normalize();

    raycaster.set(this.camera.position, rayDir);

    const muzzleWorld = new THREE.Vector3();
    this.muzzleLight.getWorldPosition(muzzleWorld);

    const hits = raycaster.intersectObjects(targets, true);
    const wallHits = raycaster.intersectObjects(getObstacleMeshes(colliders), false);

    let closestHit = null;
    let hitDistance = this.range;

    if (wallHits.length > 0 && wallHits[0].distance < hitDistance) {
      closestHit = { type: 'wall', hit: wallHits[0] };
      hitDistance = wallHits[0].distance;
    }
    if (hits.length > 0 && hits[0].distance < hitDistance) {
      closestHit = { type: 'enemy', hit: hits[0] };
      hitDistance = hits[0].distance;
    }

    // 誘導電磁補正 (初期値2.0倍基準)
    if ((!closestHit || closestHit.type === 'wall') && Array.isArray(enemiesList)) {
      const tolerance = 0.70 + hitRangeBonus; // 0.35 * 2.0 = 0.70
      const camPos = this.camera.position;
      for (const enemy of enemiesList) {
        if (!enemy || enemy.isDead) continue;
        const enemyCenter = enemy.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        const toEnemy = enemyCenter.clone().sub(camPos);
        const forwardDist = toEnemy.dot(rayDir);
        if (forwardDist > 1.5 && forwardDist < hitDistance) {
          const pointOnRay = camPos.clone().addScaledVector(rayDir, forwardDist);
          if (pointOnRay.distanceTo(enemyCenter) < tolerance) {
            const targetMesh = enemy.targetMeshes && enemy.targetMeshes[0] ? enemy.targetMeshes[0] : null;
            if (targetMesh) {
              closestHit = { type: 'enemy', hit: { object: targetMesh, point: enemyCenter, distance: forwardDist } };
              break;
            }
          }
        }
      }
    }

    const endPoint = closestHit ? closestHit.hit.point : muzzleWorld.clone().addScaledVector(rayDir, this.range);
    this.particles.createTracer(muzzleWorld, endPoint, 0x00f3ff);

    const wield = this.wieldMode || 1;
    if (wield >= 2) {
      const leftMuzzle = muzzleWorld.clone().add(new THREE.Vector3(-0.16, -0.02, 0));
      this.particles.createTracer(leftMuzzle, endPoint, 0x00f3ff);
    }
    if (wield >= 3) {
      const rightMuzzle = muzzleWorld.clone().add(new THREE.Vector3(0.16, 0.02, 0));
      this.particles.createTracer(rightMuzzle, endPoint, 0x00f3ff);
    }

    if (closestHit) {
      if (closestHit.type === 'wall') {
        this.particles.createImpactSparks(closestHit.hit.point, getSafeNormal(closestHit.hit), 0x00f3ff, 6 * wield);
      }
      return wield > 1 ? Array(wield).fill(closestHit) : closestHit;
    }
    return null;
  }
}

/**
 * 5. 重プラズマ・グレネードランチャー「ヘルハウンド」 (Hellhound)
 * - 単発大威力榴弾 (直撃180ダメージ + 半径6m爆風スプラッシュ)
 * - 6発装填ドラムマガジン
 */
export class HeavyGrenadeLauncher extends Weapon {
  constructor(camera, scene, audio, particles) {
    super({
      name: 'HELLHOUND',
      displayName: 'ヘルハウンド (榴弾砲)',
      type: 'launcher',
      damage: 180,
      headshotMultiplier: 1.5,
      fireRate: 0.65,
      magazineSize: 6,
      reserveAmmo: 24,
      reloadTime: 2.2,
      range: 80,
      spread: 0.012,
      automatic: false,
      fireMode: 'SEMI',
      hipPos: new THREE.Vector3(0.24, -0.25, -0.46),
      adsPos: new THREE.Vector3(0.0, -0.19, -0.36),
      muzzleOffset: new THREE.Vector3(0, 0.05, -0.62),
      muzzleColor: 0xff7700,
      maxRecoilZ: 0.12,
      maxRecoilRotX: 0.20,
      recoilRecoverySpeed: 11.0,
    }, camera, scene, audio, particles);
  }

  buildModel() {
    const gunGroup = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222a25, roughness: 0.55, metalness: 0.75 });
    const heavyMat = new THREE.MeshStandardMaterial({ color: 0x141816, roughness: 0.4, metalness: 0.9 });
    const orangeMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });

    // Massive Launcher Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.52, 14), heavyMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, -0.32);
    gunGroup.add(barrel);

    // Revolving Drum Cylinder
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.24, 12), metalMat);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, -0.04, -0.15);
    gunGroup.add(drum);

    // Ammo Indicator Lights
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.04), orangeMat);
    led.position.set(0, 0.09, -0.14);
    gunGroup.add(led);

    // Heavy Stock & Receiver
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.32), metalMat);
    stock.position.set(0, 0, 0.08);
    gunGroup.add(stock);

    const arms = buildTacticalArms(
      gunGroup,
      new THREE.Vector3(0.03, -0.12, 0.02),
      new THREE.Vector3(-0.03, -0.1, -0.32)
    );
    gunGroup.add(arms);

    return gunGroup;
  }

  fire(raycaster, targets, colliders, hitRangeBonus = 0, enemiesList = []) {
    this.currentAmmo--;
    this.fireCooldown = this.fireRate;
    this.triggerRecoil();
    this.audio.playLauncherShot();

    const rayDir = new THREE.Vector3(0, 0.02, -1).applyQuaternion(this.camera.quaternion).normalize();
    raycaster.set(this.camera.position, rayDir);

    const muzzleWorld = new THREE.Vector3();
    this.muzzleLight.getWorldPosition(muzzleWorld);

    const hits = raycaster.intersectObjects(targets, true);
    const wallHits = raycaster.intersectObjects(getObstacleMeshes(colliders), false);

    let closestHit = null;
    let hitDistance = this.range;

    if (wallHits.length > 0 && wallHits[0].distance < hitDistance) {
      closestHit = { type: 'wall', hit: wallHits[0] };
      hitDistance = wallHits[0].distance;
    }
    if (hits.length > 0 && hits[0].distance < hitDistance) {
      closestHit = { type: 'enemy', hit: hits[0] };
      hitDistance = hits[0].distance;
    }

    const blastPoint = closestHit ? closestHit.hit.point : muzzleWorld.clone().addScaledVector(rayDir, this.range);
    this.particles.createTracer(muzzleWorld, blastPoint, 0xff7700);

    // 着弾特大爆風エフェクト & 爆破音
    this.particles.createBlastExplosion(blastPoint, 0xff5500, 1.4);
    const blastDist = blastPoint.distanceTo(this.camera.position);
    this.audio.playExplosion(blastDist);

    // 範囲スプラッシュダメージ判定 (初期値2.0倍: 半径12.0m + 攻撃範囲ボーナス)
    const blastRadius = 12.0 + (hitRangeBonus * 3.0); // 6.0 * 2.0 = 12.0
    const affectedHits = [];

    if (closestHit && closestHit.type === 'enemy') {
      affectedHits.push(closestHit);
    }

    if (Array.isArray(enemiesList)) {
      enemiesList.forEach(e => {
        if (!e || e.isDead) return;
        const ePos = e.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        const dist = ePos.distanceTo(blastPoint);
        if (dist <= blastRadius) {
          const ratio = Math.max(0.3, 1 - (dist / blastRadius));
          const targetMesh = e.targetMeshes && e.targetMeshes[0] ? e.targetMeshes[0] : null;
          if (targetMesh && (!closestHit || targetMesh !== closestHit.hit.object)) {
            affectedHits.push({
              type: 'enemy',
              hit: {
                object: targetMesh,
                point: ePos,
                splashRatio: ratio,
              }
            });
          }
        }
      });
    }

    if (affectedHits.length > 0) {
      return affectedHits;
    }
    return closestHit;
  }
}

/**
 * 6. 反物質レーザーキャノン「ネビュラ・ビーム」 (Nebula Beam)
 * - 敵貫通・超高速照射 (tick: 0.08s)
 * - 敵の群れを一撃で薙ぎ払う紫電の極太ビーム
 */
export class NebulaBeamCannon extends Weapon {
  constructor(camera, scene, audio, particles) {
    super({
      name: 'NEBULA BEAM',
      displayName: 'ネビュラ・ビーム (連続照射)',
      type: 'beam',
      damage: 22,
      headshotMultiplier: 1.8,
      fireRate: 0.08,
      magazineSize: 80,
      reserveAmmo: 320,
      reloadTime: 1.8,
      range: 120,
      spread: 0.003,
      automatic: true,
      fireMode: 'BEAM',
      hipPos: new THREE.Vector3(0.23, -0.22, -0.44),
      adsPos: new THREE.Vector3(0.0, -0.17, -0.34),
      muzzleOffset: new THREE.Vector3(0, 0.04, -0.65),
      muzzleColor: 0xd946ef,
      maxRecoilZ: 0.02,
      maxRecoilRotX: 0.015,
      recoilRecoverySpeed: 24.0,
    }, camera, scene, audio, particles);

    // チャネリング過熱・ダメージ増幅機構 (最低4段階: 照射時間に応じて威力とアニメーションが激変)
    this.channelDuration = 0.0;
    this.channelTimer = 0.0;
    this.beamHeat = 0.0;
    this.currentTier = 1;
    this.emitterRings = [];
    this.coreCapacitor = null;
    this.glowMaterial = null;
  }

  update(delta, isMoving, walkTime, isSliding) {
    super.update(delta, isMoving, walkTime, isSliding);

    // 照射が途切れたら徐々に冷却 (自然なホールド感のため減衰を緩和)
    this.channelTimer -= delta;
    if (this.channelTimer <= 0) {
      this.channelDuration = Math.max(0, this.channelDuration - delta * 1.5);
    }
    this.beamHeat = Math.min(1.0, this.channelDuration / 1.8);

    // 5段階の威力判定 (Lv.1 〜 Lv.5): 表示枠肥大化防止のため名称を排除しレベルと倍率のみ表示
    if (this.channelDuration >= 1.8) {
      this.currentTier = 5;
      this.fireMode = 'Lv.5 [MAX] (4.0x)';
    } else if (this.channelDuration >= 1.25) {
      this.currentTier = 4;
      this.fireMode = 'Lv.4 (3.0x)';
    } else if (this.channelDuration >= 0.75) {
      this.currentTier = 3;
      this.fireMode = 'Lv.3 (2.3x)';
    } else if (this.channelDuration >= 0.30) {
      this.currentTier = 2;
      this.fireMode = 'Lv.2 (1.6x)';
    } else {
      this.currentTier = 1;
      this.fireMode = 'Lv.1 (1.0x)';
    }

    // エミッターリングの高速回転 & コア蓄電アニメーション
    const spinSpeed = 3.0 + this.currentTier * 6.5;
    for (const r of this.emitterRings) {
      r.rotation.z += delta * spinSpeed;
      if (this.currentTier >= 3) {
        const pulse = 1.0 + Math.sin(walkTime * 18.0) * 0.15;
        r.scale.set(pulse, pulse, 1.0);
      } else {
        r.scale.set(1, 1, 1);
      }
    }

    // コアの蓄電発光色変化 (紫 -> シアン -> 黄金 -> 純白熱 -> 極限シアン白光)
    if (this.glowMaterial) {
      if (this.currentTier === 5) {
        this.glowMaterial.color.setHex(0x00ffff);
      } else if (this.currentTier === 4) {
        this.glowMaterial.color.setHex(0xffffff);
      } else if (this.currentTier === 3) {
        this.glowMaterial.color.setHex(0xffea00);
      } else if (this.currentTier === 2) {
        this.glowMaterial.color.setHex(0x00f3ff);
      } else {
        this.glowMaterial.color.setHex(0xd946ef);
      }
    }
  }

  buildModel() {
    const gunGroup = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.25, metalness: 0.9 });
    this.glowMaterial = new THREE.MeshBasicMaterial({ color: 0xd946ef });

    // Sleek Quantum Rail Barrel
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.62), metalMat);
    barrel.position.set(0, 0.02, -0.32);
    gunGroup.add(barrel);

    // Orbiting Emitter Rings (アニメーション対応)
    this.emitterRings = [];
    [-0.45, -0.32, -0.19].forEach((zOff, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055 + i * 0.005, 0.008, 8, 16), this.glowMaterial);
      ring.position.set(0, 0.02, zOff);
      gunGroup.add(ring);
      this.emitterRings.push(ring);
    });

    // Core Capacitor
    this.coreCapacitor = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), this.glowMaterial);
    this.coreCapacitor.rotation.x = Math.PI / 2;
    this.coreCapacitor.position.set(0, 0.02, -0.05);
    gunGroup.add(this.coreCapacitor);

    const arms = buildTacticalArms(
      gunGroup,
      new THREE.Vector3(0.02, -0.11, 0.06),
      new THREE.Vector3(-0.02, -0.07, -0.32)
    );
    gunGroup.add(arms);

    return gunGroup;
  }

  fire(raycaster, targets, colliders, hitRangeBonus = 0, enemiesList = []) {
    this.currentAmmo--;
    this.fireCooldown = this.fireRate;
    this.triggerRecoil();
    this.audio.playBeamTick();

    // 連続照射時間 (チャネリング) の蓄積
    this.channelTimer = 0.22;
    this.channelDuration = Math.min(3.0, this.channelDuration + 0.10);

    const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    raycaster.set(this.camera.position, rayDir);

    const muzzleWorld = new THREE.Vector3();
    this.muzzleLight.getWorldPosition(muzzleWorld);

    // 貫通ビーム: 射線上のすべての敵を貫通
    const allHits = raycaster.intersectObjects(targets, true);
    const wallHits = raycaster.intersectObjects(getObstacleMeshes(colliders), false);

    const maxDist = wallHits.length > 0 ? wallHits[0].distance : this.range;
    const endPoint = muzzleWorld.clone().addScaledVector(rayDir, maxDist);

    const penetratingHits = [];
    const hitEnemiesSet = new Set();

    allHits.forEach(h => {
      if (h.distance <= maxDist && h.object.userData && h.object.userData.enemy) {
        const e = h.object.userData.enemy;
        if (!hitEnemiesSet.has(e)) {
          hitEnemiesSet.add(e);
          penetratingHits.push({ type: 'enemy', hit: h });
        }
      }
    });

    // 照射時間による4段階のダメージ倍率 (1.0x -> 1.6x -> 2.3x -> 3.0x -> 4.0x)
    // ネビュラビーム近傍ヒット判定 (初期値2.0倍基準: 0.80m)
    const beamTolerance = 0.80 + hitRangeBonus * 0.8; // 0.40 * 2.0 = 0.80
    const camPos = this.camera.position;
    if (Array.isArray(enemiesList)) {
      enemiesList.forEach(e => {
        if (!e || e.isDead || hitEnemiesSet.has(e)) return;
        const enemyCenter = e.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        const toEnemy = enemyCenter.clone().sub(camPos);
        const forwardDist = toEnemy.dot(rayDir);
        if (forwardDist > 1.2 && forwardDist < maxDist) {
          const pointOnRay = camPos.clone().addScaledVector(rayDir, forwardDist);
          if (pointOnRay.distanceTo(enemyCenter) < beamTolerance) {
            const targetMesh = e.targetMeshes && e.targetMeshes[0] ? e.targetMeshes[0] : null;
            if (targetMesh) {
              hitEnemiesSet.add(e);
              penetratingHits.push({ type: 'enemy', hit: { object: targetMesh, point: enemyCenter, distance: forwardDist } });
            }
          }
        }
      });
    }

    let rampMult = 1.0;
    if (this.currentTier === 5) rampMult = 4.0;
    else if (this.currentTier === 4) rampMult = 3.0;
    else if (this.currentTier === 3) rampMult = 2.3;
    else if (this.currentTier === 2) rampMult = 1.6;
    else rampMult = 1.0;

    penetratingHits.forEach(h => {
      h.hit.rampMult = rampMult;
    });

    // 5段階のビーム視覚演出を描画
    this.particles.createNebulaBeam(muzzleWorld, endPoint, this.currentTier, 0.09);

    if (wallHits.length > 0) {
      const sparkColor = this.currentTier >= 3 ? 0x00f3ff : 0xd946ef;
      this.particles.createImpactSparks(wallHits[0].point, getSafeNormal(wallHits[0]), sparkColor, 10 + this.currentTier * 4);
    }

    if (penetratingHits.length > 0) {
      return penetratingHits;
    }
    return wallHits.length > 0 ? { type: 'wall', hit: wallHits[0] } : null;
  }
}
