# 🏛️ Pillar Finance — Self-Repaying Credit

> Never sell. Never repay.

Borrow USDG against tokenized stocks and let the collateral's yield repay the loan.
Pillar charges **no interest**: debt never grows on its own — if yield drops to zero it simply
stops shrinking. Protocol revenue is a 10% cut of harvested yield.

## Struktur
- `contracts/` — Foundry project. `src/` is production-only; every mock lives under `test/mocks/`
- `docs/` — catatan produk & thread
- `src/app/` — Next.js App Router: landing (`/`), portfolio (`/app`), market (`/app/[SYMBOL]`)
- `src/components/` — landing sections, `ConnectButton`, `Providers`, `app/*` widgets
- `src/lib/` — `chain.ts` (wagmi config), `contracts.ts` (addresses/ABIs/formatters), `hooks.ts`, `generated/` (synced ABIs + deployment)
- `scripts/sync-abi.mjs` — copies ABIs + `contracts/deployments/local.json` into `src/lib/generated/`

## Protocol (contracts/src)
| File | Role |
| --- | --- |
| `PillarCore.sol` | Market registry, positions, deposit/withdraw/borrow/repay, `harvest` (yield → debt), partial `liquidate`, USDG treasury, pause/keeper roles |
| `IPriceOracle.sol` | `getPrice(asset) → (price1e18, updatedAt)` — the whole price surface PillarCore needs |
| `ChainlinkOracle.sol` | One Chainlink-shaped aggregator per asset, normalised to 1e18. Reverts on a zero/negative answer, an unfinished round, or a price above the per-feed ceiling. Reports `updatedAt` faithfully; the staleness *policy* stays in PillarCore |
| `IAggregatorV3.sol` | The Chainlink feed interface (and everything that copies its shape) |
| `IYieldSource.sol` | Principal in the collateral asset, yield settled in USDG |
| `ERC4626YieldSource.sol` | Deposits collateral into an ERC-4626 vault; yield is `convertToAssets(shares) − principal`. `harvest` redeems exactly the surplus and swaps it to USDG through the router, bounded by an oracle quote minus a slippage tolerance |
| `ISwapRouter.sol` | `swapExactInput(tokenIn, tokenOut, amountIn, minAmountOut, to)` — the only thing Pillar needs from a DEX |

Nothing in `contracts/src/` is a mock. The test doubles for the systems Pillar does
not own — the aggregator, the vault, the swap venue, the tokens — live in
`contracts/test/mocks/` and cannot be deployed by the production script.

Risk rules baked in:
- Per-market max LTV (AAPL/MSFT 40%, NVDA 35%, TSLA 30%, SPY 50%, SLV 35% but closed); liquidation threshold = LTV + 10%; liquidator bonus 5%.
- **Stale oracle** (> 1h) blocks `borrow`, `withdrawCollateral` (when debt > 0) and `liquidate`. `deposit`, `repay`, `harvest` never check freshness.
- **Partial liquidation**: max repay is the amount that restores health factor to exactly 1.0; larger amounts revert. Pending yield is applied first.
- Pause blocks deposit/borrow/withdraw/liquidate; repay + harvest always work. Keepers can pause / close markets; only the owner can unpause / reopen.

### Yield, honestly
Yield is share appreciation in the vault and nothing else. If the vault loses
value the surplus is zero and `harvest` is a no-op — the adapter never invents a
number, and rounding always goes against the harvester so principal stays whole.
`yieldRatePerSecond` is **realised**, not projected: everything earned since the
first deposit divided by the time elapsed. A fresh position therefore reports ~0
until the vault has actually produced something.

The swap is the one step where value can leak, so `harvest` computes a minimum
output from the oracle price minus `maxSlippageBps` (capped at 10%) and reverts
if the venue cannot fill it. A failed swap leaves the debt exactly where it was;
the protocol never books a repayment it did not receive.

### Deploying
| Script | Use |
| --- | --- |
| `script/DeployLocal.s.sol` | Anvil only. Deploys the mocks from `test/mocks/` so there is something to click. |
| `script/Deploy.s.sol` | Production. Refuses to run on chain 31337. Every external address comes from the environment; markets come from `script/markets.<chainId>.json` (see `markets.example.json`). |

```bash
MARKETS_FILE=script/markets.1234.json \
USDG=0x… ROUTER=0x… FEE_RECIPIENT=0x… PRIVATE_KEY=… \
forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
```

The deploy proves each feed answers before anyone can borrow against it, then
hands ownership to `OWNER` if one is set. Sync the frontend with
`DEPLOYMENT_FILE=contracts/deployments/<chainId>.json npm run abi:sync`.

## Local run
Requires Node 20+, Foundry (`~/.foundry/bin` on PATH).

```bash
npm install
npm run contracts:build          # forge build
npm run contracts:test           # forge test -vvv (99 tests incl. fuzz)

npm run chain                    # terminal 1: anvil on :8545 (ANVIL_PORT=8546 to change)
npm run deploy:local             # terminal 2: DeployLocal (mocks + PillarCore) → contracts/deployments/local.json, sync ABIs
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
Note: after `evm_increaseTime` the oracle is stale — new borrows revert with `StalePrice` until the owner calls `MockOracle.refresh(asset)` (local only; on a real chain the feed republishes on its own).

## Chain config
`src/lib/chain.ts` reads `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CHAIN_NAME`; defaults to Anvil 31337. Point them at Robinhood Chain and re-run `deploy` + `abi:sync` to switch.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind v4 + wagmi/viem; Solidity ^0.8.24 + OpenZeppelin 5 + Foundry.
