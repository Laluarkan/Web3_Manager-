import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { FORMATION_433_SLOTS } from "../config/constants";
import { AuthRequest } from "../middlewares/auth.middleware";
import { generateStarterPackForUser } from "../services/starter.service";
import {
  fetchOnChainCardsOfOwner,
  signStarterPackVoucher,
  upgradeOnChainCardLevel,
} from "../services/blockchain.service";

const updateLineupSchema = z.object({
  slots: z
    .array(
      z.object({
        slotCode: z.string(),
        userCardId: z.string(),
      })
    )
    .length(11, "Formasi 4-3-3 harus berisi tepat 11 pemain"),
});

const freeMatchSchema = z.object({
  difficulty: z.enum(["AMATEUR", "PRO", "WORLD_CLASS"]).default("AMATEUR"),
  tactic: z.enum(["ATTACKING", "BALANCED", "DEFENSIVE"]).default("BALANCED"),
});

const FORM_BONUS: Record<string, number> = {
  A: 3,
  B: 1,
  C: 0,
  D: -2,
  E: -4,
};

export async function getSquad(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const [cards, lineup] = await Promise.all([
      prisma.userCard.findMany({
        where: { userId },
        include: { player: { include: { club: true } } },
        orderBy: [{ baseOverall: "desc" }, { createdAt: "asc" }],
      }),
      prisma.lineup.findUnique({
        where: { userId },
        include: {
          slots: {
            include: {
              userCard: { include: { player: { include: { club: true } } } },
            },
          },
        },
      }),
    ]);

    const slots = lineup?.slots ?? [];
    const teamOverall =
      slots.length > 0
        ? Math.round(
            slots.reduce((acc, s) => acc + s.userCard.baseOverall + (s.userCard.level - 1), 0) /
              slots.length
          )
        : 0;

    const unclaimedStarterCount = cards.filter((c) => !c.isOnChain).length;

    res.json({
      formation: lineup?.formation || "4-3-3",
      teamOverall,
      hasClaimedStarter: req.user!.hasClaimedStarter,
      unclaimedStarterCount,
      slots,
      cards,
    });
  } catch (err) {
    console.error("Get squad error:", err);
    res.status(500).json({ error: "Gagal mengambil data skuad" });
  }
}

export async function claimStarterPack(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user?.hasClaimedStarter) {
      res.status(400).json({ error: "Anda sudah pernah mengklaim Starter Pack!" });
      return;
    }

    const { cards, gotLuckyEpic } = await generateStarterPackForUser(userId);
    res.status(201).json({
      message: gotLuckyEpic
        ? "Starter Pack 11 Kartu (4-3-3) diterima! Selamat, Anda hoki mendapat 1 kartu EPIC!"
        : "Starter Pack 11 Kartu (4-3-3) diterima (termasuk 1 kartu RARE)!",
      gotLuckyEpic,
      cards,
    });
  } catch (err: any) {
    console.error("Claim starter pack error:", err);
    res.status(500).json({ error: err.message || "Gagal membuat Starter Pack" });
  }
}

export async function requestStarterVoucher(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const walletAddress = req.user!.walletAddress!;

    const starterCards = await prisma.userCard.findMany({
      where: { userId, isOnChain: false },
      orderBy: { createdAt: "asc" },
    });

    if (starterCards.length !== 11) {
      res.status(400).json({
        error:
          starterCards.length === 0
            ? "Semua kartu Starter Pack sudah berada On-Chain di dompet Anda."
            : "Jumlah kartu Starter Pack belum lengkap 11 kartu.",
      });
      return;
    }

    const voucher = await signStarterPackVoucher(walletAddress, starterCards);
    res.json({
      message: "Voucher EIP-712 siap! Konfirmasi di MetaMask untuk mencetak 11 NFT sekaligus.",
      voucher,
    });
  } catch (err: any) {
    console.error("Request starter voucher error:", err);
    res.status(500).json({ error: err.message || "Gagal membuat voucher minting" });
  }
}

