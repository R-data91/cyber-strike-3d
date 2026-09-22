import * as THREE from 'three';

/**
 * Tactical Combat Drone (自律浮遊防衛ドローン / オービタル・ビット)
 * - プレイヤーの周囲を滑らかに周回旋回し、接近する敵を自動捕捉してプラズマ援護射撃を行う。
 */
export class TacticalDrone {
  constructor(player, scene, audio, particles, index = 0, totalDrones = 1) {
    this.player = player;
    this.scene = scene;
    this.audio = audio;
    this.particles = particles;
    this.index = index;
    this.totalDrones = totalDrones;

    this.orbitRadius = 1.35;
    this.orbitSpeed = 1.6;
    this.fireCooldown = 0.4 + index * 0.2; // 少し時間差をつけてリズミカルに射撃
    this.baseInterval = 0.68;
    this.range = 28.0;
    this.time = index * (Math.PI * 2 / Math.max(1, totalDrones));

    this.mesh = this.buildModel();
    this.scene.add(this.mesh);

    // Initial position
    const pPos = this.player.position;
    this.mesh.position.set(pPos.x, pPos.y + 1.6, pPos.z);
  }

  buildModel() {
    const droneGroup = new THREE.Group();

    // 1. 中央装甲ボディ (サイバーダークチタン)
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x0a1420,
      metalness: 0.85,
      roughness: 0.25,
    });
    const hullGeo = new THREE.CylinderGeometry(0.11, 0.08, 0.07, 8);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.y = Math.PI / 8;
    droneGroup.add(hull);

    // 2. センサーアイ (シアン発光コア)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const eyeGeo = new THREE.SphereGeometry(0.038, 8, 8);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 0.015, -0.09);
    droneGroup.add(eye);

    // 3. 小型プラズマ銃身 (アンダーマウント)
    const gunGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6);
    gunGeo.rotateX(Math.PI / 2);
    const gun = new THREE.Mesh(gunGeo, hullMat);
    gun.position.set(0, -0.035, -0.08);
    droneGroup.add(gun);
    this.gunMuzzle = gun;

    // 4. 左右ホバーウィング／スタビライザー
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.4,
    });
    const wingGeo = new THREE.BoxGeometry(0.32, 0.015, 0.07);
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(0, 0.01, 0.02);
    droneGroup.add(wings);

    // 5. 下部ホバースラスタ発光リング
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const thrusterGeo = new THREE.RingGeometry(0.03, 0.06, 8);
    thrusterGeo.rotateX(Math.PI / 2);
    const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    thruster.position.set(0, -0.04, 0);
    droneGroup.add(thruster);

    droneGroup.scale.set(1.1, 1.1, 1.1);
    return droneGroup;
  }

  updateFormation(index, totalDrones) {
    this.index = index;
    this.totalDrones = totalDrones;
  }

  update(delta, enemiesList = []) {
    if (!this.player || !this.mesh) return;

    this.time += delta * this.orbitSpeed;
    const baseAngle = this.time + (this.index * (Math.PI * 2 / Math.max(1, this.totalDrones)));

    // プレイヤーの周囲を滑らかに周回 (ボブ運動つき)
    const pPos = this.player.position;
    const targetX = pPos.x + Math.cos(baseAngle) * this.orbitRadius;
    const targetZ = pPos.z + Math.sin(baseAngle) * this.orbitRadius;
    const targetY = pPos.y + 1.65 + Math.sin(this.time * 3.5 + this.index) * 0.10;

    const targetPos = new THREE.Vector3(targetX, targetY, targetZ);
    this.mesh.position.lerp(targetPos, Math.min(1.0, delta * 9.0));

    // 射撃クールダウン
    const fireInterval = Math.max(0.28, this.baseInterval / (this.player.fireRateMultiplier || 1.0));
    this.fireCooldown -= delta;

    // 索敵＆自律射撃
    if (this.fireCooldown <= 0 && Array.isArray(enemiesList) && enemiesList.length > 0) {
      let closestEnemy = null;
      let closestDist = this.range;
      const dronePos = this.mesh.position;

      for (const e of enemiesList) {
        if (!e || e.isDead || e.isDying) continue;
        const ePos = e.position.clone().add(new THREE.Vector3(0, 1.0, 0));
        const dist = dronePos.distanceTo(ePos);
        if (dist < closestDist) {
          closestDist = dist;
          closestEnemy = e;
        }
      }

      if (closestEnemy) {
        this.fireCooldown = fireInterval;
        const targetCenter = closestEnemy.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        this.mesh.lookAt(targetCenter);

        // ダメージ計算 (基礎18 + プレイヤー攻撃力倍率)
        const baseDmg = 18;
        const totalDamage = Math.round(baseDmg * (this.player.damageMultiplier || 1.0));
        const targetMesh = closestEnemy.targetMeshes && closestEnemy.targetMeshes[0] ? closestEnemy.targetMeshes[0] : null;

        const isLethal = closestEnemy.takeDamage(totalDamage, false, targetMesh);
        if (this.audio && typeof this.audio.playDroneShot === 'function') {
          this.audio.playDroneShot();
        }

        // 銃口からのプラズマ光弾トレーサー
        const muzzlePos = new THREE.Vector3();
        this.gunMuzzle.getWorldPosition(muzzlePos);
        if (this.particles) {
          this.particles.createTracer(muzzlePos, targetCenter, 0x00f3ff);
          this.particles.createImpactSparks(targetCenter, new THREE.Vector3(0, 1, 0), 0x00f3ff, 6);
        }

        if (this.player.onHitEnemy) {
          this.player.onHitEnemy(totalDamage, false, isLethal, closestEnemy);
        }
      } else {
        // 敵がいない時は旋回方向に自然に前傾
        const forwardAngle = baseAngle + Math.PI / 2;
        const forwardTarget = new THREE.Vector3(
          dronePos.x + Math.cos(forwardAngle),
          dronePos.y,
          dronePos.z + Math.sin(forwardAngle)
        );
        this.mesh.lookAt(forwardTarget);
      }
    }
  }

  dispose() {
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
      this.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
  }
}
