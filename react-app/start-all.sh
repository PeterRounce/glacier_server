#!/bin/bash

# Glacier Timelock Wallet - Complete Startup Script
# This starts both the Bitcoin API proxy and the React frontend

echo "======================================"
echo "   GLACIER TIMELOCK WALLET"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo ""

# Check if Bitcoin CLI is available
if ! command -v bitcoin-cli &> /dev/null; then
    echo "⚠️  Warning: bitcoin-cli not found in PATH"
    echo "   Make sure Bitcoin Core is installed and running"
    echo ""
else
    echo "✓ bitcoin-cli found"
    echo ""
fi

# Start Bitcoin API Proxy
echo "🚀 Starting Bitcoin API Proxy..."
cd proxy

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "   Installing proxy dependencies..."
    npm install
fi

# Start proxy server in background
node proxy-server.js &
PROXY_PID=$!
echo "✓ Proxy server started (PID: $PROXY_PID)"
echo "   API available at: http://localhost:3001"
echo ""

# Wait for proxy to be ready
sleep 2

# Start React App
echo "🚀 Starting React App..."
cd ../client

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "   Installing client dependencies..."
    npm install
fi

echo "✓ Starting Vite dev server..."
echo "   App will be available at: http://localhost:5173"
echo ""
echo "======================================"
echo "   Both servers are running!"
echo "======================================"
echo ""
echo "   React App: http://localhost:5173"
echo "   API Proxy: http://localhost:3001"
echo ""
echo "   Press Ctrl+C to stop both servers"
echo ""

# Start Vite (this will block)
npx vite@5

# Cleanup: Kill proxy server when Vite stops
echo ""
echo "Shutting down..."
kill $PROXY_PID 2>/dev/null
echo "✓ All servers stopped"
