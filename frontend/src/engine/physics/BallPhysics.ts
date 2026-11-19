import { Vector2D } from "../Vector2D";
import type { PlayerAgent } from "../ai/PlayerBehavior";

export type BallMode = "CARRIED" | "FLIGHT" | "CROSS" | "LOOSE";

/** Bola (meter & detik). Saat dibawa, bola mengikuti kaki pemain dengan smoothing sehingga tidak pernah teleport. */
export class BallPhysics {
  position = new Vector2D(52.5, 34);
  velocity = new Vector2D(0, 0);
  z = 0;
  mode: BallMode = "LOOSE";
  carrier: PlayerAgent | null = null;
  crossTarget = new Vector2D(0, 0);

  private crossStart = new Vector2D(0, 0);
  private crossTime = 0;
  private crossDuration = 1;
  private crossApex = 5;

  setCarrier(a: PlayerAgent) {
    this.carrier = a;
    this.mode = "CARRIED";
    this.z = 0;
  }

  release() {
    this.carrier = null;
    this.mode = "LOOSE";
    this.velocity.set(0, 0);
    this.z = 0;
  }

  /** Operan datar / tembakan */
  pass(target: Vector2D, speed: number) {
    this.carrier = null;
    this.mode = "FLIGHT";
    this.z = 0;
    this.velocity = Vector2D.sub(target, this.position).normalize().mult(speed);
  }

  shoot(target: Vector2D, speed: number) {
    this.pass(target, speed);
  }

  /** Umpan silang melambung (parabola 3D) */
  cross(target: Vector2D, duration: number, apex: number) {
    this.carrier = null;
    this.mode = "CROSS";
    this.crossStart = this.position.clone();
    this.crossTarget = target.clone();
    this.crossTime = 0;
    this.crossDuration = duration;
    this.crossApex = apex;
  }

  /** Pantulan: bola blok / tepisan / tiang */
  deflect(angle: number, speed: number) {
    this.carrier = null;
    this.mode = "LOOSE";
    this.z = 0;
    this.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  update(dt: number) {
    if (this.mode === "CARRIED" && this.carrier) {
      const c = this.carrier;
      const tx = c.position.x + Math.cos(c.facingAngle) * 0.9;
      const ty = c.position.y + Math.sin(c.facingAngle) * 0.9;
      const k = 1 - Math.exp(-16 * dt);
      this.position.x += (tx - this.position.x) * k;
      this.position.y += (ty - this.position.y) * k;
      this.velocity.set(c.velocity.x, c.velocity.y);
      this.z = 0;
      return;
    }

    if (this.mode === "CROSS") {
      this.crossTime += dt;
      const t = Math.min(1, this.crossTime / this.crossDuration);
      this.position.x = this.crossStart.x + (this.crossTarget.x - this.crossStart.x) * t;
      this.position.y = this.crossStart.y + (this.crossTarget.y - this.crossStart.y) * t;
      this.z = 4 * this.crossApex * t * (1 - t);
      if (t >= 1) {
        this.mode = "LOOSE";
        this.z = 0;
        this.velocity = Vector2D.sub(this.crossTarget, this.crossStart).normalize().mult(2.5);
      }
      return;
    }

    // FLIGHT / LOOSE: meluncur dengan gesekan rumput
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    const friction = Math.exp(-(this.mode === "LOOSE" ? 1.5 : 0.35) * dt);
    this.velocity.mult(friction);
    if (this.velocity.mag() < 0.1) this.velocity.set(0, 0);
    this.z = 0;
  }
}
