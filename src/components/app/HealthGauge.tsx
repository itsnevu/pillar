import { distanceToLiquidationPct, fmtHealth } from "@/lib/contracts";

/** Semicircular health-factor gauge. 1.0 = liquidation line; scale tops out at 3.0. */
export function HealthGauge({ hf, ltvBps, maxLtvBps, liqThresholdBps }: { hf?: bigint; ltvBps?: bigint; maxLtvBps: number; liqThresholdBps: number }) {
  const inf = hf === undefined || hf >= 2n ** 200n;
  const h = inf ? 3 : Math.min(3, Number(hf) / 1e18);
  const t = Math.max(0, Math.min(1, (h - 0.5) / 2.5)); // 0.5..3.0 → 0..1
  const r = 88, cx = 110, cy = 104;
  const ang = Math.PI * (1 - t);
  const px = cx + r * Math.cos(ang), py = cy - r * Math.sin(ang);
  const liqT = (1 - 0.5) / 2.5;
  const la = Math.PI * (1 - liqT);
  const lx = cx + (r + 10) * Math.cos(la), ly = cy - (r + 10) * Math.sin(la);
  const dist = distanceToLiquidationPct(hf);
  const tone = inf ? "#57534e" : h < 1 ? "#823a24" : h < 1.2 ? "#d97645" : "#292524";

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="122" viewBox="0 0 220 122" aria-label="Health factor gauge">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e7e5e4" strokeWidth="12" strokeLinecap="round" />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${px.toFixed(1)} ${py.toFixed(1)}`}
          fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round"
        />
        <line x1={cx + (r - 14) * Math.cos(la)} y1={cy - (r - 14) * Math.sin(la)} x2={lx} y2={ly} stroke="#823a24" strokeWidth="1.5" strokeDasharray="3 2" />
        <text x={lx - 4} y={ly - 4} fontSize="9" fill="#823a24" textAnchor="middle">1.0</text>
        <text x={cx} y={cy - 22} textAnchor="middle" fontSize="30" fontFamily="var(--font-serif)" fill={tone}>{fmtHealth(hf)}</text>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fill="#57534e" letterSpacing="1.2">HEALTH FACTOR</text>
      </svg>
      <div className="grid grid-cols-3 gap-4 w-full text-center mt-2">
        <div>
          <div className="text-[11px] tracking-[0.12em] uppercase text-muted">LTV</div>
          <div className="text-[15px] text-ink mt-1">{ltvBps === undefined ? "—" : `${(Number(ltvBps) / 100).toFixed(1)}%`}</div>
        </div>
        <div>
          <div className="text-[11px] tracking-[0.12em] uppercase text-muted">Max / Liq.</div>
          <div className="text-[15px] text-ink mt-1">{maxLtvBps / 100}% / {liqThresholdBps / 100}%</div>
        </div>
        <div>
          <div className="text-[11px] tracking-[0.12em] uppercase text-muted">To liquidation</div>
          <div className="text-[15px] mt-1" style={{ color: tone }}>
            {dist === undefined ? "—" : `${dist.toFixed(1)}% drop`}
          </div>
        </div>
      </div>
    </div>
  );
}
