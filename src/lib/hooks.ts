"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { zeroAddress, type Address } from "viem";
import { PyrisPactAbi, Erc20Abi, type Pact, PactStatus } from "./contracts";
import { useNetwork } from "./network";

const noop = () => () => {};
/** true after hydration, false during SSR */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

// ------------------------------------------------------------ onchain history

export type PactEventKind =
  | "PactCreated"
  | "DeadlineExtended"
  | "WorkSubmitted"
  | "PactReleased"
  | "PactRefunded"
  | "PactDisputed"
  | "ResolutionProposed"
  | "PactResolved";

/** One state transition of a pact, as proven by an event log on the pact's chain. */
export type PactEvent = {
  kind: PactEventKind;
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp: number; // unix seconds
  actor?: Address;
  /** Human detail pulled from the event args (note, reason, split, amounts). */
  detail?: string;
};

const HISTORY_EVENTS: PactEventKind[] = [
  "PactCreated",
  "DeadlineExtended",
  "WorkSubmitted",
  "PactReleased",
  "PactRefunded",
  "PactDisputed",
  "ResolutionProposed",
  "PactResolved",
];

function describe(kind: PactEventKind, a: Record<string, unknown>): { actor?: Address; detail?: string } {
  const bps = (v: unknown) => `${Number(v) / 100}%`;
  switch (kind) {
    case "PactCreated":
      return { actor: a.client as Address, detail: `Escrow funded for "${a.title}"` };
    case "DeadlineExtended":
      return { detail: `Deadline moved to ${new Date(Number(a.newDeadline) * 1000).toLocaleDateString("en-US")}` };
    case "WorkSubmitted":
      return { detail: String(a.submissionNote ?? "") };
    case "PactReleased":
      return { actor: a.vendor as Address, detail: "Full amount paid to contractor" };
    case "PactRefunded":
      return { actor: a.client as Address, detail: "Full amount returned to client" };
    case "PactDisputed":
      return { actor: a.initiator as Address, detail: String(a.reason ?? "") };
    case "ResolutionProposed":
      return { actor: a.proposer as Address, detail: `Proposed ${bps(a.vendorShareBps)} to contractor` };
    case "PactResolved":
      return { actor: a.resolver as Address, detail: `Settled: ${bps(a.vendorShareBps)} to contractor` };
  }
}

/**
 * Every event the contract emitted for one pact on the selected network, oldest first,
 * each with the transaction hash that proves it. Read straight from chain logs; nothing
 * is stored off-chain.
 */
export function usePactHistory(pactId: bigint | undefined) {
  const net = useNetwork();
  const client = net.client;
  const pactAddress = net.pyrisPact;
  const [events, setEvents] = useState<PactEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!client || pactId === undefined || !pactAddress) return;
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    setEvents([]);

    (async () => {
      try {
        const logsPerKind = await Promise.all(
          HISTORY_EVENTS.map((eventName) =>
            client.getContractEvents({
              address: pactAddress,
              abi: PyrisPactAbi,
              eventName,
              args: { pactId },
              fromBlock: net.deployBlock,
              toBlock: "latest",
            })
          )
        );
        const logs = logsPerKind.flat() as Array<{
          eventName: PactEventKind;
          args: Record<string, unknown>;
          transactionHash: `0x${string}`;
          blockNumber: bigint;
          logIndex: number;
        }>;

        const blockNumbers = Array.from(new Set(logs.map((l) => l.blockNumber)));
        const blocks = await Promise.all(blockNumbers.map((n) => client.getBlock({ blockNumber: n })));
        const tsByBlock = new Map(blockNumbers.map((n, i) => [n, Number(blocks[i].timestamp)]));

        const out: PactEvent[] = logs
          .sort((x, y) => (x.blockNumber === y.blockNumber ? x.logIndex - y.logIndex : x.blockNumber < y.blockNumber ? -1 : 1))
          .map((l) => ({
            kind: l.eventName,
            txHash: l.transactionHash,
            blockNumber: l.blockNumber,
            timestamp: tsByBlock.get(l.blockNumber) ?? 0,
            ...describe(l.eventName, l.args),
          }));
        if (!cancelled) setEvents(out);
      } catch (e) {
        console.error("pact history", e);
        if (!cancelled) setIsError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, pactId, tick, pactAddress, net.deployBlock, net.id]);

  return { events, isLoading, isError, refetch: () => setTick((t) => t + 1) };
}

/**
 * All pacts on the selected network, filtered by client/vendor role.
 */
