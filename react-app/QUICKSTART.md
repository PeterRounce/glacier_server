# Quick Start with Bitcoin CLI Integration

## Prerequisites

1. **Bitcoin Core installed and running**
   ```bash
   bitcoind -regtest -daemon
   ```

2. **Node.js 18+** installed

## Setup (One-time)

```bash
cd /home/user/hack25/glacier_server/react-app

# Install dependencies
cd proxy && npm install && cd ..
cd client && npm install && cd ..
```

## Running

### Option 1: All-in-one (Recommended)

```bash
cd /home/user/hack25/glacier_server/react-app
./start-all.sh
```

This starts:
- Bitcoin API Proxy (port 3001)
- React App (port 5173)

### Option 2: Separate terminals

**Terminal 1 - Proxy:**
```bash
cd /home/user/hack25/glacier_server/react-app/proxy
npm start
```

**Terminal 2 - React App:**
```bash
cd /home/user/hack25/glacier_server/react-app/client
npx vite@5
```

## Usage

1. **Open browser:** http://localhost:5173

2. **Check API status:**
   - Green badge = Connected ✓
   - Red badge = Disconnected ✗

3. **Create wallet or import existing**

4. **Create timelock:**
   - Block height auto-updates
   - Click quick buttons (+10, +100, +1000)
   - Copy lockup address

5. **Fund the lockup address:**
   ```bash
   bitcoin-cli -regtest sendtoaddress <lockup-address> 0.001
   bitcoin-cli -regtest generatetoaddress 1 <any-address>
   ```

6. **Unlock timelock:**
   - Click "Select to Unlock" on a timelock
   - UTXOs auto-scan and fill form
   - Click "Unlock Timelock"
   - Transaction auto-broadcasts if possible

## Features

✅ **Auto-fetch block height** - Updates every 10 seconds  
✅ **Auto-scan UTXOs** - When selecting a timelock  
✅ **Auto-broadcast** - After signing transaction  
✅ **Manual fallback** - Everything works without API  

## Troubleshooting

### API shows disconnected

1. Check proxy is running:
   ```bash
   curl http://localhost:3001/health
   ```

2. Check Bitcoin Core is running:
   ```bash
   bitcoin-cli -regtest getblockcount
   ```

### No UTXOs found

Make sure you've:
1. Sent funds to the lockup address
2. Mined/confirmed the transaction
3. Waited for 1 confirmation

### Transaction broadcast fails

Possible reasons:
- Timelock not yet unlocked (check block height)
- Insufficient fee
- Double-spend attempt

Check transaction manually:
```bash
bitcoin-cli -regtest testmempoolaccept '["<hex>"]'
```

## Documentation

- `BITCOIN_API.md` - Full API documentation
- `NEW_FEATURES.md` - UI features guide
- `README.md` - Complete app documentation

## Network Switching

Change network in proxy:
```bash
BITCOIN_NETWORK=testnet npm start
```

Change network in React app:
- Select network dropdown in UI
- Or edit `network` state default in App.jsx

## Security

⚠️ **Local use only!** The proxy has no authentication.

🔒 **Mainnet warning:** Always test on regtest/testnet first!
