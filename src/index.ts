import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import checkValidHexadecimal from "./utils/type-check.js";

const API_BASE_URL = "https://docs-demo.quiknode.pro"; // ETH
// const API_BASE_URL = "https://rpc.soniclabs.com"; // SONIC

const USER_AGENT = "ftm-mcp-server/1.0";

// Helper function for making JSON-RPC requests
async function makeEthRpcRequest<T>(
    method: string,
    params: any[],
    id: number = 1
): Promise<T | null> {
    try {
        const response = await fetch(API_BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method,
                params,
                id: id,
            }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json()) as T;
    } catch (error) {
        console.error("Error making ETH RPC request:", error);
        return null;
    }
}

// Create server instance
const server = new McpServer({
    name: "ftm",
    version: "1.0.0",
});

function formatEth(wei: bigint): string {
    return (
        (Number(wei) / 1e18).toLocaleString(undefined, {
            maximumFractionDigits: 8,
        }) + " ETH"
    );
}

function formatGwei(wei: bigint): string {
    return (
        (Number(wei) / 1e9).toLocaleString(undefined, {
            maximumFractionDigits: 2,
        }) + " Gwei"
    );
}

function formatNumber(num: bigint): string {
    return num.toLocaleString();
}

// eth_getBalance tool
server.tool(
    "get-balance",
    "Get the ETH balance of a given account address in wei",
    {
        address: z
            .string()
            .length(42)
            .startsWith("0x")
            .describe("Ethereum address (0x...)"),
        blockNumber: z
            .string()
            .optional()
            .default("latest")
            .describe(
                "Block tag (e.g. latest, earliest, pending, or a hex block number)"
            ),
    },
    async ({ address, blockNumber }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_getBalance",
            [address, blockNumber || "latest"]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve balance: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        const balanceWei = BigInt(rpcResult.result || "0x0");

        return {
            content: [
                {
                    type: "text",
                    text: `ETH balance for ${address} at block "${blockNumber || "latest"}":${formatEth(balanceWei)} (${balanceWei.toLocaleString()} wei)`,
                },
            ],
        };
    }
);

// eth_getCode tool
server.tool(
    "get-contract-code",
    "Get the bytecode of a smart contract at a given address",
    {
        address: z
            .string()
            .length(42)
            .startsWith("0x")
            .describe("Ethereum address (0x...)"),
        blockNumber: z
            .string()
            .optional()
            .default("latest")
            .describe(
                "Block tag (e.g. latest, earliest, pending, or a hex block number)"
            ),
    },
    async ({ address, blockNumber }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_getCode",
            [address, blockNumber || "latest"]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve contract code: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        const code = rpcResult.result || "0x";

        return {
            content: [
                {
                    type: "text",
                    text: `Contract code from ${address} (block ${blockNumber || "latest"}):\n${code}`,
                },
            ],
        };
    }
);

// eth_getStorageAt tool
server.tool(
    "get-storage-at",
    "Get the value from a storage position at a given address",
    {
        address: z
            .string()
            .length(42)
            .startsWith("0x")
            .describe("Ethereum address (0x...)"),
        position: z
            .string()
            .startsWith("0x")
            .describe("Hex-encoded position of the storage slot"),
        blockNumber: z
            .string()
            .optional()
            .default("latest")
            .describe("Block tag (e.g. latest, earliest, pending, or a hex block number)"),
    },
    async ({ address, position, blockNumber }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_getStorageAt",
            [address, position, blockNumber || "latest"]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve storage: ${rpcResult?.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text: `Storage at position ${position} for ${address} at block "${blockNumber || "latest"}": ${rpcResult.result}`,
                },
            ],
        };
    }
);

// eth_getProof tool
server.tool(
    "get-proof",
    "Get the account and storage values of the specified account including the Merkle-proof",
    {
        address: z
            .string()
            .length(42)
            .startsWith("0x")
            .describe("Ethereum address (0x...)"),
        storageKeys: z
            .array(z.string())
            .describe("Array of storage-keys that should be proofed and included"),
        blockNumber: z
            .string()
            .optional()
            .default("latest")
            .describe("Block number or tag (latest, earliest, pending, safe, finalized)"),
    },
    async ({ address, storageKeys, blockNumber }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: any; error?: any }>(
            "eth_getProof",
            [address, storageKeys, blockNumber || "latest"]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve proof: ${rpcResult?.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }

        const proof = rpcResult.result;

        return {
            content: [
                {
                    type: "text",
                    text: `Account Proof for ${address} (block ${blockNumber || "latest"}):\n\n` +
                        `Account Proof: ${proof.accountProof.map((item: string) =>
                            `${item}`
                        ).join('\n')}\n\n` +
                        `Balance: ${formatEth(BigInt(proof.balance))}\n` +
                        `Nonce: ${parseInt(proof.nonce, 16)}\n` +
                        `Code Hash: ${proof.codeHash}\n` +
                        `Storage Hash: ${proof.storageHash}\n\n` +
                        `Storage Proofs:\n${proof.storageProof.map((storage: any, index: number) =>
                            `\nStorage Key ${index + 1}: ${storage.key}\n` +
                            `Value: ${storage.value}\n` +
                            `Proof Length: ${storage.proof.length} nodes`
                        ).join('\n')}\n\n` +
                        `Account Proof Length: ${proof.accountProof.length} nodes`,
                },
            ],
        };
    }
);