export function usePacts(userAddress?: Address) {
  const net = useNetwork();
  const pactAddress = net.pyrisPact;
  const { data: rawPacts, refetch, isLoading, isError } = useReadContract({
    address: pactAddress,
    abi: PyrisPactAbi,
    functionName: "getPacts",
    args: [0n, 50n],
    chainId: net.id,
    query: {
      enabled: !!pactAddress,
    },
  });

  const pacts: Pact[] = useMemo(() => {
    return Array.isArray(rawPacts) ? (rawPacts as Pact[]) : [];
  }, [rawPacts]);

  const outgoingPacts = useMemo(() => {
    if (!userAddress) return pacts;
    return pacts.filter(
      (p) => p.client.toLowerCase() === userAddress.toLowerCase()
    );
  }, [pacts, userAddress]);

  const incomingPacts = useMemo(() => {
    if (!userAddress) return [];
    return pacts.filter(
      (p) => p.vendor.toLowerCase() === userAddress.toLowerCase()
    );
  }, [pacts, userAddress]);

  const stats = useMemo(() => {
    let totalEscrowVolume = 0n;
    let activeEscrowAmount = 0n;
    let completedPayouts = 0n;
    let activeCount = 0;
    let completedCount = 0;

    for (const p of pacts) {
      totalEscrowVolume += p.amount;
      if (p.status === PactStatus.FUNDED || p.status === PactStatus.SUBMITTED) {
        activeEscrowAmount += p.amount;
        activeCount++;
      } else if (p.status === PactStatus.RELEASED || p.status === PactStatus.RESOLVED) {
        completedPayouts += p.amount;
        completedCount++;
      }
    }

    return {
      totalEscrowVolume,
      activeEscrowAmount,
      completedPayouts,
      activeCount,
      completedCount,
      totalCount: pacts.length,
    };
  }, [pacts]);

  return {
    pacts,
    outgoingPacts,
    incomingPacts,
    stats,
    isLoading,
    isError,
    refetch,
  };
}

/** The open split proposal on a disputed pact, if any. */
export function useProposal(pactId: bigint | undefined) {
  const net = useNetwork();
  const pactAddress = net.pyrisPact;
  const { data, refetch } = useReadContract({
    address: pactAddress,
    abi: PyrisPactAbi,
    functionName: "proposals",
    args: [pactId ?? 0n],
    chainId: net.id,
    query: { enabled: !!pactAddress && pactId !== undefined },
  });
  const [proposer, vendorShareBps] = (data ?? [zeroAddress, 0]) as readonly [Address, number];
  return { proposer: proposer === zeroAddress ? undefined : proposer, vendorShareBps, refetch };
}

/** Payout owed to the connected wallet after a push transfer failed. */
export function usePendingWithdrawal(account: Address | undefined) {
  const net = useNetwork();
  const pactAddress = net.pyrisPact;
  const { data, refetch } = useReadContract({
    address: pactAddress,
    abi: PyrisPactAbi,
    functionName: "pendingWithdrawals",
    args: [account ?? zeroAddress],
    chainId: net.id,
    query: { enabled: !!pactAddress && !!account },
  });
  return { amount: (data as bigint | undefined) ?? 0n, refetch };
}

/**
 * The connected wallet's balance of the escrow token on the selected network: native
 * balance on Arc, ERC-20 balance on Robinhood Chain. Undefined until loaded.
 */
