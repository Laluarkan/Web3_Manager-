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
  Award,
} from "lucide-react";

export interface SimulationPlayer {
  id: number;
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  slotCode: string;
  number: number;
  baseOverall: number;
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

// Koordinat jangkar formasi 4-3-3 (dalam persentase lapangan 0 - 100)
const ANCHOR_HOME: Record<string, { x: number; y: number }> = {
  GK: { x: 7, y: 50 },
  LB: { x: 23, y: 16 },
  LCB: { x: 19, y: 38 },
  RCB: { x: 19, y: 62 },
  RB: { x: 23, y: 84 },
  LCM: { x: 42, y: 32 },
  CM: { x: 38, y: 50 },
  RCM: { x: 42, y: 68 },
  LW: { x: 67, y: 20 },
  ST: { x: 74, y: 50 },
  RW: { x: 67, y: 80 },
};

const ANCHOR_AWAY: Record<string, { x: number; y: number }> = {
  GK: { x: 93, y: 50 },
  RB: { x: 77, y: 16 },
  RCB: { x: 81, y: 38 },
  LCB: { x: 81, y: 62 },
  LB: { x: 77, y: 84 },
  RCM: { x: 58, y: 32 },
  CM: { x: 62, y: 50 },
  LCM: { x: 58, y: 68 },
  RW: { x: 33, y: 20 },
  ST: { x: 26, y: 50 },
  LW: { x: 33, y: 80 },
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
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  speed: number;
  wanderPhase: number;
  wanderSpeed: number;
  isCarrier: boolean;
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
  const [currentEvent, setCurrentEvent] = useState<MatchEvent | null>(simulation.events[0] || null);
  const [eventHistory, setEventHistory] = useState<MatchEvent[]>([simulation.events[0] || null].filter(Boolean));
  const [goalCelebration, setGoalCelebration] = useState<{
    player: string;
    team: string;
    minute: number;
  } | null>(null);
  const [isMatchFinished, setIsMatchFinished] = useState(false);

  // Ball physics & state
  const ballRef = useRef<{
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    vx: number;
    vy: number;
    state: "CARRIED" | "PASSING" | "SHOOTING" | "LOOSE";
    passProgress: number;
    carrierId: number | null;
  }>({
    x: 50,
    y: 50,
    targetX: 50,
    targetY: 50,
    vx: 0,
    vy: 0,
    state: "CARRIED",
    passProgress: 1,
    carrierId: simulation.homePlayers.find((p) => p.slotCode === "ST")?.id || null,
  });

  // Agent players list
  const agentsRef = useRef<AgentPlayer[]>([]);

  // Initialize individual agents
  useEffect(() => {
    const list: AgentPlayer[] = [];

    // Home players
    simulation.homePlayers.forEach((p, idx) => {
      const anchor = ANCHOR_HOME[p.slotCode] || { x: 25, y: 50 };
      list.push({
        id: p.id,
        name: p.name,
        position: p.position,
        slotCode: p.slotCode,
        number: p.number || idx + 1,
        team: "HOME",
        x: anchor.x,
        y: anchor.y,
        targetX: anchor.x,
        targetY: anchor.y,
        vx: 0,
        vy: 0,
        speed: 0.85 + Math.random() * 0.35,
        wanderPhase: Math.random() * Math.PI * 2,
        wanderSpeed: 0.02 + Math.random() * 0.03,
        isCarrier: p.slotCode === "ST",
      });
    });

    // Away players
    simulation.awayPlayers.forEach((p, idx) => {
      const anchor = ANCHOR_AWAY[p.slotCode] || { x: 75, y: 50 };
      list.push({
        id: p.id,
        name: p.name,
        position: p.position,
        slotCode: p.slotCode,
        number: p.number || idx + 1,
        team: "AWAY",
        x: anchor.x,
        y: anchor.y,
        targetX: anchor.x,
        targetY: anchor.y,
        vx: 0,
        vy: 0,
        speed: 0.85 + Math.random() * 0.35,
        wanderPhase: Math.random() * Math.PI * 2,
        wanderSpeed: 0.02 + Math.random() * 0.03,
        isCarrier: false,
      });
    });

    agentsRef.current = list;
  }, [simulation]);

  const minuteRef = useRef(1);
  const matchFinishedRef = useRef(false);

  // Time loop (10 minute match duration default at 1x speed: 1 match minute = ~6.6s)
  useEffect(() => {
    if (isPaused || isMatchFinished) return;

    const intervalTimeMs = Math.max(25, Math.round(6666 / speedMultiplier));

    const timer = setInterval(() => {
      minuteRef.current += 1;
      const m = minuteRef.current;
      setCurrentMinute(m);

      // Check event trigger
      const nextEvent = simulation.events.find((e) => e.minute === m);
      if (nextEvent) {
        setCurrentEvent(nextEvent);
        setEventHistory((prev) => [nextEvent, ...prev].slice(0, 15));

        // Find passer and receiver
        const actors = agentsRef.current;
        const passer = actors.find((a) => a.name === nextEvent.player && a.team === nextEvent.team);
        const receiver = actors.find(
          (a) => a.name === nextEvent.targetPlayer && a.team === nextEvent.team
        );

        if (nextEvent.type === "GOAL") {
          // Ball shoots into goal
          const targetGoal = nextEvent.team === "HOME" ? { x: 97, y: 50 } : { x: 3, y: 50 };
          ballRef.current.state = "SHOOTING";
          ballRef.current.targetX = targetGoal.x;
          ballRef.current.targetY = targetGoal.y;

          if (nextEvent.team === "HOME") {
            setHomeScore((s) => s + 1);
          } else {
            setAwayScore((s) => s + 1);
          }

          setGoalCelebration({
            player: nextEvent.player,
            team: nextEvent.team === "HOME" ? simulation.homeTeamName : simulation.awayTeamName,
            minute: nextEvent.minute,
          });
          setTimeout(() => setGoalCelebration(null), 3800);
        } else if (nextEvent.type === "PASS" && receiver) {
          // Ball kicked from passer to receiver
          ballRef.current.state = "PASSING";
          ballRef.current.passProgress = 0;
          ballRef.current.carrierId = receiver.id;
          ballRef.current.targetX = receiver.x;
          ballRef.current.targetY = receiver.y;
        } else if (nextEvent.type === "SAVE") {
          // Shot towards goal then stopped by GK
          const isHome = nextEvent.team === "HOME";
          ballRef.current.state = "SHOOTING";
          ballRef.current.targetX = isHome ? 92 : 8;
          ballRef.current.targetY = 48 + (Math.random() * 8 - 4);
        } else {
          // Dribbling phase
          if (passer) {
            ballRef.current.state = "CARRIED";
            ballRef.current.carrierId = passer.id;
            ballRef.current.targetX = nextEvent.ballCoord.x;
            ballRef.current.targetY = nextEvent.ballCoord.y;
          }
        }
      }

      if (m >= 90) {
        clearInterval(timer);
        matchFinishedRef.current = true;
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
    matchFinishedRef.current = true;
  };

  // Canvas 60 FPS Render Loop (Agents AI + Real Ball Physics)
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

      // 1. Draw Green Pitch Grass with Alternate Vertical Stripes
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
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2.5;

      // Outer boundary lines
      ctx.strokeRect(pad, pad, pitchW, pitchH);

      // Halfway line
      const midX = width / 2;
      const midY = height / 2;
      ctx.beginPath();
      ctx.moveTo(midX, pad);
      ctx.lineTo(midX, height - pad);
      ctx.stroke();

      // Center Circle & Spot
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

      // Left Net
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(pad - 12, (height - smallBoxH) / 2, 12, smallBoxH);
      ctx.strokeRect(pad - 12, (height - smallBoxH) / 2, 12, smallBoxH);

      // Right Penalty Box & Goal
      ctx.strokeRect(width - pad - boxW, (height - boxH) / 2, boxW, boxH);
      ctx.strokeRect(width - pad - smallBoxW, (height - smallBoxH) / 2, smallBoxW, smallBoxH);

      // Right Net
      ctx.fillRect(width - pad, (height - smallBoxH) / 2, 12, smallBoxH);
      ctx.strokeRect(width - pad, (height - smallBoxH) / 2, 12, smallBoxH);

      // 3. Update & Draw Autonomous Agents (Steering & Role Logic)
      const actors = agentsRef.current;
      const ball = ballRef.current;

      // Find current carrier agent
      const carrier = actors.find((a) => a.id === ball.carrierId) || actors[0];

      actors.forEach((a) => {
        a.wanderPhase += a.wanderSpeed;

        const anchor =
          a.team === "HOME"
            ? ANCHOR_HOME[a.slotCode] || { x: 30, y: 50 }
            : ANCHOR_AWAY[a.slotCode] || { x: 70, y: 50 };

        // Unique Individual Movement based on Role
        let desireX = anchor.x;
        let desireY = anchor.y;

        const isHome = a.team === "HOME";
        const tacticPush =
          activeTactic === "ATTACKING" && isHome
            ? 8
            : activeTactic === "DEFENSIVE" && isHome
            ? -8
            : 0;

        if (a.position === "GK") {
          // Goalkeeper: only stays in goal area and moves vertically tracking ball Y
          desireX = isHome ? 7 : 93;
          desireY = 50 + (ball.y - 50) * 0.45;
        } else if (a.position === "DF") {
          // Defender: Holds defensive line, shifts when ball is near, stays between ball and goal
          const lineX = anchor.x + tacticPush;
          desireX = isHome ? Math.min(42, lineX + (ball.x - 50) * 0.15) : Math.max(58, lineX + (ball.x - 50) * 0.15);
          desireY = anchor.y + (ball.y - anchor.y) * 0.25;
        } else if (a.position === "MF") {
          // Midfielder: Roams to create passing triangles or press carrier
          const ballDist = Math.hypot(a.x - ball.x, a.y - ball.y);
          if (ballDist < 25 && a.team !== carrier?.team) {
            // Pressing ball carrier!
            desireX = ball.x + (isHome ? -3 : 3);
            desireY = ball.y;
          } else {
            // Support passing lane
            desireX = anchor.x + (ball.x - 50) * 0.3 + tacticPush;
            desireY = anchor.y + (ball.y - anchor.y) * 0.35;
          }
        } else if (a.position === "FW") {
          // Forward / Wingers: Making attacking runs towards goal
          if (a.slotCode === "ST") {
            // Striker cuts into penalty box
            desireX = isHome ? Math.min(88, anchor.x + 8 + (ball.x - 50) * 0.25) : Math.max(12, anchor.x - 8 + (ball.x - 50) * 0.25);
            desireY = 50 + Math.sin(a.wanderPhase) * 16;
          } else {
            // Wingers stay wide and push forward
            desireX = isHome ? Math.min(84, anchor.x + 6 + (ball.x - 50) * 0.2) : Math.max(16, anchor.x - 6 + (ball.x - 50) * 0.2);
            desireY = anchor.y + Math.cos(a.wanderPhase) * 8;
          }
        }

        // Add personal organic wander jitter so each player moves independently!
        const jitterX = Math.sin(a.wanderPhase) * 2.2;
        const jitterY = Math.cos(a.wanderPhase * 1.3) * 2.8;

        a.targetX = desireX + jitterX;
        a.targetY = desireY + jitterY;

        // Smooth velocity interpolation (Euler Integration)
        const dx = a.targetX - a.x;
        const dy = a.targetY - a.y;
        a.vx = a.vx * 0.85 + dx * 0.04 * a.speed;
        a.vy = a.vy * 0.85 + dy * 0.04 * a.speed;

        a.x += a.vx;
        a.y += a.vy;

        // Draw Player
        const px = pad + (a.x / 100) * pitchW;
        const py = pad + (a.y / 100) * pitchH;
        const isCarrier = a.id === ball.carrierId;

        // Glowing Carrier Ring
        if (isCarrier) {
          ctx.strokeStyle = isHome ? "rgba(52, 211, 153, 0.95)" : "rgba(251, 113, 133, 0.95)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px, py, 14, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Body Circle (Team Colors)
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

        // Player Number
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

      // 4. Real Foot-to-Foot Ball Physics
      if (ball.state === "CARRIED" && carrier) {
        // Glued to carrier feet with natural dribble oscillation
        const dribbleOffset = Math.sin(Date.now() * 0.012) * 1.5;
        const forwardDir = carrier.team === "HOME" ? 2.5 : -2.5;
        ball.x = carrier.x + forwardDir + dribbleOffset;
        ball.y = carrier.y;
      } else if (ball.state === "PASSING") {
        // Ball travels to target with smooth deceleration
        ball.x += (ball.targetX - ball.x) * 0.09;
        ball.y += (ball.targetY - ball.y) * 0.09;

        if (Math.hypot(ball.x - ball.targetX, ball.y - ball.targetY) < 1.8) {
          ball.state = "CARRIED";
        }
      } else if (ball.state === "SHOOTING") {
        // High speed strike
        ball.x += (ball.targetX - ball.x) * 0.14;
        ball.y += (ball.targetY - ball.y) * 0.14;
      }

      const ballRealX = pad + (ball.x / 100) * pitchW;
      const ballRealY = pad + (ball.y / 100) * pitchH;

      // Draw Ball Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(ballRealX + 2, ballRealY + 3.5, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw Ball Body
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ballRealX, ballRealY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ball Hexagonal Spot
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(ballRealX, ballRealY, 2.2, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [simulation, activeTactic]);

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
            {currentEvent ? `${currentEvent.minute}'` : `${currentMinute}'`}
          </span>
          <p className="flex-1 text-slate-200">
            {currentEvent?.description || "Kedua tim saling mengatur tempo dan membaca pergerakan lawan di tengah lapangan..."}
          </p>
        </div>

        {/* Recent Events Scroll */}
        <div className="flex max-h-24 flex-col gap-1 overflow-y-auto pt-1 text-xs text-slate-400 scrollbar-thin">
          {eventHistory.slice(1, 5).map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 opacity-75">
              <span className="font-mono text-[10px] text-slate-500">{ev.minute}&apos;</span>
              <span className="truncate">{ev.description}</span>
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
