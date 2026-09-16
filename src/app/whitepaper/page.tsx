import Link from "next/link";
import { ProsePage, Section, Note } from "@/components/ProsePage";

export const metadata = {
  title: "Whitepaper — Pyris Pact",
  description:
    "Pyris Pact Whitepaper: Programmable B2B Payments & Milestone Escrow on Arc Chain. Mathematical specifications, state machine transitions, and native USDC gas fee dynamics.",
};

const TOC = [
  { id: "abstract", heading: "Abstract" },
  { id: "problem", heading: "The Problem in Global B2B Payments" },
  { id: "core-pillars", heading: "Core Pillars: Programmable B2B Payments" },
  { id: "architecture", heading: "Smart Contract Architecture (PyrisPact.sol)" },
  { id: "state-machine", heading: "State Machine & Conditional Disbursal" },
  { id: "arc-chain-gas", heading: "Arc Chain: Native USDC Gas Advantage" },
  { id: "invoice-tracking", heading: "Onchain Invoicing & Milestone Tracking" },
  { id: "case-study", heading: "Reference Case: Agency & Freelancer Settlement" },
  { id: "security-refund", heading: "Timeout Refunds & Non-Custodial Invariants" },
  { id: "conclusion", heading: "Conclusion & Protocol Status" },
];