// eth_blockNumber tool
server.tool("get-block-number", "Get the latest block number", async ({ }) => {
    const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
        "eth_blockNumber",
        []
    );

    if (!rpcResult || rpcResult.error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to retrieve latest block: ${rpcResult?.error?.message || "Unknown error"
                        }`,
                },
            ],
        };
    }

    const latestBlock = BigInt(rpcResult.result || "0x0");

    return {
        content: [
            {
                type: "text",
                text: `Latest block number: ${formatNumber(latestBlock)} (hex: ${rpcResult.result
                    })`,
            },
        ],
    };
});

// eth_gasPrice tool
server.tool("get-gas-price", "Get the latest gas price", async ({ }) => {
    const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
        "eth_gasPrice",
        []
    );

    if (!rpcResult || rpcResult.error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to retrieve latest gas price: ${rpcResult?.error?.message || "Unknown error"
                        }`,
                },
            ],
        };
    }

    const latestGasPrice = BigInt(rpcResult.result || "0x0");

    return {
        content: [
            {
                type: "text",
                text: `Latest gas price: ${formatGwei(
                    latestGasPrice
                )} (${latestGasPrice.toLocaleString()} wei)`,
            },
        ],
    };
});

// eth_feeHistory tool
server.tool(
    "get-fee-history",
    "Get historical gas information for a range of blocks",
    {
        blockCount: z
            .number()
            .min(1)
            .max(1024)
            .describe("Number of blocks in the requested range (1-1024)"),
        newestBlock: z
            .string()
            .describe("Highest block number of the requested range (hex or tag: latest, earliest, pending, safe, finalized)"),
        rewardPercentiles: z
            .array(z.number())
            .describe("List of percentile values with monotonic increase (e.g. [25, 75])"),
    },
    async ({ blockCount, newestBlock, rewardPercentiles }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: any; error?: any }>(
            "eth_feeHistory",
            [blockCount, newestBlock, rewardPercentiles]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve fee history: ${rpcResult?.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }

        const history = rpcResult.result;

        return {
            content: [
                {
                    type: "text",
                    text: `Fee History (${blockCount} blocks ending at ${newestBlock}):\n\n` +
                        `Oldest Block: ${parseInt(history.oldestBlock, 16)}\n\n` +
                        `Base Fee Per Gas:\n${history.baseFeePerGas.map((fee: string, index: number) =>
                            `Block ${index + 1}: ${formatGwei(BigInt(fee))}`
                        ).join('\n')}\n\n` +
                        `Gas Used Ratio:\n${history.gasUsedRatio.map((ratio: number, index: number) =>
                            `Block ${index + 1}: ${(ratio * 100).toFixed(2)}%`
                        ).join('\n')}\n\n` +
                        `Reward Percentiles (${rewardPercentiles.join(', ')}):\n${history.reward.map((rewards: string[], index: number) =>
                            `Block ${index + 1}:\n${rewards.map((reward: string, rIndex: number) =>
                                `  ${rewardPercentiles[rIndex]}th: ${formatGwei(BigInt(reward))}`
                            ).join('\n')}`
                        ).join('\n\n')}`,
                },
            ],
        };
    }
);

// eth_maxPriorityFeePerGas tool
server.tool(
    "get-max-priority-fee",
    "Get the priority fee needed to be included in a block",
    async () => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_maxPriorityFeePerGas",
            []
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve max priority fee: ${rpcResult?.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }

        const maxPriorityFee = BigInt(rpcResult.result || "0x0");

        return {
            content: [
                {
                    type: "text",
                    text: `Max Priority Fee Per Gas: ${formatGwei(maxPriorityFee)} (${maxPriorityFee.toLocaleString()} wei)`,
                },
            ],
        };
    }
);

// eth_getTransactionByHash tool
server.tool(
    "get-transaction",
    "Get transaction details by hash",
    {
        transactionHash: z
            .string()
            .length(66)
            .startsWith("0x")
            .regex(/^0x[a-fA-F0-9]{64}$/)
            .describe("Ethereum transaction hash (0x followed by 64 hex characters)"),
    },
    async ({ transactionHash }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: any; error?: any }>(
            "eth_getTransactionByHash",
            [transactionHash]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to fetch transaction: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        const tx = rpcResult.result;

        if (!tx) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Transaction not found",
                    },
                ],
            };
        }

        const formattedTx = {
            hash: tx.hash,
            blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : "Pending",
            from: tx.from,
            to: tx.to || "Contract Creation",
            value: tx.value ? `${formatEth(BigInt(tx.value))} ETH` : "0 ETH",
            gas: parseInt(tx.gas, 16),
            gasPrice: tx.gasPrice ? `${formatGwei(BigInt(tx.gasPrice))} Gwei` : "N/A",
            nonce: parseInt(tx.nonce, 16),
            input: tx.input || "0x",
        };

        return {
            content: [
                {
                    type: "text",
                    text: `Transaction Details:
                Hash: ${formattedTx.hash}
                Block: ${formattedTx.blockNumber}
                From: ${formattedTx.from}
                To: ${formattedTx.to}
                Value: ${formattedTx.value}
                Gas: ${formattedTx.gas}
                Gas Price: ${formattedTx.gasPrice}
                Nonce: ${formattedTx.nonce}
                Input Data: ${formattedTx.input}`,
                },
            ],
        };
    }
);

