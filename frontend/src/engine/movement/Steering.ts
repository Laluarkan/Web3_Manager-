import { Vector2D } from "../Vector2D";

export interface ISteerable {
  id: number;
  position: Vector2D;
  velocity: Vector2D;
  maxSpeed: number;
  maxForce: number;
}

export class SteeringBehaviors {
  /**
   * Seek: Menghasilkan gaya langsung menuju posisi target
   */
  static seek(agent: ISteerable, target: Vector2D): Vector2D {
    const desired = Vector2D.sub(target, agent.position);
    desired.normalize().mult(agent.maxSpeed);
    const steer = Vector2D.sub(desired, agent.velocity);
    steer.truncate(agent.maxForce);
    return steer;
  }

  /**
   * Arrive: Menghasilkan gaya menuju target, namun melambat secara mulus
   * saat memasuki radius pengereman (slowingRadius) agar tidak overshoot
   */
  static arrive(
    agent: ISteerable,
    target: Vector2D,
    slowingRadius: number = 8.0
  ): Vector2D {
    const desired = Vector2D.sub(target, agent.position);
    const distance = desired.mag();

    if (distance < 0.001) {
      return new Vector2D(0, 0);
    }

    if (distance < slowingRadius) {
      // Skala kecepatan sebanding dengan jarak yang tersisa
      const speed = agent.maxSpeed * (distance / slowingRadius);
      desired.normalize().mult(speed);
    } else {
      desired.normalize().mult(agent.maxSpeed);
    }

    const steer = Vector2D.sub(desired, agent.velocity);
    steer.truncate(agent.maxForce);
    return steer;
  }

  /**
   * Separation: Mencegah pemain saling bertumpuk / menabrak (Personal Space)
   * Memberikan gaya tolak berbanding terbalik dengan jarak
   */
  static separation(
    agent: ISteerable,
    neighbors: ISteerable[],
    personalRadius: number = 4.5
  ): Vector2D {
    const steer = new Vector2D(0, 0);
    let count = 0;

    for (const other of neighbors) {
      if (other.id === agent.id) continue;

      const d = agent.position.dist(other.position);
      if (d > 0 && d < personalRadius) {
        // Vektor menjauh dari tetangga
        const diff = Vector2D.sub(agent.position, other.position);
        diff.normalize();
        diff.div(d); // Makin dekat, gaya tolak makin kuat
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) {
      steer.div(count);
      if (steer.magSq() > 0) {
        steer.normalize().mult(agent.maxSpeed);
        steer.sub(agent.velocity);
        steer.truncate(agent.maxForce * 1.5); // Prioritas tinggi untuk separation
      }
    }

    return steer;
  }

  /**
   * Wander: Menghasilkan pergerakan organik kecil agar pemain tidak kaku/patung
   */
  static wander(
    agent: ISteerable,
    wanderAngle: number,
    circleRadius: number = 2.0,
    circleDistance: number = 4.0
  ): { force: Vector2D; newAngle: number } {
    // Lingkaran proyeksi di depan agen
    const circleCenter = agent.velocity.clone().normalize().mult(circleDistance);
    if (circleCenter.magSq() === 0) {
      circleCenter.set(1, 0).mult(circleDistance);
    }

    const displacement = new Vector2D(
      Math.cos(wanderAngle) * circleRadius,
      Math.sin(wanderAngle) * circleRadius
    );

    // Sedikit ubah sudut untuk frame berikutnya (-0.2 sampai +0.2 rad)
    const angleChange = (Math.random() - 0.5) * 0.4;
    const newAngle = wanderAngle + angleChange;

    const wanderForce = Vector2D.add(circleCenter, displacement);
    wanderForce.truncate(agent.maxForce * 0.4);

    return { force: wanderForce, newAngle };
  }

  /**
   * Pursuit: Mengejar target yang bergerak dengan memprediksi posisinya di masa depan
   */
  static pursuit(
    agent: ISteerable,
    targetPos: Vector2D,
    targetVel: Vector2D
  ): Vector2D {
    const toTarget = Vector2D.sub(targetPos, agent.position);
    const distance = toTarget.mag();

    // Waktu estimasi intersepsi
    const lookAheadTime = Math.min(distance / (agent.maxSpeed + 0.1), 1.5);
    const futurePos = Vector2D.add(targetPos, Vector2D.mult(targetVel, lookAheadTime));

    return this.arrive(agent, futurePos, 5.0);
  }
}
