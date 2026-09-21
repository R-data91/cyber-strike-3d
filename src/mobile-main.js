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
      btnAds: document.getElementById('btn-ads'),
      btnJump: document.getElementById('btn-jump'),
      btnCrouch: document.getElementById('btn-crouch'),
      btnReload: document.getElementById('btn-reload'),
      btnGrenade: document.getElementById('btn-grenade'),
      btnBulletTime: document.getElementById('btn-bullet-time'),
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

    // 7. Setup Web Audio unlocking on first user touch gesture
    this.setupAudioUnlock();

    // 8. Prevent accidental gestures (pinch-zoom, bounce scroll)
    this.preventAccidentalGestures();

    // 9. Setup HUD Customizer (Position drag & drop, size slider, persistence)
    this.setupHudCustomizer();

    // 10. Setup auto-pause on portrait orientation during gameplay
    this.setupOrientationAutoPause();
  }

  setupAudioUnlock() {
    const unlock = () => {
      if (this.game && this.game.audio) {
        this.game.audio.resume();
      }
    };
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
  }

  setupWeaponSlotsTouch() {
    const bindSlotTouch = (el, onTrigger) => {
      if (!el) return;
      let handled = false;
      const trigger = (e) => {
        if (handled) return;
        handled = true;
        setTimeout(() => { handled = false; }, 120);
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        onTrigger();
      };
      el.addEventListener('touchstart', trigger, { passive: false });
      el.addEventListener('pointerdown', trigger, { passive: false });
      el.addEventListener('click', trigger);
    };

    // Direct touch support for weapon slots 1-6
    for (let i = 1; i <= 6; i++) {
      const slot = document.getElementById(`slot-${i}`);
      bindSlotTouch(slot, () => {
        if (this.game && this.game.player) {
          this.game.player.switchWeapon(i - 1);
          const w = this.game.player.activeWeapon;
          // Immediate visual slot highlight update
          for (let s = 1; s <= 6; s++) {
            const slotEl = document.getElementById(`slot-${s}`);
            if (slotEl) {
              if (s === i) slotEl.classList.add('active');
              else slotEl.classList.remove('active');
            }
          }
          if (this.game.hud) {
            this.game.hud.showPickupToast(`【兵装切替】[${i}] ${w.displayName || w.name}`, 'supply');
            const nameEl = document.getElementById('hud-current-weapon-name');
            if (nameEl) nameEl.textContent = w.name;
          }
        }
      });
    }

    // Direct touch support for Ammo panel (tap to reload)
    const ammoPanel = document.querySelector('.ammo-panel');
    bindSlotTouch(ammoPanel, () => {
      if (this.game && this.game.player && this.game.player.activeWeapon) {
        this.game.player.activeWeapon.reload();
      }
    });
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

  setupHudCustomizer() {
    const HUD_BUTTONS = [
      { id: 'btn-fire', name: '射撃 (FIRE)', defaultW: 94, defaultH: 94 },
      { id: 'btn-jump', name: 'ジャンプ (JUMP)', defaultW: 54, defaultH: 54 },
      { id: 'btn-crouch', name: 'スライド (SLIDE)', defaultW: 50, defaultH: 50 },
      { id: 'btn-ads', name: '照準 (ADS)', defaultW: 52, defaultH: 52 },
      { id: 'btn-reload', name: 'リロード (RELOAD)', defaultW: 46, defaultH: 46 },
      { id: 'btn-grenade', name: '手榴弾 (GRENADE)', defaultW: 44, defaultH: 44 },
      { id: 'btn-bullet-time', name: 'バレットタイム (TIME)', defaultW: 44, defaultH: 44 },
    ];

    const STORAGE_KEY = 'cyber_strike_mobile_hud_layout_v2';
    let currentLayout = {};
    let selectedBtnDef = HUD_BUTTONS[0];
    let originModal = null;

    // 1. Load persisted layout from localStorage
    const loadSavedLayout = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          currentLayout = JSON.parse(raw);
          applyAllLayout();
        }
      } catch (e) {
        console.warn('Failed to load HUD layout:', e);
      }
    };

    const applyAllLayout = () => {
      HUD_BUTTONS.forEach((b) => {
        const el = document.getElementById(b.id);
        if (!el) return;
        const conf = currentLayout[b.id];
        if (conf) {
          if (conf.right !== undefined) el.style.right = `${conf.right}px`;
          if (conf.bottom !== undefined) el.style.bottom = `${conf.bottom}px`;
          if (conf.width !== undefined) el.style.width = `${conf.width}px`;
          if (conf.height !== undefined) el.style.height = `${conf.height}px`;
          if (conf.scale !== undefined) el.dataset.hudScale = conf.scale;
        }
      });
    };

    const resetLayout = () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      currentLayout = {};
      HUD_BUTTONS.forEach((b) => {
        const el = document.getElementById(b.id);
        if (el) {
          el.style.right = '';
          el.style.bottom = '';
          el.style.width = '';
          el.style.height = '';
          delete el.dataset.hudScale;
        }
      });
      if (slider) slider.value = 100;
      if (sizeDisplay) sizeDisplay.textContent = '100%';
    };

    // UI elements
    const editor = document.getElementById('hud-custom-editor');
    const targetName = document.getElementById('hud-custom-target-name');
    const slider = document.getElementById('hud-custom-size-slider');
    const sizeDisplay = document.getElementById('hud-custom-size-display');
    const btnReset = document.getElementById('btn-hud-custom-reset');
    const btnSave = document.getElementById('btn-hud-custom-save');

    const btnStartCustom = document.getElementById('btn-start-custom-hud');
    const btnPauseCustom = document.getElementById('btn-pause-custom-hud');
    const startScreen = document.getElementById('start-screen');
    const pauseScreen = document.getElementById('pause-screen');

    const selectButton = (btnDef) => {
      selectedBtnDef = btnDef;
      HUD_BUTTONS.forEach(b => {
        const el = document.getElementById(b.id);
        if (el) {
          if (b.id === btnDef.id) el.classList.add('custom-selected');
          else el.classList.remove('custom-selected');
        }
      });
      // Update quick selection chips in toolbar
      const chips = document.querySelectorAll('.btn-custom-chip');
      chips.forEach(c => {
        if (c.dataset.id === btnDef.id) c.classList.add('active');
        else c.classList.remove('active');
      });
      if (targetName) targetName.textContent = `選択中: [${btnDef.name}]`;
      const currentScale = currentLayout[btnDef.id]?.scale || 100;
      if (slider) slider.value = currentScale;
      if (sizeDisplay) sizeDisplay.textContent = `${currentScale}%`;
    };

    const openEditor = (fromModal) => {
      originModal = fromModal;
      if (originModal) originModal.classList.add('hidden');
      document.body.classList.add('hud-editing');
      if (editor) editor.classList.remove('hidden');
      selectButton(HUD_BUTTONS[0]);
    };

    const closeEditor = (save = true) => {
      if (save) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(currentLayout));
        } catch (e) {}
      }
      document.body.classList.remove('hud-editing');
      HUD_BUTTONS.forEach(b => {
        const el = document.getElementById(b.id);
        if (el) el.classList.remove('custom-selected');
      });
      if (editor) editor.classList.add('hidden');
      if (originModal) originModal.classList.remove('hidden');
      originModal = null;
    };

    if (btnStartCustom) btnStartCustom.addEventListener('click', () => openEditor(startScreen));
    if (btnPauseCustom) btnPauseCustom.addEventListener('click', () => openEditor(pauseScreen));

    if (btnSave) btnSave.addEventListener('click', () => closeEditor(true));
    if (btnReset) btnReset.addEventListener('click', () => resetLayout());

    // Click handler for custom chips
    const chipsBar = document.getElementById('hud-custom-chips-bar');
    if (chipsBar) {
      chipsBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.btn-custom-chip');
        if (!chip) return;
        const targetDef = HUD_BUTTONS.find(b => b.id === chip.dataset.id);
        if (targetDef) selectButton(targetDef);
      });
    }

    // Slider for scale
    if (slider) {
      slider.addEventListener('input', (e) => {
        if (!selectedBtnDef) return;
        const scale = parseInt(e.target.value, 10);
        if (sizeDisplay) sizeDisplay.textContent = `${scale}%`;
        const el = document.getElementById(selectedBtnDef.id);
        if (!el) return;
        const newW = Math.round(selectedBtnDef.defaultW * (scale / 100));
        const newH = Math.round(selectedBtnDef.defaultH * (scale / 100));
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
        el.dataset.hudScale = scale;
        if (!currentLayout[selectedBtnDef.id]) currentLayout[selectedBtnDef.id] = {};
        currentLayout[selectedBtnDef.id].width = newW;
        currentLayout[selectedBtnDef.id].height = newH;
        currentLayout[selectedBtnDef.id].scale = scale;
      });
    }

    // Touch & Pointer Drag for Buttons
    HUD_BUTTONS.forEach((btnDef) => {
      const el = document.getElementById(btnDef.id);
      if (!el) return;

      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initRight = 0;
      let initBottom = 0;

      const onDragStart = (clientX, clientY) => {
        if (!document.body.classList.contains('hud-editing')) return false;
        selectButton(btnDef);
        isDragging = true;
        startX = clientX;
        startY = clientY;
        const rect = el.getBoundingClientRect();
        initRight = window.innerWidth - rect.right;
        initBottom = window.innerHeight - rect.bottom;
        return true;
      };

      const onDragMove = (clientX, clientY) => {
        if (!isDragging) return;
        const dx = clientX - startX;
        const dy = clientY - startY;

        // Since origin is bottom-right:
        // Moving right (positive dx) means right decreases.
        // Moving down (positive dy) means bottom decreases.
        const elW = el.offsetWidth || btnDef.defaultW;
        const elH = el.offsetHeight || btnDef.defaultH;

        const maxRight = window.innerWidth - elW - 6;
        const maxBottom = window.innerHeight - elH - 6;

        const newRight = Math.max(6, Math.min(maxRight, initRight - dx));
        const newBottom = Math.max(6, Math.min(maxBottom, initBottom - dy));

        el.style.right = `${Math.round(newRight)}px`;
        el.style.bottom = `${Math.round(newBottom)}px`;

        if (!currentLayout[btnDef.id]) currentLayout[btnDef.id] = {};
        currentLayout[btnDef.id].right = Math.round(newRight);
        currentLayout[btnDef.id].bottom = Math.round(newBottom);
      };

      const onDragEnd = () => {
        isDragging = false;
      };

      el.addEventListener('touchstart', (e) => {
        if (!document.body.classList.contains('hud-editing')) return;
        const t = e.touches[0];
        if (onDragStart(t.clientX, t.clientY)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, { passive: false });

      el.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const t = e.touches[0];
        onDragMove(t.clientX, t.clientY);
        e.preventDefault();
        e.stopPropagation();
      }, { passive: false });

      el.addEventListener('touchend', () => onDragEnd(), { passive: true });
      el.addEventListener('touchcancel', () => onDragEnd(), { passive: true });

      // Pointer events for desktop testing / mouse emulation
      el.addEventListener('pointerdown', (e) => {
        if (!document.body.classList.contains('hud-editing')) return;
        if (onDragStart(e.clientX, e.clientY)) {
          e.preventDefault();
          e.stopPropagation();
          const moveHandler = (ev) => onDragMove(ev.clientX, ev.clientY);
          const upHandler = () => {
            onDragEnd();
            window.removeEventListener('pointermove', moveHandler);
            window.removeEventListener('pointerup', upHandler);
          };
          window.addEventListener('pointermove', moveHandler);
          window.addEventListener('pointerup', upHandler);
        }
      });
      // Direct click to select during editing
      el.addEventListener('click', (e) => {
        if (!document.body.classList.contains('hud-editing')) return;
        selectButton(btnDef);
      });
    });

    // Initial load
    loadSavedLayout();
  }

  setupOrientationAutoPause() {
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      if (isPortrait && this.game && this.game.state === 'PLAYING') {
        this.game.pauseGame();
      }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => {
      setTimeout(checkOrientation, 100);
      setTimeout(checkOrientation, 300);
    });
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', () => {
        setTimeout(checkOrientation, 100);
        setTimeout(checkOrientation, 300);
      });
    }
  }
}

// Start mobile application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new MobileCyberStrikeApp();
});
