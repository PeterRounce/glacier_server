# BIP32 Timelock Wallet

A Bitcoin timelock wallet implementation using BIP32 HD wallet derivation with secure OP_CHECKLOCKTIMEVERIFY (CLTV) timelocks.

## Features

- 🔐 **HD Wallet with BIP32/BIP39/BIP84** - Hierarchical Deterministic wallet with industry-standard derivation
- ⏰ **Secure Timelocks** - Protocol-level time locks using OP_CHECKLOCKTIMEVERIFY
- 🎯 **Predefined Recipients** - Only the designated key can unlock funds
- 📦 **Separate Accounts** - Different derivation paths for locked and released funds
- 🔄 **No Address Reuse** - New addresses generated for each timelock
- 💾 **Full Recovery** - Complete wallet recovery from 24-word mnemonic

## Architecture

### HD Wallet Structure (BIP84)

```
m/84'/{coin_type}'/{account}'/{change}/{index}

Lock-up Account:      m/84'/1'/0'/0/{index}  (Can unlock funds)
Released Account:     m/84'/1'/1'/0/{index}  (Receives unlocked funds)
```

### Timelock Script

The redeem script enforces both time and recipient constraints:

```
<block_height> OP_CHECKLOCKTIMEVERIFY OP_DROP 
OP_DUP OP_HASH160 <lockup_pubkey_hash> OP_EQUALVERIFY OP_CHECKSIG
```

**Security Properties:**
1. Funds cannot be unlocked before the specified block height
2. Only the lockup address private key can unlock the funds
3. Funds automatically route to the predefined released address

## Installation

### Prerequisites

```bash
# Install Node.js dependencies
npm install

# Download and extract Bitcoin Core (regtest for testing)
# Bitcoin Core 27.0 or later recommended
```

### Dependencies

```json
{
  "express": "^4.18.0",
  "bip32": "^4.0.0",
  "bip39": "^3.1.0",
  "tiny-secp256k1": "^2.2.3",
  "bitcoinjs-lib": "^6.1.5"
}
```

## Quick Start

### 1. Start Bitcoin Daemon (Regtest)

```bash
./bitcoin-27.0/bin/bitcoind -regtest -daemon -fallbackfee=0.00001
```

### 2. Start the API Server

```bash
node server.js
```

Server will start on `http://localhost:3000`

### 3. Run the Demo

```bash
./demo_timelock.sh
```

This will demonstrate the complete lifecycle:
- Initialize HD wallet
- Create a timelock
- Send funds to P2SH address
- Wait for timelock expiration
- Unlock and broadcast transaction

## API Reference

### POST `/api/wallet/init`

Initialize a new HD wallet or restore from mnemonic.

**Request:**
```json
{
  "network": "regtest",  // "mainnet", "testnet", or "regtest"
  "mnemonic": "optional existing mnemonic..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mnemonic": "24-word mnemonic phrase",
    "network": "regtest",
    "accounts": {
      "lockup": "m/84'/0'/0'",
      "released": "m/84'/0'/1'"
    }
  }
}
```

### POST `/api/wallet/create-timelock`

Create a new timelock with predefined recipient.

**Request:**
```json
{
  "blockHeight": 600
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timelockId": 0,
    "p2shAddress": "2N...",
    "blockHeight": 600,
    "redeemScript": "hex...",
    "lockup": {
      "path": "m/84'/0'/0'/0/0",
      "address": "bcrt1q...",
      "note": "Only this address can unlock the funds"
    },
    "released": {
      "path": "m/84'/0'/1'/0/0",
      "address": "bcrt1q...",
      "note": "Funds will be sent here when unlocked"
    }
  }
}
```

### POST `/api/wallet/unlock-timelock`

Create a signed transaction to unlock a timelock.

**Request:**
```json
{
  "timelockId": 0,
  "txid": "transaction_id",
  "vout": 0,
  "amountBTC": 0.001,
  "feeSatoshis": 500
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signedTransaction": "hex_encoded_transaction",
    "txid": "unlock_transaction_id",
    "blockHeight": 600,
    "from": "2N...",
    "to": "bcrt1q...",
    "amountSatoshis": 99500,
    "feeSatoshis": 500
  }
}
```

### GET `/api/wallet/timelocks`

List all timelocks in the wallet.

