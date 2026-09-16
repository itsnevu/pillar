import Link from "next/link";
import { ProsePage, Section } from "@/components/ProsePage";

export const metadata = {
  title: "Docs — Pyris Pact",
  description:
    "How Pyris Pact works: programmable B2B payments, smart contract escrow, milestone tracking, and native USDC gas fees on Arc Chain.",
};

const TOC = [
  { id: "overview", heading: "01 · Overview: Programmable B2B Payments" },
  { id: "case-study", heading: "Real-World Example: Agency & Freelancer" },
  { id: "smart-contract-escrow", heading: "Smart Contract Escrow Architecture" },
  { id: "conditional-release", heading: "Conditional Release upon Approval" },
  { id: "invoice-tracking", heading: "Invoice & Milestone Payment Tracking" },
  { id: "arc-chain-gas", heading: "Why Arc Chain & Native USDC Gas" },
  { id: "refund-protection", heading: "Timeout Refunds & Contractor Guarantees" },
  { id: "using-the-dashboard", heading: "Using the Dashboard" },
];

export default function Page() {
  return (
    <ProsePage
      eyebrow="Documentation"
      title="Pyris Pact: Programmable B2B Payments"
      lede="Platform untuk bisnis yang membayar freelancer, vendor, atau agency secara otomatis berdasarkan kondisi yang disepakati di atas Arc Chain."
      meta={["Updated 16 September 2026", "~6 min read"]}
      toc={TOC}
    >
      <Section id="overview" heading="01 · Overview: Programmable B2B Payments">
        <p>
          <strong>Pyris Pact</strong> adalah infrastruktur pembayaran terprogram (<em>programmable payments</em>)
          yang dirancang khusus untuk entitas bisnis: agency, software house, marketplace B2B, dan kontraktor
          internasional.
        </p>
        <p>
          Dalam transaksi konvensional, pembayaran lintas batas terhambat oleh dua kutub risiko:
        </p>
        <ul>
          <li><strong>Klien/Agency:</strong> Ragu mengirim uang muka (DP) besar ke vendor/freelancer yang belum teruji karena risiko ditinggal (<em>ghosted</em>).</li>
          <li><strong>Freelancer/Vendor:</strong> Ragu menyerahkan kode atau aset final sebelum ada jaminan dana tersedia karena risiko tagihan tidak dibayar.</li>
        </ul>
        <p>
          Pyris Pact menyelesaikan masalah ini dengan <strong>Smart Contract Escrow</strong> di jaringan Arc Chain:
          dana disimpan aman di blockchain dan hanya akan dicairkan setelah hasil pekerjaan disetujui.
        </p>
      </Section>

      <Section id="case-study" heading="Real-World Example: Agency & Freelancer">
        <div className="p-5 rounded-[12px] bg-soft border border-line my-4">
          <h3 className="text-[16px] font-bold text-ink mb-2">Contoh Skenario Nyata:</h3>
          <p className="text-[13.5px] text-muted leading-relaxed">
            Sebuah <strong>Agency</strong> merekrut <strong>Freelancer</strong> untuk membangun landing page dan smart contract seharga <strong>$5,000 USDC</strong>:
          </p>
          <ol className="list-decimal pl-5 mt-3 space-y-2 text-[13px] text-ink">
            <li>
              <strong>Locking Dana:</strong> Agency membuat Pact di dashboard dan mendepositkan $5,000 USDC ke dalam smart contract escrow di Arc Chain.
            </li>
            <li>
              <strong>Pekerjaan Dimulai:</strong> Freelancer dapat melihat langsung di onchain bahwa dana $5,000 USDC telah 100% terkunci dan terjamin aman di kontrak.
            </li>
            <li>
              <strong>Submit Deliverable:</strong> Freelancer menyelesaikan pekerjaan dan menyematkan bukti deliverable (link PR GitHub atau link Figma) di smart contract.
            </li>
            <li>
              <strong>Persetujuan & Pencairan:</strong> Agency memeriksa hasil kerja, merasa puas, dan menekan tombol <strong>&ldquo;Release Funds&rdquo;</strong>.
            </li>
            <li>
              <strong>Penerimaan Instan:</strong> $5,000 USDC langsung masuk ke wallet freelancer dalam hitungan sub-detik dengan potongan platform <strong>0%</strong> (menghemat fee $1,000 dibanding Upwork/Escrow konvensional).
            </li>
          </ol>
        </div>
      </Section>

      <Section id="smart-contract-escrow" heading="Smart Contract Escrow Architecture">
        <p>
          Escrow dikelola sepenuhnya oleh <code>PyrisPact.sol</code>. Tidak ada pihak ketiga atau pengelola
          platform yang dapat mengambil atau mengalihkan dana yang sedang dikunci.
        </p>
        <pre className="p-4 bg-soft rounded-[8px] text-[12px] font-mono overflow-x-auto">
{`// Membuat dan mendanai escrow milestone baru
function createPact(
    address vendor,
    uint256 amount,
    uint256 deadline,
    string calldata title,
    string calldata description
) external payable returns (uint256 pactId);`}
        </pre>
        <p>
          Begitu dipanggil oleh klien, token USDC otomatis ditarik dari wallet klien dan dikunci di dalam
          kontrak dengan status <code>FUNDED (0)</code>.
        </p>
      </Section>

      <Section id="conditional-release" heading="Conditional Release upon Approval">
        <p>
          Smart contract menjamin prinsip <em>pembayaran setelah pekerjaan disetujui</em>:
        </p>
        <ul>
          <li>
            <strong>Kontraktor submit bukti kerja:</strong> Melalui fungsi <code>submitWork(pactId, note)</code>, status berpindah menjadi <code>SUBMITTED (1)</code>.
          </li>
          <li>
            <strong>Persetujuan Klien:</strong> Hanya alamat wallet klien (<code>pact.client</code>) yang berhak memanggil fungsi <code>releaseFunds(pactId)</code>.
          </li>
          <li>
            <strong>Disbursement Otomatis:</strong> Kontrak secara atomik mentransfer 100% nominal USDC ke wallet kontraktor dan mengubah status menjadi <code>RELEASED (2)</code>.
          </li>
        </ul>
      </Section>

      <Section id="invoice-tracking" heading="Invoice & Milestone Payment Tracking">
        <p>
          Pyris Pact berfungsi sebagai <em>payment tracker</em> onchain permanen. Setiap transaksi memiliki
          nomor identifikasi (<code>pactId</code>), timestamp pembuatan, tenggat waktu (deadline), catatan deliverable,
          dan status verifikasi yang dapat diaudit oleh kedua belah pihak secara transparan melalui block explorer Arc Chain.
        </p>
      </Section>

      <Section id="arc-chain-gas" heading="Why Arc Chain & Native USDC Gas">
        <p>
          Arc Chain (Circle EVM Layer-1) adalah fondasi ideal untuk produk B2B payment karena menggunakan
          <strong> USDC sebagai native gas currency</strong>.
        </p>
        <p>
          Di jaringan blockchain biasa, bisnis dipusingkan karena harus membeli token volatil seperti ETH hanya
          untuk membayar gas fee. Di Arc Chain:
        </p>
        <ul>
          <li>Klien menyimpan USDC, membayar gas fee pecahan sen dalam USDC.</li>
          <li>Kontraktor menerima USDC bersih tanpa risiko fluktuasi harga.</li>
          <li>Pembukuan akuntansi perusahaan menjadi sangat sederhana (100% berbasis dollar AS).</li>
        </ul>
      </Section>

      <Section id="refund-protection" heading="Timeout Refunds & Contractor Guarantees">
        <p>
          Bagaimana jika salah satu pihak tidak responsif?
        </p>
        <ul>
          <li>
            <strong>Proteksi Klien (Timeout Refund):</strong> Jika deadline proyek telah lewat dan kontraktor belum melakukan submit deliverable, klien berhak memanggil <code>refund(pactId)</code> untuk menarik kembali 100% saldo USDC tanpa potongan.
          </li>
          <li>
            <strong>Pembatalan Sukarela Kontraktor:</strong> Jika terjadi perubahan kesepakatan, kontraktor dapat secara sukarela memicu refund kapan saja untuk mengembalikan dana ke klien.
          </li>
          <li>
            <strong>Flag Sengketa (Dispute):</strong> Jika deliverable tidak sesuai spesifikasi, salah satu pihak dapat mengaktifkan status <code>DISPUTED (4)</code>. Escrow dibekukan dan hanya bisa diselesaikan lewat <em>split</em> yang disetujui kedua pihak (<code>proposeResolution</code>), atau lewat putusan <em>arbiter</em> jika alamat arbiter ditunjuk saat pact dibuat.
          </li>
          <li>
            <strong>Submit terlambat ditolak:</strong> kontraktor tidak bisa memanggil <code>submitWork</code> setelah deadline, jadi hak refund klien tidak bisa didahului. Klien bisa memberi waktu tambahan lewat <code>extendDeadline</code>.
          </li>
          <li>
            <strong>Payout tidak bisa diblokir:</strong> jika dompet penerima menolak transfer, dana masuk ke <code>pendingWithdrawals</code> dan bisa ditarik kapan saja lewat <code>withdraw()</code>.
          </li>
        </ul>
      </Section>

      <Section id="using-the-dashboard" heading="Using the Dashboard">
        <p>
          Kunjungi <Link href="/app">Pact Dashboard</Link> untuk membuat escrow baru, memantau invoice masuk/keluar,
          dan menyetujui pencairan dana secara langsung.
        </p>
      </Section>
    </ProsePage>
  );
}
