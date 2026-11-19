import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { env } from "../config/env";
import { fetchOnChainCard } from "../services/blockchain.service";

/**
 * 1. Toggle Lock Kartu (Kunci agar tidak menerima tawaran / Not For Sale)
 */
export async function toggleCardLock(req: AuthRequest, res: Response) {
  try {
    const cardId = String(req.params.cardId);
    const userId = req.user!.id;

    const card = await prisma.userCard.findFirst({
      where: { id: cardId, userId },
      include: { player: true },
    });

    if (!card) {
      res.status(404).json({ error: "Kartu tidak ditemukan di klub Anda" });
      return;
    }

    const updated = await prisma.userCard.update({
      where: { id: cardId },
      data: { isLocked: !card.isLocked },
      include: { player: true },
    });

    res.json({
      message: updated.isLocked
        ? `Kartu ${updated.player.name} berhasil DIKUNCI 🔒 (Menolak semua tawaran transfer).`
        : `Kartu ${updated.player.name} telah DIBUKA 🔓 (Siap menerima tawaran dari teman/manajer lain).`,
      isLocked: updated.isLocked,
    });
  } catch (err: any) {
    console.error("Toggle card lock error:", err);
    res.status(500).json({ error: err.message || "Gagal mengubah status kunci kartu" });
  }
}

/**
 * 2. Daftar Manajer / Cari Teman
 */
export async function getManagersList(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user!.id;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        ...(search ? { username: { contains: search } } : {}),
      },
      select: {
        id: true,
        username: true,
        walletAddress: true,
        freeMatchWins: true,
        freeMatchPoints: true,
        freeMatchPlayed: true,
        createdAt: true,
        _count: {
          select: { cards: true },
        },
      },
      take: 20,
      orderBy: { freeMatchPoints: "desc" },
    });

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: currentUserId },
          { receiverId: currentUserId },
        ],
      },
    });

    const enriched = users.map((u) => {
      const friendship = friendships.find(
        (f) =>
          (f.senderId === currentUserId && f.receiverId === u.id) ||
          (f.receiverId === currentUserId && f.senderId === u.id)
      );

      let friendStatus = "NONE";
      if (friendship) {
        if (friendship.status === "ACCEPTED") friendStatus = "ACCEPTED";
        else if (friendship.senderId === currentUserId) friendStatus = "PENDING_SENT";
        else friendStatus = "PENDING_RECEIVED";
      }

      return {
        ...u,
        cardCount: u._count.cards,
        friendStatus,
        friendshipId: friendship?.id,
      };
    });

    res.json({ managers: enriched });
  } catch (err: any) {
    console.error("Get managers error:", err);
    res.status(500).json({ error: "Gagal memuat daftar manajer" });
  }
}

/**
 * 3. Kunjungi & Lihat Lineup 4-3-3 Manajer Lain (Read-Only)
 */
export async function getManagerLineup(req: Request, res: Response) {
  try {
    const username = String(req.params.username);

    const user = await prisma.user.findFirst({
      where: { username },
      select: {
        id: true,
        username: true,
        walletAddress: true,
        freeMatchWins: true,
        freeMatchPoints: true,
        lineup: {
          include: {
            slots: {
              include: {
                userCard: {
                  include: {
                    player: { include: { club: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "Manajer tidak ditemukan" });
      return;
    }

    res.json({
      manager: {
        id: user.id,
        username: user.username,
        walletAddress: user.walletAddress,
        freeMatchWins: user.freeMatchWins,
        freeMatchPoints: user.freeMatchPoints,
      },
      lineup: user.lineup,
    });
  } catch (err: any) {
    console.error("Get manager lineup error:", err);
    res.status(500).json({ error: "Gagal memuat lineup manajer" });
  }
}

/**
 * 4. Kirim & Respons Permintaan Pertemanan
 */
export async function sendFriendRequest(req: AuthRequest, res: Response) {
  try {
    const senderId = req.user!.id;
    const receiverId = String(req.body.receiverId);

    if (!receiverId || senderId === receiverId) {
      res.status(400).json({ error: "Target teman tidak valid" });
      return;
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      res.status(400).json({ error: "Permintaan pertemanan sudah ada sebelumnya" });
      return;
    }

    const friendship = await prisma.friendship.create({
      data: { senderId, receiverId, status: "PENDING" },
    });

    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: "Permintaan Pertemanan Baru 👥",
        message: `Coach ${req.user!.username} mengirimkan permintaan pertemanan kepada Anda.`,
        type: "FRIEND_REQUEST",
        link: "/social",
      },
    });

    res.json({ message: "Permintaan pertemanan terkirim!", friendship });
  } catch (err: any) {
    console.error("Send friend request error:", err);
    res.status(500).json({ error: "Gagal mengirim permintaan pertemanan" });
  }
}

export async function respondFriendRequest(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const friendshipId = String(req.body.friendshipId);
    const action = req.body.action; // 'ACCEPT' | 'REJECT'

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
      include: { sender: true },
    });

    if (!friendship || friendship.receiverId !== userId) {
      res.status(404).json({ error: "Permintaan tidak ditemukan" });
      return;
    }

    if (action === "ACCEPT") {
      await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: "ACCEPTED" },
      });

      await prisma.notification.create({
        data: {
          userId: friendship.senderId,
          title: "Pertemanan Diterima! 🤝",
          message: `Coach ${req.user!.username} sekarang berteman dengan Anda. Intip skuadnya di Komunitas!`,
          type: "FRIEND_ACCEPTED",
          link: `/social/lineup/${req.user!.username}`,
        },
      });

      res.json({ message: "Permintaan pertemanan diterima!" });
    } else {
      await prisma.friendship.delete({ where: { id: friendshipId } });
      res.json({ message: "Permintaan pertemanan ditolak." });
    }
  } catch (err: any) {
    console.error("Respond friend request error:", err);
    res.status(500).json({ error: "Gagal memproses pertemanan" });
  }
}

