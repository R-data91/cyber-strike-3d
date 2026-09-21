function setText(el, val) {
  if (el && el._cachedText !== val) {
    el.textContent = val;
    el._cachedText = val;
  }
}
function setWidth(el, val) {
  if (el && el._cachedWidth !== val) {
    el.style.width = val;
    el._cachedWidth = val;
  }
}
function setClassName(el, val) {
  if (el && el._cachedClass !== val) {
    el.className = val;
    el._cachedClass = val;
  }
}

export class HUD {
  constructor() {
    // Overlays
    this.hudElement = document.getElementById('hud');
    this.damageOverlay = document.getElementById('damage-overlay');
    this.shieldOverlay = document.getElementById('shield-overlay');
    this.lowHpVignette = document.getElementById('low-hp-vignette');
    this.adsScopeOverlay = document.getElementById('ads-scope-overlay');

    // Top Bar
    this.waveVal = document.getElementById('hud-wave-val');
    this.enemiesLeft = document.getElementById('hud-enemies-left');
    this.enemiesTotal = document.getElementById('hud-enemies-total');
    this.waveProgressFill = document.getElementById('wave-progress-fill');
    this.scoreVal = document.getElementById('hud-score-val');
    this.streakVal = document.getElementById('hud-streak-val');

    // Notifications
    this.announcementBanner = document.getElementById('announcement-banner');
    this.killfeed = document.getElementById('killfeed');
    this.announcementTimer = null;

    // Crosshair & Hitmarker
    this.crosshair = document.getElementById('crosshair');
    this.hitmarker = document.getElementById('hitmarker');
    this.headshotIndicator = document.getElementById('headshot-indicator');
    this.hitmarkerTimer = null;

    // Vitals
    this.shieldBar = document.getElementById('hud-shield-bar');
    this.shieldText = document.getElementById('hud-shield-text');
    this.hpBar = document.getElementById('hud-hp-bar');
    this.hpText = document.getElementById('hud-hp-text');
    this.staminaBar = document.getElementById('hud-stamina-bar');
    this.staminaText = document.getElementById('hud-stamina-text');
    this.adrenalineBar = document.getElementById('hud-adrenaline-bar');
    this.adrenalineText = document.getElementById('hud-adrenaline-text');
    this.bulletTimeOverlay = document.getElementById('bullet-time-overlay');

    // Ammo & Weapons & Grenade (全6種兵装スロット)
    this.weaponSlots = [
      document.getElementById('slot-1'),
      document.getElementById('slot-2'),
      document.getElementById('slot-3'),
      document.getElementById('slot-4'),
      document.getElementById('slot-5'),
      document.getElementById('slot-6'),
    ];
    this.grenadeCount = document.getElementById('hud-grenade-count');
    this.btnGrenadeCount = document.getElementById('btn-grenade-count');
    this.weaponName = document.getElementById('hud-current-weapon-name');
    this.fireMode = document.getElementById('hud-fire-mode');
    this.ammoCurrent = document.getElementById('hud-ammo-current');
    this.ammoReserve = document.getElementById('hud-ammo-reserve');
    this.reloadIndicator = document.getElementById('reload-indicator');
    this.ammoBarsContainer = document.getElementById('ammo-bars-container');
    this.pickupToastContainer = document.getElementById('pickup-toast-container');

    // High-performance HTML5 Canvas for Ammo Pips (replaces 500 DOM elements that caused massive reflow lag)
    if (this.ammoBarsContainer) {
      this.ammoCanvas = document.createElement('canvas');
      this.ammoCanvas.width = 260;
      this.ammoCanvas.height = 24;
      this.ammoCanvas.className = 'ammo-canvas-display';
      this.ammoCtx = this.ammoCanvas.getContext('2d');
      this.ammoBarsContainer.innerHTML = '';
      this.ammoBarsContainer.appendChild(this.ammoCanvas);
    }
    this._lastRenderedAmmo = -1;
    this._lastRenderedMag = -1;
    this._lastRenderedWield = -1;

    // 通知スタック＆キュー管理 (最大同時表示6件でReflowと描画負荷を最小化)
    this.toastQueue = [];
    this.activeToastCount = 0;
    this.maxActiveToasts = 6;

    // HUD武器スロット クリック切替対応
    this.onSlotClick = null;
    this.weaponSlots.forEach((slot, idx) => {
      if (slot) {
        slot.style.pointerEvents = 'auto';
        slot.style.cursor = 'pointer';
        slot.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onSlotClick) this.onSlotClick(idx);
        });
      }
    });

    this.badgeDmgUp = document.getElementById('badge-dmg-up');
    this.badgeMagUp = document.getElementById('badge-mag-up');
    this.badgeRangeUp = document.getElementById('badge-range-up');
    this.badgeSpeedUp = document.getElementById('badge-speed-up');
    this.badgeRateUp = document.getElementById('badge-rate-up');
    this.badgeDropUp = document.getElementById('badge-drop-up');
    this.badgeDoubleDrop = document.getElementById('badge-double-drop');
    this.invincibleIndicator = document.getElementById('invincible-indicator');
    this.invincibleTimerVal = document.getElementById('invincible-timer-val');
    this.invincibleOverlay = document.getElementById('invincible-overlay');

    // Wield Mode & EX Stage Altitude
    this.hudWieldMode = document.getElementById('hud-wield-mode');
    this.hudAltitudePanel = document.getElementById('hud-altitude-panel');
    this.hudAltitudeVal = document.getElementById('hud-altitude-val');

    // Raid Boss HUD
    this.bossHudContainer = document.getElementById('boss-hud-container');
    this.bossName = document.getElementById('boss-name');
    this.bossHpText = document.getElementById('boss-hp-text');
    this.bossHpFill = document.getElementById('boss-hp-fill');

    this.createdPipsCount = 0;

    // Real-time Performance Telemetry elements (F3 key)
    this.perfHud = document.getElementById('perf-monitor-hud');
    this.perfFps = document.getElementById('perf-fps');
    this.perfFt = document.getElementById('perf-ft');
    this.perfDc = document.getElementById('perf-dc');
    this.perfTri = document.getElementById('perf-tri');
    this.perfGeo = document.getElementById('perf-geo');
    this.perfEnt = document.getElementById('perf-ent');
    this.perfPk = document.getElementById('perf-pk');
    this.perfHeap = document.getElementById('perf-heap');
  }

  setSniperScope(active) {
    if (!this.adsScopeOverlay) return;
    if (active) {
      this.adsScopeOverlay.classList.remove('hidden');
      if (this.crosshair) this.crosshair.style.opacity = '0';
    } else {
      this.adsScopeOverlay.classList.add('hidden');
      if (this.crosshair) this.crosshair.style.opacity = '1';
    }
  }

  show() {
    this.hudElement.classList.remove('hidden');
  }

  hide() {
    this.hudElement.classList.add('hidden');
    this.setSniperScope(false);
    if (this.invincibleOverlay) this.invincibleOverlay.classList.add('hidden');
    if (this.invincibleIndicator) this.invincibleIndicator.classList.add('hidden');
    if (this.bossHudContainer) this.bossHudContainer.classList.add('hidden');
    this.hideAltitude();
  }

  setAltitude(altMeters) {
    if (!this.hudAltitudePanel || !this.hudAltitudeVal) return;
    this.hudAltitudePanel.classList.remove('hidden');
    this.hudAltitudeVal.textContent = `ALT: ${Math.round(altMeters).toLocaleString()}m ↑ 昇降中`;
  }

  hideAltitude() {
    if (this.hudAltitudePanel) {
      this.hudAltitudePanel.classList.add('hidden');
    }
  }

  triggerDamageFlash(isShield) {
    const overlay = isShield ? this.shieldOverlay : this.damageOverlay;
    overlay.classList.add('active');
    setTimeout(() => {
      overlay.classList.remove('active');
    }, 120);
  }

  showHitmarker(isCritical = false) {
    if (this.hitmarkerTimer) clearTimeout(this.hitmarkerTimer);

    this.hitmarker.classList.remove('hidden');
    if (isCritical) {
      this.hitmarker.classList.add('critical');
      this.headshotIndicator.classList.remove('hidden');
    } else {
      this.hitmarker.classList.remove('critical');
      this.headshotIndicator.classList.add('hidden');
    }

    this.hitmarkerTimer = setTimeout(() => {
      this.hitmarker.classList.add('hidden');
    }, 180);
  }

  showAnnouncement(text, duration = 2200) {
    if (this.announcementTimer) clearTimeout(this.announcementTimer);

    this.announcementBanner.textContent = text;
    this.announcementBanner.classList.remove('hidden');

    this.announcementTimer = setTimeout(() => {
      this.announcementBanner.classList.add('hidden');
    }, duration);
  }

  addKillfeedItem(message) {
    // 通知種別に関係なく単一スタックで管理 (ユーザー要望: killfeedもtoastも同じスタック)
    this.showPickupToast(message, 'killfeed');
  }

  showPickupToast(message, type = 'ammo') {
    if (!this.pickupToastContainer) return;

    // 1. 直前の表示中トーストと同一メッセージであれば、新規DOMを作成せずカウントアップ (x2, x3...)
    const lastChild = this.pickupToastContainer.lastElementChild;
    if (lastChild && !lastChild.classList.contains('fading-out') && lastChild._baseMessage === message) {
      lastChild._toastCount = (lastChild._toastCount || 1) + 1;
      lastChild.textContent = `${message} (x${lastChild._toastCount})`;
      if (lastChild._fadeTimeout) clearTimeout(lastChild._fadeTimeout);
      lastChild._fadeTimeout = setTimeout(() => {
        lastChild.classList.add('fading-out');
        setTimeout(() => {
          if (lastChild.parentNode) lastChild.parentNode.removeChild(lastChild);
          this.activeToastCount = Math.max(0, this.activeToastCount - 1);
          this.processToastQueue();
        }, 250);
      }, 2200);
      return;
    }

    // 2. キュー末尾が同一メッセージの場合も合算
    if (this.toastQueue.length > 0) {
      const lastQueueItem = this.toastQueue[this.toastQueue.length - 1];
      if (lastQueueItem.baseMessage === message) {
        lastQueueItem.count = (lastQueueItem.count || 1) + 1;
        lastQueueItem.message = `${message} (x${lastQueueItem.count})`;
        return;
      }
    }

    // 溜まりすぎによるDOM過負荷防止 (キュー最大12件)
    if (this.toastQueue.length >= 12) {
      this.toastQueue.shift();
    }
    this.toastQueue.push({ message, type, baseMessage: message, count: 1 });
    this.processToastQueue();
  }

  processToastQueue() {
    if (!this.pickupToastContainer || this.activeToastCount >= this.maxActiveToasts || this.toastQueue.length === 0) {
      return;
    }

    const item = this.toastQueue.shift();
    this.activeToastCount++;

    const toast = document.createElement('div');
    toast.className = `pickup-toast ${item.type}`;
    toast.textContent = item.message;
    toast._baseMessage = item.baseMessage;
    toast._toastCount = item.count;
    this.pickupToastContainer.appendChild(toast);

    toast._fadeTimeout = setTimeout(() => {
      toast.classList.add('fading-out');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        this.activeToastCount = Math.max(0, this.activeToastCount - 1);
        this.processToastQueue();
      }, 250);
    }, 2200);
  }

  // ==================== リアルタイム性能・メモリモニタ (F3) ====================
  togglePerfMonitor(force) {
    if (!this.perfHud) return false;
    const isHidden = this.perfHud.classList.contains('hidden');
    const show = force !== undefined ? force : isHidden;
    if (show) {
      this.perfHud.classList.remove('hidden');
    } else {
      this.perfHud.classList.add('hidden');
    }
    return show;
  }

  updatePerfTelemetry(data) {
    if (!this.perfHud || this.perfHud.classList.contains('hidden')) return;

    if (this.perfFps) {
      const fpsNum = Math.round(data.fps);
      this.perfFps.textContent = fpsNum;
      if (fpsNum >= 55) {
        this.perfFps.className = 'perf-val perf-good';
      } else if (fpsNum >= 30) {
        this.perfFps.className = 'perf-val perf-warn';
      } else {
        this.perfFps.className = 'perf-val perf-crit';
      }
    }
    if (this.perfFt) this.perfFt.textContent = `${data.frameTime.toFixed(1)}ms`;
    if (this.perfDc) this.perfDc.textContent = data.drawCalls;
    if (this.perfTri) this.perfTri.textContent = `${(data.triangles / 1000).toFixed(1)}k`;
    if (this.perfGeo) this.perfGeo.textContent = data.gpuGeometries;
    if (this.perfEnt) this.perfEnt.textContent = data.enemies;
    if (this.perfPk) this.perfPk.textContent = data.pickups;
  }

  updateBoss(activeBoss) {
    if (!this.bossHudContainer) return;
    if (activeBoss && !activeBoss.isDead) {
      if (this.bossHudContainer.classList.contains('hidden')) {
        this.bossHudContainer.classList.remove('hidden');
      }
      if (this.bossName) {
        let phaseSuffix = '';
        if (activeBoss.maxPhase > 1) {
          phaseSuffix = activeBoss.currentPhase === 3 ? ' [FINAL PHASE 🔥]' : ` [PHASE ${activeBoss.currentPhase}/3 ⚡]`;
        }
        setText(this.bossName, `${activeBoss.name}${phaseSuffix}`);
      }
      if (this.bossHpText) {
        const curHp = Math.max(0, Math.ceil(activeBoss.health));
        setText(this.bossHpText, `${curHp.toLocaleString()} / ${activeBoss.maxHealth.toLocaleString()}`);
      }
      if (this.bossHpFill) {
        const hpPct = Math.max(0, Math.min(100, (activeBoss.health / activeBoss.maxHealth) * 100));
        setWidth(this.bossHpFill, `${hpPct}%`);
        let bgGrad = 'linear-gradient(90deg, #ff0044, #ff7700, #ffcc00)';
        if (activeBoss.currentPhase === 3) {
          bgGrad = 'linear-gradient(90deg, #9900ff, #ff0055, #ffd700)';
        } else if (activeBoss.currentPhase === 2) {
          bgGrad = 'linear-gradient(90deg, #ff0055, #ff5500, #ffcc00)';
        }
        if (this.bossHpFill._cachedBg !== bgGrad) {
          this.bossHpFill.style.background = bgGrad;
          this.bossHpFill._cachedBg = bgGrad;
        }
      }
    } else {
      if (!this.bossHudContainer.classList.contains('hidden')) {
        this.bossHudContainer.classList.add('hidden');
      }
    }
  }

  updateAmmoDisplay(weapon) {
    if (!this.ammoCtx) return;
    const currentAmmo = weapon.currentAmmo;
    const magSize = weapon.magazineSize;
    let wieldMode = 1;
    if (currentAmmo >= 6000) {
      wieldMode = 3;
    } else if (currentAmmo >= 3000) {
      wieldMode = 2;
    }

    if (this.hudWieldMode) {
      if (wieldMode === 3) {
        setClassName(this.hudWieldMode, 'tag wield-badge tri');
        setText(this.hudWieldMode, '3丁流 🔱');
        this.hudWieldMode.classList.remove('hidden');
      } else if (wieldMode === 2) {
        setClassName(this.hudWieldMode, 'tag wield-badge dual');
        setText(this.hudWieldMode, '2丁流 ⚔️');
        this.hudWieldMode.classList.remove('hidden');
      } else {
        this.hudWieldMode.classList.add('hidden');
      }
    }

    // Skip canvas redraw if ammo, magazine size, and wield mode have not changed
    if (
      this._lastRenderedAmmo === currentAmmo &&
      this._lastRenderedMag === magSize &&
      this._lastRenderedWield === wieldMode
    ) {
      return;
    }

    this._lastRenderedAmmo = currentAmmo;
    this._lastRenderedMag = magSize;
    this._lastRenderedWield = wieldMode;

    const ctx = this.ammoCtx;
    ctx.clearRect(0, 0, 260, 24);

    const cycleOffset = (wieldMode - 1) * 3000;
    const relAmmo = Math.max(0, currentAmmo - cycleOffset);

    // Visual pips: max 40 pips for clean futuristic layout with ZERO DOM allocations
    const maxPips = Math.min(magSize, 40);
    if (maxPips <= 0) return;

    const gap = 2;
    const pipWidth = Math.max(3, Math.floor((260 - (maxPips - 1) * gap) / maxPips));
    const totalWidth = maxPips * pipWidth + (maxPips - 1) * gap;
    const startX = 260 - totalWidth; // right-aligned

    if (!this._rainbowGrad) {
      this._rainbowGrad = ctx.createLinearGradient(0, 4, 0, 20);
      this._rainbowGrad.addColorStop(0, '#ff0055');
      this._rainbowGrad.addColorStop(0.2, '#ffaa00');
      this._rainbowGrad.addColorStop(0.4, '#ffff00');
      this._rainbowGrad.addColorStop(0.6, '#00ff88');
      this._rainbowGrad.addColorStop(0.8, '#00f3ff');
      this._rainbowGrad.addColorStop(1, '#aa00ff');
    }

    for (let i = 0; i < maxPips; i++) {
      const x = startX + i * (pipWidth + gap);
      let ammoThreshold;
      if (magSize <= 40) {
        ammoThreshold = i;
      } else {
        ammoThreshold = Math.floor(i * (magSize / maxPips));
      }

      if (relAmmo <= ammoThreshold) {
        // Spent pip
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(x, 4, pipWidth, 14);
      } else {
        // Active pip with color tier
        if (relAmmo > ammoThreshold + 2500) {
          ctx.fillStyle = this._rainbowGrad;
        } else if (relAmmo > ammoThreshold + 2000) {
          ctx.fillStyle = '#bb00ff';
        } else if (relAmmo > ammoThreshold + 1500) {
          ctx.fillStyle = '#ff1144';
        } else if (relAmmo > ammoThreshold + 1000) {
          ctx.fillStyle = '#ff7700';
        } else if (relAmmo > ammoThreshold + 500) {
          ctx.fillStyle = '#ffea00';
        } else {
          ctx.fillStyle = '#00f3ff';
        }
        ctx.fillRect(x, 4, pipWidth, 14);
      }
    }
  }

  update(player, wave, enemiesRemaining, totalWaveEnemies, score, streak, activeBoss = null) {
    // 1. Top bar with dirty-checking
    setText(this.waveVal, wave);
    setText(this.enemiesLeft, enemiesRemaining);
    setText(this.enemiesTotal, totalWaveEnemies);
    const progress = totalWaveEnemies > 0 
      ? ((totalWaveEnemies - enemiesRemaining) / totalWaveEnemies) * 100 
      : 0;
    setWidth(this.waveProgressFill, `${progress}%`);

    setText(this.scoreVal, score.toLocaleString());
    setText(this.streakVal, `連続キル: ${streak}x`);

    // 1.5 Boss Health Bar
    this.updateBoss(activeBoss);

    // 2. Vitals
    const shieldPct = (player.shield / player.maxShield) * 100;
    const hpPct = (player.health / player.maxHealth) * 100;
    const staminaPct = (player.stamina / player.maxStamina) * 100;

    setWidth(this.shieldBar, `${shieldPct}%`);
    setText(this.shieldText, `${Math.ceil(player.shield)} / ${player.maxShield}`);

    setWidth(this.hpBar, `${hpPct}%`);
    setText(this.hpText, `${Math.ceil(player.health)} / ${player.maxHealth}`);

    setWidth(this.staminaBar, `${staminaPct}%`);
    setText(this.staminaText, `${Math.round(staminaPct)}%`);

    // Adrenaline / Bullet Time
    if (this.adrenalineBar && this.adrenalineText) {
      const adrPct = Math.min(100, (player.adrenaline / player.maxAdrenaline) * 100);
      setWidth(this.adrenalineBar, `${adrPct}%`);
      if (player.isBulletTime) {
        setText(this.adrenalineText, `減速中 (${player.bulletTimeTimer.toFixed(1)}s)`);
      } else if (adrPct >= 50) {
        setText(this.adrenalineText, `発動可能 [Q] (${Math.round(adrPct)}%)`);
      } else {
        setText(this.adrenalineText, `${Math.round(adrPct)}%`);
      }
    }

    if (this.bulletTimeOverlay) {
      if (player.isBulletTime) {
        this.bulletTimeOverlay.classList.remove('hidden');
      } else {
        this.bulletTimeOverlay.classList.add('hidden');
      }
    }

    if (this.grenadeCount) {
      setText(this.grenadeCount, `x${player.grenades}`);
    }

    if (this.btnGrenadeCount) {
      const gCount = player.grenades;
      setText(this.btnGrenadeCount, gCount.toString());
      if (gCount >= 100) {
        this.btnGrenadeCount.style.fontSize = '6.5px';
        this.btnGrenadeCount.style.padding = '1px 2px';
      } else if (gCount >= 10) {
        this.btnGrenadeCount.style.fontSize = '7.5px';
        this.btnGrenadeCount.style.padding = '1px 3px';
      } else {
        this.btnGrenadeCount.style.fontSize = '9px';
        this.btnGrenadeCount.style.padding = '1px 4px';
      }
    }

    // Low HP heartbeat vignette
    if (player.health < 35 && player.health > 0) {
      if (this.lowHpVignette.style.opacity !== '1') this.lowHpVignette.style.opacity = '1';
    } else {
      if (this.lowHpVignette.style.opacity !== '0') this.lowHpVignette.style.opacity = '0';
    }

    // 3. Active Weapon & Ammo
    const weapon = player.activeWeapon;
    setText(this.weaponName, weapon.name);
    setText(this.fireMode, weapon.fireMode);
    if (weapon.isReloading) {
      setText(this.ammoCurrent, 'RLD');
      this.ammoCurrent.classList.add('reloading');
    } else {
      setText(this.ammoCurrent, weapon.currentAmmo);
      this.ammoCurrent.classList.remove('reloading');
    }
    setText(this.ammoReserve, weapon.reserveAmmo);

    const isLowAmmo = !weapon.isReloading && weapon.currentAmmo <= Math.ceil(weapon.magazineSize * 0.25);
    if (isLowAmmo !== this._lastLowAmmoState) {
      this._lastLowAmmoState = isLowAmmo;
      if (isLowAmmo) this.ammoCurrent.classList.add('low-ammo');
      else this.ammoCurrent.classList.remove('low-ammo');
    }

    // Reload indicator (縦伸び防止のためインライン表示化し独立ブロックは常時非表示)
    if (this.reloadIndicator) {
      this.reloadIndicator.classList.add('hidden');
    }

    // Weapon slot highlights
    if (player.currentWeaponIndex !== this._lastSlotIndex) {
      this._lastSlotIndex = player.currentWeaponIndex;
      this.weaponSlots.forEach((slot, idx) => {
        if (idx === player.currentWeaponIndex) {
          slot.classList.add('active');
        } else {
          slot.classList.remove('active');
        }
      });
    }

    // Update Ammo Pips with high-performance Canvas (0ms overhead when idle)
    this.updateAmmoDisplay(weapon);

    // 4. Weapon Upgrades Status Badges (Dirty-checked to eliminate per-frame style reflows)
    if (this.badgeDmgUp) {
      if (player.damageUpgradeLevel > 0) {
        setText(this.badgeDmgUp, `威力: x${player.damageMultiplier.toFixed(2)} (Lv.${player.damageUpgradeLevel})`);
        if (!this.badgeDmgUp.classList.contains('active')) this.badgeDmgUp.classList.add('active');
      } else {
        setText(this.badgeDmgUp, `威力: x1.0`);
        if (this.badgeDmgUp.classList.contains('active')) this.badgeDmgUp.classList.remove('active');
      }
    }

    if (this.badgeMagUp) {
      if (player.magUpgradeLevel > 0) {
        setText(this.badgeMagUp, `弾倉: +${player.magUpgradeLevel}段階 (Lv.${player.magUpgradeLevel})`);
        if (!this.badgeMagUp.classList.contains('active')) this.badgeMagUp.classList.add('active');
      } else {
        setText(this.badgeMagUp, `弾倉: 標準`);
        if (this.badgeMagUp.classList.contains('active')) this.badgeMagUp.classList.remove('active');
      }
    }

    if (this.badgeRangeUp) {
      if (player.hitRangeUpgradeLevel > 0) {
        setText(this.badgeRangeUp, `範囲: +${Math.round(player.hitRangeBonus * 100)}cm (Lv.${player.hitRangeUpgradeLevel})`);
        if (!this.badgeRangeUp.classList.contains('active')) this.badgeRangeUp.classList.add('active');
      } else {
        setText(this.badgeRangeUp, `範囲: 標準`);
        if (this.badgeRangeUp.classList.contains('active')) this.badgeRangeUp.classList.remove('active');
      }
    }

    if (this.badgeSpeedUp) {
      if (player.speedUpgradeLevel > 0) {
        setText(this.badgeSpeedUp, `機動: x${player.speedMultiplier.toFixed(2)} (Lv.${player.speedUpgradeLevel})`);
        if (!this.badgeSpeedUp.classList.contains('active')) this.badgeSpeedUp.classList.add('active');
      } else {
        setText(this.badgeSpeedUp, `機動: x1.0`);
        if (this.badgeSpeedUp.classList.contains('active')) this.badgeSpeedUp.classList.remove('active');
      }
    }

    if (this.badgeRateUp) {
      if (player.fireRateUpgradeLevel > 0) {
        setText(this.badgeRateUp, `連射: x${player.fireRateMultiplier.toFixed(2)} (Lv.${player.fireRateUpgradeLevel})`);
        if (!this.badgeRateUp.classList.contains('active')) this.badgeRateUp.classList.add('active');
      } else {
        setText(this.badgeRateUp, `連射: x1.0`);
        if (this.badgeRateUp.classList.contains('active')) this.badgeRateUp.classList.remove('active');
      }
    }

    if (this.badgeDropUp) {
      const dropPct = Math.round((0.80 + (player.dropRateBonus || 0)) * 100);
      setText(this.badgeDropUp, `泥率: ${dropPct}%`);
      if (player.dropRateBonus > 0) {
        if (!this.badgeDropUp.classList.contains('active')) this.badgeDropUp.classList.add('active');
      } else {
        if (this.badgeDropUp.classList.contains('active')) this.badgeDropUp.classList.remove('active');
      }
    }

    if (this.badgeDoubleDrop) {
      const dChance = Math.round((player.doubleDropChance || 0) * 100);
      const tChance = Math.round((player.tripleDropChance || 0) * 100);
      if (tChance > 0) {
        setText(this.badgeDoubleDrop, tChance >= 100 ? '👑 3倍泥: 確定' : `👑 3倍泥: ${tChance}%`);
        setClassName(this.badgeDoubleDrop, 'upgrade-badge double-drop active badge-triple');
      } else if (dChance > 0) {
        setText(this.badgeDoubleDrop, dChance >= 100 ? '✨ 倍泥: 確定' : `✨ 倍泥: ${dChance}%`);
        setClassName(this.badgeDoubleDrop, 'upgrade-badge double-drop active');
      } else {
        setText(this.badgeDoubleDrop, `倍泥: なし`);
        setClassName(this.badgeDoubleDrop, 'upgrade-badge double-drop');
      }
    }

    // 5. 5秒無敵バリア表示 & カウントダウン
    if (this.invincibleIndicator && this.invincibleTimerVal) {
      if (player.invincibleTimer > 0) {
        this.invincibleIndicator.classList.remove('hidden');
        setText(this.invincibleTimerVal, `${player.invincibleTimer.toFixed(1)}s`);
        if (this.invincibleOverlay) this.invincibleOverlay.classList.remove('hidden');
      } else {
        this.invincibleIndicator.classList.add('hidden');
        if (this.invincibleOverlay) this.invincibleOverlay.classList.add('hidden');
      }
    }

    // 6. ADS Scope Overlay (Active only when railgun is in ADS)
    this.setSniperScope(weapon.type === 'railgun' && weapon.isADS);

    // 7. Crosshair recoil expansion
    const isFiringRecoil = weapon.recoilRotX > 0.02;
    if (isFiringRecoil !== this._lastFiringRecoil) {
      this._lastFiringRecoil = isFiringRecoil;
      if (isFiringRecoil) this.crosshair.classList.add('firing');
      else this.crosshair.classList.remove('firing');
    }
  }
}

