# 🏛️ Pillar Finance — Self-Repaying Credit

> Never sell. Never repay.

Borrow USDG against tokenized stocks and let the collateral's yield repay the loan.
Pillar charges **no interest**: debt never grows on its own — if yield drops to zero it simply
stops shrinking. Protocol revenue is a 10% cut of harvested yield.

## Struktur
- `contracts/` — Foundry project (PillarCore + mocks, tests, deploy script)
- `docs/` — catatan produk & thread
- `src/app/` — Next.js App Router: landing (`/`), portfolio (`/app`), market (`/app/[SYMBOL]`)
- `src/components/` — landing sections, `ConnectButton`, `Providers`, `app/*` widgets
- `src/lib/` — `chain.ts` (wagmi config), `contracts.ts` (addresses/ABIs/formatters), `hooks.ts`, `generated/` (synced ABIs + deployment)
- `scripts/sync-abi.mjs` — copies ABIs + `contracts/deployments/local.json` into `src/lib/generated/`

## Protocol (contracts/src)
| File | Role |
| --- | --- |
| `PillarCore.sol` | Market registry, positions, deposit/withdraw/borrow/repay, `harvest` (yield → debt), partial `liquidate`, USDG treasury, pause/keeper roles |
| `IPriceOracle.sol` / `MockOracle.sol` | `getPrice(asset) → (price1e18, updatedAt)`; owner can `setPrice`, `markStale`, `refresh` |
| `IYieldSource.sol` / `MockYieldSource.sol` | Holds collateral, accrues yield **in USDG** at a per-second rate (mock mints it) |
| `MockERC20.sol` | USDG (6 dec) + stock tokens (18 dec) |

Risk rules baked in:
- Per-market max LTV (AAPL/MSFT 40%, NVDA 35%, TSLA 30%, SPY 50%, SLV 35% but closed); liquidation threshold = LTV + 10%; liquidator bonus 5%.
- **Stale oracle** (> 1h) blocks `borrow`, `withdrawCollateral` (when debt > 0) and `liquidate`. `deposit`, `repay`, `harvest` never check freshness.
- **Partial liquidation**: max repay is the amount that restores health factor to exactly 1.0; larger amounts revert. Pending yield is applied first.
- Pause blocks deposit/borrow/withdraw/liquidate; repay + harvest always work. Keepers can pause / close markets; only the owner can unpause / reopen.

### Mock vs production
`MockYieldSource` mints USDG as yield. In production the yield source is the Mosaic vault (or a lending pool) that pays yield in the collateral asset; the adapter swaps that leg to USDG on `harvest`. `MockOracle` is replaced by an adapter over a real equities feed. USDG/stock tokens are the real Robinhood Chain assets. `PillarCore` is unchanged — swap constructor args + `listMarket` params in `script/Deploy.s.sol`.

## Local run
Requires Node 20+, Foundry (`~/.foundry/bin` on PATH).

```bash
npm install
npm run contracts:build          # forge build
npm run contracts:test           # forge test -vvv (43 tests incl. fuzz)

npm run chain                    # terminal 1: anvil on :8545 (ANVIL_PORT=8546 to change)
npm run deploy:local             # terminal 2: deploy mocks + PillarCore, write contracts/deployments/local.json, sync ABIs
npm run dev                      # http://localhost:3000  (NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8546 if you changed the port)
```

Then add the local chain (id 31337, RPC http://127.0.0.1:8545) to MetaMask and import Anvil account #1
(`0x59c6…690d`) — the deploy mints it 10,000 of every stock token and 10,000 USDG.

- `/app` — portfolio: collateral, debt, LTV, health factor, yield repaid so far, est. time-to-zero.
  Append `?address=0x…` to inspect any account read-only.
- `/app/AAPL` — market page: deposit / borrow / repay / withdraw / harvest with approve flows, health gauge, distance to liquidation.

### Drive it from the CLI
```bash
export RPC=http://127.0.0.1:8545 PK1=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
CORE=$(node -p "require('./contracts/deployments/local.json').pillarCore")
AAPL=$(node -p "require('./contracts/deployments/local.json').markets.AAPL.asset")
cast send $AAPL "approve(address,uint256)" $CORE $(cast max-uint) --private-key $PK1 --rpc-url $RPC
cast send $CORE "depositCollateral(address,uint256)" $AAPL 100e18 --private-key $PK1 --rpc-url $RPC
cast send $CORE "borrow(address,uint256)" $AAPL 10000e6 --private-key $PK1 --rpc-url $RPC
cast rpc evm_increaseTime 2592000 --rpc-url $RPC && cast rpc evm_mine --rpc-url $RPC   # +30 days
cast send $CORE "harvest(address,address)" $AAPL 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --private-key $PK1 --rpc-url $RPC
cast call $CORE "getPosition(address,address)((uint256,uint256,uint256,uint256))" 0x7099…79C8 $AAPL --rpc-url $RPC   # debt went down
```
Note: after `evm_increaseTime` the oracle is stale — new borrows revert with `StalePrice` until the owner calls `MockOracle.refresh(asset)`.

## Chain config
`src/lib/chain.ts` reads `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CHAIN_NAME`; defaults to Anvil 31337. Point them at Robinhood Chain and re-run `deploy` + `abi:sync` to switch.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind v4 + wagmi/viem; Solidity ^0.8.24 + OpenZeppelin 5 + Foundry.
