# 🏛️ Pillar Finance — Self-Repaying Credit

> Jangan jual. Pinjam di atasnya, biarkan dia yang melunasi.

## Apa ini
Kamu setor **tokenized stocks** (Robinhood Crypto) sebagai jaminan. Kamu pinjam **USDG** di atasnya.
Jaminanmu bekerja menghasilkan yield, dan **yield itu yang melunasi utangmu** — bukan kamu.
Tidak ada cicilan, tidak ada jatuh tempo. Waktu yang membayar.

## Analogi nama
Pilar adalah bagian bangunan yang **tidak pernah kamu bongkar** untuk dapat material.
Portofolio yang kamu yakini seharusnya diperlakukan sama.

## Masalah yang diselesaikan
Menjual aset yang kamu yakini demi kebutuhan tunai adalah kekalahan paling mahal dalam investing.
Pillar memberi likuiditas **tanpa menutup posisi**.

## Cara kerja
```
Deposit stock token  →  jadi jaminan
        ↓
Jaminan disalurkan ke sumber yield (Mosaic / lending pool)
        ↓
Pinjam USDG (LTV konservatif 30–50% per market)
        ↓
harvest(): yield → potongan protokol 10% → sisanya melunasi utang otomatis
        ↓
Utang lunas → jaminan kembali utuh, posisi tidak pernah dijual
```

## Aturan jujur
- Yield nol → utang berhenti menyusut, tapi **tidak pernah bertambah** (Pillar tidak mengenakan bunga).
- Saham tutup, utang hidup 24/7 → LTV sengaja konservatif.
- Oracle basi → **borrow & withdraw diblokir**, repay/harvest/deposit tetap jalan.
- Likuidasi **parsial**: hanya irisan terkecil yang memulihkan health factor; over-liquidate → revert.

## Produk
- Vault jaminan + credit line USDG (`PillarCore`)
- Auto-repay engine (`harvest`)
- Dashboard `/app`: LTV, sisa utang, yield yang sudah melunasi, estimasi waktu lunas, jarak ke likuidasi
- Market page `/app/<TICKER>`: deposit / borrow / repay / withdraw / harvest

## Posisi di ekosistem
```
Prism  → menciptakan aset (index token)
Pillar → menjadikannya jaminan produktif
Mosaic → menghasilkan yield yang melunasi utangnya
```

## Tech
Lihat `contracts/` (Foundry) dan `README.md` untuk cara jalankan lokal (anvil → deploy → abi:sync → dev).
