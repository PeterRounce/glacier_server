# Bitcoin API Integration

## Overview

The Glacier Timelock Wallet now integrates with Bitcoin Core via a lightweight proxy server. This enables:

- **Auto-fetch block height** from your Bitcoin node
- **Auto-scan for UTXOs** when selecting a timelock
- **Auto-broadcast transactions** after signing
- **Real-time blockchain data** without manual CLI commands

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌──────────────────┐
│   React App     │◄───────►│  Proxy Server   │◄───────►│  Bitcoin Core    │
│  (Port 5173)    │  REST   │  (Port 3001)    │   CLI   │  (bitcoin-cli)   │
└─────────────────┘         └─────────────────┘         └──────────────────┘
```

### Why a Proxy?

The React app runs in the browser and cannot directly execute `bitcoin-cli` commands. The proxy server:
1. Runs on your local machine (Node.js)
2. Accepts HTTP requests from the React app
3. Executes `bitcoin-cli` commands
4. Returns results as JSON

## Setup

### 1. Install Proxy Dependencies

```bash
cd react-app/proxy
npm install
```

### 2. Start Bitcoin Core

Make sure Bitcoin Core is running on your desired network:

```bash
# For regtest
bitcoind -regtest -daemon

# For testnet
bitcoind -testnet -daemon

# For mainnet
bitcoind -daemon
```

### 3. Start the Proxy Server

```bash
cd react-app/proxy
npm start
```

Or specify a different network:

```bash
BITCOIN_NETWORK=testnet npm start
```

### 4. Start the React App

```bash
cd react-app/client
npx vite@5
```

### Or Use the Combined Startup Script

```bash
cd react-app
chmod +x start-all.sh
./start-all.sh
```

This starts both the proxy and the React app together.

## Features

### 1. Auto-Fetch Block Height

When the API is connected, the app automatically fetches the current block height every 10 seconds.

**UI Indicator:**
- Green badge: ✓ Connected
- Red badge: ✗ Disconnected

**Toggle:**
You can enable/disable auto-fetch with the checkbox in the Wallet Status section.

### 2. Auto-Scan for UTXOs

When you select a timelock to unlock, the app automatically scans the blockchain for UTXOs sent to that timelock address.

**What it does:**
1. Queries `listunspent` for the timelock address
2. If UTXOs are found, auto-fills the form:
   - Transaction ID (txid)
   - Output index (vout)
   - Amount in BTC

**Manual Entry:**
If no UTXOs are found (or API is disconnected), you can still enter these values manually.

### 3. Auto-Broadcast Transactions

After signing a transaction, the app attempts to broadcast it automatically.

**Success:**
- Transaction is broadcast to the network
- You see the TXID immediately
- Form is cleared for the next transaction

**Failure:**
- App shows the signed transaction hex
- You can broadcast manually with:
  ```bash
  bitcoin-cli -regtest sendrawtransaction <hex>
  ```

### 4. Manual Fallback

Everything works without the API:
- Manually update block height
- Manually enter txid/vout/amount
- Manually broadcast transactions

The app is fully functional offline, with the API adding convenience features.

## API Endpoints

### GET /api/blockheight
Get current block height.

**Query params:**
- `network`: regtest | testnet | mainnet (default: regtest)

**Response:**
```json
{
  "success": true,
  "height": 150,
  "network": "regtest",
  "timestamp": "2025-10-03T..."
}
```

### GET /api/listunspent
List unspent outputs (UTXOs).

**Query params:**
- `network`: regtest | testnet | mainnet
- `minconf`: minimum confirmations (default: 1)
- `address`: filter by address (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "txid": "abc123...",
      "vout": 0,
      "amount": 0.001,
      "confirmations": 6
    }
  ]
}
```

### POST /api/sendrawtransaction
Broadcast a signed transaction.

**Query params:**
- `network`: regtest | testnet | mainnet

**Body:**
```json
{
  "hex": "0200000001..."
}
```

**Response:**
```json
{
  "success": true,
  "txid": "abc123...",
  "network": "regtest"
}
```

### POST /api/generatetoaddress
Mine blocks (regtest only).

**Body:**
```json
{
  "blocks": 10,
  "address": "bcrt1q..."
}
```

### Other Endpoints

See `proxy/proxy-server.js` for full API documentation:
- `/api/blockchaininfo` - Get blockchain info
- `/api/transaction/:txid` - Get transaction details
- `/api/rawtransaction/:txid` - Get raw transaction (decoded)
- `/api/transactions` - List recent transactions
- `/api/testmempoolaccept` - Test transaction validity
- `/api/getnewaddress` - Get new address
- `/health` - Health check

## Troubleshooting

### Proxy Won't Start

**Error: `bitcoin-cli: command not found`**

Solution: Add Bitcoin Core to your PATH:
```bash
export PATH="/home/user/hack25/glacier_server/bitcoin-27.0/bin:$PATH"
```

Or edit the proxy to use the full path:
```javascript
const fullCommand = `/path/to/bitcoin-cli ${networkFlag} ${command}`;
```

### API Shows Disconnected

1. Check if proxy is running:
   ```bash
   curl http://localhost:3001/health
   ```

2. Check if Bitcoin Core is running:
   ```bash
   bitcoin-cli -regtest getblockcount
   ```

3. Check proxy logs for errors

### CORS Errors

The proxy enables CORS by default. If you encounter CORS errors, check that:
- Proxy is running on port 3001
- React app is accessing the correct URL
- No firewall is blocking the connection

### Wrong Network

If the proxy connects to the wrong network:

1. Stop the proxy
2. Set the environment variable:
   ```bash
   export BITCOIN_NETWORK=regtest
   ```
3. Restart the proxy

Or specify in the React app by changing the `network` state.

## Security Considerations

### Local Use Only

The proxy server has **NO AUTHENTICATION** and should only be used locally:
- Listen on `localhost` only (default)
- Do NOT expose to the internet
- Do NOT use on public networks

### Production Use

For production:
1. Add authentication (API keys, JWT, etc.)
2. Use HTTPS/TLS
3. Implement rate limiting
4. Whitelist specific commands
5. Run behind a firewall

### Mainnet Warning

When using mainnet:
- Double-check all transactions
- Use small amounts for testing
- Verify timelock conditions carefully
- Consider using a hardware wallet

## Development Tips

### Testing the API

```bash
# Health check
curl http://localhost:3001/health

# Get block height
curl http://localhost:3001/api/blockheight?network=regtest

# List UTXOs
curl "http://localhost:3001/api/listunspent?network=regtest&address=bcrt1q..."

# Broadcast transaction
curl -X POST http://localhost:3001/api/sendrawtransaction?network=regtest \
  -H "Content-Type: application/json" \
  -d '{"hex":"0200000001..."}'
```

### Debugging

Add logging to the proxy:
```javascript
console.log('Request:', req.method, req.url);
console.log('Body:', req.body);
```

Check browser console for API errors in the React app.

### Custom Endpoints

Add new endpoints to `proxy-server.js`:

```javascript
app.get('/api/custom', async (req, res) => {
  try {
    const result = await bitcoinCli('your-command', network);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

Then use in the React app via `bitcoinApi.js`.

## Next Steps

1. **Start both servers** with `./start-all.sh`
2. **Initialize or import your wallet** in the React app
3. **Create a timelock** - block height will auto-update
4. **Fund the timelock address** (use bitcoin-cli or the node)
5. **Select the timelock** - UTXOs will auto-scan
6. **Unlock and broadcast** - transaction will auto-broadcast

Enjoy the streamlined workflow! 🚀
