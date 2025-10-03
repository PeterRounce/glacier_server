# Auto-Fund on Unlock - Smart TXID Population

## Overview
Enhanced the "Unlock Timelock" button to automatically scan for UTXOs and offer to fund the timelock if none are found, eliminating the need to manually fund before unlocking.

## Problem Solved
Previously, clicking "Unlock Timelock" on an unfunded timelock would show:
- ❌ "Missing TXID" error
- Required user to manually click "💰 Fund" button first
- Extra steps in the workflow

## New Behavior

When you click "Unlock Timelock":

### Scenario 1: Timelock Already Funded ✅
- Automatically scans blockchain for UTXOs
- Finds the UTXO and fills in TXID, vout, amount
- Shows: "✓ Found UTXO: 0.001 BTC. Click 'Unlock Timelock' again to proceed."
- Second click proceeds with unlocking

### Scenario 2: Timelock Not Funded 💰
- Scans blockchain and finds no UTXOs
- Shows confirmation dialog:
  ```
  Timelock #0 has not been funded yet.
  
  Would you like to send 0.001 BTC to it now?
  
  Lockup Address: bcrt1q...
  ```
- If you click **OK**:
  1. Sends 0.001 BTC to the lockup address
  2. Mines 1 confirmation block (regtest only)
  3. Waits 1 second for transaction indexing
  4. Scans again and auto-fills TXID, vout, amount
  5. Shows: "✓ Timelock funded and ready! Click 'Unlock Timelock' again to proceed."
  6. Second click proceeds with unlocking
  
- If you click **Cancel**:
  - Returns to form (you can fund manually later)

## Code Changes

**File:** `client/src/App.jsx`

Enhanced `handleUnlockTimelock()` function with two new features:

### 1. Auto-Scan on Unlock
```javascript
// If TXID is missing and we have API connection, try to auto-fetch it
if ((!unlockTxid || unlockTxid.trim() === '') && apiConnected && selectedTimelock) {
  console.log('⏳ TXID missing, attempting to scan blockchain for UTXOs...');
  showMessage('⏳ Scanning blockchain for UTXOs...', 'info');
  
  try {
    const utxos = await bitcoinApi.getUtxosForAddress(selectedTimelock.lockupAddress, network);
    
    if (utxos.length > 0) {
      const utxo = utxos[0];
      console.log('✓ Found UTXO:', utxo);
      setUnlockTxid(utxo.txid);
      setUnlockVout(utxo.vout);
      setUnlockAmount(utxo.amount);
      showMessage(`✓ Found UTXO: ${utxo.amount} BTC. Click "Unlock Timelock" again to proceed.`, 'success');
      return; // Stop here, let user click again
    }
```

### 2. Auto-Fund Offer
```javascript
    } else {
      console.error('No UTXOs found on blockchain');
      
      // Offer to auto-fund the timelock
      const shouldFund = window.confirm(
        `Timelock #${timelockId} has not been funded yet.\n\n` +
        `Would you like to send 0.001 BTC to it now?\n\n` +
        `Lockup Address: ${selectedTimelock.lockupAddress}`
      );
      
      if (shouldFund) {
        try {
          setStatus(`Funding timelock #${timelockId}...`);
          const txid = await bitcoinApi.sendToAddress(selectedTimelock.lockupAddress, 0.001, network);
          showMessage(`✓ Sent 0.001 BTC to timelock! TXID: ${txid}`, 'success');
          
          // Auto-mine confirmation on regtest
          if (network === 'regtest') {
            const address = await bitcoinApi.getNewAddress(network);
            await bitcoinApi.generateToAddress(1, address, network);
            showMessage(`✓ Mined confirmation block`, 'success');
            await fetchBlockHeight();
          }
          
          // Wait a moment for the transaction to be indexed
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Scan again for UTXOs
          const utxosAfterFunding = await bitcoinApi.getUtxosForAddress(selectedTimelock.lockupAddress, network);
          if (utxosAfterFunding.length > 0) {
            const utxo = utxosAfterFunding[0];
            setUnlockTxid(utxo.txid);
            setUnlockVout(utxo.vout);
            setUnlockAmount(utxo.amount);
            showMessage(`✓ Timelock funded and ready! Click "Unlock Timelock" again to proceed.`, 'success');
          }
          
          setStatus('Ready');
        } catch (fundError) {
          console.error('Error funding timelock:', fundError);
          showMessage(`✗ Failed to fund timelock: ${fundError.message}`, 'error');
          setStatus('Error');
        }
      }
      
      return;
    }
```

## User Experience Comparison

### Before (Required Multiple Steps):
```
1. Click "Select to Unlock" on timelock
2. See "No UTXOs found" warning
3. Click "💰 Fund" button
4. Enter amount → OK
5. Wait for confirmation
6. Click "Select to Unlock" again
7. See TXID auto-filled
8. Click "Unlock Timelock"
9. Transaction broadcasts
```

### After (Simplified Flow):
```
1. Click "Select to Unlock" on timelock (optional)
2. Click "Unlock Timelock"
3. Dialog: "Would you like to send 0.001 BTC?"
4. Click OK
5. Wait 1-2 seconds (auto-funding + confirmation)
6. Click "Unlock Timelock" again
7. Transaction broadcasts
```

Or even simpler:
```
1. Click "💰 Fund" button (0.001 BTC)
2. Click "Select to Unlock"
3. Click "Unlock Timelock"
4. Done!
```

## Benefits

1. ✅ **Smarter Error Handling** - Tries to help instead of just showing error
2. ✅ **Fewer Clicks** - Can fund directly from unlock button
3. ✅ **Auto-Scan** - Always checks blockchain before erroring
4. ✅ **Confirmations** - User must explicitly approve funding
5. ✅ **Status Updates** - Clear messages at each step
6. ✅ **Regtest-Friendly** - Auto-mines confirmation blocks
7. ✅ **Flexible** - Can still use separate Fund button if preferred

## Technical Details

- **1-second delay** after funding to allow transaction indexing
- **Confirmation dialog** prevents accidental spending
- **Error handling** for each async operation
- **Status messages** guide user through process
- **Blockchain scan** ensures UTXO is confirmed before proceeding

## Edge Cases Handled

- ✅ TXID already present → Skip scan, proceed with unlock
- ✅ API disconnected → Show original validation error
- ✅ No selected timelock → Show error
- ✅ UTXO found → Auto-fill and ask to click again
- ✅ No UTXO found → Offer to fund
- ✅ User declines funding → Return to form
- ✅ Funding fails → Show error message
- ✅ Multiple UTXOs → Use first one

## Testing

Reload the app and try:

1. **Create timelock** (block height = current + 5)
2. **Click "Select to Unlock"** (optional)
3. **Click "Unlock Timelock"**
4. **Click OK** in the funding dialog
5. Wait for "✓ Timelock funded and ready!"
6. **Click "Unlock Timelock"** again
7. Transaction should broadcast successfully!

## Notes

- The "💰 Fund" button still exists and works independently
- You can use either workflow (separate Fund button or auto-fund on unlock)
- The auto-fund uses a fixed amount of 0.001 BTC
- For custom amounts, use the "💰 Fund" button which prompts for amount