// eth_getTransactionByBlockHashAndIndex tool
server.tool(
    "get-transaction-by-block",
    "Get transaction by block hash and index",
    {
        blockHash: z
            .string()
            .length(66)
            .startsWith("0x")
            .regex(/^0x[a-fA-F0-9]{64}$/)
            .describe("Ethereum block hash (0x followed by 64 hex characters)"),

        transactionIndex: z
            .string()
            .startsWith("0x")
            .regex(/^0x[0-9a-fA-F]+$/)
            .describe("Transaction index position in the block (hex string)"),
    },
    async ({ blockHash, transactionIndex }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: any; error?: any }>(
            "eth_getTransactionByBlockHashAndIndex",
            [blockHash, transactionIndex]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to fetch transaction: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        const tx = rpcResult.result;

        if (!tx) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Transaction not found at specified block position",
                    },
                ],
            };
        }

        const formattedTx = {
            hash: tx.hash,
            blockNumber: parseInt(tx.blockNumber, 16),
            blockHash: tx.blockHash,
            transactionIndex: parseInt(tx.transactionIndex, 16),
            from: tx.from,
            to: tx.to || "Contract Creation",
            value: tx.value ? `${formatEth(BigInt(tx.value))} ETH` : "0 ETH",
            gas: parseInt(tx.gas, 16),
            gasPrice: tx.gasPrice ? `${formatGwei(BigInt(tx.gasPrice))} Gwei` : "N/A",
            nonce: parseInt(tx.nonce, 16),
            input: tx.input || "0x",
        };

        return {
            content: [
                {
                    type: "text",
                    text: `Transaction Details:
                Hash: ${formattedTx.hash}
                Block Number: ${formattedTx.blockNumber}
                Block Hash: ${formattedTx.blockHash}
                Position in Block: ${formattedTx.transactionIndex}
                From: ${formattedTx.from}
                To: ${formattedTx.to}
                Value: ${formattedTx.value}
                Gas: ${formattedTx.gas}
                Gas Price: ${formattedTx.gasPrice}
                Nonce: ${formattedTx.nonce}
                Input Data: ${formattedTx.input}`,
                },
            ],
        };
    }
);

// eth_getTransactionByBlockNumberAndIndex tool
server.tool(
    "get-transaction-by-block-number",
    "Get transaction by block number and index",
    {
        blockNumber: z
            .string()
            .refine(
                (val) =>
                    /^0x[a-fA-F0-9]+$/.test(val) ||
                    ["latest", "earliest", "pending"].includes(val),
                "Must be hex block number or 'latest', 'earliest', 'pending'"
            )
            .describe("Block number (hex) or tag: 'latest', 'earliest', 'pending'"),

        transactionIndex: z
            .string()
            .startsWith("0x")
            .regex(/^0x[0-9a-fA-F]+$/)
            .describe("Transaction index position in block (hex string)"),
    },
    async ({ blockNumber, transactionIndex }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: any; error?: any }>(
            "eth_getTransactionByBlockNumberAndIndex",
            [blockNumber, transactionIndex]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to fetch transaction: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        const tx = rpcResult.result;

        if (!tx) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Transaction not found at specified block position",
                    },
                ],
            };
        }

        const formattedTx = {
            hash: tx.hash,
            blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : "Pending",
            blockHash: tx.blockHash || "Pending",
            transactionIndex: parseInt(tx.transactionIndex, 16),
            from: tx.from,
            to: tx.to || "Contract Creation",
            value: tx.value ? `${formatEth(BigInt(tx.value))} ETH` : "0 ETH",
            gas: parseInt(tx.gas, 16),
            gasPrice: tx.gasPrice ? `${formatGwei(BigInt(tx.gasPrice))} Gwei` : "N/A",
            nonce: parseInt(tx.nonce, 16),
            input: tx.input || "0x",
        };

        return {
            content: [
                {
                    type: "text",
                    text: `Transaction Details:
              Hash: ${formattedTx.hash}
              Block Number: ${formattedTx.blockNumber}
              Block Hash: ${formattedTx.blockHash}
              Position in Block: ${formattedTx.transactionIndex}
              From: ${formattedTx.from}
              To: ${formattedTx.to}
              Value: ${formattedTx.value}
              Gas: ${formattedTx.gas}
              Gas Price: ${formattedTx.gasPrice}
              Nonce: ${formattedTx.nonce}
              Input Data: ${formattedTx.input}`,
                },
            ],
        };
    }
);

