import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = new PrismaClient();

interface LeagueConfig {
  code: string;
  name: string;
  country: string;
  tierBonus: number; // Penyesuaian tingkat kompetisi liga dunia
}

// 13 Liga Dunia (Eropa, Amerika Selatan, Amerika Utara, Timur Tengah, Asia, & Indonesia)
const GLOBAL_LEAGUES: LeagueConfig[] = [
  { code: "eng.1", name: "Premier League", country: "England", tierBonus: 7 },
  { code: "esp.1", name: "La Liga", country: "Spain", tierBonus: 7 },
  { code: "ita.1", name: "Serie A", country: "Italy", tierBonus: 6 },
  { code: "ger.1", name: "Bundesliga", country: "Germany", tierBonus: 6 },
  { code: "fra.1", name: "Ligue 1", country: "France", tierBonus: 5 },
  { code: "ned.1", name: "Eredivisie", country: "Netherlands", tierBonus: 3 },
  { code: "por.1", name: "Primeira Liga", country: "Portugal", tierBonus: 3 },
  { code: "bra.1", name: "Brasileirão", country: "Brazil", tierBonus: 3 },
  { code: "arg.1", name: "Liga Profesional", country: "Argentina", tierBonus: 2 },
  { code: "usa.1", name: "MLS", country: "USA", tierBonus: 2 },
  { code: "ksa.1", name: "Saudi Pro League", country: "Saudi Arabia", tierBonus: 2 },
  { code: "jpn.1", name: "J1 League", country: "Japan", tierBonus: 1 },
  { code: "idn.1", name: "Liga 1 Indonesia", country: "Indonesia", tierBonus: 0 },
];

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function mapPosition(abbr?: string, name?: string): { position: string; detailPosition: string } {
  const a = (abbr || "").toUpperCase();
  const n = (name || "").toLowerCase();

  if (a === "G" || n.includes("goalkeeper")) return { position: "GK", detailPosition: "GK" };
  if (a === "D" || n.includes("defender")) {
    if (n.includes("left")) return { position: "DF", detailPosition: "LB" };
    if (n.includes("right")) return { position: "DF", detailPosition: "RB" };
    return { position: "DF", detailPosition: "CB" };
  }
  if (a === "M" || n.includes("midfielder")) {
    if (n.includes("defensive")) return { position: "MF", detailPosition: "CDM" };
    if (n.includes("attacking")) return { position: "MF", detailPosition: "CAM" };
    return { position: "MF", detailPosition: "CM" };
  }
  if (n.includes("left")) return { position: "FW", detailPosition: "LW" };
  if (n.includes("right")) return { position: "FW", detailPosition: "RW" };
  return { position: "FW", detailPosition: "ST" };
}

function extractStatMap(athlete: any): Record<string, number> {
  const map: Record<string, number> = {};
  const categories = athlete?.statistics?.splits?.categories;
  if (!Array.isArray(categories)) return map;

  for (const cat of categories) {
    if (!Array.isArray(cat.stats)) continue;
    for (const s of cat.stats) {
      if (typeof s.name === "string" && typeof s.value === "number") {
        map[s.name] = s.value;
      }
    }
  }
  return map;
}

/**
 * Menghitung rating (OVR + 6 atribut) & Live Form (A-E) secara deterministik
 * dari statistik musim berjalan nyata (appearances, goals, assists, shots, saves, dll.).
 */
