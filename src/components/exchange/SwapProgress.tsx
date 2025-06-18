import { useEffect, useState, useRef } from "react";
import { Card, Link, Text, Button, List } from "@chakra-ui/react";
import {
  LuCircleCheck,
  LuCircleDashed,
  LuCircleX,
  LuRepeat,
} from "react-icons/lu";
import { swapEthToUsdt, swapUsdtToEth } from "../../services/swapService";
import {
  useAccount,
  useWriteContract,
  useSignTypedData,
  useChainId,
  usePublicClient,
} from "wagmi";

export type Currency = "ETH" | "USDT";

interface SwapProgressProps {
  currency: Currency;
  amount: string;
  minOut: string;
}

interface LogEntry {
  text: string;
  variant: "info" | "success" | "error";
  hash?: `0x${string}`;
}

export default function SwapProgress({
  currency,
  amount,
  minOut,
}: SwapProgressProps) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    const pushLog = (entry: LogEntry) => setLogs((prev) => [...prev, entry]);
    (async () => {
      if (!address || !publicClient) {
        pushLog({ text: "Wallet not connected", variant: "error" });
        return;
      }
      pushLog({ text: "Building swap", variant: "info" });
      if (currency === "ETH") {
        try {
          const txHash = await swapEthToUsdt({
            amountInWei: BigInt(amount),
            minOut: BigInt(minOut),
            chainId,
            writeContractAsync,
          });
          pushLog({ text: "Swap tx sent", variant: "info", hash: txHash });
        } catch (err) {
          pushLog({ text: (err as Error).message, variant: "error" });
          return;
        }
      } else {
        try {
          const txHash = await swapUsdtToEth({
            amountIn: BigInt(amount),
            minOut: BigInt(minOut),
            chainId,
            walletAddress: address,
            writeContractAsync,
            signTypedDataAsync,
          });
          pushLog({ text: "Swap tx sent", variant: "info", hash: txHash });
        } catch (err) {
          pushLog({ text: (err as Error).message, variant: "error" });
          return;
        }
      }
      pushLog({ text: "Swap complete", variant: "success" });
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