/**
 * 5. Kirim Tawaran Harga Awal (Buyer Makes Offer)
 */
export async function createCardOffer(req: AuthRequest, res: Response) {
  try {
    const buyerId = req.user!.id;
    const buyerWallet = req.user!.walletAddress;
    const cardId = String(req.body.cardId);
    const priceKans = req.body.priceKans;

    if (!buyerWallet) {
      res.status(400).json({ error: "Hubungkan MetaMask Anda terlebih dahulu untuk menawar kartu." });
      return;
    }

    const priceNum = Number(priceKans);
    if (!priceNum || priceNum <= 0) {
      res.status(400).json({ error: "Nominal tawaran KANS tidak valid" });
      return;
    }

    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: { user: true, player: true },
    });

    if (!card) {
      res.status(404).json({ error: "Kartu pemain tidak ditemukan" });
      return;
    }

    if (card.userId === buyerId) {
      res.status(400).json({ error: "Anda tidak bisa menawar kartu Anda sendiri" });
      return;
    }

    if (card.isLocked) {
      res.status(400).json({
        error: "🔒 Kartu ini telah DIKUNCI oleh pemiliknya dan tidak menerima tawaran transfer.",
      });
      return;
    }

    if (!card.isOnChain || !card.tokenId) {
      res.status(400).json({
        error: "Kartu ini belum dicetak on-chain (NFT) oleh pemiliknya.",
      });
      return;
    }

    const existingActive = await prisma.cardOffer.findFirst({
      where: {
        cardId,
        buyerId,
        status: { in: ["PENDING", "COUNTERED", "ACCEPTED"] },
      },
    });

    if (existingActive) {
      res.status(400).json({
        error: "Anda sudah memiliki tawaran aktif untuk kartu ini. Periksa riwayat negosiasi Anda.",
      });
      return;
    }

    const history = [
      {
        by: buyerId,
        username: req.user!.username,
        action: "OFFER",
        priceKans: String(priceNum),
        timestamp: new Date().toISOString(),
      },
    ];

    const offer = await prisma.cardOffer.create({
      data: {
        cardId,
        sellerId: card.userId,
        buyerId,
        priceKans: String(priceNum),
        status: "PENDING",
        lastActionBy: buyerId,
        history: JSON.stringify(history),
      },
      include: {
        card: { include: { player: { include: { club: true } } } },
        buyer: { select: { id: true, username: true, walletAddress: true } },
        seller: { select: { id: true, username: true, walletAddress: true } },
      },
    });

    await prisma.notification.create({
      data: {
        userId: card.userId,
        title: "Tawaran Transfer Baru! ⚽",
        message: `Coach ${req.user!.username} menawar ${card.player.name} seharga ${priceNum} KANS.`,
        type: "OFFER_RECEIVED",
        link: "/social?tab=offers",
      },
    });

    res.json({ message: "Tawaran berhasil dikirim ke pemilik kartu!", offer });
  } catch (err: any) {
    console.error("Create card offer error:", err);
    res.status(500).json({ error: err.message || "Gagal mengirim tawaran kartu" });
  }
}

/**
 * 6. Tawar Balik (Counter-Offer)
 */
