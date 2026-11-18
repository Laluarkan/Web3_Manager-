# 03 — Fitur NFT Kartu Pemain (`FootballCardNFT.sol`)

Dokumen ini menjelaskan struktur kartu pemain sebagai aset **100% On-Chain NFT (ERC-721)**, sistem tier rarity, jenis kartu berdasarkan event (seperti *eFootball*), serta standar metadata agar kartu tampil di dompet Web3.

---

## 1. Konsep Kepemilikan Penuh (On-Chain NFT)

Di versi baru ini, **setiap aset kartu Web3 adalah NFT ERC-721 yang benar-benar dimiliki di dompet pemain** (`ownerOf(tokenId) == playerWallet`):
- **Kartu Starter Pack (User Email/Gmail tanpa wallet):** Dapat langsung dipakai untuk menyusun formasi 4-3-3 & main Mode Gratis dulu; begitu user menghubungkan MetaMask (*Link Wallet*), ke-11 kartu Starter Pack dapat langsung di-**Claim / Batch Mint On-Chain** dalam 1 transaksi ke dompetnya.
- **Semua Kartu Ekonomi Koin (Marketplace, Pack `KANS`, Hadiah Turnamen Koin):** 100% langsung dicetak / berpindah secara On-Chain di dompet pemain sejak detik pertama.
- Kartu yang sudah On-Chain dapat dilihat di MetaMask, ditransfer ke teman, dan diperjualbelikan bebas di Marketplace game maupun marketplace eksternal (seperti OpenSea).

---

## 2. Data Kartu yang Disimpan Langsung di Blockchain

Di dalam `FootballCardNFT.sol`, setiap `tokenId` memiliki struct data permanen:

```solidity
enum Rarity {
    COMMON,     // 0 — Kartu Biasa / Standard
    RARE,       // 1 — 1 level lebih tinggi
    EPIC,       // 2 — 2 level lebih tinggi
    LEGENDARY,  // 3 — Kelas dunia / Legenda
    MYTHIC      // 4 — Super langka / Limited Edition
}

enum CardEdition {
    BASE,           // 0 — Kartu musim reguler
    POTW,           // 1 — Player of The Week (Event Mingguan)
    HIGHLIGHT,      // 2 — Show Time / Highlight pemain aktif
    CLUB_SELECTION, // 3 — Event klub / derby / turnamen
    ICONIC          // 4 — Momen bersejarah / Legenda
}

struct CardMetadata {
    uint32 playerId;      // ID pemain yang terhubung ke master data pemain
    uint8 position;       // 0=GK, 1=DF, 2=MF, 3=FW
    uint8 baseOverall;    // Rating dasar kartu saat dicetak (misal 65–99)
    uint8 level;          // Level latihan kartu (mulai dari 1, bisa di-upgrade nanti)
    Rarity rarity;        // Tier rarity kartu
    CardEdition edition;  // Jenis/edisi event kartu
    uint16 season;        // Contoh: 2026 (musim 2025/2026)
    uint64 mintedAt;      // Timestamp waktu kartu dicetak
}
```

### Mengapa Hanya Data Inti yang Masuk Struct Solidity?
- Menyimpan string panjang/gambar di blockchain mahal gas fee-nya.
- Dengan menyimpan **ID pemain + atribut angka (`uint8`/`uint32`/`enum`)**, ukuran data sangat kecil (hemat gas hingga 80% karena *struct packing* di Solidity), tetapi **nilai & kelangkaan kartu 100% dijamin dan diverifikasi oleh blockchain**!

---

## 3. Sistem 5 Level Kartu (*Rarity Tiers*)

