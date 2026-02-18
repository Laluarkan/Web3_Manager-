import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers'; 
import PlayerCard from './components/PlayerCard';
import FootballPitch from './components/FootballPitch';
import FootballNFT from './FootballNFT.json'; // <--- PASTIKAN FILE INI ADA DI SRC

function App() {
  const [account, setAccount] = useState(null);
  const [viewMode, setViewMode] = useState('SQUAD'); 
  const [loading, setLoading] = useState(false);

  // --- DATA STATE ---
  const [myCards, setMyCards] = useState([]);
  const [marketPlayers, setMarketPlayers] = useState([]);
  const [matches, setMatches] = useState([]);         
  const [leaderboard, setLeaderboard] = useState([]); 
  const [profile, setProfile] = useState({ normal_tickets: 0, premium_tickets: 0 }); 
  const [userPredictions, setUserPredictions] = useState({});
  const [balance, setBalance] = useState("0"); // State untuk menyimpan saldo

  // --- STATE MODAL SQUAD ---
  const [selectedCard, setSelectedCard] = useState(null);
  const [showModal, setShowModal] = useState(false);      
  const [sellPrice, setSellPrice] = useState('');         
  const [isSelling, setIsSelling] = useState(false);      

  // --- WEB3 CONFIG ---
  // GANTI INI DENGAN ALAMAT KONTRAK YANG ANDA DAPAT DARI TERMINAL DEPLOY
  const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; 

  // --- KONEKSI WALLET ---
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
      } catch (error) { alert("Gagal konek wallet!"); }
    } else { alert("Install MetaMask dulu!"); }
  };

  const getHeaders = () => ({ headers: { 'X-Wallet-Address': account } });
  
  // GANTI IP INI SESUAI NETWORK ANDA
  const API_URL = 'http://10.154.217.241:8000/api'; 

  // --- API CALLS (Sama seperti sebelumnya) ---
  const fetchMyCards = async () => {
    if (!account) return;
    try { const res = await axios.get(`${API_URL}/my-cards/`, getHeaders()); setMyCards(res.data); } catch (err) {}
  };
  
  const fetchMarket = async () => {
    try { const res = await axios.get(`${API_URL}/market/`, getHeaders()); setMarketPlayers(res.data); } catch (err) {}
  };

  const fetchProfile = async () => {
    if (!account) return;
    try { const res = await axios.get(`${API_URL}/profile/`, getHeaders()); setProfile(res.data); } catch (err) {}
  };

  const fetchBalance = async () => {
  if (!account) return;
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const bal = await provider.getBalance(account);
    setBalance(ethers.formatEther(bal)); // Ubah dari Wei ke ETH
  } catch (err) {
    console.error("Gagal ambil saldo:", err);
  }
};

  const fetchMatches = async () => {
    try { const res = await axios.get(`${API_URL}/matches/`, getHeaders()); setMatches(res.data); } catch (err) {}
  };

  const fetchLeaderboard = async () => {
    try { const res = await axios.get(`${API_URL}/leaderboard/`, getHeaders()); setLeaderboard(res.data); } catch (err) {}
  };

  const fetchMyPredictions = async () => {
    if (!account) return;
    try { 
        const res = await axios.get(`${API_URL}/my-predictions/`, getHeaders()); 
        setUserPredictions(res.data); 
    } catch (err) {}
  };

  // --- ACTIONS ---

  const handleCardClick = (card) => {
    setSelectedCard(card); setIsSelling(false); setSellPrice(''); setShowModal(true);  
  };

  const handleToggleLineupFromModal = async () => {
    if (!selectedCard) return;
    try {
        await axios.post(`${API_URL}/toggle-lineup/${selectedCard.id}/`, {}, getHeaders());
        await fetchMyCards(); setShowModal(false); 
    } catch (error) { alert("" + error.response?.data?.error); }
  };

  const handleRemoveFromLineup = async (playerOrId) => {
    const cardId = typeof playerOrId === 'object' ? playerOrId.id : playerOrId;
    try { await axios.post(`${API_URL}/toggle-lineup/${cardId}/`, {}, getHeaders()); await fetchMyCards(); } catch (error) {}
  };

  const handleSellCard = async () => {
    if (!selectedCard || !sellPrice) return alert("Masukkan harga!");
    setLoading(true);
    try {
        await axios.post(`${API_URL}/sell-card/${selectedCard.id}/`, { price: sellPrice }, getHeaders());
        alert("Berhasil dijual!"); fetchMyCards(); fetchMarket(); setShowModal(false);
    } catch (error) { alert("" + error.response?.data?.error); }
    setLoading(false);
  };

  const handleBuy = async (cardId, playerName, price) => {
    if (!window.confirm(`Beli ${playerName} seharga ${price} ETH?`)) return;
    try {
        await axios.post(`${API_URL}/buy-market/${cardId}/`, {}, getHeaders());
        alert("Pembelian Berhasil!"); fetchMyCards(); fetchMarket();  
    } catch (error) { alert("" + (error.response?.data?.error || "Gagal")); }
  };

  const claimStarterPack = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/generate-starter/`, {}, getHeaders());
      fetchMyCards(); alert("Starter Pack Diterima!");
    } catch (err) { alert("" + (err.response?.data?.message || "Gagal")); }
    setLoading(false);
  };

  const handlePlayMatch = async () => { 
    setLoading(true);
    try {
        const res = await axios.post(`${API_URL}/play-match/`, {}, getHeaders());
        const data = res.data;
        alert(`MATCH REPORT:\n${data.opponent} (${data.opp_rating}) vs Anda (${data.my_rating})\nSKOR: ${data.score}\nHASIL: ${data.result}`);
    } catch (error) { alert(error.response?.data?.error); }
    setLoading(false);
  };

  const handlePredict = async (matchId, prediction) => {
      setUserPredictions(prev => ({ ...prev, [matchId]: prediction }));
      try {
          await axios.post(`${API_URL}/predict/${matchId}/`, { prediction }, getHeaders());
      } catch (error) { 
          alert("" + error.response?.data?.error); 
          fetchMyPredictions();
      }
  };

  const handleClaimRewards = async () => {
      try {
          const res = await axios.post(`${API_URL}/claim-rewards/`, {}, getHeaders());
          alert(res.data.message); fetchProfile();
      } catch (error) { alert("Gagal klaim hadiah"); }
  };

  // --- [NEW] WEB3 GACHA HANDLER ---
  const handleGacha = async (type) => {
      if (!account) return alert("Harap konek wallet dulu!");
      setLoading(true);
      try {
          const res = await axios.post(`${API_URL}/gacha/`, { type }, getHeaders());
          
          setProfile(prev => ({
              ...prev,
              normal_tickets: res.data.new_tickets.normal,
              premium_tickets: res.data.new_tickets.premium
          }));

          alert(res.data.message); 
          fetchMyCards(); 
      } catch (error) {
          alert("" + (error.response?.data?.error || "Gagal Gacha"));
      }
      setLoading(false);
  };

  const handleMintCard = async () => {
      if (!selectedCard) return;
      if (selectedCard.is_minted) return alert("Kartu ini sudah NFT!");
      
      if(!window.confirm("Ubah kartu ini jadi NFT? Biaya gas fee ditanggung Anda.")) return;

      setLoading(true);
      try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const contract = new ethers.Contract(CONTRACT_ADDRESS, FootballNFT.abi, signer);

          // Data Dummy Metadata
          const playerId = selectedCard.player_details.id;
          const rarity = selectedCard.rarity;
          const metadataUrl = `https://api.game.com/meta/${playerId}/${rarity}`;

          console.log("Minting ke Blockchain...");
          const tx = await contract.mintCard(account, metadataUrl, playerId, rarity);
          
          console.log("Tunggu konfirmasi...");
          await tx.wait(); 
          
          // Lapor ke Backend
          await axios.post(`${API_URL}/confirm-mint/`, {
              card_id: selectedCard.id,
              tx_hash: tx.hash,
              token_id: Math.floor(Math.random() * 10000) // Dummy ID
          }, getHeaders());

          alert("SUKSES! Kartu kini abadi di Blockchain.");
          fetchMyCards();
          setShowModal(false);

      } catch (error) {
          console.error(error);
          alert("Minting Gagal: " + error.message);
      }
      setLoading(false);
  };

  const handleRestoreNFTs = async () => {
      if (!account) return alert("Konek wallet dulu!");
      if (!window.confirm("Cek Blockchain untuk memulihkan kartu yang hilang di Database?")) return;
      
      setLoading(true);
      try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          // Gunakan provider untuk membaca event log (lebih fleksibel daripada contract object)
          const contract = new ethers.Contract(CONTRACT_ADDRESS, FootballNFT.abi, provider);

          // 1. Ambil semua event "CardMinted" dari masa lalu
          const filter = contract.filters.CardMinted(); 
          const logs = await contract.queryFilter(filter);
          
          console.log(`Ditemukan ${logs.length} riwayat minting global.`);

          let restoredCount = 0;

          // 2. Loop setiap kartu
          for (const log of logs) {
              try {
                  // Cek apakah pemilik kartu ini adalah akun yang sedang login?
                  // (log.args[1] adalah parameter 'owner' di smart contract)
                  if (log.args[1].toLowerCase() !== account.toLowerCase()) continue;

                  const tokenId = Number(log.args[0]); // Ambil Token ID
                  
                  // Ambil Data Pemain dari URI
                  const tokenURI = await contract.tokenURI(tokenId);
                  // Format URI kita: ".../api/metadata/{PLAYER_ID}/{RARITY}"
                  
                  const parts = tokenURI.split('/');
                  const rarity = parts[parts.length - 1];   
                  const playerId = parts[parts.length - 2]; 

                  console.log(`Mencoba restore: ID ${tokenId}, Player ${playerId}, Rarity ${rarity}`);

                  // 3. Kirim ke Backend untuk disimpan ulang
                  await axios.post(`${API_URL}/restore-card/`, {
                      player_id: playerId,
                      rarity: rarity,
                      token_id: tokenId
                  }, getHeaders());
                  
                  restoredCount++;
              } catch (innerError) {
                  console.warn("Skip log error:", innerError);
              }
          }

          // --- LOGIKA UPDATE TAMPILAN (YANG DIPERBAIKI) ---
          if (restoredCount > 0) {
              alert(`Selesai! ${restoredCount} NFT berhasil disinkronkan kembali ke Squad.`);
              
              // 1. Ambil data terbaru dari backend
              await fetchMyCards(); 
              
              // 2. Tutup Modal & Reset Pilihan (Agar status Off-chain hilang)
              setShowModal(false); 
              setSelectedCard(null);
          } else {
              alert("Semua NFT di blockchain sudah ada di Squad. Tidak ada yang perlu dipulihkan.");
          }

      } catch (error) {
          console.error(error);
          alert("Gagal Restore: " + error.message);
      }
      setLoading(false);
  };

  // --- INIT DATA ---
  useEffect(() => {
  if (account) { 
        fetchMyCards(); fetchMarket(); fetchProfile(); 
        fetchMatches(); fetchLeaderboard(); 
        fetchMyPredictions();
        fetchBalance(); // <--- Tambahkan ini
    }
    }, [account]);

  // --- RENDER LOGIN ---
  if (!account) return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 text-center">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-8">W3 MANAGER</h1>
          <button onClick={connectWallet} className="bg-orange-600 active:bg-orange-700 px-8 py-4 rounded-full font-bold text-xl shadow-lg w-full max-w-xs transition transform active:scale-95">Connect Wallet</button>
      </div>
  );

  const calculateTeamRating = () => {
    const startingXI = myCards.filter(c => c.is_playing);
    if (startingXI.length === 0) return 0;
    const total = startingXI.reduce((sum, c) => sum + (Number(c.player_details.overall) || 0), 0);
    return Math.floor(total / startingXI.length);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white font-sans overflow-hidden relative">
      
      {/* MODAL SQUAD (TIDAK BERUBAH) */}
      {showModal && selectedCard && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-slate-800 border-2 border-slate-600 rounded-2xl p-6 w-full max-w-xs flex flex-col items-center shadow-2xl">
                <div className="w-full flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Atur Pemain</h2>
                    <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>
                <div className="transform scale-90 mb-[-10px]">
                    <PlayerCard player={selectedCard.player_details} rarity={selectedCard.rarity} />
                </div>
                <p className="text-lg font-bold text-yellow-400 mb-2">{selectedCard.player_details.name}</p>
                
                {/* Indikator Status NFT */}
                <div className="mb-4 text-xs">
                    {selectedCard.is_minted ? 
                        <span className="bg-green-900 text-green-300 px-2 py-1 rounded border border-green-700">✅ On-Chain (NFT)</span> 
                        : 
                        <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600">Off-Chain (Database)</span>
                    }
                </div>

                {!isSelling ? (
                    <div className="flex gap-2 w-full">
                        <button onClick={handleToggleLineupFromModal} className="flex-1 bg-green-600 active:bg-green-700 py-3 rounded-xl font-bold shadow-lg text-sm">
                            {selectedCard.is_playing ? "Cadangkan" : "Mainkan"}
                        </button>
                        
                        {/* --- [LOGIKA BARU: PROTEKSI JUAL] --- */}
                        {selectedCard.is_minted ? (
                            // Jika sudah NFT -> Tombol Jual MATI/INFORMASI
                            <button onClick={() => alert("Kartu ini sudah jadi NFT!\nSilakan jual di OpenSea atau Transfer via MetaMask.")} className="flex-1 bg-gray-700 text-gray-400 py-3 rounded-xl font-bold shadow-lg text-sm flex flex-col items-center justify-center border border-gray-600">
                                <span>Terkunci</span>
                                <span className="text-[8px]">Aset On-Chain</span>
                            </button>
                        ) : (
                            // Jika masih Database -> Tombol Jual NYALA (Bisa masuk Market Game)
                            <button onClick={() => setIsSelling(true)} className="flex-1 bg-red-600 active:bg-red-700 py-3 rounded-xl font-bold shadow-lg text-sm">
                                Jual ke Market
                            </button>
                        )}

                        {/* Tombol Minting Muncul HANYA jika belum Mint */}
                        {!selectedCard.is_minted && (
                             <button onClick={handleMintCard} disabled={loading} className="flex-1 bg-purple-600 active:bg-purple-700 py-3 rounded-xl font-bold shadow-lg text-sm flex flex-col items-center justify-center leading-tight">
                                <span>MINT NFT</span>
                                <span className="text-[9px] opacity-70">Gas Fee</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="w-full">
                        <label className="text-xs text-gray-400 mb-1 block">Harga (ETH)</label>
                        <input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white mb-4 focus:outline-none" placeholder="0.1" />
                        <div className="flex gap-2">
                            <button onClick={() => setIsSelling(false)} className="flex-1 bg-gray-600 py-2 rounded-lg font-bold text-sm">Batal</button>
                            <button onClick={handleSellCard} className="flex-1 bg-blue-600 py-2 rounded-lg font-bold text-sm shadow-lg">{loading ? "..." : "Confirm"}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* HEADER (TIDAK BERUBAH) */}
      {/* HEADER: Navigasi, Tiket, & Wallet */}
      <header className="flex-none flex flex-col bg-slate-800 p-2 shadow-lg border-b border-slate-700 z-20 gap-2">
        <div className="flex justify-between items-center">
            <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">W3 MANAGER</h1>
            
            <div className="flex gap-2 items-center">
                {/* INFO WALLET & SALDO */}
                <div className="hidden md:flex flex-col items-end mr-2 bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-700">
                    <span className="text-[10px] text-gray-400 font-mono">
                        {account.substring(0, 6)}...{account.substring(account.length - 4)}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                        {parseFloat(balance).toFixed(2)} ETH
                    </span>
                </div>

                {/* Tampilan Tiket */}
                <div className="flex gap-2 text-xs font-mono bg-slate-900 px-3 py-1 rounded-full border border-slate-600">
                    <span className="text-blue-300">🎫 N:{profile.normal_tickets}</span>
                    <span className="text-yellow-400">🎟️ P:{profile.premium_tickets}</span>
                </div>

                {/* Rating Tim */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-gray-700 border border-slate-500 text-white shadow-lg text-xs">
                    {calculateTeamRating()}
                </div>
            </div>
        </div>

        {/* MENU SCROLLABLE */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {['SQUAD', 'MARKET', 'PREDICTIONS', 'GACHA', 'LEADERBOARD'].map(mode => (
                <button 
                    key={mode}
                    onClick={() => setViewMode(mode)} 
                    className={`px-4 py-1.5 rounded-full font-bold text-[10px] whitespace-nowrap transition ${viewMode === mode ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-700 text-gray-400'}`}
                >
                    {mode}
                </button>
            ))}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden relative w-full h-full bg-slate-900">
        
        {/* VIEW: SQUAD (TIDAK BERUBAH) */}
        {viewMode === 'SQUAD' && (
          <div className="h-full w-full flex flex-col md:flex-row">
            {myCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full w-full p-4 gap-4">
                <p className="text-gray-400">Belum ada pemain?</p>
                <div className="flex gap-4">
                    <button onClick={claimStarterPack} disabled={loading} className="bg-orange-600 active:bg-orange-700 px-6 py-3 rounded-xl font-bold text-lg shadow-xl">
                        KLAIM STARTER
                    </button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[55%] md:h-full w-full md:w-[70%] flex flex-col p-2 md:p-4 order-1 md:order-2">
                    <div className="flex justify-between items-center mb-2 px-3 py-2 bg-slate-800/90 rounded-lg border border-slate-700 shadow-sm">
                        <h3 className="text-xs md:text-lg font-bold text-green-400">Starting XI</h3>
                    </div>
                    <div className="flex-1 rounded-xl overflow-hidden border border-slate-700 relative bg-slate-900 shadow-2xl w-full">
                        <FootballPitch players={myCards.filter(c => c.is_playing)} onPlayerClick={handleRemoveFromLineup} />
                    </div>
                </div>
                <div className="h-[45%] md:h-full w-full md:w-[30%] bg-slate-800 border-t md:border-t-0 md:border-r border-slate-700 flex flex-col shadow-xl order-2 md:order-1 z-10">
                    <div className="p-2 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
                        {/* Judul Bench */}
                        <h3 className="font-bold text-yellow-400 text-xs md:text-sm">Bench</h3>
                        
                        {/* Tombol Sync (Dibuat lebih kecil & rapi di pojok kanan) */}
                        <button 
                            onClick={handleRestoreNFTs} 
                            disabled={loading} 
                            className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white px-3 py-1 rounded-lg text-[10px] font-bold shadow-md transition-all border border-purple-500 flex items-center gap-1 disabled:opacity-50"
                        >
                            {loading ? (
                                <span>Scanning...</span>
                            ) : (
                                <>
                                    <span>$</span> SYNC NFT
                                </>
                            )}
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-slate-900/50">
                        <div className="grid grid-cols-3 md:grid-cols-2 gap-2 pb-20 md:pb-10"> 
                            {myCards.filter(c => !c.is_playing && !c.is_on_sale).map(card => (
                                <div key={card.id} onClick={() => handleCardClick(card)} className="relative cursor-pointer active:scale-95 transition flex justify-center h-32 md:h-48">
                                    <div className="transform scale-[0.45] md:scale-[0.65] origin-top">
                                        <PlayerCard player={card.player_details} rarity={card.rarity} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* VIEW: MARKET (TIDAK BERUBAH) */}
        {viewMode === 'MARKET' && (
          <div className="h-full overflow-y-auto pb-20 p-2 md:p-4">
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {marketPlayers.map((card) => (
                    <div key={card.id} className="flex flex-col items-center bg-slate-800 p-2 rounded-lg relative shadow-md">
                        <div className="absolute top-2 right-2 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded z-10">{card.price} Ξ</div>
                        <div className="transform scale-[0.5] md:scale-[0.6] origin-top h-36 md:h-44 w-full flex justify-center">
                            <PlayerCard player={card.player_details} rarity={card.rarity} />
                        </div>
                        <button onClick={() => handleBuy(card.id, card.player_details.name, card.price)} className="mt-[-10px] bg-emerald-600 active:bg-emerald-700 text-white text-[10px] md:text-xs px-4 py-2 rounded-full font-bold shadow-lg w-full">Buy</button>
                    </div>
                ))}
             </div>
          </div>
        )}

        {/* VIEW: PREDICTIONS (TIDAK BERUBAH) */}
        {viewMode === 'PREDICTIONS' && (
           <div className="h-full overflow-y-auto p-4 pb-20">
               <div className="flex justify-between items-center mb-4">
                   <h2 className="text-xl font-bold text-white">Jadwal Pertandingan</h2>
                   <button onClick={handleClaimRewards} className="bg-yellow-500 text-black px-4 py-1 text-sm rounded-full font-bold shadow hover:bg-yellow-400">Klaim Hadiah</button>
               </div>
               
               {matches.length === 0 ? <p className="text-gray-400 text-center mt-10">Belum ada jadwal tersedia.</p> : (
                   <div className="space-y-3">
                       {matches.map(match => (
                        <div key={match.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-3 shadow-lg">
                            <div className="flex justify-between text-xs text-gray-400 border-b border-slate-700 pb-2">
                                <span className="bg-slate-700 px-2 py-0.5 rounded text-white">{match.div}</span>
                                <span>{match.date}</span>
                            </div>
                            
                            <div className="flex justify-between items-center px-4 py-4 relative">
                                <div className="flex flex-col items-center w-1/3 gap-3 z-10">
                                    <div className="relative w-16 h-16 md:w-20 md:h-20 bg-white/5 rounded-full flex items-center justify-center shadow-inner border border-white/10 p-2">
                                        <img 
                                            src={match.home_logo || `https://ui-avatars.com/api/?name=${match.home_team_name}&background=random&color=fff&size=128&rounded=true&bold=true&length=2`} 
                                            alt="Home" 
                                            referrerPolicy="no-referrer" 
                                            className="w-full h-full object-contain filter drop-shadow-md" 
                                            onError={(e) => {
                                                e.target.onerror = null; 
                                                e.target.src = `https://ui-avatars.com/api/?name=${match.home_team_name}&background=1e293b&color=fff&size=128&rounded=true&bold=true&length=2`;
                                            }}
                                        />
                                    </div>
                                    <span className="font-bold text-sm md:text-base text-center leading-tight text-white">{match.home_team_name}</span>
                                </div>

                                <div className="flex flex-col items-center justify-center w-1/3 z-10">
                                    {match.is_finished ? (
                                        <div className="flex flex-col items-center">
                                            <span className="text-3xl font-black text-white tracking-widest">{match.fthg} - {match.ftag}</span>
                                            <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest mt-1">Full Time</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center">
                                            <span className="text-2xl font-black text-slate-600 italic">VS</span>
                                            <span className="text-[10px] text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-800/50 mt-1">Upcoming</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-center w-1/3 gap-3 z-10">
                                    <div className="relative w-16 h-16 md:w-20 md:h-20 bg-white/5 rounded-full flex items-center justify-center shadow-inner border border-white/10 p-2">
                                        <img 
                                            src={match.away_logo || `https://ui-avatars.com/api/?name=${match.away_team_name}&background=random&color=fff&size=128&rounded=true&bold=true&length=2`} 
                                            alt="Away" 
                                            referrerPolicy="no-referrer" 
                                            className="w-full h-full object-contain filter drop-shadow-md"
                                            onError={(e) => {
                                                e.target.onerror = null; 
                                                e.target.src = `https://ui-avatars.com/api/?name=${match.away_team_name}&background=1e293b&color=fff&size=128&rounded=true&bold=true&length=2`;
                                            }}
                                        />
                                    </div>
                                    <span className="font-bold text-sm md:text-base text-center leading-tight text-white">{match.away_team_name}</span>
                                </div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-blue-500/10 blur-3xl rounded-full -z-0"></div>
                            </div>

                            <div className="flex gap-2 mt-1">
                                <button 
                                    onClick={() => handlePredict(match.id, 'H')} 
                                    disabled={match.is_finished}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition transform active:scale-95
                                        ${userPredictions[match.id] === 'H' 
                                            ? 'bg-blue-600 text-white ring-2 ring-white shadow-lg shadow-blue-500/50' 
                                            : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                                        }`}
                                >
                                    Home
                                </button>
                                <button 
                                    onClick={() => handlePredict(match.id, 'D')} 
                                    disabled={match.is_finished}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition transform active:scale-95
                                        ${userPredictions[match.id] === 'D' 
                                            ? 'bg-orange-500 text-white ring-2 ring-white shadow-lg shadow-orange-500/50' 
                                            : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                                        }`}
                                >
                                    Draw
                                </button>
                                <button 
                                    onClick={() => handlePredict(match.id, 'A')} 
                                    disabled={match.is_finished}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition transform active:scale-95
                                        ${userPredictions[match.id] === 'A' 
                                            ? 'bg-red-600 text-white ring-2 ring-white shadow-lg shadow-red-500/50' 
                                            : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                                        }`}
                                >
                                    Away
                                </button>
                            </div>
                        </div>
                        ))}
                   </div>
               )}
           </div>
        )}

        {/* VIEW: GACHA (TIDAK BERUBAH) */}
        {viewMode === 'GACHA' && (
            <div className="h-full flex flex-col items-center justify-center p-6 gap-6">
                <h2 className="text-2xl font-bold text-white mb-4">Summon Players</h2>
                <div className="w-full max-w-sm bg-slate-800 p-6 rounded-2xl border border-slate-600 flex flex-col items-center text-center shadow-lg">
                    <h3 className="text-xl font-bold text-blue-400">Normal Gacha</h3>
                    <p className="text-xs text-gray-400 mb-4">Isi: Basic, Common, Rare (No Legend)</p>
                    <p className="text-sm mb-4">Cost: <span className="text-blue-300 font-bold">1 Tiket Normal</span></p>
                    <button onClick={() => handleGacha('NORMAL')} disabled={loading || profile.normal_tickets < 1} className="w-full bg-blue-600 active:bg-blue-700 py-3 rounded-xl font-bold disabled:opacity-50">
                        {loading ? "Summoning..." : "GACHA (Normal)"}
                    </button>
                </div>
                <div className="w-full max-w-sm bg-gradient-to-br from-slate-800 to-yellow-900/30 p-6 rounded-2xl border border-yellow-600 flex flex-col items-center text-center shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-bold px-2 py-1">HIGH RATE</div>
                    <h3 className="text-xl font-bold text-yellow-400">Premium Gacha</h3>
                    <p className="text-xs text-gray-400 mb-4">Isi: Rare & Legend!</p>
                    <p className="text-sm mb-4">Cost: <span className="text-yellow-400 font-bold">1 Tiket Premium</span></p>
                    <button onClick={() => handleGacha('PREMIUM')} disabled={loading || profile.premium_tickets < 1} className="w-full bg-yellow-600 active:bg-yellow-700 py-3 rounded-xl font-bold text-black disabled:opacity-50">
                        {loading ? "Summoning..." : "GACHA (Premium)"}
                    </button>
                </div>
            </div>
        )}

        {/* VIEW: LEADERBOARD (TIDAK BERUBAH) */}
        {viewMode === 'LEADERBOARD' && (
            <div className="h-full overflow-y-auto p-4">
                <h2 className="text-xl font-bold text-white mb-4 text-center">Fantasy Leaderboard</h2>
                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900 text-gray-400">
                            <tr>
                                <th className="p-3">#</th>
                                <th className="p-3">User</th>
                                <th className="p-3 text-right">Points</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {leaderboard.length === 0 ? (
                                <tr><td colSpan="3" className="p-4 text-center text-gray-500">Belum ada data minggu ini.</td></tr>
                            ) : (
                                leaderboard.map((row, index) => (
                                    <tr key={index} className={index < 3 ? 'bg-yellow-900/10' : ''}>
                                        <td className="p-3 font-bold text-gray-400">{index + 1}</td>
                                        <td className="p-3 font-bold text-white">{row.username}</td>
                                        <td className="p-3 text-right font-mono text-green-400 font-bold">{row.total_points}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-center text-gray-500 mt-4">Top 3 User akan mendapatkan Tiket Premium setiap minggu.</p>
            </div>
        )}

      </main>
    </div>
  );
}

export default App;