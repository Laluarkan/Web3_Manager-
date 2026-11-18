# 04 — Fitur Onboarding (Email/Gmail + Link Wallet), Starter Pack 11 Kartu & Formasi 4-3-3

Dokumen ini menjelaskan alur lengkap pemain baru menggunakan model **Progressive Web3**: bisa langsung daftar & main gratis pakai **Email atau akun Gmail** tanpa harus punya wallet di awal, lalu menghubungkan **Wallet (MetaMask)** saat ingin mengakses fitur **On-Chain NFT, Marketplace, dan Turnamen Koin KANS**.

---

## 1. Alur Login & Hubungkan Wallet (2 Tahap Ramah Pemula)

### Tahap A — Masuk & Mulai Bermain (Tanpa Wallet)
Agar gamer biasa tidak langsung bingung disuruh install MetaMask di halaman pertama:
1. User bisa mendaftar menggunakan:
   - **Register Email & Password**, atau
   - **Login dengan Google (Gmail OAuth)** *(1 klik langsung masuk)*.
2. Backend membuat akun `User` dan memberikan **JWT Session**.
3. User langsung bisa klaim **Starter Pack 11 Kartu Gratis**, menyusun formasi **4-3-3**, dan bermain di **Mode & Turnamen Gratis (Tanpa Koin)**.

### Tahap B — Hubungkan Wallet (Wajib Untuk Fitur Web3 / Koin)
Ketika user ingin:
- **Jual-beli kartu di Marketplace**,
- **Mengikuti Match / Turnamen Berhadiah Koin `KANS`**, atau
- **Menarik / mengklaim kartu menjadi NFT di dompet pribadi**,

maka sistem meminta user klik **"Hubungkan Wallet (MetaMask)"**:
1. Frontend meminta `nonce` unik ke Backend (`GET /api/auth/wallet-nonce`).
2. MetaMask muncul untuk **Sign Message (SIWE — gratis, tanpa gas fee)** sebagai bukti sah bahwa wallet tersebut milik user.
3. Backend memverifikasi tanda tangan (`POST /api/auth/link-wallet`) dan menautkan `walletAddress` secara unik ke akun user (`1 akun = 1 wallet`).

---

## 2. Alur Klaim Starter Pack Gratis (11 Kartu — Formasi 4-3-3)

Setiap akun baru berhak mendapat **1x Starter Pack Gratis** agar langsung punya 1 tim lengkap.

### A. Komposisi Posisi (Wajib Mengisi Penuh Default 4-3-3)
Starter Pack selalu menghasilkan **11 kartu** yang langsung mengisi seluruh slot formasi **4-3-3**:
- **1 GK** (*Goalkeeper*)
- **4 DF** (*Defender*: `LB`, `LCB`, `RCB`, `RB`)
- **3 MF** (*Midfielder*: `LCM`, `CM`, `RCM`)
- **3 FW** (*Forward*: `LW`, `ST`, `RW`)

### B. Aturan Probabilitas Rarity Starter Pack
1. **9 slot dasar** → `COMMON` (Kartu Biasa / Standard).
2. **1 slot dijamin (100%)** → `RARE` *(1 level lebih tinggi dari Common)*.
3. **1 slot bonus (peluang kecil):**
   - **10% peluang** → `EPIC` *(2 level lebih tinggi dari Common)*.
   - **90% peluang** → `COMMON`.

*(Posisi mana yang mendapat Rare atau Epic dipilih acak secara adil di antara 11 slot).*

### C. Bagaimana Status On-Chain Kartu Starter Pack Saat User Belum Punya Wallet?
Karena user baru login pakai Email/Gmail (belum punya wallet MetaMask):
1. **Saat belum hubungkan wallet:** 11 kartu Starter Pack disimpan sebagai **kartu siap-klaim (*Unclaimed Starter Cards*)** di akun user sehingga bisa **langsung dipakai menyusun formasi 4-3-3 & main Mode Gratis** tanpa gas fee dan tanpa MetaMask.
2. **Setelah hubungkan wallet (MetaMask):**
   - User bisa klik **"Claim 11 Kartu ke Wallet (Mint On-Chain)"** → 1 transaksi *batch mint* (menggunakan Voucher EIP-712 dari backend) langsung mencetak **seluruh 11 kartu sekaligus menjadi NFT ERC-721** di dompet user!
   - Smart Contract mencatat `hasClaimedStarter[walletAddress] = true` sehingga 1 wallet tidak bisa klaim ulang.
   - **Semua kartu baru dari Marketplace, Pack KANS, dan Hadiah Turnamen Koin** otomatis **100% langsung On-Chain di wallet** sejak detik pertama!