export function useEscrowBalance(account: Address | undefined) {
  const net = useNetwork();
  const client = net.client;
  const [balance, setBalance] = useState<bigint | undefined>(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!client || !account) { setBalance(undefined); return; }
    let cancelled = false;
    (async () => {
      try {
        const v =
          net.mode === "native" || !net.token.address
            ? await client.getBalance({ address: account })
            : ((await client.readContract({ address: net.token.address, abi: Erc20Abi, functionName: "balanceOf", args: [account] })) as bigint);
        if (!cancelled) setBalance(v);
      } catch {
        if (!cancelled) setBalance(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [client, account, net.id, net.mode, net.token.address, tick]);
  return { balance, refetch: () => setTick((t) => t + 1) };
}

/**
 * Hook for executing Pact escrow actions on the selected network.
 */
export function usePactMutations() {
  const net = useNetwork();
  const pactAddress = net.pyrisPact as Address;
  const { writeContractAsync: rawWrite, data: hash, isPending } = useWriteContract();
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash, chainId: net.id });
  const { chainId, address: account } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = net.client;
  const [step, setStep] = useState<"idle" | "approving" | "sending">("idle");

  /**
   * Every write goes through here so the wallet is on the selected network first. A
   * second injected wallet (Rabby, Phantom) often sits on Ethereum mainnet; without this
   * the transaction would be sent there and fail for lack of gas.
   */
  const writeContractAsync = async (opts: Record<string, unknown>) => {
    if (chainId !== net.id) {
      await switchChainAsync({ chainId: net.id });
    }
    const txHash = await rawWrite({ ...opts, chainId: net.id });
    // The wallet resolves as soon as the tx is signed and sent. Callers refetch state
    // right after, so wait until the chain has actually mined it. Both networks finalise
    // in seconds; anything past 90s means the tx never reached the chain.
    let receipt;
    try {
      receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 90_000 });
    } catch {
      throw new Error(
        `Transaction ${txHash} was not confirmed on ${net.name} within 90s. Check that your wallet sent it on ${net.name} (chain ${net.id}), not another network.`
      );
    }
    if (receipt.status !== "success") throw new Error(`Transaction reverted: ${txHash}`);
    return txHash;
  };

  /**
   * Fund a new pact. Arc (native mode): the amount travels as msg.value. Robinhood Chain
   * (ERC-20 mode): approve the escrow token for the contract first when the allowance is
   * short, then createPact pulls it with transferFrom. arbiter may be the zero address.
   */
  const createPact = async (
    vendor: Address,
    amount: bigint,
    deadlineSeconds: number,
    title: string,
    description: string,
    arbiter: Address = zeroAddress
  ) => {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
    try {
      if (net.mode === "erc20") {
        if (!net.token.address) throw new Error(`${net.name} deployment has no escrow token address`);
        if (!account) throw new Error("Connect a wallet first");
        const allowance = (await publicClient.readContract({
          address: net.token.address,
          abi: Erc20Abi,
          functionName: "allowance",
          args: [account, pactAddress],
        })) as bigint;
        if (allowance < amount) {
          setStep("approving");
          await writeContractAsync({
            address: net.token.address,
            abi: Erc20Abi,
            functionName: "approve",
            args: [pactAddress, amount],
          });
        }
        setStep("sending");
        return await writeContractAsync({
          address: pactAddress,
          abi: PyrisPactAbi,
          functionName: "createPact",
          args: [vendor, arbiter, amount, deadline, title, description],
        });
      }
      setStep("sending");
      return await writeContractAsync({
        address: pactAddress,
        abi: PyrisPactAbi,
        functionName: "createPact",
        args: [vendor, arbiter, amount, deadline, title, description],
        value: amount,
      });
    } finally {
      setStep("idle");
    }
  };

  const extendDeadline = async (pactId: bigint, newDeadline: bigint) => {
    return await writeContractAsync({
      address: pactAddress,
      abi: PyrisPactAbi,
      functionName: "extendDeadline",
      args: [pactId, newDeadline],
    });
  };

  const dispute = async (pactId: bigint, reason: string) => {
    return await writeContractAsync({
      address: pactAddress,
      abi: PyrisPactAbi,
      functionName: "dispute",
      args: [pactId, reason],
    });
  };

  /** Propose a split (vendor share in basis points); settles when the counterparty matches it. */
  const proposeResolution = async (pactId: bigint, vendorShareBps: number) => {
    return await writeContractAsync({
      address: pactAddress,
      abi: PyrisPactAbi,
      functionName: "proposeResolution",
      args: [pactId, vendorShareBps],
    });
  };

  const arbitrate = async (pactId: bigint, vendorShareBps: number) => {
    return await writeContractAsync({
      address: pactAddress,
      abi: PyrisPactAbi,
      functionName: "arbitrate",
      args: [pactId, vendorShareBps],
    });
  };

  const withdraw = async () => {
    return await writeContractAsync({
      address: pactAddress,
      abi: PyrisPactAbi,
      functionName: "withdraw",
    });
  };

  const submitWork = async (pactId: bigint, submissionNote: string) => {
    return await writeContractAsync({
      address: pactAddress,
      abi: PyrisPactAbi,
      functionName: "submitWork",
      args: [pactId, submissionNote],
    });
  };

  const releaseFunds = async (pactId: bigint) => {
    return await writeContractAsync({
      address: pactAddress,
      abi: PyrisPactAbi,
      functionName: "releaseFunds",
      args: [pactId],
    });
  };

  const refund = async (pactId: bigint) => {
    return await writeContractAsync({
      address: pactAddress,
      abi: PyrisPactAbi,
      functionName: "refund",
      args: [pactId],
    });
  };

  return {
    createPact,
    extendDeadline,
    submitWork,
    releaseFunds,
    refund,
    dispute,
    proposeResolution,
    arbitrate,
    withdraw,
    isPending: isPending || isWaiting || step !== "idle",
    /** "approving" while the ERC-20 allowance tx is in flight (Robinhood Chain only). */
    step,
    isSuccess,
    hash,
  };
}
