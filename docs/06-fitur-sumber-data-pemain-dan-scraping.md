# 06 — Sumber Data Statistik Pemain Dunia & Update Mingguan (GRATIS)

Dokumen ini membahas secara lengkap cara mendapatkan **data statistik pemain bola seluruh dunia** (bukan hanya Liga Inggris/EPL) untuk musim terbaru dengan **update rutin setiap minggu secara GRATIS**.

> **Catatan Ruang Lingkup:**
> - Kita **HANYA membutuhkan data pemain & statistik performa pemain** (untuk rating kartu, Live Form mingguan, dan rilis kartu event seperti `POTW`).
> - **Tidak ada** fitur tampilan jadwal/skor pertandingan asli maupun prediksi skor, sehingga kita **tidak membutuhkan** API jadwal pertandingan seperti `Football-Data.org` / `Football-Data.co.uk`.
> - Pada Fase 1 (membangun NFT, KANS, Starter Pack, 4-3-3, Marketplace), kita gunakan **seed data awal** sesuai struktur tabel di bawah, lalu scraper/sync global dipasang di Fase berikutnya tanpa mengubah struktur Smart Contract.

---

## 1. Sumber Data Statistik Pemain Dunia Gratis (Multi-Liga Global)

**Pipeline penarikan data pemain dunia nyata sudah aktif** melalui script `backend/src/scripts/sync-global-players.ts` (`npm run sync:players`) menggunakan **ESPN Public Soccer API (100% gratis, tanpa API key, JSON resmi)**:

- **Cakupan 13 Liga Dunia sekaligus:** Premier League (`eng.1`), La Liga (`esp.1`), Serie A (`ita.1`), Bundesliga (`ger.1`), Ligue 1 (`fra.1`), Eredivisie (`ned.1`), Primeira Liga (`por.1`), Brasileirão (`bra.1`), Liga Profesional Argentina (`arg.1`), MLS (`usa.1`), Saudi Pro League (`ksa.1`), J1 League (`jpn.1`), dan **Liga 1 Indonesia (`idn.1`)**.
- **Data yang ditarik langsung:** Ribuan pemain aktif musim berjalan, nama lengkap, kewarganegaraan, posisi, klub & **logo klub PNG resmi**, serta statistik live (`appearances`, `goals`, `assists`, `saves`, `shotsOnTarget`, kartu) yang otomatis dihitung menjadi **OVR, 6 atribut (`PAC/SHO/PAS/DRI/DEF/PHY`), dan Live Form (`A`–`E`)**.
- **Disimpan di Database Dulu (Bukan Blockchain):** Master data ribuan pemain dunia disimpan di tabel `Player` & `Club` di **Database** (SQLite lokal → Neon PostgreSQL), sedangkan **Blockchain hanya menyimpan NFT milik user** (`tokenId` merujuk ke `playerId`).
- **Update Mingguan Aman:** Cukup jalankan `npm run sync:players` setiap minggu (atau via GitHub Actions Cron gratis). Script memakai `UPSERT` berdasarkan `externalKey` (`espn-<id>`) sehingga **`Player.id` tidak pernah berubah** dan referensi `playerId` pada NFT on-chain tetap aman 100%.

### Sumber Tambahan Opsional (Untuk Pengembangan Lanjutan)

| Sumber Data | Cakupan Dunia | Biaya | Peran Tambahan |
| :--- | :--- | :--- | :--- |
| **1. ESPN Public Soccer API** *(Sudah Aktif di `sync:players`)* | **Global: 13+ liga dunia (Eropa, Brasil, Argentina, MLS, Saudi, Jepang, Indonesia)** | **100% Gratis**, tanpa API Key | Tarik daftar klub + logo PNG + ribuan pemain & statistik musim berjalan secara rutin tiap minggu. |
| **2. EA FC / SoFIFA Database** *(Dataset publik Kaggle / CSV)* | **Global: 17.000+ pemain dari 30+ liga dunia** | **100% Gratis** | Opsional jika ingin mencocokkan atribut `Pace/Dribbling/Physical` persis angka EA FC. |
| **3. Transfermarkt Datasets** *(repo terbuka `dcaribou/transfermarkt-datasets`)* | **Global: 400+ klub lintas liga** | **100% Gratis** | Referensi tambahan *market value* & riwayat transfer. |
| **4. API-Football (API-Sports) — Free Plan** | **1.000+ liga seluruh dunia** | **Gratis** (100 request/hari) | Opsional untuk menambah foto wajah (*headshot*) pemain tertentu dengan cache database. |

