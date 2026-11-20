import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { fetchOnChainCard, signPackOpenVoucher } from "../services/blockchain.service";

interface PackDefinition {
  id: "STANDARD" | "POTW" | "ICONIC";
  name: string;
  priceKans: string;
  edition: string;
  description: string;
  odds: Array<{ rarity: string; chance: number }>;
}

const PACK_CATALOG: PackDefinition[] = [
  {
    id: "STANDARD",
    name: "Standard Global Pack",
    priceKans: "100",
    edition: "BASE",
    description: "1 Kartu NFT pemain global musim berjalan (50% KANS di-burn).",
    odds: [
      { rarity: "COMMON", chance: 65 },
      { rarity: "RARE", chance: 27 },
      { rarity: "EPIC", chance: 7 },
      { rarity: "LEGENDARY", chance: 1 },
    ],
  },
  {
    id: "POTW",
    name: "Weekly POTW Pack",
    priceKans: "300",
    edition: "POTW",
    description: "1 Kartu edisi terbatas Player of The Week dari pemain Live Form A dunia!",
    odds: [
      { rarity: "RARE", chance: 50 },
      { rarity: "EPIC", chance: 38 },
      { rarity: "LEGENDARY", chance: 10 },
      { rarity: "MYTHIC", chance: 2 },
    ],
  },
  {
    id: "ICONIC",
    name: "Iconic Star Pack",
    priceKans: "1000",
    edition: "ICONIC",
    description: "Peluang tertinggi mendapatkan pemain bintang kelas dunia (Epic / Legendary / Mythic).",
    odds: [
      { rarity: "EPIC", chance: 55 },
      { rarity: "LEGENDARY", chance: 37 },
      { rarity: "MYTHIC", chance: 8 },
    ],
  },
];

const packVoucherSchema = z.object({
  packId: z.enum(["STANDARD", "POTW", "ICONIC"]),
  buyerAddress: z.string().optional(),
});

const packConfirmSchema = z.object({
  tokenId: z.number().int().positive(),
});

function rollRarity(odds: Array<{ rarity: string; chance: number }>): string {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const item of odds) {
    cumulative += item.chance;
    if (roll <= cumulative) return item.rarity;
  }
  return odds[odds.length - 1].rarity;
}

function overallRangeForRarity(rarity: string): [number, number] {
  switch (rarity) {
    case "MYTHIC":
      return [94, 98];
    case "LEGENDARY":
      return [88, 93];
    case "EPIC":
      return [82, 87];
    case "RARE":
      return [75, 81];
    default:
      return [65, 74];
  }
}

export async function getPackCatalog(_req: Request, res: Response) {
  try {
    // Ambil 8 pemain top dunia Live Form A sebagai etalase POTW minggu ini
    const potwFeatured = await prisma.player.findMany({
      where: { liveForm: "A", appearances: { gte: 5 } },
      include: { club: true },
      orderBy: [{ overall: "desc" }, { goals: "desc" }, { assists: "desc" }],
      take: 8,
    });

    res.json({
      packs: PACK_CATALOG,
      potwFeatured,
    });
  } catch (err) {
    console.error("Get pack catalog error:", err);
    res.status(500).json({ error: "Gagal memuat katalog Pack" });
  }
}

export async function requestPackVoucher(req: AuthRequest, res: Response) {
  try {
    const parsed = packVoucherSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Jenis pack tidak valid" });
      return;
    }

    const pack = PACK_CATALOG.find((p) => p.id === parsed.data.packId)!;
    const rarity = rollRarity(pack.odds);
    const [minOvr, maxOvr] = overallRangeForRarity(rarity);

    // Pilih pool pemain nyata sesuai jenis pack
    let candidates = await prisma.player.findMany({
      where:
        pack.id === "POTW"
          ? { liveForm: "A", appearances: { gte: 5 } }
          : pack.id === "ICONIC"
          ? { overall: { gte: 82 } }
          : { overall: { gte: Math.max(60, minOvr - 4), lte: maxOvr + 5 } },
      take: 150,
      orderBy: [{ overall: "desc" }, { goals: "desc" }],
    });

    if (candidates.length === 0) {
      candidates = await prisma.player.findMany({ take: 100 });
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const baseOverall = Math.min(maxOvr, Math.max(minOvr, picked.overall));

    let buyer = req.user!.walletAddress;
    if (parsed.data.buyerAddress && parsed.data.buyerAddress.startsWith("0x")) {
      buyer = parsed.data.buyerAddress;
      if (buyer.toLowerCase() !== (req.user!.walletAddress || "").toLowerCase()) {
        await prisma.user.update({
          where: { id: req.user!.id },
          data: { walletAddress: buyer },
        });
      }
    }

    if (!buyer) {
      res.status(400).json({ error: "Alamat dompet (walletAddress) belum terhubung" });
      return;
    }

    const voucher = await signPackOpenVoucher(
      buyer,
      {
        playerId: picked.id,
        position: picked.position,
        baseOverall,
        rarity,
        edition: pack.edition,
        season: 2026,
      },
      pack.priceKans
    );

    res.json({
      pack: { id: pack.id, name: pack.name, priceKans: pack.priceKans },
      voucher,
    });
  } catch (err: any) {
    console.error("Request pack voucher error:", err);
    res.status(500).json({ error: err.message || "Gagal menyiapkan voucher Pack" });
  }
}

export async function confirmPackOpen(req: AuthRequest, res: Response) {
  try {
    const parsed = packConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "tokenId tidak valid" });
      return;
    }

    const userId = req.user!.id;
    const walletAddress = req.user!.walletAddress!;

    // Verifikasi langsung ke blockchain
    const onChain = await fetchOnChainCard(parsed.data.tokenId);

    // Tentukan akun pemilik kartu di database:
    // 1. Cek apakah alamat dompet pemilik NFT di blockchain sudah tertaut ke akun tertentu
    const existingWalletOwner = await prisma.user.findUnique({
      where: { walletAddress: onChain.owner.toLowerCase() },
    });

    let cardOwnerUserId = userId;
    if (existingWalletOwner) {
      cardOwnerUserId = existingWalletOwner.id;
    } else if (!walletAddress) {
      // Jika dompet ini belum terdaftar di akun manapun dan user saat ini belum punya wallet, tautkan
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { walletAddress: onChain.owner.toLowerCase() },
        });
      } catch (e) {
        console.warn("Could not auto-link wallet to user:", e);
      }
    }

    const saved = await prisma.userCard.upsert({
      where: { tokenId: onChain.tokenId },
      update: {
        userId: cardOwnerUserId,
        isOnChain: true,
        isListed: false,
        level: onChain.level,
      },
      create: {
        userId: cardOwnerUserId,
        playerId: onChain.playerId,
        position: onChain.position,
        baseOverall: onChain.baseOverall,
        level: onChain.level,
        rarity: onChain.rarity,
        edition: onChain.edition,
        season: onChain.season,
        isOnChain: true,
        tokenId: onChain.tokenId,
        isListed: false,
      },
      include: { player: { include: { club: true } } },
    });

    res.json({
      message: `Selamat! Kamu mendapatkan ${saved.player.name} (${saved.rarity} - ${saved.edition})!`,
      card: saved,
    });
  } catch (err: any) {
    console.error("Confirm pack open error:", err);
    res.status(500).json({
      error: `Gagal memverifikasi kartu Pack di blockchain: ${err?.message || "Kesalahan internal"}`,
    });
  }
}
