# Glacier Timelock Wallet - Standalone React App

## Overview

This is a **completely standalone Bitcoin timelock wallet** built with React. All Bitcoin wallet logic runs **client-side in your browser** - no backend server required!

## What's Different?

### Original Version (server.js)
- ❌ Requires Node.js server running
- ❌ API endpoints
- ❌ Server-side wallet storage

### New React App Version
- ✅ **No server required** - Runs entirely in browser
- ✅ **All logic client-side** - Complete wallet in JavaScript
- ✅ **Portable** - Can run from file:// or any web server
- ✅ **Export/Import** - Save and restore wallet state

## Installation

```bash
cd react-app
npm run install-all
```

Or manually:

```bash
cd react-app/client
npm install
```

## Running the App

```bash
cd react-app
npm run dev
```

Open your browser to: **http://localhost:5173**

## Architecture

```
┌─────────────────────────────────────┐
│                                     │
│         Browser (React App)         │
│                                     │
│  ┌───────────────────────────────┐ │
│  │      App.jsx (UI)             │ │
│  └────────────┬──────────────────┘ │
│               │                     │
│  ┌────────────▼──────────────────┐ │
│  │  walletService.js             │ │
│  │                               │ │
│  │  • Mnemonic Generation        │ │
│  │  • HD Key Derivation          │ │
│  │  • Address Generation         │ │
│  │  • Timelock Creation          │ │
│  │  • Transaction Signing        │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

## How It Works

### 1. Wallet Initialization

```javascript
// Generate or import mnemonic
walletService.initWallet(mnemonic, mainnet, network);
```

All BIP39/BIP32 operations happen in the browser using:
- `bip39` - Mnemonic generation
- `bip32` - HD key derivation
- `bitcoinjs-lib` - Bitcoin operations

### 2. Create Timelock

```javascript
const result = walletService.createTimelock(blockHeight);
// Returns: { p2shAddress, redeemScript, ... }
```

Creates:
- Lockup address (BIP84 path: m/84'/0'/0'/0/n)
- Released address (BIP84 path: m/84'/0'/1'/0/n)
- Timelock redeem script (OP_CHECKLOCKTIMEVERIFY)
- P2SH address for receiving funds

### 3. Unlock Timelock

```javascript
const result = walletService.unlockTimelock(
  timelockId, txid, vout, amount, fee
);
// Returns: { signedTransaction, txid, ... }
```

Signs transaction entirely in the browser:
- Builds raw transaction
- Creates signature hash
- Signs with private key
- Constructs scriptSig
- Returns hex for broadcasting

## File Structure

```
react-app/
├── client/
│   ├── src/
│   │   ├── App.jsx              # Main React component
│   │   │   - Wallet initialization UI
│   │   │   - Timelock creation form
│   │   │   - Unlock transaction form
│   │   │   - Timelock list display
│   │   │
│   │   ├── walletService.js     # Complete wallet logic
│   │   │   - initWallet()       # Create/import wallet
│   │   │   - createTimelock()   # Create timelock
│   │   │   - unlockTimelock()   # Sign transaction
│   │   │   - exportState()      # Backup wallet
│   │   │   - importState()      # Restore wallet
│   │   │
│   │   ├── main.jsx             # App entry point
│   │   └── index.css            # Styles
│   │
│   ├── index.html               # HTML template
│   ├── vite.config.js           # Vite configuration
│   └── package.json             # Dependencies
│
├── server/                      # (Not needed anymore!)
├── package.json                 # Root scripts
├── install.sh                   # Quick install script
└── README.md                    # Documentation
```

## Key Features

### 🔐 HD Wallet
- **24-word mnemonic** (BIP39)
- **Hierarchical deterministic** addresses (BIP32)
- **Native SegWit** (BIP84)
- **Separate accounts** for lockup and released funds

### ⏰ Timelocks
- **OP_CHECKLOCKTIMEVERIFY** - Protocol-level enforcement
- **Predefined recipient** - Secure to specific address
- **P2SH addresses** - Standard Bitcoin format
- **Manual transaction signing** - Full control

### 💾 Backup & Restore
- **Export wallet state** to JSON
- **Import from backup** or mnemonic
- **Portable** - Move between devices

### 🌐 Network Support
- **Mainnet** - Real Bitcoin
- **Testnet** - Test network
- **Regtest** - Local testing

## Usage Example

### 1. Initialize Wallet

```
1. Open app in browser
2. Select "Regtest" network
3. Click "Create New Wallet"
4. SAVE the 24-word mnemonic!
```

### 2. Create Timelock

```
1. Enter block height (e.g., 315)
2. Click "Create Timelock"
3. Copy the P2SH address
4. Send Bitcoin to that address
```

### 3. Fund the Timelock

```bash
# Using bitcoin-cli
bitcoin-cli -regtest sendtoaddress <P2SH_ADDRESS> 0.001

