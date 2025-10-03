# Fixed: querySelector Invalid Selector Error

## Problem

Line 692 had an invalid CSS selector:
```javascript
document.querySelector('.card:has(h2:contains("Unlock"))')
```

**Error:**
```
Uncaught SyntaxError: Failed to execute 'querySelector' on 'Document': 
'.card:has(h2:contains("Unlock"))' is not a valid selector.
```

## Issue

The selector used two pseudo-classes that aren't valid in `querySelector`:
- `:has()` - Not widely supported in querySelector (CSS4)
- `:contains()` - Not a valid CSS selector (jQuery only)

## Solution

Changed to use an ID-based approach:

### 1. Added ID to Unlock Section
```javascript
<div id="unlock-timelock-section" className="card">
  <h2>🔓 Unlock Timelock</h2>
```

### 2. Updated Scroll Logic
```javascript
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
```

## Why This Works

✅ **`getElementById` is faster and more reliable** than complex selectors  
✅ **Always supported** - works in all browsers  
✅ **More maintainable** - explicit targeting  
✅ **Safe** - checks if element exists before scrolling  
✅ **Smooth animation** - uses `behavior: 'smooth'`  

## About the "Missing Required Fields" Message

This is **working as intended**! The validation shows:
```
Missing required fields: {unlockTxid: "", unlockVout: 0, unlockAmount: 0.001}
```

This means:
- ✅ The button IS working
- ✅ Validation is working
- ❌ The timelock needs to be funded first

## To Fix "Missing Required Fields"

You need to fund the timelock address first:

### 1. Create a timelock
### 2. Copy the lockup address
### 3. Fund it:
```bash
bitcoin-cli -regtest sendtoaddress <lockup-address> 0.001
bitcoin-cli -regtest generatetoaddress 1 $(bitcoin-cli -regtest getnewaddress)
```

### 4. Click "Select to Unlock"
- The app will automatically scan for UTXOs
- Form fields will auto-fill with txid, vout, amount

### 5. Click "Unlock Timelock"
- Transaction will sign and broadcast

## Summary

✅ **Fixed:** querySelector invalid selector error  
✅ **Changed:** Complex CSS selector → Simple ID lookup  
✅ **Added:** ID to unlock section for reliable targeting  
✅ **Improved:** setTimeout to ensure smooth scrolling  

The "Missing required fields" error is actually showing that the validation is working correctly! You just need to fund the timelock first. 🎯