// eth_getTransactionByBlockNumberAndIndex tool
server.tool(
    "get-transaction-by-block-number-index",
    "Get transaction by block number and transaction index position",
    {
        blockNumber: z
            .string()
            .refine(
                (val) =>
                    /^0x[a-fA-F0-9]+$/.test(val) ||
                    ["latest", "earliest", "pending"].includes(val),
                {
                    message:
                        "Must be hex block number (0x...) or one of: latest, earliest, pending",
                }
            )
            .describe("Block number (hex) or tag (latest/earliest/pending)"),

        transactionIndex: z
            .string()
            .startsWith("0x")
            .regex(/^0x[0-9a-fA-F]+$/)
            .describe("Transaction index position in block (hex string)"),
    },
    async ({ blockNumber, transactionIndex }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: any; error?: any }>(
            "eth_getTransactionByBlockNumberAndIndex",
            [blockNumber, transactionIndex]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to fetch transaction: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        const tx = rpcResult.result;

        if (!tx) {
            return {
                content: [
                    {
                        type: "text",
                        text: "No transaction found at the specified block position",
                    },
                ],
            };
        }

        const formattedTx = {
            hash: tx.hash,
            blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : "Pending",
            blockHash: tx.blockHash || "Pending",
            from: tx.from,
            to: tx.to || "Contract Creation",
            value: tx.value ? `${formatEth(BigInt(tx.value))} ETH` : "0 ETH",
            gasLimit: parseInt(tx.gas, 16),
            gasPrice: tx.gasPrice ? `${formatGwei(BigInt(tx.gasPrice))} Gwei` : "N/A",
            nonce: parseInt(tx.nonce, 16),
            transactionIndex: parseInt(tx.transactionIndex, 16),
            input: tx.input || "0x",
            status: tx.blockNumber ? "Confirmed" : "Pending",
        };

        return {
            content: [
                {
                    type: "text",
                    text: `Transaction Details:
              Status: ${formattedTx.status}
              Hash: ${formattedTx.hash}
              Block Number: ${formattedTx.blockNumber}
              Block Hash: ${formattedTx.blockHash}
              From: ${formattedTx.from}
              To: ${formattedTx.to}
              Value: ${formattedTx.value}
              Gas Limit: ${formattedTx.gasLimit}
              Gas Price: ${formattedTx.gasPrice}
              Nonce: ${formattedTx.nonce}
              Position in Block: ${formattedTx.transactionIndex}
              Input Data: ${formattedTx.input}`,
                },
            ],
        };
    }
);

// eth_getTransactionReceipt tool
server.tool(
    "get-transaction-receipt",
    "Get transaction receipt by hash",
    {
        transactionHash: z
            .string()
            .length(66)
            .startsWith("0x")
            .regex(/^0x[a-fA-F0-9]{64}$/)
            .describe("Ethereum transaction hash (0x followed by 64 hex characters)"),
    },
    async ({ transactionHash }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: any; error?: any }>(
            "eth_getTransactionReceipt",
            [transactionHash]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to fetch transaction receipt: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        const txReceipt = rpcResult.result;

        if (!txReceipt) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Transaction receipt not found (transaction may be pending or failed)",
                    },
                ],
            };
        }

        const formattedReceipt = {
            status: txReceipt.status ? "Success" : "Failed",
            blockNumber: parseInt(txReceipt.blockNumber, 16),
            blockHash: txReceipt.blockHash,
            transactionHash: txReceipt.transactionHash,
            gasUsed: parseInt(txReceipt.gasUsed, 16),
            cumulativeGasUsed: parseInt(txReceipt.cumulativeGasUsed, 16),
            effectiveGasPrice: txReceipt.effectiveGasPrice
                ? `${formatGwei(BigInt(txReceipt.effectiveGasPrice))} Gwei`
                : "N/A",
            contractAddress: txReceipt.contractAddress || "N/A",
            logs: txReceipt.logs.map(
                (log: any, index: number) =>
                    `Log ${index}: ${log.data} (Topics: ${log.topics.join(", ")})`
            ),
        };

        return {
            content: [
                {
                    type: "text",
                    text: `Transaction Receipt Details:
              Status: ${formattedReceipt.status}
              Block Number: ${formattedReceipt.blockNumber}
              Block Hash: ${formattedReceipt.blockHash}
              Transaction Hash: ${formattedReceipt.transactionHash}
              Gas Used: ${formattedReceipt.gasUsed}
              Cumulative Gas Used: ${formattedReceipt.cumulativeGasUsed}
              Effective Gas Price: ${formattedReceipt.effectiveGasPrice}
              Contract Address: ${formattedReceipt.contractAddress}
              Logs: ${formattedReceipt.logs.join("\n                ")}`,
                },
            ],
        };
    }
);

