import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  fetchOnChainCard,
  fetchOnChainListing,
  mintTestKansFaucet,
} from "../services/blockchain.service";

const listingSyncSchema = z.object({
  listingId: z.number().int().positive(),
});

export async function getMarketListings(req: Request, res: Response) {
  try {
    const position = typeof req.query.position === "string" ? req.query.position.toUpperCase() : "";
    const rarity = typeof req.query.rarity === "string" ? req.query.rarity.toUpperCase() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";

    const listings = await prisma.marketListing.findMany({
      where: { status: "ACTIVE" },
      include: {
        userCard: {
          include: {
            player: { include: { club: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let filtered = listings.filter((item) => {
      if (!item.userCard) return false;
      if (position && position !== "ALL" && item.userCard.position !== position) return false;
      if (rarity && rarity !== "ALL" && item.userCard.rarity !== rarity) return false;
      if (search) {
        const pName = item.userCard.player.name.toLowerCase();
        const cName = item.userCard.player.club.name.toLowerCase();
        if (!pName.includes(search) && !cName.includes(search)) return false;
      }
      return true;
    });

    if (sort === "price_asc") {
      filtered = filtered.sort((a, b) => Number(a.priceKans) - Number(b.priceKans));
    } else if (sort === "price_desc") {
      filtered = filtered.sort((a, b) => Number(b.priceKans) - Number(a.priceKans));
    } else if (sort === "ovr_desc") {
      filtered = filtered.sort(
        (a, b) => (b.userCard?.baseOverall ?? 0) - (a.userCard?.baseOverall ?? 0)
      );
    }

    res.json({ listings: filtered });
  } catch (err) {
    console.error("Get market listings error:", err);
    res.status(500).json({ error: "Gagal memuat daftar Marketplace" });
  }
}

/**
 * Verifikasi listing baru langsung ke Smart Contract CardMarketplace lalu simpan cache ke DB.
 */
export async function syncListing(req: AuthRequest, res: Response) {
  try {
    const parsed = listingSyncSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "listingId tidak valid" });
      return;
    }

    const onChain = await fetchOnChainListing(parsed.data.listingId);
    if (!onChain.active) {
      res.status(400).json({ error: "Listing ini tidak aktif di blockchain" });
      return;
    }

    const card = await prisma.userCard.findUnique({ where: { tokenId: onChain.tokenId } });
    if (card) {
      // Pastikan kartu yang dijual otomatis dicopot dari Starting XI
      await prisma.lineupSlot.deleteMany({ where: { userCardId: card.id } });
      await prisma.userCard.update({
        where: { id: card.id },
        data: { isListed: true },
      });
    }

    const saved = await prisma.marketListing.upsert({
      where: { listingId: onChain.listingId },
      update: {
        priceKans: onChain.priceKans,
        status: "ACTIVE",
        sellerWallet: onChain.seller,
        userCardId: card?.id ?? null,
      },
      create: {
        listingId: onChain.listingId,
        tokenId: onChain.tokenId,
        userCardId: card?.id ?? null,
        sellerWallet: onChain.seller,
        priceKans: onChain.priceKans,
        status: "ACTIVE",
      },
    });

    res.json({ message: "Listing berhasil disinkronkan dari blockchain!", listing: saved });
  } catch (err) {
    console.error("Sync listing error:", err);
    res.status(500).json({ error: "Gagal memverifikasi listing di blockchain" });
  }
}

/**
 * Verifikasi pembelian kartu langsung ke blockchain dan pindahkan kepemilikan kartu di DB.
 */
export async function syncSale(req: AuthRequest, res: Response) {
  try {
    const parsed = listingSyncSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "listingId tidak valid" });
      return;
    }

    const onChain = await fetchOnChainListing(parsed.data.listingId);
    if (onChain.active) {
      res.status(400).json({ error: "Listing masih aktif di blockchain (belum terjual)" });
      return;
    }

    const cardMeta = await fetchOnChainCard(onChain.tokenId);
    const buyerUser = await prisma.user.findUnique({
      where: { walletAddress: cardMeta.owner },
    });

    await prisma.marketListing.updateMany({
      where: { listingId: onChain.listingId },
      data: { status: "SOLD", buyerWallet: cardMeta.owner },
    });

    const existingCard = await prisma.userCard.findUnique({
      where: { tokenId: onChain.tokenId },
    });

    if (existingCard && buyerUser) {
      await prisma.lineupSlot.deleteMany({ where: { userCardId: existingCard.id } });
      await prisma.userCard.update({
        where: { id: existingCard.id },
        data: { userId: buyerUser.id, isListed: false, isOnChain: true },
      });
    } else if (!existingCard && buyerUser) {
      await prisma.userCard.create({
        data: {
          userId: buyerUser.id,
          playerId: cardMeta.playerId,
          position: cardMeta.position,
          baseOverall: cardMeta.baseOverall,
          level: cardMeta.level,
          rarity: cardMeta.rarity,
          edition: cardMeta.edition,
          season: cardMeta.season,
          isOnChain: true,
          tokenId: cardMeta.tokenId,
          isListed: false,
        },
      });
    }

    res.json({
      message: "Pembelian terverifikasi On-Chain! Kartu sudah masuk ke Squad pembeli.",
      newOwner: cardMeta.owner,
    });
  } catch (err) {
    console.error("Sync sale error:", err);
    res.status(500).json({ error: "Gagal memverifikasi pembelian di blockchain" });
  }
}

export async function syncCancel(req: AuthRequest, res: Response) {
  try {
    const parsed = listingSyncSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "listingId tidak valid" });
      return;
    }

    const onChain = await fetchOnChainListing(parsed.data.listingId);
    if (onChain.active) {
      res.status(400).json({ error: "Listing masih aktif di blockchain" });
      return;
    }

    await prisma.marketListing.updateMany({
      where: { listingId: onChain.listingId },
      data: { status: "CANCELED" },
    });

    await prisma.userCard.updateMany({
      where: { tokenId: onChain.tokenId },
      data: { isListed: false },
    });

    res.json({ message: "Pembatalan listing berhasil disinkronkan!" });
  } catch (err) {
    console.error("Sync cancel error:", err);
    res.status(500).json({ error: "Gagal memverifikasi pembatalan listing" });
  }
}