export default function Page() {
  return (
    <ProsePage
      eyebrow="Whitepaper · v1.0"
      title="Programmable B2B Payments & Smart Contract Escrow"
      lede="Platform terdesentralisasi untuk bisnis yang membayar freelancer, vendor, atau agency secara otomatis berdasarkan kondisi yang disepakati di atas Arc Chain."
      meta={["Version 1.0", "16 September 2026", "~10 min read"]}
      toc={TOC}
      numbered
      footNote="Spesifikasi teknis PyrisPact.sol yang telah terdeploy di Arc Chain Testnet."
    >
      <Section id="abstract" heading="Abstract">
        <p>
          <strong>Pyris Pact</strong> adalah protokol pembayaran terprogram (<em>programmable payments</em>)
          non-kustodial yang dibangun untuk modern B2B commerce. Protokol ini memungkinkan bisnis, agency,
          dan perusahaan global mengunci modal dalam bentuk USDC ke dalam escrow berbasis smart contract sebelum
          pekerjaan dimulai, dan mencairkannya secara instan begitu deliverables disetujui.
        </p>
        <p>
          Dengan memanfaatkan <strong>Arc Chain</strong>—jaringan Layer-1 EVM dari Circle dengan akuntansi
          native gas fee dalam USDC—Pyris Pact menghapus friksi token volatil, biaya transfer kawat bank yang lambat,
          serta potongan komisi 10%–20% dari marketplace freelance terpusat.
        </p>
      </Section>

      <Section id="problem" heading="The Problem in Global B2B Payments">
        <p>
          Dalam lanskap ekonomi digital saat ini, transaksi antara bisnis (klien/agency) dan penyedia jasa
          (freelancer/vendor) menghadapi inefisiensi struktural:
        </p>
        <ul>
          <li>
            <strong>Eksploitasi Fee Platform Terpusat:</strong> Platform freelance konvensional (Upwork, Freelancer, Escrow.com)
            memotong 10% hingga 20% dari total nilai proyek, memberlakukan masa tahanan dana 5–14 hari, dan memiliki kuasa sepihak untuk membekukan akun.
          </li>
          <li>
            <strong>Latensi & Biaya Wire Transfer Bank:</strong> Pengiriman dana antarnegara melalui jaringan SWIFT memakan waktu
            3–5 hari kerja, dengan biaya transfer $30–$50 per pengiriman ditambah margin selisih kurs valuta asing (FX markup) 2%–4%.
          </li>
          <li>
            <strong>Ketidakseimbangan Kepercayaan (Trust Deficit):</strong> Klien enggan membayar di awal tanpa bukti progres;
            freelancer enggan menyerahkan deliverable akhir tanpa kepastian ketersediaan dana.
          </li>
        </ul>
      </Section>

      <Section id="core-pillars" heading="Core Pillars: Programmable B2B Payments">
        <p>Pyris Pact dibangun di atas empat pilar fundamental:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            <strong>Escrow Berbasis Smart Contract:</strong> Dana USDC disimpan secara terdesentralisasi dan otonom di smart contract onchain, bukan di database perantara.
          </li>
          <li>
            <strong>Pembayaran Setelah Pekerjaan Disetujui:</strong> Dana hanya berpindah tangan apabila klien telah memeriksa dan menyetujui hasil deliverable.
          </li>
          <li>
            <strong>Invoice & Payment Tracking:</strong> Rekam jejak status pembayaran, milestone, dan bukti hasil kerja terdokumentasi permanen di blockchain.
          </li>
          <li>
            <strong>B2B Native USDC Settlement:</strong> Seluruh nilai transaksi dan biaya gas diselesaikan murni dalam USDC di jaringan Arc Chain.
          </li>
        </ol>
      </Section>

      <Section id="architecture" heading="Smart Contract Architecture (PyrisPact.sol)">
        <p>
          Inti dari protokol adalah kontrak otonom <code>PyrisPact.sol</code>. Setiap milestone direpresentasikan
          sebagai struktur data tunggal dengan identifier <code>pactId</code> unik:
        </p>
        <pre className="p-4 bg-soft rounded-[8px] text-[12px] font-mono overflow-x-auto">
{`enum PactStatus {
    FUNDED,      // 0: Client mendepositkan USDC ke escrow
    SUBMITTED,   // 1: Contractor submit deliverable link / proof
    RELEASED,    // 2: Client menyetujui; USDC cair ke contractor
    REFUNDED,    // 3: Dana kembali ke client (timeout / cancel)
    DISPUTED     // 4: Dalam tinjauan perselisihan
}

struct Pact {
    uint256 id;
    address client;
    address vendor;
    uint256 amount;
    uint256 deadline;
    PactStatus status;
    string title;
    string description;
    string submissionNote;
    uint256 createdAt;
    uint256 submittedAt;
}`}
        </pre>
        <Note>
          Invarian Kontrak: Dana yang terkunci di dalam escrow tidak dapat dialihkan ke alamat mana pun
          kecuali ke alamat <code>vendor</code> (saat release) atau kembali ke alamat <code>client</code> (saat refund).
        </Note>
      </Section>

      <Section id="state-machine" heading="State Machine & Conditional Disbursal">
        <p>
          Protokol mengimplementasikan mesin status (state machine) deterministik:
        </p>
        <div className="py-4 font-mono text-[12.5px] bg-soft p-4 rounded-[8px] border border-line">
          [CLIENT: createPact] ──► FUNDED (0)<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;▼ [VENDOR: submitWork]<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SUBMITTED (1)<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;▼ [CLIENT: releaseFunds]<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RELEASED (2)  ──► 100% USDC cair ke Vendor
        </div>
      </Section>

      <Section id="arc-chain-gas" heading="Arc Chain: Native USDC Gas Advantage">
        <p>
          Kelemahan terbesar implementasi smart contract payment di jaringan EVM konvensional (seperti Ethereum atau Polygon)
          adalah fragmentasi token gas. Klien korporat tidak ingin menyimpan token spekulatif seperti ETH di neraca keuangan mereka
          hanya untuk membayar gas fee transaksi.
        </p>
        <p>
          <strong>Arc Chain</strong> menyelesaikan masalah ini dari tingkat protokol:
        </p>
        <ul>
          <li><strong>Native Gas in USDC:</strong> Transaksi dieksekusi dengan gas fee berdenominasi langsung dalam USDC (6 desimal).</li>
          <li><strong>Single Asset Accounting:</strong> Klien mengunci $1,000 USDC, membayar gas fee $0.001 USDC, dan vendor menerima $1,000 USDC.</li>
          <li><strong>Sub-second Finality:</strong> Konfirmasi blok instan memungkinkan pencairan dana selesai dalam hitungan detik.</li>
        </ul>
      </Section>

      <Section id="invoice-tracking" heading="Onchain Invoicing & Milestone Tracking">
        <p>
          Setiap pact berfungsi sebagai invoice onchain yang tidak dapat diubah (immutable invoice). Status penyelesaian,
          timestamp pengajuan, link deliverable proof (PR GitHub, Figma, IPFS), dan tanda tangan persetujuan klien tercatat
          sebagai audit trail permanen untuk kebutuhan pembukuan akuntansi dan perpajakan B2B.
        </p>
      </Section>

      <Section id="case-study" heading="Reference Case: Agency & Freelancer Settlement">
        <p>
          <strong>Contoh Kasus Penggunaan Riil:</strong>
        </p>
        <p>
          Sebuah agency digital berbasis di Asia merekrut software engineer di Eropa untuk pengembangan modul DeFi:
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-[13.5px]">
          <li><strong>Agency menyimpan USDC:</strong> Agency mendepositkan $10,000 USDC ke <code>PyrisPact.sol</code> dengan tenggat 14 hari.</li>
          <li><strong>Pekerjaan Terjamin:</strong> Engineer memverifikasi saldo $10,000 USDC terkunci di onchain dan mulai bekerja dengan tenang.</li>
          <li><strong>Pekerjaan Selesai:</strong> Engineer menyerahkan repositori dan pull request onchain via <code>submitWork()</code>.</li>
          <li><strong>Pelepasan Dana:</strong> Agency mereviu kode, mengonfirmasi QA lolos, dan memanggil <code>releaseFunds()</code>.</li>
          <li><strong>Pencairan Bersih:</strong> Engineer menerima tepat $10,000 USDC secara instan tanpa potongan komisi $2,000 yang biasa diambil platform perantara.</li>
        </ol>
      </Section>

      <Section id="security-refund" heading="Timeout Refunds & Non-Custodial Invariants">
        <p>
          Protokol mengintegrasikan proteksi timeout matematis:
        </p>
        <p className="font-mono text-[12.5px] bg-soft p-3 rounded-[6px] border border-line">
          require(block.timestamp &gt; pact.deadline &amp;&amp; pact.status == PactStatus.FUNDED);
        </p>
        <p>
          Apabila tenggat waktu terlewati dan kontraktor belum menyerahkan deliverable, klien berhak memicu
          <code>refund(pactId)</code> untuk menarik kembali 100% modal tanpa memerlukan persetujuan kontraktor.
        </p>
      </Section>

      <Section id="conclusion" heading="Conclusion & Protocol Status">
        <p>
          Pyris Pact memodernisasi infrastruktur pembayaran B2B dunia nyata dengan menghadirkan escrow terprogram,
          pembayaran kondisional instan, dan pelacakan invoice berbasis USDC di Arc Chain.
        </p>
        <p>
          Akses dashboard produksi di <Link href="/app">Pact Dashboard</Link> atau pelajari petunjuk penggunaan
          di <Link href="/docs">Dokumentasi Pyris Pact</Link>.
        </p>
      </Section>
    </ProsePage>
  );
}
