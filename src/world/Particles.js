import * as THREE from 'three';

/**
 * Particle and Visual FX System
 */
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.beamTrails = [];
    this.tracers = [];
    this.ambientMotes = null;

    // Shared reusable geometry and material for ejected brass shells
    this.shellGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.045, 6);
    this.shellMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Shiny brass gold
      roughness: 0.35,
      metalness: 0.9,
    });

    this.maxParticles = 80;
    this.maxBeamTrails = 12;

    // 高速火線トレーサー専用オブジェクトプール (毎秒数十回のGeometry生成・破棄によるGCスタッターとNaNを根絶)
    this.tracerPoolSize = 64;
    this.tracerPool = [];
    this.tracerPoolIndex = 0;
    for (let i = 0; i < this.tracerPoolSize; i++) {
      const posArray = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 500);
      const mat = new THREE.LineBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      this.scene.add(line);
      this.tracerPool.push({
        mesh: line,
        posArray: posArray,
        posAttr: geo.attributes.position,
        mat: mat,
        life: 0,
        active: false,
      });
    }

    this.createAmbientMotes();
  }

  // パーティクル・爆風エフェクトの完全破棄 (フィールド残留防止)
  _disposeParticle(p) {
    if (!p) return;
    if (p.mesh) {
      this.scene.remove(p.mesh);
      if (p.type !== 'shell') {
        if (p.mesh.geometry) p.mesh.geometry.dispose();
        if (p.mesh.material) p.mesh.material.dispose();
      }
    }
    if (p.pieces) {
      for (const item of p.pieces) {
        if (item.mesh) this.scene.remove(item.mesh);
      }
      if (p.debrisGeo) p.debrisGeo.dispose();
      if (p.debrisMat) p.debrisMat.dispose();
    }
    if (p.ring) {
      this.scene.remove(p.ring);
      if (p.ring.geometry) p.ring.geometry.dispose();
      if (p.ring.material) p.ring.material.dispose();
    }
    if (p.type === 'blast') {
      if (p.fireball) {
        this.scene.remove(p.fireball);
        p.fireball.geometry?.dispose();
        p.fireball.material?.dispose();
      }
      if (p.ring1) {
        this.scene.remove(p.ring1);
        p.ring1.geometry?.dispose();
        p.ring1.material?.dispose();
      }
      if (p.ring2) {
        this.scene.remove(p.ring2);
        p.ring2.geometry?.dispose();
        p.ring2.material?.dispose();
      }
      if (p.flashLight) {
        this.scene.remove(p.flashLight);
        p.flashLight.dispose?.();
      }
      if (p.shrapnelPieces) {
        for (const item of p.shrapnelPieces) {
          if (item.mesh) this.scene.remove(item.mesh);
        }
        p.shrapnelGeo?.dispose();
        p.shrapnelMat?.dispose();
      }
      if (p.smokePieces) {
        for (const item of p.smokePieces) {
          if (item.mesh) this.scene.remove(item.mesh);
        }
        p.smokeGeo?.dispose();
        p.smokeMat?.dispose();
      }
    }
  }

  _pruneOldParticles() {
    while (this.particles.length > this.maxParticles) {
      const old = this.particles.shift();
      this._disposeParticle(old);
    }
  }

  _disposeBeam(b) {
    if (!b) return;
    if (b.mesh1) {
      this.scene.remove(b.mesh1);
      b.mesh1.geometry?.dispose();
      b.mesh1.material?.dispose();
    }
    if (b.mesh2) {
      this.scene.remove(b.mesh2);
      b.mesh2.geometry?.dispose();
      b.mesh2.material?.dispose();
    }
    if (b.extraMeshes) {
      for (const m of b.extraMeshes) {
        this.scene.remove(m);
        m.geometry?.dispose();
        m.material?.dispose();
      }
    }
    if (b.light) {
      this.scene.remove(b.light);
      b.light.dispose?.();
    }
  }

  // ゲームリセット時やステージクリア時に全パーティクル・光線を完全消去
  clear() {
    for (const p of this.particles) {
      this._disposeParticle(p);
    }
    this.particles = [];

    for (const b of this.beamTrails) {
      this._disposeBeam(b);
    }
    this.beamTrails = [];

    if (this.tracerPool) {
      for (const t of this.tracerPool) {
        t.mesh.visible = false;
        t.active = false;
        t.life = 0;
      }
    }
  }

  // Floating golden sun motes and pollen across the natural field
  createAmbientMotes() {
    const count = 60; // 負荷対策: 100 -> 60に最適化
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 20 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

      // Natural warm sunlit golden & leaf green motes
      const isSun = Math.random() > 0.4;
      colors[i * 3 + 0] = isSun ? 1.0 : 0.45;
      colors[i * 3 + 1] = isSun ? 0.92 : 0.75;
      colors[i * 3 + 2] = isSun ? 0.65 : 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    this.ambientMotes = new THREE.Points(geometry, material);
    this.scene.add(this.ambientMotes);
  }

  // Create sparks upon impact with wall or object (NaN防護 & BoundingSphere事前定義)
  createImpactSparks(position, normal, colorHex = 0xffaa00, count = 10) {
    if (!position || isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) return;
    const nx = (normal && !isNaN(normal.x)) ? normal.x : 0;
    const ny = (normal && !isNaN(normal.y)) ? normal.y : 1;
    const nz = (normal && !isNaN(normal.z)) ? normal.z : 0;

    this._pruneOldParticles();
    const safeCount = Math.min(count, 12);
    const sparkGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(safeCount * 3);
    const vels = [];

    for (let i = 0; i < safeCount; i++) {
      pos[i * 3 + 0] = position.x;
      pos[i * 3 + 1] = position.y;
      pos[i * 3 + 2] = position.z;

      const spread = 1.2;
      const vx = nx * 4 + (Math.random() - 0.5) * spread * 6;
      const vy = ny * 4 + (Math.random() - 0.2) * spread * 6;
      const vz = nz * 4 + (Math.random() - 0.5) * spread * 6;
      vels.push(new THREE.Vector3(vx, vy, vz));
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sparkGeo.boundingSphere = new THREE.Sphere(position.clone(), 15);

    const sparkMat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.18,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });

    const pSystem = new THREE.Points(sparkGeo, sparkMat);
    this.scene.add(pSystem);

    this.particles.push({
      mesh: pSystem,
      vels: vels,
      life: 0.25,
      maxLife: 0.25,
      type: 'sparks',
    });
  }

  // Railgun / Beam laser trail with color and lifetime parameter
  createRailgunBeam(startPos, endPos, coreColor = 0x00f3ff, outerColor = 0x0099ff, duration = 0.18) {
    if (!startPos || !endPos) return;
    if (isNaN(startPos.x) || isNaN(startPos.y) || isNaN(startPos.z)) return;
    if (isNaN(endPos.x) || isNaN(endPos.y) || isNaN(endPos.z)) return;
    while (this.beamTrails.length >= this.maxBeamTrails) {
      const old = this.beamTrails.shift();
      this.scene.remove(old.mesh1, old.mesh2);
      old.mesh1.geometry.dispose();
      old.mesh1.material.dispose();
      old.mesh2.geometry.dispose();
      this._disposeBeam(old);
    }

    const distance = startPos.distanceTo(endPos);
    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);

    // Glowing beam cylinder
    const geo = new THREE.CylinderGeometry(0.06, 0.06, distance, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    const cylinder = new THREE.Mesh(geo, mat);
    cylinder.position.copy(midPoint);
    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(endPos, startPos).normalize());
    this.scene.add(cylinder);

    // Outer glow cylinder
    const outerGeo = new THREE.CylinderGeometry(0.18, 0.18, distance, 8);
    const outerMat = new THREE.MeshBasicMaterial({
      color: outerColor,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const outerCylinder = new THREE.Mesh(outerGeo, outerMat);
    outerCylinder.position.copy(midPoint);
    outerCylinder.quaternion.copy(cylinder.quaternion);
    this.scene.add(outerCylinder);

    this.beamTrails.push({
      mesh1: cylinder,
      mesh2: outerCylinder,
      life: duration,
      maxLife: duration,
    });
  }

  // ユーザー要望: ネビュラ・ビーム専用 4段階特大ビーム演出 (最低4段階)
  // Lv.1 (細紫レーザー) -> Lv.2 (青紫電漿) -> Lv.3 (黄金衝撃プラズマ+衝撃波リング) -> Lv.4 (純白超弩級破滅光線+多重光環+閃光)
  createNebulaBeam(startPos, endPos, tierLevel = 1, duration = 0.09) {
    if (!startPos || !endPos) return;
    if (isNaN(startPos.x) || isNaN(startPos.y) || isNaN(startPos.z)) return;
    if (isNaN(endPos.x) || isNaN(endPos.y) || isNaN(endPos.z)) return;

    while (this.beamTrails.length >= this.maxBeamTrails) {
      const old = this.beamTrails.shift();
      this._disposeBeam(old);
    }

    const distance = Math.max(1, startPos.distanceTo(endPos));
    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    let innerRadius = 0.05;
    let outerRadius = 0.14;
    let coreColor = 0xd946ef;
    let outerColor = 0x7928ca;
    let ringCount = 0;
    let lightIntensity = 0;

    if (tierLevel === 1) {
      // Lv.1: 通常紫電ビーム (細身)
      innerRadius = 0.05;
      outerRadius = 0.15;
      coreColor = 0xdf4df0;
      outerColor = 0x86198f;
    } else if (tierLevel === 2) {
      // Lv.2: 帯電プラズマビーム (太さ2倍、シアン×マゼンタ)
      innerRadius = 0.11;
      outerRadius = 0.32;
      coreColor = 0x00f3ff;
      outerColor = 0xd946ef;
      ringCount = 1;
      lightIntensity = 5;
    } else if (tierLevel === 3) {
      // Lv.3: 超高圧ソーラービーム (太さ3.5倍、黄金コア×シアン放電)
      innerRadius = 0.20;
      outerRadius = 0.55;
      coreColor = 0xfff066;
      outerColor = 0x00f3ff;
      ringCount = 3;
      lightIntensity = 14;
    } else {
      // Lv.4: MAX OVERLOAD 破滅光線 (太さ6倍超、白熱純白核×極光シアン大気電離)
      innerRadius = 0.34;
      outerRadius = 0.92;
      coreColor = 0xffffff;
      outerColor = 0x00f3ff;
      ringCount = 5;
      lightIntensity = 28;
    }

    // 1. コア光線
    const coreGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, distance, 8);
    const coreMat = new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.copy(midPoint);
    coreMesh.quaternion.copy(orientation);
    this.scene.add(coreMesh);

    // 2. 外郭プラズマオーラ
    const outerGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, distance, 8);
    const outerMat = new THREE.MeshBasicMaterial({
      color: outerColor,
      transparent: true,
      opacity: tierLevel >= 3 ? 0.65 : 0.45,
      blending: THREE.AdditiveBlending,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.position.copy(midPoint);
    outerMesh.quaternion.copy(orientation);
    this.scene.add(outerMesh);

    // 3. 多重エナジーリング (Lv.2以上)
    const extraMeshes = [];
    if (ringCount > 0) {
      for (let r = 0; r < ringCount; r++) {
        const ringFraction = (r + 1) / (ringCount + 1);
        const ringPos = startPos.clone().lerp(endPos, ringFraction);
        const ringRadius = outerRadius * (1.3 + r * 0.25);
        const ringGeo = new THREE.RingGeometry(ringRadius * 0.7, ringRadius, 16);
        const ringMat = new THREE.MeshBasicMaterial({
          color: coreColor,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(ringPos);
        ringMesh.quaternion.copy(orientation);
        ringMesh.rotateX(Math.PI / 2);
        this.scene.add(ringMesh);
        extraMeshes.push(ringMesh);
      }
    }

    // 4. ダイナミックライト (Lv.2以上)
    let flashLight = null;
    if (lightIntensity > 0) {
      flashLight = new THREE.PointLight(coreColor, lightIntensity, 25, 2);
      flashLight.position.copy(midPoint);
      this.scene.add(flashLight);
    }

    this.beamTrails.push({
      mesh1: coreMesh,
      mesh2: outerMesh,
      extraMeshes: extraMeshes,
      light: flashLight,
      life: duration,
      maxLife: duration,
    });
  }

  // Bullet tracer (事前生成プールから利用して毎秒90+回のGeometry生成・破棄をゼロ化)
  createBulletTracer(startPos, endPos, colorHex = 0xffcc44) {
    if (!startPos || !endPos) return;
    if (isNaN(startPos.x) || isNaN(startPos.y) || isNaN(startPos.z)) return;
    if (isNaN(endPos.x) || isNaN(endPos.y) || isNaN(endPos.z)) return;

    if (!this.tracerPool || this.tracerPool.length === 0) return;

    const t = this.tracerPool[this.tracerPoolIndex];
    this.tracerPoolIndex = (this.tracerPoolIndex + 1) % this.tracerPoolSize;

    const arr = t.posArray;
    arr[0] = startPos.x;
    arr[1] = startPos.y;
    arr[2] = startPos.z;
    arr[3] = endPos.x;
    arr[4] = endPos.y;
    arr[5] = endPos.z;
    t.posAttr.needsUpdate = true;

    t.mat.color.setHex(colorHex);
    t.mat.opacity = 0.85;
    t.mesh.visible = true;
    t.life = 0.08;
    t.active = true;
  }

  // エイリアス: createTracer (Arsenal.jsの武器4, 5からの呼出に対応)
  createTracer(startPos, endPos, colorHex = 0x00f3ff) {
    this.createBulletTracer(startPos, endPos, colorHex);
  }

  // Enemy explosion
  createExplosion(position, colorHex = 0xff0055) {
    const count = 28;
    const pieces = [];

    const debrisGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const debrisMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.8,
    });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(debrisGeo, debrisMat);
      mesh.position.copy(position);
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        Math.random() * 12 + 2,
        (Math.random() - 0.5) * 16
      );

      const rot = new THREE.Vector3(
        Math.random() * 10,
        Math.random() * 10,
        Math.random() * 10
      );

      pieces.push({ mesh, vel, rot });
    }

    // Expanding shockwave ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.3, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);

    this.particles.push({
      pieces: pieces,
      debrisGeo: debrisGeo,
      debrisMat: debrisMat,
      ring: ring,
      life: 0.75,
      maxLife: 0.75,
      type: 'explosion',
    });
  }

  // EXステージ専用：空中3段ジャンプ反重力スラスター噴射＆衝撃波リング
  createThrusterBlast(position, colorHex = 0xffd700) {
    this._pruneOldParticles();
    const ringGeo = new THREE.RingGeometry(0.2, 0.6, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(position.x, Math.max(0.1, position.y - 0.2), position.z);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);

    this.particles.push({
      ring: ring,
      life: 0.35,
      maxLife: 0.35,
      type: 'blastRing',
    });

    this.createImpactSparks(position, new THREE.Vector3(0, -1, 0), colorHex, 24);
  }

  // 榴弾砲 (武器5) & 手榴弾 専用の特大爆風演出 (火球・二重衝撃波・閃光・破片・硝煙)
  createBlastExplosion(position, colorHex = 0xff5500, scale = 1.3) {
    this._pruneOldParticles();

    // 1. 白熱火球 (急速膨張する半透明球体)
    const fireballGeo = new THREE.SphereGeometry(0.6 * scale, 16, 12);
    const fireballMat = new THREE.MeshBasicMaterial({
      color: 0xfff0cc,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const fireball = new THREE.Mesh(fireballGeo, fireballMat);
    fireball.position.copy(position);
    this.scene.add(fireball);

    // 2. 二重衝撃波リング (地表沿い水平ショックウェーブ)
    const ringGeo1 = new THREE.RingGeometry(0.2 * scale, 0.65 * scale, 32);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.position.copy(position);
    ring1.position.y += 0.08;
    ring1.rotation.x = Math.PI / 2;
    this.scene.add(ring1);

    const ringGeo2 = new THREE.RingGeometry(0.15 * scale, 0.45 * scale, 24);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.position.copy(position);
    ring2.position.y += 0.14;
    ring2.rotation.x = Math.PI / 2;
    this.scene.add(ring2);

    // 3. 瞬間爆発閃光 (ダイナミックライト)
    const flashLight = new THREE.PointLight(colorHex, 10.0 * scale, 28.0 * scale, 1.8);
    flashLight.position.copy(position);
    flashLight.position.y += 0.8;
    this.scene.add(flashLight);

    // 4. 灼熱の飛び散る破片 (Shrapnel)
    const shrapnelCount = 36;
    const shrapnelPieces = [];
    const shrapnelGeo = new THREE.BoxGeometry(0.18 * scale, 0.18 * scale, 0.18 * scale);
    const shrapnelMat = new THREE.MeshStandardMaterial({
      color: 0xff3300,
      emissive: 0xffaa00,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8,
    });

    for (let i = 0; i < shrapnelCount; i++) {
      const mesh = new THREE.Mesh(shrapnelGeo, shrapnelMat);
      mesh.position.copy(position);
      this.scene.add(mesh);

      const speed = (16 + Math.random() * 20) * scale;
      const angleH = Math.random() * Math.PI * 2;
      const angleV = (Math.random() * 0.75 + 0.1) * Math.PI;
      const vel = new THREE.Vector3(
        Math.cos(angleH) * Math.sin(angleV) * speed,
        Math.cos(angleV) * speed + 3.0,
        Math.sin(angleH) * Math.sin(angleV) * speed
      );
      const rot = new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      );
      shrapnelPieces.push({ mesh, vel, rot });
    }

    // 5. 立ち昇る硝煙プルーム (Smoke Puffs)
    const smokeCount = 16;
    const smokePieces = [];
    const smokeGeo = new THREE.DodecahedronGeometry(0.55 * scale, 0);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x3a3430,
      transparent: true,
      opacity: 0.70,
    });

    for (let i = 0; i < smokeCount; i++) {
      const mesh = new THREE.Mesh(smokeGeo, smokeMat);
      mesh.position.set(
        position.x + (Math.random() - 0.5) * 1.4 * scale,
        position.y + 0.3 + Math.random() * 0.9 * scale,
        position.z + (Math.random() - 0.5) * 1.4 * scale
      );
      this.scene.add(mesh);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3.8 * scale,
        (3.0 + Math.random() * 5.0) * scale,
        (Math.random() - 0.5) * 3.8 * scale
      );
      smokePieces.push({ mesh, vel, scaleSpeed: 2.5 + Math.random() * 2.0 });
    }

    this.particles.push({
      type: 'blast',
      life: 0.95,
      maxLife: 0.95,
      scale,
      fireball,
      ring1,
      ring2,
      flashLight,
      shrapnelPieces,
      shrapnelGeo,
      shrapnelMat,
      smokePieces,
      smokeGeo,
      smokeMat,
    });
  }

  // スライディング摩擦の土埃・芝生パーティクル
  createSlideDust(position, direction, colorHex = 0x8b7355) {
    if (!position || isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) return;
    const dx = (direction && !isNaN(direction.x)) ? direction.x : 0;
    const dz = (direction && !isNaN(direction.z)) ? direction.z : 0;

    const count = 12;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vels = [];

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = position.x + (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 1] = 0.1 + Math.random() * 0.15;
      pos[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.4;

      // Spray backwards opposite to sliding direction
      const vx = -dx * 2.5 + (Math.random() - 0.5) * 1.8;
      const vy = 1.0 + Math.random() * 1.5;
      const vz = -dz * 2.5 + (Math.random() - 0.5) * 1.8;
      vels.push(new THREE.Vector3(vx, vy, vz));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.boundingSphere = new THREE.Sphere(position.clone(), 6);
    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.22,
      transparent: true,
      opacity: 0.75,
    });
    const pMesh = new THREE.Points(geo, mat);
    this.scene.add(pMesh);

    this.particles.push({
      mesh: pMesh,
      vels: vels,
      life: 0.45,
      maxLife: 0.45,
      type: 'slideDust',
    });
  }

  // 銃口のリアルな硝煙・煙パフ (Muzzle Smoke)
  createMuzzleSmoke(barrelWorldPos, forwardDir) {
    if (!barrelWorldPos || isNaN(barrelWorldPos.x) || isNaN(barrelWorldPos.y) || isNaN(barrelWorldPos.z)) return;
    const fx = (forwardDir && !isNaN(forwardDir.x)) ? forwardDir.x : 0;
    const fz = (forwardDir && !isNaN(forwardDir.z)) ? forwardDir.z : -1;

    const count = 3;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vels = [];

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = barrelWorldPos.x + (Math.random() - 0.5) * 0.04;
      pos[i * 3 + 1] = barrelWorldPos.y + (Math.random() - 0.5) * 0.04;
      pos[i * 3 + 2] = barrelWorldPos.z + (Math.random() - 0.5) * 0.04;

      const vx = fx * 0.8 + (Math.random() - 0.5) * 0.3;
      const vy = 0.6 + Math.random() * 0.6; // Rises upwards
      const vz = fz * 0.8 + (Math.random() - 0.5) * 0.3;
      vels.push(new THREE.Vector3(vx, vy, vz));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.boundingSphere = new THREE.Sphere(barrelWorldPos.clone(), 4);
    const mat = new THREE.PointsMaterial({
      color: 0xcccccc,
      size: 0.35,
      transparent: true,
      opacity: 0.5,
    });
    const pMesh = new THREE.Points(geo, mat);
    this.scene.add(pMesh);

    this.particles.push({
      mesh: pMesh,
      vels: vels,
      life: 0.55,
      maxLife: 0.55,
      type: 'smoke',
    });
  }

  // 薬莢排出 (Ejected Brass Shell Casing - Reuses pooled geometry/material)
  createEjectedShell(chamberWorldPos, rightDir) {
    // Cap active shells to avoid memory clutter
    const activeShells = this.particles.filter(p => p.type === 'shell');
    if (activeShells.length > 12) {
      const oldest = activeShells[0];
      oldest.life = 0;
    }

    const shell = new THREE.Mesh(this.shellGeo, this.shellMat);
    shell.position.copy(chamberWorldPos);

    // Eject velocity: to the right and upwards
    const vel = rightDir.clone().multiplyScalar(2.2 + Math.random() * 0.8);
    vel.y += 1.8 + Math.random() * 0.6;

    const rotVel = new THREE.Vector3(
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 25
    );

    this.scene.add(shell);

    this.particles.push({
      mesh: shell,
      vel: vel,
      rotVel: rotVel,
      life: 0.9,
      maxLife: 0.9,
      type: 'shell',
    });
  }

  update(delta) {
    // Update ambient motes gently
    if (this.ambientMotes) {
      const positions = this.ambientMotes.geometry.attributes.position.array;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] += delta * 0.4;
        if (positions[i * 3 + 1] > 25) {
          positions[i * 3 + 1] = 0.5;
        }
      }
      this.ambientMotes.geometry.attributes.position.needsUpdate = true;
    }

    // Update railgun and nebula beams
    for (let i = this.beamTrails.length - 1; i >= 0; i--) {
      const b = this.beamTrails[i];
      b.life -= delta;
      const progress = Math.max(0, b.life / b.maxLife);
      if (b.mesh1 && b.mesh1.material) b.mesh1.material.opacity = progress * 0.95;
      if (b.mesh2 && b.mesh2.material) b.mesh2.material.opacity = progress * 0.55;
      if (b.extraMeshes) {
        for (const m of b.extraMeshes) {
          if (m.material) m.material.opacity = progress * 0.85;
          m.rotation.z += delta * 6.0;
        }
      }
      if (b.light) {
        b.light.intensity = (b.light.maxIntensity || 10) * progress;
      }

      if (b.life <= 0) {
        this._disposeBeam(b);
        this.beamTrails.splice(i, 1);
      }
    }

    // Update bullet tracers pool (zero GC allocations)
    if (this.tracerPool) {
      for (let i = 0; i < this.tracerPoolSize; i++) {
        const t = this.tracerPool[i];
        if (t.active) {
          t.life -= delta;
          if (t.life <= 0) {
            t.mesh.visible = false;
            t.active = false;
          }
        }
      }
    }

    // Update regular particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      const progress = Math.max(0, p.life / p.maxLife);

      if (p.type === 'sparks') {
        const positions = p.mesh.geometry.attributes.position.array;
        for (let j = 0; j < p.vels.length; j++) {
          p.vels[j].y -= 9.8 * delta * 1.5; // gravity
          positions[j * 3 + 0] += p.vels[j].x * delta;
          positions[j * 3 + 1] += p.vels[j].y * delta;
          positions[j * 3 + 2] += p.vels[j].z * delta;
        }
        p.mesh.geometry.attributes.position.needsUpdate = true;
        p.mesh.material.opacity = progress;
      } else if (p.type === 'slideDust' || p.type === 'smoke') {
        const positions = p.mesh.geometry.attributes.position.array;
        for (let j = 0; j < p.vels.length; j++) {
          positions[j * 3 + 0] += p.vels[j].x * delta;
          positions[j * 3 + 1] += p.vels[j].y * delta;
          positions[j * 3 + 2] += p.vels[j].z * delta;
          if (p.type === 'slideDust') {
            p.vels[j].y -= 9.8 * delta; // gravity
          }
        }
        p.mesh.geometry.attributes.position.needsUpdate = true;
        p.mesh.material.opacity = progress * (p.type === 'smoke' ? 0.45 : 0.7);
      } else if (p.type === 'shell') {
        p.vel.y -= 16.0 * delta; // gravity
        p.mesh.position.addScaledVector(p.vel, delta);
        p.mesh.rotation.x += p.rotVel.x * delta;
        p.mesh.rotation.y += p.rotVel.y * delta;
        p.mesh.rotation.z += p.rotVel.z * delta;

        if (p.mesh.position.y <= 0.02) {
          p.mesh.position.y = 0.02;
          p.vel.y = -p.vel.y * 0.4;
          p.vel.x *= 0.6;
          p.vel.z *= 0.6;
          p.rotVel.multiplyScalar(0.5);
        }
      } else if (p.type === 'blast') {
        const t = 1.0 - progress; // 0 (start) -> 1 (end)

        // 1. 火球: 最初の0.25秒で一気に6倍まで拡大し、その後急速に薄れて消える
        if (p.fireball) {
          const fbScale = (1.0 + Math.pow(t, 0.4) * 5.0) * p.scale;
          p.fireball.scale.set(fbScale, fbScale, fbScale);
          p.fireball.material.opacity = Math.max(0, 1.0 - t * 2.2);
        }

        // 2. 衝撃波リング: 外側へ音速で放射状に拡大
        if (p.ring1) {
          const r1Scale = (1.0 + t * 14.0) * p.scale;
          p.ring1.scale.set(r1Scale, r1Scale, 1);
          p.ring1.material.opacity = Math.max(0, (1.0 - t) * 0.95);
        }
        if (p.ring2) {
          const r2Scale = (1.0 + t * 18.0) * p.scale;
          p.ring2.scale.set(r2Scale, r2Scale, 1);
          p.ring2.material.opacity = Math.max(0, (1.0 - t * 1.2) * 0.85);
        }

        // 3. 閃光ライト: 0.15秒で急速減衰
        if (p.flashLight) {
          p.flashLight.intensity = Math.max(0, 10.0 * p.scale * (1.0 - t * 5.0));
        }

        // 4. 破片: 重力で放物線落下 + 回転 + 地面バウンド
        if (p.shrapnelPieces) {
          for (const item of p.shrapnelPieces) {
            item.vel.y -= 26.0 * delta; // 重力
            item.mesh.position.addScaledVector(item.vel, delta);
            item.mesh.rotation.x += item.rot.x * delta;
            item.mesh.rotation.y += item.rot.y * delta;
            if (item.mesh.position.y <= 0.08) {
              item.mesh.position.y = 0.08;
              item.vel.y = -item.vel.y * 0.35;
              item.vel.x *= 0.65;
              item.vel.z *= 0.65;
            }
          }
        }

        // 5. 硝煙: 上昇しながらモクモク膨張 & フェード
        if (p.smokePieces) {
          for (const item of p.smokePieces) {
            item.mesh.position.addScaledVector(item.vel, delta);
            item.vel.multiplyScalar(0.96); // 空気抵抗
            const currentScale = item.mesh.scale.x + delta * item.scaleSpeed;
            item.mesh.scale.set(currentScale, currentScale, currentScale);
          }
          if (p.smokeMat) {
            p.smokeMat.opacity = Math.max(0, progress * 0.7);
          }
        }
      } else if (p.type === 'explosion') {
        const t = 1.0 - progress;
        if (p.ring) {
          const rScale = 1.0 + t * 9.0;
          p.ring.scale.set(rScale, rScale, 1);
          p.ring.material.opacity = progress * 0.9;
        }
        if (p.pieces) {
          for (const item of p.pieces) {
            item.vel.y -= 20.0 * delta;
            item.mesh.position.addScaledVector(item.vel, delta);
            item.mesh.rotation.x += item.rot.x * delta;
            item.mesh.rotation.y += item.rot.y * delta;
            item.mesh.rotation.z += item.rot.z * delta;
          }
        }
      } else if (p.type === 'blastRing') {
        const t = 1.0 - progress;
        const s = 1.0 + t * 9.0;
        p.ring.scale.set(s, s, 1);
        p.ring.material.opacity = progress * 0.95;
      }

      if (p.life <= 0) {
        this._disposeParticle(p);
        this.particles.splice(i, 1);
      }
    }
  }
}
