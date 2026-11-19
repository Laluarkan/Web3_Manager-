"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  FastForward,
  Trophy,
  Flame,
  Shield,
  Activity,
  AlertTriangle,
} from "lucide-react";

export interface SimulationPlayer {
  id: number;
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  slotCode: string;
  number: number;
  baseOverall: number;
}

export interface AttackSequence {
  id: string;
  minute: number;
  team: "HOME" | "AWAY";
  buildupPlayer: string;
  wingerPlayer: string;
  finisherPlayer: string;
  defenderPlayer: string;
  gkPlayer: string;
  outcome: "GOAL" | "SAVED" | "BLOCKED" | "WIDE" | "POST" | "TACKLED";
  description: string;
  isLoftedCross: boolean;
  startCoord: { x: number; y: number };
  wingerCoord: { x: number; y: number };
  boxCoord: { x: number; y: number };
  finishCoord: { x: number; y: number };
}

export interface MatchEvent {
  id: string;
  minute: number;
  type:
    | "KICK_OFF"
    | "PASS"
    | "DRIBBLE"
    | "CHANCE"
    | "SHOT"
    | "GOAL"
    | "SAVE"
    | "FOUL"
    | "YELLOW_CARD"
    | "CORNER"
    | "HALF_TIME"
    | "FULL_TIME";
  team: "HOME" | "AWAY";
  player: string;
  targetPlayer?: string;
  description: string;
  ballCoord: { x: number; y: number };
}

export interface SimulationData {
  homeTeamName: string;
  awayTeamName: string;
  homePlayers: SimulationPlayer[];
  awayPlayers: SimulationPlayer[];
  events: MatchEvent[];
  sequences?: AttackSequence[];
  stats: {
    shots: { home: number; away: number };
    shotsOnTarget: { home: number; away: number };
    fouls: { home: number; away: number };
    yellowCards: { home: number; away: number };
    corners: { home: number; away: number };
    possession: { home: number; away: number };
  };
}

interface LiveMatchSimulatorProps {
  simulation: SimulationData;
  earnedPoints: number;
  onFinish: () => void;
}

// Koordinat formasi dasar 4-3-3 (0 - 100% dimensi lapangan)
const FORMATION_HOME: Record<string, { x: number; y: number }> = {
  GK: { x: 7, y: 50 },
  LB: { x: 24, y: 18 },
  LCB: { x: 19, y: 38 },
  RCB: { x: 19, y: 62 },
  RB: { x: 24, y: 82 },
  LCM: { x: 42, y: 32 },
  CM: { x: 38, y: 50 },
  RCM: { x: 42, y: 68 },
  LW: { x: 68, y: 22 },
  ST: { x: 75, y: 50 },
  RW: { x: 68, y: 78 },
};

const FORMATION_AWAY: Record<string, { x: number; y: number }> = {
  GK: { x: 93, y: 50 },
  RB: { x: 76, y: 18 },
  RCB: { x: 81, y: 38 },
  LCB: { x: 81, y: 62 },
  LB: { x: 76, y: 82 },
  RCM: { x: 58, y: 32 },
  CM: { x: 62, y: 50 },
  LCM: { x: 58, y: 68 },
  RW: { x: 32, y: 22 },
  ST: { x: 25, y: 50 },
  LW: { x: 32, y: 78 },
};

interface AgentPlayer {
  id: number;
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  slotCode: string;
  number: number;
  team: "HOME" | "AWAY";
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  maxSpeed: number;
  wanderAngle: number;
  wanderSpeed: number;
}

