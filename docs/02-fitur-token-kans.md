# 02 — Fitur Mata Uang Game: Token KANS (ERC-20)

Dokumen ini menjelaskan desain teknis, ekonomi (*tokenomics*), penjelasan **Liquidity Pool (DEX)** serta **Vesting Tim**, dan jalur listing **`KANS`** ke pasar kripto.

---

## 1. Spesifikasi Smart Contract (`KansToken.sol`)

- **Nama Token:** `Kans Token`
- **Simbol:** `KANS`
- **Standar:** **ERC-20** (OpenZeppelin `ERC20`, `ERC20Burnable`, `ERC20Capped`, `AccessControl`)
- **Desimal:** `18` (standar industri Ethereum/EVM)
- **Max Supply (Batas Maksimal):** `100,000,000 KANS` *(100 juta koin — tidak dapat dicetak melebihi batas ini untuk mencegah inflasi tak terbatas)*

### Hak Akses (*Access Control*)
- `DEFAULT_ADMIN_ROLE`: Pemilik proyek (pengaturan awal & darurat).
- `MINTER_ROLE`: Diberikan khusus kepada Smart Contract reward/treasury agar koin hanya keluar sesuai aturan permainan.

---

## 2. Kegunaan KANS di Dalam Game (*Pure Football Manager*)

### A. Cara Pemain Mendapatkan KANS (*Faucet*)
1. **Menjual Kartu NFT di Marketplace (100% Menggunakan `KANS`):**
   - Seluruh jual-beli kartu di Marketplace menggunakan mata uang **`KANS`** secara langsung.
   - Jika pembeli hanya memiliki koin lain (misalnya ETH/USDC/USDT), pembeli menukar koinnya terlebih dahulu menjadi **`KANS`** (melalui DEX seperti Uniswap/Aerodrome saat sudah Mainnet, atau lewat Faucet uji coba saat di Hardhat/Testnet), lalu membeli kartu di Marketplace menggunakan `KANS`.
   - *Keuntungan:* Smart Contract Marketplace jauh lebih sederhana, lebih aman, hemat gas fee, dan mendorong permintaan langsung terhadap koin **`KANS`**.
2. **Hadiah Pertandingan & Turnamen Koin (Pure Manager):**
   - Menang di **Mode Kompetitif / Liga Manager / Turnamen Koin KANS** *(khusus pemain yang sudah menghubungkan Wallet)*.
   - *(Catatan: Tidak ada fitur prediksi skor pertandingan nyata; fokus 100% pure football manager).*
3. **Testing Lokal / Testnet:**
   - Di tahap Hardhat & Testnet, tersedia tombol **Faucet Test KANS** (klaim koin uji coba gratis) untuk mengetes jual-beli dan turnamen koin.

### B. Cara Pemain Membelanjakan KANS (*Sink*)
1. **Membeli Kartu NFT di Marketplace P2P** antar pemain.
2. **Fee Marketplace (2.5%):** Dipotong dari setiap transaksi jual-beli → sebagian masuk **Treasury** (hadiah turnamen) dan sebagian di-**Burn** (dimusnahkan permanen agar suplai KANS makin langka).
3. **Membeli Pack / Gacha NFT (Tahap 2):** Membuka Standard Pack, Event Pack (`POTW`), atau Legend Pack.
4. **Upgrade / Training Kartu (Tahap 2):** Menaikkan level & rating kartu NFT.
5. **Biaya Pendaftaran Turnamen Berhadiah Koin KANS:** *Prize pool* dibagikan kepada para juara turnamen.

---

## 3. Alokasi Supply KANS & Penjelasan Konsep Penting

| Alokasi | Persentase | Jumlah KANS | Tujuan |
| :--- | :---: | :---: | :--- |
| **Game Rewards & Turnamen** | 45% | 45.000.000 | Hadiah liga manager, turnamen koin, event musiman. |
| **Liquidity Pool (DEX)** | 20% | 20.000.000 | Cadangan likuiditas di pasar DEX agar KANS bisa ditukar ke ETH/USDC/Rupiah. |
| **Ecosystem & Treasury** | 20% | 20.000.000 | Pengembangan game, marketing, event komunitas, kemitraan. |
| **Tim & Developer (Vesting / Dikunci)** | 15% | 15.000.000 | Jatah tim pembuat game yang dikunci bertahap di Smart Contract. |

