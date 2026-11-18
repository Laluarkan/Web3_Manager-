"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Coins, Shield, ShoppingBag, Swords, Wallet } from "lucide-react";
import { useAuth } from "@/components/Providers";

export default function DashboardPage() {
  const { user, loading, linkWallet } = useAuth();

  if (loading) {
    return <div className="py-20 text-center text-slate-400">Memuat dashboard...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <span className="inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300">
          Progressive Web3 Football Manager
        </span>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
          Bangun Skuad <span className="text-emerald-400">4-3-3</span>, Miliki Kartu NFT di Dompetmu
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Mulai main gratis hanya dengan akun Email — langsung dapat 11 kartu Starter Pack dan ikut
          Match Gratis. Kapan pun siap, hubungkan MetaMask untuk klaim kartu menjadi NFT on-chain
          dan jual-beli antar pemain memakai koin <strong className="text-amber-300">KANS</strong>.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
          >
            Mulai Main Gratis (Daftar / Masuk)
          </Link>
          <Link
            href="/market"
            className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            Lihat Marketplace KANS
          </Link>
        </div>

        <div className="mt-14 grid gap-4 text-left sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <Shield className="h-7 w-7 text-emerald-400" />
            <h3 className="mt-3 font-bold text-white">11 Kartu Gratis (4-3-3)</h3>
            <p className="mt-1 text-xs text-slate-400">
              Langsung isi seluruh posisi 4-3-3: kartu Common + jaminan 1 Rare + peluang hoki 1 Epic.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <Swords className="h-7 w-7 text-sky-400" />
            <h3 className="mt-3 font-bold text-white">Mode Gratis & Mode Koin</h3>
            <p className="mt-1 text-xs text-slate-400">
              Main Match Gratis tanpa wallet, atau hubungkan MetaMask untuk arena kompetitif KANS.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <Coins className="h-7 w-7 text-amber-400" />
            <h3 className="mt-3 font-bold text-white">Aset NFT & Pasar KANS</h3>
            <p className="mt-1 text-xs text-slate-400">
              Data kartu tercatat di blockchain ERC-721 dan bebas diperjualbelikan pakai KANS.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    {
      done: user.hasClaimedStarter,
      title: "1. Klaim Starter Pack 11 Kartu (Formasi 4-3-3)",
      desc: "Dapatkan 11 pemain gratis (9-10 Common + 1 Rare pasti + peluang 10% Epic).",
      href: "/squad",
      cta: user.hasClaimedStarter ? "Lihat Squad" : "Klaim Sekarang",
    },
    {
      done: user.freeMatchPlayed > 0,
      title: "2. Main Match Gratis (Tanpa Wallet & Tanpa Koin)",
      desc: "Uji formasi 4-3-3 dan taktik melawan tim AI untuk kumpulkan poin manager.",
      href: "/match",
      cta: "Main Match Gratis",
    },
    {
      done: Boolean(user.walletAddress),
      title: "3. Hubungkan Wallet MetaMask (Opsional untuk Web3)",
      desc: "Wajib hanya saat ingin klaim kartu ke NFT on-chain, jual-beli, atau turnamen KANS.",
      action: async () => {
        try {
          const msg = await linkWallet();
          alert(msg);
        } catch (err: any) {
          alert(err.message || "Gagal menghubungkan wallet");
        }
      },
      cta: user.walletAddress ? "Wallet Terhubung" : "Hubungkan MetaMask",
    },
    {
      done: false,
      title: "4. Claim NFT On-Chain & Jual-Beli di Marketplace KANS",
      desc: "Cetak 11 kartu Starter ke dompetmu dalam 1 transaksi lalu mulai trading pakai KANS.",
      href: "/market",
      cta: "Buka Marketplace",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Manager Club HQ
            </p>
            <h1 className="mt-1 text-2xl font-black text-white">Halo, Coach {user.username}!</h1>
            <p className="mt-1 text-sm text-slate-400">
              {user.walletAddress
                ? `Wallet terhubung: ${user.walletAddress}`
                : "Mode Gratis aktif — hubungkan MetaMask kapan saja untuk fitur NFT & Koin KANS."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5">
              <div className="text-lg font-black text-white">{user.freeMatchPlayed}</div>
              <div className="text-[10px] text-slate-400">Match</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5">
              <div className="text-lg font-black text-emerald-400">{user.freeMatchWins}</div>
              <div className="text-[10px] text-slate-400">Menang</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5">
              <div className="text-lg font-black text-amber-400">{user.freeMatchPoints}</div>
              <div className="text-[10px] text-slate-400">Poin Free</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((s) => (
          <div
            key={s.title}
            className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <div className="flex items-start gap-3">
              {s.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
              )}
              <div>
                <h2 className="font-bold text-white">{s.title}</h2>
                <p className="mt-1 text-xs text-slate-400">{s.desc}</p>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              {s.href ? (
                <Link
                  href={s.href}
                  className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-slate-700"
                >
                  {s.cta} →
                </Link>
              ) : (
                <button
                  onClick={s.action}
                  disabled={s.done}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-emerald-400"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span>{s.cta}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/squad"
          className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 hover:border-emerald-500/40"
        >
          <Shield className="h-6 w-6 text-emerald-400" />
          <div>
            <div className="font-bold text-white">Atur Formasi 4-3-3</div>
            <div className="text-xs text-slate-400">Kelola Starting XI & Claim NFT</div>
          </div>
        </Link>
        <Link
          href="/match"
          className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 hover:border-sky-500/40"
        >
          <Swords className="h-6 w-6 text-sky-400" />
          <div>
            <div className="font-bold text-white">Arena Pertandingan</div>
            <div className="text-xs text-slate-400">Match Gratis & Preview Turnamen KANS</div>
          </div>
        </Link>
        <Link
          href="/market"
          className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 hover:border-amber-500/40"
        >
          <ShoppingBag className="h-6 w-6 text-amber-400" />
          <div>
            <div className="font-bold text-white">Marketplace KANS</div>
            <div className="text-xs text-slate-400">Jual & beli kartu NFT antar pemain</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
