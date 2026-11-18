import { prisma } from "../config/prisma";
import { FORMATION_433_SLOTS } from "../config/constants";

function pickRandomUnique<T>(items: T[], count: number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/**
 * Menghitung OVR dasar kartu sesuai tier rarity Starter Pack:
 * - COMMON: 64 - 74
 * - RARE  : 75 - 81
 * - EPIC  : 82 - 87
 */
function calculateStarterOverall(playerOvr: number, rarity: string): number {
  if (rarity === "EPIC") {
    return Math.min(87, Math.max(82, playerOvr));
  }
  if (rarity === "RARE") {
    return Math.min(81, Math.max(75, Math.min(playerOvr, 81)));
  }
  // COMMON: kartu biasa
  return Math.min(74, Math.max(64, Math.round(playerOvr * 0.84)));
}

/**
 * Membuat 11 kartu Starter Pack gratis untuk mengisi formasi default 4-3-3:
 * - 1 GK, 4 DF, 3 MF, 3 FW
 * - 9 COMMON + 1 RARE pasti + 1 slot bonus (10% peluang EPIC, 90% COMMON)
 */
export async function generateStarterPackForUser(userId: string) {
  const [gks, dfs, mfs, fws] = await Promise.all([
    prisma.player.findMany({ where: { position: "GK" } }),
    prisma.player.findMany({ where: { position: "DF" } }),
    prisma.player.findMany({ where: { position: "MF" } }),
    prisma.player.findMany({ where: { position: "FW" } }),
  ]);

  if (gks.length < 1 || dfs.length < 4 || mfs.length < 3 || fws.length < 3) {
    throw new Error("Data master pemain belum cukup. Jalankan npm run prisma:seed terlebih dahulu.");
  }

  const chosenPlayers = [
    ...pickRandomUnique(gks, 1),
    ...pickRandomUnique(dfs, 4),
    ...pickRandomUnique(mfs, 3),
    ...pickRandomUnique(fws, 3),
  ];

  // Tentukan rarity untuk 11 slot secara acak:
  // 1 pasti RARE, 10% peluang 1 EPIC, sisanya COMMON
  const rarities: string[] = Array(11).fill("COMMON");
  const rareSlot = Math.floor(Math.random() * 11);
  rarities[rareSlot] = "RARE";

  const gotLuckyEpic = Math.random() < 0.1; // 10% peluang
  if (gotLuckyEpic) {
    let epicSlot = Math.floor(Math.random() * 11);
    while (epicSlot === rareSlot) {
      epicSlot = Math.floor(Math.random() * 11);
    }
    rarities[epicSlot] = "EPIC";
  }

  // Simpan 11 kartu + isi Lineup 4-3-3 dalam 1 transaksi database
  const createdCards = await prisma.$transaction(async (tx) => {
    const cards = [];
    for (let i = 0; i < 11; i++) {
      const player = chosenPlayers[i];
      const rarity = rarities[i];
      const baseOverall = calculateStarterOverall(player.overall, rarity);

      const card = await tx.userCard.create({
        data: {
          userId,
          playerId: player.id,
          position: player.position,
          baseOverall,
          level: 1,
          rarity,
          edition: "BASE",
          season: 2026,
          isOnChain: false,
          isListed: false,
        },
        include: { player: { include: { club: true } } },
      });
      cards.push(card);
    }

    // Buat atau ambil Lineup 4-3-3 milik user
    const lineup = await tx.lineup.upsert({
      where: { userId },
      update: { formation: "4-3-3" },
      create: { userId, formation: "4-3-3" },
    });

    await tx.lineupSlot.deleteMany({ where: { lineupId: lineup.id } });

    // Pasang otomatis ke-11 kartu ke slot 4-3-3 (urutan sudah 1 GK, 4 DF, 3 MF, 3 FW)
    for (let i = 0; i < FORMATION_433_SLOTS.length; i++) {
      await tx.lineupSlot.create({
        data: {
          lineupId: lineup.id,
          slotCode: FORMATION_433_SLOTS[i].slotCode,
          userCardId: cards[i].id,
        },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: { hasClaimedStarter: true },
    });

    return cards;
  });

  return { cards: createdCards, gotLuckyEpic };
}
