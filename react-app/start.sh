#!/bin/bash

# 🏔️ Glacier Timelock Wallet - Quick Demo
# This script demonstrates the standalone React app

echo "╔════════════════════════════════════════════════════════╗"
echo "║  🏔️  Glacier Timelock Wallet - Standalone React App  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if dependencies are installed
if [ ! -d "client/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd client && npm install && cd ..
    echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "🎯 What can this app do?"
echo "   • Generate HD wallets (BIP32/BIP39/BIP84)"
echo "   • Create Bitcoin timelocks (OP_CHECKLOCKTIMEVERIFY)"
echo "   • Sign transactions in the browser"
echo "   • Export/import wallet state"
echo "   • Works completely offline!"
echo ""
echo "🚀 Starting the React app..."
echo ""
echo "   The app will open at: http://localhost:5173"
echo ""
echo "📚 Quick Guide:"
echo "   1. Create a new wallet (save the mnemonic!)"
echo "   2. Create a timelock with a block height"
echo "   3. Send BTC to the P2SH address"
echo "   4. After block height, unlock and sign"
echo "   5. Broadcast with bitcoin-cli"
echo ""
echo "📖 Documentation:"
echo "   • README.md          - User guide"
echo "   • GUIDE.md           - Technical details"
echo "   • CONVERSION_GUIDE.md - How it was converted"
echo "   • SUMMARY.md         - Quick overview"
echo ""
echo "⚠️  Security Notes:"
echo "   • This is a demo/educational tool"
echo "   • Always backup your mnemonic"
echo "   • Test on regtest/testnet first"
echo "   • Use small amounts"
echo ""
echo "════════════════════════════════════════════════════════"
echo ""
read -p "Press Enter to start the app..."
echo ""

cd client && npx vite@5
