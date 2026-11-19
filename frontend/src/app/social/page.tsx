"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount, usePublicClient, useSignTypedData, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Handshake,
  Lock,
  MessageSquare,
  Search,
  Send,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/Providers";
import { PlayerCard } from "@/components/PlayerCard";
import {
  apiRequest,
  CardOfferData,
  ManagerData,
  NotificationData,
} from "@/lib/api";
import {
  CONTRACT_ADDRESSES,
  KANS_TOKEN_ABI,
  MARKETPLACE_ABI,
} from "@/lib/contracts";
import { TARGET_CHAIN_ID, switchToTargetNetwork } from "@/lib/wagmi";

function SocialContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "offers" ? "offers" : "managers";

  const { user, linkWallet } = useAuth();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  const [activeTab, setActiveTab] = useState<"managers" | "offers" | "notifications">(initialTab);
  const [managers, setManagers] = useState<ManagerData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [incomingOffers, setIncomingOffers] = useState<CardOfferData[]>([]);
  const [outgoingOffers, setOutgoingOffers] = useState<CardOfferData[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [busy, setBusy] = useState(false);
  const [counterOfferId, setCounterOfferId] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const loadManagers = useCallback(async () => {
    try {
      const data = await apiRequest<{ managers: ManagerData[] }>(
        `/social/managers?search=${encodeURIComponent(searchQuery)}`
      );
      setManagers(data.managers);
    } catch {
      // silent
    }
  }, [searchQuery]);

  const loadOffers = useCallback(async () => {
    try {
      const data = await apiRequest<{
        incoming: CardOfferData[];
        outgoing: CardOfferData[];
      }>("/social/offers");
      setIncomingOffers(data.incoming);
      setOutgoingOffers(data.outgoing);
    } catch {
      // silent
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiRequest<{
        notifications: NotificationData[];
        unreadCount: number;
      }>("/social/notifications");
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadManagers();
    loadOffers();
    loadNotifications();
  }, [loadManagers, loadOffers, loadNotifications]);

  const handleSendFriendRequest = async (receiverId: string) => {
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>("/social/friends/request", {
        method: "POST",
        body: JSON.stringify({ receiverId }),
      });
      alert(res.message);
      await loadManagers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRespondFriend = async (friendshipId: string, action: "ACCEPT" | "REJECT") => {
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>("/social/friends/respond", {
        method: "POST",
        body: JSON.stringify({ friendshipId, action }),
      });
      alert(res.message);
      await loadManagers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCounterOffer = async (offerId: string) => {
    if (!counterPrice || Number(counterPrice) <= 0) {
      alert("Masukkan nominal KANS yang valid!");
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>(`/social/offers/${offerId}/counter`, {
        method: "POST",
        body: JSON.stringify({ priceKans: counterPrice }),
      });
      alert(res.message);
      setCounterOfferId(null);
      setCounterPrice("");
      await loadOffers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    if (!confirm("Yakin ingin menolak tawaran ini?")) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>(`/social/offers/${offerId}/respond`, {
        method: "POST",
        body: JSON.stringify({ action: "REJECT" }),
      });
      alert(res.message);
      await loadOffers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Penjual menyetujui tawaran -> Tanda tangan EIP-712 digital gratis di MetaMask
   */
  const handleSellerAccept = async (offer: CardOfferData) => {
    setBusy(true);
    setStatusMsg("");
    try {
      if (!user?.walletAddress) {
        await linkWallet();
      }

      setStatusMsg("Mempersiapkan dokumen kesepakatan...");
      const res = await apiRequest<{
        typedData: any;
        nonce: number;
        deadline: number;
      }>(`/social/offers/${offer.id}/respond`, {
        method: "POST",
        body: JSON.stringify({ action: "ACCEPT" }),
      });

      setStatusMsg("Silakan tanda tangani kesepakatan pelepasan kartu di MetaMask (Gratis 0 Gas Fee)...");
      const signature = await signTypedDataAsync({
        domain: {
          name: "W3CardMarketplace",
          version: "1",
          chainId: BigInt(TARGET_CHAIN_ID),
          verifyingContract: CONTRACT_ADDRESSES.marketplace,
        },
        types: res.typedData.types,
        primaryType: "PrivateDeal",
        message: {
          seller: res.typedData.message.seller as `0x${string}`,
          buyer: res.typedData.message.buyer as `0x${string}`,
          tokenId: BigInt(res.typedData.message.tokenId),
          price: parseEther(res.typedData.message.price),
          nonce: BigInt(res.nonce),
          deadline: BigInt(res.deadline),
        },
      });

      setStatusMsg("Menyimpan tanda tangan kesepakatan ke server...");
      const saved = await apiRequest<{ message: string }>(`/social/offers/${offer.id}/seller-sign`, {
        method: "POST",
        body: JSON.stringify({
          sellerSignature: signature,
          nonce: res.nonce,
          deadline: res.deadline,
        }),
      });

      alert(saved.message);
      await loadOffers();
    } catch (err: any) {
      alert(err.shortMessage || err.message || "Gagal menyetujui kesepakatan");
    } finally {
      setBusy(false);
      setStatusMsg("");
    }
  };

  /**
   * Pembeli mengeksekusi deal on-chain (Penjual boleh sedang offline!)
   */
  const handleBuyerExecuteOnChain = async (offer: CardOfferData) => {
    if (!offer.sellerSignature || !offer.nonce || !offer.deadline) {
      alert("Kesepakatan belum siap dieksekusi on-chain.");
      return;
    }
    setBusy(true);
    setStatusMsg("");
    try {
      if (!user?.walletAddress) {
        await linkWallet();
      }
      if (!publicClient) throw new Error("Provider Web3 belum siap");

      await switchToTargetNetwork();

      const priceWei = parseEther(offer.priceKans);

      // Step 1: Approve KANS
      setStatusMsg(`Step 1/2: Menyetujui pembayaran ${offer.priceKans} KANS di MetaMask...`);
      const approveTx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.kansToken,
        abi: KANS_TOKEN_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.marketplace, priceWei],
        gas: BigInt(150000),
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // Step 2: Eksekusi Private Deal di CardMarketplace.sol
      setStatusMsg("Step 2/2: Menyelesaikan transfer kartu NFT dan KANS di blockchain...");
      const dealTx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: "executePrivateDeal",
        args: [
          BigInt(offer.card.tokenId!),
          priceWei,
          offer.seller.walletAddress as `0x${string}`,
          BigInt(offer.nonce),
          BigInt(offer.deadline),
          offer.sellerSignature as `0x${string}`,
        ],
        gas: BigInt(400000),
      });
      await publicClient.waitForTransactionReceipt({ hash: dealTx });

      // Step 3: Sinkronkan ke database
      setStatusMsg("Sinkronisasi kartu baru ke skuad Anda...");
      const conf = await apiRequest<{ message: string }>(
        `/social/offers/${offer.id}/confirm-deal`,
        { method: "POST" }
      );

      alert(conf.message);
      await loadOffers();
    } catch (err: any) {
      alert(err.shortMessage || err.message || "Gagal menyelesaikan kesepakatan on-chain");
    } finally {
      setBusy(false);
      setStatusMsg("");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest("/social/notifications/read", { method: "POST" });
      setUnreadCount(0);
      await loadNotifications();
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Users className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-black text-white">Komunitas & Bursa Negosiasi</h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Kunjungi Lineup 4-3-3 manajer lain, tawar pemain incarannya, dan lakukan negosiasi personal dua arah!
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-xl bg-slate-950 p-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab("managers")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 transition ${
              activeTab === "managers" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Manajer & Teman</span>
          </button>
          <button
            onClick={() => setActiveTab("offers")}
            className={`relative flex items-center gap-1.5 rounded-lg px-4 py-2 transition ${
              activeTab === "offers" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            <Handshake className="h-3.5 w-3.5" />
            <span>Negosiasi Transfer</span>
            {(incomingOffers.filter((o) => o.status === "PENDING" || o.status === "COUNTERED").length > 0 ||
              outgoingOffers.filter((o) => o.status === "ACCEPTED").length > 0) && (
              <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("notifications");
              handleMarkAllRead();
            }}
            className={`relative flex items-center gap-1.5 rounded-lg px-4 py-2 transition ${
              activeTab === "notifications" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Notifikasi</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-black text-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-300 animate-pulse">
          <Clock className="h-4 w-4" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* TAB 1: MANAJER & TEMAN */}
      {activeTab === "managers" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama manajer atau klub..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pr-4 pl-9 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {managers.map((m) => (
              <div
                key={m.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-slate-700"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white">{m.username}</h3>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {m.cardCount} Kartu • {m.freeMatchPoints} Poin • {m.freeMatchWins} Menang
                      </div>
                    </div>
                    {m.friendStatus === "ACCEPTED" && (
                      <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        <UserCheck className="h-3 w-3" />
                        Teman
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3">
                  <Link
                    href={`/social/lineup/${m.username}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Lihat Lineup 4-3-3</span>
                  </Link>

                  {m.friendStatus === "NONE" && (
                    <button
                      onClick={() => handleSendFriendRequest(m.id)}
                      disabled={busy}
                      title="Tambah Teman"
                      className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      <UserPlus className="h-4 w-4" />
                    </button>
                  )}
                  {m.friendStatus === "PENDING_SENT" && (
                    <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[10px] font-semibold text-amber-300">
                      Menunggu
                    </span>
                  )}
                  {m.friendStatus === "PENDING_RECEIVED" && m.friendshipId && (
                    <button
                      onClick={() => handleRespondFriend(m.friendshipId!, "ACCEPT")}
                      disabled={busy}
                      className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                    >
                      Terima
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: NEGOSIASI TRANSFER (OFFERS) */}
      {activeTab === "offers" && (
        <div className="space-y-6">
          {/* Sub-Section 1: Tawaran Masuk (Orang Lain Menawar Kartu Kita) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <span>Tawaran Masuk (Kartu Anda yang Ditawar)</span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  {incomingOffers.length}
                </span>
              </h2>
            </div>

            {incomingOffers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                Belum ada manajer lain yang menawar kartu Anda. Kunci kartu yang tidak ingin dijual atau pajang di lineup untuk menarik perhatian manajer lain!
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {incomingOffers.map((offer) => {
                  const history = JSON.parse(offer.history || "[]");
                  const isPendingCounter = offer.status === "PENDING" || offer.status === "COUNTERED";
                  const canAct = isPendingCounter && offer.lastActionBy !== user?.id;

                  return (
                    <div
                      key={offer.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-black text-emerald-300 border border-white/10">
                            {offer.card.baseOverall + (offer.card.level - 1)}
                          </div>
                          <div>
                            <div className="font-bold text-white">{offer.card.player.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {offer.card.position} • {offer.card.player.club.name} • {offer.card.rarity}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-black ${
                            offer.status === "ACCEPTED"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : offer.status === "COMPLETED"
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                              : offer.status === "REJECTED"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {offer.status}
                        </span>
                      </div>

                      <div className="rounded-xl bg-slate-950/70 p-2.5 text-xs flex items-center justify-between">
                        <div>
                          <span className="text-slate-400">Penawar: </span>
                          <strong className="text-white">Coach {offer.buyer.username}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Harga Tawaran: </span>
                          <strong className="text-amber-300 text-sm">{offer.priceKans} KANS</strong>
                        </div>
                      </div>

                      {/* Riwayat Tawar-Menawar */}
                      {history.length > 1 && (
                        <div className="rounded-lg bg-slate-950/40 p-2 text-[10px] text-slate-400 space-y-1">
                          <div className="font-semibold text-slate-300">Riwayat Negosiasi:</div>
                          {history.map((h: any, idx: number) => (
                            <div key={idx} className="flex justify-between">
                              <span>
                                {h.username}: {h.action === "OFFER" ? "Tawaran Awal" : h.action === "COUNTER" ? "Tawar Balik" : h.action}
                              </span>
                              <span className="font-bold text-amber-300">{h.priceKans} KANS</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Aksi Penjual */}
                      {canAct && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => handleSellerAccept(offer)}
                            disabled={busy}
                            className="flex-1 rounded-xl bg-emerald-500 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400"
                          >
                            Setujui Deal ({offer.priceKans} KANS)
                          </button>
                          <button
                            onClick={() => setCounterOfferId(offer.id)}
                            disabled={busy}
                            className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-300 hover:bg-sky-500/20"
                          >
                            Tawar Balik
                          </button>
                          <button
                            onClick={() => handleRejectOffer(offer.id)}
                            disabled={busy}
                            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
                          >
                            Tolak
                          </button>
                        </div>
                      )}

                      {offer.status === "ACCEPTED" && (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-center text-xs text-emerald-300">
                          ✅ Anda telah menandatangani kesepakatan ini. Menunggu pembeli menyelesaikan pembayaran on-chain.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sub-Section 2: Tawaran Keluar (Kita yang Menawar Kartu Orang Lain) */}
          <div className="space-y-3 pt-6 border-t border-slate-800">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <span>Tawaran Keluar (Tawaran Anda ke Manajer Lain)</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {outgoingOffers.length}
              </span>
            </h2>

            {outgoingOffers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                Anda belum mengirim tawaran ke manajer lain. Kunjungi tab "Manajer & Teman" untuk melihat formasi 4-3-3 mereka!
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {outgoingOffers.map((offer) => {
                  const isAccepted = offer.status === "ACCEPTED";
                  const canAct =
                    (offer.status === "PENDING" || offer.status === "COUNTERED") &&
                    offer.lastActionBy !== user?.id;

                  return (
                    <div
                      key={offer.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-black text-emerald-300 border border-white/10">
                            {offer.card.baseOverall + (offer.card.level - 1)}
                          </div>
                          <div>
                            <div className="font-bold text-white">{offer.card.player.name}</div>
                            <div className="text-[10px] text-slate-400">
                              Pemilik: Coach {offer.seller.username}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-black ${
                            isAccepted
                              ? "bg-emerald-500 text-slate-950 animate-pulse"
                              : offer.status === "COMPLETED"
                              ? "bg-sky-500/20 text-sky-300"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {offer.status}
                        </span>
                      </div>

                      <div className="rounded-xl bg-slate-950/70 p-2.5 text-xs flex items-center justify-between">
                        <span className="text-slate-400">Harga Terakhir:</span>
                        <strong className="text-amber-300 text-sm">{offer.priceKans} KANS</strong>
                      </div>

                      {/* Tombol Eksekusi On-Chain untuk Pembeli ketika Penjual sudah Tanda Tangan */}
                      {isAccepted && (
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <div className="text-[11px] text-emerald-300 font-semibold">
                            🎉 Coach {offer.seller.username} sudah menyetujui dan menandatangani deal ini!
                          </div>
                          <button
                            onClick={() => handleBuyerExecuteOnChain(offer)}
                            disabled={busy}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400"
                          >
                            <Zap className="h-4 w-4" />
                            <span>Selesaikan Transaksi On-Chain ({offer.priceKans} KANS)</span>
                          </button>
                        </div>
                      )}

                      {canAct && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => setCounterOfferId(offer.id)}
                            disabled={busy}
                            className="flex-1 rounded-xl border border-sky-500/30 bg-sky-500/10 py-2 text-xs font-bold text-sky-300 hover:bg-sky-500/20"
                          >
                            Tawar Balik
                          </button>
                          <button
                            onClick={() => handleRejectOffer(offer.id)}
                            disabled={busy}
                            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
                          >
                            Batalkan
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFIKASI */}
      {activeTab === "notifications" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-white">Semua Pemberitahuan</h2>
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-emerald-400 hover:underline"
            >
              Tandai Semua Dibaca
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
              Belum ada notifikasi.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-4 transition ${
                    !n.isRead ? "bg-emerald-500/5" : "hover:bg-slate-800/40"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-emerald-400 border border-white/10">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white">{n.title}</div>
                    <div className="mt-0.5 text-xs text-slate-300">{n.message}</div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {new Date(n.createdAt).toLocaleString("id-ID")}
                    </div>
                  </div>
                  {n.link && (
                    <Link
                      href={n.link}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700"
                    >
                      Buka
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Dialog Tawar Balik (Counter-Offer) */}
      {counterOfferId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white">Tawar Balik Harga</h3>
              <button
                onClick={() => setCounterOfferId(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Masukkan Nominal Tawaran Baru (KANS)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
                placeholder="Contoh: 450"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCounterOfferId(null)}
                className="flex-1 rounded-xl border border-slate-700 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                onClick={() => handleCounterOffer(counterOfferId)}
                disabled={busy}
                className="flex-1 rounded-xl bg-emerald-500 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400"
              >
                Kirim Tawaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SocialPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center text-slate-400">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="mt-3 text-xs">Memuat Komunitas & Negosiasi...</p>
          </div>
        </div>
      }
    >
      <SocialContent />
    </Suspense>
  );
}