// eth_sendRawTransaction tool
server.tool(
    "send-raw-transaction",
    "Submit a signed raw transaction to the Ethereum network",
    {
        rawTransaction: z
            .string()
            .startsWith("0x")
            .regex(/^0x[0-9a-fA-F]+$/)
            .min(68)
            .describe("Signed RLP-encoded transaction data (0x-prefixed hex string)"),
    },
    async ({ rawTransaction }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_sendRawTransaction",
            [rawTransaction]
        );

        if (!rpcResult || rpcResult.error) {
            const errorMessage = rpcResult?.error?.message || "Unknown error";
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to submit transaction: ${errorMessage}`,
                    },
                ],
            };
        }

        const txHash = rpcResult.result;

        if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
            return {
                content: [
                    {
                        type: "text",
                        text: "⚠️ Received invalid transaction hash from RPC node",
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text:
                        `✅ Transaction submitted successfully!\n\n` +
                        `Transaction Hash: ${txHash}\n` +
                        `Block Explorer: https://etherscan.io/tx/${txHash}`,
                },
            ],
        };
    }
);

// eth_call tool
server.tool(
    "call-contract",
    "Execute a contract call without creating a transaction",
    {
        callData: z.object({
            to: z
                .string()
                .length(42)
                .startsWith("0x")
                .describe("Contract address (0x...)"),
            data: z
                .string()
                .startsWith("0x")
                .regex(/^0x[0-9a-fA-F]*$/)
                .describe("Encoded function call data"),
            from: z
                .string()
                .length(42)
                .startsWith("0x")
                .optional()
                .describe("Caller address (optional)"),
            gas: z
                .string()
                .startsWith("0x")
                .regex(/^0x[0-9a-fA-F]+$/)
                .optional()
                .describe("Gas limit (optional)"),
            gasPrice: z
                .string()
                .startsWith("0x")
                .regex(/^0x[0-9a-fA-F]+$/)
                .optional()
                .describe("Gas price (optional)"),
            value: z
                .string()
                .startsWith("0x")
                .regex(/^0x[0-9a-fA-F]+$/)
                .optional()
                .describe("Value in wei (optional)"),
        }),
        block: z
            .string()
            .refine(
                (val) =>
                    /^0x[a-fA-F0-9]+$/.test(val) ||
                    ["latest", "earliest", "pending"].includes(val),
                {
                    message:
                        "Must be hex block number or 'latest', 'earliest', 'pending'",
                }
            )
            .default("latest")
            .describe("Block number or tag"),
    },
    async ({ callData, block }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_call",
            [callData, block]
        );

        if (!rpcResult || rpcResult.error) {
            const errorMessage = rpcResult?.error?.message || "Unknown error";
            const revertReason = errorMessage.match(
                /reverted: (0x[0-9a-fA-F]+)/
            )?.[1];

            return {
                content: [
                    {
                        type: "text",
                        text:
                            `Call failed: ${errorMessage}` +
                            (revertReason ? `\nRevert reason (hex): ${revertReason}` : ""),
                    },
                ],
            };
        }

        if (!rpcResult.result) {
            return {
                content: [
                    {
                        type: "text",
                        text: "No data returned from contract call",
                    },
                ],
            };
        }

        const decodeAttempt = tryDecodeSimpleTypes(rpcResult.result);

        return {
            content: [
                {
                    type: "text",
                    text: `Call result:
              Raw hex: ${rpcResult.result}
              ${decodeAttempt ? `Decoded: ${decodeAttempt}` : ""}`,
                },
            ],
        };
    }
);

// Helper function for eth_call to decode common return types
function tryDecodeSimpleTypes(hexData: string): string | null {
    try {
        const cleanHex = hexData.startsWith("0x") ? hexData.slice(2) : hexData;

        // Empty response
        if (cleanHex === "") return "0x (empty)";

        // Address type
        if (cleanHex.length === 64) {
            const addressPart = cleanHex.slice(24);
            if (/^0+$/.test(addressPart.slice(0, 24))) {
                return `Address: 0x${addressPart}`;
            }
        }

        // Uint256
        if (cleanHex.length === 64) {
            const bigIntValue = BigInt(`0x${cleanHex}`);
            return `Uint256: ${bigIntValue.toString()}`;
        }

        // Bool
        if (cleanHex.length === 64) {
            const boolValue = BigInt(`0x${cleanHex}`);
            return `Bool: ${boolValue === 1n ? "true" : "false"}`;
        }

        // Bytes (show first 128 characters)
        return `Bytes: 0x${cleanHex.slice(0, 128)}...`;
    } catch {
        return null;
    }
}

