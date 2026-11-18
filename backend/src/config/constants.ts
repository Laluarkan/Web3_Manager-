export const FORMATION_433_SLOTS = [
  { slotCode: "GK", requiredPosition: "GK" },
  { slotCode: "LB", requiredPosition: "DF" },
  { slotCode: "LCB", requiredPosition: "DF" },
  { slotCode: "RCB", requiredPosition: "DF" },
  { slotCode: "RB", requiredPosition: "DF" },
  { slotCode: "LCM", requiredPosition: "MF" },
  { slotCode: "CM", requiredPosition: "MF" },
  { slotCode: "RCM", requiredPosition: "MF" },
  { slotCode: "LW", requiredPosition: "FW" },
  { slotCode: "ST", requiredPosition: "FW" },
  { slotCode: "RW", requiredPosition: "FW" },
] as const;

export const POSITION_TO_INDEX: Record<string, number> = {
  GK: 0,
  DF: 1,
  MF: 2,
  FW: 3,
};

export const INDEX_TO_POSITION: Record<number, string> = {
  0: "GK",
  1: "DF",
  2: "MF",
  3: "FW",
};

export const RARITY_TO_INDEX: Record<string, number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3,
  MYTHIC: 4,
};

export const INDEX_TO_RARITY: Record<number, string> = {
  0: "COMMON",
  1: "RARE",
  2: "EPIC",
  3: "LEGENDARY",
  4: "MYTHIC",
};

export const EDITION_TO_INDEX: Record<string, number> = {
  BASE: 0,
  POTW: 1,
  HIGHLIGHT: 2,
  CLUB_SELECTION: 3,
  ICONIC: 4,
};

export const INDEX_TO_EDITION: Record<number, string> = {
  0: "BASE",
  1: "POTW",
  2: "HIGHLIGHT",
  3: "CLUB_SELECTION",
  4: "ICONIC",
};
