# Pillar Finance — Catatan Status (10 Sep 2026)

## Sudah selesai ✅
**Landing page** — replika turret.capital, pakai DOM + CSS asli Turret (`src/styles/pillar.css`, class `rusd-*`, `borrow-*`, `turret-*`, `dockyard-*`) dengan konten Pillar.
- `src/app/page.tsx`, `src/components/{Header,HeaderNavigation,Hero,Tabs,Markets,Footer}.tsx`
- Aset: `public/brand/pillar-mark.svg`, `public/illustrations/pillar-column.svg`
- Tabel market: Stocks (9) · ETFs (2) · Metals (SLV closed) · Memecoins — "View market" → `/app/<TICKER>`

**Smart contract** (`contracts/`, Foundry) — **43 test lolos** (40 unit + 3 fuzz)
- `PillarCore.sol`: market registry (LTV 30–50%), deposit collateral → yield source, borrow USDG dari treasury, `harvest()` = yield → potongan protokol 10% → sisanya melunasi utang otomatis, `healthFactor`, likuidasi **parsial** (revert kalau over-liquidate), oracle basi memblokir borrow/withdraw tapi **tidak** repay/harvest/deposit, pause, keeper role
- Mock: `MockERC20` (USDG 6 dec, saham 18 dec), `MockOracle`, `MockYieldSource` (8% APY, bayar USDG)
- Terbukti via `cast`: deposit 100 AAPL → borrow 10.000 USDG → +30 hari → harvest → **utang 10.000 → 9.815** tanpa user bayar

**Frontend app** — wagmi + viem
- `/app` portofolio (LTV, utang, yield yang sudah melunasi, estimasi lunas, jarak ke likuidasi)
- `/app/[asset]` market page: deposit / borrow / repay / withdraw / harvest, health gauge
- `src/components/ConnectButton.tsx`, `src/lib/hooks.ts` (`useMarkets`, `useUserPositions`), `src/lib/chain.ts`, `src/lib/contracts.ts`
- `npm run build` ✓ · `tsc` ✓ · `eslint` ✓

## Belum selesai ⏳
Yang tersisa murni menunggu alamat/keputusan dari luar — tidak ada lagi kode mock yang harus ditulis.

1. **Alamat Robinhood Chain** — semuanya sudah env-driven. Yang dibutuhkan: RPC publik + chain id, alamat USDG asli, alamat stock token asli, alamat **Chainlink aggregator** per market, alamat **vault ERC-4626** per market, dan alamat **router swap**. Isi ke `script/markets.<chainId>.json` (contoh: `script/markets.example.json`) lalu jalankan `Deploy.s.sol`.
2. Treasury masih pot sederhana (belum LP shares); belum ada pengetatan LTV akhir pekan; belum ada keeper otomatis untuk `harvest()`.
3. Wallet flow baru diuji lewat `cast` + suite Foundry, belum di-klik dengan MetaMask sungguhan.
4. Handle X & Telegram belum ada → `NEXT_PUBLIC_X_URL` / `NEXT_PUBLIC_TELEGRAM_URL` kosong, footer otomatis menyembunyikan link-nya.
5. Ilustrasi hero = line-art SVG, bukan engraving foto seperti Turret.
6. Audit sebelum mainnet.

## Artikel peluncuran ✅ (10 Sep 2026)
Blog tidak lagi berisi satu post. Tiga artikel baru ditulis, masing-masing ~750-800 kata, dengan suara yang sama seperti ARTICLE.md dan argumen yang cocok dengan perilaku kontrak sungguhan:
- **Why We Lend So Little Against Your Apple** (`docs/ARTICLE-LTV.md`) — kenapa LTV sengaja rendah: aritmetika gap akhir pekan (pinjam 70% lalu gap 15% = LTV 82% sebelum sempat bereaksi; pinjam 30% = 35%, aman).
- **What A Self-Repaying Loan Cannot Do** (`docs/ARTICLE-LIMITS.md`) — batas jujur: yield nol menghentikan pelunasan, likuidasi nyata walau parsial, dan semua sistem eksternal yang Pillar tidak kendalikan.
- **An Oracle Should Refuse** (`docs/ARTICLE-ORACLE.md`) — kenapa oracle revert alih-alih mengembalikan nol, plafon circuit-breaker, dan kenapa staleness memblokir borrow tapi tidak pernah repay/harvest.

