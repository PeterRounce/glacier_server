# ✅ Bitcoin CLI Integration Complete!

## What's New

Your React timelock wallet app now **automatically interacts with Bitcoin Core** via a proxy server. No more copy-pasting commands between terminal and browser!

## 🎯 New Features

### 1. **Auto-Fetch Block Height**
- Updates every 10 seconds automatically
- Toggle on/off in Wallet Status
- Manual update still available

### 2. **Auto-Scan UTXOs**
- Click "Select to Unlock" on any timelock
- App automatically finds UTXOs for that address
- Form auto-fills with txid, vout, and amount

### 3. **Auto-Broadcast Transactions**
- After signing, transaction broadcasts automatically
- See TXID immediately
- Falls back to manual if broadcast fails

### 4. **Connection Status**
- Green badge ✓ = API connected (ready to use)
- Red badge ✗ = API disconnected (start proxy server to continue)
- **Bitcoin API is required** - app detects connection automatically

### 5. **Mine Blocks (Regtest)**
- Click "⛏️ Mine 5 Blocks" to instantly advance the blockchain
- Perfect for testing timelocks and confirming transactions
- Only available on regtest network (safe!)

## 📁 What Was Added

```
react-app/
├── proxy/                          # NEW: Bitcoin API Proxy Server
│   ├── package.json
│   ├── proxy-server.js            # 270 lines - HTTP ↔ bitcoin-cli bridge
│   └── node_modules/
│
├── client/
│   └── src/
│       ├── bitcoinApi.js          # NEW: API client wrapper
│       └── App.jsx                # UPDATED: Auto-fetch, scan, broadcast
│
├── start-all.sh                   # NEW: Start both servers at once
├── BITCOIN_API.md                 # NEW: Complete API documentation
├── BITCOIN_CLI_INTEGRATION.md     # NEW: Integration overview
└── QUICKSTART.md                  # NEW: Quick start guide
```

## 🚀 How to Run

### Quick Start (One Command)

```bash
cd /home/user/hack25/glacier_server/react-app
./start-all.sh
```

This starts:
1. Bitcoin API Proxy on port 3001
2. React App on port 5173

### Or Run Separately

**Terminal 1 - Bitcoin API Proxy:**
```bash
cd /home/user/hack25/glacier_server/react-app/proxy
node proxy-server.js
```

**Terminal 2 - React App:**
```bash
cd /home/user/hack25/glacier_server/react-app/client
npx vite@5
```

### Prerequisites

Make sure Bitcoin Core is running:
```bash
bitcoind -regtest -daemon
```

Or if already running, verify:
```bash
bitcoin-cli -regtest getblockcount
```

## 📖 Example Workflow

### Before (Manual - 10 steps)

1. `bitcoin-cli getblockcount` → copy height
2. Paste into app
3. Create timelock
4. Copy lockup address
5. `bitcoin-cli sendtoaddress <address> 0.001`
6. `bitcoin-cli generatetoaddress 1 <address>`
7. `bitcoin-cli listunspent` → find UTXO
8. Copy txid, vout, amount
9. Paste into app, sign transaction
10. Copy hex, `bitcoin-cli sendrawtransaction <hex>`

### After (Automatic - 5 steps)

1. Click +100 (block height auto-updates)
2. Create timelock
3. Fund address (still manual - bitcoin-cli)
4. Click "Select to Unlock" (UTXOs auto-scan)
5. Click "Unlock Timelock" (auto-broadcasts) ✨

**Saved: 5 manual steps, 3 terminal commands!**

## 🔌 API Endpoints

The proxy exposes these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/blockheight` | Current block height |
| GET | `/api/listunspent?address=...` | UTXOs for address |
| POST | `/api/sendrawtransaction` | Broadcast transaction |
| GET | `/api/blockchaininfo` | Blockchain info |
| GET | `/api/transaction/:txid` | Transaction details |
| POST | `/api/generatetoaddress` | Mine blocks (regtest) |

Add `?network=regtest` (or `testnet`, `mainnet`) to any endpoint.

## 🎨 UI Changes

### Wallet Status Section

**Before:**
```
💼 Wallet Status
Network: regtest
Lockup Index: 0
```

**After:**
```
💼 Wallet Status

Bitcoin API: ✓ Connected
☑ Auto-fetch block height