### GET `/api/wallet/status`

Get wallet status and statistics.

## Manual Testing

### Step-by-Step Example

```bash
# 1. Initialize wallet
curl -X POST http://localhost:3000/api/wallet/init \
  -H "Content-Type: application/json" \
  -d '{"network": "regtest"}'

# 2. Create timelock
TIMELOCK_RESPONSE=$(curl -s -X POST http://localhost:3000/api/wallet/create-timelock \
  -H "Content-Type: application/json" \
  -d '{"blockHeight":315}')

# 3. Extract P2SH address
P2SH_ADDR=$(echo $TIMELOCK_RESPONSE | jq -r '.data.p2shAddress')
echo "P2SH Address: $P2SH_ADDR"

# 4. Send funds
./bitcoin-27.0/bin/bitcoin-cli -regtest sendtoaddress $P2SH_ADDR 0.001

# 5. Mine blocks
./bitcoin-27.0/bin/bitcoin-cli -regtest generatetoaddress 1 $(./bitcoin-27.0/bin/bitcoin-cli -regtest getnewaddress)

# 6. Get transaction details
NEW_TXID=$(./bitcoin-27.0/bin/bitcoin-cli -regtest sendtoaddress $P2SH_ADDR 0.001)
./bitcoin-27.0/bin/bitcoin-cli -regtest generatetoaddress 1 $(./bitcoin-27.0/bin/bitcoin-cli -regtest getnewaddress)
VOUT=$(./bitcoin-27.0/bin/bitcoin-cli -regtest gettransaction $NEW_TXID | jq -r ".details[] | select(.address == \"$P2SH_ADDR\") | .vout")

# 7. Unlock timelock
SIGNED_TX=$(curl -s -X POST http://localhost:3000/api/wallet/unlock-timelock \
  -H "Content-Type: application/json" \
  -d "{\"timelockId\": 0, \"txid\": \"$NEW_TXID\", \"vout\": $VOUT, \"amountBTC\": 0.001, \"feeSatoshis\": 500}" \
  | jq -r '.data.signedTransaction')

# 8. Broadcast
./bitcoin-27.0/bin/bitcoin-cli -regtest sendrawtransaction $SIGNED_TX
```

## Security Considerations

### Production Deployment

⚠️ **This is a demonstration implementation. For production use, consider:**

1. **Database Storage** - Current implementation uses in-memory storage
2. **Key Management** - Implement secure key storage (HSM, encrypted storage)
3. **Mnemonic Backup** - Ensure secure backup and recovery procedures
4. **Multi-sig** - Consider adding multi-signature requirements
5. **Access Control** - Add authentication and authorization
6. **Rate Limiting** - Implement API rate limiting
7. **Monitoring** - Add comprehensive logging and monitoring
8. **Testing** - Extensive testing on testnet before mainnet deployment

### Mnemonic Security

- Store mnemonics securely (never in plain text)
- Use hardware wallets for production keys
- Implement proper key derivation and isolation
- Regular security audits

## Technical Details

### Signature Encoding

Uses proper DER signature encoding via `bitcoin.script.signature.encode()` to ensure canonical signatures.

### Transaction Construction

- Version 2 transactions for CSV/CLTV support
- Proper sequence numbers (0xfffffffe) for timelock enforcement
- BigInt values for satoshi amounts to prevent precision errors

### Network Support

- Mainnet (coin_type 0)
- Testnet (coin_type 1)
- Regtest (coin_type 1)

## Troubleshooting

### "Non-canonical DER signature" Error

Ensure using `bitcoin.script.signature.encode()` for proper signature encoding.

### "Script failed an OP_EQUALVERIFY operation"

- Verify the lockup address matches the one used to create the redeem script
- Ensure using the correct wallet instance
- Check that publicKeyBuffer is used directly, not converted from hex

### "Error: Fee is too high"

Adjust the `feeSatoshis` parameter to a lower value.

## License

MIT

## Contributing

Contributions welcome! Please ensure:
- Code follows existing style
- Tests pass
- Security considerations documented
- No private keys committed

## Resources

- [BIP32 - Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP39 - Mnemonic code for generating deterministic keys](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP84 - Derivation scheme for P2WPKH](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)
- [BIP65 - OP_CHECKLOCKTIMEVERIFY](https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki)
