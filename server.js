/**
 * BIP32 Timelock Wallet API Server
 * HD wallet with separate accounts for lock-up and released funds
 * 
 * Install dependencies:
 * npm install express bip32 bip39 tiny-secp256k1 bitcoinjs-lib
 * 
 * Run:
 * node server.js
 */

const express = require('express');
const crypto = require('crypto');
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');

// Initialize BIP32 with elliptic curve
const BIP32Factory = bip32.default || bip32.BIP32Factory;
const bip32Instance = BIP32Factory(ecc);

const app = express();
app.use(express.json());

const PORT = 3000;

// In-memory wallet storage (use database in production)
let walletState = {
  mnemonic: null,
  seed: null,
  lockupAccount: null,
  releasedAccount: null,
  lockupIndex: 0,
  releasedIndex: 0,
  timelocks: []
};

// ============================================================================
// BITCOIN UTILITY FUNCTIONS
// ============================================================================

function hash160(data) {
  const sha = crypto.createHash('sha256').update(data).digest();
  const ripe = crypto.createHash('ripemd160').update(sha).digest();
  return ripe;
}

function hash256(data) {
  return crypto.createHash('sha256')
    .update(crypto.createHash('sha256').update(data).digest())
    .digest();
}

function base58Encode(data) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + data.toString('hex'));
  
  if (num === 0n) return alphabet[0];
  
  let result = '';
  while (num > 0n) {
    const remainder = num % 58n;
    num = num / 58n;
    result = alphabet[Number(remainder)] + result;
  }
  
  for (const byte of data) {
    if (byte === 0) result = alphabet[0] + result;
    else break;
  }
  
  return result;
}

function encodeVarint(i) {
  if (i < 0xfd) {
    return Buffer.from([i]);
  } else if (i <= 0xffff) {
    const buf = Buffer.alloc(3);
    buf.writeUInt8(0xfd, 0);
    buf.writeUInt16LE(i, 1);
    return buf;
  } else if (i <= 0xffffffff) {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(0xfe, 0);
    buf.writeUInt32LE(i, 1);
    return buf;
  } else {
    const buf = Buffer.alloc(9);
    buf.writeUInt8(0xff, 0);
    buf.writeBigUInt64LE(BigInt(i), 1);
    return buf;
  }
}

// ============================================================================
// BIP32 HD WALLET FUNCTIONS
// ============================================================================

function deriveAddress(node, network) {
  const payment = bitcoin.payments.p2wpkh({
    pubkey: node.publicKey,
    network: network
  });
  return payment.address;
}

function getLockupAccount(seed, network) {
  const root = bip32Instance.fromSeed(seed, network);
  // m/84'/0'/0' - Lock-up Account (m/84'/1'/0' for testnet)
  const coinType = network === bitcoin.networks.bitcoin ? 0 : 1;
  return root.derivePath(`m/84'/${coinType}'/0'`);
}

function getReleasedAccount(seed, network) {
  const root = bip32Instance.fromSeed(seed, network);
  // m/84'/0'/1' - Released-funds Account (m/84'/1'/1' for testnet)
  const coinType = network === bitcoin.networks.bitcoin ? 0 : 1;
  return root.derivePath(`m/84'/${coinType}'/1'`);
}

function deriveLockupAddress(lockupAccount, index, network) {
  // m/84'/0'/0'/0/index
  const node = lockupAccount.derive(0).derive(index);
  const address = deriveAddress(node, network);
  const pubkeyHex = node.publicKey.toString('hex');
  return {
    path: `m/84'/0'/0'/0/${index}`,
    address: address,
    publicKey: pubkeyHex,
    publicKeyBuffer: node.publicKey, // Keep buffer for internal use
    privateKey: node.toWIF()
  };
}

function deriveReleasedAddress(releasedAccount, index, network) {
  // m/84'/0'/1'/0/index
  const node = releasedAccount.derive(0).derive(index);
  const address = deriveAddress(node, network);
  const pubkeyHex = node.publicKey.toString('hex');
  return {
    path: `m/84'/0'/1'/0/${index}`,
    address: address,
    publicKey: pubkeyHex,
    publicKeyBuffer: node.publicKey, // Keep buffer for internal use
    privateKey: node.toWIF()
  };
}