// eth_estimateGas tool
server.tool(
    "estimate-gas",
    "Estimate the gas required for a transaction",
    {
        transaction: z.object({
            from: z
                .string()
                .length(42)
                .startsWith("0x")
                .describe("Sender address (0x...)"),
            to: z
                .string()
                .length(42)
                .startsWith("0x")
                .describe("Recipient address (0x...)"),
            data: z
                .string()
                .startsWith("0x")
                .regex(/^0x[0-9a-fA-F]*$/)
                .optional()
                .describe("Transaction data (optional)"),
            value: z
                .string()
                .startsWith("0x")
                .regex(/^0x[0-9a-fA-F]+$/)
                .optional()
                .describe("Value in wei (optional)"),
            gasPrice: z
                .string()
                .startsWith("0x")
                .regex(/^0x[0-9a-fA-F]+$/)
                .optional()
                .describe("Gas price in wei (optional)"),
            gas: z
                .string()
                .startsWith("0x")
                .regex(/^0x[0-9a-fA-F]+$/)
                .optional()
                .describe("Gas limit (optional)"),
        }),
        block: z
            .string()
            .refine(
                (val) =>
                    /^0x[a-fA-F0-9]+$/.test(val) ||
                    ["latest", "earliest", "pending"].includes(val),
                {
                    message:
                        "Must be hex block number or 'latest', 'earliest', 'pending'",
                }
            )
            .default("latest")
            .describe("Block number or tag"),
    },
    async ({ transaction, block }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_estimateGas",
            [transaction, block]
        );

        if (!rpcResult || rpcResult.error) {
            const errorMessage = rpcResult?.error?.message || "Unknown error";
            const revertReason = errorMessage.match(
                /reverted: (0x[0-9a-fA-F]+)/
            )?.[1];

            return {
                content: [
                    {
                        type: "text",
                        text:
                            `Gas estimation failed: ${errorMessage}` +
                            (revertReason ? `\nRevert reason (hex): ${revertReason}` : ""),
                    },
                ],
            };
        }

        if (!rpcResult.result || !rpcResult.result.startsWith("0x")) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Received invalid gas estimate from RPC node",
                    },
                ],
            };
        }

        const gasEstimateHex = rpcResult.result;
        const gasEstimate = parseInt(gasEstimateHex, 16);

        return {
            content: [
                {
                    type: "text",
                    text: `Gas estimate:
              Hex: ${gasEstimateHex}
              Decimal: ${gasEstimate.toLocaleString()}
              Recommended gas limit: ${Math.ceil(
                        gasEstimate * 1.2
                    ).toLocaleString()} (+20% buffer)`,
                },
            ],
        };
    }
);

// eth_getLogs tool
server.tool(
    "get-logs",
    "Fetch logs for a contract within a given block range",
    {
        fromBlock: z
            .string()
            .default("latest")
            .describe('Start block (e.g. "earliest", "latest", or hex block number)'),
        toBlock: z
            .string()
            .default("latest")
            .describe('End block (e.g. "latest", or hex block number)'),
        address: z
            .string()
            .length(42)
            .startsWith("0x")
            .describe("Contract address to get logs from"),
        topics: z
            .array(z.string())
            .optional()
            .describe("List of topics (optional, ordered)"),
    },
    async ({ fromBlock, toBlock, address, topics }) => {
        const filter = {
            fromBlock,
            toBlock,
            address,
            ...(topics ? { topics } : {}),
        };

        const rpcResult = await makeEthRpcRequest<{ result?: any[]; error?: any }>(
            "eth_getLogs",
            [filter]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to fetch logs: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        if (rpcResult.result!.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No logs found for address ${address} from block ${fromBlock} to ${toBlock}.`,
                    },
                ],
            };
        }

        return {
            content: rpcResult.result!.map((log, idx) => ({
                type: "text",
                text: `Log ${idx + 1}:\nBlock: ${log.blockNumber}\nTxHash: ${log.transactionHash
                    }\nTopics: ${log.topics.join(", ")}\nData: ${log.data}`,
            })),
        };
    }
);

// eth_newFilter tool
server.tool(
    "get-new-filter",
    "Creates a log filter for tracking state changes",
    {
        fromBlock: z
            .string()
            .default("latest")
            .describe('Start block (e.g. "earliest", "latest", or hex block number)'),
        toBlock: z
            .string()
            .default("latest")
            .describe('End block (e.g. "latest", or hex block number)'),
        address: z
            .string()
            .length(42)
            .startsWith("0x")
            .describe("Contract address to get logs from"),
        topics: z
            .array(z.string())
            .optional()
            .describe("List of topics (optional, ordered)"),
    },
    async ({ fromBlock, toBlock, address, topics }) => {
        const filterParams: any = {
            fromBlock,
            toBlock,
            address,
            ...(topics ? { topics } : {}),
        };

        const filterCreation = await makeEthRpcRequest<{
            result?: string;
            error?: any;
        }>("eth_newFilter", [filterParams]);

        if (!filterCreation || filterCreation.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to create filter: ${filterCreation?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text: `Filter ID: ${filterCreation.result}`,
                },
            ],
        };
    }
);

// eth_newBlockFilter tool
server.tool(
    "get-new-block-filter",
    "Creates a filter to detect new block arrivals.",
    async ({ }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_newBlockFilter",
            [],
            67
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to create block filter: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text: `New block filter created.\nFilter ID: ${rpcResult.result}`,
                },
            ],
        };
    }
);

// eth_newPendingTransactionFilter tool
server.tool(
    "get-new-pending-tran-filter",
    "Creates a filter to detect new pending transaction",
    async ({ }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_newBlockFilter",
            [],
            67
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to create new pending transcation filter: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text: `Filter ID: ${rpcResult.result}`,
                },
            ],
        };
    }
);

// eth_getFilterChanges tool
server.tool(
    "get-filter-changes",
    "Polls a filter to get new logs, block hashes, or transaction hashes since the last check.",
    {
        filterId: z
            .string()
            .min(1)
            .describe(
                "The filter ID returned from eth_newFilter, eth_newBlockFilter, or eth_newPendingTransactionFilter"
            ),
    },
    async ({ filterId }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: any[]; error?: any }>(
            "eth_getFilterChanges",
            [filterId]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get filter changes: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        const changes = rpcResult.result || [];

        if (changes.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No changes found for filter ID ${filterId}.`,
                    },
                ],
            };
        }

        return {
            content: changes.map((change, idx) => ({
                type: "text",
                text: `Change ${idx + 1}:\n${JSON.stringify(change, null, 2)}`,
            })),
        };
    }
);

