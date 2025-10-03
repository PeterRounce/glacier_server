/**
 * Bitcoin Wallet Service
 * All wallet logic runs client-side
 */

import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

// Initialize BIP32 with elliptic curve
const BIP32Factory = bip32.BIP32Factory;
const bip32Instance = BIP32Factory(ecc);

// Wallet state
let walletState = {
  mnemonic: null,
  seed: null,
  lockupAccount: null,
  releasedAccount: null,
  lockupIndex: 0,
  releasedIndex: 0,
  timelocks: [],
  network: null,
  networkName: 'regtest',
};

// ============================================================================
// BITCOIN UTILITY FUNCTIONS
// ============================================================================

function hash160(data) {
  const sha256 = bitcoin.crypto.sha256(data);
  const ripemd160 = bitcoin.crypto.ripemd160(sha256);
  return ripemd160;
}

function hash256(data) {
  return bitcoin.crypto.hash256(data);
}

function base58Encode(data) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + Buffer.from(data).toString('hex'));
  
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
  const coinType = network === bitcoin.networks.bitcoin ? 0 : 1;
  return root.derivePath(`m/84'/${coinType}'/0'`);
}

function getReleasedAccount(seed, network) {
  const root = bip32Instance.fromSeed(seed, network);
  const coinType = network === bitcoin.networks.bitcoin ? 0 : 1;
  return root.derivePath(`m/84'/${coinType}'/1'`);
}

function deriveLockupAddress(lockupAccount, index, network) {
  const node = lockupAccount.derive(0).derive(index);
  const address = deriveAddress(node, network);
  const coinType = network === bitcoin.networks.bitcoin ? 0 : 1;
  
  return {
    path: `m/84'/${coinType}'/0'/0/${index}`,
    address: address,
    publicKey: node.publicKey.toString('hex'),
    publicKeyBuffer: node.publicKey,
    privateKey: node.toWIF()
  };
}

function deriveReleasedAddress(releasedAccount, index, network) {
  const node = releasedAccount.derive(0).derive(index);
  const address = deriveAddress(node, network);
  const coinType = network === bitcoin.networks.bitcoin ? 0 : 1;
  
  return {
    path: `m/84'/${coinType}'/1'/0/${index}`,
    address: address,
    publicKey: node.publicKey.toString('hex'),
    publicKeyBuffer: node.publicKey,
    privateKey: node.toWIF()
  };
}

// ============================================================================
// TIMELOCK FUNCTIONS
// ============================================================================

function createSecureTimelockScript(blockHeight, pubkeyHash) {
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
    version = Buffer.from([0xc4]);
  } else {
    version = Buffer.from([0xc4]); // testnet
  }
  const payload = Buffer.concat([version, scriptHash]);
  const checksum = hash256(payload).subarray(0, 4);
  return base58Encode(Buffer.concat([payload, checksum]));
}

// ============================================================================
// PUBLIC API
// ============================================================================