---

## 2. Strategi Pipeline Data Global Gratis (Tanpa Ganggu Performa Web)

```text
[1x per Musim]  EA FC / SoFIFA Dataset (17.000+ Pemain Dunia)
                        │
                        ▼
               Tabel Master `Player` (Base OVR, PAC, SHO, PAS, DRI, DEF, PHY)
                        ▲
                        │  (Update tiap Senin pagi via GitHub Actions Cron - GRATIS)
[1x per Minggu] Transfermarkt Dataset + FBref / Sofascore (Statistik Global)
                        │
                        ▼
        Update `PlayerWeeklyStat`, `liveForm` (A/B/C/D/E), & Kandidat `POTW`
```

### Bagaimana Statistik Dunia Nyata Memengaruhi Game Manager Kita?
1. **Live Form Mingguan (`A`, `B`, `C`, `D`, `E` — ala *eFootball*):**
   - Setiap awal pekan, sistem menghitung skor performa pemain dari gol, assist, clean sheet, dan match rating dunia nyatanya minggu lalu.
   - Pemain yang bersinar di dunia nyata mendapat **Live Form `A` atau `B`** → selama 7 hari ke depan, kartu NFT pemain tersebut mendapat **bonus performa kecil** saat bertanding di game!
   - Pemain yang jarang main/performa turun mendapat `C` (netral) atau `D`. *(Rating dasar NFT di blockchain tidak dirusak; Live Form adalah modifier dinamis mingguan).*
2. **Seleksi Kartu Event `POTW` (*Player of The Week*):**
   - Sistem otomatis menyeleksi 11 pemain dengan performa mingguan terbaik dari berbagai liga dunia untuk dirilis sebagai **Pack/Kartu NFT Edisi Terbatas `POTW`** minggu tersebut.
3. **Update Transfer Klub:**
   - Jika seorang pemain pindah klub di dunia nyata, data `club` terbarunya diperbarui dari dataset Transfermarkt (untuk kartu edisi musim baru / chemistry klub).

---

## 3. Rancangan Tabel Database Pemain (Prisma)

Hanya fokus pada **pemain & statistik pemain** (tanpa tabel jadwal pertandingan asli):

- **`Club`:** `id`, `name`, `leagueName`, `country`, `logoUrl`
- **`Player`:**
  - Identitas: `id`, `externalKey` *(ID unik stabil untuk sinkronisasi)*, `name`, `nationality`, `clubId`, `photoUrl`
  - Posisi: `position` (`GK`, `DF`, `MF`, `FW`), `detailPosition` (`ST`, `LW`, `RW`, `CAM`, `CM`, `CDM`, `LB`, `CB`, `RB`, `GK`)
  - Atribut Dasar (skala 1–99): `overall`, `pace`, `shooting`, `passing`, `dribbling`, `defending`, `physical`
  - Status Mingguan: `liveForm` (`"A"`, `"B"`, `"C"`, `"D"`, `"E"`, default `"C"`), `weeklyScore`, `lastSyncedAt`
- **`PlayerWeeklyStat`:**
  - `id`, `playerId`, `season`, `weekNumber`, `goals`, `assists`, `cleanSheets`, `minutesPlayed`, `avgRating`, `computedForm`, `isPotwSelected`, `recordedAt`

---

## 4. Prinsip Penting Agar Data Tetap Stabil & Aman

1. **ID Pemain Internal Tidak Boleh Berubah:** Karena `playerId` disimpan permanen di Smart Contract `FootballCardNFT`, update mingguan **hanya boleh melakukan `UPSERT` (update atribut/form)** berdasarkan `externalKey`, tidak pernah menghapus & mengacak ulang ID pemain.
2. **Jalankan Sync di Background (GitHub Actions Cron Gratis):** Backend dan Frontend tidak pernah memanggil sumber eksternal saat user membuka web — semuanya membaca dari database kita sendiri sehingga sangat cepat dan hemat kuota.
