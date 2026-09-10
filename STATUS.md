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
Semua yang tersisa menunggu data/keputusan dari luar kode — situsnya sendiri sudah siap produksi.

1. **Robinhood Chain** — `src/lib/chain.ts` sudah sepenuhnya env-driven; tinggal isi `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CHAIN_NAME` (lihat `.env.example`). Yang masih dibutuhkan: RPC publik, chain id, alamat USDG asli, alamat stock token asli, oracle asli (Chainlink?), lalu deploy ulang + `npm run abi:sync`.
2. **Yield source asli** — sekarang mock yang mencetak USDG. Produksi: Mosaic vault / lending pool yang bayar dalam aset jaminan → perlu swap ke USDG saat harvest.
3. Treasury masih pot sederhana (belum LP shares); belum ada pengetatan LTV akhir pekan; belum ada keeper otomatis untuk `harvest()`.
4. Wallet flow baru diuji lewat `cast`, belum di-klik dengan MetaMask sungguhan.
5. Handle X & Telegram belum ada → `NEXT_PUBLIC_X_URL` / `NEXT_PUBLIC_TELEGRAM_URL` kosong, footer otomatis menyembunyikan link-nya sampai diisi.
6. Ilustrasi hero = line-art SVG, bukan engraving foto seperti Turret.
7. Audit sebelum mainnet.

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
