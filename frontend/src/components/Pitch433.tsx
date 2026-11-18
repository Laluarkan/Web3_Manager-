"use client";

import { LineupSlotData } from "@/lib/api";
import { PlayerCard } from "./PlayerCard";

const ROWS_433 = [
  { label: "FW", slots: ["LW", "ST", "RW"] },
  { label: "MF", slots: ["LCM", "CM", "RCM"] },
  { label: "DF", slots: ["LB", "LCB", "RCB", "RB"] },
  { label: "GK", slots: ["GK"] },
];

interface Pitch433Props {
  slots: LineupSlotData[];
  selectedSlotCode: string | null;
  onSelectSlot: (slotCode: string, slot?: LineupSlotData) => void;
}

export function Pitch433({ slots, selectedSlotCode, onSelectSlot }: Pitch433Props) {
  const bySlot = new Map(slots.map((s) => [s.slotCode, s]));

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-900 via-emerald-800 to-green-900 p-4 shadow-2xl">
      {/* Garis lapangan */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 bg-white/20" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/20" />
      <div className="pointer-events-none absolute inset-x-1/4 top-0 h-16 border-x-2 border-b-2 border-white/20" />
      <div className="pointer-events-none absolute inset-x-1/4 bottom-0 h-16 border-x-2 border-t-2 border-white/20" />

      <div className="relative z-10 flex flex-col gap-5">
        {ROWS_433.map((row) => (
          <div key={row.label} className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            {row.slots.map((code) => {
              const slot = bySlot.get(code);
              const isSelected = selectedSlotCode === code;

              return (
                <div key={code} className="flex flex-col items-center gap-1">
                  <span className="rounded bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    {code}
                  </span>
                  {slot ? (
                    <PlayerCard
                      card={slot.userCard}
                      compact
                      selected={isSelected}
                      onClick={() => onSelectSlot(code, slot)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectSlot(code)}
                      className={`flex h-28 w-24 items-center justify-center rounded-xl border-2 border-dashed text-xs font-bold transition sm:w-28 ${
                        isSelected
                          ? "border-emerald-300 bg-emerald-500/20 text-emerald-200"
                          : "border-white/30 bg-slate-950/40 text-white/60 hover:border-white/60"
                      }`}
                    >
                      + {code}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
