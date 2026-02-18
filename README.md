# W3 Football Manager (Web3 Lazy Minting)

> **STATUS PROYEK: DALAM MASA PENGEMBANGAN (UNDER DEVELOPMENT)**
>
> Proyek ini adalah purwarupa (*prototype*) game manajer sepak bola berbasis **Hybrid Blockchain**. Sistem, kontrak pintar (*smart contract*), dan logika ekonomi masih dalam tahap penyempurnaan dan **belum siap** untuk digunakan di jaringan utama (Mainnet) atau produksi massal.

## Ringkasan Proyek

**W3 Football Manager** menggabungkan kecepatan database tradisional (Web2) dengan kepemilikan aset digital (Web3). Game ini menggunakan arsitektur **Lazy Minting** untuk memberikan pengalaman pengguna yang mulus tanpa biaya gas di awal.

Pemain dapat melakukan Gacha, menyusun strategi, dan bermain secara instan. Aset pemain disimpan di Database lokal hingga pengguna memutuskan untuk melakukan "Minting" menjadi NFT di Blockchain Ethereum.

## Fitur Unggulan

### 1. Lazy Minting System (Hybrid)
* **Off-Chain First:** Pemain baru (hasil Gacha/Starter Pack) disimpan di Database. Tidak ada gas fee, proses instan.
* **On-Chain Opt-in:** User dapat mengubah kartu favorit mereka menjadi NFT sesungguhnya dengan membayar gas fee.

### 2. Disaster Recovery (Fitur Sync NFT)
* Jika database game terhapus atau *crash*, aset yang sudah menjadi NFT **tidak akan hilang**.
* Fitur **"SYNC NFT"** akan memindai Blockchain, memverifikasi kepemilikan dompet, dan mengembalikan kartu tersebut ke dalam Squad di game secara otomatis.

### 3. Manajemen Skuad
* Sistem formasi 1-4-4-2 (GK, DF, MF, FW).
* Visualisasi lapangan sepak bola interaktif.
* Perhitungan *Team Rating* berdasarkan statistik pemain.

### 4. Proteksi Marketplace
* Mencegah penjualan aset yang sudah di-mint (NFT) melalui pasar internal database untuk menghindari duplikasi/desync aset.

## Tech Stack

| Komponen | Teknologi |
| :--- | :--- |
| **Blockchain** | Hardhat (Localhost), Solidity, Ethers.js v6 |
| **Backend** | Python Django, Django REST Framework, SQLite |
| **Frontend** | React.js (Vite), Tailwind CSS, Axios |
| **Wallet** | MetaMask |

---

## Panduan Instalasi & Menjalankan (Local)

Ikuti langkah-langkah ini secara berurutan di terminal yang berbeda.

### Langkah 1: Menyalakan Blockchain (Terminal 1)
Menjalankan node lokal Ethereum.

cd blockchain
npm install
npx hardhat node

### Langkah 2: Deploy Smart Contract (Terminal 2)
Mengunggah kontrak ke blockchain lokal.

cd blockchain
npx hardhat run scripts/deploy.js --network localhost

### Langkah 3: Menyiapkan Backend (Terminal 3)
Pastikan Python dan Virtual Environment aktif.

cd backend
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

### Langkah 4: Menyiapkan Frontend (Terminal 4)
cd frontend
npm install
npm run dev

## Setup Data Awal (Seeding Pemain)
jalankan:
    python import_players_2025.py 
untuk import pemain ke database

jalankan:
    python manage.py import_fixtures fixtures.csv
untuk mendapatkan jadwal pertandingan