export async function confirmStarterOnChain(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const walletAddress = req.user!.walletAddress!;

    // Verifikasi langsung ke blockchain (jangan percaya input client mentah)
    const onChainCards = await fetchOnChainCardsOfOwner(walletAddress);
    if (onChainCards.length === 0) {
      res.status(400).json({
        error: "Belum ditemukan kartu NFT di dompet Anda pada blockchain.",
      });
      return;
    }

    const offChainCards = await prisma.userCard.findMany({
      where: { userId, isOnChain: false },
      orderBy: { createdAt: "asc" },
    });

    const usedTokenIds = new Set<number>();
    let matchedCount = 0;

    for (const dbCard of offChainCards) {
      const match = onChainCards.find(
        (c) =>
          !usedTokenIds.has(c.tokenId) &&
          c.playerId === dbCard.playerId &&
          c.rarity === dbCard.rarity
      );
      if (match) {
        usedTokenIds.add(match.tokenId);
        await prisma.userCard.update({
          where: { id: dbCard.id },
          data: { isOnChain: true, tokenId: match.tokenId },
        });
        matchedCount++;
      }
    }

    res.json({
      message: `${matchedCount} kartu Starter Pack berhasil terverifikasi On-Chain di dompet Anda!`,
      matchedCount,
      totalOnChain: onChainCards.length,
    });
  } catch (err: any) {
    console.error("Confirm starter on-chain error:", err);
    res.status(500).json({
      error: "Gagal memverifikasi blockchain. Pastikan node Hardhat & kontrak sudah berjalan.",
    });
  }
}

export async function syncWalletCards(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const walletAddress = req.user!.walletAddress!;

    const onChainCards = await fetchOnChainCardsOfOwner(walletAddress);
    const onChainTokenSet = new Set(onChainCards.map((c) => c.tokenId));

    // 1. Pastikan setiap NFT yang dimiliki wallet ada di tabel UserCard milik user ini
    for (const c of onChainCards) {
      const existingByToken = await prisma.userCard.findUnique({
        where: { tokenId: c.tokenId },
      });

      if (existingByToken) {
        if (existingByToken.userId !== userId) {
          // Kartu berpindah pemilik (misal dari transfer MetaMask / pembelian)
          await prisma.lineupSlot.deleteMany({ where: { userCardId: existingByToken.id } });
          await prisma.userCard.update({
            where: { id: existingByToken.id },
            data: { userId, isOnChain: true, isListed: false, level: c.level },
          });
        } else if (existingByToken.level !== c.level) {
          await prisma.userCard.update({
            where: { id: existingByToken.id },
            data: { level: c.level },
          });
        }
      } else {
        // Cek apakah ini kartu Starter Pack off-chain yang baru di-mint
        const matchingOffChain = await prisma.userCard.findFirst({
          where: { userId, isOnChain: false, playerId: c.playerId, rarity: c.rarity },
        });

        if (matchingOffChain) {
          await prisma.userCard.update({
            where: { id: matchingOffChain.id },
            data: { isOnChain: true, tokenId: c.tokenId, level: c.level },
          });
        } else {
          const playerExists = await prisma.player.findUnique({ where: { id: c.playerId } });
          if (playerExists) {
            await prisma.userCard.create({
              data: {
                userId,
                playerId: c.playerId,
                position: c.position,
                baseOverall: c.baseOverall,
                level: c.level,
                rarity: c.rarity,
                edition: c.edition,
                season: c.season,
                isOnChain: true,
                tokenId: c.tokenId,
                isListed: false,
              },
            });
          }
        }
      }
    }

    // 2. Hapus dari Lineup jika ada kartu on-chain lama yang sudah tidak dimiliki wallet ini
    const userOnChainCards = await prisma.userCard.findMany({
      where: { userId, isOnChain: true, tokenId: { not: null } },
    });

    for (const card of userOnChainCards) {
      if (card.tokenId !== null && !onChainTokenSet.has(card.tokenId)) {
        await prisma.lineupSlot.deleteMany({ where: { userCardId: card.id } });
        await prisma.userCard.delete({ where: { id: card.id } });
      }
    }

    res.json({
      message: `Sinkronisasi selesai! Ditemukan ${onChainCards.length} kartu NFT di dompet Anda.`,
      totalOnChain: onChainCards.length,
    });
  } catch (err) {
    console.error("Sync wallet cards error:", err);
    res.status(500).json({ error: "Gagal sinkronisasi NFT dari blockchain" });
  }
}

