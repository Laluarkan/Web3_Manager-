# 06 — Sumber Data Statistik Pemain Dunia & Update Mingguan (GRATIS)

Dokumen ini membahas secara lengkap cara mendapatkan **data statistik pemain bola seluruh dunia** (bukan hanya Liga Inggris/EPL) untuk musim terbaru dengan **update rutin setiap minggu secara GRATIS**.

> **Catatan Ruang Lingkup:**
> - Kita **HANYA membutuhkan data pemain & statistik performa pemain** (untuk rating kartu, Live Form mingguan, dan rilis kartu event seperti `POTW`).
> - **Tidak ada** fitur tampilan jadwal/skor pertandingan asli maupun prediksi skor, sehingga kita **tidak membutuhkan** API jadwal pertandingan seperti `Football-Data.org` / `Football-Data.co.uk`.
> - Pada Fase 1 (membangun NFT, KANS, Starter Pack, 4-3-3, Marketplace), kita gunakan **seed data awal** sesuai struktur tabel di bawah, lalu scraper/sync global dipasang di Fase berikutnya tanpa mengubah struktur Smart Contract.

---

## 1. Sumber Data Statistik Pemain Dunia Gratis (Multi-Liga Global)

Untuk mendapatkan **1) rating lengkap ala eFootball/EA FC** dan **2) update statistik performa mingguan di seluruh dunia** secara gratis, kita memanfaatkan sumber-sumber berikut:

| Sumber Data | Cakupan Dunia | Biaya | Isi Data Pemain | Peran di Game Kita |
| :--- | :--- | :--- | :--- | :--- |
| **1. EA FC / SoFIFA Database** *(Dataset publik Kaggle / GitHub / scraping berkala)* | **Global: 17.000+ pemain dari 30+ liga dunia** (Eropa, Amerika Selatan, MLS, Saudi, J-League, K-League, dll.) | **100% Gratis** | Rating lengkap ala game bola: **OVR, Pace, Shooting, Passing, Dribbling, Defending, Physicality**, posisi detail (`ST`, `LW`, `CM`, `CB`, `GK`), umur, klub, negara, foto. | **Base Rating Awal Musim** (dasar statistik seluruh kartu `BASE`). |
| **2. FBref (berbasis data Opta)** *(via scraper terjadwal / Python `soccerdata`)* | **Global: Puluhan liga dunia** (Top 5 Eropa, Eredivisie, Liga Portugal, Brasileirão, Argentina, MLS, Liga MX, Liga Champions, dll.) | **100% Gratis** *(wajib rate-limit sopan, 1x seminggu)* | Statistik performa mingguan sangat akurat: **gol, assist, menit main, xG, xA, shots, key passes, tackles, interceptions, saves kiper**. | **Update Statistik Mingguan Global** untuk hitung skor performa & kandidat **`POTW`**. |
| **3. Transfermarkt Datasets** *(repo terbuka `dcaribou/transfermarkt-datasets` di GitHub / Kaggle)* | **Global: 400+ klub & puluhan ribu pemain lintas liga** | **100% Gratis** *(update otomatis tiap minggu via dataset publik)* | Profil pemain, **perpindahan klub terbaru (bursa transfer)**, *market value*, gol, assist, kartu kuning/merah, menit main per musim/pekan. | **Update Transfer Klub & Statistik Mingguan** tanpa harus scraping berat sendiri! |
| **4. Sofascore / FotMob (Public JSON Data)** | **Hampir seluruh liga dunia** (termasuk Eropa, Asia, Amerika Latin, Afrika) | **Gratis** *(unofficial endpoint, wajib cron lambat & di-cache)* | **Match Rating mingguan (skala 1.0 – 10.0)**, gol, assist, *Team of The Week* di berbagai liga dunia. | **Referensi Live Form (A–E)** dan rating mingguan lintas benua. |
| **5. API-Football (API-Sports) — Free Plan** | **1.000+ liga seluruh dunia** | **Gratis** (100 request/hari) | API resmi & stabil: profil pemain, foto resmi, klub, dan statistik pemain. | **Pelengkap resmi** (misal ambil foto/profil pemain tertentu yang kurang, dengan cache database). |

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
