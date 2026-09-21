/**
 * Tactical Radar Minimap
 * 2D Canvas radar displaying player position/orientation, vision FOV cone, compass cardinals, hostiles, and arena jump pads.
 */
export class Minimap {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.size = this.canvas.width;
    this.center = this.size / 2;
    this.radarRange = 45; // meters in world space
    this.scanAngle = 0;
  }

  update(delta, player, enemies, jumpPads) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);

    // Update sweep scan angle
    this.scanAngle = (this.scanAngle + delta * 2.5) % (Math.PI * 2);

    // Draw Radar Background Circles
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 1;

    for (let r = 25; r <= 70; r += 22) {
      ctx.beginPath();
      ctx.arc(this.center, this.center, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs on radar
    ctx.beginPath();
    ctx.moveTo(this.center, 5);
    ctx.lineTo(this.center, this.size - 5);
    ctx.moveTo(5, this.center);
    ctx.lineTo(this.size - 5, this.center);
    ctx.stroke();

    // Radar rotating sweep cone (cached to eliminate GC garbage)
    if (!this.sweepGradient) {
      this.sweepGradient = ctx.createRadialGradient(
        this.center, this.center, 0,
        this.center, this.center, this.center - 4
      );
      this.sweepGradient.addColorStop(0, 'rgba(0, 243, 255, 0)');
      this.sweepGradient.addColorStop(1, 'rgba(0, 243, 255, 0.12)');
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.center, this.center);
    ctx.arc(this.center, this.center, this.center - 4, this.scanAngle, this.scanAngle + 0.5);
    ctx.closePath();
    ctx.fillStyle = this.sweepGradient;
    ctx.fill();
    ctx.restore();

    const scale = (this.center - 10) / this.radarRange;

    // Draw Circular Arena Outer Boundary Wall (r = 50m)
    const arenaCenterX = this.center - player.position.x * scale;
    const arenaCenterY = this.center - player.position.z * scale;
    const arenaRadius = 50 * scale;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(arenaCenterX, arenaCenterY, arenaRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Draw Jump Pads (green rings)
    if (jumpPads) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.5;
      for (const pad of jumpPads) {
        const dx = (pad.position.x - player.position.x) * scale;
        const dz = (pad.position.z - player.position.z) * scale;
        const px = this.center + dx;
        const py = this.center + dz;

        if (Math.hypot(dx, dz) < this.center - 8) {
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Draw Enemies (red glowing blips)
    for (const e of enemies) {
      if (e.isDead) continue;
      const dx = (e.mesh.position.x - player.position.x) * scale;
      const dz = (e.mesh.position.z - player.position.z) * scale;
      const px = this.center + dx;
      const py = this.center + dz;

      if (Math.hypot(dx, dz) < this.center - 8) {
        if (e.isBoss) {
          ctx.fillStyle = '#ff0044';
          ctx.shadowColor = '#ff0044';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, 8.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = e.type === 'heavy' ? '#ff0055' : '#ff4400';
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    // Draw Compass Cardinal Indicators (N, S, E, W)
    ctx.save();
    ctx.font = 'bold 9px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // North (N) - Neon Cyan Glow
    ctx.fillStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 6;
    ctx.fillText('N', this.center, 10);

    // South (S)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.shadowBlur = 0;
    ctx.fillText('S', this.center, this.size - 9);

    // East (E)
    ctx.fillText('E', this.size - 9, this.center);

    // West (W)
    ctx.fillText('W', 9, this.center);
    ctx.restore();

    // Draw Player Vision Cone & Tactical Arrow
    ctx.save();
    ctx.translate(this.center, this.center);
    ctx.rotate(-player.yaw); // 正しい視線方向に回転

    // 視界コーン (60度の照射光芒)
    const fovAngle = (60 * Math.PI) / 180;
    const fovRadius = 26;
    const fovGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, fovRadius);
    fovGrad.addColorStop(0, 'rgba(0, 243, 255, 0.5)');
    fovGrad.addColorStop(0.6, 'rgba(0, 243, 255, 0.18)');
    fovGrad.addColorStop(1, 'rgba(0, 243, 255, 0)');

    ctx.fillStyle = fovGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, fovRadius, -Math.PI / 2 - fovAngle / 2, -Math.PI / 2 + fovAngle / 2);
    ctx.closePath();
    ctx.fill();

    // プレイヤー進行方向タクティカル矢印 (デルタシェブロン)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -9);   // 前方頂点 (上向き)
    ctx.lineTo(6, 6);    // 右後方
    ctx.lineTo(0, 2);    // 中央窪み
    ctx.lineTo(-6, 6);   // 左後方
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 中心ロケータードット
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
