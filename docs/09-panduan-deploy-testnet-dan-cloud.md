# 09 — Panduan Lengkap Deploy ke Testnet (Base Sepolia), Backend Cloud, dan Vercel

Dokumen ini adalah panduan langkah demi langkah dari awal (*from zero to production*) untuk mendeploy seluruh ekosistem **W3 Football KANS Manager**:
- **Smart Contracts:** Base Sepolia Testnet (Ethereum Layer-2)
- **Backend API:** Render.com atau Railway (Node.js/Express + Prisma)
- **Frontend App:** Vercel (Next.js 15)

---

## 1. Peta Arsitektur Deployment

```
[ Frontend (Vercel) ] 
       │
       ├── (HTTP / REST API) ───────> [ Backend API (Render / Railway) ]
       │                                            │
       │                                      (Prisma ORM)
       │                                            │
       ▼                                            ▼
[ MetaMask (User) ]                         [ Database Cloud ]
       │                               (Supabase / Neon / Railway Postgres)
       ▼
[ Smart Contracts (Base Sepolia - Chain ID 84532) ]
  ├── KansToken (ERC-20)
  ├── FootballCardNFT (ERC-721)
  ├── CardMarketplace (P2P + Dual Agreement)
  └── CardPackShop (50% KANS Burn)
```

---

## 2. Tahap 1: Mengambil Saldo Testnet ETH (Gas Fee)

Kedua dompet Anda:
1. **Dompet 1:** `0x0eE46b93baca82F1ec877BE9650759Ee0813F405` (Bisa dijadikan akun Deployer & Manager A)
2. **Dompet 2:** `0xE38fe7E71238cA4053DeD7E2747ff537B9142B8A` (Manager B)

Keduanya membutuhkan sedikit ETH di jaringan **Base Sepolia** untuk membayar gas fee transaksi blockchain.

### Cara Mendapatkan ETH Base Sepolia Gratis:
1. **Opsi 1 — Superchain Faucet (Paling Cepat):**
   - Buka: https://console.optimism.io/faucet
   - Hubungkan akun GitHub atau dompet Anda.
   - Pilih jaringan: **Base Sepolia**.
   - Masukkan alamat `0x0eE46b93baca82F1ec877BE9650759Ee0813F405` dan klik **Claim**.
   - Ulangi untuk alamat kedua `0xE38fe7E71238cA4053DeD7E2747ff537B9142B8A`.
2. **Opsi 2 — Coinbase Developer Platform Faucet:**
   - Buka: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
   - Masukkan alamat dompet -> Dapatkan hingga 0.1 ETH Base Sepolia.
3. **Opsi 3 — LearnWeb3 Faucet:**
   - Buka: https://learnweb3.io/faucets/base_sepolia/
   - Masukkan alamat dompet -> Klik claim.

*Catatan:* Dompet 1 (Deployer) membutuhkan minimal `0.02 ETH` untuk proses pasang kontrak. Dompet 2 cukup memiliki `0.005 ETH`.

---

## 3. Tahap 2: Deploy Smart Contracts ke Base Sepolia

Skrip `contracts/scripts/deploy.ts` telah dikonfigurasi untuk **otomatis mencetak 50.000 KANS** ke masing-masing dompet Anda (`0x0eE4...` dan `0xE38f...`) saat deploy selesai!

### Langkah Eksekusi:
1. Buka berkas `contracts/.env` di komputer Anda, isi:
   ```env
   DEPLOYER_PRIVATE_KEY="<PRIVATE_KEY_DARI_DOMPET_1>"
   BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
   INITIAL_HOLDER_1="0x0eE46b93baca82F1ec877BE9650759Ee0813F405"
   INITIAL_HOLDER_2="0xE38fe7E71238cA4053DeD7E2747ff537B9142B8A"
   ```
   *(Ambil Private Key dari MetaMask Dompet 1: Titik tiga -> Rincian Akun -> Tampilkan Kunci Pribadi).*

2. Jalankan perintah deploy dari terminal:
   ```bash
   cd contracts
   npx hardhat run scripts/deploy.ts --network baseSepolia
   ```

3. Terminal akan menampilkan output seperti ini:
   ```text
   ========================================
   Network  : baseSepolia
   Deployer : 0x0eE46b93baca82F1ec877BE9650759Ee0813F405
   ========================================
   KansToken deployed to      : 0x...
   FootballCardNFT deployed to: 0x...
   CardMarketplace deployed to: 0x...
   CardPackShop deployed to   : 0x...
   ----------------------------------------
   Minting initial KANS supply...
   Minted 100,000 KANS to Deployer
   Minted 50,000 KANS to Akun 1 (0x0eE46b93baca82F1ec877BE9650759Ee0813F405)
   Minted 50,000 KANS to Akun 2 (0xE38fe7E71238cA4053DeD7E2747ff537B9142B8A)
   ----------------------------------------
   Deployment info saved to   : deployments/baseSepolia.json
   ```

🎉 **Kedua akun Anda sekarang resmi memiliki masing-masing 50.000 KANS di Base Sepolia!**

---

## 4. Tahap 3: Deploy Backend API ke Cloud

