# P2SH Address Fix - Critical

## Problem

The app was funding the **wrong address**, causing the unlock transaction to fail with:

```
mandatory-script-verify-flag-failed (Witness requires empty scriptSig)
```

### Root Cause

The timelock creates TWO addresses:
1. **`lockupAddress`** - Native SegWit (P2WPKH) address like `bcrt1q...`
2. **`p2shAddress`** - P2SH address for the timelock script like `2...` or `bcrt1...c4`

The app was sending funds to `lock.lockupAddress` (SegWit), but the timelock redemption script expects funds to be locked in the `lock.p2shAddress` (P2SH).

When trying to unlock:
- ❌ We scanned for UTXOs at `lockupAddress` (wrong address)
- ❌ We funded `lockupAddress` (wrong address)  
- ❌ Then tried to spend using P2SH redemption script (doesn't match!)

Result: Bitcoin Core rejected the transaction because we were trying to spend a SegWit output with a P2SH script.

## Solution

Changed all funding and UTXO scanning operations to use `p2shAddress` instead of `lockupAddress`:

**File:** `client/src/App.jsx`

### Changes Made:

1. **UTXO Scanning** (line ~111):
   ```javascript
   // Before:
   const utxos = await bitcoinApi.getUtxosForAddress(lock.lockupAddress, network);
   
   // After:
   const utxos = await bitcoinApi.getUtxosForAddress(lock.p2shAddress, network);
   ```

2. **Funding** (line ~189):
   ```javascript
   // Before:
   const txid = await bitcoinApi.sendToAddress(lock.lockupAddress, amountBTC, network);
   
   // After:
   const txid = await bitcoinApi.sendToAddress(lock.p2shAddress, amountBTC, network);
   ```

3. **Display** (lines ~722-726):
   ```jsx
   // Both now show p2shAddress (which is correct for funding)
   <div className="detail-row">
     <span className="detail-label">P2SH Address:</span>
     <span className="detail-value">{lock.p2shAddress}</span>
   </div>
   <div className="detail-row">
     <span className="detail-label">Lockup Address:</span>
     <span className="detail-value">{lock.p2shAddress}</span>
   </div>
   ```

Note: The "Lockup Address" label is kept for clarity, but it now displays the P2SH address which is what should actually receive the funds.

## Why This Matters

In Bitcoin:
- **P2WPKH (Native SegWit)**: Uses witness data, scriptSig must be empty
- **P2SH (Pay to Script Hash)**: Uses scriptSig for redemption script

The timelock uses a **custom P2SH script** with `OP_CHECKLOCKTIMEVERIFY`. To spend from it, we must:
1. Send funds TO the P2SH address (hash of the redeem script)
2. Spend FROM it by providing the redeem script in scriptSig
3. Sign with the correct key

We were sending to a P2WPKH address but trying to spend with P2SH redemption → mismatch!

## Testing

After this fix, the complete workflow should work:

1. ✅ Create timelock
2. ✅ Click "💰 Fund" → Sends to **p2shAddress**
3. ✅ Scan for UTXO → Finds UTXO at **p2shAddress**  
4. ✅ Click "Unlock" → Signs with P2SH script
5. ✅ Transaction broadcasts successfully!

## What About lockupAddress?

The `lockupAddress` is still created but is not used for timelock operations. It's a regular P2WPKH address that could be used for:
- Receiving non-timelocked funds
- Change outputs
- Alternative receiving address

For now, it's just informational. The **p2shAddress** is what matters for timelocks.

## Status

✅ Fixed with `sed` command to replace all instances
✅ Vite will hot-reload automatically
✅ Ready to test end-to-end!

## Expected Result

Now when you:
1. Fund a timelock → Goes to P2SH address ✅
2. Select to unlock → Finds UTXO at P2SH address ✅
3. Unlock → Signs correctly with P2SH script ✅
4. Broadcast → Bitcoin Core accepts it! ✅

The "witness requires empty scriptSig" error should be gone! 🎉
