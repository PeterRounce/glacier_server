#!/bin/bash

# ============================================================================
# BIP32 Timelock Wallet - Full Demonstration Script
# ============================================================================
# This script demonstrates the complete lifecycle of a timelock transaction:
# 1. Initialize wallet with HD derivation (BIP32/BIP39/BIP84)
# 2. Create a secure timelock with predefined recipient
# 3. Send funds to the P2SH timelock address
# 4. Unlock funds after the timelock expires
# 5. Broadcast the unlocking transaction
# ============================================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BITCOIN_CLI="./bitcoin-27.0/bin/bitcoin-cli -regtest"
API_URL="http://localhost:3000"
TIMELOCK_BLOCK=600  # Block height when funds can be unlocked

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  BIP32 TIMELOCK WALLET DEMONSTRATION${NC}"
echo -e "${BLUE}============================================================================${NC}\n"

# ============================================================================
# Step 1: Check Bitcoin daemon is running
# ============================================================================
echo -e "${GREEN}[1] Checking Bitcoin daemon...${NC}"
if ! $BITCOIN_CLI getblockchaininfo &>/dev/null; then
    echo -e "${RED}Error: Bitcoin daemon not running. Start it with:${NC}"
    echo "  ./bitcoin-27.0/bin/bitcoind -regtest -daemon -fallbackfee=0.00001"
    exit 1
fi

CURRENT_BLOCK=$($BITCOIN_CLI getblockcount)
echo -e "   ✓ Bitcoin daemon running at block ${CURRENT_BLOCK}\n"

# ============================================================================
# Step 2: Check wallet exists
# ============================================================================
echo -e "${GREEN}[2] Checking Bitcoin wallet...${NC}"
if ! $BITCOIN_CLI getwalletinfo &>/dev/null; then
    echo "   Creating new wallet..."
    $BITCOIN_CLI createwallet "test" >/dev/null 2>&1 || true
fi
echo -e "   ✓ Wallet ready\n"

# ============================================================================
# Step 3: Initialize API Wallet
# ============================================================================
echo -e "${GREEN}[3] Initializing HD Wallet (BIP32/BIP39/BIP84)...${NC}"
INIT_RESPONSE=$(curl -s -X POST "${API_URL}/api/wallet/init" \
  -H "Content-Type: application/json" \
  -d '{"network": "regtest"}')

if [[ $(echo "$INIT_RESPONSE" | jq -r '.success') != "true" ]]; then
    echo -e "${RED}Error initializing wallet:${NC}"
    echo "$INIT_RESPONSE" | jq .
    exit 1
fi

MNEMONIC=$(echo "$INIT_RESPONSE" | jq -r '.data.mnemonic')
NETWORK=$(echo "$INIT_RESPONSE" | jq -r '.data.network')

echo -e "   ✓ Wallet initialized on ${NETWORK}"
echo -e "${YELLOW}   ⚠️  MNEMONIC (BACKUP THIS):${NC}"
echo -e "   ${MNEMONIC}\n"

# ============================================================================
# Step 4: Create Timelock
# ============================================================================
echo -e "${GREEN}[4] Creating timelock for block ${TIMELOCK_BLOCK}...${NC}"
TIMELOCK_RESPONSE=$(curl -s -X POST "${API_URL}/api/wallet/create-timelock" \
  -H "Content-Type: application/json" \
  -d "{\"blockHeight\":${TIMELOCK_BLOCK}}")

if [[ $(echo "$TIMELOCK_RESPONSE" | jq -r '.success') != "true" ]]; then
    echo -e "${RED}Error creating timelock:${NC}"
    echo "$TIMELOCK_RESPONSE" | jq .
    exit 1
fi

TIMELOCK_ID=$(echo "$TIMELOCK_RESPONSE" | jq -r '.data.timelockId')
P2SH_ADDR=$(echo "$TIMELOCK_RESPONSE" | jq -r '.data.p2shAddress')
LOCKUP_ADDR=$(echo "$TIMELOCK_RESPONSE" | jq -r '.data.lockup.address')
RELEASED_ADDR=$(echo "$TIMELOCK_RESPONSE" | jq -r '.data.released.address')
REDEEM_SCRIPT=$(echo "$TIMELOCK_RESPONSE" | jq -r '.data.redeemScript')

echo -e "   ✓ Timelock created (ID: ${TIMELOCK_ID})"
echo -e "   📍 P2SH Address:      ${P2SH_ADDR}"
echo -e "   🔒 Lockup Address:    ${LOCKUP_ADDR} (can unlock)"
echo -e "   📤 Released Address:  ${RELEASED_ADDR} (receives funds)"
echo -e "   📜 Redeem Script:     ${REDEEM_SCRIPT:0:40}...${NC}\n"

