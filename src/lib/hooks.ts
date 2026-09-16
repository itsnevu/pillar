"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Address } from "viem";
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
      } else if (p.status === PactStatus.RELEASED) {
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

/**
 * Hook for executing Pact escrow actions
 */
export function usePactMutations() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createPact = async (
    vendor: Address,
    amount: bigint,
    deadlineSeconds: number,
    title: string,
    description: string
  ) => {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
    return await writeContractAsync({
      address: pactAddress,
      abi: PyrisPactAbi,
      functionName: "createPact",
      args: [vendor, amount, deadline, title, description],
      value: amount,
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
    submitWork,
    releaseFunds,
    refund,
    isPending: isPending || isWaiting,
    isSuccess,
    hash,
  };
}
