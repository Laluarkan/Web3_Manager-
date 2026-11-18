# 01 — Arsitektur Sistem & Tech Stack (Opsi 1)

Dokumen ini menjelaskan arsitektur proyek (**Progressive Web3**), alasan pemilihan teknologi, cara kerja **SQLite → Neon PostgreSQL**, kesiapan aplikasi **Mobile**, serta panduan lengkap setiap folder dan file starter bagi pemula **Node.js/Express** dan **Prisma**.

---

## 1. Gambaran Besar Arsitektur (*Headless Progressive Web3*)

Sistem dibagi menjadi **3 proyek independen dalam 1 repositori** agar rapi, mendukung login biasa (Email/Gmail) untuk pemain baru, sekaligus siap dikembangkan ke aplikasi Mobile (React Native / Flutter) di masa depan:

```text
[ Web (Next.js) ]   [ Mobile App (Masa Depan: React Native / Flutter) ]
        \                             /
         \                           /
          +---> [ Backend API (Node.js + Express) ]
          |         - Login Email / Password & Google (Gmail)
          |         - Link Wallet (MetaMask / SIWE) saat butuh fitur Web3
          |         - Formasi 4-3-3, Mode & Turnamen Gratis, Data Pemain Global
          |                     |
          |               [ Prisma ORM ]
          |                     |
          |       Local: SQLite | Staging: PostgreSQL (Neon)
          |
          +---> [ Blockchain (Hardhat / Testnet) ]
                    - Koin KANS (ERC-20)
                    - Kartu Pemain NFT (ERC-721)
                    - Marketplace P2P (pakai KANS) & Turnamen Koin KANS
```

### Mengapa Menggunakan Pendekatan *Progressive Web3*?
- **Ramah Pemain Baru (Zero Barrier):** Pemain yang belum punya MetaMask tetap bisa daftar pakai **Email atau akun Gmail**, langsung dapat Starter Pack 11 kartu, menyusun formasi 4-3-3, dan ikut **Match / Turnamen Gratis (Tanpa Koin)**.
- **Transisi Mulus ke Web3:** Saat pemain ingin **menjual/membeli kartu**, **mengklaim kartu jadi NFT di dompet pribadi**, atau **ikut Turnamen Koin KANS**, barulah pemain menghubungkan wallet (MetaMask).
- **100% Gratis untuk Developer:** Developer tidak perlu menanggung biaya gas fee pembuatan akun untuk ribuan user baru yang hanya coba-coba pakai Gmail.

---

## 2. Daftar Tech Stack

| Layer | Teknologi | Fungsi Utama |
| :--- | :--- | :--- |
| **Blockchain** | Hardhat, Solidity `^0.8.24`, OpenZeppelin | Membuat, menguji, dan men-deploy Smart Contract (`KANS`, `NFT`, `Marketplace`). |
| **Backend API** | Node.js, Express.js, TypeScript, Ethers.js v6, JWT, Google OAuth | Menyediakan REST API, autentikasi Email/Gmail + Link Wallet (SIWE), logika game manager, dan baca/verifikasi blockchain. |
| **Database & ORM** | Prisma ORM (`SQLite` lokal → `PostgreSQL Neon` staging) | Mengelola tabel database secara aman dengan TypeScript tanpa menulis SQL mentah. |
| **Frontend Web** | Next.js (App Router), TypeScript, Tailwind CSS, Wagmi + Viem | Antarmuka website game, login akun biasa/Gmail, manajemen skuad 4-3-3, serta konektor wallet untuk fitur Web3. |

---

## 3. Penjelasan Struktur Folder & File Starter (Untuk Pemula)

Susunan folder yang akan kita bangun saat mulai ulang:

