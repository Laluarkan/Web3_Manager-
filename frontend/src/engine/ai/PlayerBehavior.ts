import { Vector2D } from "../Vector2D";
import { ISteerable, SteeringBehaviors } from "../movement/Steering";
import { BallPhysics } from "../physics/BallPhysics";

export type PlayerAction =
  | "IDLE"
  | "PRESSING"
  | "SUPPORTING"
  | "MAKING_RUN"
  | "BLOCKING"
  | "DIVING"
  | "DRIBBLE";

export interface PlayerInitData {
  id: number;
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  slotCode: string;
  number: number;
  team: "HOME" | "AWAY";
  baseOverall: number;
  anchor: { x: number; y: number };
}

export class PlayerAgent implements ISteerable {
  public id: number;
  public name: string;
  public positionRole: "GK" | "DF" | "MF" | "FW";
  public slotCode: string;
  public number: number;
  public team: "HOME" | "AWAY";
  public baseOverall: number;

  public position: Vector2D;
  public velocity: Vector2D;
  public facingAngle: number;
  public maxSpeed: number;
  public maxForce: number;
  public anchorPos: Vector2D;

  public wanderAngle: number;
  public actionState: PlayerAction = "IDLE";
  public slideTackleTimer: number = 0; // Efek visual tekel jika ada

  constructor(init: PlayerInitData) {
    this.id = init.id;
    this.name = init.name;
    this.positionRole = init.position;
    this.slotCode = init.slotCode;
    this.number = init.number;
    this.team = init.team;
    this.baseOverall = init.baseOverall;

    this.position = new Vector2D(init.anchor.x, init.anchor.y);
    this.velocity = new Vector2D(0, 0);
    this.facingAngle = init.team === "HOME" ? 0 : Math.PI; // Home hadap kanan, Away hadap kiri
    this.anchorPos = new Vector2D(init.anchor.x, init.anchor.y);

    // Kecepatan disesuaikan dengan rating overall (0.85 - 1.25)
    const ratingFactor = (init.baseOverall - 60) / 40;
    this.maxSpeed = 0.88 + Math.max(0, Math.min(0.35, ratingFactor * 0.35));
    this.maxForce = 0.14;
    this.wanderAngle = Math.random() * Math.PI * 2;
  }

