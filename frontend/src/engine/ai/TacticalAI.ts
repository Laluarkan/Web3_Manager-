import { Vector2D } from "../Vector2D";
import { PlayerAgent, Team } from "./PlayerBehavior";
import { BallPhysics } from "../physics/BallPhysics";
import type { AttackSequence, SimulationData, SimulationPlayer } from "@/components/LiveMatchSimulator";

export const PITCH_W = 105;
export const PITCH_H = 68;
const CY = PITCH_H / 2;
const GOAL_HALF = 3.66;

type Tactic = "DEFENSIVE" | "BALANCED" | "ATTACKING";
type Step =
  | "GATHER"
  | "BUILDUP"
  | "WING_WAIT"
  | "WING_RUN"
  | "CROSS_FLIGHT"
  | "SHOT_WAIT"
  | "SHOT"
  | "AFTER";

interface SeqRun {
  seq: AttackSequence;
  step: Step;
  t: number;
  total: number;
  sent: boolean;
  att: Team;
  def: Team;
  b: PlayerAgent;
  w: PlayerAgent;
  f: PlayerAgent;
  d: PlayerAgent;
  gk: PlayerAgent;
  wingerPos: Vector2D;
  boxPos: Vector2D;
  shotStart: Vector2D;
}

// Formasi 4-3-3 dalam persen lapangan (dikonversi ke meter)
const FORM_HOME: Record<string, { x: number; y: number }> = {
  GK: { x: 3, y: 50 }, LB: { x: 24, y: 18 }, LCB: { x: 19, y: 38 }, RCB: { x: 19, y: 62 },
  RB: { x: 24, y: 82 }, LCM: { x: 42, y: 32 }, CM: { x: 38, y: 50 }, RCM: { x: 42, y: 68 },
  LW: { x: 68, y: 22 }, ST: { x: 75, y: 50 }, RW: { x: 68, y: 78 },
};
const FORM_AWAY: Record<string, { x: number; y: number }> = {
  GK: { x: 97, y: 50 }, RB: { x: 76, y: 18 }, RCB: { x: 81, y: 38 }, LCB: { x: 81, y: 62 },
  LB: { x: 76, y: 82 }, RCM: { x: 58, y: 32 }, CM: { x: 62, y: 50 }, LCM: { x: 58, y: 68 },
  RW: { x: 32, y: 22 }, ST: { x: 25, y: 50 }, LW: { x: 32, y: 78 },
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const pm = (p: { x: number; y: number }) => new Vector2D((p.x * PITCH_W) / 100, (p.y * PITCH_H) / 100);
const dirOf = (t: Team) => (t === "HOME" ? 1 : -1);
const other = (t: Team): Team => (t === "HOME" ? "AWAY" : "HOME");

/**
 * Mesin pertandingan: 22 agen + bola + AI taktik.
 * Aliran permainan kontinu (operan, dribel, rebut bola). Skenario serangan dari
 * backend dijalankan sebagai rangkaian aksi nyata, hasil akhirnya probabilistik
 * (gol, tepis, blok, melenceng, tiang, tekel) sesuai data backend.
 */
export class MatchEngine {
  agents: PlayerAgent[];
  ball = new BallPhysics();
  onGoal?: (seq: AttackSequence) => void;

  private tactic: Tactic = "BALANCED";
  private possession: Team = "HOME";
  private receiver: PlayerAgent | null = null;
  private receiverTimer = 0;
  private decisionTimer = 1.2;
  private time = 0;
  private queue: AttackSequence[] = [];
  private run: SeqRun | null = null;
  private restartTaker: PlayerAgent | null = null;
  private restartTimer = 0;
  private presser: Record<Team, PlayerAgent | null> = { HOME: null, AWAY: null };

  constructor(sim: SimulationData) {
    const make = (players: SimulationPlayer[], team: Team) =>
      players.map((p, i) => {
        const form = team === "HOME" ? FORM_HOME : FORM_AWAY;
        const anchor = pm(form[p.slotCode] ?? { x: team === "HOME" ? 30 : 70, y: 50 });
        return new PlayerAgent({
          id: p.id,
          name: p.name,
          position: p.position,
          slotCode: p.slotCode,
          number: p.number || i + 1,
          team,
          baseOverall: p.baseOverall || 75,
          anchor,
        });
      });
    this.agents = [...make(sim.homePlayers, "HOME"), ...make(sim.awayPlayers, "AWAY")];

    const taker = this.agents.find((a) => a.team === "HOME" && a.slotCode === "ST") ?? this.agents[0];
    if (taker) {
      taker.position.set(PITCH_W / 2 - 1.5, CY);
      this.ball.position.set(PITCH_W / 2, CY);
      this.take(taker);
    }
  }

  setTactic(t: Tactic) {
    this.tactic = t;
  }

  queueSequence(seq: AttackSequence) {
    this.queue.push(seq);
  }

  private get carrier(): PlayerAgent | null {
    return this.ball.carrier;
  }

  /** Maju dalam detik waktu simulasi, dipecah menjadi langkah kecil agar halus. */
  advance(dt: number) {
    const n = Math.max(1, Math.ceil(dt / 0.02));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.step(h);
  }

  private step(h: number) {
    this.time += h;
    if (this.restartTaker) {
      this.stepRestart(h);
    } else {
      if (!this.run && this.queue.length) this.startSequence(this.queue.shift()!);
      if (this.run) this.stepSequence(h);
      else this.stepOpenPlay(h);
      this.controlBall(h);
    }
    this.assignTargets();
    for (const a of this.agents) a.update(h, this.time, this.agents);
    this.ball.update(h);
  }

  // ---------------------------------------------------------------- kepemilikan bola

  private take(a: PlayerAgent) {
    this.ball.setCarrier(a);
    this.receiver = null;
    this.possession = a.team;
    this.decisionTimer = 0.9 + Math.random() * 1.3;
  }

  private sendPass(to: PlayerAgent, speed: number) {
    const lead = to.position.clone().add(Vector2D.mult(to.velocity, 0.45));
    this.ball.pass(lead, speed);
    this.receiver = to;
    this.receiverTimer = 4.5;
    this.possession = to.team;
  }

  private controlBall(h: number) {
    const ball = this.ball;
    if (this.receiver) {
      const r = this.receiver;
      this.receiverTimer -= h;
      if (r.position.dist(ball.position) < 1.4 && ball.z < 1.8 && ball.mode !== "CROSS") {
        this.take(r);
      } else {
        if (!this.run && ball.mode === "FLIGHT") {
          for (const o of this.agents) {
            if (o.team !== r.team && o.position.dist(ball.position) < 1.3 && Math.random() < 2.5 * h) {
              this.take(o);
              return;
            }
          }
        }
        if (this.receiverTimer <= 0) this.receiver = null;
      }
    } else if (!this.carrier && ball.mode === "LOOSE") {
      let best: PlayerAgent | null = null;
      let bd = 1.5;
      for (const a of this.agents) {
        const d = a.position.dist(ball.position);
        if (d < bd) {
          bd = d;
          best = a;
        }
      }
      if (best) this.take(best);
    }
  }

  // ---------------------------------------------------------------- permainan terbuka

  private stepOpenPlay(h: number) {
    const c = this.carrier;
    if (!c) return;
    this.possession = c.team;

    // Rebut bola oleh bek/gelandang yang menekan
    for (const o of this.agents) {
      if (o.team === c.team || o.positionRole === "GK") continue;
      if (o.position.dist(c.position) < 1.8 && Math.random() < (0.12 + 0.25 * o.aggression) * h) {
        this.take(o);
        return;
      }
    }

    this.decisionTimer -= h;
    if (this.decisionTimer <= 0) this.doPass(c);
  }

  private doPass(c: PlayerAgent) {
    const d = dirOf(c.team);
    let best: PlayerAgent | null = null;
    let bestScore = -Infinity;
    for (const t of this.agents) {
      if (t.team !== c.team || t === c) continue;
      if (c.positionRole === "GK" ? t.positionRole !== "DF" : t.positionRole === "GK") continue;
      const dist = t.position.dist(c.position);
      if (dist < 7 || dist > 35) continue;
      let nearestOpp = 8;
      for (const o of this.agents) {
        if (o.team !== c.team) nearestOpp = Math.min(nearestOpp, o.position.dist(t.position));
      }
      const fwd = (t.position.x - c.position.x) * d;
      const depth = c.team === "HOME" ? t.position.x : PITCH_W - t.position.x;
      let score = fwd * 0.6 + nearestOpp * 1.2 - dist * 0.1 + Math.random() * 6;
      if (depth > 80) score -= (depth - 80) * 3;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (!best) {
      this.decisionTimer = 0.6;
      return;
    }
    this.sendPass(best, clamp(14 + c.position.dist(best.position) * 0.5, 14, 26));
  }

  // ---------------------------------------------------------------- skenario serangan

  private startSequence(seq: AttackSequence) {
    const att = seq.team;
    const def = other(att);
    const pick = (team: Team, name: string) => this.agents.find((a) => a.team === team && a.name === name);
    const b = pick(att, seq.buildupPlayer);
    const w = pick(att, seq.wingerPlayer);
    const f = pick(att, seq.finisherPlayer);
    const d = pick(def, seq.defenderPlayer);
    const gk = pick(def, seq.gkPlayer);
    if (!b || !w || !f || !d || !gk || b === w || w === f || b === f) {
      if (seq.outcome === "GOAL") this.scoreGoal(seq);
      return;
    }
    this.run = {
      seq, step: "GATHER", t: 0, total: 0, sent: false, att, def, b, w, f, d, gk,
      wingerPos: pm(seq.wingerCoord), boxPos: pm(seq.boxCoord), shotStart: new Vector2D(0, 0),
    };
  }

  private next(r: SeqRun, s: Step) {
    r.step = s;
    r.t = 0;
  }

  private stepSequence(h: number) {
    const r = this.run!;
    r.t += h;
    r.total += h;
    const ball = this.ball;
    if (r.total > 30) {
      this.run = null;
      return;
    }
    if (r.step !== "AFTER") this.possession = r.att;

    switch (r.step) {
      case "GATHER":
        if (this.carrier === r.b) {
          this.next(r, "BUILDUP");
        } else {
          if (!r.sent) {
            this.sendPass(r.b, 22);
            r.sent = true;
          }
          if (r.t > 6) this.take(r.b);
        }
        break;
      case "BUILDUP":
        if (r.t > 1.5) {
          this.sendPass(r.w, 20);
          this.next(r, "WING_WAIT");
        }
        break;
      case "WING_WAIT":
        if (this.carrier === r.w) this.next(r, "WING_RUN");
        else if (r.t > 4.5) this.take(r.w);
        break;
      case "WING_RUN":
        if (r.seq.outcome === "TACKLED") {
          if (r.d.position.dist(r.w.position) < 1.8 || r.t > 3) {
            this.sendPass(r.d, 10);
            this.next(r, "AFTER");
          }
        } else if (r.w.position.dist(r.wingerPos) < 3 || r.t > 3.5) {
          ball.cross(r.boxPos, 1.15, 5.5);
          this.receiver = r.f;
          this.receiverTimer = 5;
          this.next(r, "CROSS_FLIGHT");
        }
        break;
      case "CROSS_FLIGHT":
        if (ball.mode !== "CROSS") {
          if (this.carrier === r.f) this.next(r, "SHOT_WAIT");
          else if (r.t > 3) this.take(r.f);
        }
        break;
      case "SHOT_WAIT":
        if (r.t > 0.4) this.fireShot(r);
        break;
      case "SHOT":
        this.stepShot(r);
        break;
      case "AFTER":
        if (r.t > 1.3) this.run = null;
        break;
    }
  }

  private fireShot(r: SeqRun) {
    const oc = r.seq.outcome;
    const dd = dirOf(r.att);
    const gx = r.att === "HOME" ? PITCH_W : 0;
    let ty = pm(r.seq.finishCoord).y;
    if (oc === "GOAL") ty = clamp(ty, CY - 2.8, CY + 2.8);
    else if (oc === "SAVED") ty = clamp(ty, CY - 2.2, CY + 2.2);
    else if (oc === "POST") ty = ty < CY ? CY - GOAL_HALF : CY + GOAL_HALF;
    else if (oc === "BLOCKED") ty = CY;

    const start = this.ball.position.clone();
    const line = new Vector2D(gx, ty);
    const dir = Vector2D.sub(line, start).normalize();
    const far = start.clone().add(Vector2D.mult(dir, start.dist(line) + 3));
    this.ball.shoot(far, oc === "BLOCKED" ? 24 : 31);
    r.shotStart = start;
    void dd;
    this.next(r, "SHOT");
  }

  private stepShot(r: SeqRun) {
    const ball = this.ball;
    const pos = ball.position;
    const dd = dirOf(r.att);
    const gx = r.att === "HOME" ? PITCH_W : 0;
    const toLine = Math.abs(gx - pos.x);
    const back = dd > 0 ? Math.PI : 0; // arah kembali ke lapangan
    const spread = (s: number) => back + (Math.random() - 0.5) * s;

    if (r.t > 4) {
      this.next(r, "AFTER");
      return;
    }
    switch (r.seq.outcome) {
      case "BLOCKED":
        if (pos.dist(r.shotStart) > 3) {
          ball.deflect(spread(1.8), 9);
          this.next(r, "AFTER");
        }
        break;
      case "SAVED":
        if (toLine < 2.4) {
          ball.deflect(spread(1.6), 8);
          this.next(r, "AFTER");
        }
        break;
      case "POST":
        if (toLine < 0.7) {
          ball.deflect(spread(1.0), 10);
          this.next(r, "AFTER");
        }
        break;
      case "GOAL":
        if ((dd > 0 && pos.x > PITCH_W + 0.3) || (dd < 0 && pos.x < -0.3)) this.scoreGoal(r.seq);
        break;
      default: // WIDE
        if ((dd > 0 && pos.x > PITCH_W + 1) || (dd < 0 && pos.x < -1)) {
          this.sendPass(r.gk, 16);
          this.next(r, "AFTER");
        }
    }
  }

  private scoreGoal(seq: AttackSequence) {
    this.onGoal?.(seq);
    const conceding = other(seq.team);
    const taker =
      this.agents.find((a) => a.team === conceding && a.slotCode === "CM") ??
      this.agents.find((a) => a.team === conceding && a.positionRole === "MF") ??
      this.agents[0];
    this.ball.position.set(PITCH_W / 2, CY);
    this.ball.release();
    this.receiver = null;
    this.run = null;
    this.possession = conceding;
    this.restartTaker = taker;
    this.restartTimer = 3;
  }

  private stepRestart(h: number) {
    this.restartTimer -= h;
    const t = this.restartTaker!;
    const nearCenter = t.position.dist(new Vector2D(PITCH_W / 2, CY)) < 2;
    if (this.restartTimer <= 0 && (nearCenter || this.restartTimer < -3)) {
      this.take(t);
      this.restartTaker = null;
    }
  }

  // ---------------------------------------------------------------- target taktis semua pemain

  private assignTargets() {
    const ball = this.ball;
    const bp = ball.position;
    const restart = !!this.restartTaker;
    const teams: Team[] = ["HOME", "AWAY"];

    // Pemain penekan (dengan histeresis supaya tidak bolak-balik)
    const press: Record<Team, PlayerAgent | null> = { HOME: null, AWAY: null };
    const cover: Record<Team, PlayerAgent | null> = { HOME: null, AWAY: null };
    if (!restart) {
      for (const team of teams) {
        if (team === this.possession) continue;
        const cand = this.agents
          .filter((a) => a.team === team && a.positionRole !== "GK" && !(a.positionRole === "DF" && a.position.dist(bp) > 16))
          .sort((x, y) => x.position.dist(bp) - y.position.dist(bp));
        if (!cand.length) continue;
        let p = cand[0];
        const prev = this.presser[team];
        if (prev && cand.includes(prev) && prev.position.dist(bp) < p.position.dist(bp) + 2.5) p = prev;
        this.presser[team] = p;
        press[team] = p;
        cover[team] = cand.find((a) => a !== p) ?? null;
      }
    }

    // Posisi dasar tiap pemain
    for (const a of this.agents) {
      const d = dirOf(a.team);
      const inPoss = this.possession === a.team;
      if (a.positionRole === "GK") {
        this.gkTarget(a, bp);
        continue;
      }
      const shift = clamp((bp.x - PITCH_W / 2) * 0.5, -20, 20);
      const tac = a.team === "HOME" ? (this.tactic === "ATTACKING" ? 5 : this.tactic === "DEFENSIVE" ? -6 : 0) : 0;
      const depthF = a.positionRole === "DF" ? 0.7 : 1;
      const push = (inPoss ? 8 : -3) + tac;
      let x = a.anchor.x + shift * depthF + d * push * depthF;
      let y = a.anchor.y + (bp.y - CY) * (a.positionRole === "DF" ? 0.18 : a.positionRole === "MF" ? 0.3 : 0.12);
      let u: number | undefined;

      if (inPoss) {
        if (a.positionRole === "FW") {
          x = d > 0 ? Math.max(x, bp.x + 6) : Math.min(x, bp.x - 6);
          y = a.slotCode === "ST"
            ? CY + (bp.y - CY) * 0.2 + Math.sin(this.time * 0.35 + a.phase) * 7
            : a.anchor.y + Math.sin(this.time * 0.4 + a.phase) * 3;
          u = 0.65;
        } else if (a.positionRole === "MF") {
          x = x * 0.5 + (bp.x - d * 4) * 0.5;
        } else if (a.slotCode === "LB" || a.slotCode === "RB") {
          x += d * 6;
        }
      }
      x = d > 0 ? clamp(x, 3, PITCH_W - 6) : clamp(x, 6, PITCH_W - 3);
      a.setDesired(x, clamp(y, 3, PITCH_H - 3), u);
    }

    // Pressing & cover
    for (const team of teams) {
      const p = press[team];
      if (p) {
        const c = this.carrier && this.carrier.team !== team ? this.carrier : null;
        const tx = (c ? c.position.x + c.velocity.x * 0.4 : bp.x + ball.velocity.x * 0.2);
        const ty = (c ? c.position.y + c.velocity.y * 0.4 : bp.y + ball.velocity.y * 0.2);
        p.setDesired(tx, ty, 1);
      }
      const cv = cover[team];
      if (cv) {
        const own = team === "HOME" ? 0 : PITCH_W;
        cv.setDesired(bp.x + (own - bp.x) * 0.3, bp.y + (CY - bp.y) * 0.2, 0.8);
      }
    }

    // Bola liar: pemain terdekat tiap tim mengejar
    if (!restart && !this.carrier && !this.receiver && ball.mode === "LOOSE") {
      for (const team of teams) {
        let best: PlayerAgent | null = null;
        for (const a of this.agents) {
          if (a.team !== team || a.positionRole === "GK") continue;
          if (!best || a.position.dist(bp) < best.position.dist(bp)) best = a;
        }
        best?.setDesired(bp.x + ball.velocity.x * 0.3, bp.y + ball.velocity.y * 0.3, 1);
      }
    }

    // Pembawa bola menggiring maju
    const c = this.carrier;
    if (c) {
      if (c.positionRole === "GK") {
        c.setDesired(c.position.x, c.position.y, 0.2);
      } else {
        const d = dirOf(c.team);
        const depth = c.team === "HOME" ? c.position.x : PITCH_W - c.position.x;
        const tx = depth > 78 ? c.position.x : c.position.x + d * 9;
        c.setDesired(tx, c.position.y + (CY - c.position.y) * 0.3, 0.55);
      }
    }

    // Pengambil sepak mula
    if (this.restartTaker) this.restartTaker.setDesired(PITCH_W / 2 - dirOf(this.restartTaker.team) * 0.5, CY, 0.6);

    this.applySequenceTargets();

    // Penerima operan mengejar bola (override terakhir)
    const r = this.receiver;
    if (r) {
      if (ball.mode === "CROSS") r.setDesired(ball.crossTarget.x, ball.crossTarget.y, 0.95);
      else r.setDesired(bp.x + ball.velocity.x * 0.25, bp.y + ball.velocity.y * 0.25, 1);
    }
  }

  private applySequenceTargets() {
    const r = this.run;
    if (!r) return;
    const dd = dirOf(r.att);
    switch (r.step) {
      case "BUILDUP":
        r.b.setDesired(r.wingerPos.x - dd * 16, (r.b.position.y + r.wingerPos.y) / 2, 0.65);
        break;
      case "WING_WAIT":
        r.f.setDesired(r.boxPos.x - dd * 8, r.boxPos.y, 0.6);
        break;
      case "WING_RUN":
        r.w.setDesired(r.wingerPos.x, r.wingerPos.y, 0.8);
        r.f.setDesired(r.boxPos.x - dd * 2, r.boxPos.y, 0.8);
        if (r.seq.outcome === "TACKLED") {
          r.d.setDesired(r.w.position.x + r.w.velocity.x * 0.4, r.w.position.y + r.w.velocity.y * 0.4, 1);
        } else {
          r.d.setDesired(r.boxPos.x + dd * 3, r.boxPos.y, 0.7);
        }
        break;
      case "CROSS_FLIGHT":
        r.d.setDesired(r.boxPos.x + dd * 1.5, r.boxPos.y + (r.boxPos.y > CY ? -1.5 : 1.5), 0.9);
        break;
      case "SHOT_WAIT":
        r.f.setDesired(r.f.position.x, r.f.position.y, 0.2);
        r.d.setDesired(r.f.position.x + dd * 2, r.f.position.y, 1);
        break;
      case "SHOT":
        r.d.setDesired(r.shotStart.x + dd * 2.5, r.shotStart.y + (CY - r.shotStart.y) * 0.4, 1);
        break;
    }
  }

  private gkTarget(a: PlayerAgent, bp: Vector2D) {
    const own = a.team === "HOME" ? 0 : PITCH_W;
    const d = dirOf(a.team);
    let gx = own + d * (2.2 + clamp((Math.abs(bp.x - own) - 25) * 0.05, 0, 3.5));
    let gy = CY + (bp.y - CY) * 0.22;
    let urgent: number | undefined;

    const r = this.run;
    if (r && r.step === "SHOT" && r.def === a.team) {
      const v = this.ball.velocity;
      if (Math.abs(v.x) > 0.1) {
        const yi = bp.y + (v.y / v.x) * (own - bp.x);
        if (r.seq.outcome === "SAVED") gy = yi;
        else if (r.seq.outcome === "GOAL") gy = yi + (yi > CY ? -4.5 : 4.5); // terlambat / salah tebak
        else gy = yi * 0.6 + CY * 0.4;
      }
      gx = own + d * 1;
      urgent = 1;
    }
    a.setDesired(gx, clamp(gy, CY - GOAL_HALF, CY + GOAL_HALF), urgent);
  }
}
