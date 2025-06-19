import type { Address, PublicClient } from "viem";
import type { Config } from "wagmi";
import type { SignTypedDataMutateAsync, WriteContractMutateAsync } from "wagmi/query";

export interface QuoteParams {
  publicClient: PublicClient;
  tokenInAddress: Address;
  tokenOutAddress: Address;
  amount: bigint;
  sellDecimals: number;
  buyDecimals: number;
  quoteType: "exactIn" | "exactOut";
}

export interface QuoteResult {
  quotedAmount: bigint;
  slippage: number | null;
}

export interface CommonSwapDeps {
  writeContractAsync: WriteContractMutateAsync<Config, unknown>
}

export interface EthToUsdtParams extends CommonSwapDeps {
  amountInWei: bigint;
  minOut: bigint;
  chainId?: number;
}

export interface UsdtToEthParams extends CommonSwapDeps {
  amountIn: bigint;
  minOut: bigint;
  chainId: number;
  walletAddress: `0x${string}`;
  signTypedDataAsync: SignTypedDataMutateAsync<unknown>;
  config: Config;
}

export interface BalancesParams {
  address: Address;
  publicClient: PublicClient;
}

export interface BalancesResult {
  ethBalance?: bigint;
  usdtBalance?: bigint;
}

export type Currency = "ETH" | "USDT";

export interface ExchangeFormProps {
  onStart: (currency: Currency, amount: string, minOut: string) => void;
}

export interface SwapProgressProps {
  currency: Currency;
  amount: string;
  minOut: string;
}

export interface LogEntry {
  text: string;
  variant: "info" | "success" | "error";
  hash?: `0x${string}`;
}

export interface TokenAmountFieldProps {
  /** Current value of the input in base (integer) units */
  value: bigint
  /** Called every time a **valid** value is entered */
  onChange: (value: bigint) => void
  /** Token symbol to show as the right-hand addon, e.g. ETH */
  tokenSymbol: string
  /** Number of fraction digits – defaults to 18 */
  decimals?: number
  /** Wallet balance – used for copy-to-input and max-value validation  */
  onValidChange?: (valid: boolean) => void
  balance?: bigint
  /** true → buying mode (label 'Buy', balance non-clickable); false → selling mode */
  buyMode?: boolean
}