export async function counterCardOffer(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const offerId = String(req.params.offerId);
    const priceNum = Number(req.body.priceKans);

    if (!priceNum || priceNum <= 0) {
      res.status(400).json({ error: "Nominal tawaran balik tidak valid" });
      return;
    }

    const offer = await prisma.cardOffer.findUnique({
      where: { id: offerId },
      include: {
        card: { include: { player: true } },
        buyer: true,
        seller: true,
      },
    });

    if (!offer || (offer.sellerId !== userId && offer.buyerId !== userId)) {
      res.status(404).json({ error: "Tawaran tidak ditemukan" });
      return;
    }

    if (offer.status !== "PENDING" && offer.status !== "COUNTERED") {
      res.status(400).json({ error: "Tawaran ini sudah tidak dalam tahap negosiasi" });
      return;
    }

    if (offer.lastActionBy === userId) {
      res.status(400).json({ error: "Menunggu respons dari pihak lawan terlebih dahulu." });
      return;
    }

    const history = JSON.parse(offer.history || "[]");
    history.push({
      by: userId,
      username: req.user!.username,
      action: "COUNTER",
      priceKans: String(priceNum),
      timestamp: new Date().toISOString(),
    });

    const targetUserId = offer.sellerId === userId ? offer.buyerId : offer.sellerId;

    const updated = await prisma.cardOffer.update({
      where: { id: offerId },
      data: {
        priceKans: String(priceNum),
        status: "COUNTERED",
        lastActionBy: userId,
        history: JSON.stringify(history),
      },
      include: {
        card: { include: { player: { include: { club: true } } } },
        buyer: true,
        seller: true,
      },
    });

    await prisma.notification.create({
      data: {
        userId: targetUserId,
        title: "Tawar Balik Transfer! 🔄",
        message: `Coach ${req.user!.username} menawar balik seharga ${priceNum} KANS untuk ${offer.card.player.name}.`,
        type: "OFFER_COUNTERED",
        link: "/social?tab=offers",
      },
    });

    res.json({ message: "Tawaran balik berhasil dikirim!", offer: updated });
  } catch (err: any) {
    console.error("Counter offer error:", err);
    res.status(500).json({ error: err.message || "Gagal melakukan tawar balik" });
  }
}

/**
 * 7. Tolak atau Terima Kesepakatan (Deal Agreement)
 */
export async function respondCardOffer(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const offerId = String(req.params.offerId);
    const action = req.body.action; // 'ACCEPT' | 'REJECT'

    const offer = await prisma.cardOffer.findUnique({
      where: { id: offerId },
      include: {
        card: { include: { player: true } },
        buyer: true,
        seller: true,
      },
    });

    if (!offer || (offer.sellerId !== userId && offer.buyerId !== userId)) {
      res.status(404).json({ error: "Tawaran tidak ditemukan" });
      return;
    }

    if (action === "REJECT") {
      const history = JSON.parse(offer.history || "[]");
      history.push({
        by: userId,
        username: req.user!.username,
        action: "REJECT",
        timestamp: new Date().toISOString(),
      });

      const updated = await prisma.cardOffer.update({
        where: { id: offerId },
        data: { status: "REJECTED", history: JSON.stringify(history) },
      });

      const targetUserId = offer.sellerId === userId ? offer.buyerId : offer.sellerId;
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: "Tawaran Ditolak ❌",
          message: `Coach ${req.user!.username} menolak tawaran transfer untuk ${offer.card.player.name}.`,
          type: "OFFER_REJECTED",
          link: "/social?tab=offers",
        },
      });

      res.json({ message: "Tawaran berhasil ditolak", offer: updated });
      return;
    }

    // Jika ACCEPT:
    const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 jam batas deal

    const history = JSON.parse(offer.history || "[]");
    history.push({
      by: userId,
      username: req.user!.username,
      action: "AGREE_DEAL",
      priceKans: offer.priceKans,
      timestamp: new Date().toISOString(),
    });

    const typedData = {
      domain: {
        name: "W3CardMarketplace",
        version: "1",
        chainId: env.chainId,
        verifyingContract: env.marketplaceAddress,
      },
      types: {
        PrivateDeal: [
          { name: "seller", type: "address" },
          { name: "buyer", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "price", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "PrivateDeal",
      message: {
        seller: offer.seller.walletAddress,
        buyer: offer.buyer.walletAddress,
        tokenId: offer.card.tokenId,
        price: offer.priceKans,
        nonce,
        deadline,
      },
    };

    res.json({
      message: "Kesepakatan tercapai! Silakan tanda tangani voucher kesepakatan.",
      typedData,
      nonce,
      deadline,
    });
  } catch (err: any) {
    console.error("Respond offer error:", err);
    res.status(500).json({ error: err.message || "Gagal merespons tawaran" });
  }
}

/**
 * 8. Simpan Tanda Tangan Penjual untuk Deal On-Chain
 */
export async function saveSellerDealSignature(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const offerId = String(req.params.offerId);
    const { sellerSignature, nonce, deadline } = req.body;

    const offer = await prisma.cardOffer.findUnique({
      where: { id: offerId },
      include: { card: { include: { player: true } }, buyer: true, seller: true },
    });

    if (!offer || offer.sellerId !== userId) {
      res.status(403).json({ error: "Hanya penjual kartu yang dapat menandatangani pelepasan aset." });
      return;
    }

    const history = JSON.parse(offer.history || "[]");
    history.push({
      by: userId,
      username: req.user!.username,
      action: "SELLER_SIGNED",
      timestamp: new Date().toISOString(),
    });

    const updated = await prisma.cardOffer.update({
      where: { id: offerId },
      data: {
        status: "ACCEPTED",
        sellerSignature,
        nonce: Number(nonce),
        deadline: Number(deadline),
        history: JSON.stringify(history),
      },
    });

    await prisma.notification.create({
      data: {
        userId: offer.buyerId,
        title: "Kesepakatan Deal Siap Dieksekusi! 🚀",
        message: `Coach ${req.user!.username} sudah menandatangani penjualan ${offer.card.player.name} (${offer.priceKans} KANS). Selesaikan transaksi kapan pun Anda siap!`,
        type: "OFFER_ACCEPTED",
        link: "/social?tab=offers",
      },
    });

    res.json({
      message: "Tanda tangan kesepakatan tersimpan! Pembeli dapat mengeksekusi transfer on-chain kapan saja.",
      offer: updated,
    });
  } catch (err: any) {
    console.error("Save seller signature error:", err);
    res.status(500).json({ error: err.message || "Gagal menyimpan tanda tangan kesepakatan" });
  }
}