function computeAttributes(
  position: string,
  tierBonus: number,
  stats: Record<string, number>,
  age?: number
) {
  const apps = stats.appearances || 0;
  const goals = stats.totalGoals || 0;
  const assists = stats.goalAssists || 0;
  const shotsOnTarget = stats.shotsOnTarget || 0;
  const saves = stats.saves || 0;
  const conceded = stats.goalsConceded || 0;
  const redCards = stats.redCards || 0;
  const foulsSuffered = stats.foulsSuffered || 0;

  const perApp = (val: number) => (apps > 0 ? val / apps : 0);
  const gPerApp = perApp(goals);
  const aPerApp = perApp(assists);
  const sotPerApp = perApp(shotsOnTarget);
  const savesPerApp = perApp(saves);

  // Aktivitas bermain: pemain inti rutin mendapat bonus konsistensi
  const playingBonus = Math.min(8, Math.sqrt(apps) * 2.1);

  let perfScore = 0;
  if (position === "FW") {
    perfScore = gPerApp * 18 + aPerApp * 12 + sotPerApp * 3.5;
  } else if (position === "MF") {
    perfScore = gPerApp * 20 + aPerApp * 16 + perApp(foulsSuffered) * 2.2;
  } else if (position === "DF") {
    const cleanBonus = apps > 0 ? Math.max(0, 2.2 - conceded / apps) * 4 : 0;
    perfScore = gPerApp * 18 + aPerApp * 14 + cleanBonus;
  } else {
    // GK
    const saveRatio = saves + conceded > 0 ? saves / (saves + conceded) : 0.6;
    perfScore = savesPerApp * 3.2 + saveRatio * 10;
  }

  const disciplinePenalty = redCards * 1.5;
  const overall = clamp(62 + tierBonus + playingBonus + Math.min(16, perfScore) - disciplinePenalty, 60, 94);

  // Live Form mingguan (A - E) berdasarkan performa nyata musim berjalan
  let liveForm = "C";
  if (apps >= 4) {
    if (perfScore >= 11) liveForm = "A";
    else if (perfScore >= 6.5) liveForm = "B";
    else if (perfScore >= 2.5) liveForm = "C";
    else liveForm = "D";
  } else if (apps === 0) {
    liveForm = "C";
  }

  const agePaceMod = age && age <= 24 ? 4 : age && age >= 33 ? -5 : 0;

  if (position === "GK") {
    return {
      overall,
      liveForm,
      pace: clamp(overall - 28, 35, 65),
      shooting: clamp(overall - 35, 30, 55),
      passing: clamp(overall - 8, 55, 88),
      dribbling: clamp(overall - 22, 42, 72),
      defending: clamp(overall + 1, 60, 95),
      physical: clamp(overall - 2, 58, 92),
    };
  }

  if (position === "DF") {
    return {
      overall,
      liveForm,
      pace: clamp(overall - 4 + agePaceMod, 52, 93),
      shooting: clamp(overall - 24 + goals * 2, 38, 82),
      passing: clamp(overall - 8 + assists * 2, 55, 88),
      dribbling: clamp(overall - 11, 50, 86),
      defending: clamp(overall + 2, 62, 95),
      physical: clamp(overall + 1, 60, 94),
    };
  }

  if (position === "MF") {
    return {
      overall,
      liveForm,
      pace: clamp(overall - 6 + agePaceMod, 54, 92),
      shooting: clamp(overall - 7 + goals * 1.5, 55, 92),
      passing: clamp(overall + 2 + assists, 62, 95),
      dribbling: clamp(overall + 1, 60, 95),
      defending: clamp(overall - 10, 52, 90),
      physical: clamp(overall - 6, 54, 90),
    };
  }

  // FW
  return {
    overall,
    liveForm,
    pace: clamp(overall + 2 + agePaceMod, 60, 97),
    shooting: clamp(overall + 2 + gPerApp * 4, 62, 96),
    passing: clamp(overall - 8 + aPerApp * 6, 56, 92),
    dribbling: clamp(overall + 1, 60, 95),
    defending: clamp(overall - 38, 30, 62),
    physical: clamp(overall - 7, 54, 92),
  };
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "W3FootballManagerSync/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function syncLeague(league: LeagueConfig) {
  const teamsData = await fetchJson(`${ESPN_BASE}/${league.code}/teams`);
  const teams = teamsData?.sports?.[0]?.leagues?.[0]?.teams || [];
  let clubCount = 0;
  let playerCount = 0;

  // Proses per batch 5 klub paralel agar cepat namun sopan terhadap rate-limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = teams.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (entry: any) => {
        const t = entry?.team;
        if (!t?.id || !t?.displayName) return;

        const logoUrl = t.logos?.[0]?.href || null;
        const club = await prisma.club.upsert({
          where: { name: t.displayName },
          update: {
            leagueName: league.name,
            country: league.country,
            logoUrl,
          },
          create: {
            name: t.displayName,
            leagueName: league.name,
            country: league.country,
            logoUrl,
          },
        });
        clubCount++;

        try {
          const rosterData = await fetchJson(`${ESPN_BASE}/${league.code}/teams/${t.id}/roster`);
          const athletes = rosterData?.athletes || [];

          for (const athlete of athletes) {
            if (!athlete?.id || !athlete?.fullName) continue;

            const { position, detailPosition } = mapPosition(
              athlete.position?.abbreviation,
              athlete.position?.displayName || athlete.position?.name
            );
            const statMap = extractStatMap(athlete);
            const attrs = computeAttributes(position, league.tierBonus, statMap, athlete.age);

            await prisma.player.upsert({
              where: { externalKey: `espn-${athlete.id}` },
              update: {
                name: athlete.fullName,
                nationality: athlete.citizenship || league.country,
                clubId: club.id,
                position,
                detailPosition,
                overall: attrs.overall,
                pace: attrs.pace,
                shooting: attrs.shooting,
                passing: attrs.passing,
                dribbling: attrs.dribbling,
                defending: attrs.defending,
                physical: attrs.physical,
                liveForm: attrs.liveForm,
                appearances: statMap.appearances || 0,
                goals: statMap.totalGoals || 0,
                assists: statMap.goalAssists || 0,
                saves: statMap.saves || 0,
                lastSyncedAt: new Date(),
              },
              create: {
                externalKey: `espn-${athlete.id}`,
                name: athlete.fullName,
                nationality: athlete.citizenship || league.country,
                clubId: club.id,
                position,
                detailPosition,
                overall: attrs.overall,
                pace: attrs.pace,
                shooting: attrs.shooting,
                passing: attrs.passing,
                dribbling: attrs.dribbling,
                defending: attrs.defending,
                physical: attrs.physical,
                liveForm: attrs.liveForm,
                appearances: statMap.appearances || 0,
                goals: statMap.totalGoals || 0,
                assists: statMap.goalAssists || 0,
                saves: statMap.saves || 0,
                lastSyncedAt: new Date(),
              },
            });
            playerCount++;
          }
        } catch (err: any) {
          console.warn(`  [Skip roster ${t.displayName}]: ${err.message}`);
        }
      })
    );
  }

  console.log(`✓ ${league.name} (${league.code}): ${clubCount} klub, ${playerCount} pemain`);
  return { clubCount, playerCount };
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--leagues="));
  const selectedCodes = arg ? arg.replace("--leagues=", "").split(",") : null;
  const targetLeagues = selectedCodes
    ? GLOBAL_LEAGUES.filter((l) => selectedCodes.includes(l.code))
    : GLOBAL_LEAGUES;

  console.log(`Memulai sinkronisasi data pemain global (${targetLeagues.length} liga dunia)...`);
  const start = Date.now();

  let totalClubs = 0;
  let totalPlayers = 0;

  for (const league of targetLeagues) {
    try {
      const res = await syncLeague(league);
      totalClubs += res.clubCount;
      totalPlayers += res.playerCount;
    } catch (err: any) {
      console.error(`✗ Gagal sync ${league.name}: ${err.message}`);
    }
  }

  // Bersihkan pemain seed dummy awal (gk-*, df-*, mf-*, fw-*) HANYA jika belum dipakai oleh kartu user mana pun
  const dummyPlayers = await prisma.player.findMany({
    where: {
      OR: [
        { externalKey: { startsWith: "gk-" } },
        { externalKey: { startsWith: "df-" } },
        { externalKey: { startsWith: "mf-" } },
        { externalKey: { startsWith: "fw-" } },
      ],
      userCards: { none: {} },
    },
    select: { id: true },
  });

  if (dummyPlayers.length > 0 && totalPlayers > 0) {
    await prisma.player.deleteMany({
      where: { id: { in: dummyPlayers.map((p) => p.id) } },
    });
    console.log(`Membersihkan ${dummyPlayers.length} data pemain dummy awal (yang belum dipakai kartu user).`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const dbCount = await prisma.player.count();
  console.log("========================================");
  console.log(`Sinkronisasi selesai dalam ${elapsed}s!`);
  console.log(`Berhasil sync : ${totalClubs} klub, ${totalPlayers} pemain dari ${targetLeagues.length} liga dunia`);
  console.log(`Total di DB   : ${dbCount} pemain aktif siap dipakai!`);
  console.log("========================================");
}

main()
  .catch((err) => {
    console.error("Sync error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
