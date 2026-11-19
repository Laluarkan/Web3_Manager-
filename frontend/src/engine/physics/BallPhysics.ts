import { Vector2D } from "../Vector2D";

export type BallState = "DRIBBLE" | "PASSING" | "LOFTED_CROSS" | "SHOOTING" | "LOOSE" | "DEAD";

export class BallPhysics {
  public position: Vector2D;
  public velocity: Vector2D;
  public z: number = 0; // Ketinggian bola di atas rumput (px)
  public vz: number = 0; // Kecepatan vertikal
  public state: BallState = "LOOSE";
  public carrierId: number | null = null;
  public carrierName: string | null = null;

  // Variabel untuk lintasan lengkung 3D (Parabola)
  private crossProgress: number = 0;
  private crossDuration: number = 1.0;
  private crossStart: Vector2D = new Vector2D(50, 50);
  private crossTarget: Vector2D = new Vector2D(50, 50);
  private crossApexHeight: number = 38;

  constructor(x: number = 50, y: number = 50) {
    this.position = new Vector2D(x, y);
    this.velocity = new Vector2D(0, 0);
  }

  /**
   * Mengatur kepemilikan bola ke pemain tertentu (Dribbling)
   */
  attachToCarrier(playerId: number, playerName: string, playerPos: Vector2D, facingAngle: number) {
    this.state = "DRIBBLE";
    this.carrierId = playerId;
    this.carrierName = playerName;
    this.z = 0;
    this.vz = 0;

    // Tempatkan bola tepat di depan kaki pemain sesuai sudut hadap
    const offsetDist = 1.6;
    this.position.set(
      playerPos.x + Math.cos(facingAngle) * offsetDist,
      playerPos.y + Math.sin(facingAngle) * offsetDist
    );
    this.velocity.set(0, 0);
  }

  /**
   * Operan datar / Gulir di atas rumput
   */
  kickPass(target: Vector2D, speed: number = 2.4) {
    this.state = "PASSING";
    this.carrierId = null;
    this.carrierName = null;
    this.z = 0;
    this.vz = 0;

    const dir = Vector2D.sub(target, this.position).normalize();
    this.velocity = dir.mult(speed);
  }

  /**
   * Umpan silang melambung (3D aerial trajectory)
   */
  kickLoftedCross(target: Vector2D, apexHeight: number = 42, durationSeconds: number = 1.4) {
    this.state = "LOFTED_CROSS";
    this.carrierId = null;
    this.carrierName = null;
    this.crossStart = this.position.clone();
    this.crossTarget = target.clone();
    this.crossApexHeight = apexHeight;
    this.crossDuration = Math.max(0.6, durationSeconds);
    this.crossProgress = 0;
  }

  /**
   * Tembakan keras ke arah gawang
   */
  kickShot(target: Vector2D, speed: number = 3.8, isLofted: boolean = false) {
    this.state = "SHOOTING";
    this.carrierId = null;
    this.carrierName = null;

    const dir = Vector2D.sub(target, this.position).normalize();
    this.velocity = dir.mult(speed);

    if (isLofted) {
      this.vz = 6.0;
    } else {
      this.z = 2.0; // Sedikit terangkat dari rumput saat sepakan voli
      this.vz = 0;
    }
  }

  /**
   * Defleksi/Pantulan saat bola diblok bek atau ditepis kiper
   */
  deflect(reboundAngle: number, speed: number = 1.8) {
    this.state = "LOOSE";
    this.carrierId = null;
    this.carrierName = null;
    this.velocity.set(Math.cos(reboundAngle) * speed, Math.sin(reboundAngle) * speed);
    this.vz = Math.random() * 3.0; // Sedikit memantul
  }

  /**
   * Update siklus fisika tiap frame (dt dalam detik)
   */
  update(dt: number, speedMultiplier: number = 1.0) {
    const effectiveDt = dt * speedMultiplier;

    if (this.state === "LOFTED_CROSS") {
      this.crossProgress += effectiveDt / this.crossDuration;

      if (this.crossProgress >= 1.0) {
        // Bola mendarat
        this.crossProgress = 1.0;
        this.position = this.crossTarget.clone();
        this.z = 0;
        this.vz = 0;
        this.state = "LOOSE";
        // Sedikit menggelinding setelah mendarat
        const dir = Vector2D.sub(this.crossTarget, this.crossStart).normalize();
        this.velocity = dir.mult(0.6);
      } else {
        const t = this.crossProgress;
        // Interpolasi posisi horizontal
        this.position.x = this.crossStart.x + (this.crossTarget.x - this.crossStart.x) * t;
        this.position.y = this.crossStart.y + (this.crossTarget.y - this.crossStart.y) * t;

        // Kurva parabola 3D: z(t) = 4 * H * t * (1 - t)
        this.z = 4 * this.crossApexHeight * t * (1 - t);
      }
      return;
    }

    if (this.state === "DRIBBLE") {
      // Dikelola oleh carrier via attachToCarrier()
      return;
    }

    // Fisika peluncuran bola datar / pantulan
    this.position.add(Vector2D.mult(this.velocity, speedMultiplier));

    // Friksi permukaan rumput jika menyentuh tanah
    if (this.z <= 0.1) {
      this.z = 0;
      this.velocity.mult(0.965); // Gesekan rumput

      if (this.velocity.magSq() < 0.001) {
        this.velocity.set(0, 0);
        if (this.state === "PASSING" || this.state === "SHOOTING") {
          this.state = "LOOSE";
        }
      }
    } else {
      // Efek gravitasi saat bola di udara
      this.vz -= 9.8 * effectiveDt * 3.5;
      this.z += this.vz * effectiveDt * 10;
      if (this.z < 0) {
        this.z = 0;
        this.vz = -this.vz * 0.45; // Pantulan bouncing dengan peredaman
      }
    }

    // Batasan pinggir lapangan (Field boundaries 2% - 98%)
    this.position.x = Math.max(2, Math.min(98, this.position.x));
    this.position.y = Math.max(4, Math.min(96, this.position.y));
  }
}
