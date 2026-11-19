"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient, useWriteContract, useAccount, useConnect, useChainId, useSwitchChain } from "wagmi";
import { decodeEventLog } from "viem";
import { Coins, Flame, Package, Sparkles, Wallet, X } from "lucide-react";
import { useAuth } from "@/components/Providers";
import { PlayerCard } from "@/components/PlayerCard";
import { apiRequest, PlayerData, UserCardData } from "@/lib/api";
import { CONTRACT_ADDRESSES, KANS_TOKEN_ABI, PACK_SHOP_ABI } from "@/lib/contracts";
import { TARGET_CHAIN_ID, switchToTargetNetwork } from "@/lib/wagmi";

interface PackItem {
  id: "STANDARD" | "POTW" | "ICONIC";
  name: string;
  priceKans: string;
  edition: string;
  description: string;
  odds: Array<{ rarity: string; chance: number }>;
}

const PACK_ACCENT: Record<string, string> = {
  STANDARD: "border-slate-700 from-slate-900 to-slate-950",
  POTW: "border-emerald-500/50 from-emerald-950/60 to-slate-950",
  ICONIC: "border-amber-500/50 from-amber-950/50 to-slate-950",
};

export default function PacksPage() {
  const { user, linkWallet } = useAuth();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const [packs, setPacks] = useState<PackItem[]>([]);
  const [potwFeatured, setPotwFeatured] = useState<PlayerData[]>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [revealedCard, setRevealedCard] = useState<UserCardData | null>(null);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await apiRequest<{ packs: PackItem[]; potwFeatured: PlayerData[] }>(
        "/packs/catalog"
      );
      setPacks(data.packs);
      setPotwFeatured(data.potwFeatured);
    } catch (err: any) {
      setStatusMsg(err.message);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const handleOpenPack = async (pack: PackItem) => {
    if (!user) {
      alert("Silakan login terlebih dahulu untuk membuka Pack.");
      return;
    }

    setOpeningId(pack.id);
    setStatusMsg("");
    try {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        try {
          await (window as any).ethereum.request({ method: "eth_requestAccounts" });
        } catch {
          throw new Error("Silakan setujui izin koneksi dompet MetaMask untuk melanjutkan!");
        }
      }
      if (!isConnected || !address) {
        const injectedConnector = connectors[0];
        if (injectedConnector) {
          try {
            await connectAsync({ connector: injectedConnector });
          } catch {
            // ignore
          }
        }
      }
      if (!user.walletAddress) {
        await linkWallet();
      }
      if (!publicClient) throw new Error("Provider Web3 belum siap");

      const actualChain =
        typeof window !== "undefined" && (window as any).ethereum?.chainId
          ? parseInt((window as any).ethereum.chainId, 16)
          : chainId;

      if (actualChain !== TARGET_CHAIN_ID) {
        setStatusMsg("Meminta MetaMask beralih ke Hardhat Localhost (Chain ID 31337)...");
        try {
          await switchToTargetNetwork();
        } catch {
          throw new Error("Silakan setujui peralihan jaringan ke Hardhat Localhost di MetaMask!");
        }
      }

      const activeBuyer = address || user.walletAddress;
      setStatusMsg(`Menyiapkan voucher ${pack.name}...`);
      const { voucher } = await apiRequest<{
        voucher: {
          card: {
            playerId: number;
            position: number;
            baseOverall: number;
            rarity: number;
            edition: number;
            season: number;
          };
          priceKans: string;
          priceWei: string;
          nonce: number;
          deadline: number;
          signature: `0x${string}`;
        };
      }>("/packs/voucher", {
        method: "POST",
        body: JSON.stringify({ packId: pack.id, buyerAddress: activeBuyer }),
      });

      const priceWei = BigInt(voucher.priceWei);

      setStatusMsg(`Step 1/2: Menyetujui pembayaran ${pack.priceKans} KANS di MetaMask...`);
      const approveTx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.kansToken,
        abi: KANS_TOKEN_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.packShop, priceWei],
        gas: BigInt(150000),
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      setStatusMsg("Step 2/2: Mencetak kartu NFT baru di blockchain (50% KANS di-burn)...");
      const openTx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.packShop,
        abi: PACK_SHOP_ABI,
        functionName: "openPack",
        args: [
          voucher.card,
          priceWei,
          BigInt(voucher.nonce),
          BigInt(voucher.deadline),
          voucher.signature,
        ],
        gas: BigInt(500000),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: openTx });

      let mintedTokenId = 0;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: PACK_SHOP_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "PackOpened") {
            mintedTokenId = Number((decoded.args as { tokenId: bigint }).tokenId);
            break;
          }
        } catch {
          // skip log kontrak lain
        }
      }

      if (mintedTokenId > 0) {
        const confirm = await apiRequest<{ message: string; card: UserCardData }>(
          "/packs/confirm",
          {
            method: "POST",
            body: JSON.stringify({ tokenId: mintedTokenId }),
          }
        );
        setRevealedCard(confirm.card);
        setStatusMsg(confirm.message);
      }
    } catch (err: any) {
      alert(err.shortMessage || err.message || "Gagal membuka Pack");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white">
            <Package className="h-6 w-6 text-emerald-400" />
            <span>On-Chain Pack Shop (KANS)</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Buka Pack memakai koin <strong className="text-amber-300">KANS</strong> — kartu langsung
            tercetak sebagai <strong>NFT ERC-721</strong> di dompetmu dan{" "}
            <strong className="text-orange-400">50% KANS otomatis dibakar (burn)</strong> untuk
            menjaga kelangkaan koin!
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-300">
          <Flame className="h-4 w-4" />
          <span>50% Deflationary KANS Burn</span>
        </div>
      </div>

      {user && !user.walletAddress && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs text-amber-200">
            Membuka Pack memakai <strong>KANS</strong> membutuhkan Wallet MetaMask terhubung.
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

      {/* 3 Pack Cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {packs.map((pack) => {
          const isOpening = openingId === pack.id;
          return (
            <div
              key={pack.id}
              className={`flex flex-col justify-between rounded-2xl border-2 bg-gradient-to-b p-6 shadow-xl ${
                PACK_ACCENT[pack.id] || PACK_ACCENT.STANDARD
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Edisi {pack.edition}
                  </span>
                  <span className="flex items-center gap-1 text-sm font-black text-amber-400">
                    <Coins className="h-4 w-4" />
                    {pack.priceKans} KANS
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-black text-white">{pack.name}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{pack.description}</p>

                <div className="mt-5 space-y-1.5 rounded-xl bg-slate-950/70 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Drop Rate Rarity
                  </div>
                  {pack.odds.map((o) => (
                    <div key={o.rarity} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{o.rarity}</span>
                      <span className="font-mono font-bold text-emerald-400">{o.chance}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleOpenPack(pack)}
                disabled={openingId !== null}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>{isOpening ? "Membuka Pack..." : `Buka (${pack.priceKans} KANS)`}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Etalase Pemain POTW Dunia Nyata Minggu Ini */}
      {potwFeatured.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-white">
                Sorotan Kandidat POTW Dunia (Live Form A)
              </h3>
              <p className="text-xs text-slate-400">
                Diambil langsung dari statistik performa nyata musim berjalan lintas liga dunia.
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-bold text-emerald-300">
              Data Real-World Aktif
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {potwFeatured.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900">
                  {p.club.logoUrl ? (
                    <img src={p.club.logoUrl} alt={p.club.name} className="h-7 w-7 object-contain" />
                  ) : (
                    <span className="text-xs font-black text-emerald-400">{p.overall}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-white">{p.name}</div>
                  <div className="truncate text-[10px] text-slate-400">
                    {p.club.name} • {p.club.leagueName}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold text-emerald-400">
                    OVR {p.overall} • {p.goals ?? 0}G {p.assists ?? 0}A ({p.appearances ?? 0} Main)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Reveal Kartu Baru */}
      {revealedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border-2 border-emerald-400/60 bg-slate-900 p-6 text-center shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300">
                NFT BARU TERCETAK!
              </span>
              <button
                onClick={() => setRevealedCard(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 text-left">
              <PlayerCard card={revealedCard} />
            </div>

            <p className="text-xs text-slate-300">
              Kartu NFT <strong>#{revealedCard.tokenId}</strong> sudah resmi masuk ke dompet
              MetaMask & Squad kamu!
            </p>

            <button
              onClick={() => setRevealedCard(null)}
              className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400"
            >
              Simpan ke Koleksi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
