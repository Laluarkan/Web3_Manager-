import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CLUBS = [
  { name: "Real Madrid", leagueName: "La Liga", country: "Spain" },
  { name: "Manchester City", leagueName: "Premier League", country: "England" },
  { name: "Arsenal", leagueName: "Premier League", country: "England" },
  { name: "Bayern Munich", leagueName: "Bundesliga", country: "Germany" },
  { name: "Inter Milan", leagueName: "Serie A", country: "Italy" },
  { name: "Paris Saint-Germain", leagueName: "Ligue 1", country: "France" },
  { name: "Barcelona", leagueName: "La Liga", country: "Spain" },
  { name: "Liverpool", leagueName: "Premier League", country: "England" },
  { name: "Flamengo", leagueName: "Brasileirão", country: "Brazil" },
  { name: "Al-Hilal", leagueName: "Saudi Pro League", country: "Saudi Arabia" },
  { name: "Inter Miami", leagueName: "MLS", country: "USA" },
  { name: "Vissel Kobe", leagueName: "J1 League", country: "Japan" },
];

const PLAYERS = [
  // === GOALKEEPERS (GK) ===
  { key: "gk-1", name: "Thibaut Courtois", nat: "Belgium", club: "Real Madrid", pos: "GK", dPos: "GK", ovr: 89, pac: 48, sho: 40, pas: 76, dri: 55, def: 89, phy: 88, form: "A" },
  { key: "gk-2", name: "Alisson Becker", nat: "Brazil", club: "Liverpool", pos: "GK", dPos: "GK", ovr: 88, pac: 52, sho: 42, pas: 84, dri: 60, def: 88, phy: 85, form: "B" },
  { key: "gk-3", name: "David Raya", nat: "Spain", club: "Arsenal", pos: "GK", dPos: "GK", ovr: 83, pac: 54, sho: 38, pas: 82, dri: 58, def: 83, phy: 78, form: "A" },
  { key: "gk-4", name: "Yann Sommer", nat: "Switzerland", club: "Inter Milan", pos: "GK", dPos: "GK", ovr: 82, pac: 49, sho: 36, pas: 79, dri: 56, def: 83, phy: 77, form: "B" },
  { key: "gk-5", name: "Yassine Bounou", nat: "Morocco", club: "Al-Hilal", pos: "GK", dPos: "GK", ovr: 81, pac: 50, sho: 37, pas: 75, dri: 54, def: 82, phy: 80, form: "C" },
  { key: "gk-6", name: "Agustin Rossi", nat: "Argentina", club: "Flamengo", pos: "GK", dPos: "GK", ovr: 74, pac: 46, sho: 34, pas: 70, dri: 50, def: 75, phy: 76, form: "C" },
  { key: "gk-7", name: "Daiya Maekawa", nat: "Japan", club: "Vissel Kobe", pos: "GK", dPos: "GK", ovr: 71, pac: 48, sho: 32, pas: 68, dri: 49, def: 72, phy: 74, form: "B" },

  // === DEFENDERS (DF) ===
  { key: "df-1", name: "Virgil van Dijk", nat: "Netherlands", club: "Liverpool", pos: "DF", dPos: "CB", ovr: 89, pac: 78, sho: 60, pas: 74, dri: 72, def: 90, phy: 88, form: "A" },
  { key: "df-2", name: "William Saliba", nat: "France", club: "Arsenal", pos: "DF", dPos: "CB", ovr: 87, pac: 83, sho: 48, pas: 75, dri: 74, def: 88, phy: 84, form: "A" },
  { key: "df-3", name: "Achraf Hakimi", nat: "Morocco", club: "Paris Saint-Germain", pos: "DF", dPos: "RB", ovr: 85, pac: 92, sho: 74, pas: 80, dri: 82, def: 78, phy: 79, form: "B" },
  { key: "df-4", name: "Alessandro Bastoni", nat: "Italy", club: "Inter Milan", pos: "DF", dPos: "CB", ovr: 86, pac: 76, sho: 55, pas: 81, dri: 76, def: 87, phy: 83, form: "B" },
  { key: "df-5", name: "Alphonso Davies", nat: "Canada", club: "Bayern Munich", pos: "DF", dPos: "LB", ovr: 83, pac: 94, sho: 67, pas: 76, dri: 84, def: 76, phy: 78, form: "C" },
  { key: "df-6", name: "Josko Gvardiol", nat: "Croatia", club: "Manchester City", pos: "DF", dPos: "LB", ovr: 84, pac: 81, sho: 66, pas: 78, dri: 79, def: 84, phy: 84, form: "B" },
  { key: "df-7", name: "Jules Kounde", nat: "France", club: "Barcelona", pos: "DF", dPos: "RB", ovr: 84, pac: 84, sho: 54, pas: 76, dri: 77, def: 85, phy: 81, form: "A" },
  { key: "df-8", name: "Kalidou Koulibaly", nat: "Senegal", club: "Al-Hilal", pos: "DF", dPos: "CB", ovr: 80, pac: 74, sho: 45, pas: 68, dri: 66, def: 81, phy: 85, form: "C" },
  { key: "df-9", name: "Fabricio Bruno", nat: "Brazil", club: "Flamengo", pos: "DF", dPos: "CB", ovr: 76, pac: 80, sho: 46, pas: 66, dri: 64, def: 77, phy: 79, form: "B" },
  { key: "df-10", name: "Jordi Alba", nat: "Spain", club: "Inter Miami", pos: "DF", dPos: "LB", ovr: 78, pac: 80, sho: 68, pas: 81, dri: 79, def: 73, phy: 68, form: "C" },
  { key: "df-11", name: "Gotoku Sakai", nat: "Japan", club: "Vissel Kobe", pos: "DF", dPos: "RB", ovr: 72, pac: 75, sho: 58, pas: 71, dri: 70, def: 72, phy: 74, form: "B" },
  { key: "df-12", name: "Ayrton Lucas", nat: "Brazil", club: "Flamengo", pos: "DF", dPos: "LB", ovr: 74, pac: 84, sho: 62, pas: 70, dri: 75, def: 71, phy: 73, form: "C" },

  // === MIDFIELDERS (MF) ===
  { key: "mf-1", name: "Rodri", nat: "Spain", club: "Manchester City", pos: "MF", dPos: "CDM", ovr: 91, pac: 68, sho: 81, pas: 88, dri: 84, def: 87, phy: 86, form: "A" },
  { key: "mf-2", name: "Jude Bellingham", nat: "England", club: "Real Madrid", pos: "MF", dPos: "CAM", ovr: 90, pac: 82, sho: 87, pas: 84, dri: 90, def: 78, phy: 84, form: "A" },
  { key: "mf-3", name: "Pedri", nat: "Spain", club: "Barcelona", pos: "MF", dPos: "CM", ovr: 87, pac: 79, sho: 73, pas: 86, dri: 89, def: 72, phy: 74, form: "A" },
  { key: "mf-4", name: "Martin Odegaard", nat: "Norway", club: "Arsenal", pos: "MF", dPos: "CAM", ovr: 88, pac: 76, sho: 82, pas: 90, dri: 89, def: 68, phy: 70, form: "B" },
  { key: "mf-5", name: "Nicolo Barella", nat: "Italy", club: "Inter Milan", pos: "MF", dPos: "CM", ovr: 86, pac: 80, sho: 78, pas: 84, dri: 86, def: 81, phy: 79, form: "B" },
  { key: "mf-6", name: "Jamal Musiala", nat: "Germany", club: "Bayern Munich", pos: "MF", dPos: "CAM", ovr: 87, pac: 85, sho: 81, pas: 81, dri: 93, def: 64, phy: 68, form: "A" },
  { key: "mf-7", name: "Vitinha", nat: "Portugal", club: "Paris Saint-Germain", pos: "MF", dPos: "CM", ovr: 85, pac: 77, sho: 76, pas: 86, dri: 87, def: 75, phy: 72, form: "A" },
  { key: "mf-8", name: "Ruben Neves", nat: "Portugal", club: "Al-Hilal", pos: "MF", dPos: "CDM", ovr: 82, pac: 66, sho: 78, pas: 85, dri: 78, def: 78, phy: 79, form: "C" },
  { key: "mf-9", name: "Sergio Busquets", nat: "Spain", club: "Inter Miami", pos: "MF", dPos: "CDM", ovr: 79, pac: 46, sho: 62, pas: 84, dri: 78, def: 78, phy: 74, form: "C" },
  { key: "mf-10", name: "Gerson", nat: "Brazil", club: "Flamengo", pos: "MF", dPos: "CM", ovr: 78, pac: 75, sho: 73, pas: 79, dri: 81, def: 74, phy: 80, form: "B" },
  { key: "mf-11", name: "Takahiro Ogihara", nat: "Japan", club: "Vissel Kobe", pos: "MF", dPos: "CDM", ovr: 71, pac: 65, sho: 64, pas: 73, dri: 70, def: 70, phy: 72, form: "C" },

  // === FORWARDS (FW) ===
  { key: "fw-1", name: "Kylian Mbappe", nat: "France", club: "Real Madrid", pos: "FW", dPos: "ST", ovr: 91, pac: 97, sho: 90, pas: 81, dri: 92, def: 38, phy: 78, form: "A" },
  { key: "fw-2", name: "Erling Haaland", nat: "Norway", club: "Manchester City", pos: "FW", dPos: "ST", ovr: 91, pac: 89, sho: 93, pas: 68, dri: 81, def: 45, phy: 89, form: "A" },
  { key: "fw-3", name: "Mohamed Salah", nat: "Egypt", club: "Liverpool", pos: "FW", dPos: "RW", ovr: 90, pac: 89, sho: 89, pas: 84, dri: 89, def: 46, phy: 76, form: "A" },
  { key: "fw-4", name: "Lamine Yamal", nat: "Spain", club: "Barcelona", pos: "FW", dPos: "RW", ovr: 86, pac: 87, sho: 80, pas: 84, dri: 91, def: 35, phy: 62, form: "A" },
  { key: "fw-5", name: "Harry Kane", nat: "England", club: "Bayern Munich", pos: "FW", dPos: "ST", ovr: 90, pac: 68, sho: 93, pas: 84, dri: 83, def: 49, phy: 84, form: "B" },
  { key: "fw-6", name: "Bukayo Saka", nat: "England", club: "Arsenal", pos: "FW", dPos: "RW", ovr: 87, pac: 86, sho: 84, pas: 85, dri: 89, def: 60, phy: 74, form: "B" },
  { key: "fw-7", name: "Lautaro Martinez", nat: "Argentina", club: "Inter Milan", pos: "FW", dPos: "ST", ovr: 88, pac: 83, sho: 88, pas: 76, dri: 86, def: 52, phy: 84, form: "B" },
  { key: "fw-8", name: "Lionel Messi", nat: "Argentina", club: "Inter Miami", pos: "FW", dPos: "RW", ovr: 88, pac: 78, sho: 87, pas: 90, dri: 93, def: 34, phy: 64, form: "A" },
  { key: "fw-9", name: "Aleksandar Mitrovic", nat: "Serbia", club: "Al-Hilal", pos: "FW", dPos: "ST", ovr: 82, pac: 70, sho: 84, pas: 69, dri: 74, def: 42, phy: 87, form: "B" },
  { key: "fw-10", name: "Pedro", nat: "Brazil", club: "Flamengo", pos: "FW", dPos: "ST", ovr: 79, pac: 74, sho: 82, pas: 71, dri: 78, def: 38, phy: 81, form: "B" },
  { key: "fw-11", name: "Yuya Osako", nat: "Japan", club: "Vissel Kobe", pos: "FW", dPos: "ST", ovr: 74, pac: 70, sho: 76, pas: 72, dri: 75, def: 44, phy: 76, form: "C" },
  { key: "fw-12", name: "Bradley Barcola", nat: "France", club: "Paris Saint-Germain", pos: "FW", dPos: "LW", ovr: 82, pac: 90, sho: 78, pas: 77, dri: 85, def: 40, phy: 68, form: "B" },
];

