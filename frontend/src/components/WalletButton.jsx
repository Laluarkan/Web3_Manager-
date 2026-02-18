import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const WalletButton = () => {
    const [account, setAccount] = useState(null);
    const [balance, setBalance] = useState(null);

    // Fungsi untuk menghubungkan dompet
    const connectWallet = async () => {
        // 1. Cek apakah user punya MetaMask
        if (window.ethereum) {
            try {
                // 2. Minta izin akses akun
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                const userAccount = accounts[0];
                setAccount(userAccount);

                // 3. Ambil saldo (Opsional, biar keren)
                const provider = new ethers.BrowserProvider(window.ethereum);
                const bal = await provider.getBalance(userAccount);
                setBalance(ethers.formatEther(bal));

            } catch (error) {
                console.error("User menolak koneksi:", error);
            }
        } else {
            alert("Tolong install MetaMask dulu!");
        }
    };

    // Fungsi untuk memendekkan alamat (misal: 0x1234...5678)
    const shortenAddress = (addr) => {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    return (
        <div>
            {account ? (
                <div className="flex items-center gap-4 bg-gray-800 border border-gray-600 rounded-full px-4 py-2 shadow-lg">
                    {/* Tampilkan Saldo */}
                    <div className="text-sm font-medium text-green-400">
                        {parseFloat(balance).toFixed(4)} MATIC
                    </div>
                    
                    {/* Tampilkan Alamat Dompet */}
                    <div className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {shortenAddress(account)}
                    </div>
                </div>
            ) : (
                <button 
                    onClick={connectWallet}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-bold transition shadow-lg hover:shadow-blue-500/50"
                >
                    Connect Wallet
                </button>
            )}
        </div>
    );
};

export default WalletButton;