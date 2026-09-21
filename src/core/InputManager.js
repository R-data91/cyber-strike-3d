/**
 * InputManager
 * Handles Pointer Lock API, mouse aiming with fallback, keyboard movement, weapon switching,
 * and seamless fallback look controls for environments where Pointer Lock is restricted.
 */
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.isLocked = false;
    this.sensitivity = 1.0;

    // Movement keys (WASD)
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
      // Arrow keys for optional view look / accessibility
      lookLeft: false,
      lookRight: false,
      lookUp: false,
      lookDown: false,
    };

    // Mouse buttons and motion
    this.mouse = {
      left: false,
      right: false,
      deltaX: 0,
      deltaY: 0,
      wheelDelta: 0,
      lastClientX: null,
      lastClientY: null,
      isDragging: false,
    };

    // Callbacks
    this.onLockChange = null;
    this.onWeaponSlotSelect = null;
    this.onReloadRequest = null;
    this.onPauseRequest = null;
    this.onGrenadeRequest = null;
    this.onAdrenalineRequest = null;
    this.onTogglePerfMonitor = null;

    this.bindEvents();
  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.05, Math.min(5.0, val));
  }

  /**
   * Request Pointer Lock with multiple fallbacks and error handling
   */
  requestLock() {
    try {
      const target = this.canvas || document.body;
      if (target && target.requestPointerLock) {
        // Try unadjustedMovement for high-precision esports aim if supported
        const promise = target.requestPointerLock({ unadjustedMovement: true });
        if (promise && promise.catch) {
          promise.catch(() => {
            // Fallback to standard requestPointerLock
            try {
              target.requestPointerLock();
            } catch (err) {
              console.warn('PointerLock fallback failed:', err);
            }
          });
        }
      } else if (document.body.requestPointerLock) {
        document.body.requestPointerLock();
      }
    } catch (e) {
      console.warn('Pointer Lock request error (fallback look mode active):', e);
    }
  }

  exitLock() {
    try {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch (e) {
      console.warn('Pointer Lock exit error:', e);
    }
  }

  bindEvents() {
    // 1. Pointer lock change listener
    const handleLockChange = () => {
      const lockElem = document.pointerLockElement;
      this.isLocked = !!lockElem && (lockElem === this.canvas || lockElem === document.body);
      if (this.onLockChange) {
        this.onLockChange(this.isLocked);
      }
    };

    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('mozpointerlockchange', handleLockChange);
    document.addEventListener('webkitpointerlockchange', handleLockChange);

    document.addEventListener('pointerlockerror', (err) => {
      // Non-fatal warning; game seamlessly transitions to fallback look mode
      console.warn('PointerLock unavailable in this context. Fallback drag/look mode is active.');
      this.isLocked = false;
    });

    // 2. Mouse movement handler (Supports both Pointer Lock and Fallback Look)
    document.addEventListener('mousemove', (e) => {
      if (this.isLocked) {
        // Pointer Lock Active: direct movementX / movementY
        let mx = e.movementX ?? e.mozMovementX ?? e.webkitMovementX ?? 0;
        let my = e.movementY ?? e.mozMovementY ?? e.webkitMovementY ?? 0;

        // Clamp abnormal spikes from browser focus changes
        if (Math.abs(mx) > 300) mx = Math.sign(mx) * 50;
        if (Math.abs(my) > 300) my = Math.sign(my) * 50;

        this.mouse.deltaX += mx;
        this.mouse.deltaY += my;
      } else {
        // Pointer Lock Inactive (Fallback Look Mode):
        // Calculate delta from clientX / clientY
        if (this.mouse.lastClientX !== null && this.mouse.lastClientY !== null) {
          const dx = e.clientX - this.mouse.lastClientX;
          const dy = e.clientY - this.mouse.lastClientY;

          // Always allow looking if dragging OR if mouse is moving across viewport
          if (Math.abs(dx) < 250 && Math.abs(dy) < 250) {
            this.mouse.deltaX += dx;
            this.mouse.deltaY += dy;
          }
        }
        this.mouse.lastClientX = e.clientX;
        this.mouse.lastClientY = e.clientY;
      }
    });

    // 3. Mouse button events
    const handleMouseDown = (e) => {
      if (e.button === 0) {
        this.mouse.left = true;
        this.mouse.isDragging = true;
      }
      if (e.button === 2) {
        this.mouse.right = true;
      }

      // If clicked on the game canvas or viewport and not locked, re-request pointer lock
      if (!this.isLocked) {
        const isInteractiveUI = e.target.closest('button, input, select, a, .terminal-modal');
        if (!isInteractiveUI) {
          this.requestLock();
        }
      }

      this.mouse.lastClientX = e.clientX;
      this.mouse.lastClientY = e.clientY;
    };

    const handleMouseUp = (e) => {
      if (e.button === 0) {
        this.mouse.left = false;
        this.mouse.isDragging = false;
      }
      if (e.button === 2) {
        this.mouse.right = false;
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    // Re-sync client pos when mouse enters/leaves window
    window.addEventListener('mouseenter', (e) => {
      this.mouse.lastClientX = e.clientX;
      this.mouse.lastClientY = e.clientY;
    });
    window.addEventListener('mouseleave', () => {
      this.mouse.lastClientX = null;
      this.mouse.lastClientY = null;
    });

    // Prevent context menu on right click (ADS aim)
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Mouse wheel (weapon cycle)
    window.addEventListener('wheel', (e) => {
      if (e.deltaY > 0) {
        if (this.onWeaponSlotSelect) this.onWeaponSlotSelect('next');
      } else if (e.deltaY < 0) {
        if (this.onWeaponSlotSelect) this.onWeaponSlotSelect('prev');
      }
    }, { passive: true });

    // 4. Keyboard events
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const key = e.code;

      // WASD Movement
      if (key === 'KeyW') this.keys.forward = true;
      if (key === 'KeyS') this.keys.backward = true;
      if (key === 'KeyA') this.keys.left = true;
      if (key === 'KeyD') this.keys.right = true;
      if (key === 'Space') this.keys.jump = true;
      if (key === 'ShiftLeft' || key === 'ShiftRight') this.keys.sprint = true;
      if (key === 'KeyC' || key === 'ControlLeft' || key === 'ControlRight') this.keys.crouch = true;

      // Arrow Keys for Look / Accessibility
      if (key === 'ArrowUp') this.keys.lookUp = true;
      if (key === 'ArrowDown') this.keys.lookDown = true;
      if (key === 'ArrowLeft') this.keys.lookLeft = true;
      if (key === 'ArrowRight') this.keys.lookRight = true;

      // Combat actions
      if (key === 'KeyR') {
        this.keys.reload = true;
        if (this.onReloadRequest) this.onReloadRequest();
      }

      // Weapon Slots 1-6 & Numpad
      if (key === 'Digit1' || key === 'Numpad1') {
        if (this.onWeaponSlotSelect) this.onWeaponSlotSelect(0);
      }
      if (key === 'Digit2' || key === 'Numpad2') {
        if (this.onWeaponSlotSelect) this.onWeaponSlotSelect(1);
      }
      if (key === 'Digit3' || key === 'Numpad3') {
        if (this.onWeaponSlotSelect) this.onWeaponSlotSelect(2);
      }
      if (key === 'Digit4' || key === 'Numpad4') {
        if (this.onWeaponSlotSelect) this.onWeaponSlotSelect(3);
      }
      if (key === 'Digit5' || key === 'Numpad5') {
        if (this.onWeaponSlotSelect) this.onWeaponSlotSelect(4);
      }
      if (key === 'Digit6' || key === 'Numpad6') {
        if (this.onWeaponSlotSelect) this.onWeaponSlotSelect(5);
      }

      // Pause menu
      if (key === 'KeyP' || key === 'Escape') {
        if (this.onPauseRequest) this.onPauseRequest();
      }

      // Tactical items
      if (key === 'KeyG') {
        if (this.onGrenadeRequest) this.onGrenadeRequest();
      }
      if (key === 'KeyQ') {
        if (this.onAdrenalineRequest) this.onAdrenalineRequest();
      }
      if (key === 'KeyZ') {
        this.keys.aim = true;
      }

      // Performance Telemetry HUD (F3 key)
      if (key === 'F3') {
        e.preventDefault();
        if (this.onTogglePerfMonitor) this.onTogglePerfMonitor();
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.code;
      if (key === 'KeyW') this.keys.forward = false;
      if (key === 'KeyS') this.keys.backward = false;
      if (key === 'KeyA') this.keys.left = false;
      if (key === 'KeyD') this.keys.right = false;
      if (key === 'Space') this.keys.jump = false;
      if (key === 'ShiftLeft' || key === 'ShiftRight') this.keys.sprint = false;
      if (key === 'KeyC' || key === 'ControlLeft' || key === 'ControlRight') this.keys.crouch = false;
      if (key === 'KeyR') this.keys.reload = false;
      if (key === 'KeyZ') this.keys.aim = false;

      // Arrow Keys
      if (key === 'ArrowUp') this.keys.lookUp = false;
      if (key === 'ArrowDown') this.keys.lookDown = false;
      if (key === 'ArrowLeft') this.keys.lookLeft = false;
      if (key === 'ArrowRight') this.keys.lookRight = false;
    });
  }

  // Get and reset mouse delta for current frame (including arrow keys look)
  consumeMouseDelta() {
    let dx = this.mouse.deltaX * this.sensitivity * 0.0022;
    let dy = this.mouse.deltaY * this.sensitivity * 0.0022;

    // Reset accumulated mouse deltas
    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;

    // Add arrow keys look (accessible smooth keyboard camera look)
    const arrowSpeed = 0.038 * this.sensitivity;
    if (this.keys.lookLeft) dx -= arrowSpeed;
    if (this.keys.lookRight) dx += arrowSpeed;
    if (this.keys.lookUp) dy -= arrowSpeed;
    if (this.keys.lookDown) dy += arrowSpeed;

    return { dx, dy };
  }

  isFiring() {
    return this.mouse.left;
  }

  isAimingDownSight() {
    return this.mouse.right || !!this.keys.aim;
  }
}