async function main() {
  console.log("Seeding global clubs & players...");

  const clubMap = new Map<string, number>();
  for (const c of CLUBS) {
    const club = await prisma.club.upsert({
      where: { name: c.name },
      update: { leagueName: c.leagueName, country: c.country },
      create: c,
    });
    clubMap.set(club.name, club.id);
  }

  for (const p of PLAYERS) {
    const clubId = clubMap.get(p.club);
    if (!clubId) continue;

    await prisma.player.upsert({
      where: { externalKey: p.key },
      update: {
        name: p.name,
        nationality: p.nat,
        clubId,
        position: p.pos,
        detailPosition: p.dPos,
        overall: p.ovr,
        pace: p.pac,
        shooting: p.sho,
        passing: p.pas,
        dribbling: p.dri,
        defending: p.def,
        physical: p.phy,
        liveForm: p.form,
      },
      create: {
        externalKey: p.key,
        name: p.name,
        nationality: p.nat,
        clubId,
        position: p.pos,
        detailPosition: p.dPos,
        overall: p.ovr,
        pace: p.pac,
        shooting: p.sho,
        passing: p.pas,
        dribbling: p.dri,
        defending: p.def,
        physical: p.phy,
        liveForm: p.form,
      },
    });
  }

  console.log(`Seed complete: ${CLUBS.length} clubs, ${PLAYERS.length} global players.`);
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
