"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import { Coins, LogOut, Shield, ShoppingBag, Swords, LayoutDashboard, Wallet } from "lucide-react";
import { useAuth } from "./Providers";
import { CONTRACT_ADDRESSES, KANS_TOKEN_ABI } from "@/lib/contracts";
import { apiRequest } from "@/lib/api";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, linkWallet } = useAuth();
  const [busy, setBusy] = useState(false);

  const { data: kansRaw, refetch: refetchKans } = useReadContract({
    address: CONTRACT_ADDRESSES.kansToken,
    abi: KANS_TOKEN_ABI,
    functionName: "balanceOf",
    args: user?.walletAddress ? [user.walletAddress as `0x${string}`] : undefined,
    query: { enabled: Boolean(user?.walletAddress) },
  });

  const kansFormatted = kansRaw ? Number(formatEther(kansRaw)).toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "0";

  const handleLinkWallet = async () => {
    setBusy(true);
    try {
      const msg = await linkWallet();
      alert(msg);
      refetchKans();
    } catch (err: any) {
      alert(err.message || "Gagal menghubungkan MetaMask");
    } finally {
      setBusy(false);
    }
  };

  const handleFaucet = async () => {
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>("/market/faucet-kans", { method: "POST" });
      alert(res.message);
      refetchKans();
    } catch (err: any) {
      alert(err.message || "Gagal klaim Test KANS");
    } finally {
      setBusy(false);
    }
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/squad", label: "Squad 4-3-3", icon: Shield },
    { href: "/match", label: "Match Gratis", icon: Swords },
    { href: "/market", label: "Marketplace", icon: ShoppingBag },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 font-black text-slate-950 shadow-lg shadow-emerald-500/20">
              W3
            </div>
            <div>
              <div className="text-sm font-black tracking-wide text-white">KANS MANAGER</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-emerald-400">
                Football Web3
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
                      : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {user.walletAddress ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                    <Coins className="h-3.5 w-3.5" />
                    <span>{kansFormatted} KANS</span>
                  </div>
                  <button
                    onClick={handleFaucet}
                    disabled={busy}
                    title="Klaim 1.000 Test KANS gratis (Khusus Hardhat/Testnet)"
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    +1K Test
                  </button>
                  <div className="hidden rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-slate-300 sm:block">
                    {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleLinkWallet}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span>{busy ? "Menghubungkan..." : "Hubungkan Wallet"}</span>
                </button>
              )}

              <div className="hidden text-xs font-medium text-slate-300 md:block">
                {user.username}
              </div>

              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                title="Keluar"
                className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
            >
              Masuk / Daftar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
