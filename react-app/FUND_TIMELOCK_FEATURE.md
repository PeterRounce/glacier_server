# Fund Timelock Feature

## Overview
Added a "💰 Fund" button to each timelock in the list that allows users to easily send funds to a timelock's lockup address directly from the UI, without manually running bitcoin-cli commands.

## Changes Made

### 1. Proxy Server - Added sendtoaddress Endpoint
**File:** `proxy/proxy-server.js`

Added new POST endpoint to send funds to an address:
```javascript
app.post('/api/sendtoaddress', async (req, res) => {
  try {
    const { address, amount } = req.body;
    const network = req.query.network || DEFAULT_NETWORK;
    
    if (!address || !amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Address and amount are required' 
      });
    }
    
    const result = await bitcoinCli(`sendtoaddress ${address} ${amount}`, network);
    
    res.json({ 
      success: true, 
      txid: result,
      address,
      amount,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

### 2. API Client - Added sendToAddress Method
**File:** `client/src/bitcoinApi.js`

Added method to call the new endpoint:
```javascript
/**
 * Send funds to an address
 */
async sendToAddress(address, amount, network = 'regtest') {
  const data = await fetchApi(`/api/sendtoaddress?network=${network}`, {
    method: 'POST',
    body: JSON.stringify({ address, amount }),
  });
  return data.txid;
}
```

### 3. React App - Added Fund Handler and Button
**File:** `client/src/App.jsx`

#### Added handleFundTimelock Function:
```javascript
const handleFundTimelock = async (lock) => {
  if (!apiConnected) {
    showMessage('Bitcoin API not connected', 'error');
    return;
  }

  const defaultAmount = 0.001;
  const amount = prompt(
    `Enter amount to send to timelock #${lock.id} (BTC):`,
    defaultAmount.toString()
  );
  
  if (amount === null) {
    // User cancelled
    return;
  }

  const amountBTC = parseFloat(amount);
  if (isNaN(amountBTC) || amountBTC <= 0) {
    showMessage('Invalid amount', 'error');
    return;
  }

  try {
    setStatus(`Funding timelock #${lock.id}...`);
    
    const txid = await bitcoinApi.sendToAddress(lock.lockupAddress, amountBTC, network);
    
    showMessage(`✓ Sent ${amountBTC} BTC to timelock! TXID: ${txid}`, 'success');
    
    // Auto-mine a block on regtest to confirm
    if (network === 'regtest') {
      try {
        const address = await bitcoinApi.getNewAddress(network);
        await bitcoinApi.generateToAddress(1, address, network);
        showMessage(`✓ Mined confirmation block`, 'success');
        await fetchBlockHeight();
      } catch (mineError) {
        console.error('Could not mine confirmation block:', mineError);
      }
    }
    
    setStatus('Ready');
  } catch (error) {
    console.error('Error funding timelock:', error);
    showMessage(`✗ Failed to fund timelock: ${error.message}`, 'error');
    setStatus('Error');
  }
};
```

#### Updated Timelock Card UI:
Added a "💰 Fund" button next to the "Select to Unlock" button:
```jsx
{lock.status === 'created' && (
  <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
    <button 
      className="button"
      style={{ 
        flex: 1, 
        background: '#38a169', 
        borderColor: '#38a169',
        fontSize: '0.9rem'
      }}
      onClick={(e) => {
        e.stopPropagation();
        handleFundTimelock(lock);
      }}
      disabled={!apiConnected}
      title="Send funds to this timelock's lockup address"
    >
      💰 Fund
    </button>
    <button 
      className="button button-secondary"
      style={{ flex: 1, fontSize: '0.9rem' }}
      onClick={(e) => {
        e.stopPropagation();
        selectTimelockForUnlock(lock);
        // Scroll to unlock section
        setTimeout(() => {
          const unlockSection = document.getElementById('unlock-timelock-section');
          if (unlockSection) {
            unlockSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }}
    >
      Select to Unlock
    </button>
  </div>
)}
```

## How It Works

1. **User clicks "💰 Fund" button** on a timelock card
2. **Browser prompt appears** asking for amount (defaults to 0.001 BTC)
3. **Transaction is sent** via `bitcoin-cli sendtoaddress` through the proxy
4. **Success message** shows the transaction ID
5. **On regtest only**: Automatically mines 1 confirmation block
6. **Block height refreshes** automatically

## User Experience

### Before:
```bash
# Manual steps required
bitcoin-cli -regtest sendtoaddress <address> 0.001
bitcoin-cli -regtest generatetoaddress 1 $(bitcoin-cli -regtest getnewaddress)
# Copy TXID manually
# Click Select to Unlock
# Paste TXID, vout, amount manually
```

### After:
```
1. Click "💰 Fund" button
2. Enter amount (or use default 0.001)
3. Click OK
4. Automatically mines confirmation block (regtest)
5. Click "Select to Unlock"
6. All fields auto-filled from blockchain scan
7. Click "Unlock Timelock"
8. Done!
```

## Features

- ✅ **Prompt for amount** - User can specify how much to send
- ✅ **Input validation** - Checks for valid amount
- ✅ **Auto-confirmation** - Mines 1 block on regtest to confirm transaction
- ✅ **Status updates** - Shows progress messages
- ✅ **Error handling** - Graceful failure with helpful messages
- ✅ **Requires API** - Button disabled when API not connected
- ✅ **Non-blocking** - Uses e.stopPropagation() to prevent card click

## Network Support

- **Regtest**: Full support with auto-mining confirmation block
- **Testnet**: Sends transaction, waits for network confirmation
- **Mainnet**: Sends transaction, waits for network confirmation (use with caution!)

## Testing Workflow

Complete end-to-end test:

1. Create a new timelock (block height = current + 10)
2. Click "💰 Fund" on the timelock
3. Enter amount (e.g., 0.001)
4. Wait for success message with TXID
5. Click "Select to Unlock" 
6. Verify TXID, vout, and amount are auto-filled
7. Click "⛏️ Mine 5 Blocks" (to reach unlock height)
8. Click "Unlock Timelock"
9. Transaction broadcasts successfully

## Error Scenarios

- **API disconnected**: Button disabled, shows error if clicked
- **Invalid amount**: Shows "Invalid amount" error
- **Insufficient funds**: Shows bitcoin-cli error message
- **Network error**: Shows detailed error message
- **User cancels**: Silently returns (no error)

## Benefits

1. **Faster testing** - No need to switch to terminal
2. **Less error-prone** - No manual copy/paste of addresses
3. **Better UX** - Complete workflow in one UI
4. **Auto-confirmation** - On regtest, automatically mines block
5. **Integrated** - Works seamlessly with existing auto-scan feature

## Dependencies

- Proxy server must be running
- Bitcoin Core wallet must have funds available
- Network connection to Bitcoin Core RPC

## Future Enhancements

Possible improvements:
- Show wallet balance before funding
- Add "Fund All" button to fund multiple timelocks
- Custom fee selection for funding transaction
- Show pending funding transactions in UI
- Add "Quick Fund" buttons (0.001, 0.01, 0.1 BTC)
