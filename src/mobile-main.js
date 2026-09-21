/**
 * CYBER STRIKE 3D - Mobile & Tablet Entry Point
 */
window.__CYBER_STRIKE_MOBILE_ENTRY__ = true;

import { MobileInputManager } from './core/MobileInputManager.js';
import { CyberStrikeGame } from './main.js';

class MobileCyberStrikeApp {
  constructor() {
    this.mobileInput = new MobileInputManager();
    this.game = null;
    this.wakeLock = null;

    this.init();
  }

  init() {
    // 1. Collect Mobile DOM elements
    const dom = {
      joystickZone: document.getElementById('joystick-zone'),
      joystickBase: document.getElementById('joystick-base'),
      joystickStick: document.getElementById('joystick-stick'),
      aimZone: document.getElementById('aim-zone'),
      btnFire: document.getElementById('btn-fire'),
      btnLeftFire: document.getElementById('btn-left-fire'),
      btnAds: document.getElementById('btn-ads'),
      btnJump: document.getElementById('btn-jump'),
      btnCrouch: document.getElementById('btn-crouch'),
      btnReload: document.getElementById('btn-reload'),
      btnGrenade: document.getElementById('btn-grenade'),
      btnBulletTime: document.getElementById('btn-bullet-time'),
      btnWeaponPrev: document.getElementById('btn-weapon-prev'),
      btnWeaponNext: document.getElementById('btn-weapon-next'),
      btnPause: document.getElementById('btn-pause'),
      btnFullscreen: document.getElementById('btn-fullscreen'),
    };

    // 2. Bind touch controls to MobileInputManager
    this.mobileInput.bindUI(dom);

    // 3. Instantiate Game Core with MobileInputManager
    this.game = new CyberStrikeGame({
      isMobile: true,
      input: this.mobileInput
    });
    window.game = this.game;

    // 4. Bind mobile settings (Gyro, Sensitivity, etc.)
    this.bindMobileSettings();

    // 5. Setup Weapon Slots and Ammo Panel touch responsiveness
    this.setupWeaponSlotsTouch();

    // 6. Setup screen wake lock
    this.setupWakeLock();

    // 7. Prevent accidental gestures (pinch-zoom, bounce scroll)
    this.preventAccidentalGestures();
  }

  setupWeaponSlotsTouch() {
    // Direct touch support for weapon slots 1-6
    for (let i = 1; i <= 6; i++) {
      const slot = document.getElementById(`slot-${i}`);
      if (slot) {
        slot.addEventListener('touchstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.game && this.game.player) {
            this.game.player.switchWeapon(i - 1);
            const w = this.game.player.activeWeapon;
            if (this.game.hud) {
              this.game.hud.showPickupToast(`【兵装切替】[${i}] ${w.displayName || w.name}`, 'supply');
            }
          }
        }, { passive: false });
      }
    }

    // Direct touch support for Grenade slot
    const slotGrenade = document.getElementById('slot-grenade');
    if (slotGrenade) {
      slotGrenade.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.game && this.game.state === 'PLAYING') {
          if (!this.game.player.throwGrenade(this.game.grenades)) {
            this.game.hud.showPickupToast('手榴弾の残弾がありません！', 'supply');
          }
        }
      }, { passive: false });
    }

    // Direct touch support for Ammo panel (tap to reload)
    const ammoPanel = document.querySelector('.ammo-panel');
    if (ammoPanel) {
      ammoPanel.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.game && this.game.player && this.game.player.activeWeapon) {
          this.game.player.activeWeapon.reload();
        }
      }, { passive: false });
    }
  }

  bindMobileSettings() {
    // Gyroscope toggle in Start Screen & Pause Screen
    const toggleGyro = document.getElementById('toggle-gyro');
    const pauseToggleGyro = document.getElementById('pause-toggle-gyro');

    const handleGyroChange = async (checked) => {
      if (toggleGyro) toggleGyro.checked = checked;
      if (pauseToggleGyro) pauseToggleGyro.checked = checked;
      this.mobileInput.setGyroEnabled(checked);
    };

    if (toggleGyro) {
      toggleGyro.addEventListener('change', (e) => handleGyroChange(e.target.checked));
    }
    if (pauseToggleGyro) {
      pauseToggleGyro.addEventListener('change', (e) => handleGyroChange(e.target.checked));
    }

    // Touch Sensitivity Controls
    const sensInput = document.getElementById('input-sens');
    const sensDisplay = document.getElementById('sens-val-display');
    const pauseSensInput = document.getElementById('pause-input-sens');
    const pauseSensDisplay = document.getElementById('pause-sens-val');

    const updateTouchSens = (val) => {
      const num = parseFloat(val);
      this.mobileInput.setSensitivity(num);
      if (sensInput) sensInput.value = num;
      if (pauseSensInput) pauseSensInput.value = num;
      if (sensDisplay) sensDisplay.textContent = num.toFixed(2);
      if (pauseSensDisplay) pauseSensDisplay.textContent = num.toFixed(2);
    };

    if (sensInput) sensInput.addEventListener('input', (e) => updateTouchSens(e.target.value));
    if (pauseSensInput) pauseSensInput.addEventListener('input', (e) => updateTouchSens(e.target.value));

    // Default touch sensitivity
    updateTouchSens(1.00);
  }


  async setupWakeLock() {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          this.wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
          console.warn('Wake Lock request error:', err);
        }
      }
    };

    // Request wake lock when user interacts
    document.addEventListener('touchstart', requestWakeLock, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    });
  }

  preventAccidentalGestures() {
    // Disable double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });

    // Prevent pinch-zoom gestures
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('gestureend', (e) => e.preventDefault());
  }
}

// Start mobile application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new MobileCyberStrikeApp();
});
