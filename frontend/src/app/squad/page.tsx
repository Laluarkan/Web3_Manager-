"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePublicClient, useWriteContract, useChainId, useSwitchChain } from "wagmi";
import { decodeEventLog, parseEther } from "viem";
import { ArrowUpCircle, RefreshCw, Save, Sparkles, Tag, Wallet, X } from "lucide-react";
import { useAuth } from "@/components/Providers";
import { Pitch433 } from "@/components/Pitch433";
import { PlayerCard } from "@/components/PlayerCard";
import { apiRequest, LineupSlotData, SquadResponse, UserCardData } from "@/lib/api";
import { CARD_NFT_ABI, CONTRACT_ADDRESSES, MARKETPLACE_ABI } from "@/lib/contracts";
import { TARGET_CHAIN_ID, switchToTargetNetwork } from "@/lib/wagmi";

const SLOT_REQUIRED_POS: Record<string, string> = {
  GK: "GK",
  LB: "DF",
  LCB: "DF",
  RCB: "DF",
  RB: "DF",
  LCM: "MF",
  CM: "MF",
  RCM: "MF",
  LW: "FW",
  ST: "FW",
  RW: "FW",
};

export default function SquadPage() {
  const { user, loading: authLoading, refreshUser, linkWallet } = useAuth();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const [squad, setSquad] = useState<SquadResponse | null>(null);
  const [draftSlots, setDraftSlots] = useState<LineupSlotData[]>([]);
  const [dirtyLineup, setDirtyLineup] = useState(false);

  const [selectedSlotCode, setSelectedSlotCode] = useState<string | null>(null);
  const [inspectCard, setInspectCard] = useState<UserCardData | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const loadSquad = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiRequest<SquadResponse>("/squad");
      setSquad(data);
      setDraftSlots(data.slots);
      setDirtyLineup(false);
    } catch (err: any) {
      setStatusMsg(err.message || "Gagal memuat skuad");
    }
  }, [user]);

  useEffect(() => {
    loadSquad();
  }, [loadSquad]);

  if (authLoading) {
    return <div className="py-20 text-center text-slate-400">Memuat data manager...</div>;
  }

  if (!user) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-300">Silakan login terlebih dahulu untuk mengatur Squad 4-3-3.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950"
        >
          Masuk / Daftar
        </Link>
      </div>
    );
  }

  const starterCardIds = new Set(draftSlots.map((s) => s.userCardId));
  const benchCards = (squad?.cards || []).filter((c) => !starterCardIds.has(c.id));

  const handleClaimStarter = async () => {
    setBusy(true);
    setStatusMsg("");
    try {
      const res = await apiRequest<{ message: string }>("/squad/starter-pack", { method: "POST" });
      setStatusMsg(res.message);
      await refreshUser();
      await loadSquad();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleMintStarterOnChain = async () => {
    setBusy(true);
    setStatusMsg("");
    try {
      if (!user.walletAddress) {
        await linkWallet();
      }
      if (chainId !== TARGET_CHAIN_ID) {
        setStatusMsg("Meminta MetaMask beralih ke Hardhat Localhost (31337)...");
        try {
          await switchToTargetNetwork();
        } catch {
          throw new Error("Silakan setujui peralihan jaringan ke Hardhat Localhost di MetaMask!");
        }
      }
      const { voucher } = await apiRequest<{
        voucher: {
          cards: Array<{
            playerId: number;
            position: number;
            baseOverall: number;
            rarity: number;
            edition: number;
            season: number;
          }>;
          nonce: number;
          deadline: number;
          signature: `0x${string}`;
        };
      }>("/squad/starter-pack/voucher", { method: "POST" });

      setStatusMsg("Menunggu konfirmasi MetaMask untuk mencetak 11 NFT sekaligus...");
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.cardNft,
        abi: CARD_NFT_ABI,
        functionName: "claimStarterPack",
        args: [
          voucher.cards,
          BigInt(voucher.nonce),
          BigInt(voucher.deadline),
          voucher.signature,
        ],
        gas: BigInt(2500000),
      });

      setStatusMsg("Transaksi dikirim! Menunggu konfirmasi blockchain...");
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      const confirm = await apiRequest<{ message: string }>("/squad/starter-pack/confirm-claim", {
        method: "POST",
      });
      setStatusMsg(confirm.message);
      await loadSquad();
    } catch (err: any) {
      alert(err.shortMessage || err.message || "Gagal minting 11 NFT");
    } finally {
      setBusy(false);
    }
  };

  const handleSyncWallet = async () => {
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>("/squad/sync-wallet", { method: "POST" });
      setStatusMsg(res.message);
      await loadSquad();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectPitchSlot = (slotCode: string, slot?: LineupSlotData) => {
    if (selectedSlotCode === slotCode) {
      setSelectedSlotCode(null);
      if (slot) setInspectCard(slot.userCard);
      return;
    }

    // Jika sebelumnya sudah pilih slot lain dengan posisi sama, tukar langsung!
    if (selectedSlotCode && SLOT_REQUIRED_POS[selectedSlotCode] === SLOT_REQUIRED_POS[slotCode]) {
      const slotA = draftSlots.find((s) => s.slotCode === selectedSlotCode);
      const slotB = draftSlots.find((s) => s.slotCode === slotCode);
      if (slotA && slotB) {
        setDraftSlots((prev) =>
          prev.map((s) => {
            if (s.slotCode === selectedSlotCode)
              return { ...s, userCardId: slotB.userCardId, userCard: slotB.userCard };
            if (s.slotCode === slotCode)
              return { ...s, userCardId: slotA.userCardId, userCard: slotA.userCard };
            return s;
          })
        );
        setDirtyLineup(true);
        setSelectedSlotCode(null);
        return;
      }
    }

    setSelectedSlotCode(slotCode);
  };

  const handleBenchCardClick = (card: UserCardData) => {
    if (selectedSlotCode) {
      if (card.isListed) {
        alert("Kartu ini sedang dijual di Marketplace.");
        return;
      }
      const reqPos = SLOT_REQUIRED_POS[selectedSlotCode];
      if (card.position !== reqPos) {
        alert(`Slot ${selectedSlotCode} hanya bisa diisi pemain posisi ${reqPos}!`);
        return;
      }

      setDraftSlots((prev) => {
        const exists = prev.some((s) => s.slotCode === selectedSlotCode);
        if (exists) {
          return prev.map((s) =>
            s.slotCode === selectedSlotCode
              ? { ...s, userCardId: card.id, userCard: card }
              : s
          );
        }
        return [
          ...prev,
          { id: `draft-${selectedSlotCode}`, slotCode: selectedSlotCode, userCardId: card.id, userCard: card },
        ];
      });
      setDirtyLineup(true);
      setSelectedSlotCode(null);
      return;
    }

    setInspectCard(card);
    setSellPrice("");
  };

  const handleSaveLineup = async () => {
    setBusy(true);
    try {
      const payload = {
        slots: draftSlots.map((s) => ({ slotCode: s.slotCode, userCardId: s.userCardId })),
      };
      const res = await apiRequest<{ message: string }>("/squad/lineup", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setStatusMsg(res.message);
      setDirtyLineup(false);
      await loadSquad();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpgradeCard = async () => {
    if (!inspectCard) return;
    setBusy(true);
    setStatusMsg("");
    try {
      const res = await apiRequest<{ message: string; card: UserCardData }>(
        `/squad/cards/${inspectCard.id}/upgrade`,
        { method: "POST" }
      );
      setStatusMsg(res.message);
      setInspectCard(res.card);
      await refreshUser();
      await loadSquad();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleLock = async () => {
    if (!inspectCard) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string; isLocked: boolean }>(
        `/social/cards/${inspectCard.id}/lock`,
        { method: "POST" }
      );
      alert(res.message);
      setInspectCard({ ...inspectCard, isLocked: res.isLocked });
      await loadSquad();
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status kunci kartu");
    } finally {
      setBusy(false);
    }
  };

  const handleListForSale = async () => {
    if (!inspectCard || !inspectCard.isOnChain || !inspectCard.tokenId) return;
    const numericPrice = Number(sellPrice);
    if (!numericPrice || numericPrice <= 0) {
      alert("Masukkan harga KANS yang valid!");
      return;
    }

    setBusy(true);
    try {
      if (!user.walletAddress) {
        await linkWallet();
      }
      if (!publicClient) throw new Error("Provider Web3 belum siap");

      if (chainId !== TARGET_CHAIN_ID) {
        setStatusMsg("Meminta MetaMask beralih ke Hardhat Localhost (31337)...");
        try {
          await switchToTargetNetwork();
        } catch {
          throw new Error("Silakan setujui peralihan jaringan ke Hardhat Localhost di MetaMask!");
        }
      }

      // 1. Cek apakah marketplace sudah di-approve oleh wallet penjual
      const isApproved = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.cardNft,
        abi: CARD_NFT_ABI,
        functionName: "isApprovedForAll",
        args: [user.walletAddress as `0x${string}`, CONTRACT_ADDRESSES.marketplace],
      });

      if (!isApproved) {
        setStatusMsg("Step 1/2: Memberi izin Marketplace mengakses NFT (cukup 1x)...");
        const approveTx = await writeContractAsync({
          address: CONTRACT_ADDRESSES.cardNft,
          abi: CARD_NFT_ABI,
          functionName: "setApprovalForAll",
          args: [CONTRACT_ADDRESSES.marketplace, true],
          gas: BigInt(100000),
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      // 2. Panggil listCard di CardMarketplace.sol
      setStatusMsg("Step 2/2: Memasang kartu di Marketplace on-chain...");
      const listTx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: "listCard",
        args: [BigInt(inspectCard.tokenId), parseEther(sellPrice)],
        gas: BigInt(200000),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: listTx });

      // 3. Ambil listingId dari event CardListed
      let listingId = 0;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: MARKETPLACE_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "CardListed") {
            listingId = Number((decoded.args as { listingId: bigint }).listingId);
            break;
          }
        } catch {
          // skip log dari kontrak lain
        }
      }

      if (listingId > 0) {
        await apiRequest("/market/sync-listing", {
          method: "POST",
          body: JSON.stringify({ listingId }),
        });
      }

      alert(`Kartu ${inspectCard.player.name} berhasil dijual seharga ${sellPrice} KANS!`);
      setInspectCard(null);
      await loadSquad();
    } catch (err: any) {
      alert(err.shortMessage || err.message || "Gagal memasang kartu di Marketplace");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Squad */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Squad & Formasi 4-3-3</h1>
          <p className="text-xs text-slate-400">
            Team OVR: <strong className="text-emerald-400">{squad?.teamOverall ?? 0}</strong> •
            Total Kartu: <strong className="text-white">{squad?.cards.length ?? 0}</strong> • Klik
            slot lapangan lalu klik pemain di Bench untuk menukar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dirtyLineup && (
            <button
              onClick={handleSaveLineup}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>Simpan Formasi</span>
            </button>
          )}
          {user.walletAddress && (
            <button
              onClick={handleSyncWallet}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync NFT Wallet</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-200">
          {statusMsg}
        </div>
      )}

      {/* Belum klaim starter pack */}
      {!squad?.hasClaimedStarter ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-10 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-emerald-400" />
          <h2 className="mt-3 text-xl font-black text-white">Klaim Starter Pack 11 Kartu Gratis!</h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">
            Kamu akan langsung mendapatkan 11 pemain sesuai formasi default <strong>4-3-3</strong>{" "}
            (1 GK, 4 DF, 3 MF, 3 FW): mayoritas Common + <strong>jaminan 1 Rare</strong> +{" "}
            <strong>peluang 10% dapat 1 Epic</strong>!
          </p>
          <button
            onClick={handleClaimStarter}
            disabled={busy}
            className="mt-6 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? "Menyiapkan 11 Pemain..." : "Klaim 11 Kartu Starter Pack (Gratis)"}
          </button>
        </div>
      ) : (
        <>
          {/* Banner Claim On-Chain jika 11 Starter Card belum di-mint ke wallet */}
          {(squad.unclaimedStarterCount ?? 0) === 11 && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div>
                <div className="text-sm font-bold text-amber-300">
                  11 Kartu Starter Pack Siap Di-Claim Menjadi NFT On-Chain!
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  Cetak 11 kartu sekaligus ke dompet MetaMask-mu dalam 1 transaksi agar bisa
                  diperjualbelikan di Marketplace KANS.
                </p>
              </div>
              <button
                onClick={handleMintStarterOnChain}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                <Wallet className="h-4 w-4" />
                <span>
                  {busy
                    ? "Memproses..."
                    : user.walletAddress
                    ? "Claim 11 NFT ke Wallet"
                    : "Hubungkan Wallet & Claim NFT"}
                </span>
              </button>
            </div>
          )}

          {/* Pitch 4-3-3 + Bench */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <Pitch433
                slots={draftSlots}
                selectedSlotCode={selectedSlotCode}
                onSelectSlot={handleSelectPitchSlot}
              />
              {selectedSlotCode && (
                <p className="mt-2 text-center text-xs text-emerald-300">
                  Slot <strong>{selectedSlotCode}</strong> dipilih (butuh posisi{" "}
                  <strong>{SLOT_REQUIRED_POS[selectedSlotCode]}</strong>). Klik pemain di Bench
                  untuk mengganti, atau klik ulang slot ini untuk melihat detail kartu.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-4">
              <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-300">
                Bangku Cadangan & Koleksi ({benchCards.length})
              </h2>
              {benchCards.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">
                  Semua kartumu sedang masuk Starting XI. Beli pemain baru di Marketplace untuk
                  menambah kedalaman skuad!
                </p>
              ) : (
                <div className="grid max-h-[540px] gap-3 overflow-y-auto pr-1">
                  {benchCards.map((card) => (
                    <PlayerCard
                      key={card.id}
                      card={card}
                      onClick={() => handleBenchCardClick(card)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal Inspect & Jual Kartu */}
      {inspectCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-black text-white">Detail Kartu Pemain</h3>
              <button
                onClick={() => setInspectCard(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <PlayerCard card={inspectCard} />

            {/* Statistik Nyata Musim Berjalan */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-slate-300">
              <span>Statistik Musim Ini:</span>
              <span className="font-bold text-emerald-300">
                {inspectCard.player.appearances ?? 0} Main •{" "}
                {inspectCard.position === "GK"
                  ? `${inspectCard.player.saves ?? 0} Saves`
                  : `${inspectCard.player.goals ?? 0} Gol • ${inspectCard.player.assists ?? 0} Assist`}
              </span>
            </div>

            {/* 6 Atribut ala eFootball / EA FC */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["PAC", inspectCard.player.pace],
                ["SHO", inspectCard.player.shooting],
                ["PAS", inspectCard.player.passing],
                ["DRI", inspectCard.player.dribbling],
                ["DEF", inspectCard.player.defending],
                ["PHY", inspectCard.player.physical],
              ].map(([label, val]) => (
                <div key={String(label)} className="rounded-lg bg-slate-950 py-2">
                  <div className="text-[10px] font-bold text-slate-400">{label}</div>
                  <div className="text-sm font-black text-white">{val}</div>
                </div>
              ))}
            </div>

            {/* Training / Level Up Kartu */}
            <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-sky-300">
                    Training Kartu (Lv.{inspectCard.level} → Lv.{Math.min(10, inspectCard.level + 1)})
                  </div>
                  <div className="text-[10px] text-slate-300">
                    Biaya: <strong>{inspectCard.level * 30} Poin Manager</strong> (Kamu punya{" "}
                    <strong>{user.freeMatchPoints}</strong> pts)
                    {inspectCard.isOnChain ? " • Level dicatat On-Chain!" : ""}
                  </div>
                </div>
                <button
                  onClick={handleUpgradeCard}
                  disabled={busy || inspectCard.level >= 10 || inspectCard.isListed}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-sky-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-sky-400 disabled:opacity-40"
                >
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  <span>{inspectCard.level >= 10 ? "MAX" : "+1 OVR"}</span>
                </button>
              </div>
            </div>

            {/* Fitur Kunci Pemain (Tolak Tawaran / Untouchable) */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 p-3">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{inspectCard.isLocked ? "🔒 Status: Dikunci (Untouchable)" : "🔓 Status: Terbuka untuk Ditawar"}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {inspectCard.isLocked
                    ? "Pemain ini menolak semua tawaran transfer dari teman/manajer lain."
                    : "Teman atau manajer lain dapat mengajukan tawaran KANS untuk pemain ini."}
                </div>
              </div>
              <button
                onClick={handleToggleLock}
                disabled={busy}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                  inspectCard.isLocked
                    ? "border border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                    : "border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                {inspectCard.isLocked ? "Buka Kunci" : "Kunci Pemain"}
              </button>
            </div>

            {/* Panel Jual ke Marketplace KANS */}
            <div className="mt-5 border-t border-slate-800 pt-4">
              {!inspectCard.isOnChain ? (
                <p className="text-xs text-amber-300">
                  Kartu ini masih status Starter (belum di-mint). Klik{" "}
                  <strong>Claim 11 NFT ke Wallet</strong> dulu agar bisa dijual di Marketplace KANS.
                </p>
              ) : inspectCard.isListed ? (
                <p className="text-xs text-amber-300">
                  Kartu ini sedang aktif dijual di Marketplace.
                </p>
              ) : starterCardIds.has(inspectCard.id) ? (
                <p className="text-xs text-slate-400">
                  Kartu ini sedang dipasang di Starting XI 4-3-3. Pindahkan ke Bench dulu jika ingin
                  menjualnya (atau beli pemain pengganti di Marketplace).
                </p>
              ) : (
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Jual Kartu NFT di Marketplace (Harga dalam KANS)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="Contoh: 250"
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={handleListForSale}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>{busy ? "..." : "Jual KANS"}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Fee Marketplace 2.5% otomatis dipotong saat kartu terjual.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
