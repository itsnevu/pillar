# Pyris Pact — Catatan Status (16 Sep 2026)

## Sudah Selesai ✅

### 1. Rebrand & Shifting Produk
- **Identitas Baru**: Shifting total dari collateral lending ke **Pyris Pact (01 · B2B Programmable Payments & Milestone Escrow)** di jaringan **Arc Chain**.
- **Domain Resmi**: **[pyris.tech](https://pyris.tech)** (terkonfigurasi sebagai canonical origin, sitemap, robots, OpenGraph, email `support@pyris.tech`).

### 2. Smart Contract & Test Suite (`contracts/`)
- `PyrisPact.sol`:
  - Kontrak escrow terdesentralisasi khusus Arc Chain dengan akuntansi native USDC (msg.value, 18 desimal di EVM).
  - State machine: `FUNDED (0)`, `SUBMITTED (1)`, `RELEASED (2)`, `REFUNDED (3)`, `DISPUTED (4)`, `RESOLVED (5)`.
  - Fungsi: `createPact`, `submitWork`, `releaseFunds`, `refund`, `dispute`, `extendDeadline`, `proposeResolution`, `arbitrate`, `withdraw`, serta view helpers pagination.
  - Zero dependencies: tidak memerlukan oracle eksternal maupun swap DEX, sehingga sangat aman dan efisien gas.
- `PyrisPact.t.sol`:
  - Test suite Foundry lengkap menguji seluruh transisi state, pembatasan hak akses vendor vs klien, serta logika refund otomatis setelah deadline lewat.
- `DeployPact.s.sol`:
  - Script deployment untuk Arc Mainnet (`5042`) dan Anvil lokal (`31337`). **Sudah terdeploy di Arc Mainnet: `0xb5f905f48321F44e379d8680e947dDd05830AF62`** (`contracts/deployments/5042.json`).

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
   NEXT_PUBLIC_CHAIN_ID=5042
   NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.arc.io
   NEXT_PUBLIC_CHAIN_NAME=Arc Mainnet
   NEXT_PUBLIC_EXPLORER_URL=https://explorer.arc.io
   ```
4. **Smart Contract (sudah terdeploy di Arc Mainnet)**:
   Tidak perlu deploy ulang. Sinkronkan ABI + alamat mainnet ke frontend sebelum build:
   ```bash
   DEPLOYMENT_FILE=contracts/deployments/5042.json npm run abi:sync
   ```
   Hanya jika perlu redeploy (mis. upgrade kontrak):
   ```bash
   PRIVATE_KEY=0x... forge script script/DeployPact.s.sol:DeployPact --rpc-url https://rpc.mainnet.arc.io --broadcast
   ```
