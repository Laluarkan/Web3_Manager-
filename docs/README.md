# Dokumentasi Proyek — W3 Football Manager (KANS Edition)

Selamat datang di dokumentasi desain dan arsitektur versi baru **W3 Football Manager** — game **Pure Football Manager** dengan pendekatan **Progressive Web3** (bisa langsung main gratis pakai akun Email/Gmail, lalu hubungkan Wallet untuk kepemilikan NFT penuh, Marketplace, dan Turnamen Koin `KANS`).

Setiap fitur dipisahkan ke dalam 1 file Markdown tersendiri agar mudah dibaca, direvisi, dan dijadikan acuan saat coding maupun pengembangan lanjutan.

## Daftar Dokumen Per Fitur

| No | File | Fokus Pembahasan |
| :---: | :--- | :--- |
| 01 | [01-arsitektur-dan-tech-stack.md](./01-arsitektur-dan-tech-stack.md) | Tech stack (Hardhat + Express + Prisma + Next.js), penjelasan folder & file starter, auth hybrid (Email/Gmail + Link Wallet), SQLite lokal → Neon PostgreSQL, dan kesiapan Mobile. |
| 02 | [02-fitur-token-kans.md](./02-fitur-token-kans.md) | Mata uang kripto **KANS (ERC-20)**, penjelasan **Liquidity Pool (DEX)** & **Vesting Tim**, serta jalur listing ke market kripto. |
| 03 | [03-fitur-nft-kartu-pemain.md](./03-fitur-nft-kartu-pemain.md) | Smart Contract **FootballCardNFT (ERC-721)**, struct data on-chain, 5 level rarity, dan jenis kartu event (ala eFootball). |
| 04 | [04-fitur-starter-pack-dan-lineup-433.md](./04-fitur-starter-pack-dan-lineup-433.md) | Alur pemain baru: Login Email/Gmail tanpa wallet dulu → 11 Kartu Starter Pack (formasi default **4-3-3**) → Main Mode Gratis → Hubungkan Wallet untuk klaim On-Chain NFT & fitur Koin. |
| 05 | [05-fitur-marketplace-p2p.md](./05-fitur-marketplace-p2p.md) | **Marketplace On-Chain** jual-beli kartu NFT antar pemain 100% menggunakan **`KANS`** secara *trustless*. |
| 06 | [06-fitur-sumber-data-pemain-dan-scraping.md](./06-fitur-sumber-data-pemain-dan-scraping.md) | Sumber data **statistik pemain seluruh dunia** (bukan hanya EPL, tanpa fitur jadwal match asli) yang **GRATIS** & update mingguan untuk Live Form dan POTW. |
| 07 | [07-fitur-pengembangan-lanjutan.md](./07-fitur-pengembangan-lanjutan.md) | Roadmap fitur pasca-MVP: Mode Gratis vs Mode Turnamen Koin KANS, Match Engine, Pack/Gacha KANS, Upgrade Kartu, Taktik, dan Mobile App. |

## Urutan Eksekusi Pembangunan (MVP → Scaling)

1. **Fase 1 — Smart Contract Inti:** `KansToken.sol`, `FootballCardNFT.sol`, `CardMarketplace.sol` (pembayaran langsung pakai `KANS`) + unit test di Hardhat lokal.
2. **Fase 2 — Backend API & Database (SQLite):** Express + Prisma + Login Email/Gmail & Link Wallet (SIWE) + Starter Pack 11 kartu + Lineup 4-3-3.
3. **Fase 3 — Frontend Web (Next.js):** Register/Login Google, Squad Pitch 4-3-3, Mode Match Gratis (tanpa wallet), Hubungkan Wallet untuk Claim On-Chain & Marketplace P2P.
4. **Fase 4 — Data Pemain Global & Gameplay Lanjutan:** Sinkronisasi statistik pemain dunia mingguan, Match Engine & Turnamen (Gratis & Koin KANS), Pack Shop, Upgrade Kartu.
5. **Fase 5 — Staging Online (Gratis):** Deploy Smart Contract ke Testnet (Base Sepolia / Polygon Amoy), Database ke Neon PostgreSQL, Web ke Vercel.
