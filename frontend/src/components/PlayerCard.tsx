"use client";

import { UserCardData } from "@/lib/api";

const RARITY_STYLES: Record<string, { border: string; bg: string; badge: string }> = {
  COMMON: {
    border: "border-slate-500",
    bg: "from-slate-800 to-slate-900",
    badge: "bg-slate-600 text-slate-100",
  },
  RARE: {
    border: "border-sky-400",
    bg: "from-sky-900/90 to-slate-950",
    badge: "bg-sky-500 text-slate-950",
  },
  EPIC: {
    border: "border-purple-400",
    bg: "from-purple-900/90 to-slate-950",
    badge: "bg-purple-500 text-white",
  },
  LEGENDARY: {
    border: "border-amber-400",
    bg: "from-amber-700/70 via-amber-950 to-slate-950",
    badge: "bg-amber-400 text-slate-950",
  },
  MYTHIC: {
    border: "border-rose-400",
    bg: "from-rose-900/80 via-slate-950 to-amber-950",
    badge: "bg-gradient-to-r from-amber-300 to-rose-400 text-slate-950",
  },
};

const FORM_BADGE: Record<string, string> = {
  A: "bg-emerald-500 text-slate-950",
  B: "bg-lime-400 text-slate-950",
  C: "bg-slate-500 text-white",
  D: "bg-orange-500 text-white",
  E: "bg-red-600 text-white",
};

interface PlayerCardProps {
  card: UserCardData;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function PlayerCard({ card, compact = false, selected = false, onClick }: PlayerCardProps) {
  const style = RARITY_STYLES[card.rarity] || RARITY_STYLES.COMMON;
  const effectiveOvr = card.baseOverall + (card.level - 1);
  const initials = card.player.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group relative flex w-24 flex-col items-center rounded-xl border-2 bg-gradient-to-b p-1.5 text-left transition sm:w-28 ${
          style.border
        } ${style.bg} ${selected ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900" : "hover:scale-105"}`}
      >
        <div className="flex w-full items-center justify-between">
          <div className="leading-none">
            <div className="text-sm font-black text-white">{effectiveOvr}</div>
            <div className="text-[9px] font-bold text-slate-300">{card.position}</div>
          </div>
          <span className={`rounded px-1 py-0.5 text-[8px] font-extrabold ${style.badge}`}>
            {card.rarity.slice(0, 4)}
          </span>
        </div>

        <div className="my-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-slate-950/70 text-xs font-black text-emerald-300">
          {initials}
        </div>

        <div className="w-full truncate text-center text-[10px] font-bold text-white">
          {card.player.name}
        </div>
        <div className="w-full truncate text-center text-[8px] text-slate-400">
          {card.player.club.name}
        </div>

        {card.isOnChain && (
          <span className="mt-1 rounded bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-300">
            NFT #{card.tokenId}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col justify-between rounded-2xl border-2 bg-gradient-to-b p-3 shadow-lg transition ${
        style.border
      } ${style.bg} ${onClick ? "cursor-pointer hover:-translate-y-0.5" : ""} ${
        selected ? "ring-2 ring-emerald-400" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-2xl font-black leading-none text-white">{effectiveOvr}</div>
          <div className="mt-0.5 text-xs font-bold text-slate-300">
            {card.player.detailPosition} • Lv.{card.level}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${style.badge}`}>
            {card.rarity}
          </span>
          <div className="flex items-center gap-1">
            <span className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
              {card.edition}
            </span>
            <span
              title="Live Form Mingguan"
              className={`rounded px-1.5 py-0.5 text-[9px] font-black ${
                FORM_BADGE[card.player.liveForm] || FORM_BADGE.C
              }`}
            >
              {card.player.liveForm}
            </span>
          </div>
        </div>
      </div>

      <div className="my-3 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-sm font-black text-emerald-300">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold text-white">{card.player.name}</div>
          <div className="truncate text-xs text-slate-300">{card.player.club.name}</div>
          <div className="truncate text-[10px] text-slate-400">
            {card.player.club.leagueName} • {card.player.nationality}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[10px]">
        {card.isOnChain ? (
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-300">
            On-Chain NFT #{card.tokenId}
          </span>
        ) : (
          <span className="rounded bg-slate-700/70 px-1.5 py-0.5 font-semibold text-slate-300">
            Starter (Belum Mint)
          </span>
        )}
        {card.isListed && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-bold text-amber-300">
            Dijual
          </span>
        )}
      </div>
    </div>
  );
}
