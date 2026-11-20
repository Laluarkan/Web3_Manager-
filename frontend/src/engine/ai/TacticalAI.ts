import { Vector2D } from "../Vector2D";
import { PlayerAgent, Team } from "./PlayerBehavior";
import { BallPhysics } from "../physics/BallPhysics";
import type { AttackSequence, SimulationData, SimulationPlayer } from "@/components/LiveMatchSimulator";

export const PITCH_W = 105;
export const PITCH_H = 68;
const CY = PITCH_H / 2;
const GOAL_HALF = 3.66; // setengah lebar gawang (7.32 m)
const BOX_DEPTH = 16.5;
const BOX_HALF = 20.16;

export type Tactic = "DEFENSIVE" | "BALANCED" | "ATTACKING";

export type SetPieceType =
  | "NONE"
  | "KICK_OFF"
  | "CORNER"
  | "PENALTY"
  | "FREE_KICK"
  | "OFFSIDE"
  | "THROW_IN"
  | "GOAL_KICK";

export interface ActiveMatchBanner {
  badge: string;
  title: string;
  subtitle?: string;
  timer: number;
}

type ShotKind = "LONG" | "CLOSE" | "HEADER" | "FREEKICK" | "REBOUND" | "PENALTY" | "SEQ";
type ShotOutcome = "GOAL" | "SAVED" | "BLOCKED" | "WIDE" | "POST";

/**
 * Peluang hasil tembakan di luar skenario backend. SENGAJA tanpa GOL:
 * gol hanya berasal dari skenario backend agar skor tampilan selalu sama
 * dengan hasil pertandingan yang tersimpan (hadiah, statistik).
 */
const SHOT_TABLE: Record<Exclude<ShotKind, "SEQ">, Array<[ShotOutcome, number]>> = {
  LONG: [["SAVED", 0.42], ["WIDE", 0.3], ["BLOCKED", 0.18], ["POST", 0.1]],
  CLOSE: [["SAVED", 0.5], ["WIDE", 0.22], ["BLOCKED", 0.18], ["POST", 0.1]],
  HEADER: [["SAVED", 0.38], ["WIDE", 0.38], ["BLOCKED", 0.12], ["POST", 0.12]],
  FREEKICK: [["SAVED", 0.4], ["BLOCKED", 0.25], ["WIDE", 0.27], ["POST", 0.08]],
  REBOUND: [["SAVED", 0.45], ["BLOCKED", 0.25], ["WIDE", 0.2], ["POST", 0.1]],
  PENALTY: [["SAVED", 0.6], ["WIDE", 0.2], ["POST", 0.2]],
};

const rollOutcome = (kind: ShotKind): ShotOutcome => {
  const table = SHOT_TABLE[kind === "SEQ" ? "CLOSE" : kind];
  let r = Math.random();
  for (const [o, p] of table) {
    r -= p;
    if (r < 0) return o;
  }
  return "SAVED";
};

interface ShotEvt {
  shooter: PlayerAgent;
  att: Team;
  def: Team;
  kind: ShotKind;
  outcome: ShotOutcome;
  start: Vector2D;
  t: number;
  gk: PlayerAgent | null;
  blocker: PlayerAgent | null;
  seq?: AttackSequence; // skenario backend yang sedang dimainkan (untuk GOL)
  reboundGoal?: boolean; // gol disajikan sebagai bola muntah
}

type Step = "GATHER" | "BUILDUP" | "WING_WAIT" | "WING_RUN" | "CROSS_FLIGHT" | "SHOT_WAIT" | "SHOT" | "AFTER";

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
const goalXOf = (attacking: Team) => (attacking === "HOME" ? PITCH_W : 0);
const inBox = (attacking: Team, p: Vector2D) =>
  Math.abs(p.y - CY) < BOX_HALF && (attacking === "HOME" ? p.x > PITCH_W - BOX_DEPTH : p.x < BOX_DEPTH);

/**
 * Mesin pertandingan. Semua kejadian (tembakan, tepisan, rebound, offside, set piece)
 * digerakkan oleh POSISI bola dan WAKTU SIMULASI, bukan timer jam dinding, sehingga bola
 * selalu bergerak nyata dari titik A ke B dan ikut kecepatan 1x/2x/5x serta jeda.
 */
export class MatchEngine {
  public agents: PlayerAgent[];
  public ball = new BallPhysics();
  public onGoal?: (seq: AttackSequence) => void;
  public onCommentary?: (text: string) => void;
  public activeBanner: ActiveMatchBanner | null = null;

  public tactic: Tactic = "BALANCED";
  public possession: Team = "HOME";
  public setPieceState: SetPieceType = "NONE";

  private lastTouch: Team = "HOME";
  private receiver: PlayerAgent | null = null;
  private receiverTimer = 0;
  private decisionTimer = 1.0;
  private time = 0;
  private queue: AttackSequence[] = [];
  private run: SeqRun | null = null;
  private shot: ShotEvt | null = null;
  private presser: Record<Team, PlayerAgent | null> = { HOME: null, AWAY: null };

  // Set piece
  private setPieceTaker: PlayerAgent | null = null;
  private setPieceTimer = 0;
  private placeTarget: Vector2D | null = null;
  private placeDelay = 0;
  private penaltyGoalSeq: AttackSequence | null = null;

