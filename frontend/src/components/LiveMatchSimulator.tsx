"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  FastForward,
  CheckCircle2,
  Trophy,
  Flame,
  Shield,
  Activity,
  Volume2,
  VolumeX,
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

// Koordinat dasar formasi 4-3-3 (dalam persentase lapangan 0 - 100)
const BASE_POS_HOME: Record<string, { x: number; y: number }> = {
  GK: { x: 7, y: 50 },
  LB: { x: 24, y: 18 },
  LCB: { x: 19, y: 38 },
  RCB: { x: 19, y: 62 },
  RB: { x: 24, y: 82 },
  LCM: { x: 42, y: 30 },
  CM: { x: 40, y: 50 },
  RCM: { x: 42, y: 70 },
  LW: { x: 68, y: 22 },
  ST: { x: 74, y: 50 },
  RW: { x: 68, y: 78 },
};

const BASE_POS_AWAY: Record<string, { x: number; y: number }> = {
  GK: { x: 93, y: 50 },
  RB: { x: 76, y: 18 },
  RCB: { x: 81, y: 38 },
  LCB: { x: 81, y: 62 },
  LB: { x: 76, y: 82 },
  RCM: { x: 58, y: 30 },
  CM: { x: 60, y: 50 },
  LCM: { x: 58, y: 70 },
  RW: { x: 32, y: 22 },
  ST: { x: 26, y: 50 },
  LW: { x: 32, y: 78 },
};

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
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1); // 1x (~10m), 2x (~5m), 5x (~2m)
  const [activeTactic, setActiveTactic] = useState<"DEFENSIVE" | "BALANCED" | "ATTACKING">("BALANCED");
  const [currentEvent, setCurrentEvent] = useState<MatchEvent | null>(simulation.events[0] || null);
  const [eventHistory, setEventHistory] = useState<MatchEvent[]>([simulation.events[0] || null].filter(Boolean));
  const [goalCelebration, setGoalCelebration] = useState<{
    player: string;
    team: string;
    minute: number;
  } | null>(null);
  const [isMatchFinished, setIsMatchFinished] = useState(false);

  // Ball & Player interpolated positions
  const ballPosRef = useRef({ x: 50, y: 50 });
  const targetBallPosRef = useRef({ x: 50, y: 50 });
  const activeCarrierRef = useRef<{ team: "HOME" | "AWAY"; name: string } | null>({
    team: "HOME",
    name: simulation.homePlayers[0]?.name || "Player",
  });

  // Target event index tracking
  const eventIdxRef = useRef(0);
  const minuteRef = useRef(1);
  const matchFinishedRef = useRef(false);

  // Base 10 minute match: 90 minutes / 600 seconds = 0.15 match-minutes per real second.
  // 1 minute of match time takes ~6.6 seconds at 1x speed.
  useEffect(() => {
    if (isPaused || isMatchFinished) return;

    const intervalTimeMs = Math.max(20, Math.round(6666 / speedMultiplier));

    const timer = setInterval(() => {
      minuteRef.current += 1;
      const m = minuteRef.current;
      setCurrentMinute(m);

      // Check if an event matches this minute
      const nextEvent = simulation.events.find((e) => e.minute === m);
      if (nextEvent) {
        setCurrentEvent(nextEvent);
        setEventHistory((prev) => [nextEvent, ...prev].slice(0, 15));
        targetBallPosRef.current = nextEvent.ballCoord;
        activeCarrierRef.current = { team: nextEvent.team, name: nextEvent.player };

        if (nextEvent.type === "GOAL") {
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
          setTimeout(() => setGoalCelebration(null), 4000);
        }
      } else {
        // Random natural ball drift during phase
        const driftX = Math.min(92, Math.max(8, targetBallPosRef.current.x + (Math.random() * 10 - 5)));
        const driftY = Math.min(88, Math.max(12, targetBallPosRef.current.y + (Math.random() * 16 - 8)));
        targetBallPosRef.current = { x: driftX, y: driftY };
      }

      // Check full-time
      if (m >= 90) {
        clearInterval(timer);
        matchFinishedRef.current = true;
        setIsMatchFinished(true);
      }
    }, intervalTimeMs);

    return () => clearInterval(timer);
  }, [isPaused, isMatchFinished, speedMultiplier, simulation]);

  // Skip directly to final score and whistle
  const handleSkipToEnd = () => {
    // Count total goals from events
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

  // Canvas 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. Draw Green Pitch Grass with Alternate Stripes
      ctx.fillStyle = "#1b4d24";
      ctx.fillRect(0, 0, width, height);

      const stripes = 9;
      const stripeW = width / stripes;
      for (let i = 0; i < stripes; i++) {
        if (i % 2 === 0) {
          ctx.fillStyle = "#1e5729";
          ctx.fillRect(i * stripeW, 0, stripeW, height);
        }
      }

      // 2. White Pitch Markings
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 2.5;

      // Outer boundary lines (inset by 24px)
      const pad = 24;
      ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

      // Halfway line
      const midX = width / 2;
      ctx.beginPath();
      ctx.moveTo(midX, pad);
      ctx.lineTo(midX, height - pad);
      ctx.stroke();

      // Center Circle & Spot
      const midY = height / 2;
      ctx.beginPath();
      ctx.arc(midX, midY, height * 0.16, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(midX, midY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Left Penalty Box & Goal
      const boxW = width * 0.16;
      const boxH = height * 0.54;
      ctx.strokeRect(pad, (height - boxH) / 2, boxW, boxH);

      // Left 6-yard box
      const smallBoxW = width * 0.06;
      const smallBoxH = height * 0.28;
      ctx.strokeRect(pad, (height - smallBoxH) / 2, smallBoxW, smallBoxH);

      // Left Goal Net
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(pad - 12, (height - smallBoxH) / 2, 12, smallBoxH);
      ctx.strokeRect(pad - 12, (height - smallBoxH) / 2, 12, smallBoxH);

      // Right Penalty Box & Goal
      ctx.strokeRect(width - pad - boxW, (height - boxH) / 2, boxW, boxH);
      ctx.strokeRect(width - pad - smallBoxW, (height - smallBoxH) / 2, smallBoxW, smallBoxH);

      // Right Goal Net
      ctx.fillRect(width - pad, (height - smallBoxH) / 2, 12, smallBoxH);
      ctx.strokeRect(width - pad, (height - smallBoxH) / 2, 12, smallBoxH);

      // 3. Smooth Lerp Ball Position
      const lerpFactor = 0.08;
      ballPosRef.current.x += (targetBallPosRef.current.x - ballPosRef.current.x) * lerpFactor;
      ballPosRef.current.y += (targetBallPosRef.current.y - ballPosRef.current.y) * lerpFactor;

      const ballRealX = pad + (ballPosRef.current.x / 100) * (width - pad * 2);
      const ballRealY = pad + (ballPosRef.current.y / 100) * (height - pad * 2);

      // Tactic bias offset
      const tacticOffset =
        activeTactic === "ATTACKING" ? 6 : activeTactic === "DEFENSIVE" ? -6 : 0;

      // 4. Draw Home Players (Cyan / Emerald)
      simulation.homePlayers.forEach((p) => {
        const base = BASE_POS_HOME[p.slotCode] || { x: 30, y: 50 };
        // Shift toward ball naturally
        const dx = (ballPosRef.current.x - base.x) * 0.18 + tacticOffset;
        const dy = (ballPosRef.current.y - base.y) * 0.12;
        const px = pad + ((base.x + dx) / 100) * (width - pad * 2);
        const py = pad + ((base.y + dy) / 100) * (height - pad * 2);

        const isCarrier =
          activeCarrierRef.current?.team === "HOME" &&
          activeCarrierRef.current?.name === p.name;

        // Glowing carrier ring
        if (isCarrier) {
          ctx.strokeStyle = "rgba(52, 211, 153, 0.9)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px, py, 15, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Player Circle
        ctx.fillStyle = p.position === "GK" ? "#f59e0b" : "#06b6d4";
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Player Number
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(p.number), px, py);

        // Player Name Label
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(px - 28, py - 20, 56, 12);
        ctx.fillStyle = "#38bdf8";
        ctx.font = "8px sans-serif";
        ctx.fillText(p.name.slice(0, 10), px, py - 14);
      });

      // 5. Draw Away Players (Crimson / Coral)
      simulation.awayPlayers.forEach((p) => {
        const base = BASE_POS_AWAY[p.slotCode] || { x: 70, y: 50 };
        const dx = (ballPosRef.current.x - base.x) * 0.18;
        const dy = (ballPosRef.current.y - base.y) * 0.12;
        const px = pad + ((base.x + dx) / 100) * (width - pad * 2);
        const py = pad + ((base.y + dy) / 100) * (height - pad * 2);

        const isCarrier =
          activeCarrierRef.current?.team === "AWAY" &&
          activeCarrierRef.current?.name === p.name;

        if (isCarrier) {
          ctx.strokeStyle = "rgba(244, 63, 94, 0.9)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px, py, 15, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = p.position === "GK" ? "#ea580c" : "#e11d48";
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(p.number), px, py);

        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(px - 28, py - 20, 56, 12);
        ctx.fillStyle = "#fda4af";
        ctx.font = "8px sans-serif";
        ctx.fillText(p.name.slice(0, 10), px, py - 14);
      });

      // 6. Draw Ball (with Shadow & Rotation)
      // Ball Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(ballRealX + 2, ballRealY + 3, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ball Body
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ballRealX, ballRealY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ball Pentagons
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(ballRealX, ballRealY, 2.5, 0, Math.PI * 2);
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
