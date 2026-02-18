import React from 'react';

// Skema warna final: Basic (Cokelat), Common (Abu), Rare (Biru), Legend (Emas)
const rarityColors = {
    BASIC: 'border-slate-400 bg-slate-800',   
    COMMON: 'border-[#5D4037] bg-[#2D1B14]',  
    RARE: 'border-blue-500 bg-blue-900',      
    LEGEND: 'border-yellow-400 bg-[#3a3001]', 
};

const PlayerCard = ({ player, rarity = 'COMMON' }) => {
    const style = rarityColors[rarity] || rarityColors.COMMON;

    return (
        <div className={`relative w-40 h-60 md:w-48 md:h-72 rounded-xl border-4 ${style} shadow-lg overflow-hidden flex flex-col select-none`}>

            {/* Header Rating */}
            <div className="absolute top-1 left-1 md:top-2 md:left-2 flex flex-col items-center bg-black/60 p-0.5 md:p-1 rounded min-w-[24px] md:min-w-[30px] z-10">
                <span className="text-sm md:text-xl font-bold text-white leading-tight">
                    {player.overall || '-'}
                </span>
                <span className="text-[8px] md:text-xs text-gray-200">{player.position}</span>
            </div>

            {/* Gambar */}
            <div className="flex-1 overflow-hidden bg-gradient-to-b from-transparent to-black/80 relative">
                 <img 
                    src={player.image_url || "/default-player.png"} // Cek URL, kalau kosong pakai default lokal
                    alt={player.name} 
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[90%] object-cover object-top"
                    onError={(e) => { 
                        // Jika URL gambar pemain rusak/gagal load, ganti ke default lokal
                        e.target.onerror = null; // Mencegah loop error
                        e.target.src = "/default-player.png"; 
                    }} 
                />
            </div>

            {/* Info Nama */}
            <div className="bg-black/80 p-1 md:p-3 text-center z-10 h-[25%] flex flex-col justify-center">
                <h3 className="text-xs md:text-sm font-bold truncate text-white">{player.name}</h3>
                <p className="text-[8px] md:text-xs text-gray-400 truncate max-w-full">{player.team_name || "Free Agent"}</p>
            </div>

            {/* Badge Rarity */}
            <div className="absolute top-1 right-1 md:top-2 md:right-2 z-10">
                <span className={`text-[8px] md:text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm uppercase tracking-wider
                    ${rarity === 'LEGEND' ? 'bg-yellow-400 text-black' : 
                      rarity === 'RARE' ? 'bg-blue-600 text-white' : 
                      rarity === 'COMMON' ? 'bg-[#5D4037] text-gray-200' : 'bg-gray-500 text-white'}`}>
                    {rarity}
                </span>
            </div>
        </div>
    );
};

export default PlayerCard;