  /**
   * Menentukan posisi taktis yang diinginkan (Desire Target) berdasarkan:
   * 1. Peran posisi (GK, DF, MF, FW)
   * 2. Kepemilikan bola tim (Menyerang atau Bertahan)
   * 3. Taktik manajer (Defensive, Balanced, Attacking)
   */
  public computeTacticalTarget(
    ball: BallPhysics,
    isTeamInPossession: boolean,
    teamTactic: "DEFENSIVE" | "BALANCED" | "ATTACKING",
    isSequenceActor: boolean,
    sequenceTargetPos?: Vector2D
  ): Vector2D {
    // Jika pemain adalah aktor utama dalam skenario serangan yang sedang berjalan
    if (isSequenceActor && sequenceTargetPos) {
      this.actionState = "MAKING_RUN";
      return sequenceTargetPos;
    }

    const isHome = this.team === "HOME";
    const attackDir = isHome ? 1 : -1;
    const target = this.anchorPos.clone();

    // Penyesuaian garis taktik manajer
    const tacticOffset =
      teamTactic === "ATTACKING" ? 6 * attackDir : teamTactic === "DEFENSIVE" ? -6 * attackDir : 0;
    target.x += tacticOffset;

    // 1. GOALKEEPER (Kiper)
    if (this.positionRole === "GK") {
      const goalCenterX = isHome ? 6.5 : 93.5;
      const goalCenterY = 50;

      // Kiper selalu membagi sudut tembakan antara bola dan titik tengah gawang
      const toBall = Vector2D.sub(ball.position, new Vector2D(goalCenterX, goalCenterY));
      const clampDist = Math.min(toBall.mag() * 0.12, 3.2); // Kiper tidak boleh keluar terlalu jauh
      toBall.normalize().mult(clampDist);

      target.x = goalCenterX + toBall.x;
      target.y = 50 + (ball.position.y - 50) * 0.32; // Geser vertikal menutup tiang dekat
      this.actionState = "IDLE";
      return target;
    }

    // 2. DEFENDER (Lini Belakang)
    if (this.positionRole === "DF") {
      if (isTeamInPossession) {
        // Saat menyerang, garis bek naik mendekati garis tengah untuk memadatkan tim (High Line)
        const forwardPush = 14 * attackDir;
        target.x += forwardPush;
        // Fullback ikut overlap melebar
        if (this.slotCode === "LB" || this.slotCode === "RB") {
          target.x += 8 * attackDir;
        }
        this.actionState = "SUPPORTING";
      } else {
        // Saat bertahan, rapikan barisan & lakukan pressing jika bola dekat (< 16 unit)
        const distToBall = this.position.dist(ball.position);
        if (distToBall < 16) {
          this.actionState = "PRESSING";
          // Bergerak memotong jalur bola
          target.x = ball.position.x - 3 * attackDir;
          target.y = ball.position.y;
        } else {
          this.actionState = "BLOCKING";
          // Ikuti pergeseran bola secara kolektif
          target.x = this.anchorPos.x + (ball.position.x - 50) * 0.18;
          target.y = this.anchorPos.y + (ball.position.y - this.anchorPos.y) * 0.28;
        }
      }
      return target;
    }

    // 3. MIDFIELDER (Gelandang)
    if (this.positionRole === "MF") {
      if (isTeamInPossession) {
        // Gelandang aktif mencari ruang passing triangle
        const shiftX = (ball.position.x - 50) * 0.35 + 8 * attackDir;
        const shiftY = (ball.position.y - this.anchorPos.y) * 0.4;
        target.x += shiftX;
        target.y += shiftY;
        this.actionState = "SUPPORTING";
      } else {
        // Saat kehilangan bola, lakukan pressing atau tutup ruang tengah
        const distToBall = this.position.dist(ball.position);
        if (distToBall < 18) {
          this.actionState = "PRESSING";
          target.x = ball.position.x;
          target.y = ball.position.y;
        } else {
          target.x = this.anchorPos.x + (ball.position.x - 50) * 0.25;
          target.y = this.anchorPos.y + (ball.position.y - 50) * 0.25;
          this.actionState = "IDLE";
        }
      }
      return target;
    }

    // 4. FORWARD (Penyerang / Winger / Striker)
    if (this.positionRole === "FW") {
      if (isTeamInPossession) {
        // Menusuk ke celah pertahanan lawan (Off-the-ball run)
        const forwardRun = (isHome ? Math.min(88, this.anchorPos.x + 14) : Math.max(12, this.anchorPos.x - 14));
        target.x = forwardRun;
        // Winger melebar, striker di tengah
        if (this.slotCode === "ST") {
          target.y = 50 + (ball.position.y - 50) * 0.25;
        } else {
          target.y = this.anchorPos.y + Math.sin(this.wanderAngle) * 8;
        }
        this.actionState = "MAKING_RUN";
      } else {
        // Pressing dari depan atau menunggu transisi counter attack
        target.x = this.anchorPos.x + (ball.position.x - 50) * 0.15;
        target.y = this.anchorPos.y;
        this.actionState = "IDLE";
      }
      return target;
    }

    return target;
  }

  /**
   * Update pergerakan fisik setiap frame dengan kombinasi Steering Behaviors
   */
  public updatePhysics(
    desiredTarget: Vector2D,
    allAgents: PlayerAgent[],
    dt: number,
    speedMultiplier: number = 1.0
  ) {
    if (this.slideTackleTimer > 0) {
      this.slideTackleTimer -= dt * speedMultiplier;
    }

    // 1. Gaya Menuju Target (Arrive - melambat halus saat tiba di titik tujuan)
    const arriveForce = SteeringBehaviors.arrive(this, desiredTarget, 7.0);

    // 2. Gaya Pemisahan (Separation - tidak saling tabrak / bertumpuk)
    const separationForce = SteeringBehaviors.separation(this, allAgents, 4.8);

    // 3. Gaya Wander Organik (mencegah pemain diam mematung)
    const { force: wanderForce, newAngle } = SteeringBehaviors.wander(this, this.wanderAngle, 1.5, 3.0);
    this.wanderAngle = newAngle;

    // Total Steering Force
    const totalForce = new Vector2D(0, 0);
    totalForce.add(arriveForce);
    totalForce.add(separationForce);
    totalForce.add(wanderForce);

    // Integrasi percepatan & kecepatan
    totalForce.truncate(this.maxForce);
    this.velocity.add(totalForce);
    this.velocity.truncate(this.maxSpeed);

    // Update posisi
    const effectiveMove = Vector2D.mult(this.velocity, speedMultiplier);
    this.position.add(effectiveMove);

    // Update sudut hadap (Interpolasi halus menghadap arah lari)
    if (this.velocity.magSq() > 0.01) {
      const targetAngle = this.velocity.heading();
      // Interpolasi angular slerp sederhana
      let diff = targetAngle - this.facingAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.facingAngle += diff * 0.15;
    }

    // Batasan lapangan (2% - 98%)
    this.position.x = Math.max(3, Math.min(97, this.position.x));
    this.position.y = Math.max(4, Math.min(96, this.position.y));
  }
}