// ============================================================================
// TIMELOCK FUNCTIONS (SECURE VERSION WITH PREDEFINED RECIPIENT)
// ============================================================================

function createSecureTimelockScript(blockHeight, pubkeyHash) {
  /**
   * Creates a SECURE timelock script locked to a specific recipient
   * Script: <block_height> OP_CHECKLOCKTIMEVERIFY OP_DROP 
   *         OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG
   */
  const parts = [];
  
  // Push block height (minimal encoding)
  if (blockHeight <= 0x7f) {
    const buf = Buffer.alloc(2);
    buf.writeUInt8(0x01, 0);
    buf.writeUInt8(blockHeight, 1);
    parts.push(buf);
  } else if (blockHeight <= 0x7fff) {
    const buf = Buffer.alloc(3);
    buf.writeUInt8(0x02, 0);
    buf.writeUInt16LE(blockHeight, 1);
    parts.push(buf);
  } else if (blockHeight <= 0x7fffff) {
    const buf = Buffer.alloc(4);
    buf.writeUInt8(0x03, 0);
    buf.writeUIntLE(blockHeight, 1, 3);
    parts.push(buf);
  } else {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(0x04, 0);
    buf.writeUInt32LE(blockHeight, 1);
    parts.push(buf);
  }
  
  parts.push(Buffer.from([0xb1]));  // OP_CHECKLOCKTIMEVERIFY
  parts.push(Buffer.from([0x75]));  // OP_DROP
  parts.push(Buffer.from([0x76]));  // OP_DUP
  parts.push(Buffer.from([0xa9]));  // OP_HASH160
  parts.push(Buffer.from([0x14]));  // Push 20 bytes
  parts.push(pubkeyHash);           // Recipient's pubkey hash
  parts.push(Buffer.from([0x88]));  // OP_EQUALVERIFY
  parts.push(Buffer.from([0xac]));  // OP_CHECKSIG
  
  return Buffer.concat(parts);
}

