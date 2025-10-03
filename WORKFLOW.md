# BIP32 Timelock Wallet - Complete Workflow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BIP32 Timelock Wallet System                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐         ┌──────────────────────────────────┐
│   Mnemonic (BIP39)  │────────▶│  Seed (512 bits)                 │
│  24-word phrase     │         └──────────────────────────────────┘
└─────────────────────┘                        │
                                               │
                    ┌──────────────────────────┴──────────────────────────┐
                    │                                                      │
                    ▼                                                      ▼
         ┌──────────────────────┐                         ┌──────────────────────┐
         │  Lock-up Account     │                         │  Released Account    │
         │  m/84'/1'/0'         │                         │  m/84'/1'/1'         │
         └──────────────────────┘                         └──────────────────────┘
                    │                                                      │
                    ▼                                                      ▼
         ┌──────────────────────┐                         ┌──────────────────────┐
         │  Lockup Address 0    │                         │  Released Address 0  │
         │  bcrt1q...           │                         │  bcrt1q...           │
         │  (Can unlock)        │                         │  (Receives funds)    │
         └──────────────────────┘                         └──────────────────────┘
```

## Timelock Creation Flow

```
Step 1: Derive Keys
├─ Lockup Account (m/84'/1'/0')
│  └─ Derive address at index 0 → Lockup Address
│     └─ Extract public key → Lockup PubKey
│        └─ hash160(Lockup PubKey) → Lockup PubKey Hash
│
└─ Released Account (m/84'/1'/1')
   └─ Derive address at index 0 → Released Address

Step 2: Create Redeem Script
┌────────────────────────────────────────────────────────────┐
│  <block_height>                                            │
│  OP_CHECKLOCKTIMEVERIFY                                    │
│  OP_DROP                                                   │
│  OP_DUP                                                    │
│  OP_HASH160                                                │
│  <lockup_pubkey_hash>  ← Only this key can unlock         │
│  OP_EQUALVERIFY                                            │
│  OP_CHECKSIG                                               │
└────────────────────────────────────────────────────────────┘

Step 3: Create P2SH Address
hash160(redeemScript) → scriptHash
base58encode(version + scriptHash + checksum) → P2SH Address
Example: 2N4RWYHGHvgTHTWDmhWGcNWNjLgVntSHx9M
```

## Transaction Lifecycle

```
┌───────────────────────────────────────────────────────────────────┐
│                    1. FUNDING PHASE                               │
└───────────────────────────────────────────────────────────────────┘

  User's Bitcoin Wallet
         │
         │ sendtoaddress P2SH_Address 0.001 BTC
         ▼
  ┌─────────────────┐
  │  P2SH Address   │  ← Funds locked by redeem script
  │  2N4RW...       │     Cannot be spent until:
  │  0.001 BTC      │     1. Block height >= 315
  └─────────────────┘     2. Signed by lockup key


┌───────────────────────────────────────────────────────────────────┐
│                    2. WAITING PHASE                               │
└───────────────────────────────────────────────────────────────────┘

  Current Block: 100 ───────────────────────────────────────▶ 315
                 ▲                                            ▲
                 │                                            │
          Funds locked                                  Timelock expires
          (Cannot unlock)                               (Can unlock)


┌───────────────────────────────────────────────────────────────────┐
│                    3. UNLOCKING PHASE                             │
└───────────────────────────────────────────────────────────────────┘

  API Call: POST /api/wallet/unlock-timelock
  {
    "timelockId": 0,
    "txid": "...",
    "vout": 0,
    "amountBTC": 0.001,
    "feeSatoshis": 500
  }
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Create Transaction                     │
  │  ├─ Version: 2                          │
  │  ├─ Locktime: 315                       │
  │  ├─ Input:                              │
  │  │  ├─ TXID: previous transaction      │
  │  │  ├─ VOUT: 0                          │
  │  │  ├─ Sequence: 0xfffffffe             │
  │  │  └─ ScriptSig:                       │
  │  │     ├─ <signature + SIGHASH_ALL>     │
  │  │     ├─ <lockup_pubkey>               │
  │  │     └─ <redeemScript>                │
  │  └─ Output:                             │
  │     ├─ Amount: 99,500 sats              │
  │     └─ Address: Released Address        │
  └─────────────────────────────────────────┘
         │
         │ Sign with Lockup Key
         ▼
  ┌─────────────────────────────────────────┐
  │  Signed Transaction (Hex)               │
  │  0200000001d03ed77b2b16f70b8f...       │
  └─────────────────────────────────────────┘
         │
         │ sendrawtransaction
         ▼
  ┌─────────────────────────────────────────┐
  │  Bitcoin Network                        │
  │  Validates:                             │
  │  ✓ Locktime >= 315                      │
  │  ✓ Signature matches lockup key         │
  │  ✓ PubKey hash matches redeem script    │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Released Address                       │
  │  bcrt1qfkaeh...                         │
  │  Receives: 0.000995 BTC                 │
  └─────────────────────────────────────────┘
```

## Script Execution

```
STACK BEFORE EXECUTION:
┌─────────────────────────┐
│ <redeemScript>          │
│ <lockup_pubkey>         │
│ <signature>             │
└─────────────────────────┘

VERIFY SCRIPT HASH:
hash160(<redeemScript>) == scriptHash in P2SH address ✓

EXECUTE REDEEM SCRIPT:
┌────────────────────────────────────────────────────────┐
│ Step 1: Push block height                             │
│   Stack: [315]                                         │
│                                                        │
│ Step 2: OP_CHECKLOCKTIMEVERIFY                        │
│   Verify: tx.locktime (315) >= 315 ✓                  │
│   Stack: [315]                                         │
│                                                        │
│ Step 3: OP_DROP                                        │
│   Stack: []                                            │
│                                                        │
│ Step 4: OP_DUP                                         │
│   Stack: [<pubkey>, <pubkey>]                          │
│                                                        │
│ Step 5: OP_HASH160                                     │
│   Stack: [<pubkey>, <pubkey_hash>]                     │
│                                                        │
│ Step 6: Push lockup_pubkey_hash from script           │
│   Stack: [<pubkey>, <pubkey_hash>, <expected_hash>]    │
│                                                        │
│ Step 7: OP_EQUALVERIFY                                 │
│   Verify: <pubkey_hash> == <expected_hash> ✓           │
│   Stack: [<pubkey>]                                    │
│                                                        │
│ Step 8: OP_CHECKSIG                                    │
│   Verify: signature is valid for pubkey ✓              │
│   Stack: [true]                                        │
│                                                        │
│ Result: ✅ SCRIPT PASSES                               │
└────────────────────────────────────────────────────────┘
```

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Guarantees                       │
└─────────────────────────────────────────────────────────────┘

1. TIME LOCK (OP_CHECKLOCKTIMEVERIFY)
   ├─ Enforced at Bitcoin consensus level
   ├─ Cannot be bypassed or overridden
   └─ Transaction invalid before block height

2. KEY REQUIREMENT (OP_HASH160 + OP_EQUALVERIFY + OP_CHECKSIG)
   ├─ Only lockup key can create valid signature
   ├─ Public key hash must match predefined value
   └─ Prevents anyone else from unlocking

3. DESTINATION ROUTING
   ├─ Transaction output hardcoded to released address
   ├─ Funds automatically go to intended recipient
   └─ No risk of sending to wrong address

4. HD WALLET DERIVATION
   ├─ Deterministic key generation from seed
   ├─ Full wallet recovery from 24-word mnemonic
   ├─ Separate paths prevent key linkage
   └─ No address reuse
```

## API Request Flow

```
Client                    API Server                Bitcoin Node
  │                           │                           │
  │ POST /wallet/init         │                           │
  ├──────────────────────────▶│                           │
  │                           │ Generate mnemonic         │
  │                           │ Derive accounts           │
  │◀──────────────────────────┤                           │
  │ {mnemonic, addresses}     │                           │
  │                           │                           │
  │ POST /create-timelock     │                           │
  ├──────────────────────────▶│                           │
  │                           │ Derive keys               │
  │                           │ Create redeem script      │
  │                           │ Generate P2SH address     │
  │◀──────────────────────────┤                           │
  │ {p2shAddress, ...}        │                           │
  │                           │                           │
  │                           │   sendtoaddress           │
  │                           │──────────────────────────▶│
  │                           │                           │ Broadcast TX
  │                           │                           │ Mine block
  │                           │◀──────────────────────────┤
  │                           │   TXID                    │
  │                           │                           │
  │ POST /unlock-timelock     │                           │
  ├──────────────────────────▶│                           │
  │                           │ Build transaction         │
  │                           │ Sign with lockup key      │
  │◀──────────────────────────┤                           │
  │ {signedTransaction}       │                           │
  │                           │                           │
  │                           │   sendrawtransaction      │
  │                           │──────────────────────────▶│
  │                           │                           │ Validate
  │                           │                           │ Broadcast
  │                           │◀──────────────────────────┤ Mine block
  │                           │   Confirmed               │
  │                           │                           │
```

## Key Components

1. **HD Wallet (BIP32/BIP39/BIP84)**
   - Hierarchical Deterministic key derivation
   - 24-word mnemonic for seed generation
   - Standardized derivation paths

2. **Timelock Script (BIP65)**
   - OP_CHECKLOCKTIMEVERIFY for time enforcement
   - Secure recipient specification
   - P2SH wrapping for compatibility

3. **Transaction Construction**
   - Manual transaction building
   - Proper signature encoding (DER)
   - Correct sequence and locktime values

4. **RESTful API**
   - Wallet initialization
   - Timelock creation
   - Transaction signing
   - Status monitoring