export function LiveMatchSimulator({
  simulation,
  earnedPoints,
  onFinish,
}: LiveMatchSimulatorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Match State
  const [currentMinute, setCurrentMinute] = useState(1);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [activeTactic, setActiveTactic] = useState<"DEFENSIVE" | "BALANCED" | "ATTACKING">("BALANCED");
  const [currentCommentary, setCurrentCommentary] = useState<string>(
    simulation.events[0]?.description || "Wasit memulai babak pertama!"
  );
  const [commentaryHistory, setCommentaryHistory] = useState<Array<{ minute: number; text: string }>>([
    { minute: 1, text: simulation.events[0]?.description || "Pertandingan dimulai!" },
  ]);
  const [goalCelebration, setGoalCelebration] = useState<{
    player: string;
    team: string;
    minute: number;
  } | null>(null);
  const [isMatchFinished, setIsMatchFinished] = useState(false);

  // Ball with 3D elevation (z height)
  const ballPhysicsRef = useRef<{
    x: number;
    y: number;
    z: number; // Ketinggian bola untuk efek 3D parabola
    targetX: number;
    targetY: number;
    targetZ: number;
    carrierName: string | null;
    isLofted: boolean;
  }>({
    x: 50,
    y: 50,
    z: 0,
    targetX: 50,
    targetY: 50,
    targetZ: 0,
    carrierName: simulation.homePlayers.find((p) => p.slotCode === "ST")?.name || null,
    isLofted: false,
  });

  // Active play sequence state
  const activeSequenceRef = useRef<{
    seq: AttackSequence;
    phase: number; // 0.0 to 1.0 progression of sequence
  } | null>(null);

  // Autonomous agents with Craig Reynolds Steering Behaviors
  const agentsRef = useRef<AgentPlayer[]>([]);

  // Initialize individual agents
  useEffect(() => {
    const list: AgentPlayer[] = [];

    simulation.homePlayers.forEach((p, idx) => {
      const anchor = FORMATION_HOME[p.slotCode] || { x: 25, y: 50 };
      list.push({
        id: p.id,
        name: p.name,
        position: p.position,
        slotCode: p.slotCode,
        number: p.number || idx + 1,
        team: "HOME",
        x: anchor.x,
        y: anchor.y,
        vx: 0,
        vy: 0,
        targetX: anchor.x,
        targetY: anchor.y,
        maxSpeed: 0.95 + Math.random() * 0.35,
        wanderAngle: Math.random() * Math.PI * 2,
        wanderSpeed: 0.03 + Math.random() * 0.02,
      });
    });

    simulation.awayPlayers.forEach((p, idx) => {
      const anchor = FORMATION_AWAY[p.slotCode] || { x: 75, y: 50 };
      list.push({
        id: p.id,
        name: p.name,
        position: p.position,
        slotCode: p.slotCode,
        number: p.number || idx + 1,
        team: "AWAY",
        x: anchor.x,
        y: anchor.y,
        vx: 0,
        vy: 0,
        targetX: anchor.x,
        targetY: anchor.y,
        maxSpeed: 0.95 + Math.random() * 0.35,
        wanderAngle: Math.random() * Math.PI * 2,
        wanderSpeed: 0.03 + Math.random() * 0.02,
      });
    });

    agentsRef.current = list;
  }, [simulation]);

  const minuteRef = useRef(1);

  // Time loop (10 minutes real time default at 1x speed)
  useEffect(() => {
    if (isPaused || isMatchFinished) return;

    const intervalTimeMs = Math.max(25, Math.round(6666 / speedMultiplier));

    const timer = setInterval(() => {
      minuteRef.current += 1;
      const m = minuteRef.current;
      setCurrentMinute(m);

      // 1. Cek apakah di menit ini ada Attack Sequence
      const seq = simulation.sequences?.find((s) => s.minute === m);
      if (seq) {
        activeSequenceRef.current = { seq, phase: 0 };
        setCurrentCommentary(seq.description);
        setCommentaryHistory((prev) => [{ minute: m, text: seq.description }, ...prev].slice(0, 15));

        if (seq.outcome === "GOAL") {
          setTimeout(() => {
            if (seq.team === "HOME") setHomeScore((s) => s + 1);
            else setAwayScore((s) => s + 1);

            setGoalCelebration({
              player: seq.finisherPlayer,
              team: seq.team === "HOME" ? simulation.homeTeamName : simulation.awayTeamName,
              minute: seq.minute,
            });
            setTimeout(() => setGoalCelebration(null), 3800);
          }, 1800);
        }
      } else {
        // Cek event umum jika bukan sequence
        const ev = simulation.events.find((e) => e.minute === m);
        if (ev) {
          setCurrentCommentary(ev.description);
          setCommentaryHistory((prev) => [{ minute: m, text: ev.description }, ...prev].slice(0, 15));
        }
      }

      if (m >= 90) {
        clearInterval(timer);
        setIsMatchFinished(true);
      }
    }, intervalTimeMs);

    return () => clearInterval(timer);
  }, [isPaused, isMatchFinished, speedMultiplier, simulation]);

  const handleSkipToEnd = () => {
    let h = 0;
    let a = 0;
    simulation.events.forEach((ev) => {
      if (ev.type === "GOAL") {
        if (ev.team === "HOME") h++;
        else a++;
      }
    });
    setHomeScore(h);
    setAwayScore(a);
    setCurrentMinute(90);
    setIsMatchFinished(true);
  };

  // Canvas 60 FPS Render Loop: Steering Behaviors + 3D Ball Parabola + Sequence Execution
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const pad = 24;
      const pitchW = width - pad * 2;
      const pitchH = height - pad * 2;

      // 1. Draw Green Pitch Grass with Alternate Stripes
      ctx.fillStyle = "#1b4d24";
      ctx.fillRect(0, 0, width, height);

      const stripes = 11;
      const stripeW = width / stripes;
      for (let i = 0; i < stripes; i++) {
        if (i % 2 === 0) {
          ctx.fillStyle = "#1e5729";
          ctx.fillRect(i * stripeW, 0, stripeW, height);
        }
      }

      // 2. White Pitch Markings
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 2.5;

      ctx.strokeRect(pad, pad, pitchW, pitchH);

      // Halfway line & Center Circle
      const midX = width / 2;
      const midY = height / 2;
      ctx.beginPath();
      ctx.moveTo(midX, pad);
      ctx.lineTo(midX, height - pad);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(midX, midY, height * 0.15, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(midX, midY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Left Penalty Box & Goal
      const boxW = width * 0.16;
      const boxH = height * 0.54;
      ctx.strokeRect(pad, (height - boxH) / 2, boxW, boxH);

      const smallBoxW = width * 0.06;
      const smallBoxH = height * 0.28;
      ctx.strokeRect(pad, (height - smallBoxH) / 2, smallBoxW, smallBoxH);

      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(pad - 12, (height - smallBoxH) / 2, 12, smallBoxH);
      ctx.strokeRect(pad - 12, (height - smallBoxH) / 2, 12, smallBoxH);

      // Right Penalty Box & Goal
      ctx.strokeRect(width - pad - boxW, (height - boxH) / 2, boxW, boxH);
      ctx.strokeRect(width - pad - smallBoxW, (height - smallBoxH) / 2, smallBoxW, smallBoxH);

      ctx.fillRect(width - pad, (height - smallBoxH) / 2, 12, smallBoxH);
      ctx.strokeRect(width - pad, (height - smallBoxH) / 2, 12, smallBoxH);

      // 3. Play Sequence Execution & Dynamic Ball Interpolation
      const ball = ballPhysicsRef.current;
      const currentSeq = activeSequenceRef.current;
      const actors = agentsRef.current;

      if (currentSeq) {
        currentSeq.phase += 0.006 * speedMultiplier;
        const p = currentSeq.phase;
        const s = currentSeq.seq;

        if (p < 0.28) {
          // Fase 1: Buildup passing di lini tengah
          ball.carrierName = s.buildupPlayer;
          ball.isLofted = false;
          ball.targetX = s.startCoord.x;
          ball.targetY = s.startCoord.y;
          ball.targetZ = 0;
        } else if (p < 0.55) {
          // Fase 2: Tusukan ke sayap
          ball.carrierName = s.wingerPlayer;
          ball.isLofted = false;
          ball.targetX = s.wingerCoord.x;
          ball.targetY = s.wingerCoord.y;
          ball.targetZ = 0;
        } else if (p < 0.82) {
          // Fase 3: Umpan Silang Melambung (3D Parabola Arc)
          ball.carrierName = null;
          ball.isLofted = true;
          const crossT = (p - 0.55) / 0.27; // 0 to 1
          ball.targetX = s.wingerCoord.x + (s.boxCoord.x - s.wingerCoord.x) * crossT;
          ball.targetY = s.wingerCoord.y + (s.boxCoord.y - s.wingerCoord.y) * crossT;
          // Ketinggian parabola 3D: puncak setinggi 42px di tengah-tengah
          ball.targetZ = Math.sin(crossT * Math.PI) * 42;
        } else if (p <= 1.0) {
          // Fase 4: Eksekusi Tembakan ke Gawang
          ball.carrierName = s.finisherPlayer;
          ball.isLofted = false;
          const shotT = (p - 0.82) / 0.18;
          ball.targetX = s.boxCoord.x + (s.finishCoord.x - s.boxCoord.x) * shotT;
          ball.targetY = s.boxCoord.y + (s.finishCoord.y - s.boxCoord.y) * shotT;
          ball.targetZ = Math.sin(shotT * Math.PI) * 8;
        } else {
          // Selesai sequence
          activeSequenceRef.current = null;
          ball.targetZ = 0;
        }
      } else {
        // Natural midfield roaming when no attack sequence
        ball.targetZ = 0;
        ball.targetX += (Math.random() * 0.4 - 0.2);
        ball.targetY += (Math.random() * 0.4 - 0.2);
        ball.targetX = Math.max(15, Math.min(85, ball.targetX));
        ball.targetY = Math.max(15, Math.min(85, ball.targetY));
      }

      // Smooth Lerp Ball Coordinates
      ball.x += (ball.targetX - ball.x) * 0.08;
      ball.y += (ball.targetY - ball.y) * 0.08;
      ball.z += (ball.targetZ - ball.z) * 0.12;

      // 4. Update Agents with Craig Reynolds Steering Behaviors
      actors.forEach((a) => {
        a.wanderAngle += a.wanderSpeed;

        const anchor =
          a.team === "HOME"
            ? FORMATION_HOME[a.slotCode] || { x: 30, y: 50 }
            : FORMATION_AWAY[a.slotCode] || { x: 70, y: 50 };

        const isHome = a.team === "HOME";
        const tacticShift =
          activeTactic === "ATTACKING" && isHome
            ? 7
            : activeTactic === "DEFENSIVE" && isHome
            ? -7
            : 0;

        let desireX = anchor.x + tacticShift;
        let desireY = anchor.y;

        // Role-specific intelligence
        if (a.position === "GK") {
          // Goalkeeper: bergerak vertikal menutup sudut tembakan
          desireX = isHome ? 7 : 93;
          desireY = 50 + (ball.y - 50) * 0.42;
        } else if (a.position === "DF") {
          // Defender: Menjaga garis offside & menempel striker lawan
          const ballDist = Math.hypot(a.x - ball.x, a.y - ball.y);
          if (ballDist < 18 && currentSeq && currentSeq.seq.team !== a.team) {
            // Berlari menghalau / memblok tembakan!
            desireX = ball.x + (isHome ? -3 : 3);
            desireY = ball.y;
          } else {
            desireX = anchor.x + (ball.x - 50) * 0.14 + tacticShift;
            desireY = anchor.y + (ball.y - anchor.y) * 0.25;
          }
        } else if (a.position === "MF") {
          // Midfielder: Membuka passing lane atau menekan pembawa bola
          desireX = anchor.x + (ball.x - 50) * 0.28 + tacticShift;
          desireY = anchor.y + (ball.y - anchor.y) * 0.32;
        } else if (a.position === "FW") {
          // Forward / Striker: Lari menusuk ke kotak penalti saat serangan aktif
          if (currentSeq && currentSeq.seq.team === a.team) {
            desireX = isHome ? Math.min(88, anchor.x + 12) : Math.max(12, anchor.x - 12);
            desireY = 48 + Math.sin(a.wanderAngle) * 14;
          } else {
            desireX = anchor.x + (ball.x - 50) * 0.2 + tacticShift;
            desireY = anchor.y + Math.cos(a.wanderAngle) * 8;
          }
        }

        // Craig Reynolds Separation Force (Mencegah pemain menumpuk / tabrakan)
        let sepX = 0;
        let sepY = 0;
        actors.forEach((other) => {
          if (other.id !== a.id) {
            const dist = Math.hypot(a.x - other.x, a.y - other.y);
            if (dist < 4.5 && dist > 0.01) {
              const repel = (4.5 - dist) / dist;
              sepX += (a.x - other.x) * repel * 0.15;
              sepY += (a.y - other.y) * repel * 0.15;
            }
          }
        });

        // Steering force calculation
        const steerX = (desireX - a.x) * 0.04 + sepX;
        const steerY = (desireY - a.y) * 0.04 + sepY;

        a.vx = a.vx * 0.88 + steerX * a.maxSpeed;
        a.vy = a.vy * 0.88 + steerY * a.maxSpeed;

        a.x += a.vx;
        a.y += a.vy;

        // Draw Player Dot
        const px = pad + (a.x / 100) * pitchW;
        const py = pad + (a.y / 100) * pitchH;
        const isCarrier = ball.carrierName === a.name;

        // Glowing Carrier Ring
        if (isCarrier) {
          ctx.strokeStyle = isHome ? "rgba(52, 211, 153, 0.95)" : "rgba(251, 113, 133, 0.95)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px, py, 14, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Player Circle Body
        ctx.fillStyle =
          a.position === "GK"
            ? isHome
              ? "#f59e0b"
              : "#ea580c"
            : isHome
            ? "#06b6d4"
            : "#e11d48";

        ctx.beginPath();
        ctx.arc(px, py, 9.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Jersey Number
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(a.number), px, py);

        // Player Name Tag
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(px - 26, py - 19, 52, 11);
        ctx.fillStyle = isHome ? "#38bdf8" : "#fda4af";
        ctx.font = "8px sans-serif";
        ctx.fillText(a.name.slice(0, 9), px, py - 13);
      });

      // 5. Draw Ball with 3D Parabolic Elevation ($Z$-Height)
      const ballFloorX = pad + (ball.x / 100) * pitchW;
      const ballFloorY = pad + (ball.y / 100) * pitchH;

      // Ball Shadow (stays on the grass floor, grows larger and more transparent when lofted)
      const shadowScale = 1 + (ball.z / 35);
      const shadowAlpha = Math.max(0.12, 0.38 - (ball.z / 100));
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(ballFloorX + 2, ballFloorY + 3.5, 5.5 * shadowScale, 3.5 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ball Elevated Position (x, y - z)
      const ballAirY = ballFloorY - ball.z;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ballFloorX, ballAirY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(ballFloorX, ballAirY, 2.2, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [simulation, activeTactic, speedMultiplier]);

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3 sm:p-5 shadow-2xl">
      {/* 1. TOP HEADER: Scoreboard, Clock & Speed Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/90 px-4 py-3">
        {/* Teams & Score */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-cyan-400 ring-4 ring-cyan-500/20" />
            <span className="font-bold text-slate-100 sm:text-base text-sm truncate max-w-[120px] sm:max-w-[200px]">
              {simulation.homeTeamName}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-950/80 px-3 py-1 font-mono text-xl font-extrabold text-amber-400 border border-amber-500/30">
            <span>{homeScore}</span>
            <span className="text-slate-600">:</span>
            <span>{awayScore}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100 sm:text-base text-sm truncate max-w-[120px] sm:max-w-[200px]">
              {simulation.awayTeamName}
            </span>
            <span className="h-3 w-3 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
          </div>
        </div>

        {/* Live Clock & Speeds */}
        <div className="flex items-center gap-2">
          {/* Match Minute */}
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-sm font-bold text-emerald-400">
            <Activity className="h-4 w-4 animate-pulse" />
            <span>
              {currentMinute >= 90
                ? "90'+ FT"
                : currentMinute === 45
                ? "45' HT"
                : `${currentMinute}'`}
            </span>
          </div>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsPaused((p) => !p)}
            className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
            title={isPaused ? "Lanjutkan Pertandingan" : "Jeda"}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>

          {/* Speed Multipliers */}
          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/80 p-0.5 text-xs font-bold text-slate-300">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => setSpeedMultiplier(s)}
                className={`rounded px-2 py-1 transition-all ${
                  speedMultiplier === s
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "hover:text-white"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Skip Button */}
          <button
            onClick={handleSkipToEnd}
            disabled={isMatchFinished}
            className="flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-50"
            title="Langsung lompat ke peluit akhir"
          >
            <FastForward className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lewati</span>
          </button>
        </div>
      </div>

      {/* 2. 2D PITCH CANVAS */}
      <div className="relative overflow-hidden rounded-xl border-2 border-emerald-600/40 shadow-inner">
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          className="w-full h-auto block aspect-[5/3] bg-emerald-950"
        />

        {/* Goal Overlay Celebration */}
        {goalCelebration && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-2 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 px-8 py-4 text-center shadow-2xl">
              <span className="text-4xl animate-bounce">⚽</span>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-slate-950 tracking-wider animate-pulse">
                  GOOOOL!
                </p>
                <p className="text-sm sm:text-base font-extrabold text-white">
                  {goalCelebration.player} ({goalCelebration.minute}&apos;)
                </p>
                <p className="text-xs font-bold text-slate-900">{goalCelebration.team}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. LIVE COMMENTARY TICKER */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <span>📢 Komentar Pertandingan Langsung</span>
          <span className="text-emerald-400">
            {currentMinute <= 45 ? "Babak Pertama" : "Babak Kedua"}
          </span>
        </div>

        {/* Current Active Highlight */}
        <div className="flex items-center gap-2 py-1 text-sm font-semibold text-slate-100">
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
            {currentMinute}&apos;
          </span>
          <p className="flex-1 text-slate-200">{currentCommentary}</p>
        </div>

        {/* Recent Events Scroll */}
        <div className="flex max-h-24 flex-col gap-1 overflow-y-auto pt-1 text-xs text-slate-400 scrollbar-thin">
          {commentaryHistory.slice(1, 6).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 opacity-75">
              <span className="font-mono text-[10px] text-slate-500">{item.minute}&apos;</span>
              <span className="truncate">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. IN-MATCH TACTICS & LIVE STATS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Tactical Control */}
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Instruksi Taktik:
          </span>
          <div className="flex items-center gap-1">
            {(
              [
                { id: "DEFENSIVE", label: "Bertahan", icon: Shield },
                { id: "BALANCED", label: "Seimbang", icon: Activity },
                { id: "ATTACKING", label: "Menyerang", icon: Flame },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const isActive = activeTactic === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTactic(t.id)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-emerald-500 text-slate-950 shadow-md"
                      : "border border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Possession Bar */}
        <div className="flex flex-col justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
            <span>Penguasaan: {simulation.stats.possession.home}%</span>
            <span>{simulation.stats.possession.away}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-rose-500/80 flex">
            <div
              className="h-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${simulation.stats.possession.home}%` }}
            />
          </div>
        </div>
      </div>

      {/* 5. FULL TIME RESULT MODAL */}
      {isMatchFinished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
            <Trophy className="mx-auto h-12 w-12 text-amber-400 animate-bounce" />
            <h3 className="mt-3 text-2xl font-black text-slate-100 uppercase tracking-wider">
              Peluit Akhir Berbunyi!
            </h3>
            <p className="text-sm font-semibold text-slate-400">Pertandingan Telah Selesai</p>

            <div className="my-5 flex items-center justify-center gap-4 rounded-xl border border-slate-800 bg-slate-950/80 py-4">
              <div className="text-right flex-1">
                <p className="text-sm font-bold text-cyan-400 truncate">{simulation.homeTeamName}</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 px-4 py-1 text-3xl font-black text-amber-400 border border-amber-500/30">
                {homeScore} - {awayScore}
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-rose-400 truncate">{simulation.awayTeamName}</p>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-400">
              🎉 Hadiah: +{earnedPoints} Poin EXP Manajer diterima!
            </div>

            <button
              onClick={onFinish}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/20"
            >
              Kembali ke Arena Pertandingan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