  // Alur lanjutan berbasis kejadian
  private offsideFlag: PlayerAgent | null = null;
  private shotOnReceive: { player: PlayerAgent; kind: ShotKind } | null = null;
  private pendingShot: { shooter: PlayerAgent; kind: ShotKind; outcome?: ShotOutcome; seq?: AttackSequence; timer: number } | null = null;
  private reboundWindow: { team: Team; timer: number } | null = null;
  private guaranteedGoal: { seq: AttackSequence; shooter: PlayerAgent; timer: number } | null = null;

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
      this.ball.placeAt(PITCH_W / 2, CY);
      this.take(taker);
    }
  }

  public setTactic(t: Tactic) {
    this.tactic = t;
  }

  public queueSequence(seq: AttackSequence) {
    this.queue.push(seq);
  }

  public triggerBanner(badge: string, title: string, subtitle?: string, duration = 3.2) {
    this.activeBanner = { badge, title, subtitle, timer: duration };
    this.onCommentary?.(subtitle ? `${badge} ${title}: ${subtitle}` : `${badge} ${title}`);
  }

  public get carrier(): PlayerAgent | null {
    return this.ball.carrier;
  }

  public advance(dt: number) {
    const n = Math.max(1, Math.ceil(dt / 0.02));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.step(h);
  }

  private step(h: number) {
    this.time += h;

    if (this.activeBanner) {
      this.activeBanner.timer -= h;
      if (this.activeBanner.timer <= 0) this.activeBanner = null;
    }
    if (this.reboundWindow) {
      this.reboundWindow.timer -= h;
      if (this.reboundWindow.timer <= 0) this.reboundWindow = null;
    }
    if (this.guaranteedGoal) {
      this.guaranteedGoal.timer += h;
      // Pengaman: bola muntah gol harus tetap berujung gol sesuai hasil backend
      if (this.guaranteedGoal.timer > 6 && !this.carrier) this.take(this.guaranteedGoal.shooter);
    }

    if (this.setPieceState !== "NONE") {
      this.stepSetPiece(h);
    } else {
      if (!this.run && !this.shot && !this.guaranteedGoal && this.queue.length) {
        this.startSequence(this.queue.shift()!);
      }
      if (this.shot) this.stepShot(h);
      else if (this.run) this.stepSequence(h);
      else this.stepOpenPlay(h);

      this.controlBall(h);
      this.checkPitchBoundaries();
    }

    this.assignTargets();
    for (const a of this.agents) a.update(h, this.time, this.agents);
    this.ball.update(h);
  }

  // ================================================================ KEPEMILIKAN BOLA

  private take(a: PlayerAgent) {
    this.ball.setCarrier(a);
    this.receiver = null;
    this.possession = a.team;
    this.lastTouch = a.team;
    this.decisionTimer = 0.8 + Math.random() * 1.0;
    if (this.offsideFlag && this.offsideFlag !== a) this.offsideFlag = null;
    if (this.pendingShot && this.pendingShot.shooter !== a) this.pendingShot = null;

    // Peluang menembak lanjutan setelah menerima bola
    if (this.guaranteedGoal && a.team === this.guaranteedGoal.seq.team) {
      this.pendingShot = { shooter: a, kind: "REBOUND", outcome: "GOAL", seq: this.guaranteedGoal.seq, timer: 0.3 };
      this.guaranteedGoal = null;
    } else if (this.shotOnReceive && this.shotOnReceive.player === a) {
      this.pendingShot = { shooter: a, kind: this.shotOnReceive.kind, timer: 0.3 };
    } else if (this.reboundWindow && a.team === this.reboundWindow.team && this.inDanger(a)) {
      this.pendingShot = { shooter: a, kind: "REBOUND", timer: 0.25 };
      this.reboundWindow = null;
    } else if (this.reboundWindow && a.team !== this.reboundWindow.team) {
      this.reboundWindow = null;
    }
    this.shotOnReceive = null;
  }

  private inDanger(a: PlayerAgent) {
    return a.position.dist(new Vector2D(goalXOf(a.team), CY)) < 24 && Math.abs(a.position.y - CY) < 20;
  }

  private sendPass(to: PlayerAgent, speed: number) {
    const lead = to.position.clone().add(Vector2D.mult(to.velocity, 0.45));
    this.passTo(lead, to, speed);
  }

  /** Operan datar ke titik tertentu dengan penerima yang ditentukan */
  private passTo(point: Vector2D, to: PlayerAgent, speed: number) {
    if (this.carrier) this.lastTouch = this.carrier.team;
    this.ball.pass(point, speed);
    this.receiver = to;
    this.receiverTimer = 4.5;
    this.possession = to.team;
  }

  /** Umpan lambung (crossing / umpan jauh / tendangan pojok) */
  private crossTo(from: PlayerAgent, target: Vector2D, to: PlayerAgent, duration: number, apex: number, shotKind?: ShotKind) {
    this.ball.cross(target, duration, apex);
    this.receiver = to;
    this.receiverTimer = duration + 3.5;
    this.possession = from.team;
    this.lastTouch = from.team;
    this.shotOnReceive = shotKind ? { player: to, kind: shotKind } : null;
  }

  private controlBall(h: number) {
    const ball = this.ball;
    if (this.receiver) {
      const r = this.receiver;
      this.receiverTimer -= h;
      if (r.position.dist(ball.position) < 1.6 && ball.z < 1.8 && ball.mode !== "CROSS") {
        if (this.offsideFlag === r) {
          this.awardOffside(r);
          return;
        }
        this.take(r);
      } else {
        const canIntercept = !this.run && !this.guaranteedGoal && (ball.mode === "FLIGHT" || ball.mode === "LOOSE");
        if (canIntercept) {
          for (const o of this.agents) {
            if (o.team !== r.team && o.position.dist(ball.position) < 1.3 && Math.random() < 2.5 * h) {
              this.take(o);
              return;
            }
          }
        }
        if (this.receiverTimer <= 0) {
          this.receiver = null;
          this.offsideFlag = null;
        }
      }
    } else if (!this.carrier && ball.mode === "LOOSE") {
      let best: PlayerAgent | null = null;
      let bd = 1.6;
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

  // ================================================================ BOLA KELUAR LAPANGAN

  private checkPitchBoundaries() {
    if (this.run || this.shot || this.guaranteedGoal) return;
    const bp = this.ball.position;
    const lastTeam = this.lastTouch;

    if (bp.y < 0 || bp.y > PITCH_H) {
      const team = other(lastTeam);
      const place = new Vector2D(clamp(bp.x, 3, PITCH_W - 3), bp.y < 0 ? 0 : PITCH_H);
      const taker = this.nearestOutfield(team, place);
      if (taker) {
        this.beginSetPiece("THROW_IN", place, taker, 1.6);
        this.triggerBanner("🤾", "LEMPARAN KE DALAM", `${taker.name} bersiap melempar bola`, 2.4);
      }
      return;
    }

    if (bp.x < 0 || bp.x > PITCH_W) {
      const defTeam: Team = bp.x < 0 ? "HOME" : "AWAY";
      if (lastTeam === defTeam) {
        this.awardCorner(other(defTeam), bp.x < 0 ? 0 : PITCH_W, bp.y < CY ? 0 : PITCH_H);
      } else {
        this.awardGoalKick(defTeam);
      }
    }
  }

  private nearestOutfield(team: Team, p: Vector2D): PlayerAgent | undefined {
    return this.agents
      .filter((a) => a.team === team && a.positionRole !== "GK")
      .sort((a, b) => a.position.dist(p) - b.position.dist(p))[0];
  }

  // ================================================================ SET PIECE

  /** Memulai set piece: bola menggelinding dulu, baru diletakkan di titik tendangan setelah jeda wajar. */
  private beginSetPiece(type: SetPieceType, place: Vector2D, taker: PlayerAgent | null, timer: number) {
    if (this.ball.carrier || this.ball.mode === "CROSS") this.ball.release();
    this.receiver = null;
    this.pendingShot = null;
    this.shotOnReceive = null;
    this.offsideFlag = null;
    this.reboundWindow = null;
    this.setPieceState = type;
    this.setPieceTaker = taker;
    this.setPieceTimer = timer;
    this.placeTarget = place.clone();
    this.placeDelay = this.ball.position.dist(place) < 2.5 ? 0 : 0.8;
    if (this.placeDelay === 0) this.ball.placeAt(place.x, place.y);
    if (taker) this.possession = taker.team;
  }

  public awardCorner(att: Team, cornerX: number, cornerY: number) {
    const spot = new Vector2D(cornerX, cornerY);
    const taker =
      this.agents
        .filter((a) => a.team === att && a.positionRole !== "GK" && a.positionRole !== "DF")
        .sort((a, b) => a.position.dist(spot) - b.position.dist(spot))[0] ?? null;
    this.beginSetPiece("CORNER", spot, taker, 2.2);
    this.triggerBanner("⛳", "SEPAK POJOK!", `Tendangan sudut untuk ${att === "HOME" ? "tim tuan rumah" : "tim tamu"}`, 3.2);
  }

  public awardPenalty(att: Team, preferred?: PlayerAgent) {
    const spot = new Vector2D(att === "HOME" ? PITCH_W - 11 : 11, CY);
    const taker = preferred ?? this.agents.find((a) => a.team === att && a.slotCode === "ST") ?? null;
    this.beginSetPiece("PENALTY", spot, taker, 2.6);
    this.triggerBanner("⚡", "PENALTI!", `Pelanggaran di kotak terlarang! ${taker?.name ?? "Algojo"} maju sebagai eksekutor`, 3.6);
  }

  public awardFreeKick(att: Team, foulPos: Vector2D) {
    const taker =
      this.agents
        .filter((a) => a.team === att && a.positionRole !== "GK")
        .sort((a, b) => b.topSpeed - a.topSpeed)[0] ?? null;
    this.beginSetPiece("FREE_KICK", foulPos, taker, 2.4);
    const dist = Math.round(foulPos.dist(new Vector2D(goalXOf(att), CY)));
    this.triggerBanner("🧱", "TENDANGAN BEBAS!", `Berjarak sekitar ${dist} meter dari gawang`, 3.0);
  }

  public awardOffside(caught: PlayerAgent) {
    const defTeam = other(caught.team);
    const taker = this.nearestOutfield(defTeam, this.ball.position) ?? null;
    this.beginSetPiece("OFFSIDE", this.ball.position.clone(), taker, 1.8);
    this.triggerBanner("🚩", "OFFSIDE!", `Bendera hakim garis naik! ${caught.name} lebih maju dari bek terakhir`, 3.0);
  }

  public awardGoalKick(defTeam: Team) {
    const gk = this.agents.find((a) => a.team === defTeam && a.positionRole === "GK") ?? null;
    const spot = new Vector2D(defTeam === "HOME" ? 5.5 : PITCH_W - 5.5, CY);
    this.beginSetPiece("GOAL_KICK", spot, gk, 1.8);
    this.triggerBanner("🧤", "TENDANGAN GAWANG", `${gk?.name ?? "Kiper"} bersiap menendang bola dari kotak 6 yard`, 2.4);
  }

  private stepSetPiece(h: number) {
    const taker = this.setPieceTaker;
    if (this.placeDelay > 0) {
      this.placeDelay -= h;
      if (this.placeDelay <= 0 && this.placeTarget) this.ball.placeAt(this.placeTarget.x, this.placeTarget.y);
    } else {
      this.setPieceTimer -= h;
    }
    const spot = this.placeTarget ?? this.ball.position;
    taker?.setDesired(spot.x, spot.y, 0.85);

    if (this.placeDelay > 0 || this.setPieceTimer > 0) return;
    // Tunggu penendang tiba di dekat bola (maks. 2.5 dtk tambahan)
    if (taker && taker.position.dist(this.ball.position) > 1.8 && this.setPieceTimer > -2.5) return;

    const sp = this.setPieceState;
    this.setPieceState = "NONE";
    this.setPieceTaker = null;
    this.placeTarget = null;
    if (!taker) return;
    this.executeSetPiece(sp, taker);
  }

  private executeSetPiece(sp: SetPieceType, taker: PlayerAgent) {
    const att = taker.team;
    const d = dirOf(att);
    const gx = goalXOf(att);
    const bp = this.ball.position;

    if (sp === "KICK_OFF" || sp === "THROW_IN" || sp === "OFFSIDE") {
      this.take(taker);
      this.doNormalPass(taker, sp === "THROW_IN" ? 12 : undefined);
      if (sp === "THROW_IN") this.onCommentary?.(`🤾 ${taker.name} melempar bola ke dalam.`);
      return;
    }

    if (sp === "PENALTY") {
      const seq = this.penaltyGoalSeq ?? undefined;
      this.penaltyGoalSeq = null;
      this.onCommentary?.(`⚡ ${taker.name} mengambil ancang-ancang... menembak!`);
      this.launchShot(taker, "PENALTY", seq ? "GOAL" : undefined, seq);
      return;
    }

    if (sp === "FREE_KICK") {
      if (bp.dist(new Vector2D(gx, CY)) < 30 && Math.random() < 0.6) {
        this.onCommentary?.(`🧱 ${taker.name} mengeksekusi tendangan bebas langsung ke arah gawang!`);
        this.launchShot(taker, "FREEKICK");
      } else {
        this.crossIntoBox(taker, "HEADER", `🧱 ${taker.name} mengangkat bola bebas ke dalam kotak penalti!`);
      }
      return;
    }

    if (sp === "CORNER") {
      this.crossIntoBox(taker, "HEADER", `⛳ ${taker.name} melepas tendangan sudut melengkung ke kotak penalti!`);
      return;
    }

    if (sp === "GOAL_KICK") {
      if (Math.random() < 0.55) {
        const target = new Vector2D(PITCH_W / 2 + d * 6, CY + (Math.random() * 20 - 10));
        const rec = this.agents
          .filter((a) => a.team === att && a.positionRole !== "GK" && a.positionRole !== "DF")
          .sort((a, b) => a.position.dist(target) - b.position.dist(target))[0];
        if (rec) {
          this.onCommentary?.(`🚀 ${taker.name} menendang bola jauh ke lini tengah.`);
          this.crossTo(taker, target, rec, 1.6, 7.5);
          return;
        }
      }
      this.take(taker);
      this.doNormalPass(taker);
    }
  }

  /** Umpan lambung ke kotak penalti, penerima akan langsung menyundul/menembak */
  private crossIntoBox(taker: PlayerAgent, shotKind: ShotKind, text: string) {
    const att = taker.team;
    const d = dirOf(att);
    const gx = goalXOf(att);
    const target = new Vector2D(gx - d * 9, CY + (Math.random() * 8 - 4));
    const rec = this.agents
      .filter((a) => a.team === att && a !== taker && a.positionRole !== "GK")
      .sort((a, b) => (a.slotCode === "ST" ? -1 : 0) - (b.slotCode === "ST" ? -1 : 0) || a.position.dist(target) - b.position.dist(target))[0];
    if (!rec) {
      this.take(taker);
      return;
    }
    this.onCommentary?.(text);
    this.crossTo(taker, target, rec, 1.3, 6.5, shotKind);
  }

  // ================================================================ TEMBAKAN (BERBASIS POSISI BOLA)

  private launchShot(
    shooter: PlayerAgent,
    kind: ShotKind,
    forced?: ShotOutcome,
    seq?: AttackSequence,
    extra?: { reboundGoal?: boolean; blocker?: PlayerAgent; gk?: PlayerAgent }
  ) {
    const att = shooter.team;
    const def = other(att);
    const outcome = forced ?? rollOutcome(kind);
    const gx = goalXOf(att);
    const side = Math.random() < 0.5 ? -1 : 1;

    let ty = CY;
    if (outcome === "GOAL") ty = CY + side * (1 + Math.random() * 1.8);
    else if (outcome === "SAVED") ty = CY + side * Math.random() * 2;
    else if (outcome === "POST") ty = CY + side * GOAL_HALF;
    else if (outcome === "WIDE") {
      ty = seq ? pm(seq.finishCoord).y : CY + side * (GOAL_HALF + 2 + Math.random() * 5);
      if (Math.abs(ty - CY) < GOAL_HALF + 1.5) ty = CY + (ty < CY ? -1 : 1) * (GOAL_HALF + 2.5);
    }

    const start = this.ball.position.clone();
    const dir = Vector2D.sub(new Vector2D(gx, ty), start).normalize();
    const far = start.clone().add(Vector2D.mult(dir, start.dist(new Vector2D(gx, ty)) + 3));
    const speed = kind === "PENALTY" ? 28 : kind === "FREEKICK" ? 27 : kind === "HEADER" ? 24 : outcome === "BLOCKED" ? 25 : 31;
    this.ball.shoot(far, speed);

    this.receiver = null;
    this.pendingShot = null;
    this.possession = att;
    this.lastTouch = att;

    const gk = extra?.gk ?? this.agents.find((a) => a.team === def && a.positionRole === "GK") ?? null;
    const blocker = kind === "PENALTY" ? null : extra?.blocker ?? this.nearestOutfield(def, start) ?? null;
    this.shot = { shooter, att, def, kind, outcome, start, t: 0, gk, blocker, seq, reboundGoal: extra?.reboundGoal };

    if (kind !== "SEQ" && kind !== "PENALTY") {
      const label = kind === "HEADER" ? "SUNDULAN KERAS!" : kind === "REBOUND" ? "SAMBARAN BOLA MUNTAH!" : kind === "FREEKICK" ? "TENDANGAN BEBAS KE GAWANG!" : "TEMBAKAN KERAS!";
      this.triggerBanner("🚀", label, `${shooter.name} melepaskan tembakan ke arah gawang`, 2.2);
    }
  }

  private stepShot(h: number) {
    const s = this.shot!;
    s.t += h;
    const ball = this.ball;
    const pos = ball.position;
    const dd = dirOf(s.att);
    const gx = goalXOf(s.att);
    const toLine = Math.abs(gx - pos.x);
    const back = dd > 0 ? Math.PI : 0;
    const spread = (w: number) => back + (Math.random() - 0.5) * w;
    const gkName = s.gk?.name ?? "Kiper";

    if (s.t > 4) {
      this.endShot(s);
      return;
    }

    switch (s.outcome) {
      case "BLOCKED":
        if (pos.dist(s.start) > 3) {
          this.triggerBanner("🛡️", "TEMBAKAN DIBLOK!", `${s.blocker?.name ?? "Bek"} meluncur memblok sepakan ${s.shooter.name}`, 2.4);
          ball.deflect(spread(1.8), 9);
          this.endShot(s, 2.5);
        }
        break;
      case "SAVED":
        if (toLine < 2.5) {
          if (s.reboundGoal && s.seq) {
            // Kiper menepis, bola muntah jatuh ke kaki penembak yang sama lalu disambar jadi GOL
            this.triggerBanner("🧤", "DITEPIS KIPER!", `${gkName} menepis, bola muntah di depan gawang!`, 2.6);
            const ang = Math.atan2(s.shooter.position.y - pos.y, s.shooter.position.x - pos.x);
            ball.deflect(ang, 6);
            this.receiver = s.shooter;
            this.receiverTimer = 5;
            this.guaranteedGoal = { seq: s.seq, shooter: s.shooter, timer: 0 };
            this.shot = null;
            this.run = null;
            return;
          }
          this.triggerBanner("🧤", "PENYELAMATAN HEBAT!", `${gkName} menepis sepakan ${s.shooter.name}!`, 2.6);
          ball.deflect(spread(1.6), 8);
          this.endShot(s, 3.2);
        }
        break;
      case "POST":
        if (toLine < 0.8) {
          this.triggerBanner("💥", "MENGHANTAM TIANG!", `Tendangan ${s.shooter.name} membentur tiang gawang!`, 2.6);
          ball.deflect(spread(1.0), 10);
          this.endShot(s, 2.5);
        }
        break;
      case "GOAL":
        if ((dd > 0 && pos.x > PITCH_W + 0.3) || (dd < 0 && pos.x < -0.3)) {
          const seq = s.seq;
          this.shot = null;
          this.run = null;
          if (seq) this.scoreGoal(seq);
        }
        break;
      default: // WIDE
        if ((dd > 0 && pos.x > PITCH_W + 1) || (dd < 0 && pos.x < -1)) {
          this.triggerBanner("💨", "TEMBAKAN MELENCENG!", `Sepakan ${s.shooter.name} melebar dari gawang`, 2.4);
          this.shot = null;
          this.run = null;
          this.lastTouch = s.att;
          this.awardGoalKick(s.def);
        }
    }
  }

  /** Tembakan selesai tanpa gol: bola liar -> peluang rebound bagi tim penyerang */
  private endShot(s: ShotEvt, reboundSeconds = 0) {
    this.shot = null;
    this.run = null;
    if (reboundSeconds > 0 && this.ball.mode === "LOOSE") this.reboundWindow = { team: s.att, timer: reboundSeconds };
  }

  // ================================================================ PERMAINAN TERBUKA

  private stepOpenPlay(h: number) {
    const c = this.carrier;
    if (!c) return;
    this.possession = c.team;

    if (this.pendingShot && this.pendingShot.shooter === c) {
      this.pendingShot.timer -= h;
      if (this.pendingShot.timer <= 0) {
        const p = this.pendingShot;
        this.pendingShot = null;
        this.launchShot(c, p.kind, p.outcome, p.seq);
      }
      return;
    }

    for (const o of this.agents) {
      if (o.team === c.team || o.positionRole === "GK") continue;
      if (o.position.dist(c.position) < 1.8 && Math.random() < (0.12 + 0.25 * o.aggression) * h) {
        if (Math.random() < 0.15) {
          this.handleFoul(c);
          return;
        }
        this.take(o);
        return;
      }
    }

    this.decisionTimer -= h;
    if (this.decisionTimer <= 0) this.doRichTacticalDecision(c);
  }

  private handleFoul(victim: PlayerAgent) {
    const pos = victim.position.clone();
    if (inBox(victim.team, pos)) {
      this.awardPenalty(victim.team);
    } else {
      this.awardFreeKick(victim.team, pos);
    }
  }

  private doRichTacticalDecision(c: PlayerAgent) {
    const att = c.team;
    const d = dirOf(att);
    const depth = att === "HOME" ? c.position.x : PITCH_W - c.position.x;
    const goalPos = new Vector2D(goalXOf(att), CY);
    const distToGoal = c.position.dist(goalPos);
    const attacking = att === "HOME" && this.tactic === "ATTACKING";

    // Tembakan: dekat gawang atau spekulasi dari luar kotak
    if (c.positionRole !== "DF" && distToGoal < 26) {
      const close = distToGoal <= 14;
      const p = close ? 0.55 : attacking ? 0.38 : 0.22;
      if (Math.random() < p) {
        this.launchShot(c, close ? "CLOSE" : "LONG");
        return;
      }
    }

    // Umpan silang dari sayap
    if ((c.position.y < 16 || c.position.y > PITCH_H - 16) && depth > 68 && Math.random() < 0.68) {
      const target = new Vector2D(goalPos.x - d * 9, CY + (Math.random() * 10 - 5));
      const striker = this.agents.find((a) => a.team === att && a.slotCode === "ST" && a !== c);
      if (striker) {
        this.triggerBanner("⚡", "UMPAN SILANG!", `${c.name} melepas umpan silang ke kotak penalti`, 2.2);
        this.crossTo(c, target, striker, 1.25, 5.8, "HEADER");
        return;
      }
    }

    // Umpan lambung jauh dari belakang langsung ke depan
    if (depth < 42 && (c.positionRole === "DF" || c.slotCode === "CM") && Math.random() < (attacking ? 0.35 : 0.18)) {
      const fwd = this.agents.find((a) => a.team === att && a.positionRole === "FW" && a !== c);
      if (fwd) {
        this.triggerBanner("🚀", "UMPAN JAUH!", `${c.name} mengirim bola panjang langsung ke lini depan`, 2.2);
        this.crossTo(c, fwd.position.clone().add(new Vector2D(d * 12, 0)), fwd, 1.5, 7.2);
        return;
      }
    }

    // Umpan terobosan (bisa berujung offside)
    if (depth > 50 && depth < 82 && c.positionRole !== "DF") {
      const target = this.agents
        .filter((a) => a.team === att && a !== c && a.positionRole === "FW")
        .sort((a, b) => (b.position.x - a.position.x) * d)[0];
      if (target && Math.random() < 0.4) {
        const offside = this.checkIsOffside(target);
        const through = target.position.clone().add(new Vector2D(d * 9, 0));
        this.triggerBanner("🎯", "UMPAN TEROBOSAN!", `${c.name} melepas bola terobosan ke ruang kosong`, 2.0);
        this.passTo(through, target, 23);
        if (offside) this.offsideFlag = target; // bendera baru naik saat bola tiba di kaki pemain
        else if (Math.random() < 0.6) this.shotOnReceive = { player: target, kind: "CLOSE" };
        return;
      }
    }

    this.doNormalPass(c);
  }

  /** Offside saat umpan dilepas: lebih maju dari bola dan dari bek kedua terakhir, di area lawan */
  private checkIsOffside(attacker: PlayerAgent): boolean {
    const d = dirOf(attacker.team);
    const defenders = this.agents
      .filter((a) => a.team !== attacker.team && a.positionRole !== "GK")
      .sort((a, b) => (d > 0 ? b.position.x - a.position.x : a.position.x - b.position.x));
    if (defenders.length < 1) return false;
    const line = defenders[0].position.x;
    const ballX = this.ball.position.x;
    const x = attacker.position.x;
    if (d > 0) return x > line && x > ballX && x > PITCH_W / 2;
    return x < line && x < ballX && x < PITCH_W / 2;
  }

  private doNormalPass(c: PlayerAgent, speedOverride?: number) {
    const d = dirOf(c.team);
    let best: PlayerAgent | null = null;
    let bestScore = -Infinity;

    for (const t of this.agents) {
      if (t.team !== c.team || t === c) continue;
      if (c.positionRole === "GK" ? t.positionRole !== "DF" : t.positionRole === "GK") continue;
      const dist = t.position.dist(c.position);
      if (dist < 6 || dist > 38) continue;
      let nearestOpp = 8;
      for (const o of this.agents) {
        if (o.team !== c.team) nearestOpp = Math.min(nearestOpp, o.position.dist(t.position));
      }
      const depth = c.team === "HOME" ? t.position.x : PITCH_W - t.position.x;
      let score = (t.position.x - c.position.x) * d * 0.7 + nearestOpp * 1.4 - dist * 0.08 + Math.random() * 5;
      if (depth > 84) score -= (depth - 84) * 3;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }

    if (!best) {
      this.decisionTimer = 0.5;
      return;
    }
    this.sendPass(best, speedOverride ?? clamp(15 + c.position.dist(best.position) * 0.5, 15, 27));
  }

  // ================================================================ SKENARIO SERANGAN BACKEND

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
      wingerPos: pm(seq.wingerCoord), boxPos: pm(seq.boxCoord),
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
        if (r.t > 1.4) {
          this.sendPass(r.w, 21);
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
            this.triggerBanner("🛡️", "TEKEL BERSIH!", `${r.d.name} menghentikan tusukan ${r.w.name}`, 2.4);
            this.sendPass(r.d, 10);
            this.next(r, "AFTER");
          }
        } else if (r.w.position.dist(r.wingerPos) < 3.2 || r.t > 3.5) {
          this.triggerBanner("⚡", "UMPAN SILANG AKURAT!", `${r.w.name} melepas umpan silang ke kotak penalti`, 2.4);
          this.crossTo(r.w, r.boxPos, r.f, 1.18, 5.6);
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
        if (r.t > 0.4) this.fireSeqShot(r);
        break;
      case "SHOT":
        break; // ditangani stepShot()
      case "AFTER":
        if (r.t > 1.4) this.run = null;
        break;
    }
  }

  /**
   * Hasil skenario tetap mengikuti backend. Khusus GOL, cara penyajiannya bervariasi
   * (tembakan langsung, bola muntah, atau penalti) tetapi jumlah gol TIDAK berubah.
   */
  private fireSeqShot(r: SeqRun) {
    const oc = r.seq.outcome;
    let forced: ShotOutcome = oc === "TACKLED" ? "WIDE" : (oc as ShotOutcome);
    let reboundGoal = false;

    if (oc === "GOAL") {
      const roll = Math.random();
      if (roll < 0.14) {
        this.penaltyGoalSeq = r.seq;
        this.run = null;
        this.awardPenalty(r.att, r.f);
        return;
      }
      if (roll < 0.4) {
        reboundGoal = true;
        forced = "SAVED";
      }
    }
    this.launchShot(r.f, "SEQ", forced, r.seq, { reboundGoal, blocker: r.d, gk: r.gk });
    this.next(r, "SHOT");
  }

  private scoreGoal(seq: AttackSequence) {
    this.onGoal?.(seq);
    const conceding = other(seq.team);
    const taker =
      this.agents.find((a) => a.team === conceding && a.slotCode === "CM") ??
      this.agents.find((a) => a.team === conceding && a.positionRole === "MF") ??
      this.agents[0];

    this.run = null;
    this.shot = null;
    this.guaranteedGoal = null;
    this.beginSetPiece("KICK_OFF", new Vector2D(PITCH_W / 2, CY), taker, 3.2);
    this.triggerBanner("⚽", "GOOOOL!", `${seq.finisherPlayer} mencetak gol untuk ${seq.team === "HOME" ? "tim tuan rumah" : "tim tamu"}!`, 4.0);
  }

  // ================================================================ TARGET TAKTIS

  private assignTargets() {
    const ball = this.ball;
    const bp = ball.position;
    const teams: Team[] = ["HOME", "AWAY"];
    const press: Record<Team, PlayerAgent | null> = { HOME: null, AWAY: null };
    const cover: Record<Team, PlayerAgent | null> = { HOME: null, AWAY: null };

    if (this.setPieceState === "NONE") {
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

    for (const a of this.agents) {
      const d = dirOf(a.team);
      const inPoss = this.possession === a.team;
      if (a.positionRole === "GK") {
        this.gkTarget(a, bp);
        continue;
      }
      const shift = clamp((bp.x - PITCH_W / 2) * 0.5, -20, 20);
      const tac = a.team === "HOME" ? (this.tactic === "ATTACKING" ? 6 : this.tactic === "DEFENSIVE" ? -6 : 0) : 0;
      const depthF = a.positionRole === "DF" ? 0.7 : 1;
      const push = (inPoss ? 9 : -3) + tac;

      let x = a.anchor.x + shift * depthF + d * push * depthF;
      let y = a.anchor.y + (bp.y - CY) * (a.positionRole === "DF" ? 0.18 : a.positionRole === "MF" ? 0.32 : 0.12);
      let u: number | undefined;

      if (inPoss) {
        if (a.positionRole === "FW") {
          x = d > 0 ? Math.max(x, bp.x + 7) : Math.min(x, bp.x - 7);
          y = a.slotCode === "ST"
            ? CY + (bp.y - CY) * 0.25 + Math.sin(this.time * 0.35 + a.phase) * 7
            : a.anchor.y + Math.sin(this.time * 0.4 + a.phase) * 3;
          u = 0.7;
        } else if (a.positionRole === "MF") {
          x = x * 0.5 + (bp.x - d * 4) * 0.5;
        } else if (a.slotCode === "LB" || a.slotCode === "RB") {
          x += d * 7;
        }
      }
      x = d > 0 ? clamp(x, 3, PITCH_W - 6) : clamp(x, 6, PITCH_W - 3);
      a.setDesired(x, clamp(y, 3, PITCH_H - 3), u);
    }

    for (const team of teams) {
      const p = press[team];
      if (p) {
        const c = this.carrier && this.carrier.team !== team ? this.carrier : null;
        p.setDesired(
          c ? c.position.x + c.velocity.x * 0.4 : bp.x + ball.velocity.x * 0.2,
          c ? c.position.y + c.velocity.y * 0.4 : bp.y + ball.velocity.y * 0.2,
          1
        );
      }
      const cv = cover[team];
      if (cv) {
        const own = team === "HOME" ? 0 : PITCH_W;
        cv.setDesired(bp.x + (own - bp.x) * 0.3, bp.y + (CY - bp.y) * 0.2, 0.8);
      }
    }

    const c = this.carrier;
    if (c) {
      if (c.positionRole === "GK" || this.pendingShot?.shooter === c) {
        c.setDesired(c.position.x, c.position.y, 0.2);
      } else {
        const d = dirOf(c.team);
        const depth = c.team === "HOME" ? c.position.x : PITCH_W - c.position.x;
        const tx = depth > 82 ? c.position.x : c.position.x + d * 10;
        c.setDesired(tx, c.position.y + (CY - c.position.y) * 0.25, 0.6);
      }
    }

    this.applySequenceTargets();
    this.applySetPieceTargets();

    const r = this.receiver;
    if (r) {
      if (ball.mode === "CROSS") r.setDesired(ball.crossTarget.x, ball.crossTarget.y, 0.95);
      else r.setDesired(bp.x + ball.velocity.x * 0.25, bp.y + ball.velocity.y * 0.25, 1);
    }
  }

  private applySequenceTargets() {
    const s = this.shot;
    if (s?.blocker) {
      const dd = dirOf(s.att);
      s.blocker.setDesired(s.start.x + dd * 2.5, s.start.y + (CY - s.start.y) * 0.4, 1);
    }

    const r = this.run;
    if (!r) return;
    const dd = dirOf(r.att);
    switch (r.step) {
      case "BUILDUP":
        r.b.setDesired(r.wingerPos.x - dd * 15, (r.b.position.y + r.wingerPos.y) / 2, 0.65);
        break;
      case "WING_WAIT":
        r.f.setDesired(r.boxPos.x - dd * 8, r.boxPos.y, 0.6);
        break;
      case "WING_RUN":
        r.w.setDesired(r.wingerPos.x, r.wingerPos.y, 0.85);
        r.f.setDesired(r.boxPos.x - dd * 2, r.boxPos.y, 0.85);
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
    }
  }

  /** Posisi pemain saat set piece: pagar betis, isi kotak penalti, kosongkan area penalti */
  private applySetPieceTargets() {
    const sp = this.setPieceState;
    if (sp === "NONE" || sp === "KICK_OFF") return;
    const taker = this.setPieceTaker;
    const att = taker ? taker.team : this.possession;
    const def = other(att);
    const d = dirOf(att);
    const gx = goalXOf(att);
    const spot = this.placeTarget ?? this.ball.position;

    if (sp === "PENALTY") {
      for (const a of this.agents) {
        if (a === taker || (a.team === def && a.positionRole === "GK")) continue;
        a.setDesired(gx - d * 21, clamp(a.anchor.y, 6, PITCH_H - 6), 0.7);
      }
    } else if (sp === "CORNER") {
      const attackers = this.agents.filter(
        (a) => a.team === att && a !== taker && a.positionRole !== "GK" && (a.positionRole === "FW" || a.slotCode === "LCB" || a.slotCode === "RCB" || a.slotCode === "CM")
      );
      attackers.forEach((a, i) => a.setDesired(gx - d * (6 + (i % 3) * 3), CY + (i - (attackers.length - 1) / 2) * 3.4, 0.8));
      const defenders = this.agents.filter((a) => a.team === def && a.positionRole !== "GK" && a.positionRole !== "FW");
      defenders.forEach((a, i) => a.setDesired(gx - d * (5 + (i % 3) * 2.5), CY + (i - (defenders.length - 1) / 2) * 2.8, 0.8));
    } else if (sp === "FREE_KICK") {
      const goal = new Vector2D(gx, CY);
      if (spot.dist(goal) < 38) {
        const dir = Vector2D.sub(goal, spot).normalize();
        const centre = spot.clone().add(Vector2D.mult(dir, 9.15));
        const wall = this.agents
          .filter((a) => a.team === def && a.positionRole !== "GK")
          .sort((a, b) => a.position.dist(centre) - b.position.dist(centre))
          .slice(0, 3);
        wall.forEach((a, i) => a.setDesired(centre.x - dir.y * (i - 1) * 1.6, centre.y + dir.x * (i - 1) * 1.6, 1));
        const runners = this.agents.filter((a) => a.team === att && a !== taker && a.positionRole === "FW");
        runners.forEach((a, i) => a.setDesired(gx - d * (9 + i * 3), CY + (i - 1) * 5, 0.8));
      }
    }
  }

  private gkTarget(a: PlayerAgent, bp: Vector2D) {
    const own = a.team === "HOME" ? 0 : PITCH_W;
    const d = dirOf(a.team);
    let gx = own + d * (2.2 + clamp((Math.abs(bp.x - own) - 25) * 0.05, 0, 3.5));
    let gy = CY + (bp.y - CY) * 0.22;
    let urgent: number | undefined;

    const s = this.shot;
    if (s && s.def === a.team) {
      const v = this.ball.velocity;
      if (Math.abs(v.x) > 0.1) {
        const yi = bp.y + (v.y / v.x) * (own - bp.x);
        if (s.outcome === "SAVED") gy = yi;
        else if (s.outcome === "GOAL") gy = yi + (yi > CY ? -4.5 : 4.5); // salah tebak / terlambat
        else gy = yi * 0.6 + CY * 0.4;
      }
      gx = own + d * 1;
      urgent = 1;
    }
    a.setDesired(gx, clamp(gy, CY - GOAL_HALF, CY + GOAL_HALF), urgent);
  }
}
