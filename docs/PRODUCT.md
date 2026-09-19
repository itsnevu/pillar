# 🏛️ Pyris Pact — Programmable B2B Payments on Arc Chain

> Milestone escrow & trustless settlement in pure USDC.

## Apa ini
Platform pembayaran dan escrow berbasis smart contract untuk bisnis, agency, dan freelancer/kontraktor global.
Klien mengunci dana **USDC** ke dalam escrow milestone sebelum proyek dikerjakan. Begitu pekerjaan selesai dan disetujui, dana dicairkan langsung ke wallet kontraktor tanpa perantara.

## Keunggulan Utama
1. **Dual chain: Arc dan Robinhood Chain**:
   Di Arc Chain, USDC adalah token gas native, jadi dana kontrak dan biaya gas 100% USDC tanpa token volatil. Di Robinhood Chain (L2 Ethereum), escrow memakai USDG (stablecoin dolar, 6 desimal) dan gas dibayar ETH beberapa sen. Kontraknya sama, satu pact hidup di satu chain, network dipilih di header.
2. **0% Potongan Platform (Beta)**:
   Tidak ada potongan komisi 10%–20% seperti platform freelance konvensional (Upwork, Freelancer, Escrow.com).
3. **Instan & Tanpa Wire Delay**:
   Pencairan dana terjadi dalam hitungan sub-detik begitu disetujui klien, menggantikan wire transfer internasional yang memakan waktu 3–5 hari kerja.
4. **Proteksi Dua Arah**:
   - Kontraktor terlindungi: dana terbukti terkunci di smart contract sebelum mulai bekerja.
   - Klien terlindungi: jika deadline lewat tanpa deliverable, dana dapat di-refund 100%.

## Alur Kerja
```
1. Klien membuat Pact + Kunci USDC ke Escrow
                 ↓
2. Kontraktor mengerjakan proyek & submit proof-of-work di onchain
                 ↓
3. Klien memeriksa hasil & klik "Release Funds"
                 ↓
4. USDC instan masuk ke wallet kontraktor (0% platform cut)
```

## Smart Contract (`PyrisPact.sol`)
- `createPact(...)`: Klien mengunci USDC.
- `submitWork(...)`: Kontraktor menyematkan bukti deliverable (PR GitHub / link Figma).
- `releaseFunds(...)`: Klien menyetujui dan mencairkan pembayaran.
- `refund(...)`: Refund otomatis jika deadline lewat, atau pembatalan sukarela dari kontraktor.
- `dispute(...)`: Menandai sengketa jika deliverable tidak sesuai spesifikasi.

## Frontend
- Dashboard `/app`:
  - Ringkasan statistik (Volume Escrow, Active, Settled).
  - Filter: All Pacts, Outgoing (Klien), Incoming (Kontraktor).
  - Modal Create Pact dan tombol aksi satu klik.
- Detail `/app/[asset]`: Inspeksi detail deliverable, info onchain, dan eksekusi rilis/refund.
