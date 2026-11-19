import { Vector2D } from "../Vector2D";

export type Team = "HOME" | "AWAY";
export type Role = "GK" | "DF" | "MF" | "FW";

export interface PlayerInit {
  id: number;
  name: string;
  position: Role;
  slotCode: string;
  number: number;
  team: Team;
  baseOverall: number;
  anchor: { x: number; y: number }; // meter
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Agen pemain. Semua satuan dalam meter & detik, sehingga gerakan
 * konsisten di semua refresh rate. Halus karena:
 *  - target dihaluskan (low-pass), tidak pernah melompat
 *  - kecepatan dibatasi percepatan (tidak ada perubahan arah instan)
 *  - arah hadap berputar dengan batas laju putar
 */
export class PlayerAgent {
  id: number;
  name: string;
  positionRole: Role;
  slotCode: string;
  number: number;
  team: Team;
  anchor: Vector2D;

  position: Vector2D;
  velocity = new Vector2D(0, 0);
  facingAngle: number;

  desired: Vector2D; // target mentah dari AI taktik
  target: Vector2D; // target yang sudah dihaluskan
  urgencyOverride?: number;

  // Kepribadian & atribut individu
  topSpeed: number;
  accel: number;
  phase: number;
  discipline: number; // 0.6-1: seberapa disiplin menjaga posisi
  aggression: number; // 0-1: seberapa agresif merebut bola

  constructor(init: PlayerInit) {
    this.id = init.id;
    this.name = init.name;
    this.positionRole = init.position;
    this.slotCode = init.slotCode;
    this.number = init.number;
    this.team = init.team;
    this.anchor = new Vector2D(init.anchor.x, init.anchor.y);
    this.position = this.anchor.clone();
    this.desired = this.anchor.clone();
    this.target = this.anchor.clone();
    this.facingAngle = init.team === "HOME" ? 0 : Math.PI;

    const rating = clamp((init.baseOverall - 55) / 45, 0, 1);
    this.topSpeed = (init.position === "GK" ? 7 : 10 + rating * 3) * (0.95 + Math.random() * 0.1);
    this.accel = 16 + rating * 6;
    this.phase = Math.random() * Math.PI * 2;
    this.discipline = 0.6 + Math.random() * 0.4;
    this.aggression = Math.random();
  }

  setDesired(x: number, y: number, urgency?: number) {
    this.desired.set(x, y);
    this.urgencyOverride = urgency;
  }

  update(dt: number, time: number, others: PlayerAgent[]) {
    // 1. Haluskan target (exponential smoothing)
    const k = 1 - Math.exp(-4 * dt);
    this.target.x += (this.desired.x - this.target.x) * k;
    this.target.y += (this.desired.y - this.target.y) * k;

    // 2. Gerak organik kecil saat santai (bukan gaya acak per frame)
    const dist0 = this.target.dist(this.position);
    const urgency = this.urgencyOverride ?? clamp(0.3 + dist0 / 14, 0.3, 0.85);
    const roam = (1 - urgency) * (this.positionRole === "GK" ? 0.3 : 1) * this.discipline;
    const gx = this.target.x + Math.sin(time * 0.55 + this.phase) * 1.4 * roam;
    const gy = this.target.y + Math.cos(time * 0.43 + this.phase * 1.7) * 1.2 * roam;

    // 3. Arrive: melambat mulus mendekati tujuan
    const dx = gx - this.position.x;
    const dy = gy - this.position.y;
    const dist = Math.hypot(dx, dy);
    const cap = this.topSpeed * (0.35 + 0.65 * urgency);
    const speed = Math.min(cap, dist * 1.8);
    let wvx = dist > 0.05 ? (dx / dist) * speed : 0;
    let wvy = dist > 0.05 ? (dy / dist) * speed : 0;

    // 4. Separation: tidak bertumpuk
    for (const o of others) {
      if (o === this) continue;
      const ox = this.position.x - o.position.x;
      const oy = this.position.y - o.position.y;
      const d = Math.hypot(ox, oy);
      if (d < 3 && d > 0.001) {
        const w = (3 - d) / 3;
        wvx += (ox / d) * w * 4;
        wvy += (oy / d) * w * 4;
      }
    }

    // 5. Percepatan terbatas
    let ax = wvx - this.velocity.x;
    let ay = wvy - this.velocity.y;
    const am = Math.hypot(ax, ay);
    const maxDv = this.accel * dt;
    if (am > maxDv) {
      ax = (ax / am) * maxDv;
      ay = (ay / am) * maxDv;
    }
    this.velocity.x += ax;
    this.velocity.y += ay;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.x = clamp(this.position.x, 1, 104);
    this.position.y = clamp(this.position.y, 1, 67);

    // 6. Arah hadap berputar halus
    if (Math.hypot(this.velocity.x, this.velocity.y) > 0.8) {
      const ta = Math.atan2(this.velocity.y, this.velocity.x);
      let diff = ta - this.facingAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      const maxTurn = 7 * dt;
      this.facingAngle += clamp(diff, -maxTurn, maxTurn);
    }
  }
}
