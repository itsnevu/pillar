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

// Initial demonstration data for seamless preview before contracts are deployed
const DEMO_PACTS: Pact[] = [
  {
    id: 1n,
    client: "0x1111111111111111111111111111111111111111" as Address,
    vendor: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address,
    amount: 3500_000000n, // $3,500 USDC
    deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 5),
    status: PactStatus.SUBMITTED,
    title: "Arc Chain Smart Contract Integration",
    description: "Write PyrisEscrow.sol with milestone release & comprehensive Foundry test coverage.",
    submissionNote: "https://github.com/itsnevu/pyris/pull/14",
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3),
    submittedAt: BigInt(Math.floor(Date.now() / 1000) - 3600 * 4),
  },
  {
    id: 2n,
    client: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address,
    vendor: "0x2222222222222222222222222222222222222222" as Address,
    amount: 1800_000000n, // $1,800 USDC
    deadline: BigInt(Math.floor(Date.now() / 1000) + 86400 * 12),
    status: PactStatus.FUNDED,
    title: "Editorial Design & Brand Guidelines",
    description: "Produce typography tokens, vector column marks, and responsive Figma components.",
    submissionNote: "",
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400),
    submittedAt: 0n,
  },
  {
    id: 3n,
    client: "0x3333333333333333333333333333333333333333" as Address,
    vendor: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address,
    amount: 5000_000000n, // $5,000 USDC
    deadline: BigInt(Math.floor(Date.now() / 1000) - 86400 * 2),
    status: PactStatus.RELEASED,
    title: "Institutional Custody Security Audit",
    description: "Full threat modeling and verification of multi-sig settlement flows.",
    submissionNote: "https://audit.pyris.tech/reports/q3.pdf",
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 14),
    submittedAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3),
  },
];

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
    if (rawPacts && Array.isArray(rawPacts) && rawPacts.length > 0) {
      return rawPacts as Pact[];
    }
    return DEMO_PACTS;
  }, [rawPacts]);

  const outgoingPacts = useMemo(() => {
    if (!userAddress) return pacts;
    const filtered = pacts.filter(
      (p) => p.client.toLowerCase() === userAddress.toLowerCase()
    );
    return filtered.length > 0 ? filtered : pacts;
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
