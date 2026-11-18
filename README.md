# W3 Football Manager (KANS Edition)

Game **Pure Football Manager** berbasis **Progressive Web3** — mulai bermain gratis menggunakan akun Email/Gmail (formasi default **4-3-3**), lalu hubungkan **Wallet (MetaMask)** untuk kepemilikan kartu **NFT ERC-721** penuh, jual-beli antar pemain menggunakan koin **`KANS` (ERC-20)**, dan turnamen berhadiah koin.

## Dokumentasi Per Fitur
Seluruh desain arsitektur dan spesifikasi fitur terdokumentasi terpisah di folder [docs/](./docs/README.md):
1. [Arsitektur & Tech Stack](./docs/01-arsitektur-dan-tech-stack.md)
2. [Mata Uang Game: Token KANS (ERC-20)](./docs/02-fitur-token-kans.md)
3. [NFT Kartu Pemain (ERC-721)](./docs/03-fitur-nft-kartu-pemain.md)
4. [Onboarding, Starter Pack 11 Kartu & Lineup 4-3-3](./docs/04-fitur-starter-pack-dan-lineup-433.md)
5. [Marketplace P2P On-Chain (KANS)](./docs/05-fitur-marketplace-p2p.md)
6. [Sumber Data Statistik Pemain Global (Gratis)](./docs/06-fitur-sumber-data-pemain-dan-scraping.md)
7. [Roadmap Pengembangan Lanjutan](./docs/07-fitur-pengembangan-lanjutan.md)

## Struktur Proyek
- `contracts/` — Smart Contract Solidity + Hardhat (`KansToken`, `FootballCardNFT`, `CardMarketplace`).
- `backend/` — Backend REST API (Node.js + Express + TypeScript + Prisma SQLite → PostgreSQL Neon).
- `frontend/` — Web App (Next.js App Router + Tailwind CSS + Wagmi/Viem).

## Cara Menjalankan di Lokal (4 Terminal)

### 1. Blockchain Lokal (Terminal 1)
```bash
cd contracts
npm install
npx hardhat node
```

### 2. Deploy Smart Contract (Terminal 2)
```bash
cd contracts
npm run deploy:local
```

### 3. Backend API + Database SQLite (Terminal 3)
```bash
cd backend
npm install
# (Opsional) salin .env.example menjadi .env
npx prisma db push
npm run prisma:seed
npm run dev
```
Backend berjalan di `http://localhost:4000`.

### 4. Frontend Web Next.js (Terminal 4)
```bash
cd frontend
npm install
npm run dev
```
Website berjalan di `http://localhost:3000`.
