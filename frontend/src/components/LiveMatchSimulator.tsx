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
} from "lucide-react";
import { FootballPitch } from "./match/FootballPitch";
import { PlayerAgent } from "@/engine/ai/PlayerBehavior";
import { BallPhysics } from "@/engine/physics/BallPhysics";
import { MatchCoordinator } from "@/engine/ai/TacticalAI";

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

// Koordinat taktis formasi 4-3-3
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

export function LiveMatchSimulator({
  simulation,
  earnedPoints,
  onFinish,
}: LiveMatchSimulatorProps) {
  // State Skor & Waktu Pertandingan
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

  // Instansiasi Engine Fisika & AI Pertandingan
  const ballRef = useRef<BallPhysics>(new BallPhysics(50, 50));
  const agentsRef = useRef<PlayerAgent[]>([]);
  const coordinatorRef = useRef<MatchCoordinator>(new MatchCoordinator());

  // Inisialisasi 22 Pemain sebagai Autonomous Agents
  useEffect(() => {
    const list: PlayerAgent[] = [];

    // Home Team (11 Pemain)
    simulation.homePlayers.forEach((p, idx) => {
      const anchor = FORMATION_HOME[p.slotCode] || { x: 25, y: 50 };
      list.push(
        new PlayerAgent({
          id: p.id,
          name: p.name,
          position: p.position,
          slotCode: p.slotCode,
          number: p.number || idx + 1,
          team: "HOME",
          baseOverall: p.baseOverall || 75,
          anchor,
        })
      );
    });

    // Away Team (11 Pemain)
    simulation.awayPlayers.forEach((p, idx) => {
      const anchor = FORMATION_AWAY[p.slotCode] || { x: 75, y: 50 };
      list.push(
        new PlayerAgent({
          id: p.id,
          name: p.name,
          position: p.position,
          slotCode: p.slotCode,
          number: p.number || idx + 1,
          team: "AWAY",
          baseOverall: p.baseOverall || 75,
          anchor,
        })
      );
    });

    agentsRef.current = list;

    // Pasangkan bola di kaki striker awal
    const homeStriker = list.find((a) => a.team === "HOME" && a.slotCode === "ST") || list[9];
    if (homeStriker) {
      ballRef.current.attachToCarrier(
        homeStriker.id,
        homeStriker.name,
        homeStriker.position,
        homeStriker.facingAngle
      );
    }
  }, [simulation]);

  // Update Taktik Aktif ke Koordinator AI
  useEffect(() => {
    coordinatorRef.current.setTactic(activeTactic);
  }, [activeTactic]);

  // Game Loop Fisika 60 FPS
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      if (!isPaused && !isMatchFinished) {
        coordinatorRef.current.update(
          dt,
          speedMultiplier,
          agentsRef.current,
          ballRef.current,
          (goalSeq) => {
            // Callback ketika gol terjadi dari attack sequence
            if (goalSeq.team === "HOME") {
              setHomeScore((s) => s + 1);
            } else {
              setAwayScore((s) => s + 1);
            }
            setGoalCelebration({
              player: goalSeq.finisherPlayer,
              team: goalSeq.team === "HOME" ? simulation.homeTeamName : simulation.awayTeamName,
              minute: goalSeq.minute,
            });
            setTimeout(() => setGoalCelebration(null), 3600);
          }
        );
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, isMatchFinished, speedMultiplier, simulation]);

  // Timeline Pertandingan (Durasi ~10 menit waktu nyata pada kecepatan 1x)
  const minuteRef = useRef(1);
  useEffect(() => {
    if (isPaused || isMatchFinished) return;

    // 10 menit = 600 detik = 600.000 ms untuk 90 menit pertandingan
    // 600.000 / 90 = ~6.666 ms per menit sepak bola pada 1x speed
    const intervalTimeMs = Math.max(25, Math.round(6666 / speedMultiplier));

    const timer = setInterval(() => {
      minuteRef.current += 1;
      const m = minuteRef.current;
      setCurrentMinute(m);

      // Cek apakah menit ini memiliki skenario penyerangan terstruktur
      const seq = simulation.sequences?.find((s) => s.minute === m);
      if (seq) {
        coordinatorRef.current.triggerSequence(seq);
        setCurrentCommentary(seq.description);
        setCommentaryHistory((prev) => [{ minute: m, text: seq.description }, ...prev].slice(0, 15));
      } else {
        // Cek peristiwa reguler (Kickoff, Halftime, Fulltime, Kartu, dll)
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

      {/* 2. DYNAMIC FOOTBALL PITCH (STEERING BEHAVIORS & 3D BALL) */}
      <div className="relative">
        <FootballPitch
          agents={agentsRef.current}
          ball={ballRef.current}
          homeTeamName={simulation.homeTeamName}
          awayTeamName={simulation.awayTeamName}
        />

        {/* Goal Overlay Celebration */}
        {goalCelebration && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300 pointer-events-none rounded-xl">
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