/**
 * 9. Konfirmasi Deal On-Chain Setelah Pembeli Bayar
 */
export async function confirmDealExecuted(req: AuthRequest, res: Response) {
  try {
    const offerId = String(req.params.offerId);

    const offer = await prisma.cardOffer.findUnique({
      where: { id: offerId },
      include: {
        card: { include: { player: true } },
        buyer: true,
        seller: true,
      },
    });

    if (!offer || !offer.card.tokenId) {
      res.status(404).json({ error: "Kesepakatan tidak valid" });
      return;
    }

    const onChain = await fetchOnChainCard(offer.card.tokenId);
    if (onChain.owner.toLowerCase() !== (offer.buyer.walletAddress || "").toLowerCase()) {
      res.status(400).json({
        error: "Kartu NFT belum terdeteksi berpindah ke dompet pembeli di blockchain.",
      });
      return;
    }

    await prisma.$transaction([
      prisma.userCard.update({
        where: { id: offer.cardId },
        data: {
          userId: offer.buyerId,
          isListed: false,
          isLocked: false,
        },
      }),
      prisma.lineupSlot.deleteMany({
        where: { userCardId: offer.cardId },
      }),
      prisma.cardOffer.update({
        where: { id: offerId },
        data: { status: "COMPLETED" },
      }),
      prisma.notification.create({
        data: {
          userId: offer.sellerId,
          title: "Kartu Berhasil Terjual! 💰",
          message: `${offer.card.player.name} resmi terjual ke Coach ${offer.buyer.username} seharga ${offer.priceKans} KANS. Koin sudah masuk ke dompet Anda!`,
          type: "DEAL_COMPLETED",
          link: "/squad",
        },
      }),
    ]);

    res.json({ message: "Transaksi berhasil diselesaikan! Kartu resmi masuk ke skuad Anda." });
  } catch (err: any) {
    console.error("Confirm deal error:", err);
    res.status(500).json({ error: err.message || "Gagal mengonfirmasi kesepakatan transfer" });
  }
}

/**
 * 10. Ambil Notifikasi & Penawaran User
 */
export async function getOffers(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const incoming = await prisma.cardOffer.findMany({
      where: { sellerId: userId },
      include: {
        card: { include: { player: { include: { club: true } } } },
        buyer: { select: { id: true, username: true, walletAddress: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const outgoing = await prisma.cardOffer.findMany({
      where: { buyerId: userId },
      include: {
        card: { include: { player: { include: { club: true } } } },
        seller: { select: { id: true, username: true, walletAddress: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ incoming, outgoing });
  } catch (err: any) {
    console.error("Get offers error:", err);
    res.status(500).json({ error: "Gagal memuat daftar tawaran" });
  }
}

export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({ notifications, unreadCount });
  } catch (err: any) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: "Gagal memuat notifikasi" });
  }
}

export async function markNotificationsRead(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: "Semua notifikasi ditandai sudah dibaca" });
  } catch (err: any) {
    console.error("Mark notifications read error:", err);
    res.status(500).json({ error: "Gagal memperbarui notifikasi" });
  }
}
