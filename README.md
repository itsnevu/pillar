# 🏛️ Pyris Pact — Programmable B2B Payments on Arc Chain

> Programmable milestone escrow & instant B2B settlement in USDC.

Pyris Pact enables businesses, agencies, and global contractors to lock USDC into trustless milestone escrows. Funds disburse immediately upon deliverable sign-off.

Powered by **Arc Chain** (Circle's Layer-1 EVM network), where network gas fees are paid directly in **USDC**. No volatile gas tokens, no banking wire lags, and 0% platform commission during beta.

Canonical Domain: **[pyris.tech](https://pyris.tech)**

---

## Architecture & Structure
- `contracts/` — Foundry project.
  - `src/PyrisPact.sol` — Core milestone escrow smart contract.
  - `test/PyrisPact.t.sol` — Full lifecycle unit test suite (creation, submissions, approvals, refunds, disputes).
  - `script/DeployPact.s.sol` — Deployment script for Arc Chain and local Anvil.
- `src/app/` — Next.js App Router:
  - `/` — Landing page with live escrow explorer & traditional fee comparison.
  - `/app` — Pact Dashboard: Outgoing (Client) & Incoming (Contractor) views, Create Escrow modal, Release & Refund actions.
  - `/app/[asset]` — Detailed milestone verification and deliverable review view.
  - `/docs` — Comprehensive developer & business documentation.
  - `/whitepaper` — Technical protocol architecture & state machine specification.
  - `/terms` & `/privacy` — Non-custodial software legal notices.
- `src/components/` — UI components (`Header`, `Footer`, `Hero`, `Tabs`, `Markets`, `AppShell`, `ConnectButton`).
- `src/lib/` — `chain.ts` (Arc Chain wagmi configuration), `contracts.ts` (types, addresses, formatters), `hooks.ts` (`usePacts`, `usePactMutations`).

---

## Smart Contract: `PyrisPact.sol`
| Function | Access | Description |
| --- | --- | --- |
| `createPact(...)` | Client | Locks USDC into escrow with specified contractor, amount, deadline, and deliverable scope. |
| `submitWork(...)` | Contractor | Records proof of completion (GitHub PR, Figma link, IPFS CID) onchain. |
| `releaseFunds(...)` | Client | Approves deliverable and disburses 100% of escrowed USDC to contractor. |
| `refund(...)` | Client / Contractor | Reclaims funds if deadline passed without submission, or allows contractor voluntary cancellation. |
| `dispute(...)` | Either party | Flags a milestone as disputed if deliverables diverge from initial terms. |

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
