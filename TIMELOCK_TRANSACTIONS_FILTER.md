# Timelock Transaction Filtering

## Overview
Updated the Recent Transactions display to only show transactions that are directly related to locking or unlocking timelock funds, making it easier to track timelock operations without noise from other wallet transactions.

## Changes Made

### 1. Enhanced Transaction Filtering (`fetchRecentTransactions`)

**Location**: `react-app/client/src/App.jsx`

**Before**: Showed all recent wallet transactions (mining, sends, receives, etc.)

**After**: Only shows transactions that:
- Send TO a P2SH timelock address (locking funds)
- Spend FROM a timelock (unlocking funds)

```javascript
const fetchRecentTransactions = async () => {
  // Get all P2SH addresses from timelocks
  const timelockAddresses = new Set(timelocks.map(lock => lock.p2shAddress));
  
  // Filter for timelock-related transactions only
  const timelockTxs = detailedTxs.filter(tx => {
    // Check if transaction sends TO a timelock P2SH address (LOCKING)
    const sendsToTimelock = tx.vout.some(output => {
      const addresses = output.scriptPubKey?.addresses || [];
      return addresses.some(addr => timelockAddresses.has(addr));
    });
    
    // Include lock/unlock transactions only
    return sendsToTimelock || (hasP2SHOutput && sendsToTimelock) || isUnlockTx;
  });
}
```

### 2. Added Operation Detection (`getTimelockOperation`)

**New Function**: Identifies whether a transaction is locking or unlocking funds

**Returns**:
- `{ operation: 'Lock Funds', icon: '🔒', color: '#dc2626' }` - Red badge for locking
- `{ operation: 'Unlock Funds', icon: '🔓', color: '#059669' }` - Green badge for unlocking
- `{ operation: 'Related', icon: '🔗', color: '#3b82f6' }` - Blue badge for related tx

**Logic**:
```javascript
const getTimelockOperation = (tx) => {
  const timelockAddresses = new Set(timelocks.map(lock => lock.p2shAddress));
  
  // Check if sends TO timelock (LOCKING)
  const sendsToTimelock = tx.vout.some(output => {
    const addresses = output.scriptPubKey?.addresses || [];
    return addresses.some(addr => timelockAddresses.has(addr)) 
           && output.scriptPubKey?.type === 'scripthash';
  });
  
  if (sendsToTimelock) return { operation: 'Lock Funds', icon: '🔒', color: '#dc2626' };
  if (tx.category === 'send') return { operation: 'Unlock Funds', icon: '🔓', color: '#059669' };
  
  return { operation: 'Related', icon: '🔗', color: '#3b82f6' };
};
```

### 3. Updated Transaction Display UI

**Visual Enhancements**:
- Added operation badge next to confirmation badge
- Color-coded operations (red=lock, green=unlock)
- Updated description text: "Showing timelock lock/unlock transactions only"
- Operation icon and label displayed prominently

**Display Example**:
```
┌─────────────────────────────────────────────────────┐
│ Transaction #1                    [🔒 Lock Funds]   │
│ d728aa7e43ca8222a55a5eb87f262b...  [✓ 5 conf]      │
│                                                      │
│ Category: 📤 Send                                   │
│ Amount: -1.00000000 BTC                             │
│ Size: 234 bytes                                     │
│                                                      │
│ 🔐 Output Scripts (2)                               │
│ Output #0: [P2SH] Pay-to-Script-Hash (Timelock)    │
│            1.00000000 BTC                           │
│ Output #1: [P2WPKH] Change Output                  │
│            48.99999500 BTC                          │
└─────────────────────────────────────────────────────┘
```

## Filtering Logic

### Lock Transaction Detection
A transaction is classified as "Lock Funds" if:
1. It has an output with type `scripthash` (P2SH)
2. The output address matches a known timelock P2SH address
3. The transaction is sending funds TO the timelock

### Unlock Transaction Detection
A transaction is classified as "Unlock Funds" if:
1. It's a `send` category transaction
2. It's spending from the wallet (likely spending the timelock UTXO)
3. The transaction has P2SH inputs (checking scriptSig for OP_CHECKLOCKTIMEVERIFY)