Frontend di Vercel membutuhkan Backend API yang online di internet (berjalan dengan URL HTTPS, misal `https://api-w3football.onrender.com`).

### Rekomendasi Tempat Deploy Backend:
- **Render.com (Gratis & Sangat Mudah):** https://render.com
- **Railway.app (Cepat & Stabil):** https://railway.app

### Langkah Deploy di Render.com:
1. **Siapkan Database PostgreSQL Gratis:**
   - Buat akun gratis di **Supabase** (https://supabase.com) atau **Neon** (https://neon.tech).
   - Buat proyek baru dan salin URL koneksi basis data:
     `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require`
2. **Buat Web Service di Render.com:**
   - Hubungkan repositori GitHub Anda: `https://github.com/Laluarkan/Web3_Manager-`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     npm install && npx prisma db push && npm run build
     ```
   - **Start Command:**
     ```bash
     npm run start
     ```
3. **Isi Environment Variables di Render Dashboard:**
   ```env
   NODE_ENV=production
   PORT=10000
   DATABASE_URL="<URL_POSTGRES_DARI_SUPABASE_ATAU_NEON>"
   JWT_SECRET="ganti_dengan_rahasia_jwt_panjang_acak"
   RPC_URL="https://sepolia.base.org"
   VOUCHER_SIGNER_PRIVATE_KEY="<PRIVATE_KEY_DEPLOYER>"
   KANS_TOKEN_ADDRESS="<ALAMAT_KANS_DARI_TAHAP_2>"
   FOOTBALL_CARD_NFT_ADDRESS="<ALAMAT_NFT_DARI_TAHAP_2>"
   MARKETPLACE_ADDRESS="<ALAMAT_MARKET_DARI_TAHAP_2>"
   CARD_PACK_SHOP_ADDRESS="<ALAMAT_PACK_DARI_TAHAP_2>"
   CORS_ORIGIN="https://nama-aplikasi-anda.vercel.app"
   ```
4. Klik **Deploy**. Setelah selesai, Anda akan mendapatkan URL publik backend, misalnya: `https://w3manager-backend.onrender.com`.

---

## 5. Tahap 4: Konfigurasi Frontend di Vercel

Karena Frontend Anda sudah terdeploy di Vercel, Anda hanya perlu menyambungkan Environment Variables ke Backend dan Kontrak Base Sepolia:

1. Buka dashboard Vercel: https://vercel.com
2. Masuk ke proyek Next.js Anda -> Masuk ke tab **Settings** -> **Environment Variables**.
3. Tambahkan variabel-variabel berikut (pilih target: *Production*, *Preview*, *Development*):

| Nama Variabel | Nilai / Contoh |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://w3manager-backend.onrender.com/api` (URL Backend dari Tahap 3) |
| `NEXT_PUBLIC_CHAIN_ID` | `84532` |
| `NEXT_PUBLIC_RPC_URL` | `https://sepolia.base.org` |
| `NEXT_PUBLIC_KANS_TOKEN_ADDRESS` | `0x...` (Alamat KansToken dari Tahap 2) |
| `NEXT_PUBLIC_FOOTBALL_CARD_NFT_ADDRESS` | `0x...` (Alamat FootballCardNFT dari Tahap 2) |
| `NEXT_PUBLIC_MARKETPLACE_ADDRESS` | `0x...` (Alamat CardMarketplace dari Tahap 2) |
| `NEXT_PUBLIC_PACK_SHOP_ADDRESS` | `0x...` (Alamat CardPackShop dari Tahap 2) |

4. Buka tab **Deployments** di Vercel -> Klik titik tiga pada deployment terbaru -> Pilih **Redeploy** (agar Environment Variables baru aktif).

---

## 6. Tahap 5: Pengujian Dua Akun di Website Vercel

1. **Buka Website Anda di Vercel** di browser.
2. **Hubungkan MetaMask:**
   - Web otomatis meminta beralih ke jaringan **Base Sepolia (Chain ID 84532)**.
   - Klik **Setujui / Switch Network** di MetaMask.
3. **Uji Akun 1 (`0x0eE4...`):**
   - Saldo dompet langsung menunjukkan **50.000 KANS**.
   - Buka menu **Squad 4-3-3** -> Klaim Starter Pack (11 Kartu NFT dicetak di Base Sepolia).
   - Kunci beberapa pemain andalan dengan tombol 🔒.
   - Buka menu **Pack Shop** -> Buka Pack Mingguan / Iconic menggunakan KANS.
4. **Uji Akun 2 (`0xE38f...`):**
   - Ganti akun di MetaMask ke Akun 2.
   - Masuk ke menu **Komunitas & Nego (`/social`)** -> Cari nama manajer Akun 1.
   - Klik **Lihat Lineup 4-3-3** -> Inspeksi kartu Starting XI Akun 1.
   - Ajukan penawaran harga pada kartu yang tidak dikunci.
   - Ganti kembali ke Akun 1 untuk tawar-menawar atau menyetujui transaksi (tanda tangan gratis 0 gas fee).
   - Akun 2 menyelesaikan transaksi di Base Sepolia secara instan!
