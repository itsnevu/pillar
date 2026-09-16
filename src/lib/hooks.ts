"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { zeroAddress, type Address } from "viem";
import { PyrisPactAbi, addresses, type Pact, PactStatus } from "./contracts";

const noop = () => () => {};
/** true after hydration, false during SSR */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

const pactAddress = addresses.pyrisPact as Address;

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
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash });

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
