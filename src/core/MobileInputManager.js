/**
 * MobileInputManager
 * High-performance, multi-touch input system for mobile and tablet devices.
 * Provides virtual joystick, smooth touch swipe camera aim, gyro aiming,
 * and on-screen action controls, with 100% interface compatibility with Player and Engine.
 */
export class MobileInputManager {
  constructor() {
    this.isLocked = false;
    this.sensitivity = 1.0;
    this.gyroSensitivity = 1.0;
    this.gyroEnabled = false;

    // Movement & Action Keys (Matches PC InputManager)
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      crouch: false,
      reload: false,
      aim: false,
      lookLeft: false,
      lookRight: false,
      lookUp: false,
      lookDown: false,
    };

    // Virtual mouse state
    this.mouse = {
      left: false,
      right: false,
      deltaX: 0,
      deltaY: 0,
    };

    // Joystick internal state
    this.joystick = {
      active: false,
      touchId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      maxRadius: 52, // Maximum stick travel distance in px
      sprintLocked: false,
    };

    // Look / Aim internal state
    this.aimTouch = {
      active: false,
      touchId: null,
      lastX: 0,
      lastY: 0,
    };

    // Fire button drag-aim state (allows aiming while pressing the fire button)
    this.fireTouch = {
      active: false,
      touchId: null,
      lastX: 0,
      lastY: 0,
    };

    // Gyro internal state
    this.gyro = {
      lastBeta: null,
      lastGamma: null,
      deltaX: 0,
      deltaY: 0,
    };

    // ADS Mode: 'toggle' or 'hold' (default 'toggle' is preferred for mobile)
    this.adsMode = 'toggle';
    this.isADSToggled = false;

    // Callbacks (same as InputManager)
    this.onLockChange = null;
    this.onWeaponSlotSelect = null;
    this.onReloadRequest = null;
    this.onPauseRequest = null;
    this.onGrenadeRequest = null;
    this.onAdrenalineRequest = null;
    this.onTogglePerfMonitor = null;

