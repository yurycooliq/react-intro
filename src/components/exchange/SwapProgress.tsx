import { useEffect, useState, useRef } from "react";
import { Card, Link, Text, Button, List } from "@chakra-ui/react";
import {
  LuCircleCheck,
  LuCircleDashed,
  LuCircleX,
  LuRepeat,
} from "react-icons/lu";
import { ZeroAddress, AbiCoder } from "ethers";

import {
  useAccount,
  useWriteContract,
  useSignTypedData,
  useChainId,
  usePublicClient,
} from "wagmi";

import { useTokenStore } from "../../store/token";
import universalRouterAbi from "../../lib/abis/universalRouter";
const USDT_ADDRESS = useTokenStore.getState().usdtAddress;

// --- Uniswap v4 constants (Sepolia) ---
const UNIVERSAL_ROUTER_ADDRESS =
  "0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b" as const;
const ETH_ADDRESS = ZeroAddress as `0x${string}`;
const POOL_FEE = 10000;
const TICK_SPACING = 200;

export type Currency = "ETH" | "USDT";

interface SwapProgressProps {
  currency: Currency;
  amount: string;
  minOut: string;
  onError: (msg: string) => void;
}

export default function SwapProgress({
  currency,
  amount,
  minOut,
  onError,
}: SwapProgressProps) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const hasStarted = useRef(false);

  interface LogEntry {
    text: string;
    variant: "info" | "success" | "error";
    hash?: `0x${string}`;
  }

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    const pushLog = (entry: LogEntry) => setLogs((prev) => [...prev, entry]);
    (async () => {
      if (!address || !publicClient) {
        onError("Wallet not connected");
        return;
      }
      try {
        if (currency === "ETH") {
          // --- Build ETH → USDT swap using Universal Router ---
          pushLog({ text: "Building swap", variant: "info" });

          const value = BigInt(amount);
          const deadline: bigint = BigInt(Math.floor(Date.now() / 1000) + 3600); // +1 hour

          // Determine pool key ordering and swap direction
          const tokenIn = ETH_ADDRESS;
          const tokenOut = USDT_ADDRESS;
          const [currency0, currency1] =
            tokenIn.toLowerCase() < tokenOut.toLowerCase()
              ? [tokenIn, tokenOut]
              : [tokenOut, tokenIn];
          const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

          const amountInStr = value.toString();
          const abi = AbiCoder.defaultAbiCoder();
          const actionsHex = "0x060c0f";

          // 1) SWAP_EXACT_IN_SINGLE input
          const swapInput = abi.encode(
            [
              "((address,address,uint24,int24,address),bool,uint128,uint128,bytes)",
            ],
            [
              [
                [currency0, currency1, POOL_FEE, TICK_SPACING, ZeroAddress],
                zeroForOne,
                amountInStr,
                minOut,
                "0x",
              ],
            ]
          );

          // 2) SETTLE_ALL input
          const settleAllInput = abi.encode(
            ["address", "uint256"],
            [currency0, amountInStr]
          );

          // 3) TAKE_ALL input
          const takeAllInput = abi.encode(
            ["address", "uint256"],
            [currency1, "0"]
          );

          const encodedActions = abi.encode(
            ["bytes", "bytes[]"],
            [actionsHex, [swapInput, settleAllInput, takeAllInput]]
          );

          // Root-level command: 0x10 (V4_SWAP_EXACT_IN)
          const commandsHex = "0x10" as `0x${string}`;
          const inputs = [encodedActions as `0x${string}`] as [`0x${string}`];

          const swapHash = await writeContractAsync({
            address: UNIVERSAL_ROUTER_ADDRESS,
            abi: universalRouterAbi,
            functionName: "execute",
            args: [commandsHex, inputs, deadline],
            value,
          });

          pushLog({
            text: "Swap transaction sent",
            variant: "info",
            hash: swapHash,
          });
          pushLog({ text: "Swap complete", variant: "success" });
        } else {
          pushLog({
            text: "Checking token spending allowance",
            variant: "info",
          });
          const value = BigInt(amount);

          const deadline: bigint = BigInt(Math.floor(Date.now() / 1000) + 3600); // +1 hour

          // Build v4 swap planners
          const amountInStr = value.toString();
          const tokenIn = USDT_ADDRESS;
          const tokenOut = ETH_ADDRESS;
          const [currency0, currency1] =
            tokenIn.toLowerCase() < tokenOut.toLowerCase()
              ? [tokenIn, tokenOut]
              : [tokenOut, tokenIn];
          const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

          // --- Manually encode Uniswap v4 router actions (no sdk) ---
          const abi = AbiCoder.defaultAbiCoder();

          // action bytes sequence inside V4 router: SWAP_EXACT_IN_SINGLE (0x06), SETTLE_ALL (0x0c), TAKE_ALL (0x0f)
          const actionsHex = "0x060c0f";

          // ---- Permit2 struct + signature ----
          const PERMIT2_ADDRESS =
            "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
          const permitNonce = 0n;

          const permitDomain = {
            name: "Permit2",
            chainId,
            verifyingContract: PERMIT2_ADDRESS,
          } as const;

          const permitTypes = {
            TokenPermissions: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            PermitSingle: [
              { name: "permitted", type: "TokenPermissions" },
              { name: "spender", type: "address" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" },
            ],
          } as const;

          const permitMessage = {
            permitted: { token: USDT_ADDRESS, amount: value },
            spender: UNIVERSAL_ROUTER_ADDRESS,
            nonce: permitNonce,
            deadline,
          } as const;

          const permitSig = await signTypedDataAsync({
            domain: permitDomain,
            types: permitTypes,
            primaryType: "PermitSingle",
            message: permitMessage,
          });

          // 1) PERMIT2 input – Universal Router format (TokenPermissions + v,r,s)
          const r = `0x${permitSig.slice(2, 66)}` as `0x${string}`;
          const s = `0x${permitSig.slice(66, 130)}` as `0x${string}`;
          const v = Number("0x" + permitSig.slice(130, 132));

          const permitInput = abi.encode(
            [
              "(address,uint160)", // TokenPermissions
              "address", // spender
              "uint256", // nonce
              "uint256", // deadline
              "uint8", // v
              "bytes32", // r
              "bytes32", // s
            ],
            [
              [USDT_ADDRESS, value],
              UNIVERSAL_ROUTER_ADDRESS,
              permitNonce,
              deadline,
              v,
              r,
              s,
            ]
          );

          // 2) SWAP_EXACT_IN_SINGLE input
          const swapInput = abi.encode(
            [
              "((address,address,uint24,int24,address),bool,uint128,uint128,bytes)",
            ],
            [
              [
                [currency0, currency1, POOL_FEE, TICK_SPACING, ZeroAddress],
                zeroForOne,
                amountInStr,
                minOut,
                "0x",
              ],
            ]
          );

          // 3) SETTLE_ALL input
          const settleAllInput = abi.encode(
            ["address", "uint256"],
            [currency0, amountInStr]
          );

          // 4) TAKE_ALL input
          const takeAllInput = abi.encode(
            ["address", "uint256"],
            [currency1, "0"]
          );

          const encodedActions = abi.encode(
            ["bytes", "bytes[]"],
            [actionsHex, [swapInput, settleAllInput, takeAllInput]]
          );

          // Root-level commands: 0x02 (PERMIT2_PERMIT) + 0x10 (V4_SWAP_EXACT_IN)
          const commandsHex = "0x0210" as `0x${string}`;
          const inputs = [
            permitInput as `0x${string}`,
            encodedActions as `0x${string}`,
          ] as [`0x${string}`, `0x${string}`];

          const deadlineBn: bigint = BigInt(
            Math.floor(Date.now() / 1000) + 3600
          );

          const swapHash = await writeContractAsync({
            address: UNIVERSAL_ROUTER_ADDRESS,
            abi: universalRouterAbi,
            functionName: "execute",
            args: [commandsHex, inputs, deadlineBn],
            value: 0n,
          });
          pushLog({
            text: "Swap transaction sent",
            variant: "info",
            hash: swapHash,
          });

          pushLog({ text: "Swap complete", variant: "success" });
        }
      } catch (err) {
        const msg =
          typeof err === "object" && err !== null
            ? (err as { shortMessage?: string; message?: string })
                .shortMessage ??
              (err as { shortMessage?: string; message?: string }).message ??
              "Transaction rejected"
            : "Transaction rejected";
        onError(msg);
      }
    })();
  }, [
    address,
    amount,
    currency,
    minOut,
    writeContractAsync,
    chainId,
    signTypedDataAsync,
    publicClient,
    onError,
  ]);

  const explorer = (hash: `0x${string}`) =>
    `https://sepolia.etherscan.io/tx/${hash}`;

  return (
    <Card.Root w="360px" rounded="xl" shadow="lg" color="white">
      <Card.Body>
        <List.Root gap="2" variant="plain" align="center">
          {logs.map((log, index) => {
            const last = index === logs.length - 1;
            const color =
              log.variant === "error"
                ? "red.500"
                : log.variant === "info" && last
                ? "gray.400"
                : "green.500";
            return (
              <List.Item key={index}>
                <List.Indicator asChild color={color}>
                  {log.variant === "error" ? (
                    <LuCircleX />
                  ) : log.variant === "info" && last ? (
                    <LuCircleDashed />
                  ) : (
                    <LuCircleCheck />
                  )}
                </List.Indicator>
                <Text as="span">
                  {log.text}{" "}
                  {log.hash && (
                    <Link
                      href={explorer(log.hash)}
                      target="_blank"
                      color="blue.500"
                    >
                      {`${log.hash.slice(0, 10)}...`}
                    </Link>
                  )}
                </Text>
              </List.Item>
            );
          })}
        </List.Root>
        {logs.length > 0 && logs[logs.length - 1].variant !== "info" && (
          <Button
            colorPalette={"blue"}
            variant="solid"
            mt={4}
            onClick={() => window.location.reload()}
          >
            <LuRepeat /> Make another swap
          </Button>
        )}
      </Card.Body>
    </Card.Root>
  );
}
