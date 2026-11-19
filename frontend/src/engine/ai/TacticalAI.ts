import { Vector2D } from "../Vector2D";
import { PlayerAgent } from "./PlayerBehavior";
import { BallPhysics } from "../physics/BallPhysics";
import { AttackSequence } from "@/components/LiveMatchSimulator";

export interface TacticalContext {
  activeSequence: AttackSequence | null;
  sequencePhase: number;
  homeTactic: "DEFENSIVE" | "BALANCED" | "ATTACKING";
  possessionTeam: "HOME" | "AWAY";
  lastPassTimer: number;
}

export class MatchCoordinator {
  public context: TacticalContext;

  constructor() {
    this.context = {
      activeSequence: null,
      sequencePhase: 0,
      homeTactic: "BALANCED",
      possessionTeam: "HOME",
      lastPassTimer: 0,
    };
  }

  public setTactic(tactic: "DEFENSIVE" | "BALANCED" | "ATTACKING") {
    this.context.homeTactic = tactic;
  }

  public triggerSequence(seq: AttackSequence) {
    this.context.activeSequence = seq;
    this.context.sequencePhase = 0;
    this.context.possessionTeam = seq.team;
  }

  /**
   * Mengatur pergerakan kolektif dan alur bola tiap frame
   */
  public update(
    dt: number,
    speedMultiplier: number,
    allAgents: PlayerAgent[],
    ball: BallPhysics,
    onGoalScored?: (seq: AttackSequence) => void
  ) {
    const seq = this.context.activeSequence;

    if (seq) {
      // PROSES ATTACK SEQUENCE TERSINKRONISASI
      this.context.sequencePhase += 0.0075 * speedMultiplier;
      const p = this.context.sequencePhase;

      const buildupAgent = allAgents.find((a) => a.name === seq.buildupPlayer);
      const wingerAgent = allAgents.find((a) => a.name === seq.wingerPlayer);
      const finisherAgent = allAgents.find((a) => a.name === seq.finisherPlayer);
      const defenderAgent = allAgents.find((a) => a.name === seq.defenderPlayer);
      const gkAgent = allAgents.find((a) => a.name === seq.gkPlayer);

      if (p < 0.28) {
        // FASE 1: Buildup di lini tengah
        if (buildupAgent) {
          ball.attachToCarrier(
            buildupAgent.id,
            buildupAgent.name,
            buildupAgent.position,
            buildupAgent.facingAngle
          );
        }
      } else if (p < 0.32) {
        // Transisi Operan dari Buildup ke Winger
        if (wingerAgent && ball.carrierName !== wingerAgent.name) {
          ball.kickPass(wingerAgent.position, 3.2);
        }
      } else if (p < 0.55) {
        // FASE 2: Tusukan Winger di Sayap
        if (wingerAgent) {
          ball.attachToCarrier(
            wingerAgent.id,
            wingerAgent.name,
            wingerAgent.position,
            wingerAgent.facingAngle
          );
        }
        // Jika skenario TACKLED: bek memotong di fase ini
        if (seq.outcome === "TACKLED" && p > 0.48 && defenderAgent) {
          defenderAgent.slideTackleTimer = 0.8;
          ball.deflect(Math.random() * Math.PI * 2, 1.4);
          this.context.activeSequence = null;
          return;
        }
      } else if (p < 0.58) {
        // Transisi Umpan Silang (Lofted Cross) ke Kotak Penalti
        if (finisherAgent && ball.state !== "LOFTED_CROSS") {
          ball.kickLoftedCross(
            new Vector2D(seq.boxCoord.x, seq.boxCoord.y),
            seq.isLoftedCross ? 38 : 10,
            1.2
          );
        }
      } else if (p < 0.82) {
        // FASE 3: Bola melayang di udara, Finisher & Bek saling berebut posisi
        if (finisherAgent) {
          finisherAgent.actionState = "MAKING_RUN";
        }
        if (defenderAgent) {
          defenderAgent.actionState = "BLOCKING";
        }
      } else if (p < 0.86) {
        // Transisi Tembakan ke Gawang
        if (finisherAgent && ball.state !== "SHOOTING") {
          const targetShot = new Vector2D(seq.finishCoord.x, seq.finishCoord.y);
          ball.kickShot(targetShot, 3.8);

          if (seq.outcome === "GOAL") {
            onGoalScored?.(seq);
          } else if (seq.outcome === "BLOCKED" && defenderAgent) {
            defenderAgent.slideTackleTimer = 0.6;
            setTimeout(() => ball.deflect(Math.random() * Math.PI * 2, 1.2), 220);
          } else if (seq.outcome === "SAVED" && gkAgent) {
            gkAgent.actionState = "DIVING";
            setTimeout(() => ball.deflect(Math.PI / 2, 1.6), 280);
          }
        }
      } else if (p >= 1.0) {
        // Sequence selesai
        this.context.activeSequence = null;
      }
    } else {
      // SIRKULASI BOLA ALAMI (OPEN PLAY MIDFIELD CIRULATION)
      this.context.lastPassTimer += dt * speedMultiplier;

      // Setiap 2.5 - 3.5 detik, lakukan operan organik antar rekan setim
      if (this.context.lastPassTimer > 3.0) {
        this.context.lastPassTimer = 0;
        const currentCarrier = allAgents.find((a) => a.id === ball.carrierId);

        if (currentCarrier) {
          // Cari rekan setim terdekat yang bebas
          const teammates = allAgents.filter(
            (a) => a.team === currentCarrier.team && a.id !== currentCarrier.id && a.positionRole !== "GK"
          );
          if (teammates.length > 0) {
            const nextReceiver = teammates[Math.floor(Math.random() * teammates.length)];
            ball.kickPass(nextReceiver.position, 2.0);
          }
        } else if (ball.state === "LOOSE") {
          // Pemain terdekat menjemput bola liar
          let closestPlayer: PlayerAgent | null = null;
          let minDist = 999;
          for (const a of allAgents) {
            const d = a.position.dist(ball.position);
            if (d < minDist) {
              minDist = d;
              closestPlayer = a;
            }
          }
          if (closestPlayer && minDist < 3.5) {
            ball.attachToCarrier(
              closestPlayer.id,
              closestPlayer.name,
              closestPlayer.position,
              closestPlayer.facingAngle
            );
            this.context.possessionTeam = closestPlayer.team;
          }
        }
      }
    }

    // UPDATE SEMUA 22 PEMAIN DENGAN TACTICAL BEHAVIORS
    const isHomeAttacking = this.context.possessionTeam === "HOME";

    for (const agent of allAgents) {
      const isTeamAttacking =
        agent.team === "HOME" ? isHomeAttacking : !isHomeAttacking;

      // Cek apakah pemain merupakan aktor khusus dalam sequence saat ini
      let isActor = false;
      let targetSeqPos: Vector2D | undefined;

      if (seq) {
        if (agent.name === seq.wingerPlayer && this.context.sequencePhase < 0.55) {
          isActor = true;
          targetSeqPos = new Vector2D(seq.wingerCoord.x, seq.wingerCoord.y);
        } else if (agent.name === seq.finisherPlayer && this.context.sequencePhase >= 0.45) {
          isActor = true;
          targetSeqPos = new Vector2D(seq.boxCoord.x, seq.boxCoord.y);
        } else if (agent.name === seq.defenderPlayer && this.context.sequencePhase >= 0.50) {
          isActor = true;
          targetSeqPos = new Vector2D(
            seq.boxCoord.x + (seq.team === "HOME" ? 2 : -2),
            seq.boxCoord.y
          );
        }
      }

      const desiredTarget = agent.computeTacticalTarget(
        ball,
        isTeamAttacking,
        this.context.homeTactic,
        isActor,
        targetSeqPos
      );

      agent.updatePhysics(desiredTarget, allAgents, dt, speedMultiplier);
    }

    // UPDATE FISIKA BOLA
    ball.update(dt, speedMultiplier);
  }
}
