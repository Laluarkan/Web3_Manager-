import { PrismaClient } from "@prisma/client";

export interface SimulationPlayer {
  id: number;
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  slotCode: string;
  number: number;
  baseOverall: number;
}

export interface AttackSequence {
  id: string;
  minute: number;
  team: "HOME" | "AWAY";
  buildupPlayer: string;
  wingerPlayer: string;
  finisherPlayer: string;
  defenderPlayer: string;
  gkPlayer: string;
  outcome: "GOAL" | "SAVED" | "BLOCKED" | "WIDE" | "POST" | "TACKLED";
  description: string;
  isLoftedCross: boolean;
  startCoord: { x: number; y: number };
  wingerCoord: { x: number; y: number };
  boxCoord: { x: number; y: number };
  finishCoord: { x: number; y: number };
}

export interface MatchEvent {
  id: string;
  minute: number;
  type:
    | "KICK_OFF"
    | "PASS"
    | "DRIBBLE"
    | "CHANCE"
    | "SHOT"
    | "GOAL"
    | "SAVE"
    | "FOUL"
    | "YELLOW_CARD"
    | "CORNER"
    | "HALF_TIME"
    | "FULL_TIME";
  team: "HOME" | "AWAY";
  player: string;
  targetPlayer?: string;
  description: string;
  ballCoord: { x: number; y: number };
}

export interface GeneratedMatchSimulation {
  homeTeamName: string;
  awayTeamName: string;
  homePlayers: SimulationPlayer[];
  awayPlayers: SimulationPlayer[];
  events: MatchEvent[];
  sequences: AttackSequence[];
  stats: {
    shots: { home: number; away: number };
    shotsOnTarget: { home: number; away: number };
    fouls: { home: number; away: number };
    yellowCards: { home: number; away: number };
    corners: { home: number; away: number };
    possession: { home: number; away: number };
  };
}

/**
 * Mengambil 11 pemain real dari database PostgreSQL sesuai level kesulitan (AMATEUR, PRO, WORLD_CLASS)
 */
export async function fetchDynamicOpponentSquad(
  prisma: PrismaClient,
  difficulty: "AMATEUR" | "PRO" | "WORLD_CLASS"
): Promise<SimulationPlayer[]> {
  const range =
    difficulty === "AMATEUR"
      ? { min: 60, max: 72 }
      : difficulty === "PRO"
      ? { min: 73, max: 81 }
      : { min: 82, max: 99 };

  try {
    const [gks, dfs, mfs, fws] = await Promise.all([
      prisma.player.findMany({
        where: { position: "GK", overall: { gte: range.min, lte: range.max } },
        take: 5,
        orderBy: { overall: "desc" },
      }),
      prisma.player.findMany({
        where: { position: "DF", overall: { gte: range.min, lte: range.max } },
        take: 12,
        orderBy: { overall: "desc" },
      }),
      prisma.player.findMany({
        where: { position: "MF", overall: { gte: range.min, lte: range.max } },
        take: 10,
        orderBy: { overall: "desc" },
      }),
      prisma.player.findMany({
        where: { position: "FW", overall: { gte: range.min, lte: range.max } },
        take: 10,
        orderBy: { overall: "desc" },
      }),
    ]);

    const shuffle = <T>(arr: T[]): T[] => arr.slice().sort(() => Math.random() - 0.5);
    const selGK = shuffle(gks)[0];
    const selDF = shuffle(dfs);
    const selMF = shuffle(mfs);
    const selFW = shuffle(fws);

    const slotConfigs: Array<{ slot: string; p?: any; pos: "GK" | "DF" | "MF" | "FW" }> = [
      { slot: "GK", p: selGK, pos: "GK" },
      { slot: "LB", p: selDF[0], pos: "DF" },
      { slot: "LCB", p: selDF[1] || selDF[0], pos: "DF" },
      { slot: "RCB", p: selDF[2] || selDF[0], pos: "DF" },
      { slot: "RB", p: selDF[3] || selDF[0], pos: "DF" },
      { slot: "LCM", p: selMF[0], pos: "MF" },
      { slot: "CM", p: selMF[1] || selMF[0], pos: "MF" },
      { slot: "RCM", p: selMF[2] || selMF[0], pos: "MF" },
      { slot: "LW", p: selFW[0], pos: "FW" },
      { slot: "ST", p: selFW[1] || selFW[0], pos: "FW" },
      { slot: "RW", p: selFW[2] || selFW[0], pos: "FW" },
    ];

    return slotConfigs.map((item, idx) => ({
      id: item.p?.id || 8000 + idx,
      name: item.p?.name || `Player ${idx + 1}`,
      position: item.pos,
      slotCode: item.slot,
      number: idx === 0 ? 1 : idx + 1,
      baseOverall: item.p?.overall || 72,
    }));
  } catch (err) {
    console.warn("fetchDynamicOpponentSquad fallback:", err);
    const fallbackSlots = ["GK", "LB", "LCB", "RCB", "RB", "LCM", "CM", "RCM", "LW", "ST", "RW"];
    return fallbackSlots.map((slot, idx) => ({
      id: 8000 + idx,
      name: `Lawan ${slot}`,
      position: slot === "GK" ? "GK" : slot.includes("B") ? "DF" : slot.includes("M") ? "MF" : "FW",
      slotCode: slot,
      number: idx === 0 ? 1 : idx + 1,
      baseOverall: 70,
    }));
  }
}