export async function faucetTestKans(req: AuthRequest, res: Response) {
  try {
    const walletAddress = req.user!.walletAddress!;
    const result = await mintTestKansFaucet(walletAddress, "1000");
    res.json({
      message: `Berhasil klaim ${result.amountKans} Test KANS ke dompet Anda!`,
      ...result,
    });
  } catch (err: any) {
    console.error("Faucet KANS error:", err);
    res.status(500).json({ error: err.message || "Gagal mencetak Test KANS" });
  }
}

/**
 * Endpoint Metadata Standar ERC-721: GET /api/metadata/:tokenId
 */
export async function getTokenMetadata(req: Request, res: Response) {
  try {
    const tokenId = Number(req.params.tokenId);
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
      res.status(400).json({ error: "Token ID tidak valid" });
      return;
    }

    const onChain = await fetchOnChainCard(tokenId);
    const player = await prisma.player.findUnique({
      where: { id: onChain.playerId },
      include: { club: true },
    });

    const playerName = player?.name || `Player #${onChain.playerId}`;
    res.json({
      name: `${playerName} #${tokenId} [${onChain.rarity}]`,
      description: `W3 Football Manager Official On-Chain Card (${onChain.edition} - Season ${onChain.season})`,
      image:
        player?.photoUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&background=0f172a&color=10b981&size=512&bold=true`,
      attributes: [
        { trait_type: "Position", value: onChain.position },
        { trait_type: "Overall", value: onChain.baseOverall },
        { trait_type: "Level", value: onChain.level },
        { trait_type: "Rarity", value: onChain.rarity },
        { trait_type: "Edition", value: onChain.edition },
        { trait_type: "Season", value: onChain.season },
        { trait_type: "Club", value: player?.club.name || "Global FC" },
        { trait_type: "League", value: player?.club.leagueName || "World League" },
      ],
    });
  } catch {
    res.status(404).json({ error: "Metadata Token ID tidak ditemukan di blockchain" });
  }
}
