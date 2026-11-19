import { Vector2D } from "../Vector2D";
import { PlayerAgent, Team } from "./PlayerBehavior";
import { BallPhysics } from "../physics/BallPhysics";
import type { AttackSequence, SimulationData, SimulationPlayer } from "@/components/LiveMatchSimulator";

export const PITCH_W = 105;
export const PITCH_H = 68;
const CY = PITCH_H / 2;
const GOAL_HALF = 3.66; // Lebar setengah gawang (7.32m / 2)

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

type Step =
  | "GATHER"
  | "BUILDUP"
  | "WING_WAIT"
  | "WING_RUN"
  | "CROSS_FLIGHT"
  | "SHOT_WAIT"
  | "SHOT"
  | "REBOUND_SCRAMBLE"
  | "REBOUND_SHOT"
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
  reboundAttacker?: PlayerAgent;
  reboundTimer?: number;
}

// Formasi 4-3-3 dasar (dalam meter)
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
 * Mesin Pertandingan Sepak Bola Super Kaya:
 * - Aliran bola dinamis (Umpan 1-2, Terobosan, Umpan Jauh dari Belakang, Crossing, Placing luar kotak)
 * - Sistem Bola Rebound dari Kiper (Penyelamatan kedua / Gol bola muntah)
 * - Aturan resmi: Offside, Sepak Pojok, Penalti, Tendangan Bebas, Lemparan ke Dalam, Tendangan Gawang
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
  public setPieceTimer: number = 0;
  public setPieceTaker: PlayerAgent | null = null;

  private receiver: PlayerAgent | null = null;
  private receiverTimer = 0;
  private decisionTimer = 1.0;
  private time = 0;
  private queue: AttackSequence[] = [];
  private run: SeqRun | null = null;
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

    // Kick-off awal babak
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

  public triggerBanner(badge: string, title: string, subtitle?: string, duration: number = 3.2) {
    this.activeBanner = { badge, title, subtitle, timer: duration };
    if (subtitle) this.onCommentary?.(`${badge} ${title}: ${subtitle}`);
    else this.onCommentary?.(`${badge} ${title}`);
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

    // Update banner timer
    if (this.activeBanner) {
      this.activeBanner.timer -= h;
      if (this.activeBanner.timer <= 0) {
        this.activeBanner = null;
      }
    }

    // Cek apakah sedang dalam kondisi Set Piece (Tendangan bebas, Corner, Penalti, dll)
    if (this.setPieceState !== "NONE") {
      this.stepSetPiece(h);
    } else {
      // Ambil antrean serangan terstruktur jika ada
      if (!this.run && this.queue.length) {
        this.startSequence(this.queue.shift()!);
      }

      if (this.run) {
        this.stepSequence(h);
      } else {
        this.stepOpenPlay(h);
      }

      this.controlBall(h);
      this.checkPitchBoundaries();
    }

    this.assignTargets();
    for (const a of this.agents) a.update(h, this.time, this.agents);
    this.ball.update(h);
  }

  // ---------------------------------------------------------------- BOLA KELUAR / OUT OF BOUNDS
  private checkPitchBoundaries() {
    if (this.setPieceState !== "NONE" || this.run) return;
    const bp = this.ball.position;

    // 1. Lemparan ke dalam (Touchline Out: y < 0 atau y > 68)
    if (bp.y < 0.5 || bp.y > PITCH_H - 0.5) {
      const outTeam = other(this.possession);
      const taker = this.agents
        .filter((a) => a.team === outTeam && a.positionRole !== "GK")
        .sort((a, b) => a.position.dist(bp) - b.position.dist(bp))[0];

      if (taker) {
        const lineY = bp.y < 0.5 ? 0 : PITCH_H;
        this.ball.placeAt(clamp(bp.x, 2, PITCH_W - 2), lineY);
        this.setPieceState = "THROW_IN";
        this.setPieceTaker = taker;
        this.setPieceTimer = 2.4;
        this.triggerBanner("🤾", "LEMPARAN KE DALAM", `${taker.name} bersiap melempar bola ke dalam`, 2.5);
      }
      return;
    }

    // 2. Garis Akhir (Goal Line: x < 0 atau x > 105)
    if (bp.x < 0 || bp.x > PITCH_W) {
      const isLeft = bp.x < 0;
      const defendingTeam: Team = isLeft ? "HOME" : "AWAY";
      const isInsideGoal = bp.y >= CY - GOAL_HALF && bp.y <= CY + GOAL_HALF;

      if (!isInsideGoal) {
        // Tembakan/Pantulan keluar garis gawang
        if (this.possession === defendingTeam) {
          // Sentuhan terakhir tim bertahan -> SEPAK POJOK (CORNER)
          this.awardCorner(other(defendingTeam), isLeft ? 0 : PITCH_W, bp.y < CY ? 0 : PITCH_H);
        } else {
          // Sentuhan terakhir tim penyerang -> TENDANGAN GAWANG (GOAL KICK)
          this.awardGoalKick(defendingTeam);
        }
      }
    }
  }

  // ---------------------------------------------------------------- SET PIECES (ATURAN PERMAINAN)

  public awardCorner(attTeam: Team, cornerX: number, cornerY: number) {
    const taker = this.agents
      .filter((a) => a.team === attTeam && (a.slotCode === "LW" || a.slotCode === "RW" || a.positionRole === "MF"))
      .sort((a, b) => a.position.dist(new Vector2D(cornerX, cornerY)) - b.position.dist(new Vector2D(cornerX, cornerY)))[0];

    this.ball.placeAt(cornerX, cornerY);
    this.setPieceState = "CORNER";
    this.setPieceTaker = taker;
    this.setPieceTimer = 3.0;
    this.possession = attTeam;
    this.triggerBanner("⛳", "SEPAK POJOK!", `Peluang emas tendangan sudut untuk ${attTeam === "HOME" ? "Tim Tuan Rumah" : "Tim Tamu"}`, 3.5);
  }

  public awardPenalty(attTeam: Team) {
    const penaltySpotX = attTeam === "HOME" ? 94 : 11;
    const taker = this.agents.find((a) => a.team === attTeam && a.slotCode === "ST") ?? this.agents[0];

    this.ball.placeAt(penaltySpotX, CY);
    this.setPieceState = "PENALTY";
    this.setPieceTaker = taker;
    this.setPieceTimer = 3.8;
    this.possession = attTeam;
    this.triggerBanner("⚡", "PENALTI!", `Pelanggaran keras di kotak terlarang! ${taker.name} maju sebagai algojo`, 4.0);
  }

  public awardFreeKick(attTeam: Team, foulPos: Vector2D) {
    const taker = this.agents.find((a) => a.team === attTeam && (a.positionRole === "MF" || a.slotCode === "ST")) ?? this.agents[0];

    this.ball.placeAt(foulPos.x, foulPos.y);
    this.setPieceState = "FREE_KICK";
    this.setPieceTaker = taker;
    this.setPieceTimer = 3.2;
    this.possession = attTeam;
    this.triggerBanner("🧱", "TENDANGAN BEBAS!", `Peluang tendangan bebas berbahaya berjarak ${Math.round(foulPos.dist(new Vector2D(attTeam === "HOME" ? PITCH_W : 0, CY)))} meter!`, 3.5);
  }

  public awardOffside(caughtPlayer: PlayerAgent) {
    const defendingTeam = other(caughtPlayer.team);
    const gk = this.agents.find((a) => a.team === defendingTeam && a.positionRole === "GK");

    this.ball.placeAt(caughtPlayer.position.x, caughtPlayer.position.y);
    this.setPieceState = "OFFSIDE";
    this.setPieceTaker = gk || null;
    this.setPieceTimer = 2.8;
    this.possession = defendingTeam;
    this.triggerBanner("🚩", "OFFSIDE!", `Hakim garis mengangkat bendera! ${caughtPlayer.name} berdiri di posisi offside`, 3.0);
  }

  public awardGoalKick(defTeam: Team) {
    const gk = this.agents.find((a) => a.team === defTeam && a.positionRole === "GK");
    const gkBoxX = defTeam === "HOME" ? 5.5 : PITCH_W - 5.5;

    this.ball.placeAt(gkBoxX, CY);
    this.setPieceState = "GOAL_KICK";
    this.setPieceTaker = gk || null;
    this.setPieceTimer = 2.5;
    this.possession = defTeam;
    this.triggerBanner("🧤", "TENDANGAN GAWANG", `Kiper ${gk?.name || "Kiper"} bersiap melakukan tendangan gawang`, 2.5);
  }

  private stepSetPiece(h: number) {
    this.setPieceTimer -= h;
    const taker = this.setPieceTaker;
    const bp = this.ball.position;

    if (taker) {
      taker.setDesired(bp.x, bp.y, 0.85);
    }

    if (this.setPieceTimer <= 0) {
      // Eksekusi Set Piece setelah countdown selesai
      const sp = this.setPieceState;
      this.setPieceState = "NONE";
      this.setPieceTaker = null;

      if (!taker) return;

      if (sp === "CORNER") {
        // Umpan silang melambung dari sudut ke kotak penalti
        const d = dirOf(taker.team);
        const targetBox = new Vector2D(
          taker.team === "HOME" ? PITCH_W - 8 : 8,
          CY + (Math.random() * 8 - 4)
        );
        this.ball.cross(targetBox, 1.3, 6.5);
        this.onCommentary?.(`⛳ ${taker.name} melepas tendangan sudut melengkung ke jantung pertahanan!`);

        // Siapkan penyerang untuk duel sundulan
        const headerAttacker = this.agents.find((a) => a.team === taker.team && (a.slotCode === "ST" || a.positionRole === "DF"));
        if (headerAttacker) {
          this.receiver = headerAttacker;
          this.receiverTimer = 3.5;
        }
      } else if (sp === "PENALTY") {
        // Eksekusi tendangan penalti
        const targetGoalX = taker.team === "HOME" ? PITCH_W : 0;
        const targetY = CY + (Math.random() < 0.5 ? -2.2 : 2.2);
        const isGoal = Math.random() < 0.76;

        this.onCommentary?.(`⚡ ${taker.name} mengambil ancang-ancang... MENEMBAK KERAS!`);
        this.ball.shoot(new Vector2D(targetGoalX, targetY), 32);

        if (isGoal) {
          setTimeout(() => {
            this.triggerBanner("⚽", "GOL PENALTI!", `Dingin! Eksekusi penalti sempurna dari ${taker.name}!`, 3.5);
            this.scoreSyntheticGoal(taker);
          }, 450);
        } else {
          setTimeout(() => {
            this.triggerBanner("🧤", "PENALTI DITEPIZ!", `PENYELAMATAN FANTASTIS! Kiper berhasil membaca arah tembakan penalti!`, 3.5);
            this.ball.deflect(taker.team === "HOME" ? Math.PI : 0, 7.5);
          }, 420);
        }
      } else if (sp === "FREE_KICK") {
        // Eksekusi tendangan bebas langsung atau umpan
        const goalPos = new Vector2D(taker.team === "HOME" ? PITCH_W : 0, CY);
        const dist = bp.dist(goalPos);

        if (dist < 28 && Math.random() < 0.65) {
          // Tembakan langsung melewati pagar betis
          this.ball.cross(new Vector2D(goalPos.x, CY + (Math.random() * 5 - 2.5)), 1.1, 4.2);
          this.onCommentary?.(`🧱 ${taker.name} mengeksekusi tendangan bebas melewati pagar betis!`);
        } else {
          // Umpan terobosan / crossing
          this.ball.cross(new Vector2D(goalPos.x - dirOf(taker.team) * 8, CY), 1.2, 5.0);
          this.onCommentary?.(`🧱 ${taker.name} mengangkat bola ke dalam kotak penalti!`);
        }
      } else if (sp === "THROW_IN") {
        // Lempar ke rekan terdekat
        const teammate = this.agents
          .filter((a) => a.team === taker.team && a !== taker)
          .sort((a, b) => a.position.dist(taker.position) - b.position.dist(taker.position))[0];

        if (teammate) {
          this.sendPass(teammate, 12);
          this.onCommentary?.(`🤾 ${taker.name} melempar bola ke ${teammate.name}.`);
        } else {
          this.take(taker);
        }
      } else if (sp === "GOAL_KICK" || sp === "OFFSIDE") {
        // Kiper/bek menendang jauh ke lini tengah atau umpan pendek
        if (Math.random() < 0.6) {
          const midPos = new Vector2D(PITCH_W / 2 + dirOf(taker.team) * 5, CY + (Math.random() * 20 - 10));
          this.ball.cross(midPos, 1.6, 7.5);
          this.onCommentary?.(`🚀 Tendangan lambung jauh dilepas mengarah ke lini tengah.`);
        } else {
          const cb = this.agents.find((a) => a.team === taker.team && a.slotCode === "LCB") || taker;
          this.sendPass(cb, 14);
        }
      }
    }
  }

  // ---------------------------------------------------------------- KEPEMILIKAN BOLA & KONTROL

  private take(a: PlayerAgent) {
    this.ball.setCarrier(a);
    this.receiver = null;
    this.possession = a.team;
    this.decisionTimer = 0.8 + Math.random() * 1.0;
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
      if (r.position.dist(ball.position) < 1.6 && ball.z < 1.8 && ball.mode !== "CROSS") {
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

  // ---------------------------------------------------------------- PERMAINAN TERBUKA KAYA & DINAMIS

  private stepOpenPlay(h: number) {
    const c = this.carrier;
    if (!c) return;
    this.possession = c.team;

    // Tekel / Rebut bola dari lawan dengan probabilitas pelanggaran
    for (const o of this.agents) {
      if (o.team === c.team || o.positionRole === "GK") continue;
      if (o.position.dist(c.position) < 1.8) {
        const stealChance = (0.12 + 0.25 * o.aggression) * h;
        if (Math.random() < stealChance) {
          // Kemungkinan pelanggaran (Foul) 18%
          if (Math.random() < 0.18) {
            this.handleFoul(c, o);
            return;
          }
          this.take(o);
          return;
        }
      }
    }

    this.decisionTimer -= h;
    if (this.decisionTimer <= 0) {
      this.doRichTacticalDecision(c);
    }
  }

  private handleFoul(victim: PlayerAgent, perpetrator: PlayerAgent) {
    const foulPos = victim.position.clone();
    const isInsideBox =
      victim.team === "HOME"
        ? foulPos.x > 88.5 && foulPos.y > 13.8 && foulPos.y < 54.2
        : foulPos.x < 16.5 && foulPos.y > 13.8 && foulPos.y < 54.2;

    if (isInsideBox) {
      this.awardPenalty(victim.team);
    } else {
      this.awardFreeKick(victim.team, foulPos);
    }
  }

  /**
   * Pengambilan Keputusan Taktis Tingkat Lanjut:
   * 1. Umpan Lambung dari Belakang langsung ke Depan (Long Ball)
   * 2. Tusukan Sayap & Crossing Melambung
   * 3. Umpan Terobosan Membelah Pertahanan (Through Ball)
   * 4. Tembakan Spekulasi Jarak Jauh (Long Shot)
   * 5. Umpan Tiki-Taka 1-2
   */
  private doRichTacticalDecision(c: PlayerAgent) {
    const d = dirOf(c.team);
    const depth = c.team === "HOME" ? c.position.x : PITCH_W - c.position.x;
    const goalX = c.team === "HOME" ? PITCH_W : 0;
    const distToGoal = c.position.dist(new Vector2D(goalX, CY));

    // A. PELUANG 1: Tembakan Jarak Jauh (Long Shot) jika di depan kotak penalti (< 26m)
    if (distToGoal < 26 && distToGoal > 14 && (c.positionRole === "MF" || c.positionRole === "FW")) {
      const shotRoll = Math.random();
      const shotThreshold = this.tactic === "ATTACKING" ? 0.38 : 0.22;

      if (shotRoll < shotThreshold) {
        this.triggerBanner("🚀", "TEMBAKAN KERAS JARAK JAUH!", `${c.name} melepaskan sepakan geledek spekulasi dari luar kotak penalti!`, 2.5);
        const targetY = CY + (Math.random() * 6 - 3);
        this.ball.shoot(new Vector2D(goalX, targetY), 30);
        this.decisionTimer = 2.0;

        // Simulasi tepisan kiper menghasilkan REBOUND
        setTimeout(() => {
          if (Math.random() < 0.65) {
            this.ball.deflect(c.team === "HOME" ? Math.PI : 0, 7.0);
            this.triggerBanner("🧤", "TEPISAN REBOUND!", `Kiper menepis tembakan deras! Bola muntah bergulir liar di kotak penalti!`, 3.0);
            this.scrambleRebound(c.team);
          }
        }, 320);
        return;
      }
    }

    // B. PELUANG 2: Tusukan Sayap & Crossing Melambung (Wing Cross)
    const isFlank = c.position.y < 16 || c.position.y > PITCH_H - 16;
    if (isFlank && depth > 68) {
      const crossRoll = Math.random();
      if (crossRoll < 0.68) {
        const boxX = c.team === "HOME" ? PITCH_W - 9 : 9;
        const boxY = CY + (Math.random() * 10 - 5);
        this.triggerBanner("⚡", "UMPAN SILANG KE KOTAK PENALTI!", `${c.name} menusuk dari sayap dan melepas umpan silang akurat!`, 2.5);
        this.ball.cross(new Vector2D(boxX, boxY), 1.25, 5.8);

        const striker = this.agents.find((a) => a.team === c.team && a.slotCode === "ST");
        if (striker) {
          this.receiver = striker;
          this.receiverTimer = 3.5;
        }
        this.decisionTimer = 1.8;
        return;
      }
    }

    // C. PELUANG 3: Umpan Lambung Jauh dari Lini Belakang langsung ke Depan (Long Ball)
    if (depth < 42 && (c.positionRole === "DF" || c.slotCode === "CM")) {
      const longBallRoll = Math.random();
      const longBallThreshold = this.tactic === "ATTACKING" ? 0.35 : 0.18;

      if (longBallRoll < longBallThreshold) {
        const targetFwd = this.agents.find((a) => a.team === c.team && a.positionRole === "FW");
        if (targetFwd) {
          this.triggerBanner("🚀", "SERANGAN BALIK KILAT!", `${c.name} mengirim umpan lambung melengkung jauh langsung ke garis depan!`, 2.5);
          const targetLanding = targetFwd.position.clone().add(new Vector2D(d * 12, 0));
          this.ball.cross(targetLanding, 1.5, 7.2);
          this.receiver = targetFwd;
          this.receiverTimer = 4.0;
          this.decisionTimer = 1.6;
          return;
        }
      }
    }

    // D. PELUANG 4: Umpan Terobosan / Through Ball Membelah Bek
    if (depth > 50 && depth < 82 && (c.positionRole === "MF" || c.positionRole === "FW")) {
      const forwardTarget = this.agents
        .filter((a) => a.team === c.team && a !== c && a.positionRole === "FW")
        .sort((a, b) => (b.position.x - a.position.x) * d)[0];

      if (forwardTarget && Math.random() < 0.42) {
        // Cek apakah pemain berada di posisi offside saat umpan dilepas!
        if (this.checkIsOffside(forwardTarget)) {
          this.awardOffside(forwardTarget);
          return;
        }

        const throughPoint = forwardTarget.position.clone().add(new Vector2D(d * 10, 0));
        this.triggerBanner("🎯", "UMPAN TEROBOSAN!", `${c.name} melepaskan umpan terobosan manis membelah celah pertahanan!`, 2.0);
        this.sendPass(forwardTarget, 23);
        this.decisionTimer = 1.2;
        return;
      }
    }

    // E. Default: Operan Reguler Kombinasi Tiki-Taka / Cari Kawan Kosong
    this.doNormalPass(c);
  }

  private checkIsOffside(attacker: PlayerAgent): boolean {
    const oppTeam = other(attacker.team);
    const d = dirOf(attacker.team);

    // Ambil semua pemain bertahan lawan (kecuali kiper)
    const oppDefenders = this.agents
      .filter((a) => a.team === oppTeam && a.positionRole !== "GK")
      .sort((a, b) => (d > 0 ? b.position.x - a.position.x : a.position.x - b.position.x));

    if (oppDefenders.length < 2) return false;
    const lastDefenderX = oppDefenders[0].position.x;

    // Offside jika striker lebih maju dari bek terakhir di area pertahanan lawan
    if (d > 0) {
      return attacker.position.x > lastDefenderX && attacker.position.x > PITCH_W / 2;
    } else {
      return attacker.position.x < lastDefenderX && attacker.position.x < PITCH_W / 2;
    }
  }

  private doNormalPass(c: PlayerAgent) {
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

      const fwd = (t.position.x - c.position.x) * d;
      let score = fwd * 0.7 + nearestOpp * 1.4 - dist * 0.08 + Math.random() * 5;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }

    if (!best) {
      this.decisionTimer = 0.5;
      return;
    }
    this.sendPass(best, clamp(15 + c.position.dist(best.position) * 0.5, 15, 27));
  }

  // ---------------------------------------------------------------- SISTEM BOLA REBOUND KIPER
  private scrambleRebound(attackingTeam: Team) {
    const ballPos = this.ball.position;
    // Cari penyerang dan bek terdekat dengan bola muntah
    const attackers = this.agents
      .filter((a) => a.team === attackingTeam && a.positionRole !== "GK")
      .sort((a, b) => a.position.dist(ballPos) - b.position.dist(ballPos));

    const striker = attackers[0];
    if (!striker) return;

    this.receiver = striker;
    this.receiverTimer = 2.4;

    setTimeout(() => {
      if (this.ball.position.dist(striker.position) < 4.0) {
        // Penyerang berhasil menyambar bola rebound!
        const goalX = attackingTeam === "HOME" ? PITCH_W : 0;
        this.triggerBanner("💥", "SAMBARAN BOLA REBOUND!", `${striker.name} menyambar bola muntah di muka gawang!`, 2.5);

        const reboundOutcome = Math.random();
        if (reboundOutcome < 0.55) {
          // GOL REBOUND!
          this.ball.shoot(new Vector2D(goalX, CY + (Math.random() * 4 - 2)), 32);
          setTimeout(() => {
            this.triggerBanner("⚽", "GOOOOL REBOUND!", `GOL! Sambaran kilat ${striker.name} merobek jala gawang!`, 3.5);
            this.scoreSyntheticGoal(striker);
          }, 320);
        } else if (reboundOutcome < 0.85) {
          // DOUBLE SAVE KIPER!
          this.ball.deflect(attackingTeam === "HOME" ? Math.PI : 0, 7.5);
          this.triggerBanner("🧤", "HEROIC DOUBLE SAVE!", `LUAR BIASA! Kiper bangkit dan melakukan penyelamatan ganda super dramatis!`, 3.5);
        } else {
          // Blok garis gawang bek
          this.ball.deflect(Math.random() * Math.PI * 2, 8.0);
          this.triggerBanner("🛡️", "BLOK GARIS GAWANG!", `Heroik! Bek lawan menyapu bola tepat di atas garis gawang!`, 3.0);
        }
      }
    }, 850);
  }

  private scoreSyntheticGoal(scorer: PlayerAgent) {
    const dummySeq: AttackSequence = {
      id: `synthetic-${Date.now()}`,
      minute: 0,
      team: scorer.team,
      buildupPlayer: scorer.name,
      wingerPlayer: scorer.name,
      finisherPlayer: scorer.name,
      defenderPlayer: "Defender",
      gkPlayer: "Goalkeeper",
      outcome: "GOAL",
      description: `GOOOOL! Gol brilian dicetak oleh ${scorer.name}!`,
      isLoftedCross: false,
      startCoord: { x: 50, y: 50 },
      wingerCoord: { x: 50, y: 50 },
      boxCoord: { x: 50, y: 50 },
      finishCoord: { x: scorer.team === "HOME" ? 98 : 2, y: 50 },
    };
    this.scoreGoal(dummySeq);
  }

  // ---------------------------------------------------------------- SKENARIO SERANGAN TERSTRUKTUR

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
            this.triggerBanner("🛡️", "TEKEL BERSIH!", `${r.d.name} meluncur menghentikan tusukan ${r.w.name}`, 2.5);
            this.sendPass(r.d, 10);
            this.next(r, "AFTER");
          }
        } else if (r.w.position.dist(r.wingerPos) < 3.2 || r.t > 3.5) {
          this.triggerBanner("⚡", "UMPAN SILANG AKURAT!", `${r.w.name} melepas umpan silang melambung ke kotak penalti!`, 2.5);
          ball.cross(r.boxPos, 1.18, 5.6);
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
      case "REBOUND_SCRAMBLE":
        this.stepReboundScramble(r, h);
        break;
      case "AFTER":
        if (r.t > 1.4) this.run = null;
        break;
    }
  }

  private fireShot(r: SeqRun) {
    const oc = r.seq.outcome;
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

    this.ball.shoot(far, oc === "BLOCKED" ? 25 : 32);
    r.shotStart = start;
    this.next(r, "SHOT");
  }

  private stepShot(r: SeqRun) {
    const ball = this.ball;
    const pos = ball.position;
    const dd = dirOf(r.att);
    const gx = r.att === "HOME" ? PITCH_W : 0;
    const toLine = Math.abs(gx - pos.x);
    const back = dd > 0 ? Math.PI : 0;
    const spread = (s: number) => back + (Math.random() - 0.5) * s;

    if (r.t > 4) {
      this.next(r, "AFTER");
      return;
    }

    switch (r.seq.outcome) {
      case "BLOCKED":
        if (pos.dist(r.shotStart) > 3) {
          this.triggerBanner("🛡️", "PELUANG DIBLOK!", `${r.d.name} meluncur melakukan blok krusial!`, 2.5);
          ball.deflect(spread(1.8), 9);
          this.next(r, "AFTER");
        }
        break;
      case "SAVED":
        if (toLine < 2.5) {
          // BOLA DITEPIS -> MASUK KE FASE REBOUND SCRAMBLE!
          this.triggerBanner("🧤", "PENYELAMATAN HEBAT!", `${r.gk.name} sigap menepis sepakan keras ${r.f.name}! Bola muntah di kotak penalti!`, 3.0);
          ball.deflect(spread(1.6), 8);
          r.reboundAttacker = r.f;
          r.reboundTimer = 2.5;
          this.next(r, "REBOUND_SCRAMBLE");
        }
        break;
      case "POST":
        if (toLine < 0.8) {
          this.triggerBanner("💥", "MENGHANTAM TIANG!", `DENTUMAN KERAS! Tendangan ${r.f.name} membentur mistar gawang!`, 3.0);
          ball.deflect(spread(1.0), 10);
          this.next(r, "AFTER");
        }
        break;
      case "GOAL":
        if ((dd > 0 && pos.x > PITCH_W + 0.3) || (dd < 0 && pos.x < -0.3)) {
          this.scoreGoal(r.seq);
        }
        break;
      default: // WIDE
        if ((dd > 0 && pos.x > PITCH_W + 1) || (dd < 0 && pos.x < -1)) {
          this.triggerBanner("💨", "TEMBAKAN MELENCENG!", `Sepakan keras ${r.f.name} melambung tipis dari gawang`, 2.5);
          this.awardGoalKick(r.def);
          this.next(r, "AFTER");
        }
    }
  }

  // FASE REBOUND: Perebutan bola muntah di kotak penalti
  private stepReboundScramble(r: SeqRun, h: number) {
    if (!r.reboundTimer) r.reboundTimer = 2.5;
    r.reboundTimer -= h;

    const ball = this.ball;
    const f = r.f;
    const d = r.d;
    const gk = r.gk;

    f.setDesired(ball.position.x, ball.position.y, 1.0);
    d.setDesired(ball.position.x, ball.position.y, 0.95);
    gk.setDesired(ball.position.x, ball.position.y, 0.7);

    if (f.position.dist(ball.position) < 2.0 && r.t > 0.6) {
      // Striker mencapai bola rebound untuk tembakan kedua!
      const goalX = r.att === "HOME" ? PITCH_W : 0;
      this.triggerBanner("💥", "TEMBAKAN REBOUND KEDUA!", `${f.name} menyambar bola muntah!`, 2.5);

      const roll = Math.random();
      if (roll < 0.45) {
        // GOL DARI BOLA REBOUND!
        ball.shoot(new Vector2D(goalX, CY + (Math.random() * 4 - 2)), 30);
        setTimeout(() => {
          this.triggerBanner("⚽", "GOL REBOUND!", `GOL! Sambaran kilat ${f.name} merobek gawang!`, 3.5);
          this.scoreGoal(r.seq);
        }, 320);
      } else {
        // DOUBLE SAVE HEROIK DARI KIPER!
        ball.deflect(r.att === "HOME" ? Math.PI : 0, 8);
        this.triggerBanner("🧤", "DOUBLE SAVE SENSASIONAL!", `KIPER TERBANG! ${gk.name} menepis sambaran rebound secara ajaib!`, 3.5);
      }
      this.next(r, "AFTER");
    } else if (r.reboundTimer <= 0) {
      this.next(r, "AFTER");
    }
  }

  private scoreGoal(seq: AttackSequence) {
    this.onGoal?.(seq);
    const conceding = other(seq.team);
    const taker =
      this.agents.find((a) => a.team === conceding && a.slotCode === "CM") ??
      this.agents.find((a) => a.team === conceding && a.positionRole === "MF") ??
      this.agents[0];

    this.ball.placeAt(PITCH_W / 2, CY);
    this.receiver = null;
    this.run = null;
    this.possession = conceding;
    this.setPieceState = "KICK_OFF";
    this.setPieceTaker = taker;
    this.setPieceTimer = 3.2;
    this.triggerBanner("⚽", "GOOOOL!", `Gol spektakuler untuk ${seq.team === "HOME" ? "Tim Tuan Rumah" : "Tim Tamu"}! Kick-off tengah lapangan`, 4.0);
  }

  // ---------------------------------------------------------------- TARGET TAKTIS SELURUH PEMAIN

  private assignTargets() {
    const ball = this.ball;
    const bp = ball.position;
    const teams: Team[] = ["HOME", "AWAY"];

    // 1. Pemain Penekan (Pressing)
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

    // 2. Posisi dasar & penyesuaian taktik
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

    // 3. Pressing & Cover
    for (const team of teams) {
      const p = press[team];
      if (p) {
        const c = this.carrier && this.carrier.team !== team ? this.carrier : null;
        const tx = c ? c.position.x + c.velocity.x * 0.4 : bp.x + ball.velocity.x * 0.2;
        const ty = c ? c.position.y + c.velocity.y * 0.4 : bp.y + ball.velocity.y * 0.2;
        p.setDesired(tx, ty, 1);
      }
      const cv = cover[team];
      if (cv) {
        const own = team === "HOME" ? 0 : PITCH_W;
        cv.setDesired(bp.x + (own - bp.x) * 0.3, bp.y + (CY - bp.y) * 0.2, 0.8);
      }
    }

    // 4. Pembawa bola menggiring maju
    const c = this.carrier;
    if (c) {
      if (c.positionRole === "GK") {
        c.setDesired(c.position.x, c.position.y, 0.2);
      } else {
        const d = dirOf(c.team);
        const depth = c.team === "HOME" ? c.position.x : PITCH_W - c.position.x;
        const tx = depth > 82 ? c.position.x : c.position.x + d * 10;
        c.setDesired(tx, c.position.y + (CY - c.position.y) * 0.25, 0.6);
      }
    }

    this.applySequenceTargets();

    // 5. Penerima operan mengejar bola
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
      case "SHOT":
        r.d.setDesired(r.shotStart.x + dd * 2.5, r.shotStart.y + (CY - r.shotStart.y) * 0.4, 1);
        break;
      case "REBOUND_SCRAMBLE":
        r.f.setDesired(this.ball.position.x, this.ball.position.y, 1.0);
        r.d.setDesired(this.ball.position.x, this.ball.position.y, 0.9);
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
        else if (r.seq.outcome === "GOAL") gy = yi + (yi > CY ? -4.5 : 4.5);
        else gy = yi * 0.6 + CY * 0.4;
      }
      gx = own + d * 1;
      urgent = 1;
    }
    a.setDesired(gx, clamp(gy, CY - GOAL_HALF, CY + GOAL_HALF), urgent);
  }
}
