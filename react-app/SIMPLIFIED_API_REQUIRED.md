# Simplified: Bitcoin API Required

## Changes Made

The app has been simplified to **require the Bitcoin API** instead of supporting manual fallback modes. This makes the UX cleaner and aligns with the assumption that bitcoind will always be available.

## What Changed

### 1. **Removed Manual Fallback**
- ❌ No more manual block height entry
- ❌ No more toggle for auto-fetch (always on)
- ✅ Clear error messages when API is disconnected
- ✅ Disabled buttons when API is unavailable

### 2. **Simplified Connection Status**
**Before:**
```
Bitcoin API: ✓ Connected
☑ Auto-fetch block height
```

**After:**
```
Bitcoin API: ✓ Connected (auto-updating)
```

### 3. **Simplified Block Height Display**
**Before:**
- Showed different states (auto-updating, paused, manual mode)
- Had manual input field as fallback
- Toggle checkbox for auto-fetch

**After:**
- Shows "Auto-updating every 10s" when connected
- Shows "Waiting for Bitcoin API" when disconnected
- No manual input, no toggles - just clean status

### 4. **Create Timelock Protection**
**New behavior:**
- Button disabled when API disconnected
- Shows warning: "⚠️ Bitcoin API Required: Start the proxy server to create timelocks"
- Button text changes to "Waiting for Bitcoin API..." when disconnected
- Only works when block height is available

## User Experience

### When API is Connected ✅
1. Green badge shows "✓ Connected (auto-updating)"
2. Block height displays and updates every 10 seconds
3. All features work normally
4. Seamless experience

### When API is Disconnected ❌
1. Red badge shows "✗ Disconnected - Start proxy server to continue"
2. Block height shows "Waiting for connection..."
3. Create timelock button is disabled
4. Clear error message: "⚠️ Bitcoin API Required"
5. User knows exactly what to do: start the proxy server

## Running the App

Always start both servers together:

```bash
cd /home/user/hack25/glacier_server/react-app
./start-all.sh
```

This ensures:
- Bitcoin API Proxy runs on port 3001
- React App runs on port 5173
- Both are ready simultaneously
- Clean shutdown with Ctrl+C

## Architecture

```
React App (Required) ←→ Bitcoin API Proxy (Required) ←→ Bitcoin Core (Required)
```

All three components must be running for the app to work.

## Code Changes

### Removed State
```javascript
// Removed:
const [autoFetchEnabled, setAutoFetchEnabled] = useState(true);
```

### Simplified fetchBlockHeight
```javascript
// Before: checked autoFetchEnabled
if (!apiConnected || !autoFetchEnabled) return;

// After: always runs when connected
if (!apiConnected) return;
```

### Simplified useEffect
```javascript
// Before: dependency on autoFetchEnabled
useEffect(() => {
  if (walletInitialized && apiConnected && autoFetchEnabled) {
    // ...
  }
}, [walletInitialized, apiConnected, autoFetchEnabled, network]);

// After: simpler dependencies
useEffect(() => {
  if (walletInitialized && apiConnected) {
    // ...
  }
}, [walletInitialized, apiConnected, network]);
```

### Added Button Protection
```javascript
<button 
  className="button" 
  onClick={handleCreateTimelock}
  disabled={!apiConnected || currentBlockHeight === null}
>
  {apiConnected ? 'Create Timelock' : 'Waiting for Bitcoin API...'}
</button>
```

## Benefits

✅ **Simpler code** - No manual fallback logic  
✅ **Clearer UX** - User knows API is required  
✅ **Less confusion** - No mixed modes  
✅ **Better error handling** - Clear messages when disconnected  
✅ **Aligned with requirements** - bitcoind always available  

## Testing

1. **Start both servers:**
   ```bash
   ./start-all.sh
   ```

2. **Verify green badge** - Should show "Connected (auto-updating)"

3. **Test disconnection:**
   - Stop proxy server (Ctrl+C in Terminal 1)
   - UI should show red badge
   - Create timelock button should be disabled
   - Error message should appear

4. **Restart proxy:**
   - UI should reconnect automatically within 30 seconds
   - Green badge returns
   - All features work again

## Summary

The app now has a **cleaner, more straightforward UX** that assumes the Bitcoin API will always be available. When it's not, the app clearly indicates what's wrong and what the user needs to do. No more confusing manual modes or fallback options!

🎯 **Result:** Simpler code, clearer UX, better aligned with your requirements.
