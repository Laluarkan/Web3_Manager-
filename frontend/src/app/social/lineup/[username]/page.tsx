"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  Trophy,
  Unlock,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/components/Providers";
import { Pitch433 } from "@/components/Pitch433";
import { PlayerCard } from "@/components/PlayerCard";
import { apiRequest, LineupSlotData, UserCardData } from "@/lib/api";

interface ManagerLineupResponse {
  manager: {
    id: string;
    username: string;
    walletAddress: string | null;
    freeMatchWins: number;
    freeMatchPoints: number;
  };
  lineup: {
    id: string;
    formation: string;
    slots: LineupSlotData[];
  } | null;
}

export default function ManagerLineupPage() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username as string;

  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [data, setData] = useState<ManagerLineupResponse | null>(null);

  const [selectedSlotCode, setSelectedSlotCode] = useState<string | null>(null);
  const [inspectCard, setInspectCard] = useState<UserCardData | null>(null);

  // Form tawaran
  const [offerPrice, setOfferPrice] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerSuccessMsg, setOfferSuccessMsg] = useState("");

  useEffect(() => {
    if (!username) return;
    const fetchLineup = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await apiRequest<ManagerLineupResponse>(`/social/lineup/${username}`);
        setData(res);
        if (res.lineup?.slots && res.lineup.slots.length > 0) {
          // Default inspect the first slot
          setSelectedSlotCode(res.lineup.slots[0].slotCode);
          setInspectCard(res.lineup.slots[0].userCard);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Gagal memuat lineup manajer");
      } finally {
        setLoading(false);
      }
    };
    fetchLineup();
  }, [username]);

  // Hitung rata-rata OVR Lineup
  const teamOverall = useMemo(() => {
    if (!data?.lineup?.slots || data.lineup.slots.length === 0) return 0;
    const total = data.lineup.slots.reduce((acc, slot) => {
      const card = slot.userCard;
      return acc + (card ? card.baseOverall + (card.level - 1) : 0);
    }, 0);
    return Math.round(total / data.lineup.slots.length);
  }, [data]);

  const handleSelectSlot = (slotCode: string, slot?: LineupSlotData) => {
    setSelectedSlotCode(slotCode);
    setInspectCard(slot?.userCard || null);
    setOfferSuccessMsg("");
    setOfferPrice("");
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectCard) return;
    if (!user) {
      alert("Silakan login terlebih dahulu untuk menawar kartu");
      return;
    }
    if (!user.walletAddress) {
      alert("Silakan hubungkan MetaMask Anda terlebih dahulu di menu atas.");
      return;
    }
    const priceNum = Number(offerPrice);
    if (!priceNum || priceNum <= 0) {
      alert("Masukkan nominal KANS yang valid (> 0)");
      return;
    }

    setSubmittingOffer(true);
    setOfferSuccessMsg("");
    try {
      const res = await apiRequest<{ message: string; offer: any }>("/social/offers", {
        method: "POST",
        body: JSON.stringify({
          cardId: inspectCard.id,
          priceKans: priceNum,
        }),
      });

      setOfferSuccessMsg(res.message);
      setOfferPrice("");
    } catch (err: any) {
      alert(err.message || "Gagal mengirim tawaran kartu");
    } finally {
      setSubmittingOffer(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="mt-3 text-xs">Memuat Skuad Taktis 4-3-3 Coach {username}...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-rose-400" />
        <h2 className="mt-3 text-lg font-bold text-white">Lineup Tidak Ditemukan</h2>
        <p className="mt-1 text-sm text-slate-400">{errorMsg || "Manajer belum menyusun skuad."}</p>
        <Link
          href="/social"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Komunitas</span>
        </Link>
      </div>
    );
  }

  const { manager, lineup } = data;
  const isOwnLineup = user?.id === manager.id;

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER BANNER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/social"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-emerald-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Daftar Manajer</span>
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 font-black text-slate-950 shadow-lg shadow-emerald-950/40">
              {manager.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                  {manager.username}
                </h1>
                {isOwnLineup && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Skuad Anda
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <Wallet className="h-3 w-3 text-slate-500" />
                <span>
                  {manager.walletAddress
                    ? `${manager.walletAddress.slice(0, 6)}...${manager.walletAddress.slice(-4)}`
                    : "Wallet Belum Terhubung"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* STATS KELAS MANAJER */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-center">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Team OVR
            </div>
            <div className="text-lg font-black text-emerald-400">{teamOverall}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-center">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Poin Arena
            </div>
            <div className="text-lg font-black text-amber-400">{manager.freeMatchPoints}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-center">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Menang
            </div>
            <div className="text-lg font-black text-sky-400">{manager.freeMatchWins}</div>
          </div>
        </div>
      </div>

      {/* INFORMASI SCOUTING */}
      <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-300">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>
            {isOwnLineup
              ? "Anda sedang meninjau susunan taktik 4-3-3 tim Anda sendiri."
              : `Mode Scouting Aktif: Anda sedang memantau skuad milik Coach ${manager.username}. Klik pemain untuk menawar.`}
          </span>
        </div>
        <span className="font-mono text-[11px] font-bold uppercase text-emerald-400">
          Formasi: {lineup?.formation || "4-3-3"}
        </span>
      </div>

      {/* MAIN CONTENT: PITCH & INSPECTOR */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LAPANGAN HIJAU 4-3-3 (7 COLS) */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Starting XI ({lineup?.slots?.length || 0} / 11)
              </span>
              <span className="text-[10px] text-slate-400">
                Klik kartu pemain untuk melihat detail & negosiasi
              </span>
            </div>

            <Pitch433
              slots={lineup?.slots || []}
              selectedSlotCode={selectedSlotCode}
              onSelectSlot={handleSelectSlot}
            />
          </div>
        </div>

        {/* INSPEKSI KARTU & NEGOSIASI DRAWER (5 COLS) */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            {inspectCard ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Detail Pemain Scouted</h3>
                    <p className="text-[10px] text-slate-400">
                      Posisi: <span className="font-semibold text-emerald-400">{selectedSlotCode}</span>
                    </p>
                  </div>
                  {inspectCard.isLocked ? (
                    <span className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-400">
                      <Lock className="h-3 w-3" />
                      Untouchable (Locked)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                      <Unlock className="h-3 w-3" />
                      Open for Offers
                    </span>
                  )}
                </div>

                {/* KARTU LENGKAP */}
                <div className="flex justify-center">
                  <PlayerCard card={inspectCard} />
                </div>

                {/* STATUS KUNCI KARTU / NOT FOR SALE BANNER */}
                {inspectCard.isLocked && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-200">
                    <div className="flex items-center gap-2 font-bold text-xs text-rose-300">
                      <Lock className="h-4 w-4 shrink-0 text-rose-400" />
                      <span>KARTU INI TELAH DIKUNCI (NOT FOR SALE)</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-rose-200/80">
                      Coach <strong>{manager.username}</strong> telah mengunci kartu {inspectCard.player.name} agar tidak menerima tawaran transfer apa pun dari manajer lain.
                    </p>
                  </div>
                )}

                {/* FORM TAWARAN (JIKA BUKAN PEMILIK & KARTU TIDAK DIKUNCI) */}
                {!isOwnLineup && !inspectCard.isLocked && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Ajukan Tawaran Transfer P2P</span>
                      </h4>
                      <span className="text-[10px] text-slate-400">Off-Chain Negotiation</span>
                    </div>

                    <p className="mt-1 text-[11px] text-slate-300">
                      Tawar pemain ini langsung kepada Coach <strong>{manager.username}</strong>. Jika sepakat, transaksi on-chain otomatis mentransfer kartu & KANS secara aman!
                    </p>

                    {offerSuccessMsg ? (
                      <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/20 p-3 text-center">
                        <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-300" />
                        <p className="mt-1 text-xs font-bold text-emerald-200">{offerSuccessMsg}</p>
                        <Link
                          href="/social?tab=offers"
                          className="mt-2.5 inline-block rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                        >
                          Buka Kotak Negosiasi ➔
                        </Link>
                      </div>
                    ) : (
                      <form onSubmit={handleSendOffer} className="mt-3 space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                            Nominal Tawaran (KANS)
                          </label>
                          <div className="relative mt-1">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={offerPrice}
                              onChange={(e) => setOfferPrice(e.target.value)}
                              placeholder="Misal: 250"
                              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pr-14 pl-3 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                              required
                            />
                            <span className="absolute top-2.5 right-3 text-xs font-bold text-emerald-400">
                              KANS
                            </span>
                          </div>
                        </div>

                        {/* PRESETS CEPAT */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">Preset:</span>
                          {[100, 250, 500, 1000].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setOfferPrice(String(val))}
                              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
                            >
                              {val}
                            </button>
                          ))}
                        </div>

                        <button
                          type="submit"
                          disabled={submittingOffer}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{submittingOffer ? "Mengirim Tawaran..." : "Kirim Tawaran Transfer"}</span>
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* TOMBOL DINONAKTIFKAN KETIKA DIKUNCI */}
                {!isOwnLineup && inspectCard.isLocked && (
                  <button
                    disabled
                    className="w-full cursor-not-allowed rounded-xl border border-slate-700/60 bg-slate-800/40 py-2.5 text-xs font-bold text-slate-500"
                  >
                    🔒 Tawaran Transfer Dinonaktifkan (Pemain Dikunci)
                  </button>
                )}

                {/* KETIKA MELIHAT KARTU MILIK SENDIRI */}
                {isOwnLineup && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-center text-xs text-slate-400">
                    <p>Ini adalah kartu pemain Anda sendiri di skuad ini.</p>
                    <Link
                      href="/squad"
                      className="mt-2 inline-block font-bold text-emerald-400 hover:underline"
                    >
                      Buka Pengaturan Skuad & Kunci Kartu ➔
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">
                <p className="text-xs">Pilih salah satu pemain di lapangan untuk melihat data scouted.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
