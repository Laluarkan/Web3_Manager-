export interface SimulationPlayer {
  id: number;
  name: string;
  position: "GK" | "DF" | "MF" | "FW";
  slotCode: string;
  number: number;
  baseOverall: number;
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
  ballCoord: { x: number; y: number }; // 0 - 100 percentage of pitch
}

export interface GeneratedMatchSimulation {
  homeTeamName: string;
  awayTeamName: string;
  homePlayers: SimulationPlayer[];
  awayPlayers: SimulationPlayer[];
  events: MatchEvent[];
  stats: {
    shots: { home: number; away: number };
    shotsOnTarget: { home: number; away: number };
    fouls: { home: number; away: number };
    yellowCards: { home: number; away: number };
    corners: { home: number; away: number };
    possession: { home: number; away: number };
  };
}

const DEFAULT_AWAY_NAMES = [
  "R. Navas", "D. Carvajal", "S. Ramos", "V. van Dijk", "M. Marcelo",
  "Casemiro", "L. Modric", "T. Kroos", "M. Salah", "K. Benzema", "Vinicius Jr."
];

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
  myGoals: number,
  oppGoals: number,
  myRating: number,
  oppRating: number,
  possessionHome: number
): GeneratedMatchSimulation {
  // 1. Build home players (4-3-3 formation)
  const homePlayers: SimulationPlayer[] = homeSlots.map((s, idx) => ({
    id: s.userCard.player.id,
    name: s.userCard.player.name,
    position: (s.userCard.player.position as any) || "MF",
    slotCode: s.slotCode,
    number: idx === 0 ? 1 : idx + 1,
    baseOverall: s.userCard.baseOverall,
  }));

  // 2. Build away players (standard 4-3-3 template)
  const awaySlots = ["GK", "LB", "LCB", "RCB", "RB", "LCM", "CM", "RCM", "LW", "ST", "RW"];
  const awayPlayers: SimulationPlayer[] = awaySlots.map((slot, idx) => ({
    id: 9000 + idx,
    name: DEFAULT_AWAY_NAMES[idx] || `Player ${idx + 1}`,
    position: slot === "GK" ? "GK" : slot.includes("B") ? "DF" : slot.includes("M") ? "MF" : "FW",
    slotCode: slot,
    number: idx === 0 ? 1 : idx + 1,
    baseOverall: oppRating,
  }));

  const events: MatchEvent[] = [];

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

  // Pre-generate ~22 realistic match moments spread across 90 minutes
  const keyMinutes: number[] = [
    5, 9, 14, 18, 22, 27, 33, 38, 42, 45, 48, 52, 57, 63, 68, 73, 78, 82, 86, 90
  ];

  const getAttackers = (team: "HOME" | "AWAY") => {
    const list = team === "HOME" ? homePlayers : awayPlayers;
    const forwards = list.filter((p) => p.position === "FW" || p.position === "MF");
    return forwards.length ? forwards : list;
  };

  const getDefenders = (team: "HOME" | "AWAY") => {
    const list = team === "HOME" ? homePlayers : awayPlayers;
    const defs = list.filter((p) => p.position === "DF" || p.position === "GK");
    return defs.length ? defs : list;
  };

  // Compile all key events
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

  for (const m of keyMinutes) {
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

    // Cek apakah di menit ini ada gol
    const matchingGoal = goalEvents.find((g) => Math.abs(g.minute - m) <= 2);
    if (matchingGoal && !events.some((e) => e.type === "GOAL" && e.minute === matchingGoal.minute)) {
      const isHome = matchingGoal.team === "HOME";
      const scorerList = getAttackers(matchingGoal.team);
      const scorer = scorerList[Math.floor(Math.random() * scorerList.length)];
      const assisterList = scorerList.filter((p) => p.id !== scorer.id);
      const assister = assisterList.length
        ? assisterList[Math.floor(Math.random() * assisterList.length)]
        : null;

      events.push({
        id: `ev-goal-${matchingGoal.minute}`,
        minute: matchingGoal.minute,
        type: "GOAL",
        team: matchingGoal.team,
        player: scorer.name,
        targetPlayer: assister ? assister.name : undefined,
        description: isHome
          ? `GOOOOL LUAR BIASA! ${scorer.name} melepaskan tembakan terarah yang merobek jala gawang lawan! (${homeTeamName})`
          : `GOL! Lawan membalas lewat sontekan dingin ${scorer.name} ke sudut gawang! (${awayTeamName})`,
        ballCoord: isHome ? { x: 95, y: 50 } : { x: 5, y: 50 },
      });
      continue;
    }

    // Acak event normal (Pass, Chance, Shot, Save, Foul, Corner)
    const isHomeAction = Math.random() * 100 < possessionHome;
    const activeTeam = isHomeAction ? "HOME" : "AWAY";
    const attackTeam = getAttackers(activeTeam);
    const defendingTeam = getDefenders(activeTeam === "HOME" ? "AWAY" : "HOME");
    const p1 = attackTeam[Math.floor(Math.random() * attackTeam.length)];
    const p2 = attackTeam[Math.floor(Math.random() * attackTeam.length)];
    const defender = defendingTeam[Math.floor(Math.random() * defendingTeam.length)];

    const roll = Math.random();
    if (roll < 0.28) {
      // Chance / Shot saved
      if (isHomeAction) {
        homeShots++;
        homeOnTarget++;
      } else {
        awayShots++;
        awayOnTarget++;
      }
      events.push({
        id: `ev-${m}`,
        minute: m,
        type: "SAVE",
        team: activeTeam,
        player: p1.name,
        targetPlayer: defender.name,
        description: `Peluang emas! ${p1.name} melepaskan tembakan voli keras, namun kiper lawan berhasil menepis bola!`,
        ballCoord: isHomeAction ? { x: 88, y: 46 } : { x: 12, y: 54 },
      });
    } else if (roll < 0.48) {
      // Corner kick
      if (isHomeAction) homeCorners++;
      else awayCorners++;
      events.push({
        id: `ev-${m}`,
        minute: m,
        type: "CORNER",
        team: activeTeam,
        player: p1.name,
        description: `Tendangan sudut untuk ${isHomeAction ? homeTeamName : awayTeamName}. ${p1.name} bersiap mengayunkan umpan lambung ke kotak penalti.`,
        ballCoord: isHomeAction ? { x: 98, y: 5 } : { x: 2, y: 95 },
      });
    } else if (roll < 0.68) {
      // Foul & Yellow Card
      if (isHomeAction) {
        awayFouls++;
        if (Math.random() < 0.4) awayYellows++;
      } else {
        homeFouls++;
        if (Math.random() < 0.4) homeYellows++;
      }
      events.push({
        id: `ev-${m}`,
        minute: m,
        type: "FOUL",
        team: isHomeAction ? "AWAY" : "HOME",
        player: defender.name,
        targetPlayer: p1.name,
        description: `Pelanggaran! ${defender.name} menekel ${p1.name} saat mencoba menerobos barisan pertahanan.`,
        ballCoord: isHomeAction ? { x: 65, y: 40 } : { x: 35, y: 60 },
      });
    } else {
      // Build-up play / Through Pass
      events.push({
        id: `ev-${m}`,
        minute: m,
        type: "PASS",
        team: activeTeam,
        player: p1.name,
        targetPlayer: p2.name,
        description: `${p1.name} mengatur tempo serangan, mengoper bola terobosan manis kepada ${p2.name}.`,
        ballCoord: isHomeAction ? { x: 60, y: 50 } : { x: 40, y: 50 },
      });
    }
  }

  // Ensure all goals are present in events list
  for (const g of goalEvents) {
    if (!events.some((e) => e.type === "GOAL" && e.minute === g.minute)) {
      const isHome = g.team === "HOME";
      const scorerList = getAttackers(g.team);
      const scorer = scorerList[Math.floor(Math.random() * scorerList.length)];
      events.push({
        id: `ev-goal-${g.minute}`,
        minute: g.minute,
        type: "GOAL",
        team: g.team,
        player: scorer.name,
        description: isHome
          ? `GOOOOL! Sontekan tajam ${scorer.name} menjebol gawang lawan! (${homeTeamName})`
          : `GOL! Serangan balik cepat lawan diselesaikan oleh ${scorer.name}. (${awayTeamName})`,
        ballCoord: isHome ? { x: 96, y: 50 } : { x: 4, y: 50 },
      });
    }
  }

  // Sort events chronologically by minute
  events.sort((a, b) => a.minute - b.minute);

  return {
    homeTeamName,
    awayTeamName,
    homePlayers,
    awayPlayers,
    events,
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
