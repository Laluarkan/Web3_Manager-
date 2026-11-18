"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Swords, Trophy, Wallet } from "lucide-react";
import { useAuth } from "@/components/Providers";
import { apiRequest } from "@/lib/api";

interface MatchResult {
  opponent: string;
  opponentRating: number;
  myRating: number;
  tactic: string;
  score: { myGoals: number; oppGoals: number };
  outcome: "WIN" | "DRAW" | "LOSE";
  possession: { my: number; opp: number };
  scorers: string[];
  earnedPoints: number;
}

export default function MatchPage() {
  const { user, refreshUser, linkWallet } = useAuth();
  const [difficulty, setDifficulty] = useState<"AMATEUR" | "PRO" | "WORLD_CLASS">("AMATEUR");
  const [tactic, setTactic] = useState<"ATTACKING" | "BALANCED" | "DEFENSIVE">("BALANCED");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-300">Silakan login untuk bermain Match Gratis.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950"
        >
          Masuk / Daftar
        </Link>
      </div>
    );
  }

  const handlePlayFree = async () => {
    setBusy(true);
    try {
      const data = await apiRequest<MatchResult>("/squad/free-match", {
        method: "POST",
        body: JSON.stringify({ difficulty, tactic }),
      });
      setResult(data);
      await refreshUser();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Mode Gratis (Tanpa Wallet & Tanpa Koin) */}
      <div className="space-y-5 rounded-2xl border border-emerald-500/30 bg-slate-900/70 p-6 lg:col-span-7">
        <div className="flex items-center justify-between">
          <div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
              Free-to-Play • Tanpa Wallet & Tanpa Koin
            </span>
            <h1 className="mt-2 text-2xl font-black text-white">Match Manager Gratis</h1>
          </div>
          <Swords className="h-8 w-8 text-emerald-400" />
        </div>

        <p className="text-xs text-slate-400">
          Hasil pertandingan dihitung dari OVR Starting XI 4-3-3, Live Form mingguan pemain, dan
          taktik yang kamu pilih.
        </p>

        <div>
          <label className="mb-2 block text-xs font-bold text-slate-300">Pilih Level Lawan</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "AMATEUR", label: "Amateur", sub: "OVR 68 • +15 pts" },
              { id: "PRO", label: "Pro", sub: "OVR 76 • +30 pts" },
              { id: "WORLD_CLASS", label: "World Class", sub: "OVR 84 • +50 pts" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setDifficulty(item.id as any)}
                className={`rounded-xl border p-3 text-left transition ${
                  difficulty === item.id
                    ? "border-emerald-400 bg-emerald-500/15 text-white"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="text-xs font-bold">{item.label}</div>
                <div className="mt-0.5 text-[10px] text-slate-400">{item.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold text-slate-300">Pilih Taktik</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "ATTACKING", label: "Attacking", sub: "Agresif cari gol" },
              { id: "BALANCED", label: "Balanced", sub: "Stabil & dominasi" },
              { id: "DEFENSIVE", label: "Defensive", sub: "Rapat & aman" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTactic(item.id as any)}
                className={`rounded-xl border p-3 text-left transition ${
                  tactic === item.id
                    ? "border-sky-400 bg-sky-500/15 text-white"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="text-xs font-bold">{item.label}</div>
                <div className="mt-0.5 text-[10px] text-slate-400">{item.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handlePlayFree}
          disabled={busy}
          className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "Pertandingan Berlangsung..." : "Kick Off! (Gratis)"}
        </button>

        {result && (
          <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Full Time • Taktik {result.tactic}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-black ${
                  result.outcome === "WIN"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : result.outcome === "DRAW"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-red-500/20 text-red-300"
                }`}
              >
                {result.outcome === "WIN"
                  ? "MENANG!"
                  : result.outcome === "DRAW"
                  ? "SERI"
                  : "KALAH"}{" "}
                (+{result.earnedPoints} Poin)
              </span>
            </div>

            <div className="my-4 grid grid-cols-3 items-center text-center">
              <div>
                <div className="text-sm font-black text-white">{user.username}</div>
                <div className="text-[11px] text-emerald-400">OVR {result.myRating}</div>
              </div>
              <div className="text-4xl font-black tracking-wider text-white">
                {result.score.myGoals} - {result.score.oppGoals}
              </div>
              <div>
                <div className="text-sm font-black text-white">{result.opponent}</div>
                <div className="text-[11px] text-slate-400">OVR {result.opponentRating}</div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
              <span>
                Possession: <strong className="text-white">{result.possession.my}%</strong> -{" "}
                {result.possession.opp}%
              </span>
              <span>
                Pencetak Gol:{" "}
                <strong className="text-emerald-300">
                  {result.scorers.length > 0 ? result.scorers.join(", ") : "-"}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Arena Kompetitif Koin KANS (Wajib Wallet) */}
      <div className="flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/30 to-slate-900 p-6 lg:col-span-5">
        <div>
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
              Web3 Competitive • Wajib Wallet
            </span>
            <Trophy className="h-7 w-7 text-amber-400" />
          </div>
          <h2 className="mt-3 text-xl font-black text-white">Turnamen & Liga Koin KANS</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Bertanding menggunakan skuad kartu NFT On-Chain melawan manager lain untuk memperebutkan
            hadiah <strong>Prize Pool KANS</strong> dan kartu edisi terbatas (
            <strong>POTW / Legendary</strong>).
          </p>

          <ul className="mt-4 space-y-2 text-xs text-slate-400">
            <li>• Membutuhkan Wallet MetaMask terhubung</li>
            <li>• Membutuhkan 11 Kartu NFT On-Chain aktif</li>
            <li>• Hadiah KANS otomatis dikirim ke dompet pemenang (Fase 4)</li>
          </ul>
        </div>

        <div className="mt-6">
          {user.walletAddress ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs font-semibold text-emerald-300">
              Wallet kamu sudah terhubung! Siap ikut saat Turnamen KANS Fase 4 dibuka.
            </div>
          ) : (
            <button
              onClick={async () => {
                try {
                  const msg = await linkWallet();
                  alert(msg);
                } catch (err: any) {
                  alert(err.message);
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-black text-slate-950 hover:bg-amber-400"
            >
              <Lock className="h-4 w-4" />
              <Wallet className="h-4 w-4" />
              <span>Hubungkan Wallet untuk Akses Mode Koin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
