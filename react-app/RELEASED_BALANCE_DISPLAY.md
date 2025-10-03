# Released Address Balance Display

## Overview
Added a new section that displays the balance of the final destination address (released address) after successfully unlocking a timelock. The balance updates automatically when "Unlock Timelock" is pressed.

## Features

### 1. Automatic Balance Fetch
When a timelock is successfully unlocked and broadcast:
- Automatically fetches the balance of the destination address
- Displays the total BTC received at that address
- Shows the full address for reference

### 2. Visual Display
A green-themed card appears showing:
- **Balance**: Large, prominent display in BTC (8 decimal places)
- **Address**: Monospace font display of the destination address
- **Refresh Button**: Manual refresh option
- **Info Note**: Explanation of what the balance represents

### 3. Manual Refresh
Users can click "🔄 Refresh Balance" to update the balance at any time without unlocking another timelock.

## Code Changes

### State Variables Added
**File:** `client/src/App.jsx`

```javascript
const [releasedBalance, setReleasedBalance] = useState(null);
const [releasedAddress, setReleasedAddress] = useState(null);
```

### Function Added: fetchReleasedBalance
```javascript
const fetchReleasedBalance = async (address) => {
  if (!apiConnected || !address) return;
  
  try {
    const utxos = await bitcoinApi.getUtxosForAddress(address, network);
    const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.amount, 0);
    setReleasedBalance(totalBalance);
    setReleasedAddress(address);
    console.log(`💰 Released address balance: ${totalBalance} BTC at ${address}`);
  } catch (error) {
    console.error('Error fetching released balance:', error);
    setReleasedBalance(null);
  }
};
```

### Integration with Unlock Flow
After successful transaction broadcast:
```javascript
const broadcastTxid = await bitcoinApi.sendRawTransaction(result.signedTransaction, network);
showMessage(`✓ Transaction broadcast successfully! TXID: ${broadcastTxid}`, 'success');
setStatus('Transaction broadcast');

// Fetch balance of released address after unlock
if (result.to) {
  await fetchReleasedBalance(result.to);
}
```

### UI Component
```jsx
{/* Released Address Balance */}
{releasedBalance !== null && releasedAddress && (
  <div className="card" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
    <h2>💰 Released Address Balance</h2>
    
    <div style={{ 
      padding: '20px', 
      background: 'white', 
      borderRadius: '8px',
      border: '2px solid #22c55e',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>
        Latest Unlock Destination
      </div>
      <div style={{ 
        fontSize: '2.5rem', 
        fontWeight: 'bold', 
        color: '#15803d',
        marginBottom: '12px'
      }}>
        {releasedBalance.toFixed(8)} BTC
      </div>
      <div style={{ 
        fontSize: '0.85rem', 
        color: '#666',
        wordBreak: 'break-all',
        fontFamily: 'monospace',
        background: '#f9fafb',
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #e5e7eb'
      }}>
        {releasedAddress}
      </div>
      {apiConnected && (
        <button 
          className="button"
          style={{ 
            marginTop: '15px', 
            padding: '8px 16px', 
            fontSize: '0.9rem',
            background: '#22c55e',
            borderColor: '#22c55e'
          }}
          onClick={() => fetchReleasedBalance(releasedAddress)}
        >
          🔄 Refresh Balance
        </button>
      )}
    </div>
    
    <div style={{ 
      marginTop: '15px', 
      padding: '12px', 
      background: '#fef3c7', 
      borderRadius: '6px',
      fontSize: '0.85rem',
      color: '#92400e'
    }}>
      <strong>ℹ️ Note:</strong> This shows the balance at the final destination 
      address after successfully unlocking a timelock. It updates automatically 
      when you click "Unlock Timelock".
    </div>
  </div>
)}
```

## How It Works

1. **User unlocks a timelock** → Clicks "Unlock Timelock" button
2. **Transaction signs and broadcasts** → Sends funds to released address
3. **Balance fetch triggered** → Automatically calls `fetchReleasedBalance(result.to)`
4. **UTXOs scanned** → Uses `scantxoutset` to find all UTXOs at that address
5. **Balance calculated** → Sums all UTXO amounts
6. **UI updates** → Green card appears showing balance and address
7. **Manual refresh available** → User can refresh balance anytime

## Benefits

✅ **Instant Feedback** - See immediately where funds went
✅ **Balance Tracking** - Know exactly how much was received
✅ **Address Verification** - Confirm the destination address
✅ **Accumulation Tracking** - If multiple unlocks go to same address, see total
✅ **Manual Refresh** - Can check balance updates without unlocking again

## Visual Design

### Color Scheme
- **Background**: Light green (#f0fdf4) - indicates success/money
- **Border**: Medium green (#86efac) - friendly highlight
- **Balance Text**: Dark green (#15803d) - emphasis on the number
- **Card Border**: Bright green (#22c55e) - clear visual separation

### Layout
- **Centered content** - Easy to read at a glance
- **Large balance text** - 2.5rem, bold, prominent
- **Monospace address** - Technical detail, easy to copy
- **Responsive padding** - Comfortable spacing

## Use Cases

### 1. Single Unlock
```
User unlocks Timelock #0
→ Sends 0.001 BTC to bcrt1q...
→ Card appears showing: 0.00100000 BTC
```

### 2. Multiple Unlocks to Same Address
```
User unlocks Timelock #0 → 0.001 BTC
User unlocks Timelock #1 → 0.002 BTC (same released address)
→ Card shows: 0.00300000 BTC (accumulated)
```

### 3. Checking After Mining
```
User unlocks timelock
Mines confirmation blocks
Clicks "🔄 Refresh Balance"
→ Confirms transaction is confirmed and balance updated
```

## Testing

1. **Create and fund a timelock**
2. **Mine blocks to reach unlock height**
3. **Click "Unlock Timelock"**
4. **Observe**:
   - ✅ Transaction broadcasts successfully
   - ✅ Green card appears below Wallet Status
   - ✅ Shows balance (e.g., 0.00099500 BTC after 500 sat fee)
   - ✅ Shows destination address
5. **Click "🔄 Refresh Balance"**
6. **Verify balance updates** (should be same unless new transactions)

## Edge Cases

- **No unlocks yet**: Card doesn't appear (releasedBalance === null)
- **API disconnected**: Card appears but refresh button may not work
- **Invalid address**: fetchReleasedBalance catches error, sets balance to null
- **Zero balance**: Shows 0.00000000 BTC (valid state if funds were moved)

## Future Enhancements

Possible improvements:
- Show transaction history for the address
- Display number of confirmations
- Add QR code for the address
- Show USD value conversion
- Track multiple addresses (if different timelocks use different released addresses)
- Export balance history to CSV

## Status

✅ Implemented in `client/src/App.jsx`
✅ Vite will hot-reload automatically
✅ Ready to test!