    // References to DOM elements
    this.dom = {};
  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.1, Math.min(5.0, parseFloat(val) || 1.0));
  }

  setGyroSensitivity(val) {
    this.gyroSensitivity = Math.max(0.1, Math.min(5.0, parseFloat(val) || 1.0));
  }

  setGyroEnabled(enabled) {
    this.gyroEnabled = !!enabled;
    if (this.gyroEnabled) {
      this.initGyroscope();
    } else {
      this.gyro.lastBeta = null;
      this.gyro.lastGamma = null;
    }
  }

  // PointerLock API is a no-op on touch devices
  requestLock() {
    this.isLocked = true;
    if (this.onLockChange) this.onLockChange(true);
  }

  exitLock() {
    this.isLocked = false;
    if (this.onLockChange) this.onLockChange(false);
  }

  /**
   * Bind DOM controls from mobile layout
   */
  bindUI(elements) {
    this.dom = elements;

    this.bindJoystick();
    this.bindAimSurface();
    this.bindActionButtons();
    this.bindGyroscope();
  }

  /**
   * 1. Virtual Movement Joystick (Left Thumb Area)
   */
  bindJoystick() {
    const zone = this.dom.joystickZone;
    const base = this.dom.joystickBase;
    const stick = this.dom.joystickStick;

    if (!zone || !base || !stick) return;

    const onTouchStart = (e) => {
      // If already tracking a joystick touch, ignore additional touches in this zone
      if (this.joystick.active) return;

      const touch = e.changedTouches ? e.changedTouches[0] : e;
      this.joystick.active = true;
      this.joystick.touchId = touch.identifier ?? 'mouse';

      const rect = zone.getBoundingClientRect();
      const clientX = touch.clientX;
      const clientY = touch.clientY;

      // Position base at touch position
      this.joystick.startX = clientX;
      this.joystick.startY = clientY;
      this.joystick.currentX = clientX;
      this.joystick.currentY = clientY;

      base.style.left = `${clientX - rect.left}px`;
      base.style.top = `${clientY - rect.top}px`;
      base.classList.add('active');
      stick.style.transform = `translate3d(0px, 0px, 0px)`;

      e.preventDefault();
    };

    const onTouchMove = (e) => {
      if (!this.joystick.active) return;

      const touches = e.changedTouches ?? [e];
      let touch = null;
      for (let i = 0; i < touches.length; i++) {
        if ((touches[i].identifier ?? 'mouse') === this.joystick.touchId) {
          touch = touches[i];
          break;
        }
      }
      if (!touch) return;

      let dx = touch.clientX - this.joystick.startX;
      let dy = touch.clientY - this.joystick.startY;
      const dist = Math.hypot(dx, dy);
      const maxR = this.joystick.maxRadius;

      // Clamp stick travel
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }

      stick.style.transform = `translate3d(${dx}px, ${dy}px, 0px)`;

      // Normalized input (-1.0 to 1.0)
      const normX = dx / maxR;
      const normY = dy / maxR;
      const deadzone = 0.18;

      // Direction keys
      this.keys.right = normX > deadzone;
      this.keys.left = normX < -deadzone;
      this.keys.forward = normY < -deadzone;
      this.keys.backward = normY > deadzone;

      // Automatic sprint when pushed near edge (> 78% distance)
      const isNearEdge = (dist / maxR) > 0.78;
      this.keys.sprint = isNearEdge && this.keys.forward;

      e.preventDefault();
    };

    const onTouchEnd = (e) => {
      if (!this.joystick.active) return;

      const touches = e.changedTouches ?? [e];
      let match = false;
      for (let i = 0; i < touches.length; i++) {
        if ((touches[i].identifier ?? 'mouse') === this.joystick.touchId) {
          match = true;
          break;
        }
      }
      if (!match && e.type !== 'pointerup' && e.type !== 'pointercancel') return;

      this.joystick.active = false;
      this.joystick.touchId = null;
      this.keys.forward = false;
      this.keys.backward = false;
      this.keys.left = false;
      this.keys.right = false;
      this.keys.sprint = false;

      base.classList.remove('active');
      stick.style.transform = `translate3d(0px, 0px, 0px)`;

      if (e.cancelable) e.preventDefault();
    };

    zone.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  /**
   * 2. Touch Screen Aim Surface (Right Hand Area)
   */
  bindAimSurface() {
    const aimZone = this.dom.aimZone;
    if (!aimZone) return;

    const onTouchStart = (e) => {
      // Only process touches not originating from actionable buttons
      const target = e.target;
      if (target.closest('.touch-btn, .action-btn, select, input, button')) return;

      const touches = e.changedTouches ?? [e];
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        if (!this.aimTouch.active) {
          this.aimTouch.active = true;
          this.aimTouch.touchId = t.identifier ?? 'mouse';
          this.aimTouch.lastX = t.clientX;
          this.aimTouch.lastY = t.clientY;
          break;
        }
      }
    };

    const onTouchMove = (e) => {
      if (!this.aimTouch.active) return;

      const touches = e.changedTouches ?? [e];
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        if ((t.identifier ?? 'mouse') === this.aimTouch.touchId) {
          const dx = t.clientX - this.aimTouch.lastX;
          const dy = t.clientY - this.aimTouch.lastY;

          // Filter out abnormal sudden spikes
          if (Math.abs(dx) < 250 && Math.abs(dy) < 250) {
            this.mouse.deltaX += dx * 1.35;
            this.mouse.deltaY += dy * 1.35;
          }

          this.aimTouch.lastX = t.clientX;
          this.aimTouch.lastY = t.clientY;
          break;
        }
      }
    };

    const onTouchEnd = (e) => {
      if (!this.aimTouch.active) return;

      const touches = e.changedTouches ?? [e];
      for (let i = 0; i < touches.length; i++) {
        if ((touches[i].identifier ?? 'mouse') === this.aimTouch.touchId) {
          this.aimTouch.active = false;
          this.aimTouch.touchId = null;
          break;
        }
      }
    };

    aimZone.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  }

  /**
   * 3. On-Screen Action Buttons
   */
  bindActionButtons() {
    const bindBtn = (el, onDown, onUp) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        if (document.body.classList.contains('hud-editing')) return;
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('pressed');
        if (onDown) onDown(e);
      }, { passive: false });

      const handleRelease = (e) => {
        el.classList.remove('pressed');
        if (onUp) onUp(e);
      };

      el.addEventListener('touchend', handleRelease, { passive: true });
      el.addEventListener('touchcancel', handleRelease, { passive: true });
    };

    // Primary Fire Button (Supports drag-to-aim while firing)
    const btnFire = this.dom.btnFire;
    if (btnFire) {
      btnFire.addEventListener('touchstart', (e) => {
        if (document.body.classList.contains('hud-editing')) return;
        e.preventDefault();
        e.stopPropagation();
        btnFire.classList.add('pressed');
        this.mouse.left = true;

        const touch = e.changedTouches[0];
        this.fireTouch.active = true;
        this.fireTouch.touchId = touch.identifier;
        this.fireTouch.lastX = touch.clientX;
        this.fireTouch.lastY = touch.clientY;
      }, { passive: false });

      btnFire.addEventListener('touchmove', (e) => {
        if (!this.fireTouch.active) return;
        const touches = e.changedTouches;
        for (let i = 0; i < touches.length; i++) {
          if (touches[i].identifier === this.fireTouch.touchId) {
            const dx = touches[i].clientX - this.fireTouch.lastX;
            const dy = touches[i].clientY - this.fireTouch.lastY;

            if (Math.abs(dx) < 200 && Math.abs(dy) < 200) {
              this.mouse.deltaX += dx * 1.1;
              this.mouse.deltaY += dy * 1.1;
            }
            this.fireTouch.lastX = touches[i].clientX;
            this.fireTouch.lastY = touches[i].clientY;
            break;
          }
        }
      }, { passive: true });

      const releaseFire = (e) => {
        btnFire.classList.remove('pressed');
        this.mouse.left = false;
        this.fireTouch.active = false;
        this.fireTouch.touchId = null;
      };
      btnFire.addEventListener('touchend', releaseFire, { passive: true });
      btnFire.addEventListener('touchcancel', releaseFire, { passive: true });
    }


    // ADS / Precision Aim Button (Toggle mode)
    const btnAds = this.dom.btnAds;
    if (btnAds) {
      bindBtn(btnAds, () => {
        this.isADSToggled = !this.isADSToggled;
        this.mouse.right = this.isADSToggled;
        this.keys.aim = this.isADSToggled;
        if (this.isADSToggled) {
          btnAds.classList.add('toggled');
        } else {
          btnAds.classList.remove('toggled');
        }
      });
    }

    // Jump Button
    const btnJump = this.dom.btnJump;
    if (btnJump) {
      bindBtn(btnJump, () => { this.keys.jump = true; }, () => { this.keys.jump = false; });
    }

    // Slide / Crouch Button
    const btnCrouch = this.dom.btnCrouch;
    if (btnCrouch) {
      bindBtn(btnCrouch, () => { this.keys.crouch = true; }, () => { this.keys.crouch = false; });
    }

    // Reload Button
    const btnReload = this.dom.btnReload;
    if (btnReload) {
      bindBtn(btnReload, () => {
        this.keys.reload = true;
        if (this.onReloadRequest) this.onReloadRequest();
      }, () => {
        this.keys.reload = false;
      });
    }

    // Grenade Button
    const btnGrenade = this.dom.btnGrenade;
    if (btnGrenade) {
      bindBtn(btnGrenade, () => {
        if (this.onGrenadeRequest) this.onGrenadeRequest();
      });
    }

    // Adrenaline / Bullet Time Button
    const btnBulletTime = this.dom.btnBulletTime;
    if (btnBulletTime) {
      bindBtn(btnBulletTime, () => {
        if (this.onAdrenalineRequest) this.onAdrenalineRequest();
      });
    }


    // Pause Button
    const btnPause = this.dom.btnPause;
    if (btnPause) {
      bindBtn(btnPause, () => {
        if (this.onPauseRequest) this.onPauseRequest();
      });
    }

    // Fullscreen Toggle Button
    const btnFullscreen = this.dom.btnFullscreen;
    if (btnFullscreen) {
      bindBtn(btnFullscreen, () => {
        this.toggleFullscreen();
      });
      btnFullscreen.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleFullscreen();
      });
    }
  }

  /**
   * 4. Gyroscope Aiming (Tilt to aim)
   */
  bindGyroscope() {
    this.handleOrientation = (e) => {
      if (!this.gyroEnabled || e.beta === null || e.gamma === null) return;

      // In landscape orientation:
      // Beta corresponds to pitch/yaw depending on screen orientation
      const screenAngle = window.screen?.orientation?.angle ?? 90;
      let beta = e.beta;
      let gamma = e.gamma;

      if (this.gyro.lastBeta !== null && this.gyro.lastGamma !== null) {
        let diffBeta = beta - this.gyro.lastBeta;
        let diffGamma = gamma - this.gyro.lastGamma;

        // Correct for landscape-primary (90 deg) vs landscape-secondary (270 deg)
        let yawChange = 0;
        let pitchChange = 0;

        if (screenAngle === 90) {
          yawChange = -diffBeta;
          pitchChange = diffGamma;
        } else if (screenAngle === 270) {
          yawChange = diffBeta;
          pitchChange = -diffGamma;
        } else {
          yawChange = diffGamma;
          pitchChange = diffBeta;
        }

        // Clamp extreme gyro shakes
        if (Math.abs(yawChange) < 12 && Math.abs(pitchChange) < 12) {
          const gyroFactor = 0.0035 * this.gyroSensitivity;
          this.gyro.deltaX += yawChange * gyroFactor;
          this.gyro.deltaY += pitchChange * gyroFactor;
        }
      }

      this.gyro.lastBeta = beta;
      this.gyro.lastGamma = gamma;
    };
  }

  async initGyroscope() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', this.handleOrientation);
        } else {
          console.warn('Gyroscope permission denied.');
          this.gyroEnabled = false;
        }
      } catch (err) {
        console.warn('Error requesting gyro permission:', err);
        this.gyroEnabled = false;
      }
    } else {
      window.addEventListener('deviceorientation', this.handleOrientation);
    }
  }

  toggleFullscreen() {
    try {
      const docEl = document.documentElement;
      const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);

      if (!isFullscreen) {
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {
            this.handleFullscreenFallback();
          });
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else {
          this.handleFullscreenFallback();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch (e) {
      this.handleFullscreenFallback();
    }
  }

  handleFullscreenFallback() {
    window.scrollTo(0, 1);
    if (window.game && window.game.hud && typeof window.game.hud.showPickupToast === 'function') {
      window.game.hud.showPickupToast('📱 iOS Safariは「共有 ➔ ホーム画面に追加」で全画面アプリ化できます', 'supply');
    }
  }

  /**
   * Consumes accumulated touch and gyro deltas for the current frame
   */
  consumeMouseDelta() {
    let dx = this.mouse.deltaX * this.sensitivity * 0.0022;
    let dy = this.mouse.deltaY * this.sensitivity * 0.0022;

    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;

    // Incorporate gyro tilt
    if (this.gyroEnabled) {
      dx += this.gyro.deltaX;
      dy += this.gyro.deltaY;
      this.gyro.deltaX = 0;
      this.gyro.deltaY = 0;
    }

    return { dx, dy };
  }

  isFiring() {
    return this.mouse.left;
  }

  isAimingDownSight() {
    return this.mouse.right || !!this.keys.aim;
  }
}