export async function updateLineup(req: AuthRequest, res: Response) {
  try {
    const parsed = updateLineupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const userId = req.user!.id;
    const slotMap = new Map(FORMATION_433_SLOTS.map((s) => [s.slotCode as string, s.requiredPosition]));
    const seenSlots = new Set<string>();
    const seenCardIds = new Set<string>();

    for (const item of parsed.data.slots) {
      if (!slotMap.has(item.slotCode) || seenSlots.has(item.slotCode)) {
        res.status(400).json({ error: `Slot formasi 4-3-3 tidak valid: ${item.slotCode}` });
        return;
      }
      if (seenCardIds.has(item.userCardId)) {
        res.status(400).json({ error: "Satu kartu tidak boleh dipasang di dua posisi sekaligus" });
        return;
      }
      seenSlots.add(item.slotCode);
      seenCardIds.add(item.userCardId);
    }

    const ownedCards = await prisma.userCard.findMany({
      where: { userId, id: { in: Array.from(seenCardIds) } },
    });
    if (ownedCards.length !== 11) {
      res.status(400).json({ error: "Ada kartu yang tidak valid atau bukan milik Anda" });
      return;
    }

    const cardById = new Map(ownedCards.map((c) => [c.id, c]));
    for (const item of parsed.data.slots) {
      const card = cardById.get(item.userCardId)!;
      if (card.isListed) {
        res.status(400).json({ error: "Kartu yang sedang dijual di Marketplace tidak bisa dimainkan" });
        return;
      }
      const requiredPos = slotMap.get(item.slotCode)!;
      if (card.position !== requiredPos) {
        res.status(400).json({
          error: `Slot ${item.slotCode} membutuhkan posisi ${requiredPos}, bukan ${card.position}`,
        });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      const lineup = await tx.lineup.upsert({
        where: { userId },
        update: { formation: "4-3-3" },
        create: { userId, formation: "4-3-3" },
      });

      await tx.lineupSlot.deleteMany({ where: { lineupId: lineup.id } });
      for (const item of parsed.data.slots) {
        await tx.lineupSlot.create({
          data: {
            lineupId: lineup.id,
            slotCode: item.slotCode,
            userCardId: item.userCardId,
          },
        });
      }
    });

    res.json({ message: "Formasi 4-3-3 berhasil disimpan!" });
  } catch (err) {
    console.error("Update lineup error:", err);
    res.status(500).json({ error: "Gagal menyimpan lineup" });
  }
}

/**
 * Mode Permainan Gratis (Tanpa Wallet & Tanpa Koin) — Pure Football Manager PvE.
 */
export async function playFreeMatch(req: AuthRequest, res: Response) {
  try {
    const parsed = freeMatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Parameter pertandingan tidak valid" });
      return;
    }

    const userId = req.user!.id;
    const lineup = await prisma.lineup.findUnique({
      where: { userId },
      include: {
        slots: {
          include: { userCard: { include: { player: true } } },
        },
      },
    });

    if (!lineup || lineup.slots.length !== 11) {
      res.status(400).json({ error: "Lengkapi 11 pemain di formasi 4-3-3 terlebih dahulu!" });
      return;
    }

    const { difficulty, tactic } = parsed.data;
    const opponents = {
      AMATEUR: { name: "Nusantara Youth FC", rating: 68, winPoints: 15 },
      PRO: { name: "Europa Select XI", rating: 76, winPoints: 30 },
      WORLD_CLASS: { name: "Galacticos All-Star", rating: 84, winPoints: 50 },
    };
    const opp = opponents[difficulty];

    // Hitung kekuatan tim berdasarkan OVR kartu + level + Live Form mingguan
    const effectivePower =
      lineup.slots.reduce((sum, s) => {
        const formMod = FORM_BONUS[s.userCard.player.liveForm] ?? 0;
        return sum + s.userCard.baseOverall + (s.userCard.level - 1) + formMod;
      }, 0) / 11;

    const myRating = Math.round(effectivePower);
    const diff = myRating - opp.rating;

    // Taktik memengaruhi gaya skor (Attacking = lebih banyak gol & kebobolan, Defensive = ketat)
    const attackMod = tactic === "ATTACKING" ? 1 : tactic === "DEFENSIVE" ? -1 : 0;
    const myGoals = Math.max(
      0,
      Math.round(1.3 + diff * 0.08 + attackMod * 0.5 + (Math.random() * 2.4 - 0.8))
    );
    const oppGoals = Math.max(
      0,
      Math.round(1.2 - diff * 0.06 + attackMod * 0.4 + (Math.random() * 2.2 - 0.8))
    );

    const outcome = myGoals > oppGoals ? "WIN" : myGoals < oppGoals ? "LOSE" : "DRAW";
    const earnedPoints =
      outcome === "WIN" ? opp.winPoints : outcome === "DRAW" ? Math.floor(opp.winPoints / 3) : 5;

    // Pilih pencetak gol dari pemain FW/MF di lineup
    const attackers = lineup.slots
      .map((s) => s.userCard.player)
      .filter((p) => p.position === "FW" || p.position === "MF");
    const scorers: string[] = [];
    for (let g = 0; g < myGoals; g++) {
      const scorer = attackers[Math.floor(Math.random() * attackers.length)];
      const minute = Math.floor(Math.random() * 88) + 2;
      scorers.push(`${scorer?.name || "Striker"} (${minute}')`);
    }

    const possession = Math.min(68, Math.max(35, 50 + Math.round(diff * 0.7) + (tactic === "BALANCED" ? 3 : 0)));

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        freeMatchPlayed: { increment: 1 },
        freeMatchWins: outcome === "WIN" ? { increment: 1 } : undefined,
        freeMatchPoints: { increment: earnedPoints },
      },
      select: {
        freeMatchPlayed: true,
        freeMatchWins: true,
        freeMatchPoints: true,
      },
    });

    res.json({
      mode: "FREE_TO_PLAY",
      opponent: opp.name,
      opponentRating: opp.rating,
      myRating,
      tactic,
      score: { myGoals, oppGoals },
      outcome,
      possession: { my: possession, opp: 100 - possession },
      scorers,
      earnedPoints,
      stats: updatedUser,
    });
  } catch (err) {
    console.error("Free match error:", err);
    res.status(500).json({ error: "Gagal menjalankan simulasi pertandingan" });
  }
}

