"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Medal, Swords, Trophy, Users, Wallet } from "lucide-react";
import { useAuth } from "@/components/Providers";
import { apiRequest } from "@/lib/api";

interface MatchResult {
  mode: string;
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

interface PvpOpponent {
  userId: string;
  username: string;
  teamOverall: number;
  wins: number;
  played: number;
  points: number;
  starPlayer: string;
}

interface LeaderboardRow {
  id: string;
  username: string;
  walletAddress: string | null;
  freeMatchPlayed: number;
  freeMatchWins: number;
  freeMatchPoints: number;
}

export default function MatchPage() {
  const { user, refreshUser, linkWallet } = useAuth();
  const [tab, setTab] = useState<"AI" | "PVP" | "LEADERBOARD">("AI");
  const [difficulty, setDifficulty] = useState<"AMATEUR" | "PRO" | "WORLD_CLASS">("AMATEUR");
  const [tactic, setTactic] = useState<"ATTACKING" | "BALANCED" | "DEFENSIVE">("BALANCED");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [opponents, setOpponents] = useState<PvpOpponent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [busy, setBusy] = useState(false);

  const loadArenaData = useCallback(async () => {
    try {
      const lb = await apiRequest<{ leaderboard: LeaderboardRow[] }>("/squad/leaderboard");
      setLeaderboard(lb.leaderboard);
      if (user) {
        const opp = await apiRequest<{ opponents: PvpOpponent[] }>("/squad/opponents");
        setOpponents(opp.opponents);
      }
    } catch {
      // abaikan error non-kritis saat inisialisasi
    }
  }, [user]);

  useEffect(() => {
    loadArenaData();
  }, [loadArenaData]);

  if (!user) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-300">Silakan login untuk masuk ke Arena Pertandingan.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950"
        >
          Masuk / Daftar
        </Link>
      </div>
    );
  }

  const handlePlayAI = async () => {
    setBusy(true);
    try {
      const data = await apiRequest<MatchResult>("/squad/free-match", {
        method: "POST",
        body: JSON.stringify({ difficulty, tactic }),
      });
      setResult(data);
      await refreshUser();
      await loadArenaData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePlayPvp = async (opponentUserId: string) => {
    setBusy(true);
    try {
      const data = await apiRequest<MatchResult>("/squad/pvp-match", {
        method: "POST",
        body: JSON.stringify({ opponentUserId, tactic }),
      });
      setResult(data);
      await refreshUser();
      await loadArenaData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Arena Pertandingan Manager</h1>
          <p className="text-xs text-slate-400">
            Poin Manager kamu: <strong className="text-amber-400">{user.freeMatchPoints} pts</strong>{" "}
            (bisa dipakai untuk <strong>Training / Level Up kartu</strong> di halaman Squad!)
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-900 p-1 text-xs font-bold">
          <button
            onClick={() => setTab("AI")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 ${
              tab === "AI" ? "bg-emerald-500 text-slate-950" : "text-slate-400"
            }`}
          >
            <Swords className="h-3.5 w-3.5" />
            <span>Quick Match (AI)</span>
          </button>
          <button
            onClick={() => setTab("PVP")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 ${
              tab === "PVP" ? "bg-sky-500 text-slate-950" : "text-slate-400"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>PvP Klub Lain</span>
          </button>
          <button
            onClick={() => setTab("LEADERBOARD")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 ${
              tab === "LEADERBOARD" ? "bg-amber-500 text-slate-950" : "text-slate-400"
            }`}
          >
            <Medal className="h-3.5 w-3.5" />
            <span>Leaderboard</span>
          </button>
        </div>
      </div>

      {/* Hasil Match Terbaru */}
      {result && (
        <div className="rounded-2xl border border-emerald-500/40 bg-slate-900 p-5 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Full Time • {result.mode === "PVP_FREE" ? "PvP Manager" : "AI Match"} • Taktik{" "}
              {result.tactic}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-black ${
                result.outcome === "WIN"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : result.outcome === "DRAW"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-red-500/20 text-red-300"
              }`}
            >
              {result.outcome === "WIN" ? "MENANG!" : result.outcome === "DRAW" ? "SERI" : "KALAH"}{" "}
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

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-xs text-slate-400">
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

      {/* TAB 1: Quick Match AI */}
      {tab === "AI" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-5 rounded-2xl border border-emerald-500/30 bg-slate-900/70 p-6 lg:col-span-7">
            <div>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                Free-to-Play • Tanpa Wallet & Tanpa Koin
              </span>
              <h2 className="mt-2 text-xl font-black text-white">Quick Match vs AI</h2>
              <p className="mt-1 text-xs text-slate-400">
                Dihitung dari OVR Starting XI 4-3-3, Level Training kartu, Live Form mingguan, dan
                taktik.
              </p>
            </div>

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
              onClick={handlePlayAI}
              disabled={busy}
              className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy ? "Pertandingan Berlangsung..." : "Kick Off! (Gratis)"}
            </button>
          </div>

          {/* Panel Turnamen Koin KANS */}
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
                Masuk turnamen berhadiah <strong>Prize Pool KANS</strong> dengan skuad kartu NFT
                On-Chain kamu. Pemenang langsung menerima KANS di dompetnya!
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-400">
                <li>• Membutuhkan Wallet MetaMask terhubung</li>
                <li>• Membutuhkan 11 Kartu NFT On-Chain aktif</li>
                <li>• Siap diaktifkan dengan Smart Contract Prize Pool</li>
              </ul>
            </div>

            <div className="mt-6">
              {user.walletAddress ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs font-semibold text-emerald-300">
                  Wallet terhubung! Kamu bisa langsung beli Pack KANS & latih kartumu untuk persiapan
                  Turnamen KANS.
                </div>
              ) : (
                <button
                  onClick={() => linkWallet().catch((e) => alert(e.message))}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-black text-slate-950 hover:bg-amber-400"
                >
                  <Lock className="h-4 w-4" />
                  <Wallet className="h-4 w-4" />
                  <span>Hubungkan Wallet untuk Mode Koin</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PvP Tantang Klub Pemain Lain */}
      {tab === "PVP" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs text-slate-300">
              Pilih taktik sebelum menantang formasi 4-3-3 milik manager lain (Menang: <strong>+35 pts</strong>):
            </div>
            <div className="flex gap-2">
              {(["ATTACKING", "BALANCED", "DEFENSIVE"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTactic(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    tactic === t ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {opponents.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 py-14 text-center">
              <p className="text-sm font-bold text-slate-300">
                Belum ada klub pemain lain yang memiliki formasi 4-3-3 lengkap.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Coba daftar 1 akun kedua di browser/incognito lalu klaim Starter Pack untuk tes
                tantangan PvP!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {opponents.map((opp) => (
                <div
                  key={opp.userId}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-white">{opp.username}</h3>
                      <span className="rounded-lg bg-sky-500/20 px-2 py-0.5 text-xs font-black text-sky-300">
                        OVR {opp.teamOverall}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Bintang Utama: <strong className="text-slate-200">{opp.starPlayer}</strong>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Rekor: {opp.wins} Menang / {opp.played} Main • {opp.points} Poin
                    </p>
                  </div>

                  <button
                    onClick={() => handlePlayPvp(opp.userId)}
                    disabled={busy}
                    className="mt-4 w-full rounded-xl bg-sky-500 py-2 text-xs font-black text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                  >
                    {busy ? "Bertanding..." : "Tantang Klub Ini (PvP)"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Leaderboard Manager */}
      {tab === "LEADERBOARD" && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Manager / Klub</th>
                <th className="px-4 py-3 text-center">Status Web3</th>
                <th className="px-4 py-3 text-center">Main / Menang</th>
                <th className="px-4 py-3 text-right">Poin Manager</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Belum ada data peringkat.
                  </td>
                </tr>
              ) : (
                leaderboard.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={row.id === user.id ? "bg-emerald-500/10" : "hover:bg-slate-800/40"}
                  >
                    <td className="px-4 py-3 font-black text-slate-400">#{idx + 1}</td>
                    <td className="px-4 py-3 font-bold text-white">
                      {row.username} {row.id === user.id && <span className="text-emerald-400">(Kamu)</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.walletAddress ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          Wallet Linked
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                          Free Mode
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-300">
                      {row.freeMatchPlayed} / <span className="text-emerald-400">{row.freeMatchWins}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-amber-400">
                      {row.freeMatchPoints}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
