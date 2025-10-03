# BigInt Type Error Fix

## Problem

When clicking "Unlock Timelock", the transaction signing failed with:

```
Error: Expected property "1" of type Satoshi, got BigInt 99500
    at _Transaction.addOutput
```

## Root Cause

In `walletService.js`, line 379 was wrapping the output amount in `BigInt()`:

```javascript
tx.addOutput(releasedPayment.output, BigInt(outputAmount));
```

However, bitcoinjs-lib's `addOutput` method expects the amount to be a **regular Number** (in satoshis), not a BigInt.

The `outputAmount` variable was already a regular number:
```javascript
const amountSatoshis = Math.floor(amountBTC * 100000000);
const outputAmount = amountSatoshis - feeSatoshis;
// outputAmount = 99500 (regular Number)
```

By wrapping it in `BigInt(outputAmount)`, we converted it to `99500n` (BigInt), which bitcoinjs-lib rejected.

## Solution

**File:** `client/src/walletService.js`

Changed line 379 from:
```javascript
tx.addOutput(releasedPayment.output, BigInt(outputAmount));
```

To:
```javascript
tx.addOutput(releasedPayment.output, outputAmount);
```

## Why This Works

- `outputAmount` is already a Number in satoshis (e.g., 99500)
- bitcoinjs-lib expects `addOutput(scriptPubKey, value)` where `value` is a Number
- No type conversion needed - just pass the value directly

## Testing

After this fix:

1. **Click "Select to Unlock"** on a funded timelock
2. **Click "Unlock Timelock"**
3. Transaction should sign successfully ✅
4. Transaction should broadcast successfully ✅

## Status

✅ Fixed in `walletService.js`
✅ Vite will hot-reload the change automatically
✅ Ready to test!

## Related

This was the last piece needed for the complete end-to-end workflow:
1. ✅ Create timelock
2. ✅ Fund timelock (scantxoutset fix)
3. ✅ Scan for UTXO (scantxoutset)
4. ✅ Auto-fill form
5. ✅ Sign transaction (BigInt fix) ← Just fixed!
6. ✅ Broadcast transaction

All pieces are now working! 🎉