/**
 * Training / Level Up Kartu (Level 1 -> 10) memakai Poin Manager (EXP).
 * Jika kartu sudah On-Chain NFT, level juga langsung dinaikkan di Smart Contract!
 */
export async function upgradeCard(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const cardId = String(req.params.cardId);

    const [user, card] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.userCard.findFirst({
        where: { id: cardId, userId },
        include: { player: { include: { club: true } } },
      }),
    ]);

    if (!user || !card) {
      res.status(404).json({ error: "Kartu tidak ditemukan" });
      return;
    }
    if (card.isListed) {
      res.status(400).json({ error: "Kartu yang sedang dijual tidak dapat dilatih" });
      return;
    }
    if (card.level >= 10) {
      res.status(400).json({ error: "Kartu sudah mencapai level maksimal (Lv.10)" });
      return;
    }

    const pointCost = card.level * 30;
    if (user.freeMatchPoints < pointCost) {
      res.status(400).json({
        error: `Poin Manager kurang! Butuh ${pointCost} poin (Anda punya ${user.freeMatchPoints} poin). Main Match Gratis / PvP untuk kumpulkan poin.`,
      });
      return;
    }

    const newLevel = card.level + 1;
    let txHash: string | null = null;

    if (card.isOnChain && card.tokenId) {
      const tx = await upgradeOnChainCardLevel(card.tokenId, newLevel);
      txHash = tx.txHash;
    }

    const [updatedCard, updatedUser] = await prisma.$transaction([
      prisma.userCard.update({
        where: { id: card.id },
        data: { level: newLevel },
        include: { player: { include: { club: true } } },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { freeMatchPoints: { decrement: pointCost } },
        select: { freeMatchPoints: true },
      }),
    ]);

    res.json({
      message: card.isOnChain
        ? `${card.player.name} naik ke Level ${newLevel} (+1 OVR) & tercatat On-Chain!`
        : `${card.player.name} naik ke Level ${newLevel} (+1 OVR)!`,
      card: updatedCard,
      remainingPoints: updatedUser.freeMatchPoints,
      txHash,
    });
  } catch (err: any) {
    console.error("Upgrade card error:", err);
    res.status(500).json({ error: err.message || "Gagal melatih kartu" });
  }
}

/**
 * Daftar klub pemain lain yang siap ditantang di Mode PvP Asynchronous.
 */
export async function getPvpOpponents(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        hasClaimedStarter: true,
      },
      include: {
        lineup: {
          include: {
            slots: {
              include: { userCard: { include: { player: true } } },
            },
          },
        },
      },
      take: 20,
      orderBy: { freeMatchPoints: "desc" },
    });

    const opponents = users
      .filter((u) => (u.lineup?.slots.length ?? 0) === 11)
      .map((u) => {
        const slots = u.lineup!.slots;
        const teamOverall = Math.round(
          slots.reduce((s, slot) => s + slot.userCard.baseOverall + (slot.userCard.level - 1), 0) /
            11
        );
        const starSlot = [...slots].sort(
          (a, b) =>
            b.userCard.baseOverall + b.userCard.level - (a.userCard.baseOverall + a.userCard.level)
        )[0];

        return {
          userId: u.id,
          username: u.username,
          teamOverall,
          wins: u.freeMatchWins,
          played: u.freeMatchPlayed,
          points: u.freeMatchPoints,
          starPlayer: starSlot?.userCard.player.name || "-",
        };
      });

    res.json({ opponents });
  } catch (err) {
    console.error("Get PvP opponents error:", err);
    res.status(500).json({ error: "Gagal memuat daftar lawan PvP" });
  }
}