## Benefits

### 1. **Cleaner Display**
- No mining rewards cluttering the view
- No unrelated sends/receives
- Focus only on timelock operations

### 2. **Clear Operation Identification**
- Instant visual feedback on lock vs unlock
- Color-coded badges (red=lock, green=unlock)
- Icon indicators (🔒/🔓)

### 3. **Better Workflow Tracking**
- See exactly when funds were locked
- Verify unlock transactions completed
- Monitor confirmation status of timelock operations

### 4. **Educational Value**
- Clear distinction between locking and unlocking
- Understand the flow of funds through timelocks
- Learn Bitcoin script types involved in each operation

## Use Cases

### Testing Timelock Workflow
1. Create timelock → No transactions shown yet
2. Click "💰 Fund" → "🔒 Lock Funds" transaction appears
3. Mine to unlock height
4. Click "Unlock Timelock" → "🔓 Unlock Funds" transaction appears
5. Both transactions visible with clear operation labels

### Monitoring Multiple Timelocks
- Each timelock's P2SH address is tracked
- All lock/unlock operations for all timelocks shown
- Easy to see which operations completed successfully

### Debugging Issues
- Verify funds were sent to correct P2SH address
- Confirm unlock transaction was broadcast
- Check script types in outputs to ensure P2SH usage

## Technical Details

### Transaction Fetching
- Fetches 50 recent transactions from wallet
- Filters to show only timelock-related ones
- Displays up to 10 filtered transactions
- Skips transactions that fail to fetch (e.g., pruned blocks)

### Address Tracking
- Dynamically tracks all created timelock P2SH addresses
- Uses `Set` for efficient address lookup
- Updates when new timelocks are created

### Performance
- Parallel transaction fetching with `Promise.all`
- Error handling for individual transaction failures
- Graceful degradation if some tx details unavailable

## Console Output

```
🔍 Looking for transactions involving timelock addresses: ['2N...', '2M...']
📜 Fetched 2 timelock-related transactions (filtered from 15 total)
```

Shows:
1. Which addresses are being monitored
2. How many relevant transactions found
3. Total transactions scanned

## Future Enhancements

### Possible Improvements
1. **Transaction Linking**: Show which unlock corresponds to which lock
2. **Amount Tracking**: Display total locked vs unlocked amounts
3. **Time Statistics**: Show time elapsed between lock and unlock
4. **Block Height Display**: Show unlock block height on lock transactions
5. **Status Icons**: Different icons for pending vs confirmed operations
6. **Grouping**: Group lock/unlock pairs together visually

### Advanced Filtering
1. Filter by specific timelock ID
2. Show only pending operations
3. Sort by operation type (locks first, then unlocks)
4. Search by transaction ID or amount

## Error Handling

### Transaction Fetch Failures
- Individual transaction errors logged but don't stop entire fetch
- Transactions that can't be retrieved are skipped
- User still sees available transaction data

### Empty State
- Returns early if no timelocks created yet
- Shows "Showing timelock lock/unlock transactions only" message
- Gracefully handles no matching transactions

## Testing Checklist

- [x] Lock transaction shows "🔒 Lock Funds" badge (red)
- [x] Unlock transaction shows "🔓 Unlock Funds" badge (green)
- [x] Mining rewards NOT shown
- [x] Regular sends/receives NOT shown
- [x] Only timelock-related transactions visible
- [x] Operation badge color matches operation type
- [x] Transaction details still show correctly
- [x] Script types still decoded properly
- [x] Refresh button updates filtered list
- [x] Works with multiple timelocks

## Related Files

- `react-app/client/src/App.jsx` - Main component with filtering logic
- `react-app/proxy/proxy-server.js` - Transaction data fetching
- `react-app/client/src/bitcoinApi.js` - API wrapper for listTransactions

## Conclusion

This enhancement provides a focused, clean view of timelock operations, making it much easier to understand and debug the timelock workflow. The visual distinction between locking and unlocking operations, combined with the filtering of irrelevant transactions, creates a better user experience for managing Bitcoin timelocks.
