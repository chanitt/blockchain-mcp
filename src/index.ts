import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE_URL = "https://docs-demo.quiknode.pro"; // ETH
// const API_BASE_URL = "https://rpc.soniclabs.com"; // SONIC

const USER_AGENT = "ftm-mcp-server/1.0";

// Helper function for making JSON-RPC requests
async function makeEthRpcRequest<T>(method: string, params: any[]): Promise<T | null> {
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
                id: 1,
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
    return (Number(wei) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 8 }) + " ETH";
}

function formatGwei(wei: bigint): string {
    return (Number(wei) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " Gwei";
}

function formatNumber(num: bigint): string {
    return num.toLocaleString();
}

// get-balance tool
server.tool(
    "get-balance",
    "Get the ETH balance of a given account address in wei",
    {
        address: z.string().length(42).startsWith("0x").describe("Ethereum address (0x...)"),
        blockNumber: z.string().optional().default("latest").describe("Block tag (e.g. latest, earliest, pending, or a hex block number)"),
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
                        text: `Failed to retrieve balance: ${rpcResult?.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }

        const balanceWei = BigInt(rpcResult.result || "0x0");

        return {
            content: [
                {
                    type: "text",
                    text: `ETH balance for ${address} at block "${blockNumber || "latest"}":\n${formatEth(balanceWei)} (${balanceWei.toLocaleString()} wei)`,
                    // text: `${rpcResult.result}`,
                },
            ],
        };
    }
);

// get-block-number tool
server.tool(
    "get-block-number",
    "Get the latest block number",
    async ({ }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_blockNumber",
            []
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve latest block: ${rpcResult?.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }

        const latestBlock = BigInt(rpcResult.result || "0x0");

        return {
            content: [
                {
                    type: "text",
                    text: `Latest block number: ${formatNumber(latestBlock)} (hex: ${rpcResult.result})`,
                },
            ],
        };
    }
);

// get-gas-price tool
server.tool(
    "get-gas-price",
    "Get the latest gas price",
    async ({ }) => {
        const rpcResult = await makeEthRpcRequest<{ result?: string; error?: any }>(
            "eth_gasPrice",
            []
        );

        if (!rpcResult || rpcResult.error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve latest gas price: ${rpcResult?.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }

        const latestGasPrice = BigInt(rpcResult.result || "0x0");

        return {
            content: [
                {
                    type: "text",
                    text: `Latest gas price: ${formatGwei(latestGasPrice)} (${latestGasPrice.toLocaleString()} wei)`,
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