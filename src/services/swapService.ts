import { AbiCoder, ZeroAddress } from "ethers";
import { universalRouterAbi, permit2Abi } from "../abis";
import { useTokenStore } from "../store/token";
import type { SignTypedDataMutateAsync, WriteContractMutateAsync } from "wagmi/query";
import type { Config } from "wagmi";
import { readContract } from "wagmi/actions"; // Added for fetching nonce

// --- Addresses & constants (Sepolia) ---
const UNIVERSAL_ROUTER_ADDRESS =
  "0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b" as const;
const PERMIT2_ADDRESS =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const ETH_ADDRESS = ZeroAddress as `0x${string}`;
const POOL_FEE = 10_000; // 1% fee tier
const TICK_SPACING = 200;

const abi = AbiCoder.defaultAbiCoder();

// Helper to convert an ERC-20 address to bytes32 Currency (Uniswap v4 type)
const toCurrency = (addr: string): `0x${string}` =>
  ("0x" + addr.toLowerCase().slice(2).padStart(64, "0")) as `0x${string}`;

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
  config: Config; // Add config here
}

export async function swapEthToUsdt({
  amountInWei,
  minOut,
  writeContractAsync,
}: EthToUsdtParams): Promise<`0x${string}`> {
  const USDT_ADDRESS = useTokenStore.getState().usdtAddress;

  // Determine pool ordering
  const tokenIn = ETH_ADDRESS;
  const tokenOut = USDT_ADDRESS;
  const [currency0, currency1] =
    tokenIn.toLowerCase() < tokenOut.toLowerCase()
      ? [tokenIn, tokenOut]
      : [tokenOut, tokenIn];
  const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

  const currency0Bytes = toCurrency(currency0);
  const currency1Bytes = toCurrency(currency1);

  // V4 router inner actions (SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL)
  const actionsHex = "0x060c0f" as const;

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

  const deadlineBn: bigint = BigInt(Math.floor(Date.now() / 1000) + 3600);

  return writeContractAsync({
    address: UNIVERSAL_ROUTER_ADDRESS,
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commandsHex, inputs, deadlineBn],
    value: amountInWei,
  });
}

export async function swapUsdtToEth({
  amountIn,
  minOut,
  chainId,
  walletAddress,
  writeContractAsync,
  signTypedDataAsync,
  config, // Add config here
}: UsdtToEthParams): Promise<`0x${string}`> {
  const USDT_ADDRESS = useTokenStore.getState().usdtAddress;

  // 1. Fetch nonce from Permit2 contract
  const allowanceData = await readContract(config, { // Use the passed config
    address: PERMIT2_ADDRESS,
    abi: permit2Abi,
    functionName: "allowance",
    args: [walletAddress, USDT_ADDRESS, UNIVERSAL_ROUTER_ADDRESS],
    chainId: chainId, // Ensure chainId is passed if required by your wagmi setup for readContract
  });
  const fetchedNonce = BigInt(allowanceData[2]); // Nonce is the third element (uint48)

  // 2. Prepare and sign Permit2 message
  const permitDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

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

  // Ensure amountIn fits uint160 and deadlines/nonce fit their respective uint types
  // This should ideally be validated before calling this function or handled here.
  // For now, direct conversion is assumed valid based on typical usage.
  const permitValue = {
    details: {
      token: USDT_ADDRESS,
      amount: amountIn, // wagmi will handle BigInt to uint160 if types match
      expiration: Number(permitDeadline), // Convert to number as expected by PermitSingle.details.expiration
      nonce: Number(fetchedNonce),       // Convert to number as expected by PermitSingle.details.nonce to uint48
    },
    spender: UNIVERSAL_ROUTER_ADDRESS,
    sigDeadline: permitDeadline, // For PermitSingle, this is uint256
  } as const;

  const permitSig = await signTypedDataAsync({
    domain: permitDomain,
    types: permitTypes,
    primaryType: "PermitSingle",
    message: permitValue, // Use the new structure for the message
  });

  // 3. Prepare permitInput for the router
  // Universal Router expects two sequential parameters: PermitSingle then signature bytes.
  const permitSingleTuple = [
    [USDT_ADDRESS, amountIn, permitDeadline, fetchedNonce], // PermitDetails (token, amount, expiration, nonce)
    UNIVERSAL_ROUTER_ADDRESS, // spender
    permitDeadline, // sigDeadline
  ] as const;

  const permitInput = abi.encode(
    ["((address,uint160,uint48,uint48),address,uint256)", "bytes"],
    [permitSingleTuple, permitSig]
  );

  // Build V4 swap actions (same as above but opposite token direction)
  const tokenIn = USDT_ADDRESS;
  const tokenOut = ETH_ADDRESS;
  const [currency0, currency1] =
    tokenIn.toLowerCase() < tokenOut.toLowerCase()
      ? [tokenIn, tokenOut]
      : [tokenOut, tokenIn];
  const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

  const currency0Bytes = toCurrency(currency0);
  const currency1Bytes = toCurrency(currency1);

  const actionsHex = "0x060c0f" as const;

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

  // Router must settle the debt on the *input* token (USDT) and then take the
  // credit on the *output* token (WETH). Using currency0/1 here is wrong if the
  // pool ordering differs from actual swap direction.
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

  // Parameters for UNWRAP_WETH: recipient and minimum amount out (0 = accept any)
  const unwrapInput = abi.encode(
    ["address", "uint256"],
    [walletAddress, minOut]
  );

  const encodedActions = abi.encode(
    ["bytes", "bytes[]"],
    [actionsHex, [swapInput, settleAllInput, takeAllInput]]
  );

  const commandsHex = "0x0a100c" as `0x${string}`; // PERMIT + V4_SWAP + UNWRAP_WETH
  const inputs = [permitInput as `0x${string}`, encodedActions as `0x${string}`, unwrapInput as `0x${string}`] as [
    `0x${string}`,
    `0x${string}`,
    `0x${string}`,
  ];

  const txDeadline: bigint = BigInt(Math.floor(Date.now() / 1000) + 3600);

  return writeContractAsync({
    address: UNIVERSAL_ROUTER_ADDRESS,
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commandsHex, inputs, txDeadline],
    value: 0n,
  });
}