# Mine a block to confirm
bitcoin-cli -regtest generatetoaddress 1 <YOUR_ADDRESS>
```

### 4. Unlock Timelock

```
1. Wait for block height to be reached
2. Get TXID and vout from funding transaction
3. Enter details in "Unlock Timelock" form
4. Click "Unlock Timelock"
5. Copy the signed transaction hex
6. Broadcast using bitcoin-cli
```

### 5. Broadcast Transaction

```bash
bitcoin-cli -regtest sendrawtransaction <SIGNED_TX_HEX>
```

## Browser Compatibility

- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Edge
- ✅ Safari (with WebCrypto)

Requires:
- ES6+ support
- WebCrypto API
- BigInt support

## Security Considerations

### ⚠️ Important

1. **Not a production wallet** - This is educational/demo code
2. **Private keys in memory** - Not encrypted at rest in browser
3. **No hardware wallet support** - Pure software signing
4. **Test with small amounts** - Especially on mainnet

### Best Practices

1. **Backup your mnemonic** - Write it down on paper
2. **Test on regtest/testnet first** - Don't risk real funds
3. **Use hardware wallet for large amounts** - Ledger/Trezor
4. **Run offline for cold storage** - Air-gapped computer
5. **Clear browser cache** - After using

### For Production

To adapt this for production use:

1. **Add encryption** - Encrypt mnemonic/keys with password
2. **Hardware wallet integration** - Use Ledger/Trezor APIs
3. **Multi-signature** - Require multiple keys
4. **Code audit** - Professional security review
5. **Offline signing** - Use on air-gapped device
6. **HTTPS only** - Never use on HTTP
7. **Content Security Policy** - Restrict script execution

## Development

### Run Dev Server

```bash
cd client
npm run dev
```

### Build for Production

```bash
cd client
npm run build
```

Output in `client/dist/`

### Preview Production Build

```bash
cd client
npm run preview
```

## Testing Workflow

```bash
# 1. Start Bitcoin daemon
../bitcoin-27.0/bin/bitcoind -regtest -daemon -fallbackfee=0.00001

# 2. Create wallet
bitcoin-cli -regtest createwallet "test"

# 3. Generate initial blocks
ADDR=$(bitcoin-cli -regtest getnewaddress)
bitcoin-cli -regtest generatetoaddress 101 $ADDR

# 4. Start React app
cd react-app
npm run dev

# 5. In browser (http://localhost:5173):
#    - Create new wallet
#    - Create timelock for block 315
#    - Copy P2SH address

# 6. Send to P2SH
bitcoin-cli -regtest sendtoaddress <P2SH_ADDR> 0.001
bitcoin-cli -regtest generatetoaddress 1 $ADDR

# 7. Get transaction details
TXID=$(bitcoin-cli -regtest listtransactions "*" 1 | jq -r '.[0].txid')
VOUT=$(bitcoin-cli -regtest gettransaction $TXID | jq -r '.details[] | select(.address == "<P2SH_ADDR>") | .vout')

# 8. Mine to block height
bitcoin-cli -regtest generatetoaddress 214 $ADDR

# 9. In browser:
#    - Enter timelock ID: 0
#    - Enter TXID and vout
#    - Enter amount: 0.001
#    - Click "Unlock Timelock"
#    - Copy signed transaction hex

# 10. Broadcast
bitcoin-cli -regtest sendrawtransaction <SIGNED_TX_HEX>
bitcoin-cli -regtest generatetoaddress 1 $ADDR
```

## Comparison with Server Version

| Feature | Server Version | React App Version |
|---------|---------------|-------------------|
| **Runtime** | Node.js server | Browser only |
| **Installation** | npm install + node server.js | npm install + npm run dev |
| **Dependencies** | Express, Bitcoin libs | React, Bitcoin libs |
| **Storage** | Server memory | Browser memory |
| **API** | REST endpoints | Direct function calls |
| **Portability** | Needs server | Runs anywhere |
| **Complexity** | Higher | Lower |
| **Use Case** | Multi-user service | Personal wallet |

## Troubleshooting

### Buffer is not defined

Add to `vite.config.js`:
```javascript
import { Buffer } from 'buffer'
window.Buffer = Buffer
```

### Crypto module not found

Install polyfills:
```bash
npm install crypto-browserify stream-browserify
```

### Transaction fails to broadcast

1. Check block height is reached
2. Verify TXID and vout are correct
3. Check amount matches UTXO
4. Ensure fee is not too high or low

## Next Steps

1. **Try it out** - Create a timelock on regtest
2. **Understand the code** - Read walletService.js
3. **Customize** - Add your own features
4. **Deploy** - Build and host on GitHub Pages
5. **Share** - Help others learn Bitcoin!

## Resources

- [BIP32 Specification](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP39 Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP84 Specification](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)
- [OP_CHECKLOCKTIMEVERIFY](https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki)
- [bitcoinjs-lib Documentation](https://github.com/bitcoinjs/bitcoinjs-lib)

## License

MIT