// eth_getFilterLogs tool
server.tool(
    "get-filter-logs",
    "Polls a filter to get all logs matching the filter ID.",
    {
        filterId: z
            .string()
            .min(1)
            .describe(
                "The filter ID returned from eth_newFilter, eth_newBlockFilter, or eth_newPendingTransactionFilter"
            ),
    },
    async ({ filterId }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: any[]; error?: any }>(
            "eth_getFilterLogs",
            [filterId]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get logs for filter ID ${filterId}: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        const logs = rpcResult.result || [];

        if (logs.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No logs found for filter ID ${filterId}.`,
                    },
                ],
            };
        }

        return {
            content: logs.map((log, idx) => ({
                type: "text",
                text: `Log ${idx + 1}:\n${JSON.stringify(log, null, 2)}`,
            })),
        };
    }
);

// eth_uninstallFilter tool
server.tool(
    "uninstall-filter",
    "Uninstalls a filter with the given filter ID.",
    {
        filterId: z.string().min(1).describe("The filter ID to uninstall"),
    },
    async ({ filterId }) => {
        const rpcResult = await makeEthRpcRequest<{
            result?: boolean;
            error?: any;
        }>("eth_uninstallFilter", [filterId]);

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to uninstall filter ID ${filterId}: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text: rpcResult.result
                        ? `Successfully uninstalled filter ID ${filterId}.`
                        : `Failed to uninstall filter ID ${filterId}.`,
                },
            ],
        };
    }
);

// eth_submitWork tool
server.tool(
    "submit-proof-of-work",
    "Submits a proof-of-work solution to the network.",
    {
        nonce: z.string().min(1).describe("The nonce found during mining"),
        hash: z.string().min(1).describe("The header's PoW hash"),
        digest: z.string().min(1).describe("The mix digest"),
    },
    async ({ nonce, hash, digest }) => {
        const rpcResult = await makeEthRpcRequest<{
            result?: boolean;
            error?: any;
        }>("eth_submitWork", [nonce, hash, digest]);

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to submit PoW solution: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text: rpcResult.result
                        ? "Successfully submitted PoW solution."
                        : "Failed to submit PoW solution. Invalid solution.",
                },
            ],
        };
    }
);

// web3_clientVersion tool
server.tool(
    "get-client-version",
    "Fetches the current version of the Ethereum client.",
    async () => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "web3_clientVersion",
            []
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to fetch client version: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text: `Current Ethereum client version: ${rpcResult.result}`,
                },
            ],
        };
    }
);

// web3_sha3 tool
server.tool(
    "get-sha3-hash",
    "Generates a Keccak-256 (SHA3) hash of the given hexadecimal data.",
    {
        data: z
            .string()
            .min(1)
            .describe("The data in hexadecimal form to convert into a SHA3 hash"),
    },
    async ({ data }) => {
        if (checkValidHexadecimal(data)) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Invalid hexadecimal input. Ensure the data starts with '0x' and contains only hexadecimal characters.",
                    },
                ],
            };
        }

        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "web3_sha3",
            [data]
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to compute SHA3 hash: ${rpcResult?.error?.message || "Unknown error"
                            }`,
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text: `SHA3 (Keccak-256) hash of the provided data: ${rpcResult.result}`,
                },
            ],
        };
    }
);

// eth_chainId tool
server.tool(
    "get-chain-id",
    "Fetch the chain ID of the current Ethereum network",
    {},
    async () => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_chainId",
            []
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to fetch chain ID: ${rpcResult?.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }

        const chainId = parseInt(rpcResult.result!, 16); // Convert hex to decimal

        return {
            content: [
                {
                    type: "text",
                    text: `Chain ID: ${chainId} (hex: ${rpcResult.result})`,
                },
            ],
        };
    }
);