export function buildPvPOpponentSquad(
  oppSlots: Array<{
    slotCode: string;
    userCard: {
      baseOverall: number;
      player: { id: number; name: string; position: string };
    };
  }>
): SimulationPlayer[] {
  return oppSlots.map((s, idx) => ({
    id: s.userCard.player.id,
    name: s.userCard.player.name,
    position: (s.userCard.player.position as any) || "MF",
    slotCode: s.slotCode,
    number: idx === 0 ? 1 : idx + 1,
    baseOverall: s.userCard.baseOverall,
  }));
}

export function buildMatchSimulation(
  homeTeamName: string,
  awayTeamName: string,
  homeSlots: Array<{
    slotCode: string;
    userCard: {
      baseOverall: number;
      player: { id: number; name: string; position: string };
    };
  }>,
  awayPlayers: SimulationPlayer[],
  myGoals: number,
  oppGoals: number,
  myRating: number,
  oppRating: number,
  possessionHome: number
): GeneratedMatchSimulation {
  const homePlayers: SimulationPlayer[] = homeSlots.map((s, idx) => ({
    id: s.userCard.player.id,
    name: s.userCard.player.name,
    position: (s.userCard.player.position as any) || "MF",
    slotCode: s.slotCode,
    number: idx === 0 ? 1 : idx + 1,
    baseOverall: s.userCard.baseOverall,
  }));

  const events: MatchEvent[] = [];
  const sequences: AttackSequence[] = [];

  // Kick-off event
  events.push({
    id: "ev-0",
    minute: 1,
    type: "KICK_OFF",
    team: "HOME",
    player: homePlayers.find((p) => p.slotCode === "ST")?.name || homeTeamName,
    description: `Wasit meniup peluit tanda babak pertama dimulai! ${homeTeamName} memulai sepak mula.`,
    ballCoord: { x: 50, y: 50 },
  });

  // Assign goal minutes
  const goalEvents: Array<{ minute: number; team: "HOME" | "AWAY" }> = [];
  const usedMinutes = new Set<number>([1, 45, 90]);

  const pickRandomMinute = (min: number, max: number): number => {
    let m = Math.floor(Math.random() * (max - min + 1)) + min;
    while (usedMinutes.has(m)) {
      m = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    usedMinutes.add(m);
    return m;
  };

  for (let i = 0; i < myGoals; i++) {
    goalEvents.push({ minute: pickRandomMinute(4, 88), team: "HOME" });
  }
  for (let i = 0; i < oppGoals; i++) {
    goalEvents.push({ minute: pickRandomMinute(4, 88), team: "AWAY" });
  }

  // Generate 18 realistic attack timeline minutes throughout the match
  const attackMinutes: number[] = [
    6, 11, 16, 21, 26, 31, 36, 41, 45, 49, 54, 59, 64, 69, 74, 79, 84, 90
  ];

  let homeShots = myGoals;
  let awayShots = oppGoals;
  let homeOnTarget = myGoals;
  let awayOnTarget = oppGoals;
  let homeFouls = 0;
  let awayFouls = 0;
  let homeYellows = 0;
  let awayYellows = 0;
  let homeCorners = 0;
  let awayCorners = 0;

  for (const m of attackMinutes) {
    if (m === 45) {
      events.push({
        id: `ev-${m}`,
        minute: 45,
        type: "HALF_TIME",
        team: "HOME",
        player: "Wasit",
        description: `Peluit babak pertama berbunyi! Para pemain menuju lorong ganti untuk istirahat.`,
        ballCoord: { x: 50, y: 50 },
      });
      continue;
    }
    if (m === 90) {
      events.push({
        id: `ev-${m}`,
        minute: 90,
        type: "FULL_TIME",
        team: "HOME",
        player: "Wasit",
        description: `Peluit panjang tanda pertandingan selesai berbunyi! Skor akhir: ${homeTeamName} ${myGoals} - ${oppGoals} ${awayTeamName}.`,
        ballCoord: { x: 50, y: 50 },
      });
      continue;
    }

    // Tentukan apakah serangan ini menghasilkan GOL atau TIDAK GOL (kemungkinan beragam)
    const matchingGoal = goalEvents.find((g) => Math.abs(g.minute - m) <= 2);
    const isGoal = Boolean(matchingGoal && !events.some((e) => e.type === "GOAL" && e.minute === matchingGoal.minute));

    const isHome = isGoal
      ? matchingGoal!.team === "HOME"
      : Math.random() * 100 < possessionHome;

    const attackingPlayers = isHome ? homePlayers : awayPlayers;
    const defendingPlayers = isHome ? awayPlayers : homePlayers;

    const buildup =
      attackingPlayers.find((p) => p.slotCode === "CM" || p.slotCode === "LCM" || p.slotCode === "RCM") ||
      attackingPlayers[5];
    const winger =
      attackingPlayers.find((p) => p.slotCode === "LW" || p.slotCode === "RW") ||
      attackingPlayers[8];
    const finisher =
      attackingPlayers.find((p) => p.slotCode === "ST") ||
      attackingPlayers[9];

    const defender =
      defendingPlayers.find((p) => p.slotCode === "LCB" || p.slotCode === "RCB") ||
      defendingPlayers[2];
    const gk =
      defendingPlayers.find((p) => p.position === "GK") ||
      defendingPlayers[0];

    const attackingTeamName = isHome ? homeTeamName : awayTeamName;

    // Koordinat dinamis penyerangan (Home menyerang ke Kanan x:95, Away ke Kiri x:5)
    const startX = isHome ? 38 : 62;
    const wingerX = isHome ? 74 : 26;
    const wingerY = Math.random() < 0.5 ? 20 : 80;
    const boxX = isHome ? 86 : 14;
    const boxY = 48 + (Math.random() * 12 - 6);

    if (isGoal) {
      // HASIL GOL: Build-up sukses diakhiri tembakan jitu
      const goalMin = matchingGoal!.minute;
      const finishX = isHome ? 96 : 4;
      const finishY = 46 + (Math.random() * 10 - 5);

      sequences.push({
        id: `seq-${goalMin}`,
        minute: goalMin,
        team: isHome ? "HOME" : "AWAY",
        buildupPlayer: buildup.name,
        wingerPlayer: winger.name,
        finisherPlayer: finisher.name,
        defenderPlayer: defender.name,
        gkPlayer: gk.name,
        outcome: "GOAL",
        description: `GOOOOL! ${buildup.name} mengalirkan bola ke sayap, ${winger.name} melepas umpan silang akurat, dan ${finisher.name} menyambar bola masuk ke gawang!`,
        isLoftedCross: true,
        startCoord: { x: startX, y: 50 },
        wingerCoord: { x: wingerX, y: wingerY },
        boxCoord: { x: boxX, y: boxY },
        finishCoord: { x: finishX, y: finishY },
      });

      events.push({
        id: `ev-goal-${goalMin}`,
        minute: goalMin,
        type: "GOAL",
        team: isHome ? "HOME" : "AWAY",
        player: finisher.name,
        targetPlayer: winger.name,
        description: `GOOOOL! ${finisher.name} mencetak gol brilian untuk ${attackingTeamName}!`,
        ballCoord: { x: finishX, y: finishY },
      });
    } else {
      // HASIL BUKAN GOL: Ditentukan secara probabilistik (Penyelamatan Kiper, Blok Bek, Tembakan Meleset, Kena Tiang, Tekel)
      const roll = Math.random();
      let outcome: AttackSequence["outcome"] = "SAVED";
      let desc = "";
      let finishX = isHome ? 92 : 8;
      let finishY = 50;

      if (isHome) homeShots++;
      else awayShots++;

      if (roll < 0.35) {
        // Outcome 1: Tembakan tepat sasaran ditepis kiper (SAVED -> REBOUND)
        outcome = "SAVED";
        if (isHome) homeOnTarget++;
        else awayOnTarget++;
        finishX = isHome ? 92 : 8;
        finishY = 48 + (Math.random() * 8 - 4);
        desc = `Penyelamatan hebat! ${finisher.name} menyambut umpan silang dengan sepakan keras, namun ${gk.name} sigap menepis bola! Bola muntah memantul liar di kotak penalti!`;
      } else if (roll < 0.60) {
        // Outcome 2: Dicegah dan diblok oleh bek (BLOCKED -> CORNER)
        outcome = "BLOCKED";
        finishX = isHome ? 84 : 16;
        finishY = 50 + (Math.random() * 10 - 5);
        if (isHome) homeCorners++;
        else awayCorners++;
        desc = `Peluang diblok! ${finisher.name} siap menembak, tetapi bek tangguh ${defender.name} meluncur melakukan blok krusial menghasilkan sepak pojok!`;
      } else if (roll < 0.82) {
        // Outcome 3: Tembakan meleset tipis ke samping / melambung (WIDE)
        outcome = "WIDE";
        finishX = isHome ? 98 : 2;
        finishY = Math.random() < 0.5 ? 24 : 76;
        desc = `Tembakan melenceng! Umpan terobosan matang disambar ${finisher.name}, namun bola melenceng tipis dari tiang gawang.`;
      } else if (roll < 0.92) {
        // Outcome 4: Membentur tiang/mistar gawang! (POST)
        outcome = "POST";
        if (isHome) homeOnTarget++;
        else awayOnTarget++;
        finishX = isHome ? 94 : 6;
        finishY = Math.random() < 0.5 ? 36 : 64;
        desc = `MENGHANTAM TIANG GAWANG! Tendangan geledek ${finisher.name} membentur mistar dengan keras!`;
      } else {
        // Outcome 5: Tekel sukses dihentikan bek sebelum menembak (TACKLED)
        outcome = "TACKLED";
        finishX = isHome ? 78 : 22;
        finishY = wingerY;
        desc = `Serangan terhenti! Tekel bersih dari ${defender.name} mematahkan tusukan berbahaya ${winger.name}.`;
      }

      sequences.push({
        id: `seq-${m}`,
        minute: m,
        team: isHome ? "HOME" : "AWAY",
        buildupPlayer: buildup.name,
        wingerPlayer: winger.name,
        finisherPlayer: finisher.name,
        defenderPlayer: defender.name,
        gkPlayer: gk.name,
        outcome,
        description: desc,
        isLoftedCross: true,
        startCoord: { x: startX, y: 50 },
        wingerCoord: { x: wingerX, y: wingerY },
        boxCoord: { x: boxX, y: boxY },
        finishCoord: { x: finishX, y: finishY },
      });

      events.push({
        id: `ev-${m}`,
        minute: m,
        type: outcome === "SAVED" ? "SAVE" : "CHANCE",
        team: isHome ? "HOME" : "AWAY",
        player: finisher.name,
        targetPlayer: defender.name,
        description: desc,
        ballCoord: { x: finishX, y: finishY },
      });
    }
  }

  // Ensure all goals are captured in events list
  for (const g of goalEvents) {
    if (!events.some((e) => e.type === "GOAL" && e.minute === g.minute)) {
      const isHome = g.team === "HOME";
      const scorerList = isHome ? homePlayers : awayPlayers;
      const scorer = scorerList.find((p) => p.position === "FW") || scorerList[0];
      events.push({
        id: `ev-goal-${g.minute}`,
        minute: g.minute,
        type: "GOAL",
        team: g.team,
        player: scorer.name,
        description: `GOOOOL! ${scorer.name} mencetak gol untuk ${isHome ? homeTeamName : awayTeamName}!`,
        ballCoord: isHome ? { x: 96, y: 50 } : { x: 4, y: 50 },
      });
    }
  }

  events.sort((a, b) => a.minute - b.minute);
  sequences.sort((a, b) => a.minute - b.minute);

  return {
    homeTeamName,
    awayTeamName,
    homePlayers,
    awayPlayers,
    events,
    sequences,
    stats: {
      shots: { home: Math.max(homeShots, myGoals + 3), away: Math.max(awayShots, oppGoals + 2) },
      shotsOnTarget: { home: Math.max(homeOnTarget, myGoals + 2), away: Math.max(awayOnTarget, oppGoals + 1) },
      fouls: { home: Math.max(homeFouls, 4), away: Math.max(awayFouls, 5) },
      yellowCards: { home: homeYellows, away: awayYellows },
      corners: { home: Math.max(homeCorners, 3), away: Math.max(awayCorners, 2) },
      possession: { home: possessionHome, away: 100 - possessionHome },
    },
  };
}
