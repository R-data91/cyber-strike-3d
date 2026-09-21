import * as THREE from 'three';
import { disposeHierarchy } from '../utils/dispose.js';

/**
 * Multi-Biome Arena Level with Dynamic Elevation & Buildings (Ver 4.0)
 * - Circular arena with radius = 50m
 * - 32 perimeter boundary rocks forming circular perimeter
 * - Consolidated single central super jump pad at (0, 0, 0)
 * - 10 unique cyber biomes with realistic structures:
 *   houses with rooftop vantage points, access ramps, tactical blast walls, and high elevation platforms.
 */
export class Level {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.colliderMeshes = [];
    this.jumpPads = [];
    this.trees = [];
    this.currentBiome = 'shinjuku';
    this.altitude = 0;
    this.onAltitudeUpdate = null;
    this.exDustParticles = null;
    this.exRings = [];

    // Root group for all level geometry (enables clean hot-swapping)
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    this.buildBiome('shinjuku');
  }

  /**
   * Cleans up existing level meshes and colliders, then constructs the new biome.
   */
  setBiome(waveNumber, forceEX = false) {
    if (waveNumber > 100 || forceEX) {
      if (this.currentBiome === 'ex_ascension') {
        return {
          name: 'ex_ascension',
          label: '【超軌道昇降機】エーテル・アセンション (EX STAGE)',
        };
      }
      this.currentBiome = 'ex_ascension';
      this.altitude = 100000;
      this.clearMap();
      this.buildBiome('ex_ascension');
      return {
        name: 'ex_ascension',
        label: '【超軌道昇降機】エーテル・アセンション (EX STAGE)',
      };
    }

    const biomeTypes = [
      'shinjuku',
      'slums',
      'matrix',
      'wasteland',
      'arctic',
      'orbital',
      'biodome',
      'catacombs',
      'solar',
      'abyss',
    ];
    // ユーザー要望: ステージ順序をランダム抽選 (直前のバイオームが連続しないよう制御)
    let available = biomeTypes.filter(b => b !== this.currentBiome);
    if (available.length === 0) available = biomeTypes;
    const newBiome = available[Math.floor(Math.random() * available.length)];

    this.currentBiome = newBiome;
    this.altitude = 0;
    this.clearMap();
    this.buildBiome(newBiome);

    const biomeLabels = {
      shinjuku: '【サイバー都市】ネオ・シンジュク',
      slums: '【電脳廃墟】インダストリアル・スラム',
      matrix: '【電子迷宮】サイバー・マトリクス',
      wasteland: '【灼熱熔岩】クリムゾン・ウェイスト',
      arctic: '【白銀極地】アークティック・リサーチ',
      orbital: '【軌道浮遊】オービタル・ドック',
      biodome: '【変異密林】アシッド・バイオドーム',
      catacombs: '【聖堂地下】サンクチュアリ・カタコンベ',
      solar: '【黄金砂海】ソーラー・アレイ',
      abyss: '【深核空洞】アビス・コア',
      ex_ascension: '【超軌道昇降機】エーテル・アセンション (EX STAGE)',
    };

    return {
      name: newBiome,
      label: biomeLabels[newBiome] || '未知の戦域',
    };
  }

  clearMap() {
    this.exDustParticles = null;
    this.exRings = [];
    this.exPlanet = null;
    this.exCoreMesh = null;
    this.exCoreRing = null;
    this.exVaporRings = [];
    this.exPillarPulses = [];

    while (this.levelGroup.children.length > 0) {
      const obj = this.levelGroup.children[0];
      this.levelGroup.remove(obj);
      disposeHierarchy(obj);
    }

    this.colliders = [];
    this.colliderMeshes = [];
    this.jumpPads = [];
    this.trees = [];
  }

  buildBiome(biome) {
    if (biome === 'ex_ascension') {
      this.buildExAscensionBiome();
      return;
    }

    // 1. Circular Floor
    this.createCircularFloor(biome);

    // 2. Circular Perimeter Boundary Cliffs (32 rocks ring)
    this.createCircularPerimeter(biome);

    // 3. Biome-specific architecture, houses, walls, ramps, and central super jump pad
    switch (biome) {
      case 'slums':
        this.buildSlumsBiome();
        break;
      case 'matrix':
        this.buildMatrixBiome();
        break;
      case 'wasteland':
        this.buildWastelandBiome();
        break;
      case 'arctic':
        this.buildArcticBiome();
        break;
      case 'orbital':
        this.buildOrbitalBiome();
        break;
      case 'biodome':
        this.buildBiodomeBiome();
        break;
      case 'catacombs':
        this.buildCatacombsBiome();
        break;
      case 'solar':
        this.buildSolarBiome();
        break;
      case 'abyss':
        this.buildAbyssBiome();
        break;
      case 'ex_ascension':
        this.buildExAscensionBiome();
        break;
      case 'shinjuku':
      default:
        this.buildShinjukuBiome();
        break;
    }
    this.colliderMeshes = this.colliders.map(c => c.mesh);
  }

  // ==================== FLOOR & BOUNDARY ====================
  createCircularFloor(biome) {
    const radius = 50;
    const floorGeo = new THREE.CircleGeometry(radius, 64);
    floorGeo.rotateX(-Math.PI / 2);

    let floorColor = 0x0f1524;
    let floorRough = 0.25;
    let floorMetal = 0.75;

    if (biome === 'slums') {
      floorColor = 0x1e1610;
      floorRough = 0.85;
      floorMetal = 0.35;
    } else if (biome === 'matrix') {
      floorColor = 0x031208;
      floorRough = 0.2;
      floorMetal = 0.8;
    } else if (biome === 'wasteland') {
      floorColor = 0x1c0909;
      floorRough = 0.9;
      floorMetal = 0.15;
    } else if (biome === 'arctic') {
      floorColor = 0xdae8f5;
      floorRough = 0.65;
      floorMetal = 0.1;
    } else if (biome === 'orbital') {
      floorColor = 0x151b27;
      floorRough = 0.3;
      floorMetal = 0.85;
    } else if (biome === 'biodome') {
      floorColor = 0x122210;
      floorRough = 0.8;
      floorMetal = 0.1;
    } else if (biome === 'catacombs') {
      floorColor = 0x1a1224;
      floorRough = 0.8;
      floorMetal = 0.25;
    } else if (biome === 'solar') {
      floorColor = 0xca9248;
      floorRough = 0.95;
      floorMetal = 0.05;
    } else if (biome === 'abyss') {
      floorColor = 0x060e1c;
      floorRough = 0.2;
      floorMetal = 0.9;
    } else if (biome === 'ex_ascension') {
      floorColor = 0x050e1a;
      floorRough = 0.15;
      floorMetal = 0.95;
    }

    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: floorRough,
      metalness: floorMetal,
    });

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.levelGroup.add(floor);

    const floorBox = new THREE.Box3(
      new THREE.Vector3(-radius, -2, -radius),
      new THREE.Vector3(radius, 0, radius)
    );
    this.colliders.push({ box: floorBox, mesh: floor });

    // Decorative floor decals
    this.createFloorDecals(biome);
  }

  createFloorDecals(biome) {
    const decalColor = biome === 'matrix' ? 0x00ff88 :
      (biome === 'wasteland' ? 0xff2200 :
      (biome === 'slums' ? 0xff8800 :
      (biome === 'ex_ascension' ? 0xffd700 : 0x00f3ff)));

    const ringMat = new THREE.MeshBasicMaterial({
      color: decalColor,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const ringGeo = new THREE.RingGeometry(12, 42, 32, 6);
    ringGeo.rotateX(-Math.PI / 2);
    const grid = new THREE.Mesh(ringGeo, ringMat);
    grid.position.set(0, 0.03, 0);
    this.levelGroup.add(grid);
  }

  createCircularPerimeter(biome) {
    const count = 32;
    const radius = 50.5;
    const height = 9.0;

    if (biome === 'ex_ascension') {
      // Sleek low-profile energy railing (height 2.2m) with transparent forcefields - full 360 panoramic cosmic view
      const pylonMat = new THREE.MeshStandardMaterial({
        color: 0x1a263d,
        metalness: 0.95,
        roughness: 0.15,
        emissive: 0xffd700,
        emissiveIntensity: 0.4,
      });
      const glassMat = new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.18,
        wireframe: true,
        side: THREE.DoubleSide,
      });
      const fenceH = 2.2;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, fenceH, 8), pylonMat);
        pylon.position.set(x, fenceH / 2, z);
        this.levelGroup.add(pylon);

        const glassGeo = new THREE.PlaneGeometry(10.5, fenceH * 0.9);
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(x, fenceH * 0.5, z);
        glass.rotation.y = -angle + Math.PI / 2;
        this.levelGroup.add(glass);

        const box = new THREE.Box3().setFromObject(pylon);
        box.expandByVector(new THREE.Vector3(5.0, 5.0, 1.0)); // High invisible boundary prevents falling
        this.colliders.push({ box, mesh: pylon });
      }
      return;
    }

    let rockColor = 0x181f2f;
    if (biome === 'slums') rockColor = 0x3d281a;
    else if (biome === 'matrix') rockColor = 0x0a1e12;
    else if (biome === 'wasteland') rockColor = 0x330c0c;
    else if (biome === 'arctic') rockColor = 0x768799;
    else if (biome === 'orbital') rockColor = 0x1e2638;
    else if (biome === 'biodome') rockColor = 0x1a3318;
    else if (biome === 'catacombs') rockColor = 0x27193b;
    else if (biome === 'solar') rockColor = 0x8a582c;
    else if (biome === 'abyss') rockColor = 0x0a1529;

    const rockMat = new THREE.MeshStandardMaterial({
      color: rockColor,
      roughness: 0.85,
      metalness: 0.2,
    });

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const rockW = 11.5;
      const rockH = height + (i % 3) * 1.5;
      const rockD = 5.0;

      const geo = new THREE.BoxGeometry(rockW, rockH, rockD);
      const mesh = new THREE.Mesh(geo, rockMat);
      mesh.position.set(x, rockH / 2, z);
      mesh.rotation.y = -angle + Math.PI / 2;
      mesh.receiveShadow = true;
      this.levelGroup.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ box, mesh });
    }
  }

  // ==================== CENTRAL SUPER JUMP PAD ====================
  /**
   * Consolidate all jump pads into a single central super launch pad at (0, 0, 0)
   */
  createCentralJumpPad(glowColor = 0x00f3ff) {
    const ringGeo = new THREE.TorusGeometry(3.2, 0.45, 12, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x1f293d,
      metalness: 0.9,
      roughness: 0.2,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.2, 0);
    this.levelGroup.add(ring);

    // Glowing energy discharge disc
    const ventGeo = new THREE.CircleGeometry(3.0, 32);
    ventGeo.rotateX(-Math.PI / 2);
    const ventMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    const vent = new THREE.Mesh(ventGeo, ventMat);
    vent.position.set(0, 0.22, 0);
    this.levelGroup.add(vent);

    // Pulsing central core emitter
    const coreGeo = new THREE.CylinderGeometry(0.8, 1.2, 0.3, 16);
    const coreMat = new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 0.15, 0);
    this.levelGroup.add(core);

    // Single jump pad registered
    this.jumpPads.push({
      position: new THREE.Vector3(0, 0.5, 0),
      radius: 3.4,
      power: 26.0,
    });
  }

  createPositionedJumpPad(x, z, glowColor = 0xffd700, power = 30.0, radius = 2.6) {
    const ringGeo = new THREE.TorusGeometry(radius, 0.35, 12, 28);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x1f293d,
      metalness: 0.9,
      roughness: 0.2,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, 0.2, z);
    this.levelGroup.add(ring);

    const ventGeo = new THREE.CircleGeometry(radius - 0.2, 28);
    ventGeo.rotateX(-Math.PI / 2);
    const ventMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const vent = new THREE.Mesh(ventGeo, ventMat);
    vent.position.set(x, 0.22, z);
    this.levelGroup.add(vent);

    this.jumpPads.push({
      position: new THREE.Vector3(x, 0.5, z),
      radius: radius + 0.5,
      power: power,
    });
  }

  // ==================== ARCHITECTURAL & STAIRCASE HELPERS ====================

  /**
   * Creates realistic stepped stairs with exact horizontal box colliders.
   * Completely replaces tilted ramp boards to guarantee 100% accurate collision & step-up physics.
   */
  createStairs(startX, startZ, totalHeight, width, totalRun, stepCount, stepMat, railMat, dir = 1, axis = 'z') {
    const stepH = totalHeight / stepCount;
    const stepL = totalRun / stepCount;

    for (let i = 1; i <= stepCount; i++) {
      const curH = i * stepH;
      let curX = startX;
      let curZ = startZ;
      let stepGeo;

      if (axis === 'z') {
        curZ = startZ + dir * ((i - 0.5) * stepL);
        stepGeo = new THREE.BoxGeometry(width, curH, stepL + 0.02);
      } else {
        curX = startX + dir * ((i - 0.5) * stepL);
        stepGeo = new THREE.BoxGeometry(stepL + 0.02, curH, width);
      }

      const stepMesh = new THREE.Mesh(stepGeo, stepMat);
      stepMesh.position.set(curX, curH / 2, curZ);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      this.levelGroup.add(stepMesh);

      this.colliders.push({ box: new THREE.Box3().setFromObject(stepMesh), mesh: stepMesh });

      // Guard posts on every 3rd step
      if (railMat && i % 3 === 0 && i < stepCount) {
        const postH = 0.85;
        const postGeo = new THREE.BoxGeometry(0.08, postH, 0.08);
        const pY = curH + postH / 2;

        if (axis === 'z') {
          const postL = new THREE.Mesh(postGeo, railMat);
          postL.position.set(curX - width / 2 + 0.08, pY, curZ);
          const postR = new THREE.Mesh(postGeo, railMat);
          postR.position.set(curX + width / 2 - 0.08, pY, curZ);
          this.levelGroup.add(postL, postR);
        } else {
          const postL = new THREE.Mesh(postGeo, railMat);
          postL.position.set(curX, pY, startZ - width / 2 + 0.08);
          const postR = new THREE.Mesh(postGeo, railMat);
          postR.position.set(curX, pY, startZ + width / 2 - 0.08);
          this.levelGroup.add(postL, postR);
        }
      }
    }

    // Top landing platform connecting stair to building roof
    const landingLength = 1.4;
    let landX = startX;
    let landZ = startZ;
    let landGeo;

    if (axis === 'z') {
      landZ = startZ + dir * (totalRun + landingLength / 2);
      landGeo = new THREE.BoxGeometry(width, totalHeight, landingLength);
    } else {
      landX = startX + dir * (totalRun + landingLength / 2);
      landGeo = new THREE.BoxGeometry(landingLength, totalHeight, width);
    }

    const landMesh = new THREE.Mesh(landGeo, stepMat);
    landMesh.position.set(landX, totalHeight / 2, landZ);
    landMesh.castShadow = true;
    landMesh.receiveShadow = true;
    this.levelGroup.add(landMesh);
    this.colliders.push({ box: new THREE.Box3().setFromObject(landMesh), mesh: landMesh });
  }

  /**
   * Creates a multi-story cyberpunk architectural building:
   * - 4 reinforced corner pillars
   * - Detailed wall facade with recessed panels & illuminated neon window slits
   * - Entrance canopy / doorway arch
   * - Rooftop vantage deck with parapet covers
   * - Rooftop tactical communication mast or equipment generator
   * - Stepped staircase leading up to roof level
   */
  createComplexBuilding(x, z, w, h, d, wallMat, trimMat, roofMat, options = {}) {
    const bGroup = new THREE.Group();

    // 1. 4 Reinforced Corner Structural Pillars
    const pilW = 0.9;
    const pilH = h + 0.3;
    const pilGeo = new THREE.BoxGeometry(pilW, pilH, pilW);
    const pilOffsets = [
      [-w / 2 + pilW / 2, -d / 2 + pilW / 2],
      [w / 2 - pilW / 2, -d / 2 + pilW / 2],
      [-w / 2 + pilW / 2, d / 2 - pilW / 2],
      [w / 2 - pilW / 2, d / 2 - pilW / 2],
    ];

    pilOffsets.forEach(([px, pz]) => {
      const pil = new THREE.Mesh(pilGeo, trimMat);
      pil.position.set(x + px, pilH / 2, z + pz);
      pil.castShadow = true;
      pil.receiveShadow = true;
      this.levelGroup.add(pil);
      this.colliders.push({ box: new THREE.Box3().setFromObject(pil), mesh: pil });
    });

    // 2. Main Wall Body
    const bodyW = w - 0.4;
    const bodyD = d - 0.4;
    const bodyGeo = new THREE.BoxGeometry(bodyW, h, bodyD);
    const body = new THREE.Mesh(bodyGeo, wallMat);
    body.position.set(x, h / 2, z);
    body.castShadow = true;
    body.receiveShadow = true;
    this.levelGroup.add(body);
    this.colliders.push({ box: new THREE.Box3().setFromObject(body), mesh: body });

    // 3. Entrance Canopy (庇) on Front Wall
    const canopyDir = options.stairDir === 1 ? -1 : 1; // opposite side of stair
    const canopyW = 3.6;
    const canopyH = 0.3;
    const canopyD = 1.8;
    const canopyGeo = new THREE.BoxGeometry(canopyW, canopyH, canopyD);
    const canopy = new THREE.Mesh(canopyGeo, trimMat);
    canopy.position.set(x, 2.7, z + canopyDir * (d / 2 + canopyD / 2 - 0.2));
    canopy.castShadow = true;
    this.levelGroup.add(canopy);
    this.colliders.push({ box: new THREE.Box3().setFromObject(canopy), mesh: canopy });

    // Entrance Glow Arch
    const archMat = new THREE.MeshBasicMaterial({ color: options.neonColor || 0x00f3ff });
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.15), archMat);
    archTop.position.set(x, 2.5, z + canopyDir * (d / 2 + 0.1));
    this.levelGroup.add(archTop);

    // 4. Horizontal Accent Louvers / Window Slits
    const slitMat = new THREE.MeshBasicMaterial({
      color: options.neonColor || 0x00f3ff,
      transparent: true,
      opacity: 0.85,
    });
    [-1, 1].forEach(side => {
      const slit1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, d * 0.6), slitMat);
      slit1.position.set(x + side * (w / 2 + 0.05), h * 0.4, z);
      const slit2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, d * 0.6), slitMat);
      slit2.position.set(x + side * (w / 2 + 0.05), h * 0.75, z);
      this.levelGroup.add(slit1, slit2);
    });

    // 5. Rooftop Vantage Deck (広々とした屋上フロア)
    const deckThick = 0.45;
    const deckW = w + 0.5;
    const deckD = d + 0.5;
    const deckGeo = new THREE.BoxGeometry(deckW, deckThick, deckD);
    const deck = new THREE.Mesh(deckGeo, roofMat);
    deck.position.set(x, h + deckThick / 2, z);
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.levelGroup.add(deck);
    this.colliders.push({ box: new THREE.Box3().setFromObject(deck), mesh: deck });

    // 6. Rooftop Parapet Covers (身を隠せる防護壁)
    const paraH = 0.95;
    const paraThick = 0.28;
    const pNorth = new THREE.Mesh(new THREE.BoxGeometry(deckW, paraH, paraThick), trimMat);
    pNorth.position.set(x, h + paraH / 2, z - deckD / 2 + paraThick / 2);
    this.levelGroup.add(pNorth);
    this.colliders.push({ box: new THREE.Box3().setFromObject(pNorth), mesh: pNorth });

    const pWest = new THREE.Mesh(new THREE.BoxGeometry(paraThick, paraH, deckD - paraThick * 2), trimMat);
    pWest.position.set(x - deckW / 2 + paraThick / 2, h + paraH / 2, z);
    this.levelGroup.add(pWest);
    this.colliders.push({ box: new THREE.Box3().setFromObject(pWest), mesh: pWest });

    const pEast = new THREE.Mesh(new THREE.BoxGeometry(paraThick, paraH, deckD - paraThick * 2), trimMat);
    pEast.position.set(x + deckW / 2 - paraThick / 2, h + paraH / 2, z);
    this.levelGroup.add(pEast);
    this.colliders.push({ box: new THREE.Box3().setFromObject(pEast), mesh: pEast });

    // 7. Rooftop Tactical Equipment (通信アンテナタワー & 電源ポッド)
    const antPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 3.8, 8),
      trimMat
    );
    antPole.position.set(x + w * 0.28, h + 1.9, z - d * 0.28);
    antPole.castShadow = true;
    this.levelGroup.add(antPole);

    const antBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      archMat
    );
    antBeacon.position.set(x + w * 0.28, h + 3.8, z - d * 0.28);
    this.levelGroup.add(antBeacon);

    // 8. Access Stepped Stairs (登れる本物の段差階段)
    const stairDir = options.stairDir || 1; // 1: +Z direction, -1: -Z direction
    const stairSteps = options.stairSteps || 12;
    const stairRun = options.stairRun || 7.2;
    const stairWidth = 2.8;

    let stairStartZ;
    if (stairDir === 1) {
      stairStartZ = z + (d / 2) + 0.1;
      this.createStairs(x, stairStartZ, h, stairWidth, stairRun, stairSteps, roofMat, trimMat, -1, 'z');
    } else {
      stairStartZ = z - (d / 2) - 0.1;
      this.createStairs(x, stairStartZ, h, stairWidth, stairRun, stairSteps, roofMat, trimMat, 1, 'z');
    }
  }

  /**
   * Tactical Blast Wall / Barricade
   */
  createTacticalWall(x, z, w, h, d, mat, rotY = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.levelGroup.add(mesh);
    this.colliders.push({ box: new THREE.Box3().setFromObject(mesh), mesh });
  }

  /**
   * Elevated Observation Deck with Real Stepped Stairs (高台展望デッキ)
   */
  createObservationDeck(x, z, h, w, d, postMat, deckMat, railMat, stairDir = 1) {
    // 4 Support Steel Pillars
    const postGeo = new THREE.BoxGeometry(0.7, h, 0.7);
    const offsets = [
      [-w / 2 + 0.5, -d / 2 + 0.5],
      [w / 2 - 0.5, -d / 2 + 0.5],
      [-w / 2 + 0.5, d / 2 - 0.5],
      [w / 2 - 0.5, d / 2 - 0.5],
    ];
    offsets.forEach(([ox, oz]) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x + ox, h / 2, z + oz);
      post.castShadow = true;
      this.levelGroup.add(post);
      this.colliders.push({ box: new THREE.Box3().setFromObject(post), mesh: post });
    });

    // Elevated Deck Floor
    const deckThick = 0.45;
    const deckGeo = new THREE.BoxGeometry(w, deckThick, d);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(x, h, z);
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.levelGroup.add(deck);
    this.colliders.push({ box: new THREE.Box3().setFromObject(deck), mesh: deck });

    // Guardrails on 3 sides
    const railH = 0.9;
    const railThick = 0.2;
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(w, railH, railThick), railMat);
    r1.position.set(x, h + railH / 2, z - (stairDir * d / 2) + (stairDir * railThick / 2));
    this.levelGroup.add(r1);
    this.colliders.push({ box: new THREE.Box3().setFromObject(r1), mesh: r1 });

    const r2 = new THREE.Mesh(new THREE.BoxGeometry(railThick, railH, d), railMat);
    r2.position.set(x - w / 2 + railThick / 2, h + railH / 2, z);
    this.levelGroup.add(r2);
    this.colliders.push({ box: new THREE.Box3().setFromObject(r2), mesh: r2 });

    const r3 = new THREE.Mesh(new THREE.BoxGeometry(railThick, railH, d), railMat);
    r3.position.set(x + w / 2 - railThick / 2, h + railH / 2, z);
    this.levelGroup.add(r3);
    this.colliders.push({ box: new THREE.Box3().setFromObject(r3), mesh: r3 });

    // Stepped Stairs leading to Deck
    const stairRun = 7.0;
    const stairSteps = 10;
    const stairW = 2.6;
    if (stairDir === 1) {
      this.createStairs(x, z + d / 2, h, stairW, stairRun, stairSteps, deckMat, railMat, -1, 'z');
    } else {
      this.createStairs(x, z - d / 2, h, stairW, stairRun, stairSteps, deckMat, railMat, 1, 'z');
    }
  }

  // ==================== BIOME 1: NEO-SHINJUKU (ネオ・シンジュク) ====================
  buildShinjukuBiome() {
    const cyberWallMat = new THREE.MeshStandardMaterial({
      color: 0x141b2d,
      roughness: 0.35,
      metalness: 0.8,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x090e1a,
      roughness: 0.25,
      metalness: 0.9,
    });
    const cyberRoofMat = new THREE.MeshStandardMaterial({
      color: 0x1f2940,
      roughness: 0.4,
      metalness: 0.75,
    });

    // 2 Multi-story Cyber Complex Buildings with stepped stairs & rooftop access
    this.createComplexBuilding(-24, -10, 11, 4.8, 9, cyberWallMat, trimMat, cyberRoofMat, {
      stairDir: 1,
      neonColor: 0x00f3ff,
    });
    this.createComplexBuilding(24, 10, 11, 4.8, 9, cyberWallMat, trimMat, cyberRoofMat, {
      stairDir: -1,
      neonColor: 0xff0088,
    });

    // Mid-range fortified blast walls & cover
    this.createTacticalWall(-12, 16, 7, 2.4, 1.2, cyberWallMat, 0.3);
    this.createTacticalWall(12, -16, 7, 2.4, 1.2, cyberWallMat, -0.3);
    this.createTacticalWall(-7, -4, 4, 1.8, 1.0, cyberWallMat);
    this.createTacticalWall(7, 4, 4, 1.8, 1.0, cyberWallMat);

    // Elevated sniper observation deck with stepped stairs
    this.createObservationDeck(0, 26, 4.2, 9, 6, trimMat, cyberRoofMat, trimMat, -1);

    // Central Super Jump Pad (Cyan)
    this.createCentralJumpPad(0x00f3ff);
  }

  // ==================== BIOME 2: INDUSTRIAL SLUMS (インダストリアル・スラム) ====================
  buildSlumsBiome() {
    const rustyIronMat = new THREE.MeshStandardMaterial({
      color: 0x4a3222,
      roughness: 0.85,
      metalness: 0.4,
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x221812,
      roughness: 0.65,
      metalness: 0.6,
    });
    const rustPlankMat = new THREE.MeshStandardMaterial({
      color: 0x61442e,
      roughness: 0.75,
      metalness: 0.3,
    });

    // 2 Multi-tier Slum Outposts with stairs
    this.createComplexBuilding(-22, -12, 10, 4.2, 8, rustyIronMat, darkSteelMat, rustPlankMat, {
      stairDir: 1,
      neonColor: 0xff7700,
    });
    this.createComplexBuilding(22, 12, 10, 4.2, 8, rustyIronMat, darkSteelMat, rustPlankMat, {
      stairDir: -1,
      neonColor: 0xff7700,
    });

    // Elevated Scrap Observation Deck
    this.createObservationDeck(0, -26, 4.0, 8, 6, darkSteelMat, rustPlankMat, darkSteelMat, 1);

    // Broken corrugated sheet barricades
    this.createTacticalWall(-10, 8, 6, 2.0, 0.8, rustyIronMat, 0.5);
    this.createTacticalWall(10, -8, 6, 2.0, 0.8, rustyIronMat, -0.5);
    this.createTacticalWall(0, 18, 8, 2.2, 1.0, rustyIronMat);

    // Central Super Jump Pad (Sodium Orange)
    this.createCentralJumpPad(0xff7700);
  }

  // ==================== BIOME 3: CYBER MATRIX (サイバー・マトリクス) ====================
  buildMatrixBiome() {
    const matrixDarkMat = new THREE.MeshStandardMaterial({
      color: 0x051a0d,
      roughness: 0.25,
      metalness: 0.9,
    });
    const matrixTrimMat = new THREE.MeshStandardMaterial({
      color: 0x021008,
      roughness: 0.35,
      metalness: 0.95,
    });
    const matrixGreenMat = new THREE.MeshStandardMaterial({
      color: 0x0c381c,
      roughness: 0.3,
      metalness: 0.85,
      emissive: 0x00ff88,
      emissiveIntensity: 0.25,
    });

    // 2 High-tech Matrix Server Hubs with stairs
    this.createComplexBuilding(-24, 0, 11, 4.8, 9, matrixDarkMat, matrixTrimMat, matrixGreenMat, {
      stairDir: 1,
      neonColor: 0x00ff88,
    });
    this.createComplexBuilding(24, 0, 11, 4.8, 9, matrixDarkMat, matrixTrimMat, matrixGreenMat, {
      stairDir: -1,
      neonColor: 0x00ff88,
    });

    // Elevated Data Observation Deck
    this.createObservationDeck(0, 25, 4.5, 9, 6, matrixTrimMat, matrixGreenMat, matrixDarkMat, -1);
    this.createObservationDeck(0, -25, 4.5, 9, 6, matrixTrimMat, matrixGreenMat, matrixDarkMat, 1);

    // Digital partition walls
    this.createTacticalWall(-10, -10, 6, 2.2, 1.0, matrixGreenMat, 0.78);
    this.createTacticalWall(10, 10, 6, 2.2, 1.0, matrixGreenMat, 0.78);

    // Central Super Jump Pad (Matrix Green)
    this.createCentralJumpPad(0x00ff88);
  }

  // ==================== BIOME 4: CRIMSON WASTELAND (クリムゾン・ウェイスト) ====================
  buildWastelandBiome() {
    const volcanicMat = new THREE.MeshStandardMaterial({
      color: 0x240c0c,
      roughness: 0.9,
      metalness: 0.25,
    });
    const obsidianTrimMat = new THREE.MeshStandardMaterial({
      color: 0x110404,
      roughness: 0.4,
      metalness: 0.85,
    });
    const magmaTrimMat = new THREE.MeshStandardMaterial({
      color: 0x3d1010,
      roughness: 0.7,
      metalness: 0.3,
      emissive: 0xff2200,
      emissiveIntensity: 0.35,
    });

    // 2 Scorched Volcanic Fortress Bunkers with stairs
    this.createComplexBuilding(-22, -12, 11, 4.6, 9, volcanicMat, obsidianTrimMat, magmaTrimMat, {
      stairDir: 1,
      neonColor: 0xff2200,
    });
    this.createComplexBuilding(22, 12, 11, 4.6, 9, volcanicMat, obsidianTrimMat, magmaTrimMat, {
      stairDir: -1,
      neonColor: 0xff2200,
    });

    // Volcanic Observation Deck
    this.createObservationDeck(0, 24, 4.2, 9, 6, obsidianTrimMat, magmaTrimMat, obsidianTrimMat, -1);

    // Heavy obsidian blast barriers
    this.createTacticalWall(-14, 12, 8, 2.6, 1.4, volcanicMat, -0.4);
    this.createTacticalWall(14, -12, 8, 2.6, 1.4, volcanicMat, 0.4);

    // Central Super Jump Pad (Crimson Magma)
    this.createCentralJumpPad(0xff2200);
  }

  // ==================== BIOME 5: ARCTIC RESEARCH (アークティック・リサーチ) ====================
  buildArcticBiome() {
    const polarLabMat = new THREE.MeshStandardMaterial({
      color: 0x6a7d8d,
      roughness: 0.4,
      metalness: 0.7,
    });
    const steelTrimMat = new THREE.MeshStandardMaterial({
      color: 0x364350,
      roughness: 0.3,
      metalness: 0.85,
    });
    const iceDeckMat = new THREE.MeshStandardMaterial({
      color: 0x9dc6e8,
      roughness: 0.25,
      metalness: 0.45,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.2,
    });

    // 2 Polar Research Stations with stairs
    this.createComplexBuilding(-24, -12, 11, 4.5, 9, polarLabMat, steelTrimMat, iceDeckMat, {
      stairDir: 1,
      neonColor: 0x38bdf8,
    });
    this.createComplexBuilding(24, 12, 11, 4.5, 9, polarLabMat, steelTrimMat, iceDeckMat, {
      stairDir: -1,
      neonColor: 0x38bdf8,
    });

    // Elevated Arctic Observation Platform with stairs
    this.createObservationDeck(0, -24, 4.4, 9, 6, steelTrimMat, iceDeckMat, steelTrimMat, 1);

    // Ice sheet blast barriers
    this.createTacticalWall(-12, 10, 7, 2.2, 1.2, iceDeckMat, 0.3);
    this.createTacticalWall(12, -10, 7, 2.2, 1.2, iceDeckMat, -0.3);

    // Central Super Jump Pad (Frost Ice Cyan)
    this.createCentralJumpPad(0x38bdf8);
  }

  // ==================== BIOME 6: ORBITAL DOCK (オービタル・ドック) ====================
  buildOrbitalBiome() {
    const starportMat = new THREE.MeshStandardMaterial({
      color: 0x222c3e,
      roughness: 0.35,
      metalness: 0.85,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f1520,
      roughness: 0.25,
      metalness: 0.95,
    });
    const hazardDeckMat = new THREE.MeshStandardMaterial({
      color: 0x36435c,
      roughness: 0.4,
      metalness: 0.8,
      emissive: 0xffea00,
      emissiveIntensity: 0.2,
    });

    // 2 Spaceport Cargo Hangars with stairs
    this.createComplexBuilding(-26, 0, 12, 5.0, 9, starportMat, frameMat, hazardDeckMat, {
      stairDir: 1,
      neonColor: 0xffea00,
    });
    this.createComplexBuilding(26, 0, 12, 5.0, 9, starportMat, frameMat, hazardDeckMat, {
      stairDir: -1,
      neonColor: 0xffea00,
    });

    // Elevated Gantry Skybridge with stairs
    this.createObservationDeck(0, 24, 4.8, 10, 6, frameMat, hazardDeckMat, frameMat, -1);
    this.createObservationDeck(0, -24, 4.8, 10, 6, frameMat, hazardDeckMat, frameMat, 1);

    // Cargo containers
    this.createTacticalWall(-10, -12, 6, 2.4, 2.0, starportMat, 0.6);
    this.createTacticalWall(10, 12, 6, 2.4, 2.0, starportMat, -0.6);

    // Central Super Jump Pad (Orbital Gold)
    this.createCentralJumpPad(0xffea00);
  }

  // ==================== BIOME 7: ACID BIODOME (アシッド・バイオドーム) ====================
  buildBiodomeBiome() {
    const organicWallMat = new THREE.MeshStandardMaterial({
      color: 0x1a2e16,
      roughness: 0.75,
      metalness: 0.3,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x0e1c0c,
      roughness: 0.6,
      metalness: 0.4,
    });
    const acidTrussMat = new THREE.MeshStandardMaterial({
      color: 0x244720,
      roughness: 0.4,
      metalness: 0.7,
      emissive: 0x66ff00,
      emissiveIntensity: 0.25,
    });

    // 2 Biodome Greenhouse Laboratories with stairs
    this.createComplexBuilding(-23, -12, 10, 4.4, 9, organicWallMat, darkWoodMat, acidTrussMat, {
      stairDir: 1,
      neonColor: 0x66ff00,
    });
    this.createComplexBuilding(23, 12, 10, 4.4, 9, organicWallMat, darkWoodMat, acidTrussMat, {
      stairDir: -1,
      neonColor: 0x66ff00,
    });

    // Elevated Canopy Observation Deck
    this.createObservationDeck(0, 24, 4.2, 9, 6, darkWoodMat, acidTrussMat, darkWoodMat, -1);

    // Biodome retaining barriers
    this.createTacticalWall(-12, 14, 7, 2.2, 1.2, acidTrussMat, -0.35);
    this.createTacticalWall(12, -14, 7, 2.2, 1.2, acidTrussMat, 0.35);

    // Central Super Jump Pad (Toxic Lime)
    this.createCentralJumpPad(0x66ff00);
  }

  // ==================== BIOME 8: SANCTUARY CATACOMBS (サンクチュアリ・カタコンベ) ====================
  buildCatacombsBiome() {
    const stonePillarMat = new THREE.MeshStandardMaterial({
      color: 0x2d1f3f,
      roughness: 0.85,
      metalness: 0.35,
    });
    const gothicTrimMat = new THREE.MeshStandardMaterial({
      color: 0x160c22,
      roughness: 0.45,
      metalness: 0.8,
    });
    const voidMat = new THREE.MeshStandardMaterial({
      color: 0x3b1c5a,
      roughness: 0.4,
      metalness: 0.75,
      emissive: 0xd946ef,
      emissiveIntensity: 0.3,
    });

    // 2 Gothic Sanctuary Crypt Citadels with stairs
    this.createComplexBuilding(-24, 0, 11, 4.8, 9, stonePillarMat, gothicTrimMat, voidMat, {
      stairDir: 1,
      neonColor: 0xd946ef,
    });
    this.createComplexBuilding(24, 0, 11, 4.8, 9, stonePillarMat, gothicTrimMat, voidMat, {
      stairDir: -1,
      neonColor: 0xd946ef,
    });

    // Elevated Altar Observation Deck with stairs
    this.createObservationDeck(0, -25, 4.5, 9, 6, gothicTrimMat, voidMat, gothicTrimMat, 1);

    // Catacomb stone sarcophagi barriers
    this.createTacticalWall(-10, 12, 6, 2.4, 1.4, stonePillarMat, 0.5);
    this.createTacticalWall(10, -12, 6, 2.4, 1.4, stonePillarMat, -0.5);

    // Central Super Jump Pad (Sanctuary Violet)
    this.createCentralJumpPad(0xd946ef);
  }

  // ==================== BIOME 9: SOLAR ARRAY (ソーラー・アレイ) ====================
  buildSolarBiome() {
    const solarBaseMat = new THREE.MeshStandardMaterial({
      color: 0x8a582c,
      roughness: 0.85,
      metalness: 0.3,
    });
    const goldSteelMat = new THREE.MeshStandardMaterial({
      color: 0x3d240c,
      roughness: 0.35,
      metalness: 0.85,
    });
    const solarCellMat = new THREE.MeshStandardMaterial({
      color: 0x1a2e3b,
      roughness: 0.2,
      metalness: 0.95,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.25,
    });

    // 2 Solar Substation Bunkers with stairs
    this.createComplexBuilding(-24, -12, 11, 4.5, 9, solarBaseMat, goldSteelMat, solarCellMat, {
      stairDir: 1,
      neonColor: 0xf59e0b,
    });
    this.createComplexBuilding(24, 12, 11, 4.5, 9, solarBaseMat, goldSteelMat, solarCellMat, {
      stairDir: -1,
      neonColor: 0xf59e0b,
    });

    // High Solar Collector Deck with stairs
    this.createObservationDeck(0, 24, 4.4, 9, 6, goldSteelMat, solarCellMat, goldSteelMat, -1);

    // Heat-sink defensive barriers
    this.createTacticalWall(-12, 12, 7, 2.2, 1.2, solarBaseMat, 0.4);
    this.createTacticalWall(12, -12, 7, 2.2, 1.2, solarBaseMat, -0.4);

    // Central Super Jump Pad (Solar Gold)
    this.createCentralJumpPad(0xf59e0b);
  }

  // ==================== BIOME 10: ABYSS CORE (アビス・コア) ====================
  buildAbyssBiome() {
    const abyssDarkMat = new THREE.MeshStandardMaterial({
      color: 0x091424,
      roughness: 0.3,
      metalness: 0.9,
    });
    const darkObsidianMat = new THREE.MeshStandardMaterial({
      color: 0x03070f,
      roughness: 0.2,
      metalness: 0.95,
    });
    const quantumGlowMat = new THREE.MeshStandardMaterial({
      color: 0x0c2b4d,
      roughness: 0.25,
      metalness: 0.9,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.35,
    });

    // 2 Deep Core Research Pillars with stairs
    this.createComplexBuilding(-25, 0, 11, 5.0, 9, abyssDarkMat, darkObsidianMat, quantumGlowMat, {
      stairDir: 1,
      neonColor: 0x00f3ff,
    });
    this.createComplexBuilding(25, 0, 11, 5.0, 9, abyssDarkMat, darkObsidianMat, quantumGlowMat, {
      stairDir: -1,
      neonColor: 0x00f3ff,
    });

    // Core Observation Gantry with stairs
    this.createObservationDeck(0, 25, 4.6, 9, 6, darkObsidianMat, quantumGlowMat, darkObsidianMat, -1);
    this.createObservationDeck(0, -25, 4.6, 9, 6, darkObsidianMat, quantumGlowMat, darkObsidianMat, 1);

    // Quantum flux barrier walls
    this.createTacticalWall(-10, -10, 6, 2.4, 1.2, quantumGlowMat, 0.78);
    this.createTacticalWall(10, 10, 6, 2.4, 1.2, quantumGlowMat, 0.78);

    // Central Super Jump Pad (Abyss Quantum Cyan)
    this.createCentralJumpPad(0x00f3ff);
  }

  // ==================== BIOME 11: EX ASCENSION (超軌道昇降機 エーテル・アセンション) ====================
  buildExAscensionBiome() {
    const celestialWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xedf4fc,
      metalness: 0.9,
      roughness: 0.15,
      emissive: 0x00e1ff,
      emissiveIntensity: 0.25,
    });
    const hyperGoldMat = new THREE.MeshStandardMaterial({
      color: 0x241d06,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.7,
    });
    const darkHullMat = new THREE.MeshStandardMaterial({
      color: 0x070c14,
      metalness: 0.95,
      roughness: 0.2,
    });
    const holoShieldMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });

    // 0. 超軌道昇降機 オクタゴナル・スカイデッキ (フロア)
    const floorGeo = new THREE.CylinderGeometry(42, 45, 1.6, 8);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x07111e,
      roughness: 0.18,
      metalness: 0.95,
      emissive: 0x002244,
      emissiveIntensity: 0.4,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.8;
    floorMesh.receiveShadow = true;
    this.levelGroup.add(floorMesh);

    const floorBox = new THREE.Box3(
      new THREE.Vector3(-46, -2, -46),
      new THREE.Vector3(46, 0, 46)
    );
    this.colliders.push({ box: floorBox, mesh: floorMesh });

    // フロア中央のサイバーヘキサゴン・エンブレム
    const decalMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const decal = new THREE.Mesh(new THREE.RingGeometry(6, 28, 8), decalMat);
    decal.rotation.x = -Math.PI / 2;
    decal.position.y = 0.02;
    this.levelGroup.add(decal);

    // 外周8面フォースフィールド・エネルギーバリアフェンス (岩の代わりに透過力場フェンス)
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const wx = Math.cos(ang) * 42.5;
      const wz = Math.sin(ang) * 42.5;
      const wallGeo = new THREE.PlaneGeometry(33.0, 9.0);
      const wall = new THREE.Mesh(wallGeo, holoShieldMat);
      wall.position.set(wx, 4.5, wz);
      wall.rotation.y = -ang + Math.PI / 2;
      this.levelGroup.add(wall);

      // コライダー
      const box = new THREE.Box3().setFromObject(wall);
      box.expandByVector(new THREE.Vector3(0.5, 0, 0.5));
      this.colliders.push({ box, mesh: wall });
    }

    // 1. 遥か深淵に広がる母星 (地球/惑星) - 昇降機を見下ろすと宇宙空間に雄大な惑星が回る
    const planetGeo = new THREE.SphereGeometry(180, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x0a264a,
      roughness: 0.75,
      metalness: 0.15,
      emissive: 0x061838,
      emissiveIntensity: 0.5,
    });
    this.exPlanet = new THREE.Mesh(planetGeo, planetMat);
    this.exPlanet.position.set(0, -340, 0);

    // 惑星大気層リング
    const atmoGeo = new THREE.RingGeometry(181, 210, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x00d9ff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const atmoRing = new THREE.Mesh(atmoGeo, atmoMat);
    atmoRing.rotation.x = Math.PI / 2 + 0.2;
    this.exPlanet.add(atmoRing);

    // 雲海ワイヤーフレーム
    const cloudGeo = new THREE.SphereGeometry(183, 24, 24);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0x73d5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    this.exPlanet.add(clouds);
    this.levelGroup.add(this.exPlanet);

    // 2. 昇降機フロア底面の6大イオンスラスター (宇宙空間へ吹き出す巨大青白プラズマ火柱)
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const thrusterCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const tx = Math.cos(ang) * 36;
      const tz = Math.sin(ang) * 36;

      // エンジンノズル
      const nozzleGeo = new THREE.CylinderGeometry(2.4, 3.4, 4.5, 16);
      const nozzle = new THREE.Mesh(nozzleGeo, darkHullMat);
      nozzle.position.set(tx, -2.5, tz);
      this.levelGroup.add(nozzle);

      // プラズマ火炎コーン
      const plumeGeo = new THREE.ConeGeometry(2.6, 26.0, 16);
      const plume = new THREE.Mesh(plumeGeo, thrusterMat);
      plume.position.set(tx, -16.0, tz);
      plume.rotation.x = Math.PI;
      this.levelGroup.add(plume);

      const innerPlumeGeo = new THREE.ConeGeometry(1.3, 20.0, 12);
      const innerPlume = new THREE.Mesh(innerPlumeGeo, thrusterCoreMat);
      innerPlume.position.set(tx, -13.0, tz);
      innerPlume.rotation.x = Math.PI;
      this.levelGroup.add(innerPlume);
    }

    // 3. 4本の超長距離軌道ケーブルガイドタワー & 高速下降パルスリング
    this.exPillarPulses = [];
    const pillarPositions = [
      { x: 42, z: 0 },
      { x: -42, z: 0 },
      { x: 0, z: 42 },
      { x: 0, z: -42 },
    ];
    pillarPositions.forEach(pos => {
      // 天空と深淵を繋ぐ超長尺ピラー (高さ600m)
      const colGeo = new THREE.CylinderGeometry(1.2, 1.2, 600, 12);
      const col = new THREE.Mesh(colGeo, darkHullMat);
      col.position.set(pos.x, 50, pos.z);
      this.levelGroup.add(col);

      // 衝突判定 (幅2.6m)
      const box = new THREE.Box3().setFromObject(col);
      box.expandByVector(new THREE.Vector3(1.2, 0, 1.2));
      this.colliders.push({ box, mesh: col });

      // 光輝くエネルギーパルスリング (下降移動)
      for (let p = 0; p < 3; p++) {
        const pulseGeo = new THREE.TorusGeometry(1.8, 0.25, 8, 24);
        pulseGeo.rotateX(Math.PI / 2);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: 0xffd700,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
        });
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.position.set(pos.x, 30 + p * 45, pos.z);
        this.levelGroup.add(pulse);
        this.exPillarPulses.push(pulse);
      }
    });

    // 4. 超音速成層圏突破ショックウェーブ・ベイパーリング (下降移動)
    this.exVaporRings = [];
    const vaporRadii = [46, 52, 58, 64, 50, 60];
    vaporRadii.forEach((r, idx) => {
      const vGeo = new THREE.TorusGeometry(r, 1.2, 8, 36);
      vGeo.rotateX(Math.PI / 2);
      const vMat = new THREE.MeshBasicMaterial({
        color: 0x66ddff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      });
      const vRing = new THREE.Mesh(vGeo, vMat);
      vRing.position.set(0, -30 + idx * 25, 0);
      this.levelGroup.add(vRing);
      this.exVaporRings.push(vRing);
    });

    // 5. 上空に浮遊するクォンタム・コア (ジャンプ台は完全廃止)
    // 浮遊クォンタム・コア (八面体)
    const coreGeo = new THREE.OctahedronGeometry(2.4, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f3ff,
      emissive: 0x00f3ff,
      emissiveIntensity: 1.2,
      wireframe: true,
    });
    this.exCoreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.exCoreMesh.position.set(0, 6.0, 0);
    this.levelGroup.add(this.exCoreMesh);

    // コア周回エナジーリング
    const cRingGeo = new THREE.TorusGeometry(3.6, 0.15, 8, 32);
    const cRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.85,
    });
    this.exCoreRing = new THREE.Mesh(cRingGeo, cRingMat);
    this.exCoreRing.position.set(0, 6.0, 0);
    this.levelGroup.add(this.exCoreRing);

    // 6. 4基の高台クリスタル・デッキ (視界を遮らない超開放的フローティングデッキ)
    const deckPositions = [
      { x: 0, z: 22, stairDir: -1, axis: 'z' },
      { x: 0, z: -22, stairDir: 1, axis: 'z' },
      { x: 22, z: 0, stairDir: -1, axis: 'x' },
      { x: -22, z: 0, stairDir: 1, axis: 'x' },
    ];
    deckPositions.forEach(dp => {
      const deckH = 4.2;
      const deckW = 7.5;
      const deckD = 7.5;

      // 4本のスタイリッシュ支柱
      const legGeo = new THREE.CylinderGeometry(0.35, 0.45, deckH, 8);
      const legOffsets = [
        [-deckW / 2 + 0.6, -deckD / 2 + 0.6],
        [deckW / 2 - 0.6, -deckD / 2 + 0.6],
        [-deckW / 2 + 0.6, deckD / 2 - 0.6],
        [deckW / 2 - 0.6, deckD / 2 - 0.6],
      ];
      legOffsets.forEach(([ox, oz]) => {
        const leg = new THREE.Mesh(legGeo, darkHullMat);
        leg.position.set(dp.x + ox, deckH / 2, dp.z + oz);
        this.levelGroup.add(leg);
        this.colliders.push({ box: new THREE.Box3().setFromObject(leg), mesh: leg });
      });

      // フローティングフロア
      const floorM = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.35, deckD), celestialWhiteMat);
      floorM.position.set(dp.x, deckH, dp.z);
      this.levelGroup.add(floorM);
      this.colliders.push({ box: new THREE.Box3().setFromObject(floorM), mesh: floorM });

      // デッキ上部のホログラフィック・シールドカバー (透明で視界を遮らない)
      const shield = new THREE.Mesh(new THREE.BoxGeometry(deckW * 0.9, 1.4, 0.15), holoShieldMat);
      shield.position.set(dp.x, deckH + 0.7, dp.z - dp.stairDir * (deckD / 2 - 0.2));
      this.levelGroup.add(shield);
      this.colliders.push({ box: new THREE.Box3().setFromObject(shield), mesh: shield });

      // 階段
      if (dp.axis === 'z') {
        const startZ = dp.z + (dp.stairDir > 0 ? -deckD / 2 - 0.1 : deckD / 2 + 0.1);
        this.createStairs(dp.x, startZ, deckH, 2.6, 6.0, 10, celestialWhiteMat, hyperGoldMat, dp.stairDir, 'z');
      } else {
        const startX = dp.x + (dp.stairDir > 0 ? -deckW / 2 - 0.1 : deckW / 2 + 0.1);
        this.createStairs(startX, dp.z, deckH, 2.6, 6.0, 10, celestialWhiteMat, hyperGoldMat, dp.stairDir, 'x');
      }
    });

    // 7. EXステージ専用: ジャンプ台は完全廃止 (ユーザー要望: ジャンプ台廃止 & 完全新規地形)
    this.jumpPads = [];

    // 8. 4箇所のシースルー・タクティカルエネルギーバリア
    this.createTacticalWall(-12, 12, 6, 2.2, 0.4, holoShieldMat, 0.78);
    this.createTacticalWall(12, -12, 6, 2.2, 0.4, holoShieldMat, 0.78);
    this.createTacticalWall(-12, -12, 6, 2.2, 0.4, holoShieldMat, -0.78);
    this.createTacticalWall(12, 12, 6, 2.2, 0.4, holoShieldMat, -0.78);

    // 9. 宇宙空間を漂う巨大同心円ジャイロリング
    this.exRings = [];
    const ringConfigs = [
      { radius: 75, tube: 0.7, color: 0x00f3ff, rotX: 0.12, rotY: 0.25, rotZ: 0.08 },
      { radius: 98, tube: 0.9, color: 0xffd700, rotX: -0.18, rotY: 0.15, rotZ: -0.14 },
      { radius: 125, tube: 1.2, color: 0x38bdf8, rotX: 0.09, rotY: -0.22, rotZ: 0.18 },
    ];
    ringConfigs.forEach(rc => {
      const ringGeo = new THREE.TorusGeometry(rc.radius, rc.tube, 8, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: rc.color,
        wireframe: true,
        transparent: true,
        opacity: 0.45,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(0, 15, 0);
      ringMesh.rotation.x = Math.random() * Math.PI;
      ringMesh.rotation.y = Math.random() * Math.PI;
      this.levelGroup.add(ringMesh);
      this.exRings.push({
        mesh: ringMesh,
        speedX: rc.rotX,
        speedY: rc.rotY,
        speedZ: rc.rotZ,
      });
    });

    // 10. 高速下降光条パーティクル (軽量化: 180本 & 固定BoundingSphereでNaN/CPU負荷ゼロ化)
    const pCount = 180;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    const colors = new Float32Array(pCount * 3);
    const c1 = new THREE.Color(0x00f3ff);
    const c2 = new THREE.Color(0xffd700);

    for (let i = 0; i < pCount; i++) {
      const rad = 12 + Math.random() * 55;
      const ang = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(ang) * rad;
      positions[i * 3 + 1] = -30 + Math.random() * 160;
      positions[i * 3 + 2] = Math.sin(ang) * rad;

      const c = Math.random() > 0.35 ? c1 : c2;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // 固定バウンディングスフィアを明示定義してcomputeBoundingSphereのNaN・毎フレーム計算を完全回避
    pGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 50, 0), 250);

    const pMat = new THREE.PointsMaterial({
      size: 0.60,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.exDustParticles = new THREE.Points(pGeo, pMat);
    this.levelGroup.add(this.exDustParticles);
    this.colliderMeshes = this.colliders.map(c => c.mesh);
  }

  update(delta) {
    if (this.currentBiome === 'ex_ascension') {
      this.altitude += delta * 1450;
      if (this.onAltitudeUpdate) {
        this.onAltitudeUpdate(this.altitude);
      }

      // 遥か下方の母星の自転
      if (this.exPlanet) {
        this.exPlanet.rotation.y += delta * 0.02;
        this.exPlanet.rotation.x += delta * 0.005;
      }

      // クォンタム・コアの回転
      if (this.exCoreMesh) {
        this.exCoreMesh.rotation.y += delta * 1.6;
        this.exCoreMesh.rotation.x += delta * 0.9;
      }
      if (this.exCoreRing) {
        this.exCoreRing.rotation.x += delta * 1.3;
        this.exCoreRing.rotation.z += delta * 2.2;
      }

      // ピラーのエネルギーパルスが高速下降
      if (this.exPillarPulses) {
        for (const pulse of this.exPillarPulses) {
          pulse.position.y -= delta * 160.0;
          if (pulse.position.y < -40) {
            pulse.position.y = 140;
          }
        }
      }

      // ベイパーリングが高速下降
      if (this.exVaporRings) {
        for (const vRing of this.exVaporRings) {
          vRing.position.y -= delta * 110.0;
          if (vRing.position.y < -50) {
            vRing.position.y = 120;
          }
        }
      }

      // 巨大同心円ジャイロリングの回転
      if (this.exRings && this.exRings.length > 0) {
        this.exRings.forEach(r => {
          r.mesh.rotation.x += r.speedX * delta;
          r.mesh.rotation.y += r.speedY * delta;
          r.mesh.rotation.z += r.speedZ * delta;
        });
      }

      // 光条パーティクルが急下降（エレベーター上昇演出）
      if (this.exDustParticles && this.exDustParticles.geometry) {
        const posAttr = this.exDustParticles.geometry.attributes.position;
        if (posAttr && posAttr.array) {
          const arr = posAttr.array;
          const speed = 180.0;
          const safeDelta = (delta > 0 && delta < 0.2) ? delta : 0.016;
          for (let i = 1; i < arr.length; i += 3) {
            arr[i] -= speed * safeDelta;
            if (arr[i] < -40 || isNaN(arr[i])) {
              arr[i] = 140 + Math.random() * 30;
            }
          }
          posAttr.needsUpdate = true;
        }
      }
    }
  }
}