export const walletService = {
  /**
   * Initialize wallet
   */
  initWallet(mnemonic = null, mainnet = false, networkParam = 'regtest') {
    let finalMnemonic;
    if (mnemonic) {
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }
      finalMnemonic = mnemonic;
    } else {
      finalMnemonic = bip39.generateMnemonic(256); // 24 words
    }
    
    const seed = bip39.mnemonicToSeedSync(finalMnemonic);
    let network;
    
    if (networkParam === 'regtest') {
      network = bitcoin.networks.regtest;
    } else if (networkParam === 'testnet' || mainnet === false) {
      network = bitcoin.networks.testnet;
    } else {
      network = bitcoin.networks.bitcoin;
    }
    
    walletState.mnemonic = finalMnemonic;
    walletState.seed = seed;
    walletState.lockupAccount = getLockupAccount(seed, network);
    walletState.releasedAccount = getReleasedAccount(seed, network);
    walletState.lockupIndex = 0;
    walletState.releasedIndex = 0;
    walletState.timelocks = [];
    walletState.network = network;
    walletState.networkName = networkParam;
    
    return {
      success: true,
      mnemonic: finalMnemonic,
      network: networkParam,
    };
  },

  /**
   * Get wallet status
   */
  getStatus() {
    if (!walletState.mnemonic) {
      throw new Error('Wallet not initialized');
    }
    
    return {
      initialized: true,
      network: walletState.networkName,
      lockupIndex: walletState.lockupIndex,
      releasedIndex: walletState.releasedIndex,
      totalTimelocks: walletState.timelocks.length,
    };
  },

  /**
   * Get next lockup address
   */
  getLockupAddress() {
    if (!walletState.lockupAccount) {
      throw new Error('Wallet not initialized');
    }
    
    const addressInfo = deriveLockupAddress(
      walletState.lockupAccount,
      walletState.lockupIndex,
      walletState.network
    );
    
    return {
      ...addressInfo,
      index: walletState.lockupIndex,
    };
  },

  /**
   * Get next released address
   */
  getReleasedAddress() {
    if (!walletState.releasedAccount) {
      throw new Error('Wallet not initialized');
    }
    
    const addressInfo = deriveReleasedAddress(
      walletState.releasedAccount,
      walletState.releasedIndex,
      walletState.network
    );
    
    return {
      ...addressInfo,
      index: walletState.releasedIndex,
    };
  },

  /**
   * Create a timelock
   */
  createTimelock(blockHeight) {
    if (!walletState.lockupAccount) {
      throw new Error('Wallet not initialized');
    }
    
    // Derive addresses
    const lockupInfo = deriveLockupAddress(
      walletState.lockupAccount,
      walletState.lockupIndex,
      walletState.network
    );
    
    const releasedInfo = deriveReleasedAddress(
      walletState.releasedAccount,
      walletState.releasedIndex,
      walletState.network
    );
    
    // Create timelock script
    const pubkey = lockupInfo.publicKeyBuffer;
    const pubkeyHash = hash160(pubkey);
    const redeemScript = createSecureTimelockScript(blockHeight, pubkeyHash);
    const p2shAddress = createP2SHAddress(redeemScript, walletState.network);
    
    // Store timelock
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
    
    return {
      success: true,
      timelock: timelockInfo
    };
  },

  /**
   * Get all timelocks
   */
  getTimelocks() {
    if (!walletState.mnemonic) {
      throw new Error('Wallet not initialized');
    }
    
    return walletState.timelocks;
  },

  /**
   * Unlock a timelock
   */
  unlockTimelock(timelockId, txid, vout, amountBTC, feeSatoshis = 1000) {
    const timelock = walletState.timelocks[timelockId];
    if (!timelock) {
      throw new Error('Timelock not found');
    }
    
    const amountSatoshis = Math.floor(amountBTC * 100000000);
    const outputAmount = amountSatoshis - feeSatoshis;
    
    if (outputAmount <= 0) {
      throw new Error('Fee is too high');
    }
    
    // Get nodes
    const network = walletState.network;
    const lockupNode = walletState.lockupAccount.derive(0).derive(timelock.lockupIndex);
    const releasedNode = walletState.releasedAccount.derive(0).derive(timelock.releasedIndex);
    
    // Create released address payment
    const releasedPayment = bitcoin.payments.p2wpkh({
      pubkey: releasedNode.publicKey,
      network: network
    });
    
    // Get redeem script
    const redeemScript = Buffer.from(timelock.redeemScript, 'hex');
    
    // Build transaction
    const tx = new bitcoin.Transaction();
    tx.version = 2;
    tx.locktime = timelock.blockHeight;
    
    // Add input
    tx.addInput(Buffer.from(txid, 'hex').reverse(), vout, 0xfffffffe);
    
    // Add output (must be a regular Number, not BigInt)
    tx.addOutput(releasedPayment.output, outputAmount);
    
    // Sign
    const hashType = bitcoin.Transaction.SIGHASH_ALL;
    const signatureHash = tx.hashForSignature(0, redeemScript, hashType);
    const signature = lockupNode.sign(signatureHash);
    const signatureWithHashType = bitcoin.script.signature.encode(signature, hashType);
    
    // Build scriptSig
    const scriptSig = bitcoin.script.compile([
      signatureWithHashType,
      lockupNode.publicKey,
      redeemScript
    ]);
    
    tx.ins[0].script = scriptSig;
    
    const txHex = tx.toHex();
    const txId = tx.getId();
    
    // Update timelock status
    timelock.status = 'unlocked';
    timelock.unlockedAt = new Date().toISOString();
    timelock.unlockingTxid = txId;
    
    return {
      success: true,
      signedTransaction: txHex,
      txid: txId,
      blockHeight: timelock.blockHeight,
      from: timelock.p2shAddress,
      to: releasedPayment.address,
      amountSatoshis: outputAmount,
      feeSatoshis
    };
  },

  /**
   * Export wallet state (for backup)
   */
  exportState() {
    return {
      mnemonic: walletState.mnemonic,
      network: walletState.networkName,
      lockupIndex: walletState.lockupIndex,
      releasedIndex: walletState.releasedIndex,
      timelocks: walletState.timelocks
    };
  },

  /**
   * Import wallet state (from backup)
   */
  importState(state) {
    this.initWallet(state.mnemonic, false, state.network);
    walletState.lockupIndex = state.lockupIndex || 0;
    walletState.releasedIndex = state.releasedIndex || 0;
    walletState.timelocks = state.timelocks || [];
  }
};

// Export individual functions for convenience
export const initWallet = walletService.initWallet.bind(walletService);
export const createTimelock = walletService.createTimelock.bind(walletService);
export const unlockTimelock = walletService.unlockTimelock.bind(walletService);
export const getTimelocks = walletService.getTimelocks.bind(walletService);
export const getStatus = walletService.getStatus.bind(walletService);
export const exportState = walletService.exportState.bind(walletService);
export const importState = walletService.importState.bind(walletService);