### Apa itu *Liquidity Pool (DEX)*?
Bayangkan **Liquidity Pool** seperti **Money Changer otomatis tanpa kasir manusia** yang berjalan di blockchain (contohnya di **Uniswap**, **PancakeSwap**, atau **Aerodrome**):
- Agar pemain bisa menukar `KANS ↔ USDC/ETH` (baik untuk membeli `KANS` sebelum belanja di game maupun mencairkan `KANS` hasil main/jual kartu), harus ada **"laci kas"** yang menyimpan stok **kedua koin sekaligus** — misalnya `1.000.000 KANS` dipasangkan dengan `$5.000 USDC`.
- "Laci kas" berisi pasangan dua koin itulah yang disebut **Liquidity Pool**.
- **Cara penentuan harganya otomatis (AMM — *Automated Market Maker*):**
  - Jika banyak orang membeli `KANS` (memasukkan `USDC`, mengambil `KANS` dari laci), stok `KANS` menipis → **harga `KANS` otomatis naik**.
  - Jika banyak orang menjual `KANS` (memasukkan `KANS`, mengambil `USDC` dari laci), stok `KANS` melimpah → **harga `KANS` otomatis turun**.
- Tanpa Liquidity Pool di Mainnet, orang tidak punya tempat otomatis untuk menukar KANS menjadi uang lain.

### Apa itu *Tim & Developer (Vesting / Dikunci)*?
Bayangkan kamu sebagai pembuat game memegang 15% (15 juta) koin `KANS`.
- **Masalah jika tidak dikunci:** Di dunia kripto, pemain dan investor akan takut terkena **"Rug Pull"** — yaitu ketakutan bahwa developer tiba-tiba menjual seluruh 15 juta koinnya sekaligus ke Liquidity Pool sampai harga `KANS` anjlok menjadi Rp 0.
- **Solusinya (*Vesting Smart Contract*):** 15% jatah tim **dikunci di dalam Smart Contract khusus** sehingga bahkan developer sendiri **tidak bisa menariknya sekaligus**.
- **Contoh skema Vesting standar industri (3 tahun):**
  - **Cliff 6 bulan:** Selama 6 bulan pertama sejak rilis, `0 KANS` yang bisa ditarik oleh tim (membuktikan komitmen jangka panjang).
  - **Linear Vesting 30 bulan berikutnya:** Setelah bulan ke-6, jatah tim baru terbuka sedikit demi sedikit setiap bulan secara otomatis sampai bulan ke-36.
- Karena kode pengunciannya bisa dilihat publik di blockchain, pemain & investor tahu proyek ini serius dan aman!

---

## 4. Jalur KANS Masuk ke Market Kripto (Masa Depan)

1. **Tahap 1 — Hardhat Lokal (Rp 0):**
   - KANS berjalan penuh di laptop untuk development & testing (lengkap dengan Faucet KANS uji coba).
2. **Tahap 2 — Testnet Publik, misal Base Sepolia / Polygon Amoy (Rp 0):**
   - KANS online di internet, bisa ditambah ke MetaMask pemain, dan dipakai transaksi nyata di Marketplace Testnet.
3. **Tahap 3 — Mainnet & Listing di DEX (Uniswap / Aerodrome / PancakeSwap):**
   - Tidak perlu izin bursa. Developer menyetor pasangan likuiditas (`KANS + USDC/ETH`) ke **Liquidity Pool**.
   - Sejak saat itu, `KANS` langsung punya harga pasar dunia sehingga pemain bisa membeli `KANS` pakai koin lain di DEX untuk belanja di game, atau mencairkan `KANS` hasil jual kartu/turnamen ke ETH/USDC/Rupiah.
4. **Tahap 4 — Listing di CEX (Indodax / Tokocrypto / Binance):**
   - Opsional di masa depan jika jumlah pemain, volume transaksi, legalitas, dan audit keamanan sudah memenuhi syarat bursa terpusat.