Network: regtest
Lockup Index: 0
```

### Timelock List

**Before:**
```
Timelock #1
Block Height: 150
Address: bcrt1q...
```

**After:**
```
Timelock #1                    [Select to Unlock]
Block Height: 150 ✓ Unlockable
Address: bcrt1q...
```

### Status Messages

Now you see real-time feedback:
- "Scanning for UTXOs..."
- "✓ Found UTXO: 0.001 BTC"
- "✓ Transaction broadcast successfully! TXID: abc123..."
- "✓ Block height updated: 155"

## 📚 Documentation

Three new guides have been created:

1. **`QUICKSTART.md`** - Start here! Quick setup and usage
2. **`BITCOIN_API.md`** - Complete API reference and troubleshooting
3. **`BITCOIN_CLI_INTEGRATION.md`** - Architecture and technical details

## 🔧 Configuration

### Change Network

**Proxy:**
```bash
BITCOIN_NETWORK=testnet node proxy-server.js
```

**React App:**
Use the network dropdown in the UI (defaults to regtest)

### Change Port

**Proxy:**
```bash
PORT=3002 node proxy-server.js
```

**React App:**
Edit `client/src/bitcoinApi.js`:
```javascript
const API_BASE_URL = 'http://localhost:3002';
```

Or set environment variable:
```bash
VITE_BITCOIN_API_URL=http://localhost:3002 npx vite@5
```

## 🛡️ Security Notes

⚠️ **The proxy has NO AUTHENTICATION** - local use only!

**Safe:**
- Running on localhost
- Testing on regtest/testnet
- Single-user development

**Unsafe:**
- Exposing to internet
- Running on public networks
- Using with mainnet funds (without hardening)

For production use, see `BITCOIN_API.md` security section.

## 🐛 Troubleshooting

### API shows disconnected

1. Check proxy is running: Look for "Server running on http://localhost:3001"
2. Check Bitcoin Core: `bitcoin-cli -regtest getblockcount`
3. Check PATH includes bitcoin-cli

### No UTXOs found

The address hasn't received funds yet:
```bash
bitcoin-cli -regtest sendtoaddress <lockup-address> 0.001
bitcoin-cli -regtest generatetoaddress 1 $(bitcoin-cli -regtest getnewaddress)
```

### Transaction broadcast fails

Common reasons:
- **"non-final"** - Timelock height not reached yet (mine more blocks)
- **"bad-txns-inputs-missingorspent"** - UTXO already spent or doesn't exist
- **"min relay fee not met"** - Increase fee in unlock form

Test transaction first:
```bash
bitcoin-cli -regtest testmempoolaccept '["<hex>"]'
```

### bitcoin-cli not found

Add to PATH:
```bash
export PATH="/home/user/hack25/glacier_server/bitcoin-27.0/bin:$PATH"
```

Add to `~/.zshrc` to make permanent.

## 🎯 Next Steps

1. **Start everything:**
   ```bash
   ./start-all.sh
   ```

2. **Open browser:** http://localhost:5173

3. **Check green badge** - Should say "✓ Connected"

4. **Test the workflow:**
   - Create or import wallet
   - Notice block height auto-updates
   - Create timelock (use quick buttons)
   - Fund the lockup address
   - Click "Select to Unlock" (watch it scan!)
   - Click "Unlock Timelock" (watch it broadcast!)

5. **Explore the API:**
   ```bash
   curl http://localhost:3001/api/blockheight?network=regtest
   curl "http://localhost:3001/api/listunspent?network=regtest"
   ```

## 💡 Tips

- **Always start both servers** with `./start-all.sh` for full functionality
- **Block height updates automatically** every 10 seconds
- **Check browser console** for detailed API logs
- **Use regtest** for fast testing (instant block generation)
- **Read BITCOIN_API.md** for advanced usage

## 📊 Summary

You now have:

✅ **Automatic block height updates** (every 10 seconds)  
✅ **Automatic UTXO scanning** (on timelock selection)  
✅ **Automatic transaction broadcasting** (after signing)  
✅ **Real-time status feedback** (connection, scanning, broadcasting)  
✅ **Connection detection** (shows error if proxy not running)  
✅ **Complete documentation** (3 new guides)  
✅ **One-command startup** (./start-all.sh)  

The app is now **production-ready for regtest/testnet** and provides a seamless user experience! 🚀

---

**Questions? Issues?**

Check the documentation:
- `QUICKSTART.md` - Quick setup
- `BITCOIN_API.md` - API reference  
- `BITCOIN_CLI_INTEGRATION.md` - Technical details

Happy timelocking! ⏰🔒