function createP2SHAddress(redeemScript, network) {
  const scriptHash = hash160(redeemScript);
  let version;
  if (network === bitcoin.networks.bitcoin) {
    version = Buffer.from([0x05]);
  } else if (network === bitcoin.networks.regtest) {
    version = Buffer.from([0xc4]); // Same as testnet
  } else {
    version = Buffer.from([0xc4]); // testnet
  }
  const payload = Buffer.concat([version, scriptHash]);
  const checksum = hash256(payload).subarray(0, 4);
  return base58Encode(Buffer.concat([payload, checksum]));
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /api/wallet/init
 * Initialize wallet with new or existing mnemonic
 */
app.post('/api/wallet/init', (req, res) => {
  try {
    const { mnemonic, mainnet = true, network: networkParam = null } = req.body;
    
    let finalMnemonic;
    if (mnemonic) {
      if (!bip39.validateMnemonic(mnemonic)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid mnemonic phrase'
        });
      }
      finalMnemonic = mnemonic;
    } else {
      finalMnemonic = bip39.generateMnemonic(256); // 24 words
    }
    
    const seed = bip39.mnemonicToSeedSync(finalMnemonic);
    let network;
    let actualMainnet;
    if (networkParam === 'regtest') {
      network = bitcoin.networks.regtest;
      actualMainnet = false;
    } else if (networkParam === 'testnet' || mainnet === false) {
      network = bitcoin.networks.testnet;
      actualMainnet = false;
    } else {
      network = bitcoin.networks.bitcoin;
      actualMainnet = true;
    }
    
    walletState.mnemonic = finalMnemonic;
    walletState.seed = seed;
    walletState.lockupAccount = getLockupAccount(seed, network);
    walletState.releasedAccount = getReleasedAccount(seed, network);
    walletState.lockupIndex = 0;
    walletState.releasedIndex = 0;
    walletState.timelocks = [];
    walletState.network = network;
    walletState.mainnet = actualMainnet;
    walletState.networkName = networkParam || (actualMainnet ? 'mainnet' : 'testnet');
    
    res.json({
      success: true,
      data: {
        mnemonic: finalMnemonic,
        network: walletState.networkName,
        accounts: {
          lockup: "m/84'/0'/0'",
          released: "m/84'/0'/1'"
        },
        warning: '⚠️  BACKUP THIS MNEMONIC! Without it, you cannot recover your funds.'
      }
    });
  } catch (error) {
    console.error('Error in /api/wallet/init:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/wallet/status
 * Get current wallet status
 */
app.get('/api/wallet/status', (req, res) => {
  if (!walletState.mnemonic) {
    return res.status(400).json({
      success: false,
      error: 'Wallet not initialized. Call POST /api/wallet/init first.'
    });
  }
  
  res.json({
    success: true,
    data: {
      initialized: true,
      network: walletState.networkName || (walletState.mainnet ? 'mainnet' : 'testnet'),
      lockupIndex: walletState.lockupIndex,
      releasedIndex: walletState.releasedIndex,
      totalTimelocks: walletState.timelocks.length,
      accounts: {
        lockup: "m/84'/0'/0'",
        released: "m/84'/0'/1'"
      }
    }
  });
});

/**
 * GET /api/wallet/lockup-address
 * Get next unused lock-up address
 */
app.get('/api/wallet/lockup-address', (req, res) => {
  if (!walletState.lockupAccount) {
    return res.status(400).json({
      success: false,
      error: 'Wallet not initialized'
    });
  }
  
  try {
    const addressInfo = deriveLockupAddress(
      walletState.lockupAccount,
      walletState.lockupIndex,
      walletState.network
    );
    
    res.json({
      success: true,
      data: {
        ...addressInfo,
        index: walletState.lockupIndex,
        account: 'Lock-up Account',
        note: 'This address will be the recipient of timelocked funds'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/wallet/released-address
 * Get next unused released-funds address
 */
app.get('/api/wallet/released-address', (req, res) => {
  if (!walletState.releasedAccount) {
    return res.status(400).json({
      success: false,
      error: 'Wallet not initialized'
    });
  }
  
  try {
    const addressInfo = deriveReleasedAddress(
      walletState.releasedAccount,
      walletState.releasedIndex,
      walletState.network
    );
    
    res.json({
      success: true,
      data: {
        ...addressInfo,
        index: walletState.releasedIndex,
        account: 'Released-funds Account',
        note: 'This address will receive funds after timelock expires'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/wallet/create-timelock
 * Create a new timelock using HD wallet derivation
 */
app.post('/api/wallet/create-timelock', (req, res) => {
  if (!walletState.lockupAccount) {
    return res.status(400).json({
      success: false,
      error: 'Wallet not initialized'
    });
  }
  
  try {
    const { blockHeight } = req.body;
    
    if (!blockHeight || typeof blockHeight !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'blockHeight is required and must be a number'
      });
    }
    
    // Derive lock-up address (recipient)
    const lockupInfo = deriveLockupAddress(
      walletState.lockupAccount,
      walletState.lockupIndex,
      walletState.network
    );
    
    // Derive released-funds address (destination)
    const releasedInfo = deriveReleasedAddress(
      walletState.releasedAccount,
      walletState.releasedIndex,
      walletState.network
    );
    
    // Get pubkey hash for the lock-up address
    // Always use the buffer directly
    const pubkey = lockupInfo.publicKeyBuffer;
    const pubkeyHash = hash160(pubkey);
    
    // Create SECURE timelock script with predefined recipient
    const redeemScript = createSecureTimelockScript(blockHeight, pubkeyHash);
    
    // Create P2SH address
    const p2shAddress = createP2SHAddress(redeemScript, walletState.network);
    
    // Store timelock info
    const timelockInfo = {
      id: walletState.timelocks.length,
      lockupPath: lockupInfo.path,
      lockupAddress: lockupInfo.address,
      lockupIndex: walletState.lockupIndex,
      releasedPath: releasedInfo.path,
      releasedAddress: releasedInfo.address,
      releasedIndex: walletState.releasedIndex,
      p2shAddress,
      redeemScript: redeemScript.toString('hex'),
      blockHeight,
      status: 'created',
      createdAt: new Date().toISOString()
    };
    
    walletState.timelocks.push(timelockInfo);
    walletState.lockupIndex++;
    walletState.releasedIndex++;
    
    res.json({
      success: true,
      data: {
        timelockId: timelockInfo.id,
        p2shAddress,
        blockHeight,
        redeemScript: redeemScript.toString('hex'),
        lockup: {
          path: lockupInfo.path,
          address: lockupInfo.address,
          note: 'Only this address can unlock the funds'
        },
        released: {
          path: releasedInfo.path,
          address: releasedInfo.address,
          note: 'Funds will be sent here when unlocked'
        },
        instructions: [
          `1. Send BTC to: ${p2shAddress}`,
          `2. After block ${blockHeight}, unlock using timelock ID ${timelockInfo.id}`,
          '3. Funds will automatically go to the released-funds address',
          '4. 🔒 SECURE: Only your lock-up key can unlock these funds'
        ]
      }
    });
  } catch (error) {
    console.error('Error in /api/wallet/create-timelock:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/wallet/timelocks
 * List all timelocks
 */
app.get('/api/wallet/timelocks', (req, res) => {
  if (!walletState.mnemonic) {
    return res.status(400).json({
      success: false,
      error: 'Wallet not initialized'
    });
  }
  
  res.json({
    success: true,
    data: {
      total: walletState.timelocks.length,
      timelocks: walletState.timelocks.map(t => ({
        id: t.id,
        p2shAddress: t.p2shAddress,
        blockHeight: t.blockHeight,
        lockupAddress: t.lockupAddress,
        releasedAddress: t.releasedAddress,
        status: t.status,
        createdAt: t.createdAt
      }))
    }
  });
});

/**
 * GET /api/wallet/timelock/:id
 * Get details of a specific timelock
 */
app.get('/api/wallet/timelock/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const timelock = walletState.timelocks[id];
  
  if (!timelock) {
    return res.status(404).json({
      success: false,
      error: 'Timelock not found'
    });
  }
  
  res.json({
    success: true,
    data: timelock
  });
});

/**
 * POST /api/wallet/unlock-timelock
 * Create a transaction to unlock a specific timelock
 */
app.post('/api/wallet/unlock-timelock', (req, res) => {
  try {
    const { timelockId, txid, vout, amountBTC, feeSatoshis = 1000 } = req.body;
    
    if (timelockId === undefined || !txid || vout === undefined || !amountBTC) {
      return res.status(400).json({
        success: false,
        error: 'timelockId, txid, vout, and amountBTC are required'
      });
    }
    
    const timelock = walletState.timelocks[timelockId];
    if (!timelock) {
      return res.status(404).json({
        success: false,
        error: 'Timelock not found'
      });
    }
    
    const amountSatoshis = Math.floor(amountBTC * 100000000);
    const outputAmount = amountSatoshis - feeSatoshis;
    
    if (outputAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Fee is too high'
      });
    }
    
    console.log('Creating unlock transaction:', {
      timelockId,
      txid,
      vout,
      amountSatoshis,
      outputAmount,
      feeSatoshis
    });
    
    // Get nodes
    const network = walletState.network;
    const lockupNode = walletState.lockupAccount.derive(0).derive(timelock.lockupIndex);
    const releasedNode = walletState.releasedAccount.derive(0).derive(timelock.releasedIndex);
    
    // Create released address payment
    const releasedPayment = bitcoin.payments.p2wpkh({
      pubkey: releasedNode.publicKey,
      network: network
    });
    
    console.log('Building transaction manually (P2SH does not work well with PSBT)...');
    
    // Get redeem script
    const redeemScript = Buffer.from(timelock.redeemScript, 'hex');
    
    console.log('Released address:', releasedPayment.address);
    console.log('Released output script:', releasedPayment.output.toString('hex'));
    
    // Build transaction manually
    const tx = new bitcoin.Transaction();
    tx.version = 2;
    tx.locktime = timelock.blockHeight;
    
    // Add input
    tx.addInput(Buffer.from(txid, 'hex').reverse(), vout, 0xfffffffe);
    
    // Add output - CRITICAL: Use BigInt for value
    tx.addOutput(releasedPayment.output, BigInt(outputAmount));
    
    console.log('Transaction built. Signing...');
    
    // Create signature hash
    const hashType = bitcoin.Transaction.SIGHASH_ALL;
    const signatureHash = tx.hashForSignature(0, redeemScript, hashType);
    
    // Sign and encode signature properly
    const signature = lockupNode.sign(signatureHash);
    // Use script.signature.encode to ensure DER encoding
    const signatureWithHashType = bitcoin.script.signature.encode(signature, hashType);
    
    // Build scriptSig: <signature> <pubkey> <redeemScript>
    const scriptSig = bitcoin.script.compile([
      signatureWithHashType,
      lockupNode.publicKey,
      redeemScript
    ]);
    
    tx.ins[0].script = scriptSig;
    
    const txHex = tx.toHex();
    
    console.log('Transaction signed successfully!');
    console.log('TXID:', tx.getId());
    
    // Update timelock status
    timelock.status = 'unlocked';
    timelock.unlockedAt = new Date().toISOString();
    timelock.unlockingTxid = tx.getId();
    
    res.json({
      success: true,
      data: {
        signedTransaction: txHex,
        txid: tx.getId(),
        blockHeight: timelock.blockHeight,
        from: timelock.p2shAddress,
        to: releasedPayment.address,
        amountSatoshis: outputAmount,
        feeSatoshis,
        instructions: [
          '✅ Transaction is SIGNED and ready to broadcast',
          `⏰ Only valid after block ${timelock.blockHeight}`,
          'Broadcast with: bitcoin-cli -regtest sendrawtransaction <hex>',
          'Or use mempool.space broadcast tool'
        ]
      }
    });
  } catch (error) {
    console.error('Error in /api/wallet/unlock-timelock:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/info
 * Get API information
 */
app.get('/api/info', (req, res) => {
  res.json({
    name: 'BIP32 Timelock Wallet API',
    version: '2.0.0',
    description: 'HD wallet with separate accounts for lock-up and released funds',
    features: [
      'BIP32/BIP39/BIP44 compliant',
      'Separate derivation paths for locked and released funds',
      'Secure timelocks with predefined recipients',
      'No address reuse',
      'Full wallet recovery from seed phrase'
    ],
    accounts: {
      'lockup': {
        path: "m/84'/0'/0'",
        purpose: 'Generate recipient addresses for timelocks'
      },
      'released': {
        path: "m/84'/0'/1'",
        purpose: 'Receive unlocked funds'
      }
    },
    endpoints: {
      'POST /api/wallet/init': 'Initialize wallet with mnemonic',
      'GET /api/wallet/status': 'Get wallet status',
      'GET /api/wallet/lockup-address': 'Get next lock-up address',
      'GET /api/wallet/released-address': 'Get next released-funds address',
      'POST /api/wallet/create-timelock': 'Create a new timelock',
      'GET /api/wallet/timelocks': 'List all timelocks',
      'GET /api/wallet/timelock/:id': 'Get timelock details',
      'POST /api/wallet/unlock-timelock': 'Unlock a timelock',
      'GET /api/info': 'This endpoint',
      'GET /api/health': 'Health check'
    }
  });
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    walletInitialized: !!walletState.mnemonic,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('  BIP32 TIMELOCK WALLET API SERVER');
  console.log('='.repeat(60));
  console.log(`\n✓ Server running on http://localhost:${PORT}`);
  console.log('\n📚 Key endpoints:');
  console.log(`   POST http://localhost:${PORT}/api/wallet/init`);
  console.log(`   POST http://localhost:${PORT}/api/wallet/create-timelock`);
  console.log(`   POST http://localhost:${PORT}/api/wallet/unlock-timelock`);
  console.log(`   GET  http://localhost:${PORT}/api/wallet/timelocks`);
  console.log(`   GET  http://localhost:${PORT}/api/info`);
  console.log('\n🔐 Features:');
  console.log('   • BIP32 HD wallet with separate accounts');
  console.log('   • Lock-up account: m/84\'/0\'/0\'');
  console.log('   • Released-funds account: m/84\'/0\'/1\'');
  console.log('   • Secure timelocks with predefined recipients');
  console.log('\n⚠️  Store your mnemonic safely - it\'s your only backup!\n');
  console.log('='.repeat(60) + '\n');
});

module.exports = app;