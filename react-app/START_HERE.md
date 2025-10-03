# 🏔️ START HERE - Glacier Timelock Wallet (Standalone React App)

## 🎉 What You Got

A **fully standalone Bitcoin timelock wallet** that runs **entirely in your browser** - NO server needed!

## ⚡ Quick Start (3 Steps)

```bash
# 1. Install
./install.sh

# 2. Start
./start.sh

# 3. Open browser
http://localhost:5173
```

That's it! 🚀

## 📂 What's in This Folder?

```
react-app/
├── 📖 START_HERE.md        ← You are here!
├── 📖 README.md            ← User guide
├── 📖 SUMMARY.md           ← What was built
├── 📖 GUIDE.md             ← Technical details
├── 📖 CONVERSION_GUIDE.md  ← How it was converted
│
├── 🚀 start.sh             ← Run this to start!
├── 📦 install.sh           ← Run this first
├── 📄 package.json         ← Root config
│
└── client/                 ← React app
    ├── src/
    │   ├── App.jsx              ← Main UI
    │   ├── walletService.js     ← All Bitcoin logic
    │   ├── main.jsx             ← Entry point
    │   └── index.css            ← Styles
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## 🎯 What Can This Do?

✅ **Generate HD Wallets** - BIP39 24-word mnemonic  
✅ **Create Timelocks** - Lock Bitcoin until a future block  
✅ **Sign Transactions** - All in the browser  
✅ **Export/Import** - Backup and restore wallet  
✅ **Works Offline** - After initial load  
✅ **No Server** - Pure client-side  

## 📖 Which Document Should I Read?

| If you want to... | Read this |
|-------------------|-----------|
| **Get started quickly** | START_HERE.md (you're reading it!) |
| **Learn how to use it** | README.md |
| **Understand what was built** | SUMMARY.md |
| **Deep technical dive** | GUIDE.md |
| **See how it was converted** | CONVERSION_GUIDE.md |

## 🚀 Tutorial: Create Your First Timelock

### Step 1: Start Bitcoin (for testing)

```bash
# In terminal 1
cd ..
./bitcoin-27.0/bin/bitcoind -regtest -daemon -fallbackfee=0.00001
./bitcoin-27.0/bin/bitcoin-cli -regtest createwallet "test"

# Generate some blocks
ADDR=$(./bitcoin-27.0/bin/bitcoin-cli -regtest getnewaddress)
./bitcoin-27.0/bin/bitcoin-cli -regtest generatetoaddress 101 $ADDR
```

### Step 2: Start the App

```bash
# In terminal 2
cd react-app
./start.sh
```

Open: http://localhost:5173

### Step 3: Initialize Wallet

1. Select **"Regtest"** network
2. Click **"Create New Wallet"**
3. **SAVE THE MNEMONIC!** (Write it down)

### Step 4: Create Timelock

1. Enter block height: **315**
2. Click **"Create Timelock"**
3. Copy the **P2SH address** (starts with `2...`)

### Step 5: Send Bitcoin

```bash
# In terminal 1
bitcoin-cli -regtest sendtoaddress <P2SH_ADDRESS> 0.001
bitcoin-cli -regtest generatetoaddress 1 $ADDR

# Get transaction details
TXID=$(bitcoin-cli -regtest listtransactions "*" 1 | jq -r '.[0].txid')
echo "TXID: $TXID"

# Get vout (usually 0 or 1)
bitcoin-cli -regtest gettransaction $TXID
```

### Step 6: Mine to Block Height

```bash
# Mine to block 315
bitcoin-cli -regtest getblockcount  # Check current height
bitcoin-cli -regtest generatetoaddress 214 $ADDR  # Mine more blocks
```

### Step 7: Unlock Timelock

In the app:
1. Enter **Timelock ID**: 0
2. Enter **TXID**: (from step 5)
3. Enter **Vout**: (from step 5, usually 0 or 1)
4. Enter **Amount**: 0.001
5. Enter **Fee**: 500
6. Click **"Unlock Timelock"**
7. Copy the **transaction hex**

### Step 8: Broadcast

```bash
bitcoin-cli -regtest sendrawtransaction <TRANSACTION_HEX>
bitcoin-cli -regtest generatetoaddress 1 $ADDR
```

### Step 9: Verify

```bash
# Check balance on released address
bitcoin-cli -regtest listunspent
```

🎉 **Success!** You've created and unlocked a Bitcoin timelock!

## 🔐 Security Checklist

Before using with real Bitcoin:

- [ ] Backed up mnemonic on paper
- [ ] Tested on regtest
- [ ] Tested on testnet
- [ ] Understand the risks
- [ ] Use small amounts first
- [ ] Have recovery plan
- [ ] Cleared browser cache after use

## 🆘 Troubleshooting

### "npm: command not found"
Install Node.js: https://nodejs.org/

### "Port 5173 already in use"
Stop other Vite dev servers or change port in vite.config.js

### "Buffer is not defined"
Already fixed! Check that `main.jsx` has `window.Buffer = Buffer`

### "ESM integration proposal for Wasm"
Already fixed! We use `vite-plugin-wasm` to handle WebAssembly modules

### "Transaction fails to broadcast"
- Check block height is reached
- Verify TXID/vout are correct
- Check amount matches UTXO
- Verify fee is reasonable

### "Wallet won't initialize"
- Check browser console for errors
- Try clearing browser cache
- Make sure all dependencies installed

## 📚 Learn More

- **BIP39**: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- **BIP32**: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- **BIP84**: https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki
- **Timelocks**: https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki

## 🎓 What This Teaches

1. **HD Wallets** - How Bitcoin wallets derive keys
2. **Timelocks** - Time-based Bitcoin constraints
3. **Transaction Signing** - Low-level Bitcoin operations
4. **Client-Side Crypto** - Cryptography in browsers
5. **React Development** - Modern web app structure

## 🚢 Deployment Options

### GitHub Pages
```bash
cd client
npm run build
# Upload dist/ to GitHub Pages
```

### Netlify
```bash
cd client
npm run build
# Drag dist/ to Netlify
```

### Run Offline
```bash
cd client
npm run build
# Copy dist/ to USB
# Open dist/index.html in browser
```

## ⚠️ Important Warnings

1. **Educational Tool** - Not audited for production
2. **Test First** - Use regtest/testnet before mainnet
3. **Backup Mnemonic** - Only way to recover funds
4. **Small Amounts** - Start small, test thoroughly
5. **Hardware Wallet** - Use for large amounts
6. **No Warranty** - Use at your own risk

## 🤝 Need Help?

1. **Read the docs** - Check README.md and GUIDE.md
2. **Check console** - Browser DevTools (F12)
3. **Review code** - src/walletService.js has all logic
4. **Test on regtest** - Safe environment for testing

## 🎉 You're Ready!

Run `./start.sh` and start exploring!

Remember:
- 💾 **Backup your mnemonic**
- 🧪 **Test on regtest first**
- 💰 **Use small amounts**
- 📚 **Read the documentation**

Happy building! 🏔️⚡
