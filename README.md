# 🏛️ Pyris Pact — Programmable B2B Payments on Arc & Robinhood Chain

> Programmable milestone escrow & instant B2B settlement in USDC.

Pyris Pact enables businesses, agencies, and global contractors to lock USDC into trustless milestone escrows. Funds disburse immediately upon deliverable sign-off.

Dual chain. On **Arc** (Circle's Layer-1 EVM network) gas is paid directly in **USDC** and the contract runs in native mode. On **Robinhood Chain** (Arbitrum Orbit L2, chain 4663) the same contract runs in ERC-20 mode against **USDG** with ETH gas of a few cents. No banking wire lags, 0% platform commission during beta.

| Network | Chain id | Mode | Escrow asset | Gas | Contract |
|---|---|---|---|---|---|
| Arc Mainnet | 5042 | native | USDC (18 dec) | USDC | `0xb5f905f48321F44e379d8680e947dDd05830AF62` |
| Robinhood Chain | 4663 | ERC-20 | USDG (6 dec) `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | ETH | `0xf7c81a882594b3f3ddd969ebfa750e30eedaead3` |

Registry: `src/lib/chains.ts`. Selected network: `src/lib/network.tsx` (header switcher, `?chain=` links). Robinhood RPC relay: `src/app/api/rpc/[chainId]/route.ts`.

Canonical Domain: **[pyris.tech](https://pyris.tech)**

---

## Architecture & Structure
- `contracts/` — Foundry project.
  - `src/PyrisPact.sol` — Core milestone escrow smart contract.
  - `test/PyrisPact.t.sol` — Full lifecycle unit test suite (creation, submissions, approvals, refunds, disputes).
  - `script/DeployPact.s.sol` — Foundry deployment script for Arc Chain and local Anvil.
  - `../scripts/deploy-robinhood.mjs` — Node/viem deploy to Robinhood Chain from the compiled artifact (no Foundry needed): `npm run deploy:robinhood`.
- `src/app/` — Next.js App Router:
  - `/` — Landing page with live escrow explorer & traditional fee comparison.
  - `/app` — Pact Dashboard: Outgoing (Client) & Incoming (Contractor) views, Create Escrow modal, Release & Refund actions.
  - `/app/[asset]` — Detailed milestone verification and deliverable review view.
  - `/docs` — Comprehensive developer & business documentation.
  - `/whitepaper` — Technical protocol architecture & state machine specification.
  - `/terms` & `/privacy` — Non-custodial software legal notices.
- `src/components/` — UI components (`Header`, `Footer`, `Hero`, `Tabs`, `Markets`, `AppShell`, `ConnectButton`).
- `src/lib/` — `chains.ts` (network registry), `network.tsx` (selected network + switcher), `chain.ts` (wagmi config), `contracts.ts` (types, formatters), `hooks.ts` (`usePacts`, `usePactMutations` incl. the ERC-20 approve step).

---

## Smart Contract: `PyrisPact.sol`
| Function | Access | Description |
| --- | --- | --- |
| `createPact(...)` | Client | Locks USDC into escrow with contractor, optional arbiter, amount, deadline, and scope. |
| `submitWork(...)` | Contractor | Records proof of completion (GitHub PR, Figma link, IPFS CID) onchain. |
| `releaseFunds(...)` | Client | Approves deliverable and disburses 100% of escrowed USDC to contractor. |
| `refund(...)` | Client / Contractor | Reclaims funds if deadline passed without submission, or allows contractor voluntary cancellation. |
| `dispute(...)` | Either party | Freezes the pact if deliverables diverge from the agreed scope. |
| `proposeResolution(...)` | Either party | Proposes a split (vendor share in bps); settles when the counterparty matches it. |
| `arbitrate(...)` | Arbiter | Rules on a disputed pact, if an arbiter was named at creation. |
| `extendDeadline(...)` | Client | Grants the contractor more time while the pact is FUNDED. |
| `withdraw()` | Anyone owed | Claims a payout that could not be pushed to the recipient. |

---

## Arc Chain & USDC Native Gas
Arc Chain features native gas accounting in USDC:
- Clients and contractors only need **USDC** in their wallets.
- Zero need to buy ETH or volatile tokens to fund an escrow or submit deliverables.
- Sub-cent gas fees and sub-second transaction finality.

---

## Local Development
Requires Node 20+, Foundry.

```bash
# 1. Install dependencies
npm install

# 2. Build & test contracts
npm run contracts:build
npm run contracts:test

# 3. Start local chain & deploy
npm run chain
npm run deploy:local

# 4. Start Next.js frontend
npm run dev
# Open http://localhost:3000
```