---

## 3. Pembagian Akses: Mode Gratis vs Mode Web3 (Koin)

| Fitur / Mode Permainan | Login Email / Gmail Saja | Sudah Hubungkan Wallet (MetaMask) |
| :--- | :---: | :---: |
| Klaim 11 Kartu Starter Pack (4-3-3) | ✅ Bisa langsung main | ✅ Bisa Claim/Mint jadi NFT di Dompet |
| Atur Formasi 4-3-3 & Manajemen Skuad | ✅ Bisa | ✅ Bisa |
| **Quick Match / Liga Gratis (Tanpa Koin)** | ✅ Bisa (hadiah EXP & poin) | ✅ Bisa |
| **Turnamen Free-to-Play (Tanpa Koin)** | ✅ Bisa (hadiah trofi/rank/EXP) | ✅ Bisa |
| **Turnamen & Match Koin `KANS`** | 🔒 Harus hubungkan Wallet | ✅ Bisa ikut & terima hadiah `KANS` |
| **Jual-Beli Kartu di Marketplace P2P** | 🔒 Harus hubungkan Wallet | ✅ Bisa jual/beli pakai `KANS` |
| **Buka Pack NFT pakai `KANS`** | 🔒 Harus hubungkan Wallet | ✅ Langsung mint NFT ke Wallet |

---

## 4. Fitur Manajemen Skuad & Lapangan 4-3-3

1. **Auto-Fill Default 4-3-3:** Begitu Starter Pack diklaim, ke-11 kartu langsung terpasang otomatis di slot posisinya:
   - Depan: `LW` — `ST` — `RW`
   - Tengah: `LCM` — `CM` — `RCM`
   - Belakang: `LB` — `LCB` — `RCB` — `RB`
   - Kiper: `GK`
2. **Tukar Pemain (*Swap*):** Klik pemain di lapangan ↔ pemain di Bangku Cadangan (*Bench*), atau tukar posisi antar slot.
3. **Validasi Posisi & Status NFT:**
   - Kartu yang sedang dijual (*listed*) di Marketplace tidak bisa dipasang di Starting XI.
   - Untuk kartu yang sudah On-Chain, Backend selalu memverifikasi kepemilikan di blockchain (`ownerOf(tokenId)`) agar kartu yang sudah terjual otomatis hilang dari skuad penjual.
4. **Team Rating (OVR Skuad):** Rata-rata OVR dari 11 pemain yang sedang dipasang.
5. **Inspect Detail Kartu:** Melihat OVR, posisi, Rarity, Edition, status (*Starter / On-Chain NFT*), Token ID, dan tombol **"Claim ke Wallet"** atau **"Jual di Marketplace"**.

---

## 5. Model Data Database (Prisma)

- **`User`:** `id`, `email` (unique), `passwordHash` (nullable jika login Google), `googleId` (nullable, unique), `username`, `walletAddress` (nullable, unique), `walletNonce`, `hasClaimedStarter`, `createdAt`
- **`UserCard`:** `id`, `userId`, `playerId`, `position`, `baseOverall`, `level`, `rarity`, `edition`, `season`, `isOnChain` (Boolean), `tokenId` (nullable, unique jika sudah mint), `isListed`
- **`Lineup`:** `id`, `userId`, `formation` (default `"4-3-3"`), `updatedAt`
- **`LineupSlot`:** `id`, `lineupId`, `slotCode` (`GK`, `LB`, `LCB`, `RCB`, `RB`, `LCM`, `CM`, `RCM`, `LW`, `ST`, `RW`), `userCardId`
