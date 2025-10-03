# Mine Blocks Feature (Regtest)

## What's New

Added a **"Mine 5 Blocks"** button for regtest testing! This makes it super easy to advance the blockchain and test timelocks.

## Feature Details

### Button Location
The button appears in the **Wallet Status** section, next to the "Refresh" button.

**Availability:**
- ✅ Only shows on **regtest** network
- ✅ Only enabled when **API is connected**
- ❌ Hidden on testnet/mainnet (mining not allowed)

### What It Does

When you click "⛏️ Mine 5 Blocks":

1. **Generates a new address** in your Bitcoin wallet
2. **Mines 5 blocks** to that address (instant on regtest)
3. **Refreshes block height** automatically
4. **Shows confirmation** message with block count

### Use Cases

**1. Testing Timelocks:**
```
Current block height: 100
Create timelock at height 105
Click "⛏️ Mine 5 Blocks" 
New block height: 105
Now timelock is unlockable!
```

**2. Confirming Transactions:**
```
Fund lockup address
Click "⛏️ Mine 5 Blocks"
Transaction now has 5 confirmations
```

**3. Quick Advancement:**
```
Need to advance blockchain quickly?
Click mine button multiple times
5 blocks per click
```

## UI

**Button Style:**
- Purple background (`#722ed1`)
- Pickaxe emoji: ⛏️
- Text: "Mine 5 Blocks"
- Tooltip: "Mine 5 blocks (regtest only)"

**Placement:**
```
Current Block Height
123,456                    [🔄 Refresh] [⛏️ Mine 5 Blocks]
🔄 Auto-updating every 10s
```

## API Integration

Uses the `/api/generatetoaddress` endpoint:

```javascript
const address = await bitcoinApi.getNewAddress(network);
const hashes = await bitcoinApi.generateToAddress(5, address, network);
```

**Backend Call:**
```bash
bitcoin-cli -regtest getnewaddress
bitcoin-cli -regtest generatetoaddress 5 <address>
```

## Error Handling

**Not on regtest:**
```
⚠️ Mining only available on regtest network
```

**API disconnected:**
```
⚠️ Bitcoin API not connected
```

**Mining failure:**
```
✗ Failed to mine blocks: [error message]
```

## Example Workflow

### Complete Timelock Test Flow

1. **Start servers:**
   ```bash
   ./start-all.sh
   ```

2. **Initialize wallet**

3. **Check current height:**
   - Shows: 100

4. **Create timelock at height 105**

5. **Copy lockup address**

6. **Fund address:**
   ```bash
   bitcoin-cli -regtest sendtoaddress <address> 0.001
   ```

7. **Mine to confirm:**
   - Click "⛏️ Mine 5 Blocks"
   - Transaction confirmed

8. **Select timelock to unlock:**
   - UTXOs auto-scan
   - Form auto-fills

9. **Unlock timelock:**
   - Transaction signs and broadcasts
   - Click "⛏️ Mine 5 Blocks" again to confirm

10. **Done!** ✨

## Benefits

✅ **No command line needed** - Everything in the UI  
✅ **Instant feedback** - See block height update immediately  
✅ **Multiple uses** - Advance blockchain, confirm txs, test timelocks  
✅ **Safe** - Only works on regtest (can't accidentally mine on mainnet!)  
✅ **Convenient** - One click to advance 5 blocks  

## Technical Details

### Code Location
`client/src/App.jsx` - `handleMineBlocks()` function

### Network Check
```javascript
if (network !== 'regtest') {
  showMessage('Mining only available on regtest network', 'error');
  return;
}
```

### API Call
```javascript
const address = await bitcoinApi.getNewAddress(network);
const hashes = await bitcoinApi.generateToAddress(5, address, network);
await fetchBlockHeight(); // Refresh after mining
```

### Proxy Endpoint
```javascript
// POST /api/generatetoaddress
app.post('/api/generatetoaddress', async (req, res) => {
  const { blocks, address } = req.body;
  const result = await bitcoinCli(`generatetoaddress ${blocks} ${address}`, network);
  res.json({ success: true, blockhashes: JSON.parse(result) });
});
```

## Why 5 Blocks?

- **Good balance** between too few and too many
- **Enough for confirmations** (most wallets want 1-6)
- **Fast on regtest** (instant generation)
- **Reasonable for testing** timelocks a few blocks ahead

You can easily change this by clicking multiple times:
- 1 click = 5 blocks
- 2 clicks = 10 blocks
- 3 clicks = 15 blocks
- etc.

## Future Enhancements

Possible improvements:
- [ ] Configurable block count (slider or input)
- [ ] Show block hashes after mining
- [ ] Auto-mine until timelock height
- [ ] Batch mine with confirmation
- [ ] Show mining rewards in wallet

## Summary

The "Mine 5 Blocks" button makes regtest testing **effortless**. No more switching to terminal to run `bitcoin-cli generatetoaddress`. Just click and go! 🚀

Perfect for:
- 🧪 Testing timelocks
- ✅ Confirming transactions
- ⏩ Advancing the blockchain
- 🎯 Quick development iterations