```text
web3-football-manager/
├── docs/                           # Dokumentasi per fitur (folder ini)
├── contracts/                      # [1] PROYEK BLOCKCHAIN (Hardhat)
│   ├── contracts/                  # Kode Smart Contract (.sol)
│   │   ├── KansToken.sol           # Koin KANS (ERC-20) + Vesting support
│   │   ├── FootballCardNFT.sol     # Kartu Pemain NFT (ERC-721)
│   │   └── CardMarketplace.sol     # Pasar jual-beli NFT pakai KANS
│   ├── scripts/
│   │   └── deploy.ts               # Script deploy kontrak ke Hardhat lokal / Testnet
│   ├── test/                       # Pengujian otomatis Smart Contract sebelum dipakai
│   │   └── GameContracts.test.ts
│   ├── hardhat.config.ts           # Pengaturan Solidity & jaringan (local/testnet)
│   └── package.json
│
├── backend/                        # [2] PROYEK BACKEND API (Node.js + Express + Prisma)
│   ├── prisma/
│   │   ├── schema.prisma           # Definisi semua tabel database (User, Player, Card, Lineup)
│   │   ├── seed.ts                 # Script isi data awal pemain bola ke database
│   │   └── dev.db                  # File database SQLite lokal (dibuat otomatis)
│   ├── src/
│   │   ├── index.ts                # Titik masuk utama: menyalakan server Express (port 4000)
│   │   ├── config/
│   │   │   ├── env.ts              # Membaca konfigurasi dari .env secara aman
│   │   │   └── prisma.ts           # Koneksi tunggal ke database via PrismaClient
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts  # Cek login JWT (akun Email/Gmail)
│   │   │   └── wallet.middleware.ts# Cek apakah akun sudah menghubungkan Wallet (khusus fitur Web3)
│   │   ├── routes/                 # Daftar alamat URL API (mirip urls.py di Django)
│   │   │   ├── auth.routes.ts      # /api/auth/* (register, login, google, link-wallet)
│   │   │   ├── squad.routes.ts     # /api/squad/* (starter pack, koleksi kartu, lineup 4-3-3)
│   │   │   └── market.routes.ts    # /api/market/* (listing marketplace & sinkronisasi on-chain)
│   │   ├── controllers/            # Penerima request & pengirim response (mirip views.py)
│   │   │   ├── auth.controller.ts
│   │   │   ├── squad.controller.ts
│   │   │   └── market.controller.ts
│   │   ├── services/               # Logika bisnis utama & komunikasi ke Blockchain
│   │   │   ├── auth.service.ts     # Hash password, verifikasi Google OAuth, verifikasi SIWE
│   │   │   ├── blockchain.service.ts # Baca kepemilikan NFT & saldo KANS dari blockchain
│   │   │   └── starter.service.ts  # Pilih 11 pemain 4-3-3 (Common/Rare/Epic) & voucher mint
│   │   └── utils/                  # Helper umum & error handler
│   ├── .env.example                # Template variabel environment (tanpa rahasia asli)
│   ├── tsconfig.json               # Pengaturan compiler TypeScript
│   └── package.json
│
└── frontend/                       # [3] PROYEK WEB FRONTEND (Next.js)
    ├── src/
    │   ├── app/                    # Halaman-halaman website (App Router Next.js)
    │   │   ├── layout.tsx          # Kerangka utama (Navbar, Auth & Wallet Provider)
    │   │   ├── page.tsx            # Landing / Dashboard utama
    │   │   ├── login/page.tsx      # Login & Register (Email/Password + Tombol Google)
    │   │   ├── squad/page.tsx      # Formasi 4-3-3, Koleksi Kartu, & Claim to Wallet
    │   │   └── market/page.tsx     # Marketplace Jual-Beli Kartu (wajib Link Wallet)
    │   ├── components/             # Komponen UI yang dipakai ulang
    │   │   ├── Navbar.tsx          # Header: info akun, status wallet, saldo KANS
    │   │   ├── PlayerCard.tsx      # Tampilan kartu pemain (warna sesuai Rarity & Event)
    │   │   └── Pitch433.tsx        # Lapangan hijau interaktif formasi 4-3-3
    │   ├── lib/
    │   │   ├── wagmi.ts            # Pengaturan jaringan Web3 (Hardhat Local / Testnet)
    │   │   ├── contracts.ts        # Alamat kontrak & ABI Smart Contract
    │   │   └── api.ts              # Konfigurasi HTTP client ke Backend Express
    │   └── hooks/                  # Custom React hooks (useAuth, useMyCards, useKansBalance)
    └── package.json
```

### Analogi Cepat dari Django ke Express + Prisma
| Konsep di Django | Padanan di Express + Prisma |
| :--- | :--- |
| `models.py` | `backend/prisma/schema.prisma` |
| `python manage.py makemigrations && migrate` | `npx prisma migrate dev` |
| `urls.py` | `backend/src/routes/*.routes.ts` |
| `views.py` | `backend/src/controllers/*.controller.ts` |
| `User.objects.filter(...)` | `prisma.user.findMany(...)` |
| `venv` + `requirements.txt` | `node_modules` + `package.json` |

---

## 4. Strategi Database: SQLite Lokal → PostgreSQL Neon (Staging)

### Tahap Lokal (Development)
- Menggunakan **SQLite** (`file:./dev.db`). Tidak perlu install server database, cukup 1 file lokal, cepat untuk coding & testing.

### Tahap Staging / Online (Gratis)
- Menggunakan **Neon** (`neon.tech` — PostgreSQL serverless gratis).
- **Aturan di `schema.prisma` agar migrasi mulus tanpa ubah kode:**
  1. Gunakan tipe `String` untuk field berkode seperti `rarity`, `position`, `edition` (validasi dilakukan di TypeScript/Zod agar kompatibel di SQLite maupun PostgreSQL).
  2. Saat pindah ke Neon, cukup ubah `provider = "postgresql"` di `schema.prisma`, masukkan `DATABASE_URL` dari Neon, lalu jalankan migrasi. Seluruh kode Express & query Prisma tetap sama 100%.