`allPosts()` sekarang stable-sort: post dengan tanggal sama mempertahankan urutan deklarasi, karena set peluncuran ini semuanya bertanggal sama.

Juga diperbaiki: `/app` menampilkan **"Paid"** di kartu "Est. time to zero" padahal belum ada posisi sama sekali — menyesatkan, seolah ada pinjaman yang sudah lunas. Sekarang `—` / "no open position" kalau tidak ada posisi terbuka.

## Halaman panjang & whitepaper ✅ (10 Sep 2026)
Halaman prose sebelumnya melayang tanpa header/footer, hierarki judul rata (h1 seukuran h2), serif display tidak kepakai, dan teks menempel di tepi kiri. Sekarang semuanya duduk di dalam situs dan memakai bahasa desain landing.

- `src/styles/prose.css` — stylesheet long-form baru di atas token `--rusd-*` yang sama. Mengisi kelas `blog-index-heading` / `blog-article-heading` / `blog-feature` / `blog-archive` / `blog-prose` yang sudah dicadangkan di `pillar.css` tapi belum pernah punya layout.
- `ProsePage` sekarang membawa `Banner` + `Header` + `Footer`, punya eyebrow, lede, baris meta, rail daftar isi sticky, dan footer navigasi.
- **`/whitepaper` baru** — 10 bagian bernomor (abstract → status), tabel parameter risiko, dan callout. Isinya mendeskripsikan perilaku kontrak yang benar-benar ter-deploy, bukan roadmap.
- `/blog` jadi arsip dua kolom (tanggal · judul+kutipan); halaman artikel punya judul serif besar, tanggal, dan estimasi waktu baca.
- `/docs` dan `/risk` dapat daftar isi sticky; `/terms` dan `/privacy` ikut shell yang sama.

Dua bug CSS yang ketemu lewat screenshot dan diperbaiki:
1. Jarak antar-paragraf hilang. `.blog-prose p { margin: 0 }` punya specificity (0,1,1) dan mengalahkan `.blog-prose > * + *` di (0,1,0) — universal selector tidak menyumbang specificity, jadi urutan tidak menolong. Kedua aturan sekarang ditulis pada specificity yang sama.
2. Judul artikel membungkus jadi 7 baris karena `max-width: 22ch` terpasang di seluruh header, bukan di `h1`-nya.

Link inline di dalam prose tidak lagi memakai `rusd-text-link` (13px bold) sehingga terbaca sebagai teks biasa.

## Bebas mock ✅ (10 Sep 2026)
`contracts/src/` sekarang **tidak berisi satu pun mock**. Semua mock pindah ke `contracts/test/mocks/` dan tidak bisa ikut ter-deploy oleh script produksi.

**Kontrak produksi baru**
- `ChainlinkOracle.sol` — satu aggregator Chainlink per aset, dinormalisasi ke 1e18. Menolak jawaban nol/negatif, ronde yang belum selesai, dan harga di atas plafon per-feed (`maxAnswer`, penjaga kalau feed "pinned" di circuit breaker). Melaporkan `updatedAt` apa adanya — kebijakan staleness tetap satu tempat di PillarCore. **17 test.**
- `ERC4626YieldSource.sol` — jaminan masuk ke vault ERC-4626 sungguhan; yield = `convertToAssets(shares) − principal`. `harvest` menebus persis surplusnya, menukarnya ke USDG lewat router dengan batas bawah dari harga oracle dikurangi toleransi slippage (plafon 10%). Vault rugi → surplus nol, bukan angka karangan. Pembulatan selalu memihak protokol sehingga principal tetap utuh. `yieldRatePerSecond` **realized**, bukan proyeksi. **31 test.**
- `IAggregatorV3.sol`, `ISwapRouter.sol` — interface eksternal.