const pvpMatchSchema = z.object({
  opponentUserId: z.string().min(1),
  tactic: z.enum(["ATTACKING", "BALANCED", "DEFENSIVE"]).default("BALANCED"),
});

/**
 * Simulasi PvP Asynchronous melawan formasi 4-3-3 milik pemain lain.
 */
export async function playPvpMatch(req: AuthRequest, res: Response) {
  try {
    const parsed = pvpMatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Data lawan PvP tidak valid" });
      return;
    }

    const userId = req.user!.id;
    if (parsed.data.opponentUserId === userId) {
      res.status(400).json({ error: "Tidak bisa menantang klub sendiri" });
      return;
    }

    const [myLineup, oppUser] = await Promise.all([
      prisma.lineup.findUnique({
        where: { userId },
        include: { slots: { include: { userCard: { include: { player: true } } } } },
      }),
      prisma.user.findUnique({
        where: { id: parsed.data.opponentUserId },
        include: {
          lineup: {
            include: { slots: { include: { userCard: { include: { player: true } } } } },
          },
        },
      }),
    ]);

    if (!myLineup || myLineup.slots.length !== 11) {
      res.status(400).json({ error: "Lengkapi 11 pemain di formasi 4-3-3 Anda terlebih dahulu" });
      return;
    }
    if (!oppUser?.lineup || oppUser.lineup.slots.length !== 11) {
      res.status(404).json({ error: "Skuad lawan belum siap bertanding" });
      return;
    }

    const calcPower = (slots: typeof myLineup.slots) =>
      Math.round(
        slots.reduce(
          (sum, s) =>
            sum + s.userCard.baseOverall + (s.userCard.level - 1) + (FORM_BONUS[s.userCard.player.liveForm] ?? 0),
          0
        ) / 11
      );

    const myRating = calcPower(myLineup.slots);
    const oppRating = calcPower(oppUser.lineup.slots);
    const diff = myRating - oppRating;
    const { tactic } = parsed.data;
    const attackMod = tactic === "ATTACKING" ? 1 : tactic === "DEFENSIVE" ? -1 : 0;

    const myGoals = Math.max(
      0,
      Math.round(1.3 + diff * 0.09 + attackMod * 0.5 + (Math.random() * 2.4 - 0.8))
    );
    const oppGoals = Math.max(
      0,
      Math.round(1.2 - diff * 0.07 + attackMod * 0.4 + (Math.random() * 2.2 - 0.8))
    );

    const outcome = myGoals > oppGoals ? "WIN" : myGoals < oppGoals ? "LOSE" : "DRAW";
    const earnedPoints = outcome === "WIN" ? 35 : outcome === "DRAW" ? 12 : 5;

    const attackers = myLineup.slots
      .map((s) => s.userCard.player)
      .filter((p) => p.position === "FW" || p.position === "MF");
    const scorers: string[] = [];
    for (let g = 0; g < myGoals; g++) {
      const scorer = attackers[Math.floor(Math.random() * attackers.length)];
      const minute = Math.floor(Math.random() * 88) + 2;
      scorers.push(`${scorer?.name || "Striker"} (${minute}')`);
    }

    const possession = Math.min(68, Math.max(35, 50 + Math.round(diff * 0.7)));

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        freeMatchPlayed: { increment: 1 },
        freeMatchWins: outcome === "WIN" ? { increment: 1 } : undefined,
        freeMatchPoints: { increment: earnedPoints },
      },
      select: { freeMatchPlayed: true, freeMatchWins: true, freeMatchPoints: true },
    });

    res.json({
      mode: "PVP_FREE",
      opponent: oppUser.username,
      opponentRating: oppRating,
      myRating,
      tactic,
      score: { myGoals, oppGoals },
      outcome,
      possession: { my: possession, opp: 100 - possession },
      scorers,
      earnedPoints,
      stats: updatedUser,
    });
  } catch (err) {
    console.error("PvP match error:", err);
    res.status(500).json({ error: "Gagal menjalankan pertandingan PvP" });
  }
}

export async function getManagerLeaderboard(_req: AuthRequest, res: Response) {
  try {
    const managers = await prisma.user.findMany({
      orderBy: [{ freeMatchPoints: "desc" }, { freeMatchWins: "desc" }],
      take: 20,
      select: {
        id: true,
        username: true,
        walletAddress: true,
        freeMatchPlayed: true,
        freeMatchWins: true,
        freeMatchPoints: true,
      },
    });
    res.json({ leaderboard: managers });
  } catch (err) {
    console.error("Get leaderboard error:", err);
    res.status(500).json({ error: "Gagal memuat leaderboard" });
  }
}
