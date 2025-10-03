# Glacier Timelock Wallet - React App with Bitcoin CLI Integration

A **fully-featured** Bitcoin timelock wallet application built with React. All Bitcoin wallet logic runs in your browser, with optional automatic integration to Bitcoin Core via a lightweight proxy server!

## ✨ Features

- 🔐 **HD Wallet** (BIP32/BIP39/BIP84) - Complete wallet in the browser
- ⏰ **Bitcoin Timelocks** (OP_CHECKLOCKTIMEVERIFY) - Time-locked transactions
- ⚛️ **Modern React UI** - Clean, responsive interface
- 💾 **Export/Import** - Backup and restore your wallet
- 🌐 **Network Support** - Mainnet/Testnet/Regtest
- 🔒 **Secure** - Private keys never leave your browser

### 🚀 NEW: Bitcoin CLI Integration

- **Auto-fetch block height** - Updates every 10 seconds
- **Auto-scan UTXOs** - Finds unspent outputs automatically
- **Auto-broadcast transactions** - One-click transaction broadcasting
- **Real-time feedback** - See blockchain status instantly
- **Works offline too** - All features available without the API

## 🎯 Quick Start

### One-Command Setup

```bash
cd /home/user/hack25/glacier_server/react-app
./start-all.sh
```

This starts:
- Bitcoin API Proxy (port 3001)
- React App (port 5173)

Then open: **http://localhost:5173**

### Or Run Separately

**Terminal 1 - Bitcoin API Proxy:**
```bash
cd proxy
npm install  # first time only
node proxy-server.js
```

**Terminal 2 - React App:**
```bash
cd client
npm install  # first time only
npx vite@5
```

### Prerequisites

Make sure Bitcoin Core is running:
```bash
bitcoind -regtest -daemon
```

## How It Works

This is a **completely standalone** React application. All Bitcoin wallet functionality runs client-side:

- ✅ Mnemonic generation (BIP39)
- ✅ HD key derivation (BIP32)
- ✅ Address generation (BIP84)
- ✅ Timelock script creation
- ✅ Transaction signing
- ✅ P2SH address creation

**No backend server needed!**

## Project Structure

```
react-app/
├── client/                    # Standalone React app
│   ├── src/
│   │   ├── App.jsx           # Main React component
│   │   ├── walletService.js  # All Bitcoin wallet logic
│   │   ├── main.jsx          # Entry point
│   │   └── index.css         # Styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── package.json              # Root scripts
```

## Usage

### 1. Initialize Wallet

- **Create New**: Generate a new 24-word mnemonic
- **Import Existing**: Use an existing mnemonic phrase
- **Import Backup**: Load a previously exported wallet

### 2. Create Timelock

1. Enter the block height for the timelock
2. Click "Create Timelock"
3. Send Bitcoin to the generated P2SH address

### 3. Unlock Timelock

1. Wait for the specified block height
2. Enter the timelock ID, TXID, vout, and amount
3. Click "Unlock Timelock"
4. Broadcast the signed transaction using `bitcoin-cli`

### 4. Backup Your Wallet

- Always backup your **24-word mnemonic**
- Use "Export Wallet" to save the full state
- Store backups securely offline

## Security Notes

⚠️ **Important Security Considerations:**

- **Private keys are stored in browser memory** - Not encrypted at rest
- **This is a development/demo application** - Not audited for production use
- **Always backup your mnemonic** - You cannot recover funds without it
- **Test with small amounts first** - Especially on mainnet
- **Use hardware wallets for large amounts** - This is for education/testing

### For Production Use:

- ✅ Run offline on an air-gapped computer
- ✅ Use a hardware wallet for key storage
- ✅ Encrypt wallet backups
- ✅ Use multi-signature setups for large amounts
- ✅ Test thoroughly on testnet first

## Development

### Run Development Server

```bash
cd client
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Testing with Bitcoin Regtest

```bash
# Start Bitcoin daemon
../bitcoin-27.0/bin/bitcoind -regtest -daemon -fallbackfee=0.00001

# Create wallet
bitcoin-cli -regtest createwallet "test"

# Generate blocks
ADDR=$(bitcoin-cli -regtest getnewaddress)
bitcoin-cli -regtest generatetoaddress 101 $ADDR

# Send to P2SH address (from the app)
bitcoin-cli -regtest sendtoaddress <P2SH_ADDRESS> 0.001

# Mine blocks
bitcoin-cli -regtest generatetoaddress 1 $ADDR

# After unlocking in the app, broadcast transaction
bitcoin-cli -regtest sendrawtransaction <SIGNED_TX_HEX>
```

## Technical Details

### BIP Standards

- **BIP39**: Mnemonic code for generating deterministic keys
- **BIP32**: Hierarchical Deterministic Wallets
- **BIP84**: Derivation scheme for P2WPKH (Native SegWit)

### Derivation Paths

- **Lockup Account**: `m/84'/0'/0'/0/*` (or `m/84'/1'/0'/0/*` for testnet)
- **Released Account**: `m/84'/0'/1'/0/*` (or `m/84'/1'/1'/0/*` for testnet)

### Libraries Used

- `bitcoinjs-lib` - Bitcoin transaction building
- `bip32` - HD key derivation
- `bip39` - Mnemonic generation
- `tiny-secp256k1` - Elliptic curve cryptography

## License

MIT
