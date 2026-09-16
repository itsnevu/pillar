// Ambient declarations for React, Next, Node, Viem, and Wagmi when node_modules is not installed locally

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  type Element = any;
}

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    type Element = any;
  }
  type ReactNode = any;
  type ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> = any;
  type ComponentType<P = {}> = any;
  type JSXElementConstructor<P> = any;
  type FormEvent<T = any> = any;
  type ChangeEvent<T = any> = any;
  function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  function useRef<T>(initialValue?: T): { current: T };
  function useId(): string;
  function useSyncExternalStore<T>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T
  ): T;
  function createElement(type: any, props?: any, ...children: any[]): any;
}

type LayoutProps<T = any> = {
  children: any;
  params?: Promise<any>;
};

type PageProps<T = any> = {
  params: Promise<any>;
  searchParams?: Promise<any>;
};

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
  interface Process {
    cwd: () => string;
    env: ProcessEnv;
  }
}

declare var process: NodeJS.Process;

declare module "react" {
  export = React;
  export as namespace React;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module "react/jsx-dev-runtime" {
  export const jsxDEV: any;
  export const Fragment: any;
}

declare module "next" {
  export type Metadata = any;
  export type NextConfig = any;
  export type MetadataRoute = any;
  export namespace MetadataRoute {
    export type Robots = any;
    export type Sitemap = any;
  }
}

declare module "next/link" {
  const Link: any;
  export default Link;
}

declare module "next/navigation" {
  export const usePathname: () => string;
  export const useSearchParams: () => any;
  export const useRouter: () => any;
  export const notFound: () => never;
}

declare module "next/font/google" {
  export const Libre_Caslon_Text: (opts: any) => any;
}

declare module "next/og" {
  export class ImageResponse {
    constructor(element: any, options?: any);
  }
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: string): string;
  export function readFileSync(path: string, options?: any): string | Buffer;
  const fs: {
    readFileSync: (path: string, encoding: string) => string;
    [key: string]: any;
  };
  export default fs;
}

declare module "fs" {
  export function readFileSync(path: string, encoding: string): string;
  export function readFileSync(path: string, options?: any): string | Buffer;
  const fs: {
    readFileSync: (path: string, encoding: string) => string;
    [key: string]: any;
  };
  export default fs;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  const path: {
    join: (...paths: string[]) => string;
    resolve: (...paths: string[]) => string;
    [key: string]: any;
  };
  export default path;
}

declare module "path" {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  const path: {
    join: (...paths: string[]) => string;
    resolve: (...paths: string[]) => string;
    [key: string]: any;
  };
  export default path;
}

declare module "viem" {
  export type Address = `0x${string}`;
  export type Hash = `0x${string}`;
  export const isAddress: (val: string) => boolean;
  export const parseUnits: (val: string, decimals: number) => bigint;
  export const formatUnits: (val: bigint, decimals: number) => string;
  export const defineChain: (chain: any) => any;
  export const zeroAddress: Address;
}

declare module "wagmi" {
  export const WagmiProvider: any;
  export const createConfig: (opts: any) => any;
  export const http: (url?: string) => any;
  export const useAccount: () => { address?: `0x${string}`; isConnected: boolean; chainId?: number };
  export const useConnect: () => { connect: (opts: any) => void; connectors: any[]; isPending: boolean; error?: any };
  export const useDisconnect: () => { disconnect: () => void };
  export const useSwitchChain: () => { switchChain: (opts: any) => void };
  export const useConfig: () => any;
  export const useReadContract: (opts: any) => any;
  export const useReadContracts: (opts: any) => any;
  export const useWriteContract: () => {
    writeContractAsync: (opts: any) => Promise<any>;
    data?: any;
    isPending: boolean;
  };
  export const useWaitForTransactionReceipt: (opts: any) => {
    isLoading: boolean;
    isSuccess: boolean;
  };
}

declare module "wagmi/actions" {
  export const waitForTransactionReceipt: (config: any, opts: any) => Promise<any>;
}

declare module "wagmi/connectors" {
  export const injected: () => any;
}
