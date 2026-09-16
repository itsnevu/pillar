# Pyris Pact — Catatan Status (16 Sep 2026)

## Sudah Selesai ✅

### 1. Rebrand & Shifting Produk
- **Identitas Baru**: Shifting total dari collateral lending ke **Pyris Pact (01 · B2B Programmable Payments & Milestone Escrow)** di jaringan **Arc Chain**.
- **Domain Resmi**: **[pyris.tech](https://pyris.tech)** (terkonfigurasi sebagai canonical origin, sitemap, robots, OpenGraph, email `support@pyris.tech`).

### 2. Smart Contract & Test Suite (`contracts/`)
- `PyrisPact.sol`:
  - Kontrak escrow terdesentralisasi khusus Arc Chain dengan akuntansi native USDC (msg.value, 18 desimal di EVM).
  - State machine: `FUNDED (0)`, `SUBMITTED (1)`, `RELEASED (2)`, `REFUNDED (3)`, `DISPUTED (4)`.
  - Fungsi: `createPact`, `submitWork`, `releaseFunds`, `refund`, `dispute`, serta view helpers pagination.
  - Zero dependencies: tidak memerlukan oracle eksternal maupun swap DEX, sehingga sangat aman dan efisien gas.
- `PyrisPact.t.sol`:
  - Test suite Foundry lengkap menguji seluruh transisi state, pembatasan hak akses vendor vs klien, serta logika refund otomatis setelah deadline lewat.
- `DeployPact.s.sol`:
  - Script deployment untuk Arc Chain Testnet (`5042002`) dan Anvil lokal (`31337`).

### 3. Frontend App & UI
- **Dashboard (`/app`)**:
  - Metrik akumulatif: *Total Escrow Volume*, *Active in Escrow*, *Settled Payouts*, *Network Gas Currency (USDC)*.
  - Filter tab: *All Pacts*, *Outgoing (Klien)*, *Incoming (Kontraktor)*.
  - Modal interaktif **"Create New Pact"** untuk mendanai escrow milestone baru.
  - Tombol aksi satu klik: **Release Funds**, **Submit Deliverable**, **Claim Refund**.
- **Detail Milestone (`/app/[asset]`)**:
  - Halaman verifikasi milestone dan review proof-of-work onchain.
- **Landing Page (`/`)**:
  - Hero baru, direktori public pacts live, dan tabel komparasi biaya (Upwork 10–20% fee vs Wire transfer $45 vs Pyris Pact 0% fee di Arc Chain).
- **Dokumentasi & Legal**:
  - `/docs` (panduan lengkap B2B escrow).
  - `/whitepaper` (arsitektur teknis Pyris Pact).
  - `/terms` & `/privacy` (ketentuan software non-custodial).
  - `/blog` (4 artikel baru seputar ekonomi B2B di Arc Chain).

---

## Yang Perlu Dilakukan Saat Deploy ke VPS 🚀

1. **Pull Kode ke VPS**:
   ```bash
   git pull origin main
   ```
2. **Install & Build**:
   ```bash
   npm install
   npm run contracts:build   # forge build
   npm run contracts:test    # forge test
   npm run build             # next build
   ```
3. **Environment (.env di VPS)**:
   File `.env` sudah disiapkan dengan:
   ```env
   NEXT_PUBLIC_SITE_URL=https://pyris.tech
   NEXT_PUBLIC_CHAIN_ID=5042002
   NEXT_PUBLIC_RPC_URL=https://rpc.testnet.arc.io
   NEXT_PUBLIC_CHAIN_NAME=Arc Chain
   NEXT_PUBLIC_EXPLORER_URL=https://testnet.arcscan.io
   ```
4. **Deploy Smart Contract ke Arc Chain Testnet**:
   Jalankan script deploy dengan private key deployer yang didanai testnet USDC:
   ```bash
   PRIVATE_KEY=0x... forge script script/DeployPact.s.sol:DeployPact --rpc-url https://rpc.testnet.arc.io --broadcast
   ```
5. **Jalankan Service di VPS**:
   Gunakan PM2 atau systemd:
   ```bash
   pm2 start npm --name "pyris-tech" -- start
   ```