**Bukti end-to-end** — `test/ProductionStack.t.sol` (8 test) menjalankan PillarCore di atas ChainlinkOracle + ERC4626YieldSource, tanpa satu pun mock di `src/`:
- yield melunasi utang tanpa peminjam bayar sepeser pun ($30k jaminan, 8%/thn → $2.160 masuk ke utang setelah potongan protokol)
- 6× harvest tahunan → utang **nol**, jaminan kembali **utuh 100 AAPL**
- yield nol → utang **diam**, tidak tumbuh
- feed basi memblokir borrow tapi tidak repay; feed jawab 0 → market berhenti total
- gap Senin −40% → likuidasi **parsial**, over-liquidate revert, posisi masih dipegang user
- swap gagal → harvest revert, utang tidak berubah (protokol tidak pernah membukukan pelunasan yang tidak diterima)

**Frontend** — tidak ada lagi angka karangan. Tabel market digerakkan penuh oleh data chain: hanya market yang benar-benar ada di deployment yang ditampilkan (6, bukan 13 baris fiksi), harga oracle tampil `—` sampai chain menjawab, dan kalau chain tak terjangkau muncul pesan eksplisit alih-alih harga palsu. ABI yang di-generate juga produksi saja (`ChainlinkOracle`, `ERC4626YieldSource`, `IERC20Metadata`) — tidak mungkin lagi ter-compile terhadap `MockOracle`.

**Script** — `DeployLocal.s.sol` (anvil, pakai mock) dipisah dari `Deploy.s.sol` (produksi, menolak jalan di chain 31337, semua alamat dari env + `markets.<chainId>.json`, membuktikan tiap feed menjawab sebelum market di-list).

**Test: 99 lulus** (43 PillarCore + 17 oracle + 31 yield source + 8 integrasi), 0 gagal.

## Kesiapan produksi ✅ (10 Sep 2026)
- **Tidak ada lagi route mati.** Nav/tab sisa Turret (`/borrow`, `/earn`, `/portfolio`, `/borrow/fixed-term`, `/borrow/self-repaying`) dulu 404 semua; sekarang menunjuk ke `/#markets`, `/app`, `/docs`. Seluruh link internal di-crawl dari HTML hasil `next start` → 0 rusak.
- **Halaman publik lengkap**: `/docs` (dokumentasi produk asli, bukan lagi dump ARTICLE.md), `/blog` + `/blog/<slug>` (post dibaca dari `docs/ARTICLE.md` lewat `src/lib/posts.ts`), `/risk`, `/terms`, `/privacy` — semua lewat shell bersama `src/components/ProsePage.tsx`.
- **SEO/social**: `metadataBase`, canonical, OpenGraph + Twitter card, `src/app/robots.ts`, `src/app/sitemap.ts`, dan kartu OG 1200×630 yang di-generate (`src/app/opengraph-image.tsx`).
- **Link terpusat** di `src/lib/links.ts`; tidak ada `href="#"` tersisa. Aset bawaan `create-next-app` di `public/` sudah dihapus.
- `npm run build` ✓ · `tsc` ✓ · `eslint` ✓ (0 error) · `forge test` 43/43 ✓

## Cara jalankan lokal
```bash
npm run chain          # anvil (port 8545; override ANVIL_PORT)
npm run deploy:local   # deploy mock + PillarCore → contracts/deployments/local.json
npm run abi:sync       # ABI → src/lib/generated
npm run dev            # http://localhost:3000  ·  /app  ·  /app/AAPL
npm run contracts:test # forge test
```
Akun Anvil #1 sudah dapat 10k tiap saham + 10k USDG.

## Konten
`docs/PRODUCT.md` (spek), `docs/THREAD.md` (thread X 16 post ≤280 char), bio X: *"Borrow against your Robinhood Crypto tokenized stocks and let the yield repay the loan for you."*
