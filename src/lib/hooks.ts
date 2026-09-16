"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useSwitchChain,
} from "wagmi";
import { zeroAddress, type Address } from "viem";
import { PyrisPactAbi, addresses, DEPLOY_BLOCK, type Pact, PactStatus } from "./contracts";
import { pyrisChain } from "./chain";

const noop = () => () => {};
/** true after hydration, false during SSR */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

const pactAddress = addresses.pyrisPact as Address;

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

/** One state transition of a pact, as proven by an event log on Arc. */
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
 * Every event the contract emitted for one pact, oldest first, each with the
 * transaction hash that proves it. Read straight from Arc logs; nothing is
 * stored off-chain.
 */
export function usePactHistory(pactId: bigint | undefined) {
  const client = usePublicClient();
  const [events, setEvents] = useState<PactEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!client || pactId === undefined || !pactAddress) return;
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);

    (async () => {
      try {
        const logsPerKind = await Promise.all(
          HISTORY_EVENTS.map((eventName) =>
            client.getContractEvents({
              address: pactAddress,
              abi: PyrisPactAbi,
              eventName,
              args: { pactId },
              fromBlock: DEPLOY_BLOCK,
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
  }, [client, pactId, tick]);

  return { events, isLoading, isError, refetch: () => setTick((t) => t + 1) };
}

/**
 * Hook to retrieve all pacts, filtered by client/vendor role
 */
export function usePacts(userAddress?: Address) {
  const { data: rawPacts, refetch, isLoading, isError } = useReadContract({
    address: pactAddress,
    abi: PyrisPactAbi,
    functionName: "getPacts",
    args: [0n, 50n],
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
  const { data, refetch } = useReadContract({
    address: pactAddress,
    abi: PyrisPactAbi,
    functionName: "proposals",
    args: [pactId ?? 0n],
    query: { enabled: !!pactAddress && pactId !== undefined },
  });
  const [proposer, vendorShareBps] = (data ?? [zeroAddress, 0]) as readonly [Address, number];
  return { proposer: proposer === zeroAddress ? undefined : proposer, vendorShareBps, refetch };
}

/** Payout owed to the connected wallet after a push transfer failed. */
export function usePendingWithdrawal(account: Address | undefined) {
  const { data, refetch } = useReadContract({
    address: pactAddress,
    abi: PyrisPactAbi,
    functionName: "pendingWithdrawals",
    args: [account ?? zeroAddress],
    query: { enabled: !!pactAddress && !!account },
  });
  return { amount: (data as bigint | undefined) ?? 0n, refetch };
}

/**
 * Hook for executing Pact escrow actions
 */
export function usePactMutations() {
  const { writeContractAsync: rawWrite, data: hash, isPending } = useWriteContract();
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  /**
   * Every write goes through here so the wallet is on Arc first. A second
   * injected wallet (Rabby, Phantom) often sits on Ethereum mainnet; without
   * this the transaction would be sent there and fail for lack of ETH.
   */
  const writeContractAsync = async (opts: Record<string, unknown>) => {
    if (chainId !== pyrisChain.id) {
      await switchChainAsync({ chainId: pyrisChain.id });
    }
    return rawWrite({ ...opts, chainId: pyrisChain.id });
  };

  /** Native mode: the escrowed amount travels as msg.value. arbiter may be the zero address. */
  const createPact = async (
    vendor: Address,
    amount: bigint,
    deadlineSeconds: number,
    title: string,
    description: string,
    arbiter: Address = zeroAddress
  ) => {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
    return await writeContractAsync({
      address: pactAddress,
      abi: PyrisPactAbi,
      functionName: "createPact",
      args: [vendor, arbiter, amount, deadline, title, description],
      value: amount,
    });
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
    isPending: isPending || isWaiting,
    isSuccess,
    hash,
  };
}
