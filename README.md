# MCP Demo Server

This project provides an MCP (Model Context Protocol) server for interacting with Ethereum-compatible blockchains via JSON-RPC.

## Prerequisites

- **Node.js** (v18 or newer recommended)
- **npm** (comes with Node.js)
- (Optional) **TypeScript** globally, if you want to build manually:  
  ```bash
  npm install -g typescript
  ```

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

## Setup Claude Desktop path

To use this server with ClaudeDesktop, add the following to your `claude_desktop_config.json`:

```
{
    "mcpServers": {
        "ftm": {
            "command": "node",
            "args": [
                "/PATH/TO/YOUR/PROJECT/build/index.js"
            ]
        }
    }
}
```

> **Note:** The server communicates over stdio and is designed to be used as a subprocess by an MCP-compatible client.

## Tools Provided

- `get-balance`: Get the ETH balance of an address.
- `get-block-number`: Get the latest block number.
- `get-gas-price`: Get the current gas price.

## Configuration

- The server is currently configured to use the SonicLabs RPC endpoint (`https://rpc.soniclabs.com`).  
  You can change this in `src/index.ts` by modifying the `API_BASE_URL` variable.