// net_version tool
server.tool(
  "get-network-id",
  "Fetch the network ID using net_version",
  {},
  async () => {
      const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
          "net_version",
          []
      );

      if (!rpcResult || rpcResult.error) {
          return {
              content: [
                  {
                      type: "text",
                      text: `Failed to fetch network ID: ${rpcResult?.error?.message || "Unknown error"}`,
                  },
              ],
          };
      }

      return {
          content: [
              {
                  type: "text",
                  text: `Network ID: ${rpcResult.result}`,
              },
          ],
      };
  }
);

// net_listening tool
server.tool(
  "is-network-listening",
  "Check if the Ethereum node is listening for network connections",
  {},
  async () => {
      const rpcResult = await makeEthRpcRequest<{ result?: boolean; error?: any }>(
          "net_listening",
          []
      );

      if (!rpcResult || rpcResult.error) {
          return {
              content: [
                  {
                      type: "text",
                      text: `Failed to check network listening status: ${rpcResult?.error?.message || "Unknown error"}`,
                  },
              ],
          };
      }

      const statusText = rpcResult.result
          ? "✅ The node is listening for network connections."
          : "❌ The node is not listening for network connections.";

      return {
          content: [
              {
                  type: "text",
                  text: statusText,
              },
          ],
      };
  }
);

// net_peerCount tool
server.tool(
  "get-peer-count",
  "Fetch the number of peers currently connected to the Ethereum node",
  {},
  async () => {
      const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
          "net_peerCount",
          []
      );

      if (!rpcResult || rpcResult.error) {
          return {
              content: [
                  {
                      type: "text",
                      text: `Failed to fetch peer count: ${rpcResult?.error?.message || "Unknown error"}`,
                  },
              ],
          };
      }

      // The result is a hex string, so convert it to a decimal number
      const peerCount = parseInt(rpcResult.result!, 16);

      return {
          content: [
              {
                  type: "text",
                  text: `Peer Count: ${peerCount} (${rpcResult.result} in hex)`,
              },
          ],
      };
  }
);

// eth_syncing tool
server.tool(
  "get-sync-status",
  "Check if the Ethereum node is syncing and return sync progress if applicable",
  {},
  async () => {
      const rpcResult = await makeEthRpcRequest<{
          result?: false | {
              startingBlock: string;
              currentBlock: string;
              highestBlock: string;
          };
          error?: any;
      }>("eth_syncing", []);

      if (!rpcResult || rpcResult.error || typeof rpcResult.result === "undefined") {
          return {
              content: [
                  {
                      type: "text",
                      text: `Failed to check sync status: ${rpcResult?.error?.message || "Invalid or undefined response from node."}`,
                  },
              ],
          };
      }

      const result = rpcResult.result;

      // If not syncing
      if (result === false) {
          return {
              content: [
                  {
                      type: "text",
                      text: "✅ The node is fully synced.",
                  },
              ],
          };
      }

      // If syncing
      return {
          content: [
              {
                  type: "text",
                  text: `🔄 Node is syncing...\n\nStarting Block: ${parseInt(result.startingBlock, 16)}\nCurrent Block: ${parseInt(result.currentBlock, 16)}\nHighest Block: ${parseInt(result.highestBlock, 16)}`,
              },
          ],
      };
  }
);

// eth_mining tool
server.tool(
  "is-mining",
  "Check if the Ethereum node is currently mining",
  {},
  async () => {
      const rpcResult = await makeEthRpcRequest<{
          result?: boolean;
          error?: any;
      }>("eth_mining", []);

      if (!rpcResult || rpcResult.error || typeof rpcResult.result === "undefined") {
          return {
              content: [
                  {
                      type: "text",
                      text: `Failed to check mining status: ${rpcResult?.error?.message || "Invalid or undefined response from node."}`,
                  },
              ],
          };
      }

      const isMining = rpcResult.result;

      return {
          content: [
              {
                  type: "text",
                  text: isMining
                      ? "⛏️ The node is currently mining."
                      : "❌ The node is not mining.",
              },
          ],
      };
  }
);

// eth_hashrate tool
server.tool(
  "get-hashrate",
  "Fetch the current mining hashrate of the Ethereum node",
  {},
  async () => {
      const rpcResult = await makeEthRpcRequest<{
          result?: string; // The result is a hex string representing hashrate
          error?: any;
      }>("eth_hashrate", []);

      if (!rpcResult || rpcResult.error || typeof rpcResult.result === "undefined") {
          return {
              content: [
                  {
                      type: "text",
                      text: `Failed to fetch hashrate: ${rpcResult?.error?.message || "Invalid or undefined response from node."}`,
                  },
              ],
          };
      }

      // Convert the hashrate from hex string to decimal
      const hashrate = parseInt(rpcResult.result, 16);

      return {
          content: [
              {
                  type: "text",
                  text: `⛏️ Current Mining Hashrate: ${hashrate} H/s`,
              },
          ],
      };
  }
);

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("FTM MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
