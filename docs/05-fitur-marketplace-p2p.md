# 05 — Fitur Marketplace P2P On-Chain (`CardMarketplace.sol`)

Dokumen ini menjelaskan mekanisme jual-beli kartu NFT antar pemain secara **100% On-Chain** menggunakan koin **`KANS`** secara langsung tanpa perantara manusia (*trustless*).

---

## 1. Syarat Mengakses Marketplace

- Semua user (termasuk yang login pakai Email/Gmail) boleh **melihat-lihat** daftar kartu di halaman Marketplace.
- Untuk melakukan **Jual Kartu** atau **Beli Kartu**, user **wajib menghubungkan Wallet (MetaMask)** ke akunnya terlebih dahulu.
- Hanya kartu yang sudah **On-Chain (NFT di dompet)** yang dapat dijual di Marketplace (jika kartu Starter Pack masih belum di-mint, user cukup klik "Claim ke Wallet" dulu).
- **Pembayaran 100% menggunakan `KANS`:** Jika pembeli hanya memiliki koin lain (misalnya ETH/USDC), pembeli menukar koinnya terlebih dahulu menjadi **`KANS`** di DEX/wallet sebelum membeli kartu di Marketplace. *(Lebih aman, hemat gas fee, dan mendorong permintaan langsung terhadap koin `KANS`).*

---

## 2. Alur Jual-Beli Kartu (Smart Contract)

Kita menggunakan kontrak `CardMarketplace.sol` yang sederhana, aman, dan dilindungi OpenZeppelin `ReentrancyGuard`.

### A. Menjual Kartu (*List Card*)
1. Penjual memilih kartu NFT dari Bench (kartu di Starting XI harus dicadangkan dulu).
2. Penjual menentukan **harga dalam `KANS`** (contoh: `250 KANS`).
3. **Transaksi 1 (1x seumur hidup per wallet):** `FootballCardNFT.setApprovalForAll(marketplaceAddress, true)` — memberi izin Smart Contract Marketplace memindahkan NFT saat nanti ada pembeli.
4. **Transaksi 2:** `CardMarketplace.listCard(tokenId, priceInKans)`.
   - Smart Contract mengecek `ownerOf(tokenId) == msg.sender` serta `price > 0`, lalu memancarkan event `CardListed`.

### B. Membeli Kartu (*Buy Card*)
1. Pembeli melihat kartu yang diinginkan di Marketplace lalu klik **Beli (250 KANS)**.
2. **Transaksi 1:** `KansToken.approve(marketplaceAddress, priceInKans)` — memberi izin Marketplace menarik `250 KANS` dari dompet pembeli.
3. **Transaksi 2:** `CardMarketplace.buyCard(listingId)`.
   - Smart Contract mengecek:
     - Listing masih aktif (`active == true`).
     - Pembeli bukan penjual itu sendiri.
     - Penjual masih benar-benar pemilik NFT tersebut (`ownerOf(tokenId) == seller`).
   - **Eksekusi Atomic (Dalam 1 Blok — Semua Sukses atau Semua Batal):**
     - Hitung **Marketplace Fee** (`2.5%` = `6.25 KANS`) → dikirim ke alamat **Treasury / Burn**.
     - Kirim sisa **`97.5%`** (`243.75 KANS`) langsung dari dompet Pembeli ke dompet Penjual.
     - Pindahkan NFT (`safeTransferFrom`) langsung dari dompet Penjual ke dompet Pembeli.
     - Tandai listing selesai (`active = false`) & pancarkan event `CardSold(listingId, seller, buyer, tokenId, price, fee)`.

### C. Membatalkan Penjualan (*Cancel Listing*)
- Sebelum terjual, penjual bisa memanggil `cancelListing(listingId)` kapan saja.
- Listing berubah menjadi `active = false` dan memancarkan event `ListingCanceled`.

---

## 3. Sinkronisasi Otomatis ke Backend & Squad

- Backend mendengarkan / memverifikasi event `CardListed`, `CardSold`, `ListingCanceled`, dan `Transfer`.
- Saat kartu terjual:
  - Tabel cache `MarketListing` langsung diperbarui (`SOLD`).
  - Pemilik `UserCard` otomatis berpindah ke akun Pembeli (jika wallet pembeli terdaftar di sistem) dan **dihapus dari Lineup penjual** sehingga tidak ada kartu ganda.

---

## 4. Fitur UI Halaman Marketplace

1. **Filter & Sorting:** Cari nama pemain, filter Posisi (`GK/DF/MF/FW`), Rarity (`COMMON`–`MYTHIC`), Edisi (`BASE/POTW/ICONIC`), urutkan harga/OVR.
2. **Info Saldo `KANS`:** Menampilkan saldo `KANS` user secara real-time + tombol bantuan cara mendapatkan `KANS` (tombol *Faucet Test KANS* di lokal/testnet, atau link swap DEX saat sudah Mainnet).
3. **Tab "Penjualan Saya":** Pantau listing aktif & tombol batalkan penjualan.