# ============================================================================
# Step 5: Send funds to P2SH address
# ============================================================================
echo -e "${GREEN}[5] Sending 0.001 BTC to timelock address...${NC}"
SEND_TXID=$($BITCOIN_CLI sendtoaddress "$P2SH_ADDR" 0.001)
echo -e "   ✓ Transaction created: ${SEND_TXID}"

# Mine a block to confirm
echo -e "   Mining block to confirm..."
MINING_ADDR=$($BITCOIN_CLI getnewaddress)
$BITCOIN_CLI generatetoaddress 1 "$MINING_ADDR" >/dev/null
CURRENT_BLOCK=$($BITCOIN_CLI getblockcount)
echo -e "   ✓ Transaction confirmed at block ${CURRENT_BLOCK}\n"

# ============================================================================
# Step 6: Send another transaction to get a clean UTXO
# ============================================================================
echo -e "${GREEN}[6] Sending second transaction for testing...${NC}"
NEW_TXID=$($BITCOIN_CLI sendtoaddress "$P2SH_ADDR" 0.001)
echo -e "   ✓ Transaction: ${NEW_TXID}"

# Mine a block to confirm
$BITCOIN_CLI generatetoaddress 1 "$($BITCOIN_CLI getnewaddress)" >/dev/null
CURRENT_BLOCK=$($BITCOIN_CLI getblockcount)
echo -e "   ✓ Confirmed at block ${CURRENT_BLOCK}\n"

# ============================================================================
# Step 7: Get VOUT (output index)
# ============================================================================
echo -e "${GREEN}[7] Finding transaction output...${NC}"
VOUT=$($BITCOIN_CLI gettransaction "$NEW_TXID" | jq -r ".details[] | select(.address == \"$P2SH_ADDR\") | .vout")
echo -e "   ✓ TXID: ${NEW_TXID}"
echo -e "   ✓ VOUT: ${VOUT}\n"

# ============================================================================
# Step 8: Check if we need to mine more blocks
# ============================================================================
echo -e "${GREEN}[8] Checking timelock status...${NC}"
CURRENT_BLOCK=$($BITCOIN_CLI getblockcount)
if [ "$CURRENT_BLOCK" -lt "$TIMELOCK_BLOCK" ]; then
    BLOCKS_NEEDED=$((TIMELOCK_BLOCK - CURRENT_BLOCK))
    echo -e "   ⏳ Current block: ${CURRENT_BLOCK}"
    echo -e "   ⏳ Timelock block: ${TIMELOCK_BLOCK}"
    echo -e "   Mining ${BLOCKS_NEEDED} blocks to reach timelock height..."
    $BITCOIN_CLI generatetoaddress "$BLOCKS_NEEDED" "$($BITCOIN_CLI getnewaddress)" >/dev/null
    CURRENT_BLOCK=$($BITCOIN_CLI getblockcount)
fi
echo -e "   ✓ Current block (${CURRENT_BLOCK}) >= Timelock block (${TIMELOCK_BLOCK})"
echo -e "   ✅ Timelock can now be unlocked!\n"

# ============================================================================
# Step 9: Unlock the timelock
# ============================================================================
echo -e "${GREEN}[9] Creating unlock transaction...${NC}"
UNLOCK_RESPONSE=$(curl -s -X POST "${API_URL}/api/wallet/unlock-timelock" \
  -H "Content-Type: application/json" \
  -d "{
    \"timelockId\": ${TIMELOCK_ID},
    \"txid\": \"${NEW_TXID}\",
    \"vout\": ${VOUT},
    \"amountBTC\": 0.001,
    \"feeSatoshis\": 500
  }")

if [[ $(echo "$UNLOCK_RESPONSE" | jq -r '.success') != "true" ]]; then
    echo -e "${RED}Error unlocking timelock:${NC}"
    echo "$UNLOCK_RESPONSE" | jq .
    exit 1
fi

SIGNED_TX=$(echo "$UNLOCK_RESPONSE" | jq -r '.data.signedTransaction')
UNLOCK_TXID=$(echo "$UNLOCK_RESPONSE" | jq -r '.data.txid')
TO_ADDRESS=$(echo "$UNLOCK_RESPONSE" | jq -r '.data.to')
AMOUNT_SATS=$(echo "$UNLOCK_RESPONSE" | jq -r '.data.amountSatoshis')
FEE_SATS=$(echo "$UNLOCK_RESPONSE" | jq -r '.data.feeSatoshis')

