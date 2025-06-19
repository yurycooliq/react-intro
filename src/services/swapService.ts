/**
 * Swap Service
 * ------------
 * A collection of low-level helpers that build calldata for Uniswap v4’s
 * Universal Router on Sepolia.  The service exposes two convenience functions:
 *
 * • `swapEthToUsdt` — wraps ETH → USDT exact-in flow.
 * • `swapUsdtToEth` — wraps USDT → ETH exact-in flow with Permit2 approval.
 *
 * The helpers are **framework-agnostic** — they do NOT rely on React hooks and
 * can be consumed from any environment.  They keep the dApp logic clean by
 * encapsulating all ABI encoding intricacies in one place.
 */
import { AbiCoder, ZeroAddress } from "ethers";
import { universalRouterAbi, permit2Abi } from "../abis";
import { readContract } from "wagmi/actions"; // Added for fetching nonce
import {
  UNIVERSAL_ROUTER_ADDRESS,
  PERMIT2_ADDRESS,
  ETH_ADDRESS,
  POOL_FEE,
  TICK_SPACING,
  USDT_ADDRESS,
} from "../config/blockchain";
import type { EthToUsdtParams, UsdtToEthParams } from "../interfaces";

/**
 * V4 router inner actions (SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL)
 */
const actionsHex = "0x060c0f" as const;

/**
 * AbiCoder instance for encoding calldata.
 */
export const abi = AbiCoder.defaultAbiCoder();

/**
 * Converts an ERC-20 address into the 32-byte `Currency` type used by Uniswap v4.
 * Essentially left-pads the lowercase address with zeros (after the `0x` prefix)
 * so that the result fits into 32 bytes.
 */
export const toCurrency = (addr: string): `0x${string}` =>
  ("0x" + addr.toLowerCase().slice(2).padStart(64, "0")) as `0x${string}`;

/**
 * Returns the deadline for a tx execution. 1 hour from now.
 */
export const getDeadline = (): bigint =>
  BigInt(Math.floor(Date.now() / 1000) + 3600);

/**
 * Executes an **exact-in** swap of native ETH to USDT via Universal Router.
 *
 * Flow:
 *  1. Build router inner actions (`SWAP_EXACT_IN_SINGLE`, `SETTLE_ALL`, `TAKE_ALL`).
 *  2. ABI-encode them, wrap into a single `V4_SWAP` command.
 *  3. Submit `execute` tx via `writeContractAsync`.
 *
 * Slippage protection is achieved on-chain by passing `minOut`; if the pool
 * cannot satisfy the quote the router reverts.
 *
 * @param amountInWei        Raw ETH amount being sold (18 decimals).
 * @param minOut             Minimum USDT amount expected (to protect from slippage).
 * @param writeContractAsync wagmi `writeContractAsync` mutation.
 * @returns Transaction hash of the submitted router tx.
 */
export async function swapEthToUsdt({
  amountInWei,
  minOut,
  writeContractAsync,
}: EthToUsdtParams): Promise<`0x${string}`> {
  const tokenIn = ETH_ADDRESS;
  const tokenOut = USDT_ADDRESS;
  const [currency0, currency1] =
    tokenIn.toLowerCase() < tokenOut.toLowerCase()
      ? [tokenIn, tokenOut]
      : [tokenOut, tokenIn];
  const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

  const currency0Bytes = toCurrency(currency0);
  const currency1Bytes = toCurrency(currency1);

  // 1) swap
  const swapInput = abi.encode(
    ["((bytes32,bytes32,uint24,int24,address),bool,uint128,uint128,bytes)"],
    [
      [
        [currency0Bytes, currency1Bytes, POOL_FEE, TICK_SPACING, ZeroAddress],
        zeroForOne,
        amountInWei.toString(),
        minOut.toString(),
        "0x",
      ],
    ]
  );

  // 2) settle all
  const settleAllInput = abi.encode(
    ["bytes32", "uint256"],
    [currency0Bytes, amountInWei.toString()]
  );

  // 3) take all
  const takeAllInput = abi.encode(
    ["bytes32", "uint256"],
    [currency1Bytes, minOut.toString()]
  );

  const encodedActions = abi.encode(
    ["bytes", "bytes[]"],
    [actionsHex, [swapInput, settleAllInput, takeAllInput]]
  );

  const commandsHex = "0x10" as `0x${string}`; // V4_SWAP
  const inputs = [encodedActions as `0x${string}`] as [`0x${string}`];

  const deadlineBn = getDeadline();

  return writeContractAsync({
    address: UNIVERSAL_ROUTER_ADDRESS,
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commandsHex, inputs, deadlineBn],
    value: amountInWei,
  });
}