| Level | Nama Rarity | Warna Visual Kartu | Kisaran OVR | Sumber Utama |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **Common** *(Standard)* | Abu-abu / Perunggu | 60 – 74 | Starter Pack (mayoritas), Standard Pack |
| **2** | **Rare** | Biru Metalik | 75 – 81 | Starter Pack (jaminan 1), Standard/Premium Pack |
| **3** | **Epic** | Ungu Neon | 82 – 87 | Starter Pack (peluang kecil), Premium/Event Pack |
| **4** | **Legendary** | Emas | 88 – 93 | Premium Pack, Event Khusus, Hadiah Turnamen |
| **5** | **Mythic** *(Limited)* | Hitam-Emas / Hologram | 94 – 99 | Cetak terbatas (misal max 10 kartu/musim), Juara Musim |

---

## 4. Jenis Kartu Berdasarkan Event (*Card Editions*)

Mengadaptasi sistem populer dari *eFootball* dan *EA FC* agar pasar jual-beli antar pemain selalu dinamis:

1. **`BASE` (Standard Card):** Kartu reguler awal musim untuk semua pemain liga.
2. **`POTW` (Player of The Week):** Dirilis tiap minggu berdasarkan pemain yang tampil terbaik di pertandingan nyata akhir pekan (stat boost + desain kartu spesial). **Hanya tersedia selama 7 hari**, setelah itu tidak bisa dicetak lagi sehingga bernilai koleksi di Marketplace.
3. **`HIGHLIGHT` / `SHOWTIME`:** Kartu pemain aktif pilihan dengan atribut unggulan tertentu (misal *Finishing* tinggi atau *Playmaker*).
4. **`CLUB_SELECTION` / `TOURNAMENT`:** Edisi spesial bertema klub besar, Derby, Liga Champions, atau Piala Dunia.
5. **`ICONIC` / `LEGEND`:** Kartu pemain legendaris atau momen bersejarah tertentu dengan *capped supply* (batas cetak ketat di smart contract).

---

## 5. Keamanan Minting (Anti-Cheat)

Pada project lama, fungsi `mintCard` terbuka untuk publik sehingga siapa saja bisa mencetak kartu Legend gratis.  
Di versi baru ini, **minting diamankan menggunakan salah satu dari dua mekanisme**:
- **EIP-712 Signed Voucher (Rekomendasi):** Backend memilih pemain/rarity secara acak (sesuai aturan Starter Pack / Pack), lalu menandatangani izin (*voucher*) secara kriptografis. User mengirim voucher itu ke Smart Contract saat klik MetaMask. Smart Contract memverifikasi bahwa tanda tangan benar-benar berasal dari server game dan **nonce voucher belum pernah dipakai** sebelum mencetak NFT.
- **Anti-Duplicate Starter Pack:** Smart Contract mencatat `mapping(address => bool) public hasClaimedStarter;` sehingga 1 wallet hanya bisa klaim Starter Pack **tepat 1 kali** secara permanen di blockchain.

---

## 6. Metadata Standar ERC-721 (`tokenURI`)

Agar NFT bisa menampilkan **nama, gambar, rarity, dan statistik** di MetaMask atau OpenSea:
- Smart Contract mengatur `baseURI` ke endpoint metadata standar, misalnya:  
  `https://api.namagame.com/api/metadata/{tokenId}`
- Endpoint tersebut membaca data on-chain `getCard(tokenId)` + info nama/foto dari database master, lalu mengembalikan JSON standar ERC-721:
  ```json
  {
    "name": "Erling Haaland #42 [EPIC - POTW]",
    "description": "W3 Football Manager Official On-Chain Player Card",
    "image": "https://cdn.namagame.com/cards/haaland-potw.png",
    "attributes": [
      { "trait_type": "Position", "value": "FW" },
      { "trait_type": "Overall", "value": 86 },
      { "trait_type": "Rarity", "value": "EPIC" },
      { "trait_type": "Edition", "value": "POTW" },
      { "trait_type": "Season", "value": "2025/26" },
      { "trait_type": "Level", "value": 1 }
    ]
  }
  ```
- Untuk jangka panjang (desentralisasi penuh), gambar & JSON edisi permanen bisa di-pin ke **IPFS** (misal via Pinata).
