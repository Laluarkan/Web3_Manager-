"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { Coins, Search, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { useAuth } from "@/components/Providers";
import { PlayerCard } from "@/components/PlayerCard";
import { apiRequest, MarketListingData } from "@/lib/api";
import { CONTRACT_ADDRESSES, KANS_TOKEN_ABI, MARKETPLACE_ABI } from "@/lib/contracts";

export default function MarketPage() {
  const { user, linkWallet } = useAuth();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [listings, setListings] = useState<MarketListingData[]>([]);
  const [tab, setTab] = useState<"ALL" | "MINE">("ALL");
  const [position, setPosition] = useState("ALL");
  const [rarity, setRarity] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  const loadListings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (position !== "ALL") params.set("position", position);
      if (rarity !== "ALL") params.set("rarity", rarity);
      if (search.trim()) params.set("search", search.trim());
      params.set("sort", sort);

      const data = await apiRequest<{ listings: MarketListingData[] }>(
        `/market?${params.toString()}`
      );
      setListings(data.listings);
    } catch (err: any) {
      setStatusMsg(err.message);
    }
  }, [position, rarity, search, sort]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const myWallet = user?.walletAddress?.toLowerCase() || "";
  const displayedListings =
    tab === "MINE"
      ? listings.filter((l) => l.sellerWallet.toLowerCase() === myWallet)
      : listings;

  const handleBuy = async (item: MarketListingData) => {
    if (!user) {
      alert("Silakan login terlebih dahulu untuk membeli kartu.");
      return;
    }
    setBusyId(item.listingId);
    setStatusMsg("");
    try {
      if (!user.walletAddress) {
        await linkWallet();
      }
      if (!publicClient) throw new Error("Provider Web3 belum siap");

      const priceWei = parseEther(item.priceKans);

      // 1. Approve KANS ke CardMarketplace.sol
      setStatusMsg(`Step 1/2: Menyetujui pembayaran ${item.priceKans} KANS di MetaMask...`);
      const approveTx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.kansToken,
        abi: KANS_TOKEN_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.marketplace, priceWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // 2. Eksekusi buyCard di blockchain (atomic swap NFT <-> KANS)
      setStatusMsg("Step 2/2: Membeli kartu NFT di blockchain...");
      const buyTx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: "buyCard",
        args: [BigInt(item.listingId)],
      });
      await publicClient.waitForTransactionReceipt({ hash: buyTx });

      // 3. Sinkronkan kepemilikan baru ke backend
      const syncRes = await apiRequest<{ message: string }>("/market/sync-sale", {
        method: "POST",
        body: JSON.stringify({ listingId: item.listingId }),
      });
      setStatusMsg(syncRes.message);
      await loadListings();
    } catch (err: any) {
      alert(err.shortMessage || err.message || "Gagal membeli kartu");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (item: MarketListingData) => {
    setBusyId(item.listingId);
    setStatusMsg("");
    try {
      if (!publicClient) throw new Error("Provider Web3 belum siap");
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [BigInt(item.listingId)],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      await apiRequest("/market/sync-cancel", {
        method: "POST",
        body: JSON.stringify({ listingId: item.listingId }),
      });
      setStatusMsg("Penjualan kartu berhasil dibatalkan.");
      await loadListings();
    } catch (err: any) {
      alert(err.shortMessage || err.message || "Gagal membatalkan listing");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white">
            <ShoppingBag className="h-6 w-6 text-amber-400" />
            <span>Marketplace Kartu NFT (KANS)</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Seluruh transaksi jual-beli kartu NFT dilakukan 100% On-Chain memakai koin{" "}
            <strong className="text-amber-300">KANS</strong> (potongan fee ekosistem 2.5%).
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-900 p-1 text-xs font-bold">
          <button
            onClick={() => setTab("ALL")}
            className={`rounded-lg px-4 py-2 ${
              tab === "ALL" ? "bg-amber-500 text-slate-950" : "text-slate-400"
            }`}
          >
            Semua Pasar ({listings.length})
          </button>
          <button
            onClick={() => setTab("MINE")}
            className={`rounded-lg px-4 py-2 ${
              tab === "MINE" ? "bg-amber-500 text-slate-950" : "text-slate-400"
            }`}
          >
            Penjualan Saya
          </button>
        </div>
      </div>

      {user && !user.walletAddress && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs text-amber-200">
            Kamu bisa melihat pasar dengan akun Email, tetapi <strong>wajib hubungkan MetaMask</strong>{" "}
            untuk membeli atau menjual kartu pakai KANS.
          </p>
          <button
            onClick={() => linkWallet().catch((e) => alert(e.message))}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-black text-slate-950"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Hubungkan Wallet</span>
          </button>
        </div>
      )}

      {statusMsg && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
          {statusMsg}
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pemain / klub..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white focus:border-amber-500 focus:outline-none"
          />
        </div>

        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
        >
          <option value="ALL">Semua Posisi</option>
          <option value="GK">GK (Kiper)</option>
          <option value="DF">DF (Bek)</option>
          <option value="MF">MF (Gelandang)</option>
          <option value="FW">FW (Penyerang)</option>
        </select>

        <select
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
        >
          <option value="ALL">Semua Rarity</option>
          <option value="COMMON">Common</option>
          <option value="RARE">Rare</option>
          <option value="EPIC">Epic</option>
          <option value="LEGENDARY">Legendary</option>
          <option value="MYTHIC">Mythic</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
        >
          <option value="newest">Terbaru</option>
          <option value="price_asc">Harga Termurah</option>
          <option value="price_desc">Harga Termahal</option>
          <option value="ovr_desc">OVR Tertinggi</option>
        </select>
      </div>

      {/* Grid Listing */}
      {displayedListings.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 py-16 text-center">
          <p className="text-sm font-bold text-slate-300">Belum ada kartu yang dijual di pasar.</p>
          <p className="mt-1 text-xs text-slate-500">
            Buka halaman Squad → Claim 11 NFT ke Wallet → pilih kartu cadangan untuk mulai menjual
            pakai KANS!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {displayedListings.map((item) => {
            if (!item.userCard) return null;
            const isMine = myWallet && item.sellerWallet.toLowerCase() === myWallet;
            const isBusy = busyId === item.listingId;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-3"
              >
                <PlayerCard card={item.userCard} />

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2">
                    <span className="text-[10px] font-semibold text-slate-400">Harga</span>
                    <span className="flex items-center gap-1 text-sm font-black text-amber-400">
                      <Coins className="h-3.5 w-3.5" />
                      {item.priceKans} KANS
                    </span>
                  </div>

                  {isMine ? (
                    <button
                      onClick={() => handleCancel(item)}
                      disabled={isBusy}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{isBusy ? "Membatalkan..." : "Batalkan Jual"}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuy(item)}
                      disabled={isBusy}
                      className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                    >
                      {isBusy ? "Memproses..." : `Beli (${item.priceKans} KANS)`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