/**
 * Executes an **exact-in** USDT → ETH swap using Permit2 for token allowance.
 *
 * Steps:
 *  1. Sign Uniswap’s Permit2 EIP-712 permit (no gas, off-chain).
 *  2. Encode router actions (PERMIT2_PERMIT, V4_SWAP + helpers).
 *  3. Submit `execute` transaction with combined commands.
 *
 * @param amountIn          Raw USDT amount being sold.
 * @param minOut            Minimum ETH to receive.
 * @param walletAddress     Trader’s wallet (used for Permit2 nonce).
 * @param chainId           Optional, overrides chain when signing permit.
 * @param signTypedDataAsync wagmi mutate for EIP-712 signing.
 * @param writeContractAsync wagmi mutate for sending tx.
 * @returns Transaction hash once Universal Router tx is broadcast.
 */
export async function swapUsdtToEth({
  amountIn,
  minOut,
  chainId,
  walletAddress,
  writeContractAsync,
  signTypedDataAsync,
  config,
}: UsdtToEthParams): Promise<`0x${string}`> {
  // 1. Fetch nonce from Permit2 contract
  const allowanceData = await readContract(config, {
    address: PERMIT2_ADDRESS,
    abi: permit2Abi,
    functionName: "allowance",
    args: [walletAddress, USDT_ADDRESS, UNIVERSAL_ROUTER_ADDRESS],
    chainId: chainId,
  });
  const fetchedNonce = BigInt(allowanceData[2]); // Nonce is the third element (uint48)

  // 2. Prepare and sign Permit2 message
  const permitDeadline = getDeadline();

  const permitDomain = {
    name: "Permit2",
    chainId: BigInt(chainId),
    verifyingContract: PERMIT2_ADDRESS,
  } as const;

  const permitTypes = {
    PermitDetails: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
    PermitSingle: [
      { name: "details", type: "PermitDetails" },
      { name: "spender", type: "address" },
      { name: "sigDeadline", type: "uint256" },
    ],
  } as const;

  const permitValue = {
    details: {
      token: USDT_ADDRESS,
      amount: amountIn,
      expiration: Number(permitDeadline),
      nonce: Number(fetchedNonce),
    },
    spender: UNIVERSAL_ROUTER_ADDRESS,
    sigDeadline: permitDeadline,
  } as const;

  const permitSig = await signTypedDataAsync({
    domain: permitDomain,
    types: permitTypes,
    primaryType: "PermitSingle",
    message: permitValue,
  });

  const permitSingleTuple = [
    [USDT_ADDRESS, amountIn, permitDeadline, fetchedNonce],
    UNIVERSAL_ROUTER_ADDRESS,
    permitDeadline,
  ] as const;

  const permitInput = abi.encode(
    ["((address,uint160,uint48,uint48),address,uint256)", "bytes"],
    [permitSingleTuple, permitSig]
  );

  const tokenIn = USDT_ADDRESS;
  const tokenOut = ETH_ADDRESS;
  const [currency0, currency1] =
    tokenIn.toLowerCase() < tokenOut.toLowerCase()
      ? [tokenIn, tokenOut]
      : [tokenOut, tokenIn];
  const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

  const currency0Bytes = toCurrency(currency0);
  const currency1Bytes = toCurrency(currency1);

  const swapInput = abi.encode(
    ["((bytes32,bytes32,uint24,int24,address),bool,uint128,uint128,bytes)"],
    [
      [
        [currency0Bytes, currency1Bytes, POOL_FEE, TICK_SPACING, ZeroAddress],
        zeroForOne,
        amountIn.toString(),
        minOut.toString(),
        "0x",
      ],
    ]
  );

  const tokenInBytes = toCurrency(tokenIn);
  const tokenOutBytes = toCurrency(tokenOut);

  const settleAllInput = abi.encode(
    ["bytes32", "uint256"],
    [tokenInBytes, amountIn.toString()]
  );
  const takeAllInput = abi.encode(
    ["bytes32", "uint256"],
    [tokenOutBytes, minOut.toString()]
  );

  const encodedActions = abi.encode(
    ["bytes", "bytes[]"],
    [actionsHex, [swapInput, settleAllInput, takeAllInput]]
  );

  const commandsHex = "0x0a10" as `0x${string}`;
  const inputs = [
    permitInput as `0x${string}`,
    encodedActions as `0x${string}`,
  ] as [`0x${string}`, `0x${string}`];

  const txDeadline = getDeadline();

  return writeContractAsync({
    address: UNIVERSAL_ROUTER_ADDRESS,
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commandsHex, inputs, txDeadline],
    value: 0n,
  });
}
