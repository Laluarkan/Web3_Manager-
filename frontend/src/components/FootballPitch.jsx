import React from 'react';
import PlayerCard from './PlayerCard';

const FootballPitch = ({ players, onPlayerClick }) => {
    
    const getPlayersByPos = (posCode) => {
        return players.filter(p => {
            const pos = p.player_details?.position?.trim().toUpperCase();
            return pos === posCode;
        });
    };

    const gk = getPlayersByPos('GK');
    const df = getPlayersByPos('DF');
    const mf = getPlayersByPos('MF');
    const fw = getPlayersByPos('FW');

    const PlayerRow = ({ rowPlayers }) => (
        <div className="flex flex-row justify-center gap-1 md:gap-4 items-center h-1/4 w-full relative z-10">
            {rowPlayers.map(card => (
                <div 
                    key={card.id} 
                    onClick={() => onPlayerClick(card.id)}
                    // MOBILE: scale-[0.35] agar muat 4 bek sejajar
                    // DESKTOP: md:scale-[0.55] agar lebih jelas
                    className="transform scale-[0.30] md:scale-[0.55] transition duration-200 active:scale-[0.40] md:hover:scale-[0.60] cursor-pointer relative group flex-shrink-0"
                >
                    <PlayerCard player={card.player_details} rarity={card.rarity} />
                    {/* Nama Pemain Kecil di Bawah Kartu (Opsional untuk mobile) */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[8px] px-1 rounded whitespace-nowrap opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {card.player_details.name}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="relative bg-gradient-to-b from-emerald-600 to-green-700 w-full h-full rounded-xl border-2 border-white/20 shadow-inner overflow-hidden select-none">
            
            {/* --- DEKORASI LAPANGAN (Simple CSS) --- */}
            <div className="absolute inset-0 opacity-20" 
                 style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, #000 40px, #000 80px)'}}>
            </div>
            {/* Garis Tengah & Lingkaran */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/40 -translate-y-1/2"></div>
            <div className="absolute top-1/2 left-1/2 w-20 h-20 md:w-32 md:h-32 border-2 border-white/40 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
            
            {/* --- POSISI PEMAIN --- */}
            {/* Padding vertical agar tidak terlalu mepet atas/bawah */}
            <div className="absolute inset-0 flex flex-col justify-between py-2 md:py-6 h-full w-full">
                <PlayerRow rowPlayers={fw} />
                <PlayerRow rowPlayers={mf} />
                <PlayerRow rowPlayers={df} />
                <PlayerRow rowPlayers={gk} />
            </div>
        </div>
    );
};

export default FootballPitch;