import * as THREE from 'three';

// Robust safety guard for THREE.BufferGeometry.computeBoundingSphere to prevent NaN crashes
const _origComputeBoundingSphere = THREE.BufferGeometry.prototype.computeBoundingSphere;
THREE.BufferGeometry.prototype.computeBoundingSphere = function() {
  _origComputeBoundingSphere.call(this);
  if (this.boundingSphere && isNaN(this.boundingSphere.radius)) {
    this.boundingSphere.radius = 50;
    this.boundingSphere.center.set(0, 0, 0);
  }
};

/**
 * 3D Graphics Engine wrapper using Three.js
 * Configured for natural sunny daytime outdoor illumination, soft shadows, and sky atmospheric haze.
 */
export class Engine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();

    // Natural Daytime Sky & Atmospheric Haze
    this.scene.background = new THREE.Color(0x87ceeb); // Clear Blue Sky
    this.scene.fog = new THREE.FogExp2(0xcde6f7, 0.008); // Soft Daytime Atmospheric Haze

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.defaultFOV = 75;
    // CRITICAL: Must add camera to scene so child viewmodels (weapon & arms) are rendered!
    this.scene.add(this.camera);

    // WebGL Renderer with performance optimizations
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.quality = 'medium';
    // Cap pixel ratio to 1.0 by default to avoid 4K rendering lag on high-DPI displays
    this.renderer.setPixelRatio(1.0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.appendChild(this.renderer.domElement);

    // Delta Time Clock
    this.clock = new THREE.Clock();

    // Setup Natural Daytime Lighting
    this.setupLighting();

    // Resize Handler with mobile fullscreen and orientation transition support
    const handleResize = () => {
      this.onResize();
      setTimeout(() => this.onResize(), 100);
      setTimeout(() => this.onResize(), 300);
    };
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    document.addEventListener('webkitfullscreenchange', handleResize);
    window.addEventListener('orientationchange', handleResize);
  }

  setQuality(qualityMode) {
    this.quality = qualityMode;
    if (qualityMode === 'low') {
      // 軽量モード (最大FPS重視): 影無効・DPR 1.0
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
    } else if (qualityMode === 'high') {
      // 高画質モード
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 1024;
      this.sunLight.shadow.mapSize.height = 1024;
    } else {
      // 標準モード (バランス): DPR 1.0・影1024
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 1024;
      this.sunLight.shadow.mapSize.height = 1024;
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setupLighting() {
    // 1. Sky & Earth Natural Hemispheric Bounce Light
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d7023, 1.3);
    this.scene.add(this.hemiLight);

    // 2. Soft Ambient Fill
    this.ambientLight = new THREE.AmbientLight(0xd4e9f7, 0.9);
    this.scene.add(this.ambientLight);

    // 3. Warm Golden Sunlight (Primary Directional Light casting crisp shadows)
    this.sunLight = new THREE.DirectionalLight(0xfff6e0, 2.5);
    this.sunLight.position.set(45, 85, 35);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 180;
    const d = 52;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);

    // Sun disc in sky
    const sunGeo = new THREE.SphereGeometry(4.5, 16, 16);
    this.sunMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    this.sunMesh = new THREE.Mesh(sunGeo, this.sunMat);
    this.sunMesh.position.set(120, 200, 90);
    this.scene.add(this.sunMesh);
  }

  setBiomeLighting(biome) {
    if (!this.scene) return;
    this.sunLight.castShadow = (biome !== 'ex_ascension' && this.quality !== 'low');

    if (biome === 'shinjuku') {
      // 1. ネオ・シンジュク: 雨天深夜の歓楽街 (高視認性シアン＆マゼンタネオン)
      this.scene.background.setHex(0x10162a);
      this.scene.fog.color.setHex(0x16203a);
      this.scene.fog.density = 0.006;
      this.hemiLight.color.setHex(0x00f3ff);
      this.hemiLight.groundColor.setHex(0x3a1044);
      this.hemiLight.intensity = 1.6;
      this.ambientLight.color.setHex(0x2a3e60);
      this.ambientLight.intensity = 1.2;
      this.sunLight.color.setHex(0xff0088);
      this.sunLight.intensity = 2.4;
      this.sunLight.position.set(-40, 65, 40);
      this.sunMat.color.setHex(0x00f3ff);
      this.sunMesh.position.set(-80, 130, 80);
    } else if (biome === 'slums') {
      // 2. インダストリアル・スラム: 夕暮れトワイライト (温かみのある高輝度ナトリウム灯)
      this.scene.background.setHex(0x2c1f16);
      this.scene.fog.color.setHex(0x38281d);
      this.scene.fog.density = 0.007;
      this.hemiLight.color.setHex(0xffaa66);
      this.hemiLight.groundColor.setHex(0x382012);
      this.hemiLight.intensity = 1.65;
      this.ambientLight.color.setHex(0x563826);
      this.ambientLight.intensity = 1.25;
      this.sunLight.color.setHex(0xff8833);
      this.sunLight.intensity = 2.8;
      this.sunLight.position.set(70, 35, -30);
      this.sunMat.color.setHex(0xffaa44);
      this.sunMesh.position.set(140, 70, -60);
    } else if (biome === 'matrix') {
      // 3. サイバー・マトリクス: 明るい電脳グリッド (鮮烈エメラルドグリーン)
      this.scene.background.setHex(0x061e12);
      this.scene.fog.color.setHex(0x0b2c1b);
      this.scene.fog.density = 0.006;
      this.hemiLight.color.setHex(0x00ff88);
      this.hemiLight.groundColor.setHex(0x062412);
      this.hemiLight.intensity = 1.65;
      this.ambientLight.color.setHex(0x1a5433);
      this.ambientLight.intensity = 1.2;
      this.sunLight.color.setHex(0x55ffaa);
      this.sunLight.intensity = 2.5;
      this.sunLight.position.set(0, 90, 0);
      this.sunMat.color.setHex(0x00ff88);
      this.sunMesh.position.set(0, 180, 0);
    } else if (biome === 'wasteland') {
      // 4. クリムゾン・ウェイスト: 溶岩荒野 (ハイコントラスト赤熱)
      this.scene.background.setHex(0x280e0e);
      this.scene.fog.color.setHex(0x381515);
      this.scene.fog.density = 0.006;
      this.hemiLight.color.setHex(0xff4433);
      this.hemiLight.groundColor.setHex(0x300808);
      this.hemiLight.intensity = 1.65;
      this.ambientLight.color.setHex(0x552020);
      this.ambientLight.intensity = 1.2;
      this.sunLight.color.setHex(0xff2211);
      this.sunLight.intensity = 2.8;
      this.sunLight.position.set(50, 45, 50);
      this.sunMat.color.setHex(0xff5533);
      this.sunMesh.position.set(100, 90, 100);
    } else if (biome === 'arctic') {
      // 5. アークティック・リサーチ: 白銀極地 (透き通る高輝度ホワイト)
      this.scene.background.setHex(0xc5dff0);
      this.scene.fog.color.setHex(0xd6eaf8);
      this.scene.fog.density = 0.005;
      this.hemiLight.color.setHex(0xe2f2fc);
      this.hemiLight.groundColor.setHex(0x829eb3);
      this.hemiLight.intensity = 1.6;
      this.ambientLight.color.setHex(0xcbe3f5);
      this.ambientLight.intensity = 1.3;
      this.sunLight.color.setHex(0xf8fbfe);
      this.sunLight.intensity = 2.9;
      this.sunLight.position.set(35, 75, 45);
      this.sunMat.color.setHex(0xffffff);
      this.sunMesh.position.set(70, 150, 90);
    } else if (biome === 'orbital') {
      // 6. オービタル・ドック: 軌道宇宙港 (明るいスターライトブルー)
      this.scene.background.setHex(0x0e1728);
      this.scene.fog.color.setHex(0x142036);
      this.scene.fog.density = 0.005;
      this.hemiLight.color.setHex(0xffea00);
      this.hemiLight.groundColor.setHex(0x102040);
      this.hemiLight.intensity = 1.55;
      this.ambientLight.color.setHex(0x28385a);
      this.ambientLight.intensity = 1.18;
      this.sunLight.color.setHex(0xffffff);
      this.sunLight.intensity = 2.7;
      this.sunLight.position.set(-60, 80, -20);
      this.sunMat.color.setHex(0xfff0aa);
      this.sunMesh.position.set(-120, 160, -40);
    } else if (biome === 'biodome') {
      // 7. アシッド・バイオドーム: 毒性密林 (視界良好アシッドライム)
      this.scene.background.setHex(0x162c14);
      this.scene.fog.color.setHex(0x203e1e);
      this.scene.fog.density = 0.006;
      this.hemiLight.color.setHex(0x99ff11);
      this.hemiLight.groundColor.setHex(0x381240);
      this.hemiLight.intensity = 1.6;
      this.ambientLight.color.setHex(0x30552d);
      this.ambientLight.intensity = 1.2;
      this.sunLight.color.setHex(0xbbff44);
      this.sunLight.intensity = 2.6;
      this.sunLight.position.set(40, 60, -40);
      this.sunMat.color.setHex(0x77ff00);
      this.sunMesh.position.set(80, 120, -80);
    } else if (biome === 'catacombs') {
      // 8. サンクチュアリ・カタコンベ: 聖堂地下迷宮 (神秘的な明るいサイバーバイオレット)
      this.scene.background.setHex(0x1e102f);
      this.scene.fog.color.setHex(0x2b1842);
      this.scene.fog.density = 0.006;
      this.hemiLight.color.setHex(0xdd55ff);
      this.hemiLight.groundColor.setHex(0x301a0a);
      this.hemiLight.intensity = 1.6;
      this.ambientLight.color.setHex(0x42265f);
      this.ambientLight.intensity = 1.2;
      this.sunLight.color.setHex(0xffcc44);
      this.sunLight.intensity = 2.6;
      this.sunLight.position.set(0, 75, 40);
      this.sunMat.color.setHex(0xe877ff);
      this.sunMesh.position.set(0, 150, 80);
    } else if (biome === 'solar') {
      // 9. ソーラー・アレイ: 灼熱黄金砂漠 (白熱ゴールド)
      this.scene.background.setHex(0xeea64c);
      this.scene.fog.color.setHex(0xdf983e);
      this.scene.fog.density = 0.005;
      this.hemiLight.color.setHex(0xfff099);
      this.hemiLight.groundColor.setHex(0x8a450c);
      this.hemiLight.intensity = 1.75;
      this.ambientLight.color.setHex(0xf3be7a);
      this.ambientLight.intensity = 1.35;
      this.sunLight.color.setHex(0xfffbe8);
      this.sunLight.intensity = 3.2;
      this.sunLight.position.set(65, 80, 20);
      this.sunMat.color.setHex(0xfffae0);
      this.sunMesh.position.set(130, 160, 40);
    } else if (biome === 'ex_ascension') {
      // 11. 超軌道昇降機 エーテル・アセンション (超宇宙空間・成層圏突破)
      // 無限の星空を見通せる超低密度フォグ & 神秘的なコズミックパープル/シアン
      this.scene.background.setHex(0x02020e);
      this.scene.fog.color.setHex(0x050518);
      this.scene.fog.density = 0.0006; // 惑星や宇宙空間を完璧に見通せる超クリア視程
      this.hemiLight.color.setHex(0x00f3ff);
      this.hemiLight.groundColor.setHex(0x4a0e66);
      this.hemiLight.intensity = 2.0;
      this.ambientLight.color.setHex(0x323c64);
      this.ambientLight.intensity = 1.45;
      this.sunLight.color.setHex(0xfff2bb);
      this.sunLight.intensity = 3.6;
      this.sunLight.position.set(0, 120, -50);
      this.sunMat.color.setHex(0xffea88);
      this.sunMesh.position.set(0, 240, -100);
      this.sunMesh.scale.set(2.2, 2.2, 2.2);
    } else {
      // 10. アビス・コア: 惑星深核 (明るいクォンタムシアン)
      this.scene.background.setHex(0x0a182e);
      this.scene.fog.color.setHex(0x102542);
      this.scene.fog.density = 0.006;
      this.hemiLight.color.setHex(0x00f3ff);
      this.hemiLight.groundColor.setHex(0x081830);
      this.hemiLight.intensity = 1.65;
      this.ambientLight.color.setHex(0x1e426e);
      this.ambientLight.intensity = 1.25;
      this.sunLight.color.setHex(0x88eeff);
      this.sunLight.intensity = 2.8;
      this.sunLight.position.set(-20, 85, 30);
      this.sunMat.color.setHex(0x00e1ff);
      this.sunMesh.position.set(-40, 170, 60);
    }
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  getDelta() {
    return Math.min(this.clock.getDelta(), 0.1);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
