# 07 — Roadmap Fitur Pengembangan Lanjutan (Pasca-MVP)

Dokumen ini menjadi peta jalan fitur-fitur **Pure Football Manager** yang dikembangkan setelah **Fondasi Inti** (Token `KANS`, NFT Kartu, Onboarding Email/Gmail + Link Wallet, Starter Pack 11 Kartu, Formasi 4-3-3, dan Marketplace `KANS`) berjalan mulus.

---

## 1. Dua Jalur Permainan: Mode Gratis vs Mode Web3 (Koin `KANS`)

Sesuai konsep agar pemain tanpa wallet tetap bisa menikmati game sekaligus memberi insentif kuat untuk masuk ke ekosistem Web3:

### A. Mode & Turnamen Gratis (*Free-to-Play*, Tanpa Wallet & Tanpa Koin)
Dapat dimainkan langsung oleh user yang login memakai **Email / Gmail** saja:
- **Quick Match (PvE vs AI):** Uji formasi 4-3-3 melawan tim AI berbagai tingkat kesulitan (*Amateur → World Class*).
- **Liga & Turnamen Gratis (Non-Koin):** Kompetisi antar manager melawan skuad pemain lain tanpa taruhan/hadiah koin kripto.
- **Hadiah Mode Gratis:** **EXP pemain**, trofi profil, poin peringkat musiman, dan tiket latihan gratis (untuk menaikkan skill tim sebelum terjun ke arena koin).

### B. Mode & Turnamen Koin `KANS` (*Competitive Web3*, Wajib Link Wallet)
Khusus pemain yang sudah menghubungkan **Wallet (MetaMask)** dan memakai kartu On-Chain:
- **Ranked League (`KANS` Rewards):** Klasemen liga mingguan berhadiah koin **`KANS`** bagi peringkat teratas dan promosi divisi.
- **Turnamen Koin `KANS` (Sistem Gugur / Cup):** Peserta mendaftar dengan biaya masuk kecil (misal `20 KANS`) → seluruh biaya masuk menjadi **Prize Pool** di Smart Contract yang otomatis dibagikan ke Juara 1, 2, dan 3!
- **Event Special Cup:** Turnamen musiman dengan hadiah **KANS + Kartu Event Langka (`EPIC` / `LEGENDARY` / `MYTHIC`)**.

---

## 2. Match Engine (Simulasi Pertandingan Manager)

Hasil pertandingan disimulasikan secara adil dan strategis (mirip *Top Eleven*):
- **Faktor Penentu Hasil:**
  1. **OVR & Atribut Spesifik Starting XI** (`Shooting` & `Pace` untuk peluang gol, `Passing` & `Dribbling` untuk penguasaan bola, `Defending` & `Physical` untuk pertahanan).
  2. **Kecocokan Posisi** (pemain di luar posisi aslinya mendapat penalti performa).
  3. **Live Form Mingguan (`A`–`E`)** dari statistik asli pemain di dunia nyata (lihat Dokumen `06`).
  4. **Pilihan Taktik Manager:** `Attacking` vs `Balanced` vs `Counter-Attack` vs `Defensive` + mentalitas pressing.
  5. **Stamina Pemain** (mendorong rotasi skuad menggunakan Bangku Cadangan).
- **Tampilan Match:** *Live Commentary* menit-per-menit, statistik pertandingan (possession, shots on target, pencetak gol), dan ke depannya bisa ditingkatkan ke **visual lapangan 2D (Canvas/PixiJS)**.

---

## 3. Pack / Gacha Shop On-Chain (Pakai `KANS`)

Pemain yang sudah menghubungkan wallet bisa membelanjakan `KANS` untuk membuka Pack yang langsung mencetak NFT ke dompet:

| Jenis Pack | Harga (Contoh) | Isi & Peluang Rarity |
| :--- | :---: | :--- |
| **Standard Pack** | `100 KANS` | 1 Kartu: 70% Common, 25% Rare, 4.5% Epic, 0.5% Legendary |
| **Pro Pack (3 Kartu)** | `450 KANS` | 3 Kartu: Minimal 1 Rare, peluang Epic & Legendary lebih tinggi |
| **Weekly `POTW` Pack** | `300 KANS` | 1 Kartu edisi terbatas **`POTW`** dunia minggu ini (tersedia 7 hari) |
| **Iconic / Legend Pack** | `1.000 KANS` | Peluang besar `EPIC` / `LEGENDARY` / `MYTHIC` edisi terbatas |

---

## 4. Training, Level Up & Card Fusion (*Progression*)

Mirip *eFootball* dan *Top Eleven*, pemain bisa melatih kartu favorit agar semakin kuat dan bernilai jual lebih tinggi:
- **Level Up Kartu (Level 1 → Level 10):** Menggunakan **EXP** (didapat dari Mode Gratis maupun Mode Koin) + sedikit `KANS` untuk menaikkan `level` kartu NFT on-chain → OVR meningkat.
- **Card Burning / Fusion:** Mengorbankan (burn) misalnya 5 kartu `COMMON` duplikat untuk ditukar menjadi 1 Pack dengan jaminan `RARE` ke atas — menjaga kelangkaan kartu di Marketplace.

---

## 5. Formasi Lanjutan & Team Chemistry

- **Formasi Tambahan:** Membuka formasi `4-4-2`, `4-2-3-1`, `3-5-2`, `5-3-2` selain default `4-3-3`.
- **Team Chemistry:** Bonus performa jika pemain yang berdekatan berasal dari **Klub**, **Liga**, atau **Negara** yang sama — membuat pasar jual-beli pemain tertentu di Marketplace semakin aktif!

---

## 6. Ekspansi ke Aplikasi Mobile (Android & iOS)

- Karena Backend API (Express) dan Smart Contract sudah terpisah (*Headless*), aplikasi Mobile dapat dibangun dengan **React Native (Expo)** atau **Flutter** tanpa menulis ulang logika server maupun blockchain.
- Login Email/Google langsung jalan mulus di HP, dan saat butuh fitur Web3 tinggal hubungkan ke **MetaMask Mobile / Trust Wallet** melalui **WalletConnect (Reown AppKit)**.
