# Fixed: walletService.initWallet is not a function

## Problem

The error occurred because of a mismatch between the export and import patterns:

**In walletService.js:**
```javascript
export const walletService = {
  initWallet() { ... },
  createTimelock() { ... },
  // ...
};
```

**In App.jsx:**
```javascript
import * as walletService from './walletService';
walletService.initWallet(); // ❌ Error: not a function
```

With `import * as`, the functions were nested as `walletService.walletService.initWallet()`.

## Solution

Added individual named exports at the end of `walletService.js`:

```javascript
// Export individual functions for convenience
export const initWallet = walletService.initWallet.bind(walletService);
export const createTimelock = walletService.createTimelock.bind(walletService);
export const unlockTimelock = walletService.unlockTimelock.bind(walletService);
export const getTimelocks = walletService.getTimelocks.bind(walletService);
export const getStatus = walletService.getStatus.bind(walletService);
export const exportState = walletService.exportState.bind(walletService);
export const importState = walletService.importState.bind(walletService);
```

Now both import patterns work:

```javascript
// Pattern 1: Named imports
import { initWallet, createTimelock } from './walletService';
initWallet();

// Pattern 2: Namespace import (used in App.jsx)
import * as walletService from './walletService';
walletService.initWallet(); // ✅ Works!
```

## Status

✅ **Fixed!** The app should now work correctly. 

Try running the app:

```bash
cd /home/user/hack25/glacier_server/react-app/client
npx vite@5
```

Then open http://localhost:5173 and initialize your wallet.