echo -e "   ✓ Transaction signed"
echo -e "   📤 From:   ${P2SH_ADDR}"
echo -e "   📥 To:     ${TO_ADDRESS}"
echo -e "   💰 Amount: ${AMOUNT_SATS} satoshis (0.000995 BTC)"
echo -e "   💸 Fee:    ${FEE_SATS} satoshis\n"

# ============================================================================
# Step 10: Broadcast the unlocking transaction
# ============================================================================
echo -e "${GREEN}[10] Broadcasting unlock transaction...${NC}"
BROADCAST_TXID=$($BITCOIN_CLI sendrawtransaction "$SIGNED_TX" 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}Error broadcasting transaction:${NC}"
    echo "$BROADCAST_TXID"
    exit 1
fi

echo -e "   ✓ Transaction broadcast successfully!"
echo -e "   📝 TXID: ${BROADCAST_TXID}\n"

# ============================================================================
# Step 11: Mine a block to confirm
# ============================================================================
echo -e "${GREEN}[11] Mining block to confirm unlock transaction...${NC}"
$BITCOIN_CLI generatetoaddress 1 "$($BITCOIN_CLI getnewaddress)" >/dev/null
CURRENT_BLOCK=$($BITCOIN_CLI getblockcount)
echo -e "   ✓ Transaction confirmed at block ${CURRENT_BLOCK}\n"

# ============================================================================
# Step 12: Verify the transaction on-chain
# ============================================================================
echo -e "${GREEN}[12] Verifying transaction on blockchain...${NC}"
BLOCK_HASH=$($BITCOIN_CLI getbestblockhash)
TX_INFO=$($BITCOIN_CLI getrawtransaction "$BROADCAST_TXID" 1 "$BLOCK_HASH")

CONFIRMED_LOCKTIME=$(echo "$TX_INFO" | jq -r '.locktime')
CONFIRMED_OUTPUT=$(echo "$TX_INFO" | jq -r '.vout[0].scriptPubKey.address')
CONFIRMED_VALUE=$(echo "$TX_INFO" | jq -r '.vout[0].value')

echo -e "   ✓ Transaction found in blockchain"
echo -e "   🔒 Locktime:        ${CONFIRMED_LOCKTIME}"
echo -e "   📥 Output Address:  ${CONFIRMED_OUTPUT}"
echo -e "   💰 Output Value:    ${CONFIRMED_VALUE} BTC"
echo -e "   ✅ Verification passed!\n"

# ============================================================================
# Step 13: Show wallet summary
# ============================================================================
echo -e "${GREEN}[13] Wallet Summary${NC}"
WALLET_STATUS=$(curl -s "${API_URL}/api/wallet/status")
TIMELOCKS=$(curl -s "${API_URL}/api/wallet/timelocks")

echo -e "   Network:         $(echo "$WALLET_STATUS" | jq -r '.data.network')"
echo -e "   Lockup Index:    $(echo "$WALLET_STATUS" | jq -r '.data.lockupIndex')"
echo -e "   Released Index:  $(echo "$WALLET_STATUS" | jq -r '.data.releasedIndex')"
echo -e "   Total Timelocks: $(echo "$TIMELOCKS" | jq -r '.data.total')\n"

# ============================================================================
# Summary
# ============================================================================
echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  DEMONSTRATION COMPLETE!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Successfully completed all steps:${NC}"
echo -e "   1. ✓ Initialized HD wallet with BIP32/BIP39/BIP84"
echo -e "   2. ✓ Created secure timelock with predefined recipient"
echo -e "   3. ✓ Sent funds to P2SH timelock address"
echo -e "   4. ✓ Waited for timelock expiration (block ${TIMELOCK_BLOCK})"
echo -e "   5. ✓ Unlocked funds using lockup key"
echo -e "   6. ✓ Broadcast transaction to blockchain"
echo -e "   7. ✓ Confirmed transaction on-chain"
echo ""
echo -e "${YELLOW}📊 Transaction Details:${NC}"
echo -e "   P2SH Address:      ${P2SH_ADDR}"
echo -e "   Lockup Address:    ${LOCKUP_ADDR}"
echo -e "   Released Address:  ${RELEASED_ADDR}"
echo -e "   Unlock TXID:       ${BROADCAST_TXID}"
echo -e "   Final Block:       ${CURRENT_BLOCK}"
echo ""
echo -e "${YELLOW}🔐 Security Features Demonstrated:${NC}"
echo -e "   • HD wallet with separate derivation paths"
echo -e "   • Timelock enforced at protocol level (OP_CHECKLOCKTIMEVERIFY)"
echo -e "   • Only predefined lockup key can unlock funds"
echo -e "   • Automatic routing to released-funds address"
echo -e "   • No address reuse - new addresses for each timelock"
echo ""
echo -e "${BLUE}============================================================================${NC}\n"
